import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from '../src/engine/index.js';
import { BoatModel } from '../src/world/BoatModel.js';
import { BoatController } from '../src/player/BoatController.js';
import { WhaleBrain } from '../src/world/marine/WhaleBrain.js';
import { Whale } from '../src/world/marine/Whale.js';
import { OCEAN_ZONES, OCEAN_CHART_BOUNDS, zoneAt, chartPoint } from '../src/islandlife/OceanZones.js';
import { Shipyard } from '../src/islandlife/Shipyard.js';
import { OceanChart } from '../src/islandlife/OceanChart.js';
import { WORLD } from '../src/world/WorldLayout.js';

// Shared chart marks must be identical to the actual survey triggers.
assert.equal( OCEAN_ZONES.length, 4 );
for ( const zone of OCEAN_ZONES ) {
	assert.equal( zoneAt( zone.x, zone.z )?.id, zone.id );
	const pt = chartPoint( zone.x, zone.z );
	assert.ok( pt.x > 0 && pt.x < 1 && pt.y > 0 && pt.y < 1 );
}
assert.ok( OCEAN_CHART_BOUNDS.maxX - OCEAN_CHART_BOUNDS.minX >= 550 );

// The in-place capsize recovery never teleports the vessel to its dock.
const model = new BoatModel();
const boat = new BoatController( {
	model, query: { allocate() { return 0; }, cpuValid: false },
	terrain: { heightAt() { return - 30; } }, colliders: null,
} );
boat.position.set( 111, - 0.5, 177 );
boat.velocity.set( 4, 0, 2 ); boat.angular.set( 1.5, 0.8, 1.2 );
boat.hasWater = true; boat.waterH.fill( 0.27 );
boat.quaternion.setFromAxisAngle( new Vector3( 0, 1, 0 ), 0.7 )
	.multiply( new Quaternion().setFromAxisAngle( new Vector3( 0, 0, 1 ), Math.PI ) );
assert.equal( boat.capsized, true );
assert.equal( boat.rightCapsizedBoat(), true );
assert.equal( boat.capsized, false );
assert.ok( Math.hypot( boat.position.x - 111, boat.position.z - 177 ) < 1e-6 );
assert.ok( Math.abs( boat.position.y - 0.42 ) < 0.01 );
assert.ok( boat.velocity.length() < 1 );
assert.equal( boat.angular.length(), 0 );
assert.equal( boat.rightCapsizedBoat(), false, 'X does not change a normal upright boat' );
for ( let step = 0; step < 240; step ++ ) boat.step( 1 / 120 );
assert.equal( boat.capsized, false, 'physical buoyancy does not immediately re-flip the righted boat' );
boat.position.y = - 3.8;
boat.quaternion.identity();
const atSea = boat.position.clone();
assert.equal( boat.capsized, false, 'submerged boat may remain upright' );
assert.equal( boat.needsRecovery, true, 'a sunk hull can be rescued even without an upside-down quaternion' );
assert.equal( boat.rightCapsizedBoat(), true, 'underwater helm soft-lock is recoverable' );
assert.equal( boat.needsRecovery, false );
assert.ok( Math.abs( boat.position.x - atSea.x ) < 0.001 && Math.abs( boat.position.z - atSea.z ) < 0.001 );

// Shipyard can now be reached from the helm anywhere, or from the real dock.
const p = { mode: 'boat', position: new Vector3( 500, 0, 400 ) };
const app = { player: p, boatCtl: { position: new Vector3( 500, 0, 400 ), speed: 0.3 }, freeCam: false };
const yard = Object.create( Shipyard.prototype ); yard.app = app;
assert.equal( yard.nearby, true, 'captain can open the fleet when anchored offshore' );
p.mode = 'deck'; assert.equal( yard.nearby, true );
p.mode = 'walk'; assert.equal( yard.nearby, false, 'no remote fleet from a distant beach' );
p.position.copy( WORLD.boatDock.position ); app.boatCtl.position.copy( WORLD.boatDock.position );
assert.equal( yard.nearby, true, 'shipyard is accessible from the dock' );
p.mode = 'boat';
let gearRefresh = 0, yardClosed = 0;
yard.app.boat = model;
yard.app.game = { applyGear() { gearRefresh ++; } };
yard.close = () => { yardClosed ++; };
assert.equal( yard.choose( 'brig' ), true, 'helmsman can actually replace the active vessel' );
assert.equal( model.variant, 'brig' );
assert.equal( gearRefresh, 1 ); assert.equal( yardClosed, 1 );
assert.equal( yard.choose( 'cutter' ), true, 'subsequent changes replace the last vessel' );
assert.equal( model.variant, 'cutter' );
const chart = Object.create( OceanChart.prototype );
chart.app = { marineExpedition: { targetZone: 'reef' }, game: { toast() {} }, whale: { ready: true } };
chart.close = () => {};
assert.equal( chart.select( 'west' ), true );
assert.equal( chart.app.marineExpedition.targetZone, 'west' );
assert.equal( chart.select( 'whale' ), true );
assert.equal( chart.app.marineExpedition.targetZone, 'whale' );

// Whale smoothly becomes visible under close observation, but keeps swimming
// and retains deep cruising behavior at a distance.
const floor = { heightAt() { return - 60; } };
const near = new WhaleBrain( { terrain: floor, seed: 91 } );
const far = new WhaleBrain( { terrain: floor, seed: 91 } );
for ( const brain of [ near, far ] ) {
	brain.state = 'cruise'; brain.seq = null;
	brain.u = brain.length * 0.52; brain._place( 0 );
}
for ( let i = 0; i < 1200; i ++ ) {
	near.observer = near.position; near.update( 1 / 60 );
	far.update( 1 / 60 );
}
assert.ok( near.encounter > 0.9 );
assert.ok( near.backDepth < 1.5, `close whale should be visible: depth ${ near.backDepth }` );
assert.ok( far.backDepth > 6, 'far whale keeps its natural underwater cruise' );
assert.ok( near.arc > 10, 'close whale continues to swim instead of freezing' );

// A single skinned whale mesh bypasses unreliable close frustum culling.
const whale = new Whale( { scene: { add() {} }, terrain: floor } );
whale.ready = true; whale._pose = () => {};
whale.uWater = { value: 0 }; whale.uWet = { value: 0 };
const mesh = { geometry: { boundingSphere: { center: new Vector3() } }, frustumCulled: true };
whale.meshes = [ mesh ]; whale.brain = near;
whale.update( 1 / 60, { position: near.position.clone().add( new Vector3( 8, 1, 0 ) ) } );
assert.equal( mesh.frustumCulled, false );
assert.equal( mesh.visible, true );

console.log( 'V12 ocean: PASS actual mapped survey targets, waypoint selection, fleet accessibility, in-place capsize recovery, persistent close whale visibility' );
