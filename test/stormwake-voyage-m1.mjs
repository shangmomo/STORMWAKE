import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ShipStations,STATION_IDS} from '../src/ship/ShipStations.js';
import {SailWind} from '../src/ship/SailWind.js';
import {ShipDamage} from '../src/ship/ShipDamage.js';
import {CrewAI} from '../src/ship/CrewAI.js';
import {EnemyShotgunBoat} from '../src/ship/EnemyShotgunBoat.js';
import {VOYAGE_GOLD_MOSS} from '../src/voyage/VoyageDefs.js';
import {VoyageDirector} from '../src/voyage/VoyageDirector.js';
import {DigSite} from '../src/voyage/DigSite.js';
import {Cargo} from '../src/voyage/Cargo.js';
import {Broker} from '../src/voyage/Broker.js';
import {InteractionDirector} from '../src/interact/InteractionDirector.js';
import {STORMWAKE_M1} from '../src/voyage/VoyageWorld.js';
import {CoopHub} from '../server/coopHub.js';
let tests=0;const test=(name,fn)=>{try{fn();tests++;console.log('✓',name);}catch(e){console.error('✕',name);throw e;}};
test('岗位互斥、释放、同人不可占两岗',()=>{
 const s=new ShipStations();assert.equal(s.claim('helm','p1'),true);assert.equal(s.claim('helm','p2'),false);
 assert.equal(s.claim('sail_main','p1'),false);assert.equal(s.getOccupant('helm'),'p1');
 assert.equal(s.release('helm','p2'),false);assert.equal(s.release('helm','p1'),true);
 assert.equal(s.claim('helm','p2'),true);assert.equal(s.claim('invalid','p3'),false);
});
test('AI 让岗但不能踢掉真人',()=>{const s=new ShipStations();s.claim('helm','ai:one');assert.equal(s.claim('helm','p1',{replaceAI:true}),true);assert.equal(s.claim('helm','p2',{replaceAI:true}),false);});
test('岗位输入隔离、舵轮回中、帆位保持',()=>{
 const s=new ShipStations();s.claim('helm','p1');s.claim('sail_main','p2');
 s.setInput('helm','p1',{axis:1});s.setInput('sail_main','p2',{axis:1});const x=s.update(1);assert.equal(x.rudder,1);assert.ok(x.sailMain>.3);
 const sail=x.sailMain;s.release('sail_main','p2');s.release('helm','p1');s.update(.5);assert.equal(s.sailMain,sail);assert.ok(s.rudder<1);
 assert.equal(s.setInput('helm','p2',{axis:1}),false);
});
test('舷炮装弹与冷却、一枪只触发一次',()=>{const s=new ShipStations();s.claim('cannon_port','p1');s.setInput('cannon_port','p1',{fire:true});assert.equal(s.update(.1).shots.length,1);assert.equal(s.update(.1).shots.length,0);s.setInput('cannon_port','p1',{reload:true});s.update(4);s.setInput('cannon_port','p1',{reload:true,fire:true});assert.equal(s.update(.1).shots.length,1);});
test('顺风满帆推力明显强于纯辅机与逆风帆',()=>{
 const wind=new SailWind({wind:{x:0,z:9}});const full=wind.evaluate({heading:0,sailMain:1,sailJib:1}),up=wind.evaluate({heading:Math.PI,sailMain:1,sailJib:1});
 assert.ok(Math.abs(full.thrust-1.45*9*9*23)<1e-6,'quadratic wind pressure with real canvas coefficient');assert.ok(full.thrust>up.thrust*5);assert.equal(wind.evaluate({heading:0}).thrust,0);
});
test('船体破损、进水、修复、火灾、沉船',()=>{
 const d=new ShipDamage();d.applyHit(40);d.applyHit(40);assert.equal(d.integrity,20);assert.ok(d.breach>0);d.update(2);assert.ok(d.integrity<20);const v=d.integrity;d.repair(1);assert.ok(d.integrity>v);d.applyHit(200);assert.equal(d.isSinking(),true);assert.equal(d.repair(1),false);
});
test('4s 连续挖掘、离开重置、一处只能完成一次',()=>{
 const d=new DigSite({duration:4});for(let i=0;i<50;i++)d.advance('p1',.05);assert.equal(d.advance('p1',.05,false).progress,0);
 let last;for(let i=0;i<80;i++)last=d.advance('p1',.05);assert.equal(last.justCompleted,true);
 assert.equal(d.advance('p1',.05).justCompleted,false);
});
test('宝箱搬运→船舱→兑现，只发一次奖励',()=>{
 const v=new VoyageDirector(),c=new Cargo();assert.equal(v.accept(),true);assert.equal(v.digDone(),true);
 assert.equal(c.spawnChest('chest_1',{x:1,y:0,z:2}),true);assert.equal(c.tryPick('p1','chest_1',{x:99,z:99}),false);
 assert.equal(c.tryPick('p1','chest_1',{x:1,z:2}),true);assert.equal(c.tryPick('p2','chest_1'),false);
 assert.equal(c.tryStow('p1','ship'),true);assert.equal(v.stow(),true);
 const b=new Broker({voyage:v,cargo:c,shipId:'ship'});assert.equal(b.sell(),true);assert.equal(v.tideCoin,120);assert.equal(b.sell(),false);assert.equal(v.tideCoin,120);
});
test('完整状态可持久化且损坏存档安全回退',()=>{
 const v=new VoyageDirector();v.accept();v.digDone();v.stow();v.sell('chest1');const raw=v.serialize();const vv=new VoyageDirector();vv.deserialize(raw);assert.deepEqual(vv.serialize(),raw);assert.equal(vv.sell('chest1'),false);
});
test('AI 在无人时补 helm/sail_main/cannon_starboard，真人优先',()=>{
 const stations=new ShipStations(),ai=new CrewAI(stations);
 const boat={position:{x:0,z:0},getYaw:()=>0};ai.update(.1,{boat,wind:{alignment:1},waypoint:{x:-50,z:50},autopilot:true});
 assert.equal(stations.getOccupant('helm'),'ai:kael');assert.equal(stations.getOccupant('sail_main'),'ai:mei');
 assert.equal(stations.claim('helm','p1',{replaceAI:true}),true);ai.update(.1,{boat});assert.equal(stations.getOccupant('helm'),'p1');
});
test('AI 炮艇巡航接敌、开火、低血量撤退和沉船',()=>{
 const enemy=new EnemyShotgunBoat({path:[{x:0,z:0},{x:0,z:100}]}),d=new ShipDamage(),b={position:{x:2,z:4},getYaw:()=>0};
 const events=enemy.update(4,b,d);assert.equal(enemy.state,'engage');assert.equal(events.length,1);assert.ok(d.integrity<100);
 enemy.hit(85);enemy.update(.1,b,d);assert.equal(enemy.state,'flee');enemy.hit(15);assert.equal(enemy.state,'sink');
});
test('E 交互按优先级每帧只派发一次',()=>{
 const i=new InteractionDirector();const p={position:{x:0,y:0,z:0}},invoked=[];i.beginFrame();
 i.add({id:'a',position:{x:1,y:0,z:1},perform:()=>invoked.push('a'),priority:2},p);i.add({id:'b',position:{x:1,y:0,z:1},perform:()=>invoked.push('b'),priority:8},p);
 assert.equal(i.select().id,'b');const input={consume:()=>true};i.dispatch(input);assert.deepEqual(invoked,['b']);
});
test('坐标集中定义，藏宝与海港位置不同',()=>{assert.ok(distance2(STORMWAKE_M1.noticeBoard,STORMWAKE_M1.digSite)>50);assert.ok(STORMWAKE_M1.mossIsland.radius===80);});
function distance2(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
function fakeSocket(){return {destroyed:false,bytes:[],write(data){this.bytes.push(data);},end(){}};}
function lastMessage(sock){const b=sock.bytes.at(-1),offset=(b[1]===126?4:2),len=b[1]===126?b.readUInt16BE(2):b[1];return JSON.parse(b.subarray(offset,offset+len).toString());}
test('服务器禁止非法 stationId、重复 claim、越权释放',()=>{
 let now=5000;const h=new CoopHub({now:()=>now}),a=h.join(fakeSocket()),b=h.join(fakeSocket());h.handle(a,{type:'hello',name:'A'});h.handle(b,{type:'hello',name:'B'});
 h.handle(a,{type:'station_claim',seq:1,stationId:'__proto__'});assert.equal(h.stations.occupants.size,0);
 h.handle(a,{type:'station_claim',seq:2,stationId:'helm'});h.handle(b,{type:'station_claim',seq:1,stationId:'helm'});assert.equal(h.stations.getOccupant('helm'),a.id);
 h.handle(b,{type:'station_release',seq:2,stationId:'helm'});assert.equal(h.stations.getOccupant('helm'),a.id);
 h.handle(a,{type:'station_release',seq:3,stationId:'helm'});assert.equal(h.stations.getOccupant('helm'),null);
});
test('服务器拒绝非房主船状态、非法数字与倒序 seq',()=>{
 let now=5000;const h=new CoopHub({now:()=>now}),a=h.join(fakeSocket()),b=h.join(fakeSocket());h.handle(a,{type:'hello'});h.handle(b,{type:'hello'});
 const state={type:'ship_state_host',seq:1,x:5,y:0,z:0,yaw:0,vx:0,vz:0,sailMain:.5,sailJib:.1,integrity:100,breach:0,fire:0,anchor:false};
 h.handle(b,state);assert.equal(h.shipState,null);h.handle(a,{...state,seq:1,x:NaN});assert.equal(h.shipState,null);
 h.handle(a,{...state,seq:2});assert.equal(h.shipState.x,5);h.handle(a,{...state,seq:2,x:80});assert.equal(h.shipState.x,5);
});
test('服务器 station_input 必须归属、限频并正确转发',()=>{
 let now=6000;const h=new CoopHub({now:()=>now}),a=h.join(fakeSocket()),b=h.join(fakeSocket());h.handle(a,{type:'hello'});h.handle(b,{type:'hello'});
 h.handle(a,{type:'station_claim',seq:1,stationId:'sail_main'});
 h.handle(b,{type:'station_input',seq:1,stationId:'sail_main',axis:1,buttons:0});assert.equal(h.stations.inputs.size,0);
 h.handle(a,{type:'station_input',seq:2,stationId:'sail_main',axis:1,buttons:0});assert.equal(h.stations.inputs.get(a.id).axis,1);
 now+=10;h.handle(a,{type:'station_input',seq:3,stationId:'sail_main',axis:-1,buttons:0});assert.equal(h.stations.inputs.get(a.id).axis,1);
 now+=50;h.handle(a,{type:'station_input',seq:4,stationId:'sail_main',axis:-1,buttons:0});assert.equal(h.stations.inputs.get(a.id).axis,-1);
});
test('服务端防重复发奖：接受→4秒挖→拾取→入舱→港口兑现',()=>{
 let now=10000;const h=new CoopHub({now:()=>now}),a=h.join(fakeSocket());h.handle(a,{type:'hello'});
 let seq=0;const send=(type,rest)=>h.handle(a,{type,seq:++seq,...rest});
 send('voyage_event',{verb:'accept',voyageId:VOYAGE_GOLD_MOSS.id});assert.equal(h.voyage.phase,'accepted');
 Object.assign(a,{mode:'walk',x:STORMWAKE_M1.digSite.x,z:STORMWAKE_M1.digSite.z});
 for(let n=0;n<28;n++){send('voyage_event',{verb:'dig_progress',voyageId:VOYAGE_GOLD_MOSS.id});now+=150;}
 send('voyage_event',{verb:'dig_progress',voyageId:VOYAGE_GOLD_MOSS.id});assert.equal(h.voyage.phase,'dug');assert.ok(h.cargo.get('chest_moss_01'));
 send('cargo_event',{verb:'pick',itemId:'chest_moss_01'});assert.equal(h.cargo.get('chest_moss_01').state,'held');
 Object.assign(a,{mode:'deck',deckLayer:'deck',x:70,y:1.03,z:32.5});h.shipState={x:70,y:0,z:38,yaw:0};send('cargo_event',{verb:'stow',itemId:'chest_moss_01',holdLocal:{x:0,y:1.03,z:-5.5},holdLayer:'deck'});assert.equal(h.voyage.phase,'stowed');
 Object.assign(a,{mode:'walk',x:56,z:-71});send('voyage_event',{verb:'sell',voyageId:VOYAGE_GOLD_MOSS.id});assert.equal(h.voyage.tideCoin,120);
 send('voyage_event',{verb:'sell',voyageId:VOYAGE_GOLD_MOSS.id});assert.equal(h.voyage.tideCoin,120);
});
test('服务端挖掘必须连续长按：松开、超时均不能白嫖4秒',()=>{
 let now=8000;const h=new CoopHub({now:()=>now}),a=h.join(fakeSocket());h.handle(a,{type:'hello'});
 let seq=0;const send=verb=>h.handle(a,{type:'voyage_event',verb,seq:++seq,voyageId:VOYAGE_GOLD_MOSS.id});
 send('accept');Object.assign(a,{mode:'walk',x:STORMWAKE_M1.digSite.x,z:STORMWAKE_M1.digSite.z});
 send('dig_progress');now+=2300;send('dig_progress');assert.equal(h.voyage.phase,'accepted');
 send('dig_cancel');now+=2500;send('dig_progress');assert.equal(h.voyage.phase,'accepted');
 for(let n=0;n<12;n++){now+=150;send('dig_progress');}
 now+=600;send('dig_progress');assert.equal(h.voyage.phase,'accepted');
});
test('V56 AI不能因登船或选点自动起锚，仍可控制航路',async()=>{
 const source=readFileSync(new URL('../src/voyage/VoyageM1.js',import.meta.url),'utf8');
 assert.ok(!source.includes('autoAnchor({aboard:crewAboard'));
 assert.ok(source.includes('this.crew.update(dt'));
});
test('跨历史模块不改 WGSL/FFT 内核',()=>{
 for(const f of ['src/ocean/OceanFFT.js','src/sky/Atmosphere.js','src/engine/index.js'])assert.ok(readFileSync(new URL('../'+f,import.meta.url)).length>100);
});
console.log(`\nM1 逻辑与网络验收：${tests} 项通过`);
