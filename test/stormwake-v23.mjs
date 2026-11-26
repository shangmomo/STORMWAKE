import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { SkinnedModel } from '../src/engine/render/Skinning.js';
import { GPU } from '../src/engine/gpu/GPU.js';
import { Vector3 } from '../src/engine/index.js';
import { attachTitanSkeleton, updateTitanSkeleton } from '../src/oceanhunt/TitanSkeleton.js';
import { ABYSS_STATS, ABYSS_ZONE, distanceToSegment, phaseAt, pressureAt, shockfrontHit } from '../src/oceanhunt/AbyssRaid.js';
import { HUNT_RECIPES } from '../src/oceanhunt/HuntRules.js';
import { HuntProgress, restoreHuntSave, initialHuntSave } from '../src/oceanhunt/HuntProgress.js';

const glb = relative => {
	const bytes = readFileSync( new URL( '../public/models/' + relative, import.meta.url ) );
	return parseGLB( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ) );
};

const monster = glb( 'titans/rigged/sea-god-skeleton.glb' );
assert.equal( monster.skins.length, 1, 'final boss needs a single real mesh deforming armature' );
assert.equal( monster.skins[ 0 ].joints.length, 172, '172 independent bones, not two mesh stretch controls' );
const boneNames = new Set( monster.nodes.map( n => n.name ) );
for ( const name of [ 'BodyRoot', 'GodSpine65', 'GodHead2', 'GodJaw9',
	'GodFinL13', 'GodFinR13', 'GodWhiskerL22', 'GodWhiskerR22', 'GodFlukeL8', 'GodFlukeR8' ] )
	assert.ok( boneNames.has( name ), `missing actual deforming skeleton joint ${ name }` );
let skinnedVertices = 0, weighted = 0;
for ( const node of monster.nodes.filter( n => n.skin === 0 && n.mesh !== undefined ) ) {
	for ( const primitive of monster.meshes[ node.mesh ] ) {
		const a = primitive.attributes;
		assert.ok( a.JOINTS_0 && a.WEIGHTS_0, 'requires skinned vertices, not static GLB geometry' );
		const count = a.POSITION.array.length / 3;
		skinnedVertices += count;
		for ( let i = 0; i < count; i ++ ) {
			const weight = a.WEIGHTS_0.array.slice( i * 4, i * 4 + 4 );
			if ( weight.reduce( ( sum, w ) => sum + w, 0 ) > 0 ) weighted ++;
		}
	}
}
assert.ok( skinnedVertices > 15000 && weighted > skinnedVertices * .98,
	`boss must be a genuinely weighted dense mesh: ${ weighted }/${ skinnedVertices }` );

const submarine = glb( 'abyss/deepsea-demon-whale.glb' );
assert.ok( submarine.meshes.length > 60, `need mechanically modeled pieces: ${ submarine.meshes.length }` );
const subNames = submarine.nodes.map( n => n.name ).filter( Boolean );
for ( const name of [ 'DemonWhale_Hull_MainContinuousMetalBody', 'DemonWhale_ConningTower',
	'DemonWhale_L_VectorThruster0', 'DemonWhale_R_VectorThruster2',
	'DemonWhale_L_TorpedoTube0', 'DemonWhale_R_TorpedoTube2' ] )
	assert.ok( subNames.includes( name ), `missing separate modeled submarine part ${ name }` );

globalThis.GPUBufferUsage = { STORAGE: 1, COPY_DST: 2, COPY_SRC: 4 };
GPU.device = { createBuffer: () => ( { destroy() {} } ) };
GPU.queue = { writeBuffer() {} };
const skin = new SkinnedModel( monster );
const asset = { skeleton: skin, root: skin.group, bounds: { scale: 250 / 260 } };
assert.equal( attachTitanSkeleton( asset ), true );
const controlled = asset.boneControls.length;
assert.ok( controlled >= 170, `skeletal director only controls ${ controlled } actual joints` );
const pseudo = { id: 'sea_god', chaseSpeed: 33, brain: { x: 0, z: 0, heading: 0, currentSpeed: 18,
	state: 'charge', windup: 0, attack: { kind: 'ocean_ram', windup: 2.6 } } };
for ( let i = 0; i < 160; i ++ ) updateTitanSkeleton( asset, pseudo,
	new Vector3( 1.5, -130, 53 ), i / 60, 1 / 60, 1, 'ocean_ram' );
assert.ok( skin.jointData.every( Number.isFinite ), 'animated skeleton matrices must never become NaN' );
assert.ok( asset.boneControls.filter( c => Math.abs( c.current.yaw ) + Math.abs( c.current.pitch ) > 1e-5 ).length > 100,
	'head, tail, whiskers and fins all require independent animated motion' );

assert.equal( phaseAt( .71 ), 1 ); assert.equal( phaseAt( .70 ), 2 );
assert.equal( phaseAt( .30 ), 3 );
assert.equal( pressureAt( ABYSS_ZONE.safeDepth ), 0 );
assert.ok( pressureAt( 380 ) > 0 );
assert.equal( distanceToSegment( new Vector3( 0, 1, 0 ),
	new Vector3( -2, 0, 0 ), new Vector3( 2, 0, 0 ) ), 1 );
assert.ok( shockfrontHit( 88, 103, 100 ) );
assert.equal( shockfrontHit( 130, 145, 100 ), false, 'a passed shockfront must not damage behind itself' );
assert.ok( ABYSS_STATS.torpedo > 100 && ABYSS_STATS.leviathan > 5000 );

const save = initialHuntSave();
assert.equal( save.stock.abyssHeart, 0 );
assert.equal( save.stock.seaGodPearl, 0 );
save.hunts.leviathan = 1;
const oldSave = restoreHuntSave( save );
assert.equal( oldSave.stock.abyssHeart, 1, 'V22 Hydra victory unlock migrates safely' );
const backing = new Map();
const store = { getItem: key => backing.get( key ), setItem: ( key, value ) => backing.set( key, value ) };
const progress = new HuntProgress( store );
assert.equal( progress.canCraft( 'abyss_sub' ), false, 'cannot skip Hydra in normal progression' );
assert.equal( progress.defeat( 'leviathan', 'test:hydra_once' ), true );
progress.add( { bone: 8, oil: 8, scrap: 15, ink: 1 } );
assert.ok( Object.entries( HUNT_RECIPES.abyss_sub.cost ).every( ( [ k, n ] ) => progress.data.stock[k] >= n ) );
assert.equal( progress.craft( 'abyss_sub' ), true );
assert.equal( progress.owned( 'abyss_sub' ), true );
assert.equal( progress.defeatSeaGod( 'seagod:royal-abyss' ), true );
assert.equal( progress.defeatSeaGod( 'seagod:royal-abyss' ), false, 'no infinite trophy farm via replay' );
assert.equal( progress.data.stock.seaGodPearl, 1 );
assert.equal( new HuntProgress( store ).data.hunts.sea_god, 1 );

console.log( `V23: sea god ${ monster.skins[0].joints.length } bones, ${ skinnedVertices } skin verts, ${ controlled } animated controls` );
console.log( `V23: submarine ${ submarine.meshes.length } modeled mesh groups, ${ subNames.length } named parts` );
console.log( 'V23: stages, 3D collision, pressure, crafting unlock, save migration and unique final reward passed.' );
