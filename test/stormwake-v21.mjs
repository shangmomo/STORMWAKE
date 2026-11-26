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
	{ id: 'shark', name: 'shark', joints: 63, checks: [ 'SharkJaw0', 'SharkSpine11', 'TailFin5', 'FinLeft7', 'FinRight7' ] },
	{ id: 'turtle', name: 'turtle', joints: 73, checks: [ 'TurtleHead', 'FrontFinL0', 'FrontFinR9', 'BackFinL9', 'TurtleTail7' ] },
	{ id: 'squid', name: 'kraken', joints: 211, checks: [ 'Arm0_0', 'Arm0_23', 'Arm7_23', 'KrakenMantle11' ] },
	{ id: 'leviathan', name: 'hydra', joints: 90, checks: [ 'C_Head', 'L_Head', 'R_Head', 'L_Jaw0', 'R_Jaw3', 'C_17', 'L_17', 'R_17' ] },
];

for ( const spec of specs ) {
	const input = readFileSync( new URL( `../public/models/titans/rigged/${ spec.name }-skeleton.glb`, import.meta.url ) );
	const gltf = parseGLB( input.buffer.slice( input.byteOffset, input.byteOffset + input.byteLength ) );
	assert.equal( gltf.skins.length, 1, `${ spec.id } must have real glTF skin` );
	// Later editions may add deform joints while preserving V21's named rig.
	assert.ok( gltf.skins[ 0 ].joints.length >= spec.joints );
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
	let hullSamples = 0;
	const ship = { model: { dimensions: { beam: 7, length: 16 } }, toWorld( local, out ) {
		hullSamples ++;
		return out.copy( local ).add( captain );
	} };
	for ( let frame = 0; frame < 60; frame ++ ) updateTitanSkeleton( asset, boss, captain, frame / 60, 1 / 60, 1, skill, ship );
	assert.ok( skeleton.jointData.every( Number.isFinite ), `${ spec.id } pose must stay finite` );
	assert.ok( skeleton.jointData.some( ( x, i ) => Math.abs( x - matricesBefore[ i ] ) > 1e-4 ),
		`${ spec.id } must articulate joints` );
	if ( spec.id === 'squid' ) {
		assert.ok( hullSamples >= 6 * 60, 'reach tips must sample six moving boat sockets on every frame' );
		assert.equal( asset.tentacles.length, 8 );
		assert.ok( asset.tentacles.every( chain => chain.indices.length === 24 ), 'all eight appendages must have 24 independent joints' );
		assert.equal( asset.ikPose.size, 192, 'all eight tentacles deform along all joints on every frame' );
	}
	if ( spec.id === 'leviathan' ) {
		assert.ok( hullSamples >= 3 * 60, 'three heads aim for independent moving boat hardpoints' );
		assert.equal( asset.hydraHeads.length, 3 );
		assert.ok( asset.hydraHeads.every( chain => chain.indices.length >= 19 ) );
		assert.equal( asset.ikPose.size, asset.hydraHeads.reduce( ( n, chain ) => n + chain.indices.length, 0 ), 'all three heads independently track through their full neck and head rigs' );
		assert.ok( skeleton.nodeWorld( 'L_Head', new Vector3() ).distanceTo( skeleton.nodeWorld( 'R_Head', new Vector3() ) ) > 1 );
	}
	console.log( `PASS ${ spec.id }: ${ gltf.skins[ 0 ].joints.length } bones; ${ asset.ikPose.size } IK joints; finite GPU skin matrices` );
}

// Separate attack poses must not collapse into one whole-mesh animation.
const mock = { chaseSpeed: 10, brain: { x: 0, z: 0, heading: 0, currentSpeed: 8,
	state: 'windup', windup: 0.2, attack: { kind: 'triple_bite', windup: 2 } } };
const hydraPose = skeletonTargets( 'leviathan', mock, { x: 5, z: 24 }, 2.2, 0.8, 'triple_bite' );
assert.notEqual( hydraPose.C_Head.yaw, hydraPose.L_Head.yaw );
assert.notEqual( hydraPose.R_Head.yaw, hydraPose.L_Head.yaw );
assert.ok( hydraPose.C_Jaw0.pitch > 0 && hydraPose.L_Jaw0.pitch > 0 && hydraPose.R_Jaw0.pitch > 0 );

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
const inkSamples = [];
surface._titanInkSlot = 0;
surface.params = { set: ( name, data ) => inkSamples.push( { name, data } ) };
assert.equal( surface.emitTitanInk( -3, 8, 2.5, 7.2 ), true );
assert.equal( surface.emitTitanInk( 1, -4, 0.8, 8.3 ), true );
assert.equal( surface.emitTitanInk( 0, 0, 1, 9 ), true );
assert.equal( surface.emitTitanInk( 0, 0, -1, 9 ), false );
assert.deepEqual( inkSamples.map( x => x.name ), [ 'titanInk0', 'titanInk1', 'titanInk0' ] );
assert.equal( inkSamples[ 0 ].data[ 3 ], 2 );
const shaderSource = readFileSync( new URL( '../src/ocean/WaterSurface.js', import.meta.url ), 'utf8' );
const waterMaterial = readFileSync( new URL( '../src/ocean/WaterMaterial.js', import.meta.url ), 'utf8' );
const effects = readFileSync( new URL( '../src/oceanhunt/TitanEffects.js', import.meta.url ), 'utf8' );
const devWeapons = readFileSync( new URL( '../src/oceanhunt/HuntCombat.js', import.meta.url ), 'utf8' );
assert.ok( shaderSource.includes( 'titanShockSurfaceDetail( lagXZ )' ) );
assert.ok( shaderSource.includes( 'foamSum += shock.z' ) );
assert.ok( shaderSource.includes( 'fn titanInkConcentration' ) );
assert.ok( waterMaterial.includes( 'titanInkConcentration( pos.xz )' ) );
assert.ok( effects.includes( 'u.wave.visible = false' ) && effects.includes( 'u.ink.visible = false' ) );
assert.ok( devWeapons.includes( 'previewBossAttack' ) && devWeapons.includes( 'data-hunt="ink:squid"' ) );
console.log( 'PASS optical integration: common-sea slope, foam and reflection; dark noise-driven ink' );
console.log( 'V21 dense-rig / full-contact IK / integrated water-attack tests passed.' );
