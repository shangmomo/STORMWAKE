import { Vector3 } from '../../engine/index.js';
import { WOOD, HARD, lin } from '../Props.js';

// Stormwake Outpost (V9): original procedural architecture inspired by the
// broad-shape language of painted pirate fantasy, not copied game assets.
// All pieces are baked into the existing static material batches; no extra
// material, light, particle system or per-frame draw call is introduced.

const UP = new Vector3( 0, 1, 0 );
const V = ( x, y, z ) => new Vector3( x, y, z );
const ROPES = [ lin( 0xd9b782 ), lin( 0xb18a56 ), lin( 0xc3a783 ) ];
const BROWN = lin( 0x4d332b );
const PITCH = lin( 0x2d2c38 );
const BRASS = lin( 0xd9a75d );
const SAILS = [ lin( 0xf0cc86 ), lin( 0x9c473b ), lin( 0x277b78 ), lin( 0xc7b18a ) ];

export function buildPirateOutpostHouse( { B, rand, s, floorY, H, w, d, doorX } ) {

	const variant = s.pirateStyle.variant;
	const paint = s.pirateStyle;
	const yE = floorY + H;
	const roofType = s.roof || 'gable';
	const pitch = Math.tan( s.pitch ?? 0.69 );
	const ovE = s.ovE ?? 0.83;
	const ovR = s.ovR ?? 0.66;
	const darkWood = ( tint = BROWN, a = 0.18 ) => ( { tint, data: WOOD( rand.next(), a, 0, 0.46 ) } );
	const painted = ( tint = paint.edging ) => ( { tint, data: WOOD( rand.next(), 0.89, 0, 0.52 ) } );
	const rope = () => ( { tint: ROPES[ variant % ROPES.length ], data: [ rand.next(), 0.9, 0, 0 ] } );

	// Heavy, slightly crooked ship-timber exoskeleton. Wide angled knees and
	// cross-braces change the read of the house at medium distance.
	for ( const side of [ - 1, 1 ] ) {

		for ( const zSide of [ - 1, 1 ] ) {

			const x = side * ( w / 2 + 0.065 ), z = zSide * ( d / 2 + 0.07 );
			const drift = 0.08 * ( ( variant + zSide ) % 3 - 1 );
			B.beam( 'wood', [ x, floorY - 0.18, z ], [ x + drift, yE + 0.06, z - zSide * 0.1 ], 0.18, 0.27, darkWood() );
			B.beam( 'wood', [ x + drift, yE - 0.76, z - zSide * 0.1 ], [ x - side * 0.85, yE - 0.09, z - zSide * 0.1 ], 0.13, 0.18, painted() );
			B.cyl( 'hard', x, floorY + 0.22, z, 0.045, 0.045, 0.10, { segs: 6, tint: BRASS, data: HARD( rand.next(), 0.8, 0.8, 0.4 ) } );

		}

		// Rough planks stand proud of the side elevation and break its flat plane.
		for ( let i = 0; i < 3; i ++ ) {

			const xx = side * ( w / 2 + 0.092 );
			const zz = - d * 0.27 + i * d * 0.27;
			B.beam( 'wood', [ xx, floorY + 0.35, zz - 0.25 ], [ xx, yE - 0.46, zz + 0.14 ], 0.06, 0.09, darkWood( variant % 2 ? BROWN : PITCH, 0.3 ) );

		}

	}

	for ( const zSide of [ - 1, 1 ] ) {

		B.beam( 'wood', [ - w / 2 - 0.22, yE - 0.12, zSide * ( d / 2 + 0.12 ) ],
			[ w / 2 + 0.22, yE - 0.15, zSide * ( d / 2 + 0.12 ) ], 0.17, 0.24, darkWood() );
		B.beam( 'wood', [ - w / 2 - 0.13, floorY + 0.18, zSide * ( d / 2 + 0.12 ) ],
			[ w / 2 + 0.13, floorY + 0.16, zSide * ( d / 2 + 0.12 ) ], 0.14, 0.19, darkWood() );

	}
	// Some houses have a genuinely different aft massing: a low salvaged
	// captain's cargo cabin instead of recreating the old bungalow lean-to.
	// It is deliberately lower than the original main roof and uses the same
	// pirate hull palette and batching. The attached room is storage scenery;
	// the functional sleeping room and door stay in the main house.
	if ( s.annex ) {

		const a = s.annex;
		const aw = Math.min( w - 0.7, a.w ?? w * 0.62 );
		const ad = a.d ?? 2.1;
		const ax = a.x ?? 0;
		const az = - d / 2 - ad / 2 + 0.13;
		const aft = - d / 2 - ad + 0.13;
		const h = Math.min( 2.26, H - 0.42 );
		const bodyTint = variant % 3 === 0 ? lin( 0x654f40 ) : paint.roof;
		B.box( 'wood', ax, floorY + h / 2, az, aw, h, ad,
			{ grain: 0, ...painted( bodyTint ) } );
		for ( const side of [ - 1, 1 ] ) {

			const xx = ax + side * ( aw / 2 + 0.11 );
			B.rod( 'wood', [ xx, floorY - 0.48, aft + 0.2 ],
				[ xx - side * 0.08, floorY + h + 0.16, aft + 0.2 ],
				0.15, 0.12, { segs: 7, ...darkWood() } );
			B.beam( 'wood', [ xx - side * 0.07, floorY + h - 0.14, aft + 0.2 ],
				[ ax, floorY + h + 0.45, az ], 0.09, 0.14, darkWood( paint.edging ) );

		}
		B.slab( 'wood', [ V( ax - aw / 2 - 0.25, floorY + h - 0.22, aft - 0.20 ),
			V( ax + aw / 2 + 0.25, floorY + h - 0.22, aft - 0.20 ),
			V( ax + aw / 2 + 0.18, floorY + h + 0.48, - d / 2 + 0.04 ),
			V( ax - aw / 2 - 0.18, floorY + h + 0.48, - d / 2 + 0.04 ) ],
			0.10, { up: UP, tint: paint.roof, data: WOOD( rand.next(), 0.85, 0, 0.45 ) } );
		for ( let i = 0; i < 3; i ++ ) B.beam( 'wood',
			[ ax - aw / 2 + 0.2, floorY + 0.5 + i * 0.54, aft - 0.015 ],
			[ ax + aw / 2 - 0.2, floorY + 0.52 + i * 0.54, aft - 0.015 ],
			0.07, 0.13, darkWood( i % 2 ? paint.edging : BROWN ) );

	}

	// Ship-hull skirting remains BELOW the window sills. In V8 the 1.45 m
	// flare crossed the actual lower-storey windows and hid the window joinery.
	// A shorter raised hull also makes the load path visibly more believable.
	for ( const side of [ - 1, 1 ] ) {

		const lowerX = side * ( w / 2 + 0.38 ), upperX = side * ( w / 2 + 0.105 );
		for ( let j = 0; j < 4; j ++ ) {

			const zA = - d / 2 + j * d / 4, zB = zA + d / 4 + 0.015;
			B.slab( 'wood', [ V( lowerX, floorY + 0.12, zA ), V( lowerX, floorY + 0.12, zB ),
				V( upperX, floorY + 0.68, zB ), V( upperX, floorY + 0.68, zA ) ],
				0.085, { up: V( side, 0.15, 0 ), tint: j % 4 === 2 ? paint.roof : BROWN,
					data: WOOD( rand.next(), 0.49, 0, 0.66 ) } );

		}
		B.beam( 'wood', [ lowerX, floorY + 0.16, - d / 2 - 0.13 ],
			[ lowerX, floorY + 0.16, d / 2 + 0.13 ], 0.15, 0.22, darkWood() );
		B.beam( 'wood', [ upperX, floorY + 0.68, - d / 2 - 0.09 ],
			[ upperX, floorY + 0.68, d / 2 + 0.09 ], 0.11, 0.17, painted() );

	}
	B.slab( 'wood', [ V( - w / 2 - 0.30, floorY + 0.12, - d / 2 - 0.31 ),
		V( w / 2 + 0.30, floorY + 0.12, - d / 2 - 0.31 ),
		V( w / 2 + 0.10, floorY + 0.68, - d / 2 - 0.10 ),
		V( - w / 2 - 0.10, floorY + 0.68, - d / 2 - 0.10 ) ],
		0.10, { up: V( 0, 0.14, - 1 ), tint: BROWN, data: WOOD( rand.next(), 0.36, 0, 0.62 ) } );

	// The carved roof horns must follow the actual ridge direction. Earlier
	// versions put every horn on the X axis, leaving gableFront houses with
	// ornaments floating beside their sloped roof instead of fastened timber.
	for ( const side of [ - 1, 1 ] ) {

		const frontGable = roofType === 'gableFront';
		const reach = side * ( ( frontGable ? d / 2 + ovE : w / 2 + ovR ) + 0.10 );
		const yy = yE + ( frontGable ? w / 2 : d / 2 ) * pitch + 0.20;
		const ridge = ( along, height, offset = 0 ) => frontGable ? [ offset, height, along ] : [ along, height, offset ];
		B.beam( 'wood', ridge( reach - side * 0.82, yy - 0.12 ),
			ridge( reach + side * 0.32, yy + 0.20 ), 0.17, 0.24, darkWood( paint.edging, 0.74 ) );
		B.beam( 'wood', ridge( reach + side * 0.30, yy + 0.20 ),
			ridge( reach + side * 0.49, yy + 0.56, 0.07 ), 0.13, 0.19, darkWood( paint.edging, 0.74 ) );

	}

	// Distinct from the source's thin sheet-metal gables: swept overlapping
	// painted shingles and a high curved ridge, with deliberately uneven ends.
	const xSpan = w / 2 + ovR + 0.24;
	const zSpan = d / 2 + ovE + 0.22;
	const roofKey = 'wood';
	// Cohesive dyed planking with rare storm-repair patches; not a four-color
	// checkerboard. This also reads much more naturally at distant LOD.
	const roofColors = [ paint.roof, lin( 0x2c4850 ), lin( 0x435e63 ), lin( 0x715442 ) ];
	const roofAt = ( distance, baseHalf ) => yE + 0.14 + ( baseHalf - distance ) * pitch + 0.17 * Math.sin( Math.PI * ( 1 - Math.min( 1, distance / ( baseHalf + 0.01 ) ) ) );
	const roofPiece = ( p0, p1, p2, p3, tint, seed = 0 ) => {

		B.slab( roofKey, [ p0, p1, p2, p3 ], 0.082, {
			up: UP, uDir: p3.clone().sub( p0 ).normalize(), tint,
			data: WOOD( rand.next(), 0.96, 0, 0.45 + seed * 0.08 ),
		} );

	};

	if ( roofType === 'gable' || roofType === 'gableFront' ) {

		const acrossX = roofType === 'gable';
		const A = acrossX ? xSpan : zSpan;
		const D = acrossX ? zSpan : xSpan;
		const half = acrossX ? d / 2 : w / 2;
		const p = ( along, y, sloping ) => acrossX ? V( along, y, sloping ) : V( sloping, y, along );
		for ( const side of [ - 1, 1 ] ) for ( let row = 0; row < 4; row ++ ) {

			const ds = D * row / 4, de = D * ( row + 1 ) / 4;
			const y0 = roofAt( ds, half ) + 0.18, y1 = roofAt( de, half ) + 0.15;
			const n = Math.max( 3, Math.ceil( 2 * A / 1.25 ) );
			for ( let i = 0; i < n; i ++ ) {

				const a0 = - A + 2 * A * i / n - 0.014;
				const a1 = - A + 2 * A * ( i + 1 ) / n + 0.014;
				const stagger = ( row % 2 ? 0.045 : - 0.025 ) * ( i % 3 - 1 );
				const repair = rand.next();
				const tint = repair < 0.13 ? roofColors[ 2 + ( ( i + variant ) % 2 ) ] :
					( repair < 0.48 ? roofColors[ 1 ] : roofColors[ 0 ] );
				roofPiece( p( a0, y0, side * ds ), p( a1, y0, side * ds ),
					p( a1 + stagger, y1, side * de ), p( a0 + stagger, y1, side * de ), tint, row );

			}

		}
		// Long asymmetrical timber crest, shaped like the upturned spine of a boat.
		for ( let i = 0; i < 7; i ++ ) {

			const a = - A + 2 * A * i / 7, b = - A + 2 * A * ( i + 1 ) / 7;
			const hump = 0.10 * Math.sin( i / 6 * Math.PI );
			B.beam( 'wood', [ ...p( a, roofAt( 0, half ) + 0.32 + hump, 0 ).toArray() ],
				[ ...p( b, roofAt( 0, half ) + 0.32 + hump + 0.04, 0 ).toArray() ],
				0.19, 0.24, darkWood( variant % 2 ? BROWN : paint.edging ) );

		}
		// Structural rake boards and eave drips: the roof is held by timber at
		// its edges instead of stopping as a ragged loose pile of shingles.
		for ( const side of [ - 1, 1 ] ) {

			for ( const along of [ - A + 0.08, A - 0.08 ] ) B.beam( 'wood',
				p( along, roofAt( 0, half ) + 0.22, 0 ).toArray(),
				p( along, roofAt( D, half ) + 0.17, side * D ).toArray(),
				0.105, 0.17, darkWood( paint.edging, 0.65 ) );
			B.beam( 'wood', p( - A, roofAt( D, half ) + 0.10, side * D ).toArray(),
				p( A, roofAt( D, half ) + 0.10, side * D ).toArray(),
				0.105, 0.19, darkWood() );

		}

	} else {

		// A high patchwork four-sided captain's roof, with narrower ridge.
		const eX = w / 2 + ovE + 0.12;
		const eZ = d / 2 + ovE + 0.12;
		const rX = Math.max( 0.38, ( w - d ) / 2 );
		const ye = roofAt( eZ, d / 2 ) + 0.22, yr = roofAt( 0, d / 2 ) + 0.27;
		for ( const side of [ - 1, 1 ] ) {

			roofPiece( V( - eX, ye, side * eZ ), V( eX, ye, side * eZ ),
				V( rX, yr, 0 ), V( - rX, yr, 0 ), roofColors[ ( variant + ( side > 0 ? 0 : 1 ) ) % 4 ] );
			roofPiece( V( side * eX, ye, - eZ ), V( side * eX, ye, eZ ),
				V( side * rX, yr, 0 ), V( side * rX, yr, 0.005 ), roofColors[ ( variant + 2 ) % 4 ] );
		}
		B.beam( 'wood', [ - rX, yr + 0.08, 0 ], [ rX, yr + 0.11, 0 ], 0.2, 0.26, darkWood() );

	}
	// Real intermediate ring beams mark the second storey; they also support
	// the interior loft rather than being an unexplained painted band.
	if ( ( s.stories || 1 ) > 1 ) {

		const mid = floorY + H / 2 - 0.035;
		for ( const side of [ - 1, 1 ] ) {

			B.beam( 'wood', [ side * ( w / 2 + 0.105 ), mid, - d / 2 - 0.09 ],
				[ side * ( w / 2 + 0.105 ), mid, d / 2 + 0.09 ], 0.11, 0.20, darkWood( paint.edging ) );
			B.beam( 'wood', [ - w / 2 - 0.11, mid, side * ( d / 2 + 0.09 ) ],
				[ w / 2 + 0.11, mid, side * ( d / 2 + 0.09 ) ], 0.11, 0.20, darkWood( paint.edging ) );

		}

	}

	// Save nautical bunting for selected landmarks. Covering every house with
	// five random cloth pennants was the major visual-clutter problem in V8.
	if ( variant % 5 === 0 ) {
		const bannerY = floorY + Math.min( H - 0.18, s.porch ? 2.75 : 2.62 );
		const bannerZ = d / 2 + ( s.porch ? s.porch.depth - 0.12 : 0.29 );
		for ( let i = 0; i < 3; i ++ ) {

			const span = Math.min( w - 0.5, 3.6 );
			const px = - span / 2 + ( i + 0.5 ) * span / 3;
			const top = bannerY - ( i % 2 ? 0.08 : 0 );
			B.slab( 'fabric', [ V( px - 0.32, top, bannerZ ), V( px + 0.32, top, bannerZ ),
				V( px + 0.22, top - 0.24 - 0.04 * ( i % 2 ), bannerZ + 0.035 ) ], 0.014,
				{ tint: SAILS[ ( variant + i ) % SAILS.length ], data: [ rand.next(), 0.45, 0.4, 0 ] } );

		}
		B.beam( 'rope', [ - 1.86, bannerY + 0.02, bannerZ ], [ 1.86, bannerY + 0.015, bannerZ ], 0.017, 0.017, rope() );
	}

	// A salvaged ship's spar in front of each main porch: thick visible rope
	// wraps, iron hardware, carved overhang brackets, and high-end finials.
	if ( s.porch ) {

		const depth = s.porch.depth;
		const halfP = Math.min( w, s.porch.width || w ) / 2;
		const cen = s.porch.offset || 0;
		for ( const side of [ - 1, 1 ] ) {

			const px = cen + side * ( halfP - 0.05 );
			const pz = d / 2 + depth - 0.14;
			B.rod( 'wood', [ px, floorY + 0.01, pz ], [ px + side * 0.08, floorY + 2.67, pz - 0.03 ], 0.15, 0.12,
				{ segs: 8, ...darkWood() } );
			for ( const yy of [ floorY + 0.46, floorY + 2.37 ] ) for ( let k = 0; k < 3; k ++ ) {

				B.torus( 'rope', px, yy + k * 0.032, pz, 0.16, 0.023,
					{ radial: 4, tubular: 10, ...rope() } );

			}
			B.beam( 'wood', [ px, floorY + 2.20, pz ], [ px - side * 0.87, floorY + 2.78, d / 2 + 0.32 ], 0.12, 0.19, darkWood() );

		}
		B.beam( 'wood', [ cen - halfP - 0.15, floorY + 2.72, d / 2 + depth - 0.14 ],
			[ cen + halfP + 0.13, floorY + 2.76, d / 2 + depth - 0.14 ], 0.20, 0.26, darkWood() );

	}

	// Individual roof silhouettes for landmark buildings: an attached aft
	// lookout, painted wind-vane and projecting ship's mast (above the roof).
	if ( variant % 4 === 2 || variant === 0 || variant === 11 ) {

		const anchorX = ( variant % 2 ? - 1 : 1 ) * w * 0.21;
		const anchorZ = - d * 0.15;
		const slopingHalf = roofType === 'gableFront' ? w / 2 : d / 2;
		const slopePosition = roofType === 'gableFront' ? Math.abs( anchorX ) : Math.abs( anchorZ );
		const platform = yE + ( slopingHalf - slopePosition ) * pitch + 0.43;
		for ( const ax of [ - 0.48, 0.48 ] ) for ( const az of [ - 0.43, 0.43 ] ) {

			B.beam( 'wood', [ anchorX + ax, platform - 0.76, anchorZ + az ],
				[ anchorX + ax * 1.04, platform + 1.75, anchorZ + az * 1.05 ], 0.12, 0.18, darkWood() );

		}
		for ( const side of [ - 1, 1 ] ) {

			B.beam( 'wood', [ anchorX + side * 0.5, platform + 1.18, anchorZ + 0.48 ],
				[ anchorX + side * 0.5, platform + 1.75, anchorZ - 0.42 ], 0.10, 0.15, painted() );

		}
		B.box( 'wood', anchorX, platform + 0.82, anchorZ, 1.40, 0.13, 1.35, darkWood() );
		const baseY = platform + 1.92;
		B.slab( 'fabric', [ V( anchorX - 0.94, baseY - 0.35, anchorZ + 0.78 ), V( anchorX + 0.95, baseY - 0.36, anchorZ + 0.78 ),
			V( anchorX + 0.68, baseY + 0.38, anchorZ ), V( anchorX - 0.63, baseY + 0.39, anchorZ ) ], 0.075,
			{ tint: paint.sail, data: [ rand.next(), 0.48, 0.1, 0 ] } );
		B.rod( 'wood', [ anchorX, baseY - 0.65, anchorZ ], [ anchorX, baseY + 2.00, anchorZ ],
			0.049, 0.036, { segs: 7, ...darkWood() } );
		B.slab( 'fabric', [ V( anchorX, baseY + 1.75, anchorZ ), V( anchorX + 0.93, baseY + 1.49, anchorZ ),
			V( anchorX, baseY + 1.23, anchorZ ) ], 0.018,
			{ tint: SAILS[ variant % SAILS.length ], data: [ rand.next(), 0.67, 0.4, 0 ] } );

	}

	// Painted house crest at the high front wall: wooden roundels and brass
	// portholes make a maritime identity without any copied emblem or branding.
	if ( roofType !== 'gable' && ! s.fewWindows ) {

		B.cyl( 'wood', 0, yE + 0.44, d / 2 + 0.16, 0.37, 0.39, 0.085,
			{ segs: 12, rx: Math.PI / 2, ...darkWood() } );
		B.torus( 'hard', 0, yE + 0.44, d / 2 + 0.23, 0.28, 0.045,
			{ radial: 5, tubular: 16, rx: Math.PI / 2, tint: BRASS, data: HARD( rand.next(), 0.5, 0.78, 0.4 ) } );

	}

}
