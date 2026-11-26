// Swept ballistic hit against a yaw/pitch/roll rotated, dimensioned ship hull.
// Ship collision uses one METRIC local frame regardless of the visual ship GLB.
import {Vector3} from '../engine/index.js';
export function segmentHullHit(start,end,boat){
 if(!start||!end||!boat?.position||!boat?.quaternion)return null;
 const dims=boat.model?.dimensions||{beam:3.1,length:8.2,draft:.7,deckHeight:.35};
 const inv=boat.quaternion.clone().invert();
 const a=new Vector3(start.x-boat.position.x,start.y-boat.position.y,start.z-boat.position.z).applyQuaternion(inv);
 const b=new Vector3(end.x-boat.position.x,end.y-boat.position.y,end.z-boat.position.z).applyQuaternion(inv);
 const bounds={x:[-dims.beam/2-.08,dims.beam/2+.08],
  y:[-Math.max(.85,dims.draft*.85),Math.max(2.6,dims.deckHeight+1.8)],
  z:[-dims.length/2-.08,dims.length/2+.08]};
 let t0=0,t1=1;
 for(const axis of ['x','y','z']){
  const d=b[axis]-a[axis],lo=bounds[axis][0],hi=bounds[axis][1];
  if(Math.abs(d)<1e-10){if(a[axis]<lo||a[axis]>hi)return null;continue;}
  let tEnter=(lo-a[axis])/d,tExit=(hi-a[axis])/d;
  if(tEnter>tExit)[tEnter,tExit]=[tExit,tEnter];
  t0=Math.max(t0,tEnter);t1=Math.min(t1,tExit);
  if(t0>t1)return null;
 }
 return {t:t0,local:{x:a.x+(b.x-a.x)*t0,y:a.y+(b.y-a.y)*t0,z:a.z+(b.z-a.z)*t0}};
}
