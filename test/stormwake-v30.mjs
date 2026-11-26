import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from '../src/engine/index.js';
import { SUBMARINE_DRIVE, adjustSubmarineThrottle, orbitSubmarineCamera, stepSubmarineDynamics } from '../src/oceanhunt/SubmarineDynamics.js';
import { ABYSS_ZONE, AbyssRaid } from '../src/oceanhunt/AbyssRaid.js';

const source = p => readFileSync( new URL( '../' + p, import.meta.url ), 'utf8' );
const raidSrc = source( 'src/oceanhunt/AbyssRaid.js' );
assert.doesNotMatch( raidSrc, /heading:\s*this\.helmMode === 'mouse'/, 'mouse must never order a hull heading' );
assert.match( raidSrc, /data-abyss="throttle-up"/ );
assert.match( raidSrc, /data-abyss="throttle-stop"/ );
assert.match( raidSrc, /data-abyss-target-speed/ );
assert.match( raidSrc, /KeyN/ );

// The telegraph is a persistent *order*, not a temporary key-driven velocity.
const telegraph = { throttle: 0, throttleHold: 0 };
assert.equal( adjustSubmarineThrottle( telegraph, { up: true, upPressed: true }, 1/60 ), .25 );
for ( let n = 0; n < 100; n ++ ) adjustSubmarineThrottle( telegraph, {}, 1/60 );
assert.equal( telegraph.throttle, .25, 'W release holds the lever' );
for ( let n = 0; n < 60; n ++ ) adjustSubmarineThrottle( telegraph,
	{ up: true, upPressed: n === 0 }, 1/60 );
assert.ok( telegraph.throttle > .95, 'holding W advances the lever across multiple notches' );
adjustSubmarineThrottle( telegraph, { stop: true }, 1/60 );
assert.equal( telegraph.throttle, 0, 'N is an actual neutral command' );
assert.equal( adjustSubmarineThrottle( telegraph, { down: true, downPressed: true }, 1/60 ), -.25 );
adjustSubmarineThrottle( telegraph, {}, 1/60 );
assert.equal( telegraph.throttle, -.25, 'reverse order persists without S' );
assert.equal( adjustSubmarineThrottle( telegraph, { arcade: true, up: true }, 1/60 ), 1 );
assert.equal( adjustSubmarineThrottle( telegraph, { arcade: true }, 1/60 ), 0,
	'optional arcade mode brakes after release' );

function heldThrottleAt( fps ) {
	const t = { throttle: 0, throttleHold: 0 };
	for ( let n = 0; n < fps * .62; n ++ ) adjustSubmarineThrottle( t,
		{ up: true, upPressed: n === 0 }, 1 / fps );
	return t.throttle;
}
assert.ok( Math.abs( heldThrottleAt( 30 ) - heldThrottleAt( 144 ) ) < .03,
	'throttle lever is independent of 30/144Hz display update rate' );

const camera = orbitSubmarineCamera( 0, .20, 120, 35, 1 );
assert.ok( camera.yaw < -.30 && camera.elevation > .26, 'mouse right/down looks right/down' );
assert.ok( camera.yaw > -Math.PI && camera.yaw <= Math.PI );

function cruise( fps ) {
	const s = { throttle: .80, speed: 0, yaw: 0, yawRate: 0, rudder: 0,
		diveVelocity: 0, pitch: 0, subRoll: 0 };
	for ( let n = 0; n < fps * 3; n ++ ) stepSubmarineDynamics( s,
		{ thrust: s.throttle, turn: n < fps * 1.3 ? 1 : 0 }, 1 / fps );
	return s;
}
const samples = [ cruise( 30 ), cruise( 60 ), cruise( 144 ) ];
const stationary = { speed: 0, yaw: 0, yawRate: 0, rudder: 0, diveVelocity: 0, pitch: 0, subRoll: 0 };
for ( let n = 0; n < 60; n ++ ) stepSubmarineDynamics( stationary, { thrust: 0, turn: 1 }, 1/60 );
assert.ok( Math.abs( stationary.yaw ) < .25, 'nearly stationary hull does not pirouette like an FPS character' );
for ( const s of samples ) {
	assert.ok( Math.abs( s.speed - SUBMARINE_DRIVE.cruise * .8 ) < .03,
		'speed settles at persistent ordered value' );
	assert.ok( s.yaw < -.5, 'D turns the hull toward screen right' );
	assert.ok( Math.abs( s.rudder ) < .0003, 'rudder returns to centre after A/D release' );
	assert.ok( Math.abs( s.yawRate ) < .002, 'hull stops rotating after the rudder centres' );
}
assert.ok( Math.abs( samples[0].yaw - samples[2].yaw ) < .025 );

