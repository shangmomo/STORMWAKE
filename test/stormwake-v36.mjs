// V36: enforce *content* rather than just filename and clip-name presence.
// This tests the engine's own GLB parser and animation evaluator, but does not
// pretend that CPU tests constitute actual browser/WebGPU visual acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { SkinnedModel } from '../src/engine/render/Skinning.js';
import { assignRigActions, validateRigDefinition } from '../src/land/LandRigRuntime.js';
import { makeStrikeWindow, strikeActive, sweptBladeContact, strikeLineBlocked } from '../src/land/LandCombatTiming.js';
import { GPU } from '../src/engine/gpu/GPU.js';
import { Colliders } from '../src/world/Colliders.js';
import { Vector3 } from '../src/engine/index.js';

const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..' );
const manifest = JSON.parse( fs.readFileSync( path.join( root, 'public/models/land/manifest.json' ), 'utf8' ) );
const roles = [ 'captain', ...[ 'harbor', 'herbalist', 'keeper', 'netmaker', 'merchant', 'fisher', 'baker',
  'scout', 'medic', 'sailor', 'carpenter', 'shipwright', 'cartographer', 'watchman', 'teacher',
  'courier', 'gardener', 'smith', 'apprentice', 'bellringer' ].map( x => 'resident_' + x ),
  'warden', 'hound', 'crab', 'wraith', 'fox', 'deer', 'boar' ];
assert.equal( roles.length, 28 );
for ( const role of roles ) assert.ok( manifest.actors[ role ], `${role}: absent from manifest` );
assert.deepEqual( Object.keys( manifest.actors ).sort(), roles.sort(), 'unexpected or unused role entries' );

globalThis.GPUBufferUsage = { STORAGE:1, COPY_DST:2, COPY_SRC:4 };
GPU.device = { createBuffer:() => ({ destroy(){} }) };
GPU.queue = { writeBuffer(){} };

const perRole = { captain:[ 'idle','walk','run','attack','heavy','dodge','hit','death' ],
  warden:[ 'idle','walk','run','attack','hit','death' ],
  hound:[ 'idle','walk','run','attack','hit','death' ],
  crab:[ 'idle','walk','run','attack','hit','death' ],
  wraith:[ 'idle','run','attack','hit','death' ],
  fox:[ 'idle','walk','run' ], deer:[ 'idle','walk','run' ], boar:[ 'idle','walk','run' ] };
