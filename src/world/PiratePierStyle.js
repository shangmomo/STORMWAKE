import { Vector3 } from '../engine/index.js';
import { HARD, WOOD, lin, buoyString, ropeCoil } from './Props.js';
import { sagPoints } from './village/GeoBuilder.js';

// Stormwake shipyard pier: asymmetric ship ribs, rope suspension, painted
// repair boards and canvas. V8 also builds real, collision-backed wharf
// extensions. The landward deck and movable boat berth remain traversable.

const V = ( x, y, z ) => new Vector3( x, y, z );
const UP = V( 0, 1, 0 );
const TAR = lin( 0x2e3034 );
const HULL = lin( 0x49342b );
const GOLD = lin( 0xcea267 );
const TEAL = lin( 0x245b63 );
const CORAL = lin( 0x954b40 );
const IVORY = lin( 0xe2c6a0 );
const DARK_ROPE = lin( 0xb09465 );
const COLORS = [ TEAL, CORAL, GOLD, lin( 0x526855 ), lin( 0x555977 ) ];

export function buildPiratePierStyle( { B, rand, colliders, X, HX, DK, z0, zH, z1, hx0, hx1, halfW, bentZ, terrain } ) {

	const wood = ( tint = HULL, paint = 0.20 ) => ( { tint, data: WOOD( rand.next(), paint, 0, 0.65 ) } );
	const rope = () => ( { tint: DARK_ROPE, data: [ rand.next(), 0.85, 0, 0 ] } );
	const ropeCurve = ( points, r = 0.024 ) => B.tube( 'rope', points, r, { radial: 4, ...rope() } );
	const addBox = ( cx, cy, cz, hx, hy, hz, opts ) => colliders.addBox(
		V( cx, cy, cz ), V( hx, hy, hz ), 0, opts );

	// A thin painted repair stripe every few steps: old deck planks stay as the
	// walkable surface, so physics remain bit-for-bit unchanged.
	const pitch = 0.215;
	const n = Math.floor( ( zH - z0 ) / pitch );
	for ( let i = 0; i < n; i ++ ) {

		if ( i % 7 !== 3 && i % 19 !== 8 ) continue;
		const zz = z0 + ( i + 0.5 ) * ( zH - z0 ) / n;
		const tint = COLORS[ Math.floor( i / 7 ) % COLORS.length ];
		B.box( 'wood', X, DK - 0.004, zz, halfW * 1.93, 0.023, 0.16, {
			grain: 0, ry: rand.range( - 0.01, 0.01 ), ...wood( tint, 0.79 ),
		} );

	}

	// Dark ship-keel strips below both edges make the entire walkway read as
	// a reclaimed longboat hull, not a flat boardwalk floating on poles.
	for ( const side of [ - 1, 1 ] ) {

		const px = X + side * ( halfW + 0.10 );
		for ( let i = 0; i < bentZ.length - 1; i ++ ) {

			const za = bentZ[ i ], zb = bentZ[ i + 1 ];
			const mid = ( za + zb ) / 2;
			B.beam( 'wood', [ px, DK - 0.09, za - 0.12 ],
				[ px + side * 0.07, DK - 0.03, zb + 0.1 ], 0.18, 0.27, wood( i % 5 === 0 ? TAR : HULL ) );
			B.beam( 'wood', [ px + side * 0.22, DK - 1.02, mid - 0.68 ],
				[ px + side * 0.14, DK - 0.10, mid ], 0.12, 0.17, wood() );
			B.beam( 'wood', [ px + side * 0.22, DK - 1.02, mid + 0.68 ],
				[ px + side * 0.14, DK - 0.10, mid ], 0.12, 0.17, wood() );

		}

	}

	// The original dock was a thin uninterrupted line. Four navigable
	// over-water trading bays use precisely the gaps already built into its
	// railing, giving the pier a broad, asymmetric pirate-harbor footprint.
	const sideBays = [
		{ side: - 1, start: 9, end: 11, accent: TEAL },
		{ side: 1, start: 14, end: 16, accent: CORAL },
		{ side: - 1, start: 20, end: 21, accent: GOLD },
		{ side: 1, start: 26, end: 27, accent: TEAL },
	];
	for ( const [ bayIndex, bay ] of sideBays.entries() ) {

		if ( bay.end >= bentZ.length - 1 ) continue;
		const za = bentZ[ bay.start ], zb = bentZ[ bay.end ];
		const centerZ = ( za + zb ) / 2, spanZ = zb - za;
		const side = bay.side;
		const inner = X + side * ( halfW - 0.02 );
		const outer = X + side * ( halfW + 3.25 );
		const centerX = ( inner + outer ) / 2, breadth = Math.abs( outer - inner );
		const beamY = DK - 0.19;
		B.box( 'wood', centerX, beamY, centerZ, breadth + 0.16, 0.27, spanZ + 0.3, wood( HULL ) );
		for ( let j = 0; j < Math.floor( spanZ / 0.23 ); j ++ ) {

			const zz = za + ( j + 0.5 ) * spanZ / Math.floor( spanZ / 0.23 );
			B.box( 'wood', centerX, DK - 0.026, zz, breadth + 0.14, 0.052, 0.19,
				{ grain: 0, ...wood( j % 8 === 2 ? bay.accent : ( j % 4 === 0 ? TAR : HULL ), j % 8 === 2 ? 0.73 : 0.18 ) } );

		}
		colliders?.addBox( V( centerX, DK - 0.04, centerZ ), V( breadth / 2, 0.04, spanZ / 2 ), 0,
			{ walkable: true, solid: true, tag: 'pierDeck' } );
		const postX = outer - side * 0.15;
		for ( const zSide of [ - 1, 1 ] ) {

			const zz = centerZ + zSide * ( spanZ / 2 - 0.19 );
			B.rod( 'wood', [ postX, - 2.7, zz ], [ postX + side * 0.1, DK + 1.15, zz ],
				0.20, 0.16, { segs: 9, ...wood( TAR ) } );
			B.beam( 'wood', [ postX, DK - 1.36, zz ], [ inner, DK - 0.21, zz ],
				0.15, 0.21, wood( HULL ) );
			B.box( 'wood', ( inner + outer ) / 2, DK + 0.78, zz, breadth - 0.30, 0.14, 0.13,
				wood( bay.accent, 0.72 ) );
			colliders?.addBox( V( ( inner + outer ) / 2, DK + 0.52, zz ),
				V( breadth / 2, 0.5, 0.08 ), 0, { tag: 'pierRail' } );

		}
		B.box( 'wood', postX, DK + 0.82, centerZ, 0.15, 0.16, spanZ - 0.14,
			wood( bay.accent, 0.74 ) );
		colliders?.addBox( V( postX, DK + 0.54, centerZ ),
			V( 0.09, 0.54, spanZ / 2 ), 0, { tag: 'pierRail' } );
		// Fabric fishmonger's canopy, high enough for the player's camera.
		const frontX = outer - side * 0.18;
		for ( const zz of [ za + 0.35, zb - 0.35 ] ) {

			B.rod( 'wood', [ frontX, DK, zz ], [ frontX + side * 0.12, DK + 3.65, zz ],
				0.12, 0.095, { segs: 8, ...wood() } );

		}
		const clothA = [ V( frontX + side * 0.1, DK + 3.65, za + 0.35 ),
			V( frontX + side * 0.1, DK + 3.65, zb - 0.35 ),
			V( inner + side * 0.42, DK + 3.12, zb - 0.1 ),
			V( inner + side * 0.42, DK + 3.12, za + 0.1 ) ];
		B.slab( 'fabric', clothA, 0.045, { up: UP, tint: bay.accent,
			data: [ rand.next(), 0.75, 0.25, 0 ] } );
		B.beam( 'wood', [ frontX, DK + 3.66, za + 0.35 ],
			[ frontX, DK + 3.66, zb - 0.35 ], 0.12, 0.18, wood() );
		// Nets and lobster traps hang on the OUTER railing, no path blocker.
		buoyString( B, [ postX + side * 0.1, DK + 1.0, centerZ - Math.min( 0.95, spanZ * 0.28 ) ],
			[ postX + side * 0.1, DK + 1.0, centerZ + Math.min( 0.95, spanZ * 0.28 ) ],
			bayIndex % 2 ? 3 : 4, rand, 0.16 );

	}

	// Whalebone-style curved guard ribs: chunky timber horns extend OUTSIDE
	// the old rail, leaving the walkable width and arrival gate untouched.
	for ( let i = 2; i < bentZ.length - 2; i += 3 ) {

		const zz = bentZ[ i ];
		for ( const side of [ - 1, 1 ] ) {

			const px = X + side * ( halfW + 0.37 );
			const tip = px + side * 0.25;
			B.beam( 'wood', [ px, DK - 0.67, zz ], [ tip, DK + 1.65, zz + 0.12 ],
				0.23, 0.33, wood( i % 2 ? HULL : TAR ) );
			B.beam( 'wood', [ px + side * 0.11, DK + 0.20, zz - 0.47 ],
				[ tip, DK + 1.27, zz + 0.10 ], 0.10, 0.18, wood( GOLD, 0.48 ) );
			B.cyl( 'wood', tip, DK + 1.61, zz + 0.12, 0.075, 0.17, 0.27,
				{ segs: 8, ...wood( GOLD, 0.55 ) } );
			for ( let k = 0; k < 3; k ++ ) B.torus( 'rope', px, DK + 0.72 + k * 0.042, zz,
				0.23, 0.024, { radial: 4, tubular: 11, ...rope() } );

		}

	}

	// Sagged ropes between recurring horn posts are the dominant mid-distance
	// rail silhouette. No new physical collision geometry is needed.
	for ( const side of [ - 1, 1 ] ) {

		for ( let i = 2; i + 3 < bentZ.length - 2; i += 3 ) {

			const xx = X + side * ( halfW + 0.62 );
			const za = bentZ[ i ] + 0.12, zb = bentZ[ i + 3 ] + 0.12;
			ropeCurve( sagPoints( [ xx, DK + 1.57, za ], [ xx, DK + 1.57, zb ], 0.37, 9 ), 0.036 );
			ropeCurve( sagPoints( [ xx - side * 0.03, DK + 1.02, za ], [ xx - side * 0.03, DK + 1.02, zb ], 0.18, 8 ), 0.024 );
			if ( i % 2 === 0 ) buoyString( B, [ xx, DK + 1.21, za + 1.1 ],
				[ xx, DK + 1.19, za + 2.6 ], 3, rand, 0.16 );

		}

	}

	// Towering ship-rib archways at two distant bays; all crossing beams have
	// >2.8 m headroom. The first arrival arch remains separately owned by V5.
	for ( const index of [ 11, 24 ] ) {

		if ( index >= bentZ.length - 2 ) continue;
		const zz = bentZ[ index ];
		const outer = halfW + 0.46;
		for ( const side of [ - 1, 1 ] ) {

			const px = X + side * outer;
			B.beam( 'wood', [ px, DK + 1.26, zz ], [ px - side * 0.19, DK + 3.41, zz + 0.04 ],
				0.22, 0.28, wood( TAR ) );
			B.beam( 'wood', [ px - side * 0.19, DK + 3.39, zz + 0.03 ],
				[ X, DK + 3.95, zz + 0.12 ], 0.19, 0.29, wood( HULL ) );
			B.rod( 'wood', [ px, DK + 3.45, zz + 0.02 ],
				[ px + side * 0.08, DK + 5.04, zz + 0.02 ], 0.08, 0.05, { segs: 7, ...wood() } );
			B.slab( 'fabric', [ V( px + side * 0.10, DK + 4.92, zz + 0.02 ),
				V( px - side * 0.94, DK + 4.68, zz + 0.04 ), V( px + side * 0.10, DK + 4.29, zz + 0.02 ) ],
				0.016, { tint: COLORS[ ( index + side + 7 ) % COLORS.length ], data: [ rand.next(), 0.58, 0.55, 0 ] } );
			B.torus( 'rope', px, DK + 3.34, zz, 0.21, 0.023,
				{ radial: 4, tubular: 10, ...rope() } );

		}
		B.box( 'wood', X, DK + 3.93, zz + 0.10, 0.54, 0.31, 0.32, wood( TAR ) );
		B.cyl( 'hard', X, DK + 4.01, zz + 0.10, 0.12, 0.12, 0.03,
			{ segs: 10, rx: Math.PI / 2, tint: GOLD, data: HARD( rand.next(), 0.2, 0.88, 0.58 ) } );

	}

	// ---------------------------------------------------------------- V8 WHARF STRUCTURE
	// These two terraces are not painted-over decks. They are additional
	// *primary* boarding surfaces with independent piles and deck colliders,
	// linked through deliberate openings in the main head's old perimeter.
	// The final outline resembles a salvaged shipyard, not a narrow T-shaped jetty.
	const terraces = [
		{ id: 'netQuay', x0: hx0 - 4.55, x1: hx0 + 0.10,
			z0: zH + 5.3, z1: z1 - 0.75, tint: TEAL },
		{ id: 'captainSpur', x0: HX - 3.2, x1: HX + 3.25,
			z0: z1 - 0.10, z1: z1 + 5.35, tint: CORAL },
	];
	const terracePlankPitch = 0.235;
	const pierFoundation = ( px, pz ) => {

		const bottom = Math.min( - 2.3, ( terrain?.heightAt?.( px, pz ) ?? - 2.0 ) - 1.0 );
		B.rod( 'wood', [ px - 0.07, bottom, pz ],
			[ px, DK + 1.15, pz + 0.04 ], 0.25, 0.20,
			{ segs: 9, ...wood( TAR, 0.26 ) } );
		B.torus( 'rope', px, DK + 0.14, pz, 0.235, 0.035,
			{ radial: 5, tubular: 12, ...rope() } );
		colliders.addCylinder( px, pz, 0.27, bottom, DK + 1.16, { tag: 'pile' } );

	};
	for ( const [ ti, deck ] of terraces.entries() ) {

		const cx = ( deck.x0 + deck.x1 ) / 2, cz = ( deck.z0 + deck.z1 ) / 2;
		const width = deck.x1 - deck.x0, depth = deck.z1 - deck.z0;
		for ( const edgeX of [ deck.x0 + 0.24, deck.x1 - 0.24 ] )
			for ( const edgeZ of [ deck.z0 + 0.24, deck.z1 - 0.24 ] )
				pierFoundation( edgeX, edgeZ );
		for ( const edgeZ of [ deck.z0 + 0.22, deck.z1 - 0.22 ] ) B.beam( 'wood',
			[ deck.x0 - 0.04, DK - 0.36, edgeZ ],
			[ deck.x1 + 0.04, DK - 0.36, edgeZ ], 0.18, 0.29, wood( TAR ) );
		for ( const edgeX of [ deck.x0 + 0.25, deck.x1 - 0.25 ] ) B.beam( 'wood',
			[ edgeX, DK - 0.37, deck.z0 - 0.05 ],
			[ edgeX, DK - 0.37, deck.z1 + 0.05 ], 0.18, 0.28, wood( HULL ) );
		const boardN = Math.ceil( depth / terracePlankPitch );
		for ( let j = 0; j < boardN; j ++ ) {

			const zz = deck.z0 + ( j + 0.5 ) * depth / boardN;
			const patch = ( j + ti ) % 11 === 4;
			B.box( 'wood', cx, DK - 0.035 - ( j % 7 === 0 ? 0.008 : 0 ), zz,
				width - 0.035, 0.073, depth / boardN - 0.015,
				{ grain: 0, ...wood( patch ? deck.tint : ( j % 3 === 0 ? TAR : HULL ), patch ? 0.85 : 0.32 ) } );

		}
		addBox( cx, DK - 0.04, cz, width / 2, 0.04, depth / 2,
			{ walkable: true, solid: true, tag: 'pierDeck' } );
		// Staggered keel braces below: real shipyard construction visible from shore.
		for ( let i = 0; i < 3; i ++ ) {

			const zz = deck.z0 + ( i + 0.5 ) * depth / 3;
			B.beam( 'wood', [ deck.x0 + 0.2, DK - 1.20, zz - 0.55 ],
				[ deck.x1 - 0.2, DK - 0.26, zz + 0.52 ], 0.13, 0.20, wood( HULL ) );

		}
		const rail = ( ax, az, bx, bz ) => {

			B.beam( 'wood', [ ax, DK + 1.05, az ], [ bx, DK + 1.06, bz ],
				0.10, 0.15, wood( deck.tint, 0.75 ) );
			ropeCurve( sagPoints( [ ax, DK + 0.85, az ],
				[ bx, DK + 0.85, bz ], 0.17, 8 ), 0.032 );
			const xLen = Math.abs( bx - ax ), zLen = Math.abs( bz - az );
			addBox( ( ax + bx ) / 2, DK + 0.54, ( az + bz ) / 2,
				Math.max( 0.08, xLen / 2 ), 0.52, Math.max( 0.08, zLen / 2 ), { tag: 'pierRail' } );

		};
		// Exposed edges only: no physical or visual rails across the connecting
		// opening to the main dock or down the captain's southward walkway.
		if ( ti === 0 ) {

			rail( deck.x0 + 0.15, deck.z0 + 0.15, deck.x0 + 0.15, deck.z1 - 0.15 );
			rail( deck.x0 + 0.15, deck.z0 + 0.15, deck.x1 - 0.15, deck.z0 + 0.15 );
			rail( deck.x0 + 0.15, deck.z1 - 0.15, deck.x1 - 0.15, deck.z1 - 0.15 );

		} else {

			rail( deck.x0 + 0.15, deck.z0 + 0.15, deck.x0 + 0.15, deck.z1 - 0.15 );
			rail( deck.x1 - 0.15, deck.z0 + 0.15, deck.x1 - 0.15, deck.z1 - 0.15 );
			rail( deck.x0 + 0.15, deck.z1 - 0.15, deck.x1 - 0.15, deck.z1 - 0.15 );

		}

	}

	// Boatbuilder's hoist, a recognizable skyline with braced timber legs,
	// pulley drum, rope and an empty cargo hook. Fits inside the net quay so
	// the boat's eastern berth and the player's central path stay unobstructed.
	const hoistX = hx0 - 3.65, hoistZ = zH + 7.35;
	for ( const side of [ - 1, 1 ] ) {

		B.beam( 'wood', [ hoistX, DK + 0.02, hoistZ + side * 1.0 ],
			[ hoistX + 0.17, DK + 4.7, hoistZ + side * 0.64 ], 0.21, 0.28,
			wood( TAR, 0.25 ) );
		B.beam( 'wood', [ hoistX + 0.17, DK + 4.65, hoistZ + side * 0.64 ],
			[ hoistX + 1.6, DK + 5.23, hoistZ ], 0.17, 0.23,
			wood( GOLD, 0.6 ) );

	}
	B.beam( 'wood', [ hoistX, DK + 4.3, hoistZ - 0.83 ],
		[ hoistX, DK + 4.3, hoistZ + 0.83 ], 0.18, 0.25, wood( HULL ) );
	B.torus( 'hard', hoistX + 1.60, DK + 5.23, hoistZ,
		0.19, 0.052, { rx: Math.PI / 2, radial: 7, tubular: 14,
			tint: GOLD, data: HARD( rand.next(), 0.5, 0.8, 0.4 ) } );
	B.beam( 'rope', [ hoistX + 1.60, DK + 5.18, hoistZ ],
		[ hoistX + 1.60, DK + 2.8, hoistZ ], 0.023, 0.023, rope() );
	B.torus( 'hard', hoistX + 1.6, DK + 2.73, hoistZ, 0.11, 0.03,
		{ radial: 6, tubular: 12, tint: GOLD, data: HARD( rand.next(), 0.6, 0.7, 0.5 ) } );

	// Sailmaker's high tarpaulin on the new spur, intentionally above the walk
	// clearance and asymmetric against the head's original rectangular canopy.
	const sx0 = HX - 2.87, sx1 = HX + 2.94, sz = z1 + 3.7;
	for ( const px of [ sx0, sx1 ] ) B.rod( 'wood',
		[ px, DK + 0.08, sz ], [ px, DK + 3.90, sz - 0.16 ],
		0.15, 0.11, { segs: 8, ...wood( HULL ) } );
	B.slab( 'fabric', [ V( sx0, DK + 3.67, sz - 0.15 ),
		V( sx1, DK + 3.82, sz - 0.14 ), V( sx1 - 0.48, DK + 3.07, z1 + 0.10 ),
		V( sx0 + 0.32, DK + 3.05, z1 + 0.15 ) ], 0.025,
		{ tint: IVORY, data: [ rand.next(), 0.82, 0.35, 0 ] } );
	for ( const px of [ sx0, sx1 ] ) ropeCurve( sagPoints(
		[ px, DK + 3.82, sz ], [ HX, DK + 4.20, z1 - 0.5 ], 0.13, 10 ), 0.022 );

	// Main T-head becomes a maritime work platform: contrasting transom
	// borders, canvas sail shade, heavy masts, cargo ropes and coiled rigging.
	for ( const xx of [ hx0 + 0.16, hx1 - 0.16 ] ) {

		B.beam( 'wood', [ xx, DK - 0.09, zH + 0.06 ], [ xx, DK - 0.09, z1 - 0.08 ],
			0.19, 0.26, wood( TAR ) );

	}
	for ( const zz of [ zH + 0.18, z1 - 0.12 ] ) {

		B.beam( 'wood', [ hx0 + 0.1, DK - 0.085, zz ], [ hx1 - 0.1, DK - 0.085, zz ],
			0.19, 0.28, wood( HULL ) );

	}

	const poleA = [ hx0 + 0.48, DK, zH + 0.93 ];
	const poleB = [ hx0 + 4.1, DK, z1 - 0.86 ];
	for ( const [ px, py, pz ] of [ poleA, poleB ] ) {

		B.rod( 'wood', [ px, py + 0.1, pz ], [ px + 0.04, py + 4.10, pz ], 0.17, 0.13,
			{ segs: 9, ...wood( HULL ) } );
		for ( const h of [ 0.65, 3.7 ] ) for ( let k = 0; k < 4; k ++ ) B.torus( 'rope', px, py + h + k * 0.039, pz,
			0.17, 0.026, { radial: 4, tubular: 12, ...rope() } );

	}
	// Three irregular patches instead of a straight geometric tarp.
	const a = poleA, b = poleB;
	const edge = [ hx0 + 0.62, DK + 3.05, z1 - 0.64 ];
	B.slab( 'fabric', [ V( a[ 0 ], DK + 3.77, a[ 2 ] ), V( b[ 0 ], DK + 3.53, b[ 2 ] ),
		V( edge[ 0 ], DK + 2.82, edge[ 2 ] ) ], 0.045,
		{ tint: IVORY, data: [ rand.next(), 0.75, 0.2, 0 ] } );
	B.slab( 'fabric', [ V( a[ 0 ] + 0.07, DK + 3.66, a[ 2 ] ),
		V( b[ 0 ] + 0.17, DK + 3.45, b[ 2 ] ), V( hx0 + 5.55, DK + 2.88, z1 - 1.4 ) ], 0.035,
		{ tint: CORAL, data: [ rand.next(), 0.62, 0.15, 0 ] } );
	for ( const pt of [ [ a[ 0 ], a[ 2 ] ], [ b[ 0 ], b[ 2 ] ] ] ) {

		ropeCoil( B, pt[ 0 ] + 0.31, DK, pt[ 1 ] + 0.28, 0.06, 0.30, 4, rand.next(), DARK_ROPE );

	}

	// An outboard swinging tide marker: visible from water, outside the boat
	// berth itself. Finial sits well above the play corridor.
	const mx = hx0 - 0.42, mz = z1 - 0.68;
	B.rod( 'wood', [ mx, DK - 0.6, mz ], [ mx, DK + 4.68, mz ], 0.14, 0.10,
		{ segs: 8, ...wood( HULL ) } );
	B.beam( 'wood', [ mx, DK + 4.1, mz ], [ mx + 1.6, DK + 3.93, mz ], 0.12, 0.18,
		wood( HULL ) );
	B.slab( 'fabric', [ V( mx + 0.09, DK + 3.95, mz ), V( mx + 1.54, DK + 3.88, mz ),
		V( mx + 0.16, DK + 2.86, mz + 0.05 ) ], 0.022,
		{ tint: TEAL, data: [ rand.next(), 0.74, 0.2, 0 ] } );

}
