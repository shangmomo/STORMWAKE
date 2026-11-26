import {interactionDistance,heldInteraction} from '../interact/InteractionGeometryV79.js';
import {TOOL_SLOTS,controlContext} from '../core/ControlPolicy.js';
import {missionLog,journalSignature} from './MissionLog.js';
import {nearestCombatTitan,combatCourse} from '../ship/CombatHelm.js';
import {SailingCourse} from '../ship/SailingCourse.js';
import {aimCannonMount,cannonMuzzle} from '../ship/CannonMount.js';
import {SailorBody} from '../ship/SailorBody.js';
import {SailorActivity} from '../ship/SailorActivity.js';
import {Quaternion} from '../engine/index.js';
import {HarborTradeRuntime} from './HarborTradeRuntime.js';
import {ShipLoadDynamics,cargoMass} from '../ship/ShipLoadDynamics.js';
import {releaseSunkenCargo} from './SunkenCargo.js';
import {ARSENAL_SITES} from '../ship/ArsenalSites.js';
import {HarborQuestPeople} from '../world/HarborQuestPeople.js';
import {StationHandRig,stationHandTargets} from '../ship/StationHandRig.js';
import {sellMonsterSpoils} from './MonsterSpoils.js';
import {DeepEchoRuntime} from './DeepEchoRuntime.js';
import {GhostLanternRuntime} from './GhostLanternRuntime.js';
import {MerchantRescueRuntime} from './MerchantRescueRuntime.js';
import {StormBeaconRuntime} from './StormBeaconRuntime.js';
import {CartographerRuntime} from './CartographerRuntime.js';
import {spawnSpectralSpoils,sellSpectralSpoils} from './SpectralSpoils.js';
import {SpectralWeather} from '../offshore/SpectralWeather.js';
import {BoatModel} from '../world/BoatModel.js';
import {installHeritageStationAssets,loadStaticArtistModel,SHIP_ART_CATALOG} from '../ship/HeritageAssetRig.js';
import {Vector3} from '../engine/index.js';
import {getLocale} from '../course/Localization.js';
import {ShipStations} from '../ship/ShipStations.js';
import {buildSafeSeaRoute} from '../ship/FreeSeaNavigation.js';
import {cannonDirection} from '../ship/CannonBallistics.js';
import {SHIP_STATION_SITES,shipPoint,stationLocalMeters} from '../ship/StationSites.js';
import {ShipDamage} from '../ship/ShipDamage.js';
import {segmentHullHit} from '../ship/ShipHitGeometry.js';
import {CrewAI} from '../ship/CrewAI.js';
import {CrewVisuals} from '../ship/CrewVisuals.js';
import {PirateEquipment} from '../ship/PirateEquipment.js';
import {PirateHands} from '../ship/PirateHands.js';
import {EnemyShipController} from '../combat/EnemyShipController.js';
import {ShipCannon} from '../ship/ShipCannon.js';
import {ShipInventory} from '../ship/ShipInventory.js';
import {GhostFleet} from '../offshore/GhostFleet.js';
import {VortexVisuals} from '../offshore/VortexVisuals.js';
import {StormRain} from '../offshore/StormRain.js';
import {ShipInterior} from '../ship/ShipInterior.js';
import {ShipStorageSpace} from '../ship/ShipStorageSpace.js';
import {ShipLooseProps} from '../ship/ShipLooseProps.js';
import {actualHalfWidth,deckHeight,CABIN} from '../ship/HeritageDeck.js';
import {beginShipClimb,beginCabinDoorExit,beginCabinDoorEnter} from '../ship/ShipLadder.js';
import {DutchLowerHold} from '../ship/DutchLowerHold.js';
import {bakeShipCollision} from '../ship/ShipCollisionWorld.js';
import {installInteriorLanterns} from '../ship/InteriorLanterns.js';
import {installShipStairs} from '../ship/ShipStairs.js';
import {ANCHOR_HAWSE} from '../ship/AnchorKinematics.js';
import {ShipHullVisuals} from '../ship/ShipHullVisuals.js';
import {isDryHoldCamera} from '../ship/DryHoldCamera.js';
import {ShipNetBridge} from '../net/ShipNetBridge.js';
import {VoyageDirector} from './VoyageDirector.js';
import {voyageJournal} from './VoyageJournal.js';
import {VOYAGE_GOLD_MOSS} from './VoyageDefs.js';
import {Cargo} from './Cargo.js';
import {DigSite} from './DigSite.js';
import {Broker} from './Broker.js';
import {InteractionDirector} from '../interact/InteractionDirector.js';
import {STORMWAKE_M1,makeVoyageNotice,makeBroker,makeDigMarker,makeChest,makeStationMarkers,makeDeckFire,makeCannonBall} from './VoyageWorld.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const htmlText=s=>String(s??'').replace(/[<>&"']/g,x=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[x]));
const cc=(key)=>{try{return localStorage.getItem(key);}catch{return null;}};
const L=(zh,en)=>getLocale()==='en'?en:zh;
const save=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
export class VoyageM1 {
 constructor(app){
  this.app=app;this.input=app.input;this.time=0;this.stations=new ShipStations({cooperativeCapstan:!!app.boat.heritageDeck});
  this.stations.anchorDown=true;this.damage=new ShipDamage();this.damage.hull.setShipScale(app.boat.shipScale);
  this.equipment=new PirateEquipment();this.equipment.planks=app.boat.heritageDeck?0:3;this.hasBucket=!app.boat.heritageDeck;this.bucketRackStock=!!app.boat.heritageDeck;this.heldAmmo=null;
  this.looseSupplies=new ShipLooseProps(app.scene,app.boatCtl);this.hands=new PirateHands(app.scene);this.stationHands=new StationHandRig(app.scene);this.repairProgress=new Map();this.inventory=new ShipInventory({cannonball:18,chainshot:4,plank:9,food:8});this.repairStock=9;
  this.cannons={cannon_port:new ShipCannon({id:'cannon_port'}),cannon_starboard:new ShipCannon({id:'cannon_starboard'})};
  this.interior=app.boat.heritageDeck&&app.boat.captainCabin?app.boat.captainCabin:new ShipInterior(app.boat);
  if(app.boat.heritageDeck&&!app.boat.captainCabin){this.interior.root.visible=false;this.interior.inHatch=()=>false;}
  this.storageSpace=new ShipStorageSpace(this.interior);
  this.lowerHold=app.boat.heritageDeck?new DutchLowerHold(app.boat):null;
  if(app.boat.heritageArt){app.boat.lowerHold=this.lowerHold;installShipStairs(app.boat);bakeShipCollision(app.boat);}
  if(app.boat.heritageArt)installInteriorLanterns(app.boat);
  this.lowerStorageSpace=this.lowerHold?new ShipStorageSpace(this.lowerHold):null;
  app.player.shipInterior=this.interior;app.player.lowerHold=this.lowerHold;app.player.deckLayer='deck';
  this.hullVisuals=new ShipHullVisuals(app.boat,this.damage);this.lastToolMouse=false;this.spyglassWasRaised=false;
  this.crew=new CrewAI(this.stations,{boat:app.boat});this.crewVisuals=new CrewVisuals(app.boat,this.stations,this.crew);this.net=new ShipNetBridge(this);
  app.boat.anchorContext=()=>{const b=app.boatCtl,q=b.quaternion;
    return {hawseWorld:b.toWorld(new Vector3(ANCHOR_HAWSE.x,ANCHOR_HAWSE.y,ANCHOR_HAWSE.z),new Vector3()),
      ship:{x:b.position.x,y:b.position.y,z:b.position.z,yaw:b.getYaw(),rotation:{x:q.x,y:q.y,z:q.z,w:q.w}},
      inverseRotation:q.clone().invert(),tether:this.net.isHost?b.anchorTether.snapshot():this.net.remoteShip?.anchorTether};};
  this.voyage=new VoyageDirector({storage:typeof localStorage!=='undefined'?localStorage:null});
  this.cargoWaterSlot=app.query?.allocate?.('floatingCargo',10)??null;this.cargo=new Cargo();this.dig=new DigSite({duration:VOYAGE_GOLD_MOSS.digSeconds});
  this.broker=new Broker({voyage:this.voyage,cargo:this.cargo,shipId:STORMWAKE_M1.shipId});
  // Keep the voyage and its treasure in one atomic snapshot. The older
  // separate keys are still read for migration, but no longer define recovery.
  let restored=false;
  try{const snapshot=JSON.parse(cc('stormwake.m1.snapshot.v2')||'null');
    if(snapshot?.version===2&&snapshot.voyage&&Array.isArray(snapshot.cargo)){
      this.voyage.deserialize(snapshot.voyage);
      this.cargo.deserialize(snapshot.cargo);restored=true;
    }
  }catch{}
  if(!restored){try{this.cargo.deserialize(JSON.parse(cc('stormwake.cargo.v1')||'[]'));}catch{}}
  this._repairSavedVoyage();
  if(app.boat.heritageDeck&&!app.boat.captainCabin)for(const item of this.cargo.items.values())
    if(item.state==='hold')item.holdLocal={x:0,y:deckHeight(-5.5,0)+.04,z:-5.5};
  this.interact=new InteractionDirector();this.selected=null;this.notice='';this.noticeTimer=0;
  this.lastMouseDown=false;this.cannonBalls=[];this.inputClock=0;this.digClock=0;this.pendingAction={fire:false,reload:false,bucket:false};
  const t=app.terrainData;
  const ground=p=>t.heightAt(p.x,p.z);
  this.sign=makeVoyageNotice(STORMWAKE_M1.noticeBoard.x,ground(STORMWAKE_M1.noticeBoard),STORMWAKE_M1.noticeBoard.z);
  this.brokerModel=makeBroker(STORMWAKE_M1.broker.x,ground(STORMWAKE_M1.broker),STORMWAKE_M1.broker.z);
  this.digModel=makeDigMarker(STORMWAKE_M1.digSite.x,ground(STORMWAKE_M1.digSite),STORMWAKE_M1.digSite.z);
  app.scene.add(this.sign,this.brokerModel,this.digModel);
  this.markerMeshes=makeStationMarkers(app.boat);
  if(app.boat.heritageArt)installHeritageStationAssets(app.boat,this.markerMeshes).catch(e=>console.warn('[V47] PBR work station fallback active',e));
  this.fireMesh=makeDeckFire(app.boat);
  this.chestMesh=makeChest();app.scene.add(this.chestMesh);this.chestMesh.visible=false;this.chestMeshes=new Map();
  this.artistChestRoot=null;
  if(app.boat.heritageArt)loadStaticArtistModel(SHIP_ART_CATALOG.chest).then(model=>{
    this.artistChestRoot=model.root;
    for(const mesh of this.chestMeshes.values())this._decorateChest(mesh);
  }).catch(error=>console.warn('[V47] Artist treasure fallback retained',error));
  this.enemy=new EnemyShipController({path:STORMWAKE_M1.gunboatPatrol});
  this.enemyModel=new BoatModel();this.enemyModel.setVariant('brig');app.scene.add(this.enemyModel.group);
  this.spectralWeather=new SpectralWeather(app.scene);this.ghostFleet=new GhostFleet(app.scene,{query:app.query,terrain:app.terrainData,colliders:app.colliders,player:app.player});this.vortexVisuals=new VortexVisuals(app.scene);this.stormRain=new StormRain(app.scene);
  app.boatCtl.voyageEnabled=true;app.boatCtl.voyageAnchor=true;if(app.boat.heritageDeck)app.boatCtl.voyageAuxPower=0;
  app.boatCtl.voyageWind.wind={x:-12,z:1};
  this._createHUD();this.cartographer=new CartographerRuntime(this);this.beacon=new StormBeaconRuntime(this);this.merchant=new MerchantRescueRuntime(this);this.ghostLantern=new GhostLanternRuntime(this);this.deepEcho=new DeepEchoRuntime(this);this.harborPeople=new HarborQuestPeople(app);this.brokerModel.visible=false;this.harborTrade=new HarborTradeRuntime(this);this.deckBody=new SailorBody(app.scene,{slot:'captain'});this.bodyActivity=new SailorActivity();this.refreshVisuals();
  // Capturing Escape here avoids the existing photo/settings panel competing with
  // a person leaving a ship station. Never trap Escape when no station is active.
  if(typeof window!=='undefined')window.addEventListener('keydown',e=>{
    if(e.code==='Escape'&&app.player.shipClimb){e.preventDefault();e.stopImmediatePropagation();app.player.shipClimb.reversing=true;return;}
    if(e.code==='Escape'&&this.net.pendingClaim){e.preventDefault();e.stopImmediatePropagation();this.net.cancelClaim();return;}
    if(e.code==='Escape'&&app.player.stationId&&!app.hunt?.abyss?.active&&!this.deepEcho?.piloting&&app.input.enabled&&!app.input.gameplayBlocked){e.preventDefault();e.stopImmediatePropagation();this.leaveStation();}
  },true);
 }
 get actorId(){return this.net.actorId;}
 stationLocal(id){return stationLocalMeters(this.app.boat,id);}
 stationName(id){return (getLocale()==='en'?SHIP_STATION_SITES[id]?.en:SHIP_STATION_SITES[id]?.name)||id;}
 shipWorld(id){return shipPoint(this.app.boatCtl,id);}
 localWorld(local){
  const b=this.app.boatCtl;
  if(typeof b.toWorld==='function')return b.toWorld(new Vector3(local.x,local.y,local.z),new Vector3());
  const yaw=b.getYaw?.()||0,sn=Math.sin(yaw),cs=Math.cos(yaw);
  return {x:b.position.x+local.x*cs+local.z*sn,y:(b.position.y||0)+local.y,z:b.position.z-local.x*sn+local.z*cs};
 }
 holdWorldAt(interior,upper=false){const h=interior.layout;return this.localWorld({x:h.x,y:upper?h.deckY:h.floorY,z:h.z});}
 holdWorld(y){const b=this.app.boatCtl;if(typeof b.toWorld==='function')return b.toWorld(new Vector3(this.interior.layout.x,y,this.interior.layout.z),new Vector3());
  const yaw=b.getYaw?.()||0;return {x:b.position.x+Math.sin(yaw)*this.interior.layout.z,y:(b.position.y||0)+y,z:b.position.z+Math.cos(yaw)*this.interior.layout.z};}
 _createHUD(){if(typeof document==='undefined')return;
  this.hud=document.createElement('section');this.hud.className='sw-v39-hud';this.hud.setAttribute('aria-label',L('STORMWAKE 金潮航程','STORMWAKE Gold Tide Voyage'));
  this.hud.innerHTML=`<div class="sw-v39-heading">STORMWAKE <span>${L('V67 · 航程','V67 · Voyage')}</span></div><div data-v39-goal></div>
  <div class="sw-v39-detail" data-v39-status></div><div class="sw-v39-detail" data-v44-weather></div>
  <div class="sw-v41-instruments" data-v41-instruments hidden>
   <div><small>${L('锚','Anchor')}</small><strong data-v41-anchor>—</strong></div>
   <div><small>${L('舵角','Rudder')}</small><strong data-v41-rudder>—</strong></div>
   <div><small>${L('主帆','Main sail')}</small><strong data-v41-sail>—</strong></div>
   <div><small>${L('领航','Pilot')}</small><strong data-v41-power>—</strong></div>
   <div><small>${L('左炮','Port gun')}</small><strong data-v41-port>—</strong></div>
   <div><small>${L('右炮','Starboard gun')}</small><strong data-v41-starboard>—</strong></div>
   <div><small>${L('舱底积水','Bilge water')}</small><strong data-v41-water>0%</strong></div>
   <div><small>${L('维修木板','Planks')}</small><strong data-v41-planks>9</strong></div>
   <div><small>${L('备用炮弹','Cannonballs')}</small><strong data-v43-ammo>18</strong></div>
   <div><small>${L('破口','Open holes')}</small><strong data-v43-holes>0</strong></div>
   <div><small>${L('船员状态','Crew')}</small><strong data-v43-crew>—</strong></div>
  </div><div class="sw-v42-equipment" data-v42-equipment><strong data-v42-tool></strong><span data-v42-action></span></div><div class="sw-v42-navigation" data-v42-navigation></div><button type="button" data-v42-journal-toggle>${L('查看航程日志','Open voyage journal')}</button><div class="sw-v42-camera" data-v42-camera></div><div class="sw-v39-prompt" data-v39-prompt></div>
  <div class="sw-v43-hold" data-v43-hold></div><div class="sw-v39-message" data-v39-message></div><button type="button" data-v40-rescue hidden>${L('船只沉没 · 返回海风镇整备（将失去当前宝箱）','Ship sunk · Return to harbor (lose current treasure)')}</button><div class="sw-v39-help">${L('E 交互 · 1/2/3 人物武器 / 4 灯 / 5 望远镜 / 6 木板 / 7 水桶 / 8 铲 / 0 空手 · G 放下宝箱 · 舵 A/D 转向，古帆船仅靠风帆推进 · 帆 W/S 收放 A/D 角度 · Space 跳跃越舷 · 海中对准舷梯按 W · 对准货舱梯 W 上/S 下 · E 开关门，沿阶梯步行进出船长室 · 绞盘 E 操作 W/S 起放锚（多人加速） · 对准桅梯 W 上/S 下','E interact · 1/2/3 weapons / 4 lantern / 5 spyglass / 6 plank / 7 bucket / 8 shovel / 0 hands · G drop chest · Helm A/D rudder; wind-driven sailing · Sails W/S area A/D trim · Jump over rail; face boarding ladders and hold W · hold ladder W/S · E opens cabin door, walk through · capstan E then W/S (multi-crew speed) · mast ladder W/S')}</div>`;
  document.body.append(this.hud);
  const detailButton=document.createElement('button');detailButton.type='button';detailButton.className='sw-v61-details';
  detailButton.textContent=L('船况详情','Ship details');detailButton.setAttribute('aria-expanded','false');
  detailButton.addEventListener('click',()=>{const expanded=this.hud.classList.toggle('is-expanded');detailButton.setAttribute('aria-expanded',String(expanded));detailButton.blur();});
  this.hud.append(detailButton);
  this.hud.querySelector('[data-v40-rescue]')?.addEventListener('click',()=>this.rescueSoloShip());
  this.journal=document.createElement('aside');this.journal.className='sw-v42-journal';this.journal.hidden=true;
  document.body.append(this.journal);
  this.hud.querySelector('[data-v42-journal-toggle]')?.addEventListener('click',()=>this._toggleJournal());
  this.journal.addEventListener('click',e=>{if(e.target.closest('[data-v42-close]')||e.target===this.journal){this._toggleJournal(false);return;}const select=e.target.closest('[data-v66-mission]');if(select){this.trackedMission=select.dataset.v66Mission;this._refreshJournal();return;}if(e.target.closest('[data-v66-track]')){const q=missionLog(this).find(x=>x.id===this.trackedMission);if(q?.target){const chart=this.app.oceanChart;if(chart?.setFreeTarget(q.target)){this._toggleJournal(false);this.toast('已追踪：'+q.title);}}}});
  window.addEventListener('keydown',e=>{if((e.code==='Escape'||(e.code==='KeyP'&&!e.shiftKey))&&!this.journal.hidden){e.preventDefault();e.stopImmediatePropagation();this._toggleJournal(false);}},true);
  this.text=(id,value)=>{const el=this.hud.querySelector(`[data-v39-${id}]`)||this.hud.querySelector(`[data-v44-${id}]`);if(el)el.textContent=value;};
 }
 _toggleJournal(open=this.journal?.hidden){
  if(!this.journal||open===!this.journal.hidden)return;
  // Open the parchment by a real mouse action. Disable movement and shooting
  // while it is visible, then restore the previous input state exactly.
  if(open&&(!this.input.enabled||this.input.gameplayBlocked))return;
  if(open){this._journalWasEnabled=this.input.enabled;this.input.enabled=false;
   if(typeof document!=='undefined'&&document.pointerLockElement)document.exitPointerLock?.();
   this._journalPhase=journalSignature(this);this._refreshJournal();this.journal.hidden=false;}
  else{this.journal.hidden=true;this.input.enabled=this._journalWasEnabled??true;}
 }
 _refreshJournal(){if(!this.journal)return;
  const english=getLocale()==='en',all=missionLog(this,english);this.trackedMission??=all.find(q=>q.status==='active')?.id||'gold';const log=all.find(q=>q.id===this.trackedMission)||all[0];
  const status={done:L('已完成','Completed'),active:L('进行中','Active'),offer:L('待接取','Available'),locked:L('未解锁','Locked'),failed:L('失败 · 可重新接取','Failed · retry')};
  const labels=all.map(q=>`<button type="button" data-v66-mission="${q.id}" class="${q.id===log.id?'selected':''}"><b>${htmlText(q.title)}</b><small>${status[q.status]} · ${q.completed}/${q.total}</small></button>`).join('');
  const distance=log.target?Math.round(Math.hypot(this.app.player.position.x-log.target.x,this.app.player.position.z-log.target.z)):null;
  this.journal.innerHTML=`<div class="sw-v42-journal-page sw-v66-mission-page" role="dialog" aria-modal="true" aria-label="Voyage journal"><header><small>STORMWAKE · ${L('航程任务','VOYAGE MISSIONS')}</small><button data-v42-close type="button">×</button></header><div class="sw-v66-mission-layout"><nav class="sw-v66-mission-nav">${labels}</nav><main><h2>${htmlText(log.title)}</h2><p>${status[log.status]} · ${log.completed}/${log.total}</p><div class="sw-v66-mission-progress"><i style="width:${100*log.completed/log.total}%"></i></div><ol>${log.steps.map((step,i)=>`<li class="${step.status}"><b>${i+1}. ${htmlText(step.title)}</b></li>`).join('')}</ol>${log.detail?`<p>${htmlText(log.detail)}</p>`:''}${distance===null?'':`<p>${L('距当前目标','Distance')} ${distance} m · X ${Math.round(log.target.x)} / Z ${Math.round(log.target.z)}</p>`}<button type="button" data-v66-track ${log.target&&log.status!=='done'?'':'disabled'}>${L('设置航图追踪','Track on chart')}</button><footer>${L('完成奖励','Reward')}: ${log.reward} ${L('潮币','TideCoin')}</footer></main></div></div>`;
 }
 toast(msg,seconds=4){this.notice=msg;this.noticeTimer=seconds;}
 _persistCargo(){
  const cargo=this.cargo.serialize();
  save('stormwake.m1.snapshot.v2',JSON.stringify({version:2,voyage:this.voyage.serialize(),cartographer:this.cartographer?.quest.serialize(),beacon:this.beacon?.quest.serialize(),merchant:this.merchant?.quest.serialize(),ghostLantern:this.ghostLantern?.quest.serialize(),deepEcho:this.deepEcho?.quest.serialize(),cargo}));
  // Retain the old cargo key for migration from V39, without making it authoritative.
  save('stormwake.cargo.v1',JSON.stringify(cargo));
 }
 _repairSavedVoyage(){
  const phase=this.voyage.phase,id='chest_moss_01';
  // A crash between saving the quest and saving its treasure must not make
  // the only playable mission impossible to finish.
  if(phase==='dug'&&!this.cargo.get(id))this.cargo.spawnChest(id,{x:STORMWAKE_M1.digSite.x,y:0,z:STORMWAKE_M1.digSite.z});
  if(phase==='stowed'&&!this.cargo.listShipHold(STORMWAKE_M1.shipId).length){
    this.cargo.spawnChest(id,{x:STORMWAKE_M1.digSite.x,y:0,z:STORMWAKE_M1.digSite.z});
    this.cargo.tryPick('recovery',id);this.cargo.tryStow('recovery',STORMWAKE_M1.shipId);
  }
  if(phase==='sold'&&this.cargo.get(id))this.cargo.remove(id);
  if(phase==='dug'||phase==='stowed'||phase==='sold')this.dig.completed.add('moss_01');
 }
 wantsInteraction(){if(this.app.freeCam)return false;if(this.app.player?.stationId)return true;return this.getNearbyCandidates().some(c=>interactionDistance(c,this.app.player.position,3.2,4)!==null);}
 wantsDeckStationAt(p){return Object.values(SHIP_STATION_SITES).some(s=>Math.hypot(p.x-s.x,p.z-s.z)<1.15);}
 cargoWorldPoint(item){
  if(item?.onDeck&&item.deckLocal){
   const b=this.app.boatCtl,local=item.deckLocal;
   const world=b.toWorld?.(new Vector3(local.x,local.y,local.z),new Vector3());
   if(world)return world;
  }
  return item;
 }
 _nearPlayer(target,r=4){const p=this.app.player;return distance(p.position,target)<r;}
 getNearbyCandidates(){
  const p=this.app.player,mode=p?.mode;if(!p||this.app.freeCam||p.pendingStation||p.shipClimb||p.mastClimb||p.aftLadderClimb||p.boardingClimb||!['walk','deck','swim'].includes(mode))return [];
  const items=[];const add=(id,label,pos,range,priority,perform)=>{
   // In the original uncut Dutch hull, a surface interaction may not occur
   // through the castle deck merely because the horizontal x/z is nearby.
   const isCapstan=id.startsWith('anchor');
   const verticalCap=this.app.boat.heritageDeck?(isCapstan?2.30:1.55):4;
   const near=isCapstan?Math.hypot(p.position.x-pos.x,p.position.z-pos.z)<range:distance(p.position,pos)<range;
   if(near&&Math.abs(p.position.y-(pos.y??p.position.y))<verticalCap){
    const world=this.app.boat.collisionWorld,b=this.app.boatCtl;
    // Portal actions are evaluated by their own door/ladder passage rules.
    // Equipment cannot be acquired through an opaque static hull or furniture.
    if(world&&mode==='deck'&&!/hatch|exit|door|climb|stow/.test(id)&&this.app.camera){
      const inverse=b.quaternion.clone().invert();
      const eye=p.position.clone().add(new Vector3(0,p.poseHeight?Math.min(p.poseHeight-.12,1.6):1.6,0)).sub(b.position).applyQuaternion(inverse);
      const reachable=[.2,.55,.8].some(height=>{
        const target=new Vector3(pos.x,pos.y+height,pos.z).sub(b.position).applyQuaternion(inverse);
        return !world.occluded(eye,target)&&!this.app.boat.originalDoor?.collider?.occluded(eye,target);
      });
      if(!reachable)return;
    }
    items.push({id,label,position:pos,range,priority,perform});
   }
  };
  if(p.stationId){const id=p.stationId;items.push({id:'leave',label:L('离开 ','Leave ')+this.stationName(id),position:p.position,range:2,priority:300,perform:()=>this.leaveStation()});return items;}
  items.push(...(this.cartographer?.candidates()||[]),...(this.beacon?.candidates()||[]),...(this.merchant?.candidates()||[]),...(this.ghostLantern?.candidates()||[]),...(this.deepEcho?.candidates()||[]),...(this.harborTrade?.candidates()||[]));
  if(mode==='walk'||mode==='swim'){
    const sign=this.sign.position;
    if(mode==='walk'&&this.voyage.phase==='accepted'&&!this.app.landAdventure?.stance)add('dig_moss','[按住 E] 挖掘藏宝点',this.digModel.position,4.1,95,()=>true);
    if(this.voyage.phase==='offer'||this.voyage.phase==='sold')add('accept',L('[E] 接取金潮藏宝航程','[E] Accept Gold Tide treasure voyage'),sign,5.2,80,()=>this.acceptVoyage());
    if(this.cargo.listShipHold(STORMWAKE_M1.shipId).some(c=>['spectral','monster'].includes(c.origin)))add('spectral_broker',L('[E] 出售打捞的幽焰战利品','[E] Sell salvaged spectral spoils'),this.brokerModel.position,4.8,85,()=>this.sellSpectral());
    if(this.voyage.phase==='stowed')add('broker',L('[E] 兑现宝箱 · 潮币 +120','[E] Sell treasure chest · +120 TideCoin'),this.brokerModel.position,4.8,80,()=>this.sell());
    {
      for(const c of this.cargo.items.values())if(c.state==='world'&&!c.onDeck)add('pick',L('[E] 抱起藏宝箱','[E] Pick up treasure chest'),c,3.5,90,()=>this.pick(c.id));
    }
  }else if(mode==='deck'){
    if(p.deckLayer==='lowerHold'){
      // Source-mesh main hatch: lower cargo deck, not the captain's quarters.
      if(this.cargo.heldBy.has(this.actorId))
        add('lower_stow',L('[E] 将宝箱放在下层货舱','[E] Stow chest in lower hold'),p.position,1.35,235,()=>this.stow());
      for(const loose of this.cargo.items.values())if(loose.state==='world'&&loose.onDeck&&loose.deckLocal&&this.lowerHold.inside(loose.deckLocal)){
        add('lower_pick:'+loose.id,L('[E] 捡起下层货舱地面的宝箱','[E] Pick up chest from lower hold floor'),this.cargoWorldPoint(loose),1.8,245,()=>this.pick(loose.id));
      }
      for(const item of this.cargo.listShipHold(STORMWAKE_M1.shipId)){
        const point=this.localWorld(item.holdLocal||{x:0,y:this.lowerHold.layout.floorY,z:0});
        add('lower_take:'+item.id,L('[E] 拿取船舱货物','[E] Take lower hold cargo'),point,1.65,240,()=>this.retrieve(item.id));
      }
      return items;
    }
    if(p.deckLayer==='hold'){
      // V44.1: stored chest remains an actual visible ship-local item. Players
      // can take it back out, and G places it at their feet on the lower floor.
      if(this.cargo.heldBy.has(this.actorId)){
        const site=p.position;
        add('hold_stow',L('[E] 将宝箱放上舱底货架','[E] Stow chest on hold shelf'),site,2.1,245,()=>this.stow());
      }else{
        for(const c of this.cargo.listShipHold(STORMWAKE_M1.shipId)){
          const local=c.holdLocal||{x:0,y:this.interior.layout.floorY,z:this.interior.layout.z};
          const pt=this.localWorld(local);
          add('hold_take:'+c.id,L('[E] 从货架取下宝箱','[E] Take chest from hold shelf'),pt,1.65,235,()=>this.retrieve(c.id));
        }
        for(const c of this.cargo.items.values())if(c.state==='world'&&c.onDeck&&c.deckLocal){
          const local=c.deckLocal;if(this.interior.inside(local)){
            add('hold_pick:'+c.id,L('[E] 捡起舱底宝箱','[E] Pick up chest on hold floor'),this.cargoWorldPoint(c),1.7,230,()=>this.pick(c.id));
          }
        }
      }
      const ladder=this.holdWorld(this.interior.layout.floorY);
      if(this.app.boat.captainCabin){
        const chart={x:-1.12,y:this.interior.layout.floorY,z:-8.73};
        add('captain_chart',L('[E] 查看船长室真实海图','[E] Examine the captain\'s sea chart'),this.localWorld(chart),1.2,260,()=>{this.app.oceanChart?.open?.();return true;});
      }
      if(this.interior.inHatch(p.deckPos)&&!this.app.boat.heritageDeck)add('climb',L('[E] 爬上舱口梯回甲板','[E] Climb ladder back to deck'),ladder,1.8,285,()=>this.toggleHold());
      // This E action was unreachable in V52: the source door was only offered
      // when deckLayer==='deck', but crossing into the room set layer='hold'.
      const originalDoor=this.app.boat.originalDoor;
      if(originalDoor&&Math.hypot(p.deckPos.x+.88,p.deckPos.z+6.635)<1.45)add('cabin_door',originalDoor.open?'[E] 关闭船长室门':'[E] 打开船长室门',this.localWorld(originalDoor.local),1.7,299,()=>{originalDoor.set(!originalDoor.open);this.net?.send('ship_door',{open:originalDoor.open});return true;});
      return items;
    }
    // Source mesh sterncastle door: the only moving geometry is the original
    // panel cut from the uploaded Dutch hull, not a door spawned over its face.
    // V52: ship lanterns use the world's day-night cycle, not the E key.
    const originalDoor=this.app.boat.originalDoor;
    if(originalDoor && p.deckPos && p.deckLayer==='deck' &&
       Math.hypot(p.deckPos.x-originalDoor.local.x,p.deckPos.z-originalDoor.local.z)<1.35){
      add('dutch_original_door',originalDoor.open?L('[E] 关闭船长室门','[E] Close captain cabin door'):L('[E] 打开原船门板','[E] Open original Dutch door'),
          this.localWorld(originalDoor.local),1.65,265,()=>{
            if(!originalDoor.open){originalDoor.set(true);this.net?.send('ship_door',{open:true});return true;}
            originalDoor.set(false);this.net?.send('ship_door',{open:false});return true;
          });
    }
    if(!this.app.boat.heritageDeck&&!p.stationId&&p.deckPos&&this.interior.inHatch(p.deckPos)){const hatch=this.holdWorld(this.interior.layout.deckY);
      add('hatch',L('[E] 沿船尾舱口梯进入船长室','[E] Climb into captain quarters'),hatch,1.35,175,()=>this.toggleHold());}
    // V50: the sourced room is below the original quarterdeck. No exterior
    // interactions are allowed to pass through its actual overhead deck.
    const extra=this.app.boat.heritageDeck;
    if(extra){
      const obj=extra.objects;
      for(const item of this.cargo.listShipHold(STORMWAKE_M1.shipId)){
        const local=item.holdLocal||{x:0,y:deckHeight(-5.5),z:-5.5};
        add('deck_retrieve:'+item.id,L('[E] 从后甲板货物存放点取回宝箱','[E] Retrieve chest from aft cargo position'),this.localWorld(local),1.65,230,()=>this.retrieve(item.id));
      }
      if(!this.heldAmmo){
        for(const [kind,site] of [['cannonball',obj.ammo],['chainshot',obj.chain]]){
          if(this.inventory.count(kind)>0)add('take_'+kind,L(`[E] 从弹药箱拿取${kind==='cannonball'?'炮弹':'链弹'}`,`[E] Take ${kind} from ammunition rack`),this.localWorld(site),1.60,210,()=>this.takeSupply(kind));
        }
      }
      if(this.equipment.planks<3&&this.inventory.count('plank')>0){
        add('plank_supply',L('[E] 从修理箱拿取一块木板','[E] Take one plank from repair crate'),this.shipWorld('repair'),1.65,215,()=>this.takeSupply('plank'));
      }
      for(const entity of this.looseSupplies.byId.values()){
        add('loose:'+entity.id,L(`[E] 捡起 ${entity.kind}`,`[E] Pick up ${entity.kind}`),this.localWorld(entity.local),1.28,240,()=>this.pickLooseSupply(entity.id));
      }
      // The existing physical DeckArsenal meshes are operable. Pick up a
      // hand-held gun or optical instrument from its ORIGINAL rack position;
      // the hunting system actually generates and collides projectiles (F).
      const hunt=this.app.hunt;
      if(hunt){
        const racks=[
          ['harpoon',ARSENAL_SITES.harpoon,'船首捕鲸叉','bow harpoon'],
          ['musket',ARSENAL_SITES.musket,'长枪架','musket rack'],
          ['spyglass',ARSENAL_SITES.spyglass,'望远镜架','spyglass mount'],
          ['storm',ARSENAL_SITES.storm,'风暴炮','storm launcher']
        ];
        for(const [kind,at,zh,en] of racks)if(hunt.canEquip(kind)){
          const already=hunt.selected===kind;
          add('arsenal_'+kind,L(`[E] ${already?'检查':'拿取'}${zh} · F ${kind==='spyglass'?'观察':'发射'}`,
              `[E] ${already?'Inspect':'Equip'} ${en} · F ${kind==='spyglass'?'look':'fire'}`),
            this.localWorld(at),1.72,235,()=>hunt.equip(kind));
        }
      }
    }
    if(this.cargo.heldBy.has(this.actorId)) {
      const site=this.shipWorld('carry');add('stow',this.app.boat.heritageDeck?L('[E] 把宝箱存放在原船后甲板货位','[E] Stow chest at original aft-deck cargo rack'):L('[E] 放入船舱','[E] Stow chest in ship hold'),site,2.4,130,()=>this.stow());
    }
    if(!this.cargo.heldBy.has(this.actorId)){
      for(const c of this.cargo.items.values())if(c.state==='world'&&c.onDeck){
        const point=this.cargoWorldPoint(c);
        add('pick:'+c.id,L('[E] 捡起甲板宝箱','[E] Pick up deck treasure'),point,2.7,105,()=>this.pick(c.id));
      }
      for(const [id,site] of Object.entries(SHIP_STATION_SITES)){
        // Capstan arms are separate occupiable seats, but one visible winch prompt.
        // Additional sailors receive the next reachable free arm on claiming.
        if(id==='carry'||['anchor_2','anchor_3','anchor_4'].includes(id))continue;
        if(id==='bucket'){
          // Exactly one initially stocked bucket for the real ship. Once taken,
          // it can only be recovered from the deck entity, never duplicated.
          if(!this.app.boat.heritageDeck || (this.bucketRackStock&&!this.hasBucket)){
            add('bucket_supply',L('[E] 从水桶架拿起空桶','[E] Take an empty bucket from the rack'),this.shipWorld(id),1.5,90,()=>{
              if(this.net.connected&&this.app.boat.heritageDeck){this.net.send('supply_action',{verb:'take',kind:'bucket'});return;}
              if(!this.hasBucket && (!this.app.boat.heritageDeck||this.bucketRackStock)){
                this.hasBucket=true;if(this.app.boat.heritageDeck)this.bucketRackStock=false;
                this.equipment.equip('bucket');this.toast(L('已从水桶架拿取唯一的水桶','The bucket was taken from its rack'));
              }
            });
          }
          continue;
        }
        // One prompt follows the closest physical handle, including the far
        // side of the winch. It must not remain pinned to the starboard seat.
        const world=id==='anchor'?['anchor','anchor_2','anchor_3','anchor_4'].map(slot=>{const hands=stationHandTargets(this.app.boat,slot);return hands?hands[0].clone().add(hands[1]).multiplyScalar(.5):this.shipWorld(slot);}).filter(Boolean).sort((a,b)=>distance(p.position,a)-distance(p.position,b))[0]:this.shipWorld(id),owner=this.stations.getOccupant(id);
        const who=owner&&!owner.startsWith('ai:')?L(` · 被 ${owner.slice(0,8)} 占用`,` · occupied by ${owner.slice(0,8)}`):'';
        add(id,`[E] ${this.stationName(id)}${who}`,world,id.startsWith('anchor')?2.35:1.5,id.startsWith('anchor')?330:40,()=>this.takeStation(id));
      }
    }
  }
  return items;
 }
 takeSupply(kind){
  const p=this.app.player;if(p.mode!=='deck'||p.deckLayer==='hold'||this.cargo.heldBy.has(this.actorId))return false;
  if(this.net.connected&&this.app.boat.heritageDeck){this.app.crew.sendMyPose?.(true);return this.net.send('supply_action',{verb:'take',kind});}
  if(kind==='plank'){
    if(this.equipment.planks>=3||!this.inventory.take('plank'))return false;
    this.equipment.planks++;this.equipment.equip('plank');
  }else if(['cannonball','chainshot'].includes(kind)){
    if(this.heldAmmo||!this.inventory.take(kind))return false;
    this.heldAmmo=kind;this.equipment.equip('hands');
  }else return false;
  this.toast(L(`已拿取${kind==='plank'?'一块修船木板':kind==='chainshot'?'链弹':'炮弹'}：拿到对应岗位实际使用，G 可放下`,`Picked up ${kind}. Bring it to its working station; G drops it.`));return true;
 }
 pickLooseSupply(id){
  const item=this.looseSupplies.byId.get(id),p=this.app.player;
  if(!item||p.mode!=='deck'||p.deckLayer!=='deck'||Math.hypot(p.deckPos.x-item.local.x,p.deckPos.z-item.local.z)>1.35)return false;
  if(this.net.connected){this.app.crew.sendMyPose?.(true);return this.net.send('supply_action',{verb:'pick',itemId:id});}
  if(item.kind==='bucket'){
    if(this.hasBucket)return false;this.hasBucket=true;this.equipment.equip('bucket');
  }else if(item.kind==='plank'){
    if(this.equipment.planks>=9)return false;this.equipment.planks++;this.equipment.equip('plank');
  }else{
    if(this.heldAmmo)return false;this.heldAmmo=item.kind;this.equipment.equip('hands');
  }
  this.looseSupplies.take(id);this.toast(L('已捡起地面物品','Picked up the physical item'));return true;
 }
 dropSupply(kind){
  const p=this.app.player;
  if(!this.app.boat.heritageDeck||p.mode!=='deck'||p.deckLayer!=='deck')return false;
  if(this.net.connected){this.app.crew.sendMyPose?.(true);return this.net.send('supply_action',{verb:'drop',kind});}
  const z=p.deckPos.z,half=actualHalfWidth(z)-.38;
  const x=clamp(p.deckPos.x,-half,half);
  const local={x,y:deckHeight(z,x)+.02,z};
  if(!this.looseSupplies.add(kind,local))return false;
  if(kind==='bucket'){this.hasBucket=false;this.equipment.bucketFull=false;this.equipment.bucketContent=null;this.equipment.equip('hands');}
  else if(kind==='plank'){this.equipment.planks=Math.max(0,this.equipment.planks-1);if(!this.equipment.planks)this.equipment.equip('hands');}
  else this.heldAmmo=null;
  this.toast(L('已将物品放在真实甲板上，可再次捡起。','Item dropped on the physical deck, available to pick up.'));return true;
 }
 toggleHatchAt(){
  const p=this.app.player;
  if(p?.deckLayer==='lowerHold'||(p?.deckLayer==='deck'&&this.lowerHold?.nearEntrance(p.deckPos)))return this.toggleLowerHold();
  return this.app.boat.heritageDeck?false:this.toggleHold();
 }
 toggleLowerHold(){
  const p=this.app.player,room=this.lowerHold;
  if(!room||p.mode!=='deck'||p.stationId||!p.deckPos||p.shipClimb||!room.nearEntrance(p.deckPos))return false;
  const entering=p.deckLayer!=='lowerHold';
  if(!entering&&p.deckLayer!=='lowerHold'||entering&&p.deckLayer!=='deck')return false;
  if(!beginShipClimb(p,room,entering))return false;
  this.toast(entering?L('进入下层货舱；对准梯子按住 W 返回，S 下梯。','Inside lower hold: face ladder and hold W up / S down.'):L('已从下层货舱回到甲板。','Returned to main deck.'),2.1);
  return true;
 }
 toggleHold(){
  if(this.app.boat.heritageDeck)return false; // sourced rear door is the captain quarters entrance, not a hatch overlapping the helm
  if(this.app.boat.heritageDeck && !this.app.boat.captainCabin)return false; // avoid climbing into unbuilt rooms
  const p=this.app.player;if(p.mode!=='deck'||p.stationId||!p.deckPos||p.shipClimb||!['deck','hold'].includes(p.deckLayer)||!this.interior.inHatch(p.deckPos))return false;
  const entering=p.deckLayer!=='hold';
  if(typeof p.updateDeck==='function'){
    if(!beginShipClimb(p,this.interior,entering))return false;
  }else{ // Keep old headless V43 tests' mock player supported.
    this.interior.setHatchOpen(entering);p.deckLayer=entering?'hold':'deck';
    p.deckPos.set(this.interior.layout.x,entering?this.interior.floorAt(this.interior.layout.z):this.interior.layout.deckY,this.interior.layout.z);p.deckVel.set(0,0,0);p.deckGrounded=true;p.deckToWorld?.();
  }
  this.toast(entering?L('已进入船长室：沿舱口梯或原船门返回甲板。','In captain quarters: use hatch ladder or original door to exit.'):L('已返回甲板。','Back on deck.'),2.7);
  return true;
 }
 acceptVoyage(){
  if(this.net.connected){
    this.net.send('voyage_event',{verb:'accept',voyageId:VOYAGE_GOLD_MOSS.id});
  } else if(this.voyage.accept()){
    // V39 left DigSite.completed set after the first successful voyage,
    // causing every subsequent attempt to stick at 0% indefinitely.
    this.dig.completed.clear();this.dig.progress.clear();
    this.cargo.remove('chest_moss_01');this._persistCargo();
  }
  this.toast(L('航程已接取！前往码头，E 登船后操作帆索与舵轮。','Voyage accepted! Go to the dock, board with E, then use the sails and helm.'));
 }
 takeStation(id){
  const player=this.app.player;if(player.shipClimb||player.mastClimb||player.aftLadderClimb||player.boardingClimb||player.pendingStation)return false;
  if(!this.stations.valid(id)||this.cargo.heldBy.has(this.actorId)||this.app.player.deckLayer!=='deck')return false;
  if(id.startsWith('anchor')){
    const slots=['anchor','anchor_2','anchor_3','anchor_4'];
    const at=this.app.player.deckPos;
    const free=slots.filter(slot=>{const owner=this.stations.getOccupant(slot),seat=this.stationLocal(slot);return (!owner||owner.startsWith('ai:'))&&seat&&at&&Math.hypot(at.x-seat.x,at.z-seat.z)<2.65;});
    free.sort((a,b)=>{const A=this.stationLocal(a),B=this.stationLocal(b);
      return Math.hypot((at?.x||0)-A.x,(at?.z||0)-A.z)-Math.hypot((at?.x||0)-B.x,(at?.z||0)-B.z);});
    if(!free.length){this.toast(L('四个锚机把手均已有人操作。','All four capstan handles are occupied.'));return false;}
    id=free[0];
  }
  const owner=this.stations.getOccupant(id);
  if(owner&&!owner.startsWith('ai:')){this.toast(L('该岗位已有船员，请换一个岗位。','That station is already occupied.'));return false;}
  if(this.net.connected)this.net.claim(id);
  else if(this.stations.claim(id,this.actorId,{replaceAI:true}))this.app.player.stationId=id;
  if(this.app.player.stationId===id)this._faceStation(id);
  this.toast(`${this.stationName(id)}：${id.startsWith('cannon')?'鼠标或 A/D 转炮，W/S 调仰角；左键开炮，R 从弹药库存装填':id==='helm'?'A/D 左右操舵 · W 请求船员起锚展帆 · S 收帆减速 · E 离岗 · F2 航海图':id.startsWith('sail')?'W / S 收放帆':id.startsWith('anchor')?'按住 W 收锚链 / S 放锚链，可四人一起转':id==='repair'?'仅在回港且破口封堵后可长按左键整备船体':'E 操作，Esc 退出'}`,3.5);
  return true;
 }
 _faceStation(id){const p=this.app.player;
  if(!p)return;
  p.deckViewMode='first';p.crouched=false;p.poseHeight=1.75;
  if(id==='helm'){p.deckYaw=0;p.pitch=-.12;}
  if(id.startsWith('anchor')){const targets=stationHandTargets(this.app.boat,id);if(targets){const midpoint=targets[0].clone().add(targets[1]).multiplyScalar(.5).sub(p.position).applyQuaternion(this.app.boatCtl.quaternion.clone().invert());p.deckYaw=Math.atan2(midpoint.x,midpoint.z);p.pitch=Math.atan2(midpoint.y-1.62,Math.hypot(midpoint.x,midpoint.z));}}
  if(id==='cannon_port'||id==='cannon_starboard'){p.deckYaw=id==='cannon_port'?Math.PI/2:-Math.PI/2;p.pitch=-.03;}
 }
 leaveStation(){const id=this.app.player.stationId;if(!id)return false;
  this.net.release(id);this.app.player.stationId=null;this.pendingAction={fire:false,reload:false,bucket:false};
  // Never erase physically held WASD when a player leaves a station. V41's
  // resetPhysicalState required an extra key-release/repress to walk again.
  this.input.pressed?.delete?.('KeyE');return true;}
 pick(itemId){
  if(this.net.connected){this.net.send('cargo_event',{verb:'pick',itemId});this.toast(L('正在请求拾取宝箱…','Requesting chest pickup…'));return;}
  const item=this.cargo.get(itemId);if(item?.onDeck){const world=this.cargoWorldPoint(item);item.x=world.x;item.z=world.z;item.y=world.y;}
  if(this.cargo.tryPick(this.actorId,itemId,this.app.player.position)){
    this._persistCargo();this.toast(this.app.boat.heritageDeck?L('已拿起宝箱，运到原船后甲板的货物存放点。','Treasure picked up; carry it to the original aft deck.'):L('宝箱已拿起：带到船上货舱，行走速度降低。','Treasure picked up. Carry it to the ship hold; movement is slower.'));
  }else this.toast(L('宝箱太远或已被拿走。','Chest unavailable or too far away.'));
 }
 retrieve(itemId){
  // The interactive prompt already has a range check, but the action itself
  // must reject unreachable cargo (e.g. a stale click or scripted call).
  const player=this.app.player,item=this.cargo.get(itemId);
  const loc=item?.holdLocal||{x:0,y:this.interior.layout.floorY,z:this.interior.layout.z};
  if(player?.mode!=='deck'||(player.deckLayer!=='lowerHold'&&player.deckLayer!=='hold' && !this.app.boat.heritageDeck)||!player.deckPos||
      Math.hypot(player.deckPos.x-loc.x,player.deckPos.z-loc.z)>1.75){
   this.toast(L('请走到宝箱旁边再取。','Move beside the chest before taking it.'));return false;
  }
  if(this.net.connected){
    this.app.crew?.sendMyPose?.(true);
    this.net.send('cargo_event',{verb:'retrieve',itemId});
    this.toast(L('正在从共享船舱取货…','Retrieving shared cargo…'));return true;
  }
  if(this.cargo.tryRetrieve(this.actorId,itemId,STORMWAKE_M1.shipId)){
    this._persistCargo();this.toast(L('宝箱已取出。G 放在舱底或 E 再放回架上。','Chest retrieved. G to place; E to stow again.'));return true;
  }
  return false;
 }
 stow(){
  const p=this.app.player;
  // V43 quest adapter kept for old saved games and regression scenarios.
  // Heritage ship requires real traversal before hold storage.
  if(this.app.boat.heritageDeck&&p.deckLayer==='lowerHold'&&this.lowerHold){
    const id=this.cargo.heldBy.get(this.actorId);
    const slot=this.lowerStorageSpace.nearestFree(p.deckPos,this.cargo.items.values(),id);
    if(!id||!slot)return false;
    if(this.net.connected){
      this.app.crew?.sendMyPose?.(true);
      this.net.send('cargo_event',{verb:'stow',itemId:id,holdLocal:slot,holdLayer:'lowerHold'});
      this.toast(L('正在将货物放入共享底舱…','Stowing cargo in the shared lower hold…'));return true;
    }
    if(!this.cargo.tryStow(this.actorId,STORMWAKE_M1.shipId,slot))return false;
    this.cargo.get(id).holdLayer='lowerHold';
    if(!this.cargo.get(id)?.origin)this.voyage.stow();this._persistCargo();
    this.toast(L('已放在真实下层货舱。','Cargo stowed below deck.'));return true;
  }
  if(this.app.boat.heritageDeck){
    const site=this.stationLocal('carry');
    if(p.mode!=='deck'||p.deckLayer!=='deck'||Math.hypot(p.deckPos.x-site.x,p.deckPos.z-site.z)>1.8){
      this.toast(L('把宝箱搬到后甲板原船货位再放下。','Carry the chest to the original aft-deck cargo position.'));return false;
    }
    const local={x:site.x,y:site.y+.06,z:site.z},id=this.cargo.heldBy.get(this.actorId);
    if(!id)return false;
    if(this.net.connected){
      this.app.crew?.sendMyPose?.(true);
      this.net.send('cargo_event',{verb:'stow',itemId:id,holdLocal:local,holdLayer:'deck'});
      this.toast(L('正在同步后甲板存货…','Stowing on the shared aft deck…'));return true;
    }
    if(!this.cargo.tryStow(this.actorId,STORMWAKE_M1.shipId,local))return false;
    this.cargo.get(id).holdLayer='deck';
    if(!this.cargo.get(id)?.origin)this.voyage.stow();this._persistCargo();
    this.toast(L('宝箱已安放在原船后甲板货位，可以再次取回。','Chest placed on the original aft deck; can be retrieved.'));return true;
  }
  if(p.mode!=='deck'||p.shipClimb||(p.deckLayer!=='hold'&&this.app.boat.shipScale)){
   this.toast(L('必须亲自把宝箱带到舱底，再放到空位上。','Carry the chest down into the hold and choose a clear space.'));return false;
  }
  const id=this.cargo.heldBy.get(this.actorId);
  const proposed=p.deckLayer==='hold'?p.deckPos:{x:0,z:this.interior.layout.z-.9*this.interior.scale.z};
  const slot=this.storageSpace.nearestFree(proposed,this.cargo.items.values(),id);
  if(!id||!slot){this.toast(L('此处没有空位：换一个位置再试。','No free space here; move and try again.'));return false;}
  if(this.net.connected){
    this.app.crew?.sendMyPose?.(true);
    this.net.send('cargo_event',{verb:'stow',itemId:id,holdLocal:slot,holdLayer:'hold'});
    this.toast(L('正在同步船舱存货…','Stowing cargo in the shared hold…'));return true;
  }
  if(this.cargo.tryStow(this.actorId,STORMWAKE_M1.shipId,slot)){
    this.cargo.get(id).holdLayer='hold';
    if(!this.cargo.get(id)?.origin)this.voyage.stow();this._persistCargo();this.toast(L('宝箱已放在舱底实际位置，可再次拿取。','Chest stowed at its physical location; it can be retrieved.'));return true;
  }
  return false;
 }
 sellSpectral(){
  if(distance(this.app.boatCtl.position,STORMWAKE_M1.returnPort)>55)return false;
  if(this.net.connected){this.net.send('voyage_event',{verb:'sell_spectral',voyageId:VOYAGE_GOLD_MOSS.id});return true;}
  const result=sellSpectralSpoils(this.cargo,this.voyage),hunt=sellMonsterSpoils(this.cargo,this.voyage);for(const r of hunt.receipts)this.app.hunt.progress.defeat(r.boss,r.receipt);result.reward+=hunt.reward;result.count+=hunt.count;this._persistCargo();this.toast(`幽焰战利品已交付：${result.count} 箱，${result.reward} 潮币。`,5);return !!result.count;
 }
 sell(){if(this.net.connected){this.net.send('voyage_event',{verb:'sell',voyageId:VOYAGE_GOLD_MOSS.id});return;}
  if(distance(this.app.boatCtl.position,STORMWAKE_M1.returnPort)>55){this.toast(L('船还没回港：先把潮醒号开回码头。','The ship must first return to the harbor.'));return;}
  if(this.broker.sell()){this.toast(L('金潮航程完成！获得 120 潮币和 1 金潮声望。','Gold Tide voyage complete! +120 TideCoin and +1 Gold Tide reputation.'),7);this._persistCargo();}
  else this.toast(L('宝箱尚未入舱或已经售出，无法再次兑现。','No treasure in the hold, or it was already sold.'));
 }
 rescueSoloShip(){
  if(this.net.connected){this.toast(L('联机船只沉没：请房主重新开始房间。','Ship sunk online: ask the host to restart the room.'));return false;}
  if(!this.damage.isSinking())return false;
  if(this.app.player.stationId)this.leaveStation();
  this.damage=new ShipDamage();this.damage.hull.setShipScale(this.app.boat.shipScale);this.hullVisuals.damage=this.damage;this.sinkingReported=false;this.inventory=new ShipInventory();this.repairStock=this.inventory.count('plank');this.equipment=new PirateEquipment();this.equipment.planks=this.app.boat.heritageDeck?0:3;this.hasBucket=!this.app.boat.heritageDeck;this.bucketRackStock=!!this.app.boat.heritageDeck;this.heldAmmo=null;this.looseSupplies?.clear();this.cannons={cannon_port:new ShipCannon({id:'cannon_port'}),cannon_starboard:new ShipCannon({id:'cannon_starboard'})};this.stationBucket={full:false};
  this.enemy=new EnemyShipController({path:STORMWAKE_M1.gunboatPatrol});
  this.app.boatCtl.reset();
  // Return to the real dock; do not spawn a second unexplained offshore ship.
  this.app.boatCtl.moored=true;
  this.app.boatCtl.mooring.anchor.copy(this.app.boatCtl.position);
  this.app.boatCtl.mooring.heading=this.app.boatCtl.getYaw();
  // V58: disaster recovery is a fresh moored state, not an automatic departure.
  // Historical V57 code immediately overwrote the safe idle state with 35%
  // engine and pre-trimmed sails, and re-enabled automatic anchor control.
  this.stations.anchorDown=true;this.stations.anchorManual=true;
  this.stations.anchorTravel=1;this.stations.anchorTravelReady=true;
  this.stations.helmThrottle=0;this.stations.sailMain=0;this.stations.sailJib=0;
  this.stations.rudder=0;this.stations.sailTrim=0;
  this.app.boatCtl.voyageAuxPower=0;
  this.app.boatCtl.voyageSails={main:0,jib:0,trim:0};
  for(const c of Object.values(this.stations.cannon)){c.loaded=true;c.cooldown=0;c.reloadQueued=false;}
  this.voyage.abandon();this.cargo.items.clear();this.cargo.heldBy.clear();this.cargo.holds.clear();
  this.dig.progress.clear();this.dig.completed.clear();
  const p=this.app.player;p.mode='walk';p.stationId=null;p.deckLayer='deck';p.carryingChest=false;
  p.position.set(53.6,this.app.terrainData.heightAt(53.6,-77),-77);
  // Player respawns on dry land; boarding and weighing anchor are deliberate actions.
  p.velocity?.set?.(0,0,0);p._camY=null;
  for(const ball of this.cannonBalls){this.app.scene.remove(ball.mesh);}
  this.cannonBalls.length=0;
  this._persistCargo();
  this.toast(L('船已在港口整备。原宝箱已丢失，重新到告示板接航程。','Ship restored at harbor. Lost treasure; accept a new voyage.'));
  return true;
 }
 // Direct, explicit first-person equipment. No effect is awarded simply
 // because an item was selected; mouse/hold, position and finite supplies matter.
 _updateTools(dt){
  const p=this.app.player,input=this.input,eq=this.equipment;
  eq.tick(dt);
  const usable=controlContext(this.app)==='personal'&&input.enabled&&!input.gameplayBlocked;
  if(!usable){eq.clearTransient();this.lastToolMouse=!!input.mouseDown;return;}
  const carrying=this.cargo.heldBy.has(this.actorId);
  if(carrying){
   if(input.consume('KeyG','voyage')){
    let local=p.mode==='deck'?{x:p.deckPos.x,y:p.deckPos.y,z:p.deckPos.z}:null;
    if(local&&p.deckLayer==='hold'){
      const free=this.storageSpace.nearestFree(local,this.cargo.items.values(),this.cargo.heldBy.get(this.actorId));
      if(!free){this.toast(L('此处被货物或舱口挡住，请换个位置。','Storage space is blocked.'));this.lastToolMouse=!!input.mouseDown;return;}
      local=free;
    }
    const destination=local?this.localWorld(local):p.position;
    const world={x:destination.x,y:destination.y,z:destination.z};
    if(this.net.connected){this.net.send('cargo_event',{verb:'drop',itemId:this.cargo.heldBy.get(this.actorId),...world});}
    else if(this.cargo.tryDrop(this.actorId,world,local)){this._persistCargo();this.toast(L('宝箱已放下，可再次拿起。','Treasure placed down; press E to pick it up again.'));}
   }
   this.lastToolMouse=!!input.mouseDown;return;
  }
  if(this.heldAmmo){
   if(input.consume('KeyG','voyage'))this.dropSupply(this.heldAmmo);
   this.lastToolMouse=!!input.mouseDown;return;
  }
  if(this.app.boat.heritageDeck&&p.mode==='deck'&&input.consume('KeyG','voyage')){
    if(eq.active==='bucket'&&this.hasBucket){this.dropSupply('bucket');this.lastToolMouse=!!input.mouseDown;return;}
    if(eq.active==='plank'&&eq.planks>0){this.dropSupply('plank');this.lastToolMouse=!!input.mouseDown;return;}
  }
  for(const [key,tool] of Object.entries(TOOL_SLOTS))if(input.consume(key,'voyage')){
   if(this.app.boat.heritageDeck&&tool==='bucket'&&!this.hasBucket){this.toast(L('先到船上水桶架实际拿取水桶','Pick up a bucket from its rack first'));continue;}
   if(this.app.boat.heritageDeck&&tool==='plank'&&eq.planks<1){this.toast(L('先到修理箱拿取真实木板','Take physical planks from the repair crate first'));continue;}
   eq.equip(tool);
   const land=this.app.landAdventure;
   if(land?.stance)land._toggleStance();if(this.app.game?.rod?.equipped){this.app.game.cancelLine(true);this.app.game.rod.equip(false);}
   this.toast(L(({cutlass:'短刀：左键斩击，右键防御；K 重击、Q 翻滚',bucket:this.app.boat.heritageDeck?'水桶：在尾部维修桶位舀出积水，到船舷泼出':'水桶：到舱底用左键舀水，再到船舷或火源左键泼出',shovel:'铁铲：藏宝地按住 E 挖掘',plank:this.app.boat.heritageDeck?'木板：从船侧接近真实破口，按住左键 2.2 秒修补':'木板：进入舱底，靠近实际破口按住左键 2.2 秒修补',spyglass:'望远镜：按住右键观察',lantern:'提灯：R 切换照明',hands:'已收起工具'})[tool]||'工具已装备',({cutlass:'Cutlass: LMB swing, RMB guard, K heavy, Q dodge',bucket:'Bucket: click by bilge to scoop; click at rail/fire to throw',shovel:'Shovel: hold E at dig site',plank:'Planks: enter the hold, face an actual hull hole and hold LMB for 2.2s',spyglass:'Spyglass: hold RMB to zoom',lantern:'Lantern: R toggles light',hands:'Hands free'})[tool]||'Tool equipped'),2.6);
  }
  if(this.app.landAdventure?.stance){eq.clearTransient();this.lastToolMouse=!!input.mouseDown;return;}
  if(eq.active==='spyglass')eq.raised=!!input.rightDown;
  else eq.raised=false;
  const click=!!input.mouseDown&&!this.lastToolMouse;
  const rail=p.mode==='deck' && (p.deckPos?(this.app.boat.shipScale?Math.abs(p.deckPos.x)>actualHalfWidth(p.deckPos.z)-.65:Math.abs(p.deckPos.x)>1.02)||(!this.app.boat.shipScale&&p.deckPos.z>2.8):false);
  const bilge=p.mode==='deck'&&['hold','lowerHold'].includes(p.deckLayer);
  const hole=p.mode==='deck'&&['hold','lowerHold'].includes(p.deckLayer)?this.damage.nearbyHole(p.deckPos,1.35):null;
  const nearRepair=!!hole;
  const nearCrate=p.mode==='deck'&&p.deckLayer!=='hold'&&distance(p.position,this.shipWorld('repair'))<2.7;
  if(eq.active==='bucket'&&click){
   if(!eq.bucketFull){
    if(bilge){
     const r=this.net.connected&&!this.net.isHost?
      (this.damage.water>.001?(eq.bucketFull=true,eq.bucketContent='bilge',eq.animate('scoop'),this.net.send('ship_tool',{verb:'bail'}),{ok:true}):{ok:false}):eq.scoop(this.damage);
     this.toast(r.ok?L('已从维修桶位抽取积水，去船舷泼出','Bucket filled; throw over the side'):L('目前没有积水。','No bilge water to bail.'),2);
    }else if(rail){eq.fillSea();this.toast(L('从船舷提起一桶海水','Drew seawater over the rail'),1.5);}
    else if(p.mode==='walk'&&Math.abs(p.position.y-(p.waterH??0))<1.15){eq.fillSea();this.toast(L('水桶装满了海水','Bucket filled with seawater'),1.5);}
    else this.toast(L('先到船尾水桶 / 舱底积水处舀水','Find bilge water by the stern bucket first'),2);
   }else{
    const fire=p.mode==='deck'&&this.damage.fire>.01&&distance(p.position,this.shipWorld('repair'))<3.4;
    const result=eq.throwWater(this.net.connected&&!this.net.isHost?{douse:()=>{}}:this.damage,{overboard:rail,atFire:fire});
    if(result.ok){if(this.net.connected&&!this.net.isHost&&fire)this.net.send('ship_tool',{verb:'douse'});
     this.toast(fire?L('泼水扑火！','Fire doused!'):L('已将积水泼到船外','Water thrown overboard'),2);}
    else this.toast(L('到船舷或火源再泼水；不能倒在甲板上','Throw water over the rail or at a fire'),2);
   }
  }
  if(eq.active==='plank'){
   if(!this.net.isHost&&this.net.connected){
     const result=eq.repair(dt,{...this.damage,patchHole:()=>true},{nearHole:nearRepair,held:!!input.mouseDown,holeId:hole?.id||null});
     if(result.finished)this.net.send('ship_tool',{verb:'patch',holeId:hole.id});
     if(click&&!nearRepair)this.toast(this.app.boat.heritageDeck?L('靠近有破口的船侧才能修补','Move alongside an actual hull breach'):L('下舱找到实际破口才能修补','Find a leaking hull hole in the lower hold'),2);
   }
   else{
    const result=eq.repair(dt,this.damage,{nearHole:nearRepair,held:!!input.mouseDown,holeId:hole?.id||null});
    if(result.finished){if(this.net.connected)this.net.send('ship_tool',{verb:'patch',holeId:hole?.id});this.toast(L(`已钉牢船板，剩余 ${result.remaining} 块`,`Plank secured, ${result.remaining} remaining`),2);eq.animate('hammer');}
    else if(click&&!nearRepair)this.toast(this.app.boat.heritageDeck?L('先移动到出现破口的船舷，再按住左键修补','Move to the damaged rail and hold LMB'):L('请到舱底破口旁，按住左键修补','Hold LMB next to an actual hole in the hold'),2);
   }
  }
  if(eq.active==='plank'&&input.consume('KeyR','voyage')&&nearCrate){
    if(this.net.connected&&this.app.boat.heritageDeck)this.takeSupply('plank');
    else {const n=eq.restock(Math.min(3,this.inventory.count('plank')));if(n)this.inventory.take('plank',n);this.repairStock=this.inventory.count('plank');this.toast(n?L(`从维修箱取出 ${n} 块木板，库存剩余 ${this.repairStock}`,`Took ${n} planks; crate: ${this.repairStock}`):L('维修箱木板已耗尽','Repair crate is empty'),2);}
   }
  if(eq.active==='lantern'&&input.consume('KeyR','voyage')){
   this.app.localLights?.toggleFlashlight?.();eq.animate('draw');
  }
  if(eq.active==='cutlass'&&click){eq.animate('swing');this.app.hunt?.bosses.tryCutTentacle(this.app.camera.position,p.getViewDir(new Vector3()));}
  if(eq.active==='shovel'&&this.digging)eq.animate('scoop');
  this.lastToolMouse=!!input.mouseDown;
 }
 afterPlayer(dt){
  if(!this.app.camera)return;const body=this.deckBody,p0=this.app.player,b0=this.app.boatCtl;if(body){body.root.position.copy(p0.position);if(p0.mode==='deck')body.root.quaternion.copy(b0.quaternion).multiply(new Quaternion().setFromAxisAngle({x:0,y:1,z:0},p0.deckYaw||0));else{const d=p0.getViewDir(new Vector3());body.root.rotation.set(0,Math.atan2(d.x,d.z),0);}const bodyThird=p0.mode==='deck'?p0.deckViewMode==='third':p0.mode==='walk'&&this.app.landAdventure?.avatar.mode==='third';const activity=this.bodyActivity.update(dt,{player:p0,voyage:this,land:this.app.landAdventure,input:this.input,speed:p0.mode==='deck'?Math.hypot(p0.deckVel?.x||0,p0.deckVel?.z||0):Math.hypot(p0.velocity?.x||0,p0.velocity?.z||0)});body.update(dt,{visible:bodyThird&&!p0.cameraOccluded&&!this.app.freeCam&&!this.deepEcho?.piloting,activity,station:p0.stationId,boat:this.app.boat,feet:p0.position,yaw:b0.getYaw()+(p0.deckYaw||0),gear:this.app.landAdventure?.stance?this.app.landAdventure.weaponId:this.equipment.active,supply:this.heldAmmo,cargo:this.cargo.heldBy.has(this.actorId),crouched:p0.crouched,poseHeight:p0.mode==='deck'?p0.poseHeight:1.75,working:this.input.down('KeyW')||this.input.down('KeyS')});if(p0.mode==='walk'&&this.app.landAdventure?.avatar?.actor){body.root.visible=false;/* LandAvatar owns its own rig and weapon bones. */}else if(body.ready&&bodyThird&&this.app.landAdventure?.avatar)this.app.landAdventure.avatar.root.visible=false;}
  const eq=this.equipment,p=this.app.player;
  const third=!p.cameraOccluded&&((this.app.landAdventure?.avatar?.mode==='third'&&p.mode==='walk')||(p.mode==='deck'&&p.deckViewMode==='third'));
  this.hands.update(dt,{player:p,camera:this.app.camera,equipment:eq,
   carrying:this.cargo.heldBy.has(this.actorId),supply:this.heldAmmo,thirdPerson:third,landSword:!!this.app.landAdventure?.stance||!!this.app.game?.rod?.equipped,freeCam:!!this.app.freeCam});
  const gripActive=p.mode==='deck'&&p.stationId&&!third&&!this.app.freeCam&&this.stationHands.update(this.app.boat,p.stationId,p.position,this.app.boatCtl.quaternion);if(!gripActive)this.stationHands.root.visible=false;else this.hands.root.visible=false;
  const camera=this.app.camera;
  if(this._originalFOV==null&&Number.isFinite(camera.fov))this._originalFOV=camera.fov;
  const want=eq.active==='spyglass'&&eq.raised&&!p.stationId?Math.min(28,this._originalFOV||55):this._originalFOV;
  if(Number.isFinite(want)&&Math.abs(camera.fov-want)>.1){camera.fov=want;camera.updateProjectionMatrix?.();}
 }
 refreshVisuals(){this.chestMesh && (this.chestMesh.visible=false);}
 _syncSailVisual(){
  // The guest sees the same reefed canvas as the authoritative helm.
  const canvas=this.app.boat.meshes?.sail;
  const show=.10+.9*(this.stations.sailMain*.78+this.stations.sailJib*.22);
  if(canvas){canvas.scale.y=show;canvas.position.y=(1-show)*4.8;canvas.rotation.y=this.stations.sailTrim*.26;}
    const rigFactor=1-(this.damage.rigDamage||0)*.85;
  this.app.boat.heritageArt?.setSailAmount?.(this.stations.sailMain*rigFactor,this.stations.sailJib*rigFactor,this.stations.sailTrim);
  // Physical guns follow their current constrained muzzle direction. Visual
  // recoil uses the same shot that the authority generated, not a cosmetic click.
  for(const id of ['cannon_port','cannon_starboard']){
   const pivot=this.markerMeshes?.[id]?.userData?.tube;
   if(!pivot)continue;
   const owner=this.stations.getOccupant(id),cmd=owner?this.stations.inputs.get(owner):null;
   const direction=cannonDirection(id,0,cmd?.aimYaw,cmd?.aimPitch);
   aimCannonMount(this.markerMeshes[id],direction,this.cannonRecoil?.[id]||0);
  }
  // Mechanical instrument needles mirror live winch positions.
  for(const id of ['sail_main','sail_jib']){
    const mesh=this.markerMeshes?.[id]?.userData?.needle;
    if(mesh)mesh.rotation.y=(id==='sail_main'?this.stations.sailMain:this.stations.sailJib)*Math.PI*1.65;
  }
  const anchorNeedle=this.markerMeshes?.anchor?.userData?.needle;
  if(anchorNeedle)anchorNeedle.rotation.y=this.stations.anchorCrankTurns;
 }
 _decorateChest(mesh){
   if(!this.artistChestRoot||mesh.userData?.v47ArtistChest)return;
   const child=this.artistChestRoot.clone(true);child.name='Quaternius CC0 actual treasure model';child.scale.setScalar(.70);
   for(const existing of mesh.children)existing.visible=false;
   mesh.add(child);mesh.userData.v47ArtistChest=true;
 }
 _updateChest(){
  const live=new Set();let floatingIndex=0;
  for(const item of this.cargo.items.values()){
   if(item.kind!=='treasure_chest_small')continue;
   live.add(item.id);
   let mesh=this.chestMeshes.get(item.id);
   if(!mesh){mesh=this.chestMeshes.size===0?this.chestMesh:makeChest();if(mesh!==this.chestMesh)this.app.scene.add(mesh);this.chestMeshes.set(item.id,mesh);}
   this._decorateChest(mesh);
   mesh.visible=true;
   if(item.state==='hold'){
    const l=item.holdLocal||{x:0,y:this.interior.layout.floorY,z:this.interior.layout.z};
    const pos=this.localWorld({x:l.x,y:l.y+.05,z:l.z});mesh.position.copy(pos);
    if(this.app.boatCtl.quaternion)mesh.quaternion.copy(this.app.boatCtl.quaternion);
   }else if(item.state==='world'){
    if(item.onDeck&&item.deckLocal){const pos=this.cargoWorldPoint(item);mesh.position.set(pos.x,pos.y+.12,pos.z);if(this.app.boatCtl.quaternion)mesh.quaternion.copy(this.app.boatCtl.quaternion);}
    else{mesh.quaternion.identity();const ground=this.app.terrainData.heightAt(item.x,item.z);let y=Math.max(item.y||0,ground+.25);
     if(item.floating){y=Math.max(0,ground+.25);const q=this.app.query;
      if(q&&this.cargoWaterSlot!==null&&floatingIndex<10){const slot=this.cargoWaterSlot+floatingIndex++;q.setPoint(slot,item.x,item.z);
       if(q.cpuValid&&Math.hypot(q.resultInputs[slot*4]-item.x,q.resultInputs[slot*4+1]-item.z)<10){const w=q.get(slot);y=Math.max(ground+.25,w.height+.06);mesh.rotation.set(-Math.atan2(w.nz,1)*.6,0,Math.atan2(w.nx,1)*.6);}
      }
     }mesh.position.set(item.x,y,item.z);}
   }else if(item.state==='held'){
    const peer=this.app.crew?.peers?.get?.(item.actorId);
    if(item.actorId===this.actorId){const p=this.app.player,third=!p.cameraOccluded&&(p.mode==='deck'?p.deckViewMode==='third':this.app.landAdventure?.avatar.mode==='third');mesh.visible=!!third;if(third){const rotation=p.mode==='deck'?this.app.boatCtl.quaternion.clone().multiply(new Quaternion().setFromAxisAngle({x:0,y:1,z:0},p.deckYaw||0)):new Quaternion().setFromAxisAngle({x:0,y:1,z:0},p.yaw+Math.PI);mesh.position.copy(new Vector3(0,.85,.48).applyQuaternion(rotation).add(p.position));mesh.quaternion.copy(rotation);}}
    else if(!peer?.root)mesh.visible=false;
    else if(peer.sailorBody?.ready){mesh.position.copy(peer.sailorBody.root.localToWorld(new Vector3(0,.85,.48)));peer.sailorBody.root.getWorldQuaternion(mesh.quaternion);}
    else{const pos=peer.root.position,yaw=peer.root.rotation.y;mesh.position.set(pos.x-Math.sin(yaw)*.48,pos.y+.85,pos.z-Math.cos(yaw)*.48);mesh.rotation.y=yaw;}
   }else mesh.visible=false;
  }
  for(const [id,mesh] of this.chestMeshes)if(!live.has(id)){
    mesh.visible=false;if(mesh!==this.chestMesh)this.app.scene.remove(mesh);this.chestMeshes.delete(id);
  }
 }
 isHeldInteraction(id,candidates){return this.heldInteractionId===id&&!this.app.freeCam&&!this.app.player.stationId&&!this.app.player.shipClimb&&!this.app.player.mastClimb&&!this.app.player.aftLadderClimb&&!this.app.player.boardingClimb&&!this.app.player.pendingStation&&heldInteraction(this.input,id,candidates,this.app.player.position);}
 _runDig(dt){const p=this.app.player;
  const near=p.mode==='walk'&&this.voyage.phase==='accepted'&&this._nearPlayer(this.digModel.position,4.1);
  if(!near||!this.input.enabled||this.input.gameplayBlocked||this.app.freeCam||this.app.landAdventure?.stance){this._cancelDig();return;}
  if(this.isHeldInteraction('dig_moss',this.getNearbyCandidates())){
    if(this.equipment.active!=='shovel'){
      if(this.app.landAdventure?.stance)this.app.landAdventure._toggleStance();
      this.equipment.equip('shovel');
    }
    this.digging=true;const d=this.dig.advance(this.actorId,dt,true);
    this.toast(`正在挖掘藏宝点 ${Math.round(d.progress*100)}% · 按住 E`,.3);
    if(this.net.connected){this.digClock-=dt;if(this.digClock<=0){this.net.send('voyage_event',{verb:'dig_progress',voyageId:VOYAGE_GOLD_MOSS.id});this.digClock=.16;}}
    else if(d.justCompleted&&this.voyage.digDone()){
      this.cargo.spawnChest('chest_moss_01',{x:STORMWAKE_M1.digSite.x,y:this.digModel.position.y,z:STORMWAKE_M1.digSite.z});
      this.toast(this.app.boat.heritageDeck?'找到藏宝箱！按 E 拿起，搬到原船后甲板货位。':'找到藏宝箱！按 E 拿起，搬回船舱。',6);this._persistCargo();
    }
  }else this._cancelDig();
 }
 _cancelDig(){
  if(this.digging){
    if(this.net.connected)this.net.send('voyage_event',{verb:'dig_cancel',voyageId:VOYAGE_GOLD_MOSS.id});
  }
  this.dig.advance(this.actorId,0,false);this.digClock=0;this.digging=false;
 }
 _issueShot(shot){
  if(!this.net.isHost)return;
  const gun=this.cannons[shot.stationId];
  const fired=gun?.fire();
  if(!fired){this.toast(L('火炮尚未完成装填，按 R 装弹。','Cannon not loaded. Press R to reload.'),1.5);return;}
  const b=this.app.boatCtl;
  const direction=cannonDirection(shot.stationId,b.getYaw(),shot.aimYaw,shot.aimPitch,b.quaternion);
  const origin=this.shipWorld(shot.stationId);
  if(!origin||!direction){gun.phase='READY';return;}
  const marker=this.markerMeshes?.[shot.stationId];
  aimCannonMount(marker,direction,0);
  const socket=cannonMuzzle(marker);
  const fallback=new Vector3(0,this.app.boat.heritageDeck ? .17 : .6,0).applyQuaternion(b.quaternion||new Quaternion());
  const muzzle=socket||new Vector3(origin.x,origin.y,origin.z).add(fallback).addScaledVector(new Vector3(direction.x,direction.y,direction.z),.90);
  const launch={x:muzzle.x,y:muzzle.y,z:muzzle.z,
    vx:direction.x*56+b.velocity.x,vy:direction.y*56+(b.velocity.y||0),vz:direction.z*56+b.velocity.z};
  this._spawnBall({...launch,source:'player',ammoType:fired.ammoType});
  this.cannonRecoil=this.cannonRecoil||{};this.cannonRecoil[shot.stationId]=.48;
  // Broadcast only validated, authoritative ball trajectories, not client hits.
  if(this.net.connected)this.net.send('cannon_fire_host',{...launch,source:'player',ammoType:fired.ammoType});
  this.toast(L('舷炮开火！后坐复位后按 R 装弹。','Cannon fired. Press R after recoil to reload.'),1.2);
 }
 _spawnBall(launch){
  if(!['x','y','z','vx','vy','vz'].every(k=>Number.isFinite(launch[k])))return false;
  const ball=makeCannonBall();ball.position.set(launch.x,launch.y,launch.z);this.app.scene.add(ball);
  this.cannonBalls.push({mesh:ball,...launch,source:launch.source||'player',ammoType:launch.ammoType||'cannonball',age:0});return true;
 }
 _stepShots(dt){
  // Fixed substeps prevent a 56 m/s ball from tunnelling through a 3 m hull.
  const steps=Math.max(1,Math.ceil(Math.min(dt,.06)/.012)),h=dt/steps;
  const b=this.app.boatCtl;
  for(const ball of this.cannonBalls){if(ball.dead)continue;
   for(let i=0;i<steps&&!ball.dead;i++){
    const ax=ball.x,ay=ball.y,az=ball.z;
    ball.age+=h;ball.vy-=9.81*h;ball.x+=ball.vx*h;ball.y+=ball.vy*h;ball.z+=ball.vz*h;
    const incoming=ball.source==='enemy'||ball.source==='ghost';
    const target=incoming?b.position:this.enemy;
    const cx=target.x??target.position?.x,cz=target.z??target.position?.z;
    const dx=ball.x-ax,dz=ball.z-az,den=dx*dx+dz*dz;
    const t=den>0?clamp(((cx-ax)*dx+(cz-az)*dz)/den,0,1):0;
    const ix=ax+dx*t,iz=az+dz*t,iy=ay+(ball.y-ay)*t;
    // Test the moving shell against the boat's rotated *full-sized* hull.
    // A circular 3.25m target wrongly made the 23m bow and stern unhittable.
    const shipHit=incoming?segmentHullHit({x:ax,y:ay,z:az},{x:ball.x,y:ball.y,z:ball.z},b):null;
    const lampHit=!incoming&&this.net.isHost?this.ghostLantern?.hitSegment({x:ax,y:ay,z:az},{x:ball.x,y:ball.y,z:ball.z}):null;
    const ghostHit=!incoming&&this.net.isHost?this.ghostFleet.findHullHit({x:ax,y:ay,z:az},{x:ball.x,y:ball.y,z:ball.z}):null;
    const enemyHit=!incoming&&Math.hypot(ix-cx,iz-cz)<3.1&&iy>-.85&&iy<2.6;
    const titanHit=!incoming&&this.net.isHost&&ball.age>.03&&!enemyHit&&!ghostHit&&!lampHit&&this.app.hunt?.bosses?.hitProjectile(new Vector3(ax,ay,az),new Vector3(ball.x,ball.y,ball.z),{id:'cannon',damage:82,type:'blast'});
    if(titanHit){ball.dead=true;this.toast('舷炮命中 '+titanHit.name,2);}
    if(this.net.isHost&&!ball.dead&&ball.age>.03&&(shipHit||enemyHit||ghostHit||lampHit)){
     if(lampHit){this.toast('命中幽焰桅灯',2);}
     else if(incoming){
      const local=shipHit.local,sc=this.app.boat.shipScale||{x:1,y:1,z:1};
      const hit={x:local.x>=0?1.05*sc.x:-1.05*sc.x,
        y:clamp(local.y,-.65*sc.y,-.05*sc.y),z:clamp(local.z,-3.25*sc.z,3.5*sc.z)};
      this.damage.applyHit(ball.ammoType==='chainshot'?8:12,ball.ammoType==='chainshot'?'chain':'ball',hit);
      this.toast(L('敌炮命中！下舱检查破口并排水。','Incoming cannon hit! Inspect holes below deck.'),3);
     }else if(ghostHit){
      const shieldIndex=Number(ghostHit.ship.id.slice(-1));const shield=this.ghostLantern?.quest.phase==='battle'&&shieldIndex<3&&this.ghostLantern.quest.lamps[shieldIndex]>0;
      if(!shield)this.ghostFleet.hit(ghostHit.ship.id,ball.ammoType==='chainshot'?22:33,ball.ammoType);
      this.toast(shield?L('幽焰防护吸收了炮弹，瞄准桅杆绿灯！','Spectral shield absorbed the shot; aim at the green mast lantern!'):L('命中幽灵舰体！','Spectral hull hit!'),2);
     }else{
      this.enemy.hit(ball.ammoType==='chainshot'?19:30,ball.ammoType);
      this.toast(L(`命中敌船 · 敌船剩余 ${this.enemy.hp} HP`,`Enemy hit · ${this.enemy.hp} HP remaining`),2);
     }
     ball.dead=true;
    }
    if(ball.age>8||ball.y<-1.5)ball.dead=true;
   }
   ball.mesh.position.set(ball.x,ball.y,ball.z);
   if(ball.dead)this.app.scene.remove(ball.mesh);
  }
  this.cannonBalls=this.cannonBalls.filter(ball=>!ball.dead);
 }
 beforePhysics(dt){
  this.net.beforePhysics(dt);if(!this.net.isHost)return;
  const b=this.app.boatCtl;const phase=this.voyage.phase;this.loadDynamics??=new ShipLoadDynamics(b);this.loadDynamics.update(dt,b,this.damage,[...this.cargo.items.values()].filter(i=>i.shipId===STORMWAKE_M1.shipId||i.onDeck));
  if(this.damage.isSinking()){
    this.stations.anchorDown=true;b.driven=false;b.voyageAnchor=true;b.setInput(0,0,dt);
    if(!this.sinkingReported){
      this.sinkingReported=true;this.toast('船只正在下沉！船舱里的战利品落入海中，使用存档或重新开始航程。',10);
      if(!this.net.connected)releaseSunkenCargo(this.cargo,this.cartographer.ship());this._persistCargo();
    }return;
  }
  const chartAim=this.app.oceanChart?.getNavigationTarget?.();
  const missionAim=phase==='accepted'?STORMWAKE_M1.mossLanding:phase==='stowed'?STORMWAKE_M1.returnPort:null;
  const aim=chartAim||missionAim;
  const crewAboard=['boat','deck'].includes(this.app.player.mode) || [...(this.app.crew?.peers?.values?.() || [])].some(p=>['boat','deck'].includes(p.mode));
  const wind=b.voyageWind.evaluate({heading:b.getYaw(),velocity:b.velocity,sailMain:this.stations.sailMain,sailJib:this.stations.sailJib,sailTrim:this.stations.sailTrim});
  const distanceGoal=aim?distance(b.position,aim):Infinity;
  let steeringTarget=aim;
  if(aim&&crewAboard&&distanceGoal>17){
    const changed=!this.navPlan||distance(this.navPlan.target,aim)>22||distance(this.navPlan.start,b.position)>260;
    if(changed){this.navPlan={target:{x:aim.x,z:aim.z},start:{x:b.position.x,z:b.position.z},
      points:buildSafeSeaRoute(b.position,aim,this.app.terrainData)};}
    if(this.navPlan.points){
      while(this.navPlan.points.length>1&&distance(b.position,this.navPlan.points[0])<37)this.navPlan.points.shift();
      steeringTarget=this.navPlan.points[0]||aim;
    }else{
      steeringTarget=null;
      if(!this.navRouteWarning){this.navRouteWarning=true;this.toast('目标缺少安全航路：请重新选择靠近开放海域的位置',5);}
    }
  }else if(!aim)this.navPlan=null;
  if(steeringTarget)this.navRouteWarning=false;
  if(chartAim){if(!this.navDestination||distance(this.navDestination,chartAim)>1){this.navDestination={...chartAim};this.navArrived=false;}if(distanceGoal<18)this.navArrived=true;this.navigationStopping=false;}
  else if(this.navDestination){this.navDestination=null;this.navigationStopping=true;}
  if(this.navigationStopping&&this.stations.anchorTravel>.999)this.navigationStopping=false;
  const auto=!!chartAim||this.navigationStopping,arriving=!!this.navArrived||this.navigationStopping;
  this.sailingCourse??=new SailingCourse();
  const threat=crewAboard?nearestCombatTitan(b,this.app.hunt?.bosses?.entities?.values(),this.combatWarpTarget):null;
  if(!threat)this.combatWarpTarget=null;
  const escape=threat?combatCourse(b,threat,this.app.terrainData):null;
  const helm=this.stations.getOccupant('helm');const humanHelm=helm&&!helm.startsWith('ai:');const helmOrder=humanHelm?(this.stations.inputs.get(helm)?.throttleAxis||0):0;
  if(!humanHelm)this.helmAssist=null;
  else if(helmOrder>0)this.helmAssist='sail';else if(helmOrder<0)this.helmAssist='furl';
  const assist=this.helmAssist;
  const combat=!!escape;const course=combat?this.sailingCourse.update(dt,b,escape,b.voyageWind.wind,this.app.terrainData):auto&&!arriving?this.sailingCourse.update(dt,b,steeringTarget,b.voyageWind.wind,this.app.terrainData):null;
  this.navigationPhase=combat?'combat':!auto?'manual':arriving?'stopping':Math.hypot(b.voyageWind.wind.x,b.voyageWind.wind.z)<.1?'calm':this.stations.anchorTravel>.001?'weighing':this.stations.sailMain<.7?'setting_sail':this.sailingCourse.tacking?'tacking':'sailing';
  this.crew.update(dt,{boat:b,wind,enemy:this.enemy,waypoint:crewAboard?course:null,damage:this.damage,inventory:this.inventory,autopilot:auto||combat,arriving:!combat&&arriving,sailTarget:combat?.95:Math.max(.18,Math.min(.95,(distanceGoal-10)/110)),standby:!combat&&(arriving||this.deepEcho.quest.members.length>0),threat,assist});
  // V56: NEVER release the anchor just because a crew member boards or chooses
  // an AI target. The capstan (W raise / S lower) is the sole release mechanism.
  // AI may set rudder and sails only AFTER the anchor is physically hauled up.
  for(const [id,gun] of Object.entries(this.cannons)){const owner=this.stations.getOccupant(id),cmd=owner?this.stations.inputs.get(owner):null;
    if(cmd?.reload&&!(this.net.connected&&this.app.boat.heritageDeck&&!owner?.startsWith('ai:'))){
      if(this.app.boat.heritageDeck&&owner===this.actorId){
        if(this.heldAmmo){if(gun.requestReload(this.heldAmmo,{reserved:true})){this.heldAmmo=null;this.toast(L('开始真实装填，等待炮闩就绪。','Manual loading started; wait for the breech.'));}else this.toast(L('先等火炮复位，再按 R 装填','Wait for cannon recoil to finish'));}
        else if(this.inventory.count('cannonball')>0){if(gun.requestReload('cannonball'))this.toast(L('正在从有限弹药库存装填，约 2.8 秒。','Reloading from finite ship magazine (~2.8 s).'));}
        else this.toast(L('弹药库存为空，请补给实体炮弹','Magazine empty; resupply cannonballs'));
      }else gun.requestReload();
    }
    gun.tick(dt,this.inventory);
    if(this.app.boat.heritageDeck)this.stations.cannon[id].loaded=gun.ready;
   }
  const state=this.stations.update(dt);
  b.voyageSails.main=state.sailMain*(1-(this.damage.rigDamage||0)*.85);b.voyageSails.jib=state.sailJib*(1-(this.damage.rigDamage||0)*.85);b.voyageSails.trim=state.sailTrim;
  this._syncSailVisual();
  b.voyageAnchor=state.anchorHeld;
  b.anchorTravel=state.anchorTravel;
  b.driven=!b.voyageAnchor;
  if(!b.voyageAnchor)b.moored=false; // dock lines release after the manual capstan is fully raised
  if(this.app.boat.heritageDeck)this.stations.helmThrottle=0;
  b.setInput(b.voyageAnchor||this.app.boat.heritageDeck?0:state.helmThrottle,state.rudder,dt);
  // Host executes all participants' ship repairs and bucket actions,
  // not just the physical keyboard attached to the host computer.
  const repairer=this.stations.getOccupant('repair');
  if(repairer){
   const held=!!this.stations.inputs.get(repairer)?.repair;
   const progress=held?Math.min(2.2,(this.repairProgress.get(repairer)||0)+dt):0;
   if(progress>=2.2&&this.inventory.count('plank')>0&&this.damage.holes.every(h=>h.state==='sealed')&&distance(b.position,STORMWAKE_M1.returnPort)<55&&this.damage.integrity<99.9){
    this.damage.repair(1.7);this.inventory.take('plank');this.repairStock=this.inventory.count('plank');this.repairProgress.set(repairer,0);
    this.toast(L(`船板修复完成，库存 ${this.repairStock}`,`Hull patched. Planks: ${this.repairStock}`),2);
   }else this.repairProgress.set(repairer,progress);
  }
  const bucketer=this.stations.getOccupant('bucket');
  const bucketCmd=bucketer?this.stations.inputs.get(bucketer):null;
  if(bucketCmd?.bucket){
   const inventory=this.stationBucket||(this.stationBucket={full:false});
   if(inventory.full){if(this.damage.fire>.01)this.damage.douse(1);inventory.full=false;}
   else inventory.full=this.damage.bail(.22)>.01;
   bucketCmd.bucket=false;
  }
  for(const shot of state.shots)this._issueShot(shot);
  this.damage.update(dt,{boat:b});
  // A hatch left open in a rain wall admits a small but real amount of water.
  // The ship's single authoritative bilge value remains shared by tools/visuals.
  const rain=this.app.offshoreWeather?.rain||0;
  if(this.interior.hatchOpen && rain>.15 && !this.damage.sunk){
    this.damage.water=clamp(this.damage.water+dt*rain*.0015,0,.98);
    this.damage.hull.setWater(this.damage.water);
  }
  this.repairStock=this.inventory.count('plank');
 }
 _updateControls(dt){
  const player=this.app.player,id=player.stationId;if(!id)return;
  if(this.stations.getOccupant(id)!==this.actorId){player.stationId=null;return;}
  if(this.app.freeCam)return;
  const input=this.input;if(!input.enabled)return;
  let stationFire=false,stationBucket=false;
  
  if(id==='bucket'&&input.consume('KeyE','voyage')){
    stationBucket=true;
    this.toast((this.stationBucket?.full?L('正在泼水','Throwing water'):L('正在舀取舱底积水','Scooping bilge water')),1.5);
  }
  if(id!=='bucket'&&input.consume('KeyE','voyage')){this.leaveStation();return;}
  let axis=0;
  if(id==='helm')axis=Number(input.down('KeyA'))-Number(input.down('KeyD'));
  else if(id.startsWith('sail_')||id.startsWith('anchor'))axis=Number(input.down('KeyW'))-Number(input.down('KeyS'));
  if(!['helm','sail_main','sail_jib'].includes(id)&&!id.startsWith('anchor'))axis=0;
  const throttleAxis=id==='helm'?Number(input.down('KeyW'))-Number(input.down('KeyS')):0;
  const trimAxis=id.startsWith('sail_')?Number(input.down('KeyA'))-Number(input.down('KeyD')):0;
  const anchorAuto=false; // Manual chain only: the R key cannot secretly override the winch.
  const aimYaw=id.startsWith('cannon_')?player.deckYaw:undefined;
  const aimPitch=id.startsWith('cannon_')?player.pitch:undefined;
  const clicked=!!input.mouseDown&&!this.lastMouseDown;
  const fire=(id.startsWith('cannon_')&&clicked)||stationFire;
  const reload=id.startsWith('cannon_')&&input.consume('KeyR','voyage');
  if(reload)this.equipment.animate('reload');
  if(id.startsWith('anchor')&&axis)this.equipment.animate('crank');
  if(id.startsWith('sail_')&&(axis||trimAxis))this.equipment.animate('haul');
  if(this.net.connected){
    // Edge events must survive the 60ms position-rate scheduler. Otherwise
    // an LMB shot or single E anchor toggle can disappear between frames.
    this.pendingAction.fire ||= fire;
    this.pendingAction.reload ||= reload||anchorAuto;
    this.pendingAction.bucket ||= stationBucket;
    this.inputClock-=dt;
    if(this.inputClock<=0){
      this.net.input(id,{axis,throttleAxis,trimAxis,aimYaw,aimPitch,fire:this.pendingAction.fire,reload:this.pendingAction.reload,
        bucket:this.pendingAction.bucket,repair:id==='repair'&&!!input.mouseDown});
      this.pendingAction={fire:false,reload:false,bucket:false};
      this.inputClock=.06;
    }
  }else this.stations.setInput(id,this.actorId,{axis,throttleAxis,trimAxis,aimYaw,aimPitch,fire,reload:reload||anchorAuto,bucket:stationBucket,repair:id==='repair'&&!!input.mouseDown});
 }
 update(dt){if(!this.input.down('KeyE')||this.input.hit('KeyE')||this.input.gameplayBlocked||this.input.interactionOwner!=='voyage')this.heldInteractionId=null;if(!this.cartographer)this.cartographer=new CartographerRuntime(this);this.cartographer.update(dt);this.beacon?.update(dt);this.merchant?.update(dt);this.ghostLantern?.update(dt);this.deepEcho?.update(dt);this.harborPeople?.update(dt,this.app.fft?.time?.value||this.time);this.time+=dt;this.noticeTimer=Math.max(0,this.noticeTimer-dt);
  const blockers=this.app.player.mode==='deck'?[this.app.player.deckPos]:[];
  for(const peer of this.app.crew?.peers?.values?.()||[]){
    if(peer.mode!=='deck'||!peer.root?.position)continue;
    blockers.push(peer.root.position.clone().sub(this.app.boatCtl.position).applyQuaternion(this.app.boatCtl.quaternion.clone().invert()));
  }
  this.app.boat.originalDoor?.update(dt,blockers);
  this.app.boat.heritageArt?.anchorRig?.update(dt,this.stations.anchorTravel);
  if(this.app.boat.heritageDeck?.helmWheel)this.app.boat.heritageDeck.helmWheel.rotation.z=-this.stations.rudder*.78;
  const capstan=this.app.boat.heritageArt?.capstan;if(capstan)capstan.rotation.y=this.stations.anchorCrankTurns;
  const handles=this.app.boat.heritageDeck?.windlass;
  if(handles)handles.rotation.y=this.stations.anchorCrankTurns;
  if(this.app.hunt?.abyss?.active)return;
  const player=this.app.player,inp=this.input;
  this._runDig(dt);
  if(this.deepEcho?.piloting)return;this._updateTools(dt);
  const view=this.app.camera?player.getViewDir(new Vector3()):null;
  this.interact.beginFrame({view});for(const c of this.getNearbyCandidates())this.interact.add(c,player.position);
  this.selected=this.interact.select();
  if(this.heldInteractionId&&!this.interact.candidates.some(c=>c.id===this.heldInteractionId))this.heldInteractionId=null;
  if(!this.selected&&inp.interactionOwner==='voyage'&&!player.stationId&&!(player.mode==='deck'&&(inp.down('ShiftLeft')||inp.down('ShiftRight'))))inp.interactionOwner=this.app.landAdventure?.wantsLandInteraction?.(player.position)?'land':null;
  if(this.selected&&player.mode!=='boat'&&inp.enabled){
    // Shift+E is reserved for leaving the physical deck at a rail; never
    // let a nearby cannon, barrel or mooring line steal the disembark key.
    const shiftExit=player.mode==='deck'&&!player.stationId&&(inp.down('ShiftLeft')||inp.down('ShiftRight'));
    if(!shiftExit&&player.stationId!=='anchor'&&player.stationId!=='bucket'){if(this.interact.dispatch(inp,'voyage')&&inp.down('KeyE')&&/^dig_moss$|^cartographer_reel$|^ghost_lantern_reel$|^beacon_repair$|^merchant_repair/.test(this.selected.id))this.heldInteractionId=this.selected.id;}
  }
  if(player.stationId)this._updateControls(dt);
  player.carryingChest=this.cargo.heldBy.has(this.actorId);player.carriedMassKg=player.carryingChest?cargoMass(this.cargo.get(this.cargo.heldBy.get(this.actorId))):0;
  if(this.damage.isSinking()&&player.mode==='deck'&&player.deckLayer==='deck'&&player.position.y<player.waterH-.6){if(player.stationId)this.leaveStation();player.mode='swim';player.deckGrounded=false;}
  this.lastMouseDown=!!inp.mouseDown;
  if(this.net.isHost){
    const events=this.enemy.update(Math.min(dt,.1),this.app.boatCtl);
    for(const event of events)if(event.type==='enemy_projectile'){
      this._spawnBall({...event.launch,source:'enemy'});
      if(this.net.connected)this.net.send('cannon_fire_host',{...event.launch,source:'enemy'});
      this.toast(L('敌舰已发炮！注意弹道并准备规避。','Enemy broadside fired! Watch the incoming projectile.'),2);
    }
  }
  // Spectral fleet stays offshore; only three close hostile hull controllers
  // run projectile logic. Their shot events use the same cannonball and hull-hole pipeline.
  if(this.net.isHost&&!this.net.connected&&spawnSpectralSpoils(this.cargo,this.ghostFleet.snapshot(),this.voyage.redeemedSpectral))this._persistCargo();
  const ghostShots=this.ghostFleet.update(dt,this.app.boatCtl,{host:this.net.isHost,time:this.app.fft?.time?.value,camera:this.app.camera?.position});
  for(const event of ghostShots)if(event.type==='enemy_projectile'&&this.net.isHost){
    this._spawnBall({...event.launch,source:'ghost'});
    if(this.net.connected)this.net.send('cannon_fire_host',{...event.launch,source:'ghost'});
  }
  this.spectralWeather.update(this.app.fft?.time?.value ?? this.time,this.app.camera?.position || this.app.boatCtl.position);
  this.vortexVisuals.update(this.app.fft?.time?.value ?? this.time,this.app.camera?.position || this.app.boatCtl.position);
  this.stormRain.update(this.app.offshoreWeather,this.app.camera?.position||this.app.boatCtl.position,{indoors:isDryHoldCamera(this.app.player)});
  // Guest clients animate the same authoritative projectiles without applying damage twice.
  this._stepShots(Math.min(dt,.05));
  if(this.fireMesh){
   this.fireMesh.visible=this.damage.fire>.01;
   const intensity=clamp(this.damage.fire,0,1);
   this.fireMesh.scale.set(.6+intensity*.85,.6+intensity*.85,.6+intensity*.85);
   this.fireMesh.rotation.y=Math.sin(this.time*4)*.09;
  }
  if(this.cannonRecoil)for(const id of Object.keys(this.cannonRecoil))this.cannonRecoil[id]=Math.max(0,this.cannonRecoil[id]-dt);
  this.crewVisuals.update(dt,{aboard:true});this.looseSupplies.update();this.interior.update(this.damage.hull.getSection(-8));
  this.lowerHold?.update(this.damage.water,this.damage.hull.sections);
  this.hullVisuals.update();
  this.enemyModel.group.visible=this.enemy.state!=='sink';
  this.enemyModel.group.position.set(this.enemy.x,.2+Math.sin(this.time*1.4+this.enemy.x*.03)*.08,this.enemy.z);this.enemyModel.group.rotation.y=this.enemy.yaw;
  this._syncSailVisual();this._updateChest();this.net.update(dt);
  if(this.hud){
    if(typeof document!=='undefined'){
      document.body.classList.toggle('sw-v61-aboard',player.mode==='deck'||player.mode==='boat');
    }
    this.hud.dataset.station=player.stationId||'';
    this.hud.dataset.layer=player.deckLayer||'deck';
    if(this.journal&&!this.journal.hidden){const sig=journalSignature(this);if(sig!==this._journalPhase){this._journalPhase=sig;this._refreshJournal();}}
    const {objectiveIndex,objectives}=this.voyage.getState();
    const tracked=this.trackedMission&&missionLog(this,getLocale()==='en').find(q=>q.id===this.trackedMission);this.text('goal',tracked?`${tracked.title} · ${tracked.steps.find(s=>s.status==='active')?.title||L('已完成','Completed')}`:objectiveIndex>=objectives.length?L('航程已完成！可领取新的航程。','Voyage complete! A new voyage is available.'):(getLocale()==='en'?VOYAGE_GOLD_MOSS.objectivesEn[objectiveIndex]:objectives[objectiveIndex]));
    const b=this.app.boatCtl,dmg=this.damage;
    this.text('status',L(`潮币 ${this.voyage.tideCoin} · 声望 ${this.voyage.repGoldTide} · ${Math.round(b.speed*1.94)} 节 · ${this.stations.anchorDown?'已抛锚':'已起锚'} · 帆力 ${Math.round(b.voyageSailForce||0)}N · 主帆 ${Math.round(this.stations.sailMain*100)}% · 船体 ${Math.round(dmg.integrity)}%${dmg.breach>.02?' · 进水 '+Math.round(dmg.breach*100)+'%':''}${dmg.fire>.01?' · 火情 '+Math.round(dmg.fire*100)+'%':''}${dmg.water>.01?' · 舱水 '+Math.round(dmg.water*100)+'%':''}`,`TideCoin ${this.voyage.tideCoin} · Rep ${this.voyage.repGoldTide} · ${Math.round(b.speed*1.94)} kn · ${this.stations.anchorDown?'Anchored':'Anchor raised'} · Wind ${Math.round(b.voyageSailForce||0)}N · Mainsail ${Math.round(this.stations.sailMain*100)}% · Hull ${Math.round(dmg.integrity)}%${dmg.breach>.02?' · Leak '+Math.round(dmg.breach*100)+'%':''}${dmg.fire>.01?' · Fire '+Math.round(dmg.fire*100)+'%':''}${dmg.water>.01?' · Water '+Math.round(dmg.water*100)+'%':''}`));
    const w=this.app.offshoreWeather;
    if(w){
      const vc=this.vortexVisuals.root.position;
      const vortexDistance=Math.round(Math.hypot(b.position.x-vc.x,b.position.z-vc.z));
      this.text('weather',L(`海况 W${w.seaState} · 风 ${Math.round(w.windSpeed)} m/s · 云量 ${Math.round(w.cloud*100)}% · 幽灵舰 ${this.ghostFleet.liveCount}/10 · 龙卷距离 ${vortexDistance}m`,
        `Sea W${w.seaState} · wind ${Math.round(w.windSpeed)} m/s · clouds ${Math.round(w.cloud*100)}% · spectral ships ${this.ghostFleet.liveCount}/10 · waterspout ${vortexDistance}m`));
    }
    const active=player.stationId;
    this.text('prompt',active?L(`【${this.stationName(active)}】 ${active.startsWith('anchor')?'按住 W 收锚 · S 放锚 · E 离岗':active==='bucket'?'E 舀水/泼水 · Esc 离岗':'E 离岗 · Esc 返回甲板'}`,`[${this.stationName(active)}] ${active.startsWith('anchor')?'Hold W raise · S lower · E leave':active==='bucket'?'E scoop/throw · Esc leave':'E leave · Esc return to deck'}`):
      this.selected?.label||L(player.mode==='deck'?'舵轮/帆索 E 操作 · Space 越舷跳海 · 海中 W 爬梯':'去码头接航程，或直接登船自由出航',player.mode==='deck'?'E at stations · Space to jump rail · W on boarding ladder':'Accept a voyage or board to free-sail')); 
    const aboard=player.mode==='deck'||player.mode==='boat';
    const inst=this.hud.querySelector('[data-v41-instruments]');if(inst)inst.hidden=!aboard;
    if(aboard){
      const label=(key,val)=>{const el=this.hud.querySelector(`[data-v41-${key}]`);if(el)el.textContent=val;};
      const anchorPhysics=this.net.isHost?b.anchorTether?.state:this.net.remoteShip?.anchorState;
      label('anchor',this.stations.anchorTravel>.98&&anchorPhysics==='NO_BOTTOM_CONTACT'?L('锚链未触底','Anchor off bottom'):anchorPhysics==='DRAGGING'?L('拖锚！请收帆/减速','Dragging! Reduce sail'):this.stations.anchorTravel>.05&&this.stations.anchorTravel<.98?L('锚链 '+Math.round(this.stations.anchorTravel*100)+'% · '+this.stations.anchorHands+' 人转动','Chain '+Math.round(this.stations.anchorTravel*100)+'% · '+this.stations.anchorHands+' hands'):(this.stations.anchorDown?L('抛锚','DOWN'):L('起锚','UP')));
      label('rudder',`${Math.round(this.stations.rudder*100)}%`);
      label('sail',`${Math.round(this.stations.sailMain*100)}%`);
      label('power',({manual:'手动',weighing:'起锚',setting_sail:'调帆',tacking:'换舷',sailing:'领航',stopping:'减速',calm:'无风'})[this.navigationPhase]||'手动');
      label('water',`${Math.round(dmg.water*100)}%`);label('planks',String(this.inventory.count('plank')));
      const ammo=this.hud.querySelector('[data-v43-ammo]');if(ammo)ammo.textContent=`${this.inventory.count('cannonball')} / ${this.inventory.count('chainshot')}`;
      const holes=this.hud.querySelector('[data-v43-holes]');if(holes)holes.textContent=String(dmg.holes.filter(h=>h.state==='open').length);
      const crew=this.hud.querySelector('[data-v43-crew]');if(crew)crew.textContent=[...this.crew.actors.values()].map(a=>`${a.id.slice(3)}:${a.job}`).join(' · ');
      const gun=id=>{const c=this.cannons[id];return c.phase==='LOADING'?`${L('装填','Loading')} ${c.loadRemaining.toFixed(1)}s`:c.phase==='RECOIL'?L('后坐复位','Recoil'):c.phase==='READY'?L('已装弹','Ready'):L('空膛 · R 装弹','Empty · R reload');};
      label('port',gun('cannon_port'));label('starboard',gun('cannon_starboard'));
      if(this.stations.anchorDown&&!player.stationId&&this.noticeTimer<=0&&!this.selected){
        this.text('prompt',L('船已抛锚：靠近原船中央绞盘按 E，占岗后按住 W 转动起锚；多人一起更快。',
          'Anchor down: E at the original capstan, hold W to turn; more sailors help.'));
      }
    }
    this.text('message',this.noticeTimer>0?this.notice:'');
    const lower=this.hud.querySelector('[data-v43-hold]');if(lower)lower.textContent=player.mode==='deck'?(player.deckLayer==='lowerHold'?L('【下层货舱】对准梯子，按住 W 上 / S 下','[Lower hold] face ladder, hold W up / S down'):player.deckLayer==='hold'?L('【船长室】沿入口阶梯步行返回甲板，E 开关门','[Captain cabin] walk up entrance steps; E opens/closes door'):L('【主甲板】对准梯子 W 上 / S 下；船长室 E 开门后步行进出','[Deck] face ladders W/S; E opens cabin door, walk through')):'';
    const gearName={hands:L('空手','Hands'),cutlass:L('短刀','Cutlass'),bucket:L('水桶','Bucket'),shovel:L('铁铲','Shovel'),lantern:L('提灯','Lantern'),spyglass:L('望远镜','Spyglass'),plank:L('修船木板','Plank')};
    const belt=this.hud.querySelector('[data-v42-tool]'),action=this.hud.querySelector('[data-v42-action]');
    if(belt)belt.textContent=this.cargo.heldBy.has(this.actorId)?L('正在搬运藏宝箱','Carrying treasure'):(this.app.landAdventure?.stance?({cutlass:'短刃',polearm:'长矛',rod:'潮钩钓竿'})[this.app.landAdventure.weaponId]:gearName[this.equipment.active]);
    if(action)action.textContent=this.equipment.active==='bucket'?(this.equipment.bucketFull?L('已装水 · 到船舷或火源左键泼出','Full · click at rail or fire'):L('空桶 · 舱底左键舀水','Empty · click at bilge')):
      this.equipment.active==='plank'?L(`个人木板 ${this.equipment.planks} · 修补 ${Math.round(this.equipment.repairProgress*100)}%`,`Planks ${this.equipment.planks} · Patch ${Math.round(this.equipment.repairProgress*100)}%`):'';
    const camHint=this.hud.querySelector('[data-v42-camera]');if(camHint){
      camHint.textContent=player.stationId?.startsWith('cannon_')&&!this.input.locked?L('鼠标未锁定：点击游戏画面后再移动鼠标瞄准','Mouse free: click the game canvas to capture aiming'):'';
    }
    const nav=this.hud.querySelector('[data-v42-navigation]');if(nav){
      const phase=this.voyage.phase;
      const goal=this.app.oceanChart?.getNavigationTarget?.()||(phase==='accepted'?STORMWAKE_M1.digSite:phase==='dug'?STORMWAKE_M1.mossLanding:phase==='stowed'?STORMWAKE_M1.returnPort:null);
      const source=['deck','boat'].includes(player.mode)?b.position:player.position;
      const meters=goal?Math.round(distance(source,goal)):0;
      const angle=goal?Math.atan2(goal.x-source.x,goal.z-source.z):0;
      const direction=((Math.round(angle*180/Math.PI/45)%8)+8)%8;
      const dirZh=['北','东北','东','东南','南','西南','西','西北'],dirEn=['N','NE','E','SE','S','SW','W','NW'];
      const pilot=({weighing:'船员正在起锚',setting_sail:'船员调帆',tacking:'逆风换舷',sailing:'自动领航',stopping:'收帆放锚，惯性减速',calm:'无风，等待风起'})[this.navigationPhase]||'手动航行';
      nav.textContent=goal?L(`${pilot} · 航向 ${dirZh[direction]} · 目标距离 ${meters}m`,`Voyage bearing ${dirEn[direction]} · ${meters} m to objective`):L('自由航行 · 告示板位于海风镇','Free sail · Gold Tide board at harbor');
    }
    const hazard=dmg.integrity<90||dmg.breach>.01||dmg.fire>.01||dmg.water>.18;
    this.hud.classList.toggle('sw-v39-danger',hazard);
    const rescue=this.hud.querySelector('[data-v40-rescue]');
    if(rescue)rescue.hidden=!dmg.isSinking() || this.net.connected;
  }
 }
}
