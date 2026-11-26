import { Vector3 } from '../../engine/index.js';
import { box, cylinder, rod, gridSurface, fanCap, mat4 } from './GeoKit.js';
import { buildHull } from './HullBuilder.js';

// Stormwake V9: custom-built compact privateer sloop. It keeps the original
// 8.2 m watertight hull and hydrostatic sampling so every existing boat game
// mechanic still works. Nothing from the lobster boat's radar, wheelhouse,
// fiberglass console or deck-trap rig is instantiated.
const V = ( x, y, z ) => new Vector3( x, y, z );
const TIMBER = 0x39271f;
const DECK = 0x87613d;
const TEAL = 0x265c60;
const ROPE = 0xc0a078;
const BRASS = 0xc79b55;
const SAIL = 0xe5d3aa;
const SAIL_DARK = 0xc6b18c;

const WOOD = { rough: 0.82, metal: 0 };
const METAL = { rough: 0.46, metal: 0.55 };
const ROUGH = { rough: 0.85, metal: 0 };

const timber = ( kit, x, y, z, w, h, d, color = DECK, ry = 0 ) =>
	kit.add( 'wood', box( w, h, d ), { ...WOOD, color, matrix: mat4( x, y, z, 0, ry ) } );
const spar = ( kit, a, b, r, color = TIMBER, bucket = 'wood' ) =>
	kit.add( bucket, rod( V( ...a ), V( ...b ), r, 9 ), { ...ROUGH, color } );
const braid = ( kit, a, b ) => spar( kit, a, b, 0.014, ROPE, 'fittings' );

function sail( kit, { x0, x1, y0, y1, z, color = SAIL, fullness = 0.17 } ) {

	const rows = [];
	for ( let i = 0; i <= 8; i ++ ) {

		const f = i / 8, yy = y0 + ( y1 - y0 ) * f;
		const row = [];
		for ( let j = 0; j <= 7; j ++ ) {

			const g = j / 7, xx = x0 + ( x1 - x0 ) * g;
			const billow = fullness * Math.sin( Math.PI * g ) * Math.sin( Math.PI * f );
			row.push( V( xx, yy, z + billow ) );

		}
		rows.push( row );

	}
	kit.add( 'sail', gridSurface( rows ), { ...ROUGH, color } );
	for ( let i = 0; i <= 5; i ++ ) {

		const xx = x0 + ( x1 - x0 ) * i / 5;
		// Stitched vertical seams are narrow, visible at medium distance.
		kit.add( 'fittings', rod( V( xx, y0 + 0.02, z + 0.012 ), V( xx, y1 - 0.02, z + 0.012 ),
			0.008, 5 ), { ...ROUGH, color: SAIL_DARK } );

	}
	braid( kit, [ x0, y0, z ], [ x1, y0, z ] );
	braid( kit, [ x0, y1, z ], [ x1, y1, z ] );

}

function gun( kit, x, z, direction ) {

	const x0 = x, x1 = x + direction * 0.70;
	timber( kit, x0, 0.59, z, 0.44, 0.16, 0.45, TIMBER );
	for ( const zz of [ z - 0.22, z + 0.22 ] ) kit.add( 'wood',
		cylinder( 0.16, 0.16, 0.09, 10 ), { ...WOOD, color: DECK,
			matrix: mat4( x0, 0.59, zz, Math.PI / 2 ) } );
	spar( kit, [ x0, 0.79, z ], [ x1, 0.79, z ], 0.105, 0x21252c, 'fittings' );
	kit.add( 'fittings', cylinder( 0.13, 0.13, 0.06, 10 ), {
		...METAL, color: BRASS, matrix: mat4( x1, 0.79, z, 0, 0, Math.PI / 2 ),
	} );

}

