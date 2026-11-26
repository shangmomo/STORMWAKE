import { Vector3 } from '../engine/index.js';
import { groundSurface } from './LandGrounding.js';

// Local CPU navigation while the village's future Recast navmesh is authored.
// Paths are planned infrequently and checked against the *same* obstacle world
// the player uses; no NPC may wander through a wall as a shortcut.
export class LandVillageNavigator {
	constructor( terrain, colliders, cellSize = 2 ) {
		this.terrain = terrain;
		this.colliders = colliders;
		this.cellSize = cellSize;
		this.passCache = new Map();
	}
	groundAt( x, z, currentY = NaN ) {
		return groundSurface( this.terrain, this.colliders, x, z, currentY );
	}
	passable( x, z ) {
		// Centimetre-scale cache keys avoid reusing a clearance result across
		// opposite sides of the same narrow wall or door frame.
		const key = `${Math.round( x * 100 )}:${Math.round( z * 100 )}`;
		if ( this.passCache.has( key ) ) return this.passCache.get( key );
		const y = this.groundAt( x, z );
		if ( !Number.isFinite( y ) ) return false;
		const probe = new Vector3( x, y, z );
		this.colliders?.resolveCapsule?.( probe, .32, 1.72, .28 );
		const safe = Math.hypot( probe.x - x, probe.z - z ) < .045;
		this.passCache.set( key, safe );
		return safe;
	}
	clearSegment( a, b ) {
		const len = Math.hypot( b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
		const n = Math.max( 1, Math.ceil( len / .28 ) );
		let lastY = this.groundAt( a[ 0 ], a[ 1 ] );
		for ( let i = 1; i <= n; i ++ ) {
			const t = i / n, x = a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, z = a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t;
			const y = this.groundAt( x, z );
			if ( !this.passable( x, z ) || Math.abs( y - lastY ) > .36 ) return false;
			lastY = y;
		}
		return true;
	}
	findPath( from, to, { margin = 24, maxVisited = 4200 } = {} ) {
		this.passCache.clear(); // furniture and other collision geometry can change after asset load
		const start = [ from[ 0 ], from[ 1 ] ], goal = [ to[ 0 ], to[ 1 ] ];
		if ( Math.hypot( start[ 0 ] - goal[ 0 ], start[ 1 ] - goal[ 1 ] ) < .3 ) return this.clearSegment(start,goal)?[goal]:[];
		if ( this.clearSegment( start, goal ) ) return [ goal ];
		const cell = this.cellSize;
		const minX = Math.floor( ( Math.min( start[ 0 ], goal[ 0 ] ) - margin ) / cell ) * cell;
		const minZ = Math.floor( ( Math.min( start[ 1 ], goal[ 1 ] ) - margin ) / cell ) * cell;
		const width = Math.ceil( ( Math.max( start[ 0 ], goal[ 0 ] ) + margin - minX ) / cell ) + 1;
		const height = Math.ceil( ( Math.max( start[ 1 ], goal[ 1 ] ) + margin - minZ ) / cell ) + 1;
		const ix = p => Math.min( width - 1, Math.max( 0, Math.round( ( p[ 0 ] - minX ) / cell ) ) );
		const iz = p => Math.min( height - 1, Math.max( 0, Math.round( ( p[ 1 ] - minZ ) / cell ) ) );
		const toPoint = ( x, z ) => [ minX + x * cell, minZ + z * cell ];
		const startId = iz( start ) * width + ix( start );
		const goalId = iz( goal ) * width + ix( goal );
		const estimate = id => {
			const [ x, z ] = toPoint( id % width, Math.floor( id / width ) );
			return Math.hypot( x - goal[ 0 ], z - goal[ 1 ] );
		};
		const open = [ { id: startId, g: 0, f: estimate( startId ) } ];
		const known = new Map( [ [ startId, 0 ] ] ), came = new Map();
		let visited = 0, found = false;
		while ( open.length && visited ++ < maxVisited ) {
			// The bounded village graph is small; a deterministic linear priority
			// queue is simpler to audit and is only evaluated on destination changes.
			let bestIndex = 0;
			for ( let j = 1; j < open.length; j ++ ) if ( open[ j ].f < open[ bestIndex ].f ) bestIndex = j;
			const current = open.splice( bestIndex, 1 )[ 0 ];
			if ( current.g !== known.get( current.id ) ) continue;
			if ( current.id === goalId ) { found = true; break; }
			const x = current.id % width, z = Math.floor( current.id / width );
			const p = toPoint( x, z );
			for ( const [ dx, dz ] of [ [ 1, 0 ], [ -1, 0 ], [ 0, 1 ], [ 0, -1 ], [ 1, 1 ], [ 1, -1 ], [ -1, 1 ], [ -1, -1 ] ] ) {
				const nx = x + dx, nz = z + dz;
				if ( nx < 0 || nz < 0 || nx >= width || nz >= height ) continue;
				const next = toPoint( nx, nz );
				if ( !this.passable( next[ 0 ], next[ 1 ] ) || !this.clearSegment( p, next ) ) continue;
				const id = nz * width + nx, g = current.g + cell * Math.hypot( dx, dz );
				if ( g >= ( known.get( id ) ?? Infinity ) ) continue;
				known.set( id, g ); came.set( id, current.id);
				open.push( { id, g, f: g + estimate( id ) } );
			}
		}
		if ( !found ) return [];
		const path = [];
		for ( let id = goalId; id !== startId; id = came.get( id ) ) {
			if ( id === undefined ) return [];
			path.push( toPoint( id % width, Math.floor( id / width ) ) );
		}
		path.reverse();
		if ( this.clearSegment( path.at( -1 ) || start, goal ) ) path.push( goal );
		const simplified = [];
		for ( let i = 0; i < path.length; ) {
			let j = path.length - 1;
			for ( ; j > i; j -- ) if ( this.clearSegment( simplified.at( -1 ) || start, path[ j ] ) ) break;
			simplified.push( path[ j ] ); i = j + 1;
		}
		// A snapped grid start must not create an unchecked shortcut through a wall.
		return simplified.every((p,i)=>this.clearSegment(i?simplified[i-1]:start,p))?simplified:[];
	}
}
