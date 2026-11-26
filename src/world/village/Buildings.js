import { Color, Matrix4, Vector3 } from '../../engine/index.js';
import { slabPart, quad01Part, gridPart } from './GeoBuilder.js';
import {
	WOOD, HARD, C, lin, wallLantern, lantern, buoyString, waterTank, woodpile, rowboat, oar, flagPole,
	bucket, fish, iceBed, bananaLeaf, lobster, fishTwine, sHook, Rand,
} from '../Props.js';
import { mulberry32 } from '../../util/Noise.js';
import { buildHeroCottageExterior, buildHeroCottageInterior, heroWindowReveal } from './HeroCottage.js';
import { buildPirateOutpostHouse } from './PirateOutpostStyle.js';

// Parametric tropical fishing-village buildings: cottages, two-storey houses and stilt huts,
// plus a boathouse and a market stall. All geometry goes into a GeoBuilder in the building's
// local frame (x across the facade, +z = front, y = world height).

const UP = new Vector3( 0, 1, 0 );
const V3 = ( x, y, z ) => new Vector3( x, y, z );
const _v = new Vector3();
const _h = new Vector3();
const WARM = new Color( 1.0, 0.68, 0.38 );

function frameFns( terrain, x, z, yaw ) {

	const cy = Math.cos( yaw ), sy = Math.sin( yaw );
	const toW = ( lx, lz ) => ( { x: x + lx * cy + lz * sy, z: z - lx * sy + lz * cy } );
	const gAt = ( lx, lz ) => {

		const p = toW( lx, lz );
		return terrain.heightAt( p.x, p.z );

	};

	return { toW, gAt };

}

function linspace( a, b, n ) {

	const out = [];
	if ( n <= 1 ) return [ ( a + b ) / 2 ];
	for ( let i = 0; i < n; i ++ ) out.push( a + ( b - a ) * i / ( n - 1 ) );
	return out;

}

// Wall apertures are actual holes in the wall mesh, not dark glass pasted over
// a solid facade. Kept independent of the house builder for geometry testing.
export function fillWallAroundApertures( B, {
	width, floorY, height, z, thickness, openings, tint, data,
} ) {

	const lo = - width / 2, hi = width / 2;
	const clamp = ( x, a, b ) => Math.max( a, Math.min( b, x ) );
	const cuts = [ lo, hi ];
	for ( const o of openings ) {

		cuts.push( clamp( o.x - o.w / 2, lo, hi ), clamp( o.x + o.w / 2, lo, hi ) );

	}
	const xs = [ ...new Set( cuts.map( x => + x.toFixed( 5 ) ) ) ].sort( ( a, b ) => a - b );
	let panels = 0;
	for ( let i = 0; i < xs.length - 1; i ++ ) {

		const xl = xs[ i ], xr = xs[ i + 1 ], xc = ( xl + xr ) / 2;
		if ( xr - xl < 0.005 ) continue;
		const ys = [ floorY, floorY + height ];
		for ( const o of openings ) if ( xc > o.x - o.w / 2 && xc < o.x + o.w / 2 ) {

			ys.push( clamp( o.y, floorY, floorY + height ), clamp( o.y + o.h, floorY, floorY + height ) );

		}
		ys.sort( ( a, b ) => a - b );
		for ( let j = 0; j < ys.length - 1; j ++ ) {

			const yl = ys[ j ], yr = ys[ j + 1 ], yc = ( yl + yr ) / 2;
			if ( yr - yl < 0.005 ) continue;
			if ( openings.some( o => xc > o.x - o.w / 2 + 0.0001 && xc < o.x + o.w / 2 - 0.0001 &&
				yc > o.y + 0.0001 && yc < o.y + o.h - 0.0001 ) ) continue;
			B.box( 'wood', xc, yc, z, xr - xl, yr - yl, thickness, { grain: 0, tint, data: data() } );
			panels ++;

		}

	}
	return panels;

}

function windowSlots( L, avoid, spacing = 1.9 ) {

	const n = Math.max( 1, Math.floor( ( L - 0.9 ) / spacing ) );
	const out = [];
	for ( let i = 0; i < n; i ++ ) {

		const px = - L / 2 + L * ( i + 0.5 ) / n;
		if ( avoid.every( q => Math.abs( px - q ) > 1.05 ) ) out.push( px );

	}
	return out;

}

// Keep the front stairs clear while retaining the corner roof supports.
export function porchRoofPosts( left, right, stairX ) {
	const posts = linspace( left + 0.08, right - 0.08, Math.max( 2, Math.ceil( ( right - left ) / 2.6 ) + 1 ) );
	return posts.filter( ( x, i ) => i === 0 || i === posts.length - 1 || Math.abs( x - stairX ) >= 0.75 );
}

// pentagonal gable end in the local XY plane (base width `base` along x), extruded by `t` along z
function gableEndPart( base, hSide, hApex, t ) {

	const pts = [ V3( - base / 2, 0, t / 2 ), V3( base / 2, 0, t / 2 ), V3( base / 2, hSide, t / 2 ), V3( 0, hApex, t / 2 ), V3( - base / 2, hSide, t / 2 ) ];
	return slabPart( pts, t, V3( 1, 0, 0 ), V3( 0, 0, 1 ) );

}

// ---------------------------------------------------------------------------
// shared building blocks (all in the builder's current frame; wall surface at z = 0, facing +z)

function windowUnit( B, rand, cx, sillY, ww, wh, st ) {

	const tw = 0.085, tp = 0.035;
	const trim = st.trim, td = () => [ rand.next(), st.trimPaint, 0, st.weather ];
	B.box( 'wood', cx - ww / 2 - tw / 2, sillY + wh / 2, tp / 2, tw, wh + 0.02, tp, { grain: 1, skip: 44, tint: trim, data: td() } );
	B.box( 'wood', cx + ww / 2 + tw / 2, sillY + wh / 2, tp / 2, tw, wh + 0.02, tp, { grain: 1, skip: 44, tint: trim, data: td() } );
	B.box( 'wood', cx, sillY + wh + 0.06, tp / 2 + 0.004, ww + 2 * tw + 0.05, 0.12, tp + 0.008, { grain: 0, skip: 32, tint: trim, data: td() } );
	B.box( 'wood', cx, sillY + wh + 0.13, 0.04, ww + 2 * tw + 0.1, 0.025, 0.075, { grain: 0, tint: trim, data: td() } );
	B.box( 'wood', cx, sillY - 0.025, 0.045, ww + 2 * tw + 0.08, 0.045, 0.09, { grain: 0, rx: 0.1, tint: trim, data: td() } );

	if ( st.closed ) {

		// closed board shutters instead of glass
		for ( const s of [ - 1, 1 ] ) {

			B.box( 'wood', cx + s * ww / 4, sillY + wh / 2, 0.018, ww / 2 - 0.006, wh, 0.03, { grain: 0, tint: st.accent, data: [ rand.next(), st.paint, st.closedPattern ?? 3, st.weather ] } );

		}

		return null;

	}

	// sash frame, glass, muntins
	B.box( 'wood', cx, sillY + 0.03, 0.012, ww, 0.06, 0.024, { grain: 0, skip: 35, tint: trim, data: td() } );
	B.box( 'wood', cx, sillY + wh - 0.03, 0.012, ww, 0.06, 0.024, { grain: 0, skip: 35, tint: trim, data: td() } );
	B.box( 'wood', cx, sillY + wh / 2, 0.016, ww, 0.045, 0.03, { grain: 0, skip: 35, tint: trim, data: td() } );
	B.box( 'wood', cx - ww / 2 + 0.025, sillY + wh / 2, 0.012, 0.05, wh, 0.024, { grain: 1, skip: 44, tint: trim, data: td() } );
	B.box( 'wood', cx + ww / 2 - 0.025, sillY + wh / 2, 0.012, 0.05, wh, 0.024, { grain: 1, skip: 44, tint: trim, data: td() } );
	B.box( 'wood', cx, sillY + wh / 2, 0.01, 0.022, wh - 0.1, 0.018, { grain: 1, skip: 44, tint: trim, data: td() } );
	const lit = rand.chance( st.litChance ?? 0.6 ) ? 1 : 0;
	// On the sample cottage, the glass is set behind a real cut-through opening.
	// The exterior frame, cavity reveals and inner pane create proper parallax.
	B.part( 'glass', quad01Part( ww - 0.05, wh - 0.05 ), cx, sillY + wh / 2, st.hero ? - 0.105 : 0.004, { tint: st.curtain, data: [ rand.next(), 0, lit, 0 ] } );
	if ( st.hero ) heroWindowReveal( B, rand, cx, sillY, ww, wh, st.trim );

	if ( st.shutters === 'louver' || st.shutters === 'board' ) {

		const sw = ww / 2 + 0.03, sh = wh + 0.05;
		const pat = st.shutters === 'louver' ? 4 : 3;
		for ( const s of [ - 1, 1 ] ) {

			const hx = cx + s * ( ww / 2 + tw );
			const open = rand.range( 0.02, 0.45 );
			B.pushAt( hx, 0, 0.03, - s * open );
			B.box( 'wood', s * ( sw / 2 + 0.01 ), sillY + wh / 2, 0.016, sw, sh, 0.028, { grain: 0, tint: st.accent, data: [ rand.next(), st.paint, pat, st.weather ] } );
			if ( pat === 4 ) {

				for ( const yy of [ sillY + wh / 2 - sh / 2 + 0.035, sillY + wh / 2 + sh / 2 - 0.035 ] ) {

					B.box( 'wood', s * ( sw / 2 + 0.01 ), yy, 0.033, sw, 0.06, 0.012, { grain: 0, skip: 32, tint: st.accent, data: [ rand.next(), st.paint, 0, st.weather ] } );

				}

				for ( const xx of [ 0.03, sw - 0.03 ] ) {

					B.box( 'wood', s * ( xx + 0.01 ), sillY + wh / 2, 0.033, 0.055, sh - 0.12, 0.012, { grain: 1, skip: 44, tint: st.accent, data: [ rand.next(), st.paint, 0, st.weather ] } );

				}

			}

			B.pop();

		}

	} else if ( st.shutters === 'bahama' ) {

		const bw = ww + 2 * tw + 0.08, bh = wh + 0.12;
		const hy = sillY + wh + 0.14;
		const ang = rand.range( 0.45, 0.75 );
		B.pushAt( cx, hy, 0.05, 0, - ang );
		B.box( 'wood', 0, - bh / 2, 0.015, bw, bh, 0.03, { grain: 0, tint: st.accent, data: [ rand.next(), st.paint, 4, st.weather ] } );
		B.box( 'wood', 0, - bh + 0.03, 0.035, bw, 0.06, 0.015, { grain: 0, tint: st.accent, data: [ rand.next(), st.paint, 0, st.weather ] } );
		B.pop();
		// prop sticks
		const tipY = hy - Math.cos( ang ) * bh, tipZ = 0.05 + Math.sin( ang ) * bh;
		for ( const s of [ - 1, 1 ] ) {

			B.rod( 'wood', [ cx + s * ( bw / 2 - 0.08 ), sillY - 0.02, 0.07 ], [ cx + s * ( bw / 2 - 0.08 ), tipY + 0.02, tipZ - 0.02 ], 0.012, 0.012, { segs: 4, data: WOOD( rand.next(), 0.8 ) } );

		}

	}

	return lit ? { x: cx, y: sillY + wh / 2 } : null;

}

function doorUnit( B, rand, cx, floorY, st, openable = false ) {

	const dw = 0.92, dh = 2.08, tw = 0.09;
	const trim = st.trim, td = () => [ rand.next(), st.trimPaint, 0, st.weather ];
	// The mobile door leaf is a separate mesh (Village._buildHomeDoors). Do not
	// bake a second closed leaf across the real opening.
	if ( ! openable ) B.box( 'wood', cx, floorY + dh / 2, 0.012, dw, dh, 0.045, { grain: 1, tint: st.accent, data: [ rand.next(), st.paint, st.doorPattern ?? 3, st.weather ] } );
	B.box( 'wood', cx - dw / 2 - tw / 2, floorY + dh / 2 + 0.02, 0.02, tw, dh + 0.04, 0.04, { grain: 1, tint: trim, data: td() } );
	B.box( 'wood', cx + dw / 2 + tw / 2, floorY + dh / 2 + 0.02, 0.02, tw, dh + 0.04, 0.04, { grain: 1, tint: trim, data: td() } );
	B.box( 'wood', cx, floorY + dh + 0.1, 0.024, dw + 2 * tw + 0.06, 0.14, 0.048, { grain: 0, tint: trim, data: td() } );
	B.box( 'wood', cx, floorY + dh + 0.18, 0.045, dw + 2 * tw + 0.12, 0.025, 0.09, { grain: 0, tint: trim, data: td() } );
	B.box( 'wood', cx, floorY + 0.015, 0.05, dw + 0.12, 0.03, 0.1, { grain: 0, data: WOOD( rand.next(), 0.7 ) } );
	if ( st.doorGlass && ! openable ) {

		B.box( 'wood', cx, floorY + 1.55, 0.04, 0.56, 0.5, 0.012, { grain: 0, tint: trim, data: td() } );
		B.part( 'glass', quad01Part( 0.46, 0.4 ), cx, floorY + 1.55, 0.047, { tint: st.curtain, data: [ rand.next(), 0, rand.chance( 0.5 ) ? 1 : 0, 0 ] } );
		B.box( 'wood', cx, floorY + 1.55, 0.049, 0.02, 0.4, 0.006, { grain: 1, tint: trim, data: td() } );

	}

	if ( ! openable ) B.lathe( 'hard', cx + dw / 2 - 0.1, floorY + 0.98, 0.035, [ [ 0, 0 ], [ 0.012, 0 ], [ 0.012, 0.03 ], [ 0.028, 0.045 ], [ 0.0, 0.065 ] ], { segs: 8, rx: Math.PI / 2, tint: C.brass, data: HARD( rand.next(), 0.1, 0.9, 0.35 ) } );

}

// Interior furniture is procedural and merges into the six existing village
// batches. A furnished room therefore costs no additional per-house draw call.
function furnishHome( ctx, fr, s, floorY, storyH, st ) {

	const { B, rand, lights } = ctx;
	const { w, d } = s;
	const wood = () => WOOD( rand.next(), 0.86 );
	const warm = lin( 0xc9a980 );
	const linen = lin( 0xf2e7d4 );
	const cover = s.wall || lin( 0x8cc2e0 );
	B.box( 'wood', 0, floorY - 0.09, 0, w - 0.2, 0.18, d - 0.2, { grain: 2, tint: warm, data: wood() } );
	fr.addBoxL( 0, floorY - 0.09, 0, w / 2 - 0.1, 0.09, d / 2 - 0.1, { walkable: true, solid: false, tag: 'homeFloor' } );

	// Skirting boards and a simple ceiling for the two-storey cottages.
	for ( const side of [ - 1, 1 ] ) {

		B.box( 'wood', 0, floorY + 0.12, side * ( d / 2 - 0.15 ), w - 0.3, 0.24, 0.06, { tint: st.trim, data: wood() } );
		B.box( 'wood', side * ( w / 2 - 0.15 ), floorY + 0.12, 0, 0.06, 0.24, d - 0.3, { tint: st.trim, data: wood() } );

	}
	// Upper-floor structure is built separately with a *real stairwell opening*.
	// The previous solid ceiling left the second storey completely inaccessible.

	// The bed sits against the rear-left wall, leaving the central aisle clear.
	const bx = - w / 2 + 1.04, bz = - d / 2 + 1.18;
	B.box( 'wood', bx, floorY + 0.3, bz, 1.26, 0.18, 2.0, { tint: warm, data: wood() } );
	B.box( 'wood', bx, floorY + 0.45, bz, 1.15, 0.15, 1.83, { tint: linen, data: wood() } );
	B.box( 'wood', bx, floorY + 0.54, bz + 0.32, 1.17, 0.045, 1.0, { tint: cover, data: wood() } );
	B.box( 'wood', bx, floorY + 0.73, bz - 0.98, 1.36, 0.62, 0.12, { tint: warm, data: wood() } );
	B.box( 'wood', bx, floorY + 0.56, bz - 0.5, 0.9, 0.07, 0.36, { tint: linen, data: wood() } );
	for ( const xx of [ bx - 0.51, bx + 0.51 ] ) for ( const zz of [ bz - 0.8, bz + 0.8 ] ) B.box( 'wood', xx, floorY + 0.13, zz, 0.08, 0.26, 0.09, { data: wood() } );
	fr.addBoxL( bx, floorY + 0.42, bz, 0.63, 0.42, 1.0, { tag: 'bed' } );

	// Writing table, small shelf and a bedside lamp in the same static batch.
	// The right wall is reserved for the staircase in two-storey houses.
	const tx = ( s.stories || 1 ) > 1 ? - w / 2 + 1.03 : w / 2 - 1.03;
	const tz = ( s.stories || 1 ) > 1 ? d / 2 - 0.78 : - d / 2 + 0.83;
	B.box( 'wood', tx, floorY + 0.72, tz, 1.23, 0.09, 0.7, { tint: warm, data: wood() } );
	for ( const dx of [ - 0.48, 0.48 ] ) for ( const dz of [ - 0.23, 0.23 ] ) B.box( 'wood', tx + dx, floorY + 0.34, tz + dz, 0.085, 0.68, 0.08, { data: wood() } );
	B.box( 'wood', tx, floorY + 0.92, tz - 0.16, 0.52, 0.25, 0.06, { tint: st.accent, data: wood() } );
	B.box( 'wood', tx - 0.32, floorY + 0.8, tz + 0.12, 0.18, 0.11, 0.18, { tint: st.trim, data: wood() } );
	B.box( 'wood', tx - 0.32, floorY + 1.06, tz + 0.12, 0.28, 0.3, 0.28, { tint: lin( 0xffd393 ), data: wood() } );
	fr.addBoxL( tx, floorY + 0.42, tz, 0.61, 0.42, 0.35, { tag: 'homeDesk' } );
	const shelfX = ( s.stories || 1 ) > 1 ? - w / 2 + 0.16 : w / 2 - 0.16;
	B.box( 'wood', shelfX, floorY + 1.26, - 0.25, 0.2, 1.45, 1.1, { tint: warm, data: wood() } );
	for ( const y of [ 0.8, 1.4, 1.9 ] ) B.box( 'wood', shelfX, floorY + y, - 0.25, 0.4, 0.065, 1.1, { tint: st.trim, data: wood() } );
	B.box( 'wood', 0, floorY + 0.012, 0.33, 1.25, 0.018, 0.8, { tint: lin( 0x8a929a ), data: wood() } );
	const lampPos = fr.worldPt( tx - 0.32, floorY + 1.12, tz + 0.12 );
	lights.push( { position: new Vector3( lampPos.x, lampPos.y, lampPos.z ), color: new Color( 1, 0.78, 0.52 ), intensity: 2.3, kind: 'homeLamp' } );

	return fr.worldPt( bx, floorY + 0.52, bz );

}

