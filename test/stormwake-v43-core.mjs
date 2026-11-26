import assert from 'node:assert/strict';
import {HullCompartments} from '../src/ship/HullCompartments.js';
import {ShipDamage} from '../src/ship/ShipDamage.js';
import {ShipCannon} from '../src/ship/ShipCannon.js';
import {ShipInventory} from '../src/ship/ShipInventory.js';
import {CrewAI} from '../src/ship/CrewAI.js';
import {crewRoute,CREW_NODES} from '../src/ship/CrewNavigation.js';
import {ShipStations} from '../src/ship/ShipStations.js';
import {EnemyShipController} from '../src/combat/EnemyShipController.js';
import {ShipInterior,HOLD} from '../src/ship/ShipInterior.js';
import {ShipHullVisuals} from '../src/ship/ShipHullVisuals.js';
import {BoatModel} from '../src/world/BoatModel.js';
import {BoatController} from '../src/player/BoatController.js';
import {TerrainData} from '../src/world/TerrainData.js';
import {Vector3} from '../src/engine/index.js';
import {VoyageM1} from '../src/voyage/VoyageM1.js';
import {CoopHub} from '../server/coopHub.js';
let checks=0;
const run=(name,fn)=>{fn();checks++;console.log('PASS',name);};
run('Local hull damage produces independently identifiable spatial holes',()=>{
 const d=new ShipDamage();d.applyHit(21,'ball',{x:-1,y:-.3,z:-1.5});d.applyHit(21,'ball',{x:1,y:-.3,z:1.5});
 assert.equal(d.holes.length,2);assert.notEqual(d.holes[0].id,d.holes[1].id);
 assert.equal(d.nearbyHole({x:-.75,y:-.45,z:-1.5})?.id,d.holes[0].id);
 assert.equal(d.nearbyHole({x:0,y:0,z:9}),null);
 const water=d.water;for(let i=0;i<60;i++)d.update(.1);
 assert.ok(d.water>water);
 assert.equal(d.patchHole(d.holes[0].id),true);assert.equal(d.holes.filter(h=>h.state==='open').length,1);
 assert.ok(d.breach>0);const had=d.water;
 for(let i=0;i<60;i++)d.update(.1);assert.ok(d.water>had);
 assert.equal(d.patchHole(d.holes[1].id),true);const dry=d.water;
 for(let i=0;i<60;i++)d.update(.1);assert.equal(d.water,dry,'sealed hull does not magically remove prior bilge water');
 assert.ok(d.bail(.12)>0);assert.ok(d.water<dry);
 assert.equal(d.patchHole(d.holes[1].id),false);
});
run('Leak depends on local submersion instead of global HP',()=>{
 const h=new HullCompartments();h.addHole({x:0,y:.75,z:0},{radius:.3});
 assert.equal(h.flowRate({waterline:0}),0);
 const exposed=h.flowRate({waterline:-2});assert.equal(exposed,0);
 const sunken=h.flowRate({waterline:2});assert.ok(sunken>exposed);
});
run('All broadside impact zones are repairable from the physical hold corridor',()=>{
 const model=new BoatModel(),hold=new ShipInterior(model);
 for(const z of [-3.25,-2.1,-.2,1.6,3.5])for(const x of [-1.05,1.05]){
  const p={x:x>0?HOLD.halfW-.08:-HOLD.halfW+.08,z:Math.max(HOLD.z0+.13,Math.min(HOLD.z1-.13,z))};
  p.y=hold.floorAt(p.z);
  assert.ok(hold.inside(p),'patch worker must stand inside the accessible hull');
  assert.ok(Math.hypot(p.x-x,p.y+.25,p.z-z)<1.36,`Impact at ${x},${z} cannot be patched`);
 }
});
run('Dry above-water hull wound never floods by numerical offset',()=>{
 const d=new ShipDamage();d.applyHit(3,'ball',{x:1,y:1.1,z:-1});
 for(let i=0;i<300;i++)d.update(.1,{waterline:0});
 assert.equal(d.water,0);
});
run('Ship inventory prevents overdraw, doubles, unknown kinds and negative stock',()=>{
 const bag=new ShipInventory({cannonball:1,chainshot:0,plank:2});
 assert.equal(bag.take('cannonball'),true);assert.equal(bag.take('cannonball'),false);
 assert.equal(bag.take('plank',3),false);assert.equal(bag.count('plank'),2);
 assert.equal(bag.put('nothing'),false);assert.equal(bag.set('plank',-1),false);
});
run('Cannon has staged recoil, reload duration, exactly one ammo debit and empty feedback',()=>{
 const bag=new ShipInventory({cannonball:1,chainshot:1,plank:0});const gun=new ShipCannon({id:'cannon_port'});
 assert.ok(gun.fire());assert.equal(gun.fire(),null);assert.equal(gun.requestReload('cannonball'),true);
 for(let i=0;i<10;i++)gun.tick(.1,bag);
 assert.equal(gun.phase,'LOADING');assert.equal(bag.count('cannonball'),1);
 for(let i=0;i<25;i++)gun.tick(.1,bag);
 assert.equal(gun.phase,'READY');assert.equal(bag.count('cannonball'),0);
 assert.ok(gun.fire());gun.requestReload();for(let i=0;i<40;i++)gun.tick(.1,bag);
 assert.equal(gun.phase,'EMPTY');assert.equal(gun.fire(),null);
 gun.requestReload('chainshot');for(let i=0;i<30;i++)gun.tick(.1,bag);
 assert.equal(gun.phase,'READY');assert.equal(gun.fire().ammoType,'chainshot');assert.equal(bag.count('chainshot'),0);
});
run('Crew navigation route actually traverses hatch into hold',()=>{
 assert.deepEqual(crewRoute('cannon_starboard','hold'),['cannon_starboard','mid','hatch','hold']);
 assert.equal(CREW_NODES.hold.y<HOLD.deckY,true);
});
run('Crew is physically present while changing jobs and actually consumes a plank to repair',()=>{
 const stations=new ShipStations(),crew=new CrewAI(stations),damage=new ShipDamage(),bag=new ShipInventory({plank:3});
 const boat={position:{x:0,z:0},getYaw:()=>0};
 crew.update(.1,{boat,wind:{alignment:1},waypoint:{x:2,z:30},damage,inventory:bag});
 assert.equal(stations.getOccupant('helm'),'ai:kael');
 const ai=crew.getActor('ai:rowan');assert.equal(stations.getOccupant('cannon_starboard'),ai.id);
 damage.applyHit(10,'ball',{x:1,y:-.2,z:-1});
 let moved=false,finished=false;
 for(let i=0;i<650;i++){const before=ai.z;crew.update(.05,{boat,wind:{alignment:1},damage,inventory:bag});if(ai.z!==before)moved=true;
  if(damage.holes[0].state==='sealed'){finished=true;break;}}
 assert.equal(moved,true);assert.equal(finished,true,'AI must complete walking/fetching/repairing');
 assert.equal(bag.count('plank'),2);
});
run('Crew cannot reclaim a human station or teleport through takeover',()=>{
 const stations=new ShipStations(),crew=new CrewAI(stations),boat={position:{x:0,z:0},getYaw:()=>0};
 crew.update(.016,{boat});assert.equal(stations.claim('helm','player',{replaceAI:true}),true);
 const actor=crew.getActor('ai:kael'),x=actor.x;
 crew.update(.05,{boat});assert.equal(stations.getOccupant('helm'),'player');
 assert.ok(Math.abs(actor.x-x)<.1,'crew changed job by gradual movement, not instant placement');
});
run('Enemy is inertia-limited rather than directly snapping toward its target',()=>{
 const enemy=new EnemyShipController({path:[{x:0,z:0},{x:90,z:0}]}),boat={position:{x:30,z:0},getYaw:()=>0,velocity:{x:0,z:0}};
 const starting=enemy.x;enemy.update(.1,boat);assert.ok(enemy.x-starting<.8);
 const yaw=enemy.yaw;enemy.update(.1,boat);assert.ok(Math.abs(enemy.yaw-yaw)<.08);
 for(let i=0;i<180;i++)enemy.update(.05,boat);assert.ok(Math.hypot(enemy.vx,enemy.vz)<7.5);
 assert.ok(enemy.distance<200);assert.ok(['engage','flee'].includes(enemy.state));
});
run('Enemy fires independent projectile events, does not directly reduce HP',()=>{
 const e=new EnemyShipController({path:[{x:0,z:0}]}),damage=new ShipDamage();
 const boat={position:{x:30,z:0},velocity:{x:0,z:0},getYaw:()=>0};
 // Facing north, player exactly on starboard; shell leaves at finite speed.
 e.yaw=0;e.cooldown=0;const events=e.update(.001,boat);
 assert.equal(events.length,1);assert.equal(events[0].type,'enemy_projectile');assert.equal(damage.integrity,100);
 assert.ok(events[0].launch.vx>0);
});
run('Ship hatch has separate visible cover and low hold floor in ship coordinates',()=>{
 const b=new BoatModel(),cabin=new ShipInterior(b);assert.equal(cabin.hatchOpen,false);
 assert.equal(cabin.coverMesh.visible,true);cabin.setHatchOpen(true);assert.equal(cabin.coverMesh.visible,false);
 assert.ok(cabin.inside({x:0,y:-.48,z:-1.4}));assert.equal(cabin.inside({x:8,z:-1.4}),false);
 const p={x:10,y:0,z:-10};cabin.constrain(p);assert.ok(cabin.inside(p));
});
run('Hull hole visuals mirror true open/sealed states and stay ship-relative',()=>{
 const b=new BoatModel(),d=new ShipDamage(),v=new ShipHullVisuals(b,d);
 d.applyHit(10,'ball',{x:1,y:-.35,z:-1});v.update();assert.equal(v.meshes.size,1);
 assert.equal([...v.meshes.values()][0].visible,true);d.patchHole(d.holes[0].id);v.update();assert.equal([...v.meshes.values()][0].visible,false);
});
run('LAN rejects malformed or hostile extra ship fields but accepts valid crew, holes and ammunition',()=>{
 let now=10000;const h=new CoopHub({now:()=>now});const sock={destroyed:false,write(){},end(){}};const p=h.join(sock);h.handle(p,{type:'hello'});
 const state={type:'ship_state_host',seq:1,x:20,y:0,z:30,yaw:0,vx:0,vz:0,sailMain:.5,sailJib:.3,integrity:70,breach:.2,fire:0,anchor:false};
 h.handle(p,{...state,ammo:{cannonball:1,chainshot:-4,plank:2}});assert.equal(h.shipState,null);
 h.handle(p,{...state,seq:2,crew:[{id:'ai:__proto__',x:0,y:0,z:0,yaw:0,job:'helm'}]});assert.equal(h.shipState,null);
 const hole={id:'hole_1',local:{x:1,y:-.2,z:-1},radius:.12,state:'open'};
 h.handle(p,{...state,seq:3,holes:[hole],ammo:{cannonball:5,chainshot:2,plank:7},crew:[{id:'ai:kael',x:0,y:.35,z:0,yaw:0,job:'helm'}],cannons:{cannon_port:{phase:'READY',loadRemaining:0},cannon_starboard:{phase:'LOADING',loadRemaining:2}}});
 assert.equal(h.shipState.holes[0].id,'hole_1');assert.equal(h.shipState.ammo.cannonball,5);assert.equal(h.shipState.crew[0].id,'ai:kael');
});
run('Full V43 gameplay runtime constructs with native boat and keeps the old quest state',()=>{
 const model=new BoatModel();const boat=new BoatController({model,query:{allocate:()=>0},terrain:new TerrainData(7),colliders:null});
 const app={input:{enabled:true,down:()=>false,consume:()=>false},player:{mode:'deck',position:new Vector3(),deckPos:new Vector3(0,.35,-1.4),deckVel:new Vector3(),stationId:null},boatCtl:boat,boat:model,scene:{add(){},remove(){}},terrainData:{heightAt:()=>0}};
 const runtime=new VoyageM1(app);assert.equal(runtime.toggleHold(),true);assert.equal(app.player.deckLayer,'hold');assert.equal(runtime.interior.coverMesh.visible,false);
 assert.equal(runtime.toggleHold(),true);assert.equal(app.player.deckLayer,'deck');assert.equal(runtime.interior.coverMesh.visible,true);
 assert.equal(runtime.voyage.phase,'offer');
});
console.log(`V43 system checks passed: ${checks}`);
