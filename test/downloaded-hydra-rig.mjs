import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { SkinnedModel } from '../src/engine/render/Skinning.js';
import { GPU } from '../src/engine/gpu/GPU.js';
import { Vector3 } from '../src/engine/index.js';
import { attachTitanSkeleton, updateTitanSkeleton } from '../src/oceanhunt/TitanSkeleton.js';

const read = path => { const b = readFileSync( new URL( path, import.meta.url ) ); return parseGLB( b.buffer.slice( b.byteOffset, b.byteOffset + b.byteLength ) ); };
const original = read( '../public/models/titans/abyssal-hydra.glb' );
const rig = read( '../public/models/titans/rigged/downloaded-hydra-skeleton.glb' );
const source = original.meshes[ 0 ][ 0 ], mesh = rig.meshes[ 0 ][ 0 ];
assert.deepEqual( mesh.attributes.POSITION.array, source.attributes.POSITION.array, 'source mesh must be preserved' );
assert.deepEqual( mesh.indices, source.indices, 'source triangles must be preserved' );
assert.deepEqual( mesh.attributes.TEXCOORD_0.array, source.attributes.TEXCOORD_0.array, 'source UVs must be preserved' );
assert.equal( rig.images.length, original.images.length );
assert.equal( rig.skins[ 0 ].joints.length, 90 );
for ( const part of [ 'C_0', 'C_8', 'C_17', 'C_Head', 'L_0', 'L_8', 'L_17', 'L_Head', 'R_0', 'R_8', 'R_17', 'R_Head' ] ) assert.ok( rig.nodes.some( n => n.name === part ), part );
const j = mesh.attributes.JOINTS_0.array, w = mesh.attributes.WEIGHTS_0.array;
const totals = Array( 90 ).fill( 0 );
for ( let i = 0; i < j.length; i += 4 ) {
	assert.ok( Math.abs( w[ i ] + w[ i + 1 ] + w[ i + 2 ] + w[ i + 3 ] - 1 ) < 1e-5 );
	for ( let k = 0; k < 4; k ++ ) totals[ j[ i + k ] ] += w[ i + k ];
}
for ( const label of [ 'C', 'L', 'R' ] ) for ( const n of [ 0, 8, 17, 'Head' ] ) {
	const joint = rig.skins[ 0 ].joints.findIndex( i => rig.nodes[ i ].name === `${ label }_${ n }` );
	assert.ok( totals[ joint ] > 1, `${ label }_${ n } must deform vertices` );
}
globalThis.GPUBufferUsage = { STORAGE: 1, COPY_DST: 2, COPY_SRC: 4 };
GPU.device = { createBuffer: () => ( { destroy() {} } ) };
GPU.queue = { writeBuffer() {} };
const model = new SkinnedModel( rig ); model.update( 0 );
// Every bind matrix should be identity before animation, so the source mesh
// does not jump or deform when the skinned asset first loads.
for ( let k = 0; k < model.joints; k ++ ) for ( let i = 0; i < 16; i ++ ) assert.ok( Math.abs( model.jointData[ k * 16 + i ] - ( i % 5 === 0 ? 1 : 0 ) ) < 1e-5 );
const asset = { skeleton: model, root: model.group }; assert.equal( attachTitanSkeleton( asset ), true );
assert.equal( asset.hydraHeads.length, 3 );
assert.ok( asset.hydraHeads.every( head => head.indices.length === 19 ) );
const boss = { id: 'leviathan', chaseSpeed: 14, brain: { x: 0, z: 0, heading: 0, currentSpeed: 0, state: 'patrol' } };
updateTitanSkeleton( asset, boss, new Vector3( 0, 0, 30 ), 1, .05 );
assert.ok( asset.boneControls.filter( b => /^[CLR]_/.test( b.name ) ).some( b => Math.abs( b.current.yaw ) > 0.0001 ), 'head chains must animate' );
console.log( 'PASS downloaded hydra geometry, 3 weighted necks, bind pose and animation' );
