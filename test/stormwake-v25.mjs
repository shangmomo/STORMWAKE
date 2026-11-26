import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { SkinnedModel } from '../src/engine/render/Skinning.js';
import { GPU } from '../src/engine/gpu/GPU.js';
import { ABYSS_ASSETS } from '../src/oceanhunt/TitanAssets.js';

const load = relative => {
	const bytes = readFileSync( new URL( '../public/models/' + relative, import.meta.url ) );
	return parseGLB( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ) );
};

assert.equal( ABYSS_ASSETS.abyss_sub.externalUrl, '/models/abyss/external/nautilus-sdc.glb' );
assert.equal( ABYSS_ASSETS.sea_god.externalUrl, '/models/titans/external/leviathan-monster.glb' );
assert.equal( ABYSS_ASSETS.abyss_sub.artistAxis, 'x', 'SDC Nautilus is X-forward' );
assert.ok( ABYSS_ASSETS.abyss_sub.artistYaw < -1.5, 'its +X bow must face combat +Z' );

const sub = load( 'abyss/external/nautilus-sdc.glb' );
assert.ok( sub.meshes.length >= 35 && sub.materials.length >= 4 && sub.images.length >= 4 );
const subTriangles = sub.meshes.flatMap( x => x ).reduce( ( sum, p ) => sum + ( p.indices?.length || 0 ) / 3, 0 );
assert.ok( subTriangles > 240000, 'real licensed SDC Nautilus hull must replace placeholder art' );
assert.match( sub.json.asset.extras?.author || '', /SDC PERFORMANCE/i );
assert.match( sub.json.asset.extras?.license || '', /CC-BY-4\.0/i );

const boss = load( 'titans/external/leviathan-monster.glb' );
assert.match( boss.json.asset.extras?.author || '', /Lebin Benny/i );
assert.match( boss.json.asset.extras?.license || '', /CC-BY-4\.0/i );
assert.equal( boss.skins.length, 1, 'Leviathan artist body must have a real deforming armature' );
assert.equal( boss.skins[ 0 ].joints.length, 66, '66 continuous tail/spine bones' );
assert.deepEqual( boss.animations.map( clip => clip.name ).sort(), [ 'Attack', 'Charge', 'Swim' ] );
assert.ok( boss.meshes.length === 2, 'the author stage ground and expensive floating orbs are excluded' );
assert.ok( boss.images.length >= 1, 'Leviathan must retain its textured artist body' );
let weighted = 0, vertices = 0;
for ( const node of boss.nodes.filter( node => node.skin === 0 && node.mesh !== undefined ) ) {
	for ( const p of boss.meshes[ node.mesh ] ) {
		assert.ok( p.attributes.JOINTS_0 && p.attributes.WEIGHTS_0, 'must not be a rigid shader-stretched image' );
		const a = p.attributes.WEIGHTS_0.array;
		vertices += a.length / 4;
		for ( let i = 0; i < a.length; i += 4 ) if ( a[ i ] + a[ i + 1 ] + a[ i + 2 ] + a[ i + 3 ] > .99 ) weighted ++;
	}
}
assert.ok( vertices >= 12000 && weighted >= vertices * .99, 'virtually all vertices need valid bone weights' );

globalThis.GPUBufferUsage = { STORAGE: 1, COPY_DST: 2, COPY_SRC: 4 };
GPU.device = { createBuffer: () => ( { destroy() {} } ) };
GPU.queue = { writeBuffer() {} };
const model = new SkinnedModel( boss );
model.play( 'Swim', { fade: .2 } );
model.update( 0 );
const neutral = Float32Array.from( model.jointData );
for ( let i = 0; i < 45; i ++ ) model.update( 1 / 60 );
assert.ok( model.jointData.every( Number.isFinite ) );
assert.ok( model.jointData.some( ( x, i ) => Math.abs( x - neutral[ i ] ) > 1e-6 ), 'tail joints must truly animate' );
model.play( 'Charge', { fade: .3 } );
for ( let i = 0; i < 45; i ++ ) model.update( 1 / 60 );
assert.equal( model.current, 'Charge' );
model.play( 'Attack', { fade: .3 } );
for ( let i = 0; i < 45; i ++ ) model.update( 1 / 60 );
assert.equal( model.current, 'Attack' );
assert.ok( model.jointData.every( Number.isFinite ), 'crossfading cannot create NaN skin matrices' );

console.log( `V25: SDC Nautilus ${ Math.round( subTriangles ) } triangles, artist Leviathan ${ vertices } weighted vertices, 66 animated bones and three crossfading clips passed.` );
