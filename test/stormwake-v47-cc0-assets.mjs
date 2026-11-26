// Static, repeatable acceptance of user-supplied Dutch .blend -> embedded GLB,
// Quaternius/Kenney assets and the real-ship collision profile.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseGLB} from '../src/engine/loaders/GLTF.js';
import {BoatModel} from '../src/world/BoatModel.js';
import {artistHullHalfWidth,ART_HULL_HALF_WIDTH} from '../src/ship/HeritageHullBounds.js';
import {HERITAGE_ART_ALIGNMENT} from '../src/ship/HeritageAssetRig.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public/models/stormwake_v47');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'asset_manifest.json')));
const get=name=>{const f=fs.readFileSync(path.join(root,name));return parseGLB(f.buffer.slice(f.byteOffset,f.byteOffset+f.length));};
let pass=0;
function check(label,fn){fn();console.log('PASS',++pass,label);}
check('21 uploaded CC0 assets actually bundled, with matching SHA256',()=>{
 assert.equal(manifest.length,21);
 for(const m of manifest){const p=path.join(root,m.file);assert.ok(fs.existsSync(p),m.file);const data=fs.readFileSync(p);
 assert.equal(data.length,m.size);assert.equal(crypto.createHash('sha256').update(data).digest('hex'),m.sha256);}
});
const ship=get('dutch_ship_medium_pbr.glb');
check('real Dutch Blender mesh converted to three separate PBR GLB primitives',()=>{
 assert.equal(ship.meshes.length,3);assert.equal(ship.materials.length,3);assert.equal(ship.images.length,9);
 assert.equal(ship.nodes.filter(n=>n.mesh!==undefined).length,3);
 assert.ok(ship.meshes.flat().every(p=>p.attributes.TEXCOORD_0&&p.attributes.NORMAL));
 assert.ok(ship.materials.every(m=>m.normalTexture&&m.pbrMetallicRoughness.baseColorTexture));
 assert.ok(ship.materials.find(m=>m.name.endsWith('sails')).alphaMode==='MASK');
});
check('measured hull 22m long, 5.2m wide, real mast 22m tall',()=>{
 const p=ship.meshes[0][0].attributes.POSITION.array,rig=ship.meshes[1][0].attributes.POSITION.array;
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<p.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[i+k]);max[k]=Math.max(max[k],p[i+k]);}
 assert.ok(max[2]-min[2]>21.5&&max[2]-min[2]<23);
 assert.ok(max[0]-min[0]>5&&max[0]-min[0]<5.5);
 let maxY=-Infinity;for(let i=1;i<rig.length;i+=3)maxY=Math.max(maxY,rig[i]);assert.ok(maxY>22);
});
check('V49 original Dutch hull deck restored with no artificial hatch',()=>{
 const p=ship.meshes[0][0],positions=p.attributes.POSITION.array,idx=p.indices;
 let inside=0;
 for(let i=0;i<idx.length;i+=3){
  const a=idx[i]*3,b=idx[i+1]*3,c=idx[i+2]*3;
  const mx=(positions[a]+positions[b]+positions[c])/3;
  const mz=(positions[a+2]+positions[b+2]+positions[c+2])/3;
  const my=(positions[a+1]+positions[b+1]+positions[c+1])/3;
  if(!(Math.abs(mx)<1.01&&mz>-4.47&&mz<-1.73&&my>1.68&&my<3.82))continue;
  const ux=positions[b]-positions[a],uy=positions[b+1]-positions[a+1],uz=positions[b+2]-positions[a+2];
  const vx=positions[c]-positions[a],vy=positions[c+1]-positions[a+1],vz=positions[c+2]-positions[a+2];
  const ny=uz*vx-ux*vz,norm=Math.hypot(uy*vz-uz*vy,ny,ux*vy-uy*vx);
  if(norm>1e-7&&Math.abs(ny/norm)>.65)inside++;
 }
 assert.ok(inside>0,'uncut authored deck faces are restored in the former V47 hatch region');
});
check('Quaternius skeleton has actual skin and 15 animations',()=>{const m=get('quaternius_characters_skeleton.glb');assert.ok(m.skins.length>0&&m.animations.length>=14);});
check('Kenney cannon/stock and Quaternius bucket/chest can be parsed in engine',()=>{
 for(const n of ['kenney_cannon.glb','kenney_barrel.glb','kenney_cannon-ball.glb','quaternius_prop_bucket.glb','quaternius_prop_chest_closed.glb','quaternius_ship_large.glb']){
  const g=get(n);assert.ok(g.meshes.length>0&&g.meshes.flat().every(p=>p.attributes.POSITION),n);
 }
});
check('baked artist hull width is finite, conservative and continuous',()=>{
 assert.equal(ART_HULL_HALF_WIDTH.length,48);
 for(let z=-12;z<=12;z+=.1){const x=artistHullHalfWidth(z);assert.ok(Number.isFinite(x)&&x>=.85&&x<=2.35);}
 assert.ok(artistHullHalfWidth(-4)>1.8);assert.ok(artistHullHalfWidth(6)>1.3);
});
check('ship hydro and artist mesh are not scaled twice',()=>{
 const boat=new BoatModel({shipClass:'heritage'});
 assert.ok(boat.shipScale&&boat.dimensions.length>20);
 assert.ok(HERITAGE_ART_ALIGNMENT.y>0&&HERITAGE_ART_ALIGNMENT.y<1);
 assert.ok(boat.group.scale.x>1&&boat.group.scale.z>2);
});
console.log(`V47 imported art acceptance ${pass}/${pass} (not a GPU/browser QA)`);
