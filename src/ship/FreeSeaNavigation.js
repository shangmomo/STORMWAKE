// V55 captain's free-chart route. A* grid avoids traversing exposed island
// terrain. A sailor can click any chart point; a land pin resolves to the
// nearest navigable water, never to a fictitious path through solid terrain.
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
export function navigable(terrain,x,z,depth=2.6){
  if(!Number.isFinite(x)||!Number.isFinite(z))return false;
  // The island heightmap is 2 km wide; the outer chart is open sea.
  if(Math.abs(x)>1010||Math.abs(z)>1010)return true;
  return (terrain?.heightAt?.(x,z)??-999)<-depth;
}
export function nearestSea(goal,terrain,{limit=560,depth=2.6}={}){
  if(!finite(goal))return null;
  if(navigable(terrain,goal.x,goal.z,depth))return {...goal};
  for(let r=18;r<=limit;r+=18){
    for(let j=0;j<48;j++){
      const a=j*Math.PI/24,x=goal.x+r*Math.cos(a),z=goal.z+r*Math.sin(a);
      if(navigable(terrain,x,z,depth))return {x,z};
    }
  }
  return null;
}
export function lineSafe(a,b,terrain,{depth=2.6,ignoreStart=0}={}){
  if(!finite(a)||!finite(b))return false;
  const d=dist(a,b),count=Math.max(1,Math.ceil(d/16));
  for(let k=0;k<=count;k++){
    const t=k/count;if(t*d<ignoreStart)continue;
    if(!navigable(terrain,a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,depth))return false;
  }
  return true;
}
export function buildSafeSeaRoute(start,destination,terrain,{depth=2.6}={}){
  if(!finite(start)||!finite(destination))return null;
  const goal=nearestSea(destination,terrain,{depth});if(!goal)return null;
  if(lineSafe(start,goal,terrain,{depth,ignoreStart:40}))return [goal];
  const spacing=dist(start,goal)>1200?42:24;
  const pad=310,minX=Math.min(start.x,goal.x)-pad,minZ=Math.min(start.z,goal.z)-pad;
  const nx=Math.ceil((Math.max(start.x,goal.x)+pad-minX)/spacing)+1;
  const nz=Math.ceil((Math.max(start.z,goal.z)+pad-minZ)/spacing)+1;
  if(nx*nz>60000)return null;
  const cell=(x,z)=>({ix:Math.max(0,Math.min(nx-1,Math.round((x-minX)/spacing))),
    iz:Math.max(0,Math.min(nz-1,Math.round((z-minZ)/spacing)))});
  const key=(ix,iz)=>iz*nx+ix;
  const at=(ix,iz)=>({x:minX+ix*spacing,z:minZ+iz*spacing});
  const first=cell(start.x,start.z),last=cell(goal.x,goal.z);
  const dest=key(last.ix,last.iz),origin=key(first.ix,first.iz),total=nx*nz;
  const best=new Float64Array(total).fill(Infinity),prev=new Int32Array(total).fill(-1);
  const closed=new Uint8Array(total),open=[];
  const heapPush=(k,score)=>{let i=open.length;open.push({k,score});while(i){const p=(i-1)>>1;if(open[p].score<=score)break;open[i]=open[p];i=p;}open[i]={k,score};};
  const heapPop=()=>{const first=open[0],tail=open.pop();if(open.length){let i=0;while(2*i+1<open.length){let c=2*i+1;if(c+1<open.length&&open[c+1].score<open[c].score)c++;if(open[c].score>=tail.score)break;open[i]=open[c];i=c;}open[i]=tail;}return first.k;};
  const checked=new Map();
  const safe=(ix,iz)=>{const k=key(ix,iz);if(k===origin||k===dest)return true;
    if(checked.has(k))return checked.get(k);
    const pos=at(ix,iz);const ok=navigable(terrain,pos.x,pos.z,depth+1);
    checked.set(k,ok);return ok;};
  best[origin]=0;heapPush(origin,dist(start,goal));
  let searched=0;
  while(open.length&&searched++<total*2){
    const k=heapPop();if(closed[k])continue;closed[k]=1;if(k===dest)break;
    const x=k%nx,z=Math.floor(k/nx);
    for(const dx of [-1,0,1])for(const dz of [-1,0,1]){
      if(!dx&&!dz)continue;const xx=x+dx,zz=z+dz;
      if(xx<0||xx>=nx||zz<0||zz>=nz)continue;
      const nk=key(xx,zz);if(closed[nk]||!safe(xx,zz))continue;
      // Diagonals must not cut the corner through solid island cells.
      if(dx&&dz&&(!safe(x+dx,z)||!safe(x,z+dz)))continue;
      const candidate=best[k]+spacing*Math.hypot(dx,dz);
      if(candidate>=best[nk])continue;
      best[nk]=candidate;prev[nk]=k;
      heapPush(nk,candidate+dist(at(xx,zz),goal));
    }
  }
  if(!closed[dest])return null;
  const chain=[];let cursor=dest;
  while(cursor!==origin&&cursor!==-1){chain.push(at(cursor%nx,Math.floor(cursor/nx)));cursor=prev[cursor];}
  if(cursor!==origin)return null;
  chain.reverse();chain.push(goal);
  // String-pull to remove grid zig-zags while checking actual seabed samples.
  const result=[],points=[start,...chain];let i=0;
  while(i<points.length-1){let j=points.length-1;
    while(j>i+1&&!lineSafe(points[i],points[j],terrain,{depth,ignoreStart:i===0?40:0}))j--;
    result.push(points[j]);i=j;
  }
  return result;
}
