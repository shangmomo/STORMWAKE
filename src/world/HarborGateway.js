import { Vector3 } from '../engine/index.js';
import { C, HARD, WOOD, buoy, lin } from './Props.js';
import { addEmbossedHarborText } from './village/HarborLettering.js';

// The village's arrival landmark. Static geometry is emitted into the village's
// original six material batches; only the small hanging sign remains animated.
// No additional lights, textures, material pipelines or per-frame work.

const palette = {
	wood: lin( 0x886043 ),
	darkWood: lin( 0x573a2b ),
	bone: lin( 0xf3e6c7 ),
	teal: lin( 0x13505c ),
	tealBright: lin( 0x32838d ),
	gold: lin( 0xe3ae66 ),
	stone: lin( 0xe5dbba ),
	slate: lin( 0x4a7777 ),
	pink: lin( 0xec8d80 ),
	coral: lin( 0xffac72 ),
	leaves: lin( 0x5d9070 ),
	seafoam: lin( 0x9fd4c2 ),
};

function oval( cx, cy, cz, rx, ry, segs = 28 ) {

	const pts = [];
	for ( let i = 0; i < segs; i ++ ) {

		const a = i / segs * Math.PI * 2;
		pts.push( new Vector3( cx + Math.cos( a ) * rx, cy + Math.sin( a ) * ry, cz ) );

	}
	return pts;

}

function flowerBarrel( B, terrain, x, z, seed, tone, size = 1 ) {

	const y = terrain( x, z ) - 0.06;
	const wood = WOOD( seed, 0.8, 0, 0.55 );
	B.cyl( 'wood', x, y, z, 0.33 * size, 0.37 * size, 0.48 * size, { segs: 12, tint: palette.darkWood, data: wood } );
	for ( const dh of [ 0.09, 0.42 ] ) B.torus( 'hard', x, y + dh * size, z, 0.342 * size, 0.027 * size, {
		radial: 5, tubular: 16, tint: C.brass, data: HARD( seed, 0.22, 0.3, 0.64 ),
	} );
	B.cyl( 'stone', x, y + 0.47 * size, z, 0.32 * size, 0.32 * size, 0.07 * size, { segs: 12, tint: lin( 0x554a38 ), data: [ seed, 0, 0, 0 ] } );
	const petals = [ tone, palette.coral, palette.pink, palette.bone, lin( 0xe7d66d ) ];
	for ( let i = 0; i < 17; i ++ ) {

		const a = i * 2.39996323 + seed * 3, r = Math.sqrt( ( i + 0.5 ) / 17 ) * 0.32 * size;
		const xx = x + Math.cos( a ) * r, zz = z + Math.sin( a ) * r;
		const h = ( 0.18 + ( i * 7 % 11 ) / 11 * 0.42 ) * size;
		const fx = xx + Math.cos( a ) * 0.085 * size, fy = y + 0.52 * size + h;
		B.rod( 'hard', [ xx, y + 0.47 * size, zz ], [ fx, fy, zz ], 0.012 * size, 0.009 * size, {
			segs: 4, tint: palette.leaves, data: HARD( seed, 0, 0, 0.8 ),
		} );
		for ( const s of [ - 1, 1 ] ) B.slab( 'hard', [
			new Vector3( fx, fy - 0.10 * size, zz ),
			new Vector3( fx + s * 0.10 * size, fy - 0.15 * size, zz ),
			new Vector3( fx + s * 0.035 * size, fy + 0.04 * size, zz ),
		], 0, { tint: palette.leaves, data: HARD( seed, 0, 0, 0.9 ) } );
		const tint = petals[ i % petals.length ];
		for ( let k = 0; k < 5; k ++ ) {

			const t = k * Math.PI * 2 / 5;
			B.cyl( 'hard', fx + Math.cos( t ) * 0.045 * size, fy + Math.sin( t ) * 0.045 * size, zz, 0.048 * size, 0.041 * size, 0.024 * size, {

				rx: Math.PI / 2, segs: 7, tint, data: HARD( seed, 0, 0, 0.85 ),

			} );

		}
		B.cyl( 'hard', fx, fy, zz + 0.025 * size, 0.023 * size, 0.023 * size, 0.018 * size, {
			rx: Math.PI / 2, segs: 8, tint: palette.gold, data: HARD( seed, 0, 0, 0.6 ),
		} );

	}

}

