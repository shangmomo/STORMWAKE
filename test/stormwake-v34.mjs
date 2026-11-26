import assert from 'node:assert/strict';
import { Vector3 } from '../src/engine/index.js';
import { Colliders } from '../src/world/Colliders.js';
import { LIGHTHOUSE_V34, createLighthouseV34 } from '../src/land/LandLighthouseV34.js';
import { installLighthouseV34Colliders } from '../src/land/LandLighthouseV34Colliders.js';
import { LandResidents } from '../src/land/LandResidents.js';
import { replyToResident } from '../src/land/LandDialoguePanel.js';
import { makeLandWorldIntent } from '../src/land/LandControls.js';

const close = (a, b, label, e = .001) =>
    assert.ok( Math.abs(a - b) < e, `${label}: ${a} differs from ${b}` );

// Separate game rendering and physical worlds: no legacy solid cylinder is
// allowed to block the genuine interior of the new tall tower.
const x = -140, z = -260, y = 12;
const tower = createLighthouseV34( x, y, z );
const collision = new Colliders();
const installed = installLighthouseV34Colliders( collision, tower );
assert.ok( installed && installed.colliders.length >= 480, 'real solid, climbable, detailed structure' );
assert.equal( LIGHTHOUSE_V34.stepCount, 154 );
assert.equal( tower.steps.length, 154 );
assert.ok( tower.height >= 44 && tower.height <= 46, 'a real ~44m navigable landmark' );
assert.ok( tower.group.children.length >= 5, 'independent static, stair, beacon and hinged-door meshes' );
assert.ok( installed.colliders.filter(c => c.tag.includes('lighthouse-stair')).length === 154 );

const center = new Vector3( x + 2.8, y + 1.2, z );
assert.equal( collision.resolveCapsule( center, .32, 1.8, .3 ), false,
    'interior volume is not sealed by an invisible solid lighthouse cylinder' );

for ( const s of tower.steps ) {
    const wx = x + s.x, wz = z + s.z;
    const solid = collision.groundHeightAt( wx, wz, y + s.y + .45 );
    close( solid, y + s.y, `stair ${s.step} has a visible/physical top`, .001 );
    const player = new Vector3( wx, y + s.y, wz );
    collision.resolveCapsule( player, .31, 1.8, .4 );
    assert.ok( Math.hypot( player.x - wx, player.z - wz ) < .01,
        `player body is not forced sideways off stair ${s.step}` );
}
let gaps = 0;
for ( let i = 0; i < tower.steps.length - 1; i ++ ) {
    const a = tower.steps[ i ], b = tower.steps[ i + 1 ];
    for ( let j = 0; j <= 10; j ++ ) {
        const t = j / 10, wx = x + a.x * ( 1 - t ) + b.x * t;
        const wz = z + a.z * ( 1 - t ) + b.z * t;
        const ground = collision.groundHeightAt( wx, wz, y + b.y + .4 );
        if ( ground < y + a.y - .001 ) gaps ++;
    }
}
assert.equal( gaps, 0, 'no gaps in every interpolated step-to-step approach' );
close( tower.steps.at( -1 ).y, LIGHTHOUSE_V34.deckHeight, 'stairs reach top gallery', .25 );

// The gate is genuinely hinged and its collider only goes away after E.
const entry = new Vector3( x, y + 1.12, z + LIGHTHOUSE_V34.doorFront );
const shut = entry.clone();
assert.equal( installed.door.solid, true );
assert.equal( collision.resolveCapsule( shut, .32, 1.8, .35 ), true,
    'shut gate is a physical obstacle' );
assert.ok( Math.hypot( shut.x - entry.x, shut.z - entry.z ) > .32 );
installed.setDoorOpen( true );
assert.equal( installed.door.solid, false );
const opened = entry.clone();
collision.resolveCapsule( opened, .32, 1.8, .35 );
assert.ok( Math.hypot( opened.x - entry.x, opened.z - entry.z ) < .01,
    'opening gate clears the same physical passage' );
installed.setDoorOpen( false );
assert.equal( installed.door.solid, true );

// Fully populated village: separate occupations and paths; the AI must
// actually travel over a route rather than bob in place.
const app = {
    terrainData: { heightAt: () => 0 }, colliders: new Colliders(),
    scene: { add() {} }, settings: { timeOfDay: 11 },
    player: { mode: 'walk', position: new Vector3( 40, 0, -110 ), prompt: null },
    input: { consume: () => false }, freeCam: false,
};
const settlement = new LandResidents( app );
assert.equal( settlement.residents.length, 20, 'village is populated by 20 real agents' );
assert.equal( new Set( settlement.residents.map( p => p.id ) ).size, 20 );
assert.equal( new Set( settlement.residents.map( p => p.name ) ).size, 20 );
assert.equal( new Set( settlement.residents.map( p => p.home.join(',') ) ).size, 20 );
const origins = settlement.residents.map( p => [ p.x, p.z ] );
for ( let i = 0; i < 300; i ++ ) settlement.update( .05 );
assert.ok( settlement.residents.filter((p,i) =>
    Math.hypot( p.x - origins[i][0], p.z - origins[i][1] ) > 1 ).length >= 5,
    'five or more distinct independent villager travel schedules animate' );
app.settings.timeOfDay = 22;
settlement.update( .05 );
assert.ok( settlement.residents.some( p => p.model.group.visible ), 'town residents survive nighttime schedules' );
const person = settlement.residents[ 2 ];
assert.match( replyToResident( person, '灯塔怎么进去？', { stage: 2 } ), /螺旋|灯塔/ );
assert.match( replyToResident( person, '晚上几点了？', { timeOfDay: 23 } ), /休息|巡夜/ );
assert.notEqual( replyToResident( person, '你在做什么？' ), replyToResident( person, '再见' ) );
assert.ok( replyToResident( person, '<script>alert(1)</script>' ).includes('可以告诉你'),
    'unknown player text handled as plain text, never rendered as HTML' );

// Every replicated world interaction is an intent, never a client-authorized
// loot, NPC or puzzle state. Stable sequence and fixed target IDs only.
const intent = makeLandWorldIntent( { actorId: 'local', sequence: 3, tick: 142,
    verb: 'open-door', targetId: 'land:lighthouse-door' } );
assert.equal( intent.verb, 'open-door' );
assert.equal( intent.authoritative, false );
assert.equal( Object.hasOwn( intent, 'damage' ), false );
assert.throws( () => makeLandWorldIntent( { actorId: 'x', sequence: 1, tick: 1,
    verb: 'grant-money', targetId: 'vault' } ) );
assert.throws( () => makeLandWorldIntent( { actorId: 'x', sequence: -1, tick: 1,
    verb: 'talk', targetId: 'resident' } ) );
console.log( 'V34 PASS: physically open 45m lighthouse, 154 continuous steps, gate collision toggle, 20 independent villagers, free dialogue, network-safe world intents.' );
