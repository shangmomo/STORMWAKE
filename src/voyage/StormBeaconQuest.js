import {worldToShip} from './CargoReach.js';
import {CABIN_TABLE} from './VoyageSites.js';
export const BEACON={x:-800,y:-2,z:2250};
export const SHIPWRIGHT={x:62,y:1,z:-73};
export class StormBeaconQuest{
 constructor(){this.phase='offer';this.route=null;this.routeIndex=0;this.progress=0;this.wick=true;this.clock=0;this.until=0;this.holder=null;this.rewards=0;}
 serialize(){return {version:1,phase:this.phase,route:this.route,routeIndex:this.routeIndex,progress:this.progress,wick:this.wick,rewards:this.rewards};}
 deserialize(s){if(s?.version!==1||!['offer','route','sailing','return','completed'].includes(s.phase)||!Number.isFinite(s.progress))return false;this.phase=s.phase;this.route=s.route;this.routeIndex=Math.max(0,Math.min(2,s.routeIndex||0));this.progress=Math.max(0,Math.min(1,s.progress));this.wick=!!s.wick;this.rewards=s.rewards||0;return true;}
 action(verb,p,ship,{tool}={}){if(!p||!ship)return false;const port=p.mode==='walk'&&Math.hypot(p.x-62,p.z+73)<4;
  if(verb==='accept'&&port&&['offer','completed'].includes(this.phase)){this.phase='route';this.progress=0;this.wick=true;return true;}
  const local=worldToShip(ship,p);
  if(['route_coast','route_direct'].includes(verb)&&this.phase==='route'&&p.mode==='deck'&&p.deckLayer==='hold'&&local&&Math.hypot(local.x-CABIN_TABLE.x,local.z-CABIN_TABLE.z)<2.2){this.route=verb==='route_coast'?'coast':'direct';this.phase='sailing';return true;}
  const at=p.mode==='swim'&&Math.hypot(p.x-BEACON.x,p.y-BEACON.y,p.z-BEACON.z)<2.2;
  if(verb==='repair'&&this.phase==='sailing'&&at&&tool==='plank'){this.until=this.clock+.28;this.holder=p.id;return true;}
  if(verb==='fit_wick'&&this.phase==='sailing'&&at&&this.progress>=1&&this.wick){this.wick=false;this.phase='return';return true;}
  if(verb==='deliver'&&this.phase==='return'&&port&&Math.hypot(ship.x-69.8,ship.z-42)<55){this.phase='completed';this.rewards++;return true;}return false;
 }
 get waypoints(){return this.route==='coast'?[{x:130,z:760},{x:-400,z:1500},BEACON]:[BEACON];}
  update(dt,ship){dt=Math.max(0,Math.min(.1,dt));this.clock+=dt;const point=this.waypoints[this.routeIndex];if(ship&&point&&this.routeIndex<this.waypoints.length-1&&Math.hypot(ship.x-point.x,ship.z-point.z)<80)this.routeIndex++;if(this.phase==='sailing'&&this.progress<1&&this.clock<this.until){this.progress=Math.min(1,this.progress+dt/6);if(this.progress>=1&&this.consumePlank&&!this.consumePlank(this.holder))this.progress=.999;}}
 disconnect(id){if(this.holder===id)this.until=0;}
}
