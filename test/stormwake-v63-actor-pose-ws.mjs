import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createCoopHub} from '../server/coopHub.js';
const hub=createCoopHub(),server=createServer((req,res)=>res.end('OK')),peers=[];hub.attach(server);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<150;i++){const result=fn();if(result)return result;await sleep(15);}throw Error('Actor pose timeout: '+label);}
async function open(){const socket=new WebSocket(`ws://127.0.0.1:${server.address().port}/crew-ws`),p={socket,seq:0,events:[]};peers.push(p);socket.onmessage=e=>p.events.push(JSON.parse(e.data));await until(()=>socket.readyState===1,'open');p.id=(await until(()=>p.events.find(e=>e.type==='welcome'),'welcome')).id;send(p,{type:'hello',name:'Sailor QA'});send(p,{type:'move',x:62,y:1,z:-73,yaw:0,mode:'walk',boat:'corsair'});await until(()=>hub.players.get(p.id).ready,'ready');return p;}
const send=(p,data)=>p.socket.send(JSON.stringify({seq:++p.seq,...data}));
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const a=await open(),b=await open(),player=hub.players.get(a.id),position=[player.x,player.y,player.z];
 await sleep(20);send(a,{type:'actor_pose',poseSeq:1,activity:'repair',gear:'plank',crouched:true,poseHeight:1.02,x:6000,y:-700,z:6000,stationId:'helm',supply:{ammo:'chainshot'}});
 const event=await until(()=>b.events.find(e=>e.type==='actor_pose'&&e.peer.id===a.id),'real peer pose');assert.equal(event.peer.activity,'repair');assert.equal(event.peer.poseHeight,1.02);assert.equal(event.peer.crouched,true);assert.equal(event.peer.gear,'plank');assert.deepEqual([player.x,player.y,player.z],position,'cosmetic pose cannot move player');assert.notEqual(event.peer.stationId,'helm','station remains canonical');assert.notEqual(event.peer.supply?.ammo,'chainshot','held ammunition remains canonical');
 await sleep(20);send(a,{type:'actor_pose',poseSeq:1,activity:'death'});await sleep(40);assert.equal(player.activity,'repair','stale pose sequence cannot overwrite activity');
 send(a,{type:'actor_pose',poseSeq:2,activity:'invented_pose'});await sleep(40);assert.equal(player.activity,'repair','unknown state rejected');
 send(a,{type:'actor_pose',poseSeq:3,activity:'death',poseHeight:-100,gear:'free_cannon'});await until(()=>player.activity==='death','death state');assert.equal(player.poseHeight,.9);assert.equal(player.gear,'hands');
 const c=await open(),welcome=c.events.find(e=>e.type==='welcome'),late=welcome.peers.find(p=>p.id===a.id);assert.equal(late.activity,'death');assert.equal(late.poseHeight,.9);
 console.log('V63 real WebSocket actor poses: replication, late join, valid states, stale-sequence rejection, height bounds and no position/station/ammunition authority escalation PASS');
}finally{for(const p of peers)p.socket.close();await new Promise(r=>server.close(r));}
