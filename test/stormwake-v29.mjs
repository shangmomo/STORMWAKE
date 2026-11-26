import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from '../src/engine/index.js';
import { SUBMARINE_DRIVE, orbitSubmarineCamera, adjustSubmarineThrottle, stepSubmarineDynamics } from '../src/oceanhunt/SubmarineDynamics.js';
import { ABYSS_ZONE, AbyssRaid, abyssCameraPose, beyondAbyssPatrol } from '../src/oceanhunt/AbyssRaid.js';

const source = p => readFileSync( new URL( '../' + p, import.meta.url ), 'utf8' );
const raid = source( 'src/oceanhunt/AbyssRaid.js' );
const app = source( 'src/App.js' );
const chart = source( 'src/islandlife/OceanChart.js' );
const ui = source( 'src/ui/UI.js' );

// V30 deliberately replaces V29's mouse steering: the mouse *always* orbits
// the view. It has no access to heading, engine power, or rudder state.
const rightCamera = orbitSubmarineCamera( 0, .2, 130, 0, 1 );
assert.ok( rightCamera.yaw < -.35, 'mouse right orbits toward screen right' );
const leftCamera = orbitSubmarineCamera( 0, .2, -130, 0, 1 );
assert.ok( leftCamera.yaw > .35, 'mouse left orbits toward screen left' );
const sensitive = orbitSubmarineCamera( 0, .2, 70, 0, 1.35 );
assert.ok( sensitive.yaw < orbitSubmarineCamera( 0, .2, 70, 0, .7 ).yaw );
const wrapped = orbitSubmarineCamera( Math.PI - .02, .2, 100, 0, 1 );
assert.ok( Math.abs( wrapped.yaw - ( Math.PI - .02 ) ) < .5, 'no +/-pi jump' );
const lever = { throttle: 0, throttleHold: 0 };
adjustSubmarineThrottle( lever, { up: true, upPressed: true }, 1/60 );
assert.equal( lever.throttle, SUBMARINE_DRIVE.throttleNotch );
adjustSubmarineThrottle( lever, {}, 1/60 );
assert.equal( lever.throttle, SUBMARINE_DRIVE.throttleNotch, 'releasing W retains the engine order' );

const vessel = () => ( { speed: 0, yaw: 0, yawRate: 0, diveVelocity: 0, pitch: 0, subRoll: 0 } );
function simulate( fps ) {
	const craft = vessel();
	for ( let n = 0; n < fps * 3; n ++ ) stepSubmarineDynamics( craft,
		{ thrust: 1, flank: true, heading: .75, ballast: n < fps ? -1 : 0 }, 1 / fps );
	return craft;
}
const at30 = simulate( 30 ), at60 = simulate( 60 ), at144 = simulate( 144 );
for ( const c of [ at30, at60, at144 ] ) {
	assert.ok( c.speed > SUBMARINE_DRIVE.cruise + 20 && c.speed <= SUBMARINE_DRIVE.flank );
	assert.ok( Math.abs( c.yaw - .75 ) < .005, 'mouse helm reaches its desired bearing' );
	assert.ok( Math.abs( c.diveVelocity ) < .02, 'ballast returns to neutral' );
}
assert.ok( Math.abs( at30.yaw - at144.yaw ) < .01, 'heading is frame-rate independent' );
const braking = vessel(); braking.speed = SUBMARINE_DRIVE.flank;
for ( let n = 0; n < 72; n ++ ) stepSubmarineDynamics( braking, { thrust: 0 }, 1 / 60 );
assert.ok( braking.speed < 1, 'releasing W brakes the propeller predictably' );
const reverse = vessel();
for ( let n = 0; n < 100; n ++ ) stepSubmarineDynamics( reverse, { thrust: -1, turn: 1 }, 1 / 60 );
assert.ok( reverse.speed < -30 && reverse.yaw > .5, 'rudder reverses naturally in reverse gear' );
const ballast = vessel();
for ( let n = 0; n < 60; n ++ ) stepSubmarineDynamics( ballast, { ballast: 1 }, 1 / 60 );
assert.ok( ballast.diveVelocity > 34, 'submarine can surface without engine thrust' );
for ( let n = 0; n < 100; n ++ ) stepSubmarineDynamics( ballast, { ballast: -1 }, 1 / 60 );
assert.ok( ballast.diveVelocity < -34, 'submarine can dive without engine thrust' );
assert.ok( SUBMARINE_DRIVE.flank > 60 * 1.8, 'the submarine can outrun the boss charge' );

const origin = new Vector3( 0, -60, 0 );
const chase = abyssCameraPose( origin, 0, 0, .32, 46, 'chase' );
const bridge = abyssCameraPose( origin, 0, 0, .32, 46, 'bridge' );
assert.ok( chase.position.y > chase.target.y && bridge.position.y > bridge.target.y,
	'positive mouse-down elevation looks down from both camera modes' );
assert.ok( chase.position.z < origin.z && bridge.position.z > origin.z );
assert.ok( ABYSS_ZONE.safeDepth < ABYSS_ZONE.maxDepth );
assert.equal( beyondAbyssPatrol( ABYSS_ZONE.x, ABYSS_ZONE.z ), false );
assert.equal( beyondAbyssPatrol( ABYSS_ZONE.x + ABYSS_ZONE.radius + 5, ABYSS_ZONE.z ), true );

