// CPU-only PLY model export of the *real V7 pier build* for Blender inspection.
// Usage: node tools/pirate/export_pier_preview.mjs <output-dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Builder } from '../../src/world/village/GeoBuilder.js';
import { Colliders } from '../../src/world/Colliders.js';
import { Rand } from '../../src/world/Props.js';
import { buildPier } from '../../src/world/Pier.js';

const out = resolve( process.argv[ 2 ] || 'pier_geometry' );
mkdirSync( out, { recursive: true } );
let seed = 46119;
const rand = new Rand( () => ( ( seed = ( Math.imul( seed, 1664525 ) + 1013904223 ) >>> 0 ) / 0x100000000 ) );
const B = new Builder(), S = new Builder(), colliders = new Colliders();
buildPier( { B, signB: S, terrain: { heightAt: () => - 2.9 },
	colliders, rand, lights: [], inst: { add() {} } } );

const srgb = v => {
	const x = Math.max( 0, Math.min( 1, v ) );
	return Math.round( 255 * ( x <= 0.0031308 ? x * 12.92 : 1.055 * x ** ( 1 / 2.4 ) - 0.055 ) );
};

for ( const [ kind, builder ] of [ [ 'pier', B ], [ 'sign', S ] ] ) for ( const [ name, b ] of Object.entries( builder.batches ) ) {

	if ( ! b.vcount ) continue;
	const header = `ply\nformat binary_little_endian 1.0\nelement vertex ${ b.vcount }\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face ${ b.idx.length / 3 }\nproperty list uchar int vertex_indices\nend_header\n`;
	const bytes = Buffer.alloc( b.vcount * 15 + b.idx.length / 3 * 13 );
	let o = 0;
	for ( let i = 0; i < b.vcount; i ++ ) {

		for ( let k = 0; k < 3; k ++ ) { bytes.writeFloatLE( b.pos[ i * 3 + k ], o ); o += 4; }
		for ( let k = 0; k < 3; k ++ ) bytes.writeUInt8( srgb( b.tint[ i * 3 + k ] ), o ++ );

	}
	for ( let i = 0; i < b.idx.length; i += 3 ) {

		bytes.writeUInt8( 3, o ++ );
		for ( let k = 0; k < 3; k ++ ) { bytes.writeInt32LE( b.idx[ i + k ], o ); o += 4; }

	}
	writeFileSync( join( out, `${ kind }_${ name }.ply` ), Buffer.concat( [ Buffer.from( header ), bytes ] ) );
	console.log( kind, name, b.idx.length / 3, 'triangles' );

}
console.log( 'TOTAL PIER TRIANGLES', B.triangles );
