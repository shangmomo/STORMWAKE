import assert from 'node:assert/strict';
import { Vector3 } from '../src/engine/index.js';
import { Colliders } from '../src/world/Colliders.js';
import { installLandSiteColliders } from '../src/land/LandSiteColliders.js';
import { LandInteractionDirector } from '../src/land/LandInteractionDirector.js';
import { LandVillageNavigator } from '../src/land/LandVillageNavigator.js';
import { LandResidents } from '../src/land/LandResidents.js';

const world = new Colliders();
const site = {
	tower: { x: -140, z: -260 },
	shrine: { position: new Vector3( -82, 5, -208 ) },
	mirrors: [ { group: { position: new Vector3( -151, 5, -257 ) } },
		{ group: { position: new Vector3( -136, 5, -247 ) } },
		{ group: { position: new Vector3( -129, 5, -265 ) } } ],
	board: { position: new Vector3( 57, 5, -80 ) },
};
const registered = installLandSiteColliders( world, { heightAt: () => 5 }, site );
assert.ok( registered.length >= 20, 'all relevant supports and obstacles are registered' );
const close = ( actual, expected, label ) => assert.ok( Math.abs( actual - expected ) < .001, label );
close( world.groundHeightAt( -82, -208, 5.7 ), 5.565, 'stone platform top is physically walkable' );
close( world.groundHeightAt( -82, -204.38, 5.5 ), 5.18, 'first visible step is walkable' );
close( world.groundHeightAt( -82, -204.96, 5.6 ), 5.36, 'second visible step is walkable' );
close( world.groundHeightAt( -82, -205.49, 5.7 ), 5.53, 'third visible step is walkable' );
assert.equal( world.groundHeightAt( -82, -202.9, 6 ), -Infinity, 'no invisible suspended platform outside shrine' );
const tabletOverlap = new Vector3( -82, 5.565, -208 );
assert.equal( world.resolveCapsule( tabletOverlap, .32, 1.8, .4 ), true );
assert.ok( Math.hypot( tabletOverlap.x + 82, tabletOverlap.z + 208 ) >= .6, 'tablet prevents character intersection' );
const coLocated = new Colliders();
coLocated.addCylinder( 0, 0, 1, 0, 3 );
const coincident = new Vector3( 0, 0, 0 );
coLocated.resolveCapsule( coincident, .35, 1.8 );
assert.ok( Math.abs( coincident.x ) > 1.3, 'exact-center cylinder collisions never silently fail' );

const director = new LandInteractionDirector();
const player = { position: new Vector3( 0, 0, 0 ), prompt: null };
let calls = 0, key = true;
const input = { consume( code, owner ) {
	assert.equal( code, 'KeyE' ); assert.equal( owner, 'land' );
	if ( !key ) return false;
	key = false; return true;
} };
director.add( { id: 'villager', position: new Vector3( .5, 0, .4 ), range: 2, priority: 35,
	label: 'Talk', perform: () => { calls += 1; } }, player );
director.add( { id: 'mirror', position: new Vector3( 1, 0, 0 ), range: 3, priority: 110,
	label: 'Rotate', perform: () => { calls += 10; } }, player );
assert.equal( director.dispatch( input, player ).id, 'mirror', 'puzzle wins when both within reach' );
assert.equal( calls, 10, 'one E press performs only one action' );
assert.equal( player.prompt.targetId, 'mirror' );
director.dispatch( input, player );
assert.equal( calls, 10, 'same frame cannot perform another interaction' );
player.prompt = { key: 'E', text: 'Take the helm' }; key = true;
assert.equal( director.dispatch( input, player ), null, 'existing boat interaction has right of way' );
assert.equal( calls, 10 );
director.beginFrame();
assert.equal( director.select(), null, 'stale interaction never persists to another frame' );

const street = new Colliders();
street.addBox( new Vector3( 0, 1.4, 0 ), new Vector3( 2.5, 1.4, 2.5 ), 0, { tag: 'village-house' } );
const navigator = new LandVillageNavigator( { heightAt: () => 0 }, street, 1.8 );
const journey = navigator.findPath( [ -9, 0 ], [ 9, 0 ] );
assert.ok( journey.length >= 2, 'villager finds a route around the village house' );
for ( let i = 0; i < journey.length; i ++ )
	assert.ok( navigator.clearSegment( journey[ i - 1 ] || [ -9, 0 ], journey[ i ] ), 'no waypoint segment crosses a solid wall' );
assert.ok( navigator.clearSegment( [ 6, 6 ], [ 8, 6 ] ), 'clear streets remain directly walkable' );

const residentApp = {
	terrainData: { heightAt: () => 0 }, colliders: new Colliders(),
	scene: { add() {} }, settings: { timeOfDay: 11 },
	player: { mode: 'walk', position: new Vector3( 50, 0, -107 ), prompt: null },
	input: { consume: () => false }, freeCam: false,
};
const residents = new LandResidents( residentApp );
assert.ok( residents.residents.length >= 10, 'land population has meaningfully increased' );
const origins = residents.residents.map( r => [ r.x, r.z ] );
for ( let i = 0; i < 60; i ++ ) residents.update( .1 );
assert.ok( residents.residents.some( ( r, i ) => Math.hypot( r.x - origins[ i ][ 0 ], r.z - origins[ i ][ 1 ] ) > 1 ),
	'residents physically travel between destinations, rather than oscillate inside a one-metre circle' );
residentApp.settings.timeOfDay = 22;
residents.update( .1 );
assert.ok( residents.residents.some( r => r.model.group.visible ), 'the entire town does not vanish at night' );
console.log( 'V33 PASS: truthful walkable shrine surfaces, collision separation, priority E dispatch, collision-aware villager routes.' );
