import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Group,Vector3} from '../src/engine/index.js';
import {TerrainData} from '../src/world/TerrainData.js';
import {Colliders} from '../src/world/Colliders.js';
import {Village} from '../src/world/Village.js';
import {GPU} from '../src/engine/gpu/GPU.js';
import {EXPEDITION_ROUTES,CAVE,FOSSIL,expeditionClearance} from '../src/land/ExpeditionTerrain.js';
import {buildExpeditionCave,buildHarborRoom} from '../src/land/ExpeditionSites.js';
import {CORSAIR,newCorsairState,advanceCorsair,corsairAttackFacing} from '../src/land/LandCorsairBrain.js';
import {strikeLineBlocked} from '../src/land/LandCombatTiming.js';
const terrain=new TerrainData(),scene=new Group(),colliders=new Colliders();
const cave=buildExpeditionCave(scene,terrain,colliders),v=(x,y,z)=>new Vector3(x,y,z);
test('real terrain: both expedition routes continuous and traversable',()=>{for(const route of EXPEDITION_ROUTES){let max=0;for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/.5);let prev;for(let j=0;j<=n;j++){const x=a[0]+(b[0]-a[0])*j/n,z=a[1]+(b[1]-a[1])*j/n,h=terrain.heightAt(x,z);assert.ok(h>2);assert.ok(expeditionClearance(x,z));if(prev!==undefined)max=Math.max(max,Math.abs(h-prev)/(len/n));prev=h;}}assert.ok(max<.36,`grade ${max}`);console.log('max route grade',max.toFixed(3));}assert.ok(Math.hypot(CORSAIR.arena.x-56,CORSAIR.arena.z+71)>500);assert.ok(terrain.heightAt(FOSSIL.x,FOSSIL.z)>40);});
test('actual cave mesh: roof, side collision, open entrance, return route',()=>{assert.ok(cave.world.triangles.length>2000);const y=terrain.heightAt(CAVE.x,-500);assert.ok(cave.world.ceilingAt(CAVE.x,-500,y+2,y+40)>y+9);for(const sign of [-1,1]){const moved=cave.world.move(v(CAVE.x,y,-500),v(CAVE.x+sign*32,y,-500),{radius:.24,height:1.8});assert.ok(Math.abs(moved.x-CAVE.x)<23);assert.ok(moved.contacts.length);}let p=v(CAVE.x,terrain.heightAt(CAVE.x,-440),-440);for(let z=-441;z>=-530;z--){const q=v(CAVE.x,terrain.heightAt(CAVE.x,z),z);const m=cave.world.move(p,q,{radius:.24,height:1.8});assert.ok(Math.abs(m.z-z)<.05);p=v(m.x,m.y,m.z);}for(let z=-529;z<=-440;z++){const q=v(CAVE.x,terrain.heightAt(CAVE.x,z),z);const m=cave.world.move(p,q,{radius:.24,height:1.8});assert.ok(Math.abs(m.z-z)<.05);p=v(m.x,m.y,m.z);}assert.ok(strikeLineBlocked(colliders,v(CAVE.x,y+1,-500),v(CAVE.x+35,y+1,-500)));});
test('three service rooms: station and aisle clear, counter and rear solid',()=>{for(const [x,z,role,width] of [[57.8,-71,'merchant',3.8],[62,-73,'shipwright',4.4],[45,-80,'keeper',4.4]]){const c=new Colliders(),r=buildHarborRoom({terrainData:terrain,colliders:c,scene:new Group()},{x,z,role,width});assert.ok(r.mesh.geometry.attributes.position.count>1000);let p=r.service.clone();assert.equal(c.resolveCapsule(p,.24,1.8,.2),false);p=v(x,r.floor,z+.46);assert.equal(c.resolveCapsule(p,.24,1.8,.2),true);p=v(x+width*.37,r.floor,z+1.35);for(let zz=z+1.35;zz>=z-.9;zz-=.05){p.z=zz;assert.equal(c.resolveCapsule(p,.215,1.8,.2),false,`${role} aisle ${zz}`);}p=v(x,r.floor,z-3.75);assert.ok(c.resolveCapsule(p,.24,1.8,.2));}});
test('corsair has bounded turn, initialized strafe, locked dash, no remote melee',()=>{let e=newCorsairState();delete e.strafeSign;const p={x:e.x+5,z:e.z};for(let i=0;i<800;i++){const yaw=e.yaw;const r=advanceCorsair(e,p,.05);assert.ok(Math.abs(Math.atan2(Math.sin(e.yaw-yaw),Math.cos(e.yaw-yaw)))<=.175001);assert.ok(Number.isFinite(e.vx)&&Number.isFinite(e.vz));if(r.moving){e.x+=e.vx*.05;e.z+=e.vz*.05;}}e=newCorsairState();e.state='telegraph';e.attackStyle='lunge';e.yaw=0;e.timer=.01;advanceCorsair(e,{x:e.x+10,z:e.z},.05);assert.ok(Math.abs(e.dashX)<1e-6&&e.dashZ===1);assert.equal(corsairAttackFacing(e,{x:e.x,z:e.z-3}),false);e=newCorsairState();e.x+=8;advanceCorsair(e,{x:0,z:0},.05);assert.equal(e.state,'return');assert.ok(e.vx<0);});

test('actual V69 village plus four new service buildings: full-sized player can enter',()=>{
 globalThis.GPUBufferUsage={STORAGE:1,COPY_DST:2,COPY_SRC:4,VERTEX:8,INDEX:16,UNIFORM:32};GPU.device={createBuffer:()=>({destroy(){}})};GPU.queue={writeBuffer(){}};
 const c=new Colliders(),s=new Group();const village=new Village({scene:s,terrain,colliders:c});assert.ok(c.boxes.length>600);const app={terrainData:terrain,colliders:c,scene:s};
 const notice=buildHarborRoom(app,{x:57,z:-79.15,role:'expedition-notice',width:4.8,notice:true});
 for(const [x,z,role,width] of [[57.8,-71,'merchant',3.8],[62,-73,'shipwright',4.4],[45,-80,'keeper',4.4]]){
 const r=buildHarborRoom(app,{x,z,role,width});let p=r.service.clone();assert.equal(c.resolveCapsule(p,.24,1.8,.2),false,role+' station');
 for(let zz=z+1.35;zz>=z-.9;zz-=.05){p=v(x+width*.35,r.floor,zz);assert.equal(c.resolveCapsule(p,.30,1.75,.4),false,`${role} full-size aisle ${zz}`);}}
 for(let z=-77.6;z>=-79;z-=.05){const p=v(57,notice.floor,z);assert.equal(c.resolveCapsule(p,.30,1.75,.4),false,'notice hall entrance');}
});