// V10: continuous starboard staircase with a real L-turn at the TOP. The V9
// staircase ran nearly into the rear wall and joined the mezzanine through a
// narrow strip, making the final step look and feel like a dead end. Keep at
// least 1.2 m before that wall, build a broad return landing, and interrupt
// the left handrail where the player must turn into the upper room.
export function buildPirateLoft( ctx, fr, s, floorY, storyH, st ) {

	if ( ( s.stories || 1 ) < 2 ) return null;
	const { B, rand } = ctx;
	const { w, d } = s;
	const upperY = floorY + storyH;
	const stepCount = Math.ceil( storyH / 0.185 );
	const rise = storyH / stepCount;
	const stairX = w / 2 - 0.91;
	const stairW = 1.08;
	// The entrance is on the +Z facade. Reserve a full adult-sized turning bay
	// between that wall/door and the stair foot: V10 left only 45 cm, so the
	// first tread appeared to grow straight out of the masonry.
	const zFront = d / 2 - 1.05;
	const zBack = - d / 2 + 1.20;
	const stepDepth = ( zFront - zBack ) / stepCount;
	const wood = ( tint = st.trim, paint = 0.5 ) => ( { tint, data: WOOD( rand.next(), paint, 0, 0.55 ) } );
	const dark = lin( 0x4a332e );
	const gold = lin( 0xb18b56 );

	// Floor boards end at the *left* rim of the stairwell. No invisible flat slab
	// is allowed over the staircase (the V8 bug).
	const wellLeft = stairX - stairW / 2 - 0.12;
	const floorLeft = - w / 2 + 0.15;
	const floorRight = wellLeft;
	const nBoards = Math.ceil( d / 0.25 );
	for ( let i = 0; i < nBoards; i ++ ) {

		const z = - d / 2 + ( i + 0.5 ) * d / nBoards;
		B.box( 'wood', ( floorLeft + floorRight ) / 2, upperY - 0.085, z,
			floorRight - floorLeft, 0.13, d / nBoards - 0.018,
			wood( i % 7 === 0 ? gold : dark, i % 7 === 0 ? 0.7 : 0.35 ) );

	}
	fr.addBoxL( ( floorLeft + floorRight ) / 2, upperY - 0.10, 0,
		( floorRight - floorLeft ) / 2, 0.10, d / 2 - 0.13,
		{ walkable: true, solid: false, tag: 'homeUpperFloor' } );
	// Stringers carry the tread load into the foundations below. Each tread is
	// connected to this pair, not a collection of floating wooden rectangles.
	for ( const side of [ - 1, 1 ] ) {

		const sx = stairX + side * ( stairW / 2 + 0.04 );
		B.beam( 'wood', [ sx, floorY + 0.04, zFront + 0.12 ],
			[ sx, upperY - 0.09, zBack - 0.14 ], 0.12, 0.20, wood( dark ) );
		// The inner handrail ends BEFORE the return, rather than visually
		// barricading the left turn onto the upstairs decking.
		const railEndZ = side < 0 ? zBack + 0.55 : zBack - 0.13;
		const railEndY = side < 0 ? upperY + 0.59 : upperY + 0.88;
		B.beam( 'wood', [ sx, floorY + 0.91, zFront + 0.10 ],
			[ sx, railEndY, railEndZ ], 0.065, 0.085, wood( gold ) );
		for ( let i = 1; i < stepCount - ( side < 0 ? 3 : 0 ); i += 3 ) {

			const z = zFront - ( i + 0.5 ) * stepDepth;
			B.beam( 'wood', [ sx, floorY + i * rise + 0.05, z ],
				[ sx, floorY + i * rise + 0.90, z ], 0.047, 0.065, wood( dark ) );

		}

	}
	for ( let i = 0; i < stepCount; i ++ ) {

		const z = zFront - ( i + 0.5 ) * stepDepth;
		const top = floorY + ( i + 1 ) * rise;
		B.box( 'wood', stairX, top - 0.04, z, stairW, 0.08, stepDepth + 0.025,
			wood( i % 5 === 0 ? gold : dark, 0.68 ) );
		// Do not make treads horizontally solid: the player can step up naturally.
		fr.addBoxL( stairX, top - 0.045, z, stairW / 2, 0.045,
			stepDepth / 2 + 0.015, { walkable: true, solid: false, tag: 'homeStairTread' } );

	}
	// Genuine 90-degree RETURN LANDING. The wide back platform is completely
	// visible and level with the top tread; a player can step onto it, continue
	// toward the rear, then walk left into the main mezzanine. The old tiny
	// 0.74 m-deep bridge forced the player into the back wall.
	const landX0 = wellLeft - 0.92, landX1 = w / 2 - 0.18;
	const landingRear = - d / 2 + 0.20;
	const landingFront = zBack + 0.23;
	const landingDepth = landingFront - landingRear;
	const landZ = ( landingFront + landingRear ) / 2;
	const nLandingBoards = Math.ceil( landingDepth / 0.22 );
	for ( let k = 0; k < nLandingBoards; k ++ ) {

		const zz = landingRear + ( k + 0.5 ) * landingDepth / nLandingBoards;
		B.box( 'wood', ( landX0 + landX1 ) / 2, upperY - 0.065, zz,
			landX1 - landX0, 0.12, landingDepth / nLandingBoards - 0.012,
			wood( k % 4 === 0 ? gold : dark, 0.55 ) );

	}
	fr.addBoxL( ( landX0 + landX1 ) / 2, upperY - 0.075, landZ,
		( landX1 - landX0 ) / 2, 0.075, landingDepth / 2,
		{ walkable: true, solid: false, tag: 'homeUpperLanding' } );

	// Guard the exposed mezzanine edge, leaving the aft landing open. Balusters
	// have matching solid colliders to stop accidental falls into the stairwell.
	const railX = wellLeft - 0.06;
	const railZ0 = landingFront + 0.20, railZ1 = d / 2 - 0.23;
	for ( let i = 0; i <= Math.ceil( ( railZ1 - railZ0 ) / 0.58 ); i ++ ) {

		const z = railZ0 + ( railZ1 - railZ0 ) * i / Math.ceil( ( railZ1 - railZ0 ) / 0.58 );
		B.rod( 'wood', [ railX, upperY + 0.02, z ], [ railX, upperY + 1.03, z ],
			0.04, 0.035, wood( dark ) );

	}
	for ( const y of [ upperY + 0.13, upperY + 0.99 ] ) B.beam( 'wood',
		[ railX, y, railZ0 ], [ railX, y, railZ1 ], 0.062, 0.083, wood( gold, 0.73 ) );
	fr.addBoxL( railX, upperY + 0.54, ( railZ0 + railZ1 ) / 2,
		0.06, 0.54, ( railZ1 - railZ0 ) / 2, { tag: 'homeLoftRail' } );

	// An actual furnished upper room: chart table, sea chest, wall lantern and
	// low storage crates, all away from the opening and playable floor area.
	const deskX = - w / 2 + 1.05;
	const deskZ = - d / 2 + 0.81;
	B.box( 'wood', deskX, upperY + 0.63, deskZ, 1.24, 0.12, 0.67, wood( dark ) );
	for ( const dx of [ - 0.49, 0.49 ] ) for ( const dz of [ - 0.21, 0.21 ] )
		B.box( 'wood', deskX + dx, upperY + 0.32, deskZ + dz, 0.09, 0.62, 0.09, wood( dark ) );
	B.box( 'wood', deskX, upperY + 0.71, deskZ, 0.85, 0.013, 0.45,
		wood( lin( 0xdabf83 ), 0.88 ) );
	B.box( 'wood', - w / 2 + 0.56, upperY + 0.29, d / 2 - 0.82,
		0.89, 0.58, 0.57, wood( dark ) );
	fr.addBoxL( deskX, upperY + 0.4, deskZ, 0.64, 0.4, 0.37,
		{ tag: 'upperChartTable' } );
	return { upperY, stairX, stairW, zFront, zBack, stepCount, rise, wellLeft,
		landingRear, landingFront, landZ, landX0, landX1, railZ0 };

}

// Straight stair out along +z from (cx, topY, zs) down to the terrain. Registers walkable colliders.
function stairRun( ctx, fr, cx, zs, topY, width, st ) {

	const { B, colliders, rand } = ctx;
	const tread = 0.28, maxRise = 0.2;
	let g = fr.gAt( cx, zs + 0.8 );
	let n = Math.max( 1, Math.ceil( ( topY - g ) / maxRise ) );
	g = fr.gAt( cx, zs + n * tread );
	n = Math.max( 1, Math.ceil( ( topY - g ) / maxRise ) );
	g = Math.min( g, fr.gAt( cx, zs + n * tread ) );
	const rh = ( topY - g ) / n;
	for ( let k = 1; k < n; k ++ ) {

		const top = topY - k * rh;
		const zc = zs + ( k - 0.5 ) * tread;
		B.box( 'wood', cx, top - 0.02, zc, width, 0.04, tread + 0.02, { grain: 0, tint: st.stepTint || [ 1, 1, 1 ], data: WOOD( rand.next(), 0.75, st.stepPaint || 0, 0 ) } );
		const gb = Math.min( fr.gAt( cx, zc ), top - 0.1 );
		fr.addBoxL( cx, ( top + gb - 0.4 ) / 2, zc, width / 2, ( top - gb + 0.4 ) / 2, tread / 2 + 0.005, { walkable: true, solid: true, tag: 'stairs' } );

	}

	const run = n * tread;
	for ( const s of [ - 1, 1 ] ) {

		const sx = cx + s * ( width / 2 + 0.025 );
		B.beam( 'wood', [ sx, topY - 0.1, zs - 0.02 ], [ sx, g - 0.02, zs + run + 0.05 ], 0.05, 0.24, { tint: st.trim, data: WOOD( rand.next(), 0.75, st.trimPaint * 0.8, 0 ) } );
		if ( n >= 5 ) {

			// handrail for taller stairs
			B.box( 'wood', sx, g + 0.5, zs + run - 0.1, 0.07, 1.0 + 0.3, 0.07, { grain: 1, tint: st.trim, data: WOOD( rand.next(), 0.75, st.trimPaint, 0 ) } );
			B.beam( 'wood', [ sx, topY + 0.9, zs + 0.05 ], [ sx, g + 0.95, zs + run - 0.1 ], 0.06, 0.05, { tint: st.trim, data: WOOD( rand.next(), 0.75, st.trimPaint, 0 ) } );

		}

		fr.checks.push( fr.worldPt( sx, g - 0.02, zs + run ) );

	}

	return { g, run, n };

}

// ---------------------------------------------------------------------------
// House / cottage / stilt hut

