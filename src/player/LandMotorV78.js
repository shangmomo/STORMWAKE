// Single swept contact set for all currently committed triangle worlds. No
// per-world slide can undo another world's contact. Substeps bound legacy box
// and cylinder depenetration; corrections are themselves swept against meshes.
import {CollisionWorld} from '../systems/CollisionWorld.js';
import {Vector3} from '../engine/index.js';
import {moveDeckCapsule} from './CharacterMotor.js';
const finite=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
export function combinedWorld(colliders){const w=new CollisionWorld();w.query=box=>{const out=[];for(const c of colliders.triangleWorlds||[])for(const t of c.query(box))out.push(t);return out;};return w;}
export function moveLand(colliders,from,to,{radius=.3,height=1.75,grounded=false,stepHeight=.4,groundAt=null}={}){
 if(!finite(from)||!finite(to))return {...from,invalid:true};
 const w=combinedWorld(colliders),dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,dist=Math.hypot(dx,dy,dz);
 if(dist>3)return {...from,invalid:true};
 const n=Math.max(1,Math.ceil(dist/.12));let p={...from},stepped=false,contacts=[];
 for(let i=0;i<n;i++){
  const target={x:p.x+dx/n,y:p.y+dy/n,z:p.z+dz/n};
  let q=moveDeckCapsule(w,p,target,{radius,height,grounded,stepHeight});
  if(!finite(q))break;
  const v=new Vector3(q.x,q.y,q.z);
  v.y=colliders.verticalLimit?.(p,v,radius,height)??v.y;
  // Reject corrections that would cross a different solid mesh or create a
  // large sideways teleport. Repeat boundedly at intersecting box corners.
  let ok=true;
  for(let j=0;j<3;j++){
   const before=v.clone();if(!colliders.resolveCapsule(v,radius,height,grounded?stepHeight:0,true))break;
   if(v.distanceTo(before)>.5){ok=false;break;}
   const corrected=w.move(before,v,{radius,height,step:grounded?stepHeight:0});
   if(Math.hypot(corrected.x-v.x,corrected.z-v.z)>.002){ok=false;break;}
  }
  if(!ok)break;
  const probe=v.clone();colliders.resolveCapsule(probe,radius,height,grounded?stepHeight:0,true);
  if(probe.distanceTo(v)>.005)break;
  if(groundAt){const g=groundAt(v.x,v.z,v.y+stepHeight+.05);if(!Number.isFinite(g))break;
   if(g>v.y){if(g-p.y>stepHeight+.02)break;if((colliders.verticalLimit?.(v,{...v,y:g},radius,height)??g)<g-.0001)break;const raised=w.move(v,{x:v.x,y:g,z:v.z},{radius,height,step:grounded?stepHeight:0});if(raised.y<g-.005)break;v.y=g;stepped=true;}else if(grounded&&dy<=0&&v.y-g<=stepHeight+.02){const down=w.move(v,{x:v.x,y:g,z:v.z},{radius,height,step:stepHeight});if(Math.abs(down.y-g)<.005&&(colliders.verticalLimit?.(v,{...v,y:g},radius,height)??g)<=g+.0001){v.y=g;stepped=true;}}}
  p={x:v.x,y:v.y,z:v.z};stepped||=!!q.stepped;contacts.push(...(q.contacts||[]));
 }
 return {...p,stepped,contacts};
}
// A sphere sweep gives the near plane clearance, unlike a centre ray. Use
// first contact, not the slid end of the sweep (which can lie behind a wall).
export function triangleBoomFraction(world,origin,desired,dynamic=[]){if(!world)return 1;const a={x:origin.x,y:origin.y-.10,z:origin.z},b={x:desired.x,y:desired.y-.10,z:desired.z};const hit=world.move(a,b,{radius:.10,height:.20,step:-.21,dynamic});let f=hit.contacts[0]?.t??1;for(const w of [world,...dynamic]){const line=w.segmentHit(origin,desired);if(line)f=Math.min(f,line.t);}return Math.max(0,Math.min(1,f));}
// Conservative camera boom, checking both triangle meshes and legacy boxes.
export function safeCameraBoom(colliders,origin,desired){const d=new Vector3().subVectors(desired,origin),len=d.length();if(len<.01)return desired.clone();d.multiplyScalar(1/len);let limit=colliders.raycast(origin,d,len,.10);const w=combinedWorld(colliders);limit=Math.min(limit,len*triangleBoomFraction(w,origin,desired));const q=origin.clone().addScaledVector(d,Math.max(0,limit-.16));return q;}

// Standing transitions must fit both the legacy and the exact mesh world.
export function canStandAt(colliders,foot,radius=.3,height=1.75){if(!finite(foot))return false;const q=new Vector3(foot.x,foot.y+.012,foot.z);const probe=q.clone();colliders.resolveCapsule(probe,radius,height,0,true);return probe.distanceTo(q)<.005&&!combinedWorld(colliders).capsuleOverlap(q,radius,height);}

// A free-camera is not a character. Only a supported, capsule-clear dry landing
// close to its eye can become a solo-player spawn. Never snap through rock.
export function safeFlyLanding(terrain,colliders,camera,water=0){
 if(!finite(camera)||!Number.isFinite(water))return null;
 const foot=camera.y-1.62,ground=Math.max(terrain.heightAt(camera.x,camera.z),colliders.groundHeightAt(camera.x,camera.z,foot+.4));
 if(!Number.isFinite(ground)||ground<water+.05||ground>foot+.35||foot-ground>3)return null;
 const p=new Vector3(camera.x,ground,camera.z);if(!canStandAt(colliders,p))return null;
 const eye=p.clone().add(new Vector3(0,1.62,0));
 const w=combinedWorld(colliders);if(w.segmentHit(camera,eye))return null;
 const support=w.segmentHit(eye,{x:p.x,y:p.y-.06,z:p.z});
 if(support&&(support.y>p.y+.06||support.normal[1]<.55))return null;
 const d=eye.clone().sub(camera),len=d.length();
 if(len>.005&&colliders.raycast(camera,d.multiplyScalar(1/len),len,.08)<len-.001)return null;
 return p;
}