function climbingFlowers( B, px, baseTop, gateZ, sign, seed ) {

	const stem = HARD( seed, 0.03, 0.1, 0.7 );
	const colours = [ palette.coral, palette.pink, lin( 0xe45f58 ), palette.gold ];
	for ( let i = 0; i < 10; i ++ ) {

		const h = i / 10;
		const a = h * Math.PI * 2.7 + seed * 2.5;
		const px0 = px + sign * ( 0.23 + 0.16 * Math.cos( a ) );
		const y = baseTop + 0.13 + h * 1.14;
		const z0 = gateZ + 0.31 + 0.07 * Math.sin( a );
		const fx = px0 + sign * ( 0.1 + 0.1 * ( i % 3 ) / 3 ), fy = y + 0.10;
		B.rod( 'hard', [ px, baseTop - 0.13 + i * 0.08, gateZ + 0.31 ], [ fx, fy, z0 ],
			0.011, 0.007, { segs: 4, tint: palette.leaves, data: stem } );
		for ( const s of [ - 1, 1 ] ) B.slab( 'hard', [
			new Vector3( fx - sign * 0.08, fy - 0.05, z0 ),
			new Vector3( fx + s * 0.13, fy - 0.01, z0 + 0.02 ),
			new Vector3( fx, fy + 0.05, z0 ),
		], 0, { tint: palette.leaves, data: stem } );
		if ( i % 2 === 0 ) for ( let j = 0; j < 5; j ++ ) {

			const t = j / 5 * Math.PI * 2;
			B.cyl( 'hard', fx + Math.cos( t ) * 0.07, fy + Math.sin( t ) * 0.07, z0,
				0.065, 0.055, 0.018, { rx: Math.PI / 2, segs: 7,
					tint: colours[ ( i / 2 ) % colours.length ], data: HARD( seed, 0, 0, 0.85 ) } );

		}

	}

}

function waveCrest( B, X, beamY, gateZ, poleX, wood, metal ) {

	// The reference's distinctive teal-and-gold rolling crest is real volume,
	// not a flat image: a succession of convex timber pieces sharing one batch.
	const spans = 38, reach = poleX - 0.37;
	const arch = t => beamY + 0.13 + 0.17 * Math.sin( Math.PI * t );
	const crown = t => {

		const bump = ( center, spread, height ) => height * Math.exp( - ( ( ( t - center ) / spread ) ** 2 ) );
		return arch( t ) + 0.17 + bump( 0.30, 0.09, 0.34 ) + bump( 0.5, 0.12, 0.54 ) + bump( 0.70, 0.09, 0.34 );

	};
	for ( let i = 0; i < spans; i ++ ) {

		const ta = i / spans, tb = ( i + 1 ) / spans;
		const xa = X + ( ta * 2 - 1 ) * reach, xb = X + ( tb * 2 - 1 ) * reach;
		for ( const zFace of [ - 0.13, 0.19 ] ) {

			const path = [
				new Vector3( xa, arch( ta ) + 0.055, gateZ + zFace ),
				new Vector3( xb, arch( tb ) + 0.055, gateZ + zFace ),
				new Vector3( xb, crown( tb ), gateZ + zFace ),
				new Vector3( xa, crown( ta ), gateZ + zFace ),
			];
			B.slab( 'wood', path, 0.045, { up: new Vector3( 0, 0, zFace > 0 ? 1 : - 1 ),
				tint: palette.teal, data: WOOD( 0.23, 0.46, 0.78, 0 ) } );

		}
		for ( const lift of [ 0.05, - 0.12 ] ) B.beam( 'wood',
			[ xa, arch( ta ) + lift, gateZ ], [ xb, arch( tb ) + lift, gateZ ],
			0.31, lift > 0 ? 0.15 : 0.14, { tint: lift > 0 ? palette.darkWood : palette.wood, data: wood(), extend: 0.015 } );
		for ( const dz of [ - 0.185, 0.24 ] ) {

			B.rod( 'hard', [ xa, crown( ta ), gateZ + dz ], [ xb, crown( tb ), gateZ + dz ],
				0.013, 0.013, { segs: 5, tint: palette.gold, data: metal() } );
			B.rod( 'hard', [ xa, arch( ta ) + 0.055, gateZ + dz ], [ xb, arch( tb ) + 0.055, gateZ + dz ],
				0.009, 0.009, { segs: 5, tint: palette.seafoam, data: metal() } );

		}

	}
	for ( const s of [ - 1, 0, 1 ] ) for ( const dz of [ - 0.20, 0.25 ] ) {

		const t = 0.5 + s * 0.2;
		const x = X + ( t * 2 - 1 ) * reach;
		const y = crown( t ) - 0.085;
		B.torus( 'hard', x, y, gateZ + dz, 0.12, 0.019, {
			rx: Math.PI / 2, radial: 5, tubular: 22, arc: Math.PI * 1.75,
			tint: palette.gold, data: metal(), rz: 0.2 * s,
		} );
		B.torus( 'hard', x, y, gateZ + dz + Math.sign( dz ) * 0.017, 0.075, 0.026, {
			rx: Math.PI / 2, radial: 6, tubular: 18, arc: Math.PI * 1.85,
			tint: palette.tealBright, data: metal(), rz: 0.2 * s,
		} );

	}

}

