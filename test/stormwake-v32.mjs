import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3, Quaternion } from '../src/engine/index.js';
import { Input } from '../src/core/Input.js';
import { LandAdventure } from '../src/land/LandAdventure.js';
import { LAND_BINDINGS, landActionContext, landInputEdges, makeLandActionEvent } from '../src/land/LandControls.js';
import { assignRigActions, validateRigDefinition } from '../src/land/LandRigRuntime.js';
import { createLighthouse } from '../src/land/LandModels.js';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { installHumanoidMotionFallback } from '../src/land/LandHumanoidMotion.js';

const file = name => readFileSync( new URL( `../${name}`, import.meta.url ), 'utf8' );
assert.match( file( 'src/course/IslandCompanion.js' ), /claimsGlobalKey\( 'KeyK' \)/ );
assert.match( file( 'src/ui/UI.js' ), /claimsGlobalKey\( 'KeyP' \)/ );
assert.match( file( 'src/ui/AppUI.js' ), /ui\.app = app/ );
assert.match( file( 'src/App.js' ), /this\.landAdventure\.update\( dt \);\s*if \( !this\.hunt\?\.abyss\?\.active \) this\.game\.update/ );
assert.match( file( 'src/land/LandAvatar.js' ), /class LandAvatar/ );
assert.match( file( 'src/land/LandResidents.js' ), /loadResidentRig/ );

const events = { window: {}, document: {}, dom: {} };
const savedWindow = globalThis.window, savedDocument = globalThis.document;
globalThis.window = { addEventListener: ( key, fn ) => ( events.window[ key ] ||= [] ).push( fn ) };
globalThis.document = { addEventListener: ( key, fn ) => ( events.document[ key ] ||= [] ).push( fn ) };
const dom = { addEventListener: ( key, fn ) => ( events.dom[ key ] ||= [] ).push( fn ), requestPointerLock() {} };
const input = new Input( dom );
const press = code => { for ( const fn of events.window.keydown || [] ) fn( { code, target: { tagName: 'DIV' }, preventDefault() {} } ); };
press( 'KeyZ' );
assert.equal( input.hit( LAND_BINDINGS.stance ), true );
assert.equal( landInputEdges( input, false ).toggle, true );
assert.equal( input.hit( 'KeyZ' ), false, 'combat owns Z once' );
input.endFrame();
press( 'KeyK' );
assert.equal( landInputEdges( input, true ).heavy, true, 'K yields heavy attack only in land stance' );
assert.equal( input.hit( 'KeyK' ), false, 'other frame systems cannot claim heavy key' );
input.endFrame();
press( 'KeyP' );
assert.equal( landInputEdges( input, true ).journal, true, 'journal key is consumed once' );
input.endFrame();
for ( const fn of events.dom.mousedown || [] ) fn( { button: 0 } );
assert.equal( landInputEdges( input, true, false ).light, true, 'real mouse event reaches light strike' );
assert.equal( landInputEdges( input, true, true ).light, false, 'held mouse does not generate duplicate edge' );
for ( const fn of events.window.mouseup || [] ) fn( { button: 0 } );
globalThis.window = savedWindow;
globalThis.document = savedDocument;

const captured = [];
const app = {
	input, freeCam: false,
	player: { mode: 'walk', position: new Vector3( -28, 5, -157.2 ), velocity: new Vector3(),
		getViewDir( v ) { return v.set( 0, 0, -1 ); }, groundAt: () => 5, prompt: null },
	scene: { add( m ) { captured.push( m ); }, remove() {} },
	settings: { timeOfDay: 12 }, terrainData: { heightAt: () => 5 },
	colliders: { addCylinder() {}, resolveCapsule() {} },
	localLights: { flashlight: { on: false }, add( source ) { return source; } },
	camera: { position: new Vector3( -28, 7, -157.2 ), quaternion: new Quaternion() },
	game: { hud: { invOpen: false, standOpen: false, catchOpen: false }, rod: { equip() {} }, cancelLine() {},
		state: { grantMoney() {} } },
	homeLife: { saveState: { day: 1 } }, companionActor: { group: { position: new Vector3() }, command() {} },
};
assert.equal( landActionContext( app ), 'land' );
assert.equal( landActionContext( { ...app, player: { mode: 'boat' } } ), 'unavailable' );
assert.equal( landActionContext( { ...app, ui: { ui: { _photo: true } } } ), 'ui' );
const land = new LandAdventure( app ); app.landAdventure = land;
assert.equal( land.claimsGlobalKey( 'KeyK' ), false );
input.pressed.add( 'KeyZ' );
land.update( 1/60 ); input.endFrame();
assert.equal( land.stance, true, 'actual input activates combat stance' );
assert.equal( land.claimsGlobalKey( 'KeyK' ), true, 'companion global handler must yield K' );
assert.equal( land.claimsGlobalKey( 'KeyP' ), true, 'photo mode must yield P' );
const enemy = land.enemies.find( e => e.id === 'forest-crab' );
const before = enemy.hp;
input.pressed.add( 'KeyK' );
land.update( 1/60 ); input.endFrame();
assert.equal( enemy.hp, before, 'V36: pressing K must not apply damage before the sword reaches its active contact frames' );
for ( let i = 0; i < 16; i ++ ) { land.update( 1/60 ); input.endFrame(); }
assert.ok( enemy.hp < before, 'the heavy strike must contact the enemy during the swept blade interval' );
const once = enemy.hp;
land._resolveStrikeContacts();
assert.equal( enemy.hp, once, 'swept blade can strike a creature only once per input edge' );
const entering = { id: 'window-foe', type: 'hound', x: -28, z: -167, hp: 100, maxHp: 100,
	dead: false, state: 'idle', cooldown: 0 };
