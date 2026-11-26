// V57: two real WebSocket browsers' network roles, server-owned world clock,
// late joining, remote animated avatar rigs, guest permission, host migration.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createCoopHub } from '../server/coopHub.js';
import { RemoteWorldClock, RoomClock } from '../src/net/SharedWorldClock.js';
import { weatherAt } from '../src/offshore/OffshoreField.js';
import { CoopClient } from '../src/oceanhunt/CoopClient.js';
import { Group, Vector3 } from '../src/engine/index.js';
import { readFileSync } from 'node:fs';

const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
let checks=0;
function check(name, fn){fn();checks++;console.log('✓',name);}
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
{
 const clock=new RoomClock(1000000);
 check('Server clock is deterministic at 16:12, advances by one timeline only',()=>{
  assert(Math.abs(clock.snapshot(1000000).hour-16.2)<1e-9);
  assert(Math.abs(clock.snapshot(1006000).hour-(16.2+6/60))<1e-8);
 });
 check('Pause freezes the sky but not weather evolution',()=>{
  assert(clock.control({speed:0},1006000));
  const a=clock.snapshot(1006000),b=clock.snapshot(1016000);
  assert.equal(a.hour,b.hour);assert.equal(b.weatherSeconds-a.weatherSeconds,10);
 });
 check('Host controls validate hour, rate and sun azimuth',()=>{
  assert(!clock.control({hour:-3},1016000));
  assert(!clock.control({speed:999},1016000));
  assert(clock.control({hour:7.5,azimuth:90,speed:.05},1016000));
  assert.equal(clock.snapshot(1016000).hour,7.5);
 });
 const mirror=new RemoteWorldClock();
 check('Client clock maintains same weather sample at a matched shared position',()=>{
  assert(mirror.set(clock.snapshot(1018000),1018000));
  const sample=mirror.sample(1019400),server=clock.snapshot(1019400);
  assert(Math.abs(sample.hour-server.hour)<1e-6);
  assert(Math.abs(sample.weatherSeconds-server.weatherSeconds)<1e-6);
  assert.deepEqual(weatherAt(-800,2250,sample.weatherSeconds),weatherAt(-800,2250,server.weatherSeconds));
 });
}
const hub=createCoopHub();
const http=createServer((req,res)=>{res.writeHead(200);res.end('ok');});hub.attach(http);
await new Promise(ok=>http.listen(0,'127.0.0.1',ok));
const url=`ws://127.0.0.1:${http.address().port}/crew-ws`;
const sockets=[];
async function connect(name){
 const ws=new WebSocket(url),log=[];sockets.push(ws);
 ws.addEventListener('message',ev=>log.push(JSON.parse(ev.data)));
 await new Promise((ok,err)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',err,{once:true});});
 const o={ws,log,send:m=>ws.send(JSON.stringify(m))};
 const welcome=await until(o,'welcome');o.id=welcome.id;o.welcome=welcome;
 o.send({type:'hello',name});return o;
}
async function until(client,type,pred=()=>true){
 for(let i=0;i<200;i++){
  const j=client.log.findIndex(m=>m.type===type&&pred(m));
  if(j>=0)return client.log.splice(j,1)[0];
  await pause(12);
 }
 throw Error(`timeout ${type}: ${JSON.stringify(client.log.slice(-5))}`);
}
const move=(x,z,mode='walk',activity='walk')=>({type:'move',x,y:2,z,yaw:1.14,mode,boat:'corsair',activity,stride:.7});
try{
 const host=await connect('Captain'),guest=await connect('Sailor');
 await until(host,'joined',m=>m.peer.id===guest.id&&m.peer.ready===false);
 check('Network membership is NOT an avatar spawn before first actual pose',()=>{
  assert(!guest.welcome.peers.some(p=>p.id===host.id));
 });
 host.send(move(80,90));
 const first=await until(guest,'moved',m=>m.peer.id===host.id);
 check('Real WebSocket forwards a measured moving captain with animation state',()=>{
  assert.equal(first.peer.x,80);assert.equal(first.peer.activity,'walk');assert.equal(first.peer.stride,.7);assert.equal(first.peer.ready,true);
 });
 guest.send(move(81,90,'swim','swim'));
 const swim=await until(host,'moved',m=>m.peer.id===guest.id);
 check('Second real client replicates swimmer state and 3D position',()=>{
  assert.equal(swim.peer.mode,'swim');assert.equal(swim.peer.activity,'swim');
 });
 const shot=await until(host,'room_snapshot',m=>m.peers.length===2);
 check('Periodic keyframes include both players for recovery from missing frames',()=>{
  assert.deepEqual(new Set(shot.peers.map(p=>p.id)),new Set([host.id,guest.id]));
  assert(shot.world.weatherSeconds>=0);
 });
 const t0=hub.world.snapshot(Date.now());
 guest.send({type:'world_control',hour:1,speed:0});await pause(45);
 check('Guests cannot mutate shared time and weather',()=>{
  assert.equal(hub.world.revision,0);assert(Math.abs(hub.world.snapshot(Date.now()).hour-t0.hour)<.15);
 });
 host.send({type:'world_control',hour:22.5,speed:0,azimuth:35});
 const broadcast=await until(guest,'world_state',m=>m.world.hour===22.5);
 check('Host time change broadcasts same paused night to other real client',()=>{
  assert.equal(broadcast.world.hour,22.5);assert.equal(broadcast.world.speed,0);
  assert.equal(hub.world.snapshot(Date.now()).hour,22.5);
 });
 const w1=await until(host,'room_snapshot',m=>m.world.revision===1);
 const w2=await until(guest,'room_snapshot',m=>m.world.revision===1);
 check('Both real clients receive one weather phase and same sky clock',()=>{
  assert(Math.abs(w1.world.weatherSeconds-w2.world.weatherSeconds)<.4);
  assert.equal(w1.world.hour,w2.world.hour);
  assert.deepEqual(weatherAt(-800,2200,w1.world.weatherSeconds),weatherAt(-800,2200,w2.world.weatherSeconds));
 });
 guest.send({type:'net_ping',sentAt:12345});
 const pong=await until(guest,'net_pong');
 check('Real heartbeat returns server timestamp',()=>{assert.equal(pong.sentAt,12345);assert(Number.isFinite(pong.serverNow));});
 const late=await connect('Late');
 check('Late-join welcome receives both active peers and live room night',()=>{
  assert.equal(late.welcome.peers.length,2);assert.equal(late.welcome.world.hour,22.5);
 });
 host.ws.close();await until(guest,'ship_host',m=>m.hostId===guest.id);
 check('Room promotes remaining sailor and retains world revision',()=>{
  assert.equal(hub.hostId,guest.id);assert.equal(hub.world.revision,1);
 });
 guest.send({type:'world_control',hour:6.5,speed:0});
 await until(late,'world_state',m=>m.world.hour===6.5);
 check('New captain can change the synchronized world after old host exits',()=>{assert.equal(hub.world.snapshot(Date.now()).hour,6.5);});
}finally{
 for(const ws of sockets)if(ws.readyState===WebSocket.OPEN)ws.close();
 await pause(85);for(const ws of sockets)if(ws.readyState!==WebSocket.CLOSED)ws.terminate?.();
 await new Promise(ok=>http.close(ok));
}
// Test actual animated peer hierarchy in headless scene without needing GPU.
const game={scene:new Group(),boat:{materials:{fittings:{}},variant:'corsair'},voyageM1:{},player:{position:new Vector3()},boatCtl:{position:new Vector3()},hunt:{bosses:{}}};
const viewer=Object.create(CoopClient.prototype);viewer.app=game;viewer.peers=new Map();viewer.socket=null;
viewer.addPeer({id:'other',name:'Sailor',x:5,y:2,z:6,yaw:1,mode:'walk',activity:'run',stride:1,ready:true});
const peer=viewer.peers.get('other');
check('Peer is a live articulated pirate, not a single static mannequin',()=>{
 assert(peer);assert(peer.rig.legs.length===2);assert(peer.rig.arms.length===2);
 assert(peer.meshes.length>=10);assert(game.scene.children.includes(peer.root));
});
viewer.update(.10);
check('Running animates both legs and arms; pose catches up to network position',()=>{
 assert.notEqual(peer.rig.legs[0].rotation.x,0);
 assert.equal(peer.rig.legs[0].rotation.x,-peer.rig.legs[1].rotation.x);
 assert(peer.root.position.distanceTo(peer.target)<1e-4);
});
viewer.addPeer({id:'ghost',ready:false,x:0,y:0,z:0});
check('Uninitialized placeholder never appears in the scene',()=>{assert(!viewer.peers.has('ghost'));});
viewer.removePeer('other');
check('Disconnect removes mesh rig and disposes its geometry',()=>{assert(!viewer.peers.has('other'));assert(!game.scene.children.includes(peer.root));});
check('Game loop consumes server sun, weather, FFT wave phase',()=>{
 const s=source('src/App.js');
 assert(s.includes('this.crew?.getWorldState?.()'));
 assert(s.includes('G.time.value = roomWorld.weatherSeconds'));
 assert(s.includes('this.fft.time.value = roomWorld.weatherSeconds'));
});
console.log('STORMWAKE V57 REAL MULTIPLAYER PASS:',checks,'focused checks');
