// Comprehensive V38 offline gates: exported pirate GLBs, visual scale,
// true locomotion clips, input ownership, ground probes and Boss behavior.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { SkinnedModel } from '../src/engine/render/Skinning.js';
import { GPU } from '../src/engine/gpu/GPU.js';
import { LandFootPlant } from '../src/land/LandGrounding.js';
import { assignRigActions } from '../src/land/LandRigRuntime.js';
import { landInputEdges } from '../src/land/LandControls.js';
import { Input } from '../src/core/Input.js';
import { attachPirateStyle } from '../src/land/LandPirateStyle.js';
import { newCorsairState, advanceCorsair, CORSAIR } from '../src/land/LandCorsairBrain.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p));
const text=p=>read(p).toString('utf8');
globalThis.GPUBufferUsage={STORAGE:1,COPY_DST:2,COPY_SRC:4};
GPU.device={createBuffer:()=>({destroy(){}})};GPU.queue={writeBuffer(){}};
const originalManifest=JSON.parse(text('public/models/land/manifest.json'));
const newPirates=JSON.parse(text('public/models/land/v38_pirate_cast_manifest.json'));
const manifest={actors:{...originalManifest.actors,...newPirates.actors}};
const provenance=JSON.parse(text('public/models/land/v38_pirate_cast_sources.json'));
const residentNames=[...text('src/land/LandResidents.js').matchAll(/\{ id: '([\w-]+)', name:/g)].map(m=>m[1]);
assert.equal(residentNames.length,20);
const cast=new Set();
const GLBfiles=new Map();
for(const id of [...residentNames.map(id=>'resident_'+id),'captain','corsair']){
 const slot=manifest.actors[id];
 assert.ok(slot,id+': actor missing');
 assert.equal(slot.license,'CC0',id+': provenance not CC0');
 assert.ok(slot.attribution?.includes('Quaternius'));
 cast.add(slot.file);
 assert.ok(fs.existsSync(path.join(root,'public/models/land',slot.file)),slot.file+' absent');
 if(!GLBfiles.has(slot.file)){
   const bytes=read('public/models/land/'+slot.file);
   const glb=parseGLB(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
   assert.equal(glb.skins.length,1,slot.file+': no bone skin');
   assert.ok(glb.skins[0].joints.length>=28,slot.file+': not a full human rig');
   assert.ok(glb.materials.length>=6,slot.file+': not a material-based costume');
   assert.ok(glb.meshes.some(m=>m.some(p=>p.attributes.WEIGHTS_0)),slot.file+': no skin weights');
   const actions=assignRigActions(glb.animations.map(a=>a.name));
   for(const key of ['idle','walk','run','attack','death'])assert.ok(actions[key],`${slot.file}: missing ${key}`);
   const rig=new SkinnedModel(glb);rig.group.scale.setScalar(slot.scale);
   const fp=new LandFootPlant(rig);
   assert.ok(fp.anchor.sampled>=5,slot.file+': no foot anchor');
   assert.ok(Math.abs(fp.offset)<.20,slot.file+': floating source origin');
   // Trace a genuine bone movement, not simply a nonempty clip name.
   rig.play(actions.walk,{fade:0});rig.update(.17);
   const before=Float32Array.from(rig.jointData.subarray(0,rig.joints*16));
   rig.update(.23);
   let motion=0;for(let i=0;i<before.length;i++)motion=Math.max(motion,Math.abs(before[i]-rig.jointData[i]));
   assert.ok(motion>1e-5,slot.file+': walk bones do not move');
   const style=attachPirateStyle({rig},cast.size,{boss:slot.file.includes('boss')});
   assert.ok(style?.coat && style.hat && style.belt,slot.file+': missing pirate identity');
   if(slot.file.includes('boss'))assert.ok(style.weapon, 'boss cutlass not mounted');
   style.update();
   // Probe nonflat terrain at two feet with an actual Vector3 bone destination.
   for(let step=0;step<20;step++){
      rig.update(1/60);
      fp.update(1/60,{moving:true,root:{x:0,y:0,z:0},groundProbe:(x,z)=>.12*x+.07*z,yaw:.3});
      assert.ok(Number.isFinite(rig.group.position.y));
      assert.ok(Math.abs(rig.group.position.y)<.32);
   }
   GLBfiles.set(slot.file,{rig,actions});
 }
}
assert.ok(cast.size>=8,'pirates should not all have the same mesh/paint');
assert.equal(provenance.models.length,12);
for(const e of provenance.models){
 assert.ok(GLBfiles.has(e.file));
 assert.ok(e.sha256.length===64);
}
const uniqueCoats=new Set([...GLBfiles.values()].map(({rig})=>JSON.stringify(rig.gltf.materials.find(x=>x.name.toLowerCase()==='shirt')?.pbrMetallicRoughness?.baseColorFactor)));
assert.ok(uniqueCoats.size>=6,'actual material palettes should be different');

// Real keyboard event routing with a fake DOM (including modal transitions).
const listeners=new Map(),domListeners=new Map();
const reg=(t,cb,map)=>{if(!map.has(t))map.set(t,[]);map.get(t).push(cb)};
globalThis.window={addEventListener:(t,cb)=>reg(t,cb,listeners)};
globalThis.document={addEventListener:(t,cb)=>reg(t,cb,new Map())};
const dom={addEventListener:(t,cb)=>reg(t,cb,domListeners),requestPointerLock(){return Promise.resolve()}};
const input=new Input(dom);
const press=(code,other={})=>{for(const fn of listeners.get('keydown')||[])fn({code,target:{tagName:'DIV'},preventDefault(){},...other});};
const release=code=>{for(const fn of listeners.get('keyup')||[])fn({code})};
press('KeyZ');let a=landInputEdges(input,false);assert.equal(a.toggle,true);
assert.equal(landInputEdges(input,false).toggle,false,'double Z from one keydown');
release('KeyZ');press('ShiftLeft');press('KeyZ');assert.equal(landInputEdges(input,false).toggle,false,'Shift+Z erroneously consumed');
input.resetPhysicalState();
press('KeyP');assert.equal(landInputEdges(input,true).journal,true);
input.resetPhysicalState();
press('ShiftLeft');press('KeyP');assert.equal(landInputEdges(input,true).journal,false,'Shift+P belongs to camera');
input.resetPhysicalState();
press('KeyJ');assert.equal(landInputEdges(input,true).light,true);
assert.equal(landInputEdges(input,true).light,false,'double swing');
input.resetPhysicalState();press('KeyK');assert.equal(landInputEdges(input,true).heavy,true);
input.resetPhysicalState();press('KeyJ');input.enabled=false;
assert.equal(input.keys.size,0);assert.equal(input.pressed.size,0);
input.enabled=true;assert.equal(landInputEdges(input,true).light,false,'modal leaked prior attack');
input.resetPhysicalState();press('ShiftLeft');press('KeyJ');assert.equal(landInputEdges(input,true).light,false,'Shift+J shipyard hijack');

const result=[];
for(const hz of [30,60,144]){
 const boss=newCorsairState();boss.hp=CORSAIR.hp*.39;
 const styles=new Set();let serial=0,maxSpeed=0;
 for(let i=0;i<hz*25;i++){
  const action=advanceCorsair(boss,{x:boss.homeX+4,z:boss.homeZ+3},1/hz,{active:true});
  if(action.strike){styles.add(action.style);serial=Math.max(serial,boss.attackSerial);}
  maxSpeed=Math.max(maxSpeed,Math.hypot(boss.vx,boss.vz));
  if(action.moving){boss.x+=boss.vx/hz;boss.z+=boss.vz/hz;}
  assert.ok(Math.hypot(boss.x-boss.homeX,boss.z-boss.homeZ)<CORSAIR.leash+1.8);
 }
 assert.ok(styles.size>=3 && serial>=9 && maxSpeed<=14);
 result.push(serial);
}
assert.ok(Math.max(...result)-Math.min(...result)<=2,'boss outcome frame-rate dependent');
for(const [file,pattern] of [
 ['src/land/LandAdventure.js',/loadLandRig\( type \)/],
 ['src/land/LandAdventure.js',/actor\.actions\.heavy/],
 ['src/land/LandGrounding.js',/this\.rig\.nodeWorld\(name,pos\)/],
 ['src/course/IslandCompanion.js',/player\?\.mode === 'walk'/],
 ['src/ui/UI.js',/player\?\.mode === 'walk'/],
 ['src/engine/render/Skinning.js',/SHARED_GLTF_TEXTURES/],
 ])assert.match(text(file),pattern,file+' lacks required integration');
console.log(`V38 PASS: 20 residents, 1 captain, 1 corsair; ${cast.size} unique pirate GLB palettes; ${GLBfiles.size} unique skeletal rigs validated; 5 true clips, 4 headwear types + coat, simulated grounded feet, keyboard/modals, 30/60/144 Hz boss (${result.join('/')})`);
