import assert from 'node:assert/strict';
import {Vector3,PerspectiveCamera} from '../src/engine/index.js';
import {Village} from '../src/world/Village.js';import {Builder} from '../src/world/village/GeoBuilder.js';import {buildHouse} from '../src/world/village/Buildings.js';import {Colliders} from '../src/world/Colliders.js';import {Rand} from '../src/world/Props.js';import {Player} from '../src/player/Player.js';
let seed=51521;const rand=new Rand(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/0x100000000));
for(const s of Village.prototype._layout(rand).houses.filter(h=>h.stories===2)){
 const colliders=new Colliders(),terrain={heightAt:()=>1};const built=buildHouse({B:new Builder(),colliders,rand,lights:[],checks:[],terrain,inst:{add(){}}},s),f=built.loft;
 const keys=new Set(['KeyW']);const input={enabled:true,down:k=>keys.has(k),hit:()=>false};const p=new Player({camera:new PerspectiveCamera(),input,terrain,colliders,query:{allocate:()=>0},boat:{}});p.waterMean=0;
 const world=(x,z)=>new Vector3(s.x+x*Math.cos(s.yaw)+z*Math.sin(s.yaw),built.floorY,s.z-x*Math.sin(s.yaw)+z*Math.cos(s.yaw));
 p.position.copy(world(f.stairX,f.zFront+.14));p.yaw=s.yaw;p.grounded=true;
 let max=0;for(let i=0;i<180;i++){const old=p.position.clone();p.updateWalk(1/60);max=Math.max(max,old.distanceTo(p.position));}
 const dx=p.position.x-s.x,dz=p.position.z-s.z,localZ=dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw);console.log(s.name,{height:p.position.y,expected:f.upperY,localZ,end:f.zBack,max});assert(p.position.y>=f.upperY-.03,'actual controller failed to reach landing');assert(localZ<f.zBack,'actual controller stuck on stairs');assert(max<.43,'teleport');
 for(const mode of ['normal','carry','sprint']){
  p.position.copy(world(f.stairX,f.zFront+.14));p.velocity.set(0,0,0);p.grounded=true;p.carryingChest=mode==='carry';if(mode==='sprint')keys.add('ShiftLeft');else keys.delete('ShiftLeft');
  for(let cycle=0;cycle<20;cycle++)for(const reverse of [false,true]){
   p.yaw=s.yaw+(reverse?Math.PI:0);p.velocity.set(0,0,0);const end=reverse?f.zFront+.14:f.zBack-.2;
   let steps=0,z=reverse?-Infinity:Infinity;while((reverse?z<end:z>end)&&steps++<700){p.updateWalk(1/60);const dx=p.position.x-s.x,dz=p.position.z-s.z;z=dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw);}
   keys.delete('KeyW');p.velocity.x=0;p.velocity.z=0;for(let settle=0;settle<30;settle++)p.updateWalk(1/60);keys.add('KeyW');
   assert(steps<700,`${s.name} ${mode} cycle ${cycle} stuck on ${reverse?'descent':'ascent'}`);assert(Math.abs(p.position.y-(reverse?built.floorY:f.upperY))<.03,`${s.name} ${mode} reverse ${reverse} height ${p.position.y} expected ${reverse?built.floorY:f.upperY}`);
  }
  console.log(s.name,mode,'20 uninterrupted round trips PASS');
 }

}
console.log('V62 all three two-storey houses: actual Player stair ascent PASS');
