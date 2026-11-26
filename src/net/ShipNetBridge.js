// Same messages in offline and LAN mode. Only the server may mint currency.
import {Quaternion} from '../engine/index.js';
export class ShipNetBridge {
 constructor(runtime){this.runtime=runtime;this.app=runtime.app;this.seq=0;this.hostId=null;this.inventoryRevision=0;this.remoteShip=null;this.remoteInputs=new Map();this.lastStateSent=0;this.lastInputSent=0;}
 get peer(){return this.app.crew;}
 get connected(){return !!this.peer?.connected;}
 get actorId(){return this.peer?.selfId||'local';}
 get isHost(){return !this.connected||this.actorId===this.hostId;}
 send(type,payload={}){if(!this.connected)return false;this.peer.send({type,seq:++this.seq,...payload});return true;}
 claim(id){if(this.pendingClaim)return false;
  if(this.connected){this.pendingClaim={id,elapsed:0,waiting:false};this.cancelledClaim=null;
    this.app.player.pendingStation=id;this.runtime.interact?.record({claimSent:id});
    this.send('station_claim',{stationId:id});return true;}return this.runtime.stations.claim(id,this.actorId,{replaceAI:true});}
 cancelClaim(){const pending=this.pendingClaim;if(!pending)return false;
  this.send('station_release',{stationId:pending.id});this.cancelledClaim=pending.id;
  this.runtime.interact?.record({claimCancelled:pending.id});this.pendingClaim=null;this.app.player.pendingStation=null;return true;}
 release(id){if(this.connected){this.send('station_release',{stationId:id});return true;}return this.runtime.stations.release(id,this.actorId);}
 input(id,cmd){if(!this.connected){return this.runtime.stations.setInput(id,this.actorId,cmd);}
  // The host should apply its own controls immediately; remote claims always wait for server ACK.
  if(this.isHost)this.runtime.stations.setInput(id,this.actorId,{...cmd,reload:this.app.boat.heritageDeck&&id.startsWith('cannon')?false:cmd.reload});
  return this.send('station_input',{stationId:id,axis:cmd.axis||0,throttleAxis:cmd.throttleAxis||0,trimAxis:cmd.trimAxis||0,aimYaw:cmd.aimYaw,aimPitch:cmd.aimPitch,buttons:(cmd.fire?1:0)|(cmd.reload?2:0)|(cmd.repair?4:0)|(cmd.bucket?8:0)});
 }
 receive(msg){if(!msg)return;
  const v=this.runtime;
  if(msg.type==='harbor_trade_receipt'){v.harborTrade?.receipt(msg.ok?(msg.upgrade?'\u5347\u7ea7\u5df2\u5b89\u88c5':'\u8d27\u7bb1\u5df2\u653e\u5728\u8239\u5320\u8eab\u65c1'):'\u65e0\u6cd5\u8d2d\u4e70\uff1a\u6f6e\u5e01\u4e0d\u8db3\u6216\u5df2\u62e5\u6709');return;}
  if(msg.type==='supply_stock'||msg.type==='supply_unpacked'){if(msg.inventoryRevision<=this.inventoryRevision)return;for(const [kind,count] of Object.entries(msg.ammo||{})){const delta=this.isHost?v.inventory.count(kind)-(msg.baseAmmo?.[kind]??v.inventory.count(kind)):0;v.inventory.set(kind,Math.max(0,Math.min(999,count+delta)));}this.inventoryRevision=msg.inventoryRevision;if(msg.type==='supply_unpacked')v.toast('补给已入库',3);return;}
  if(msg.type==='supply_personal'){const before={planks:v.equipment.planks,ammo:v.heldAmmo,bucket:v.hasBucket};v.equipment.planks=msg.planks;v.heldAmmo=msg.ammo;v.hasBucket=!!msg.bucket;if(msg.ammo&&!before.ammo)v.equipment.equip('hands');else if(msg.bucket&&!before.bucket)v.equipment.equip('bucket');else if(msg.planks>before.planks)v.equipment.equip('plank');return;}
  if(msg.type==='supply_loose'){v.bucketRackStock=!!msg.bucketStock;v.looseSupplies.sync(msg.items||[]);return;}
  if(msg.type==='supply_notice'){v.toast(msg.text,3);return;}
  if(msg.type==='cannon_load_request'){if(this.isHost){const gun=v.cannons[msg.stationId],accepted=gun?.loadRequestId===msg.requestId||!!gun?.requestReload(msg.kind,{reserved:true});if(accepted)gun.loadRequestId=msg.requestId;this.send('cannon_load_result',{requestId:msg.requestId,accepted});}return;}
  if(msg.type==='hunt_delivery'){for(const r of msg.receipts||[])this.app.hunt?.progress.defeat(r.boss,r.receipt);return;}
  if(msg.type==='ghost_fleet_reset'){v.ghostFleet?.resetLanternPatrol();return;}
  if(msg.type==='titan_contact'){this.app.hunt?.bosses.applyConfirmedContact(msg);return;}
  if(msg.type==='titan_cut'){this.app.hunt?.bosses.applyTentacleCut(msg);return;}
  if(msg.type==='deep_echo_state'){v.deepEcho?.quest.deserialize(msg.state);return;}
  if(msg.type==='ghost_lantern_state'){v.ghostLantern?.quest.deserialize(msg.state);return;}
  if(msg.type==='merchant_state'){v.merchant?.quest.deserialize(msg.state);return;}
  if(msg.type==='beacon_state'){v.beacon?.quest.deserialize(msg.state);return;}
  if(msg.type==='cartographer_state'){v.cartographer?.quest.deserialize(msg.state);return;}
  if(msg.type==='welcome'){if(msg.supplyHand&&this.app.boat.heritageDeck)this.receive({type:'supply_personal',...msg.supplyHand});if(msg.deckSupplies)this.receive({type:'supply_loose',...msg.deckSupplies});if(Number.isInteger(msg.inventoryRevision))this.inventoryRevision=msg.inventoryRevision;
    if(msg.deepEcho)v.deepEcho?.quest.deserialize(msg.deepEcho);
    if(msg.ghostLantern)v.ghostLantern?.quest.deserialize(msg.ghostLantern);
    if(msg.merchant)v.merchant?.quest.deserialize(msg.merchant);
    if(msg.beacon)v.beacon?.quest.deserialize(msg.beacon);
    if(msg.cartographer)v.cartographer?.quest.deserialize(msg.cartographer);
    this.hostId=msg.hostId||msg.id;
    if(typeof msg.sourceDoorOpen==='boolean')this.app.boat.originalDoor?.set(msg.sourceDoorOpen);
    for(const [id,owner] of Object.entries(msg.stations?.occupants||{}))v.stations.setRemoteOccupant(id,owner);
    if(msg.voyage)v.voyage.deserialize(msg.voyage);
    if(Array.isArray(msg.cargo))v.cargo.deserialize(msg.cargo);
    if(msg.shipState){this.remoteShip=msg.shipState;this.applyShipExtra(msg.shipState);}
    v.refreshVisuals();
  }else if(msg.type==='ship_door'){
    if(typeof msg.open==='boolean')this.app.boat.originalDoor?.set(msg.open);
  }else if(msg.type==='ship_host'){
    const wasHost=this.isHost;
    this.hostId=msg.hostId;
    // When the old captain disconnects, adopt the LAST authoritative ship
    // snapshot before simulating as the new host. Otherwise a fresh local
    // hull pose snaps the entire crew back to the joiner's harbor.
    if(!wasHost&&this.isHost&&this.remoteShip){
      const s=this.remoteShip,b=this.app.boatCtl;
      if([s.x,s.y,s.z,s.yaw,s.vx,s.vz].every(Number.isFinite)) {
        b.position.set(s.x,s.y,s.z);b.velocity.set(s.vx,s.vy||0,s.vz);
        if(s.rotation)b.quaternion.set(s.rotation.x,s.rotation.y,s.rotation.z,s.rotation.w).normalize();
        else b.quaternion.setFromAxisAngle({x:0,y:1,z:0},s.yaw);
        if(s.angular)b.angular.set(s.angular.x,s.angular.y,s.angular.z);b.apply();
      }
      v.stations.anchorDown=!!s.anchor;
      if(Number.isFinite(s.anchorTravel))v.stations.anchorTravel=s.anchorTravel;
      if(Number.isFinite(s.helmThrottle))v.stations.helmThrottle=s.helmThrottle;
      if(Number.isFinite(s.sailMain))v.stations.sailMain=s.sailMain;
      if(Number.isFinite(s.sailJib))v.stations.sailJib=s.sailJib;
      this.applyShipExtra(s);this.lastStateSent=0;
    }
  }else if(msg.type==='station_update'){
    v.stations.setRemoteOccupant(msg.stationId,msg.actorId);
    if(msg.actorId===this.actorId){
      if(this.cancelledClaim===msg.stationId){this.send('station_release',{stationId:msg.stationId});return;}
      this.pendingClaim=null;this.app.player.pendingStation=null;
      v.interact?.record({ack:true,finalStation:msg.stationId});
      v.app.player.stationId=msg.stationId;if(msg.stationId)v._faceStation(msg.stationId);}
    else if(v.app.player.stationId===msg.stationId && v.stations.getOccupant(msg.stationId)!==this.actorId)v.app.player.stationId=null;
  }else if(msg.type==='station_input'){
    if(this.isHost&&msg.actorId!==this.actorId){this.remoteInputs.set(msg.actorId,{id:msg.stationId,age:0});
      v.stations.setInput(msg.stationId,msg.actorId,{axis:msg.axis||0,throttleAxis:msg.throttleAxis||0,trimAxis:msg.trimAxis||0,aimYaw:msg.aimYaw,aimPitch:msg.aimPitch,fire:!!(msg.buttons&1),reload:!!(msg.buttons&2),repair:!!(msg.buttons&4),bucket:!!(msg.buttons&8)});}
  }else if(msg.type==='station_rejected'){
    if(this.pendingClaim?.id===msg.stationId){this.pendingClaim=null;this.app.player.pendingStation=null;}
    v.interact?.record({ack:false,station:msg.stationId,reason:msg.reason});
    v.toast('岗位占领失败：'+(msg.reason==='occupied'?'已有船员占用':'当前不可用'));
  }else if(msg.type==='ship_state'){
    if(!this.isHost){this.remoteShip=msg;this.applyShipExtra(msg);}
    v.stations.sailMain=msg.sailMain??v.stations.sailMain;
    v.stations.sailJib=msg.sailJib??v.stations.sailJib;
    if(Number.isFinite(msg.sailTrim))v.stations.sailTrim=msg.sailTrim;
    v.stations.anchorDown=!!msg.anchor;
    if(Number.isFinite(msg.anchorTravel)){v.stations.anchorTravel=msg.anchorTravel;v.stations.anchorTravelReady=true;}
    if(Number.isFinite(msg.anchorCrankTurns))v.stations.anchorCrankTurns=msg.anchorCrankTurns;
    if(Number.isInteger(msg.anchorHands))v.stations.anchorHands=msg.anchorHands;
    if(Number.isInteger(msg.repairStock))v.repairStock=msg.repairStock;
    if(Number.isFinite(msg.helmThrottle))v.stations.helmThrottle=Math.max(-1,Math.min(1,msg.helmThrottle));
    if(!this.isHost&&Number.isFinite(msg.rudder))v.stations.rudder=msg.rudder;
    if(msg.bilgeSections&&v.damage?.hull){
      for(const key of ['stern','mid','bow'])if(Number.isFinite(msg.bilgeSections[key]))v.damage.hull.sections[key]=msg.bilgeSections[key];
      v.damage.hull.water=v.damage.hull.totalWater();v.damage.water=v.damage.hull.water;
    }else if(Number.isFinite(msg.water))v.damage.water=msg.water;
    v.damage.integrity=msg.integrity??v.damage.integrity;v.damage.breach=msg.breach??v.damage.breach;v.damage.fire=msg.fire??v.damage.fire;v.damage.sunk=v.damage.integrity<=0||v.damage.water>=.98;
  }else if(msg.type==='voyage_state'){
    if(msg.state)v.voyage.deserialize(msg.state);
    v.refreshVisuals();
  }else if(msg.type==='cargo_spawn'){
    v.cargo.spawnChest(msg.itemId,{x:msg.x,y:msg.y||0,z:msg.z});v.refreshVisuals();
  }else if(msg.type==='cargo_update'){
    if(Array.isArray(msg.items))v.cargo.deserialize(msg.items);v.refreshVisuals();
  }else if(msg.type==='cargo_rejected'){
    v.toast('货物操作被拒绝：请站在正确的货舱位置，靠近宝箱再操作。');
  }else if(msg.type==='cargo_despawn'){
    v.cargo.remove(msg.itemId);v.refreshVisuals();
  }else if(msg.type==='economy'){
    if(msg.state)v.voyage.deserialize(msg.state);v.refreshVisuals();
  }else if(msg.type==='cannon_fire'){
    if(!this.isHost)v._spawnBall(msg);
  }else if(msg.type==='ship_tool'){
    if(this.isHost&&msg.actorId!==this.actorId){
      if(msg.verb==='bail')v.damage.bail(.22);
      else if(msg.verb==='douse')v.damage.douse(1);
      else if(msg.verb==='patch'&&!v.damage.isSinking())v.damage.patchHole(msg.holeId);
    }
  }else if(msg.type==='enemy_ship'){
    if(!this.isHost)Object.assign(v.enemy,msg);
  }
 }
 applyShipExtra(msg){const v=this.runtime;if(Number.isFinite(msg.floodCollapse))this.app.boatCtl.voyageFloodCollapse=msg.floodCollapse;if(Number.isInteger(msg.inventoryRevision))this.inventoryRevision=msg.inventoryRevision;
  if(msg.ghostFleet)v.ghostFleet?.applySnapshot(msg.ghostFleet);
  if(this.isHost&&msg.anchorTether&&this.app.boatCtl?.anchorTether){const target=this.app.boatCtl.anchorTether,s=msg.anchorTether;
    target.point=s.point?{...s.point}:null;target.state=s.state;target.chain=s.chain;target.bottomDepth=s.depth??Infinity;target.tension=s.tension||0;}
  if(msg.ammo)for(const [kind,count] of Object.entries(msg.ammo))v.inventory?.set(kind,count);
  if(msg.bilgeSections&&v.damage?.hull){for(const k of ['stern','mid','bow'])
    if(Number.isFinite(msg.bilgeSections[k]))v.damage.hull.sections[k]=msg.bilgeSections[k];
    v.damage.hull.water=v.damage.hull.totalWater();v.damage.water=v.damage.hull.water;}
  if(Array.isArray(msg.holes)&&v.damage?.hull){
   v.damage.hull.holes=msg.holes.map(h=>({...h,local:{...h.local}}));
   v.damage.hull.nextId=1+v.damage.hull.holes.reduce((max,h)=>Math.max(max,Number(h.id.split('_')[1])||0),0);
  }
  if(Array.isArray(msg.crew))for(const actor of msg.crew){const local=v.crew?.getActor(actor.id);if(local)Object.assign(local,actor);}
  if(msg.cannons)for(const [id,state] of Object.entries(msg.cannons)){const cannon=v.cannons?.[id];if(cannon&&['READY','EMPTY','LOADING','RECOIL'].includes(state.phase)){cannon.phase=state.phase;cannon.loadRemaining=state.loadRemaining;cannon.requested=state.requested||state.ammoType||'cannonball';cannon.ammoType=state.ammoType||'cannonball';cannon.reserved=!!state.reserved;cannon.loadRequestId=state.loadRequestId||null;cannon.recoilRemaining=state.recoilRemaining||0;}}
 }
 beforePhysics(dt){
  if(this.isHost||!this.remoteShip)return;
  const s=this.remoteShip,b=this.app.boatCtl;
  if(![s.x,s.y,s.z,s.yaw,s.vx,s.vz].every(Number.isFinite))return;
  const t=Math.min(.42,dt*10);
  b.position.x+=(s.x-b.position.x)*t;b.position.y+=(s.y-b.position.y)*t;b.position.z+=(s.z-b.position.z)*t;
  b.velocity.x+=(s.vx-b.velocity.x)*t;b.velocity.z+=(s.vz-b.velocity.z)*t;
  b.velocity.y+=((s.vy||0)-b.velocity.y)*t;
  const angle=Math.atan2(Math.sin(s.yaw-b.getYaw()),Math.cos(s.yaw-b.getYaw()));
  if(s.rotation){this.rotationTarget=this.rotationTarget||new Quaternion();
    this.rotationTarget.set(s.rotation.x,s.rotation.y,s.rotation.z,s.rotation.w).normalize();b.quaternion.slerp(this.rotationTarget,t);}
  else b.quaternion.setFromAxisAngle({x:0,y:1,z:0},b.getYaw()+angle*t);
  b.throttle=0;b.rpm=0;b.angular.set(0,0,0);
  b.apply();
 }
 update(dt){const v=this.runtime;
  if(!this.connected){
    if(this.wasConnected){v.stations.releaseActor(this.networkActor);this.app.player.stationId=null;this.remoteInputs.clear();this.wasConnected=false;}
    if(this.pendingClaim){this.pendingClaim=null;this.app.player.pendingStation=null;}return;}
  this.wasConnected=true;this.networkActor=this.actorId;
  if(this.pendingClaim){const p=this.pendingClaim;p.elapsed+=Math.max(0,dt);
    if(p.elapsed>=.5&&!p.waiting){p.waiting=true;v.toast('正在等待房间确认岗位…',1);}
    if(p.elapsed>=1.5){this.cancelClaim();v.toast('岗位请求超时，请靠近设备后重试。',2);}}
  for(const [actor,entry] of this.remoteInputs){entry.age+=Math.max(0,dt);
    if(entry.age>.35){v.stations.inputs.delete(actor);this.remoteInputs.delete(actor);}}
  if(this.isHost){
    this.lastStateSent-=dt;
    if(this.lastStateSent<=0){this.lastStateSent=1/12;const b=this.app.boatCtl;
      this.send('ship_state_host',{floodCollapse:b.voyageFloodCollapse||0,inventoryRevision:this.inventoryRevision,ghostFleet:v.ghostFleet.snapshot(),anchorTether:b.anchorTether.snapshot(),rotation:{x:b.quaternion.x,y:b.quaternion.y,z:b.quaternion.z,w:b.quaternion.w},vy:b.velocity.y,angular:{x:b.angular.x,y:b.angular.y,z:b.angular.z},shipClass:this.app.boat?.heritageDeck?'heritage':'legacy',ammo:v.inventory.serialize(),holes:v.damage.hull.serialize().holes,crew:[...v.crew.actors.values()].map(a=>({id:a.id,x:a.x,y:a.y,z:a.z,yaw:a.yaw,job:a.job,phase:a.phase,station:a.station,node:a.node,holding:a.holding})),cannons:Object.fromEntries(Object.entries(v.cannons).map(([id,c])=>[id,c.snapshot()])),x:b.position.x,y:b.position.y,z:b.position.z,yaw:b.getYaw(),vx:b.velocity.x,vz:b.velocity.z,
        rudder:v.stations.rudder,sailMain:v.stations.sailMain,sailJib:v.stations.sailJib,sailTrim:v.stations.sailTrim,water:v.damage.water,bilgeSections:{...v.damage.hull.sections},anchorTravel:v.stations.anchorTravel,anchorCrankTurns:v.stations.anchorCrankTurns,anchorHands:v.stations.anchorHands,anchorState:b.anchorTether?.state,anchorTension:b.anchorTether?.tension,repairStock:v.repairStock,helmThrottle:v.stations.helmThrottle,anchor:v.stations.anchorDown,integrity:v.damage.integrity,breach:v.damage.breach,fire:v.damage.fire});
      this.send('enemy_ship_host',v.enemy.snapshot());
    }
  }
 }
}
