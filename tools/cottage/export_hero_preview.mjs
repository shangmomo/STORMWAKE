// Usage: node tools/cottage/export_hero_preview.mjs <output-dir> [baseline]
// Diagnostic geometry only. The WebGPU game's procedural PBR shaders are not
// present in these PLY snapshots, which should not be treated as game captures.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Builder } from '../../src/world/village/GeoBuilder.js';
import { Colliders } from '../../src/world/Colliders.js';
import { Rand, lin } from '../../src/world/Props.js';
import { buildHouse } from '../../src/world/village/Buildings.js';

const target = resolve( process.argv[ 2 ] || 'cottage_geometry' );
mkdirSync( target, { recursive: true } );
let seed = 3235;
const rand = new Rand( () => ( ( seed = ( Math.imul( seed, 1664525 ) + 1013904223 ) >>> 0 ) / 0x100000000 ) );
const B = new Builder(), colliders = new Colliders();
const baseline = process.argv[ 3 ] === 'baseline';
const pirate = process.argv[ 3 ] === 'pirate';
buildHouse( {
	B, colliders, rand, terrain: { heightAt: () => 1.0 },
	lights: [], checks: [], inst: { add() {} },
}, {
	name: 'A', x: 0, z: 0, yaw: 0, w: 6.2, d: 5.0,
	heroCottage: ! baseline, foundation: 'stone', roof: 'gable', roofMat: 'metal',
	roofColor: lin( pirate ? 0x163e4d : 0xa64a35 ), wall: lin( pirate ? 0x225b66 : 0x5dbcb0 ), trim: lin( pirate ? 0xe4a650 : 0xf3efe6 ),
	accent: lin( 0x2e4f73 ), siding: 1, porch: { depth: 2.1, rail: pirate ? 'x' : 'balusters' },
	paint: 0.58, stovepipe: true, buoys: - 1, porchPaint: lin( 0x8a9aa0 ),
	...( pirate ? { pitch: 0.69, ovE: 0.83, ovR: 0.66, pirateStyle: {
		variant: 0, roof: lin( 0x163e4d ), sail: lin( 0x722e38 ), edging: lin( 0xe4a650 ),
	} } : {} ),
} );
// The real game builds A's hinged door in Village._buildHomeDoors, outside
// buildHouse. Include a *static closed pose* for this standalone shape preview.
B.box( 'wood', 0, 1.0 + 0.55 + 1.04, 2.52, 0.92, 2.08, 0.06,
	{ grain: 1, tint: lin( 0x2e4f73 ), data: [ rand.next(), 0.7, 3, 0.3 ] } );

function srgb( v ) {

	const x = Math.max( 0, Math.min( 1, v ) );
	return Math.round( 255 * ( x <= 0.0031308 ? x * 12.92 : 1.055 * x ** ( 1 / 2.4 ) - 0.055 ) );

}

for ( const [ name, b ] of Object.entries( B.batches ) ) {

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
	writeFileSync( join( target, name + '.ply' ), Buffer.concat( [ Buffer.from( header ), bytes ] ) );
	console.log( name, b.idx.length / 3, 'triangles' );

}
