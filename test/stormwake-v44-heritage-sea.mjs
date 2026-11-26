import assert from 'node:assert/strict';
import {BoatModel} from '../src/world/BoatModel.js';
import {BoatController} from '../src/player/BoatController.js';
import {TerrainData} from '../src/world/TerrainData.js';
import {Vector3} from '../src/engine/index.js';
const m=new BoatModel({shipClass:'heritage'}),q={latency:.03,allocate:()=>0,version:0,resultTime:0,cpuValid:true,resultInputs:new Float32Array(m.hullSamples.length*4),cpu:new Float32Array(m.hullSamples.length*4),setPoint(){}};
const ship=new BoatController({model:m,query:q,terrain:new TerrainData(7),colliders:null});
ship.teleportTo(-600,1850,0);ship.voyageEnabled=true;ship.voyageAnchor=false;ship.moored=false;ship.driven=true;ship.voyageSails.main=.8;ship.voyageSails.jib=.6;
let peak=0,minY=Infinity,maxY=-Infinity,maxAng=0;
for(let i=0;i<1800;i++){
 const dt=1/60;q.version++;q.resultTime+=dt;
 for(let j=0;j<ship.samples.length;j++){const pt=ship.toWorld(ship.samples[j].p,new Vector3());q.resultInputs[j*4]=pt.x;q.resultInputs[j*4+1]=pt.z;q.cpu[j*4]=0;}
 ship.setInput(.6,.02,dt);ship.update(dt);
 minY=Math.min(minY,ship.position.y);maxY=Math.max(maxY,ship.position.y);peak=Math.max(peak,ship.speed);maxAng=Math.max(maxAng,ship.angular.length());
 assert.ok(ship.isFinite(),'NaN in legacy-derived heritage ship step '+i);
}
const results={x:ship.position.x,z:ship.position.z,y:ship.position.y,speed:ship.speed,peak,minY,maxY,maxAng,capsized:ship.capsized,mass:ship.mass};
console.log('Heritage physics 30s calm-water:',results);
assert.ok(!ship.capsized,'new hull must remain upright in calm water');
assert.ok(minY>-5&&maxY<5,'height must remain near waterline');
assert.ok(peak>.3&&peak<15,'new hull must sail instead of being stuck / explosively fast');
