import { readFileSync } from 'node:fs';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
const path = process.argv[2] || 'public/models/titans/external/leviathan-monster.glb';
const buffer = readFileSync(path);
if (buffer.toString('ascii', 0, 4) !== 'glTF') throw Error('Not GLB');
const jsonSize = buffer.readUInt32LE(12);
const gltf = JSON.parse(buffer.subarray(20, 20 + jsonSize).toString('utf8'));
const names = (gltf.nodes || []).map((n,i)=>({i,name:n.name||'',t:n.translation,skin:n.skin,mesh:n.mesh})).filter(n=>n.name);
process.stdout.write(JSON.stringify({
  scene:gltf.scene,
  skins:(gltf.skins||[]).map(s=>({joints:s.joints.length,root:s.skeleton,jointNames:s.joints.map(j=>gltf.nodes[j]?.name)})),
  names,
  animations:(gltf.animations||[]).map(a=>({name:a.name,channels:a.channels?.length,paths:a.channels?.map(c=>c.target.path)})),
  meshes:gltf.meshes?.length,
},null,2)+'\n');
const parsed = parseGLB(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength));
for(const [meshIndex,prims] of parsed.meshes.entries()){
 for (const p of prims){
  const pos=p.attributes.POSITION.array;
  const bins=[];
  for(let k=0;k<8;k++){
   const a=[];
   for(let i=0;i<pos.length;i+=3)if(pos[i+2]>=-0.128+k*.032&&pos[i+2]<-0.128+(k+1)*.032)a.push([pos[i],pos[i+1]]);
   if(!a.length)continue;
   const ys=a.map(x=>x[1]).sort((a,b)=>a-b);
   bins.push({z:[-0.128+k*.032,-0.128+(k+1)*.032],count:a.length,low:ys[0],q10:ys[Math.floor(ys.length*.1)],mid:ys[Math.floor(ys.length*.5)],q90:ys[Math.floor(ys.length*.9)],high:ys.at(-1)});
  }
  process.stdout.write(JSON.stringify({meshIndex,bins},null,2)+'\n');
 }
}
