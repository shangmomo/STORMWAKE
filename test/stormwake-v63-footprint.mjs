import assert from 'node:assert/strict';
import {CollisionWorld} from '../src/systems/CollisionWorld.js';
// A thin tread corner lies between the former eight radial foot probes.
const world=new CollisionWorld([{vertices:[[.237,1,.08],[.25,1,.082],[.238,1,.095]]}]);
assert.equal(world.floorAt(0,0,1.03,.8),null);
for(let i=0;i<8;i++){const a=i*Math.PI/4;assert.equal(world.floorAt(Math.cos(a)*.264,Math.sin(a)*.264,1.03,.8),null);}
assert.equal(world.footprintFloorAt(0,0,.264,1.03,.8),1,'actual circular sole retains support at the missed triangle corner');
assert.equal(world.footprintFloorAt(0,0,.2,1.03,.8),null,'cannot invent support outside the unchanged capsule radius');
assert.equal(world.footprintFloorAt(0,0,.264,.98,.8),null,'cannot climb above the permitted support height');
const wall=new CollisionWorld([{vertices:[[.2,0,-1],[.2,2,-1],[.2,2,1]]}]);assert.equal(wall.footprintFloorAt(0,0,.264,1.03,.8),null,'vertical walls cannot become foot support');
console.log('V63 exact capsule footprint: real tread corner missed by 8 spokes, unchanged radius/height bounds, no false support on walls or open space PASS');
