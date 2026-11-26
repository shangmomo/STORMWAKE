// V71: reuse the already bundled, licensed Poly Haven scans and PBR surfaces.
// Only replace the visual mesh after the complete textured mesh is ready.
import {Mesh,Matrix4,Vector3,Quaternion,Color} from '../engine/index.js';
import {KitBuilder,LAYER,place,loadStallAssets} from '../game/StallKit.js';
import {PAT} from '../game/GameMaterials.js';
export const SCANS=Object.freeze(['WoodenTable_03','wooden_display_shelves_01','wooden_crate_01','wooden_crate_02','wooden_bucket_01','wooden_lantern_01','wooden_cutting_board','metal_toolbox']);
// Fit a scan to a measured gameplay AABB, without changing the collision layout.
// Local source bounds may be off-centre or rotated relative to the desired box.
export function fitScan(bounds,center,size,yaw=0){
 const q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw);
 const rotated=[];for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]])rotated.push(new Vector3(x,y,z).applyQuaternion(q));
 const lo=new Vector3(Infinity,Infinity,Infinity),hi=new Vector3(-Infinity,-Infinity,-Infinity);for(const p of rotated){lo.min(p);hi.max(p);}
 const span=hi.clone().sub(lo);if([span.x,span.y,span.z,...size].some(v=>!Number.isFinite(v)||v<=0))throw Error('Invalid scan bounds');
 const s=new Vector3(size[0]/span.x,size[1]/span.y,size[2]/span.z),mid=lo.clone().add(hi).multiplyScalar(.5);
 const offset=new Vector3(...center).sub(mid.multiply(s));
 return new Matrix4().makeTranslation(offset.x,offset.y,offset.z).multiply(new Matrix4().makeScale(s.x,s.y,s.z)).multiply(new Matrix4().makeRotationFromQuaternion(q));
}
function scan(K,name,center,size,yaw=0){K.prop(name,fitScan(K.bounds(name),center,size,yaw));}
function plankLayer(pattern){return pattern===PAT.woodX?LAYER.DECK:pattern===PAT.woodZ?LAYER.DECK:pattern===PAT.wood?LAYER.WALL:LAYER.PLAIN;}
export function buildRoomArt(assets,boxes,{width,depth,notice,role}){
 const K=new KitBuilder(assets,71),zBack=-depth+.75;
 for(const b of boxes){
  if(b.kind==='counter'||b.kind==='shelf'||b.kind==='stock')continue;
  const layer=plankLayer(b.pattern),c=new Color(b.color);
  // Photoscanned timber has its own colour; a subtle tint distinguishes structural parts.
  const tint=layer===LAYER.PLAIN?[c.r,c.g,c.b]:[.75+c.r*.25,.75+c.g*.25,.75+c.b*.25];
  K.box(b.w,b.h,b.d,place(b.x,b.y,b.z,0,b.rx),{layer,color:tint,along:b.pattern===PAT.woodZ?'z':b.pattern===PAT.wood?'y':'x',params:[.9,0]});
 }
 if(!notice){
  // Preserve all collision bounds of the original V70 work station.
  scan(K,'WoodenTable_03',[0,.642,.46],[width*.52,1.045,.76]);
  // Two adjacent scan shelves collectively cover the V70 shelf footprint.
  const shelfW=(width-.65)/2;
  for(const side of [-1,1])scan(K,'wooden_display_shelves_01',[side*shelfW/2,1.145,zBack+.34],[shelfW,1.75,.49],Math.PI/2);
  // Real crates, with sizes that stay inside the shelving envelope.
  for(const i of [1,3]){
   const x=(i-2)*.55;
   scan(K,i===1?'wooden_crate_02':'wooden_crate_01',[x,.78,zBack+.35],[.35,.30,.32],i===1?Math.PI/2:0);
   scan(K,'wooden_crate_01',[x,1.48,zBack+.35],[.35,.28,.32]);
  }
  scan(K,role==='shipwright'?'metal_toolbox':'wooden_cutting_board',[-width*.15,1.205,.46],[.34,.08,.23]);
 }
 // High wall lanterns do not intrude into the capsule aisle.
 for(const side of [-1,1])scan(K,'wooden_lantern_01',[side*(width/2-.30),2.65,.45],[.22,.52,.23]);
 return K.build();
}
export function upgradeRoomArt(root,fallback,boxes,spec){
 if(typeof document==='undefined')return Promise.resolve(false);
 return loadStallAssets().then(assets=>{
  const mesh=new Mesh(buildRoomArt(assets,boxes,spec),assets.material);mesh.name='V71 Poly Haven scanned timber and furnishings';mesh.castShadow=true;mesh.receiveShadow=true;
  root.add(mesh);fallback.visible=false;return true;
 }).catch(e=>{console.warn('[V71] Scanned room art unavailable; V70 room preserved',e);return false;});
}
// Add a small number of actual scanned props to the cave, outside the central path.
export function caveScanSpecs(terrain,x){return [-462,-482,-517].flatMap(z=>[-1,1].map(side=>({x:x+side*12,z,y:terrain.heightAt(x+side*12,z),name:side<0?'wooden_crate_02':'wooden_bucket_01',size:side<0?[.82,.52,.72]:[.37,.55,.37]})));}
export function installCaveArt(scene,terrain,colliders,x){
 if(typeof document==='undefined')return Promise.resolve(false);
 return loadStallAssets().then(assets=>{
  const K=new KitBuilder(assets,711),specs=caveScanSpecs(terrain,x);
  for(const s of specs)scan(K,s.name,[s.x,s.y+s.size[1]/2,s.z],s.size);
  const mesh=new Mesh(K.build(),assets.material);mesh.name='V71 scanned cave supplies';mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  for(const s of specs)colliders.addBox(new Vector3(s.x,s.y+s.size[1]/2,s.z),new Vector3(...s.size).multiplyScalar(.5),0,{tag:'v71:cave-supply'});
  return true;
 }).catch(e=>{console.warn('[V71] Cave scanned props unavailable',e);return false;});
}
