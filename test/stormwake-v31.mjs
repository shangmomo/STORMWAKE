import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3 } from '../src/engine/index.js';
import { Colliders } from '../src/world/Colliders.js';
import { TerrainData } from '../src/world/TerrainData.js';
import { LAND_SITES, LAND_SPECIES, landPhase, restoreLandSave, rotateMirror,
	allMirrorsAligned, createLandEnemy, advanceLandEnemy, landEnemyHit, targetWithinStrike } from '../src/land/LandLogic.js';
import { LandAdventure } from '../src/land/LandAdventure.js';
import { residentShift } from '../src/land/LandResidents.js';

const file = f => readFileSync( new URL( `../${f}`, import.meta.url ), 'utf8' );
assert.match( file( 'src/App.js' ), /this\.landAdventure = new LandAdventure/ );
assert.match( file( 'src/App.js' ), /this\.landAdventure\.update\( dt \)/ );
assert.match( file( 'src/game/Game.js' ), /! app\.landAdventure\?\.stance/ );
assert.match( file( 'src/player/Player.js' ), /this\.adventure\?\.dodgeTimer > 0/ );
assert.match( file( 'src/land/land-adventure.css' ), /land-v31-hud/ );

assert.deepEqual( restoreLandSave( { stage: 200, mirrors: [ 6, -1, 99 ], kills: -3, shrineFound: 'yes' } ),
	{ stage: 4, mirrors: [ 2, 3, 3 ], kills: 0, shrineFound: false, lastRaidDay: 0 } );
assert.equal( landPhase( 12 ), 'calm' );
assert.equal( landPhase( 19 ), 'warning' );
assert.equal( landPhase( 21 ), 'invasion' );
assert.equal( landPhase( 1, true ), 'guarded-night' );
const mirrors = [ 0, 0, 0 ];
for ( const [ i, count ] of [ [ 0, 2 ], [ 1, 1 ], [ 2, 3 ] ] ) for ( let n = 0; n < count; n ++ ) rotateMirror( mirrors, i );
assert.ok( allMirrorsAligned( mirrors ), 'all three mechanical mirrors can be solved without companion' );
rotateMirror( mirrors, 2 );
assert.equal( allMirrorsAligned( mirrors ), false );
assert.equal( LAND_SITES.trail.length, 10 );
const terrain = new TerrainData();
for ( let i = 1; i < LAND_SITES.trail.length; i ++ ) {
	const a = LAND_SITES.trail[ i - 1 ], b = LAND_SITES.trail[ i ];
	const distance = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
	const steps = Math.ceil( distance / .65 );
	let last = terrain.heightAt( ...a );
	for ( let j = 1; j <= steps; j ++ ) {
		const f = j / steps, y = terrain.heightAt( a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * f,
			a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * f );
		assert.ok( Math.abs( y - last ) / ( distance / steps ) < .65,
			`trail segment ${ i } has a cliff at step ${ j }; guidance must follow walkable contour` );
		last = y;
	}
}
assert.equal( residentShift( 11 ), 'work' );
assert.equal( residentShift( 19 ), 'meet' );
assert.equal( residentShift( 23 ), 'home' );
assert.equal( residentShift( 11, true ), 'shelter' );

const crab = createLandEnemy( 'crab', 'crab', 0, 0 );
let strikes = 0, visualTelegraphs = 0;
for ( let i = 0; i < 150; i ++ ) {
	const r = advanceLandEnemy( crab, { x: 1, z: 0 }, 1/60 );
	if ( crab.state === 'telegraph' ) visualTelegraphs ++;
	if ( r.strike ) strikes ++;
}
assert.ok( visualTelegraphs > 15, 'enemy has a readable windup warning' );
assert.equal( strikes, 1, 'one contact check per strike, not continuous invisible damage' );
assert.ok( targetWithinStrike( { x: 0, z: 0, y: 0 }, { x: 1, z: 1, y: 0 }, 2 ) );
assert.equal( targetWithinStrike( { x: 0, z: 0, y: 0 }, { x: 1, z: 1, y: 6 }, 2 ), false );
assert.equal( landEnemyHit( crab, LAND_SPECIES.crab.hp ), true );
assert.equal( landEnemyHit( crab, 100 ), false, 'death cannot reward twice' );
assert.equal( advanceLandEnemy( crab, { x: 1, z: 0 }, 1/60 ).strike, false );
const wraith = createLandEnemy( 'ghost', 'wraith', 0, 0 );
advanceLandEnemy( wraith, { x: 2, z: 0 }, 1/60, { illuminated: true } );
assert.equal( wraith.state, 'flee', 'torchlight drives away spectral enemies' );
assert.ok( wraith.vx < 0 );
const guardian = createLandEnemy( 'guardian', 'warden', 0, 0 );
const patterns = new Set();
for ( let n = 0; n < 750; n ++ ) {
	const event = advanceLandEnemy( guardian, { x: 2, z: 0 }, 1/60 );
	if ( event.strike ) patterns.add( event.style );
}
assert.deepEqual( [ ...patterns ].sort(), [ 'rush', 'shockwave', 'sweep' ].sort(),
	'land boss cycles physically different sweep, shockwave and rush attacks' );

