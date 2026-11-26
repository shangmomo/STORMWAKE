import assert from 'node:assert/strict';
import { Group } from '../src/engine/index.js';
import { BoatModel } from '../src/world/BoatModel.js';
import { BoatController } from '../src/player/BoatController.js';
import { GameState } from '../src/game/GameState.js';
import { IslandLifeState } from '../src/islandlife/IslandLifeState.js';
import { MarineExpedition } from '../src/islandlife/MarineExpedition.js';

const storage = new Map();
const deviceStore = { getItem: key => storage.get( key ) ?? null, setItem: ( key, value ) => storage.set( key, value ) };
const wallet = new GameState( deviceStore );
const state = new IslandLifeState( { storage: deviceStore, wallet } );
const model = new BoatModel();
const query = { allocate() { return 0; }, cpuValid: false, setPoint() {} };
const terrain = { heightAt() { return - 9; } };
const boat = new BoatController( { model, query, terrain, colliders: null } );
boat.position.set( - 78, 0, 58 ); boat.speed = 4;
let notes = [];
const input = { pressed: new Set(), enabled: true, hit( key ) { return this.pressed.has( key ); } };
const app = {
	boat: model, boatCtl: boat, input, scene: new Group(), terrainData: terrain,
	player: { mode: 'boat' }, settings: { timeOfDay: 12 }, freeCam: false,
	shipyard: { opened: false }, islandLife: { state, ui: { isOpen: false } },
	game: { state: wallet, toast( s ) { notes.push( s ); }, habitatAtPoint() {
		return { reef: 1, shallows: 0, pier: 0, bay: 0, deep: 0 }; } },
};
globalThis.document = { createElement() { return { hidden: true, textContent: '', className: '' }; }, body: { append() {} } };
const marine = new MarineExpedition( app );
assert.equal( marine.netMesh.parent, model.group, 'real geometry is attached behind the ship' );
assert.ok( marine.netMesh.geometry.attributes.position.count > 500, 'modeled trawl web, not a text-only quest' );
const trawl = state.data.quests.find( q => q.event === 'trawl' );
assert.ok( trawl ); assert.equal( state.accept( trawl.id ), true );
input.pressed.add( 'KeyN' ); marine.update( 1 / 60 ); input.pressed.clear();
assert.equal( marine.netOn, true );
for ( let frame = 0; frame < 1800; frame ++ ) marine.update( 1 / 60 );
assert.ok( state.data.marine.netCatches > 0, 'distance-driven fish catches occur' );
assert.equal( trawl.progress, 2, 'two actual net catches complete the daily quest' );
assert.ok( wallet.log && Object.keys( wallet.log ).length > 0, 'catch enters original fishing collection' );
assert.ok( notes.some( n => n.includes( '收获' ) ), 'player is notified of the catch' );

boat.speed = 0;
input.pressed.add( 'KeyO' ); marine.update( 1 / 60 ); input.pressed.clear();
assert.equal( state.data.marine.pots.length, 1 );
assert.equal( marine.potModels.size, 1 );
const pot = state.data.marine.pots[ 0 ];
pot.readyAt = Date.now() - 100;
input.pressed.add( 'KeyU' ); marine.update( 1 / 60 ); input.pressed.clear();
assert.equal( state.data.marine.pots.length, 0 );
assert.equal( marine.potModels.size, 0, 'recovered pots also remove model geometry' );
assert.ok( Object.keys( wallet.log ).length > 0 );
input.pressed.add( 'KeyY' ); marine.update( 1 / 60 ); input.pressed.clear();
assert.deepEqual( state.data.marine.surveys, [ 'reef' ] );
const reloaded = new IslandLifeState( { storage: deviceStore, wallet } );
assert.equal( reloaded.data.marine.netCatches, state.data.marine.netCatches );
console.log( 'V11 maritime: PASS physical trawl mesh, distance-based fish inventory, pot deploy/haul, reef survey, persistence, daily quest' );
