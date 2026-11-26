// V48 deterministic smoke tests for the real-scale ship and manual game loop.
// These test geometry, state and transforms; not physical real-GPU QA.
import assert from 'node:assert/strict';
import {BoatModel} from '../src/world/BoatModel.js';
import {Player} from '../src/player/Player.js';
import {Scene,PerspectiveCamera,Quaternion,Vector3} from '../src/engine/index.js';
import {HeritageDeck,BOARDING_LADDERS,CABIN,HATCH,actualHalfWidth,deckHeight,ladderLocal,nearbyLadder,railingEscape,cabinCollision} from '../src/ship/HeritageDeck.js';
import {SHIP_STATION_SITES,HERITAGE_STATION_METERS,stationLocalMeters,shipPoint} from '../src/ship/StationSites.js';
import {ShipInventory} from '../src/ship/ShipInventory.js';
import {ShipCannon} from '../src/ship/ShipCannon.js';
import {ShipLooseProps} from '../src/ship/ShipLooseProps.js';
import {PirateEquipment} from '../src/ship/PirateEquipment.js';
import {VoyageM1} from '../src/voyage/VoyageM1.js';
import {heritageCrewNodes} from '../src/ship/CrewNavigation.js';
let pass=0;
const check=(name,fn)=>{fn();console.log('PASS',++pass,name);};
const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`expected ${a} ≈ ${b}`);
const boat=new BoatModel({shipClass:'heritage'});
const deck=new HeritageDeck(boat);boat.heritageDeck=deck;
const ctl={model:boat,position:new Vector3(45,.08,-12),quaternion:new Quaternion(),velocity:new Vector3(.8,0,0),speed:2.2,
  getYaw(){return 0;},toWorld(local,out){return out.copy(local).applyQuaternion(this.quaternion).add(this.position);}};
