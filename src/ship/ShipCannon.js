// Per-cannon mechanical state. Reload completes only after animation time has
// elapsed AND the ship magazine can supply one ball. No infinite R-to-reload.
export class ShipCannon {
 constructor({id,loaded=true}={}){this.id=id;this.phase=loaded?'READY':'EMPTY';this.loadRemaining=0;this.recoilRemaining=0;this.ammoType='cannonball';this.requested='cannonball';this.shots=0;this.queued=false;}
 get ready(){return this.phase==='READY';}
 requestReload(kind='cannonball',{reserved=false}={}){
  if(!['cannonball','chainshot'].includes(kind))return false;
  if(this.phase==='RECOIL'){if(reserved)return false;this.queued=kind;return true;}
  if(this.phase!=='EMPTY')return false;
  this.phase='LOADING';this.loadRemaining=2.8;this.requested=kind;this.reserved=!!reserved;return true;
 }
 tick(dt,inventory){const delta=Math.min(.15,Math.max(0,dt));
  if(this.phase==='LOADING'){this.loadRemaining=Math.max(0,this.loadRemaining-delta);if(this.loadRemaining<=0){
   if(this.reserved||inventory.take(this.requested)){this.ammoType=this.requested;this.phase='READY';}else this.phase='EMPTY';this.reserved=false;
  }}
  if(this.phase==='RECOIL'){this.recoilRemaining-=delta;if(this.recoilRemaining<=0){this.phase='EMPTY';if(this.queued){const type=this.queued;this.queued=false;this.requestReload(type);}}}
 }
 fire(){if(!this.ready)return null;this.phase='RECOIL';this.recoilRemaining=.65;this.shots++;return {id:this.id,ammoType:this.ammoType,shotNumber:this.shots};}
 snapshot(){return {phase:this.phase,loadRemaining:this.loadRemaining,recoilRemaining:this.recoilRemaining,ammoType:this.ammoType,loadRequestId:this.loadRequestId||null,requested:this.requested,reserved:!!this.reserved};}
}
