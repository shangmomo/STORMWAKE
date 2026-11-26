import assert from 'node:assert/strict';
import { SEA_TITANS } from '../src/oceanhunt/HuntRules.js';
import { WORLD } from '../src/world/WorldLayout.js';
import { TerrainData } from '../src/world/TerrainData.js';
import { OCEAN_CHART_BOUNDS, chartPoint, OCEAN_ZONES } from '../src/islandlife/OceanZones.js';
import { createCreatureMaterial, CREATURE_MATERIAL_PROFILES } from '../src/oceanhunt/CreatureMaterials.js';
import { Shipyard } from '../src/islandlife/Shipyard.js';
import { FLEET } from '../src/world/boat/FleetVariants.js';

const dock = WORLD.boatDock.position;
const bounds = OCEAN_CHART_BOUNDS;
const terrain = new TerrainData();
assert.ok( bounds.maxZ - bounds.minZ > 5000, 'multi-kilometre navigable offshore chart' );
assert.ok( bounds.maxX - bounds.minX > 4000, 'multi-kilometre chart width' );
for ( const titan of SEA_TITANS ) {
	const distance = Math.hypot( titan.x - dock.x, titan.z - dock.z );
	assert.ok( distance > 1400, `${ titan.id } must be a long voyage from harbor: ${ distance }` );
	assert.ok( titan.patrol >= 45, `${ titan.id }: sizable independent encounter territory` );
	const projected = chartPoint( titan.x, titan.z );
	assert.ok( projected.x > 0.02 && projected.x < 0.98 && projected.y > 0.02 && projected.y < 0.98,
		`${ titan.id }: boss remains visible on full nautical chart` );
	for ( let j = 0; j < 12; j ++ ) {
		const angle = Math.PI * 2 * j / 12;
		const x = titan.x + titan.patrol * Math.sin( angle );
		const z = titan.z + titan.patrol * Math.cos( angle );
		assert.ok( terrain.heightAt( x, z ) < - 70, `${ titan.id }: circular patrol safely offshore` );
	}
	const material = createCreatureMaterial( titan.id );
	assert.ok( material.isSceneMaterial, 'dedicated physically-lit biological material' );
	assert.ok( /s.metalness\s*=\s*0\.0/.test( material.surface ), 'living creature must not have polished metal shading' );
	assert.ok( CREATURE_MATERIAL_PROFILES[ titan.id ].rough >= 0.6, 'skin/shell has restrained glossy reflection' );
}
for ( let a = 0; a < SEA_TITANS.length; a ++ ) for ( let b = a + 1; b < SEA_TITANS.length; b ++ ) {
	const p = SEA_TITANS[ a ], q = SEA_TITANS[ b ];
	assert.ok( Math.hypot( p.x - q.x, p.z - q.z ) > 1500, `${ p.id } and ${ q.id }: separated ocean territories` );
}
assert.equal( OCEAN_ZONES.length, 4, 'original close-to-island survey points remain intact' );

const yard = Object.create( Shipyard.prototype );
let current = '';
yard.app = { player: { mode: 'boat' }, boatCtl: { speed: 0 }, game: { applyGear() {} },
	boat: { setVariant: id => { current = id; return true; } }, ui: { ui: { toast() {} } } };
yard.close = () => {};
for ( const id of Object.keys( FLEET ) ) {
	assert.equal( yard.choose( id ), true, `${ id }: accessible to developer without forge progression` );
	assert.equal( current, id );
}
assert.equal( yard.choose( 'not-a-vessel' ), false, 'arbitrary invalid vessels still rejected' );
console.log( 'V15: PASS far-ocean territory/chart, offshore depth, four independent biological skin materials and unlocked six-vessel developer fleet' );