assert.match( raid, /helmMode = helmPrefs\.mode/ );
assert.match( raid, /data-abyss="helm"/ );
assert.match( raid, /data-abyss="sensitivity"/ );
assert.match( raid, /orbitSubmarineCamera\(/ );
assert.match( raid, /guided: this\.bossLock/ );
assert.match( raid, /for \( const shot of this\.torpedoes \) this\.app\.scene\.remove/ );
assert.match( raid, /document\.exitPointerLock\?\.\(\)/ );
assert.match( app, /if \( !this\.hunt\?\.abyss\?\.active \) this\.game\.update\( dt \)/ );
assert.match( chart, /! app\.hunt\?\.abyss\?\.active/ );
assert.match( ui, /classList\.contains\( 'abyss-raid-active' \)/ );
assert.doesNotMatch( raid, /this\.speed\s*=\s*0;\s*this\.notice\s*=\s*'⚠ 已抵达深渊海沟边界/ );
assert.match( source( 'src/oceanhunt/abyss-raid.css' ), /body\.abyss-raid-active \.tw-root,[\s\S]*?display:\s*none\s*!important/ );

// Lock-on seeker has a real 3-D swept collision; losing the camera lock after
// launching must not switch off guidance on an already launched torpedo.
const game = Object.create( AbyssRaid.prototype );
game.active = true; game.finished = false; game.fireCooldown = 0; game.bossLock = true;
game.pos = new Vector3( 0, -60, 0 ); game.godPos = new Vector3( 0, -145, 200 );
game.yaw = 0; game.pitch = 0; game.torpedoGeometry = {}; game.torpedoMaterial = {};
game.torpedoes = []; game.app = { scene: { add() {}, remove() {} } };
assert.equal( game.fire(), true );
assert.equal( game.torpedoes[0].guided, true );
assert.ok( game.torpedoes[0].velocity.y < -10, 'locked torpedo starts diving toward target' );

// Integration regression from the user screenshot: a throttle notch at the
// old horizontal radius must MOVE the hull and animate the actual speed gauge.
const nodes = new Map();
const uiNode = key => {
	if ( !nodes.has( key ) ) nodes.set( key, { textContent: '', disabled: false, style: { width: '0%' } } );
	return nodes.get( key );
};
const held = new Set( [ 'KeyW', 'ShiftLeft', 'ControlLeft' ] );
const testInput = {
	down( key ) { return held.has( key ); }, hit( key ) { return held.has( key ); },
	consumeLook() { return { x: 0, y: 0 }; }, consumeWheel() { return 0; },
};
const live = Object.assign( Object.create( AbyssRaid.prototype ), {
	active: true, finished: false, elapsed: 0, noticeClock: 0, notice: '',
	gunHurt: 0, godHurt: 0, bossHitFlash: 0, fireCooldown: 0,
	harpoonCooldown: 0, chargeCooldown: 0, counterPulseCooldown: 0,
	sonarClock: 0, pingClock: 0, pingCooldown: 0,
	pos: new Vector3( ABYSS_ZONE.x - ABYSS_ZONE.radius - 1, -ABYSS_ZONE.maxDepth, ABYSS_ZONE.z ),
	godPos: new Vector3( ABYSS_ZONE.x, -140, ABYSS_ZONE.z ),
	forward: new Vector3(), godForward: new Vector3( 0, 0, 1 ),
	yaw: -Math.PI / 2, throttle: .75, throttleHold: 0, pitch: 0, speed: 78,
	yawRate: 0, subRoll: 0, diveVelocity: 0, subImpulse: new Vector3(),
	windup: 0, godHP: 6100, hull: 1500, helmMode: 'helm', mouseSensitivity: 1,
	bossLock: false, orbitYaw: 0, orbitElevation: .2,
	orbitTargetYaw: 0, orbitTargetElevation: .2,
	cameraDistance: 46, cameraAim: new Vector3(), cameraPrimed: false,
	lightsOn: true, lampsOn: true,
	hud: { classList: { toggle() {} }, querySelector: uiNode },
	app: { input: testInput, camera: { position: new Vector3(), lookAt() {} } },
	sub: { position: new Vector3(), rotation: { set() {} } },
	stepGod() {}, stepTorpedoes() {}, stepWaterJets() {}, stepShockwaves() {}, updateDiveLights() {},
} );
const firstX = live.pos.x;
live.update( .05 );
assert.ok( live.pos.x < firstX && live.speed > 78,
	'no invisible-wall stop at the old patrol radius' );
assert.ok( Number.parseFloat( uiNode( '[data-abyss-speed]' ).textContent ) > 78 );
assert.ok( Number.parseFloat( uiNode( '[data-abyss-speed-fill]' ).style.width ) > 60 );
assert.match( uiNode( '[data-abyss-thrust]' ).textContent, /急速/ );
assert.equal( live.pos.y, -ABYSS_ZONE.maxDepth, 'no movement below maximum depth' );
assert.equal( live.diveVelocity, 0, 'depth readout never claims movement at the floor' );
held.clear();
const speedBeforeBraking = live.speed;
live.update( .05 );
assert.ok( live.speed > speedBeforeBraking, 'releasing W preserves ordered speed instead of auto-braking' );
assert.match( uiNode( '[data-abyss-thrust]' ).textContent, /车钟：前进 100%/ );
live.hull = 120;
live.update( .05 );
assert.equal( live.emergencyAscent, true, 'critically damaged hull rises automatically' );
assert.ok( live.diveVelocity > 0, 'emergency ballast produces real upward movement' );

console.log( 'V29 legacy regressions PASS: real speed gauge, free navigation, depth rescue, combat isolation, 30/60/144 Hz dynamics.' );
