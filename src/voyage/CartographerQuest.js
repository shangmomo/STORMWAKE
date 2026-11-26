import {ARSENAL_SITES,HARPOON_PIVOT,HARPOON_BARREL,HAUL_BOX_SITE} from '../ship/ArsenalSites.js';
import {CABIN_TABLE} from './VoyageSites.js';
import {worldToShip,shipToWorld} from './CargoReach.js';
export const CARTOGRAPHER={site:{x:130,y:.12,z:760},log:{x:130,y:-4,z:760},island:{x:-430,y:9,z:430},broker:{x:56,y:1,z:-71},table:CABIN_TABLE,harpoon:ARSENAL_SITES.harpoon};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export class CartographerQuest{
 constructor(){this.reset();this.run=0;this.rewards=0;}
 reset(){this.phase='offer';this.crate={...CARTOGRAPHER.site};this.logActor=null;this.shot=null;this.reelUntil=0;this.clock=0;this.reelActor=null;this.hoistAge=0;this.hoistStart=null;}
 serialize(){return {version:1,phase:this.phase,crate:{...this.crate},logActor:this.logActor,shot:this.shot?structuredClone(this.shot):null,run:this.run,rewards:this.rewards,hoistAge:this.hoistAge,hoistStart:this.hoistStart};}
 deserialize(s){if(s?.version!==1||!['offer','accepted','spotted','flying','latched','salvaged','log_held','island','return','completed'].includes(s.phase)||!s.crate||!['x','y','z'].every(k=>Number.isFinite(s.crate[k])))return false;this.phase=s.phase;this.crate={...s.crate};this.logActor=typeof s.logActor==='string'?s.logActor:null;this.shot=s.shot?structuredClone(s.shot):null;this.run=s.run||0;this.rewards=s.rewards||0;this.hoistAge=Math.max(0,Math.min(1.2,s.hoistAge||0));this.hoistStart=s.hoistStart?{...s.hoistStart}:null;return true;}
 action(verb,p,ship,{direction=null,spyglass=false}={}){
  if(!p||!ship)return false;const local=worldToShip(ship,p);const atTable=p.mode==='deck'&&p.deckLayer==='hold'&&local&&distance(local,CARTOGRAPHER.table)<2.2;
  if(verb==='accept'&&['offer','completed'].includes(this.phase)&&atTable){this.reset();this.phase='accepted';this.run++;return true;}
  if(verb==='spot'&&this.phase==='accepted'&&spyglass&&direction){const dx=this.crate.x-p.x,dz=this.crate.z-p.z,d=Math.hypot(dx,dz),n=Math.hypot(direction.x,direction.z);if(d<500&&d>3&&n>.1&&(dx*direction.x+dz*direction.z)/(d*n)>.985){this.phase='spotted';return true;}}
  const atGun=p.mode==='deck'&&p.deckLayer==='deck'&&local&&distance(local,CARTOGRAPHER.harpoon)<2.1;
  if(verb==='fire'&&this.phase==='spotted'&&atGun&&direction){const n=Math.hypot(direction.x,direction.y,direction.z);if(!Number.isFinite(n)||n<.99||n>1.01)return false;if((Math.hypot(ship.vx||0,ship.vz||0)||Math.abs(ship.speed||0))>2)return false;this.hoistAge=0;this.hoistStart=null;const pivot=shipToWorld(ship,HARPOON_PIVOT);this.shot={origin:{x:pivot.x+direction.x*HARPOON_BARREL,y:pivot.y+direction.y*HARPOON_BARREL,z:pivot.z+direction.z*HARPOON_BARREL},direction:{...direction},age:0};this.phase='flying';return true;}
  if(verb==='reel'&&this.phase==='latched'&&atGun){this.reelUntil=this.clock+.28;this.reelActor=p.id;return true;}
  if(verb==='take_log'&&this.phase==='salvaged'&&p.mode==='swim'&&distance(p,CARTOGRAPHER.log)<2.2){this.logActor=p.id;this.phase='log_held';return true;}
  if(verb==='read_log'&&this.phase==='log_held'&&p.id===this.logActor&&atTable){this.phase='island';this.logActor=null;return true;}
  if(verb==='inspect'&&this.phase==='island'&&p.mode==='walk'&&Math.hypot(p.x-CARTOGRAPHER.island.x,p.z-CARTOGRAPHER.island.z)<3){this.phase='return';return true;}
  if(verb==='deliver'&&this.phase==='return'&&p.mode==='walk'&&Math.hypot(p.x-56,p.z+71)<4&&Math.hypot(ship.x-69.8,ship.z-42)<55){this.phase='completed';this.rewards++;return true;}
  return false;
 }
 update(dt,ship){dt=Math.max(0,Math.min(.1,dt));this.clock+=dt;if(!ship)return;
  if(this.phase==='flying'&&this.shot){const s=this.shot;s.age+=dt;const d=distance(s.origin,this.crate),t=Math.max(0,(this.crate.x-s.origin.x)*s.direction.x+(this.crate.y-s.origin.y)*s.direction.y+(this.crate.z-s.origin.z)*s.direction.z),near={x:s.origin.x+s.direction.x*t,y:s.origin.y+s.direction.y*t,z:s.origin.z+s.direction.z*t};
   if(t<85&&distance(near,this.crate)<1.5&&s.age*48>=t)this.phase='latched';else if(s.age>1.9){this.phase='spotted';this.shot=null;}}
  if(this.phase==='latched'){const dx=ship.x-this.crate.x,dz=ship.z-this.crate.z,d=Math.hypot(dx,dz);if(d>95){this.phase='spotted';this.shot=null;this.hoistAge=0;this.hoistStart=null;return;}if(this.clock<this.reelUntil){if(d<6||this.hoistStart){this.hoistStart??={...this.crate};this.hoistAge=Math.min(1.2,this.hoistAge+dt);const t=this.hoistAge/1.2,target=shipToWorld(ship,HAUL_BOX_SITE);for(const k of ['x','y','z'])this.crate[k]=this.hoistStart[k]*(1-t)+target[k]*t;if(t>=1){this.phase='salvaged';this.shot=null;}}else{const step=Math.min(d,dt*3);this.crate.x+=dx/Math.max(d,.001)*step;this.crate.z+=dz/Math.max(d,.001)*step;}}}
 }
 disconnect(id){if(this.logActor===id){this.logActor=null;this.phase='salvaged';}if(this.reelActor===id)this.reelUntil=0;}
}
