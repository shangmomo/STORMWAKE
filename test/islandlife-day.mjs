import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { IslandLifeState } from '../src/islandlife/IslandLifeState.js';

const vite = await createServer( { configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' } );
try {
	const { HomeLife } = await vite.ssrLoadModule( '/src/course/HomeLife.js' );
	const state = new IslandLifeState( { day: 1 } ), home = Object.create( HomeLife.prototype );
	const app = { player: { mode: 'walk', busy: false }, freeCam: true, settings: { timeOfDay: 0.01, timeSpeed: 0 }, input: {} };
	Object.assign( home, { app, saveState: { day: 1, nights: 0, home: null, hour: null }, sleeping: null, lastHour: 23.99, uiTime: 10, clockSaveTime: 10, toastTime: 0, _save() {}, _render() {}, _notice() {} } );
	home.update( 0.01 ); assert.equal( home.saveState.day, 1, 'paused time does not advance the date' );
	home.lastHour = 23.99; app.settings.timeSpeed = 1 / 60; home.update( 0.01 );
	assert.equal( home.saveState.day, 2 ); assert.equal( state.syncDay( home.saveState.day ), true );
	for ( let i = 0; i < 4; i ++ ) { home.update( 0.01 ); assert.equal( state.syncDay( home.saveState.day ), false ); }
	home._wake( { name: 'A' } ); assert.equal( home.saveState.day, 3 ); assert.equal( state.syncDay( home.saveState.day ), true );
	home.update( 0.01 ); assert.equal( state.syncDay( home.saveState.day ), false );
	assert.ok( state.data.quests.every( q => q.id.startsWith( '3:' ) ) );
	console.log( 'ok island day: paused, natural midnight and sleep each refresh exactly once' );
} finally { await vite.close(); }
