import {VoyageM1} from '../src/voyage/VoyageM1.js';
import assert from 'node:assert/strict';
import {Vector3} from '../src/engine/index.js';
import {beginShipClimb,advanceShipClimb} from '../src/ship/ShipLadder.js';
import {walkCrew} from '../src/ship/CrewNavigation.js';
const keys=new Set(),p={mode:'deck',deckLayer:'deck',deckPos:new Vector3(0,1,0),deckVel:new Vector3(),input:{down:k=>keys.has(k)}},room={layout:{x:-.8,z:0,floorY:-.6,deckY:1,deckExit:{x:0,z:0}},layer:'lowerHold',nearEntrance:()=>true,setHatchOpen(){},floorAt:()=>-.6,constrain(){}};
assert.ok(beginShipClimb(p,room,true));p.shipClimb.manual=true;
for(let i=0;i<30;i++)advanceShipClimb(p,1/30,room);assert.equal(p.shipClimb.t,0,'standing near a ladder cannot move the player');
keys.add('KeyS');for(let i=0;i<10;i++)advanceShipClimb(p,1/30,room);keys.clear();const before=p.deckPos.clone(),time=p.shipClimb.t;
for(let i=0;i<30;i++)advanceShipClimb(p,1/30,room);assert.equal(p.shipClimb.t,time);assert.ok(p.deckPos.distanceTo(before)<1e-9,'release stops instead of finishing an automatic animation');
keys.add('KeyW');while(p.shipClimb)advanceShipClimb(p,1/30,room);keys.clear();assert.equal(p.deckLayer,'deck');assert.ok(p.deckPos.distanceTo(new Vector3(0,1,0))<1e-8);
const actor={x:0,y:0,z:0,metricScale:{x:2.05,y:2.45,z:2.85}};walkCrew(actor,{x:1,y:0,z:1},.1);const dx=actor.x*2.05,dz=actor.z*2.85;assert.ok(Math.abs(Math.hypot(dx,dz)-.175)<1e-8);assert.ok(Math.abs(Math.atan2(dx,dz)-actor.yaw)<1e-8,'face direction follows physical movement after the ship scale is cancelled');
console.log('V64 manual ladder: no proximity teleport, held S descent, release pause, held W reverse, same-world return; crew metre speed and facing under anisotropic ship scaling PASS');

for(const flag of ['shipClimb','mastClimb','boardingClimb']){const scope={app:{player:{mode:'deck',[flag]:{t:.4}}}};assert.deepEqual(VoyageM1.prototype.getNearbyCandidates.call(scope),[]);assert.equal(VoyageM1.prototype.takeStation.call(scope,'anchor'),false,'ladder input cannot attach the same player to a second station');}
