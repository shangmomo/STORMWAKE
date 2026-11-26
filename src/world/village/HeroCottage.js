import { HARD, WOOD, lin } from '../Props.js';
import { Vector3 } from '../../engine/index.js';

// V6 showcase cottage: additional architecture and lived-in details, sharing
// the existing village material batches. No imported render pipelines/models.
const P = {
	cream: lin( 0xece1c8 ), teal: lin( 0x3c8c88 ), aged: lin( 0x9c8164 ),
	terracotta: lin( 0xa86949 ), stone: lin( 0xd8cbb0 ), copper: lin( 0x6c6e62 ),
	leaf: lin( 0x4a8652 ), leafLight: lin( 0x76a66b ),
	flower: [ lin( 0xe68c68 ), lin( 0xf4c27f ), lin( 0xefb2ba ), lin( 0xece5c1 ) ],
};

const wd = ( rand, paint = 0.68, weather = 0.58 ) => WOOD( rand.next(), paint, 0, weather );

// Opaque wooden windows used to float in front of an unbroken wall.
// These reveals sit *inside* the apertures cut by fillWallAroundApertures.
export function heroWindowReveal( B, rand, cx, y, w, h, trim ) {

	const data = () => wd( rand, 0.78, 0.53 );
	const depth = 0.135;
	for ( const s of [ - 1, 1 ] ) {

		B.box( 'wood', cx + s * ( w / 2 - 0.023 ), y + h / 2, - depth / 2, 0.055, h - 0.045, depth, { grain: 1, tint: trim, data: data() } );

	}
	for ( const yy of [ y + 0.027, y + h - 0.027 ] ) {

		B.box( 'wood', cx, yy, - depth / 2, w - 0.048, 0.055, depth, { grain: 0, tint: trim, data: data() } );

	}
	// A projecting drip lip and a deep wooden sill make the aperture legible at an angle.
	B.box( 'wood', cx, y - 0.055, 0.105, w + 0.24, 0.075, 0.3, { grain: 0, tint: trim, data: data() } );
	B.box( 'wood', cx, y + h + 0.085, 0.075, w + 0.26, 0.08, 0.21, { grain: 0, tint: trim, data: data() } );

}

function flower( B, rand, x, y, z, color ) {

	const g = () => wd( rand, 0.6, 0.35 );
	B.beam( 'wood', [ x, y, z ], [ x + 0.04, y + 0.25, z + 0.03 ], 0.011, 0.012, { tint: P.leaf, data: g() } );
	for ( const s of [ - 1, 1 ] ) {

		B.box( 'fabric', x + s * 0.08, y + 0.13 + s * 0.022, z + 0.025, 0.13, 0.035, 0.08, { ry: s * 0.55, rz: s * 0.28, tint: s > 0 ? P.leafLight : P.leaf, data: [ rand.next(), 0, 0, 0 ] } );

	}
	const xx = x + 0.04, yy = y + 0.25, zz = z + 0.035;
	for ( let i = 0; i < 5; i ++ ) {

		const a = i * Math.PI * 2 / 5;
		B.box( 'fabric', xx + Math.cos( a ) * 0.052, yy + Math.sin( a ) * 0.052, zz + 0.017,
			0.072, 0.11, 0.014, { rz: a - Math.PI / 2, tint: color, data: [ rand.next(), 0, 0, 0 ] } );

	}
	B.box( 'hard', xx, yy, zz + 0.032, 0.039, 0.039, 0.016, { tint: lin( 0xe8ba66 ), data: HARD( rand.next(), 0.4, 0, 0.9 ) } );

}

function planter( B, rand, x, y, z, width = 0.9, depth = 0.28 ) {

	const data = () => wd( rand, 0.6, 0.72 );
	B.box( 'wood', x, y + 0.1, z, width, 0.21, depth, { grain: 0, tint: P.aged, data: data() } );
	B.box( 'wood', x, y + 0.21, z, width + 0.05, 0.04, depth + 0.045, { tint: P.cream, data: data() } );
	B.box( 'stone', x, y + 0.2, z, width - 0.07, 0.01, depth - 0.06, { tint: P.terracotta, data: [ rand.next(), 0, 0, 0 ] } );
	const n = Math.max( 3, Math.round( width / 0.21 ) );
	for ( let i = 0; i < n; i ++ ) {

		const fx = x - width * 0.42 + width * 0.84 * ( i + 0.5 ) / n;
		flower( B, rand, fx, y + 0.22, z, P.flower[ i % P.flower.length ] );

	}

}

