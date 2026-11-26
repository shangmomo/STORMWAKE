const COUNT = Object.freeze( { shell: 9, driftwood: 10, sea_glass: 6 } );
function rng( seed ) {
	let x = seed >>> 0;
	return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ( x >>> 0 ) / 4294967296; };
}

// Coarse, deterministic dry-land connectivity from the starting beach. This
// excludes isolated patches behind walls/water before individual points are
// chosen. The predicate must use the static world, not mutable furniture.
export function beachReachability( isValid, { step = 2, minX = - 125, maxX = 145, minZ = - 95, maxZ = - 20, seedX = 53.6, seedZ = - 77 } = {} ) {
	const width = Math.floor( ( maxX - minX ) / step ) + 1, height = Math.floor( ( maxZ - minZ ) / step ) + 1;
	const cache = new Map(), visited = new Set(), queue = [];
	const key = ( x, z ) => z * width + x;
	const heightAt = ( x, z ) => {
		if ( x < 0 || z < 0 || x >= width || z >= height ) return NaN;
		const k = key( x, z ); if ( ! cache.has( k ) ) cache.set( k, isValid( minX + x * step, minZ + z * step ) );
		return cache.get( k );
	};
	const sx = Math.round( ( seedX - minX ) / step ), sz = Math.round( ( seedZ - minZ ) / step );
	let seed = null;
	for ( let radius = 0; radius <= 6 && ! seed; radius ++ ) for ( let dx = - radius; dx <= radius && ! seed; dx ++ ) for ( let dz = - radius; dz <= radius; dz ++ ) {
		if ( Number.isFinite( heightAt( sx + dx, sz + dz ) ) ) { seed = [ sx + dx, sz + dz ]; break; }
	}
	if ( ! seed ) return () => false;
	queue.push( seed ); visited.add( key( ...seed ) );
	for ( let i = 0; i < queue.length; i ++ ) {
		const [ x, z ] = queue[ i ], y = heightAt( x, z );
		for ( const [ dx, dz ] of [ [ 1, 0 ], [ - 1, 0 ], [ 0, 1 ], [ 0, - 1 ] ] ) {
			const nx = x + dx, nz = z + dz, k = key( nx, nz );
			if ( nx < 0 || nz < 0 || nx >= width || nz >= height || visited.has( k ) ) continue;
			const ny = heightAt( nx, nz );
			if ( ! Number.isFinite( ny ) || Math.abs( ny - y ) > 0.55 ) continue;
			const middle = isValid( minX + ( x + nx ) * step / 2, minZ + ( z + nz ) * step / 2 );
			if ( ! Number.isFinite( middle ) || Math.abs( middle - y ) > 0.55 || Math.abs( middle - ny ) > 0.55 ) continue;
			visited.add( k ); queue.push( [ nx, nz ] );
		}
	}
	return ( x, z ) => {
		const gx = Math.round( ( x - minX ) / step ), gz = Math.round( ( z - minZ ) / step );
		if ( gx < 0 || gz < 0 || gx >= width || gz >= height || ! visited.has( key( gx, gz ) ) ) return false;
		const y = isValid( x, z ), middle = isValid( ( x + minX + gx * step ) / 2, ( z + minZ + gz * step ) / 2 );
		return Number.isFinite( y ) && Number.isFinite( middle ) && Math.abs( y - middle ) <= 0.55;
	};
}
// Static terrain/collision predicate ensures a saved day's IDs reconstruct to
// the same places even after refresh; items are not regenerated each frame.
export function generateCollectibles( day, isValid ) {
	day = Math.max( 1, Math.floor( Number( day ) || 1 ) );
	const random = rng( ( 0x5245cafe ^ Math.imul( day, 0x9e3779b1 ) ) >>> 0 || 1 );
	const points = [];
	for ( const [ type, count ] of Object.entries( COUNT ) ) {
		for ( let index = 0; index < count; index ++ ) {
			for ( let tries = 0; tries < 1500; tries ++ ) {
				const x = - 125 + random() * 270, z = - 95 + random() * 75;
				if ( points.some( p => Math.hypot( p.x - x, p.z - z ) < 2.2 ) ) continue;
				const y = isValid( x, z );
				if ( ! Number.isFinite( y ) ) continue;
				points.push( { id: `c:${ day }:${ type }:${ index }`, day, type, x, y, z, yaw: random() * Math.PI * 2 } );
				break;
			}
		}
	}
	return points;
}
