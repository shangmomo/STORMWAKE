// Shared metric rules; no renderer dependencies on the room server.
export const LIFT=Object.freeze({x:342.5,z:-602,bottom:37.02,top:40.52,halfX:1.25,halfZ:1.3,speed:.85});
export const nearLift=(p,q,r=1.45,h=.85)=>!!p&&Math.hypot(p.x-q.x,p.z-q.z)<=r&&Math.abs(p.y-q.y)<=h;
export const liftLanding=y=>({x:LIFT.x,y,z:LIFT.z+(y===LIFT.bottom?2.35:-2.35)});
export const onLift=(p,y,tolerance=.12)=>!!p&&Math.abs(p.x-LIFT.x)<=LIFT.halfX-.08&&Math.abs(p.z-LIFT.z)<=LIFT.halfZ-.08&&Math.abs(p.y-y)<tolerance;
export const liftThreshold=p=>!!p&&Math.abs(p.x-LIFT.x)<LIFT.halfX+.32&&[LIFT.z+LIFT.halfZ+.1,LIFT.z-LIFT.halfZ-.1].some((z,i)=>Math.abs(p.z-z)<.65&&Math.abs(p.y-(i?LIFT.top:LIFT.bottom))<1.8);
export const validLiftTarget=y=>y===LIFT.bottom||y===LIFT.top;
export function canCallLift(p,y,target){return validLiftTarget(target)&&target!==y&&!!p&&!liftThreshold(p)&&(onLift(p,y,.24)||nearLift(p,liftLanding(target)));}
export function stepLiftY(y,target,dt){return y+Math.sign(target-y)*Math.min(Math.abs(target-y),LIFT.speed*Math.max(0,Math.min(.25,Number.isFinite(dt)?dt:0)));}
