import assert from 'node:assert/strict';
import { Group, Vector3 } from '../src/engine/index.js';
import { BoatModel } from '../src/world/BoatModel.js';
import { FLEET } from '../src/world/boat/FleetVariants.js';
import { createTitanModel } from '../src/oceanhunt/CreatureGeometry.js';
import { SEA_TITANS, HUNT_RECIPES, HUNT_WEAPONS, TITAN_BY_ID } from '../src/oceanhunt/HuntRules.js';
import { HuntProgress, initialHuntSave, restoreHuntSave } from '../src/oceanhunt/HuntProgress.js';
import { SeaBosses, segmentHitsTitan } from '../src/oceanhunt/SeaBosses.js';
import { Shipyard } from '../src/islandlife/Shipyard.js';
import { TerrainData } from '../src/world/TerrainData.js';

const storage = { value: '', getItem() { return this.value; }, setItem( _, x ) { this.value = x; } };
const progress = new HuntProgress( storage );
assert.deepEqual( progress.data.crafted, [ 'harpoon', 'spyglass' ], 'starter equipment available immediately' );
assert.equal( progress.canCraft( 'cannon' ), false );
for ( let i = 0; i < 19; i ++ ) progress.catchFish( { kept: true, kg: i % 7 ? 2 : 8 } );
assert.ok( progress.data.stock.bone >= 19 && progress.data.stock.scrap >= 6 );
progress.trawlSalvage(); progress.trawlSalvage(); progress.trawlSalvage();
assert.equal( progress.craft( 'musket' ), true );
assert.equal( progress.craft( 'cannon' ), true );
assert.equal( progress.craft( 'cannon' ), false, 'cannot craft duplicate weapon' );
assert.equal( restoreHuntSave( { v: 13, stock: { bone: -20, oil: 2.5 }, crafted: [ 'alien' ] } ).stock.bone, 0, 'corrupt save sanitized' );
assert.equal( SEA_TITANS.length, 4 );
assert.equal( new Set( SEA_TITANS.map( b => b.region ) ).size, 4, 'each titan patrols a distinct zone' );
const terrain = new TerrainData();
for ( const beast of SEA_TITANS ) {
 const orbit = beast.patrol;
 const depths = Array.from( { length: 32 }, ( _, i ) => {
  const angle = Math.PI * 2 * i / 32;
  return - terrain.heightAt( beast.x + Math.sin( angle ) * orbit, beast.z + Math.cos( angle ) * orbit );
 } );
 assert.ok( Math.min( ...depths ) >= 8, `${ beast.name }: full patrol must stay in navigable water; min ${ Math.min( ...depths ) }m` );
}
assert.equal( HUNT_RECIPES.storm.cost.scale, undefined, 'do not require leviathan loot to fight the leviathan' );
assert.equal( HUNT_RECIPES.storm.cost.carapace, 1 );
assert.equal( Object.keys( FLEET ).length, 6, 'six drivable craft including forged whaler' );

const boat = new BoatModel();
const tris = new Set();
for ( const name of Object.keys( FLEET ) ) {
 assert.ok( boat.setVariant( name ), `${ name } is physically selectable` );
 assert.ok( boat.triangleCount < 30000, 'no excessive geometry' );
 tris.add( boat.triangleCount );
}
assert.equal( tris.size, 6, 'six fully separate 3D vessel designs' );
let totalVertices = 0;
for ( const beast of SEA_TITANS ) {
 const model = createTitanModel( beast.id, boat.materials.fittings );
 let count = 0;
 model.root.traverse( mesh => { if ( mesh.geometry ) count += mesh.geometry.attributes.position.count; } );
 assert.ok( count > 1800, `${ beast.name } has detailed 3D geometry` );
 totalVertices += count;
}
assert.ok( totalVertices > 18000 );
assert.equal( segmentHitsTitan( new Vector3( - 20, 0, 0 ), new Vector3( 20, 0, 0 ), new Vector3(), 3 ), true );
assert.equal( segmentHitsTitan( new Vector3( - 20, 0, 20 ), new Vector3( 20, 0, 20 ), new Vector3(), 3 ), false );

global.document = { body: { append() {} }, createElement: () => ( { hidden: true, className: '', innerHTML: '' } ) };
const messages = []; const income = [];
const app = {
 boat, scene: new Group(), player: { mode: 'boat' },
 boatCtl: { position: new Vector3(), velocity: new Vector3(), angular: new Vector3() },
 game: { toast: s => messages.push( s ), state: { grantMoney: ( n, id ) => income.push( [ n, id ] ) } },
};
const bosses = new SeaBosses( app, progress );
assert.equal( bosses.entities.size, 4 );
assert.ok( bosses.damage( 'shark', 55 ) );
assert.equal( bosses.get( 'shark' ).health, TITAN_BY_ID.shark.hp - 55 );
const shark = bosses.get( 'shark' );
shark.health = 20;
bosses.damage( 'shark', HUNT_WEAPONS.musket.damage );
assert.equal( shark.root.visible, true, 'defeated titan begins a sinking animation, no abrupt popping' );
assert.equal( progress.data.stock.tooth, 2, 'shark trophy appears in inventory' );
assert.equal( progress.data.hunts.shark, 1 );
assert.equal( income.length, 1 );
assert.equal( progress.defeat( 'shark', `solo:shark:${ shark.spawn }` ), false, 'cannot duplicate trophy receipt' );
assert.equal( bosses.damage( 'shark', 80 ), false, 'dead boss ignores attacks' );
bosses.update( 6.1 );
assert.equal( shark.root.visible, false, 'defeated titan sinks below the water after a short death sequence' );
shark.deadUntil = bosses.clock + 0.05; bosses.update( 0.1 );
assert.equal( shark.health, shark.hp, 'offline boss respawns' );
const squid = bosses.get( 'squid' ); app.boatCtl.position.set( squid.x, 0, squid.z );
bosses.strike( squid, 13 );
assert.ok( bosses.inkClock > 0, 'giant squid attacks obscure visibility' );
assert.ok( bosses.integrity < 100, 'boss impacts damage ship integrity' );
progress.add( { bone: 10, scrap: 10 } );
assert.equal( bosses.repair(), true, 'crafted materials repair real ship integrity' );
bosses.applyServerSnapshot( { squid: { hp: 0, spawn: 'match-01' } } );
assert.equal( bosses.get( 'squid' ).deadUntil, Infinity );
bosses.leaveRoom(); assert.ok( Number.isFinite( bosses.get( 'squid' ).deadUntil ) );

const yard = Object.create( Shipyard.prototype );
let selected = '';
yard.app = { player: { mode: 'boat' }, boatCtl: { speed: 0 }, game: { toast: s => messages.push( s ), applyGear() {} },
 boat: { setVariant: id => { selected = id; return true; } }, hunt: { progress }, ui: { ui: { toast() {} } } };
yard.close = () => {};
assert.equal( yard.choose( 'whaler' ), true, 'developer can freely equip the whaler from the start' );
assert.equal( selected, 'whaler' );
progress.add( { bone: 40, oil: 30, scrap: 40 } );
assert.ok( progress.craft( 'whaler' ), 'whaling ship can be built using shark trophy and fish materials' );
assert.equal( yard.choose( 'whaler' ), true );
assert.equal( selected, 'whaler' );
console.log( 'V15 ocean hunt: PASS 4 offshore bosses, six unlocked ships, materials/forge, hull attacks, trophies, collision, respawn' );
