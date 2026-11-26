import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Group,Vector3} from '../src/engine/index.js';
import {HARBOUR,OFFSHORE_SITES,weatherAt,vortexCenter,vortexForceAt,safeFromHarbour} from '../src/offshore/OffshoreField.js';
import {GhostFleet} from '../src/offshore/GhostFleet.js';
import {VortexVisuals} from '../src/offshore/VortexVisuals.js';
import {StormRain} from '../src/offshore/StormRain.js';
import {Cargo} from '../src/voyage/Cargo.js';
import {OCEAN_ZONES,OCEAN_CHART_BOUNDS,zoneAt,chartPoint} from '../src/islandlife/OceanZones.js';
import {BoatModel} from '../src/world/BoatModel.js';
import {BoatController} from '../src/player/BoatController.js';
import {TerrainData} from '../src/world/TerrainData.js';
let count=0;
function run(name,fn){fn();console.log(`PASS V44 ${++count}: ${name}`);}
run('Port is calm and major hazards are located well offshore, not near island',()=>{
 const w=weatherAt(HARBOUR.x,HARBOUR.z,99);assert.equal(w.danger,0);assert.equal(w.rain,0);assert.equal(w.seaState,0);
 for(const site of OFFSHORE_SITES.filter(v=>v.level>=4))assert.ok(safeFromHarbour(site.x,site.z,850),site.id);
 for(const [id,site] of [['outer_storm',OFFSHORE_SITES[1]],['ghost_fleet',OFFSHORE_SITES[2]],['maelstrom',OFFSHORE_SITES[3]]]){
  const zone=OCEAN_ZONES.find(z=>z.id===id);assert.ok(zone);assert.equal(zone.x,site.x);assert.equal(zone.z,site.z);
  const pos=chartPoint(zone.x,zone.z);assert.ok(pos.x>0&&pos.x<1);assert.ok(pos.y>0&&pos.y<1);
  assert.equal(zoneAt(zone.x,zone.z)?.id,id);
 }
 assert.ok(OCEAN_CHART_BOUNDS.maxZ>=3570);
});
run('Remote spatial weather is deterministic, bounded and changes with time',()=>{
 const a=weatherAt(-800,2250,100),b=weatherAt(-800,2250,100),later=weatherAt(-800,2250,200);
 assert.deepEqual(a,b);assert.ok(a.danger>.65&&a.rain>.5);assert.ok(later.windSpeed!==a.windSpeed);
 assert.ok(weatherAt(-500,3570,100).seaState===5);
 for(let t=0;t<300;t+=19)for(let x=-2000;x<1300;x+=311){const w=weatherAt(x,2500,t);
  assert.ok(w.rain>=0&&w.rain<=1);assert.ok(w.cloud>=0&&w.cloud<=1);
  assert.ok(w.windSpeed>=0&&w.windSpeed<=35);assert.ok(w.visibility>0);
 }
 assert.throws(()=>weatherAt(Infinity,10,0),TypeError);
});
run('Weather has continuous boundary transitions, not sudden jumps near a storm edge',()=>{
 for(let z=1100;z<3900;z+=23){const a=weatherAt(-800,z,230),b=weatherAt(-800,z+.05,230);
  assert.ok(Math.abs(a.danger-b.danger)<.004);
 }
});
run('Vortex force is physically finite, inward + rotational, damped and localized',()=>{
 const c=vortexCenter(100);const f=vortexForceAt(c.x+150,c.z,0,0,100);
 assert.ok(f.intensity>.6&&f.ax<-.1&&f.az>.1);
 assert.ok(f.r>100);
 assert.equal(vortexForceAt(HARBOUR.x,HARBOUR.z,0,0,100).intensity,0);
 assert.equal(vortexForceAt(c.x+600,c.z,0,0,100).intensity,0);
 for(const [x,z] of [[c.x,c.z],[c.x+.001,c.z+.001],[c.x+550,c.z],[c.x+220,c.z+220]]){
  const v=vortexForceAt(x,z,100,-90,100);assert.ok(Number.isFinite(v.ax)&&Number.isFinite(v.az));assert.ok(Math.hypot(v.ax,v.az)<=1.800001);
 }
 assert.notDeepEqual(c,vortexCenter(300));
});
run('Ghost fleet includes ten damageable armed spectral ships with a real damage state',()=>{
 const scene=new Group(),fleet=new GhostFleet(scene);
 assert.equal(fleet.ships.length,10);assert.equal(fleet.ships.filter(s=>s.controller).length,10);
 for(const ship of fleet.ships){assert.ok(safeFromHarbour(ship.x,ship.z,850));assert.ok(ship.model.children[0].material.transparent);assert.equal(ship.model.children[0].castShadow,false);}
 const boat={position:{x:-600,z:2450},velocity:{x:0,z:0},getYaw:()=>0};
 fleet.update(.05,boat);
 assert.ok(fleet.ships.filter(s=>s.model.visible).length>=8);
 assert.ok(fleet.ships.filter(s=>s.controller&&s.controller.distance<580).length>=4);
 const s=fleet.ships[1],old=s.hp;
 assert.equal(fleet.hit(s.id,22,'chainshot'),true);assert.equal(s.hp,old-22);assert.ok(s.controller.rigDamage>0);
 const seg=fleet.findHitSegment(s.x-10,s.z,s.x+10,s.z);
 assert.ok(seg?.ship?.id);
 assert.equal(fleet.hit(s.id,150),true);assert.equal(s.down,true);
 assert.equal(fleet.liveCount,9);
 assert.equal(fleet.hit(s.id,1),false);
});
run('Ghost ship fires a ballistic projectile when within a broadside firing arc',()=>{
 const scene=new Group(),fleet=new GhostFleet(scene),ship=fleet.ships[0];
 const b={position:{x:ship.x+37,z:ship.z},velocity:{x:0,z:0},getYaw:()=>0};
 ship.controller.yaw=0;ship.controller.cooldown=0;
 const events=fleet.update(.001,b,{host:true});
 assert.ok(events.length>=1,'ghost gun did not fire under a valid broadside condition');
 assert.equal(events[0].type,'enemy_projectile');assert.equal(events[0].shipId,ship.id);
 assert.ok(Number.isFinite(events[0].launch.vx));
});
run('Ghost LOD does not simulate a distant full combat fleet at the harbor',()=>{
 const scene=new Group(),fleet=new GhostFleet(scene),p={position:{x:HARBOUR.x,z:HARBOUR.z},velocity:{x:0,z:0},getYaw:()=>0};
 const shots=fleet.update(.1,p);assert.equal(shots.length,0);
 assert.ok(fleet.ships.every(s=>s.model.visible===false));
});
run('Vortex visual follows the exact same moving center as vortex physical force',()=>{
 const scene=new Group(),v=new VortexVisuals(scene);
 const c=vortexCenter(180);v.update(180,{x:c.x+300,z:c.z});
 assert.equal(v.root.visible,true);assert.equal(v.root.position.x,c.x);assert.equal(v.root.position.z,c.z);
 assert.equal(v.root.children[0].material.transparent,true);
 v.update(180,{x:HARBOUR.x,z:HARBOUR.z});assert.equal(v.root.visible,false);
});
run('Rain mesh is invisible at harbor, visible in remote storm and GPU-animated in one draw',()=>{
 const scene=new Group(),rain=new StormRain(scene),camera={x:5,y:8,z:12};
 rain.update(weatherAt(HARBOUR.x,HARBOUR.z,20),camera);assert.equal(rain.root.visible,false);
 rain.update(weatherAt(-800,2250,100),camera);assert.equal(rain.root.visible,true);
 assert.equal(rain.root.position.x,5);assert.equal(rain.root.position.z,12);
 assert.equal(rain.root.children.length,1);
 assert.equal(rain.root.children[0].material.transparent,true);
 assert.ok(rain.material.uniforms.rainStrength.value>.5);
 assert.match(rain.material.vertex,/frame\.time/);
});
run('Ship-local chest location persists through stow, rejoin, retrieval, floor drop and stow',()=>{
 const cargo=new Cargo();const a='captain',b='crew',id='treasure:01',ship='myship';
 assert.equal(cargo.spawnChest(id,{x:4,y:0,z:12}),true);
 assert.equal(cargo.spawnChest(id,{x:4,y:0,z:12}),false);
 assert.equal(cargo.tryPick(a,id,{x:4,z:12}),true);
 assert.equal(cargo.tryStow(a,ship,{x:.3,y:-.47,z:-1.8}),true);
 assert.deepEqual(cargo.get(id).holdLocal,{x:.3,y:-.47,z:-1.8});
 assert.equal(cargo.listShipHold(ship).length,1);assert.equal(cargo.tryRetrieve(b,id,'wrongship'),false);
 const saved=JSON.parse(JSON.stringify(cargo.serialize()));
 const rejoined=new Cargo();rejoined.deserialize(saved);assert.equal(rejoined.listShipHold(ship).length,1);
 assert.equal(rejoined.tryRetrieve(b,id,ship),true);
 assert.equal(rejoined.tryRetrieve(a,id,ship),false);
 assert.equal(rejoined.listShipHold(ship).length,0);
 assert.equal(rejoined.tryDrop(b,{x:99,y:-.4,z:120},{x:.25,y:-.48,z:-1.6}),true);
 assert.equal(rejoined.get(id).onDeck,true);assert.equal(rejoined.tryPick(a,id,{x:99,z:120}),true);
 assert.equal(rejoined.tryStow(a,ship),true);assert.equal(rejoined.listShipHold(ship).length,1);
});
run('Offshore vortex applies to true boat integrator, not direct coordinate edits',()=>{
 const src=readFileSync(new URL('../src/player/BoatController.js',import.meta.url),'utf8');
 assert.match(src,/F\.x\s*\+=\s*m\s*\*\s*vtx\.ax/);
 assert.match(src,/F\.z\s*\+=\s*m\s*\*\s*vtx\.az/);
 assert.match(src,/this\.voyageEnabled\s*&&\s*!this\.voyageAnchor\s*&&\s*!this\.moored/);
 const model=new BoatModel(),boat=new BoatController({model,query:{allocate:()=>0},terrain:new TerrainData(7),colliders:null});
 assert.equal(boat.offshoreTime,0);assert.ok(boat.samples.length>0);
});
run('Weather HUD actually resolves the V44 weather field rather than obsolete V39',()=>{
 const src=readFileSync(new URL('../src/voyage/VoyageM1.js',import.meta.url),'utf8');
 assert.match(src,/data-v44-weather/);
 assert.match(src,/querySelector\(`\[data-v44-\$\{id\}\]`\)/);
});
console.log(`V44 phase-one checks passed: ${count}`);
