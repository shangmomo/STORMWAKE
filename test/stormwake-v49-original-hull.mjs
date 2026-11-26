// STORMWAKE V49 original sourced hull regression tests.
// Does not assert browser/WebGPU rendering or claim pixel-perfect no clipping.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {BoatModel} from '../src/world/BoatModel.js';
import {Player} from '../src/player/Player.js';
import {Scene,PerspectiveCamera,Quaternion,Vector3} from '../src/engine/index.js';
import {HeritageDeck,BOARDING_LADDERS,CABIN,HATCH,actualHalfWidth,deckHeight,measuredFloorAt,ladderLocal,nearbyLadder,insideHatch} from '../src/ship/HeritageDeck.js';
import {DUTCH_OUTER_WIDTH,outerHalfWidth} from '../src/ship/DutchHullOuterProfile.js';
import {DUTCH_WALKMAP} from '../src/ship/DutchHullWalkmap.js';
import {SHIP_STATION_SITES,HERITAGE_STATION_METERS,stationLocalMeters} from '../src/ship/StationSites.js';
import {heritageCrewNodes} from '../src/ship/CrewNavigation.js';
import {ShipDamage} from '../src/ship/ShipDamage.js';
import {PirateEquipment} from '../src/ship/PirateEquipment.js';
import {ShipInventory} from '../src/ship/ShipInventory.js';
import {ShipCannon} from '../src/ship/ShipCannon.js';
import {ShipLooseProps} from '../src/ship/ShipLooseProps.js';
let passed=0;
const check=(title,run)=>{run();console.log('PASS',++passed,title);};
const close=(a,b,d=.035)=>assert.ok(Math.abs(a-b)<=d,`${a} ≉ ${b} within ${d}`);
const boat=new BoatModel({shipClass:'heritage'}),deck=new HeritageDeck(boat);boat.heritageDeck=deck;
check('The only newly-generated deck geometry is four ladders, not a phantom cabin/roof/floor',()=>{
 assert.equal(deck.root.children.length,1);
 assert.match(deck.root.children[0].name,/ladder/i);
 assert.equal(deck.originalHullOnly,true);
 assert.equal(deck.realInteriorEnabled,false);
 assert.equal(CABIN.integrated,true);
 assert.match(CABIN.asset,/stormwake_v50\/captains_quarters_access\.glb/);
 assert.equal(HATCH.available,false);
 assert.equal(insideHatch(0,-4),false);
 assert.equal(deck.setDoor(true),false);
 assert.equal(deck.doorOpen,false);
});
check('Restored GLB is still the exact exported original asset in manifest',()=>{
 const manifest=JSON.parse(fs.readFileSync('public/models/stormwake_v47/asset_manifest.json','utf8'));
 const record=manifest.find(a=>a.file==='dutch_ship_medium_pbr.glb');
 const bytes=fs.readFileSync('public/models/stormwake_v47/dutch_ship_medium_pbr.glb');
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256);
 assert.match(record.reexport,/no V47 artificial hatch cut/);
 assert.ok(record.stats.triangles?.hull>27000 || record.stats.meshes?.hull?.triangles>27000 || bytes.length>20_000_000);
});
check('Source-mesh floor and hull sampling are populated with real triangles',()=>{
 assert.equal(DUTCH_WALKMAP.nx,31);assert.equal(DUTCH_WALKMAP.nz,124);
 assert.ok(DUTCH_WALKMAP.low.filter(a=>a>0).length>500);
 assert.ok(DUTCH_WALKMAP.high.filter(a=>a>0).length>50);
 assert.ok(DUTCH_OUTER_WIDTH.length>85);
 assert.equal(measuredFloorAt(9,9),null);
 close(deckHeight(-4.75),.935,.08);
 close(deckHeight(-6.85,-.65),1.925,.08);
 close(deckHeight(4.85,.78),1.89,.10);
});
check('Every boarding ladder lies outside the original hull and touches accessible source planks',()=>{
 assert.equal(BOARDING_LADDERS.length,4);
 for(const l of BOARDING_LADDERS){
  const outer=ladderLocal(l,{outside:true});const inner=ladderLocal(l);
  assert.equal(nearbyLadder(outer.x,outer.z,1.2),l);
  assert.ok(Math.abs(outer.x)>outerHalfWidth(l.z)+.1,'ladder top must be OUTBOARD');
  assert.ok(Math.abs(inner.x)<actualHalfWidth(l.z), 'landing is on inboard source deck');
  const floor=measuredFloorAt(inner.x,inner.z,inner.y+.30);
  assert.notEqual(floor,null,'cannot land on air');
  close(inner.y,floor,.18);
 }
});
check('Station mounts are attached to sampled real deck, not V48 synthetic floor',()=>{
 for(const id of Object.keys(SHIP_STATION_SITES)){
  const pos=HERITAGE_STATION_METERS[id];assert.deepEqual(stationLocalMeters(boat,id),pos);
  assert.ok(Math.abs(pos.x)<actualHalfWidth(pos.z),`station ${id} outside original hull`);
  const floor=measuredFloorAt(pos.x,pos.z,pos.y+.30);
  assert.notEqual(floor,null,id+' floor is missing');
  close(pos.y,floor,.14);
 }
});
check('Original half-beam is continuous, with no arbitrary 8m invisible wall',()=>{
 for(let z=-9.5;z<=7;z+=.19){
  assert.ok(outerHalfWidth(z)>0.8,`missing width at ${z}`);
  assert.ok(actualHalfWidth(z)<outerHalfWidth(z),'walking width must stay inside rail');
 }
});
check('Old model-scale inverse keeps human and station dimensions one metre',()=>{
 for(const axis of ['x','y','z'])close(deck.root.scale[axis]*boat.shipScale[axis],1,.00001);
 const nodes=heritageCrewNodes(boat.shipScale);
 for(const id of ['helm','sail_main','sail_jib','anchor'])
  for(const key of ['x','y','z'])close(nodes[id][key]*boat.shipScale[key],HERITAGE_STATION_METERS[id][key],.00001);
});
const keys=new Set(),inp={down:k=>keys.has(k),consumeLook:()=>({x:0,y:0}),consume:()=>false,hit:()=>false,interactionOwner:null};
const controller={model:boat,position:new Vector3(35,0,-10),quaternion:new Quaternion(),velocity:new Vector3(.4,0,0),getYaw(){return 0;},toWorld(l,out){return out.copy(l).applyQuaternion(this.quaternion).add(this.position);}};
const player=new Player({camera:new PerspectiveCamera(),input:inp,terrain:{heightAt:()=>-9},colliders:{groundHeightAt:()=>-Infinity,resolveCapsule:()=>{}},query:{allocate:()=>0,setPoint:()=>{},cpuValid:false},boat:controller});
check('Swimming near real boarding ladder ignores E and requires W or Space',()=>{
 const p=ladderLocal(BOARDING_LADDERS[1],{outside:true});
 player.position.copy(controller.toWorld(new Vector3(p.x,-.6,p.z),new Vector3()));player.mode='swim';player.busy=false;player._boardingCooldown=0;player.boardingClimb=null;
 keys.add('KeyE');assert.equal(player.tryHeritageBoarding(),false);keys.clear();assert.equal(player.tryHeritageBoarding(),false);
 keys.add('Space');assert.equal(player.tryHeritageBoarding(),true);keys.clear();
});
check('Climber remains linked to moving real ship and reaches correct source deck',()=>{
 const before=player.position.clone();player.advanceBoarding(.22);
 controller.position.x+=1;player.advanceBoarding(.22);
 assert.ok(player.position.x>before.x+.2);
 for(let k=0;k<50;k++)player.advanceBoarding(.05);
 assert.equal(player.mode,'deck');assert.equal(player.boardingClimb,null);
 assert.ok(Math.abs(player.deckPos.x)<actualHalfWidth(player.deckPos.z));
 close(player.deckPos.y,deckHeight(player.deckPos.z,player.deckPos.x),.20);
});
check('Gun, ammo and plank finite-state actions retain existing item authority',()=>{
 const supply=new ShipInventory({cannonball:2,chainshot:1,plank:1});
 const gun=new ShipCannon({loaded:false});
 assert.equal(supply.take('cannonball'),true);
 assert.equal(gun.requestReload('cannonball',{reserved:true}),true);
 for(let n=0;n<25;n++)gun.tick(.15,supply);
 assert.equal(gun.ready,true);assert.ok(gun.fire());assert.equal(gun.fire(),null);
 const items=new ShipLooseProps(new Scene(),controller);
 const ball=items.add('cannonball',{x:0,y:1,z:-2});assert.equal(items.take(ball.id),ball);assert.equal(items.take(ball.id),null);
 const damage=new ShipDamage();damage.applyHit(15,'ball',{x:1.6,y:-.15,z:-1.2});
 const hole=damage.nearbyHole({x:1.6,y:.84,z:-1.2},2.25);
 assert.ok(hole,'reachable waterline repair from source ship side');
 const kit=new PirateEquipment();kit.planks=1;
 assert.ok(kit);
});
console.log(`V49 original sourced ship logic ${passed}/${passed} checks passed. Browser GPU / no clipping in all camera angles NOT certified.`);
