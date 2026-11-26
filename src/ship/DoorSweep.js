import {DUTCH_AFT_DOOR as D,DUTCH_SAILOR as S} from './HeritageDeck.js';
// Physical leaf rotates about its original port hinge, in metric ship space.
function touches(angle,p){
  if(!p||p.y>=D.roof||p.y+S.height<=D.footMin)return false;
  const length=D.xMax-D.xMin,dx=Math.cos(angle)*length,dz=-Math.sin(angle)*length;
  const t=Math.max(0,Math.min(1,((p.x-D.xMin)*dx+(p.z-D.z)*dz)/(length*length)));
  return Math.hypot(p.x-D.xMin-t*dx,p.z-D.z-t*dz)<(p.radius??S.radius)+.045;
}
export function safeDoorAngle(current,next,blockers=[]){
  const steps=Math.max(1,Math.ceil(Math.abs(next-current)/.015));let safe=current;
  for(let i=1;i<=steps;i++){
    const a=current+(next-current)*i/steps;
    // An already touching body must still be able to move away from the leaf.
    if(blockers.some(p=>touches(a,p)&&!touches(safe,p)))return {angle:safe,blocked:true};
    if(blockers.some(p=>touches(a,p)&&touches(safe,p)))return {angle:safe,blocked:true};
    safe=a;
  }return {angle:safe,blocked:false};
}
export function doorTriangles(angle){
  const length=D.xMax-D.xMin,x=D.xMin+Math.cos(angle)*length,z=D.z-Math.sin(angle)*length;
  const a=[D.xMin,D.footMin,D.z],b=[x,D.footMin,z],c=[x,D.roof,z],d=[D.xMin,D.roof,D.z];
  return [[a,b,c],[a,c,d]];
}
