import { RECIPES } from './IslandLifeState.js';

export function toLocal( home, x, z ) {
	const dx = x - home.x, dz = z - home.z, c = Math.cos( home.yaw ), s = Math.sin( home.yaw );
	return { x: dx * c - dz * s, z: dx * s + dz * c };
}
export function toWorld( home, x, z ) {
	const c = Math.cos( home.yaw ), s = Math.sin( home.yaw );
	return { x: home.x + x * c + z * s, y: home.floorY, z: home.z - x * s + z * c };
}
export function insideHome( home, position ) {
	if ( ! home || ! position || Math.abs( position.y - home.floorY ) > 1.2 ) return false;
	const p = toLocal( home, position.x, position.z );
	return Math.abs( p.x ) < home.width / 2 - 0.08 && Math.abs( p.z ) < home.depth / 2 - 0.08;
}
export function homeSlots( home ) {
	const slots = [];
	if ( ! home || ! Number.isFinite( home.width ) || ! Number.isFinite( home.depth ) ) return slots;
	const step = 0.4;
	for ( let i = 0; - home.width / 2 + 0.45 + i * step <= home.width / 2 - 0.45; i ++ ) {
		for ( let j = 0; - home.depth / 2 + 0.45 + j * step <= home.depth / 2 - 0.45; j ++ ) {
			const x = - home.width / 2 + 0.45 + i * step, z = - home.depth / 2 + 0.45 + j * step;
			// Keep a continuous center aisle between the door and back of the room.
			if ( Math.abs( x - ( home.doorX || 0 ) ) < 0.8 && z > - home.depth / 2 + 1.15 ) continue;
			slots.push( { id: `s:${ i }:${ j }`, localX: x, localZ: z, ...toWorld( home, x, z ) } );
		}
	}
	return slots;
}
function overlaps( a, b, margin = 0.04 ) {
	const axes = [ [ Math.cos( a.yaw ), - Math.sin( a.yaw ) ], [ Math.sin( a.yaw ), Math.cos( a.yaw ) ], [ Math.cos( b.yaw ), - Math.sin( b.yaw ) ], [ Math.sin( b.yaw ), Math.cos( b.yaw ) ] ];
	const axisX = r => [ Math.cos( r.yaw ), - Math.sin( r.yaw ) ];
	const axisZ = r => [ Math.sin( r.yaw ), Math.cos( r.yaw ) ];
	for ( const axis of axes ) {
		const dot = ( u, v ) => u[ 0 ] * v[ 0 ] + u[ 1 ] * v[ 1 ];
		const distance = Math.abs( ( b.x - a.x ) * axis[ 0 ] + ( b.z - a.z ) * axis[ 1 ] );
		const radius = r => r.hx * Math.abs( dot( axisX( r ), axis ) ) + r.hz * Math.abs( dot( axisZ( r ), axis ) );
		if ( distance >= radius( a ) + radius( b ) + margin ) return false;
	}
	return true;
}
export function validDecorPlacement( home, slot, itemId, rotation, existing, colliders, ignoreId = null ) {
	const recipe = RECIPES[ itemId ];
	if ( ! home || ! slot || ! recipe || ! Number.isInteger( rotation ) || rotation < 0 || rotation > 3 ) return false;
	const [ hx, hz ] = recipe.size, swap = rotation % 2;
	if ( Math.abs( slot.localX ) + ( swap ? hz : hx ) > home.width / 2 - 0.12 || Math.abs( slot.localZ ) + ( swap ? hx : hz ) > home.depth / 2 - 0.12 ) return false;
	// Check the whole footprint, not only its centre, against the doorway aisle.
	if ( Math.abs( slot.localX - ( home.doorX || 0 ) ) < 0.68 + ( swap ? hz : hx ) && slot.localZ > - home.depth / 2 + 1.15 - ( swap ? hx : hz ) ) return false;
	const rect = { x: slot.x, z: slot.z, hx, hz, yaw: home.yaw + rotation * Math.PI / 2 };
	for ( const box of colliders.boxes ) {
		if ( ! box.solid || box.tag === 'lifeFurniture' || box.top <= home.floorY + 0.05 || box.bottom >= home.floorY + 1.2 ) continue;
		if ( Math.hypot( box.center.x - slot.x, box.center.z - slot.z ) > box.radius + Math.hypot( hx, hz ) + 0.1 ) continue;
		if ( overlaps( rect, { x: box.center.x, z: box.center.z, hx: box.half.x, hz: box.half.z, yaw: box.rotY } ) ) return false;
	}
	const slots = homeSlots( home );
	for ( const p of existing || [] ) {
		if ( p.instanceId === ignoreId || ! RECIPES[ p.itemId ] ) continue;
		const other = slots.find( s => s.id === p.slotId ); if ( ! other ) continue;
		const [ ohx, ohz ] = RECIPES[ p.itemId ].size;
		if ( overlaps( rect, { x: other.x, z: other.z, hx: ohx, hz: ohz, yaw: home.yaw + p.rotation * Math.PI / 2 }, 0.1 ) ) return false;
	}
	return true;
}
