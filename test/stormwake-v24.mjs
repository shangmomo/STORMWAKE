import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3, Color } from '../src/engine/index.js';
import { AbyssRaid, abyssCameraPose } from '../src/oceanhunt/AbyssRaid.js';
import { ABYSS_ASSETS } from '../src/oceanhunt/TitanAssets.js';

const origin = new Vector3( 300, -125, 700 );
const a = abyssCameraPose( origin, 0, 0, .23, 32, 'chase' );
assert.ok( a.position.z < origin.z - 10, 'third-person camera must sit behind the nose' );
assert.ok( a.position.y > origin.y + 5, 'default camera must stay ABOVE the sub, not below the hull' );
assert.ok( a.target.z > a.position.z, 'camera must look toward the submarine' );

const b = abyssCameraPose( origin, 0, Math.PI / 2, .23, 32, 'chase' );
assert.ok( b.position.x < origin.x - 10, 'orbit aim must rotate sideways independently from heading' );
assert.ok( b.target.distanceTo( a.target ) > 5, 'free-look actually changes aim, not just a HUD label' );

const c = abyssCameraPose( origin, Math.PI / 3, .45, -.12, 48, 'bridge' );
assert.ok( c.position.y > origin.y + 8, 'periscope must remain outside opaque conning tower' );
assert.ok( c.target.distanceTo( c.position ) > 80, 'periscope requires a genuine distance look-vector' );

const abyss = Object.create( AbyssRaid.prototype );
const sources = [];
const fl = { on: true, overridePosition: new Vector3(), overrideDir: new Vector3() };
abyss.app = { localLights: { sources, add( s ) { sources.push( s ); return s; }, flashlight: fl } };
abyss.pos = new Vector3( 0, -190, 0 );
abyss.godPos = new Vector3( 0, -215, 110 );
abyss.forward = new Vector3( 0, 0, 1 );
abyss.godForward = new Vector3( 0, 0, -1 );
abyss.yaw = 0;
abyss.active = true;
abyss.lampsOn = true;
abyss.renderHud = () => {};
abyss.installDiveLights();
assert.equal( abyss.diveLights.length, 3, 'two forward searchlights plus keel fill light' );
assert.ok( abyss.diveLights.every( s => s.alwaysOn && s.range >= 80 ) );
assert.ok( abyss.diveLights[0].color instanceof Color );
abyss.toggleDiveLights( true );
abyss.updateDiveLights();
assert.ok( abyss.diveLights[0].position.z > 10 );
assert.equal( abyss.diveLights[0].dir.z, 1, 'beams must be ship-forward in world space' );
assert.ok( fl.overridePosition.distanceTo( abyss.pos ) > 10, 'volumetric beam has a physical lens origin' );
abyss.toggleDiveLights( false );
assert.ok( abyss.diveLights.every( s => !s.enabled ), 'lights must really switch off' );
assert.equal( fl.on, false );
assert.equal( abyss.bossLight.enabled, true, 'boss bioluminescence independent from player lights' );

assert.equal( ABYSS_ASSETS.sea_god.externalUrl, '/models/titans/external/leviathan-monster.glb' );
const lightSource = readFileSync( new URL( '../src/materials/LocalLights.js', import.meta.url ), 'utf8' );
assert.match( lightSource, /s\.alwaysOn \? this\.strength : nightLevel/,
	'deep-sea lamps must not be gated by surface day/night' );
const appSource = readFileSync( new URL( '../src/App.js', import.meta.url ), 'utf8' );
assert.match( appSource, /KeyL' \) && ! this\.hunt\?\.abyss\?\.active/,
	'global handheld lamp must not conflict with submarine keybind' );

console.log( 'V24: independent orbit & periscope camera, day-independent dual floodlights, volumetric sub beam, optional licensed Leviathan source passed.' );
