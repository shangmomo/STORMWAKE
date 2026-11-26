// Ship-local +Z is bow, +X is port; positive heading is port.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function nearestCombatTitan(boat,entities,forcedId=null){
 let best=null;
 for(const b of entities||[]){if(!b||b.health<=0||b.deadUntil||!b.brain)continue;
  const d=Math.hypot(b.brain.x-boat.position.x,b.brain.z-boat.position.z);
  if(d>Math.min(260,b.disengage||260)||(!['alert','chase','windup','charge'].includes(b.brain.state)&&b.id!==forcedId))continue;
  if(!best||d<best.distance)best={boss:b,x:b.brain.x,z:b.brain.z,distance:d,urgent:['windup','charge'].includes(b.brain.state)};
 }return best;
}
// Choose a navigable lateral escape/broadside course. The existing sailing
// controller still handles tacking, cloth, wind and real hull dynamics.
export function combatCourse(boat,threat,terrain){
 if(!threat)return null;const dx=boat.position.x-threat.x,dz=boat.position.z-threat.z;
 const away=Math.atan2(dx,dz),yaw=boat.getYaw(),d=threat.distance;
 const offsets=threat.urgent||d<32?[.65,-.65,0,1.25,-1.25]:[Math.PI*.55,-Math.PI*.55,.25,-.25];
 const safe=[];for(const o of offsets){const a=away+o;const p={x:boat.position.x+Math.sin(a)*85,z:boat.position.z+Math.cos(a)*85};
  let ok=true;for(let i=1;i<=8;i++){const t=i/8,x=boat.position.x+(p.x-boat.position.x)*t,z=boat.position.z+(p.z-boat.position.z)*t;if(terrain?.heightAt&&terrain.heightAt(x,z)>-7){ok=false;break;}}if(ok)safe.push({p,cost:Math.abs(angle(a,yaw))+(threat.urgent?Math.abs(o)*.5:0)});}
 safe.sort((a,b)=>a.cost-b.cost);return safe[0]?.p||null;
}
// Ballistic broadside aim with actual moving-target lead and limited traverse.
// Use cannon's 56m/s muzzle velocity, gravity, ship velocity, and physical arc.
export function titanCannonAim(boat,threat,side){
 if(!threat)return null;const yaw=boat.getYaw(),base=side==='port'?Math.PI/2:-Math.PI/2;
 const b=threat.boss,origin=boat.position,vel=boat.velocity||{x:0,z:0},d=threat.distance;
 if(d>125||d<5)return null;
 const t=d/56,leadX=Math.sin(b.brain.heading||0)*(b.brain.currentSpeed||0)*t,leadZ=Math.cos(b.brain.heading||0)*(b.brain.currentSpeed||0)*t;
 const dx=threat.x+leadX-(vel.x||0)*t-origin.x,dz=threat.z+leadZ-(vel.z||0)*t-origin.z;
 const rel=angle(Math.atan2(dx,dz),yaw),off=angle(rel,base);if(Math.abs(off)>Math.PI/4.8*.92)return null;
 const h=Math.max(5,Math.hypot(dx,dz)),targetY=b.pos?.y||0,originY=(origin.y||0)+2.0;
 const pitch=Math.atan2(targetY-originY+4.905*t*t,h)-.14;
 return {aimYaw:rel,aimPitch:clamp(pitch,-.20,.22)};
}