function fishingFloat( B, x, y, z, tint, seed, size = 1 ) {

	B.lathe( 'hard', x, y, z, [
		[ 0, 0 ], [ 0.10 * size, 0.025 * size ], [ 0.22 * size, 0.12 * size ],
		[ 0.23 * size, 0.27 * size ], [ 0.12 * size, 0.42 * size ], [ 0, 0.45 * size ],
	], { segs: 13, tint, data: HARD( seed, 0.08, 0.24, 0.55 ) } );
	for ( const h of [ 0.1, 0.33 ] ) B.torus( 'rope', x, y + h * size, z, 0.2 * size, 0.017 * size,
		{ radial: 5, tubular: 15, tint: C.rope, data: [ seed, 0.5, 0, 0 ] } );
	// Loose net strapping around each brightly coloured float.
	for ( let k = 0; k < 8; k ++ ) {

		const a = k / 8 * Math.PI * 2;
		B.rod( 'rope', [ x + Math.cos( a ) * 0.15 * size, y + 0.04 * size, z + Math.sin( a ) * 0.15 * size ],
			[ x + Math.cos( a + 0.17 ) * 0.16 * size, y + 0.39 * size, z + Math.sin( a + 0.17 ) * 0.16 * size ],
			0.009 * size, 0.009 * size, { segs: 4, tint: C.rope, data: [ seed, 0.4, 0, 0 ] } );

	}

}

function drapedFishingNet( B, x, y, z, seed ) {

	// A single static diamond fishing net, outside the playable walkable lane.
	// Its shallow curved silhouette reads naturally from both pier directions.
	const cols = 9, rows = 8, width = 0.94, height = 1.30;
	const point = ( i, j ) => {

		const u = i / cols, v = j / rows;
		return [ x + u * width + Math.sin( v * Math.PI ) * 0.09 - v * 0.13,
			y - v * height - 0.38 * u * u - Math.sin( u * Math.PI ) * v * 0.15,
			z + Math.sin( u * Math.PI ) * ( 0.06 + 0.10 * v ) ];

	};
	for ( let i = 0; i <= cols; i ++ ) for ( let j = 0; j < rows; j ++ ) B.rod( 'rope', point( i, j ), point( i, j + 1 ),
		0.008, 0.008, { segs: 4, tint: C.ropeDark, data: [ seed, 0.16, 0, 0 ] } );
	for ( let j = 0; j <= rows; j ++ ) for ( let i = 0; i < cols; i ++ ) B.rod( 'rope', point( i, j ), point( i + 1, j ),
		0.008, 0.008, { segs: 4, tint: C.ropeDark, data: [ seed, 0.16, 0, 0 ] } );
	for ( const i of [ 2, 5, 8 ] ) B.cyl( 'stone', ...point( i, rows ), 0.034, 0.05, 0.085,
		{ segs: 7, tint: palette.bone, data: [ seed, 0.3, 0, 0 ] } );

}

