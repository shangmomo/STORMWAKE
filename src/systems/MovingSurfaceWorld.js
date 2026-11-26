import {Matrix4,Vector3} from '../engine/index.js';
import {CollisionWorld} from './CollisionWorld.js';
// A second ship shares the world rather than switching the player's scene.
export class MovingSurfaceWorld{
 constructor(root,{world=null}={}){this.root=root;if(world){this.world=world;return;}const triangles=[],v=new Vector3();root.updateWorldMatrix(true,true);const inverse=new Matrix4().copy(root.matrixWorld).invert();
  root.traverse(mesh=>{if(mesh.material?.transparent)return;const g=mesh.geometry,a=g?.attributes?.position;if(!a)return;const m=new Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),idx=g.index?.array,n=idx?.length??a.count;
   for(let i=0;i<n;i+=3){const vertices=[];for(let j=0;j<3;j++){v.fromBufferAttribute(a,idx?idx[i+j]:i+j).applyMatrix4(m);vertices.push([v.x,v.y,v.z]);}if(Math.min(...vertices.map(p=>p[1]))<4)triangles.push({vertices,id:mesh.name});}
  });this.world=new CollisionWorld(triangles);
 }
 local(p){return this.root.worldToLocal(new Vector3(p.x,p.y,p.z));}
 global(p){return this.root.localToWorld(new Vector3(p.x,p.y,p.z));}
 // The land motor combines all triangle worlds by query(). Transform the
 // swept AABB into the vessel's local BVH, then return world-space triangles.
 query(box){
  if(!this.root.visible||!box?.min||!box?.max)return [];
  this.root.updateWorldMatrix(true,false);
  const m=this.root.matrixWorld,e=m.elements,bb=this.world.root;if(!bb)return [];
  // Conservative sphere broad phase prevents distant ghost fleet hulls from
  // allocating local boxes and scanning the BVH for every land-motor substep.
  const r=Math.hypot(...bb.min.map((x,i)=>Math.max(Math.abs(x),Math.abs(bb.max[i]))))*Math.hypot(e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10]);
  if(Math.hypot(...[0,1,2].map(i=>Math.max(0,box.min[i]-e[12+i],e[12+i]-box.max[i])))>r)return [];
  const inverse=new Matrix4().copy(m).invert();
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],v=new Vector3();
  for(const x of [box.min[0],box.max[0]])for(const y of [box.min[1],box.max[1]])for(const z of [box.min[2],box.max[2]]){v.set(x,y,z).applyMatrix4(inverse);const q=[v.x,v.y,v.z];for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],q[i]);hi[i]=Math.max(hi[i],q[i]);}}
  const transform=p=>{v.set(...p).applyMatrix4(m);return [v.x,v.y,v.z];};
  const out=[];for(const t of this.world.query({min:lo,max:hi})){const a=transform(t.a),b=transform(t.b),c=transform(t.c),normal=new Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).cross(new Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2])).normalize();const min=[0,1,2].map(i=>Math.min(a[i],b[i],c[i])),max=[0,1,2].map(i=>Math.max(a[i],b[i],c[i]));if(min.every((v,i)=>v<=box.max[i]&&max[i]>=box.min[i]))out.push({a,b,c,n:[normal.x,normal.y,normal.z],min,max,id:t.id});}return out;
 }
 near(p){return this.root.visible&&Math.hypot(p.x-this.root.position.x,p.z-this.root.position.z)<35;}
 floorAt(x,z,maxY,minY=-100){if(!this.near({x,z}))return null;const hit=this.world.segmentHit(this.local({x,y:maxY,z}),this.local({x,y:minY,z}),{minNormalY:.65});return hit?this.global(hit).y:null;}
 segmentHit(from,to){if(!this.near(from)&&!this.near(to))return null;const hit=this.world.segmentHit(this.local(from),this.local(to));return hit?{...hit,...this.global(hit)}:null;}
 move(from,to,opts){if(!this.near(from)&&!this.near(to))return {...to,contacts:[]};this.root.updateWorldMatrix(true,false);const e=this.root.matrixWorld.elements,scale=Math.hypot(e[0],e[1],e[2]),localOpts={...opts};for(const key of ['radius','height','stepHeight','step','skin'])if(Number.isFinite(opts?.[key]))localOpts[key]=opts[key]/scale;const hit=this.world.move(this.local(from),this.local(to),localOpts),p=this.global(hit);return {...hit,...p,contacts:hit.contacts.map(h=>{const n=new Vector3(...h.normal).transformDirection(this.root.matrixWorld);return {...h,normal:[n.x,n.y,n.z]};})};}
}
