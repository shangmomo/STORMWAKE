import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseGLB} from '../src/engine/loaders/GLTF.js';
import {RigTwoBoneIK} from '../src/ship/RigTwoBoneIK.js';
import {inferPirateForward} from '../src/land/LandRigRuntime.js';
import {Matrix4,Vector3} from '../src/engine/index.js';
const manifest=JSON.parse(readFileSync(new URL('../public/models/land/v38_pirate_cast_manifest.json',import.meta.url))),files=new Set();let corrected=0;
for(const entry of Object.values(manifest.actors)){if(files.has(entry.file))continue;files.add(entry.file);const b=readFileSync(new URL('../public/models/land/'+entry.file,import.meta.url)),gltf=parseGLB(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),rig={gltf},matrices=new RigTwoBoneIK(rig,['UpperArm.L','UpperArm.R','Head']);matrices.evaluate(gltf.nodes,new Matrix4());rig.nodeWorld=(name,out)=>{const index=gltf.nodes.findIndex(n=>n.name===name);return index<0?null:out.copy(matrices.point(index));};const angle=inferPirateForward(rig,entry),left=rig.nodeWorld('UpperArm.L',new Vector3()),right=rig.nodeWorld('UpperArm.R',new Vector3());if(!left||!right)continue;left.applyAxisAngle(new Vector3(0,1,0),angle);right.applyAxisAngle(new Vector3(0,1,0),angle);assert.ok(left.x>right.x,'anatomical left is +X for a +Z-facing Y-up actor: '+entry.file);if(angle)corrected++;assert.equal(inferPirateForward(rig,{...entry,yawOffset:1}),0,'explicit artist alignment remains authoritative');}
assert.equal(corrected,0,'bundled +Z-facing bodies must retain their authored front');console.log('V63 bundled humanoid forward basis: measured left/right shoulders, retained authored forward basis, rigid rotation only and explicit asset offset preserved PASS ('+files.size+' distinct models)');