function mockApp( hour = 12 ) {
	const pressed = new Set(), held = new Set(), awarded = [], objects = [];
	const input = {
		mouseDown: false, rightDown: false,
		down: key => held.has( key ), hit: key => pressed.has( key ),
		consume( key ) { if ( !pressed.has( key ) ) return false; pressed.delete( key ); return true; },
	};
	const player = { mode: 'walk', position: new Vector3( LAND_SITES.board.x, 5, LAND_SITES.board.z ),
		velocity: new Vector3(), getViewDir( v ) { return v.set( 0, 0, -1 ); }, groundAt: () => 5, prompt: null };
	const app = { input, player, freeCam: false, settings: { timeOfDay: hour },
		scene: { add( x ) { objects.push( x ); }, remove( x ) { const i = objects.indexOf( x ); if ( i >= 0 ) objects.splice( i, 1 ); } },
		terrainData: { heightAt: () => 5 },
		colliders: new Colliders(),
		localLights: { flashlight: { on: false }, add( src ) { return src; } },
		camera: { position: new Vector3( 57, 8, -80 ), quaternion: { clone() {} } },
		game: { rod: { equip( equipped ) { this.equipped = equipped; } }, cancelLine() {},
			state: { grantMoney( amount, id ) { awarded.push( [ amount, id ] ); return true; } } },
		companionActor: { group: { position: new Vector3( 57, 5, -80 ) }, command( x ) { this.last = x; return true; } },
		homeLife: { saveState: { day: 3 } },
	};
	return { app, pressed, held, awarded, objects };
}

const mock = mockApp();
const land = new LandAdventure( mock.app ); mock.app.landAdventure = land;
assert.ok( mock.objects.length > 15 &&
	mock.app.colliders.boxes.length + mock.app.colliders.cylinders.length >= 480,
	'new hollow tower, 154 actual stairs, props, animals and enemies are registered in the 3D scene' );
assert.ok( land.residents.residents.length >= 10, 'townsfolk population includes multiple work/evening/night schedules' );
assert.equal( land.progress.stage, 0 );
mock.pressed.add( 'KeyE' );
land.update( 1/60 );
assert.equal( land.progress.stage, 1, 'board accepts the land chapter' );
assert.equal( mock.app.companionActor.last, 'follow', 'Xiaoxi joins the expedition' );
mock.app.player.position.set( LAND_SITES.lighthouse.x, 5, LAND_SITES.lighthouse.z );
land.update( 1/60 );
assert.equal( land.progress.stage, 2, 'lighthouse proximity unlocks optical puzzle' );
for ( let i = 0; i < 3; i ++ ) {
	for ( let n = 0; n < [ 2, 1, 3 ][ i ]; n ++ ) {
		mock.app.player.position.copy( land.mirrors[ i ].group.position );
		mock.pressed.add( 'KeyE' ); land.update( 1/60 );
	}
}
assert.equal( land.progress.stage, 3, 'three mirrors awaken the original land boss' );
assert.ok( land.mirrorRays.every( ray => ray.visible ), 'aligned lenses cast visible beams into the beacon' );
const boss = land.enemies.find( e => e.type === 'warden' );
assert.ok( !boss.dead && boss.model.group.visible );
assert.equal( landEnemyHit( boss, 9999 ), true ); land._defeated( boss );
assert.equal( land.progress.stage, 4 );
assert.equal( land.lighthouseLight.enabled, true, 'beacon lights only after boss defeat' );
assert.ok( mock.awarded.some( a => a[ 0 ] === 250 ) );

const raid = mockApp( 21 );
const defense = new LandAdventure( raid.app ); raid.app.landAdventure = defense;
defense.progress.stage = 1; defense.progress.kills = 1;
defense.update( 1/60 );
assert.ok( defense.raidActive );
assert.equal( defense.enemies.filter( e => e.raid ).length, 3 );
for ( const e of defense.enemies.filter( e => e.raid ) ) e.dead = true;
defense.update( 1/60 );
assert.equal( defense.raidActive, false );
assert.ok( !defense.enemies.some( e => e.raid ), 'old raids do not leak CPU or GPU entities' );
assert.ok( raid.awarded.some( a => a[ 0 ] === 75 ) );

console.log( 'V31 PASS: living island and tower models, land combat telegraphs, torches, AI contact, 3-mirror puzzle, Xiaoxi aid, boss, saves and nightly harbor defense.' );
