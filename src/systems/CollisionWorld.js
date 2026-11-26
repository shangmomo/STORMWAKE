// Ship-local collision queries. Static triangles are baked from the displayed
// meshes; a median BVH bounds the work to the swept capsule's neighbourhood.
// Floors remain owned by the existing measured walkmap/ladder graph.
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=x=>Math.max(0,Math.min(1,x));
const xyz=p=>[p.x,p.y,p.z];
function bounds(points){return {min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i])))};}
function overlap(a,b){return [0,1,2].every(i=>a.min[i]<=b.max[i]&&a.max[i]>=b.min[i]);}
function pointTriangle(p,a,b,c){
  const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
  if(d1<=0&&d2<=0)return a;
  const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);
  if(d3>=0&&d4<=d3)return b;
  const vc=d1*d4-d3*d2;
  if(vc<=0&&d1>=0&&d3<=0)return add(a,mul(ab,d1/(d1-d3)));
  const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);
  if(d6>=0&&d5<=d6)return c;
  const vb=d5*d2-d1*d6;
  if(vb<=0&&d2>=0&&d6<=0)return add(a,mul(ac,d2/(d2-d6)));
  const va=d3*d6-d5*d4;
  if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0)return add(b,mul(sub(c,b),(d4-d3)/(d4-d3+d5-d6)));
  const inv=1/(va+vb+vc);return add(a,add(mul(ab,vb*inv),mul(ac,vc*inv)));
}
function segmentPair(p,q,a,b){
  const d1=sub(q,p),d2=sub(b,a),r=sub(p,a),aa=dot(d1,d1),ee=dot(d2,d2),f=dot(d2,r);
  let s=0,t=0;
  if(aa<1e-12)t=clamp(f/ee);
  else {const cc=dot(d1,r);if(ee<1e-12)s=clamp(-cc/aa);
    else {const bb=dot(d1,d2),den=aa*ee-bb*bb;s=den?clamp((bb*f-cc*ee)/den):0;t=(bb*s+f)/ee;
      if(t<0){t=0;s=clamp(-cc/aa);}else if(t>1){t=1;s=clamp((bb-cc)/aa);}}}
  return [add(p,mul(d1,s)),add(a,mul(d2,t))];
}
function segmentTriangle(p,q,tri){
  const {a,b,c,n}=tri,d=sub(q,p),den=dot(n,d);
  if(Math.abs(den)>1e-10){const t=dot(n,sub(a,p))/den;
    if(t>=0&&t<=1){const hit=add(p,mul(d,t)),near=pointTriangle(hit,a,b,c);
      if(dot(sub(hit,near),sub(hit,near))<1e-12)return [hit,hit];}}
  let best=[p,pointTriangle(p,a,b,c)],ds=dot(sub(best[0],best[1]),sub(best[0],best[1]));
  for(const pair of [[q,pointTriangle(q,a,b,c)],segmentPair(p,q,a,b),segmentPair(p,q,b,c),segmentPair(p,q,c,a)]){
    const v=sub(pair[0],pair[1]),s=dot(v,v);if(s<ds){best=pair;ds=s;}}
  return best;
}
function build(tris){
  if(!tris.length)return null;
  const box={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(const t of tris)for(let i=0;i<3;i++){box.min[i]=Math.min(box.min[i],t.min[i]);box.max[i]=Math.max(box.max[i],t.max[i]);}
  if(tris.length<=12)return {...box,tris};
  const axis=[0,1,2].sort((a,b)=>(box.max[b]-box.min[b])-(box.max[a]-box.min[a]))[0];
  tris.sort((a,b)=>(a.min[axis]+a.max[axis])-(b.min[axis]+b.max[axis]));
  const m=tris.length>>1;return {...box,left:build(tris.slice(0,m)),right:build(tris.slice(m))};
}
export class CollisionWorld {
  constructor(triangles=[]){this.triangles=[];this.root=null;this.setTriangles(triangles);}
  setTriangles(triangles){
    this.triangles=triangles.map(t=>{const [a,b,c]=t.vertices||t,n=cross(sub(b,a),sub(c,a)),len=Math.hypot(...n);
      return {a,b,c,n:mul(n,1/(len||1)),...bounds([a,b,c]),id:t.id};}).filter(t=>dot(t.n,t.n)>.5);
    this.root=build(this.triangles.slice());return this;
  }
  // Yield on large authored environments, then publish the complete BVH in
  // one commit. Small synchronous ship worlds continue to use setTriangles.
  async setTrianglesAsync(triangles,{budget=9,yieldTask=()=>new Promise(r=>setTimeout(r,0))}={}){
    const staged=[];let until=performance.now()+budget;
    const checkpoint=async()=>{if(performance.now()>=until){await yieldTask();until=performance.now()+budget;}};
    for(const t of triangles){const [a,b,c]=t.vertices||t,n=cross(sub(b,a),sub(c,a)),len=Math.hypot(...n);if(len>1e-12&&Number.isFinite(len))staged.push({a,b,c,n:mul(n,1/len),...bounds([a,b,c]),id:t.id});if(staged.length%512===0)await checkpoint();}
    async function node(tris){if(!tris.length)return null;const box={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};let k=0;for(const t of tris){for(let i=0;i<3;i++){box.min[i]=Math.min(box.min[i],t.min[i]);box.max[i]=Math.max(box.max[i],t.max[i]);}if(++k%2048===0)await checkpoint();}if(tris.length<=12)return {...box,tris};const axis=[0,1,2].sort((a,b)=>(box.max[b]-box.min[b])-(box.max[a]-box.min[a]))[0];await checkpoint();tris.sort((a,b)=>(a.min[axis]+a.max[axis])-(b.min[axis]+b.max[axis]));await checkpoint();const m=tris.length>>1;return {...box,left:await node(tris.slice(0,m)),right:await node(tris.slice(m))};}
    const root=await node(staged.slice());this.triangles=staged;this.root=root;return this;
  }
  query(box){const found=[];const visit=node=>{if(!node||!overlap(box,node))return;
    if(node.tris){for(const tri of node.tris)if(overlap(box,tri))found.push(tri);}
    else{visit(node.left);visit(node.right);}};visit(this.root);return found;}
  capsuleOverlap(foot,radius=.3,height=1.75,tolerance=.008){
    if(![foot.x,foot.y,foot.z,radius,height].every(Number.isFinite))return true;
    const a=[foot.x,foot.y+radius,foot.z],b=[foot.x,foot.y+height-radius,foot.z],box=bounds([a,b]);for(let i=0;i<3;i++){box.min[i]-=radius;box.max[i]+=radius;}
    for(const tri of this.query(box)){const [p,q]=segmentTriangle(a,b,tri);if(Math.hypot(...sub(p,q))<radius-tolerance)return true;}
    return false;
  }
  sphereContact(center,radius=.65){
    if(!center||![center.x,center.y,center.z,radius].every(Number.isFinite)||radius<=0)return null;
    const p=xyz(center),box={min:p.map(v=>v-radius),max:p.map(v=>v+radius)};let best=null;
    for(const tri of this.query(box)){const q=pointTriangle(p,tri.a,tri.b,tri.c),distance=Math.hypot(...sub(p,q));if(distance<=radius&&(!best||distance<best.distance))best={point:{x:q[0],y:q[1],z:q[2]},distance,id:tri.id};}
    return best;
  }
  move(from,to,{radius=.215,height=.96,step=.10,skin=.003,dynamic=[]}={}){
    if(![from.x,from.y,from.z,to.x,to.y,to.z,radius,height].every(Number.isFinite)||radius<=0||height<2*radius)throw Error('Invalid capsule');
    let p=xyz(from),motion=sub(xyz(to),p);const contacts=[];
    for(let slide=0;slide<5&&Math.hypot(...motion)>1e-7;slide++){
      const end=add(p,motion),box=bounds([p,end]);for(let i=0;i<3;i++){box.min[i]-=radius+skin;box.max[i]+=radius+skin;}box.max[1]+=height;
      let hit=null;
      for(const tri of [...this.query(box),...dynamic.flatMap(world=>world.query(box))]){
        // Walkable upward/downward faces below the allowed step are handled
        // by foot support. Vertical walls and overhead beams remain solid.
        if(Math.abs(tri.n[1])>.65&&tri.max[1]<=from.y+step)continue;
        let t=0;
        const length=Math.hypot(...motion);
        for(let iteration=0;iteration<48;iteration++){
          const foot=add(p,mul(motion,t)),a=add(foot,[0,radius,0]),b=add(foot,[0,height-radius,0]);
          const pair=segmentTriangle(a,b,tri),delta=sub(pair[0],pair[1]),dist=Math.hypot(...delta);
          let normal=dist>1e-8?mul(delta,1/dist):tri.n;
          // A large sloped deck triangle may extend far above the local foot.
          // Classify the actual contact, not the triangle's distant highest vertex.
          if(Math.abs(tri.n[1])>.65&&normal[1]>.65&&pair[1][1]<=from.y+step)break;
          if(dist<1e-8&&dot(normal,motion)>0)normal=mul(normal,-1);
          if(dist<=radius+skin+1e-6){
            if(dot(normal,motion)<-1e-8&&(!hit||t<hit.t))hit={t,normal,id:tri.id};
            break;
          }
          t+=(dist-radius-skin)/length*.9;
          if(t>1||(hit&&t>hit.t))break;
        }
      }
      if(!hit){p=end;break;}
      p=add(p,mul(motion,Math.max(0,hit.t-1e-5)));contacts.push(hit);
      motion=mul(motion,1-hit.t);const inward=dot(motion,hit.normal);
      if(inward<0)motion=sub(motion,mul(hit.normal,inward));
    }
    return {x:p[0],y:p[1],z:p[2],contacts};
  }
  occluded(from,to){
    const p=xyz(from),q=xyz(to),d=sub(q,p);
    for(const tri of this.query(bounds([p,q]))){const den=dot(tri.n,d);if(Math.abs(den)<1e-9)continue;
      const t=dot(tri.n,sub(tri.a,p))/den;if(t<=.02||t>=.98)continue;
      const hit=add(p,mul(d,t)),near=pointTriangle(hit,tri.a,tri.b,tri.c);
      if(Math.hypot(...sub(hit,near))<1e-5)return true;
    }return false;
  }
  ceilingAt(x,z,minY,maxY=3.5){
    let height=null;
    for(const tri of this.query({min:[x-.001,minY,z-.001],max:[x+.001,maxY,z+.001]})){
      if(Math.abs(tri.n[1])<1e-5)continue;
      const y=tri.a[1]-(tri.n[0]*(x-tri.a[0])+tri.n[2]*(z-tri.a[2]))/tri.n[1];
      if(y<minY||y>maxY)continue;
      if(Math.hypot(...sub([x,y,z],pointTriangle([x,y,z],tri.a,tri.b,tri.c)))>.001)continue;
      if(height===null||y<height)height=y;
    }return height;
  }
  segmentHit(from,to,{minNormalY=0}={}){
    const a=[from.x,from.y,from.z],b=[to.x,to.y,to.z],delta=sub(b,a);let best=null;
    for(const tri of this.query({min:a.map((v,i)=>Math.min(v,b[i])-.001),max:a.map((v,i)=>Math.max(v,b[i])+.001)})){
      if(Math.abs(tri.n[1])<minNormalY)continue;const den=dot(tri.n,delta);if(Math.abs(den)<1e-10)continue;const t=dot(tri.n,sub(tri.a,a))/den;if(t<0||t>1||best&&t>=best.t)continue;const p=add(a,mul(delta,t));if(Math.hypot(...sub(p,pointTriangle(p,tri.a,tri.b,tri.c)))>.001)continue;best={x:p[0],y:p[1],z:p[2],t,normal:tri.n,id:tri.id};
    }return best;
  }
  floorAt(x,z,maxY,minY=-4){
    let height=null;
    for(const tri of this.query({min:[x-.001,minY,z-.001],max:[x+.001,maxY,z+.001]})){
      if(Math.abs(tri.n[1])<.65)continue;
      const y=tri.a[1]-(tri.n[0]*(x-tri.a[0])+tri.n[2]*(z-tri.a[2]))/tri.n[1];
      if(y<minY||y>maxY)continue;
      if(Math.hypot(...sub([x,y,z],pointTriangle([x,y,z],tri.a,tri.b,tri.c)))>.001)continue;
      if(height===null||y>height)height=y;
    }return height;
  }
  footprintFloorAt(x,z,radius,maxY,minY=-4){
    let height=null;
    for(const tri of this.query({min:[x-radius,minY,z-radius],max:[x+radius,maxY,z+radius]})){
      if(Math.abs(tri.n[1])<.65)continue;
      // Exact closest point in the tread's horizontal projection. Sparse
      // spokes miss narrow triangle corners and lower feet into the riser.
      const flat=p=>[p[0],0,p[2]],q=pointTriangle([x,0,z],flat(tri.a),flat(tri.b),flat(tri.c));
      if((q[0]-x)**2+(q[2]-z)**2>radius*radius)continue;
      const y=tri.a[1]-(tri.n[0]*(q[0]-tri.a[0])+tri.n[2]*(q[2]-tri.a[2]))/tri.n[1];
      if(y<minY||y>maxY)continue;
      if(height===null||y>height)height=y;
    }return height;
  }
  get stats(){return {triangles:this.triangles.length,bvh:!!this.root};}
}
