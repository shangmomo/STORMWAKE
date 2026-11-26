import {ShipDamage} from '../ship/ShipDamage.js';
import {worldToShip} from './CargoReach.js';
export const MERCHANT_START={x:270,y:0,z:920,yaw:Math.atan2(-140,-160)};
export const MERCHANT_SAFE={x:130,z:760};
export class MerchantRescueQuest{
 constructor(){this.phase='offer';this.run=0;this.delivered=0;this.clock=0;this.holds=new Map();this.buckets=new Set();this.ship={...MERCHANT_START};this.damage=new ShipDamage();}
 begin(){this.ship={...MERCHANT_START};this.damage=new ShipDamage({integrity:75,water:.25});this.damage.hull.addHole({x:1.3,y:-.2,z:-2},{radius:.1});this.damage.hull.addHole({x:-1.3,y:-.3,z:1.6},{radius:.11});this.phase='rescue';this.run++;this.holds.clear();this.buckets.clear();}
 serialize(){return {version:1,phase:this.phase,run:this.run,delivered:this.delivered,ship:{...this.ship},damage:this.damage.serialize(),buckets:[...this.buckets]};}
 deserialize(s){if(s?.version!==1||!['offer','rescue','escort','return','completed','failed'].includes(s.phase)||!s.ship||!['x','y','z','yaw'].every(k=>Number.isFinite(s.ship[k])))return false;this.phase=s.phase;this.run=s.run||0;this.delivered=s.delivered||(s.phase==='completed'?1:0);this.ship={...s.ship};this.damage=new ShipDamage(s.damage);this.buckets=new Set(s.buckets||[]);return true;}
 get cargoId(){return 'merchant_cargo_'+this.run;}
 action(verb,p,mother,{tool,holeId}={}){
  if(!p||!mother)return false;const port=p.mode==='walk'&&Math.hypot(p.x-56,p.z+71)<4;
  if(verb==='accept'&&port&&['offer','completed','failed'].includes(this.phase)){this.begin();return true;}
  const local=worldToShip(this.ship,p);if(!local)return false;
  if(verb==='repair'&&this.phase==='rescue'&&tool==='plank'){const hole=this.damage.hull.get(holeId);if(hole?.state==='open'&&Math.hypot(local.x-hole.local.x,local.y-hole.local.y,local.z-hole.local.z)<2){this.holds.set(p.id,{holeId,until:this.clock+.28});return true;}}
  if(verb==='scoop'&&this.phase==='rescue'&&tool==='bucket'&&p.mode==='walk'&&Math.abs(local.x)<1.2&&Math.abs(local.z)<4&&local.y>-.5&&local.y<3&&!this.buckets.has(p.id)&&this.damage.water>.001){this.damage.bail(.08);this.buckets.add(p.id);return true;}
  if(verb==='throw'&&tool==='bucket'&&Math.abs(local.x)>1&&Math.abs(local.x)<3&&Math.abs(local.z)<7&&this.buckets.has(p.id)){this.buckets.delete(p.id);return true;}
  if(verb==='deliver'&&this.phase==='return'&&port&&Math.hypot(mother.x-69.8,mother.z-42)<55){this.phase='completed';this.delivered++;return true;}return false;
 }
 update(dt,mother,cargo){dt=Math.max(0,Math.min(.1,dt));this.clock+=dt;
  if(this.phase==='rescue'){
   if(mother&&Math.hypot(mother.x-this.ship.x,mother.z-this.ship.z)<400)this.damage.update(dt);
   const rates=new Map();for(const [actor,h] of this.holds)if(h.until>this.clock){if(!rates.has(h.holeId))rates.set(h.holeId,[]);rates.get(h.holeId).push(actor);}
   for(const [id,hands] of rates){const h=this.damage.hull.get(id);if(h?.state==='open'){h.progress=Math.min(1,h.progress+dt/2.2*Math.min(hands.length,2));if(h.progress>=1){const paid=hands.some(actor=>this.consumePlank?this.consumePlank(actor):true);if(paid)this.damage.patchHole(id);else h.progress=.999;}}}
   if(this.damage.isSinking())this.phase='failed';
   else if(this.damage.holes.every(h=>h.state==='sealed')&&this.damage.water<.1&&cargo?.get(this.cargoId)?.state==='hold')this.phase='escort';
  }
  if(this.phase==='escort'&&mother&&Math.hypot(mother.x-this.ship.x,mother.z-this.ship.z)<140){const dx=MERCHANT_SAFE.x-this.ship.x,dz=MERCHANT_SAFE.z-this.ship.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*2.2);this.ship.x+=dx/Math.max(1,d)*step;this.ship.z+=dz/Math.max(1,d)*step;if(d<8)this.phase='return';}
 }
 disconnect(id){this.holds.delete(id);this.buckets.delete(id);}
}
