import { Group, Mesh, Vector3 } from '../engine/index.js';
import { prepare, mergePrepared, sphere, torus, rod, mat4 } from '../world/boat/GeoKit.js';
import { landMaterial } from './LandModels.js';

// A capped, preallocated impact pool: no allocations or network replication
// during combat and no permanently accumulating particle scene objects.
const COLORS = {
	light: [ 0x70f9e0, 0xdafaff ],
	heavy: [ 0x65d9ff, 0xeefcff ],
	block: [ 0xffbf84, 0xffe3b4 ],
	hurt: [ 0xf5758d, 0xffd3df ],
};
const MAX_EFFECTS = 12;

function burstGeometry( kind ) {
	const [ glow, core ] = COLORS[ kind ];
	const parts = [
		prepare( torus( kind === 'heavy' ? .62 : .40, .045, 6, 28 ), {
			color: glow, rough: .14, matrix: mat4( 0, 0, 0 ),
		} ),
		prepare( torus( kind === 'heavy' ? .43 : .26, .023, 5, 24 ), {
			color: core, rough: .12, matrix: mat4( 0, 0, 0 ),
		} ),
		prepare( sphere( .13, 8, 6 ), { color: core, rough: .18, matrix: mat4( 0, 0, 0 ) } ),
	];
	const count = kind === 'heavy' ? 14 : 9;
	for ( let i = 0; i < count; i ++ ) {
		const a = ( i + .23 * ( i % 3 ) ) * Math.PI * 2 / count;
		const r = kind === 'heavy' ? .91 : .65;
		const from = new Vector3( Math.cos( a ) * .22, Math.sin( a ) * .22, 0 );
		const to = new Vector3( Math.cos( a ) * r, Math.sin( a ) * r, ( i % 3 - 1 ) * .12 );
		parts.push( prepare( rod( from, to, i % 3 ? .021 : .045, 5 ), {
			color: i % 3 ? glow : core, rough: .23,
		} ) );
	}
	return mergePrepared( parts );
}

export class LandCombatFX {
	constructor( scene ) {
		this.entries = [];
		this.next = 0;
		const geometries = Object.fromEntries( Object.keys( COLORS ).map( kind => [ kind, burstGeometry( kind ) ] ) );
		for ( let i = 0; i < MAX_EFFECTS; i ++ ) {
			const group = new Group();
			group.name = `V32 pooled combat impact ${i}`;
			group.visible = false;
			const meshes = {};
			for ( const [ kind, geometry ] of Object.entries( geometries ) ) {
				const mesh = new Mesh( geometry, landMaterial );
				mesh.frustumCulled = false;
				mesh.visible = false;
				group.add( mesh );
				meshes[ kind ] = mesh;
			}
			scene.add( group );
			this.entries.push( { group, meshes, kind: 'light', age: 0, duration: 0 } );
		}
	}

	spawn( kind, at, cameraQuaternion ) {
		if ( !COLORS[ kind ] ) return;
		const entry = this.entries[ this.next ++ % MAX_EFFECTS ];
		entry.kind = kind;
		entry.age = 0;
		entry.duration = kind === 'heavy' ? .54 : kind === 'block' ? .43 : .32;
		entry.group.visible = true;
		entry.group.position.set( at.x, at.y, at.z );
		entry.group.scale.setScalar( .30 );
		if ( cameraQuaternion ) entry.group.quaternion.copy( cameraQuaternion );
		for ( const [ k, mesh ] of Object.entries( entry.meshes ) ) mesh.visible = k === kind;
	}

	update( dt ) {
		for ( const entry of this.entries ) {
			if ( !entry.group.visible ) continue;
			entry.age += dt;
			const t = Math.min( 1, entry.age / entry.duration );
			if ( t >= 1 ) { entry.group.visible = false; continue; }
			const k = ( .30 + 1.12 * ( 1 - Math.pow( 1 - t, 3 ) ) ) * ( 1 - t * .26 );
			entry.group.scale.setScalar( k );
			entry.group.rotation.z = t * ( entry.kind === 'heavy' ? .75 : -.33 );
			entry.group.position.y += dt * .22;
		}
	}
}
