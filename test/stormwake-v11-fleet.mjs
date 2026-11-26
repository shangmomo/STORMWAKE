import assert from 'node:assert/strict';
import { Vector3, Quaternion } from '../src/engine/index.js';
import { BoatModel } from '../src/world/BoatModel.js';
import { BoatController } from '../src/player/BoatController.js';
import { Player } from '../src/player/Player.js';
import { FLEET } from '../src/world/boat/FleetVariants.js';
import { SPECIES, SKIN, PATTERN } from '../src/world/fish/FishSpecies.js';
import { fishGeometry } from '../src/world/fish/FishGeometry.js';
import { FISH } from '../src/game/FishTable.js';

const model = new BoatModel(), root = model.group;
assert.ok( Object.keys( FLEET ).length >= 5, 'at least five physically playable vessel profiles' );
assert.equal( model.variant, 'corsair' );
const shapes = new Set();
for ( const name of Object.keys( FLEET ) ) {
	assert.equal( model.setVariant( name ), true );
	assert.equal( model.group, root, 'render/wake/water-mask group identity remains stable' );
	const buckets = model.group.children.filter( o => o.name.startsWith( 'boat-' ) && ! [ 'boat-wheel', 'boat-radar', 'boat-propeller', 'boat-rudder', 'boat-throttle' ].includes( o.name ) );
	assert.equal( buckets.filter( o => o.name === 'boat-wood' ).length, 1, `${ name }: old mesh was stacked on the new mesh` );
	assert.ok( model.triangleCount < 30000, `${ name }: excessive model triangles` );
	assert.equal( model.colliders.some( c => c.tag === 'mast' ), true );
	shapes.add( model.triangleCount );
}
assert.equal( shapes.size, Object.keys( FLEET ).length, 'ship models must have different geometry' );

const fakeQuery = { allocate() { return 0; }, setPoint() {}, cpuValid: false, cpu: new Float32Array( 1024 ) };
const terrain = { heightAt() { return - 8; } };
const colliders = { groundHeightAt() { return - Infinity; }, resolveCapsule() { return false; } };
const boat = new BoatController( { model, query: fakeQuery, terrain, colliders } );
const input = {
	keys: new Set(), pressed: new Set(), enabled: true,
	down( k ) { return this.keys.has( k ); }, hit( k ) { return this.pressed.has( k ); },
	consume( k ) { if ( ! this.pressed.has( k ) ) return false; this.pressed.delete( k ); return true; },
	consumeLook() { return { x: 0, y: 0 }; }, consumeWheel() { return 0; },
};
const camera = { position: new Vector3(), quaternion: new Quaternion(), lookAt() {} };
const player = new Player( { camera, input, terrain, colliders, query: fakeQuery, boat } );
const boardWorld = boat.toWorld( model.boardPoint, new Vector3() );
player.position.set( boardWorld.x - 1.5, 0, boardWorld.z );
assert.equal( player.nearBoat(), true );
input.pressed.add( 'KeyE' ); player.update( 1 / 60 );
assert.equal( player.mode, 'boat', 'a single E press at the pier must actually take helm' );
assert.equal( boat.driven, true, 'the boat physics controller must be enabled' );
assert.equal( boat.moored, false, 'mooring lines must be released' );
input.keys.add( 'KeyW' ); player.update( 1 / 60 );
assert.ok( boat.throttle > 0, 'W must command forward thrust' );
input.pressed.add( 'KeyE' ); player.update( 1 / 60 );
assert.equal( player.mode, 'deck', 'E at helm stands up on the ship' );
input.pressed.add( 'KeyE' ); player.deckPos.copy( model.helmPoint ); player.update( 1 / 60 );
assert.equal( player.mode, 'boat', 'deck can re-enter steering mode at actual helm' );
player.exitBoat();
player.position.set( boardWorld.x - 1.5, 0, boardWorld.z );
input.keys.add( 'ShiftLeft' ); input.pressed.add( 'KeyE' ); player.update( 1 / 60 );
assert.equal( player.mode, 'deck', 'Shift+E preserves walkable fishing deck' );

// Integrate the actual hydrostatic physics with a stationary sea-level query:
// reaching boat mode is not enough if the vessel fails to make way.
const water = { allocate() { return 0; }, setPoint() {}, cpuValid: true, version: 1,
	resultTime: 0.016, cpu: new Float32Array( 8192 ), resultInputs: new Float32Array( 8192 ) };
const oceanBoat = new BoatController( { model, query: water, terrain, colliders: null } );
oceanBoat.driven = true; oceanBoat.moored = false;
for ( let frame = 0; frame < 480; frame ++ ) {
	oceanBoat.setInput( 0.8, frame > 300 ? 0.45 : 0, 1 / 60 );
	oceanBoat.update( 1 / 60 );
}
assert.ok( oceanBoat.hasWater && oceanBoat.speed > 2.0, 'propulsion must physically move the boat' );
assert.ok( oceanBoat.position.distanceTo( oceanBoat.mooring.anchor ) > 10,
	'boat should actually sail away from harbor and turn' );

assert.ok( Object.keys( FISH ).length >= 30, 'at least 30 catchable fish species' );
const extra = [ 'clownfish', 'butterflyfish', 'lionfish', 'squirrelfish', 'triggerfish', 'cardinalfish', 'blueRunner', 'pompano', 'seaBream', 'wahoo', 'flyingfish', 'permit' ];
for ( const name of extra ) {
	assert.ok( SPECIES[ name ] && SKIN[ name ] && FISH[ name ] );
	assert.equal( SPECIES[ name ].pattern, PATTERN[ name ] );
	const geo = fishGeometry( SPECIES[ name ], { lod: 2, pose: 'swim' } );
	assert.ok( geo.attributes.position.count > 50, `${ name }: actual procedural mesh required` );
	geo.dispose();
}
console.log( 'V11 fleet: PASS >=5 unique replaceable ships, 1-key captain, Shift+E deck, real 3D movement and turn, 30 fish with rendered anatomy' );