function barrelPlanter( B, rand, x, y, z ) {

	B.cyl( 'wood', x, y, z, 0.24, 0.29, 0.49, { segs: 10, tint: P.aged, data: wd( rand, 0.33, 0.72 ) } );
	for ( const dy of [ 0.08, 0.39 ] ) B.cyl( 'hard', x, y + dy, z, 0.285, 0.285, 0.028,
		{ segs: 10, tint: P.copper, data: HARD( rand.next(), 0.7, 0.05, 0.5 ) } );
	for ( let i = 0; i < 6; i ++ ) {

		const a = i * Math.PI / 3;
		flower( B, rand, x + Math.cos( a ) * 0.12, y + 0.49, z + Math.sin( a ) * 0.12,
			P.flower[ i % P.flower.length ] );

	}

}

export function buildHeroCottageExterior( { B, rand, fr, floorY, H, w, d, heroWindows, winW,
	porch, st, roofType, roofColor, roofPitch, porchPitch, roofOverside, roofOverfront } ) {

	// Stand-seam ribs and continuous gutters follow the main roof's exact pitch.
	if ( roofType === 'gable' ) {

		const slope = Math.tan( roofPitch );
		const X = w / 2 + roofOverside, Z = d / 2 + roofOverfront;
		const yE = floorY + H, yR = yE + 0.12 + d / 2 * slope;
		const yF = yE + 0.12 - roofOverfront * slope;
		for ( let i = 1; i < 10; i ++ ) {

			const x = - X + 2 * X * i / 10;
			for ( const side of [ - 1, 1 ] ) {

				B.beam( 'roofMetal', [ x, yF + 0.077, side * Z ], [ x, yR + 0.077, 0 ], 0.019, 0.023,
					{ tint: roofColor, data: [ rand.next(), 0.3, 0, 0 ] } );

			}

		}
		for ( const side of [ - 1, 1 ] ) {

			B.beam( 'hard', [ - X + 0.04, yF - 0.065, side * ( Z + 0.08 ) ], [ X - 0.04, yF - 0.065, side * ( Z + 0.08 ) ], 0.064, 0.07,
				{ tint: P.copper, data: HARD( rand.next(), 0.7, 0.2, 0.2 ) } );
			// Corner downpipes join the gutter without crossing the windows or door.
			const px = X - 0.1, pz = side * ( d / 2 + 0.13 );
			B.beam( 'hard', [ px, yF - 0.06, side * ( Z + 0.08 ) ], [ px, yF - 0.2, pz ], 0.035, 0.04,
				{ tint: P.copper, data: HARD( rand.next(), 0.72, 0.1, 0.25 ) } );
			B.beam( 'hard', [ px, yF - 0.2, pz ], [ px, floorY + 0.29, pz ], 0.034, 0.035,
				{ tint: P.copper, data: HARD( rand.next(), 0.72, 0.1, 0.25 ) } );

		}
		// Subtle brackets expose a structural layer rather than a floating roof slab.
		for ( const sx of [ - 1, 1 ] ) for ( const sz of [ - 1, 1 ] ) {

			const x = sx * ( w / 2 - 0.05 ), z = sz * ( d / 2 - 0.12 );
			B.beam( 'wood', [ x, yE - 0.3, z ], [ x, yE + 0.05, sz * ( Z - 0.12 ) ], 0.075, 0.08,
				{ tint: st.trim, data: wd( rand, 0.85, 0.4 ) } );

		}

	}

	// The two main windows sit behind a true recessed facade. Planters are
	// beneath the openings and deliberately leave the central door approach free.
	for ( const cx of heroWindows[ 0 ] ) planter( B, rand, cx, floorY + 0.55, d / 2 + 0.22, winW + 0.15 );
	for ( const cx of heroWindows[ 1 ] ) planter( B, rand, - cx, floorY + 0.56, - d / 2 - 0.22, winW + 0.07 );

	if ( porch ) {

		const edgeZ = d / 2 + porch.depth;
		// Mirror the actual porch-roof construction. A row of slim metal seams
		// removes the vast featureless slab seen in the original cottage.
		const sl = Math.tan( roofPitch ), ps = Math.tan( porchPitch );
		const eaveEdge = floorY + H + 0.12 - roofOverfront * sl;
		const yAtt = Math.min( floorY + H - 0.03, eaveEdge - 0.22 - 0.03 + roofOverfront * ps );
		const frontRoofZ = edgeZ + 0.32, frontRoofY = yAtt - ( frontRoofZ - d / 2 ) * ps;
		for ( let i = 1; i < 13; i ++ ) {

			const x = - ( w / 2 + 0.2 ) + i * ( w + 0.4 ) / 13;
			B.beam( 'roofMetal', [ x, frontRoofY + 0.065, frontRoofZ - 0.015 ],
				[ x, yAtt + 0.065, d / 2 + 0.02 ], 0.017, 0.022,
				{ tint: roofColor, data: [ rand.next(), 0.24, 0, 0 ] } );

		}
		B.beam( 'wood', [ - w / 2 - 0.22, frontRoofY - 0.15, frontRoofZ ],
			[ w / 2 + 0.22, frontRoofY - 0.15, frontRoofZ ], 0.09, 0.1,
			{ tint: st.trim, data: wd( rand, 0.8, 0.34 ) } );
		for ( const x of [ - w / 2 + 0.34, w / 2 - 0.34 ] ) {

			barrelPlanter( B, rand, x, floorY - 0.03, edgeZ - 0.35 );

		}
		// Decorative hanging beam and short timber blocks at the porch ceiling.
		for ( const x of [ - 1.35, 1.35 ] ) {

			B.box( 'wood', x, floorY + 2.16, d / 2 + 0.08, 0.26, 0.09, 0.12,
				{ tint: st.trim, data: wd( rand, 0.9, 0.4 ) } );

		}

	}
	// Asymmetric covered wash/work deck behind the right gable. Its roof ends
	// before the side window, and it leaves the main front-door aisle untouched.
	// This gives the house a lived-in silhouette instead of one rectangular box.
	const ax0 = w / 2 + 0.05, ax1 = w / 2 + 1.76;
	const az0 = - d / 2 + 0.16, az1 = - d / 2 + 1.68;
	const acx = ( ax0 + ax1 ) / 2, acz = ( az0 + az1 ) / 2;
	const aW = ax1 - ax0, aD = az1 - az0;
	const yJoin = floorY + 2.46, yOutside = floorY + 2.12;
	const roofPoints = [
		new Vector3( ax0 - 0.09, yJoin, az0 - 0.14 ),
		new Vector3( ax1 + 0.23, yOutside - 0.04, az0 - 0.14 ),
		new Vector3( ax1 + 0.23, yOutside - 0.04, az1 + 0.14 ),
		new Vector3( ax0 - 0.09, yJoin, az1 + 0.14 ),
	];
	B.slab( 'roofMetal', roofPoints, 0.048,
		{ up: new Vector3( 0, 1, 0 ), uDir: new Vector3( 1, - 0.19, 0 ).normalize(),
			tint: roofColor, data: [ rand.next(), 0.5, 0, 0 ] } );
	for ( const z of [ az0 + 0.02, az1 - 0.02 ] ) {

		const ground = fr.gAt( ax1, z );
		const supportTop = floorY - 0.12;
		B.box( 'wood', ax1, ( ground - 0.12 + supportTop ) / 2, z, 0.16, supportTop - ground + 0.12, 0.16,
			{ grain: 1, tint: P.aged, data: wd( rand, 0.1, 0.82 ) } );
		B.box( 'stone', ax1, ground - 0.015, z, 0.34, 0.2, 0.34,
			{ tint: P.stone, data: [ rand.next(), 0, 0, 0 ] } );
		B.box( 'wood', ax1, floorY + 1.08, z, 0.11, 2.16, 0.11,
			{ grain: 1, tint: st.trim, data: wd( rand, 0.85, 0.6 ) } );
		B.beam( 'wood', [ ax1 - 0.31, yOutside - 0.23, z ], [ ax1, yOutside - 0.23, z ],
			0.055, 0.09, { tint: st.trim, data: wd( rand, 0.86, 0.5 ) } );

	}
	B.box( 'wood', acx, floorY - 0.08, acz, aW + 0.1, 0.16, aD + 0.12,
		{ grain: 2, tint: P.aged, data: wd( rand, 0.2, 0.72 ) } );
	B.box( 'wood', ax1 + 0.04, floorY - 0.13, acz, 0.15, 0.27, aD + 0.08,
		{ tint: P.cream, data: wd( rand, 0.6, 0.6 ) } );
	fr.addBoxL( acx, floorY - 0.06, acz, aW / 2, 0.1, aD / 2, { walkable: true, solid: false, tag: 'heroWashDeck' } );
	for ( const z of [ az0 + 0.02, az1 - 0.02 ] ) fr.addBoxL( ax1, floorY + 1.06, z, 0.09, 1.06, 0.09, { tag: 'heroWashPost' } );
	// Washbasin, slatted drying rack and a pair of small storage crates.
	B.box( 'wood', ax1 - 0.38, floorY + 0.82, acz, 0.67, 0.09, 0.48,
		{ tint: P.aged, data: wd( rand, 0.25, 0.6 ) } );
	B.box( 'stone', ax1 - 0.38, floorY + 0.91, acz, 0.48, 0.105, 0.32,
		{ tint: P.stone, data: [ rand.next(), 0, 0, 0 ] } );
	for ( const z of [ az0 + 0.27, az0 + 0.43, az0 + 0.59 ] ) B.beam( 'wood',
		[ ax0 + 0.12, floorY + 1.34, z ], [ ax1 - 0.13, floorY + 1.34, z ],
		0.025, 0.035, { tint: P.cream, data: wd( rand, 0.8, 0.35 ) } );
	B.box( 'wood', ax1 - 0.34, floorY + 0.23, az0 + 0.27, 0.5, 0.45, 0.4,
		{ tint: P.aged, data: wd( rand, 0.22, 0.7 ) } );
	B.box( 'wood', ax1 - 0.3, floorY + 0.28, az1 - 0.23, 0.44, 0.55, 0.42,
		{ tint: P.aged, data: wd( rand, 0.26, 0.72 ) } );
	fr.addBoxL( ax1 - 0.35, floorY + 0.43, acz, 0.36, 0.44, aD / 2 - 0.16, { tag: 'heroWashShelf' } );

}

