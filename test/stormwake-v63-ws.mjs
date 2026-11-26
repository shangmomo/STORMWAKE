import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createCoopHub} from '../server/coopHub.js';
const hub=createCoopHub(),server=createServer((req,res)=>res.end('OK')),peers=[];hub.attach(server);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<150;i++){const result=fn();if(result)return result;await sleep(15);}throw Error('V63 WebSocket timeout: '+label);}
const send=(p,type,fields={})=>p.socket.send(JSON.stringify({type,seq:++p.seq,...fields}));
async function open(){const socket=new WebSocket(`ws://127.0.0.1:${server.address().port}/crew-ws`),p={socket,seq:0,events:[]};peers.push(p);socket.onmessage=e=>p.events.push(JSON.parse(e.data));await until(()=>socket.readyState===1,'open');p.id=(await until(()=>p.events.find(e=>e.type==='welcome'),'welcome')).id;send(p,'hello',{name:'Quest QA'});return p;}
async function pose(p,fields){await sleep(75);send(p,'move',{x:62,y:1,z:-73,yaw:0,mode:'walk',boat:'corsair',deckLayer:'deck',...fields});await until(()=>hub.players.get(p.id)?.x===(fields.x??62),'pose');}
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const a=await open(),b=await open();
 send(a,'ship_state_host',{shipClass:'heritage',x:69.8,y:0,z:42,yaw:0,vx:0,vz:0,sailMain:0,sailJib:0,integrity:100,breach:0,fire:0,anchor:true});await until(()=>hub.shipState?.shipClass==='heritage','physical mother ship');
 await pose(b,{x:69.3,y:.55,z:33.9,mode:'deck',deckLayer:'hold'});send(b,'cartographer_action',{verb:'accept'});await until(()=>b.events.some(e=>e.type==='cartographer_state'&&e.state.phase==='accepted'),'crew accepts actual letter');await until(()=>a.events.some(e=>e.type==='cartographer_state'&&e.state.phase==='accepted'),'host receives letter');
 await pose(b,{x:56,z:-71});send(b,'merchant_action',{verb:'accept'});await until(()=>hub.merchant.phase==='rescue','merchant accepted');await until(()=>a.events.some(e=>e.type==='cargo_update'&&e.items.some(i=>i.origin==='rescue')),'rescue physical cargo');
 await pose(b,{x:62,z:-73});send(b,'beacon_action',{verb:'accept'});await until(()=>hub.beacon.phase==='route','beacon accepted');
 send(b,'beacon_action',{verb:'route_direct'});await sleep(80);assert.equal(hub.beacon.phase,'route','route cannot be chosen from shore');
 await pose(b,{x:69.3,y:.55,z:33.9,mode:'deck',deckLayer:'hold'});send(b,'beacon_action',{verb:'route_coast'});await until(()=>hub.beacon.phase==='sailing','real chart route');
 await pose(b,{x:45,z:-80});send(b,'ghost_lantern_action',{verb:'accept'});await until(()=>hub.ghostLantern.phase==='sighting','green lighthouse accepted');
 const c=await open(),welcome=c.events.find(e=>e.type==='welcome');assert.equal(welcome.cartographer.phase,'accepted');assert.equal(welcome.merchant.phase,'rescue');assert.equal(welcome.beacon.phase,'sailing');assert.equal(welcome.ghostLantern.phase,'sighting');assert.equal(welcome.deepEcho.phase,'locked');
 // Completed prerequisites are fixtures; the actual unlock and every vehicle
 // message below run through the room's real 10 Hz simulation and WebSockets.
 hub.cartographer.rewards=1;hub.merchant.delivered=1;hub.ghostLantern.delivered=1;await until(()=>hub.deepEcho.phase==='parts','shared deep unlock');
 await pose(b,{x:69.3,y:.55,z:33.9,mode:'deck',deckLayer:'hold'});send(b,'deep_echo_action',{verb:'take_part',part:0});await until(()=>hub.deepEcho.parts===1,'chart part');
 await pose(b,{x:56,z:-71});send(b,'deep_echo_action',{verb:'take_part',part:1});await until(()=>hub.deepEcho.parts===3,'merchant part');
 await pose(b,{x:45,z:-80});send(b,'deep_echo_action',{verb:'take_part',part:2});await until(()=>hub.deepEcho.parts===7,'lighthouse part');
 await pose(b,{x:62,z:-73});send(b,'deep_echo_action',{verb:'assemble'});await until(()=>hub.deepEcho.phase==='prepared','assemble');
 await until(()=>hub.deepEcho.sub.x>70,'actual towing');const sub=hub.deepEcho.sub;await pose(b,{x:sub.x,y:sub.y+1,z:sub.z,mode:'swim'});send(b,'deep_echo_action',{verb:'board'});await until(()=>hub.deepEcho.pilot===b.id,'guest is actual pilot');
 send(c,'deep_echo_action',{verb:'control',thrust:1,turn:1,ballast:-1});await sleep(80);assert.equal(hub.deepEcho.inputUntil,0,'outsider cannot operate submarine');
 await pose(b,{x:-3180,y:-352,z:4900,mode:'swim'});await until(()=>hub.players.get(b.id)?.y===-352,'deep crew pose below 250m');send(b,'nav_target',{id:'custom',x:-3180,z:4900});await until(()=>hub.navigationTarget?.x===-3180,'shared trench chart bounds');
 const d=await open(),late=d.events.find(e=>e.type==='welcome');assert.deepEqual(late.deepEcho.members,[b.id]);assert.equal(late.deepEcho.pilot,b.id);
 a.socket.close();await until(()=>hub.hostId===b.id,'host handoff');assert.equal(hub.deepEcho.pilot,b.id);assert.equal(hub.merchant.phase,'rescue');assert.equal(hub.beacon.phase,'sailing');assert.equal(hub.ghostLantern.phase,'sighting');
 console.log('V63 REAL four-client WebSockets: physical quest acceptance, cargo replication, cabin-only route, all five late-join snapshots, gated deep assembly, guest pilot authority, outsider rejection and host handoff PASS');
}finally{for(const p of peers)try{p.socket.close();}catch{}await new Promise(r=>server.close(r));}
