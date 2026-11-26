// Native V35 asset gate: inspect each shipped file, not only its manifest.
// Includes actual glTF parsing via the same loader used by the WebGPU runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { assignRigActions, validateRigDefinition } from '../src/land/LandRigRuntime.js';
import { SkinnedModel } from '../src/engine/render/Skinning.js';
import { GPU } from '../src/engine/gpu/GPU.js';

// Stub only the upload boundary. All real joint poses are still evaluated by
// the project's CPU skeletal animation mixer; no WebGPU adapter is simulated.
globalThis.GPUBufferUsage = { STORAGE: 1, COPY_DST: 2, COPY_SRC: 4 };
GPU.device = { createBuffer: () => ( { destroy() {} } ) };
GPU.queue = { writeBuffer() {} };

const cwd = path.dirname( path.dirname( fileURLToPath( import.meta.url ) ) );
const land = path.join( cwd, 'public/models/land' );
const manifest = JSON.parse( fs.readFileSync( path.join( land, 'manifest.json' ), 'utf8' ) );
const required = {
  fox: [ 'idle', 'walk', 'run', 'attack', 'death' ],
  deer: [ 'idle', 'walk', 'run', 'attack', 'death' ],
  boar: [ 'idle', 'walk', 'attack' ],
  hound: [ 'idle', 'walk', 'run', 'attack', 'hit', 'death' ],
  wraith: [ 'idle', 'run', 'attack', 'hit', 'death' ],
  warden: [ 'idle', 'walk', 'run', 'attack', 'hit', 'death' ],
  resident_scout: [ 'idle', 'walk', 'run', 'attack', 'death' ],
  resident_courier: [ 'idle', 'walk', 'run', 'attack', 'death' ],
  resident_watchman: [ 'idle', 'walk', 'run', 'attack', 'death' ],
  resident_apprentice: [ 'idle', 'walk', 'run', 'attack', 'death' ],
};
assert.ok( Object.keys( manifest.actors ).length >= Object.keys( required ).length );
let triangles = 0;
let bytes = 0;
const seenFiles = new Map();
for ( const [ slot, actions ] of Object.entries( required ) ) {
  const item = manifest.actors[ slot ];
  assert.ok( item, `missing GLB actor: ${slot}` );
  assert.deepEqual( validateRigDefinition( item ).ok, true, `${slot}: invalid licensing/scale` );
  assert.ok( /https:\/\//.test( item.attribution ), `${slot}: absent source attribution` );
  assert.ok( item.license === 'CC0' || item.license === 'CC-BY-4.0' );
  const full = path.resolve( land, item.file );
  assert.equal( path.dirname( full ), land );
  const raw = fs.readFileSync( full );
  assert.ok( raw.length > 25000 && raw.length < 10_000_000, `${slot}: unexpected model size` );
  const sha = crypto.createHash( 'sha256' ).update( raw ).digest( 'hex' );
  const cached = seenFiles.get( sha );
  const buffer = raw.buffer.slice( raw.byteOffset, raw.byteOffset + raw.byteLength );
  const gltf = parseGLB( buffer );
  assert.ok( gltf.skins.length >= 1 && gltf.animations.length > 0, `${slot}: no skin/clips` );
  assert.ok( gltf.skins[ 0 ].joints.length >= 16, `${slot}: insufficient skeletal joints` );
  const skinnedNodes = gltf.nodes.filter( node => node.skin === 0 && node.mesh != null );
  assert.ok( skinnedNodes.length, `${slot}: no skinned geometry` );
  const prims = skinnedNodes.flatMap( n => gltf.meshes[ n.mesh ] );
  assert.ok( prims.length > 0 && prims.length <= 12, `${slot}: draw call budget exceeded` );
  for ( const prim of prims ) {
    assert.equal( prim.mode, 4, `${slot}: non-triangle primitive` );
    for ( const key of [ 'POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0' ] )
      assert.ok( prim.attributes[ key ], `${slot}: missing ${key}` );
    const jointIDs = prim.attributes.JOINTS_0.array;
    assert.ok( [...jointIDs].every( x => x < gltf.skins[ 0 ].joints.length ),
      `${slot}: joint index outside skeleton` );
    const weights = prim.attributes.WEIGHTS_0.array;
    assert.ok( [...weights].every( Number.isFinite ), `${slot}: invalid skin weights` );
    triangles += ( prim.indices?.length || prim.attributes.POSITION.array.length / 3 ) / 3;
  }
  for ( const clip of gltf.animations ) {
    assert.ok( Number.isFinite( clip.duration ) && clip.duration > 0, `${slot}: empty clip: ${clip.name}` );
    assert.ok( clip.channels.length > 0, `${slot}: no animation channels: ${clip.name}` );
    assert.ok( clip.channels.every( ch => ch.node < gltf.nodes.length ), `${slot}: invalid animation target` );
  }
  assert.ok( gltf.images.every( img => img.bytes?.byteLength > 0 ), `${slot}: external image` );
  const mapped = assignRigActions( gltf.animations.map( x => x.name ) );
  for ( const action of actions ) assert.ok( mapped[ action ], `${slot}: missing authored action ${action}` );
  const rig = new SkinnedModel( gltf );
  const locomotion = mapped.run || mapped.walk;
  rig.play( locomotion, { fade: .01 } );
  rig.update( .14 );
  const first = rig.jointData.slice( 0, rig.joints * 16 );
  rig.update( .22 );
  const second = rig.jointData.slice( 0, rig.joints * 16 );
  assert.ok( [...second].every( Number.isFinite ), `${slot}: non-finite pose matrices` );
  assert.ok( second.every( ( value ) => Math.abs( value ) < 1000 ), `${slot}: pose explosion` );
  const poseDelta = second.reduce( ( sum, value, i ) => sum + Math.abs( value - first[ i ] ), 0 );
  assert.ok( poseDelta > .002, `${slot}: nominal movement clip does not animate a single joint` );
  rig.dispose();
  if ( !cached ) { seenFiles.set( sha, slot ); bytes += raw.length; }
  console.log( `[V35] ${slot.padEnd( 20 )} ${String(gltf.skins[0].joints.length).padStart(3)} bones, ${String(gltf.animations.length).padStart(2)} clips, ${prims.length} draw call(s), ${actions.length} actions validated` );
}
assert.ok( bytes < 8_000_000, 'V35 runtime external art exceeds 8 MB' );
assert.ok( triangles < 55_000, 'V35 active-actor triangle budget exceeded' );
assert.equal( assignRigActions([ 'Flying_Idle', 'Fast_Flying', 'Punch', 'HitReact', 'Death' ]).idle, 'Flying_Idle' );
assert.equal( assignRigActions([ 'Attack', 'Walk', 'Gallop', 'Idle' ]).run, 'Gallop' );
console.log( `[V35] PASS: 6 creature types + 4 independent village role rigs; ${bytes} raw asset bytes, ${Math.round( triangles )} triangles (unique actor meshes)` );
