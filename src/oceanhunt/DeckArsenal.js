import { Group, Mesh, Vector3 } from '../engine/index.js';
import { GeoKit, box, cylinder, mat4, rod, sphere, torus } from '../world/boat/GeoKit.js';
import {ARSENAL_OFFSETS,HARPOON_BARREL} from '../ship/ArsenalSites.js';
import {Quaternion} from '../engine/index.js';

// Separate supported deck fittings from the ship's replaceable hull skin.
// This group remains on the original BoatModel.group when the player switches
// vessels. Geometry is merged per bucket to avoid a draw call for every bolt.
const V = ( x, y, z ) => new Vector3( x, y, z );
const COPPER = 0xbe995b, IRON = 0x303b42, WOOD = 0x694b36, ROPE = 0xcabb92;

function build( ship, name, make ) {
	const kit = new GeoKit();
	const part = ( bucket, geometry, color, matrix = null, metal = false ) =>
		kit.add( bucket, geometry, { color, rough: metal ? 0.39 : 0.78, metal: metal ? 0.64 : 0.04, matrix } );
	const beam = ( bucket, a, b, radius, color, metal = false ) =>
		part( bucket, rod( V( ...a ), V( ...b ), radius, 9 ), color, null, metal );
	make( { part, beam } );
	const root = new Group(); root.name = `DeckArsenal_${ name }`;
	for ( const bucket of [ 'wood', 'fittings', 'glow','barrel' ] ) {
		const geometry = kit.merged( bucket );
		if ( ! geometry ) continue;
		const mesh = new Mesh( geometry, ship.materials[ bucket==='barrel'?'fittings':bucket ] );
		mesh.name=bucket;
		mesh.castShadow = true; mesh.receiveShadow = true;
		root.add( mesh );
	}
	ship.group.add( root );
	if(ship.shipScale){const s=ship.shipScale,o=ARSENAL_OFFSETS[name]||{x:0,y:0,z:0};root.scale.set(1/s.x,1/s.y,1/s.z);root.position.set(o.x/s.x,o.y/s.y,o.z/s.z);}
	return root;
}

