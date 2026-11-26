import {Vector3} from '../engine/index.js';
// Native ship coordinates: +X port, +Z bow. Yaw is radians from bow.
// Constrain to a physical broadside arc and modest elevation; never fire through own hull.
export const CANNON_ARC=Math.PI/4.8; // +/-37.5 degrees
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function cannonDirection(stationId,shipYaw,viewYaw=undefined,viewPitch=undefined,shipRotation=null){
 const side=stationId==='cannon_port'?1:stationId==='cannon_starboard'?-1:0;
 if(!side) return null;
 const base=side*Math.PI/2;
 const delta=Number.isFinite(viewYaw)?Math.atan2(Math.sin(viewYaw-base),Math.cos(viewYaw-base)):0;
 const rel=base+clamp(delta,-CANNON_ARC,CANNON_ARC);
 // The muzzle must clear the low ocean. A near-level view needs a small
 // built-in ballistic loft; otherwise balls dive under water before 30 m.
 // Mouse pitch still changes elevation throughout the safe firing envelope.
 const elevation=clamp((Number.isFinite(viewPitch)?viewPitch:0)+.14,-.06,.36);
 const world=shipYaw+rel;
 if(shipRotation){const d=new Vector3(Math.sin(rel)*Math.cos(elevation),Math.sin(elevation),Math.cos(rel)*Math.cos(elevation)).applyQuaternion(shipRotation);return {x:d.x,y:d.y,z:d.z,elevation,relativeYaw:rel};}
 return {x:Math.sin(world)*Math.cos(elevation),y:Math.sin(elevation),z:Math.cos(world)*Math.cos(elevation),elevation,relativeYaw:rel};
}
