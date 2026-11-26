import assert from 'node:assert/strict';
import { Builder } from '../src/world/village/GeoBuilder.js';
import { Colliders } from '../src/world/Colliders.js';
import { Rand, lin } from '../src/world/Props.js';
import { buildHouse, fillWallAroundApertures } from '../src/world/village/Buildings.js';

let seed = 9917;
const rand = new Rand( () => ( ( seed = ( Math.imul( seed, 1664525 ) + 1013904223 ) >>> 0 ) / 0x100000000 ) );
const B = new Builder();

// A single plain wall with one window opening must contain no wall polygons
// anywhere inside the window aperture (including its corners).
const P = new Builder();
const rect = { x: 0.3, y: 1, w: 0.8, h: 1.2 };
const count = fillWallAroundApertures( P, {
	width: 5, floorY: 0, height: 3, z: - 0.07, thickness: 0.14,
	openings: [ rect ], tint: lin( 0xffffff ), data: () => [ 0.5, 0.7, 1, 0.2 ],
} );
assert.ok( count >= 4, 'wall should be split around its opening' );
const wall = P.batches.wood;
for ( let i = 0; i < wall.idx.length; i += 3 ) {

	const centre = [ 0, 0, 0 ];
	for ( let j = 0; j < 3; j ++ ) for ( let k = 0; k < 3; k ++ ) centre[ k ] += wall.pos[ wall.idx[ i + j ] * 3 + k ] / 3;
	assert.ok( !( centre[ 0 ] > rect.x - rect.w / 2 + 0.002 && centre[ 0 ] < rect.x + rect.w / 2 - 0.002 &&
		centre[ 1 ] > rect.y + 0.002 && centre[ 1 ] < rect.y + rect.h - 0.002 ), 'solid wall polygon crosses real window opening' );

}

const colliders = new Colliders(), lights = [], checks = [];
const spec = {
	name: 'A', x: 0, z: 0, yaw: 0, w: 6.2, d: 5.0,
	heroCottage: true, foundation: 'stone', roof: 'gable', roofMat: 'metal',
	roofColor: lin( 0xa64a35 ), wall: lin( 0x5dbcb0 ), trim: lin( 0xf3efe6 ),
	accent: lin( 0x2e4f73 ), siding: 1, porch: { depth: 2.1, rail: 'balusters' },
	paint: 0.58, stovepipe: true, buoys: - 1, porchPaint: lin( 0x8a9aa0 ),
};
const result = buildHouse( {
	B, rand, colliders, lights, checks,
	terrain: { heightAt: () => 1.0 },
	inst: { add() {} },
}, spec );

assert.deepEqual( result.windowApertures.map( xs => xs.length ), [ 2, 2, 1, 1 ], 'wrong hero window layout' );
assert.ok( B.triangles > 5000 && B.triangles < 75000, 'house geometry is missing or unreasonably heavy' );
assert.ok( B.batches.fabric?.vcount > 0, 'flower boxes and home decor should be included' );
assert.ok( B.batches.roofMetal?.vcount > 0, 'roof seams must exist' );
assert.ok( colliders.boxes.some( c => c.tag === 'bed' ), 'working bed must survive' );
assert.ok( colliders.boxes.some( c => c.tag === 'homeDiningTable' ), 'new table should have a collider' );
assert.ok( colliders.boxes.some( c => c.tag === 'homeDoor' ), 'openable door must survive' );
assert.ok( colliders.boxes.some( c => c.tag === 'heroWashDeck' && c.walkable ), 'the side service deck should be walkable' );

for ( const batch of Object.values( B.batches ) ) for ( const x of batch.pos ) assert.ok( Number.isFinite( x ) );
// No fixed wall collider is permitted in the middle of the 1.12m entrance.
assert.ok( ! colliders.boxes.some( c => c.tag === 'houseWall' && Math.abs( c.center.x ) < 0.25 && c.center.z > 2.30 ),
	'the front entrance must remain unobstructed by static wall geometry' );

console.log( `V6 sample cottage A: PASS, ${ B.triangles } triangles, ${ count } synthetic wall panels, six true windows, door and bed preserved` );
