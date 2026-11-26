import { Mesh } from '../engine/index.js';
import { prepare, mergePrepared, box, sphere, cylinder, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial, PAT } from '../game/GameMaterials.js';

const WOOD = 0x96734f, PALE = 0xe8d6bb, SHELL = 0xffd2bd, GLASS = 0x86d9c9, METAL = 0x3e5050;
const b = ( color, x, y, z, w, h, d ) => prepare( box( w, h, d ), { color, rough: 0.9, pattern: PAT.wood, matrix: mat4( x, y, z ) } );
const s = ( color, x, y, z, sx, sy, sz ) => prepare( sphere( 1, 12, 8 ), { color, rough: 0.6, pattern: PAT.plain, matrix: mat4( x, y, z, 0, 0, 0, sx, sy, sz ) } );
const c = ( color, x, y, z, radius, height ) => prepare( cylinder( radius, radius, height, 10 ), { color, rough: 0.7, pattern: PAT.plain, matrix: mat4( x, y, z ) } );

export function makeLifeGeometry( id ) {
	const p = [];
	if ( id === 'chair' ) {
		p.push( b( WOOD, 0, 0.46, 0, 0.58, 0.08, 0.55 ), b( WOOD, 0, 0.75, - 0.24, 0.58, 0.55, 0.07 ) );
		for ( const x of [ - 0.23, 0.23 ] ) for ( const z of [ - 0.21, 0.21 ] ) p.push( b( WOOD, x, 0.22, z, 0.065, 0.44, 0.065 ) );
	} else if ( id === 'table' || id === 'workbench' ) {
		const w = id === 'table' ? 0.8 : 1.05, d = id === 'table' ? 0.6 : 0.45;
		p.push( b( WOOD, 0, 0.72, 0, w, 0.09, d ) );
		for ( const x of [ - w / 2 + 0.08, w / 2 - 0.08 ] ) for ( const z of [ - d / 2 + 0.07, d / 2 - 0.07 ] ) p.push( b( WOOD, x, 0.35, z, 0.08, 0.7, 0.08 ) );
		if ( id === 'workbench' ) p.push( b( METAL, 0.1, 0.79, 0, 0.32, 0.04, 0.06 ), b( WOOD, - 0.19, 0.79, 0, 0.15, 0.04, 0.1 ) );
	} else if ( id === 'shelf' ) {
		for ( const x of [ - 0.36, 0.36 ] ) p.push( b( WOOD, x, 0.7, 0, 0.07, 1.4, 0.32 ) );
		for ( const y of [ 0.12, 0.65, 1.25 ] ) p.push( b( WOOD, 0, y, 0, 0.78, 0.07, 0.32 ) );
	} else if ( id === 'lamp' ) {
		p.push( c( WOOD, 0, 0.05, 0, 0.16, 0.1 ), c( METAL, 0, 0.25, 0, 0.035, 0.36 ), s( GLASS, 0, 0.51, 0, 0.19, 0.18, 0.19 ) );
	} else if ( id === 'chime' ) {
		p.push( c( WOOD, 0, 0.08, 0, 0.14, 0.16 ), b( WOOD, 0, 0.55, 0, 0.04, 0.9, 0.04 ), b( WOOD, 0, 1.0, 0, 0.55, 0.05, 0.05 ) );
		for ( const x of [ - 0.2, 0, 0.2 ] ) p.push( b( PALE, x, 0.79, 0, 0.015, 0.35, 0.015 ), s( SHELL, x, 0.6, 0, 0.08, 0.1, 0.035 ) );
	} else if ( id === 'frame' ) {
		p.push( b( WOOD, 0, 0.3, 0, 0.48, 0.56, 0.06 ), b( GLASS, 0, 0.3, 0.04, 0.36, 0.42, 0.02 ), b( WOOD, 0, 0.04, 0, 0.32, 0.08, 0.22 ) );
	} else if ( id === 'board' ) {
		p.push( b( WOOD, - 0.55, 0.85, 0, 0.12, 1.7, 0.12 ), b( WOOD, 0.55, 0.85, 0, 0.12, 1.7, 0.12 ), b( WOOD, 0, 1.4, 0, 1.25, 0.85, 0.1 ),
			b( PALE, - 0.27, 1.48, 0.065, 0.36, 0.48, 0.015 ), b( PALE, 0.2, 1.35, 0.065, 0.36, 0.42, 0.015 ) );
	} else throw new Error( `Unknown island item: ${ id }` );
	return mergePrepared( p );
}
export class LifeModels {
	constructor() { this.material = createPropMaterial( 'islandLifeProps' ); this.material.underwaterLighting = 'lite'; this.geometry = new Map(); }
	mesh( id ) { if ( ! this.geometry.has( id ) ) this.geometry.set( id, makeLifeGeometry( id ) ); const m = new Mesh( this.geometry.get( id ), this.material ); m.castShadow = false; return m; }
}
