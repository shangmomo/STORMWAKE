import assert from 'node:assert/strict';
import {stormCells,weatherAt,vortexForceAt,HARBOUR,lightningAt} from '../src/offshore/OffshoreField.js';
import {anchorEyePose,ANCHOR_HAWSE as H} from '../src/ship/AnchorKinematics.js';
import {ShipAnchorTether} from '../src/ship/ShipAnchorTether.js';
import {Group,Quaternion,Vector3,Euler,Matrix4} from '../src/engine/index.js';
import {installAnchorRig} from '../src/ship/ShipAnchorRig.js';
import {GhostFleet} from '../src/offshore/GhostFleet.js';
const ship={x:0,y:0,z:0,yaw:0},hawseWorld={...H};
let pose=anchorEyePose({ship,hawseWorld,travel:0});assert.deepEqual(pose.eyeLocal,H);
pose=anchorEyePose({ship,hawseWorld,travel:1,tether:{depth:100,point:{x:0,z:0}}});assert.equal(pose.contact,false);assert.equal(pose.eyeLocal.y,H.y-34);
const tether=new ShipAnchorTether();tether.update({x:H.x,z:H.z,y:H.y-1.312,ground:-12,travel:1});
pose=anchorEyePose({ship,hawseWorld,travel:1,tether:tether.snapshot()});assert.equal(pose.contact,true);assert(Math.abs(pose.eyeWorld.y-(-12+1.312))<1e-7);
const q=new Quaternion().setFromEuler(new Euler(.2,.7,-.25));const tilted={x:20,y:2,z:90,yaw:.7,rotation:q};
const hawse=new Vector3(H.x,H.y,H.z).applyQuaternion(q).add(new Vector3(20,2,90));
pose=anchorEyePose({ship:tilted,hawseWorld:hawse,travel:.5});const world=new Vector3(pose.eyeLocal.x,pose.eyeLocal.y,pose.eyeLocal.z).applyQuaternion(q).add(new Vector3(20,2,90));assert(world.distanceTo(new Vector3(hawse.x,hawse.y-17,hawse.z))<1e-6);
const boat={group:new Group(),shipScale:{x:1,y:1,z:1},heritageArt:{},anchorContext:()=>({ship,hawseWorld,tether:tether.snapshot(),inverseRotation:new Quaternion()})};
const rig=installAnchorRig(boat,{root:new Group()});rig.update(.016,1);assert(rig.contact);assert(rig.chain.count>80);assert([...rig.chain.instanceMatrix.array].every(Number.isFinite));
const fleet=new GhostFleet(new Group());fleet.hit('v44_ghost_2',40);fleet.ships[2].controller.cooldown=1.24;const snapshot=fleet.snapshot();const remote=new GhostFleet(new Group());remote.applySnapshot(snapshot);assert.deepEqual(remote.snapshot(),snapshot);remote.hit('v44_ghost_2',1000);assert.equal(remote.liveCount,9);
for(const t of [0,20,135,2000]){const cells=stormCells(t);assert.equal(cells.length,3);assert.deepEqual(cells,stormCells(t));for(const c of cells){const f=vortexForceAt(c.x+50,c.z);assert(Number.isFinite(f.ax));const timed=vortexForceAt(c.x+20,c.z,0,0,t);assert(timed.intensity>.7);assert(Math.hypot(timed.ax,timed.az)<=1.80001);}}
assert(weatherAt(HARBOUR.x,HARBOUR.z,10).fog===0);assert(weatherAt(-600,2450,10).fog>.9);assert.equal(lightningAt(26.03).flash,1);assert.equal(lightningAt(26.6).flash,0);
console.log('V62 anchor depth/roll/chain, fleet handoff, three storm forces and fog/lightning PASS');

