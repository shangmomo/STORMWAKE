// STORMWAKE V42 - actual carried equipment, not instant-action menu buttons.
// Only the local player drives this state. Host validates the corresponding
// ship repair/fire/treasure effects via the existing ship authority bridge.
export const GEAR = Object.freeze(['hands','cutlass','bucket','shovel','lantern','spyglass','plank']);
export const GEAR_KEYS = Object.freeze({Digit7:'bucket',Digit8:'shovel',Digit4:'lantern',Digit5:'spyglass',Digit6:'plank',Digit0:'hands'});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export class PirateEquipment {
 constructor(){this.active='hands';this.bucketFull=false;this.bucketContent=null;this.planks=5;this.repairProgress=0;this.actionAge=0;this.action='idle';this.lastResult='';this.raised=false;}
 equip(item,{carrying=false,station=false}={}){
  if(!GEAR.includes(item)||carrying||station)return false;
  this.active=item;this.repairProgress=0;this.action='draw';this.actionAge=0;
  return true;
 }
 tick(dt){this.actionAge+=Math.max(0,dt);if(this.actionAge>.5)this.action='idle';}
 animate(action){this.action=action;this.actionAge=0;}
 // A bucket is empty until it is physically scooped. No free fire extinguish.
 scoop(damage){
  if(this.active!=='bucket'||this.bucketFull)return {ok:false,reason:'full'};
  const amount=damage.bail?.(.22)??0;
  if(amount<=0)return {ok:false,reason:'dry'};
  this.bucketFull=true;this.bucketContent='bilge';this.animate('scoop');return {ok:true,amount};
 }
 fillSea(){if(this.active!=='bucket'||this.bucketFull)return false;this.bucketFull=true;this.bucketContent='sea';this.animate('scoop');return true;}
 throwWater(damage,{overboard=false,atFire=false}={}){
  if(this.active!=='bucket'||!this.bucketFull)return {ok:false,reason:'empty'};
  if(!overboard&&!atFire)return {ok:false,reason:'aim'};
  if(atFire)damage.douse?.(1);
  this.bucketFull=false;this.bucketContent=null;this.animate('throw');return {ok:true};
 }
 // Repairing requires real time and a finite plank. Interrupted attempts lose
 // progress, but never consume material until a patch completes.
 repair(dt,damage,{nearHole=false,held=false,holeId=null}={}){
  if(this.active!=='plank'||this.planks<=0||!nearHole||!held||damage.isSinking?.()){
   this.repairProgress=0;return {ok:false,progress:0,reason:this.planks<=0?'no-planks':'not-repairing'};
  }
  if(holeId && (!damage.holes?.some(h=>h.id===holeId&&h.state==='open'))){this.repairProgress=0;return {ok:false,progress:0,reason:'sealed'};}
  if(damage.integrity>=99.95&&damage.breach<.001){this.repairProgress=0;return {ok:false,progress:0,reason:'healthy'};}
  this.repairProgress=clamp(this.repairProgress+Math.min(dt,.1)/2.2,0,1);
  this.animate('hammer');
  if(this.repairProgress<1-1e-6)return {ok:true,progress:this.repairProgress,finished:false};
  this.repairProgress=0;this.planks--;if(holeId)damage.patchHole(holeId);else damage.repair(1.7,14);
  return {ok:true,progress:1,finished:true,remaining:this.planks};
 }
 restock(count=3){const before=this.planks;this.planks=clamp(this.planks+count,0,9);return this.planks-before;}
 clearTransient(){this.repairProgress=0;this.raised=false;}
}