const nodes = new Map();
const uiNode = key => {
	if ( !nodes.has( key ) ) nodes.set( key, { textContent: '', disabled: false, style: {} } );
	return nodes.get( key );
};
const held = new Set();
const pressed = new Set();
let move = { x: 0, y: 0 };
const input = {
	down: k => held.has( k ), hit: k => pressed.has( k ),
	consumeLook() { const result = move; move = { x: 0, y: 0 }; return result; },
	consumeWheel: () => 0,
};
const live = Object.assign( Object.create( AbyssRaid.prototype ), {
	active: true, finished: false, elapsed: 0, noticeClock: 0, notice: '',
	gunHurt: 0, godHurt: 0, bossHitFlash: 0, fireCooldown: 0,
	harpoonCooldown: 0, chargeCooldown: 0, counterPulseCooldown: 0,
	sonarClock: 0, pingClock: 0, pingCooldown: 0,
	pos: new Vector3( ABYSS_ZONE.x, -100, ABYSS_ZONE.z ),
	godPos: new Vector3( ABYSS_ZONE.x + 100, -160, ABYSS_ZONE.z ),
	forward: new Vector3(), godForward: new Vector3( 0, 0, 1 ),
	yaw: 0, speed: 0, rudder: 0, yawRate: 0, subRoll: 0, pitch: 0,
	diveVelocity: 0, subImpulse: new Vector3(),
	throttle: 0, throttleHold: 0, driveCommand: 0, boostCommand: false,
	windup: 0, godHP: 6100, hull: 1500, helmMode: 'helm', mouseSensitivity: 1,
	bossLock: false, orbitYaw: 0, orbitElevation: .2,
	orbitTargetYaw: 0, orbitTargetElevation: .2,
	cameraDistance: 46, cameraAim: new Vector3(), cameraPrimed: false,
	lightsOn: true, lampsOn: true,
	hud: { classList: { toggle() {} }, querySelector: uiNode },
	app: { input, camera: { position: new Vector3(), lookAt() {} } },
	sub: { position: new Vector3(), rotation: { set() {} } },
	stepGod() {}, stepTorpedoes() {}, stepWaterJets() {}, stepShockwaves() {}, updateDiveLights() {},
} );

// Mouse-only movement: camera changes, hull angle and speed are unaffected.
move = { x: 100, y: 40 };
live.update( 1/60 );
assert.equal( live.yaw, 0, 'mouse motion NEVER changes the hull yaw' );
assert.equal( live.throttle, 0, 'mouse motion NEVER changes throttle' );
assert.ok( live.orbitYaw < 0 && live.orbitElevation > .2 );
const lastCameraTarget = live.orbitTargetYaw;
for ( let n = 0; n < 30; n ++ ) live.update( 1/60 );
assert.equal( live.orbitTargetYaw, lastCameraTarget, 'camera does not autonomously recenter' );

// A single W tap orders 25%; cruise continues to accelerate after key release.
held.add( 'KeyW' ); pressed.add( 'KeyW' );
live.update( 1/60 );
held.clear(); pressed.clear();
assert.equal( live.throttle, .25 );
const beforeCruise = live.speed;
for ( let n = 0; n < 20; n ++ ) live.update( 1/60 );
assert.ok( live.speed > beforeCruise && live.throttle === .25 );
assert.match( uiNode( '[data-abyss-target-speed]' ).textContent, /21\.5 m\/s/ );
assert.match( uiNode( '[data-abyss-thrust]' ).textContent, /前进 25%/ );

// D steers right, release straightens the rudder while speed keeps cruising.
held.add( 'KeyD' );
for ( let n = 0; n < 35; n ++ ) live.update( 1/60 );
assert.ok( live.yaw < -.15 );
held.clear();
for ( let n = 0; n < 100; n ++ ) live.update( 1/60 );
assert.ok( Math.abs( live.rudder ) < .001 );
assert.ok( live.speed > 20 );

pressed.add( 'KeyN' ); held.add( 'KeyN' );
live.update( 1/60 );
pressed.clear(); held.clear();
assert.equal( live.throttle, 0 );
const beforeStop = live.speed;
for ( let n = 0; n < 12; n ++ ) live.update( 1/60 );
assert.ok( live.speed < beforeStop, 'neutral brings engine speed down' );

// HUD buttons run the same gearbox, preserving combat and input isolation.
assert.equal( live.changeThrottle( .25 ), true );
assert.equal( live.throttle, .25 );
assert.equal( live.allStop(), true );
assert.equal( live.throttle, 0 );

console.log( 'V30 PASS: independent mouse camera, latched W/S telegraph, N stop, self-centering A/D rudder, correct speed/lever HUD, mode switching and 30/60/144Hz consistency.' );
