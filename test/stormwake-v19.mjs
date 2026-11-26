import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Quaternion, Vector3 } from '../src/engine/index.js';
import { TerrainData } from '../src/world/TerrainData.js';
import { BoatController } from '../src/player/BoatController.js';
import { SEA_TITANS, HUNT_KEY_ORDER, HUNT_WEAPONS } from '../src/oceanhunt/HuntRules.js';
import { createTitanBrain } from '../src/oceanhunt/TitanAI.js';
import { bossTeleportDestination, developerAccessEnabled, teleportCaptainAndShip } from '../src/oceanhunt/DeveloperTools.js';
import { HuntProgress, restoreHuntSave, initialHuntSave, HUNT_SAVE_KEY } from '../src/oceanhunt/HuntProgress.js';
import { HuntCombat } from '../src/oceanhunt/HuntCombat.js';

assert.equal( developerAccessEnabled( '' ), true, 'development build grants owner access' );
assert.equal( developerAccessEnabled( '?dev=0' ), false, 'production progress can be checked with explicit opt-out' );
assert.equal( developerAccessEnabled( '?dev=1' ), true );

const terrain = new TerrainData();
const bosses = new Map( SEA_TITANS.map( b => [ b.id, { ...b, brain: createTitanBrain( b ) } ] ) );
for ( const b of bosses.values() ) {
	const dest = bossTeleportDestination( b, terrain );
	assert.ok( dest, `${ b.id }: safe arrival exists in the actual terrain` );
	assert.ok( terrain.heightAt( dest.x, dest.z ) <= - 8, `${ b.id }: arrival is over deep water` );
	assert.ok( Math.hypot( dest.x - b.brain.x, dest.z - b.brain.z ) >= b.attackRange + 41, `${ b.id }: arrival is outside immediate attack impact` );
	assert.ok( Math.abs( Math.sin( dest.heading ) * ( b.brain.z - dest.z ) - Math.cos( dest.heading ) * ( b.brain.x - dest.x ) ) < 0.001, `${ b.id }: heading faces boss` );
}
assert.equal( bossTeleportDestination( bosses.get( 'turtle' ), { heightAt: () => 1 } ), null, 'never force hull onto shallow terrain' );

// Avoid a WebGPU renderer in unit tests: exercise the real boat relocation
// method against its explicit physics state with representative data.
const boat = Object.create( BoatController.prototype );
Object.assign( boat, {
	terrain, position: new Vector3( 100, 1, 0 ), quaternion: new Quaternion(),
	velocity: new Vector3( 2, 3, 4 ), angular: new Vector3( 1, 2, 3 ),
	mooring: { anchor: new Vector3( 100, 0, 0 ), heading: 0 }, moored: true,
	throttle: 1, throttleTarget: 1, steer: 1, rpm: 1, speed: 9, forwardSpeed: 8, wetFraction: 0.9,
	waterH: new Float32Array( [ 9, 9 ] ), hEff: new Float32Array( [ 9, 9 ] ),
	waterOff: new Float32Array( [ 9, 9 ] ), waterV: new Float32Array( [ 9, 9 ] ),
	gx: new Float32Array( [ 9, 9 ] ), gz: new Float32Array( [ 9, 9 ] ),
	hasWater: true, _acc: 3, _age: 1, query: { version: 6, resultTime: 44 },
	applyCount: 0, apply() { this.applyCount ++; },
} );
const turtleArrival = bossTeleportDestination( bosses.get( 'turtle' ), terrain );
assert.equal( boat.teleportTo( turtleArrival.x, turtleArrival.z, turtleArrival.heading ), true );
assert.equal( boat.applyCount, 1 );
assert.equal( boat.position.x, turtleArrival.x );
assert.equal( boat.position.z, turtleArrival.z );
assert.equal( boat.moored, false );
assert.equal( boat.hasWater, false );
assert.equal( boat.speed, 0 );
assert.equal( boat.throttle, 0 );
assert.equal( boat.rpm, 0 );
assert.equal( boat.velocity.length(), 0 );
assert.equal( boat.angular.length(), 0 );
assert.deepEqual( Array.from( boat.waterH ), [ 0, 0 ] );
assert.equal( boat._qVersion, 6 );
assert.equal( boat.teleportTo( 9000, 1, 0 ), false );
assert.equal( boat.teleportTo( 0, 0, 0 ), false, 'landing inside the island is not permitted' );