land.enemies.push( entering );
land._resolveStrikeContacts();
assert.equal( entering.hp, 100, 'off-screen enemy is not hurt outside the blade arc' );
entering.z = -159.2;
land._resolveStrikeContacts();
assert.equal( entering.hp, 42, 'moving inside active blade arc during swing makes one real contact' );
land._resolveStrikeContacts();
assert.equal( entering.hp, 42, 'continued sword overlap cannot farm duplicate damage' );
land.enemies.pop();
assert.ok( land.combatFX.entries.some( e => e.group.visible && e.kind === 'heavy' ),
	'actual heavy damage spawns a pooled 3D impact burst, not HUD-only feedback' );
assert.ok( land.combatEventLog.some( e => e.action === 'heavy' ), 'every attack emits a replayable action event' );
assert.ok( land.attackTimer > 0 && land.attackArc.visible, 'attack starts a visible swing, not a silent damage counter' );
assert.equal( land.combatEventLog[ 0 ].action, 'equip' );
assert.equal( land.combatEventLog[ 0 ].actorId, 'local' );
assert.equal( land.combatEventLog.at( -1 ).damage, null, 'clients cannot authorize damage in future multiplayer' );
assert.equal( land.combatEventLog.at( -1 ).reward, null );
assert.throws( () => makeLandActionEvent( { actorId: 'x', sequence: 0, tick: 1, action: 'light' } ) );
assert.throws( () => makeLandActionEvent( { actorId: 'x', sequence: 1, tick: 1, action: 'grantMoney' } ) );
assert.equal( makeLandActionEvent( { actorId: 'x', sequence: 1, tick: 2, action: 'guard', held: false } ).held, false,
	'future multiplayer can distinguish guard release from guard press' );
assert.deepEqual( land.combatEventLog.map( e => e.sequence ), [ 1, 2 ] );
// Returning to a submarine never swallows its navigation/weapon hotkeys.
app.player.mode = 'boat';
input.pressed.add( 'KeyZ' );
land.update( 1/60 );
assert.ok( input.hit( 'KeyZ' ), 'land combat does not steal submarine keys' );

const tower = createLighthouse( 0, 0, 0 );
const staticMesh = tower.group.children.find( o => o.isMesh );
assert.ok( staticMesh.geometry.getAttribute( 'position' ).count > 11000,
	'V32 tower has actual masonry courses, windows, lantern glazing, door and outbuildings' );
for ( const character of [ 'joe', 'marta' ] ) {
	const blob = readFileSync( new URL( `../public/models/characters/${character}.glb`, import.meta.url ) );
	const gltf = parseGLB( blob.buffer.slice( blob.byteOffset, blob.byteOffset + blob.byteLength ) );
	const actions = assignRigActions( gltf.animations.map( a => a.name ) );
	assert.ok( gltf.skins[ 0 ].joints.length >= 30, `${character} genuinely skinned` );
	for ( const name of [ 'idle', 'talk', 'greet' ] ) assert.ok( actions[ name ], `${character} has an authored ${name} clip` );
	const fakeRig = { gltf, poseModifier: null };
	const fallback = installHumanoidMotionFallback( { rig: fakeRig } );
	assert.ok( fallback, `${character} exposes leg bones for missing animation fallback` );
	const local = gltf.nodes.map( n => ( { r: Float32Array.from( n.r ) } ) );
	fallback.update( 1 / 60, 'run' );
	fallback.trigger( 'heavy' );
	fakeRig.poseModifier( local );
	for ( const bone of local ) assert.ok( Math.abs( Math.hypot( ...bone.r ) - 1 ) < .001,
		'procedural motions never corrupt skinning quaternion lengths' );
}
assert.deepEqual( validateRigDefinition( { file: '../escape.glb', license: 'CC0' } ).ok, false );
assert.deepEqual( validateRigDefinition( { file: 'fox.glb', license: 'unknown' } ).ok, false );
assert.deepEqual( validateRigDefinition( { file: 'fox.glb', license: 'CC-BY-4.0' } ).ok, true );
console.log( 'V32 PASS: real keyboard/mouse ownership, 3D impact FX pool, skin-safe locomotion+combat fallback, hit validation, replay-safe events, boat isolation, detailed lighthouse and two licensed resident rigs.' );
