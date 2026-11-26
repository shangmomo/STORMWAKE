import assert from 'node:assert/strict';
import { BoatModel } from '../src/world/BoatModel.js';
import { Village } from '../src/world/Village.js';
import { Builder } from '../src/world/village/GeoBuilder.js';
import { buildHouse } from '../src/world/village/Buildings.js';
import { Colliders } from '../src/world/Colliders.js';
import { Rand } from '../src/world/Props.js';
import { Vector3 } from '../src/engine/index.js';

let seed = 90411;
const rand = new Rand( () => ( ( seed = ( Math.imul( seed, 1664525 ) + 1013904223 ) >>> 0 ) / 0x100000000 ) );
const two = Village.prototype._layout( rand ).houses.filter( h => h.stories === 2 );
assert.equal( two.length, 3, 'expected exactly three real two-storey residences' );
let checkedSteps = 0;

for ( const s of two ) {

	const B = new Builder(), colliders = new Colliders();
	const res = buildHouse( { B, colliders, rand, lights: [], checks: [],
		terrain: { heightAt: () => 1 }, inst: { add() {} } }, s );
	const steps = colliders.boxes.filter( c => c.tag === 'homeStairTread' ).sort( ( a, b ) => a.top - b.top );
	assert.ok( res.loft, `${ s.name }: loft data not returned` );
	assert.equal( steps.length, res.loft.stepCount );
	assert.ok( res.loft.rise > 0 && res.loft.rise < 0.21,
		`${ s.name }: stairs are too tall for a walkable humanoid controller` );
	assert.ok( res.loft.upperY - res.floorY > 2.5,
		`${ s.name }: upper floor has no actual height` );
	let y = res.floorY;
	for ( const stair of steps ) {

		assert.ok( stair.top - y <= 0.4, `${ s.name }: impossible upward step` );
		const h = colliders.groundHeightAt( stair.center.x, stair.center.z, y + 0.45 );
		assert.ok( h >= stair.top - 0.006, `${ s.name }: stair has no reachable walkable face` );
		const p = new Vector3( stair.center.x, stair.top, stair.center.z );
		assert.equal( colliders.resolveCapsule( p, 0.29, 1.75 ), false,
			`${ s.name }: stairs collide with railing or another solid prop` );
		y = stair.top;
		checkedSteps ++;

	}
	const upper = colliders.boxes.find( c => c.tag === 'homeUpperFloor' );
	assert.ok( upper && upper.walkable && ! upper.solid );
	assert.ok( Math.abs( upper.top - y ) < 0.2,
		`${ s.name }: staircase does not join the loft at the correct elevation` );
	assert.ok( colliders.boxes.some( c => c.tag === 'homeUpperLanding' ) );
	assert.equal( colliders.boxes.filter( c => c.tag === 'homeDoor' ).length, 1 );
	assert.equal( colliders.boxes.filter( c => c.tag === 'bed' ).length, 1 );

}

const ship = new BoatModel();
assert.equal( ship.group.name, 'StormwakePirateSloop' );
assert.ok( ship.meshes.sail, 'sail cloth was never added to the real ship' );
assert.equal( ship.meshes.radar, undefined, 'the old electronic radar is still rendered' );
assert.equal( ship.meshes.trap, undefined, 'the old lobster traps are still rendered' );
assert.equal( ship.meshes.glass, undefined, 'the old wheelhouse glazing is still rendered' );
assert.ok( ship.triangleCount < 38000, `ship is over the geometry budget: ${ ship.triangleCount }` );
assert.ok( ship.hullSamples.length > 20, 'the hydrodynamic waterplane was removed' );
assert.ok( ship.hydro.displacedVolume > 0 && ship.hydro.suggestedMass > 2500 );
assert.ok( ship.colliders.some( c => c.tag === 'mast' ) );
assert.ok( ! ship.colliders.some( c => c.tag === 'houseWall' || c.tag === 'console' || c.tag === 'trap' ) );
const helm = new Vector3( - 0.55, ship.lines.deckY, 0.22 );
for ( const c of ship.colliders.filter( c => c.solid ) ) {

	if ( c.center.y + c.half.y < helm.y || c.center.y - c.half.y > helm.y + 1.75 ) continue;
	const dx = Math.max( Math.abs( c.center.x - helm.x ) - c.half.x, 0 );
	const dz = Math.max( Math.abs( c.center.z - helm.z ) - c.half.z, 0 );
	assert.ok( Math.hypot( dx, dz ) >= 0.29,
		`pirate ship's ${ c.tag } blocks the player from taking the helm` );

}
ship.setSteering( 0.5 );
ship.setThrottle( 0.8 );
ship.setPropellerRPM( 600 );
ship.dispose();

console.log( `V9 detail and gameplay: PASS ${ two.length } two-storey houses, ${ checkedSteps } ` +
	`unobstructed walkable treads, one genuine pirate sloop with safe helm and preserved hydrodynamics` );
