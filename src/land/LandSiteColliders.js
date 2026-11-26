import { Vector3 } from '../engine/index.js';

// Each object declares its actual obstacle, walkable top, and entrance steps.
// This does NOT make decorative glow meshes into colliders.
export function installLandSiteColliders( colliders, terrain, { tower, shrine, mirrors, board } ) {
	if ( !colliders ) return [];
	const made = [];
	const addCylinder = ( x, z, r, bottom, top, tag, options = {} ) => {
		const item = colliders.addCylinder?.( x, z, r, bottom, top, { tag, ...options } );
		if ( item ) made.push( item );
	};
	const addBox = ( x, y, z, hx, hy, hz, tag, options = {} ) => {
		const item = colliders.addBox?.( new Vector3( x, y, z ), new Vector3( hx, hy, hz ), 0, { tag, ...options } );
		if ( item ) made.push( item );
	};
	const gy = ( x, z ) => terrain.heightAt( x, z );

	// Historical lighthouse is exterior-only until a navigable interior is authored.
	if ( tower ) {
		const ty = gy( tower.x, tower.z );
		addCylinder( tower.x, tower.z, 4.85, ty - 2, ty + 25.5, 'land:lighthouse-wall' );
		// Kept for legacy V33 world models; V34 installs a separate hollow tower.
		addBox( tower.x - 6.4, ty + 1.16, tower.z + 2.2, 2.12, 1.2, 1.58, 'land:lighthouse-storehouse' );
	}

	const sy = shrine.position.y, sx = shrine.position.x, sz = shrine.position.z;
	addCylinder( sx, sz, 2.26, sy - 0.08, sy + 0.565, 'land:shrine-plinth', { walkable: true } );
	// Stairs are visible on the front (+Z) and climb by less than a single step.
	for ( const [ z, top, depth ] of [ [ 3.62, 0.18, 0.48 ], [ 3.04, 0.36, 0.49 ], [ 2.51, 0.53, 0.47 ] ] )
		addBox( sx, sy + top / 2, sz + z, 0.96, top / 2, depth, 'land:shrine-step', { walkable: true } );
	addBox( sx, sy + 1.65, sz, 0.68, 1.25, 0.30, 'land:shrine-tablet' );
	for ( let i = 0; i < 12; i ++ ) {
		const a = i * Math.PI / 6;
		addCylinder( sx + Math.sin( a ) * 2.18, sz + Math.cos( a ) * 2.18, 0.19,
			sy - .1, sy + ( i % 3 ? 0.49 : 0.61 ), `land:shrine-post-${i}` );
	}
	for ( const [ i, m ] of mirrors.entries() ) {
		const { x, y, z } = m.group.position;
		addCylinder( x, z, .99, y - .03, y + .55, `land:mirror-base-${i}`, { walkable: true } );
		addCylinder( x, z, .37, y + .55, y + 2.12, `land:mirror-spindle-${i}` );
	}
	for ( const offset of [ -1, 1 ] )
		addBox( board.position.x + offset, board.position.y + 1, board.position.z,
			.115, 1, .115, 'land:quest-board-post' );
	addBox(board.position.x,board.position.y+1.65,board.position.z,1.225,.675,.25,'land:quest-board-panel');
	return made;
}
