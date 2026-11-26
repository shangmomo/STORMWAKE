import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { SkinnedModel } from '../src/engine/render/Skinning.js';
import { GPU } from '../src/engine/gpu/GPU.js';
import { Vector3 } from '../src/engine/index.js';
import { attachTitanSkeleton, skeletonTargets, updateTitanSkeleton } from '../src/oceanhunt/TitanSkeleton.js';
import { WaterSurface } from '../src/ocean/WaterSurface.js';

// Real, independent glTF joints are verified through the same parser and pose
// compositor used in the browser. Only the GPU storage upload is stubbed.
globalThis.GPUBufferUsage = { STORAGE: 1, COPY_DST: 2, COPY_SRC: 4 };
GPU.device = { createBuffer: () => ( { destroy() {} } ) };
GPU.queue = { writeBuffer: ( buffer, offset, data ) => {
	assert.equal( offset, 0 );
	assert.ok( data.byteLength > 0 );
} };

const specs = [
	{ id: 'shark', name: 'shark', joints: 7, checks: [ 'SharkJaw', 'TailFin' ] },
	{ id: 'turtle', name: 'turtle', joints: 7, checks: [ 'TurtleHead', 'FrontFinL', 'FrontFinR' ] },
	{ id: 'squid', name: 'kraken', joints: 50, checks: [ 'Arm0_0', 'Arm0_5', 'Arm7_5' ] },
	{ id: 'leviathan', name: 'hydra', joints: 16, checks: [ 'C_Head', 'L_Head', 'R_Head', 'L_Jaw', 'R_Jaw' ] },
];

for ( const spec of specs ) {
	const input = readFileSync( new URL( `../public/models/titans/rigged/${ spec.name }-skeleton.glb`, import.meta.url ) );
	const gltf = parseGLB( input.buffer.slice( input.byteOffset, input.byteOffset + input.byteLength ) );
	assert.equal( gltf.skins.length, 1, `${ spec.id } must have real glTF skin` );
	assert.equal( gltf.skins[ 0 ].joints.length, spec.joints );
	for ( const name of spec.checks ) assert.ok( gltf.nodes.some( n => n.name === name ), `${ spec.id } ${ name }` );
	const skinned = gltf.nodes.filter( n => n.mesh !== undefined && n.skin === 0 );
	assert.ok( skinned.length, `${ spec.id } must bind a mesh to the skin` );
	const primitives = skinned.flatMap( n => gltf.meshes[ n.mesh ] );
	assert.ok( primitives.every( p => p.attributes.JOINTS_0 && p.attributes.WEIGHTS_0 ) );
	assert.ok( primitives.reduce( ( n, p ) => n + p.attributes.POSITION.array.length / 3, 0 ) > 30000 );

	const skeleton = new SkinnedModel( gltf );
	const asset = { skeleton, root: skeleton.group };
	assert.ok( attachTitanSkeleton( asset ) );
	const matricesBefore = skeleton.jointData.slice();
	const allBefore = Object.fromEntries( spec.checks.map( name => [ name, skeleton.nodeWorld( name, new Vector3() ).clone() ] ) );
	// Exercise real world-to-local math with realistic scale (model-to-boss units).
	asset.root.scale.setScalar( spec.id === 'squid' ? 6 : spec.id === 'leviathan' ? 1 : 5 );
	asset.root.position.set( 0, 0, 0 );
	const skill = spec.id === 'squid' ? 'grapple' : spec.id === 'leviathan' ? 'triple_bite' : 'charge';
	const boss = { id: spec.id, chaseSpeed: 12, brain: {
		x: 0, z: 0, heading: 0, currentSpeed: 6, state: 'windup',
		windup: 0.25, attack: { kind: skill, windup: 2 },
	} };
	const captain = new Vector3( spec.id === 'leviathan' ? 3 : 3, 0, spec.id === 'leviathan' ? 35 : 19 );
	for ( let frame = 0; frame < 60; frame ++ ) updateTitanSkeleton( asset, boss, captain, frame / 60, 1 / 60, 1, skill );
	assert.ok( skeleton.jointData.every( Number.isFinite ), `${ spec.id } pose must stay finite` );
	assert.ok( skeleton.jointData.some( ( x, i ) => Math.abs( x - matricesBefore[ i ] ) > 1e-4 ),
		`${ spec.id } must articulate joints` );
	if ( spec.id === 'squid' ) {
		assert.equal( asset.tentacles.length, 8 );
		assert.ok( asset.ikPose.size >= 6, 'at least one tentacle actually tracks a boat' );
	}
	if ( spec.id === 'leviathan' ) {
		assert.equal( asset.hydraHeads.length, 3 );
		assert.equal( asset.ikPose.size, 12, 'all three heads independently track a boat' );
		assert.ok( skeleton.nodeWorld( 'L_Head', new Vector3() ).distanceTo( skeleton.nodeWorld( 'R_Head', new Vector3() ) ) > 1 );
	}
	console.log( `PASS ${ spec.id }: ${ spec.joints } bones; ${ asset.ikPose.size } IK joints; finite GPU skin matrices` );
}

// Separate attack poses must not collapse into one whole-mesh animation.
const mock = { chaseSpeed: 10, brain: { x: 0, z: 0, heading: 0, currentSpeed: 8,
	state: 'windup', windup: 0.2, attack: { kind: 'triple_bite', windup: 2 } } };
const hydraPose = skeletonTargets( 'leviathan', mock, { x: 5, z: 24 }, 2.2, 0.8, 'triple_bite' );
assert.notEqual( hydraPose.C_Head.yaw, hydraPose.L_Head.yaw );
assert.notEqual( hydraPose.R_Head.yaw, hydraPose.L_Head.yaw );
assert.ok( hydraPose.C_Jaw.pitch > 0 && hydraPose.L_Jaw.pitch > 0 && hydraPose.R_Jaw.pitch > 0 );

// The wave emitter is a rolling set of actual water displacement inputs.
const surface = Object.create( WaterSurface.prototype );
const samples = [];
surface._titanWaveSlot = 0;
surface.params = { set: ( name, data ) => samples.push( { name, data } ) };
assert.equal( surface.emitTitanWave( 8, 9, 3, 2.5 ), true );
assert.equal( surface.emitTitanWave( NaN, 9, 3, 2.5 ), false );
for ( let i = 0; i < 4; i ++ ) surface.emitTitanWave( i, 3, 99, 10 );
assert.deepEqual( samples.map( x => x.name ), [ 'titanWave0', 'titanWave1', 'titanWave2', 'titanWave3', 'titanWave0' ] );
assert.equal( samples[ 1 ].data[ 3 ], 5 );
console.log( 'PASS waves: four-slot rolling displacement with shared ocean/buoyancy source' );
console.log( 'V20 skeletal creature / IK / wave tests passed.' );
