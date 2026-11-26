import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from '../src/engine/index.js';
import { closestSegmentPoints, movingJawHullContact, leviathanMouthPosition, approachSpeed } from '../src/oceanhunt/AbyssCombatPhysics.js';
import { AbyssRaid } from '../src/oceanhunt/AbyssRaid.js';

const file = path => readFileSync( new URL( '../' + path, import.meta.url ), 'utf8' );
const shader = file( 'src/ocean/UnderwaterLighting.js' );
const input = file( 'src/core/Input.js' );
const app = file( 'src/App.js' );
const raid = file( 'src/oceanhunt/AbyssRaid.js' );
const skin = file( 'src/engine/render/Skinning.js' );
const assets = file( 'src/oceanhunt/TitanAssets.js' );

// V26 caused a total surface black-out because WGSL let was later assigned.
assert.match( shader, /var atten = exp\(/ );
assert.doesNotMatch( shader, /let atten = exp\([^;]+;\s*atten\s*=/ );

// V28 supersedes V27's right-drag-only control with the surface helm's
// native pointer lock. Keep V27's physically swept jaw and WGSL regressions.
assert.match( input, /this\.lookMode === 'rightDrag' \? this\.rightDown/ );
assert.match( app, /this\.input\.requestLock\(\)/ );
assert.match( raid, /this\.app\.input\.lookMode = 'normal'/ );
assert.match( raid, /this\.app\.input\.lookMode = this\.beforeLookMode/ );
assert.match( raid, /orbitSubmarineCamera\(/ );
assert.match( raid, /this\.subImpulse\.multiplyScalar\( Math\.exp/ );

// A model without a jaw joint needs actual visible lower-lip movement.
assert.match( skin, /const SKIN_VERTEX = \( J, deform = '' \)/ );
assert.match( assets, /biteOpen: \[ 'f32', 0 \]/ );
assert.match( assets, /v\.position\.y -= 0\.0140 \* opening/ );
assert.match( raid, /m\.uniforms\.biteOpen\.value = this\.jawOpen/ );

const V = ( x, y = 0, z = 0 ) => new Vector3( x, y, z );
assert.equal( closestSegmentPoints( V( 0 ), V( 1 ), V( .5, 2 ), V( .5, 3 ) ).distance, 2 );
assert.ok( closestSegmentPoints( V( -1 ), V( 1 ), V( 0, -1 ), V( 0, 1 ) ).distance < 1e-8 );
assert.equal( closestSegmentPoints( V( 0 ), V( 0 ), V( 4 ), V( 4 ) ).distance, 4 );
const sub = V( 0, -80, 0 ), direction = V( 0, 0, 1 );
assert.equal( movingJawHullContact( V( -30, -80, 0 ), V( 30, -80, 0 ), sub, direction ).contact, true,
	'swept mouth hits thin hull even when both endpoints miss' );
assert.equal( movingJawHullContact( V( -30, -80, 29 ), V( 30, -80, 29 ), sub, direction ).contact, false,
	'passing 29m along the hull axis is NOT a physical bite' );
assert.equal( movingJawHullContact( V( 0, -20, 0 ), V( 0, -15, 0 ), sub, direction ).contact, false,
	'overlapping on screen but 65m apart in Y must miss' );
const mouth = leviathanMouthPosition( V( 1, -80, 2 ), V( 0, 0, 1 ) );
assert.deepEqual( mouth.toArray(), [ 1, -75, 118 ] );
assert.equal( approachSpeed( 2, 45, 70, 0.1 ), 9 );
assert.equal( approachSpeed( 45, 2, 100, 0.1 ), 35 );

// Simulates real boss state updates without rendering. Track both movement
// continuity and the lower-jaw curve; a ram must not magically damage at
// range, and the animation must transition to the Bite state on CONTACT.
const boss = {
	finished: false, godHP: 6100, pos: V( 0, -78, 165 ), forward: V( 0, 0, 1 ),
	godPos: V( 0, -80, 0 ), godForward: V( 0, 0, 1 ),
	bossState: 'windup', bossAttackType: 'ram', bossAttackIndex: 0,
	stateClock: .02, godYaw: 0, godSpeed: 6, godYawRate: 0,
	godPitch: 0, godBank: 0, chargeYaw: 0, chargePitch: 0,
	elapsed: 0, godMotes: [], jawOpen: .9, hits: 0,
	god: { position: V( 0 ), rotation: { set() {} } },
	damageHull( n ) { this.hits++; this.lastDamage = n; },
	showImpact() {},
};
let bit = false, maxStep = 0;
for ( let i = 0; i < 240; i ++ ) {
	const old = boss.godPos.clone();
	boss.elapsed += 1 / 60;
	AbyssRaid.prototype.stepGod.call( boss, 1 / 60 );
	maxStep = Math.max( maxStep, old.distanceTo( boss.godPos ) );
	if ( boss.bossState === 'bite' ) { bit = true; break; }
}
assert.ok( bit, 'the committed lunge should reach the 3D target and enter Bite' );
assert.equal( boss.hits, 1, 'the contact must be a single physical bite' );
assert.ok( boss.jawOpen > .35, 'jaw is visually open at the first contact frame' );
assert.ok( maxStep < 1.1, 'boss has smooth motion across 60Hz frames' );

const miss = { ...boss, pos: V( 140, -78, 165 ), hits: 0,
	godPos: V( 0, -80, 0 ), godForward: V( 0, 0, 1 ),
	godYaw: 0, godYawRate: 0, godSpeed: 6, godPitch: 0, godBank: 0,
	bossState: 'charge', chargeYaw: 0, chargePitch: 0,
	stateClock: 1.5, jawOpen: 1, chargeHit: false };
for ( let i = 0; i < 65; i ++ ) AbyssRaid.prototype.stepGod.call( miss, 1 / 60 );
assert.equal( miss.hits, 0, 'physical miss must never damage the submarine' );

console.log( 'V27 legacy: WGSL crash regression, boat-compatible orbit, jaw, realistic lunge, swept 3D bite/whiff and animation passed.' );