function fishAndCompass( S, X, signY, gateZ, metal ) {

	for ( const face of [ - 1, 1 ] ) {

		const z = gateZ + face * 0.123;
		const p = ( u, v ) => new Vector3( X + face * u, signY + v, z );
		const fx = X + face * ( - 1.09 );
		S.slab( 'hard', oval( fx, signY + 0.03, z, 0.18, 0.085 ), 0.023, {
			up: new Vector3( 0, 0, face ), tint: palette.coral, data: metal(),
		} );
		S.slab( 'hard', [ p( - 1.22, 0.01 ), p( - 1.37, 0.15 ), p( - 1.34, - 0.12 ) ], 0.02, {
			up: new Vector3( 0, 0, face ), tint: palette.coral, data: metal(),
		} );
		S.slab( 'hard', [ p( - 1.13, 0.085 ), p( - 1.03, 0.18 ), p( - 0.99, 0.08 ) ], 0.017, {
			up: new Vector3( 0, 0, face ), tint: palette.coral, data: metal(),
		} );
		S.cyl( 'hard', X + face * ( - 0.96 ), signY + 0.057, z + face * 0.024,
			0.013, 0.013, 0.009, { rx: Math.PI / 2, segs: 8, tint: palette.darkWood, data: metal() } );
		for ( const s of [ - 1, 0, 1 ] ) S.rod( 'hard',
			[ p( - 1.28 + s * 0.08, - 0.22 ).x, signY - 0.22, z ],
			[ p( - 1.28 + s * 0.08, - 0.22 ).x - face * 0.07, signY - 0.08 + Math.abs( s ) * 0.07, z ],
			0.009, 0.009, { segs: 5, tint: palette.coral, data: metal() } );

		const cx = X + face * 1.14, cy = signY;
		S.torus( 'hard', cx, cy, z, 0.115, 0.014, {
			rx: Math.PI / 2, radial: 5, tubular: 24, tint: palette.gold, data: metal(),
		} );
		for ( let k = 0; k < 8; k ++ ) {

			const a = k * Math.PI / 4;
			const ux = Math.cos( a ), uy = Math.sin( a );
			S.rod( 'hard', [ cx, cy, z + face * 0.009 ], [ cx + ux * 0.098, cy + uy * 0.098, z + face * 0.009 ],
				k % 2 ? 0.006 : 0.012, 0.005, { segs: 4, tint: k % 2 ? palette.bone : palette.gold, data: metal() } );

		}
		S.cyl( 'hard', cx, cy, z + face * 0.013, 0.017, 0.017, 0.009, {
			rx: Math.PI / 2, segs: 8, tint: palette.bone, data: metal(),
		} );

	}

}

