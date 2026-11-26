// Real ship-production logic, no mocks for hydrodynamics or station arbitration.
// WebGPU rendering / mouse capture still needs a real browser acceptance pass.
import assert from 'node:assert/strict';
import {BoatModel} from '../src/world/BoatModel.js';
import {BoatController} from '../src/player/BoatController.js';
import {TerrainData} from '../src/world/TerrainData.js';
import {VoyageM1} from '../src/voyage/VoyageM1.js';
import {ShipStations} from '../src/ship/ShipStations.js';
import {autoAnchor} from '../src/ship/AnchorPolicy.js';
import {shipPoint,SHIP_STATION_SITES} from '../src/ship/StationSites.js';
import {cannonDirection,CANNON_ARC} from '../src/ship/CannonBallistics.js';
import {CoopHub} from '../server/coopHub.js';
import {Vector3} from '../src/engine/index.js';
let n=0;const check=(name,fn)=>{fn();n++;console.log('PASS',name);};
check('auto anchor: shore -> anchored; free sail deck -> released; destination -> parking',()=>{
 assert.equal(autoAnchor({aboard:false}),true);
 assert.equal(autoAnchor({aboard:true}),false,'no voyage required for departure');
 assert.equal(autoAnchor({aboard:true,goalDistance:12}),true);
 assert.equal(autoAnchor({aboard:true,goalDistance:12,humanHelm:true}),false);
 assert.equal(autoAnchor({aboard:false,goalDistance:12,manual:true}),null);
});
check('anchor winch action latches, manual override persists after leaving station; R returns to automatic',()=>{
 const s=new ShipStations();s.anchorDown=true;s.claim('anchor','local');
 s.setInput('anchor','local',{fire:true});s.setInput('anchor','local',{axis:0});
 assert.equal(s.update(.016).anchorDown,false);
 assert.equal(s.anchorManual,true);s.release('anchor','local');
 assert.equal(autoAnchor({aboard:false,manual:s.anchorManual}),null);
 s.claim('anchor','local');s.setInput('anchor','local',{reload:true});s.update(.016);
 assert.equal(s.anchorManual,false);
});
check('helm A/D + W/S are independent, throttle increases and reverses without touching sails',()=>{
 const s=new ShipStations();s.claim('helm','local');s.claim('sail_main','ai:mei');
 const before=s.helmThrottle;
 s.setInput('helm','local',{axis:1,throttleAxis:1});let value=s.update(1);
 assert.equal(value.rudder,1);assert.ok(value.helmThrottle>before);
 s.setInput('helm','local',{axis:-1,throttleAxis:-1});value=s.update(3);
 assert.ok(value.helmThrottle<0,'astern power can be selected');
 assert.equal(value.rudder,-1);assert.equal(value.sailMain,.30);
});
check('projectile stays within broadside arc and follows elevation, correct side',()=>{
 const port=cannonDirection('cannon_port',0,Math.PI/2,.20);
 const starboard=cannonDirection('cannon_starboard',0,-Math.PI/2,.20);
 assert.ok(port.x>.9 && starboard.x<-.9);
 assert.ok(port.y>0 && starboard.y>0);
 const clamped=cannonDirection('cannon_port',0,-Math.PI/2,9);
 assert.ok(Math.abs(clamped.relativeYaw-Math.PI/2)<=CANNON_ARC+1e-6);
 assert.ok(clamped.elevation<=.36);
 assert.equal(cannonDirection('helm',0),null);
 // Regression: the original flat muzzle launched downward when the normal
 // camera view was slightly pitched down. At 70 m that projectile never
 // reached the opposing gunboat above the water surface.
 const normal=cannonDirection('cannon_port',0,Math.PI/2,-.05);
 const seconds=70/(normal.x*56);
 const projectileY=1.2+(normal.y*56+2)*seconds-9.81*seconds*seconds/2;
 assert.ok(projectileY>-.5&&projectileY<4.5,
   `normal broadside must reach a 70-m target near sea level, y=${projectileY}`);
 const s=new ShipStations();s.claim('cannon_port','local');
 s.setInput('cannon_port','local',{fire:true,aimYaw:.8,aimPitch:.2});
 assert.deepEqual(s.update(.016).shots.map(x=>[x.aimYaw,x.aimPitch]),[[.8,.2]]);
});
check('station world point uses pitch and roll rather than yaw-only dead zones',()=>{
 const mesh=new BoatModel();const b={position:new Vector3(10,2,-5),quaternion:mesh.group.quaternion,
  toWorld(local,out){return out.copy(local).applyQuaternion(this.quaternion).add(this.position);}};
 b.quaternion.setFromAxisAngle(new Vector3(1,0,0),.3);
 const p=shipPoint(b,'anchor');const l=SHIP_STATION_SITES.anchor;
 assert.ok(Math.abs(p.y-(2+l.y))>.5,'foredeck pitch moves interaction point vertically');
});
check('server refuses unauthorized cannon visuals and invalid throttle inputs',()=>{
 let clock=1000;const hub=new CoopHub({now:()=>clock});
 const writes=[];const sock={destroyed:false,write(b){writes.push(b);},end(){}};
 const a=hub.join(sock);hub.handle(a,{type:'hello',name:'skipper'});
 const b=hub.join({...sock,write(){}});hub.handle(b,{type:'hello',name:'guest'});
 // A guest cannot mint remote cannonfire.
 hub.handle(b,{type:'cannon_fire_host',seq:1,x:0,y:0,z:0,vx:2,vy:1,vz:2});
 assert.equal(b.lastVoyageSeq,1);
 hub.handle(a,{type:'station_claim',seq:1,stationId:'helm'});
 assert.equal(hub.stations.getOccupant('helm'),a.id);
 hub.handle(a,{type:'station_input',seq:2,stationId:'helm',axis:0,throttleAxis:900,buttons:0});
 assert.equal(hub.stations.inputs.has(a.id),false);
 clock+=100;
 hub.handle(a,{type:'station_input',seq:3,stationId:'helm',axis:0,throttleAxis:.8,buttons:0});
 assert.equal(hub.stations.inputs.get(a.id).throttleAxis,.8);
});
check('production physics departs the dock without accepting a quest',()=>{
 const model=new BoatModel();const query={latency:.03,allocate:()=>0,version:0,resultTime:0,cpuValid:true,
  resultInputs:new Float32Array(model.hullSamples.length*4),cpu:new Float32Array(model.hullSamples.length*4),setPoint(){}};
 const terrain=new TerrainData(7);const ship=new BoatController({model,query,terrain,colliders:null});
 const inp={enabled:true,mouseDown:false,keys:new Set(),pressed:new Set(),down(c){return this.keys.has(c)},
  consume(){return false},resetPhysicalState(){}};
 const p={mode:'walk',position:new Vector3(53.6,1,-77),stationId:null,carryingChest:false};
 const app={input:inp,boat:model,boatCtl:ship,terrainData:terrain,player:p,scene:{add(){},remove(){}},hunt:{abyss:{active:false}}};
 const v=new VoyageM1(app);p.voyageM1=v;const departure=ship.position.clone();
 v.beforePhysics(1/60);assert.equal(v.stations.anchorDown,true);
 p.mode='deck';p.position.copy(ship.position);
 let peakSpeed=0;
 for(let i=0;i<60*54;i++){
  const dt=1/60;query.version++;query.resultTime+=dt;
  for(let j=0;j<ship.samples.length;j++){
   const pt=ship.toWorld(ship.samples[j].p,new Vector3());
   query.resultInputs[j*4]=pt.x;query.resultInputs[j*4+1]=pt.z;query.cpu[j*4]=0;
  }
  v.beforePhysics(dt);ship.update(dt);
  peakSpeed=Math.max(peakSpeed,ship.speed);
  assert.ok(ship.isFinite(),'invalid ship physics frame '+i);
 }
 const traveled=Math.hypot(ship.position.x-departure.x,ship.position.z-departure.z);
 assert.equal(v.voyage.phase,'offer','still has no mission');
 assert.equal(v.stations.anchorDown,false,'free sailing must not re-anchor itself');
 assert.ok(peakSpeed>.7,`peak speed too small: ${peakSpeed}`);
 assert.ok(traveled>5,`ship not moving without quest: ${traveled}`);
 console.log(`  sailed ${traveled.toFixed(1)} m without mission; peak ${peakSpeed.toFixed(2)} m/s`);
});
console.log(`STORMWAKE V41 ship reliability: ${n} checks passed; no graphical assertion implied.`);