check('CC0 22m boat hull has one exact metric deck root, no inflated props',()=>{
 assert.equal(deck.root.parent,boat.group);
 for(const k of ['x','y','z'])near(deck.root.scale[k]*boat.shipScale[k],1);
 assert.ok(deck.root.children.length>=2);
 assert.ok(boat.dimensions.length>20);
});
check('Human-size walkmesh width comes from Dutch hull profile, not old 8m rail',()=>{
 for(let z=-7.5;z<=7.5;z+=.5){const w=actualHalfWidth(z);assert.ok(w>=.9&&w<2.6,`bad width at ${z}: ${w}`);}
 near(deckHeight(0),.8575);near(deckHeight(-8),1.12);
});
check('Four port/starboard ladders have real, non-overlapping ship-local endpoints',()=>{
 assert.equal(BOARDING_LADDERS.length,4);
 for(const ladder of BOARDING_LADDERS){const outside=ladderLocal(ladder,{outside:true}),inside=ladderLocal(ladder);assert.equal(nearbyLadder(outside.x,outside.z,1),ladder);
  assert.ok(Math.abs(outside.x)>Math.abs(inside.x));near(inside.y,deckHeight(inside.z));}
});
check('Jumping over real bulwark allowed; walk into continuous solid rail blocked',()=>{
 const z=0,x=actualHalfWidth(z)-.05;
 assert.equal(railingEscape(x,z,deckHeight(z)),false);
 assert.equal(railingEscape(x,z,deckHeight(z)+.8),true);
 const l=BOARDING_LADDERS[0];assert.equal(railingEscape(l.side*(actualHalfWidth(l.z)-.04),l.z,deckHeight(l.z)),true);
});
check('Captains door toggles actual geometry state and does not allow closed-door crossing',()=>{
 const before=cabinCollision(0,CABIN.frontZ-.4,0,CABIN.frontZ+.4,.24,false);
 assert.ok(before.z>CABIN.frontZ);
 const opened=cabinCollision(0,CABIN.frontZ-.4,0,CABIN.frontZ+.4,.24,true);
 assert.ok(opened.z<CABIN.frontZ);
 deck.setDoor(true);assert.equal(deck.doorOpen,true);deck.setDoor(false);assert.equal(deck.doorOpen,false);
});
check('Captains cabin side-wall collision never teleports player INTO the room',()=>{
 const fromSide=cabinCollision(1.45,-7.7,2.1,-7.7,.24,true);
 assert.ok(fromSide.x>CABIN.halfX,'walking on outside must stay outside');
 const fromInside=cabinCollision(1.45,-7.7,0,-7.7,.24,true);
 assert.ok(fromInside.x<CABIN.halfX,'walking on inside must stay inside');
 const around=cabinCollision(2.1,-8.1,2.1,-8.2,.24,false);
 near(around.x,2.1);
});
check('Hatch is open geometry and inside captain cabin has separate chart and log',()=>{
 assert.ok(HATCH.halfX>1&&HATCH.halfZ>1);
 assert.ok(deck.objects.chart.z<CABIN.frontZ&&deck.objects.chart.z>CABIN.backZ);
 assert.ok(deck.objects.locker.z<CABIN.frontZ&&deck.objects.locker.z>CABIN.backZ);
});
check('All 9 work positions have one real-metre frame and stay inside measured lateral limits',()=>{
 for(const id of Object.keys(SHIP_STATION_SITES)){
  const p=stationLocalMeters(boat,id);assert.deepEqual(p,HERITAGE_STATION_METERS[id]);
  assert.ok(Math.abs(p.x)<actualHalfWidth(p.z),`${id} outside artist hull at ${p.z}`);
  near(p.y,deckHeight(p.z),.31);
  const world=shipPoint(ctl,id);near(world.x,ctl.position.x+p.x);near(world.z,ctl.position.z+p.z);
 }
});
check('Crew moves in native boat coordinates while character dimensions remain 1:1',()=>{
 const nodes=heritageCrewNodes(boat.shipScale);
 for(const id of ['helm','sail_main','sail_jib','anchor']){
  for(const k of ['x','y','z'])near(nodes[id][k]*boat.shipScale[k],HERITAGE_STATION_METERS[id][k]);
 }
});
const keys=new Set();
const inp={down(k){return keys.has(k);},consumeLook(){return {x:0,y:0};},consume(){return false;},hit(){return false;},interactionOwner:null};
const terrain={heightAt(){return -10;}};
const colliders={groundHeightAt(){return -Infinity;},resolveCapsule(){},boxes:[]};
const query={allocate(){return 0;},setPoint(){},cpuValid:false};
const p=new Player({camera:new PerspectiveCamera(),input:inp,terrain,colliders,query,boat:ctl});
check('Swimming under a real ladder never boards via E or proximity teleport',()=>{
 const l=BOARDING_LADDERS[1],foot=ladderLocal(l,{outside:true});
 p.position.copy(ctl.toWorld(new Vector3(foot.x,-.60,foot.z),new Vector3()));
 p.mode='swim';p.busy=false;p._boardingCooldown=0;p.boardingClimb=null;
 keys.clear();keys.add('KeyE');assert.equal(p.tryHeritageBoarding(),false);assert.equal(p.mode,'swim');
 keys.clear();assert.equal(p.tryHeritageBoarding(),false);
});
check('W/Space starts timed climb with moving ship as authority, preserving 3D start',()=>{
 keys.clear();keys.add('Space');assert.equal(p.tryHeritageBoarding(),true);assert.ok(p.boardingClimb);
 const initial=p.position.clone();p.advanceBoarding(.25);
 assert.equal(p.mode,'swim');assert.ok(p.position.distanceTo(initial)>.005);
 ctl.position.x+=1.25;p.advanceBoarding(.25);
 assert.ok(p.position.x>initial.x+.3,'climber follows moving hull');
 for(let i=0;i<50;i++)p.advanceBoarding(.05);
 assert.equal(p.mode,'deck');assert.equal(p.boardingClimb,null);
 assert.ok(Math.abs(p.deckPos.x)<actualHalfWidth(p.deckPos.z));
});
check('Jump overboard retains ship and player motion; 0.9s climb cooldown stops oscillation',()=>{
 p.deckVel.set(1.7,1.5,0);p.waterH=0;
 p.fallOverboard();assert.equal(p.mode,'walk');assert.ok(p.velocity.x>ctl.velocity.x);
 assert.ok(p._boardingCooldown>.5);assert.equal(p.tryHeritageBoarding(),false);
});
check('Real deck physics blocks a mast instead of phantom original 8m cabin walls',()=>{
  keys.clear();keys.add('KeyW');p.mode='deck';p.stationId=null;p.shipClimb=null;p.shipInterior=null;
  p._ashoreT=100;p.deckViewMode='first';p.deckYaw=0;
  p.deckPos.set(0,deckHeight(-1.80),-1.80);p.deckVel.set(0,0,0);p.deckGrounded=true;
  for(let i=0;i<35;i++)p.updateDeck(.05);
  assert.equal(p.mode,'deck');
  assert.ok(p.deckPos.z< -1.40,`mast penetration at ${p.deckPos.z}`);
});
check('Walking through an actual ladder cutout leaves deck mode naturally',()=>{
  keys.clear();keys.add('KeyW');p.mode='deck';p.shipInterior=null;p.stationId=null;
  const ladder=BOARDING_LADDERS[0],width=actualHalfWidth(ladder.z);
  p.deckPos.set(ladder.side*(width-.29),deckHeight(ladder.z),ladder.z);
  p.deckYaw=Math.PI/2;p.deckVel.set(0,0,0);p.deckGrounded=true;
  for(let i=0;i<32 && p.mode==='deck';i++)p.updateDeck(.05);
  assert.equal(p.mode,'walk','no invisible forcefield at cutout');
  assert.ok(p._boardingCooldown>0,'reentry cooldown enabled');
});
const scene=new Scene();const loose=new ShipLooseProps(scene,ctl);
check('Dropped supplies are unique physical entities attached to hull in 3D',()=>{
 const item=loose.add('cannonball',{x:1,y:1,z:2});assert.ok(item.id.startsWith('loose_'));
 near(item.group.position.x,ctl.position.x+1);near(item.group.position.z,ctl.position.z+2);
 ctl.position.z+=5;loose.update();near(item.group.position.z,ctl.position.z+2);
 assert.ok(scene.children.includes(item.group));assert.equal(loose.take(item.id),item);
 assert.equal(loose.take(item.id),null);assert.equal(loose.byId.size,0);
 assert.ok(!scene.children.includes(item.group));
});
check('Loading an actually carried cannonball consumes stock only once',()=>{
 const inv=new ShipInventory({cannonball:3,chainshot:1,plank:2});
 const gun=new ShipCannon({id:'port',loaded:false});
 assert.equal(inv.take('cannonball'),true);assert.equal(inv.count('cannonball'),2);
 assert.equal(gun.requestReload('cannonball',{reserved:true}),true);
 for(let i=0;i<24;i++)gun.tick(.15,inv);
 assert.equal(gun.phase,'READY');assert.equal(inv.count('cannonball'),2);
 assert.equal(gun.fire().ammoType,'cannonball');assert.equal(gun.fire(),null);
});
check('Empty cannon cannot fire until a chambered physical ball finishes 2.8s reload',()=>{
 const inv=new ShipInventory({cannonball:0,chainshot:0,plank:0});const gun=new ShipCannon({loaded:false});
 assert.equal(gun.fire(),null);assert.equal(gun.requestReload('cannonball'),true);
 for(let i=0;i<20;i++)gun.tick(.1,inv);
 assert.equal(gun.ready,false);
 for(let i=0;i<20;i++)gun.tick(.1,inv);
 assert.equal(gun.ready,false);assert.equal(gun.fire(),null);
});
check('Plank and cannonballs can be taken, dropped, re-taken without cloning stock',()=>{
 const v=Object.create(VoyageM1.prototype);
 const player={mode:'deck',deckLayer:'deck',deckPos:new Vector3(0,deckHeight(0),0)};
 v.app={boat,player};v.net={actorId:'test:sailor'};v.cargo={heldBy:new Map()};
 v.inventory=new ShipInventory({cannonball:2,chainshot:1,plank:1});
 v.equipment=new PirateEquipment();v.equipment.planks=0;v.heldAmmo=null;v.looseSupplies=loose;v.toast=()=>{};
 assert.equal(v.takeSupply('cannonball'),true);assert.equal(v.inventory.count('cannonball'),1);
 assert.equal(v.takeSupply('cannonball'),false);
 assert.equal(v.dropSupply('cannonball'),true);assert.equal(v.heldAmmo,null);
 assert.equal(loose.byId.size,1);const id=[...loose.byId.keys()][0];
 assert.equal(v.pickLooseSupply(id),true);assert.equal(v.heldAmmo,'cannonball');
 assert.equal(v.inventory.count('cannonball'),1);
 assert.equal(v.pickLooseSupply(id),false);assert.equal(loose.byId.size,0);
 assert.equal(v.takeSupply('plank'),true);assert.equal(v.equipment.planks,1);
 assert.equal(v.dropSupply('plank'),true);assert.equal(v.equipment.planks,0);
 const plankId=[...loose.byId.keys()][0];assert.equal(v.pickLooseSupply(plankId),true);
 assert.equal(v.equipment.planks,1);assert.equal(v.inventory.count('plank'),0);loose.clear();
});
console.log(`V48 real-ship deterministic checks: ${pass}/${pass} passed; browser GPU acceptance not included.`);
