// V60: exercise actual two-client RFC6455 messages for deck cargo transactions.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createCoopHub} from '../server/coopHub.js';
const hub=createCoopHub(), server=createServer((req,res)=>{res.writeHead(200);res.end('OK');});
hub.attach(server);
const sockets=[];
async function open(url){return await new Promise((resolve,reject)=>{
 const socket=new WebSocket(url),events=[];sockets.push(socket);
 socket.addEventListener('message',e=>{try{events.push(JSON.parse(e.data));}catch{}});
 socket.addEventListener('error',reject);socket.addEventListener('open',()=>resolve({socket,events,seq:0}));
});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message){for(let i=0;i<100;i++){const value=fn();if(value)return value;await sleep(12);}throw Error('v60 websocket timeout: '+message);}
const send=(p,type,fields={})=>p.socket.send(JSON.stringify({type,seq:++p.seq,...fields}));
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const path=`ws://127.0.0.1:${server.address().port}/crew-ws`;
 const captain=await open(path),crew=await open(path);
 const a=await until(()=>captain.events.find(e=>e.type==='welcome'),'captain welcome');
 const b=await until(()=>crew.events.find(e=>e.type==='welcome'),'crew welcome');
 send(captain,'hello',{name:'Captain'});send(crew,'hello',{name:'Crew'});
 // All players must publish an actual world pose before manipulating shared cargo.
 const at={x:70,y:1.03,z:32.5,yaw:0,mode:'deck',deckLayer:'deck',boat:'corsair'};
 send(captain,'move',at);send(crew,'move',at);
 await until(()=>hub.players.get(a.id)?.ready&&hub.players.get(b.id)?.ready,'player poses');
 send(captain,'ship_state_host',{x:70,y:0,z:38,yaw:0,vx:0,vz:0,sailMain:0,sailJib:0,integrity:100,breach:0,fire:0,anchor:true});
 await until(()=>hub.shipState?.x===70,'ship snapshot');
 hub.voyage.accept();hub.voyage.digDone();hub.cargo.spawnChest('ws_v60_chest',{x:70,y:1.03,z:32.5});
 send(captain,'cargo_event',{verb:'pick',itemId:'ws_v60_chest'});
 await until(()=>hub.cargo.get('ws_v60_chest')?.actorId===a.id,'captain pickup');
 send(crew,'cargo_event',{verb:'pick',itemId:'ws_v60_chest'});
 await sleep(35);assert.equal(hub.cargo.heldBy.size,1,'pickup is exclusive');
 send(captain,'cargo_event',{verb:'stow',itemId:'ws_v60_chest',holdLocal:{x:0,y:1.03,z:-5.5},holdLayer:'deck'});
 await until(()=>hub.cargo.get('ws_v60_chest')?.state==='hold','captain stow');
 const update=await until(()=>crew.events.find(e=>e.type==='cargo_update'&&e.items.some(i=>i.id==='ws_v60_chest'&&i.state==='hold')),'synced cargo update');
 assert.equal(update.items.find(i=>i.id==='ws_v60_chest').holdLayer,'deck');
 send(crew,'cargo_event',{verb:'retrieve',itemId:'ws_v60_chest'});
 await until(()=>hub.cargo.get('ws_v60_chest')?.actorId===b.id,'crew retrieve');
 send(crew,'cargo_event',{verb:'stow',itemId:'ws_v60_chest',holdLocal:{x:0,y:1.03,z:-5.5},holdLayer:'deck'});
 await until(()=>hub.cargo.get('ws_v60_chest')?.state==='hold','crew re-stow');
 assert.equal(hub.voyage.phase,'stowed');assert.equal(hub.cargo.listShipHold('stormwake').length,1);
 // Stolen teleport position is not enough: validate live local pose against the hold.
 await sleep(72);
 send(crew,'move',{...at,x:100,z:100});
 await until(()=>hub.players.get(b.id)?.x===100,'out-of-range player pose');
 send(crew,'cargo_event',{verb:'retrieve',itemId:'ws_v60_chest'});
 await until(()=>crew.events.some(e=>e.type==='cargo_rejected'),'rejection acknowledgement');
 assert.equal(hub.cargo.get('ws_v60_chest').state,'hold');
 console.log('V60 REAL WebSocket PASS: two clients, ship pose, exclusive cargo pickup, synced aft-deck stow, cross-user retrieval, duplicate guard, range rejection.');
}finally{
 for(const s of sockets)try{s.close();}catch{}
 await new Promise(resolve=>server.close(resolve));
}
