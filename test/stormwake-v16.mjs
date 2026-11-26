import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { TITAN_ASSETS } from '../src/oceanhunt/TitanAssets.js';

const directory = resolve( dirname( fileURLToPath( import.meta.url ) ), '..' );
const expected = { shark: 65000, turtle: 85000, squid: 105000, leviathan: 29000 };

assert.deepEqual( Object.keys( TITAN_ASSETS ).sort(), Object.keys( expected ).sort(),
	'all four boss species have real, locally distributed mesh assets' );
for ( const [ id, limit ] of Object.entries( expected ) ) {
	const file = resolve( directory, 'public', ( TITAN_ASSETS[ id ].fallbackUrl || TITAN_ASSETS[ id ].url ).slice( 1 ) );
	const bytes = readFileSync( file );
	const gltf = parseGLB( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ) );
	let triangles = 0;
	let uvMeshes = 0;
	for ( const primitives of gltf.meshes ) for ( const primitive of primitives ) {
		assert.ok( primitive.attributes.POSITION, `${ id }: real vertex geometry` );
		assert.ok( primitive.attributes.NORMAL, `${ id }: normal lighting` );
		if ( primitive.attributes.TEXCOORD_0 ) uvMeshes ++;
		triangles += ( primitive.indices?.length ?? primitive.attributes.POSITION.array.length / 3 ) / 3;
	}
	assert.ok( uvMeshes >= 1, `${ id }: authored UV mapping on its textured surface` );
	assert.ok( triangles > 15000 && triangles <= limit + 15, `${ id }: detailed but reasonable topology (${ triangles })` );
	assert.ok( gltf.images.length >= ( id === 'leviathan' ? 2 : 3 ), `${ id }: embedded visual textures and normal maps` );
	assert.ok( gltf.materials.length >= 1, `${ id }: own PBR surface` );
	assert.ok( statSync( file ).size < 11 * 1024 * 1024, `${ id }: optimized GLB remains under 11 MiB` );
}
console.log( 'V16: PASS downloaded high-detail shark, turtle, kraken, handcrafted sea serpent, 4 optimized textured GLBs and readable geometry' );
