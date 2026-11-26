import assert from 'node:assert/strict';
import { Builder } from '../src/world/village/GeoBuilder.js';
import { Colliders } from '../src/world/Colliders.js';
import { Village } from '../src/world/Village.js';
import { buildHouse } from '../src/world/village/Buildings.js';
import { buildPier, PIER } from '../src/world/Pier.js';
import { Rand } from '../src/world/Props.js';
import { Vector3 } from '../src/engine/index.js';

let seed = 73007;
const rand = new Rand( () => ( ( seed = ( Math.imul( seed, 1664525 ) + 1013904223 ) >>> 0 ) / 0x100000000 ) );
const layout = Village.prototype._layout( rand );
assert.equal( layout.houses.length, 17 );
assert.equal( layout.sheds.length, 4 );
assert.ok( layout.houses.every( h => h.pirateStyle && h.pitch >= 0.68 ) );
assert.equal( new Set( layout.houses.map( h => h.pirateStyle.variant ) ).size, 17 );

// Every V8 village home must use a *single* new architectural body, never
// emitting the original metal/thatch roof geometry behind the new shingles.
for ( const name of layout.houses.map( h => h.name ) ) {

	const s = layout.houses.find( h => h.name === name );
	const B = new Builder(), colliders = new Colliders();
	const res = buildHouse( {
		B, colliders, rand, lights: [], checks: [],
		terrain: { heightAt: () => s.foundation === 'stilts' ? 0 : 1 }, inst: { add() {} },
	}, s );
	assert.ok( B.triangles > 1600 && B.triangles < 15500, `${ name }: invalid triangle budget ${ B.triangles }` );
	assert.equal( B.batches.roofMetal?.vcount || 0, 0, `${ name }: the ORIGINAL metal roof is still rendered` );
	assert.equal( B.batches.thatch?.vcount || 0, 0, `${ name }: the ORIGINAL thatch roof is still rendered` );
	// V9 deliberately reserves bunting for landmarks to remove random clutter.
	if ( s.porch ) assert.ok( B.batches.fabric?.vcount > 0, `${ name }: missing supported porch canvas` );
	if ( s.porch ) assert.ok( B.batches.rope?.vcount > 0, `${ name }: supported porch has no rope joinery` );
	assert.ok( res.bed, `${ name }: bed missing` );
	assert.ok( colliders.boxes.some( c => c.tag === 'homeDoor' ), `${ name }: door missing` );
	assert.equal( colliders.boxes.filter( c => c.tag === 'homeDoor' ).length, 1, `${ name }: multiple door leaves` );
	assert.equal( colliders.boxes.filter( c => c.tag === 'bed' ).length, 1, `${ name }: duplicate beds` );
	if ( s.stories === 2 ) {

		assert.equal( colliders.boxes.filter( c => c.tag === 'homeUpperFloor' ).length, 1, `${ name }: upper room absent` );
		assert.ok( colliders.boxes.filter( c => c.tag === 'homeStairTread' ).length >= 14, `${ name }: usable stairs absent` );
		assert.equal( colliders.boxes.filter( c => c.tag === 'homeUpperLanding' ).length, 1, `${ name }: landing absent` );
		assert.ok( colliders.boxes.some( c => c.tag === 'homeLoftRail' ), `${ name }: upper guardrail absent` );

	}
	for ( const batch of Object.values( B.batches ) ) for ( const n of batch.pos ) {

		assert.ok( Number.isFinite( n ), `${ name }: non-finite vertex` );

	}

}

const B = new Builder(), S = new Builder(), colliders = new Colliders();
buildPier( { B, signB: S, colliders, rand, lights: [], inst: { add() {} },
	terrain: { heightAt: () => 1.0 } } );
const docks = colliders.boxes.filter( c => c.tag === 'pierDeck' && c.walkable );
assert.equal( docks.length, 8, 'four side trading bays + relocated wharf + two new terraces + walkway must be walkable' );
assert.ok( B.triangles < 115000, `pier too expensive: ${ B.triangles } triangles` );
assert.ok( S.triangles > 5000 && S.triangles < 9000, 'original corrected Chinese sign was lost' );
assert.ok( PIER.headCenterX >= PIER.x + 3, 'main dock position was not relocated east' );
assert.ok( docks.some( c => Math.abs( c.center.x - PIER.headCenterX ) < 0.2 && c.half.x > 8 ),
	'new broad shifted head has no authoritative collider' );
assert.ok( docks.some( c => c.center.x < PIER.headX0 - 1 ), 'west terrace missing' );
assert.ok( docks.some( c => c.center.z > PIER.headZ0 + 12 ), 'south captain terrace missing' );
const headEntrance = new Vector3( PIER.x, PIER.deck, PIER.headZ0 + 0.52 );
assert.equal( colliders.resolveCapsule( headEntrance, 0.29, 1.8 ), false,
	'old pier supports or head rails obstruct the relocated wharf entrance' );
const westPortal = new Vector3( PIER.headX0 - 0.22, PIER.deck, PIER.headZ0 + 7.0 );
assert.equal( colliders.resolveCapsule( westPortal, 0.29, 1.8 ), false,
	'old west rail blocks access to the new net quay' );
const southPortal = new Vector3( PIER.headCenterX, PIER.deck, PIER.headZ0 + 11.24 );
assert.equal( colliders.resolveCapsule( southPortal, 0.29, 1.8 ), false,
	'old southern rail blocks access to the captain spur' );
for ( const dock of docks.slice( 2 ) ) {

	const p = new Vector3( dock.center.x, PIER.deck, dock.center.z );
	assert.equal( colliders.resolveCapsule( p, 0.29, 1.8 ), false,
		`trading platform is blocked at x=${ dock.center.x }, z=${ dock.center.z }` );

}

console.log( `V9 Stormwake rebuild: PASS 17 non-overlaid houses, usable loft staircases, 1 bed/door per house, ` +
	`8 walkable dock regions, shifted wharf, ${ B.triangles } pier triangles` );
