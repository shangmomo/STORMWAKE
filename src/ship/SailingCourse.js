import {lineSafe} from './FreeSeaNavigation.js';
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export class SailingCourse{
 constructor(){this.side=1;this.leg=null;this.age=0;this.tacking=false;}
 update(dt,boat,target,wind,terrain){
  if(!target)return null;
  const heading=Math.atan2(target.x-boat.position.x,target.z-boat.position.z),upwind=Math.atan2(-wind.x,-wind.z);
  this.tacking=Math.abs(angle(heading,upwind))<Math.PI/3;
  if(!this.tacking){this.leg=null;this.age=0;return target;}
  this.age+=dt;
  if(this.leg&&(Math.hypot(boat.position.x-this.leg.x,boat.position.z-this.leg.z)<12||this.age>24)){this.side*=-1;this.leg=null;}
  if(!this.leg){
   for(const side of [this.side,-this.side]){const a=upwind+side*Math.PI*70/180,p={x:boat.position.x+Math.sin(a)*65,z:boat.position.z+Math.cos(a)*65};
    if(lineSafe(boat.position,p,terrain,{ignoreStart:12})){this.side=side;this.leg=p;this.age=0;break;}
   }
  }
  return this.leg;
 }
}
