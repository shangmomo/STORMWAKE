// V11 full player-sized route regression: doorway -> 1m turning bay -> every stair ->
// top landing -> LEFT TURN -> usable upper floor -> back along the balcony.
// Unlike the older V9 per-step test, this explicitly fails when the staircase
// dead-ends at the back wall or the mezzanine edge is barricaded by a rail.
import assert from 'node:assert/strict';
import { Vector3 } from '../src/engine/index.js';
import { Village } from '../src/world/Village.js';
import { Builder } from '../src/world/village/GeoBuilder.js';
import { buildHouse } from '../src/world/village/Buildings.js';
import { Colliders } from '../src/world/Colliders.js';
import { Rand } from '../src/world/Props.js';

const CAPSULE_RADIUS = 0.30;
const CAPSULE_HEIGHT = 1.75;
let rngSeed = 51521;
const random = new Rand( () => ( ( rngSeed = ( Math.imul( rngSeed, 1664525 ) + 1013904223 ) >>> 0 ) / 0x100000000 ) );
const residences = Village.prototype._layout( random ).houses.filter( h => h.stories === 2 );

function stairRoute( s ) {

	const colliders = new Colliders();
	const built = buildHouse( { B: new Builder(), colliders, rand: random,
		lights: [], checks: [], terrain: { heightAt: () => 1 }, inst: { add() {} } }, s );
	const loft = built.loft;
	assert.ok( loft, `${ s.name }: no second floor` );
	assert.ok( loft.zBack + s.d / 2 >= 1.1, `${ s.name }: stair still ends against rear wall` );
	assert.ok( s.d / 2 - loft.zFront >= 0.95, `${ s.name }: stair foot crowds entrance wall` );
	assert.ok( loft.landingFront - loft.landingRear >= 1.0,
		`${ s.name }: top landing is too shallow to turn` );
	assert.ok( loft.landX1 - loft.landX0 >= 2.0,
		`${ s.name }: top landing is too narrow for a 90-degree exit` );
	assert.ok( loft.landX0 < loft.wellLeft - 0.70,
		`${ s.name }: landing does not overlap enough of the upper floor` );
	assert.ok( loft.railZ0 > loft.landingFront,
		`${ s.name }: guardrail blocks the intended left turn` );

	const c = Math.cos( s.yaw ), k = Math.sin( s.yaw );
	const toWorld = ( lx, lz ) => [ s.x + lx * c + lz * k, s.z - lx * k + lz * c ];
	const check = ( lx, y, lz, label ) => {

		const [ x, z ] = toWorld( lx, lz );
		const ground = colliders.groundHeightAt( x, z, y + 0.42 );
		assert.ok( ground >= y - 0.025 && ground <= y + 0.025,
			`${ s.name } ${ label }: unsupported deck/step: ground=${ ground }, expected=${ y }` );
		const p = new Vector3( x, y, z );
		const obstructed = colliders.resolveCapsule( p, CAPSULE_RADIUS, CAPSULE_HEIGHT, 0.4 );
		const near = colliders.boxes.filter( b => b.solid &&
			Math.hypot( x - b.center.x, z - b.center.z ) < b.radius + 0.4 &&
			b.bottom < y + CAPSULE_HEIGHT && b.top > y + 0.4 ).map( b => b.tag );
		assert.equal( obstructed, false,
			`${ s.name } ${ label }: capsule blocked by ${ near.join( ',' ) }, movement=(${ ( p.x - x ).toFixed( 3 ) },${ ( p.z - z ).toFixed( 3 ) })` );

	};

	// Walk across the actual ground-floor room to reach the lowest tread;
	// a perfectly built staircase is still useless if its foot is inaccessible.
	let feetY = built.floorY;
	for ( let i = 0; i <= 30; i ++ ) {

		const xLocal = 0.25 + ( loft.stairX - 0.25 ) * i / 30;
		// Walk in from the front door, THEN turn in the clear bay at the foot.
		const zLocal = loft.zFront + 0.44;
		const [ px, pz ] = toWorld( xLocal, zLocal );
		feetY = colliders.groundHeightAt( px, pz, feetY + 0.40 );
		assert.ok( Number.isFinite( feetY ), `${ s.name }: no usable ground-floor entry` );
		check( xLocal, feetY, zLocal, `stair approach ${ i }` );

	}
	for ( let i = 0; i <= 14; i ++ ) {
		const z = loft.zFront + 0.44 - 0.56 * i / 14;
		const [ x, zz ] = toWorld( loft.stairX, z );
		feetY = colliders.groundHeightAt( x, zz, feetY + 0.40 );
		check( loft.stairX, feetY, z, `stair foot turn ${ i }` );
	}

	// Simulate the game's step-height-biased floor query while moving forward
	// continuously. No skipping directly to an artificially high next tread.
	const run = loft.zFront - loft.zBack;
	const increments = loft.stepCount * 14;
	for ( let i = 0; i <= increments; i ++ ) {

		// Start after the entrance bay, without teleporting onto a tread.
		const z = loft.zFront - 0.12 - ( run - 0.15 ) * i / increments;
		const [ x, wz ] = toWorld( loft.stairX, z );
		const next = colliders.groundHeightAt( x, wz, feetY + 0.40 );
		assert.ok( next > - Infinity, `${ s.name }: stair loses floor support at ${ i }` );
		assert.ok( next - feetY <= 0.40, `${ s.name }: impossible riser at ${ i }` );
		feetY = next;
		check( loft.stairX, feetY, z, `stair progress ${ i }` );

	}
	assert.ok( Math.abs( feetY - loft.upperY ) < 0.04,
		`${ s.name }: top tread never reaches landing elevation` );

	// Keep moving aft into the square turn bay, then exit left onto the loft.
	const zOnTop = loft.zBack - 0.35;
	const zStart = loft.zBack + 0.05;
	for ( let i = 0; i <= 16; i ++ ) check( loft.stairX, loft.upperY,
		zStart + ( zOnTop - zStart ) * i / 16, `landing entry ${ i }` );
	const targetX = loft.wellLeft - 0.72;
	for ( let i = 0; i <= 32; i ++ ) check(
		loft.stairX + ( targetX - loft.stairX ) * i / 32,
		loft.upperY, zOnTop, `left turn ${ i }` );
	for ( let i = 0; i <= 20; i ++ ) check( targetX, loft.upperY,
		zOnTop + ( 0.15 - zOnTop ) * i / 20, `mezzanine walk ${ i }` );

	return { name: s.name, samples: 31 + increments + 1 + 17 + 33 + 21,
		rearClearance: loft.zBack + s.d / 2,
		landingDepth: loft.landingFront - loft.landingRear };

}

const result = residences.map( stairRoute );
assert.equal( result.length, 3 );
console.log( 'V11 staircase route: PASS', result );
