// V42: actual system transitions, world attachment and protocol guards.
import assert from 'node:assert/strict';
import {ShipDamage} from '../src/ship/ShipDamage.js';
import {PirateEquipment,GEAR_KEYS} from '../src/ship/PirateEquipment.js';
import {voyageJournal} from '../src/voyage/VoyageJournal.js';
import {PirateHands} from '../src/ship/PirateHands.js';
import {ShipStations} from '../src/ship/ShipStations.js';
import {SailWind} from '../src/ship/SailWind.js';
import {Cargo} from '../src/voyage/Cargo.js';
import {VoyageM1} from '../src/voyage/VoyageM1.js';
import {BoatModel} from '../src/world/BoatModel.js';
import {BoatController} from '../src/player/BoatController.js';
import {TerrainData} from '../src/world/TerrainData.js';
import {Vector3,Quaternion} from '../src/engine/index.js';
import {CoopHub} from '../server/coopHub.js';
let passed=0;
const check=(label,fn)=>{fn();console.log('✓',label);passed++;};
check('Leak causes actual bilge water; empty bucket cannot extinguish fire',()=>{
 const d=new ShipDamage();const e=new PirateEquipment();e.equip('bucket');
 d.applyHit(40,'ball');d.applyHit(8,'fire');
 assert.equal(e.throwWater(d,{atFire:true}).ok,false);
 const fire=d.fire;d.update(8);assert.ok(d.water>0,'broken hull must accumulate water');
 assert.equal(d.fire<=fire,true);
 const amount=d.water;const r=e.scoop(d);assert.equal(r.ok,true);assert.ok(d.water<amount);
 const before=d.fire;assert.equal(e.throwWater(d,{}).ok,false);
 assert.equal(e.bucketFull,true,'throwing on deck should not empty the bucket');
 assert.equal(e.throwWater(d,{atFire:true}).ok,true);assert.ok(d.fire<before);
 assert.equal(e.bucketFull,false);
});
check('Repair requires uninterrupted 2.2 s hold and consumes one plank',()=>{
 const d=new ShipDamage();d.applyHit(35);const e=new PirateEquipment();e.equip('plank');
 const start=d.integrity;
 for(let i=0;i<9;i++)e.repair(.1,d,{nearHole:true,held:true});
 assert.equal(d.integrity,start);assert.ok(e.repairProgress>.3);
 e.repair(.1,d,{nearHole:false,held:false});assert.equal(e.repairProgress,0);
 for(let i=0;i<22;i++)e.repair(.1,d,{nearHole:true,held:true});
 assert.equal(e.planks,4);assert.ok(d.integrity>start);assert.equal(e.repairProgress,0);
 e.planks=0;assert.equal(e.repair(.5,d,{nearHole:true,held:true}).ok,false);
 assert.equal(e.restock(3),3);
});
check('Winch logical request is immediate but the chain actually takes seconds',()=>{
 const s=new ShipStations();s.anchorDown=true;s.update(.016);assert.equal(s.anchorTravel,1);
 s.claim('anchor','p1');s.setInput('anchor','p1',{fire:true});
 const first=s.update(.016);assert.equal(first.anchorDown,false);assert.equal(first.anchorHeld,true);
 for(let i=0;i<280;i++)s.update(1/60);
 assert.ok(s.anchorTravel<.05,'real chain must be hauled, not teleported');
 const second=s.update(1/60);assert.equal(second.anchorHeld,false);
 s.setInput('anchor','p1',{fire:true});s.update(.016);assert.equal(s.anchorDown,true);
 assert.ok(s.anchorTravel>0);
});
check('Sail sheet angle is independent of sail area and affects physical thrust',()=>{
 const s=new ShipStations();s.claim('sail_main','p1');const orig=s.sailMain;
 s.setInput('sail_main','p1',{axis:0,trimAxis:1});s.update(1);
 assert.ok(s.sailTrim>0);assert.equal(s.sailMain,orig);
 const wind=new SailWind({wind:{x:5,z:9}});
 const scenario={heading:0,velocity:{x:0,z:0},sailMain:1,sailJib:.7};
 const baseline=wind.evaluate({...scenario,sailTrim:0});
 const optimized=wind.evaluate({...scenario,sailTrim:baseline.idealTrim});
 const opposite=wind.evaluate({...scenario,sailTrim:-baseline.idealTrim});
 assert.ok(optimized.thrust>opposite.thrust);
});
check('Bucket may be filled from sea and is then visibly full until thrown',()=>{
 const e=new PirateEquipment(),d=new ShipDamage();e.equip('bucket');
 assert.equal(e.fillSea(),true);assert.equal(e.fillSea(),false);
 assert.equal(e.throwWater(d,{overboard:true}).ok,true);
 assert.equal(e.throwWater(d,{overboard:true}).ok,false);
});
check('Actual procedural models for each carried object and real camera-space poses construct',()=>{
 const scene={add(){}};const h=new PirateHands(scene);assert.ok(h.models.size>=10);
 const eq=new PirateEquipment();eq.equip('shovel');
 const camera={position:new Vector3(0,2,0),quaternion:new Quaternion()};
 const player={mode:'deck',stationId:null,deckVel:new Vector3()};
 h.update(.016,{player,camera,equipment:eq});assert.equal(h.root.visible,true);
 assert.equal(h.equipped,'shovel');
 h.update(.016,{player,camera,equipment:eq,carrying:true});assert.equal(h.equipped,'chest');
 h.update(.016,{player,camera,equipment:eq,thirdPerson:true});assert.equal(h.root.visible,false);
});
check('A cargo chest dropped on a moving deck follows local hull pose',()=>{
 const model=new BoatModel();const water={allocate(){return 0}};const boat=new BoatController({model,query:water,terrain:new TerrainData(7),colliders:null});
 const input={enabled:true,down(){return false},consume(){return false}};
 const player={mode:'deck',stationId:null,position:new Vector3(),deckPos:new Vector3(.4,.5,-1),carryingChest:true};
 const app={input,player,boatCtl:boat,boat:model,scene:{add(){},remove(){}},terrainData:{heightAt:()=>0}};
 const runtime=new VoyageM1(app);const cargo=runtime.cargo;
 assert.equal(cargo.spawnChest('box',{x:10,y:0,z:20}),true);
 cargo.tryPick('local','box');assert.equal(cargo.tryDrop('local',{x:10,y:0,z:20},{x:.4,y:.5,z:-1}),true);
 const a=runtime.cargoWorldPoint(cargo.get('box'));
 boat.position.x+=9;boat.position.z+=4;
 const b=runtime.cargoWorldPoint(cargo.get('box'));
 assert.ok(Math.abs(b.x-a.x-9)<1e-5);assert.ok(Math.abs(b.z-a.z-4)<1e-5);
});
check('Network rejects malicious tool command and overpowered station trim',()=>{
 let now=10000;const hub=new CoopHub({now:()=>now});const output=[];
 const socket={destroyed:false,write(b){output.push(b)},end(){}};
 const host=hub.join(socket);hub.handle(host,{type:'hello',name:'captain'});
 const guest=hub.join({...socket,write(){}});hub.handle(guest,{type:'hello',name:'sailor'});
 hub.handle(host,{type:'station_claim',seq:1,stationId:'sail_main'});
 hub.handle(host,{type:'station_input',seq:2,stationId:'sail_main',axis:0,trimAxis:40,buttons:0});
 assert.equal(hub.stations.inputs.has(host.id),false);
 hub.handle(host,{type:'ship_state_host',seq:3,x:0,y:0,z:0,yaw:0,vx:0,vz:0,sailMain:.5,sailJib:.5,integrity:80,breach:.2,fire:0,water:.5,anchorTravel:1,repairStock:7,anchor:true});
 assert.equal(hub.shipState.water,.5);
 guest.mode='deck';guest.x=0;guest.z=0;
 now+=1000;hub.handle(guest,{type:'ship_tool',seq:1,verb:'infinite_money'});
 assert.equal(guest.lastToolAction,undefined);
 hub.handle(guest,{type:'ship_tool',seq:2,verb:'bail'});
 assert.ok(guest.lastToolAction===now);
 now+=100;hub.handle(guest,{type:'ship_tool',seq:3,verb:'bail'});
 assert.ok(guest.lastToolAction!==now,'tool spam must be rejected');
});
check('Voyage journal phases are sourced from actual four-step mission state',()=>{
 for(const [phase,count] of Object.entries({offer:0,accepted:1,dug:2,stowed:3,sold:4})){
  const log=voyageJournal(phase);assert.equal(log.completed,count);
  assert.equal(log.steps.filter(s=>s.status==='done').length,count);
  assert.equal(log.steps.length,4);assert.equal(log.reward,120);
 }
 assert.equal(voyageJournal('accepted',true).steps[1].status,'active');
 assert.equal(GEAR_KEYS.Digit0,'hands');assert.equal('KeyX' in GEAR_KEYS,false,'X must remain for boat righting');
});
check('LAN server persists and reprojects deck-dropped cargo when boat sails',()=>{
 let now=20000;const hub=new CoopHub({now:()=>now});const socket={destroyed:false,write(){},end(){}};
 const host=hub.join(socket);hub.handle(host,{type:'hello',name:'captain'});
 const state={x:70,y:0,z:35,yaw:0,vx:0,vz:0,sailMain:.4,sailJib:.3,integrity:100,breach:0,fire:0,anchor:false};
 hub.handle(host,{type:'ship_state_host',seq:1,...state});host.x=70;host.z=35;host.y=1;host.mode='deck';
 assert.equal(hub.cargo.spawnChest('cargo_test',{x:70,y:1,z:35}),true);
 hub.handle(host,{type:'cargo_event',seq:2,verb:'pick',itemId:'cargo_test'});
 assert.equal(hub.cargo.get('cargo_test').state,'held');
 hub.handle(host,{type:'cargo_event',seq:3,verb:'drop',itemId:'cargo_test'});
 const dropped=hub.cargo.get('cargo_test');assert.equal(dropped.onDeck,true);assert.ok(dropped.deckLocal);
 hub.handle(host,{type:'ship_state_host',seq:4,...state,x:79,z:39});
 host.x=79;host.z=39;
 hub.handle(host,{type:'cargo_event',seq:5,verb:'pick',itemId:'cargo_test'});
 assert.equal(hub.cargo.get('cargo_test').state,'held');
});
console.log(`STORMWAKE V42: ${passed} independent system checks passed (GPU rendering still requires browser QA).`);
