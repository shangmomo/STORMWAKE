import assert from 'node:assert/strict';
import { Builder } from '../src/world/village/GeoBuilder.js';
import { buildHouse, buildShed, porchRoofPosts } from '../src/world/village/Buildings.js';
import { Colliders } from '../src/world/Colliders.js';
import { Rand, lin } from '../src/world/Props.js';
import { mulberry32 } from '../src/util/Noise.js';
import { AUTO_TIME_SPEED, GAME_DAY_SECONDS, SLEEP_DURATION, SLEEP_MORNING_AT, clockLabel, dayPeriod, nearDoor, nearBed, facingBed, isNewDay } from '../src/course/HomeLifeLogic.js';

assert.equal( AUTO_TIME_SPEED * GAME_DAY_SECONDS, 24 );
assert.equal( clockLabel( 16.2 ), '16:12' );
assert.equal( clockLabel( 25.5 ), '01:30' );
assert.equal( dayPeriod( 1 ), '深夜' );
assert.equal( dayPeriod( 19 ), '傍晚' );
assert.equal( isNewDay( 23.98, 0.02, AUTO_TIME_SPEED ), true );
assert.equal( isNewDay( 20, 19, AUTO_TIME_SPEED ), false );
assert.equal( SLEEP_DURATION, 6 );
assert.ok( SLEEP_MORNING_AT > 0 && SLEEP_MORNING_AT < SLEEP_DURATION );
for ( const [ left, right, stair ] of [ [ - 2, 2, 0 ], [ - 3.1, 3.1, 0 ], [ - 2.8, 1.6, - 0.6 ] ] ) {
	const posts = porchRoofPosts( left, right, stair );
	assert.ok( Math.abs( posts[ 0 ] - ( left + 0.08 ) ) < 1e-9 );
	assert.ok( Math.abs( posts[ posts.length - 1 ] - ( right - 0.08 ) ) < 1e-9 );
	assert.ok( posts.slice( 1, - 1 ).every( x => Math.abs( x - stair ) >= 0.75 ), 'middle post must not obstruct stairs' );
}
const targetBed = { floorY: 2, bed: { x: 0, z: 0 } };
assert.equal( facingBed( { x: 0, y: 2, z: 1.5 }, 0, targetBed ), true );
assert.equal( facingBed( { x: 0, y: 2, z: 1.5 }, Math.PI, targetBed ), false );
assert.equal( facingBed( { x: 0, y: 2, z: 3 }, 0, targetBed ), false );
assert.equal( facingBed( { x: 0, y: 5, z: 1 }, 0, targetBed ), false );

function createTestHouse( spec ) {

	const B = new Builder();
	const colliders = new Colliders();
	const terrain = { heightAt: () => 2 };
	const ctx = { B, terrain, colliders, rand: new Rand( mulberry32( 2026 ) ), lights: [], checks: [], inst: { add() {} } };
	const s = { name: 'A', x: 13, z: - 106, yaw: 0, w: 6, d: 5, foundation: 'posts', roof: 'gable', roofMat: 'metal', wall: lin( 0x8cc2e0 ), trim: lin( 0xf3efe6 ), accent: lin( 0x3f79ae ), ...spec };
	return { ...buildHouse( ctx, s ), colliders, B, s };

}

for ( const spec of [ {}, { yaw: 0.3, stories: 2 }, { w: 4, d: 4, floorY: 3.1, foundation: 'stilts' } ] ) {

	const h = createTestHouse( spec );
	assert.ok( h.door, 'every cottage must have a real mobile door' );
	assert.ok( h.bed, 'every cottage must have a real bed' );
	assert.ok( h.B.batches.wood.vcount > 0, 'interior furniture is merged into wood batch' );
	const home = { floorY: h.floorY, door: h.door, bed: h.bed };
	assert.ok( nearDoor( h.door, home ) );
	assert.ok( nearBed( { ...h.bed, y: h.floorY }, home ) );
	const c = h.colliders.boxes;
	assert.ok( c.some( b => b.tag === 'homeFloor' && b.walkable && ! b.solid ) );
	assert.ok( c.some( b => b.tag === 'houseWall' ) );
	assert.equal( c.filter( b => b.tag === 'house' ).length, 0, 'no solid whole-house collider' );
	assert.equal( c.filter( b => b.tag === 'homeDoor' ).length, 1 );
	const old = h.door.door.solid;
	h.door.door.solid = false;
	assert.equal( old, true );
	assert.equal( h.door.door.solid, false );
	// Doorway at center must be traversable when the leaf is open.
	const p = { x: h.door.x, y: h.floorY + 0.02, z: h.door.z };
	const before = { ...p };
	h.colliders.resolveCapsule( p, 0.29, 1.7, 0.4 );
	assert.ok( Math.hypot( p.x - before.x, p.z - before.z ) < 0.01, 'open door should not have an invisible collision wall' );
	assert.ok( Number.isFinite( h.colliders.groundHeightAt( h.s.x, h.s.z, h.floorY + 0.3 ) ) );

}

{

	const B = new Builder();
	const colliders = new Colliders();
	const ctx = { B, terrain: { heightAt: () => 2 }, colliders, rand: new Rand( mulberry32( 19 ) ), lights: [], checks: [] };
	const shed = buildShed( ctx, { name: 'shed1', x: 21.5, z: - 119.5, yaw: 0.1 } );
	assert.ok( shed.door && shed.door.width === 0.8, 'shed has a dedicated physical door' );
	assert.equal( colliders.boxes.filter( b => b.tag === 'shed' ).length, 0 );
	assert.equal( colliders.boxes.filter( b => b.tag === 'shedDoor' ).length, 1 );
	shed.door.door.solid = false;
	const p = { x: shed.door.x, y: shed.floorY, z: shed.door.z };
	const before = { ...p };
	colliders.resolveCapsule( p, 0.29, 1.7, 0.4 );
	assert.ok( Math.hypot( p.x - before.x, p.z - before.z ) < 0.01 );

}

console.log( 'ok home life: residential + shed doors, sleeping beds, furniture, collision and 24-minute days' );