const required = role => role.startsWith( 'resident_' ) ? [ 'idle','walk','talk' ] : perRole[ role ];
const sources = new Map();
let uniqueBytes = 0;
let uniqueTriangles = 0;
let totalActions = 0;
for ( const role of roles ) {
  const entry = manifest.actors[ role ];
  const validated = validateRigDefinition( entry );
  assert.ok( validated.ok, `${role}: ${validated.reason}` );
  assert.ok( entry.attribution?.length > 12, `${role}: missing license provenance` );
  const directory = entry.collection === 'characters' ? 'characters' : 'land';
  const filepath = path.join( root, 'public/models', directory, entry.file );
  assert.equal( path.dirname( filepath ), path.join( root, 'public/models', directory ), `${role}: path escape` );
  let asset = sources.get( filepath );
  if ( !asset ) {
    const binary = fs.readFileSync( filepath );
    assert.ok( binary.length > 4096 && binary.length < 14e6, `${role}: suspicious file size` );
    const ab = binary.buffer.slice( binary.byteOffset, binary.byteOffset + binary.byteLength );
    const gltf = parseGLB( ab );
    assert.ok( gltf.skins.length === 1, `${role}: multi-skin not supported by renderer` );
    const boneCount = gltf.skins[0].joints.length;
    assert.ok( boneCount >= 24, `${role}: weak or missing skeleton` );
    const prims = gltf.nodes.filter( n => n.skin === 0 && n.mesh !== undefined ).flatMap( n => gltf.meshes[n.mesh] );
    assert.ok( prims.length >= 1 && prims.length <= 16, `${role}: unreasonable draw-call budget` );
    let tri = 0;
    for ( const primitive of prims ) {
      assert.equal( primitive.mode, 4, `${role}: only triangle meshes supported` );
      for ( const attr of [ 'POSITION','NORMAL','JOINTS_0','WEIGHTS_0' ] ) {
        assert.ok( primitive.attributes[attr], `${role}: missing ${attr}` );
        assert.ok( [...primitive.attributes[attr].array].every( Number.isFinite ), `${role}: NaN in ${attr}` );
      }
      const mat = gltf.materials[primitive.material] || {};
      if ( mat.pbrMetallicRoughness?.baseColorTexture || mat.pbrMetallicRoughness?.metallicRoughnessTexture || mat.normalTexture )
        assert.ok( primitive.attributes.TEXCOORD_0, `${role}: textured mesh lacks UVs` );
      const joints = primitive.attributes.JOINTS_0.array;
      const weights = primitive.attributes.WEIGHTS_0.array;
      assert.equal( weights.length, joints.length, `${role}: invalid skin stride` );
      for ( let i=0; i<weights.length; i+=4 ) {
        let sum = 0;
        for ( let j=0; j<4; j++ ) {
          if ( weights[i+j] > .00001 ) assert.ok( joints[i+j] < boneCount, `${role}: out-of-bounds joint` );
          assert.ok( weights[i+j] >= 0 && weights[i+j] <= 1.001, `${role}: invalid weight` );
          sum += weights[i+j];
        }
        assert.ok( Math.abs( sum - 1 ) <= .015, `${role}: skin weight not normalized` );
      }
      tri += (primitive.indices?.length || primitive.attributes.POSITION.array.length / 3) / 3;
    }
    const rig = new SkinnedModel( gltf );
    asset = { gltf, rig, mapped:assignRigActions( gltf.animations.map( a => a.name ) ), bones:boneCount, triangles:tri };
    sources.set( filepath, asset );
    uniqueBytes += binary.length;
    uniqueTriangles += tri;
  }
  for ( const name of required(role) ) {
    const clip = asset.mapped[name];
    assert.ok( clip, `${role}: no mapped ${name}` );
    assert.ok( asset.rig.clipDuration( clip ) > .15, `${role}: near-empty ${name} clip` );
    totalActions++;
  }
  if (role==='crab') {
    assert.ok( asset.bones>=34, 'original crab skeleton lost articulation' );
    assert.ok( asset.triangles > 5000, 'crab lost detailed pincers and legs' );
    assert.ok( asset.gltf.materials.length >= 4, 'crab lost distinct shell/limb material layers' );
  }
  if ( role === 'captain' || role.startsWith('resident_') ) {
    assert.ok( asset.rig.clipNames().includes('idle_neutral_01') || asset.rig.clipNames().some(n=>n.endsWith('Man_Idle')),
      `${role}: replaced original gestures rather than preserving them` );
  }
  console.log(`[V36] ${role.padEnd(23)} ${String(asset.bones).padStart(2)} bones, ${required(role).length} required clips`);
}

// Verify every important action in every distinct asset has real movement.
// Evaluating the application's skeletal CPU mixer detects broken quaternion
// streams and stationary clips concealed behind convincing names.
for ( const [ filename, asset ] of sources ) {
  const { rig, mapped } = asset;
  const keys = [ 'walk', 'run', 'attack', 'hit', 'death', 'talk', 'dodge', 'heavy' ].filter( k => mapped[k] );
  for ( const action of keys ) {
    const name = mapped[action], duration = rig.clipDuration(name);
    rig.layers = [];
    rig.play( name, { fade: .001, loop: false } );
    rig.update( 0 );
    const before = rig.jointData.slice( 0, rig.joints*16 );
    rig.update( Math.min( duration*.29, .29 ) );
    const middle = rig.jointData.slice( 0, rig.joints*16 );
    rig.update( Math.min( duration*.25, .25 ) );
    const after = rig.jointData.slice( 0, rig.joints*16 );
    assert.ok( [...after].every( Number.isFinite ), `${filename}: ${action}: NaN animation` );
    assert.ok( [...after].every( n => Math.abs(n)<2e4 ), `${filename}: ${action}: extreme exploded pose` );
    const delta = before.reduce( ( s,v,i ) => s + Math.abs( v-middle[i] ) + Math.abs( middle[i]-after[i] ), 0 );
    assert.ok( delta>.001, `${filename}: ${action}: static fake animation (${delta})` );
  }
  rig.dispose();
}

