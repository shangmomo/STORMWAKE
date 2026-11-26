import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createCoopHub} from '../server/coopHub.js';
import {deckHeight} from '../src/ship/HeritageDeck.js';
const hub=createCoopHub(),server=createServer((req,res)=>res.end('OK')),peers=[];hub.attach(server);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<150;i++){if(fn())return;await sleep(15);}throw Error(label);}
const send=(p,type,fields={})=>p.socket.send(JSON.stringify({type,seq:++p.seq,...fields}));
async function open(){const socket=new WebSocket(`ws://127.0.0.1:${server.address().port}/crew-ws`),p={socket,seq:0,events:[]};peers.push(p);socket.onmessage=e=>p.events.push(JSON.parse(e.data));await until(()=>p.events.find(e=>e.type==='welcome'),'welcome');p.id=p.events.find(e=>e.type==='welcome').id;send(p,'hello',{name:'Supply QA'});return p;}
async function pose(p,x,z){await sleep(80);send(p,'move',{x,y:deckHeight(z,x),z,yaw:0,mode:'deck',boat:'corsair',deckLayer:'deck'});await until(()=>hub.players.get(p.id).x===x,'pose');}
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const a=await open(),b=await open();
 send(a,'ship_state_host',{shipClass:'heritage',x:0,y:0,z:0,yaw:0,vx:0,vz:0,sailMain:0,sailJib:0,integrity:100,breach:0,fire:0,anchor:true,repairStock:123});await until(()=>hub.shipState,'host snapshot');assert.equal(hub.shipState.repairStock,123);
 await pose(b,-1.14,2.05);send(b,'supply_action',{verb:'take',kind:'cannonball'});await until(()=>hub.deckSupplies.hand(b.id).ammo==='cannonball','guest physical ammo');assert.equal(hub.supplies.stock.count('cannonball'),17);await until(()=>a.events.some(e=>e.type==='supply_stock'&&e.ammo.cannonball===17),'shared magazine');
 send(b,'supply_action',{verb:'drop',kind:'cannonball'});await until(()=>hub.deckSupplies.loose.size===1,'deck drop');const id=[...hub.deckSupplies.loose.keys()][0];await pose(a,-1.14,2.05);send(a,'supply_action',{verb:'pick',itemId:id});send(b,'supply_action',{verb:'pick',itemId:id});await until(()=>hub.deckSupplies.loose.size===0,'one pickup');assert.equal(hub.deckSupplies.hand(a.id).ammo,'cannonball');assert.equal(hub.deckSupplies.hand(b.id).ammo,null);
 await pose(a,1.35,1.30);send(a,'station_claim',{stationId:'cannon_port'});await until(()=>hub.stations.getOccupant('cannon_port')===a.id,'actual gun claim');send(a,'station_input',{stationId:'cannon_port',axis:0,buttons:2});await until(()=>b.events.some(e=>e.type==='cannon_load_request'),'load request');const req=b.events.find(e=>e.type==='cannon_load_request');send(b,'cannon_load_result',{requestId:req.requestId,accepted:true});await sleep(70);assert.equal(hub.deckSupplies.hand(a.id).ammo,'cannonball');send(a,'cannon_load_result',{requestId:req.requestId,accepted:true});await until(()=>hub.deckSupplies.hand(a.id).ammo===null,'host mechanical load confirmation');assert.equal(hub.supplies.stock.count('cannonball'),17);
 await pose(a,-1.28,-.95);await pose(b,-1.28,-.95);send(a,'supply_action',{verb:'take',kind:'bucket'});send(b,'supply_action',{verb:'take',kind:'bucket'});await until(()=>!hub.deckSupplies.bucketStock,'single bucket');assert.equal([...hub.deckSupplies.hands.values()].filter(h=>h.bucket).length,1);
 // Damage and pre-stowed cargo are fixtures; release and replication use the
 // actual validated host snapshot rather than a direct server helper call.
 for(const [id,x] of [['sink_a',1],['sink_b',-1]]){hub.cargo.spawnChest(id,{x:0,y:0,z:0});hub.cargo.tryPick('fixture',id);hub.cargo.tryStow('fixture','stormwake',{x,y:-.5,z:-3});}
 send(a,'ship_state_host',{shipClass:'heritage',x:0,y:-3,z:0,yaw:0,vx:0,vz:0,sailMain:0,sailJib:0,integrity:0,breach:1,fire:0,water:.98,anchor:true,floodCollapse:.7});await until(()=>hub.cargo.get('sink_a').floating,'canonical sinking cargo');assert.equal(hub.cargo.get('sink_a').x,1);assert.equal(hub.cargo.get('sink_b').x,-1);await until(()=>b.events.some(e=>e.type==='cargo_update'&&e.items.some(i=>i.id==='sink_a'&&i.floating)),'floating cargo replicated');
 const c=await open();const welcome=c.events.find(e=>e.type==='welcome');assert.equal(welcome.deckSupplies.bucketStock,false);assert.equal(welcome.shipState.floodCollapse,.7);assert.ok(welcome.cargo.find(i=>i.id==='sink_a').floating);a.socket.close();await until(()=>hub.hostId===b.id,'supply host handoff');assert.ok([...hub.deckSupplies.loose.values()].some(i=>i.kind==='bucket'),'departed sailor leaves actual bucket');
 console.log('V63 real WebSockets: guest finite ammunition, shared deck props, exclusive pickup, host-only load confirmation, unique bucket, late join and physical disconnect drop PASS');
}finally{for(const p of peers)try{p.socket.close();}catch{}await new Promise(r=>server.close(r));}
