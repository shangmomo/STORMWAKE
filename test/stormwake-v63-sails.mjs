import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseGLB} from '../src/engine/loaders/GLTF.js';
import {BufferAttribute,BufferGeometry} from '../src/engine/index.js';
import {SailReefing} from '../src/ship/SailReefing.js';
const bytes=readFileSync(new URL('../public/models/stormwake_v62/dutch_ship_lower_hold.glb',import.meta.url)),gltf=parseGLB(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),primitive=gltf.meshes[2][0],g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(primitive.attributes.POSITION.array),3));g.setIndex(new BufferAttribute(primitive.indices,1));const reef=new SailReefing(g);assert.equal(reef.panels.length,4,'actual source contains four individual canvases');
reef.set(0,1);for(const panel of reef.panels){for(const i of panel.vertices){const y=g.attributes.position.array[i*3+1],rest=reef.rest[i*3+1];assert.ok(y<=panel.top+1e-5);if(panel.z>4)assert.ok(Math.abs(y-rest)<1e-5,'jib remains deployed');else assert.ok(Math.abs(panel.top-y-(panel.top-rest)*.035)<1e-5,'main canvas folds at its own yard');}}
reef.set(1,1);for(let i=0;i<reef.rest.length;i++)assert.ok(Math.abs(g.attributes.position.array[i]-reef.rest[i])<1e-5,'restored canvas retains original source coordinates');assert.ok([...g.attributes.normal.array].every(Number.isFinite));const version=g.attributes.position.version;reef.set(1,1);assert.equal(g.attributes.position.version,version,'static cloth is not reuploaded every frame');
console.log('V63 actual Dutch canvas: four separate cloth islands, independent main/jib reefing, fixed yard heights, finite normals and exact original restoration PASS');
