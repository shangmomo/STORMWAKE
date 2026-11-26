// V37: source-model grounding, action ownership, native pirate accessories,
// 30/60/144 Hz corsair simulation and large-island region checkpoints.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { SkinnedModel } from '../src/engine/render/Skinning.js';
import { GPU } from '../src/engine/gpu/GPU.js';
import { LandFootPlant, groundSurface, followGround } from '../src/land/LandGrounding.js';
import { attachPirateStyle } from '../src/land/LandPirateStyle.js';
import { LAND_REGIONS, makeRegionWaypoint } from '../src/land/LandRegionWaypoints.js';
import { CORSAIR, newCorsairState, advanceCorsair } from '../src/land/LandCorsairBrain.js';
import { landInputEdges } from '../src/land/LandControls.js';
import { restoreLandSave } from '../src/land/LandLogic.js';
import { createCorsairArena } from '../src/land/LandCorsairArena.js';

const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
globalThis.GPUBufferUsage={STORAGE:1,COPY_DST:2,COPY_SRC:4};
GPU.device={createBuffer:()=>({destroy(){}})};GPU.queue={writeBuffer(){}};
const files=['public/models/characters/joe.glb','public/models/characters/marta.glb',
  'public/models/land/resident_scout.glb','public/models/land/warden.glb'];
const rigs=[];
for(const file of files){
 const b=fs.readFileSync(path.join(dir,file));
 const glb=parseGLB(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
 const rig=new SkinnedModel(glb);
 const ground=new LandFootPlant(rig);
 assert.ok(ground.anchor.sampled>=5,file+': missing skinned foot vertices');
 // A loaded feet-origin model must have its sole near local ground, not 1m up.
 assert.ok(Math.abs(ground.anchor.restY+ground.offset/rig.group.scale.y)<.06,file+': feet float');
 assert.ok(ground.offset<.25,file+': suspicious legacy 1m lift');
 for(let i=0;i<4;i++){
  const style=attachPirateStyle({rig},i);
  assert.ok(style?.head && style?.hip,file+': missing humanoid head/waist');
  style.update();
  assert.ok(Number.isFinite(style.hat.position.y) && style.hat.children.length===1);
  rig.group.remove(style.hat);rig.group.remove(style.belt);
 }
 rig.play(rig.clipNames()[0],{fade:.01});rig.update(1/30);
 ground.update(1/30);
 assert.ok(Number.isFinite(rig.group.position.y));
 rigs.push(rig);
}
const terrain={heightAt:()=>1.0},colliders={groundHeightAt:(x,z,maxY)=>maxY>=1.55?1.55:-Infinity};
assert.equal(groundSurface(terrain,colliders,0,0,1.55),1.55);
assert.equal(groundSurface(terrain,colliders,0,0,NaN),1.55);
assert.equal(followGround(2,1,1/60,{snapDistance:.8}),1);
assert.ok(followGround(1,1.4,1/60)>1 && followGround(1,1.4,1/60)<1.4);

function mockInput(shift){const pressed=new Set(['KeyP','KeyJ','KeyK']);return{
 pressed,mouseDown:false,rightDown:false,down:k=>shift&&k==='ShiftLeft',
 consume:k=>pressed.delete(k)};}
assert.equal(landInputEdges(mockInput(true),true).journal,false,'Shift+P must not open journal');
assert.equal(landInputEdges(mockInput(false),true).journal,true,'plain P opens journal');
assert.equal(landInputEdges(mockInput(true),true).light,false,'Shift+J must not swing sword');
assert.equal(landInputEdges(mockInput(false),true).heavy,true,'K must trigger heavy sword');
assert.equal(restoreLandSave({stage:4}).stage,4,'existing save protocol changed');
assert.equal('corsairDefeated' in restoreLandSave({}),false,'V37 side quest must not alter V31 schema');

assert.equal(LAND_REGIONS.length,7);
for(const d of LAND_REGIONS){const marker=makeRegionWaypoint(d,terrain);
 assert.ok(marker.children[0].geometry.attributes.position.count>150);
 assert.ok(Math.hypot(marker.position.x-CORSAIR.arena.x,marker.position.z-CORSAIR.arena.z)>=0);
}
const arena=createCorsairArena(CORSAIR.arena.x,1,CORSAIR.arena.z,(x,z)=>1+.13*(x-CORSAIR.arena.x));
assert.ok(arena.children[0].geometry.attributes.position.count>1000,'arena needs actual geometry');
const v=arena.children[0].geometry.attributes.position.array;
assert.ok(v.every(Number.isFinite),'terrain-draped arena produced invalid geometry');
function simulation(fps){const e=newCorsairState(),target={x:e.x+4,z:e.z+3};
 const states=new Set(),actions=new Set();let strikes=0, maxLeash=0;
 for(let i=0;i<fps*24;i++){
  const r=advanceCorsair(e,target,1/fps,{active:true});
  states.add(e.state);if(r.strike){strikes++;actions.add(e.attackStyle);}
  if(r.moving){e.x+=e.vx/fps;e.z+=e.vz/fps;}
  maxLeash=Math.max(maxLeash,Math.hypot(e.x-e.homeX,e.z-e.homeZ));
  assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.z),'Boss teleported into NaN');
  assert.ok(r.speed===undefined||r.speed<16,'Boss velocity exceeded limit');
 }
 return {e,states,actions,strikes,maxLeash};
}
const sims=[30,60,144].map(simulation);
for(const s of sims){
 for(const x of ['circle','telegraph','recover','lunge'])assert.ok(s.states.has(x),'boss did not reach '+x);
 assert.ok(s.actions.has('cutlass') && s.actions.has('lunge') && s.actions.has('whirl'));
 assert.ok(s.maxLeash<=CORSAIR.leash+1.2,'boss crossed arena leash');
 assert.ok(s.e.attackSerial>=9,'boss performs too few attack chains');
}
assert.ok(Math.abs(sims[0].e.attackSerial-sims[1].e.attackSerial)<=2);
assert.ok(Math.abs(sims[1].e.attackSerial-sims[2].e.attackSerial)<=2);
const weaken=newCorsairState();weaken.hp=CORSAIR.hp*.35;
const fast=advanceCorsair(weaken,{x:weaken.x+5,z:weaken.z+1},1/60,{active:true});
assert.equal(fast.phase,2,'weak boss did not enter second phase');
const snapshot=fs.readFileSync(path.join(dir,'src/land/LandAdventure.js'),'utf8');
assert.match(fs.readFileSync(path.join(dir,'src/islandlife/Shipyard.js'),'utf8'),/combatLocked/,'shipyard still captures combat keys');
assert.match(snapshot,/lastDamageSerial !== e\.attackSerial/,'boss could damage repeatedly within single strike');
assert.match(snapshot,/strikeLineBlocked\(this\.app\.colliders/,'boss strike ignores walls');
assert.match(snapshot,/buildExpeditionCave/,'boss arena missing from runtime');
assert.match(fs.readFileSync(path.join(dir,'src/App.js'),'utf8'),/wantsLandInteraction/,'E ownership not checked before player movement');
console.log(`V37 PASS: ${files.length} unique grounded GLBs, 4 pirate hat styles, 7 region landmarks, input exclusivity, sidequest save isolation, 30/60/144Hz boss AI (${sims.map(s=>s.e.attackSerial).join('/')})`);
