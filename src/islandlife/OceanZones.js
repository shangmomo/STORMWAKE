import { WORLD } from '../world/WorldLayout.js';

// The survey centers are shared by the physical survey action, the minimap,
// and the large sea chart. A chart target must never point somewhere that
// cannot actually be surveyed.
export const OCEAN_ZONES = Object.freeze( [
	{ id: 'reef', number: 1, zh: '珊瑚迷宫', en: 'Coral labyrinth', x: WORLD.reef.center.x, z: WORLD.reef.center.z, radius: 64 },
	{ id: 'deep', number: 2, zh: '外海深水航道', en: 'Outer deep channel', x: 46, z: 187, radius: 62 },
	{ id: 'west', number: 3, zh: '西部失落礁群', en: 'Western reef', x: - 183, z: 96, radius: 60 },
	{ id: 'lagoon', number: 4, zh: '南部蓝湾', en: 'Southern blue bay', x: 35, z: 89, radius: 57 },
	// V44 marked real offshore locations: the weather field, vortex and fleet use
	// these exact centres; the chart no longer clusters all destinations at port.
	{ id:'outer_storm',number:5,zh:'外海风暴走廊',en:'Outer storm belt',x:-800,z:2250,radius:440 },
	{ id:'ghost_fleet',number:6,zh:'幽焰舰队战区',en:'Spectral Expanse',x:-600,z:2450,radius:420 },
	{ id:'maelstrom',number:7,zh:'水龙卷海域',en:'Maelstrom Reach',x:-500,z:3570,radius:420 },
] );

// The ocean LOD follows the camera indefinitely; chart coverage is a meaningful
// multi-kilometre expedition region rather than a small rectangle around port.
export const OCEAN_CHART_BOUNDS = Object.freeze( { minX: - 4200, maxX: 2500, minZ: - 1100, maxZ: 5800 } );

export function zoneAt( x, z ) {
	// Overlapping offshore encounter circles are resolved by nearest normalized
	// center instead of array order; the ghost captain's marker must not become
	// an outer-storm survey merely because the storm entry appears first.
	let winner = null, best = Infinity;
	for ( const zone of OCEAN_ZONES ) {
		const d = Math.hypot( x - zone.x, z - zone.z ) / zone.radius;
		if ( d < 1 && d < best ) { winner = zone; best = d; }
	}
	return winner;
}

export function chartPoint( x, z, bounds = OCEAN_CHART_BOUNDS ) {
	return { x: ( x - bounds.minX ) / ( bounds.maxX - bounds.minX ),
		y: ( z - bounds.minZ ) / ( bounds.maxZ - bounds.minZ ) };
}
