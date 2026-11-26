import { InstancedMesh, Vector3 } from '../engine/index.js';
import { prepare, sphere, box, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial, PAT } from '../game/GameMaterials.js';
import { generateCollectibles, beachReachability } from './CollectibleLogic.js';
import { MATERIALS } from './IslandLifeState.js';
import { getLocale } from '../course/Localization.js';

export class Collectibles {
	constructor( app, state ) {
		this.app = app; this.state = state; this.points = []; this.meshes = {};
		this.material = createPropMaterial( 'islandCollectibles' ); this.material.underwaterLighting = 'lite';
		const geometries = {
			shell: prepare( sphere( 1, 10, 7 ), { color: 0xffd4bf, rough: 0.8, pattern: PAT.plain, matrix: mat4( 0, 0.07, 0, 0, 0, 0, 0.16, 0.07, 0.12 ) } ),
			driftwood: prepare( box( 0.48, 0.09, 0.12 ), { color: 0x9b795b, rough: 0.94, pattern: PAT.woodX, matrix: mat4( 0, 0.06, 0 ) } ),
			sea_glass: prepare( sphere( 1, 8, 6 ), { color: 0x71d9cb, rough: 0.35, pattern: PAT.plain, matrix: mat4( 0, 0.055, 0, 0, 0, 0, 0.12, 0.05, 0.09 ) } ),
		};
		for ( const [ type, geo ] of Object.entries( geometries ) ) {
			const m = new InstancedMesh( geo, this.material, type === 'sea_glass' ? 6 : type === 'shell' ? 9 : 10 );
			m.frustumCulled = false; m.castShadow = false; this.meshes[ type ] = m; app.scene.add( m );
		}
		this.reachable = beachReachability( ( x, z ) => this._valid( x, z ) );
		this.refresh();
	}
	_valid( x, z ) {
		const t = this.app.terrainData, y = t.heightAt( x, z );
		if ( ! Number.isFinite( y ) || y < 0.45 || y > 3.5 ) return NaN;
		if ( Math.hypot( x - 47, z + 86 ) < 2.5 ) return NaN; // board is present before and after reload
		if ( Math.max( ...[ [ 0.8, 0 ], [ - 0.8, 0 ], [ 0, 0.8 ], [ 0, - 0.8 ] ].map( ( [ dx, dz ] ) => Math.abs( t.heightAt( x + dx, z + dz ) - y ) ) ) > 0.42 ) return NaN;
		if ( this.app.village.footprints.some( f => Math.hypot( f.x - x, f.z - z ) < f.r + 1.0 ) ) return NaN;
		const probe = new Vector3( x, y, z ); this.app.colliders.resolveCapsule( probe, 0.38, 1.6, 0.4 );
		return Math.hypot( probe.x - x, probe.z - z ) < 0.04 ? y : NaN;
	}
	refresh() {
		this.points = generateCollectibles( this.state.data.day, ( x, z ) => this.reachable( x, z ) ? this._valid( x, z ) : NaN );
		const indices = { shell: 0, driftwood: 0, sea_glass: 0 };
		for ( const p of this.points ) p.instance = indices[ p.type ] ++;
		for ( const type of Object.keys( indices ) ) for ( let i = 0; i < this.meshes[ type ].count; i ++ ) this.meshes[ type ].setMatrixAt( i, mat4( 0, - 100, 0, 0, 0, 0, 0 ) );
		for ( const p of this.points ) this._setVisible( p, ! this.state.data.collected.includes( p.id ) );
		for ( const mesh of Object.values( this.meshes ) ) mesh.instanceMatrix.needsUpdate = true;
	}
	_setVisible( p, visible ) {
		this.meshes[ p.type ].setMatrixAt( p.instance, visible ? mat4( p.x, p.y, p.z, 0, p.yaw ) : mat4( 0, - 100, 0, 0, 0, 0, 0 ) );
		this.meshes[ p.type ].instanceMatrix.needsUpdate = true;
	}
	collect( p ) {
		if ( ! this.state.collect( p ) ) return false;
		this._setVisible( p, false );
		this.app.ui?.ui?.toast( getLocale() === 'en' ? `Collected ${ { shell: 'shell', driftwood: 'driftwood', sea_glass: 'sea glass' }[ p.type ] }` : `获得${ MATERIALS[ p.type ] } × 1` );
		return true;
	}
	nearby( player, router ) {
		const en = getLocale() === 'en', names = { shell: 'shell', driftwood: 'driftwood', sea_glass: 'sea glass' };
		for ( const p of this.points ) {
			if ( this.state.data.collected.includes( p.id ) || Math.abs( player.position.y - p.y ) > 1.3 ) continue;
			const distance = Math.hypot( player.position.x - p.x, player.position.z - p.z );
			if ( distance <= 1.7 ) router.add( { id: p.id, distance, range: 1.7, priority: 10, label: en ? `Pick up ${ names[ p.type ] }` : `拾取${ MATERIALS[ p.type ] }`, perform: () => this.collect( p ) } );
		}
	}
}