export function buildPirateSloop( kit, L, parts ) {

	buildHull( kit, L, { pirateHatch: true } );
	// The naval-deck beams and boards are a replacement visual skin above the
	// retained watertight rigid-body shape, not an independent second hull.
	for ( let i = 0; i < 31; i ++ ) {

		const z = - 3.50 + i * 0.158;
		const half = Math.max( 0.38, L.sheerX( L.tAtSheerZ( z ) ) - 0.19 );
		const col=i % 9 === 0 ? TEAL : ( i % 4 === 0 ? 0x74513a : DECK );
		if(z>-1.97&&z<-.82){
			// Actual aperture: opening through deck geometry, not a decal.
			const gap=.57,sideW=Math.max(.12,half-gap);
			for(const sign of [-1,1])timber(kit,sign*(gap+sideW/2),L.deckY+.018,z,sideW,.035,.148,col);
		}else timber(kit,0,L.deckY+.018,z,half*2,.035,.148,col);

	}
	// Braced bulwark: thicker real posts + parallel rub rails along the hull.
	for ( const side of [ - 1, 1 ] ) for ( let i = 0; i <= 12; i ++ ) {

		const z = - 3.55 + i * 0.60;
		const t = L.tAtSheerZ( z );
		const x = side * ( L.sheerX( t ) - 0.035 );
		const yy = L.sheerY( t );
		spar( kit, [ x, yy - 0.25, z ], [ x, yy + 0.23, z ], 0.048, TIMBER );
		if ( i > 0 ) {

			const zPrev = - 3.55 + ( i - 1 ) * 0.60;
			const tp = L.tAtSheerZ( zPrev );
			spar( kit, [ side * ( L.sheerX( tp ) - 0.035 ), L.sheerY( tp ) + 0.21, zPrev ],
				[ x, yy + 0.21, z ], 0.055, TEAL );
			braid( kit, [ side * ( L.sheerX( tp ) + 0.03 ), L.sheerY( tp ) + 0.035, zPrev ],
				[ x + side * 0.065, yy + 0.035, z ] );

		}

	}
	// Recessed aft quarterdeck and a low chest; the helm is clear of both.
	for ( let i = 0; i < 7; i ++ ) timber( kit, 0, 0.86, - 3.33 + i * 0.16,
		2.17, 0.065, 0.15, i % 3 ? DECK : 0x6b4c36 );
	// Carved transom gallery and an open aft guardrail replace the glass
	// wheelhouse. Four bronze posts support the captain's tiny raised deck.
	for ( const x of [ - 1.07, - 0.38, 0.38, 1.07 ] ) spar( kit,
		[ x, 0.75, - 3.40 ], [ x, 1.34, - 3.40 ], 0.05, TIMBER );
	spar( kit, [ - 1.14, 1.36, - 3.40 ], [ 1.14, 1.36, - 3.40 ], 0.085, TEAL );
	timber( kit, 0, 0.72, - 3.91, 1.44, 0.22, 0.16, TEAL );
	for ( const xx of [ - 0.64, 0.64 ] ) {
		timber( kit, xx, 0.75, - 3.98, 0.065, 0.36, 0.12, BRASS );
		spar( kit, [ xx, 0.63, - 3.99 ], [ xx, 0.91, - 3.99 ], 0.024, BRASS, 'fittings' );
	}
	timber( kit, 0.56, 0.69, - 2.04, 0.73, 0.49, 0.49, TIMBER );
	for ( const xx of [ 0.25, 0.87 ] ) timber( kit, xx, 0.76, - 2.04,
		0.068, 0.56, 0.53, BRASS );

	// Main mast is supported at the keel by an octagonal partners collar, and
	// stays tensioned to actual gunwale anchor points.
	const mast = [ 0, 0.36, 0.72 ], top = [ 0, 7.13, 0.72 ];
	spar( kit, mast, top, 0.18, TIMBER );
	kit.add( 'wood', cylinder( 0.30, 0.30, 0.13, 10 ), {
		...WOOD, color: DECK, matrix: mat4( 0, 0.55, 0.72 ),
	} );
	for ( const yy of [ 2.74, 5.01, 6.53 ] ) {

		const span = yy > 6 ? 2.05 : 3.18;
		spar( kit, [ - span / 2, yy, 0.78 ], [ span / 2, yy, 0.78 ], 0.076, TIMBER );

	}
	sail( kit, { x0: - 1.48, x1: 1.48, y0: 2.85, y1: 4.91, z: 0.72, color: SAIL } );
	sail( kit, { x0: - 0.96, x1: 0.96, y0: 5.12, y1: 6.43, z: 0.72, color: 0xe3c69a, fullness: 0.11 } );
	for ( const x of [ - 1.05, 1.05 ] ) for ( const z of [ - 2.6, 2.12 ] )
		braid( kit, [ 0, 6.85, 0.72 ], [ x, 1.09, z ] );
	// Long functional-looking bowsprit and forestay. The decorative spar
	// reaches outside the watertight hull but does not change buoyancy mass.
	spar( kit, [ 0, 0.99, 3.11 ], [ 0, 1.63, 5.15 ], 0.095, TIMBER );
	braid( kit, [ 0, 5.10, 0.72 ], [ 0, 1.63, 5.15 ] );
	for ( const sx of [ - 1, 1 ] ) braid( kit,
		[ sx * 0.81, 1.09, 2.40 ], [ 0, 1.65, 5.15 ] );
	kit.add( 'sail', fanCap( [ V( 0, 4.78, 1.04 ), V( 0, 1.84, 4.74 ),
		V( 0.58, 1.96, 1.95 ) ], V( 1, 0, 0 ) ), { ...ROUGH, color: 0xd6c19b } );
	for ( const x of [ - 1.1, 1.1 ] ) braid( kit,
		[ x, 3.03, 0.75 ], [ x * 1.12, 1.14, 2.55 ] );
	// Triangular staysail, curved into a modest wind-filled section.
	kit.add( 'sail', fanCap( [ V( 0, 5.30, 0.87 ), V( 0.08, 2.04, 3.77 ),
		V( 0.45, 2.10, 0.97 ) ], V( 1, 0, 0 ) ), { ...ROUGH, color: SAIL } );
	braid( kit, [ 0, 5.40, 0.88 ], [ 0.05, 2.00, 3.92 ] );
	braid( kit, [ 0.06, 2.02, 3.79 ], [ 0.45, 2.10, 0.96 ] );
	// Aft mizzen supplies the distinctive two-mast pirate profile, but is
	// deliberately smaller so it does not engulf the steering wheel or boarding.
	spar( kit, [ 0, 0.85, - 2.70 ], [ 0, 4.28, - 2.70 ], 0.11, TIMBER );
	spar( kit, [ - 0.90, 3.85, - 2.72 ], [ 0.90, 3.85, - 2.72 ], 0.062 );
	spar( kit, [ - 1.00, 2.30, - 2.72 ], [ 1.00, 2.30, - 2.72 ], 0.068 );
	sail( kit, { x0: - 0.88, x1: 0.88, y0: 2.40, y1: 3.72,
		z: - 2.73, color: 0xb9c0b6, fullness: 0.09 } );
	// Unique red-and-charcoal pennant; no imported game-logo or US ensign.
	kit.add( 'sail', fanCap( [ V( 0, 7.09, 0.72 ), V( 1.1, 6.89, 0.80 ),
		V( 0, 6.59, 0.72 ) ], V( 0, 0, 1 ) ), { ...ROUGH, color: 0x963f3b } );

	for ( const side of [ - 1, 1 ] ) for ( const z of [ - 1.04, 0.09 ] )
		gun( kit, side * 1.16, z, side );
	// Small timber cleats and a carved anchor at the bow. These are visual
	// fixtures; collision remains the actual hull + masts + cannon mounts.
	for ( const side of [ - 1, 1 ] ) for ( const zz of [ - 2.08, 2.24 ] ) {
		timber( kit, side * 1.04, 0.90, zz, 0.22, 0.065, 0.10, TIMBER );
		timber( kit, side * 1.04, 0.95, zz, 0.35, 0.045, 0.065, BRASS );
	}
	spar( kit, [ 0.90, 1.04, 2.80 ], [ 0.90, 0.31, 2.80 ], 0.04, 0x25272b, 'fittings' );
	spar( kit, [ 0.61, 0.38, 2.78 ], [ 1.19, 0.38, 2.78 ], 0.052, 0x25272b, 'fittings' );
	for ( const x of [ 0.58, 1.22 ] ) spar( kit, [ x, 0.38, 2.78 ],
		[ x + ( x < 0.9 ? 0.10 : - 0.10 ), 0.59, 2.82 ], 0.035, 0x25272b, 'fittings' );
	// Helm pivot matches Player's existing E-interaction at x=-0.55, z=0.22.
	timber( kit, - 0.55, 0.88, 0.28, 0.20, 0.83, 0.26, TIMBER );
	kit.add( 'fittings', cylinder( 0.17, 0.17, 0.065, 12 ), {
		...METAL, color: BRASS, matrix: mat4( - 0.55, 1.29, 0.36, Math.PI / 2 ),
	} );
	parts.wheelCenter = V( - 0.55, 1.52, 0.43 );
	parts.wheelAxis = V( 0, 0, 1 );
	parts.throttlePivot = V( - 0.82, 0.96, 0.14 );
	parts.flagPivot = V( 0, 7.07, 0.72 );
	// Small hooded lanterns for night navigation, replacing electronic radar.
	for ( const side of [ - 1, 1 ] ) {

		const x = side * 1.13;
		spar( kit, [ x, 1.11, - 3.10 ], [ x, 1.82, - 3.10 ], 0.031, TIMBER );
		kit.add( 'glow', cylinder( 0.10, 0.10, 0.20, 8 ), {
			...ROUGH, color: side > 0 ? 0x8c2e24 : 0x307b5b,
			matrix: mat4( x, 1.77, - 3.10 ),
		} );

	}
	return { mastBase: mast, mastTop: top };

}
