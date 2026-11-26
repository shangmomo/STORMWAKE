import {CartographerQuest} from './CartographerQuest.js';
import {ghostLampSocket} from '../offshore/GhostSites.js';
import {worldToShip,shipToWorld} from './CargoReach.js';
export const GHOST_CONTACT={x:45,y:1,z:-80};
const segmentDistance=(a,b,p)=>{const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,n=dx*dx+dy*dy+dz*dz,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/(n||1)));return Math.hypot(a.x+dx*t-p.x,a.y+dy*t-p.y,a.z+dz*t-p.z);};
export class GhostLanternQuest{
 constructor(){this.phase='offer';this.run=0;this.delivered=0;this.lamps=[3,3,3];this.haul=new CartographerQuest();this.boarders=[];this.clock=0;this.cooldowns=new Map();}
 get cargoId(){return 'ghost_mission_'+this.run;}
 beginBoarding(ship={x:0,y:0,z:0,yaw:0}){this.phase='defend';this.boarders=[-1,1].map((side,i)=>({id:'boarder_'+i,side,x:side*14,y:.2,z:-4.9,yaw:-side*Math.PI/2,hp:3,phase:'approach',timer:0,world:shipToWorld(ship,{x:side*14,y:.2,z:-4.9})}));}
 approachBoarder(b,dt,ship){if(!ship)return;const side=b.side||Math.sign(b.x)||1,target=shipToWorld(ship,{x:side*2.4,y:.2,z:-4.9});b.world??=shipToWorld(ship,{x:b.x,y:.2,z:b.z});const dx=target.x-b.world.x,dz=target.z-b.world.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*2.8);b.world.x+=dx/Math.max(d,.001)*step;b.world.z+=dz/Math.max(d,.001)*step;const local=worldToShip(ship,b.world);b.x=local.x;b.z=local.z;b.y=local.y;
  if(d<.3){b.x=side*2.4;b.y=-.6;b.z=-4.9;b.phase='climb';b.timer=0;}else if(d>120){b.hp=0;b.phase='retreat';}
 }
 lampPosition(i,fleet){return ghostLampSocket(fleet?.find(s=>s.id==='v44_ghost_'+i),i);}
 serialize(){return {version:1,phase:this.phase,run:this.run,delivered:this.delivered,lamps:[...this.lamps],haul:this.haul.serialize(),boarders:this.boarders.map(b=>({...b}))};}
 deserialize(s){if(s?.version!==1||!['offer','sighting','battle','haul','defend','return','completed'].includes(s.phase)||!Array.isArray(s.lamps)||s.lamps.length!==3)return false;this.phase=s.phase;this.run=s.run||0;this.delivered=s.delivered||(s.phase==='completed'?1:0);this.lamps=s.lamps.map(n=>Math.max(0,Math.min(3,n)));this.haul.deserialize(s.haul);this.boarders=(s.boarders||[]).map(b=>({...b}));return true;}
 action(verb,p,ship,{direction,spyglass=false,tool}={},fleet=[]){if(!p||!ship)return false;
  const port=p.mode==='walk'&&Math.hypot(p.x-GHOST_CONTACT.x,p.z-GHOST_CONTACT.z)<4;
  if(verb==='accept'&&port&&['offer','completed'].includes(this.phase)){this.phase='sighting';this.run++;this.lamps=[3,3,3];this.boarders=[];return true;}
  if(verb==='spot'&&this.phase==='sighting'&&spyglass&&direction){const s=fleet[0];if(s){const dx=s.x-p.x,dz=s.z-p.z,d=Math.hypot(dx,dz),n=Math.hypot(direction.x,direction.z);if(d<650&&n>.1&&(dx*direction.x+dz*direction.z)/(d*n)>.98){this.phase='battle';return true;}}}
  if(this.phase==='haul'&&['fire','reel'].includes(verb))return this.haul.action(verb,p,ship,{direction});
  if(verb==='swing'&&this.phase==='defend'&&tool==='cutlass'&&p.mode==='deck'&&direction&&(this.cooldowns.get(p.id)||0)<=this.clock){
   const local=worldToShip(ship,p);if(!local)return false;const c=Math.cos(ship.yaw),s=Math.sin(ship.yaw),dx=c*direction.x-s*direction.z,dz=s*direction.x+c*direction.z;
   const victim=this.boarders.find(b=>b.hp>0&&Math.hypot(b.x-local.x,b.y-local.y,b.z-local.z)<2&&((b.x-local.x)*dx+(b.z-local.z)*dz)>0);
   this.cooldowns.set(p.id,this.clock+.65);if(victim){victim.hp--;victim.phase=victim.hp?'stagger':'dead';victim.timer=.4;return true;}
  }
  if(verb==='deliver'&&this.phase==='return'&&port&&Math.hypot(ship.x-69.8,ship.z-42)<55){this.phase='completed';this.delivered++;return true;}return false;
 }
 hitSegment(a,b,fleet){if(this.phase!=='battle')return null;for(let i=0;i<3;i++){if(this.lamps[i]<=0)continue;const at=this.lampPosition(i,fleet);if(at&&segmentDistance(a,b,at)<.85){this.lamps[i]--;if(this.lamps.every(n=>n===0)){this.phase='haul';this.haul=new CartographerQuest();this.haul.phase='spotted';const s=fleet[0];this.haul.crate={x:s.x,y:.1,z:s.z};}return {lamp:i,point:at};}}return null;}
 update(dt,ship,cargo){dt=Math.max(0,Math.min(.1,dt));this.clock+=dt;if(this.phase==='haul'){this.haul.update(dt,ship);if(this.haul.phase==='salvaged'){this.beginBoarding(ship);}}
  if(this.phase==='defend'){for(const b of this.boarders){if(b.hp<=0)continue;b.timer+=dt;if(b.phase==='approach')this.approachBoarder(b,dt,ship);else if(b.phase==='climb'){b.y+=dt*.8;if(b.y>=1.75){b.y=1.75;b.phase='vault';b.timer=0;}}else if(b.phase==='vault'){const target=Math.sign(b.x)*1.25;b.x+=Math.sign(target-b.x)*Math.min(Math.abs(target-b.x),dt*.8);if(Math.abs(b.x-target)<.01)b.phase='drop';}else if(b.phase==='drop'){b.y=Math.max(.9,b.y-dt*1.2);if(b.y<=.9)b.phase='walk';}
    else if(b.phase==='stagger'){if(b.timer>.4){b.phase='walk';b.timer=0;}}
    else if(b.phase==='walk'){const target={x:Math.sign(b.x||1)*.85,z:-4.47},dx=target.x-b.x,dz=target.z-b.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*.8);b.yaw=Math.atan2(dx,dz);b.x+=dx/Math.max(d,.001)*step;b.z+=dz/Math.max(d,.001)*step;if(d<.05){b.phase='sabotage';b.timer=0;}}
   }if(this.boarders.every(b=>b.hp<=0)&&cargo?.get(this.cargoId)?.state==='hold')this.phase='return';}
 }
}
