// Incremental, bounded local A*: work is spread over frames to avoid pausing
// the renderer. Ground and collision checks are supplied by the game world.
export class CompanionNavigation {
	constructor( start, goal, sample, { cell = 0.85, margin = 20, maxNodes = 3500 } = {} ) {
		this.start = { x: start.x, y: start.y, z: start.z }; this.goal = { ...goal }; this.sample = sample;
		this.cell = cell; this.maxNodes = maxNodes; this.nodes = new Map(); this.open = [];
		this.bounds = { minX: Math.min( start.x, goal.x ) - margin, maxX: Math.max( start.x, goal.x ) + margin,
			minZ: Math.min( start.z, goal.z ) - margin, maxZ: Math.max( start.z, goal.z ) + margin };
		const node = { ix: 0, iz: 0, x: start.x, y: start.y, z: start.z, g: 0, f: Math.hypot( goal.x - start.x, goal.z - start.z ), parent: null, closed: false };
		this.nodes.set( '0,0', node ); this.open.push( node );
	}
	step( budget = 12 ) {
		for ( let n = 0; n < budget; n ++ ) {
			if ( ! this.open.length || this.nodes.size > this.maxNodes ) return { status: 'failed' };
			let best = 0;
			for ( let i = 1; i < this.open.length; i ++ ) if ( this.open[ i ].f < this.open[ best ].f ) best = i;
			const current = this.open.splice( best, 1 )[ 0 ];
			if ( current.closed ) continue;
			current.closed = true;
			if ( Math.hypot( current.x - this.goal.x, current.z - this.goal.z ) <= Math.max( this.goal.stop || 0, this.cell * 0.9 ) ) {
				const path = [];
				for ( let p = current; p.parent; p = p.parent ) path.push( { x: p.x, z: p.z, stop: 0.28 } );
				return { status: 'found', path: path.reverse() };
			}
			for ( const [ dx, dz ] of [ [ 1, 0 ], [ - 1, 0 ], [ 0, 1 ], [ 0, - 1 ], [ 1, 1 ], [ 1, - 1 ], [ - 1, 1 ], [ - 1, - 1 ] ] ) {
				const ix = current.ix + dx, iz = current.iz + dz, key = `${ ix },${ iz }`;
				const x = this.start.x + ix * this.cell, z = this.start.z + iz * this.cell;
				if ( x < this.bounds.minX || x > this.bounds.maxX || z < this.bounds.minZ || z > this.bounds.maxZ ) continue;
				const old = this.nodes.get( key ); if ( old?.closed ) continue;
				// Sample the whole segment: a valid endpoint can be across a thin
				// railing or wall that the walking capsule cannot pass through.
				const segments = Math.ceil( Math.hypot( dx, dz ) * this.cell / 0.14 );
				let next = current;
				for ( let s = 1; s <= segments && next; s ++ ) next = this.sample( next, current.x + ( x - current.x ) * s / segments, current.z + ( z - current.z ) * s / segments );
				if ( ! next ) continue;
				const g = current.g + this.cell * Math.hypot( dx, dz ) + Math.abs( next.y - current.y ) * 0.4;
				if ( old && g >= old.g ) continue;
				const node = old || { ix, iz, x, z, closed: false };
				node.y = next.y; node.g = g; node.f = g + Math.hypot( this.goal.x - x, this.goal.z - z ); node.parent = current;
				if ( ! old ) { this.nodes.set( key, node ); this.open.push( node ); }
			}
		}
		return { status: 'searching' };
	}
}
