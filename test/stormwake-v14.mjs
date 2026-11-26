import assert from 'node:assert/strict';
import { Group } from '../src/engine/index.js';
import { FLEET } from '../src/world/boat/FleetVariants.js';
import { BoatModel } from '../src/world/BoatModel.js';
import { DeckArsenal } from '../src/oceanhunt/DeckArsenal.js';
import { CoopClient } from '../src/oceanhunt/CoopClient.js';
import { HuntProgress } from '../src/oceanhunt/HuntProgress.js';
import { HuntCombat } from '../src/oceanhunt/HuntCombat.js';

const storage = { value: '', getItem() { return this.value; }, setItem( _, data ) { this.value = data; } };
const progress = new HuntProgress( storage );
const local = new BoatModel();
const arsenal = new DeckArsenal( local, progress );

assert.equal( Object.keys( arsenal.parts ).length, 6, 'six anatomically detailed modeled equipment mounts' );
assert.ok( local.group.children.includes( arsenal.parts.harpoon ), 'the harpoon sits on the real vessel' );
assert.equal( arsenal.parts.harpoon.visible, true, 'starter harpoon mounted' );
assert.equal( arsenal.parts.spyglass.visible, true, 'starter spyglass mounted' );
assert.equal( arsenal.parts.musket.visible, false, 'locked rifles do not appear' );
assert.equal( arsenal.parts.barbed.visible, false, 'advanced barbs stay locked' );
assert.equal( arsenal.parts.ammunition.visible, false, 'cannon ammunition remains locked' );
assert.equal( arsenal.parts.storm.visible, false, 'storm weapon remains locked' );

const meshes = [];
for ( const part of Object.values( arsenal.parts ) ) part.traverse( m => { if ( m.geometry ) meshes.push( m ); } );
assert.ok( meshes.length >= 6, 'each ship-mounted prop has actual mesh geometry' );
assert.ok( meshes.every( m => m.geometry.attributes.position.count >= 8 ), 'not decorative empty nodes' );
assert.ok( meshes.reduce( ( n, m ) => n + m.geometry.attributes.position.count, 0 ) > 1200, 'modeled props have meaningful geometry detail' );

// BoatModel.setVariant must not remove/stack parts of the independent arsenal.
for ( const type of Object.keys( FLEET ) ) {
 assert.equal( local.setVariant( type ), true );
 assert.equal( local.group.children.filter( n => n === arsenal.parts.harpoon ).length, 1, `${ type }: no duplicated mount` );
}
assert.equal( local.setVariant( '__proto__' ), false, 'unsupported inherited property must not be treated as ship ID' );
progress.data.crafted.push( 'musket', 'barbed', 'cannon', 'storm' );
arsenal.refresh();
assert.ok( Object.values( arsenal.parts ).every( p => p.visible ), 'crafting reveals the corresponding 3D equipment' );

// Exercise real remote vessel lifecycle and switching without a browser DOM.
const app = { boat: local, scene: new Group() };
const crew = Object.create( CoopClient.prototype );
crew.app = app; crew.peers = new Map(); crew.selfId = 'local';
const message = ( mode, boat ) => ( { id: 'remote', name: '炮手', x: 19, y: 0, z: 125, yaw: 0.3, mode, boat } );
crew.addPeer( message( 'walk', 'brig' ) );
let remote = crew.peers.get( 'remote' );
assert.equal( remote.vesselModel, null, 'walking clients do not allocate heavy ships' );
assert.equal( remote.captain.visible, true );
crew.addPeer( message( 'boat', 'whaler' ) );
remote = crew.peers.get( 'remote' );
assert.ok( remote.vesselModel instanceof BoatModel, 'remote peer uses full BoatModel, not a box impostor' );
assert.equal( remote.vesselModel.variant, 'whaler' );
assert.ok( remote.vesselModel.triangleCount > 4000, 'fully detailed remote hull, rigging and artillery' );
assert.equal( remote.vessel.visible, true );
assert.equal( remote.root.children.filter( n => n === remote.vessel ).length, 1 );
for ( const variant of [ 'brig', 'cutter', 'corsair', 'whaler' ] ) {
 crew.addPeer( message( 'deck', variant ) );
 assert.equal( remote.vesselModel.variant, variant, `remote ship changes into ${ variant }` );
 assert.equal( remote.root.children.filter( n => n === remote.vessel ).length, 1, 'no double hull after fleet change' );
}
crew.addPeer( message( 'swim', 'whaler' ) );
assert.equal( remote.vessel.visible, false, 'ship hidden when peer swims' );
crew.addPeer( message( 'boat', '__proto__' ) );
assert.equal( remote.vesselModel.variant, 'corsair', 'unsupported remote fleet ID falls back to default' );
crew.removePeer( 'remote' );
assert.equal( crew.peers.size, 0, 'remote model removed and geometry disposed on disconnect' );
assert.equal( app.scene.children.length, 0 );

const combat = Object.create( HuntCombat.prototype );
combat.app = app; combat.geometries = new Map(); combat.projectiles = [];
combat.bosses = { hitProjectile() { throw new Error( 'remote cosmetic rounds must never deal damage' ); } };
assert.equal( combat.remoteFire( 'cannon', [ 19, 1, 125 ], [ 0, 0, 1 ] ), true );
assert.equal( combat.projectiles[ 0 ].cosmetic, true );
combat.updateProjectiles( 0.03 );
assert.equal( combat.remoteFire( 'cannon', [ 19, 1, 125 ], [ 50, 0, 1 ] ), false, 'bad network aim is rejected' );
assert.equal( combat.remoteFire( 'unknown', [ 19, 1, 125 ], [ 0, 0, 1 ] ), false, 'unknown weapons are rejected' );
for ( const shot of combat.projectiles ) app.scene.remove( shot.mesh );

arsenal.dispose(); local.dispose();
console.log( 'V14: PASS modeled ship-mounted weapons, progression, fleet changes, lazy remote full ship models, cosmetic co-op cannon rounds, cleanup' );
