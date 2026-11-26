import assert from 'node:assert/strict';
import './headless.mjs';
import { GPU } from '../src/engine/gpu/GPU.js';
import { Scene, Vector3 } from '../src/engine/index.js';
import { TerrainData } from '../src/world/TerrainData.js';
import { Colliders } from '../src/world/Colliders.js';
import { Village } from '../src/world/Village.js';
import { IslandLifeState } from '../src/islandlife/IslandLifeState.js';
import { Collectibles } from '../src/islandlife/Collectibles.js';
import { LifeModels } from '../src/islandlife/LifeModels.js';
import { HomeDecor } from '../src/islandlife/HomeDecor.js';
import { homeSlots, validDecorPlacement, toWorld, insideHome } from '../src/islandlife/HomeDecorLogic.js';
import { InteractionRouter, facingPoint } from '../src/islandlife/InteractionRouter.js';

await GPU.init( { headless: true } );
const terrain = new TerrainData(), colliders = new Colliders(), scene = new Scene();
const village = new Village( { scene, terrain, colliders } );
const storageMap = new Map(), storage = { getItem: k => storageMap.get( k ) || null, setItem: ( k, v ) => storageMap.set( k, v ) };
const state = new IslandLifeState( { storage, day: 1 } );
const app = { scene, colliders, terrainData: terrain, village, player: { position: new Vector3() }, homeLife: { saveState: { home: null } } };
const items = new Collectibles( app, state );
assert.equal( items.points.length, 25 );
for ( const point of items.points ) { assert.equal( items._valid( point.x, point.z ), point.y, 'resource must be on valid ground' ); assert.equal( items.reachable( point.x, point.z ), true, 'resource must be connected to the starting beach' ); }
const original = items.points.map( p => ( { id: p.id, x: p.x, z: p.z } ) );
assert.equal( state.collect( items.points[ 0 ] ), true );
items.refresh(); assert.deepEqual( items.points.map( p => ( { id: p.id, x: p.x, z: p.z } ) ), original );
assert.ok( state.data.collected.includes( items.points[ 0 ].id ), 'collected point remains hidden after reconstruction' );
assert.equal( state.syncDay( 2 ), true ); items.refresh(); assert.equal( items.points.length, 25 ); assert.equal( new Set( items.points.map( p => p.id ) ).size, 25 );

const models = new LifeModels();
for ( const item of [ 'chair', 'table', 'shelf', 'lamp', 'chime', 'frame', 'board', 'workbench' ] ) assert.ok( models.mesh( item ).geometry.attributes.position.count > 0 );
const decor = new HomeDecor( app, state, models );
for ( const name of [ 'A', 'C', 'S1' ] ) {
	const h = village.homes.find( h => h.name === name ), slots = homeSlots( h );
	const valid = slots.filter( s => validDecorPlacement( h, s, 'lamp', 0, [], colliders ) );
	assert.ok( valid.length >= 8, `${ name } needs at least eight safe positions for small items, got ${ valid.length }` );
	app.homeLife.saveState.home = name; app.player.position.set( h.x, h.floorY, h.z ); assert.equal( insideHome( h, app.player.position ), true );
	state.data.furniture.lamp = ( state.data.furniture.lamp || 0 ) + 1;
	assert.equal( decor.place( 'lamp', valid[ 0 ].id, 0 ), true );
	const placed = state.data.placements[ name ][ 0 ], collision = decor.objects[ 0 ].collider;
	assert.ok( colliders.boxes.includes( collision ) );
	const same = slots.find( s => s.id === placed.slotId );
	assert.equal( validDecorPlacement( h, same, 'lamp', 0, state.data.placements[ name ], colliders ), false, 'occupied slot must be blocked' );
	assert.equal( decor.remove( placed.instanceId ), true );
	assert.equal( colliders.boxes.includes( collision ), false, 'collecting furniture removes its collision' );
}

// Both the shed door and bench are nearby; direction chooses the intended E action.
const shed = village.sheds.find( h => h.name === 'shed1' ), inside = toWorld( shed, 0, 0.2 ), bench = toWorld( shed, 0, - shed.depth / 2 + 0.3 );
const player = { position: inside, yaw: shed.yaw, prompt: null };
assert.equal( insideHome( shed, inside ), true );
assert.equal( facingPoint( player, bench ), true ); assert.equal( facingPoint( player, shed.door ), false );
const router = new InteractionRouter(), done = [];
router.add( { id: 'door', distance: 0.6, range: 2.1, priority: facingPoint( player, shed.door ) ? 50 : 20, label: 'door', perform: () => done.push( 'door' ) } );
router.add( { id: 'workbench', distance: 0.8, range: 1.5, priority: facingPoint( player, bench ) ? 60 : 10, label: 'bench', perform: () => done.push( 'bench' ) } );
router.dispatch( { consume: () => true }, player ); assert.deepEqual( done, [ 'bench' ] );
console.log( 'ok island world: 25 ground resources, 3 house layouts, furniture collisions and shed interaction' );
process.exit( 0 );
