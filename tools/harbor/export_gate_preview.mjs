// Optional CPU-only geometry export; run: node tools/harbor/export_gate_preview.mjs <dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Builder } from '../../src/world/village/GeoBuilder.js';
import { Colliders } from '../../src/world/Colliders.js';
import { Rand, lantern } from '../../src/world/Props.js';
import { buildHarborGateway } from '../../src/world/HarborGateway.js';

const target = resolve( process.argv[ 2 ] || 'preview_geometry' );
mkdirSync( target, { recursive: true } );
let seed = 31276481;
const rand = new Rand( () => ( ( seed = ( Math.imul( seed, 1664525 ) + 1013904223 ) >>> 0 ) / 0x100000000 ) );
const B = new Builder(), S = new Builder();
const gate = buildHarborGateway( { B, S, X: 0, DK: 0, az: 0, pierWidth: 2.6,
	terrain: () => - 0.6, colliders: new Colliders(), rand } );
// Add stand-in static lanterns for the preview; gameplay uses the existing
// animated hanging lantern actors with the same hook positions.
for ( const hook of gate.lampHooks ) lantern( B, hook.x, hook.y, hook.z, rand.next(), 1.1 );

function srgb( v ) {
	const x = Math.max( 0, Math.min( 1, v ) );
	return Math.round( 255 * ( x <= 0.0031308 ? x * 12.92 : 1.055 * x ** ( 1 / 2.4 ) - 0.055 ) );
}

function save( name, b ) {
	const head = `ply\nformat binary_little_endian 1.0\nelement vertex ${ b.vcount }\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face ${ b.idx.length / 3 }\nproperty list uchar int vertex_indices\nend_header\n`;
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
	writeFileSync( join( target, name + '.ply' ), Buffer.concat( [ Buffer.from( head ), bytes ] ) );
	console.log( name, b.vcount, 'vertices' );
}
for ( const [ kind, builder ] of [ [ 'gate', B ], [ 'sign', S ] ] )
	for ( const [ key, batch ] of Object.entries( builder.batches ) ) save( `${ kind }_${ key }`, batch );