export function buildHarborGateway( { B, S, X, DK, az, pierWidth, terrain, colliders, rand } ) {

	const beamY = DK + 3.45;
	const poleX = pierWidth / 2 + 0.79;
	const gateZ = az - 0.12;
	const baseTop = DK + 0.52;
	const wood = () => WOOD( rand.next(), 0.84, 0.06, 0.22 );
	const painted = ( weather = 0.7 ) => WOOD( rand.next(), weather, 0.74, 0 );
	const metal = () => HARD( rand.next(), 0.08, 0.38, 0.45 );

	for ( const sign of [ - 1, 1 ] ) {

		const px = X + sign * poleX;
		const floor = terrain( px, gateZ );
		const baseBottom = Math.min( floor - 0.13, baseTop - 0.5 );
		const baseHeight = baseTop - baseBottom;
		// Genuine stone plinths, independent of the old timber pier piles.
		B.cyl( 'stone', px, baseBottom, gateZ, 0.45, 0.66, baseHeight, {

			segs: 13, tint: palette.stone, data: [ rand.next(), 0.82, 0, 0 ],

		} );
		for ( let i = 0; i < 4; i ++ ) {

			const h = i / 4, level = baseBottom + 0.11 + h * baseHeight;
			const r = 0.67 - h * 0.20;
			B.torus( 'stone', px, level, gateZ, r, 0.027, {
				radial: 4, tubular: 13, tint: i % 2 ? palette.stone : palette.bone,
				data: [ rand.next(), 0.9, 0, 0 ],
			} );
			for ( let j = 0; j < 4; j ++ ) {

				const a = j * Math.PI / 2 + ( i % 2 ) * 0.39;
				B.box( 'stone', px + Math.cos( a ) * ( r - 0.055 ), level + 0.085,
					gateZ + Math.sin( a ) * ( r - 0.055 ), 0.19, 0.13, 0.10, {
						ry: - a, tint: i % 3 ? palette.stone : palette.bone,
						data: [ rand.next(), 0.8, 0, 0 ],
					} );

			}

		}
		B.cyl( 'stone', px, baseTop - 0.08, gateZ, 0.45, 0.45, 0.15, {

			segs: 12, tint: palette.bone, data: [ rand.next(), 1, 0, 0 ],

		} );
		// The gate stands OUTSIDE the playable pier. Do not put a collider across the walkway.
		colliders.addCylinder( px, gateZ, 0.66, baseBottom, baseTop + 0.06, { tag: 'harborGatewayBase' } );
		B.cyl( 'wood', px, baseTop - 0.025, gateZ, 0.29, 0.32, beamY + 0.42 - baseTop, {

			segs: 11, tint: palette.darkWood, data: wood(),

		} );
		colliders.addCylinder( px, gateZ, 0.33, baseTop, beamY + 0.52, { tag: 'harborGatewayPost' } );
		// Square cap, brass bolts, four rope wraps give the post human scale.
		B.cyl( 'wood', px, beamY + 0.41, gateZ, 0.29, 0.32, 0.08, {
			segs: 10, tint: palette.wood, data: WOOD( rand.next(), 0.85, 0, 0 ),
		} );
		for ( const h of [ beamY - 0.77, beamY - 0.69, beamY + 0.05, beamY + 0.13, beamY + 0.21 ] ) B.torus( 'rope', px, h, gateZ, 0.332, 0.042, {

			radial: 6, tubular: 16, tint: C.rope, data: [ rand.next(), 0, 0, 0 ],

		} );
		for ( const y of [ beamY - 0.44, beamY + 0.13 ] ) B.cyl( 'hard', px, y, gateZ + 0.323, 0.037, 0.037, 0.025, {

			segs: 8, rx: Math.PI / 2, tint: palette.gold, data: metal(),

		} );

		// Curved shoulder brace supporting the broad overhead beam.
		const brace = t => [ px - sign * ( 0.76 * t * t ),
			beamY - 0.88 + 0.80 * Math.sin( t * Math.PI / 2 ), gateZ ];
		for ( let k = 0; k < 10; k ++ ) B.beam( 'wood', brace( k / 10 ), brace( ( k + 1 ) / 10 ),
			0.19, 0.19, { tint: palette.wood, data: wood(), extend: 0.025 } );

		// Oversized flowering driftwood barrels visually anchor the limestone plinths.
		flowerBarrel( B, terrain, px + sign * 0.58, gateZ + 0.47, rand.next(), palette.pink, 1.1 );
		flowerBarrel( B, terrain, px - sign * 0.37, gateZ - 0.62, rand.next(), palette.coral, 0.7 );
		climbingFlowers( B, px, baseTop, gateZ, sign, rand.next() );

		// Three net-wrapped, full-size fishing floats hang beyond the opening.
		const bx = px + sign * 0.41;
		B.rod( 'rope', [ bx, beamY + 0.07, gateZ + 0.26 ], [ bx, beamY - 0.8, gateZ + 0.26 ], 0.018, 0.018, {

			segs: 5, tint: C.rope, data: [ rand.next(), 0.012, 0, 0 ],

		} );
		fishingFloat( B, bx, beamY - 1.17, gateZ + 0.26,
			sign === 1 ? palette.tealBright : palette.coral, rand.next(), 1 );
		if ( sign === - 1 ) {

			const bx2 = bx - 0.34;
			B.rod( 'rope', [ bx2, beamY + 0.07, gateZ + 0.3 ], [ bx2, beamY - 1.0, gateZ + 0.3 ],
				0.018, 0.018, { segs: 5, tint: C.rope, data: [ rand.next(), 0.012, 0, 0 ] } );
			fishingFloat( B, bx2, beamY - 1.33, gateZ + 0.3, palette.gold, rand.next(), 0.75 );

		}

	}

	// The reference image's sculpted triple-wave turquoise crown and gold edging.
	waveCrest( B, X, beamY, gateZ, poleX, wood, metal );
	B.beam( 'wood', [ X - poleX - 0.40, beamY + 0.16, gateZ ],
		[ X + poleX + 0.40, beamY + 0.16, gateZ ], 0.38, 0.25,
		{ tint: palette.darkWood, data: wood(), extend: 0.06 } );
	for ( const sign of [ - 1, 1 ] ) for ( let i = 0; i < 4; i ++ ) {

		// Nautical crossbar lashings at both shoulders, just like the reference.
		const sx = X + sign * ( poleX - 0.29 + i * 0.065 );
		B.torus( 'rope', sx, beamY + 0.16, gateZ, 0.205, 0.035, {
			rz: Math.PI / 2, radial: 6, tubular: 15, tint: C.rope,
			data: [ rand.next(), 0.25, 0, 0 ],
		} );

	}
	drapedFishingNet( B, X + poleX - 0.12, beamY + 0.22, gateZ + 0.37, rand.next() );

	// Hanging double-faced enamel plaque. Both wood and lettering are contained in
	// signB, so Village._buildSign() continues to animate the complete sign as one.
	const signY = beamY - 0.76;
	const pivot = new Vector3( X, beamY - 0.18, gateZ );
	// GeoBuilder.slab extrudes *behind* its input plane (not around its center).
	// Start at +0.065 so the 0.13-m body spans BOTH sides equally. Otherwise
	// the solid wooden back face would occlude all of the rear lettering.
	S.slab( 'wood', oval( X, signY, gateZ + 0.065, 1.46, 0.475 ), 0.13, {

		up: new Vector3( 0, 0, 1 ), uDir: new Vector3( 1, 0, 0 ), tint: palette.darkWood, data: wood(),

	} );
	for ( const face of [ 1, - 1 ] ) {

		S.slab( 'wood', oval( X, signY, gateZ + face * 0.076, 1.38, 0.417 ), 0.013, {

			up: new Vector3( 0, 0, face ), uDir: new Vector3( 1, 0, 0 ), tint: palette.gold, data: painted( 0.58 ),

		} );
		S.slab( 'wood', oval( X, signY, gateZ + face * 0.087, 1.315, 0.36 ), 0.012, {

			up: new Vector3( 0, 0, face ), uDir: new Vector3( 1, 0, 0 ), tint: palette.teal, data: painted( 0.55 ),

		} );
		for ( let i = 0; i < 14; i ++ ) {

			const a = i / 14 * Math.PI * 2;
			const px = X + Math.cos( a ) * 1.39, py = signY + Math.sin( a ) * 0.426;
			S.cyl( 'hard', px, py, gateZ + face * 0.088, 0.018, 0.018, 0.012, {
				rx: Math.PI / 2, segs: 6, tint: palette.gold, data: metal(),
			} );

		}

	}
	addEmbossedHarborText( S, X, signY + 0.025, gateZ );
	fishAndCompass( S, X, signY, gateZ, metal );
	for ( const s of [ - 1, 1 ] ) {

		// Chains attach to the sign and swing with its own pivot.
		S.rod( 'hard', [ X + s * 0.99, signY + 0.37, gateZ ], [ X + s * 0.99, beamY - 0.18, gateZ ],
			0.011, 0.011, { segs: 6, tint: C.iron, data: HARD( rand.next(), 0.25, 0.4, 0.4 ) } );
		for ( let i = 0; i < 4; i ++ ) S.torus( 'hard', X + s * 0.99, beamY - 0.21 - i * 0.06, gateZ, 0.034, 0.009, {

			rx: Math.PI / 2, radial: 4, tubular: 8, tint: C.iron, data: HARD( rand.next(), 0.22, 0.35, 0.6 ),

		} );

	}

	// Bunting and rope are behind the swinging plaque; colored triangles remain
	// visible beside its silhouette while preserving the center of the pier.
	const buntingY = beamY - 1.28, buntingZ = gateZ + 0.2;
	B.rod( 'rope', [ X - poleX + 0.06, buntingY, buntingZ ], [ X + poleX - 0.06, buntingY, buntingZ ],
		0.011, 0.011, { segs: 5, tint: C.rope, data: [ rand.next(), 0.011, 0, 0 ] } );
	const flags = [ palette.coral, palette.bone, palette.slate, palette.pink, palette.gold ];
	for ( let i = 0; i < 9; i ++ ) {

		const fx = X - 1.58 + i * 0.395;
		B.slab( 'flag', [
			new Vector3( fx - 0.12, buntingY, buntingZ ),
			new Vector3( fx + 0.12, buntingY, buntingZ ),
			new Vector3( fx + 0.025, buntingY - 0.13, buntingZ ),
		], 0, { tint: flags[ i % flags.length ], data: [ rand.next(), 0.6, 0, 0 ] } );

	}

	return {
		signPivot: pivot,
		lampHooks: [ - 1, 1 ].map( ( s ) => new Vector3( X + s * ( poleX - 0.47 ), beamY - 0.52, gateZ + 0.15 ) ),
		height: beamY,
		// plaque's lowest point is over 2m above the walkable deck
		clearance: beamY - 0.76 - 0.475 - DK,
		clearWidth: 2 * ( poleX - 0.66 ),
	};

}

