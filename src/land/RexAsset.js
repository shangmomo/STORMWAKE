// Animal Animator's eyes are rigid children of the deform rig, not skinned
// primitives. Convert each opaque eye to a one-joint skin in memory so the
// existing GPU skinning pass renders it and follows the animated eye node.
// The original GLB is unchanged. Transparent cornea shells are omitted because
// this deferred renderer cannot render alpha-blended skinned surfaces correctly.
import {Matrix4,Vector3} from '../engine/index.js';
export const REX_CLIPS=Object.freeze({idle:'01_Idle',walk:'02_Walk',run:'03_Run',attack:'04_Attack'});
export const BITE_FRAME=1.6;
export function adaptRexAsset(g){
 const skin=g.skins[0];if(!skin||skin.joints.length!==84)throw Error('Unexpected Animal Animator skeleton');
 const original=new Float32Array(skin.inverseBindMatrices),joints=skin.joints.slice(),bindings=[];
 for(const name of ['Eye.L','Eye.R']){
  const i=g.nodes.findIndex(n=>n.name===name),n=g.nodes[i];if(i<0||n.mesh==null||n.skin!=null)throw Error('Missing original rigid eye '+name);
  const joint=joints.length;joints.push(i);bindings.push(joint);
  for(const p of g.meshes[n.mesh]){const count=p.attributes.POSITION.array.length/3,ids=new Uint16Array(count*4),weights=new Float32Array(count*4);for(let k=0;k<count;k++){ids[k*4]=joint;weights[k*4]=1;}p.attributes.JOINTS_0={array:ids,itemSize:4,normalized:false};p.attributes.WEIGHTS_0={array:weights,itemSize:4,normalized:false};}n.skin=0;
 }
 const ibm=new Float32Array(joints.length*16);ibm.set(original);for(const j of bindings)for(let k=0;k<4;k++)ibm[j*16+k*5]=1;
 skin.joints=joints;skin.inverseBindMatrices=ibm;return g;
}
// Mouth contact points are bound to the actual head and jaw transforms. The
// model's authored rest mesh is approximately one metre long (+Z forward).
export function makeMouthAnchors(rig){
 const result=[];for(const [name,p] of [['DEF-head',[-.055,.315,.475]],['DEF-jaw',[-.055,.273,.46]]]){const i=rig.gltf.nodes.findIndex(n=>n.name===name);if(i<0)throw Error('Missing '+name);const m=new Matrix4().fromArray(rig.world,i*16).invert();result.push({i,local:new Vector3(...p).applyMatrix4(m)});}return result;
}
export function mouthWorld(rig,anchors){return anchors.map(a=>rig.group.localToWorld(a.local.clone().applyMatrix4(new Matrix4().fromArray(rig.world,a.i*16))));}
export function mouthHits(points,p,radius=.9){
 const a=points[0],b=points[1];const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,den=dx*dx+dy*dy+dz*dz;
 // Sample the player's vertical capsule, not an arbitrary horizontal disk.
 for(const y of [.45,.85,1.25,1.65]){const v={x:p.x,y:p.y+y,z:p.z},t=den?Math.max(0,Math.min(1,((v.x-a.x)*dx+(v.y-a.y)*dy+(v.z-a.z)*dz)/den)):0;if(Math.hypot(v.x-a.x-t*dx,v.y-a.y-t*dy,v.z-a.z-t*dz)<=radius)return true;}return false;
}
