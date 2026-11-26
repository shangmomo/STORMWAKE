import assert from 'node:assert/strict';
import { SEA_TITANS, HUNT_WEAPONS } from '../src/oceanhunt/HuntRules.js';
import { OCEAN_CHART_BOUNDS } from '../src/islandlife/OceanZones.js';
import { createTitanBrain, provokeTitan, stepTitanAI, titanSkill, titanWeaponDamage } from '../src/oceanhunt/TitanAI.js';
import { createCoopHub } from '../server/coopHub.js';
import { TITAN_ASSETS } from '../src/oceanhunt/TitanAssets.js';

for ( const boss of SEA_TITANS ) {
	for ( const key of [ 'territory', 'leash', 'detection', 'disengage', 'speed', 'chaseSpeed', 'attackRange', 'hp', 'strike', 'period' ] )
		assert.ok( boss[ key ] > 0, `${ boss.id }: valid ${ key }` );
	assert.ok( boss.leash > boss.territory && boss.territory > boss.patrol * 2, `${ boss.id }: home / patrol / leash` );
	assert.ok( boss.x - boss.territory > OCEAN_CHART_BOUNDS.minX && boss.x + boss.territory < OCEAN_CHART_BOUNDS.maxX );
	assert.ok( boss.z - boss.territory > OCEAN_CHART_BOUNDS.minZ && boss.z + boss.territory < OCEAN_CHART_BOUNDS.maxZ );
}
for ( let i = 0; i < SEA_TITANS.length; i ++ ) for ( let j = i + 1; j < SEA_TITANS.length; j ++ ) {
	const a = SEA_TITANS[ i ], b = SEA_TITANS[ j ];
	assert.ok( Math.hypot( a.x - b.x, a.z - b.z ) > a.territory + b.territory, `${ a.id } and ${ b.id } hunting territories do not overlap` );
}

const turtle = SEA_TITANS[ 0 ], shark = SEA_TITANS[ 1 ], squid = SEA_TITANS[ 2 ], hydra = SEA_TITANS[ 3 ];
assert.equal( titanSkill( turtle, 0 ).kind, 'vortex' );
assert.equal( titanSkill( shark, 0 ).kind, 'charge' );
assert.deepEqual( [ titanSkill( squid, 0 ).kind, titanSkill( squid, 1 ).kind ], [ 'grapple', 'ink' ] );
assert.deepEqual( [ 0, 1, 2 ].map( n => titanSkill( hydra, n, true ).kind ), [ 'triple_bite', 'shockwave', 'maelstrom' ] );
assert.ok( titanWeaponDamage( turtle, HUNT_WEAPONS.cannon ) < HUNT_WEAPONS.cannon.damage, 'shell mitigates cannon' );
assert.ok( titanWeaponDamage( hydra, { ...HUNT_WEAPONS.storm, id: 'storm' } ) > titanWeaponDamage( hydra, { ...HUNT_WEAPONS.cannon, id: 'cannon' } ) );

for ( const boss of SEA_TITANS ) {
	const brain = createTitanBrain( boss ), events = [];
	const target = { id: 'captain', x: brain.x + 8, z: brain.z + 6, mode: 'boat', noise: 1 };
	for ( let i = 0; i < 42; i ++ ) events.push( ...stepTitanAI( boss, brain, [ target ], 0.8, 1 ) );
	assert.ok( events.some( e => e.type === 'aggro' ), `${ boss.id }: acquires target` );
	assert.ok( events.some( e => e.type === 'telegraph' ), `${ boss.id }: warns before attack` );
	assert.ok( events.some( e => e.type === 'strike' ), `${ boss.id }: strikes in range` );
	assert.ok( Math.hypot( brain.x - boss.x, brain.z - boss.z ) <= boss.leash + 0.1, `${ boss.id }: never leaves leash` );
	target.x = boss.x + boss.leash + 500;
	target.z = boss.z;
	for ( let i = 0; i < 30; i ++ ) stepTitanAI( boss, brain, [ target ], 0.8, 1 );
	assert.ok( [ 'return', 'patrol' ].includes( brain.state ), `${ boss.id }: loses player and returns home` );
}

const h = createTitanBrain( hydra );
stepTitanAI( hydra, h, [ { id: 'intruder', x: hydra.x + 1800, z: hydra.z, mode: 'boat' } ], 1, 1 );
assert.equal( h.state, 'patrol', 'players outside territorial boundary cannot aggro' );
provokeTitan( h, 'captain' );
assert.equal( h.state, 'chase', 'weapon impacts can provoke without passive detection' );

const swirl = createTitanBrain( turtle );
const nearbyCrew = [ { id: 'one', x: swirl.x + 5, z: swirl.z + 2, mode: 'boat' },
	{ id: 'two', x: swirl.x - 8, z: swirl.z - 2, mode: 'deck' } ];
provokeTitan( swirl, 'one' );
const areaEvents = [];
for ( let i = 0; i < 32; i ++ ) areaEvents.push( ...stepTitanAI( turtle, swirl, nearbyCrew, 0.5 ) );
assert.ok( areaEvents.some( e => e.type === 'strike' && e.targetId === 'one' ) &&
	areaEvents.some( e => e.type === 'strike' && e.targetId === 'two' ), 'area attacks damage both vessels in a cooperative room' );

let now = 1_000_000;
const hub = createCoopHub( { now: () => now } );
const starting = hub.publicBosses();
assert.equal( Object.keys( starting ).length, 4 );
assert.ok( starting.leviathan.ai.x !== undefined, 'host exposes authoritative boss AI coordinates' );
now += 1200;
hub.ping();
assert.ok( hub.publicBosses().shark.ai.x !== undefined, 'server ticks AI with no connected players' );
assert.ok( TITAN_ASSETS.leviathan.url.endsWith( 'abyssal-hydra.glb' ) );
assert.ok( TITAN_ASSETS.leviathan.fallbackUrl.endsWith( 'leviathan.glb' ), 'offline backup remains playable' );
console.log( 'V17: PASS distinct territories, aggro, warning, actual strikes, retreat, full boss skills, damage resistance, host sync and CC0 hydra fallback' );
