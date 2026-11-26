// Actual RFC6455 socket regression. Confirms cooperative helm+sail ownership and
// remote commands with the real hub, not only direct calls to a parser.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createCoopHub} from '../server/coopHub.js';

const hub=createCoopHub();
const server=createServer((req,res)=>{res.writeHead(200);res.end('up');});hub.attach(server);
const sockets=[];
function ws(url){return new Promise((resolve,reject)=>{
 const socket=new WebSocket(url);const messages=[];
 socket.addEventListener('message',event=>{try{messages.push(JSON.parse(event.data));}catch{}});
 socket.addEventListener('open',()=>resolve({socket,messages}));
 socket.addEventListener('error',reject);sockets.push(socket);
});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<80;i++){const value=fn();if(value)return value;await sleep(15);}throw Error(`Timed out waiting for ${label}`);}
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const endpoint=`ws://127.0.0.1:${server.address().port}/crew-ws`;
 const helm=await ws(endpoint),sail=await ws(endpoint);
 const w1=await until(()=>helm.messages.find(m=>m.type==='welcome'),'helm welcome');
 const w2=await until(()=>sail.messages.find(m=>m.type==='welcome'),'sail welcome');
 helm.socket.send(JSON.stringify({type:'hello',name:'Helmsman'}));
 sail.socket.send(JSON.stringify({type:'hello',name:'Sailor'}));
 await sleep(60);
 let seq1=0,seq2=0;
 const sendHelm=(type,rest)=>helm.socket.send(JSON.stringify({type,seq:++seq1,...rest}));
 const sendSail=(type,rest)=>sail.socket.send(JSON.stringify({type,seq:++seq2,...rest}));
 sendHelm('station_claim',{stationId:'helm'});
 sendSail('station_claim',{stationId:'sail_main'});
 await until(()=>hub.stations.getOccupant('helm')===w1.id&&hub.stations.getOccupant('sail_main')===w2.id,'station claims');
 assert.ok(helm.messages.some(m=>m.type==='station_update'&&m.stationId==='sail_main'&&m.actorId===w2.id));
 assert.ok(sail.messages.some(m=>m.type==='station_update'&&m.stationId==='helm'&&m.actorId===w1.id));
 sendHelm('station_input',{stationId:'helm',axis:.7,buttons:0});
 sendSail('station_input',{stationId:'sail_main',axis:1,buttons:0});
 await until(()=>hub.stations.inputs.has(w1.id)&&hub.stations.inputs.has(w2.id),'both station inputs');
 const incoming=await until(()=>helm.messages.find(m=>m.type==='station_input'&&m.stationId==='sail_main'&&m.actorId===w2.id),'sail input on helm host');
 assert.equal(incoming.axis,1);
 sendSail('station_claim',{stationId:'helm'});
 const rejection=await until(()=>sail.messages.find(m=>m.type==='station_rejected'&&m.stationId==='helm'),'conflicting claim rejected');
 assert.equal(rejection.reason,'occupied');
 const ship={x:69,y:0,z:37,yaw:.2,vx:1,vz:0,sailMain:.7,sailJib:.2,integrity:96,breach:0,fire:0,anchor:false};
 sendHelm('ship_state_host',ship);
 await until(()=>sail.messages.find(m=>m.type==='ship_state'&&m.x===69),'host ship state');
 sendSail('ship_state_host',{...ship,x:300});await sleep(30);
 assert.equal(hub.shipState.x,69);
 sendSail('station_release',{stationId:'sail_main'});
 await until(()=>!hub.stations.getOccupant('sail_main'),'station release');
 console.log('V39 real WebSocket PASS: two-player helm+sail, messages, conflict, host authority, release');
}finally{
 for(const sock of sockets)try{sock.close();}catch{}
 await new Promise(resolve=>server.close(resolve));
}