boat.slot = 0;
boat.samples = [ { p: new Vector3(), area: 1 } ];
boat.query = { cpuValid: true, version: 7, resultInputs: new Float32Array( [ 100, 0, 0, 0 ] ), resultTime: 45,
	cpu: new Float32Array( [ 20, 0, 0, 0 ] ) };
boat.readQueries();
assert.equal( boat._qVersion, 7, 'outdated offshore wave GPU readback is discarded' );
assert.equal( boat.hasWater, false, 'old sea height must not affect newly teleported boat' );

let saved = null;
const storage = { getItem( key ) { assert.equal( key, HUNT_SAVE_KEY ); return saved; }, setItem( key, value ) { assert.equal( key, HUNT_SAVE_KEY ); saved = value; } };
const progress = new HuntProgress( storage );
const toast = [];
const hunt = Object.create( HuntCombat.prototype );
Object.assign( hunt, { developer: true, progress, selected: 'harpoon', opened: false,
	app: { game: { toast: t => toast.push( t ) } } } );
assert.equal( HUNT_KEY_ORDER.length, 6, 'existing armory has six selectable tools' );
for ( const id of Object.keys( HUNT_WEAPONS ) ) assert.equal( hunt.canEquip( id ), true, `dev can equip ${ id } without crafting` );
assert.equal( hunt.equip( 'storm' ), true );
assert.equal( progress.owned( 'storm' ), false, 'debug gear does not falsify crafting progress' );
assert.equal( JSON.parse( saved ).selected, 'storm' );
assert.equal( restoreHuntSave( JSON.parse( saved ) ).selected, 'storm', 'debug selection persists through reload' );
assert.equal( hunt.cycle(), true );
hunt.developer = false;
assert.equal( hunt.canEquip( 'storm' ), false, 'normal progression remains enforced in dev=0' );
assert.equal( restoreHuntSave( { ...initialHuntSave(), selected: '__bad__' } ).selected, 'harpoon' );

let moved = null;
const player = { mode: 'walk', position: new Vector3(), velocity: new Vector3( 1, 0, 3 ),
	_camY: 25, camInit: true, orbitYaw: 0,
	enterBoat() { this.mode = 'boat'; this.position.set( moved.x, 0, moved.z ); },
	deckVel: new Vector3( 1, 1, 1 ), deckToWorld() { this.deckUpdated = true; } };
const app = { hunt: { bosses: { get: id => bosses.get( id ) } }, terrainData: terrain,
	boatCtl: { teleportTo( x, z, heading ) { moved = { x, z, heading }; return true; },
		model: { helmEye: new Vector3( 0, 2, 0 ) }, toWorld( v, into ) { into.copy( v ).setX( moved.x ).setZ( moved.z ); } },
	player, marineExpedition: { targetZone: 'reef' }, crew: { networkClock: 2 } };
assert.equal( teleportCaptainAndShip( app, '__missing__' ), null );
const arrived = teleportCaptainAndShip( app, 'leviathan' );
assert.ok( arrived && moved, 'ship and captain arrive together' );
assert.equal( player.mode, 'boat', 'land captain automatically boards current boat' );
assert.equal( app.marineExpedition.targetZone, 'boss:leviathan' );
assert.equal( app.crew.networkClock, 0, 'crew receives immediate sync after relocating' );
assert.equal( player.camInit, false, 'camera snaps from old harbor to remote titan' );
assert.equal( player.velocity.length(), 0 );
player.mode = 'deck'; player.deckUpdated = false;
teleportCaptainAndShip( app, 'shark' );
assert.equal( player.deckUpdated, true, 'on-deck captain stays attached to relocated vessel' );
assert.equal( player.deckVel.length(), 0 );
player.mode = 'boat';
teleportCaptainAndShip( app, 'squid' );
assert.equal( player.position.x, moved.x, 'helm captain is aligned with relocated vessel' );

const source = p => readFileSync( new URL( `../${ p }`, import.meta.url ), 'utf8' );
assert.ok( source( 'src/islandlife/OceanChart.js' ).includes( 'data-boss-warp' ), 'chart includes one-click ship warp' );
assert.ok( source( 'src/oceanhunt/HuntCombat.js' ).includes( 'data-hunt="warp:' ), 'armory includes titan warp buttons' );
assert.ok( source( 'src/oceanhunt/DeckArsenal.js' ).includes( 'this.developer' ), 'all weapon models display in dev' );
console.log( 'V19: PASS four safe boss warps, ship physics reset, stale GPU guards, all six armory tools, preserved progression, captain/deck/camera relocation, dev chart controls' );