// V8: an actual replacement building, not the old bungalow plus a pirate shell.
// The footprint, door, bed, steps and wall colliders are owned once by this
// builder. The silhouette/roof belongs exclusively to PirateOutpostStyle.
export function buildIntegratedPirateHouse( ctx, s ) {

	const { B, terrain, colliders, rand, lights, checks } = ctx;
	const { x, z, yaw, w, d } = s;
	const { toW, gAt } = frameFns( terrain, x, z, yaw );
	const fr = {
		toW, gAt, checks,
		worldPt: ( lx, y, lz ) => {

			const p = toW( lx, lz );
			return { x: p.x, y, z: p.z };

		},
		addBoxL: ( lx, ly, lz, hx, hy, hz, opts ) => {

			const p = toW( lx, lz );
			return colliders.addBox( _v.set( p.x, ly, p.z ), _h.set( hx, hy, hz ), yaw, opts );

		},
	};
	const stories = s.stories || 1;
	const storyH = s.storyH || ( stories > 1 ? 2.75 : 2.95 );
	const H = stories * storyH;
	const doorX = s.doorX ?? 0;
	const porch = s.porch;
	const pd = porch?.depth ?? 0;
	const pw = porch ? Math.min( w, porch.width || w ) : 1.72;
	const pcx = porch?.offset ?? doorX;
	let gMin = Infinity, gMax = - Infinity;
	for ( let i = 0; i <= 3; i ++ ) for ( let j = 0; j <= 4; j ++ ) {

		const g = gAt( - w / 2 + w * i / 3, - d / 2 + ( d + pd ) * j / 4 );
		gMin = Math.min( gMin, g );
		gMax = Math.max( gMax, g );

	}
	const floorY = s.floorY ?? gMax + ( s.clearance ?? 0.55 );
	const yE = floorY + H;
	const t = 0.15;
	const st = {
		trim: s.trim, accent: s.accent, curtain: s.curtain || lin( 0xe9d9b8 ),
		paint: s.paint ?? 0.85, trimPaint: 0.92, weather: s.weather ?? 0.55,
		shutters: s.shutters || 'board', litChance: 0.72, hero: true,
		stepTint: s.trim, stepPaint: 0.3,
	};
	const timber = ( tint = s.trim, paint = 0.84 ) => ( { tint, data: WOOD( rand.next(), paint, 0, 0.62 ) } );
	const seaWood = lin( 0x372d30 );
	const mast = lin( 0x614331 );
	const ropeTint = lin( 0xb79a63 );
	const wallData = () => [ rand.next(), st.paint, s.siding ?? 2, st.weather ];
	const doorHalf = 0.56, doorwayH = 2.24;
	let approach = null;
	B.pushAt( x, 0, z, yaw );

	// Raised shipyard foundations are visible below the open walkways. Exactly
	// one foundation is emitted; the old stone skirt / stilt array is gone.
	const foundation = s.foundation || 'posts';
	if ( foundation === 'stone' ) {

		const bot = gMin - 0.28;
		const h = Math.max( 0.22, floorY - 0.20 - bot );
		const base = lin( 0x8d8d7b );
		for ( const side of [ - 1, 1 ] ) {

			B.box( 'stone', 0, bot + h / 2, side * ( d / 2 - 0.11 ), w + 0.15, h, 0.29,
				{ tint: base, data: [ rand.next(), 2, 0, 0.3 ] } );
			B.box( 'stone', side * ( w / 2 - 0.11 ), bot + h / 2, 0, 0.29, h, d - 0.2,
				{ tint: base, data: [ rand.next(), 2, 0, 0.3 ] } );

		}

	} else {

		for ( const lx of [ - w / 2 + 0.18, 0, w / 2 - 0.18 ] ) for ( const lz of [ - d / 2 + 0.18, d / 2 - 0.18 ] ) {

			const ground = gAt( lx, lz ) - ( foundation === 'stilts' ? 0.95 : 0.27 );
			B.rod( 'wood', [ lx, ground, lz ], [ lx + 0.045, floorY - 0.08, lz ], 0.16, 0.12,
				{ segs: 7, ...timber( mast, 0.35 ) } );
			const p = toW( lx, lz );
			colliders.addCylinder( p.x, p.z, 0.18, ground, floorY, { tag: 'stilt' } );
			checks.push( fr.worldPt( lx, ground, lz ) );

		}

	}
	// Full-height single outer walls with actual apertures on every elevation.
	// Old windows were often merely painted over an unbroken wall.
	const faces = [
		{ L: w, x: 0, z: d / 2, ry: 0 },
		{ L: w, x: 0, z: - d / 2, ry: Math.PI },
		{ L: d - 2 * t, x: w / 2, z: 0, ry: Math.PI / 2 },
		{ L: d - 2 * t, x: - w / 2, z: 0, ry: - Math.PI / 2 },
	];
	for ( let fi = 0; fi < faces.length; fi ++ ) {

		const face = faces[ fi ];
		const isFront = fi === 0;
		const windows = windowSlots( face.L, isFront ? [ doorX ] : [], fi === 1 ? 2.5 : 2.45 );
		const openings = [];
		for ( let story = 0; story < stories; story ++ ) {

			const ys = floorY + story * storyH + 0.96;
			for ( const px of windows ) openings.push( { x: px, y: ys, w: 0.78, h: 1.08 } );

		}
		if ( isFront ) openings.push( { x: doorX, y: floorY, w: doorHalf * 2, h: doorwayH } );
		B.pushAt( face.x, 0, face.z, face.ry );
		fillWallAroundApertures( B, { width: face.L, floorY, height: H, z: - t / 2,
			thickness: t, openings, tint: s.wall, data: wallData } );
		for ( let story = 0; story < stories; story ++ ) for ( const px of windows ) {

			windowUnit( B, rand, px, floorY + story * storyH + 0.96, 0.78, 1.08,
				{ ...st, closed: false, shutters: story ? 'board' : st.shutters } );

		}
		if ( isFront ) {

			doorUnit( B, rand, doorX, floorY, st, true );
			const glow = wallLantern( B, doorX + 0.83, floorY + 1.95, 0.07, rand.next() );
			lights.push( { position: glow, color: WARM.clone(), intensity: 3.3, kind: 'lantern' } );

		}
		B.pop();

	}
	// Close the roof's gable ends with *one* timber infill, otherwise the
	// interior is visibly open above the single wall shell at both ends.
	const roofSlope = Math.tan( s.pitch ?? 0.69 );
	const gableTint = s.wall;
	const gableData = () => [ rand.next(), st.paint, s.siding ?? 2, st.weather ];
	if ( s.roof === 'gable' ) {

		for ( const side of [ - 1, 1 ] ) B.part( 'wood',
			gableEndPart( d, 0.12, 0.14 + d / 2 * roofSlope, t ),
			side * ( w / 2 - t / 2 ), yE, 0,
			{ ry: Math.PI / 2, tint: gableTint, data: gableData() } );

	} else if ( s.roof === 'gableFront' ) {

		for ( const side of [ - 1, 1 ] ) B.part( 'wood',
			gableEndPart( w, 0.12, 0.14 + w / 2 * roofSlope, t ),
			0, yE, side * ( d / 2 - t / 2 ),
			{ ry: side > 0 ? 0 : Math.PI, tint: gableTint, data: gableData() } );

	}
	// Timber strakes, corner knees and an uneven colored shingle roof are built
	// once. This is the final architectural body rather than a decoration pass.
	buildPirateOutpostHouse( { B, rand, s, floorY, H, w, d, doorX } );

	// Mooring-deck porch: no conventional bungalow canopy, balusters or duplicate
	// outer columns. Instead, use heavy cargo planks, hull rails, spars and canvas.
	const deckZ0 = d / 2;
	const deckZ1 = d / 2 + ( pd || 1.1 );
	const deckY = floorY - 0.055;
	const left = pcx - pw / 2, right = pcx + pw / 2;
	const boards = Math.max( 5, Math.ceil( ( deckZ1 - deckZ0 ) / 0.24 ) );
	for ( let i = 0; i < boards; i ++ ) {

		const zz = deckZ0 + ( i + 0.5 ) * ( deckZ1 - deckZ0 ) / boards;
		B.box( 'wood', pcx, deckY - 0.03, zz, pw + 0.04, 0.075, ( deckZ1 - deckZ0 ) / boards - 0.015,
			{ grain: 0, ...timber( i % 7 === 0 ? s.pirateStyle.edging : mast, i % 7 === 0 ? 0.79 : 0.29 ) } );

	}
	for ( const side of [ - 1, 1 ] ) {

		const xx = side < 0 ? left + 0.11 : right - 0.11;
		const gg = Math.min( gAt( xx, deckZ1 - 0.08 ), deckY - 0.3 );
		B.rod( 'wood', [ xx, gg - 0.3, deckZ1 - 0.09 ],
			[ xx + side * 0.03, deckY + 1.18, deckZ1 - 0.09 ], 0.14, 0.12,
			{ segs: 8, ...timber( seaWood, 0.24 ) } );
		// Guard the sides without blocking the central entrance or the stairs.
		for ( const yy of [ deckY + 0.25, deckY + 0.94 ] ) B.beam( 'wood',
			[ xx, yy, deckZ0 + 0.12 ], [ xx, yy + 0.03, deckZ1 - 0.09 ],
			0.06, 0.13, timber( s.pirateStyle.edging, 0.8 ) );
		fr.addBoxL( xx, deckY + 0.57, ( deckZ0 + deckZ1 ) / 2, 0.07, 0.57,
			( deckZ1 - deckZ0 ) / 2, { tag: 'porchRail' } );
		// Spaced diagonal braces stop the side rail from looking like two floating
		// horizontal sticks. They are tied to the same lower and upper timbers.
		for ( let k = 0; k < 3; k ++ ) {

			const z0 = deckZ0 + 0.18 + k * ( deckZ1 - deckZ0 - 0.36 ) / 3;
			const z1 = deckZ0 + 0.18 + ( k + 1 ) * ( deckZ1 - deckZ0 - 0.36 ) / 3;
			B.beam( 'wood', [ xx, deckY + 0.24, z0 ],
				[ xx, deckY + 0.91, z1 ], 0.043, 0.058,
				timber( k === 1 ? s.pirateStyle.edging : seaWood, 0.61 ) );

		}

	}
	// The sea-facing front rail has a deliberately open 1.4 m stair portal.
	// Each segment is supported at both ends, with a matching collision rail.
	for ( const [ xa, xb ] of [ [ left + 0.08, doorX - 0.74 ], [ doorX + 0.74, right - 0.08 ] ] ) {

		if ( xb - xa < 0.22 ) continue;
		for ( const yy of [ deckY + 0.30, deckY + 0.94 ] ) B.beam( 'wood',
			[ xa, yy, deckZ1 - 0.07 ], [ xb, yy, deckZ1 - 0.07 ], 0.062, 0.082,
			timber( s.pirateStyle.edging, 0.77 ) );
		for ( let i = 0; i <= Math.ceil( ( xb - xa ) / 0.63 ); i ++ ) {

			const px = xa + i * ( xb - xa ) / Math.ceil( ( xb - xa ) / 0.63 );
			B.rod( 'wood', [ px, deckY + 0.18, deckZ1 - 0.07 ],
				[ px, deckY + 1.0, deckZ1 - 0.07 ], 0.042, 0.034, timber( seaWood, 0.54 ) );

		}
		fr.addBoxL( ( xa + xb ) / 2, deckY + 0.55, deckZ1 - 0.07,
			( xb - xa ) / 2, 0.55, 0.06, { tag: 'porchRail' } );

	}
	// A sunken rigging beam and angled sail create a readable pirate silhouette.
	if ( porch ) {

		const yA = floorY + Math.min( storyH - 0.12, 2.72 );
		const zA = deckZ0 + 0.08, zB = deckZ1 - 0.16;
		B.beam( 'wood', [ left + 0.12, yA, zA ], [ right - 0.12, yA + 0.04, zA ],
			0.13, 0.17, timber( seaWood, 0.25 ) );
		B.slab( 'fabric', [ V3( left + 0.02, yA - 0.14, zA ),
			V3( right - 0.01, yA - 0.09, zA ), V3( right - 0.19, yA - 0.59, zB ),
			V3( left + 0.14, yA - 0.56, zB ) ], 0.035,
			{ tint: s.pirateStyle.sail, data: [ rand.next(), 0.75, 0.22, 0 ] } );
		B.beam( 'rope', [ left + 0.12, yA, zA ], [ left + 0.12, yA - 0.5, zB ],
			0.014, 0.014, { tint: ropeTint, data: [ rand.next(), 0.8, 0, 0 ] } );

	}
	const groundPorch = Math.min( gMin, gAt( doorX, deckZ1 + 0.5 ) );
	fr.addBoxL( pcx, ( deckY + groundPorch - 0.4 ) / 2,
		( deckZ0 + deckZ1 ) / 2, pw / 2, ( deckY - groundPorch + 0.4 ) / 2,
		( deckZ1 - deckZ0 ) / 2, { walkable: true, solid: true, tag: 'porch' } );
	const stairs = stairRun( ctx, fr, doorX, deckZ1, deckY, 1.2, st );
	approach = fr.worldPt( doorX, stairs.g, deckZ1 + stairs.run + 0.5 );
	B.pop();

	// The original home gameplay remains independent of the retired bungalow
	// meshes. Single rooms, one functional door, one bed, and no duplicate collider.
	const bodyBot = Math.min( gMin - 0.3, floorY - 0.25 );
	const wallCy = ( bodyBot + yE ) / 2, wallHy = ( yE - bodyBot ) / 2;
	const leftW = w / 2 + doorX - doorHalf, rightW = w / 2 - doorX - doorHalf;
	fr.addBoxL( ( - w / 2 + doorX - doorHalf ) / 2, wallCy, d / 2 - t / 2,
		leftW / 2, wallHy, t / 2, { tag: 'houseWall' } );
	fr.addBoxL( ( doorX + doorHalf + w / 2 ) / 2, wallCy, d / 2 - t / 2,
		rightW / 2, wallHy, t / 2, { tag: 'houseWall' } );
	fr.addBoxL( doorX, ( floorY + doorwayH + yE ) / 2, d / 2 - t / 2,
		doorHalf, ( yE - floorY - doorwayH ) / 2, t / 2, { tag: 'houseLintel' } );
	fr.addBoxL( 0, wallCy, - d / 2 + t / 2, w / 2, wallHy, t / 2, { tag: 'houseWall' } );
	for ( const sx of [ - 1, 1 ] ) fr.addBoxL( sx * ( w / 2 - t / 2 ), wallCy, 0,
		t / 2, wallHy, d / 2, { tag: 'houseWall' } );
	B.pushAt( x, 0, z, yaw );
	const bed = furnishHome( ctx, fr, s, floorY, storyH, st );
	const loft = buildPirateLoft( ctx, fr, s, floorY, storyH, st );
	B.pop();
	const door = fr.addBoxL( doorX, floorY + 1.04, d / 2, 0.46, 1.04,
		0.045, { tag: 'homeDoor' } );
	const doorPt = fr.worldPt( doorX, floorY, d / 2 );
	return {
		floorY, roofTop: yE + 0.4 + ( ( s.roof === 'gableFront' ? w : d ) / 2 ) * Math.tan( s.pitch ?? 0.7 ),
		homeApproach: approach, bed, loft,
		door: { ...doorPt, yaw, tint: st.accent, trim: st.trim, door, name: s.name, floorY },
		footprint: { x, z, r: Math.hypot( w + 0.8, d + 2 * pd ) / 2 + 0.7, kind: 'building' },
	};

}

