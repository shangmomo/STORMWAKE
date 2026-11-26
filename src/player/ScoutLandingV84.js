import {Vector3} from '../engine/index.js';
import {canStandAt,combinedWorld} from './LandMotorV78.js';
// Find a real dry, supported landing under/near the observer, never snap
// through solid geometry or commit a new actor position on failure.
export function scoutLanding(terrain,colliders,camera,waterAt=()=>0){
 if(!camera||![camera.x,camera.y,camera.z].every(Number.isFinite))return null;
 const w=combinedWorld(colliders),offsets=[[0,0]];for(const r of [1.5,3,5,8])for(let i=0;i<8;i++){const a=i*Math.PI/4;offsets.push([Math.cos(a)*r,Math.sin(a)*r]);}
 for(const [dx,dz] of offsets){const x=camera.x+dx,z=camera.z+dz,base=terrain.heightAt(x,z),g=Math.max(base,colliders.groundHeightAt(x,z,camera.y-.10)),water=waterAt(x,g,z);
  if(![base,g,water].every(Number.isFinite)||g<water+.08||camera.y-g>180||g>camera.y-.10)continue;
  if(g-base<.06&&[[.4,0],[-.4,0],[0,.4],[0,-.4]].some(([a,b])=>Math.abs(terrain.heightAt(x+a,z+b)-base)>.32))continue;
  const foot=new Vector3(x,g,z),eye=foot.clone().add(new Vector3(0,1.62,0));if(!canStandAt(colliders,foot))continue;
  const support=w.segmentHit(eye,{x,y:g-.06,z});if(support&&(support.y>g+.06||support.normal[1]<.55))continue;
  const d=eye.clone().sub(camera),len=d.length();if(w.segmentHit(camera,eye)||len>.005&&colliders.raycast(camera,d.clone().multiplyScalar(1/len),len,.08)<len-.001)continue;
  let blocked=false;for(let i=0;i<=Math.ceil(len/1.5);i++){const u=i/Math.max(1,Math.ceil(len/1.5)),q=camera.clone().addScaledVector(d,u);if(q.y<terrain.heightAt(q.x,q.z)+.12){blocked=true;break;}}if(blocked)continue;
  return {foot,water};
 }return null;
}
