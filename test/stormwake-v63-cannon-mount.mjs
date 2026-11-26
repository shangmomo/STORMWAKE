import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseGLB} from '../src/engine/loaders/GLTF.js';
import {Group,Vector3} from '../src/engine/index.js';
import {cannonDirection} from '../src/ship/CannonBallistics.js';
import {aimCannonMount,cannonMuzzle} from '../src/ship/CannonMount.js';
const load=name=>{const b=readFileSync(new URL('../public/models/'+name,import.meta.url));return parseGLB(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const original=load('stormwake_v62/kenney_cannon.glb'),gltf=load('stormwake_v63/cannon_articulated.glb');
const base=gltf.meshes[0][0],barrelPrimitive=gltf.meshes.at(-1)[0],source=original.meshes[0][0];
assert.deepEqual(base.attributes.POSITION.array,source.attributes.POSITION.array);assert.deepEqual(barrelPrimitive.attributes.TEXCOORD_0.array,source.attributes.TEXCOORD_0.array);assert.equal(barrelPrimitive.indices.length,420);assert.equal(base.indices.length,168);
assert.deepEqual([...base.indices,...barrelPrimitive.indices].sort((a,b)=>a-b),[...source.indices].sort((a,b)=>a-b));
for(const id of ['cannon_port','cannon_starboard']){
 const side=id==='cannon_port'?1:-1,ship=new Group(),metric=new Group(),marker=new Group(),tube=new Group(),placement=new Group();
 ship.position.set(120,2,740);ship.rotation.set(.18,.65,-.22,'YXZ');ship.scale.set(2.05,2.45,2.85);metric.scale.set(1/2.05,1/2.45,1/2.85);ship.add(metric);metric.add(marker);marker.position.set(side*1.35,.89,1.3);marker.add(tube);tube.position.y=.17;tube.add(placement);placement.rotation.y=side*Math.PI/2;placement.scale.setScalar(.45);
 const groups=gltf.nodes.map(n=>{const g=new Group();g.name=n.name;g.position.fromArray(n.t);g.quaternion.fromArray(n.r);g.scale.fromArray(n.s);return g;});gltf.nodes.forEach((n,i)=>{for(const child of n.children)groups[i].add(groups[child]);});for(const index of gltf.roots)placement.add(groups[index]);
 const barrel=placement.getObjectByName('CannonBarrelPitch'),muzzle=placement.getObjectByName('CannonMuzzle');marker.userData={tube,cannonSide:side,cannonRig:{barrel,muzzle,scale:.45}};
 const restBarrel=groups[gltf.nodes.findIndex(n=>n.name==='OriginalBarrelGeometry')];assert.ok(restBarrel.localToWorld(new Vector3(0,.6450074017047882,.9906570911407471)).distanceTo(cannonMuzzle(marker))<1e-6,'source geometry retains its rest pose and real muzzle centre');
 for(let i=0;i<80;i++){
  const aimYaw=side*Math.PI/2+Math.sin(i*.2),pitch=-.14+i*.008,direction=cannonDirection(id,.65,aimYaw,pitch,ship.quaternion);aimCannonMount(marker,direction);
  const tip=cannonMuzzle(marker),axis=barrel.localToWorld(new Vector3()).sub(tip).normalize().negate(),expected=new Vector3(direction.x,direction.y,direction.z);assert.ok(axis.distanceTo(expected)<1e-6,'visible barrel axis equals full pitch/heel ballistic direction');
  const wheel=groups[1].getWorldPosition(new Vector3()),barrelBefore=cannonMuzzle(marker);aimCannonMount(marker,direction,.48);const after=cannonMuzzle(marker),recoil=barrelBefore.clone().sub(after);assert.ok(recoil.clone().normalize().distanceTo(expected)<1e-6,'recoil moves along the barrel');assert.ok(Math.abs(recoil.length()-.48*.16)<1e-6);assert.ok(wheel.distanceTo(groups[1].getWorldPosition(new Vector3()))<1e-6,'wheels and carriage cannot pitch or recoil with barrel');
 }
}
console.log('V63 actual Kenney cannon: all source triangles/UVs retained, 160 traversed/elevated shots under scaled/pitched/heeled ship, real muzzle alignment, axial recoil and stationary carriage PASS');