export function buildHouse( ctx, s ) {

	if ( s.pirateStyle ) return buildIntegratedPirateHouse( ctx, s );

	const { B, terrain, colliders, rand, lights, checks } = ctx;
	const { x, z, yaw, w, d } = s;
	const { toW, gAt } = frameFns( terrain, x, z, yaw );
	const fr = {
		toW, gAt, checks,
		worldPt: ( lx, y, lz ) => {

			const p = toW( lx, lz );
			return { x: p.x, y, z: p.z };

		},
		addBoxL: ( lx, ly, lz, hx, hy, hz, opts ) => {

			const p = toW( lx, lz );
			return colliders.addBox( _v.set( p.x, ly, p.z ), _h.set( hx, hy, hz ), yaw, opts );

		},
	};

	const stories = s.stories || 1;
	const storyH = s.storyH || ( stories > 1 ? 2.75 : 2.95 );
	const H = stories * storyH;
	const doorX = s.doorX ?? 0;
	const t = 0.14;
	const hero = !! s.heroCottage;
	const winW = s.winW ?? 0.86, winH = s.winH ?? 1.2;
	const heroWindows = hero ? [
		windowSlots( w, [ doorX ] ), windowSlots( w, [], 2.3 ),
		windowSlots( d, [], 2.2 ), windowSlots( d, [], 2.2 ),
	] : null;
	const porch = s.porch || null;
	const pd = porch ? porch.depth : 0;
	const pw = porch ? Math.min( w, porch.width || w ) : 0;
	const pcx = porch ? ( porch.offset || 0 ) : 0;
	let homeApproach = null;

	const annexD = s.annex ? ( s.annex.d ?? 2.2 ) : 0;
	let gMin = Infinity, gMax = - Infinity;
	for ( let i = 0; i <= 4; i ++ ) for ( let j = 0; j <= 6; j ++ ) {

		const g = gAt( ( i / 4 - 0.5 ) * w, - d / 2 - annexD + j / 6 * ( d + pd + annexD ) );
		gMin = Math.min( gMin, g );
		gMax = Math.max( gMax, g );

	}

	const floorY = s.floorY ?? ( gMax + ( s.clearance ?? 0.55 ) );
	const yE = floorY + H;

	const st = {
		trim: s.trim, accent: s.accent, curtain: s.curtain || lin( 0xd8c8a8 ),
		paint: s.paint ?? 0.7, trimPaint: Math.min( 1, ( s.paint ?? 0.7 ) + 0.16 ), weather: s.weather ?? 0.6,
		shutters: s.shutters || 'louver', doorGlass: !! s.doorGlass, litChance: s.litChance ?? 0.6,
		stepTint: s.porchPaint || null, stepPaint: s.porchPaint ? 0.5 : 0,
		hero,
	};
	const wallData = () => [ rand.next(), st.paint, s.siding ?? 1, st.weather ];
	const trimData = () => [ rand.next(), st.trimPaint, 0, st.weather ];
	const gableSiding = ( s.siding ?? 1 ) === 1 ? 2 : 1;

	B.pushAt( x, 0, z, yaw );

	// ------------------------------------------------------------- foundation
	const rimH = 0.24;
	const fnd = s.foundation || 'posts';
	if ( fnd === 'stone' ) {

		const bot = gMin - 0.35, top = floorY - rimH + 0.03;
		const hh = top - bot, sT = 0.32;
		const tint = s.plaster || lin( 0xe6dfcf );
		const sd = () => [ rand.next(), s.stoneStyle ?? 1, 0, 0 ];
		B.box( 'stone', 0, bot + hh / 2, d / 2 - sT / 2 + 0.03, w + 0.06, hh, sT, { grain: 0, tint, data: sd() } );
		B.box( 'stone', 0, bot + hh / 2, - d / 2 + sT / 2 - 0.03, w + 0.06, hh, sT, { grain: 0, tint, data: sd() } );
		B.box( 'stone', w / 2 - sT / 2 + 0.03, bot + hh / 2, 0, sT, hh, d - 2 * sT + 0.06, { grain: 2, tint, data: sd() } );
		B.box( 'stone', - w / 2 + sT / 2 - 0.03, bot + hh / 2, 0, sT, hh, d - 2 * sT + 0.06, { grain: 2, tint, data: sd() } );
		for ( const [ cx, cz ] of [ [ - w / 2, - d / 2 ], [ w / 2, - d / 2 ], [ w / 2, d / 2 ], [ - w / 2, d / 2 ], [ 0, d / 2 ], [ 0, - d / 2 ] ] ) checks.push( fr.worldPt( cx, bot, cz ) );

	} else {

		const stilts = fnd === 'stilts';
		const nx = Math.max( 2, Math.ceil( w / 2.1 ) + 1 ), nz = Math.max( 2, Math.ceil( d / 2.1 ) + 1 );
		const xs = linspace( - w / 2 + 0.14, w / 2 - 0.14, nx ), zs = linspace( - d / 2 + 0.14, d / 2 - 0.14, nz );
		const pts = [];
		for ( let i = 0; i < nx; i ++ ) for ( let j = 0; j < nz; j ++ ) {

			const edge = i === 0 || j === 0 || i === nx - 1 || j === nz - 1;
			if ( ! edge && ! stilts && ( i + j ) % 2 ) continue;
			pts.push( [ xs[ i ], zs[ j ], edge ] );

		}

		for ( const [ lx, lz, edge ] of pts ) {

			const g = gAt( lx, lz );
			const top = floorY - rimH + 0.02;
			if ( stilts ) {

				const bottom = g - 0.9;
				B.cyl( 'wood', lx, bottom, lz, 0.1, 0.12, top - bottom, { segs: 8, rx: rand.range( - 0.015, 0.015 ), rz: rand.range( - 0.015, 0.015 ), tint: [ 0.95, 0.92, 0.9 ], data: WOOD( rand.next(), rand.range( 0.75, 1 ) ) } );
				const p = toW( lx, lz );
				colliders.addCylinder( p.x, p.z, 0.14, bottom, top, { tag: 'stilt' } );
				checks.push( { x: p.x, y: bottom, z: p.z } );

			} else if ( edge || ( s.clearance ?? 0.55 ) > 0.3 ) {

				const bottom = g - 0.3;
				B.box( 'wood', lx, ( bottom + top ) / 2, lz, 0.16, top - bottom, 0.16, { grain: 1, data: WOOD( rand.next(), 0.85 ) } );
				B.box( 'stone', lx, g - 0.06, lz, 0.34, 0.26, 0.34, { grain: 0, tint: lin( 0xcfc8b8 ), data: [ rand.next(), 0, 0, 0 ] } );
				checks.push( fr.worldPt( lx, g - 0.19, lz ) );

			}

		}

		if ( stilts ) {

			// cross bracing around the perimeter
			const tall = floorY - gMin;
			if ( tall > 1.2 ) {

				const yT = floorY - rimH - 0.15;
				for ( const [ ax, az, bx, bz ] of [
					[ xs[ 0 ], zs[ 0 ], xs[ nx - 1 ], zs[ 0 ] ], [ xs[ 0 ], zs[ nz - 1 ], xs[ nx - 1 ], zs[ nz - 1 ] ],
					[ xs[ 0 ], zs[ 0 ], xs[ 0 ], zs[ nz - 1 ] ], [ xs[ nx - 1 ], zs[ 0 ], xs[ nx - 1 ], zs[ nz - 1 ] ] ] ) {

					const ga = gAt( ax, az ), gb = gAt( bx, bz );
					const yB = Math.max( ga, gb ) + 0.35;
					if ( yT - yB < 0.8 ) continue;
					const nxv = az === bz ? 0 : ( ax < 0 ? - 1 : 1 ), nzv = az === bz ? ( az < 0 ? - 1 : 1 ) : 0;
					const o = 0.13;
					B.beam( 'wood', [ ax + nxv * o, yT, az + nzv * o ], [ bx + nxv * o, yB, bz + nzv * o ], 0.045, 0.16, { data: WOOD( rand.next(), 0.9 ) } );
					B.beam( 'wood', [ ax + nxv * o * 1.4, yB, az + nzv * o * 1.4 ], [ bx + nxv * o * 1.4, yT, bz + nzv * o * 1.4 ], 0.045, 0.16, { data: WOOD( rand.next(), 0.9 ) } );

				}

			}

		}

	}

	// rim band + floor edge
	const rimY = floorY - rimH / 2;
	const rimTint = s.rimRaw ? [ 1, 1, 1 ] : st.trim;
	const rimData = () => [ rand.next(), s.rimRaw ? 0 : st.trimPaint, 0, st.weather ];
	B.box( 'wood', 0, rimY, d / 2 + 0.01, w + 0.08, rimH, 0.06, { grain: 0, tint: rimTint, data: rimData() } );
	B.box( 'wood', 0, rimY, - d / 2 - 0.01, w + 0.08, rimH, 0.06, { grain: 0, tint: rimTint, data: rimData() } );
	B.box( 'wood', w / 2 + 0.01, rimY, 0, 0.06, rimH, d + 0.02, { grain: 2, tint: rimTint, data: rimData() } );
	B.box( 'wood', - w / 2 - 0.01, rimY, 0, 0.06, rimH, d + 0.02, { grain: 2, tint: rimTint, data: rimData() } );

	// ------------------------------------------------------------- walls & trim
	const wy = floorY + H / 2;
	// A real 1.12m x 2.24m doorway, carved into the *geometry* and collision,
	// not an animated slab in front of a permanently sealed wall.
	const doorHalf = 0.56, doorwayH = 2.24;
	const leftW = w / 2 + doorX - doorHalf;
	const rightW = w / 2 - doorX - doorHalf;
	if ( hero ) {

		const walls = [
			{ len: w, x: 0, z: d / 2, yaw: 0 },
			{ len: w, x: 0, z: - d / 2, yaw: Math.PI },
			{ len: d - 2 * t, x: w / 2, z: 0, yaw: Math.PI / 2 },
			{ len: d - 2 * t, x: - w / 2, z: 0, yaw: - Math.PI / 2 },
		];
		for ( let wi = 0; wi < walls.length; wi ++ ) {

			const wl = walls[ wi ];
			const openings = heroWindows[ wi ].map( x => ( { x, y: floorY + 0.88, w: winW - 0.055, h: winH } ) );
			if ( wi === 0 ) openings.push( { x: doorX, y: floorY, w: doorHalf * 2, h: doorwayH } );
			B.pushAt( wl.x, 0, wl.z, wl.yaw );
			fillWallAroundApertures( B, { width: wl.len, floorY, height: H, z: - t / 2, thickness: t,
				openings, tint: s.wall, data: wallData } );
			B.pop();

		}

	} else {

		B.box( 'wood', ( - w / 2 + doorX - doorHalf ) / 2, wy, d / 2 - t / 2, leftW, H, t, { grain: 0, tint: s.wall, data: wallData() } );
		B.box( 'wood', ( doorX + doorHalf + w / 2 ) / 2, wy, d / 2 - t / 2, rightW, H, t, { grain: 0, tint: s.wall, data: wallData() } );
		B.box( 'wood', doorX, floorY + ( H + doorwayH ) / 2, d / 2 - t / 2, doorHalf * 2, H - doorwayH, t, { grain: 0, tint: s.wall, data: wallData() } );
		B.box( 'wood', 0, wy, - d / 2 + t / 2, w, H, t, { grain: 0, tint: s.wall, data: wallData() } );
		B.box( 'wood', w / 2 - t / 2, wy, 0, t, H, d - 2 * t, { grain: 2, tint: s.wall, data: wallData() } );
		B.box( 'wood', - w / 2 + t / 2, wy, 0, t, H, d - 2 * t, { grain: 2, tint: s.wall, data: wallData() } );

	}
	for ( const sx of [ - 1, 1 ] ) for ( const sz of [ - 1, 1 ] ) {

		B.box( 'wood', sx * ( w / 2 - 0.05 ), wy, sz * ( d / 2 - 0.05 ), 0.135, H + 0.01, 0.135, { grain: 1, tint: st.trim, data: trimData() } );

	}

	// frieze under the eaves and belt board between storeys
	const band = ( y, h, proud ) => {

		B.box( 'wood', 0, y, d / 2 + proud / 2, w + 0.02, h, proud, { grain: 0, tint: st.trim, data: trimData() } );
		B.box( 'wood', 0, y, - d / 2 - proud / 2, w + 0.02, h, proud, { grain: 0, tint: st.trim, data: trimData() } );
		B.box( 'wood', w / 2 + proud / 2, y, 0, proud, h, d + 0.02, { grain: 2, tint: st.trim, data: trimData() } );
		B.box( 'wood', - w / 2 - proud / 2, y, 0, proud, h, d + 0.02, { grain: 2, tint: st.trim, data: trimData() } );

	};

	band( yE - 0.1, 0.2, 0.025 );
	if ( stories > 1 ) band( floorY + storyH, 0.16, 0.03 );

	// ------------------------------------------------------------- roof
	const roofType = s.roof || 'gable';
	const isThatch = s.roofMat === 'thatch';
	const a = s.pitch ?? ( isThatch ? 0.68 : 0.44 );
	const ta = Math.tan( a );
	const r0 = 0.12;
	const T = isThatch ? 0.28 : 0.06;
	const ovE = s.ovE ?? ( isThatch ? 0.6 : 0.45 );
	const ovR = s.ovR ?? ( isThatch ? 0.45 : 0.32 );
	const roofKey = isThatch ? 'thatch' : 'roofMetal';
	const roofTint = isThatch ? [ 1, 1, 1 ] : ( s.roofColor || lin( 0xa5452f ) );
	const roofData = () => ( isThatch ? [ rand.next(), s.thatchAge ?? 0.4, 0, 0 ] : [ rand.next(), s.rust ?? 0.4, s.galv ? 1 : 0, 0 ] );
	const roofSlab = ( pts, uDir ) => B.slab( roofKey, pts, T, { uDir: uDir.normalize(), up: UP, tint: roofTint, data: roofData() } );
	const Tv = T / Math.cos( a );
	let roofTop = yE;
	let ridge = null;

	const fascia = ( ax, ay, az, bx, by, bz ) => {

		if ( isThatch ) return;
		B.beam( 'wood', [ ax, ay - 0.1, az ], [ bx, by - 0.1, bz ], 0.032, 0.2, { tint: st.trim, data: trimData() } );

	};

	const rafterTails = ( zWall, zEdge, sign, yWallTop, yEdgeTop, x0, x1 ) => {

		const n = Math.floor( ( x1 - x0 ) / 0.6 );
		for ( let i = 0; i <= n; i ++ ) {

			const px = x0 + ( x1 - x0 ) * i / Math.max( 1, n );
			B.beam( 'wood', [ px, yWallTop - Tv - 0.055, zWall - sign * 0.08 ], [ px, yEdgeTop - Tv - 0.055, zEdge - sign * 0.05 ], 0.05, 0.1, { data: WOOD( rand.next(), 0.7 ) } );

		}

	};

	const gableEnd = ( cx, cz, ry, base ) => {

		const hSide = r0 - 0.03;
		const hApex = r0 + ( base / 2 ) * ta - 0.03;
		B.part( 'wood', gableEndPart( base, hSide, hApex, t ), cx, yE, cz, { ry, tint: s.wall, data: [ rand.next(), st.paint, gableSiding, st.weather ] } );
		return hApex;

	};

	const gableVent = ( cz, dir, yBase, ry ) => {

		// small louvered vent in the gable triangle
		B.pushAt( 0, 0, cz, ry );
		const vy = yBase + 0.45;
		B.box( 'wood', 0, vy, 0.02, 0.5, 0.5, 0.04, { grain: 0, tint: st.trim, data: trimData() } );
		B.box( 'wood', 0, vy, 0.03, 0.38, 0.38, 0.03, { grain: 0, tint: st.accent, data: [ rand.next(), st.paint, 4, st.weather ] } );
		B.pop();

	};

	const ridgeCap = ( p0, p1, across ) => {

		if ( isThatch ) {

			B.rod( 'thatch', [ p0.x, p0.y - 0.06, p0.z ], [ p1.x, p1.y - 0.06, p1.z ], 0.2, 0.2, { segs: 8, tint: [ 0.9, 0.88, 0.85 ], data: [ rand.next(), ( s.thatchAge ?? 0.4 ) + 0.2, 0, 0 ] } );
			return;

		}

		const wc = 0.2, drop = wc * Math.tan( a * 0.85 );
		for ( const sg of [ - 1, 1 ] ) {

			const o = across.clone().multiplyScalar( sg * wc );
			const pts = [ V3( p0.x, p0.y + 0.02, p0.z ), V3( p1.x, p1.y + 0.02, p1.z ), V3( p1.x + o.x, p1.y + 0.02 - drop, p1.z + o.z ), V3( p0.x + o.x, p0.y + 0.02 - drop, p0.z + o.z ) ];
			B.slab( 'roofMetal', pts, 0.01, { up: UP, uDir: o.clone().normalize().negate().setY( 0.3 ), tint: roofTint, data: [ rand.next(), ( s.rust ?? 0.4 ) + 0.2, s.galv ? 1 : 0, 0 ] } );

		}

	};

	const hasPorchEave = porch && stories === 1 && roofType !== 'gableFront';

	if ( roofType === 'gable' ) {

		const X = w / 2 + ovR;
		const yR = yE + r0 + ( d / 2 ) * ta;
		const zf = d / 2 + ovE, yF = yE + r0 - ovE * ta;
		roofSlab( [ V3( - X, yF, zf ), V3( X, yF, zf ), V3( X, yR, 0 ), V3( - X, yR, 0 ) ], V3( 0, yR - yF, - zf ) );
		roofSlab( [ V3( X, yF, - zf ), V3( - X, yF, - zf ), V3( - X, yR, 0 ), V3( X, yR, 0 ) ], V3( 0, yR - yF, zf ) );
		ridgeCap( V3( - X, yR, 0 ), V3( X, yR, 0 ), V3( 0, 0, 1 ) );
		for ( const sx of [ - 1, 1 ] ) {

			gableEnd( sx * ( w / 2 - t / 2 ), 0, Math.PI / 2, d );
			fascia( sx * ( X - 0.016 ), yF, zf, sx * ( X - 0.016 ), yR, 0 );
			fascia( sx * ( X - 0.016 ), yF, - zf, sx * ( X - 0.016 ), yR, 0 );

		}

		fascia( - X, yF, zf - 0.016, X, yF, zf - 0.016 );
		fascia( - X, yF, - zf + 0.016, X, yF, - zf + 0.016 );
		if ( ! isThatch ) {

			rafterTails( d / 2, zf, 1, yE + r0, yF, - w / 2 + 0.1, w / 2 - 0.1 );
			rafterTails( - d / 2, - zf, - 1, yE + r0, yF, - w / 2 + 0.1, w / 2 - 0.1 );

		}

		roofTop = yR + 0.2;
		ridge = { y: yR, axis: 'x', ta, yF, zf };

	} else if ( roofType === 'gableFront' ) {

		const Z = d / 2 + ovR;
		const yR = yE + r0 + ( w / 2 ) * ta;
		const xe = w / 2 + ovE, yF = yE + r0 - ovE * ta;
		roofSlab( [ V3( xe, yF, Z ), V3( xe, yF, - Z ), V3( 0, yR, - Z ), V3( 0, yR, Z ) ], V3( - xe, yR - yF, 0 ) );
		roofSlab( [ V3( - xe, yF, - Z ), V3( - xe, yF, Z ), V3( 0, yR, Z ), V3( 0, yR, - Z ) ], V3( xe, yR - yF, 0 ) );
		ridgeCap( V3( 0, yR, - Z ), V3( 0, yR, Z ), V3( 1, 0, 0 ) );
		for ( const sz of [ - 1, 1 ] ) {

			const hA = gableEnd( 0, sz * ( d / 2 - t / 2 ), sz > 0 ? 0 : Math.PI, w );
			if ( hA > 1.0 && ! s.noVent ) gableVent( sz * ( d / 2 ), sz, yE, sz > 0 ? 0 : Math.PI );
			fascia( xe, yF, sz * ( Z - 0.016 ), 0, yR, sz * ( Z - 0.016 ) );
			fascia( - xe, yF, sz * ( Z - 0.016 ), 0, yR, sz * ( Z - 0.016 ) );

		}

		fascia( xe - 0.016, yF, - Z, xe - 0.016, yF, Z );
		fascia( - xe + 0.016, yF, - Z, - xe + 0.016, yF, Z );
		roofTop = yR + 0.2;
		ridge = { y: yR, axis: 'z', ta, yF, xe };

	} else {

		// hip roof (expects w >= d)
		const ov = ovE;
		const yR = yE + r0 + ( d / 2 ) * ta;
		const ye = yE + r0 - ov * ta;
		const XE = w / 2 + ov, ZE = d / 2 + ov, XR = Math.max( 0, ( w - d ) / 2 );
		if ( XR > 0.02 ) {

			roofSlab( [ V3( - XE, ye, ZE ), V3( XE, ye, ZE ), V3( XR, yR, 0 ), V3( - XR, yR, 0 ) ], V3( 0, yR - ye, - ZE ) );
			roofSlab( [ V3( XE, ye, - ZE ), V3( - XE, ye, - ZE ), V3( - XR, yR, 0 ), V3( XR, yR, 0 ) ], V3( 0, yR - ye, ZE ) );
			ridgeCap( V3( - XR, yR, 0 ), V3( XR, yR, 0 ), V3( 0, 0, 1 ) );

		} else {

			roofSlab( [ V3( - XE, ye, ZE ), V3( XE, ye, ZE ), V3( 0, yR, 0 ) ], V3( 0, yR - ye, - ZE ) );
			roofSlab( [ V3( XE, ye, - ZE ), V3( - XE, ye, - ZE ), V3( 0, yR, 0 ) ], V3( 0, yR - ye, ZE ) );

		}

		roofSlab( [ V3( XE, ye, ZE ), V3( XE, ye, - ZE ), V3( XR, yR, 0 ) ], V3( - XE + XR, yR - ye, 0 ) );
		roofSlab( [ V3( - XE, ye, - ZE ), V3( - XE, ye, ZE ), V3( - XR, yR, 0 ) ], V3( XE - XR, yR - ye, 0 ) );
		// hip rolls
		for ( const sx of [ - 1, 1 ] ) for ( const sz of [ - 1, 1 ] ) {

			const p0 = [ sx * XE, ye + 0.02, sz * ZE ], p1 = [ sx * XR, yR + 0.02, 0 ];
			if ( isThatch ) B.rod( 'thatch', [ p0[ 0 ], p0[ 1 ] - 0.05, p0[ 2 ] ], [ p1[ 0 ], p1[ 1 ] - 0.05, p1[ 2 ] ], 0.14, 0.17, { segs: 6, tint: [ 0.9, 0.88, 0.85 ], data: [ rand.next(), ( s.thatchAge ?? 0.4 ) + 0.2, 0, 0 ] } );
			else B.rod( 'roofMetal', p0, p1, 0.045, 0.045, { segs: 6, tint: roofTint, data: [ rand.next(), ( s.rust ?? 0.4 ) + 0.2, s.galv ? 1 : 0, 0 ] } );

		}

		fascia( - XE, ye, ZE - 0.016, XE, ye, ZE - 0.016 );
		fascia( - XE, ye, - ZE + 0.016, XE, ye, - ZE + 0.016 );
		fascia( XE - 0.016, ye, - ZE, XE - 0.016, ye, ZE );
		fascia( - XE + 0.016, ye, - ZE, - XE + 0.016, ye, ZE );
		if ( ! isThatch ) {

			rafterTails( d / 2, ZE, 1, yE + r0, ye, - w / 2 + 0.1, w / 2 - 0.1 );
			rafterTails( - d / 2, - ZE, - 1, yE + r0, ye, - w / 2 + 0.1, w / 2 - 0.1 );

		}

		roofTop = yR + 0.2;
		ridge = { y: yR, axis: 'x', ta, yF: ye, zf: ZE };

	}

	// thatch eave fringe (ragged strands hanging below the eave edges)
	if ( isThatch ) {

		const fringe = ( ax, az, bx, bz, yTop, outX, outZ ) => {

			const L = Math.hypot( bx - ax, bz - az );
			const n = Math.max( 4, Math.round( L / 0.05 ) );
			const part = gridPart( n, 1, ( i, j ) => {

				const tt = i / n;
				const r = Math.abs( Math.sin( i * 12.9898 + ax * 78.233 + az * 37.719 ) * 43758.5453 ) % 1;
				const hang = 0.04 + 0.16 * r * r * ( i % 2 ? 1 : 0.6 );
				const px = ax + ( bx - ax ) * tt, pz = az + ( bz - az ) * tt;
				const yy = j === 0 ? yTop - T * 0.95 - hang : yTop - T * 0.3;
				const o = j === 0 ? 0.05 : 0.0;
				return { p: [ px + outX * o, yy, pz + outZ * o ], n: [ outX, 0.2, outZ ], uv: [ j === 0 ? - hang : 0.2, tt * L ] };

			} );
			B.add( 'thatch', part, new Matrix4(), [ 0.95, 0.92, 0.88 ], [ rand.next(), ( s.thatchAge ?? 0.4 ) + 0.1, 0, 0 ] );

		};

		if ( roofType === 'gable' ) {

			const X = w / 2 + ovR, zf = d / 2 + ovE, yF = yE + r0 - ovE * ta;
			fringe( - X, zf, X, zf, yF, 0, 1 );
			fringe( X, - zf, - X, - zf, yF, 0, - 1 );

		} else if ( roofType === 'gableFront' ) {

			const Z = d / 2 + ovR, xe = w / 2 + ovE, yF = yE + r0 - ovE * ta;
			fringe( xe, Z, xe, - Z, yF, 1, 0 );
			fringe( - xe, - Z, - xe, Z, yF, - 1, 0 );

		} else {

			const XE = w / 2 + ovE, ZE = d / 2 + ovE, ye = yE + r0 - ovE * ta;
			fringe( - XE, ZE, XE, ZE, ye, 0, 1 );
			fringe( XE, - ZE, - XE, - ZE, ye, 0, - 1 );
			fringe( XE, ZE, XE, - ZE, ye, 1, 0 );
			fringe( - XE, - ZE, - XE, ZE, ye, - 1, 0 );

		}

	}

	// ------------------------------------------------------------- openings
	const litWindows = [];

	const walls = [
		{ L: w, fx: 0, fz: d / 2, ry: 0, front: true },
		{ L: w, fx: 0, fz: - d / 2, ry: Math.PI },
		{ L: d, fx: w / 2, fz: 0, ry: Math.PI / 2 },
		{ L: d, fx: - w / 2, fz: 0, ry: - Math.PI / 2 },
	];
	// keep side-wall windows clear of an external chimney (wall-local x of the chimney center)
	const chimZ = ( s.roof || 'gable' ) === 'gableFront' ? - d * 0.25 : 0;

	for ( let wi = 0; wi < 4; wi ++ ) {

		const wl = walls[ wi ];
		B.pushAt( wl.fx, 0, wl.fz, wl.ry );
		for ( let sIdx = 0; sIdx < stories; sIdx ++ ) {

			const baseY = floorY + sIdx * storyH;
			let xs;
			if ( hero ) xs = heroWindows[ wi ];
			else if ( wl.front ) xs = sIdx === 0 ? windowSlots( wl.L, [ doorX ] ) : windowSlots( wl.L, [] );
			else if ( wi === 1 ) xs = windowSlots( wl.L, [], 2.3 );
			else xs = windowSlots( wl.L, wi === 2 && s.chimney === 1 ? [ - chimZ ] : ( wi === 3 && s.chimney === - 1 ? [ chimZ ] : [] ), 2.2 );
			if ( ! wl.front && s.fewWindows && xs.length > 1 ) xs = [ xs[ Math.floor( rand.next() * xs.length ) ] ];
			for ( const px of xs ) {

				const closed = rand.chance( s.closedChance ?? 0.12 );
				const lit = windowUnit( B, rand, px, baseY + 0.88, winW, winH, { ...st, closed, closedPattern: st.shutters === 'louver' ? 4 : 3 } );
				if ( lit && wl.front ) litWindows.push( B.toWorld( lit.x, lit.y, 0.35 ) );

			}

		}

		if ( wl.front ) {

			doorUnit( B, rand, doorX, floorY, st, true );
			if ( s.lantern !== false ) {

				const lw = wallLantern( B, doorX + 0.78, floorY + 1.95, 0.0, rand.next() );
				lights.push( { position: lw, color: WARM.clone(), intensity: 3.5, kind: 'lantern' } );

			}

		}

		B.pop();

	}
	if ( hero ) buildHeroCottageExterior( { B, rand, fr, floorY, H, w, d, heroWindows, winW, winH,
		porch, st, roofType, roofColor: roofTint, roofPitch: a, porchPitch: s.porchPitch ?? 0.26,
		roofOverside: ovR, roofOverfront: ovE } );

	if ( litWindows.length ) lights.push( { position: litWindows[ 0 ], color: new Color( 1.0, 0.62, 0.32 ), intensity: 1.6, kind: 'window' } );

	// ------------------------------------------------------------- porch or stoop
	const porchPaint = s.porchPaint || null;
	if ( porch ) {

		const porchY = floorY - 0.05;
		const pz0 = d / 2, pz1 = d / 2 + pd;
		const xL = pcx - pw / 2, xR = pcx + pw / 2;
		// planks
		const np = Math.max( 2, Math.floor( pd / 0.145 ) );
		for ( let i = 0; i < np; i ++ ) {

			const zc = pz0 + 0.01 + ( i + 0.5 ) * ( pd - 0.01 ) / np;
			B.box( 'wood', pcx + rand.range( - 0.012, 0.012 ), porchY - 0.02, zc, pw + 0.06, 0.04, 0.13, { grain: 0, ry: rand.range( - 0.004, 0.004 ), tint: porchPaint || [ 1, 1, 1 ], data: WOOD( rand.next(), rand.range( 0.55, 0.9 ), porchPaint ? 0.68 : 0, 0 ) } );

		}

		// rim + support posts
		B.box( 'wood', pcx, porchY - 0.15, pz1 - 0.03, pw + 0.08, 0.22, 0.06, { grain: 0, tint: rimTint, data: rimData() } );
		for ( const sx of [ xL, xR ] ) B.box( 'wood', sx + ( sx < pcx ? 0.03 : - 0.03 ), porchY - 0.15, ( pz0 + pz1 ) / 2, 0.06, 0.22, pd, { grain: 2, tint: rimTint, data: rimData() } );
		for ( const px of linspace( xL + 0.1, xR - 0.1, Math.max( 2, Math.ceil( pw / 2.2 ) + 1 ) ) ) {

			const g = gAt( px, pz1 - 0.12 );
			const top = porchY - 0.26;
			if ( top - g > 0.05 ) {

				B.box( 'wood', px, ( top + g - 0.3 ) / 2, pz1 - 0.12, 0.14, top - g + 0.3, 0.14, { grain: 1, data: WOOD( rand.next(), 0.85 ) } );
				checks.push( fr.worldPt( px, g - 0.3, pz1 - 0.12 ) );

			}

		}

		// roof height
		const pp = s.porchPitch ?? 0.26;
		const Tp = isThatch ? 0.24 : 0.06;
		let yAtt;
		if ( stories > 1 ) yAtt = floorY + storyH - 0.02;
		else if ( ! hasPorchEave ) yAtt = yE - 0.03;
		else {

			const ovF = roofType === 'hip' ? ovE : ovE;
			const eaveEdgeTop = yE + r0 - ovF * ta;
			const fasciaBot = eaveEdgeTop - ( isThatch ? T / Math.cos( a ) + 0.16 : 0.22 );
			yAtt = Math.min( yE - 0.03, fasciaBot - 0.03 + ovF * Math.tan( pp ) );

		}

		const zEnd = pz1 + 0.32;
		const yEnd = yAtt - ( zEnd - pz0 ) * Math.tan( pp );
		const beamZ = pz1 - 0.12;
		const beamTop = yAtt - ( beamZ - pz0 ) * Math.tan( pp ) - Tp / Math.cos( pp ) - 0.005;
		const beamH = 0.18;
		const postTop = beamTop - beamH;
		const roofX0 = xL - 0.22, roofX1 = xR + 0.22;
		const porchKey = isThatch ? 'thatch' : 'roofMetal';
		B.slab( porchKey, [ V3( roofX0, yEnd, zEnd ), V3( roofX1, yEnd, zEnd ), V3( roofX1, yAtt, pz0 ), V3( roofX0, yAtt, pz0 ) ], Tp, {
			up: UP, uDir: V3( 0, yAtt - yEnd, pz0 - zEnd ).normalize(), tint: roofTint, data: roofData(),
		} );
		if ( ! isThatch ) {

			B.box( 'wood', pcx, yEnd - 0.1, zEnd - 0.016, roofX1 - roofX0, 0.18, 0.032, { grain: 0, tint: st.trim, data: trimData() } );
			B.box( 'wood', pcx, yAtt - 0.02, pz0 + 0.03, roofX1 - roofX0, 0.06, 0.05, { grain: 0, tint: st.trim, data: trimData() } );

		} else {

			// ragged thatch edge along the porch roof front
			const n = Math.round( ( roofX1 - roofX0 ) / 0.07 );
			const part = gridPart( n, 1, ( i, j ) => {

				const tt = i / n;
				const r = Math.abs( Math.sin( i * 12.9898 + roofX0 * 78.233 ) * 43758.5453 ) % 1;
				const hang = 0.04 + 0.13 * r * r * ( i % 2 ? 1 : 0.6 );
				const px = roofX0 + ( roofX1 - roofX0 ) * tt;
				const yy = j === 0 ? yEnd - Tp - hang : yEnd - Tp * 0.3;
				return { p: [ px, yy, zEnd + ( j === 0 ? 0.04 : 0 ) ], n: [ 0, 0.2, 1 ], uv: [ j === 0 ? - hang : 0.2, px ] };

			} );
			B.add( 'thatch', part, new Matrix4(), [ 0.95, 0.92, 0.88 ], [ rand.next(), ( s.thatchAge ?? 0.4 ) + 0.1, 0, 0 ] );

		}

		// beam + posts with knee braces
		B.box( 'wood', pcx, beamTop - beamH / 2, beamZ, pw + 0.1, beamH, 0.12, { grain: 0, tint: st.trim, data: trimData() } );
		const stairX = porch.stairX ?? doorX;
		const postXs = porchRoofPosts( xL, xR, stairX );
		for ( const px of postXs ) {

			B.box( 'wood', px, ( porchY + postTop ) / 2, beamZ, 0.12, postTop - porchY, 0.12, { grain: 1, tint: st.trim, data: trimData() } );
			B.box( 'wood', px, porchY + 0.05, beamZ, 0.16, 0.1, 0.16, { grain: 0, tint: st.trim, data: trimData() } );
			B.box( 'wood', px, postTop - 0.03, beamZ, 0.16, 0.06, 0.16, { grain: 0, tint: st.trim, data: trimData() } );
			for ( const sg of [ - 1, 1 ] ) {

				if ( ( px <= xL + 0.1 && sg < 0 ) || ( px >= xR - 0.1 && sg > 0 ) ) continue;
				B.beam( 'wood', [ px + sg * 0.04, postTop - 0.34, beamZ ], [ px + sg * 0.36, postTop - 0.02, beamZ ], 0.05, 0.06, { tint: st.trim, data: trimData() } );

			}

		}

		// railing with a gap for the stairs
		const railStyle = porch.rail || 'balusters';
		const railSeg = ( ax, az, bx, bz ) => {

			const L = Math.hypot( bx - ax, bz - az );
			if ( L < 0.2 ) return;
			B.beam( 'wood', [ ax, porchY + 0.86, az ], [ bx, porchY + 0.86, bz ], 0.1, 0.045, { tint: st.trim, data: trimData() } );
			B.beam( 'wood', [ ax, porchY + 0.13, az ], [ bx, porchY + 0.13, bz ], 0.07, 0.045, { tint: st.trim, data: trimData() } );
			const dx = ( bx - ax ) / L, dz = ( bz - az ) / L;
			if ( railStyle === 'balusters' ) {

				const n = Math.floor( L / 0.12 );
				for ( let i = 1; i < n; i ++ ) {

					const tt = i / n;
					B.box( 'wood', ax + dx * L * tt, porchY + 0.495, az + dz * L * tt, 0.034, 0.71, 0.034, { grain: 1, skip: 12, tint: st.trim, data: trimData() } );

				}

			} else {

				const nb = Math.max( 1, Math.round( L / 1.1 ) );
				for ( let i = 0; i < nb; i ++ ) {

					const t0 = i / nb, t1 = ( i + 1 ) / nb;
					const p0 = [ ax + dx * L * t0, az + dz * L * t0 ], p1 = [ ax + dx * L * t1, az + dz * L * t1 ];
					B.beam( 'wood', [ p0[ 0 ], porchY + 0.16, p0[ 1 ] ], [ p1[ 0 ], porchY + 0.83, p1[ 1 ] ], 0.035, 0.07, { tint: st.trim, data: trimData() } );
					B.beam( 'wood', [ p0[ 0 ], porchY + 0.83, p0[ 1 ] ], [ p1[ 0 ], porchY + 0.16, p1[ 1 ] ], 0.03, 0.07, { tint: st.trim, data: trimData() } );

				}

			}

			fr.addBoxL( ( ax + bx ) / 2, porchY + 0.55, ( az + bz ) / 2, Math.abs( dx ) > 0.5 ? L / 2 : 0.06, 0.55, Math.abs( dx ) > 0.5 ? 0.06 : L / 2, { tag: 'porchRail' } );

		};

		const gapL = stairX - 0.68, gapR = stairX + 0.68;
		if ( s.railNet && gapL - xL > 1.0 ) {

			// a fishing net thrown over the railing to dry
			const nx0 = xL + 0.2, nx1 = gapL - 0.12;
			const L = nx1 - nx0;
			const netPart = gridPart( 10, 8, ( i, j ) => {

				const u = i / 10, v = j / 8;
				const xx = nx0 + u * L;
				const fold = Math.sin( u * 17 + v * 2 ) * 0.035;
				// v: 0 inside bottom -> over the rail -> 1 outside bottom
				const inside = v < 0.35;
				const tt = inside ? ( 0.35 - v ) / 0.35 : ( v - 0.35 ) / 0.65;
				const yy = porchY + 0.9 - tt * ( inside ? 0.35 : 0.78 ) - Math.sin( u * Math.PI ) * 0.06 * tt;
				const zz = beamZ + ( inside ? - 0.05 - tt * 0.05 : 0.06 + tt * 0.1 ) + fold * tt;
				return { p: [ xx, yy, zz ], n: [ 0, 0.3, inside ? - 1 : 1 ], uv: [ u * L, v * 1.2 ] };

			} );
			const ns = rand.next();
			B.add( 'net', netPart, new Matrix4(), s.railNet, ( px, py ) => [ ns, Math.min( 1, Math.max( 0, porchY + 0.9 - py ) ) * 0.5, 0.04, 0 ] );

		}

		railSeg( xL + 0.08, beamZ, gapL, beamZ );
		railSeg( gapR, beamZ, xR - 0.08, beamZ );
		railSeg( xL + 0.08, pz0 + 0.08, xL + 0.08, beamZ );
		railSeg( xR - 0.08, pz0 + 0.08, xR - 0.08, beamZ );
		for ( const gx of [ gapL, gapR ] ) {

			B.box( 'wood', gx, porchY + 0.5, beamZ, 0.1, 1.0, 0.1, { grain: 1, tint: st.trim, data: trimData() } );

		}

		const sr = stairRun( ctx, fr, stairX, pz1, porchY, 1.2, { ...st, trim: st.trim } );
		homeApproach = fr.worldPt( stairX, sr.g, pz1 + sr.run + 0.5 );
		// porch floor collider
		const gP = Math.min( gMin, sr.g );
		fr.addBoxL( pcx, ( porchY + gP - 0.5 ) / 2, ( pz0 + pz1 ) / 2, pw / 2, ( porchY - gP + 0.5 ) / 2, pd / 2, { walkable: true, solid: true, tag: 'porch' } );
		roofTop = Math.max( roofTop, yAtt );

		// porch life: a chair or bench, hanging buoys, potted things
		if ( s.porchBench !== false ) {

			const bx = stairX > pcx ? xL + 1.1 : xR - 1.1;
			benchLow( B, rand, bx, porchY, pz0 + 0.45, st );

		}

	} else {

		// front stoop with steps
		const stoopY = floorY - 0.04;
		const sw = 1.5, sd = 1.0;
		const np = 7;
		for ( let i = 0; i < np; i ++ ) B.box( 'wood', doorX, stoopY - 0.02, d / 2 + 0.02 + ( i + 0.5 ) * sd / np, sw, 0.04, sd / np - 0.012, { grain: 0, data: WOOD( rand.next(), 0.8 ) } );
		const gS = gAt( doorX, d / 2 + sd );
		for ( const sx of [ - 1, 1 ] ) {

			B.box( 'wood', doorX + sx * ( sw / 2 - 0.06 ), ( stoopY + gS - 0.3 ) / 2, d / 2 + sd - 0.06, 0.12, stoopY - gS + 0.3, 0.12, { grain: 1, data: WOOD( rand.next(), 0.85 ) } );
			checks.push( fr.worldPt( doorX + sx * ( sw / 2 - 0.06 ), gS - 0.3, d / 2 + sd - 0.06 ) );

		}

		const sr = stairRun( ctx, fr, doorX, d / 2 + sd, stoopY, 1.1, st );
		homeApproach = fr.worldPt( doorX, sr.g, d / 2 + sd + sr.run + 0.5 );
		fr.addBoxL( doorX, ( stoopY + Math.min( gS, sr.g ) - 0.4 ) / 2, d / 2 + sd / 2, sw / 2, ( stoopY - Math.min( gS, sr.g ) + 0.4 ) / 2, sd / 2, { walkable: true, solid: true, tag: 'stoop' } );
		// small hood over the door
		const hy = floorY + 2.5;
		B.slab( roofKey, [ V3( doorX - 0.85, hy - 0.22, d / 2 + 0.75 ), V3( doorX + 0.85, hy - 0.22, d / 2 + 0.75 ), V3( doorX + 0.85, hy, d / 2 ), V3( doorX - 0.85, hy, d / 2 ) ], isThatch ? 0.14 : 0.04, {
			up: UP, uDir: V3( 0, 0.22, - 0.75 ).normalize(), tint: roofTint, data: roofData(),
		} );
		for ( const sx of [ - 1, 1 ] ) B.beam( 'wood', [ doorX + sx * 0.75, hy - 0.5, d / 2 + 0.02 ], [ doorX + sx * 0.75, hy - 0.2, d / 2 + 0.65 ], 0.05, 0.07, { tint: st.trim, data: trimData() } );

	}

	// ------------------------------------------------------------- extras
	if ( s.stovepipe && ridge ) {

		const px = ridge.axis === 'x' ? w * 0.22 : - w * 0.22, pz = ridge.axis === 'x' ? - d * 0.22 : d * 0.18;
		const surf = ridge.axis === 'x' ? ridge.y - Math.abs( pz ) * ta : ridge.y - Math.abs( px ) * ta;
		const hd = HARD( rand.next(), 0.75, 0.6, 0.55 );
		B.cyl( 'hard', px, surf - 0.3, pz, 0.08, 0.08, ridge.y - surf + 1.0, { segs: 10, capTop: false, tint: lin( 0x3a3632 ), data: hd } );
		B.cyl( 'hard', px, ridge.y + 0.72, pz, 0.02, 0.2, 0.14, { segs: 10, capBot: true, tint: lin( 0x3a3632 ), data: hd } );
		B.cyl( 'hard', px, surf - 0.02, pz, 0.1, 0.2, 0.08, { segs: 10, tint: lin( 0x3a3632 ), data: hd } );

	}

	if ( s.chimney ) {

		const sx = s.chimney;
		const cxl = sx * ( w / 2 + 0.36 ), czl = roofType === 'gableFront' ? - d * 0.25 : 0;
		const g = gAt( cxl, czl );
		const top = roofType === 'gable' ? ( ridge.y + 0.7 ) : ( ridge.y + 0.3 );
		const hh = top - ( g - 0.3 );
		B.box( 'stone', cxl, g - 0.3 + hh / 2, czl, 0.72, hh, 0.82, { grain: 0, tint: lin( 0xd8d0c0 ), data: [ rand.next(), 2, 0, 0 ] } );
		B.box( 'stone', cxl, top + 0.04, czl, 0.84, 0.08, 0.94, { grain: 0, tint: lin( 0xc8c0b0 ), data: [ rand.next(), 0, 0, 0 ] } );
		B.cyl( 'stone', cxl, top + 0.08, czl, 0.1, 0.12, 0.3, { segs: 8, tint: lin( 0xa86a4a ), data: [ rand.next(), 1, 0, 0 ] } );
		checks.push( fr.worldPt( cxl, g - 0.3, czl ) );
		fr.addBoxL( cxl, g + hh / 2 - 0.3, czl, 0.36, hh / 2, 0.41, { tag: 'chimney' } );

	}

	if ( s.antenna && ridge ) {

		const ax = ridge.axis === 'x' ? - w * 0.3 : 0, az = ridge.axis === 'x' ? 0 : - d * 0.3;
		const hd = HARD( rand.next(), 0.5, 0.8, 0.4 );
		B.rod( 'hard', [ ax, ridge.y - 0.1, az ], [ ax, ridge.y + 2.4, az ], 0.025, 0.02, { segs: 6, tint: C.galv, data: hd } );
		for ( const [ hy, len ] of [ [ 2.2, 1.2 ], [ 1.9, 1.0 ], [ 1.6, 0.8 ] ] ) {

			B.rod( 'hard', [ ax, ridge.y + hy, az - len / 2 ], [ ax, ridge.y + hy, az + len / 2 ], 0.008, 0.008, { segs: 4, tint: C.galv, data: hd } );

		}

		B.rod( 'hard', [ ax, ridge.y + 2.25, az ], [ ax + 0.9, ridge.y + 2.25, az ], 0.012, 0.012, { segs: 4, tint: C.galv, data: hd } );

	}

	if ( s.gutter && ! isThatch && ridge && ridge.axis === 'x' ) {

		const zf = ridge.zf + 0.06, yg = ridge.yF - 0.12;
		const X = w / 2 + ovR;
		const hd = HARD( rand.next(), 0.55, 0.8, 0.4 );
		B.rod( 'hard', [ - X + 0.1, yg, - zf ], [ X - 0.1, yg, - zf ], 0.06, 0.06, { segs: 8, capTop: true, tint: C.galv, data: hd } );
		const dx = X - 0.25;
		B.rod( 'hard', [ dx, yg, - zf ], [ dx, gAt( dx, - zf ) + 0.95, - zf ], 0.04, 0.04, { segs: 6, tint: C.galv, data: hd } );
		const bp = toW( dx, - zf - 0.05 );
		ctx.inst.add( 'barrel', bp.x, gAt( dx, - zf - 0.05 ) - 0.02, bp.z, rand.range( 0, 6 ), [ 0.9, 0.85, 0.8 ] );
		colliders.addCylinder( bp.x, bp.z, 0.32, gAt( dx, - zf ) - 0.1, gAt( dx, - zf ) + 0.9, { tag: 'barrel' } );

	}

	// back lean-to annex (kitchen / store room) with its own shed roof
	if ( s.annex ) {

		const an = s.annex;
		const aw = Math.min( w - 0.6, an.w ?? w * 0.62 ), ad = annexD, ax = an.x ?? 0;
		const za0 = - d / 2, za1 = - d / 2 - ad;
		const pa = 0.3, Ta = isThatch ? 0.22 : 0.05;
		let yAtt;
		if ( stories > 1 ) yAtt = floorY + storyH - 0.02;
		else if ( roofType === 'gableFront' ) yAtt = yE - 0.03;
		else {

			const eaveEdgeTop = yE + r0 - ovE * ta;
			const fasciaBot = eaveEdgeTop - ( isThatch ? T / Math.cos( a ) + 0.16 : 0.22 );
			yAtt = Math.min( yE - 0.03, fasciaBot - 0.03 + ovE * Math.tan( pa ) );

		}

		const zEnd = za1 - 0.3;
		const yEnd = yAtt - ( za0 - zEnd ) * Math.tan( pa );
		const cutV = Ta / Math.cos( pa ) + 0.01;
		const yBackTop = yAtt - ( za0 - za1 ) * Math.tan( pa ) - cutV;
		const Ha = yBackTop - floorY;
		const aColor = an.wall || s.wall;
		const aPaint = Math.max( 0.3, st.paint - 0.12 );
		const aData = () => [ rand.next(), aPaint, s.siding ?? 1, Math.min( 1, st.weather + 0.1 ) ];
		B.box( 'wood', ax, floorY + Ha / 2, za1 + t / 2, aw, Ha, t, { grain: 0, tint: aColor, data: aData() } );
		for ( const sx of [ - 1, 1 ] ) {

			const xo = ax + sx * aw / 2;
			const pts = [ V3( xo, floorY, za0 - 0.01 ), V3( xo, floorY, za1 ), V3( xo, yBackTop, za1 ), V3( xo, yAtt - cutV, za0 - 0.01 ) ];
			B.slab( 'wood', pts, t, { up: V3( sx, 0, 0 ), uDir: V3( 0, 0, - sx ), tint: aColor, data: aData() } );
			B.box( 'wood', xo - sx * 0.05, floorY + Ha / 2, za1 + 0.05, 0.13, Ha + 0.01, 0.13, { grain: 1, tint: st.trim, data: trimData() } );
			// back corner posts down to the ground
			const lx = ax + sx * ( aw / 2 - 0.12 ), lz = za1 + 0.12;
			const g = gAt( lx, lz );
			B.box( 'wood', lx, ( g - 0.3 + floorY - rimH ) / 2, lz, 0.15, floorY - rimH - g + 0.3, 0.15, { grain: 1, data: WOOD( rand.next(), 0.85 ) } );
			checks.push( fr.worldPt( lx, g - 0.3, lz ) );
			B.box( 'wood', xo + sx * 0.02, rimY, ( za0 + za1 ) / 2, 0.06, rimH, ad, { grain: 2, tint: rimTint, data: rimData() } );

		}

		B.box( 'wood', ax, rimY, za1 - 0.02, aw + 0.08, rimH, 0.06, { grain: 0, tint: rimTint, data: rimData() } );
		B.box( 'wood', ax, yBackTop - 0.08, za1 - 0.012, aw, 0.16, 0.025, { grain: 0, tint: st.trim, data: trimData() } );
		const rx0 = ax - aw / 2 - 0.22, rx1 = ax + aw / 2 + 0.22;
		B.slab( roofKey, [ V3( rx0, yEnd, zEnd ), V3( rx1, yEnd, zEnd ), V3( rx1, yAtt, za0 ), V3( rx0, yAtt, za0 ) ], Ta, {
			up: UP, uDir: V3( 0, yAtt - yEnd, za0 - zEnd ).normalize(), tint: roofTint, data: roofData(),
		} );
		if ( ! isThatch ) B.box( 'wood', ax, yEnd - 0.09, zEnd + 0.016, rx1 - rx0, 0.16, 0.03, { grain: 0, tint: st.trim, data: trimData() } );
		B.pushAt( ax, 0, za1, Math.PI );
		windowUnit( B, rand, 0, floorY + 1.0, 0.7, 0.85, { ...st, closed: rand.chance( 0.25 ), closedPattern: 3 } );
		B.pop();
		fr.addBoxL( ax, ( gMin - 0.3 + yAtt ) / 2, ( za0 + za1 ) / 2, aw / 2 + 0.05, ( yAtt - gMin + 0.3 ) / 2, ad / 2, { tag: 'house' } );

	}

	if ( s.buoys ) {

		// fishing floats hung on the side wall
		const side = s.buoys;
		B.pushAt( side * ( w / 2 + 0.02 ), 0, 0, side * Math.PI / 2 );
		buoyString( B, [ - d / 2 + 0.5, floorY + 2.3, 0.05 ], [ d / 2 - 0.9, floorY + 2.3, 0.05 ], Math.max( 3, Math.floor( d / 0.8 ) ), rand, 0.3 );
		B.pop();

	}
	if ( s.pirateStyle ) buildPirateOutpostHouse( { B, rand, s, floorY, H, w, d, doorX } );

	B.pop();

	// extras placed in world space
	if ( s.tank ) {

		const tp = toW( s.tank * ( w / 2 + 1.25 ), - d / 4 );
		const g = terrain.heightAt( tp.x, tp.z );
		waterTank( B, tp.x, g, tp.z, rand.next(), rand.chance( 0.6 ) );
		colliders.addBox( _v.set( tp.x, g + 1.5, tp.z ), _h.set( 0.75, 1.5, 0.75 ), 0, { tag: 'tank' } );
		checks.push( { x: tp.x, y: g - 0.2, z: tp.z } );

	}

	if ( s.woodpile ) {

		const lx = - s.woodpile * ( w / 2 + 0.45 ), lz = - d / 4;
		const wp = toW( lx, lz );
		woodpile( B, wp.x, terrain.heightAt( wp.x, wp.z ), wp.z, yaw + Math.PI / 2, rand );
		colliders.addBox( _v.set( wp.x, terrain.heightAt( wp.x, wp.z ) + 0.3, wp.z ), _h.set( 0.3, 0.3, 0.6 ), yaw, { tag: 'woodpile' } );

	}

	// Rooms are traversable. Collide only with the walls and lintel; the opening
	// is blocked by a toggleable door-leaf collider managed by HomeLife.
	const bodyBot = gMin - 0.3;
	const wallTop = roofTop;
	const wallCy = ( bodyBot + wallTop ) / 2, wallHy = ( wallTop - bodyBot ) / 2;
	fr.addBoxL( ( - w / 2 + doorX - doorHalf ) / 2, wallCy, d / 2 - t / 2, leftW / 2, wallHy, t / 2, { tag: 'houseWall' } );
	fr.addBoxL( ( doorX + doorHalf + w / 2 ) / 2, wallCy, d / 2 - t / 2, rightW / 2, wallHy, t / 2, { tag: 'houseWall' } );
	fr.addBoxL( doorX, ( floorY + doorwayH + wallTop ) / 2, d / 2 - t / 2, doorHalf, ( wallTop - floorY - doorwayH ) / 2, t / 2, { tag: 'houseLintel' } );
	fr.addBoxL( 0, wallCy, - d / 2 + t / 2, w / 2, wallHy, t / 2, { tag: 'houseWall' } );
	for ( const sx of [ - 1, 1 ] ) fr.addBoxL( sx * ( w / 2 - t / 2 ), wallCy, 0, t / 2, wallHy, d / 2, { tag: 'houseWall' } );
	B.pushAt( x, 0, z, yaw );
	const bed = furnishHome( ctx, fr, s, floorY, storyH, st );
	if ( hero ) buildHeroCottageInterior( { B, rand, floorY, w, d, st, fr } );
	B.pop();
	const door = fr.addBoxL( doorX, floorY + 1.04, d / 2, 0.46, 1.04, 0.045, { tag: 'homeDoor' } );
	const doorPoint = fr.worldPt( doorX, floorY, d / 2 );

	return {
		floorY, roofTop, homeApproach,
		windowApertures: hero ? heroWindows : null,
		bed,
		door: { ...doorPoint, yaw, tint: st.accent, trim: st.trim, door, name: s.name, floorY },
		footprint: { x, z, r: Math.hypot( w, d + Math.max( pd, annexD ) * 2 ) / 2 + 0.8, kind: 'building' },
	};

}

