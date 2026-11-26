import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3,Quaternion} from '../src/engine/index.js';
import {TerrainData} from '../src/world/TerrainData.js';
import {Colliders} from '../src/world/Colliders.js';
import {buildExpeditionCave} from '../src/land/ExpeditionSites.js';
import {CAVE,EXPEDITION_ROUTES} from '../src/land/ExpeditionTerrain.js';
import {RESERVOIR,localWaterAt,reservoirDistance} from '../src/land/MineReservoirV80.js';
import {cameraLocalVolume} from '../src/post/LocalWaterV81.js';
import {safeFlyLanding,canStandAt} from '../src/player/LandMotorV78.js';
import {App} from '../src/App.js';
const v=(x,y,z)=>new Vector3(x,y,z),t=new TerrainData(),c=new Colliders(),cave=buildExpeditionCave(new Group(),t,c),w=cave.world;
test('rock mesh and collision share triangles, rear face is curved, no box proxy',()=>{
 const g=cave.roof.geometry,p=g.attributes.position.array,ix=g.index.array;
 assert.ok(p.every(Number.isFinite));assert.ok(g.attributes.normal.array.every(Number.isFinite));assert.equal(w.triangles.length,ix.length/3);
 assert.ok(!c.boxes.some(b=>b.tag==='v70:cave-back'));
 for(const y of [46,48,50])assert.ok(w.segmentHit(v(346,y,-624),v(346,y,-629)));
 const backZ=w.triangles.filter(q=>q.id===cave.roof.name&&q.min[2]<CAVE.back-.05);assert.ok(backZ.length>20);
 const entrance=t.heightAt(CAVE.x,CAVE.front+1);assert.equal(w.segmentHit(v(CAVE.x,entrance+1.62,CAVE.front+1),v(CAVE.x,entrance+1.62,CAVE.front-1)),null);
});
test('fossil road capsule clearance sampled every 25cm across rerouted road',()=>{
 let count=0;const route=EXPEDITION_ROUTES[1];for(let i=1;i<route.length;i++){const [ax,az]=route[i-1],[bx,bz]=route[i],n=Math.ceil(Math.hypot(bx-ax,bz-az)/.25);for(let j=0;j<=n;j++){const x=ax+(bx-ax)*j/n,z=az+(bz-az)*j/n,y=t.heightAt(x,z);assert.ok(!w.capsuleOverlap(v(x,y,z),.3,1.75),`${x},${z}`);count++;}}assert.ok(count>1000);console.log('road capsule samples',count);
});
test('reservoir triangulation follows terrain shoreline and dry bank does not trigger underwater state',()=>{
 const p=cave.lake.geometry.attributes.position.array;assert.ok(p.length>1000);for(let i=0;i<p.length;i+=3){assert.ok(Math.abs(p[i+1]-RESERVOIR.surface)<.00001);assert.ok(reservoirDistance(p[i],p[i+2])<=1.101);assert.ok(t.heightAt(p[i],p[i+2])<=RESERVOIR.surface+.07);}
 let wet=0,dry=0;for(let x=348;x<358;x+=.25)for(let z=-620;z<-608;z+=.25){if(reservoirDistance(x,z)>=1.10)continue;const h=t.heightAt(x,z);if(h<RESERVOIR.surface){wet++;assert.equal(localWaterAt(x,h+.1,z,t),RESERVOIR.surface);}else{dry++;assert.equal(localWaterAt(x,h+.1,z,t),null);assert.equal(cameraLocalVolume(v(x,h+.1,z),null,t),null);}}assert.ok(wet>0&&dry>0);
});
test('safe fly landing accepts real dry cave floor and rejects roof interior, air, water and solid box',()=>{
 const y=t.heightAt(390,-500),floor=safeFlyLanding(t,c,v(390,y+1.62,-500),0);assert.ok(floor);assert.equal(floor.y,y);assert.ok(canStandAt(c,floor));
 const ceiling=w.ceilingAt(390,-500,y+2,y+40);assert.equal(safeFlyLanding(t,c,v(390,ceiling+1.62,-500),0),null);
 assert.equal(safeFlyLanding(t,c,v(390,y+25,-500),0),null);assert.equal(safeFlyLanding(t,c,v(353,t.heightAt(353,-614)+1.62,-614),RESERVOIR.surface),null);
 const fake=new Colliders();fake.addBox(v(0,2,0),v(1,2,1));assert.equal(safeFlyLanding({heightAt:()=>1},fake,v(0,2.62,0),0),null);
});
test('actual App camera transition rejects busy/lift/air and never teleports a co-op actor',()=>{
 const app=Object.create(App.prototype),y=t.heightAt(390,-440);const p={mode:'walk',grounded:true,position:v(390,y,-440),velocity:v(1,0,0)};let reset=0;
 Object.assign(app,{freeCam:false,player:p,qs:new URLSearchParams('coop=1'),camera:{position:v(390,y+1.62,-440),quaternion:new Quaternion()},fly:{setPose(){},velocity:v(0,0,0)},input:{resetPhysicalState(){reset++;}},terrainData:t,colliders:c,landAdventure:{expeditionCave:cave}});
 p.busy=true;assert.equal(app.setFreeCam(true),false);p.busy=false;p.grounded=false;assert.equal(app.setFreeCam(true),false);p.grounded=true;const start=p.position.clone();assert.equal(app.setFreeCam(true),true);app.camera.position.set(390,100,-500);assert.equal(app.setFreeCam(false),true);assert.deepEqual(p.position.toArray(),start.toArray());assert.equal(reset,2);
 p.position.copy(cave.lift.cabin());assert.equal(app.setFreeCam(true),false);p.position.copy(start);app.qs=new URLSearchParams();app.setFreeCam(true);const targetY=t.heightAt(390,-500);app.camera.position.set(390,targetY+1.62,-500);app.setFreeCam(false);assert.equal(p.position.z,-500);app.setFreeCam(true);app.camera.position.set(390,100,-500);app.setFreeCam(false);assert.equal(p.position.z,-500);
});
