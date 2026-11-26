export const SAILOR_ACTIVITIES=Object.freeze(['idle','walk','run','sprint','jump','fall','land','crouch','swim','climb','steer','capstan','sail_pull','cannon_load','cannon_aim','fire','carry','repair','bail','sword_strike','hit','death','recover']);
export const SAILOR_ACTIVITY_SET=new Set([...SAILOR_ACTIVITIES,'helm','station']);
export class SailorActivity{
 constructor(){this.clock=0;this.previousGrounded=true;this.landUntil=0;this.state='idle';}
 update(dt,{player={},voyage=null,land=null,input=null,speed=0}={}){
  this.clock+=Math.max(0,dt);const onDeck=player.mode==='deck',grounded=onDeck?player.deckGrounded:player.grounded,vertical=onDeck?player.deckVel?.y:player.velocity?.y,station=player.stationId,gear=voyage?.equipment;
  if(grounded&&!this.previousGrounded)this.landUntil=this.clock+.18;this.previousGrounded=!!grounded;
  let state='idle';
  if(land?.hp<=0)state='death';
  else if(land?.hurtTimer>0)state='hit';
  else if(land?.invulnerableTimer>2.2)state='recover';
  else if(player.shipClimb||player.boardingClimb||player.mastClimbing)state='climb';
  else if(player.mode==='swim')state='swim';
  else if(station==='helm'||player.mode==='boat')state='steer';
  else if(station?.startsWith('anchor'))state='capstan';
  else if(station?.startsWith('sail'))state='sail_pull';
  else if(station?.startsWith('cannon')){const gun=voyage?.cannons?.[station];state=gun?.phase==='LOADING'?'cannon_load':gun?.phase==='RECOIL'&&gun.recoilRemaining>.43?'fire':'cannon_aim';}
  else if(gear?.active==='plank'&&(gear.repairProgress>0||gear.action==='hammer'||voyage?.merchant?.quest?.holds?.has(voyage.actorId)||voyage?.beacon?.quest?.holder===voyage?.actorId&&voyage?.beacon?.quest?.until>voyage?.beacon?.quest?.clock))state='repair';
  else if(gear?.active==='bucket'&&['scoop','throw'].includes(gear.action)&&gear.actionAge<.55)state='bail';
  else if(land?.attackTimer>0||gear?.active==='cutlass'&&gear.action==='swing'&&gear.actionAge<.5)state='sword_strike';
  else if(voyage?.cargo?.heldBy?.has(voyage.actorId)||voyage?.heldAmmo)state='carry';
  else if(player.crouched)state='crouch';
  else if(!grounded&&vertical>.3)state='jump';
  else if(!grounded&&vertical<-.3)state='fall';
  else if(this.clock<this.landUntil)state='land';
  else if(speed>.19){const sprint=input?.down?.('ShiftLeft')||input?.down?.('ShiftRight');state=sprint?(speed>4.8?'sprint':'run'):speed>3.2?'run':'walk';}
  this.state=state;return state;
 }
}
