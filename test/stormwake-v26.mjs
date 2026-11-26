import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from '../src/engine/index.js';
import { WORLD } from '../src/world/WorldLayout.js';
import { AbyssRaid, abyssCameraPose, abyssSteering } from '../src/oceanhunt/AbyssRaid.js';
import { mainIslandHarborArrival, returnCaptainToMainIsland } from '../src/oceanhunt/DeveloperTools.js';
import { G } from '../src/core/Globals.js';

const file = relative => readFileSync( new URL( '../' + relative, import.meta.url ), 'utf8' );
const css = file( 'src/oceanhunt/abyss-raid.css' );
const raid = file( 'src/oceanhunt/AbyssRaid.js' );

// Screen-sized container and mutually exclusive HUD layers: prior V25's
// filtered ancestor made a bottom: -1px bar land mid-screen instead.
assert.match( css, /\.abyss-raid-hud\s*\{[^}]*inset:\s*0;/ );
assert.match( css, /\.abyss-weapon\s*\{[^}]*bottom:\s*12px/ );
assert.match( css, /body\.abyss-raid-active \.tw-root/ );
assert.doesNotMatch( css, /filter:\s*drop-shadow/ );
assert.match( raid, /data-abyss="home"/ );
// V30 animates towards a distinct camera orbit target without touching hull yaw.
assert.match( raid, /this\.orbitTargetYaw\s*[-+]=/ );
assert.match( raid, /Number\( input\.down\( 'KeyD' \) \) - Number\( input\.down\( 'KeyA' \) \)/ );
assert.match( raid, /this\.cameraAim\.lerp\( pose\.target/ );

// Smoothing has bounded turn rates, no wrap jump at +/- pi, and the same
// orbit pose drives both submarine camera modes.
let yaw = Math.PI - 0.03;
for ( let i = 0; i < 150; i ++ ) {
	const next = abyssSteering( yaw, -Math.PI + 0.22, 0.6, 1 / 60 );
	assert.ok( Math.abs( next - yaw ) <= 0.01001 );
	yaw = next;
}
assert.ok( Math.abs( Math.atan2( Math.sin( yaw + Math.PI - 0.22 ), Math.cos( yaw + Math.PI - 0.22 ) ) ) < 0.001 );
const chase = abyssCameraPose( new Vector3( 0, -65, 0 ), 0, 0.2, .22, 32, 'chase' );
const bridge = abyssCameraPose( new Vector3( 0, -65, 0 ), 0, 0.2, .22, 32, 'bridge' );
assert.ok( chase.position.y > -65 );
assert.ok( bridge.position.y > -65 );
assert.ok( chase.target.x > 0 && bridge.target.x > bridge.position.x );

// All three rendering paths must respect the active-only deep-visibility
// uniform, preserving exact original surface optics at zero.
assert.equal( G.abyssVision.value, 0 );
for ( const path of [ 'src/materials/LocalLights.js', 'src/ocean/UnderwaterLighting.js', 'src/post/Underwater.js' ] ) {
	assert.match( file( path ), /frame\.abyssVision/, `${path} must honor the arena-only light override` );
}
assert.match( raid, /G\.abyssVision\.value = 1/ );
assert.match( raid, /G\.abyssVision\.value = 0/ );

// Return-to-main-island must relocate both the real physics hull and player,
// validate seabed depth and preserve boss progression outside the raid.
const terrain = { heightAt: ( x, z ) => z >= 100 ? -12 : -3 };
const arrival = mainIslandHarborArrival( terrain );
assert.ok( arrival );
assert.ok( Math.hypot( arrival.x - WORLD.pier.x, arrival.z - WORLD.pier.zEnd ) < 200 );
assert.equal( mainIslandHarborArrival( { heightAt: () => 3 } ), null );
const position = new Vector3(), velocity = new Vector3( 3, 0, 5 );
const player = { mode: 'boat', position, velocity, camInit: true, _camY: 4, orbitYaw: 0 };
let warped = 0;
const app = {
	terrainData: terrain, player,
	boatCtl: {
		model: { helmEye: new Vector3( 0, 3, 0 ) },
		teleportTo( x, z ) { warped++; return z >= 100 && x > 60; },
		toWorld( local, out ) { out.copy( local ); return out; },
	},
	marineExpedition: { targetZone: 'boss:leviathan' },
};
assert.deepEqual( returnCaptainToMainIsland( app ), arrival );
assert.equal( warped, 1 );
assert.equal( player.camInit, false );
assert.equal( player._camY, null );
assert.equal( velocity.lengthSq(), 0 );
assert.equal( app.marineExpedition.targetZone, null );

// The 3D creature moves only along its continuously-steered facing vector.
// Old V25 moved sideways toward a freshly rotated target point every frame.
assert.doesNotMatch( raid, /displacement\.normalize\(\)/ );
assert.match( raid, /godPos\.addScaledVector\( this\.godForward, this\.godSpeed \* dt \)/ );
assert.match( raid, /const desired = charging \? 'Charge'/ );
const boss = {
	finished: false, godHP: 6100, pos: new Vector3( 0, -70, 50 ),
	godPos: new Vector3( 0, -230, -205 ), godForward: new Vector3(),
	bossState: 'stalk', bossAttackType: 'ram', bossAttackIndex: 0,
	stateClock: 4, godYaw: .05, godSpeed: 6, godYawRate: 0,
	godPitch: 0, godBank: 0, elapsed: 0, godMotes: [],
	god: { position: new Vector3(), rotation: { set() {} } },
};
for ( let i = 0; i < 1000; i ++ ) {
	const before = boss.godPos.clone();
	boss.elapsed += 1 / 60;
	AbyssRaid.prototype.stepGod.call( boss, 1 / 60 );
	const distance = boss.godPos.distanceTo( before );
	assert.ok( distance < 1.3, `frame ${i} teleport-like creature motion ${distance}` );
	assert.ok( Number.isFinite( boss.godYaw ) && Number.isFinite( boss.godPitch ) );
}

console.log( 'V26: compact combat HUD, corrected mouse and steering, safe real harbor teleport, deeper visibility and smoothly propulsive 66-bone Leviathan passed.' );
