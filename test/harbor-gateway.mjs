import assert from 'node:assert/strict';
import { Vector3 } from '../src/engine/index.js';
import { Colliders } from '../src/world/Colliders.js';
import { buildPier, PIER } from '../src/world/Pier.js';
import { Rand } from '../src/world/Props.js';
import { Builder } from '../src/world/village/GeoBuilder.js';

// Runs without a WebGPU adapter; checks that the harbor gate is real geometry
// and the original walkable pier remains accessible to the player capsule.
let seed = 184729;
const random = new Rand( () => {

	seed = ( Math.imul( seed, 1664525 ) + 1013904223 ) >>> 0;
	return seed / 0x100000000;

} );
const B = new Builder(), signB = new Builder(), colliders = new Colliders(), lights = [];
const info = buildPier( {
	B, signB, colliders, rand: random, lights, inst: { add() {} },
	terrain: { heightAt: () => 1.7 },
} );

assert.ok( info.signPivot instanceof Vector3, 'gate must have an animated sign pivot' );
assert.ok( info.gateway.clearance >= 2.1, 'player must fit under the sign' );
assert.ok( info.gateway.clearWidth >= PIER.width, 'posts must not narrow the pier' );
assert.ok( signB.batches.hard?.vcount > 1000, 'Chinese sign lettering must be real geometry' );
assert.ok( signB.batches.wood?.vcount > 0, 'sign must have a wooden body' );
const frontGlyphVertices = signB.batches.hard.pos.filter( ( _, i ) => i % 3 === 2 &&
	signB.batches.hard.pos[ i ] > info.signPivot.z + 0.115 ).length;
const rearGlyphVertices = signB.batches.hard.pos.filter( ( _, i ) => i % 3 === 2 &&
	signB.batches.hard.pos[ i ] < info.signPivot.z - 0.115 ).length;
assert.ok( frontGlyphVertices > 150 && rearGlyphVertices > 150, 'both faces need legible 3D text' );
// The gateway replaces the original tall first-bent posts; otherwise the
// player sees four parallel uprights like the failed first redesign.
const oldGatePosts = colliders.cylinders.filter( c => c.tag === 'pile' &&
	Math.abs( c.z - ( info.signPivot.z + 0.12 ) ) < 0.04 && c.yMax > PIER.deck + 1.1 );
assert.equal( oldGatePosts.length, 0, 'original high pier posts must be removed' );
for ( const key of [ 'stone', 'wood', 'hard', 'rope', 'flag' ] ) {

	assert.ok( B.batches[ key ]?.vcount > 0, `gate material missing: ${ key }` );

}
assert.ok( signB.triangles < 9000, 'sign triangle count should remain low' );
assert.ok( B.triangles < 100000, 'static pier geometry should remain lightweight' );
assert.equal( colliders.cylinders.filter( c => c.tag.startsWith( 'harborGateway' ) ).length, 4 );

const gateZ = info.signPivot.z;
for ( const dx of [ - 0.85, 0, 0.85 ] ) for ( const dz of [ - 0.5, 0, 0.5 ] ) {

	const p = new Vector3( PIER.x + dx, PIER.deck, gateZ + dz );
	const old = p.clone();
	const hit = colliders.resolveCapsule( p, 0.29, 1.8 );
	assert.equal( hit, false, `gate blocks the pier at (${ dx }, ${ dz })` );
	assert.ok( p.distanceTo( old ) < 1e-6 );

}
for ( const builder of [ B, signB ] ) for ( const batch of Object.values( builder.batches ) ) {

	for ( const value of batch.pos ) assert.ok( Number.isFinite( value ), 'invalid vertex position' );

}

console.log( `Harbor gate: PASS, clearance ${ info.gateway.clearance.toFixed( 2 ) }m, width ${ info.gateway.clearWidth.toFixed( 2 ) }m, sign ${ signB.triangles } triangles` );
