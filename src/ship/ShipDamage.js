import {HullCompartments} from './HullCompartments.js';
import {Vector3} from '../engine/index.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export class ShipDamage {
 constructor(snapshot={}){
  this.integrity=clamp(Number(snapshot.integrity??100),0,100);
  this.breach=clamp(Number(snapshot.breach??0),0,1);
  this.fire=clamp(Number(snapshot.fire??0),0,1);
  this.water=clamp(Number(snapshot.water??0),0,1);
  this.sunk=!!snapshot.sunk;
  this.hull=new HullCompartments({holes:snapshot.holes||[],water:this.water,sections:snapshot.sections});
  this._hitIndex=0;
 }
 applyHit(amount,kind='ball',local=null){
  if(this.sunk||!Number.isFinite(amount)||amount<=0)return false;
  this.integrity=clamp(this.integrity-amount,0,100);
  if(kind==='ball'||kind==='ram'){
   const points=[{x:1.05,y:-.18,z:-1.45},{x:-1.05,y:-.2,z:.4},{x:1.0,y:-.34,z:1.5},{x:-1.08,y:-.22,z:-2.1}];
   this.hull.addHole(local||points[this._hitIndex++%points.length],{radius:clamp(.07+amount*.003,.085,.36)});
   this.breach=this.hull.breach;
  }
  if(kind==='chain')this.rigDamage=clamp((this.rigDamage||0)+amount*.018,0,1);
  if(kind==='fire')this.fire=clamp(this.fire+amount*.012,0,1);
  this.sunk=this.integrity===0;return true;
 }
 get holes(){return this.hull.holes;}
 nearbyHole(local,radius=1.35){return this.hull.nearest(local,{maxDistance:radius});}
 patchHole(id){if(this.sunk||!this.hull.patch(id))return false;this.breach=this.hull.breach;this.integrity=clamp(this.integrity+17,0,100);return true;}
 update(dt,{boat=null,waterline=0}={}){
  if(this.sunk)return;
  if(this.hull.holes.length){
    // External consumers (rain, network state) may alter the normalized water.
    if(Math.abs(this.hull.water-this.water)>1e-6)this.hull.setWater(this.water);
    this.water=this.hull.update(dt,{waterline,worldPoint:boat?.toWorld?loc=>boat.toWorld(new Vector3(loc.x,loc.y,loc.z),new Vector3()):undefined});this.breach=this.hull.breach;}
  else{this.water=clamp(this.water+dt*this.breach*.026,0,1);this.hull.setWater(this.water);}
  this.integrity=clamp(this.integrity-dt*(this.breach*.8+this.fire*1.3+this.water*2.4),0,100);
  this.sunk=this.integrity===0||this.water>=.98;
 }
 repair(dt,rate=14){if(this.sunk)return false;this.integrity=clamp(this.integrity+dt*rate,0,100);
  // Older code path: shipyard/refit. Gameplay hole repair must call patchHole(id).
  if(!this.hull.holes.length)this.breach=clamp(this.breach-dt*.09,0,1);
  return true;
 }
 bail(capacity=.22,atZ=null){if(this.sunk)return 0;
  if(Math.abs(this.hull.water-this.water)>1e-6)this.hull.setWater(this.water);
  const water=this.hull.bail(capacity,atZ);this.water=this.hull.water;return water;}
 douse(dt=1){this.fire=clamp(this.fire-dt*.55,0,1);}
 isSinking(){return this.sunk;}
 serialize(){return {integrity:this.integrity,breach:this.breach,fire:this.fire,water:this.water,sunk:this.sunk,holes:this.hull.serialize().holes,sections:{...this.hull.sections},rigDamage:this.rigDamage||0};}
}
