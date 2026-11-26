import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {Group,Vector3} from '../src/engine/index.js';
import {TerrainData} from '../src/world/TerrainData.js';
import {Colliders} from '../src/world/Colliders.js';
import {buildHarborRoom} from '../src/land/ExpeditionSites.js';
import {SCANS,fitScan,buildRoomArt,caveScanSpecs} from '../src/land/ExpeditionArt.js';
import {advanceLandEnemy,createLandEnemy,LAND_SPECIES} from '../src/land/LandLogic.js';
const info=JSON.parse(fs.readFileSync(new URL('../public/models/props/props.json',import.meta.url),'utf8'));
const raw=fs.readFileSync(new URL('../public/models/props/props.bin',import.meta.url));
const bin=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
const assets={info,verts:new Float32Array(bin,0,info.vertexCount*info.vertexFloats),index:new Uint32Array(bin,info.indexByteOffset,info.indexCount)};
const terrain=new TerrainData();
test('all eight selected artist scans physically present with texture and mesh data',()=>{
 for(const name of SCANS){const p=info.props[name];assert.ok(p.vCount>1000&&p.iCount>4000,name);for(let i=p.iOff;i<p.iOff+p.iCount;i++)assert.ok(assets.index[i]<p.vCount,name);const layers=info.layers.filter(l=>l.startsWith(name+'_'));assert.ok(layers.length);for(const l of layers)for(const channel of ['a','n','r'])assert.ok(fs.statSync(new URL(`../public/models/props/p_${l}_${channel}.jpg`,import.meta.url)).size>1000);}
});
test('scanned models fit measured local collider envelope including 90-degree rotation',()=>{
 for(const name of SCANS)for(const yaw of [0,Math.PI/2]){const p=info.props[name],center=[2,1,-3],size=[1.2,.9,.65],matrix=fitScan(p,center,size,yaw);const lo=new Vector3(Infinity,Infinity,Infinity),hi=new Vector3(-Infinity,-Infinity,-Infinity);for(const x of [p.min[0],p.max[0]])for(const y of [p.min[1],p.max[1]])for(const z of [p.min[2],p.max[2]]){const point=new Vector3(x,y,z).applyMatrix4(matrix);lo.min(point);hi.max(point);}for(let i=0;i<3;i++){assert.ok(Math.abs(lo.getComponent(i)-(center[i]-size[i]/2))<1e-5);assert.ok(Math.abs(hi.getComponent(i)-(center[i]+size[i]/2))<1e-5);}}
});
test('all four rooms build real PBR mesh with scan UVs, normals and texture layer indices',()=>{
 for(const [x,z,role,width,notice] of [[57.8,-71,'merchant',3.8,false],[62,-73,'shipwright',4.4,false],[45,-80,'keeper',4.4,false],[57,-79.15,'expedition-notice',4.8,true]]){
  const app={terrainData:terrain,colliders:new Colliders(),scene:new Group()};const room=buildHarborRoom(app,{x,z,role,width,notice});
  const g=buildRoomArt(assets,room.boxes,{width,depth:4.5,role,notice});const n=g.attributes.position.count,indices=g.index.array,layers=g.attributes.aLayer.array;
  assert.ok(n>(notice?8000:30000),`${role} ${n}`);assert.equal(g.attributes.normal.count,n);assert.equal(g.attributes.uv.count,n);assert.equal(layers.length,n);
  assert.ok(layers.some(v=>v>=100));assert.ok(layers.some(v=>v===0||v===1));for(const i of indices)assert.ok(i<n);for(const v of g.attributes.position.array)assert.ok(Number.isFinite(v));
  const scanLayer=info.layers.indexOf('WoodenTable_03_0')+100;assert.equal(layers.includes(scanLayer),!notice);console.log(role,n,'vertices',indices.length/3,'triangles');
 }
});
test('cave scan supplies are outside central passage and inside rock arch',()=>{
 const specs=caveScanSpecs(terrain,390);assert.equal(specs.length,6);for(const s of specs){assert.ok(Math.abs(s.x-390)>10&&Math.abs(s.x-390)+s.size[0]/2<20);assert.ok(s.z>-540&&s.z<-445);assert.ok(Number.isFinite(s.y));}
});
test('existing enemies cannot instantly turn or attack-turn, return to home outside territory',()=>{
 for(const type of ['crab','hound','wraith','warden']){const e=createLandEnemy('test',type,0,0);let last=e.yaw;for(let i=0;i<120;i++){advanceLandEnemy(e,{x:Math.sin(i*.37)*12,z:Math.cos(i*.37)*12},.016);const delta=Math.abs(Math.atan2(Math.sin(e.yaw-last),Math.cos(e.yaw-last)));assert.ok(delta<=4.5*.016+1e-7);last=e.yaw;}
  e.state='telegraph';e.timer=.4;last=e.yaw;advanceLandEnemy(e,{x:9,z:-9},.05);assert.equal(e.yaw,last);e.state='idle';e.x=50;e.z=0;advanceLandEnemy(e,{x:100,z:0},.05);assert.equal(e.state,'return');assert.ok(e.vx<0);
 }
});
import {SURVEY,restoreSurvey,surveyAction} from '../src/land/FossilSurvey.js';
import {REX,newRex,advanceRex} from '../src/land/RexBrain.js';
test('survey records unique and return requires all three stations; malformed saves rejected',()=>{
 let s=restoreSurvey({accepted:false,records:['strata'],returned:true});assert.deepEqual(s.records,[]);assert.equal(s.returned,false);
 s=surveyAction(s,'strata');assert.equal(s.records.length,0);s=surveyAction(s,'accept');s=surveyAction(s,'strata');s=surveyAction(s,'strata');s=surveyAction(s,'return');assert.equal(s.records.length,1);assert.equal(s.returned,false);
 for(const site of SURVEY){assert.ok(terrain.heightAt(site.x,site.z)>40);s=surveyAction(s,site.id);}s=surveyAction(s,'return');assert.equal(s.returned,true);assert.equal(s.records.length,3);assert.equal(restoreSurvey({accepted:true,returned:true,records:{}}).returned,false);
});
test('optional T. rex AI: locked telegraph, bounded angular velocity and acceleration, bite event and leash',()=>{
 let e=newRex(),strikes=0,last=e.yaw,prevSpeed=e.speed;
 for(let i=0;i<1500;i++){const p={x:REX.home.x,z:REX.home.z+4.8};const prevState=e.state,r=advanceRex(e,p,.02);const delta=Math.abs(Math.atan2(Math.sin(e.yaw-last),Math.cos(e.yaw-last)));assert.ok(delta<=REX.turn*.02+1e-6);if(prevState==='windup'||prevState==='recover')assert.equal(delta,0);assert.ok(e.speed-prevSpeed<=REX.accel*.02+1e-6);assert.ok(Math.hypot(e.x-REX.home.x,e.z-REX.home.z)<=REX.radius);if(r.strike)strikes++;last=e.yaw;prevSpeed=e.speed;}
 assert.ok(strikes>0);assert.equal(strikes,e.serial);e=newRex();for(let i=0;i<800;i++)advanceRex(e,{x:1000,z:1000},.02,{canMove:()=>false});assert.equal(e.x,REX.home.x);assert.equal(e.z,REX.home.z);
});