function benchLow( B, rand, x, y, z, st ) {

	const wd = () => WOOD( rand.next(), 0.8, st.trimPaint * 0.8, 0 );
	for ( let i = 0; i < 2; i ++ ) B.box( 'wood', x, y + 0.43, z - 0.06 + i * 0.13, 1.3, 0.035, 0.11, { grain: 0, tint: st.accent, data: wd() } );
	for ( const sx of [ - 0.55, 0.55 ] ) B.box( 'wood', x + sx, y + 0.21, z, 0.06, 0.42, 0.3, { grain: 1, tint: st.accent, data: wd() } );
	B.box( 'wood', x, y + 0.72, z - 0.17, 1.3, 0.12, 0.03, { grain: 0, rx: - 0.12, tint: st.accent, data: wd() } );
	for ( const sx of [ - 0.55, 0.55 ] ) B.box( 'wood', x + sx, y + 0.6, z - 0.15, 0.05, 0.36, 0.03, { grain: 1, rx: - 0.12, tint: st.accent, data: wd() } );

}

// ---------------------------------------------------------------------------
// Open-fronted boathouse on the beach (local +z = open side toward the sea)

export function buildBoathouse( ctx, s ) {

	const { B, terrain, colliders, rand, lights, checks } = ctx;
	const { x, z, yaw } = s;
	const w = s.w ?? 5.4, d = s.d ?? 7.2;
	const { toW, gAt } = frameFns( terrain, x, z, yaw );
	const addBoxL = ( lx, ly, lz, hx, hy, hz, opts ) => {

		const p = toW( lx, lz );
		colliders.addBox( _v.set( p.x, ly, p.z ), _h.set( hx, hy, hz ), yaw, opts );

	};

	let gMin = Infinity, gMax = - Infinity;
	for ( let i = 0; i <= 4; i ++ ) for ( let j = 0; j <= 4; j ++ ) {

		const g = gAt( ( i / 4 - 0.5 ) * w, ( j / 4 - 0.5 ) * d );
		gMin = Math.min( gMin, g ); gMax = Math.max( gMax, g );

	}

	const base = gMax;
	const yE = base + 2.7;
	const wall = s.wall || lin( 0x9fb9b0 );
	const paint = s.paint ?? 0.55;
	const wdat = ( pat ) => [ rand.next(), paint, pat, 0.8 ];
	B.pushAt( x, 0, z, yaw );

	// posts
	const postXs = [ - w / 2 + 0.09, w / 2 - 0.09 ];
	const postZs = linspace( - d / 2 + 0.09, d / 2 - 0.09, 4 );
	for ( const px of postXs ) for ( const pz of postZs ) {

		const g = gAt( px, pz );
		B.box( 'wood', px, ( g - 0.5 + yE ) / 2, pz, 0.18, yE - g + 0.5, 0.18, { grain: 1, data: WOOD( rand.next(), 0.9 ) } );
		checks.push( { ...toW( px, pz ), y: g - 0.5 } );

	}

	// walls: back + sides (board and batten, faded paint), open front
	const wallBot = gMin - 0.15;
	const hW = yE - wallBot;
	B.box( 'wood', 0, wallBot + hW / 2, - d / 2 + 0.05, w, hW, 0.08, { grain: 0, tint: wall, data: wdat( 2 ) } );
	for ( const sx of [ - 1, 1 ] ) B.box( 'wood', sx * ( w / 2 - 0.05 ), wallBot + hW / 2, 0, 0.08, hW, d - 0.1, { grain: 2, tint: wall, data: wdat( 2 ) } );
	addBoxL( 0, wallBot + hW / 2, - d / 2 + 0.05, w / 2, hW / 2, 0.08, { tag: 'boathouse' } );
	for ( const sx of [ - 1, 1 ] ) addBoxL( sx * ( w / 2 - 0.05 ), wallBot + hW / 2, 0, 0.08, hW / 2, d / 2, { tag: 'boathouse' } );
	// header over the opening
	B.box( 'wood', 0, yE - 0.14, d / 2 - 0.09, w, 0.28, 0.16, { grain: 0, data: WOOD( rand.next(), 0.85 ) } );

	// gable roof, ridge along z (toward the sea)
	const a = 0.5, ta = Math.tan( a ), r0 = 0.1;
	const yR = yE + r0 + ( w / 2 ) * ta;
	const ov = 0.4, Z = d / 2 + 0.45;
	const xe = w / 2 + ov, yF = yE + r0 - ov * ta;
	const rd = () => [ rand.next(), 0.75, 0, 0 ];
	const rt = s.roofColor || lin( 0x6d7f86 );
	B.slab( 'roofMetal', [ V3( xe, yF, Z ), V3( xe, yF, - Z ), V3( 0, yR, - Z ), V3( 0, yR, Z ) ], 0.05, { up: UP, uDir: V3( - xe, yR - yF, 0 ).normalize(), tint: rt, data: rd() } );
	B.slab( 'roofMetal', [ V3( - xe, yF, - Z ), V3( - xe, yF, Z ), V3( 0, yR, Z ), V3( 0, yR, - Z ) ], 0.05, { up: UP, uDir: V3( xe, yR - yF, 0 ).normalize(), tint: rt, data: rd() } );
	// V7 pirate shipwright: broad dyed sail-roof, exaggerated timbers and
	// hanging dock pennants turn the formerly ordinary boathouse into a landmark.
	for ( const sx of [ - 1, 1 ] ) {

		B.slab( 'wood', [ V3( sx * ( xe + 0.10 ), yF + 0.13, Z + 0.13 ),
			V3( sx * ( xe + 0.10 ), yF + 0.13, - Z - 0.13 ), V3( 0, yR + 0.19, - Z - 0.13 ),
			V3( 0, yR + 0.19, Z + 0.13 ) ], 0.085,
			{ up: UP, uDir: V3( - sx, yR - yF, 0 ).normalize(), tint: sx < 0 ? lin( 0x304c58 ) : rt,
				data: WOOD( rand.next(), 0.83, 0, 0.44 ) } );
		B.beam( 'wood', [ sx * ( xe + 0.12 ), yF + 0.08, Z + 0.15 ], [ 0, yR + 0.28, Z + 0.15 ],
			0.14, 0.21, { tint: lin( 0x503529 ), data: WOOD( rand.next(), 0.24 ) } );
		B.beam( 'wood', [ sx * ( xe + 0.08 ), yF + 0.02, - Z - 0.15 ], [ 0, yR + 0.28, - Z - 0.15 ],
			0.13, 0.22, { tint: lin( 0x503529 ), data: WOOD( rand.next(), 0.24 ) } );

	}
	B.beam( 'wood', [ 0, yR + 0.27, - Z - 0.22 ], [ 0, yR + 0.32, Z + 0.40 ],
		0.22, 0.30, { tint: lin( 0xd2a15c ), data: WOOD( rand.next(), 0.68 ) } );
	for ( let i = 0; i < 7; i ++ ) {

		const px = - w / 2 + ( i + 0.5 ) * w / 7;
		B.slab( 'fabric', [ V3( px - 0.3, yE - 0.08, d / 2 + 0.21 ),
			V3( px + 0.3, yE - 0.08, d / 2 + 0.21 ), V3( px, yE - 0.47, d / 2 + 0.26 ) ],
			0.014, { tint: i % 2 ? lin( 0xd6b37c ) : lin( 0x9d4b40 ), data: [ rand.next(), 0.56, 0.2, 0 ] } );

	}
	for ( const sz of [ - 1, 1 ] ) {

		B.part( 'wood', gableEndPart( w, r0 - 0.03, r0 + ( w / 2 ) * ta - 0.03, 0.08 ), 0, yE, sz * ( d / 2 - 0.05 ), { ry: sz > 0 ? 0 : Math.PI, tint: wall, data: wdat( 2 ) } );

	}

	// ridge beam + rafters (visible from inside)
	B.box( 'wood', 0, yR - 0.14, 0, 0.1, 0.18, d + 0.8, { grain: 2, data: WOOD( rand.next(), 0.8 ) } );
	for ( const pz of linspace( - d / 2 + 0.3, d / 2 - 0.3, 5 ) ) {

		for ( const sx of [ - 1, 1 ] ) B.beam( 'wood', [ 0, yR - 0.12, pz ], [ sx * ( w / 2 + ov - 0.05 ), yF - 0.1, pz ], 0.05, 0.12, { data: WOOD( rand.next(), 0.75 ) } );
		B.box( 'wood', 0, yE - 0.05, pz, w - 0.1, 0.1, 0.07, { grain: 0, data: WOOD( rand.next(), 0.8 ) } );

	}

	// inside: a rowboat on a cradle, oars on the wall, nets, workbench, lantern
	const gIn = gAt( 0.3, 0 );
	rowboat( B, 0.35, gIn + 0.28, 0.1, 0, { seed: rand.next(), hull: lin( 0xd9d2bf ), bottom: lin( 0x2f5f7a ), trim: lin( 0x2f5f7a ), length: 4.2 } );
	for ( const pz of [ - 1.1, 1.2 ] ) B.box( 'wood', 0.35, gIn + 0.12, pz, 1.1, 0.24, 0.14, { grain: 0, data: WOOD( rand.next(), 0.9 ) } );
	addBoxL( 0.35, gIn + 0.5, 0.1, 0.8, 0.5, 2.2, { tag: 'boat' } );
	oar( B, [ - w / 2 + 0.12, gAt( - w / 2 + 0.2, - 1.5 ) + 0.4, - 1.6 ], [ - w / 2 + 0.12, gAt( - w / 2 + 0.2, - 1.5 ) + 2.55, - 1.35 ], rand.next(), lin( 0xc23b2e ) );
	oar( B, [ - w / 2 + 0.12, gAt( - w / 2 + 0.2, - 1.0 ) + 0.4, - 0.9 ], [ - w / 2 + 0.12, gAt( - w / 2 + 0.2, - 1.0 ) + 2.55, - 0.7 ], rand.next(), lin( 0xc23b2e ) );
	// workbench along the right wall
	const bx = w / 2 - 0.45;
	const gB = gAt( bx, - 1.5 );
	for ( let i = 0; i < 3; i ++ ) B.box( 'wood', bx - 0.2 + i * 0.2, gB + 0.9, - 1.5, 0.19, 0.05, 2.0, { grain: 2, data: WOOD( rand.next(), 0.7 ) } );
	for ( const pz of [ - 2.4, - 0.6 ] ) for ( const px of [ bx - 0.25, bx + 0.25 ] ) B.box( 'wood', px, gB + 0.43, pz, 0.07, 0.9, 0.07, { grain: 1, data: WOOD( rand.next(), 0.8 ) } );
	bucket( B, bx, gB + 0.925, - 2.1, lin( 0xd8d8d0 ), rand.next() );
	fish( B, bx, gB + 0.925, - 1.2, { species: 'mullet', len: 0.4, ry: 1.9, sag: 0.15, jaw: 0.2, wet: 0.6, cloudy: 0.6, seed: rand.next() } );
	addBoxL( bx, gB + 0.45, - 1.5, 0.35, 0.45, 1.0, { tag: 'bench' } );
	// net hanging on the left wall
	const netPart = gridPart( 10, 8, ( i, j ) => {

		const u = i / 10, v = j / 8;
		const pz = - 0.2 + u * 2.4;
		const sag = Math.sin( u * Math.PI ) * 0.35 * v;
		return { p: [ - w / 2 + 0.16 + Math.sin( u * 12 + v * 3 ) * 0.03, yE - 0.35 - v * 1.6 + sag * 0.3, pz + Math.sin( v * 5 ) * 0.05 ], n: [ 1, 0, 0 ], uv: [ u * 2.4, v * 1.6 ] };

	} );
	B.add( 'net', netPart, new Matrix4(), lin( 0x4f7a6a ), ( px, py ) => [ 0.3, Math.min( 1, Math.max( 0, ( yE - 0.35 - py ) / 1.6 ) ) * 0.4, 0.04, 0 ] );
	const lp = lantern( B, 0, yR - 0.25, 0.8, rand.next() );
	lights.push( { position: B.toWorld( lp[ 0 ], lp[ 1 ], lp[ 2 ] ), color: WARM.clone(), intensity: 3, kind: 'lantern' } );

	// slipway rails down toward the water
	for ( const sx of [ - 0.55, 1.25 ] ) {

		const zA = d / 2 - 0.3, zB = d / 2 + 6.5;
		const gA = gAt( sx, zA ), gBv = gAt( sx, zB );
		B.beam( 'wood', [ sx, gA + 0.04, zA ], [ sx, gBv + 0.02, zB ], 0.14, 0.12, { data: WOOD( rand.next(), 0.95 ) } );
		for ( const pz of linspace( zA + 0.5, zB - 0.3, 5 ) ) {

			const gg = gAt( sx, pz );
			B.box( 'wood', sx + 0.35, gg - 0.02, pz, 1.1, 0.09, 0.16, { grain: 0, data: WOOD( rand.next(), 0.95 ) } );

		}

	}

	B.pop();
	flagPole( B, toW( - w / 2 - 0.6, d / 2 - 0.3 ).x, gAt( - w / 2 - 0.6, d / 2 - 0.3 ), toW( - w / 2 - 0.6, d / 2 - 0.3 ).z, 5.5, lin( 0x2f6fb0 ), rand.next() );
	{

		const p = toW( - w / 2 - 0.6, d / 2 - 0.3 );
		colliders.addCylinder( p.x, p.z, 0.08, gAt( - w / 2 - 0.6, d / 2 - 0.3 ) - 0.3, gAt( - w / 2 - 0.6, d / 2 - 0.3 ) + 5.5, { tag: 'flagpole' } );

	}

	return { footprint: { x, z, r: Math.hypot( w, d ) / 2 + 1, kind: 'building' } };

}