export class DeckArsenal {
	constructor( ship, progress, developer = false ) {
		this.ship = ship;
		this.progress = progress;
		this.developer = developer;
		this.parts = {};
		// Bow harpoon is mounted to a load-bearing wooden plate. It points over
		// +Z, never through the captain's helm, hatch or starboard cannons.
		this.parts.harpoon = build( ship, 'swivel-harpoon', ( { part, beam } ) => {
			part( 'wood', box( 0.61, 0.11, 0.64 ), WOOD, mat4( 0.61, 0.62, 2.47 ) );
			for ( const x of [ 0.40, 0.82 ] ) for ( const z of [ 2.23, 2.71 ] )
				part( 'fittings', sphere( 0.046, 6, 4 ), COPPER, mat4( x, 0.69, z ), true );
			beam( 'wood', [ 0.61, 0.69, 2.46 ], [ 0.61, 1.01, 2.46 ], 0.13, WOOD );
			part( 'fittings', torus( 0.19, 0.042, 7, 14 ), COPPER, mat4( 0.61, 1.04, 2.46, Math.PI / 2 ), true );
			beam( 'barrel', [ 0.61, 1.17, 2.20 ], [ 0.61, 1.17, 3.12 ], 0.095, IRON, true );
			beam( 'barrel', [ 0.61, 1.17, 3.04 ], [ 0.61, 1.17, 3.51 ], 0.039, COPPER, true );
			for ( const s of [ - 1, 1 ] )
				beam( 'barrel', [ 0.61, 1.17, 3.50 ], [ 0.61 + s * 0.16, 1.17, 3.27 ], 0.026, COPPER, true );
			part( 'wood', cylinder( 0.20, 0.20, 0.30, 12 ), WOOD, mat4( 0.91, 0.91, 2.33, 0, 0, Math.PI / 2 ) );
			part( 'fittings', cylinder( 0.11, 0.11, 0.33, 12 ), COPPER, mat4( 0.91, 0.91, 2.33, 0, 0, Math.PI / 2 ), true );
			// A visible tension line connects the windlass to the spear's guide.
			beam( 'fittings', [ 0.91, 1.00, 2.33 ], [ 0.63, 1.18, 3.17 ], 0.014, ROPE );
		} );
		this.parts.barbed = build( ship, 'barbed-upgrade', ( { beam } ) => {
			for ( const s of [ - 1, 1 ] ) for ( const z of [ 3.25, 3.41 ] )
				beam( 'fittings', [ 0.61, 1.17, z ], [ 0.61 + s * 0.19, 1.17, z - 0.18 ], 0.032, 0xe6ba79, true );
		} );
		this.parts.musket = build( ship, 'musket-rack', ( { part, beam } ) => {
			// Fore-and-aft weapon rack on the starboard quarter; no overlap with
			// the centreline boarding point at z=-1.75 or mizzen at z=-2.70.
			for ( const z of [ - 2.36, - 1.91 ] ) {
				beam( 'wood', [ 0.92, 0.59, z ], [ 0.92, 1.04, z ], 0.065, WOOD );
				part( 'wood', box( 0.34, 0.055, 0.14 ), WOOD, mat4( 0.92, 1.00, z ) );
			}
			beam( 'wood', [ 0.93, 1.03, - 2.48 ], [ 0.93, 1.03, - 1.75 ], 0.055, 0x7e5537 );
			beam( 'fittings', [ 0.93, 1.05, - 2.35 ], [ 0.93, 1.05, - 1.53 ], 0.029, IRON, true );
			part( 'fittings', torus( 0.059, 0.018, 7, 12 ), COPPER, mat4( 0.93, 1.06, - 1.88 ), true );
			part( 'fittings', box( 0.18, 0.11, 0.05 ), COPPER, mat4( 0.93, 1.0, - 2.40 ), true );
		} );
		this.parts.spyglass = build( ship, 'navigation-optics', ( { part, beam } ) => {
			// Tripod plus telescopic tube: the tube is along the deck, and the
			// base terminates on the quarterdeck rather than floating in midair.
			for ( const x of [ 0.36, 0.74 ] )
				beam( 'wood', [ 0.55, 1.18, - 3.07 ], [ x, 0.88, - 3.32 ], 0.035, WOOD );
			beam( 'wood', [ 0.55, 1.18, - 3.07 ], [ 0.55, 0.88, - 2.84 ], 0.035, WOOD );
			beam( 'fittings', [ 0.55, 1.21, - 3.46 ], [ 0.55, 1.21, - 2.73 ], 0.085, COPPER, true );
			beam( 'fittings', [ 0.55, 1.21, - 2.81 ], [ 0.55, 1.21, - 2.55 ], 0.104, 0x7b4f35, true );
			part( 'fittings', torus( 0.104, 0.025, 8, 14 ), 0xffd691, mat4( 0.55, 1.21, - 2.55, Math.PI / 2 ), true );
			part( 'fittings', cylinder( 0.11, 0.11, 0.04, 12 ), 0x273a44, mat4( 0.55, 1.21, - 3.46, Math.PI / 2 ), true );
		} );
		this.parts.ammunition = build( ship, 'cannon-ammunition', ( { part } ) => {
			part( 'wood', box( 0.53, 0.31, 0.47 ), WOOD, mat4( - 0.80, 0.66, - 2.05 ) );
			for ( const x of [ - 1.00, - 0.6 ] )
				part( 'fittings', box( 0.055, 0.33, 0.50 ), COPPER, mat4( x, 0.68, - 2.05 ), true );
			for ( const x of [ - 0.96, - 0.8, - 0.64 ] )
					part( 'fittings', sphere( 0.087, 8, 6 ), IRON, mat4( x, 0.90, - 2.05 ), true );
		} );
		this.parts.storm = build( ship, 'storm-coil', ( { part, beam } ) => {
			for ( const z of [ 1.94, 2.37 ] )
				beam( 'fittings', [ - 0.75, 0.65, z ], [ - 0.75, 1.23, z ], 0.061, IRON, true );
			part( 'wood', box( 0.46, 0.11, 0.64 ), WOOD, mat4( - 0.75, 0.64, 2.15 ) );
			for ( let i = 0; i < 5; i ++ )
				part( 'fittings', torus( 0.14, 0.037, 7, 12 ), 0xe8c27b, mat4( - 0.75, 1.12, 1.94 + i * 0.13 ), true );
			part( 'glow', sphere( 0.105, 12, 8 ), 0x9ff2f2, mat4( - 0.75, 1.12, 2.44 ) );
		} );
		const barrel=this.parts.harpoon.children.find(c=>c.name==='barrel');if(barrel){this.harpoonPivot=new Group();this.harpoonPivot.position.set(.61,1.17,2.20);barrel.position.set(-.61,-1.17,-2.20);this.parts.harpoon.add(this.harpoonPivot);this.harpoonPivot.add(barrel);const barbs=this.parts.barbed;barbs.position.set(-.61,-1.17,-2.20);barbs.scale.set(1,1,1);this.harpoonPivot.add(barbs);}
		this.refresh();
	}

 aimHarpoon(direction){if(!this.harpoonPivot)return null;const rotation=this.parts.harpoon.getWorldQuaternion(new Quaternion()).invert(),local=direction.clone().applyQuaternion(rotation).normalize();this.harpoonPivot.rotation.set(-Math.asin(Math.max(-1,Math.min(1,local.y))),Math.atan2(local.x,local.z),0,'YXZ');return this.harpoonPivot.localToWorld(new Vector3(0,0,HARPOON_BARREL));}

	refresh() {
		const access = id => this.developer || this.progress.owned( id );
		this.parts.harpoon.visible = access( 'harpoon' );
		this.parts.barbed.visible = access( 'barbed' );
		this.parts.musket.visible = access( 'musket' ) && this.progress.data.selected !== 'musket';
		this.parts.spyglass.visible = access( 'spyglass' ) && this.progress.data.selected !== 'spyglass';
		this.parts.ammunition.visible = !this.ship.shipScale&&access( 'cannon' );
		this.parts.storm.visible = access( 'storm' );
	}

	dispose() {
		for ( const part of Object.values( this.parts ) ) {
			this.ship.group.remove( part );
			part.traverse( n => n.geometry?.dispose?.() );
		}
	}
}
