// V37 bespoke stylization pass. This is original authored accessory geometry,
// not copied Sea of Thieves assets. The silhouette can be upgraded later via
// the reviewed Quaternius Pirate Kit without changing the human skeletons.
import { Group, Mesh, Vector3, Matrix4 } from '../engine/index.js';
import { prepare, mergePrepared, box, cylinder, sphere, torus, mat4 } from '../world/boat/GeoKit.js';
import { landMaterial } from './LandModels.js';
const HEAD = /(?:^|\s|\.)head(?:$|\s|_|\.)/i;
const HIP = /pelvis|hips/i;
const CHEST = /^(?:Torso|Spine|Chest)$/i;
const HAND = /^(?:Palm|Fist|Hand)(?:\.R|_R|Right)$/i;
const TEMP = new Vector3(), TEMP2 = new Vector3();
const COLORS = [0x354c5e,0x6c3b38,0x465942,0x79603b,0x3b5961,0x563f58];
function partsToMesh(parts){ const m=new Mesh(mergePrepared(parts),landMaterial);m.castShadow=true;return m; }
function part(geo,color,x=0,y=0,z=0,sx=1,sy=sx,sz=sx,ry=0){
 return prepare(geo,{color,rough:.79,matrix:mat4(x,y,z,0,ry,0,sx,sy,sz)});
}
function createHeadwear(style,accent){
 const bits=[];const cloth=COLORS[style%COLORS.length];
 if(style%4===0){ // tricorn: folded wide brim and a low, strong crown
  bits.push(part(cylinder(.34,.40,.23,12),cloth,0,.12,0));
  bits.push(part(cylinder(.53,.53,.065,16),cloth,0,.02,0));
  for(const a of [0,Math.PI*2/3,Math.PI*4/3]){
   bits.push(part(box(.47,.15,.14),cloth,Math.sin(a)*.36,.13,Math.cos(a)*.36,1,1,1,a));
  }
  bits.push(part(box(.25,.04,.055),accent,0,.18,-.39));
 }else if(style%4===1){ // dockworker bandanna with knot
  bits.push(part(sphere(1,16,9),cloth,0,.045,0,.46,.19,.45));
  bits.push(part(box(.93,.10,.09),accent,0,.06,-.18));
  bits.push(part(box(.13,.26,.10),cloth,.41,-.09,.19,1,1,1,.23));
 }else if(style%4===2){ // navigator brim, copper band and crown
  bits.push(part(cylinder(.28,.34,.29,12),cloth,0,.16,0));
  bits.push(part(cylinder(.56,.56,.055,20),0x3c3430,0,.025,0));
  bits.push(part(cylinder(.341,.341,.055,12),accent,0,.18,0));
 }else{ // sailor bonnet
  bits.push(part(sphere(1,14,9),cloth,0,.13,0,.43,.27,.43));
  bits.push(part(box(.68,.10,.22),0x263942,0,.01,-.29));
  bits.push(part(box(.21,.06,.09),accent,0,.025,-.43));
 }
 const g=new Group();g.name='V37 distinct pirate headwear';g.add(partsToMesh(bits));return g;
}
function createSailorOutfit(style,accent,boss=false){
 const bits=[],coat=COLORS[style%COLORS.length];
 // A heavy double-breasted canvas coat; the coat, scarf and shoulder pads
 // form a distinct upper-body silhouette. All geometry is Tidewater-original.
 bits.push(part(box(.93,.95,.18),coat,0,-.05,.30));
 bits.push(part(box(.20,.86,.12),accent,-.33,-.03,.405));
 bits.push(part(box(.20,.86,.12),accent,.33,-.03,.405));
 bits.push(part(box(.78,.16,.20),0x24333d,0,.42,.32));
 for(let i=0;i<3;i++)for(let sign of [-1,1])
  bits.push(part(sphere(.055,9,6),0xd8b775,sign*.15,.23-i*.24,.425,.7,.7,.45));
 // Broad stylized shoulders; no cloth solver or body mesh copying.
 for(let sign of [-1,1]){
   bits.push(part(sphere(1,10,8),coat,sign*.50,.30,.02,.30,.20,.45));
   bits.push(part(box(.32,.10,.52),accent,sign*.51,.25,.02));
 }
 if(boss){
  bits.push(part(box(1.26,.9,.11),0x172d35,0,-.27,.42));
  bits.push(part(box(.50,.2,.08),0x63dbce,0,.53,.40));
 }
 const g=new Group();g.name=boss?'V38 boss naval coat':'V38 civilian sailor coat';g.add(partsToMesh(bits));return g;
}
function createCutlass(accent){
 const bits=[];
 bits.push(part(cylinder(.075,.09,.45,9),0x3c302d,0,-.23,0));
 bits.push(part(torus(.16,.04,6,16),accent,0,-.06,0,1,.58,.77));
 bits.push(part(box(.13,1.36,.065),0xc8d5da,0,.69,0,.83,1,1));
 bits.push(part(box(.23,.10,.085),accent,0,.06,0));
 const g=new Group();g.name='V38 cutlass bone-mounted prop';g.add(partsToMesh(bits));return g;
}
function createBelt(style,accent){
 const bits=[];
 bits.push(part(torus(.36,.065,7,20),COLORS[(style+1)%COLORS.length],0,0,0,1,1,.67));
 bits.push(part(box(.25,.23,.08),accent,0,0,-.25));
 bits.push(part(box(.13,.10,.085),0x1d272c,0,0,-.305));
 const g=new Group();g.name='V37 pirate waist silhouette';g.add(partsToMesh(bits));return g;
}
export function attachPirateStyle(actor,index=0,{boss=false}={}){
 const rig=actor?.rig;if(!rig?.gltf?.nodes||!rig.group)return null;
 const names=rig.gltf.nodes.map(n=>n.name);
 const head=names.find(n=>HEAD.test(n)&&!/end/i.test(n));
 const hip=names.find(n=>HIP.test(n));
 const chest=names.find(n=>CHEST.test(n));
 const hand=names.find(n=>HAND.test(n));
 if(!head||!hip)return null;
 const color=boss?0x70e6d7:[0xd6ae70,0x87c6ba,0xcab47c,0xc46f67][index%4];
 const hat=createHeadwear(boss?0:index,color),belt=createBelt(index,color);
 const coat=createSailorOutfit(boss?4:index,color,boss);
 const weapon=boss&&hand?createCutlass(color):null;
 rig.group.add(hat,belt,coat);
 if(weapon)rig.group.add(weapon);
 const handMat=new Matrix4();
 const sync=()=>{
  if(!rig.nodeWorld(head,TEMP)||!rig.nodeWorld(hip,TEMP2))return;
  const height=Math.max(.35,Math.min(5,Math.abs(TEMP.y-TEMP2.y)));
  const sizing=height*.60;
  hat.scale.setScalar(sizing);
  hat.position.set(TEMP.x,TEMP.y+height*.28,TEMP.z);
  belt.scale.setScalar(height*.69);
  belt.position.set(TEMP2.x,TEMP2.y+height*.10,TEMP2.z);
  if(chest && rig.nodeWorld(chest,TEMP2)){
   coat.position.copy(TEMP2);
   coat.position.y+=height*.05;
   coat.scale.setScalar(height*.55);
  }
  if(weapon&&hand){
   const idx=rig.gltf.nodes.findIndex(n=>n.name===hand);
   if(idx>=0&&rig.nodeWorld(hand,TEMP2)){
    weapon.position.copy(TEMP2);
    weapon.scale.setScalar(height*.6);
    // Follow the actual right-hand bone quaternion, not an idle floating prop.
    handMat.fromArray(rig.world,idx*16);
    weapon.quaternion.setFromRotationMatrix(handMat);
   }
  }
 };
 sync();
 return {head,hip,chest,hand,hat,belt,coat,weapon,update:sync};
}