// ---------------------------------------------------------------------------
// Market stall with a thatched roof (local +z = customer side)

export function buildMarketStall( ctx, s ) {

	const { B, terrain, colliders, rand, lights, checks } = ctx;
	const { x, z, yaw } = s;
	const w = 3.4, d = 2.4;
	const { toW, gAt } = frameFns( terrain, x, z, yaw );
	const addBoxL = ( lx, ly, lz, hx, hy, hz, opts ) => {

		const p = toW( lx, lz );
		colliders.addBox( _v.set( p.x, ly, p.z ), _h.set( hx, hy, hz ), yaw, opts );

	};

	B.pushAt( x, 0, z, yaw );
	const g0 = gAt( 0, 0 );
	const top = g0 + 2.55;
	for ( const px of [ - w / 2, w / 2 ] ) for ( const pz of [ - d / 2, d / 2 ] ) {

		const g = gAt( px, pz );
		B.cyl( 'wood', px, g - 0.4, pz, 0.065, 0.075, top - g + 0.45, { segs: 7, data: WOOD( rand.next(), 0.9 ) } );
		const p = toW( px, pz );
		colliders.addCylinder( p.x, p.z, 0.1, g - 0.4, top, { tag: 'stall' } );
		checks.push( { x: p.x, y: g - 0.4, z: p.z } );

	}

	for ( const pz of [ - d / 2, d / 2 ] ) B.rod( 'wood', [ - w / 2 - 0.2, top, pz ], [ w / 2 + 0.2, top, pz ], 0.06, 0.06, { segs: 6, data: WOOD( rand.next(), 0.85 ) } );
	// hip thatch roof
	const ov = 0.5, a = 0.62, ta = Math.tan( a );
	const XE = w / 2 + ov, ZE = d / 2 + ov, XR = ( w - d ) / 2;
	const ye = top + 0.08, yR = ye + ZE * ta;
	const td = () => [ rand.next(), 0.5, 0, 0 ];
	const T = 0.2;
	B.slab( 'thatch', [ V3( - XE, ye, ZE ), V3( XE, ye, ZE ), V3( XR, yR, 0 ), V3( - XR, yR, 0 ) ], T, { up: UP, uDir: V3( 0, yR - ye, - ZE ).normalize(), data: td() } );
	B.slab( 'thatch', [ V3( XE, ye, - ZE ), V3( - XE, ye, - ZE ), V3( - XR, yR, 0 ), V3( XR, yR, 0 ) ], T, { up: UP, uDir: V3( 0, yR - ye, ZE ).normalize(), data: td() } );
	B.slab( 'thatch', [ V3( XE, ye, ZE ), V3( XE, ye, - ZE ), V3( XR, yR, 0 ) ], T, { up: UP, uDir: V3( - XE + XR, yR - ye, 0 ).normalize(), data: td() } );
	B.slab( 'thatch', [ V3( - XE, ye, - ZE ), V3( - XE, ye, ZE ), V3( - XR, yR, 0 ) ], T, { up: UP, uDir: V3( XE - XR, yR - ye, 0 ).normalize(), data: td() } );
	B.rod( 'thatch', [ - XR - 0.05, yR - 0.04, 0 ], [ XR + 0.05, yR - 0.04, 0 ], 0.15, 0.15, { segs: 7, data: [ rand.next(), 0.7, 0, 0 ] } );

	// counter with fish baskets
	const cy = g0 + 0.92;
	for ( let i = 0; i < 4; i ++ ) B.box( 'wood', 0, cy, d / 2 - 0.55 + i * 0.13 - 0.2, w - 0.2, 0.045, 0.12, { grain: 0, data: WOOD( rand.next(), 0.75 ) } );
	for ( const px of [ - w / 2 + 0.25, w / 2 - 0.25 ] ) for ( const pz of [ d / 2 - 0.3, d / 2 - 0.85 ] ) B.box( 'wood', px, g0 + 0.45, pz, 0.07, 0.9, 0.07, { grain: 1, data: WOOD( rand.next(), 0.8 ) } );
	B.box( 'wood', 0, g0 + 0.5, d / 2 - 0.26, w - 0.3, 0.6, 0.03, { grain: 0, tint: lin( 0x5aa7a0 ), data: [ rand.next(), 0.55, 3, 0.7 ] } );
	addBoxL( 0, g0 + 0.5, d / 2 - 0.55, w / 2 - 0.05, 0.5, 0.35, { tag: 'stall' } );
	// the fish displays draw from their own random sequence (the village's stays as it was)
	const fr = new Rand( mulberry32( Math.floor( rand.next() * 4294967296 ) ) );
	for ( let i = 1; i < 58; i ++ ) rand.next();
	// basins: fish on crushed ice or banana leaves, lying on each other, curled; lobsters
	const basins = [
		{ bx: - 1.05, bed: 'ice', fish: [ [ 'redSnapper', 0.4 ], [ 'redSnapper', 0.36 ], [ 'yellowtail', 0.36 ], [ 'redSnapper', 0.38 ], [ 'yellowtail', 0.34 ] ] },
		{ bx: 0.0, bed: 'leaf', fish: [ [ 'parrot', 0.42 ], [ 'grunt', 0.3 ], [ 'grunt', 0.28 ], [ 'parrot', 0.38 ], [ 'grunt', 0.3 ] ] },
		{ bx: 1.05, bed: 'ice', fish: [ [ 'jack', 0.4 ], [ 'mullet', 0.36 ], [ 'jack', 0.38 ] ], lobsters: 2 },
	];
	const bz = d / 2 - 0.58;
	for ( const b of basins ) {

		const { bx } = b;
		B.lathe( 'wood', bx, cy + 0.02, bz, [ [ 0, 0 ], [ 0.21, 0 ], [ 0.21, 0.0 ], [ 0.3, 0.16 ], [ 0.315, 0.17 ], [ 0.29, 0.165 ], [ 0.2, 0.03 ], [ 0, 0.03 ] ], { segs: 14, tint: lin( 0xc9a66a ), data: WOOD( fr.next(), 0.2, 0, 5 ) } );
		// basin floor at cy + 0.05; inner radius 0.2 there, 0.29 at the rim (cy + 0.19)
		const floor = cy + 0.05;
		let lift = floor;
		if ( b.bed === 'ice' ) {

			iceBed( B, bx, cy + 0.12, bz, 0.25, fr.next() );
			lift = cy + 0.15;

		} else {

			// leaves lining the basin, their tips over the rim
			for ( let k = 0; k < 4; k ++ ) {

				const a = k * Math.PI / 2 + fr.range( - 0.3, 0.3 );
				bananaLeaf( B, bx + Math.cos( a ) * 0.02, floor + 0.004 + k * 0.002, bz + Math.sin( a ) * 0.02, - a, 0.36, fr.next(), 0.5 );

			}

			lift = floor + 0.02;

		}

		// fish in layers, heads alternating, bodies curved to the basin, tails over the rim
		b.fish.forEach( ( [ species, len ], i ) => {

			const a = i * 2.4 + fr.range( - 0.4, 0.4 );
			const r = fr.range( 0.0, 0.07 );
			fish( B, bx + Math.cos( a ) * r, lift + Math.floor( i / 2 ) * 0.04, bz + Math.sin( a ) * r, {
				species, len, ry: a + ( i % 2 ? Math.PI : 0 ) + fr.range( - 0.3, 0.3 ), rx: fr.range( - 0.12, 0.12 ), rz: fr.range( - 0.1, 0.1 ),
				flip: fr.chance( 0.3 ), sag: fr.range( 0.35, 0.8 ) * ( fr.chance( 0.5 ) ? 1 : - 1 ), curl: fr.range( - 0.25, 0.15 ),
				jaw: fr.range( 0.15, 0.5 ), cloudy: fr.range( 0.2, 0.6 ), blood: fr.range( 0.3, 1 ), seed: fr.next(),
			} );

		} );
		for ( let k = 0; k < ( b.lobsters || 0 ); k ++ ) {

			const a = k * Math.PI + 0.6;
			lobster( B, bx + Math.cos( a ) * 0.09, lift + 0.07, bz + Math.sin( a ) * 0.1, a + Math.PI * 0.5, 0.26, fr.next(), fr.range( - 0.15, 0.15 ) );

		}

	}

	// small fry on banana leaves between the basins
	for ( const lx of [ - 0.52, 0.52 ] ) {

		bananaLeaf( B, lx - 0.22, cy + 0.025, bz - 0.02, fr.range( - 0.12, 0.12 ), 0.44, fr.next() );
		for ( let k = 0; k < 3; k ++ ) {

			fish( B, lx + fr.range( - 0.04, 0.04 ), cy + 0.035 + k * 0.012, bz - 0.06 + k * 0.05, {
				species: fr.pick( [ 'grunt', 'yellowtail', 'mullet' ] ), len: fr.range( 0.2, 0.26 ), ry: fr.range( - 0.4, 0.4 ) + ( k % 2 ? Math.PI : 0 ),
				sag: fr.range( - 0.4, 0.4 ), jaw: fr.range( 0.1, 0.4 ), seed: fr.next(),
			} );

		}

	}

	// fish hanging from the front beam: by the tail on twine, or on S-hooks through the gills;
	// limp (slightly curled and sagging), mouths open
	const hung = [
		[ - 1.42, 'mahi', 0.9, 'tail' ], [ - 0.9, 'redSnapper', 0.46, 'gill' ], [ - 0.45, 'grouper', 0.62, 'tail' ],
		[ 0.05, 'barracuda', 0.95, 'tail' ], [ 0.52, 'tuna', 0.58, 'tail' ], [ 0.95, 'redSnapper', 0.42, 'gill' ], [ 1.4, 'yellowtail', 0.4, 'gill' ],
	];
	for ( const [ px, species, len, how ] of hung ) {

		const opts = {
			species, len, pose: how, ry: fr.range( - 0.15, 0.15 ), sag: fr.range( - 0.2, 0.2 ), curl: fr.range( - 0.25, 0.25 ),
			jaw: how === 'tail' ? fr.range( 0.35, 0.6 ) : fr.range( 0.1, 0.3 ), cloudy: fr.range( 0.2, 0.5 ), blood: fr.range( 0.4, 1 ), seed: fr.next(),
		};
		if ( how === 'tail' ) {

			const y = top - 0.2 - fr.range( 0, 0.08 );
			fishTwine( B, [ px, top - 0.05, d / 2 ], [ px, y, d / 2 ], fr.next(), 0.012 + len * 0.01 );
			fish( B, px, y, d / 2, opts );

		} else {

			const y = sHook( B, px, top, d / 2, 0.06, fr.next() );
			fish( B, px, y, d / 2, opts );

		}

	}

	const lp = lantern( B, 0, top - 0.02, - d / 2, rand.next() );
	lights.push( { position: B.toWorld( lp[ 0 ], lp[ 1 ], lp[ 2 ] ), color: WARM.clone(), intensity: 3, kind: 'lantern' } );
	B.pop();

	for ( const [ lx, lz ] of [ [ - 1.3, - 0.4 ], [ - 0.7, - 0.6 ], [ 1.2, - 0.5 ] ] ) {

		const p = toW( lx, lz );
		ctx.inst.add( 'crate', p.x, gAt( lx, lz ), p.z, yaw + rand.range( - 0.3, 0.3 ), [ rand.range( 0.85, 1.05 ), 0.95, 0.9 ] );

	}

	return { footprint: { x, z, r: Math.hypot( w, d ) / 2 + 1.2, kind: 'building' } };

}

