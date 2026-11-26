import assert from 'node:assert/strict';
import {CollisionWorld} from '../src/systems/CollisionWorld.js';
import {safeDoorAngle} from '../src/ship/DoorSweep.js';
import {beginShipClimb,advanceShipClimb} from '../src/ship/ShipLadder.js';
import {ShipNetBridge} from '../src/net/ShipNetBridge.js';
import {ShipStations} from '../src/ship/ShipStations.js';
import {InteractionDirector} from '../src/interact/InteractionDirector.js';
import {Vector3,Quaternion} from '../src/engine/index.js';
import {worldToShip} from '../src/voyage/CargoReach.js';
import {CoopHub} from '../server/coopHub.js';
import {stationLocalMeters} from '../src/ship/StationSites.js';
let count=0;
const test=(label,fn)=>{fn();count++;console.log('PASS V61 '+label);};
const wall=(x=0)=>[[[x,-2,-5],[x,5,5],[x,5,-5]],[[x,-2,-5],[x,-2,5],[x,5,5]]];
const capsule={radius:.3,height:1.75,step:.1};
test('continuous sweep stops a six metre movement at a zero-thickness wall',()=>{
 const w=new CollisionWorld(wall());
 const p=w.move({x:-3,y:0,z:0},{x:3,y:0,z:0},capsule);
 assert(p.x<-.3&&p.x>-.31);assert(p.contacts.length);
});
test('wall response preserves tangential motion and permits retreat',()=>{
 const w=new CollisionWorld(wall());
 const p=w.move({x:-3,y:0,z:0},{x:3,y:0,z:2},capsule);
 assert(p.x<-.3);assert(Math.abs(p.z-2)<.001);
 const away=w.move(p,{x:-2,y:0,z:2},capsule);assert.equal(away.x,-2);
});
test('two perpendicular walls stop corner tunnelling without snapping outside',()=>{
 const zWall=[[[-5,-2,0],[5,5,0],[-5,5,0]],[[-5,-2,0],[5,-2,0],[5,5,0]]];
 const p=new CollisionWorld([...wall(),...zWall]).move({x:-3,y:0,z:-3},{x:3,y:0,z:3},capsule);
 assert(p.x<-.3&&p.z<-.3);assert(Math.hypot(p.x+3,p.z+3)<4);
});
test('jumping capsule hits overhead triangles and walking floor remains support-owned',()=>{
 const horizontal=y=>[[[-5,y,-5],[5,y,5],[5,y,-5]],[[-5,y,-5],[-5,y,5],[5,y,5]]];
 const w=new CollisionWorld([...horizontal(2),...horizontal(0)]);
 assert.equal(w.ceilingAt(0,0,1),2);assert.equal(w.ceilingAt(10,0,1),null);
 const p=w.move({x:-1,y:0,z:0},{x:1,y:1,z:0},capsule);
 assert(p.y<.251);assert(p.x>.99);
 const ground=w.move({x:-1,y:0,z:0},{x:1,y:0,z:0},capsule);assert.equal(ground.x,1);
});
test('BVH gives the same physical result with distant geometry and ignores degenerates',()=>{
 const w=new CollisionWorld([...wall(),...wall(100),[[0,0,0],[0,0,0],[0,0,0]]]);
 assert.equal(w.stats.triangles,4);assert(w.occluded({x:-1,y:1,z:0},{x:1,y:1,z:0}));
 assert(!w.occluded({x:-2,y:1,z:0},{x:-1,y:1,z:0}));
 assert.throws(()=>w.move({x:NaN,y:0,z:0},{x:0,y:0,z:0},capsule));
});
test('original rotating door stops before sweeping into a sailor',()=>{
 const p={x:-.88,y:.86,z:-6.90};
 const result=safeDoorAngle(1.7,0,[p]);assert(result.blocked);assert(result.angle>0);
 assert.equal(safeDoorAngle(1.7,0,[]).angle,0);
 assert.equal(safeDoorAngle(1.7,0,[{...p,y:3}]).angle,0);
});
test('Esc reverses a ladder along the traversed path and restores the original layer',()=>{
 const p={mode:'deck',deckLayer:'deck',deckPos:new Vector3(0,1,0),deckVel:new Vector3()};
 const room={layer:'lowerHold',layout:{x:0,z:0,deckY:1,deckExit:{x:1,z:0}},nearEntrance:()=>true,floorAt:()=>-1,setHatchOpen(){},constrain(){}};
 assert(beginShipClimb(p,room,true));for(let i=0;i<4;i++)advanceShipClimb(p,.1,room);
 const before=p.deckPos.clone();p.shipClimb.reversing=true;advanceShipClimb(p,.05,room);
 assert(p.deckPos.distanceTo(before)<.2);for(let i=0;i<10;i++)advanceShipClimb(p,.1,room);
 assert.equal(p.shipClimb,null);assert.equal(p.deckLayer,'deck');assert(p.deckPos.distanceTo(new Vector3(0,1,0))<1e-6);
});
const bridge=()=>{
 const sent=[],stations=new ShipStations(),player={stationId:null};
 const runtime={stations,interact:new InteractionDirector(),toast(){},_faceStation(){},app:{player,crew:{connected:true,selfId:'self',send:m=>sent.push(m)}}};
 const net=new ShipNetBridge(runtime);net.hostId='other';return {net,runtime,player,sent};
};
test('unacknowledged claims time out, release, and ignore a late ACK',()=>{
 const {net,player,sent}=bridge();assert(net.claim('anchor'));assert.equal(player.stationId,null);assert.equal(player.pendingStation,'anchor');
 net.update(.6);assert(net.pendingClaim.waiting);net.update(1);assert.equal(player.pendingStation,null);
 assert(sent.some(m=>m.type==='station_release'));
 net.receive({type:'station_update',stationId:'anchor',actorId:'self'});assert.equal(player.stationId,null);
});
test('server claim ACK grants control; rejection clears the request',()=>{
 const {net,player}=bridge();net.claim('helm');net.receive({type:'station_rejected',stationId:'helm',reason:'occupied'});
 assert.equal(player.pendingStation,null);assert.equal(player.stationId,null);
 net.claim('anchor');net.receive({type:'station_update',stationId:'anchor',actorId:'self'});
 assert.equal(player.stationId,'anchor');assert.equal(player.pendingStation,null);
});
test('remote held axes stop after the heartbeat deadline',()=>{
 const {net,runtime}=bridge();net.hostId='self';runtime.stations.claim('anchor','remote');
 net.receive({type:'station_input',stationId:'anchor',actorId:'remote',axis:1,buttons:0});
 assert.equal(runtime.stations.inputs.get('remote').axis,1);
 // Keep host snapshot publishing out of this isolated input-expiry test.
 net.lastStateSent=10;net.update(.36);assert(!runtime.stations.inputs.has('remote'));
});
test('aimed equipment wins over a nearby high-priority rack, with bounded traces',()=>{
 const d=new InteractionDirector();let used='';d.beginFrame({view:{x:0,z:1}});
 d.add({id:'anchor',position:{x:1,y:0,z:0},priority:330,perform:()=>used='anchor'},{x:0,y:0,z:0});
 d.add({id:'spyglass',position:{x:0,y:0,z:1},priority:235,perform:()=>used='spyglass'},{x:0,y:0,z:0});
 assert.equal(d.select().id,'spyglass');assert(d.dispatch({consume:()=>true}));assert.equal(used,'spyglass');
 for(let i=0;i<200;i++)d.record({i});assert.equal(d.trace().history.length,80);
});
test('current capstan gains 2.5x with four sailors, cancels opposing hands and stops on release',()=>{
 const progress=n=>{const s=new ShipStations({cooperativeCapstan:true});for(let i=0;i<n;i++){
   const id=i?'anchor_'+(i+1):'anchor';s.claim(id,'p'+i);s.setInput(id,'p'+i,{axis:1});}
   s.update(.1);return {s,amount:1-s.anchorTravel};};
 const one=progress(1),four=progress(4);assert(Math.abs(four.amount/one.amount-2.5)<1e-8);
 const s=four.s;s.setInput('anchor','p0',{axis:-1});s.setInput('anchor_2','p1',{axis:-1});
 const old=s.anchorTravel;s.update(.1);assert.equal(s.anchorTravel,old);
 for(let i=0;i<4;i++)s.releaseActor('p'+i);s.update(.1);assert.equal(s.anchorTravel,old);
});
test('capstan seats rotate with the visible shared handholds',()=>{
 const model={shipScale:{x:1,y:1,z:1},heritageDeck:true,heritageArt:{capstan:{rotation:{y:Math.PI/2}}}};
 const p=stationLocalMeters(model,'anchor');assert(Math.abs(p.x)<1e-8);assert(Math.abs(p.z+4.87)<1e-8);
});
test('capstan mechanical limits stop the rotating grips even with a held key',()=>{
 const s=new ShipStations({cooperativeCapstan:true});s.claim('anchor','p');s.setInput('anchor','p',{axis:1});
 s.anchorTravel=.001;s.update(.1);const turns=s.anchorCrankTurns;assert.equal(s.anchorTravel,0);
 s.update(.1);assert.equal(s.anchorCrankTurns,turns);
 s.setInput('anchor','p',{axis:-1});s.anchorTravel=.999;s.update(.1);const down=s.anchorCrankTurns;
 s.update(.1);assert.equal(s.anchorCrankTurns,down);assert.equal(s.anchorTravel,1);
});
test('current room rejects a station claim from shore or through the cargo deck',()=>{
 const h=new CoopHub(),socket={write(){},end(){},destroyed:false},p=h.join(socket);
 h.shipState={x:70,y:0,z:38,yaw:0,anchorCrankTurns:0,shipClass:'heritage'};
 h.handleVoyage(p,{type:'station_claim',stationId:'helm',seq:1});assert.equal(h.stations.getOccupant('helm'),null);
 Object.assign(p,{mode:'deck',deckLayer:'lowerHold',x:70.82,y:.84,z:34.35});
 h.handleVoyage(p,{type:'station_claim',stationId:'anchor',seq:2});assert.equal(h.stations.getOccupant('anchor'),null);
 p.deckLayer='deck';h.handleVoyage(p,{type:'station_claim',stationId:'anchor',seq:3});assert.equal(h.stations.getOccupant('anchor'),p.id);
});
test('authoritative local reach includes heel and pitch, not only yaw',()=>{
 const rotation=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/12);
 const local=new Vector3(1,.84,-3.65),world=local.clone().applyQuaternion(rotation).add(new Vector3(70,2,38));
 const reconstructed=worldToShip({x:70,y:2,z:38,yaw:0,rotation},world);
 assert(new Vector3(reconstructed.x,reconstructed.y,reconstructed.z).distanceTo(local)<1e-8);
});
test('guests interpolate full ship attitude; host handoff restores angular and vertical velocity',()=>{
 const {net,runtime}=bridge();const q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.3);
 const b={position:new Vector3(),velocity:new Vector3(),angular:new Vector3(),quaternion:new Quaternion(),getYaw:()=>0,apply(){}};
 runtime.app.boatCtl=b;net.remoteShip={x:2,y:1,z:3,yaw:0,vx:1,vy:.5,vz:2,rotation:q,angular:{x:.1,y:.2,z:.3}};
 net.beforePhysics(.1);assert(b.quaternion.z>.03,'roll must survive guest interpolation');
 net.receive({type:'ship_host',hostId:'self'});
 assert(b.quaternion.angleTo(q)<1e-7);assert.equal(b.velocity.y,.5);assert.equal(b.angular.z,.3);
});
console.log(`V61 reliability: ${count} behavioural checks passed. GPU acceptance is separate.`);
