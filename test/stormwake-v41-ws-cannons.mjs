import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createCoopHub} from '../server/coopHub.js';
const hub=createCoopHub(),http=createServer((req,res)=>res.end('ok'));hub.attach(http);
const open=[];const delay=ms=>new Promise(r=>setTimeout(r,ms));
const until=async (fn)=>{for(let i=0;i<90;i++){let v=fn();if(v)return v;await delay(15);}throw Error('timeout on socket');};
const join=(url)=>new Promise((resolve,reject)=>{
 const ws=new WebSocket(url),inbox=[];open.push(ws);
 ws.addEventListener('open',()=>resolve({ws,inbox}));ws.addEventListener('error',reject);
 ws.addEventListener('message',ev=>{try{inbox.push(JSON.parse(ev.data));}catch{}});
});
try{
 await new Promise(done=>http.listen(0,'127.0.0.1',done));
 const url=`ws://127.0.0.1:${http.address().port}/crew-ws`;
 const host=await join(url),guest=await join(url);
 const hostID=(await until(()=>host.inbox.find(m=>m.type==='welcome'))).id;
 const guestID=(await until(()=>guest.inbox.find(m=>m.type==='welcome'))).id;
 host.ws.send(JSON.stringify({type:'hello',name:'host'}));guest.ws.send(JSON.stringify({type:'hello',name:'guest'}));
 await delay(65);let a=0,b=0;
 const h=(type,fields)=>host.ws.send(JSON.stringify({type,seq:++a,...fields}));
 const g=(type,fields)=>guest.ws.send(JSON.stringify({type,seq:++b,...fields}));
 h('station_claim',{stationId:'helm'});g('station_claim',{stationId:'cannon_port'});
 await until(()=>hub.stations.getOccupant('helm')===hostID&&hub.stations.getOccupant('cannon_port')===guestID);
 g('station_input',{stationId:'cannon_port',axis:0,throttleAxis:0,aimYaw:1.5,aimPitch:.2,buttons:1});
 const remote=await until(()=>host.inbox.find(m=>m.type==='station_input'&&m.stationId==='cannon_port'));
 assert.equal(remote.aimYaw,1.5);assert.equal(remote.aimPitch,.2);
 assert.equal(hub.stations.inputs.get(guestID).fire,true);
 g('cannon_fire_host',{x:70,y:1,z:36,vx:45,vy:2,vz:0});await delay(45);
 assert.equal(host.inbox.filter(m=>m.type==='cannon_fire').length,0,'guest cannot spoof firing visuals');
 const state={x:69.8,y:0,z:36.5,yaw:0,vx:0,vz:0,sailMain:.8,sailJib:.2,helmThrottle:.55,integrity:100,breach:0,fire:0,anchor:false};
 h('ship_state_host',state);
 await until(()=>guest.inbox.find(m=>m.type==='ship_state'&&m.helmThrottle===.55));
 h('cannon_fire_host',{x:70,y:1,z:36,vx:45,vy:3,vz:0});
 const proj=await until(()=>guest.inbox.find(m=>m.type==='cannon_fire'));
 assert.equal(proj.vx,45);
 console.log('V41 WebSocket PASS: remote gun aim, host-authoritative projectile, spoofing rejected, ship throttle synchronized');
}finally{for(const c of open)try{c.close()}catch{}await new Promise(resolve=>http.close(resolve));}
