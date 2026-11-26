import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SEA_TITANS } from '../src/oceanhunt/HuntRules.js';
import { createTitanBrain, provokeTitan, stepTitanAI } from '../src/oceanhunt/TitanAI.js';
import { titanPose } from '../src/oceanhunt/TitanEffects.js';
import { createCoopHub } from '../server/coopHub.js';

const turtle = SEA_TITANS.find( x => x.id === 'turtle' );
const brain = createTitanBrain( turtle ); brain.y=-2.9;
const player = { id: 'helm', x: brain.x + 10, z: brain.z + 5, mode: 'boat', noise: 1 };
provokeTitan( brain, player.id );
brain.cooldown = 0;
const first = stepTitanAI( turtle, brain, [ player ], 0.1 );
assert.equal( first.find( e => e.type === 'telegraph' )?.kind, 'vortex', 'first frame issues a readable warning' );
assert.ok( brain.state === 'windup' );

// The boat successfully dodges the radius but stays inside the leash. The
// creature STILL performs its attack animation and water impact.
player.x = brain.x + 96;
player.z = brain.z + 3;
const dodged = [];
for ( let i = 0; i < 20; i ++ ) dodged.push( ...stepTitanAI( turtle, brain, [ player ], 0.2 ) );
assert.equal( dodged.filter( e => e.type === 'release' ).length, 1, 'missed attack visibly releases once' );
assert.equal( dodged.filter( e => e.type === 'strike' ).length, 0, 'successfully dodged attack deals no damage' );
assert.equal( dodged.find( e => e.type === 'release' ).sequence, 0 );

// With a boat within range, release fires before strike in the same tick.
const closeBrain = createTitanBrain( turtle ); closeBrain.y=-2.9;
const closeBoat = { id: 'helm', x: closeBrain.x + 8, z: closeBrain.z + 4, mode: 'boat' };
provokeTitan( closeBrain, closeBoat.id ); closeBrain.cooldown = 0;
const allEvents = [];
for ( let i = 0; i < 20; i ++ ) allEvents.push( ...stepTitanAI( turtle, closeBrain, [ closeBoat ], 0.2 ) );
assert.ok( allEvents.findIndex( e => e.type === 'telegraph' ) >= 0 );
assert.ok( allEvents.findIndex( e => e.type === 'release' ) > allEvents.findIndex( e => e.type === 'telegraph' ) );
assert.ok( allEvents.findIndex( e => e.type === 'strike' ) > allEvents.findIndex( e => e.type === 'release' ) );

const posed = {};
for ( const b of SEA_TITANS ) {
	const unit = createTitanBrain( b );
	unit.state = 'windup'; unit.windup = 0.3; unit.attack = { windup: 2 };
	posed[ b.id ] = titanPose( b.id, unit, 2, 0.4, 0.3, 0.4 );
	for ( const v of Object.values( posed[ b.id ] ) ) assert.ok( Number.isFinite( v ), `${ b.id } produces finite poses` );
}
assert.ok( posed.leviathan.y > posed.shark.y + 3, 'abyssal hydra looms much higher than shark during telegraph' );
assert.ok( posed.squid.y > posed.turtle.y + 1, 'kraken rises in a distinct strike pose' );

const aiHub = createCoopHub( { now: () => 1000 } );
assert.equal( aiHub.publicBosses().turtle.ai.attackKind, null );
let now = 10_000;
const network = createCoopHub( { now: () => now } );
const sent = [];
network.broadcast = event => sent.push( event );
const serverBrain = network.bosses.turtle.brain; serverBrain.y=-2.9;
const helm = { id: 'captain-1', joined: true, ready:true, x: serverBrain.x + 7, z: serverBrain.z + 6, mode: 'boat' };
network.players.set( helm.id, helm );
provokeTitan( serverBrain, helm.id ); serverBrain.cooldown = 0;
for ( let i = 0; i < 17; i ++ ) { now += 220; network.ping(); }
assert.ok( sent.some( m => m.type === 'boss-telegraph' && m.boss === 'turtle' ), 'co-op host warns all players' );
assert.ok( sent.some( m => m.type === 'boss-release' && m.boss === 'turtle' ), 'co-op host broadcasts visible attack release' );
assert.ok( sent.some( m => m.type === 'boss-strike' && m.targetId === helm.id ), 'host separately authorizes hull damage' );
const root = new URL( '../', import.meta.url );
const read = p => readFileSync( new URL( p, root ), 'utf8' );
for ( const marker of [ 'this.effects?.telegraph', 'this.effects?.release', 'this.effects?.shipHit', 'titanPose(', 'visual.add( asset.root )' ] )
	assert.ok( read( 'src/oceanhunt/SeaBosses.js' ).includes( marker ), `${ marker } wired into live encounters` );
assert.ok( read( 'server/coopHub.js' ).includes( "type: 'boss-release'" ), 'authoritative host broadcasts attack release' );
assert.ok( read( 'src/oceanhunt/CoopClient.js' ).includes( "msg.type === 'boss-release'" ), 'cooperative client shows attack release' );
assert.ok( read( 'src/oceanhunt/TitanAssets.js' ).includes( 'mat.titanAgitation' ), 'static PBR GLBs receive creature-specific dynamic distortion' );
assert.ok( read( 'src/audio/SoundScape.js' ).includes( 'seaTitanImpact( position' ), 'attacks receive local spatialized audio' );
console.log( 'V18: PASS dodge-visible releases, release-before-damage, distinct 4-creature poses, host/client events, PBR deformation and positional audio' );
