import {Vector3} from '../engine/index.js';
// Source Kenney cannon points along +Z; the placement turns it broadside.
// The carriage traverses, while only the original barrel elevates/recoils.
export function aimCannonMount(marker,direction,recoil=0){
 const pivot=marker?.userData?.tube;if(!pivot||!direction)return false;
 const rig=marker.userData.cannonRig;
 if(rig){
  const side=marker.userData.cannonSide||1;
  pivot.rotation.set(0,direction.relativeYaw-side*Math.PI/2,0);
  pivot.position.z=0;
  rig.barrel.rotation.x=-direction.elevation;
  rig.restPosition??=rig.barrel.position.clone();
  rig.barrel.position.copy(rig.restPosition).addScaledVector(new Vector3(0,Math.sin(direction.elevation),Math.cos(direction.elevation)),-Math.max(0,recoil)*.16/rig.scale);
 }else{
  const side=marker.userData.cannonSide||1;
  pivot.quaternion.setFromUnitVectors(new Vector3(side,0,0),new Vector3(Math.sin(direction.relativeYaw)*Math.cos(direction.elevation),Math.sin(direction.elevation),Math.cos(direction.relativeYaw)*Math.cos(direction.elevation)));
 }
 return true;
}
export function cannonMuzzle(marker,out=new Vector3()){
 return marker?.userData?.cannonRig?.muzzle?.getWorldPosition(out)||null;
}
