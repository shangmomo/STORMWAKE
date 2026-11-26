// Runs the complete M1 single-player quest through the actual VoyageM1 frame
// update methods with real boat 3D objects, but a fake GPU-less renderer.
import assert from 'node:assert/strict';
import {BoatModel} from '../src/world/BoatModel.js';
import {VoyageM1} from '../src/voyage/VoyageM1.js';
import {STORMWAKE_M1} from '../src/voyage/VoyageWorld.js';
const boat=new BoatModel();
const input={enabled:true,keys:new Set(),pressed:new Set(),mouseDown:false,
 down(code){return this.keys.has(code);},hit(code){return this.pressed.has(code);},
 consume(code){if(!this.pressed.has(code))return false;this.pressed.delete(code);return true;},
 resetPhysicalState(){this.keys.clear();this.pressed.clear();this.mouseDown=false;}};
const b={model:boat,position:{x:69.8,y:0,z:36.5},velocity:{x:0,z:0},speed:0,
 voyageEnabled:false,voyageAnchor:false,voyageSails:{main:0,jib:0},
 voyageWind:{wind:{},evaluate(){return {alignment:1,thrust:4000};}},
 getYaw(){return 0;},setInput(throttle,steer){this.throttle=throttle;this.steer=steer;},moored:true,driven:false};
const p={mode:'walk',position:{x:STORMWAKE_M1.noticeBoard.x,y:0,z:STORMWAKE_M1.noticeBoard.z},carryingChest:false,stationId:null};
const app={input,boat,boatCtl:b,scene:{add(){},remove(){}},terrainData:{heightAt:()=>0},player:p,hunt:{abyss:{active:false}}};
const v=new VoyageM1(app);p.voyageM1=v;
const pressE=()=>{input.pressed.add('KeyE');v.update(.017);input.pressed.clear();};
pressE();assert.equal(v.voyage.phase,'accepted');
v.beforePhysics(.017);assert.equal(v.stations.anchorDown,true,'AI must wait for player boarding');
p.mode='deck';p.position={...v.shipWorld('sail_main')};v.beforePhysics(.017);
assert.equal(v.stations.anchorDown,false,'AI should raise anchor once owner has boarded');
pressE();assert.equal(p.stationId,'sail_main','player may claim sail from AI');
input.keys.add('KeyW');v._updateControls(.016);input.keys.clear();
v.beforePhysics(1);assert.ok(v.stations.sailMain>.3,'player sail input must affect real station state');
v.leaveStation();
p.mode='walk';p.position={x:STORMWAKE_M1.digSite.x,y:0,z:STORMWAKE_M1.digSite.z};
input.keys.add('KeyE');for(let i=0;i<250;i++)v._runDig(.016);input.keys.clear();
assert.equal(v.voyage.phase,'dug');assert.ok(v.cargo.get('chest_moss_01'));
pressE();assert.equal(v.cargo.get('chest_moss_01').state,'held');
p.mode='deck';b.position={x:STORMWAKE_M1.mossLanding.x,y:0,z:STORMWAKE_M1.mossLanding.z};p.position={...v.shipWorld('carry')};
pressE();assert.equal(v.voyage.phase,'stowed');
b.position={x:69.8,y:0,z:36.5};p.mode='walk';p.position={x:STORMWAKE_M1.broker.x,y:0,z:STORMWAKE_M1.broker.z};
pressE();assert.equal(v.voyage.phase,'sold');assert.equal(v.voyage.tideCoin,120);assert.equal(v.cargo.items.size,0);
pressE();assert.equal(v.voyage.tideCoin,120,'no duplicate payout');
console.log('V39 integrated offline M1 PASS: harbor accept → station → sail → dig → pick → stow → return/sell');