const {Cargo}=await import('../src/voyage/Cargo.js');const {VoyageDirector}=await import('../src/voyage/VoyageDirector.js');const {spawnSpectralSpoils,sellSpectralSpoils}=await import('../src/voyage/SpectralSpoils.js');
const cargo=new Cargo(),voyage=new VoyageDirector();const dead=remote.snapshot();assert.equal(spawnSpectralSpoils(cargo,dead,voyage.redeemedSpectral),1);assert.equal(spawnSpectralSpoils(cargo,dead,voyage.redeemedSpectral),0);
const loot=cargo.serialize()[0];assert(loot.floating);assert(cargo.tryPick('p',loot.id,{x:loot.x,y:0,z:loot.z}));assert(cargo.tryStow('p','stormwake'));
assert.deepEqual(sellSpectralSpoils(cargo,voyage),{count:1,reward:140});assert.equal(voyage.tideCoin,140);assert.equal(sellSpectralSpoils(cargo,voyage).count,0);assert.equal(spawnSpectralSpoils(cargo,dead,voyage.redeemedSpectral),0);
const restored=new VoyageDirector();restored.deserialize(voyage.serialize());restored.accept();assert.equal(spawnSpectralSpoils(cargo,dead,restored.redeemedSpectral),0,'accepting another voyage must not duplicate redeemed spoils');
const {readFileSync}=await import('node:fs');const {parseGLB}=await import('../src/engine/loaders/GLTF.js');
for(const name of ['kenney_cannon','kenney_barrel','kenney_cannon-ball']){const raw=readFileSync(new URL('../public/models/stormwake_v62/'+name+'.glb',import.meta.url));const gltf=parseGLB(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));assert(gltf.images.every(im=>im.bytes?.length>100));}
console.log('V62 physical spectral loot, repeat-safe delivery/save and embedded device textures PASS');

const {CoopHub}=await import('../server/coopHub.js');const hub=new CoopHub(),socket=()=>({write(){},end(){},destroyed:false});const captain=hub.join(socket()),guest=hub.join(socket());hub.handle(captain,{type:'hello'});hub.handle(guest,{type:'hello'});
const state={type:'ship_state_host',x:69.8,y:0,z:42,yaw:0,vx:0,vz:0,sailMain:0,sailJib:0,integrity:100,breach:0,fire:0,anchor:false,ghostFleet:dead,anchorTether:{state:'STOWED',chain:0,depth:12,tension:0,point:null}};
hub.handle(guest,{...state,seq:1});assert.equal(hub.shipState,null,'guest cannot publish fleet or anchor authority');
hub.handle(captain,{...state,seq:1,ghostFleet:[...dead.slice(0,9),dead[0]]});assert.equal(hub.shipState,null,'duplicate fleet IDs refused');
hub.handle(captain,{...state,seq:2,anchorTether:{...state.anchorTether,tension:NaN}});assert.equal(hub.shipState,null,'invalid nested anchor force refused');
hub.handle(captain,{...state,seq:3});assert.equal(hub.shipState.ghostFleet[2].hp,0);assert.equal(hub.cargo.items.size,1);
let seq=4;const loot2=hub.cargo.serialize()[0];Object.assign(captain,{mode:'swim',x:loot2.x,y:0,z:loot2.z});hub.handle(captain,{type:'cargo_event',verb:'pick',itemId:loot2.id,seq:seq++});assert.equal(hub.cargo.get(loot2.id).state,'held');
Object.assign(captain,{mode:'deck',deckLayer:'deck',x:69.8,y:.84,z:36.5});hub.handle(captain,{type:'cargo_event',verb:'stow',itemId:loot2.id,holdLocal:{x:0,y:.84,z:-5.5},holdLayer:'deck',seq:seq++});assert.equal(hub.cargo.get(loot2.id).state,'hold');assert.equal(hub.voyage.phase,'offer');
Object.assign(captain,{mode:'walk',x:56,y:1,z:-71});hub.handle(captain,{type:'voyage_event',verb:'sell_spectral',voyageId:'voyage_gold_moss_01',seq:seq++});assert.equal(hub.voyage.tideCoin,140);
hub.handle(captain,{...state,seq:seq++});assert.equal(hub.cargo.items.size,0,'replaying dead ship must not duplicate sold loot');
hub.handle(captain,{type:'voyage_event',verb:'sell_spectral',voyageId:'voyage_gold_moss_01',seq:seq++});assert.equal(hub.voyage.tideCoin,140);
console.log('V62 room authority: ghost/anchor validation, swimming salvage, actual hold reach, port delivery and duplicate prevention PASS');
