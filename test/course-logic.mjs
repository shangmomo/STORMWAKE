import assert from 'node:assert/strict';
import { EXPEDITION_TASKS, distanceXZ, isObjectiveComplete, nextObjective, locationHint, currentGameSnapshot } from '../src/course/ExpeditionLogic.js';

assert.equal( EXPEDITION_TASKS.length, 8 );
assert.equal( nextObjective( [] ).id, 'pier' );
assert.equal( nextObjective( EXPEDITION_TASKS.map( ( t ) => t.id ) ), null );
assert.equal( distanceXZ( { x: 3, z: 4 }, { x: 0, z: 0 } ), 5 );
assert.equal( distanceXZ( null, EXPEDITION_TASKS[ 0 ] ), Infinity );

const state = { position: { x: 55, z: - 9 }, mode: 'walk', fishLog: {} };
assert.equal( isObjectiveComplete( EXPEDITION_TASKS[ 0 ], state ), true );
assert.equal( isObjectiveComplete( EXPEDITION_TASKS[ 1 ], state ), false );
assert.equal( isObjectiveComplete( EXPEDITION_TASKS[ 0 ], { ...state, mode: 'swim' } ), false );
assert.equal( isObjectiveComplete( EXPEDITION_TASKS[ 2 ], { ...state, mode: 'boat' } ), true );
assert.equal( isObjectiveComplete( EXPEDITION_TASKS[ 3 ], { position: { x: - 78, z: 58 }, mode: 'swim' } ), true );
assert.equal( isObjectiveComplete( EXPEDITION_TASKS[ 3 ], { position: { x: - 78, z: 58 }, mode: 'walk' } ), false );
assert.equal( isObjectiveComplete( EXPEDITION_TASKS[ 4 ], { fishLog: { grunt: { count: 1 } } } ), true );
assert.equal( isObjectiveComplete( EXPEDITION_TASKS[ 4 ], { fishLog: { grunt: { count: 0 } } } ), false );
assert.equal( isObjectiveComplete( EXPEDITION_TASKS[ 5 ], { openedHomes: 1 } ), true );
assert.equal( isObjectiveComplete( EXPEDITION_TASKS[ 5 ], { openedHomes: 0 } ), false );
assert.equal( isObjectiveComplete( EXPEDITION_TASKS[ 6 ], { home: 'A' } ), true );
assert.equal( isObjectiveComplete( EXPEDITION_TASKS[ 7 ], { nights: 1 } ), true );
for ( const task of EXPEDITION_TASKS ) {
	assert.ok( task.titleEn && task.hintEn, `English text missing for ${ task.id }` );
	assert.equal( typeof locationHint( state, task, 'en' ), 'string' );
}
assert.deepEqual( currentGameSnapshot( { homeLife: { saveState: { day: 3, home: 'A', nights: 2, openedHomes: [ 'A' ] } } } ), { position: null, mode: 'unknown', fishLog: {}, timeOfDay: 12, money: 0, day: 3, home: 'A', nights: 2, openedHomes: 1 } );
assert.match( locationHint( state, EXPEDITION_TASKS[ 1 ] ), /米/ );
console.log( 'ok   8-stage expedition objectives and live game-state conditions' );
