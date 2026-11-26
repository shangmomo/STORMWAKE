// GPU-less but scene-integrated regression: these are actual game classes,
// including the rigid-body integrator and named world terrain, not hardcoded
// assertions that merely search source text.
import assert from 'node:assert/strict';
import {BoatModel} from '../src/world/BoatModel.js';
import {BoatController} from '../src/player/BoatController.js';
import {Player} from '../src/player/Player.js';
import {Vector3,Quaternion} from '../src/engine/index.js';
import {TerrainData} from '../src/world/TerrainData.js';
import {ShipStations} from '../src/ship/ShipStations.js';
import {CrewAI} from '../src/ship/CrewAI.js';
import {VoyageM1} from '../src/voyage/VoyageM1.js';
import {STORMWAKE_M1} from '../src/voyage/VoyageWorld.js';
import {CoopHub} from '../server/coopHub.js';
let checks=0;
const check=(label,fn)=>{fn();console.log('PASS',label);checks++;};
// Staggered 60ms packets must not discard a 1-frame cannon / winch / bucket command.
check('network input one-shots are latched and each shot is consumed once',()=>{
 const s=new ShipStations();s.claim('cannon_port','pilot');
 s.setInput('cannon_port','pilot',{fire:true});s.setInput('cannon_port','pilot',{axis:0});
 assert.equal(s.update(.016).shots.length,1);assert.equal(s.update(.016).shots.length,0);
 s.cannon.cannon_port.cooldown=0;
 s.setInput('cannon_port','pilot',{reload:true});s.setInput('cannon_port','pilot',{axis:0});s.update(.016);
 assert.equal(s.cannon.cannon_port.loaded,true);
 assert.equal(s.inputs.get('pilot').reload,false);
 s.release('cannon_port','pilot');s.claim('anchor','pilot');s.setInput('anchor','pilot',{fire:true});s.setInput('anchor','pilot',{axis:0});
 assert.equal(s.update(.016).anchorDown,true);assert.equal(s.update(.016).anchorDown,true);
 s.release('anchor','pilot');s.claim('bucket','pilot');s.setInput('bucket','pilot',{bucket:true});s.setInput('bucket','pilot',{axis:0});
 assert.equal(s.inputs.get('pilot').bucket,true);
 s.release('bucket','pilot');s.claim('cannon_starboard','pilot');
 s.setInput('cannon_starboard','pilot',{fire:true});assert.equal(s.update(.016).shots.length,1);
 s.setInput('cannon_starboard','pilot',{reload:true});s.update(.1);
 assert.equal(s.cannon.cannon_starboard.reloadQueued,true,'reload should queue during cooldown');
 s.update(3.0);s.update(.016);
 assert.equal(s.cannon.cannon_starboard.loaded,true,'queued reload should become ready after cooldown');
});
// Form a deliberately GPU-free version of the actual VoyageM1, to call all
// interaction methods and persistent save transitions across 2 voyages.
const storage=new Map();globalThis.localStorage={getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,String(v));}};
function makeFakeRuntime(){
 const boat=new BoatModel();
 const input={enabled:true,keys:new Set(),pressed:new Set(),mouseDown:false,
  down(c){return this.keys.has(c)}, hit(c){return this.pressed.has(c)},
  consume(c){if(!this.pressed.has(c))return false;this.pressed.delete(c);return true},
  resetPhysicalState(){this.keys.clear();this.pressed.clear();this.mouseDown=false}};
 const b={model:boat,position:{x:69.8,y:0,z:36.5},velocity:{x:0,z:0},speed:0,
  voyageEnabled:false,voyageAnchor:false,voyageSails:{main:0,jib:0},
  voyageWind:{wind:{},evaluate(){return {alignment:1,thrust:5000}}},
  getYaw(){return 0},setInput(){},moored:true,driven:false};
 const player={mode:'walk',position:{x:STORMWAKE_M1.noticeBoard.x,y:0,z:STORMWAKE_M1.noticeBoard.z},stationId:null,carryingChest:false};
 const app={input,boat,boatCtl:b,scene:{add(){},remove(){}},terrainData:{heightAt:()=>0},player,hunt:{abyss:{active:false}}};
 const voyage=new VoyageM1(app);player.voyageM1=voyage;
 return {voyage,app,player,input,boatCtl:b};
}
function pressE(t){t.input.pressed.add('KeyE');t.voyage.update(.016);t.input.pressed.clear();}
function finishQuest(t){
 const {voyage:v,player:p,boatCtl:b,input}=t;
 p.mode='walk';p.position={x:STORMWAKE_M1.digSite.x,y:0,z:STORMWAKE_M1.digSite.z};
 input.keys.add('KeyE');for(let i=0;i<250;i++)v._runDig(.016);input.keys.clear();
 assert.equal(v.voyage.phase,'dug');assert.ok(v.cargo.get('chest_moss_01'));
 pressE(t);assert.equal(v.cargo.get('chest_moss_01').state,'held');
 p.mode='deck';b.position={x:-130,y:0,z:10};p.position={...v.shipWorld('carry')};pressE(t);
 assert.equal(v.voyage.phase,'stowed');
 b.position={x:69.8,y:0,z:36.5};p.mode='walk';p.position={x:56,y:0,z:-71};pressE(t);
 assert.equal(v.voyage.phase,'sold');assert.equal(v.cargo.items.size,0);
}
const t=makeFakeRuntime();
check('first entire quest through actual world interactions and payout',()=>{
 pressE(t);assert.equal(t.voyage.voyage.phase,'accepted');finishQuest(t);
 assert.equal(t.voyage.voyage.tideCoin,120);
});
check('second quest is playable and pays exactly once without resetting currency',()=>{
 t.player.position={x:STORMWAKE_M1.noticeBoard.x,y:0,z:STORMWAKE_M1.noticeBoard.z};pressE(t);
 assert.equal(t.voyage.voyage.phase,'accepted');assert.equal(t.voyage.dig.completed.size,0);
 finishQuest(t);assert.equal(t.voyage.voyage.tideCoin,240);
 pressE(t);assert.equal(t.voyage.voyage.tideCoin,240);
});
check('atomic voyage/cargo save matches final state',()=>{
 const snapshot=JSON.parse(storage.get('stormwake.m1.snapshot.v2'));
 assert.equal(snapshot.version,2);assert.equal(snapshot.voyage.phase,'sold');
 assert.equal(snapshot.voyage.tideCoin,240);assert.deepEqual(snapshot.cargo,[]);
});
check('save repair restores an interrupted treasure without duplicating reward',()=>{
 const source=JSON.parse(storage.get('stormwake.m1.snapshot.v2'));
 source.voyage.phase='dug';source.voyage.voyageId='voyage_gold_moss_01';source.cargo=[];
 storage.set('stormwake.m1.snapshot.v2',JSON.stringify(source));
 const restart=makeFakeRuntime().voyage;
 assert.equal(restart.voyage.phase,'dug');assert.equal(restart.cargo.get('chest_moss_01').state,'world');
 const clone={...source,voyage:{...source.voyage,phase:'stowed'}};
 storage.set('stormwake.m1.snapshot.v2',JSON.stringify(clone));
 const hold=makeFakeRuntime().voyage;
 assert.equal(hold.cargo.listShipHold('stormwake').length,1);
 storage.set('stormwake.m1.snapshot.v2',JSON.stringify({version:2,voyage:{...source.voyage,phase:'sold'},cargo:[]}));
});
check('solo sinking can recover at harbor without resetting earned currency',()=>{
 const runtime=makeFakeRuntime();const v=runtime.voyage;
 v.voyage.accept();v.voyage.tideCoin=240;v.voyage.digDone();
 v.cargo.spawnChest('chest_moss_01',{x:-176,y:0,z:-42});
 runtime.boatCtl.reset=function(){this.position={x:69.8,y:0,z:36.5};this.moored=true;};
 runtime.player.position.set=function(x,y,z){this.x=x;this.y=y;this.z=z;};
 v.damage.applyHit(120);
 assert.equal(v.damage.isSinking(),true);
 assert.equal(v.rescueSoloShip(),true);
 assert.equal(v.damage.isSinking(),false);
 assert.equal(v.voyage.phase,'offer');assert.equal(v.voyage.tideCoin,240);
 assert.equal(v.cargo.items.size,0);
 assert.ok(Math.abs(runtime.player.position.z+77)<1e-6);
 assert.equal(v.rescueSoloShip(),false,'cannot claim a second rescue when not sunk');
});
check('actual island terrain: notice board/broker on land, dig site above tide',()=>{
 const t=new TerrainData(7);
 for(const name of ['noticeBoard','broker','digSite']){const p=STORMWAKE_M1[name];assert.ok(t.heightAt(p.x,p.z)>1,name+' should be on walkable terrain');}
 assert.ok(t.heightAt(STORMWAKE_M1.mossLanding.x,STORMWAKE_M1.mossLanding.z)<0,'landing ship is offshore');
});
check('actual deck walking routes Shift+E to leave, plain E never abandons a station',()=>{
 const mesh=new BoatModel();const b={model:mesh,toWorld:(v,out)=>out.copy(v),getYaw:()=>0,quaternion:new Quaternion(),speed:0};
 const keys=new Set(),pressed=new Set();
 const input={down:c=>keys.has(c),hit:c=>pressed.has(c),consumeLook:()=>({x:0,y:0}),
  consume(c,owner){if(!pressed.has(c))return false;pressed.delete(c);assert.equal(owner,'voyage');return true;}};
 const p=new Player({camera:{position:new Vector3(),quaternion:new Quaternion()},input,
  terrain:{heightAt:()=>0},colliders:{groundHeightAt:()=>0},query:{allocate:()=>0,cpuValid:false},boat:b});
 p.boardBoat();p.voyageM1={wantsDeckStationAt:()=>true};
 p.deckPos.copy(mesh.exitPoints[3]);p.deckVel.set(0,0,0);
 p._ashore={ep:{x:p.deckPos.x,z:p.deckPos.z}};p._ashoreT=10;
 let exitCount=0;p.exitBoat=()=>{exitCount++;p.mode='walk';};
 pressed.add('KeyE');p.updateDeck(.016);assert.equal(exitCount,0,'E must not accidentally leave while using station');
 pressed.clear();keys.add('ShiftLeft');pressed.add('KeyE');p.updateDeck(.016);
 assert.equal(exitCount,1,'Shift+E must disembark at overlapping station/rail sites');
 assert.equal(p.prompt?.key,'Shift+E');
});
// A deterministic, real rigid-body stepping of the complete out-and-back route:
// flat still water replaces GPU wave readback, but terrain contacts and boat
// physics are taken from production modules.
check('real rigid-body sailing with AI completes both legs, no teleport',()=>{
 const boat=new BoatModel();
 const q={latency:.03,allocate:()=>0,version:0,resultTime:0,cpuValid:true,
  resultInputs:new Float32Array(boat.hullSamples.length*4),cpu:new Float32Array(boat.hullSamples.length*4),setPoint(){}};
 const terrain=new TerrainData(7),b=new BoatController({model:boat,query:q,terrain,colliders:null});
 const stations=new ShipStations(),crew=new CrewAI(stations);
 b.voyageEnabled=true;b.voyageWind.wind={x:-12,z:1};
 let phase='out',parkAt=0,arrived=false,returned=false;
 for(let i=0;i<60*195;i++){
  const dt=1/60;q.version++;q.resultTime+=dt;
  for(let j=0;j<b.samples.length;j++){
   const pt=b.toWorld(b.samples[j].p,new boat.group.position.constructor());
   q.resultInputs[j*4]=pt.x;q.resultInputs[j*4+1]=pt.z;q.cpu[j*4]=0;
  }
  if(phase==='park'&&i-parkAt>120)phase='home';
  const wp=phase==='out'?STORMWAKE_M1.mossLanding:phase==='home'?STORMWAKE_M1.returnPort:null;
  const d=wp?Math.hypot(wp.x-b.position.x,wp.z-b.position.z):0;
  if(phase==='out'&&d<18){phase='park';parkAt=i;arrived=true;}
  const wind=b.voyageWind.evaluate({heading:b.getYaw(),velocity:b.velocity,sailMain:stations.sailMain,sailJib:stations.sailJib});
  crew.update(dt,{boat:b,wind,waypoint:wp});stations.anchorDown=!wp||d<18;
  const state=stations.update(dt);b.voyageSails.main=state.sailMain;b.voyageSails.jib=state.sailJib;
  b.voyageAnchor=state.anchorDown;b.driven=!state.anchorDown;
  if(!state.anchorDown)b.moored=false;
  b.setInput(state.anchorDown?0:.35,state.rudder,dt);b.update(dt);
  assert.ok(b.isFinite(),'NaN / invalid physical pose at '+i);
  if(phase==='home'&&d<18){returned=true;break;}
 }
 assert.ok(arrived,'AI failed to reach treasure shore');assert.ok(returned,'AI failed to return to harbor');
});
console.log(`V40 PLAYFLOW: ${checks} deep checks passed (not a replacement for WebGPU image QA)`);
