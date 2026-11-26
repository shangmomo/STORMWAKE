import assert from 'node:assert/strict';
import {BoatModel} from '../src/world/BoatModel.js';
import {BoatController} from '../src/player/BoatController.js';
import {ShipInterior} from '../src/ship/ShipInterior.js';
import {ShipStorageSpace} from '../src/ship/ShipStorageSpace.js';
import {beginShipClimb,advanceShipClimb} from '../src/ship/ShipLadder.js';
import {shipPoint} from '../src/ship/StationSites.js';
import {Vector3} from '../src/engine/index.js';
import {Cargo} from '../src/voyage/Cargo.js';
import {ShipDamage} from '../src/ship/ShipDamage.js';
import {segmentHullHit} from '../src/ship/ShipHitGeometry.js';
import {Quaternion} from '../src/engine/index.js';
let count=0;
function check(name,test){test();count++;console.log('PASS',name);}
const old=new BoatModel(),heritage=new BoatModel({shipClass:'heritage'});
check('Preview heritage ship reaches 23m with 5.9m beam; legacy stays 8.2m',()=>{
 assert.ok(heritage.dimensions.length>23&&heritage.dimensions.length<24);
 assert.ok(heritage.dimensions.beam>5.8&&heritage.dimensions.beam<6.1);
 assert.ok(old.dimensions.length<9);assert.equal(old.shipScale,undefined);
 assert.equal(heritage.group.scale.z,2.85);
});
check('Model mass, waterplane and buoyancy samples share the same metric frame',()=>{
 const s=heritage.shipScale;const v=s.x*s.y*s.z;
 assert.ok(Math.abs(heritage.hydro.suggestedMass-old.hydro.suggestedMass*v)<.01);
 assert.ok(Math.abs(heritage.hullSamples[0].area/old.hullSamples[0].area-s.x*s.z)<1e-6);
 assert.ok(Math.abs(heritage.hullSamples[0].position.z/old.hullSamples[0].position.z-s.z)<1e-6);
 assert.ok(heritage.colliders.every((c,i)=>Math.abs(c.center.z-old.colliders[i].center.z*s.z)<1e-6));
 assert.equal(heritage.setVariant('brig'),false,'never swap geometry without hydro calibration');
});
check('A heritage helm interaction is placed over the scaled deck',()=>{
 const boat={model:heritage,position:{x:0,y:0,z:0},getYaw:()=>0,toWorld:(v)=>v};
 const p=shipPoint(boat,'helm');assert.ok(Math.abs(p.x+.60*2.05)<1e-6);
 assert.ok(Math.abs(p.y-.35*2.45)<1e-6);
});
const interior=new ShipInterior(heritage),storage=new ShipStorageSpace(interior);
check('Hold has usable standing height, length and beam in a 23m ship',()=>{
 const h=interior.layout;
 assert.ok(h.deckY-interior.floorAt(h.z)>1.8);
 assert.ok(h.halfW*2>3.1);
 assert.ok(h.z1-h.z0>16);
 assert.ok(interior.inside({x:0,z:0}));
 const p={x:100,z:100};interior.constrain(p);assert.ok(interior.inside(p));
});
check('Ladder transitions over physical time, blocks double action, and preserves position',()=>{
 const h=interior.layout;
 const player={mode:'deck',deckLayer:'deck',stationId:null,deckPos:new Vector3(0,h.deckY,h.z),deckVel:new Vector3(),deckGrounded:true};
 assert.equal(beginShipClimb(player,interior,true),true);
 assert.equal(beginShipClimb(player,interior,true),false);
 assert.equal(interior.hatchOpen,true);
 advanceShipClimb(player,.1,interior);assert.ok(player.deckPos.y<h.deckY);assert.equal(player.deckLayer,'deck');
 for(let i=0;i<15;i++)advanceShipClimb(player,.10,interior);
 assert.equal(player.deckLayer,'hold');assert.ok(Math.abs(player.deckPos.y-interior.floorAt(h.z))<.01);
 assert.equal(beginShipClimb(player,interior,false),true);
 for(let i=0;i<15;i++)advanceShipClimb(player,.10,interior);
 assert.equal(player.deckLayer,'deck');assert.equal(interior.hatchOpen,false);
});
check('Cargo is placed at physical local coordinates, with capacity and hatch kept clear',()=>{
 const cargo=new Cargo(),h=interior.layout;
 assert.equal(storage.validate({x:0,z:h.z},cargo.items.values()).reason,'hatch');
 const place=storage.nearestFree({x:.5,z:h.z+.25},cargo.items.values());assert.ok(place);
 assert.ok(interior.inside(place));
 assert.ok(cargo.spawnChest('a',{x:0,z:0}));assert.ok(cargo.tryPick('actor','a'));
 assert.ok(cargo.tryStow('actor','ship',place));
 assert.equal(storage.validate(place,cargo.items.values()).reason,'occupied');
 const b=storage.nearestFree(place,cargo.items.values());assert.ok(b);
 assert.ok(Math.hypot(place.x-b.x,place.z-b.z)>=storage.clearance*interior.scale.x);
 const copy=new Cargo();copy.deserialize(cargo.serialize());assert.deepEqual(copy.get('a').holdLocal,place);
 assert.ok(copy.tryRetrieve('actor','a','ship'));
 assert.ok(copy.tryDrop('actor',{x:0,y:0,z:0},place));assert.deepEqual(copy.get('a').deckLocal,place);
});
check('Legacy hull and legacy interior geometry remain available as fallback',()=>{
 const hold=new ShipInterior(old);
 assert.ok(hold.layout.deckY-hold.floorAt(hold.layout.z)<1.2);
 assert.ok(hold.inside({x:0,z:-1.4}));
});
check('Rigid body mass & initial buoyancy samples are finite in heritage preview',()=>{
 const boat=new BoatController({model:heritage,query:{allocate:()=>0},terrain:{heightAt:()=>-50},colliders:null});
 assert.ok(boat.mass>40000&&boat.mass<200000);
 assert.ok(boat.samples.length>10);
 assert.ok(boat.samples.every(s=>s.p.isVector3&&Number.isFinite(s.area)&&s.area>0));
 assert.ok(boat.inertia.x>0&&boat.inertia.y>0&&boat.inertia.z>0);
});
check('Projectile segment detects a hit at the scaled bow, not just the hull centre',()=>{
 const boat={position:new Vector3(0,0,0),quaternion:new Quaternion(),model:heritage};
 const tip=heritage.dimensions.length/2-1;
 const hit=segmentHullHit({x:8,y:0,z:tip},{x:0,y:0,z:tip},boat);
 assert.ok(hit&&Math.abs(hit.local.z-tip)<.0001&&Math.abs(hit.local.x)<heritage.dimensions.beam/2+.12);
 assert.equal(segmentHullHit({x:8,y:0,z:tip+100},{x:0,y:0,z:tip+100},boat),null);
});
check('Rotated ship hitbox respects yaw and rejects misses',()=>{
 const boat={position:new Vector3(20,0,-100),quaternion:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/2),model:heritage};
 const hit=segmentHullHit({x:28,y:0,z:-108},{x:28,y:0,z:-94},boat);
 assert.ok(hit);assert.ok(Number.isFinite(hit.t));
 assert.equal(segmentHullHit({x:55,y:0,z:-108},{x:55,y:0,z:-94},boat),null);
});
check('Large-hull damage accepts impact coordinates outside 8m boat limits',()=>{
 const d=new ShipDamage();d.hull.setShipScale(heritage.shipScale);
 assert.ok(d.applyHit(15,'ball',{x:2,y:-.4,z:9}));
 assert.ok(Math.abs(d.holes[0].local.z-9)<.001);
 assert.ok(d.patchHole(d.holes[0].id));assert.equal(d.holes[0].state,'sealed');
 const oldDamage=new ShipDamage();oldDamage.applyHit(10,'ball',{x:3,y:-.2,z:9});
 assert.ok(oldDamage.holes[0].local.z<=4.5);
});
console.log(`V44 phase2 geometry / cargo / ladder checks: ${count} passed; no WebGPU browser QA implied`);