export function buildHeroCottageInterior( { B, rand, floorY, w, d, st, fr } ) {

	const wood = () => wd( rand, 0.5, 0.52 );
	const rug = lin( 0xc28d6e );
	// Thin woven rug leaves the walking surface and door physics untouched.
	B.box( 'fabric', 0.05, floorY + 0.01, 0.64, 1.35, 0.012, 1.04,
		{ tint: rug, data: [ rand.next(), 0, 0, 0 ] } );
	for ( const x of [ - 0.57, 0.57 ] ) B.box( 'wood', x, floorY + 0.022, 0.64, 0.035, 0.012, 1.0,
		{ tint: P.cream, data: wd( rand ) } );

	// Rear kitchen nook: shelves, cups and a low workbench, away from the bed.
	const kitchenZ = - d / 2 + 0.36;
	B.box( 'wood', 0.15, floorY + 0.79, kitchenZ, 1.0, 0.09, 0.48,
		{ tint: P.aged, data: wood() } );
	for ( const x of [ - 0.26, 0.56 ] ) B.box( 'wood', x, floorY + 0.37, kitchenZ,
		0.08, 0.73, 0.43, { tint: P.aged, data: wood() } );
	for ( const yy of [ 1.39, 1.8 ] ) B.box( 'wood', 0.17, floorY + yy, - d / 2 + 0.22,
		1.2, 0.058, 0.22, { tint: st.trim, data: wood() } );
	for ( const x of [ - 0.22, 0.03, 0.29 ] ) B.cyl( 'stone', x, floorY + 1.44, - d / 2 + 0.21,
		0.06, 0.07, 0.14, { segs: 8, tint: P.cream, data: [ rand.next(), 0, 0, 0 ] } );
	fr.addBoxL( 0.15, floorY + 0.43, kitchenZ, 0.52, 0.43, 0.25, { tag: 'homeKitchen' } );

	// Two-person eating corner (right wall) plus shallow wall-mounted map frame.
	const tx = w / 2 - 0.93, tz = 0.47;
	B.box( 'wood', tx, floorY + 0.75, tz, 1.05, 0.1, 0.67,
		{ tint: P.aged, data: wood() } );
	for ( const sx of [ - 1, 1 ] ) for ( const sz of [ - 1, 1 ] ) B.box( 'wood',
		tx + sx * 0.42, floorY + 0.38, tz + sz * 0.25, 0.065, 0.76, 0.07, { tint: P.aged, data: wood() } );
	fr.addBoxL( tx, floorY + 0.44, tz, 0.53, 0.44, 0.35, { tag: 'homeDiningTable' } );
	B.box( 'wood', tx, floorY + 0.42, tz + 0.77, 0.68, 0.06, 0.36,
		{ tint: st.trim, data: wood() } );
	for ( const dx of [ - 0.25, 0.25 ] ) B.box( 'wood', tx + dx, floorY + 0.2, tz + 0.77, 0.06, 0.41, 0.07,
		{ tint: P.aged, data: wood() } );
	fr.addBoxL( tx, floorY + 0.25, tz + 0.77, 0.35, 0.25, 0.2, { tag: 'homeChair' } );
	B.box( 'wood', w / 2 - 0.145, floorY + 1.55, 0.38, 0.06, 0.7, 0.86,
		{ tint: P.aged, data: wood() } );
	B.box( 'fabric', w / 2 - 0.106, floorY + 1.55, 0.38, 0.007, 0.55, 0.69,
		{ tint: lin( 0xe9ddba ), data: [ rand.next(), 0, 0, 0 ] } );
	// Ceiling beams deliberately stay above capsule height at the room perimeter.
	for ( const sx of [ - 1, 1 ] ) B.box( 'wood', sx * ( w / 2 - 0.38 ), floorY + 2.71, 0,
		0.14, 0.12, d - 0.5, { tint: P.aged, data: wood() } );
	// No extra dynamic point lights: the existing lamp and daytime cycle handle illumination.

}