// ---------------------------------------------------------------------------
// Small lean-to garden / tool shed (local +z = door side)

export function buildShed( ctx, s ) {

	const { B, terrain, colliders, rand, checks } = ctx;
	const { x, z, yaw } = s;
	const w = s.w ?? 1.9, d = s.d ?? 1.7;
	const { toW, gAt } = frameFns( terrain, x, z, yaw );
	let gMin = Infinity, gMax = - Infinity;
	for ( const [ cx, cz ] of [ [ - 1, - 1 ], [ 1, - 1 ], [ 1, 1 ], [ - 1, 1 ], [ 0, 0 ] ] ) {

		const g = gAt( cx * w / 2, cz * d / 2 );
		gMin = Math.min( gMin, g ); gMax = Math.max( gMax, g );

	}

	const base = gMax + 0.22;
	const hF = 2.3, hB = 1.95, t = 0.05;
	const doorCx = 0.15, doorHalf = 0.53, doorH = 2.03;
	const col = s.wall || lin( 0x9aa7a0 );
	const paint = s.paint ?? 0.45;
	const wd = ( pat ) => [ rand.next(), paint, pat, 0.9 ];
	B.pushAt( x, 0, z, yaw );
	for ( const sx of [ - 1, 1 ] ) for ( const sz of [ - 1, 1 ] ) {

		const px = sx * ( w / 2 - 0.05 ), pz = sz * ( d / 2 - 0.05 );
		const g = gAt( px, pz );
		const top = base + ( sz > 0 ? hF : hB );
		B.box( 'wood', px, ( g - 0.3 + top ) / 2, pz, 0.1, top - g + 0.3, 0.1, { grain: 1, data: WOOD( rand.next(), 0.9 ) } );
		checks.push( { ...toW( px, pz ), y: g - 0.3 } );

	}

	const skirt = base - gMin + 0.1;
	const bodyBottom = base - skirt;
	const bodyTop = base + hF;
	const leftW = w / 2 + doorCx - doorHalf, rightW = w / 2 - doorCx - doorHalf;
	B.box( 'wood', ( - w / 2 + doorCx - doorHalf ) / 2, ( bodyBottom + bodyTop ) / 2, d / 2 - t / 2, leftW, bodyTop - bodyBottom, t, { grain: 0, tint: col, data: wd( 2 ) } );
	B.box( 'wood', ( doorCx + doorHalf + w / 2 ) / 2, ( bodyBottom + bodyTop ) / 2, d / 2 - t / 2, rightW, bodyTop - bodyBottom, t, { grain: 0, tint: col, data: wd( 2 ) } );
	B.box( 'wood', doorCx, base + ( doorH + hF ) / 2, d / 2 - t / 2, doorHalf * 2, hF - doorH, t, { grain: 0, tint: col, data: wd( 2 ) } );
	B.box( 'wood', 0, base - skirt / 2 + hB / 2, - d / 2 + t / 2, w, hB + skirt, t, { grain: 0, tint: col, data: wd( 2 ) } );
	for ( const sx of [ - 1, 1 ] ) {

		const xo = sx * w / 2;
		const pts = [ V3( xo, base - skirt, d / 2 - t ), V3( xo, base - skirt, - d / 2 + t ), V3( xo, base + hB, - d / 2 + t ), V3( xo, base + hF, d / 2 - t ) ];
		B.slab( 'wood', pts, t, { up: V3( sx, 0, 0 ), uDir: V3( 0, 0, - sx ), tint: col, data: wd( 2 ) } );

	}

	// The wooden tool-shed leaf is separately animated by Village.
	const dc = s.door || lin( 0x2d7f7a );
	B.box( 'wood', 0, base - 0.06, 0, w - 0.14, 0.12, d - 0.14, { tint: lin( 0xb8a58b ), data: wd( 0 ) } );
	// Island Life supplies an interactive workbench in every tool shed.
	// shed roof
	const rf = [ V3( - w / 2 - 0.2, base + hB + 0.02, - d / 2 - 0.25 ), V3( w / 2 + 0.2, base + hB + 0.02, - d / 2 - 0.25 ), V3( w / 2 + 0.2, base + hF + 0.08, d / 2 + 0.3 ), V3( - w / 2 - 0.2, base + hF + 0.08, d / 2 + 0.3 ) ];
	B.slab( 'roofMetal', rf, 0.04, { up: UP, uDir: V3( 0, hF - hB, d + 0.55 ).normalize(), tint: s.roof || lin( 0x8a5a40 ), data: [ rand.next(), 0.8, s.galv ? 1 : 0, 0 ] } );
	// V7: tiny salvaged-cargo shacks get a striped sail roof and heavy knees.
	B.slab( 'fabric', [ V3( - w / 2 - 0.23, base + hB + 0.11, - d / 2 - 0.30 ),
		V3( w / 2 + 0.23, base + hB + 0.11, - d / 2 - 0.30 ),
		V3( w / 2 + 0.23, base + hF + 0.16, d / 2 + 0.37 ),
		V3( - w / 2 - 0.23, base + hF + 0.16, d / 2 + 0.37 ) ],
		0.046, { up: UP, tint: s.roof || lin( 0x5b4852 ), data: [ rand.next(), 0.61, 0.24, 0 ] } );
	for ( const side of [ - 1, 1 ] ) {

		B.beam( 'wood', [ side * ( w / 2 + 0.09 ), base - 0.08, d / 2 + 0.06 ],
			[ side * ( w / 2 + 0.17 ), base + hF + 0.15, d / 2 + 0.14 ], 0.12, 0.17,
			{ tint: lin( 0x50392c ), data: WOOD( rand.next(), 0.24 ) } );
		B.beam( 'wood', [ side * ( w / 2 + 0.14 ), base + hF - 0.78, d / 2 + 0.12 ],
			[ side * ( w / 2 - 0.50 ), base + hF + 0.02, d / 2 + 0.13 ], 0.11, 0.16,
			{ tint: lin( 0xd7aa6b ), data: WOOD( rand.next(), 0.77 ) } );

	}
	B.pop();
	const add = ( lx, y, lz, hx, hy, hz, opts ) => {

		const p = toW( lx, lz );
		return colliders.addBox( _v.set( p.x, y, p.z ), _h.set( hx, hy, hz ), yaw, opts );

	};
	const mid = ( bodyBottom + bodyTop ) / 2, halfH = ( bodyTop - bodyBottom ) / 2;
	add( ( - w / 2 + doorCx - doorHalf ) / 2, mid, d / 2 - t / 2, leftW / 2, halfH, t / 2, { tag: 'shedWall' } );
	add( ( doorCx + doorHalf + w / 2 ) / 2, mid, d / 2 - t / 2, rightW / 2, halfH, t / 2, { tag: 'shedWall' } );
	add( doorCx, base + ( doorH + hF ) / 2, d / 2 - t / 2, doorHalf, ( hF - doorH ) / 2, t / 2, { tag: 'shedLintel' } );
	add( 0, mid, - d / 2 + t / 2, w / 2, halfH, t / 2, { tag: 'shedWall' } );
	for ( const sx of [ - 1, 1 ] ) add( sx * ( w / 2 - t / 2 ), mid, 0, t / 2, halfH, d / 2, { tag: 'shedWall' } );
	add( 0, base - 0.06, 0, w / 2 - 0.07, 0.06, d / 2 - 0.07, { walkable: true, solid: false, tag: 'shedFloor' } );
	const door = add( doorCx, base + 0.9, d / 2, 0.4, 0.9, 0.045, { tag: 'shedDoor' } );
	const doorPoint = toW( doorCx, d / 2 );
	return { floorY: base, roofTop: base + hF + 0.1,
		door: { ...doorPoint, y: base, floorY: base, yaw, tint: dc, trim: col, width: 0.8, height: 1.8, door, name: s.name },
		footprint: { x, z, r: Math.hypot( w, d ) / 2 + 0.6, kind: 'building' } };

}
