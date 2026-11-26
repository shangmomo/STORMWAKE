import { ShapeUtils } from '../../engine/math/ShapeUtils.js';
import { HARD, lin } from '../Props.js';
import { Part, fixWinding } from './GeoBuilder.js';
import { HARBOR_GLYPH_CONTOURS } from './HarborGlyphContours.js';

// Unlike the original low-resolution pixel strip lettering, these are genuine
// extruded Noto Serif CJK Bold outlines. A +Z viewer looks toward -Z and sees
// world +X on the RIGHT; the -Z face is reversed to remain readable as well.
// The glyph sequence in the generated data is always 潮 → 汐 → 港.

const gold = lin( 0xffdba2 );
const engravedGold = HARD( 0.19, 0.02, 0.3, 0.32 );

function area( poly ) {

	let sum = 0;
	for ( let i = 0; i < poly.length; i ++ ) {

		const a = poly[ i ], b = poly[ ( i + 1 ) % poly.length ];
		sum += a.x * b.y - b.x * a.y;

	}
	return sum / 2;

}

function contains( poly, point ) {

	let inside = false;
	for ( let i = 0, j = poly.length - 1; i < poly.length; j = i ++ ) {

		const a = poly[ i ], b = poly[ j ];
		if ( ( a.y > point.y ) !== ( b.y > point.y ) &&
			point.x < ( b.x - a.x ) * ( point.y - a.y ) / ( b.y - a.y ) + a.x ) inside = ! inside;

	}
	return inside;

}

function groupContours( raw ) {

	const loops = raw.map( coords => {

		const path = [];
		for ( let i = 0; i < coords.length; i += 2 ) path.push( { x: coords[ i ], y: coords[ i + 1 ] } );
		return { path, area: area( path ) };

	} ).filter( c => Math.abs( c.area ) > 3 );
	const outer = loops.filter( c => c.area > 0 ).map( c => ( { contour: c.path, holes: [] } ) );
	for ( const hole of loops.filter( c => c.area < 0 ) ) {

		// The source font uses winding order to mark inner counters in 港/潮.
		const owner = outer.filter( c => contains( c.contour, hole.path[ 0 ] ) )
			.sort( ( a, b ) => Math.abs( area( a.contour ) ) - Math.abs( area( b.contour ) ) )[ 0 ];
		if ( owner ) owner.holes.push( hole.path );
		// Unpaired clockwise loops are rare but must remain visible instead of disappearing.
		else outer.push( { contour: hole.path.slice().reverse(), holes: [] } );

	}
	return outer;

}

const glyphs = HARBOR_GLYPH_CONTOURS.map( groupContours );

function extrudedOutline( shape, face, x, y, z, charIndex ) {

	const sx = 0.52 / 1000, sy = 0.59 / 1000;
	const toXY = point => ( {
		x: x + face * ( ( charIndex - 1 ) * 0.56 + ( point.x - 500 ) * sx + 0.09 ),
		y: y + ( point.y - 370 ) * sy,
	} );
	const contour = shape.contour.map( toXY ), holes = shape.holes.map( h => h.map( toXY ) );
	const flat = contour.concat( ...holes );
	const frontZ = z + face * 0.124, backZ = z + face * 0.09;
	const p = [], n = [], uv = [], idx = [];
	const addVertex = ( vx, vy, vz, nx, ny, nz ) => {

		const i = p.length / 3;
		p.push( vx, vy, vz ); n.push( nx, ny, nz ); uv.push( vx - x, vy - y );
		return i;

	};
	for ( const q of flat ) addVertex( q.x, q.y, frontZ, 0, 0, face );
	const triangles = ShapeUtils.triangulateShape( contour, holes );
	for ( const tri of triangles ) idx.push( tri[ 0 ], tri[ 1 ], tri[ 2 ] );
	// Build physical extrusion walls. Back faces are hidden by the enamel plaque.
	// All original contours have CCW outer paths and CW holes in font-space.
	for ( const loop of [ contour, ...holes ] ) for ( let i = 0; i < loop.length; i ++ ) {

		const a = loop[ i ], b = loop[ ( i + 1 ) % loop.length ];
		const ex = b.x - a.x, ey = b.y - a.y, len = Math.hypot( ex, ey );
		if ( len < 1e-6 ) continue;
		const outward = - face;
		const nx = outward * ey / len, ny = - outward * ex / len;
		const j = addVertex( a.x, a.y, frontZ, nx, ny, 0 );
		addVertex( b.x, b.y, frontZ, nx, ny, 0 );
		addVertex( b.x, b.y, backZ, nx, ny, 0 );
		addVertex( a.x, a.y, backZ, nx, ny, 0 );
		idx.push( j, j + 1, j + 2, j, j + 2, j + 3 );

	}
	return fixWinding( new Part( p, n, uv, idx ) );

}

export function addEmbossedHarborText( S, x, y, z ) {

	let total = 0;
	for ( const face of [ - 1, 1 ] ) for ( let i = 0; i < glyphs.length; i ++ ) for ( const shape of glyphs[ i ] ) {

		const part = extrudedOutline( shape, face, x, y, z, i );
		S.part( 'hard', part, 0, 0, 0, { tint: gold, data: engravedGold } );
		total += part.idx.length / 3;

	}
	return total;

}
