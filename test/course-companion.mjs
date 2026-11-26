import assert from 'node:assert/strict';
import { Group, Vector3 } from '../src/engine/index.js';
import { CompanionActor } from '../src/course/CompanionActor.js';
import { newCompanionState, chooseCompanionGoal, restoreCompanionState, addMemory, parseCompanionCommand, MEMORY_LIMIT } from '../src/course/CompanionBrain.js';

const state = newCompanionState();
assert.equal( chooseCompanionGoal( state, { hour: 10 } ), 'explore' );
assert.equal( chooseCompanionGoal( state, { hour: 22, hasHome: true } ), 'home' );
state.command = 'wait';
assert.equal( chooseCompanionGoal( state, { hour: 22, hasHome: true } ), 'wait' );
assert.equal( restoreCompanionState( { command: 'invalid', energy: 999 } ).energy, 100 );
assert.equal( restoreCompanionState( { command: 'invalid' } ).command, 'auto' );
assert.equal( addMemory( state, 'first_home', 1, 'A', true ), true );
assert.equal( addMemory( state, 'first_home', 1, 'A', true ), false );
for ( let i = 0; i < 30; i ++ ) addMemory( state, 'conversation', i + 1 );
assert.equal( state.memories.length, MEMORY_LIMIT );
for ( const [ text, command ] of [ [ '小汐过来跟我走', 'follow' ], [ '你在这里等我一下', 'wait' ], [ '先别跟着我', 'wait' ], [ '请坐下', 'sit' ], [ '站起来吧', 'stand' ], [ '给我跳一下', 'jump' ], [ '挥挥手', 'wave' ], [ '请跳个舞', 'dance' ], [ '你去睡觉', 'sleep' ], [ '回家吧', 'home' ], [ '自己去探索', 'auto' ], [ 'come with me', 'follow' ], [ 'please sit down', 'sit' ] ] ) assert.equal( parseCompanionCommand( text ), command, text );
assert.equal( parseCompanionCommand( '不要跳舞' ), null );
assert.equal( parseCompanionCommand( '请转一圈' ), 'spin' );
assert.equal( parseCompanionCommand( '不要转圈' ), null );
assert.equal( parseCompanionCommand( '停止跟随' ), 'wait' );
assert.equal( parseCompanionCommand( '不要再跟着我' ), 'wait' );
assert.equal( parseCompanionCommand( '小汐，跳' ), 'jump' );
assert.equal( parseCompanionCommand( '能跳一个舞吗' ), 'dance' );
assert.equal( parseCompanionCommand( '这片海真漂亮' ), null );

const store = new Map();
globalThis.localStorage = { getItem: k => store.get( k ) || null, setItem: ( k, v ) => store.set( k, v ) };
const app = {
	player: { position: new Vector3( 0, 1, 0 ), yaw: 0, mode: 'walk' }, scene: new Group(),
	colliders: { resolveCapsule() { return false; }, groundHeightAt() { return - Infinity; } }, terrainData: { heightAt() { return 1; } },
	village: { enterable: [] }, settings: { timeOfDay: 10 }, game: { state: { lastCatch: null } },
	homeLife: { saveState: { home: null, day: 1 } }, expedition: { isOpen: false, companionEvent() {} },
};
const actor = new CompanionActor( app );
assert.ok( app.scene.children.includes( actor.group ) );
let start = actor.group.position.clone();
assert.equal( actor.command( 'follow' ), true );
for ( let i = 0; i < 200; i ++ ) actor.update( 0.05 );
assert.ok( actor.group.position.distanceTo( start ) > 0.2, 'following moves toward the player' );
assert.equal( actor.command( 'wait' ), true );
for ( let i = 0; i < 30; i ++ ) actor.update( 0.05 );
start = actor.group.position.clone();
for ( let i = 0; i < 60; i ++ ) actor.update( 0.05 );
assert.ok( actor.group.position.distanceTo( start ) < 0.001, 'wait keeps the actor in place' );
assert.equal( actor.command( 'home' ), false, 'cannot go home before one is chosen' );
assert.equal( actor.command( 'execute_code' ), false );
assert.equal( actor.command( 'sit' ), true ); actor.update( 0.1 );
assert.equal( actor.goal, 'rest' ); assert.ok( actor.legs[ 0 ].rotation.x < - 1 );
assert.equal( actor.command( 'stand' ), true ); actor.update( 0.1 );
assert.equal( actor.goal, 'wait' ); assert.equal( actor.legs[ 0 ].rotation.x, 0 );
assert.equal( actor.command( 'jump' ), true ); actor.update( 0.1 );
assert.ok( actor.model.position.y > 0.08, 'jump produces a visible upward motion' );
assert.equal( actor.command( 'wave' ), true ); actor.update( 0.1 );
assert.ok( actor.arms[ 1 ].rotation.z > 1.5, 'wave raises the arm' );
assert.equal( actor.command( 'sleep' ), true ); actor.update( 0.1 );
assert.ok( actor.model.rotation.z > 1, 'sleep changes the body pose' );
assert.equal( actor.command( 'dance' ), true ); actor.update( 0.1 );
assert.ok( Math.abs( actor.arms[ 0 ].rotation.z ) > 0.5, 'dance moves the arms' );
assert.equal( actor.command( 'spin' ), true ); actor.update( 0.1 );
assert.ok( Math.abs( actor.model.rotation.y ) > 0.1, 'spin rotates the character' );
app.game.state.lastCatch = { species: 'tuna', kg: 7 };
actor.update( 0.05 );
assert.ok( actor.state.memories.some( m => m.type === 'large_fish' ) );
assert.ok( new CompanionActor( app ).state.memories.some( m => m.type === 'large_fish' ), 'memory survives a reload' );
console.log( 'ok companion: decisions, safe commands, 3D actor, movement and persistent memory' );
