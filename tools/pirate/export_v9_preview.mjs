// Diagnostic vertex-color geometry export of actual house, loft and ship.
// Usage: node tools/pirate/export_v9_preview.mjs <output-dir> <house2|ship|loft>
// Note: PLY previews cannot reproduce the runtime's procedural WGSL materials.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Vector3 } from '../../src/engine/index.js';
import { Builder } from '../../src/world/village/GeoBuilder.js';
import { buildHouse, buildPirateLoft } from '../../src/world/village/Buildings.js';
import { Village } from '../../src/world/Village.js';
import { Colliders } from '../../src/world/Colliders.js';
import { Rand } from '../../src/world/Props.js';
import { BoatModel } from '../../src/world/BoatModel.js';

const out = resolve( process.argv[ 2 ] || 'v9-preview-geometry' );
const mode = process.argv[ 3 ] || 'ship';
mkdirSync( out, { recursive: true } );
const rgb = c => {

	const v = Math.max( 0, Math.min( 1, c ) );
	return Math.round( 255 * ( v <= 0.0031308 ? 12.92 * v : 1.055 * v ** ( 1 / 2.4 ) - 0.055 ) );

};

function write( name, positions, colors, faces ) {

	const vertices = positions.length / 3;
	const header = `ply\nformat binary_little_endian 1.0\nelement vertex ${ vertices }\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face ${ faces.length / 3 }\nproperty list uchar int vertex_indices\nend_header\n`;
	const bytes = Buffer.alloc( vertices * 15 + faces.length / 3 * 13 );
	let j = 0;
	for ( let i = 0; i < vertices; i ++ ) {

		for ( let k = 0; k < 3; k ++ ) { bytes.writeFloatLE( positions[ i * 3 + k ], j ); j += 4; }
		for ( let k = 0; k < 3; k ++ ) bytes.writeUInt8( rgb( colors[ i * 3 + k ] ), j ++ );

	}
	for ( let i = 0; i < faces.length; i += 3 ) {

		bytes.writeUInt8( 3, j ++ );
		for ( let k = 0; k < 3; k ++ ) { bytes.writeInt32LE( faces[ i + k ], j ); j += 4; }

	}
	writeFileSync( join( out, `${ name }.ply` ), Buffer.concat( [ Buffer.from( header ), bytes ] ) );
	console.log( name, faces.length / 3, 'triangles' );

}

if ( mode === 'ship' ) {

	const b = new BoatModel();
	b.group.updateWorldMatrix( true, true );
	const swatches = {
		hull: [ 0.19, 0.12, 0.08 ], gelcoat: [ 0.49, 0.30, 0.15 ],
		wood: null, fittings: null, sail: null, glow: null,
	};
	for ( const [ name, mesh ] of Object.entries( b.meshes ) ) {

		const geo = mesh.geometry, pos = geo.attributes.position;
		const color = geo.attributes.color;
		const arr = new Float32Array( pos.count * 3 );
		const tint = new Float32Array( pos.count * 3 );
		const p = new Vector3();
		for ( let i = 0; i < pos.count; i ++ ) {

			p.fromBufferAttribute( pos, i ).applyMatrix4( mesh.matrixWorld );
			arr.set( p.toArray(), 3 * i );
			const value = swatches[ name ] ?? null;
			if ( value ) tint.set( value, 3 * i );
			else if ( color ) tint.set( [ color.getX( i ), color.getY( i ), color.getZ( i ) ], i * 3 );
			else tint.set( [ 0.45, 0.34, 0.26 ], 3 * i );

		}
		const indices = geo.index ? geo.index.array : Array.from( { length: pos.count }, ( _, i ) => i );
		write( name, arr, tint, indices );

	}
	console.log( 'SHIP TOTAL', b.triangleCount );
	b.dispose();

} else if ( mode === 'house2' ) {

	let seed = 73007;
	const rand = new Rand( () => ( ( seed = ( Math.imul( seed, 1664525 ) + 1013904223 ) >>> 0 ) / 0x100000000 ) );
	const s = { ...Village.prototype._layout( rand ).houses.find( h => h.name === 'C' ),
		x: 0, z: 0, yaw: 0 };
	const B = new Builder();
	buildHouse( { B, colliders: new Colliders(), rand, lights: [], checks: [],
		terrain: { heightAt: () => 1 }, inst: { add() {} } }, s );
	for ( const [ name, batch ] of Object.entries( B.batches ) ) if ( batch.vcount )
		write( name, batch.pos, batch.tint, batch.idx );
	console.log( 'HOUSE TOTAL', B.triangles );

} else if ( mode === 'loft' ) {

	let seed = 73007;
	const rand = new Rand( () => ( ( seed = ( Math.imul( seed, 1664525 ) + 1013904223 ) >>> 0 ) / 0x100000000 ) );
	const s = { ...Village.prototype._layout( rand ).houses.find( h => h.name === 'C' ),
		x: 0, z: 0, yaw: 0 };
	const B = new Builder();
	const loft = buildPirateLoft( { B, rand }, { addBoxL() {} }, s, 1,
		s.storyH || 2.75, { trim: s.trim } );
	for ( const [ name, batch ] of Object.entries( B.batches ) ) if ( batch.vcount )
		write( name, batch.pos, batch.tint, batch.idx );
	console.log( 'LOFT ROUTE', loft );

} else throw new Error( `Unknown preview mode: ${ mode }` );
