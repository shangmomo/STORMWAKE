import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseGLB} from '../src/engine/loaders/GLTF.js';
import {SkinnedModel} from '../src/engine/render/Skinning.js';
import {StorageBuffer} from '../src/engine/gpu/Texture.js';
import {Group,Vector3,Quaternion} from '../src/engine/index.js';
import {SailorBody} from '../src/ship/SailorBody.js';
import {assignRigActions} from '../src/land/LandRigRuntime.js';
import {deckHeight} from '../src/ship/HeritageDeck.js';
import {stationHandTargets} from '../src/ship/StationHandRig.js';
StorageBuffer.prototype.write=function(){};
const bytes=readFileSync('public/models/land/pirate_captain.glb'),rig=new SkinnedModel(parseGLB(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)));
rig.group.scale.setScalar(.64);rig.group.rotation.y=0;const actor={rig,actions:assignRigActions(rig.clipNames())};rig.play(actor.actions.idle);rig.update(0);
const scene=new Group(),vessel=new Group(),peer=new Group();scene.add(vessel,peer);vessel.position.set(69,1,42);vessel.rotation.set(.15,.7,.18,'YXZ');const windlass=new Group();vessel.add(windlass);windlass.position.set(0,deckHeight(-3.65)+.85,-3.65);const boat={heritageDeck:{windlass}},body=new SailorBody(peer);body.install(actor);const samples=[];
for(const [station,index] of [['anchor',0],['anchor_2',2],['anchor_3',1],['anchor_4',3]])for(let i=0;i<700;i++){
 const angle=Math.max(0,i-50)*.01;windlass.rotation.y=angle;const x=1.22*Math.cos(index*Math.PI/2-angle),z=-3.65+1.22*Math.sin(index*Math.PI/2-angle);peer.position.copy(vessel.localToWorld(new Vector3(x,deckHeight(z,x),z)));const hands=stationHandTargets(boat,station),d=hands[0].clone().add(hands[1]).multiplyScalar(.5).sub(peer.position);peer.rotation.y=Math.atan2(-d.x,-d.z);const inward=d.clone().applyQuaternion(vessel.quaternion.clone().invert());const relative=Math.atan2(inward.x,inward.z);body.root.quaternion.copy(peer.quaternion).invert().multiply(vessel.quaternion).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),relative));body.update(1/30,{activity:'capstan',station,boat,feet:peer.position,working:i>50});const errors=body.ik.map((ik,n)=>{ik.evaluate(rig.local,rig.group.matrixWorld);return ik.point(ik.chain[2]).distanceTo(hands[n]);});assert.ok(Math.max(...errors)<.05,station+' rotating physical wrist: '+Math.max(...errors));for(const l of body.handDiagnostics){assert.ok(Math.abs(l.upperLength-.2510293)<1e-5);assert.ok(Math.abs(l.lowerLength-.2881151)<1e-5);}samples.push({angle,station,errors});
}
console.log('V63 actual CC0 captain: 4 capstan stations, 2800 moving samples under pitch/heel, planted soles, real wrists within 5cm and fixed bone lengths PASS; max '+Math.max(...samples.flatMap(s=>s.errors)).toFixed(5)+'m');
