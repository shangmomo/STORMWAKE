import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { SkinnedModel } from '../src/engine/render/Skinning.js';
import { GPU } from '../src/engine/gpu/GPU.js';
import { Euler, Quaternion, Vector3 } from '../src/engine/index.js';
import { attachTitanSkeleton, updateTitanSkeleton } from '../src/oceanhunt/TitanSkeleton.js';

globalThis.GPUBufferUsage = { STORAGE: 1, COPY_DST: 2, COPY_SRC: 4 };
GPU.device = { createBuffer: () => ( { destroy() {} } ) };
GPU.queue = { writeBuffer() {} };
const position = ( w, i ) => new Vector3( w[ 16 * i + 12 ], w[ 16 * i + 13 ], w[ 16 * i + 14 ] );
for ( const [ id, filename, names ] of [
	[ 'squid', 'kraken', [ 'Arm0_0', 'Arm0_23' ] ],
	[ 'leviathan', 'hydra', [ 'C_Head', 'L_Head', 'R_Head' ] ],
] ) {
	const bytes = readFileSync( new URL( `../public/models/titans/rigged/${ filename }-skeleton.glb`, import.meta.url ) );
	const gltf = parseGLB( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ) );
	if ( id === 'leviathan' ) {
		assert.equal( gltf.skins[ 0 ].joints.length, 120, 'three 28-joint necks plus independent jaws, spine and heads' );
		const headJoint = gltf.skins[ 0 ].joints.findIndex( i => gltf.nodes[ i ].name === 'C_Head' );
		let sampleCount = 0, headInfluence = 0;
		for ( const meshNode of gltf.nodes.filter( n => n.skin === 0 && n.mesh !== undefined ) ) {
			for ( const primitive of gltf.meshes[ meshNode.mesh ] ) {
				const a = primitive.attributes;
				for ( let j = 0; j < a.POSITION.array.length / 3; j ++ ) {
					if ( Math.abs( a.POSITION.array[ j * 3 ] ) >= 2 || a.POSITION.array[ j * 3 + 2 ] <= 34 ) continue;
					sampleCount ++;
					for ( let slot = 0; slot < 4; slot ++ ) if ( a.JOINTS_0.array[ j * 4 + slot ] === headJoint )
						headInfluence += a.WEIGHTS_0.array[ j * 4 + slot ];
				}
			}
		}
		assert.ok( sampleCount > 1000 && headInfluence / sampleCount > .7,
			`central skull must follow C_Head instead of stretching on the neck: ${ headInfluence / sampleCount }` );
	}
	const skeleton = new SkinnedModel( gltf );
	const asset = { skeleton, root: skeleton.group, bounds: { scale: id === 'squid' ? 7.16 : 0.88 } };
	asset.root.scale.setScalar( asset.bounds.scale );
	assert.equal( attachTitanSkeleton( asset ), true );
	const chains = id === 'squid' ? asset.tentacles : asset.hydraHeads;
	const lengths = chains.map( c => c.lengths.slice() );
	const brain = { x: 0, z: 0, heading: 0, currentSpeed: 7, state: 'windup', windup: 0.01,
		attack: { kind: id === 'squid' ? 'grapple' : 'triple_bite', windup: 2 } };
	const boss = { id, brain, chaseSpeed: 10 };
	const captain = new Vector3( 0, 0, id === 'squid' ? 17 : 30 );
	const boatRotation = new Quaternion();
	const ship = { model: { dimensions: { beam: 5.2, length: 11 } }, toWorld( local, out ) {
		return out.copy( local ).applyQuaternion( boatRotation ).add( captain );
	} };
	let maxStretch = 0, maxJump = 0, contactCount = 0;
	let midFrame = null;
	const prior = chains.map( () => null );
	const started = performance.now();
	for ( let frame = 0; frame < 180; frame ++ ) {
		const seconds = frame / 60;
		boatRotation.setFromEuler( new Euler( Math.sin( seconds * 2 ) * .035,
			Math.sin( seconds * .75 ) * .045, Math.sin( seconds * 1.7 ) * .045 ) );
		if ( frame > 120 ) { captain.x += .015; captain.z += .025; }
		updateTitanSkeleton( asset, boss, captain, seconds, 1 / 60, frame < 55 ? 1 : .02,
			id === 'squid' ? 'grapple' : 'triple_bite', ship );
		for ( let a = 0; a < chains.length; a ++ ) {
			const chain = chains[ a ];
			for ( let j = 0; j < chain.indices.length - 1; j ++ ) {
				const length = position( skeleton.world, chain.indices[ j ] ).distanceTo( position( skeleton.world, chain.indices[ j + 1 ] ) );
				maxStretch = Math.max( maxStretch, Math.abs( length / lengths[ a ][ j ] - 1 ) );
			}
			assert.ok( Number.isFinite( chain.actualTip.x ) && Number.isFinite( chain.actualTipWorld.y ) );
			if ( prior[ a ] ) maxJump = Math.max( maxJump, chain.actualTip.distanceTo( prior[ a ] ) );
			prior[ a ] = chain.actualTip.clone();
		}
		contactCount += asset.contactEvents.length;
		if ( frame === 80 ) midFrame = chains.map( c => ( { error: +c.contactError.toFixed( 2 ), latched: c.latched, reach: c.reachingHull, rootDistance: +c.movingRest[ 0 ].distanceTo( c.work.aim ).toFixed( 2 ) } ) );
	}
	assert.ok( maxStretch < .012, `${ id } must maintain fixed bone lengths; max deviation ${ maxStretch }` );
	assert.ok( maxJump < 2.0, `${ id } snapped a moving tip by ${ maxJump } model units in one frame` );
	assert.ok( contactCount >= ( id === 'squid' ? 6 : 3 ), `${ id } needs real contacts on all six grabbers or all three heads: ${ contactCount }` );
	if ( id === 'squid' ) assert.equal( midFrame.filter( c => c.latched && c.error < 1.8 ).length, 6,
		'all six tentacles must remain attached to a moving, pitching hull during the grapple' );
	assert.ok( skeleton.jointData.every( Number.isFinite ) );
	const elapsed = performance.now() - started;
	for ( const name of names ) assert.ok( skeleton.nodeWorld( name, new Vector3() ) );
	console.log( `${ id }: max bone-length deviation ${( maxStretch * 100 ).toFixed( 3 )}% · max tip-frame movement ${ maxJump.toFixed( 3 )}m model · contact events ${ contactCount } · ${( elapsed / 180 ).toFixed( 3 )}ms/frame headless CPU` );
	console.log( `${ id } mid-attack:`, midFrame );
}
console.log( 'V22 fixed-length skinning, smooth joint trajectories and live-hull effector tests passed.' );