// Deterministic phase, direction, range and one-hit-per-target geometry tests.
const light = { ...makeStrikeWindow(false),heavy:false,reach:3.15,age:0,previousAge:0 };
const attacker = {x:0,y:1,z:0},forward={x:0,z:1};
const front={x:0,y:1,z:2},behind={x:0,y:1,z:-2},far={x:0,y:1,z:8};
assert.ok( !strikeActive(light) && !sweptBladeContact(light,attacker,forward,front), 'windup must not hit' );
light.previousAge=.16; light.age=.21;
assert.ok( strikeActive(light) && sweptBladeContact(light,attacker,forward,front), 'swept blade misses front target' );
assert.ok( !sweptBladeContact(light,attacker,forward,behind), 'blade hits behind user' );
assert.ok( !sweptBladeContact(light,attacker,forward,far), 'blade hits out-of-range target' );
light.previousAge=.30;light.age=.35;
assert.ok( !strikeActive(light) && !sweptBladeContact(light,attacker,forward,front), 'recovery hits target' );
const heavy={...makeStrikeWindow(true),heavy:true,reach:4.1,previousAge:.27,age:.34};
assert.ok( sweptBladeContact(heavy,attacker,forward,{x:0,y:1,z:3.8},.9), 'heavy not longer than light' );
assert.ok( !sweptBladeContact(heavy,attacker,forward,{x:0,y:8,z:3.0},.9), 'vertical separation ignored' );

const origin={x:0,y:1,z:0}, dest={x:0,y:1,z:2};
const walls = new Colliders();
assert.ok(!strikeLineBlocked(walls,origin,dest), 'false positive: empty world blocks hit');
walls.addBox(new Vector3(0,1,1),new Vector3(.4,.8,.2),0,{solid:true});
assert.ok(strikeLineBlocked(walls,origin,dest), 'wall penetration allowed');
const posts = new Colliders();
posts.addCylinder(0,1,.22,0,2,{solid:true});
assert.ok(strikeLineBlocked(posts,origin,dest), 'cylinder penetration allowed');
const farPosts = new Colliders();
farPosts.addCylinder(2,1,.22,0,2,{solid:true});
assert.ok(!strikeLineBlocked(farPosts,origin,dest), 'off-axis post blocks hit');

// Actually instantiate generated crab materials through the real renderer path.
const crabFile = path.join(root,'public/models/land/crab.glb');
const crabAsset = sources.get(crabFile);
const crabInstance = await SkinnedModel.create(crabAsset.gltf);
assert.equal(crabInstance.materials.length,6,'render path discarded eye/teeth/shell material layers');
assert.ok(crabInstance.materials.every(m=>m.color && Number.isFinite(m.color.r)), 'PBR colors not forwarded to renderer');
crabInstance.dispose();

assert.ok( uniqueBytes < 19e6, 'V36 active characters+creature assets exceed 19 MB' );
assert.ok( uniqueTriangles < 110_000, 'V36 unique actor triangles exceed 110k' );
// Reuse the same rigorous manifest/keyword gate without changing its requirements.
execFileSync( 'python', [ 'tools/audit_land_v33.py', '--strict' ], {cwd:root, stdio:'pipe'} );
console.log(`[V36] PASS: ${roles.length} roles, ${sources.size} real files, ${totalActions} declared action slots, ${uniqueBytes} unique bytes, ${Math.round(uniqueTriangles)} unique triangles, pose + combat timing`);
