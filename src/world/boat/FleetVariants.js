import { Vector3 } from '../../engine/index.js';
import { box, cylinder, rod, gridSurface, fanCap, mat4 } from './GeoKit.js';
import { buildHull } from './HullBuilder.js';

// A single watertight 8.2 m rigid body supports five genuinely different ship
// profiles. Variant geometry is rebuilt only on a dockside selection, never
// every frame. Inactive variants have zero render calls and no GPU allocation.
export const FLEET = Object.freeze( {
	corsair: { zh: '风暴醒者 · 海盗单桅帆船', en: 'Stormwake · pirate sloop', thrust: 1.0, speed: 1.0, turn: 1.0, role: '探险 / 海盗帆船' },
	brig: { zh: '金鸥号 · 双桅武装帆船', en: 'Golden Gull · two-mast brig', thrust: 0.82, speed: 0.95, turn: 0.83, role: '重型航海 / 双桅' },
	cutter: { zh: '蓝鳍号 · 快速三角帆艇', en: 'Bluefin · racing cutter', thrust: 1.18, speed: 1.27, turn: 1.28, role: '远海竞速 / 灵活' },
	crabber: { zh: '海雾号 · 远洋捕捞船', en: 'Sea Mist · fishing cutter', thrust: 1.06, speed: 0.83, turn: 0.96, role: '拖网捕鱼 / 重载' },
	skiff: { zh: '飞鱼号 · 轻型舷外支架帆艇', en: 'Flying Fish · island skiff', thrust: 1.04, speed: 1.15, turn: 1.48, role: '浅滩探索 / 轻快' },
	whaler: { zh: '铁鲸号 · 重装捕鲸战舰', en: 'Ironwhale · armed whaler', thrust: 0.9, speed: 0.91, turn: 0.77, role: 'BOSS 战 / 重装炮台 · 需锻造' },
} );

const V = ( x, y, z ) => new Vector3( x, y, z );
const TIMBER = 0x422c24, ROPE = 0xb99560, BRASS = 0xc9a25f;
const surf = ( kit, bucket, geom, color, matrix ) => kit.add( bucket, geom, { color, rough: 0.78, metal: bucket === 'fittings' ? 0.28 : 0, ...( matrix ? { matrix } : {} ) } );
const plank = ( kit, x, y, z, w, h, d, color ) => surf( kit, 'wood', box( w, h, d ), color, mat4( x, y, z ) );
const spar = ( kit, a, b, r = 0.05, color = TIMBER, bucket = 'wood' ) => surf( kit, bucket, rod( V( ...a ), V( ...b ), r, 8 ), color );
const rope = ( kit, a, b, r = 0.013 ) => spar( kit, a, b, r, ROPE, 'fittings' );

function canvas( kit, x0, x1, y0, y1, z, color, puff = 0.14 ) {

	const rows = [];
	for ( let i = 0; i <= 6; i ++ ) {
		const f = i / 6, yy = y0 + ( y1 - y0 ) * f, row = [];
		for ( let j = 0; j <= 7; j ++ ) {
			const g = j / 7, x = x0 + ( x1 - x0 ) * g;
			row.push( V( x, yy, z + puff * Math.sin( Math.PI * f ) * Math.sin( Math.PI * g ) ) );
		}
		rows.push( row );
	}
	surf( kit, 'sail', gridSurface( rows ), color );
	for ( let j = 1; j < 7; j ++ ) rope( kit, [ x0 + ( x1 - x0 ) * j / 7, y0 + 0.01, z + 0.015 ], [ x0 + ( x1 - x0 ) * j / 7, y1 - 0.01, z + 0.015 ], 0.006 );
	rope( kit, [ x0, y0, z ], [ x1, y0, z ] );
	rope( kit, [ x0, y1, z ], [ x1, y1, z ] );

}

function triangle( kit, a, b, c, color ) {

	surf( kit, 'sail', fanCap( [ V( ...a ), V( ...b ), V( ...c ) ], V( 1, 0, 0 ) ), color );
	rope( kit, a, b ); rope( kit, b, c ); rope( kit, a, c );

}

function commonHull( kit, L, dark, rail ) {

	buildHull( kit, L );
	// Individually colored boards, crossbeams and structural stanchions; every
	// raised edge rests on real timbers, with no floating decorative panel.
	for ( let i = 0; i < 30; i ++ ) {
		const z = - 3.48 + i * 0.158;
		const half = Math.max( 0.38, L.sheerX( L.tAtSheerZ( z ) ) - 0.2 );
		plank( kit, 0, L.deckY + 0.012, z, half * 2, 0.038, 0.145, i % 8 === 0 ? rail : ( i % 5 === 0 ? 0x79604a : dark ) );
	}
	for ( const side of [ - 1, 1 ] ) for ( let i = 0; i <= 12; i ++ ) {
		const z = - 3.47 + i * 0.58, t = L.tAtSheerZ( z );
		const x = side * ( L.sheerX( t ) - 0.06 ), y = L.sheerY( t );
		spar( kit, [ x, y - 0.19, z ], [ x, y + 0.30, z ], 0.049, TIMBER );
		if ( i ) {
			const prevZ = z - 0.58, pt = L.tAtSheerZ( prevZ );
			spar( kit, [ side * ( L.sheerX( pt ) - 0.06 ), L.sheerY( pt ) + 0.30, prevZ ], [ x, y + 0.30, z ], 0.055, rail );
		}
	}
	// Captains' wheel and support live at the same mechanically accessible
	// position on every craft (the player controller uses this point).
	plank( kit, - 0.55, 0.9, 0.27, 0.22, 0.76, 0.27, TIMBER );
	surf( kit, 'fittings', cylinder( 0.17, 0.17, 0.07, 12 ), BRASS, mat4( - 0.55, 1.29, 0.36, Math.PI / 2 ) );
	// Matching raised stern hatch and two hinged trim strips.
	plank( kit, 0.48, L.deckY + 0.12, - 2.25, 0.75, 0.24, 0.63, TIMBER );
	for ( const x of [ 0.13, 0.83 ] ) plank( kit, x, L.deckY + 0.25, - 2.25, 0.055, 0.06, 0.62, BRASS );

}

function rig( kit, { mastZ, tall, width, y0, color, flag = 0x9b4d3e, lateen = false } ) {

	spar( kit, [ 0, 0.46, mastZ ], [ 0, tall, mastZ ], 0.155 );
	surf( kit, 'wood', cylinder( 0.28, 0.28, 0.12, 10 ), 0x89633d, mat4( 0, 0.58, mastZ ) );
	if ( lateen ) {
		spar( kit, [ - width / 2, y0, mastZ + 0.06 ], [ width / 2, tall - 0.18, mastZ + 0.16 ], 0.075 );
		triangle( kit, [ - width / 2, y0 + 0.1, mastZ + 0.15 ], [ width / 2, tall - 0.22, mastZ + 0.22 ], [ width / 2, y0, mastZ + 0.16 ], color );
	} else {
		for ( const y of [ y0 - 0.15, tall - 0.35 ] ) spar( kit, [ - width / 2 - 0.08, y, mastZ + 0.05 ], [ width / 2 + 0.08, y, mastZ + 0.05 ], 0.07 );
		canvas( kit, - width / 2, width / 2, y0, tall - 0.48, mastZ + 0.05, color );
	}
	for ( const side of [ - 1, 1 ] ) rope( kit, [ 0, tall - 0.15, mastZ ], [ side * 1.16, 1.01, mastZ - 1.38 ] );
	triangle( kit, [ 0, tall + 0.05, mastZ ], [ 1.08, tall - 0.15, mastZ ], [ 0, tall - 0.42, mastZ ], flag );

}

function cabin( kit, x, z, paint, roof, low = false ) {

	const h = low ? 0.92 : 1.48;
	plank( kit, x, 0.66 + h / 2, z, 1.62, h, 1.17, paint );
	for ( const side of [ - 1, 1 ] ) {
		plank( kit, x + side * 0.82, 0.66 + h * 0.65, z, 0.035, h * 0.36, 0.70, 0x3d6a72 );
		for ( const zz of [ z - 0.37, z + 0.37 ] ) plank( kit, x + side * 0.846, 0.66 + h * 0.65, zz, 0.05, h * 0.39, 0.045, BRASS );
	}
	plank( kit, x, 0.67 + h, z, 1.88, 0.085, 1.39, roof );
	for ( const zz of [ z - 0.64, z + 0.64 ] ) spar( kit, [ x - 0.90, 0.75 + h, zz ], [ x + 0.90, 0.75 + h, zz ], 0.032, TIMBER );

}

function winch( kit, x, z ) {

	for ( const side of [ - 1, 1 ] ) {
		plank( kit, x + side * 0.32, 0.86, z, 0.07, 0.58, 0.14, TIMBER );
		surf( kit, 'fittings', cylinder( 0.19, 0.19, 0.09, 12 ), 0x715943, mat4( x + side * 0.31, 1.11, z, 0, 0, Math.PI / 2 ) );
	}
	spar( kit, [ x - 0.37, 1.12, z ], [ x + 0.37, 1.12, z ], 0.052, BRASS, 'fittings' );

}

export function buildFleetVariant( kit, L, parts, kind ) {

	const theme = kind === 'brig' ? [ 0x604231, 0x9a7842, 0xd4bd8b ] :
		kind === 'cutter' ? [ 0x486e73, 0x295f6f, 0xf4e2ae ] :
		kind === 'crabber' ? [ 0x73583b, 0x326c6d, 0xcbb28a ] :
		kind === 'whaler' ? [ 0x3b4e50, 0x9d8067, 0xd5ccb1 ] : [ 0x96744d, 0x529296, 0xede2ae ];
	const [ deck, rail, cloth ] = theme;
	commonHull( kit, L, deck, rail );
	const bow = [ 0, 1.62, 5.12 ];
	if ( kind === 'brig' ) {
		rig( kit, { mastZ: 1.36, tall: 6.55, width: 2.5, y0: 3.2, color: cloth, flag: 0x78362c } );
		rig( kit, { mastZ: - 1.65, tall: 5.65, width: 2.34, y0: 2.65, color: 0xc3d4c8, flag: 0x8e4137 } );
		canvas( kit, - 1.08, 1.08, 4.89, 5.91, 1.43, 0xe0c89b, 0.10 );
		cabin( kit, 0, - 3.06, 0x49362e, rail, true );
		for ( const side of [ - 1, 1 ] ) for ( const z of [ - 0.4, 0.52 ] ) {
			spar( kit, [ side * 0.93, 0.89, z ], [ side * 1.44, 0.89, z ], 0.12, 0x292929, 'fittings' );
			surf( kit, 'fittings', cylinder( 0.13, 0.13, 0.05, 10 ), BRASS,
				mat4( side * 1.44, 0.89, z, 0, 0, Math.PI / 2 ) );
		}
		winch( kit, 0.59, - 1.22 );
	} else if ( kind === 'whaler' ) {
		// A purpose-built hunt vessel: paired real gun barrels on supported wood
		// carriages, forward swivel harpoon, iron bowsprit and capstan/winch.
		rig( kit, { mastZ: 0.95, tall: 6.3, width: 2.25, y0: 2.8, color: cloth, flag: 0x762d32 } );
		rig( kit, { mastZ: - 2.05, tall: 4.9, width: 1.6, y0: 2.5, color: 0xe2d7b8, flag: 0xb78b4d } );
		cabin( kit, 0.37, - 3.0, 0x394b4c, 0x695039, true );
		for ( const side of [ - 1, 1 ] ) for ( const z of [ - 0.72, 1.62 ] ) {
			plank( kit, side * 0.91, 0.73, z, 0.58, 0.23, 0.69, 0x664e3c );
			spar( kit, [ side * 0.90, 0.86, z ], [ side * 1.55, 0.98, z ], 0.15, 0x222e31, 'fittings' );
			surf( kit, 'fittings', cylinder( 0.18, 0.18, 0.07, 12 ), BRASS,
				mat4( side * 1.57, 0.98, z, 0, 0, Math.PI / 2 ) );
			for ( const dz of [ - 0.20, 0.20 ] ) surf( kit, 'fittings', cylinder( 0.10, 0.10, 0.13, 10 ), 0x322e2b,
				mat4( side * 0.85, 0.62, z + dz, Math.PI / 2 ) );
		}
		winch( kit, - 0.68, 1.82 );
		for ( const side of [ - 1, 1 ] ) {
			spar( kit, [ side * 0.76, 0.92, 3.05 ], [ side * 1.2, 1.24, 4.46 ], 0.10, TIMBER );
			rope( kit, [ side * 1.20, 1.24, 4.46 ], [ 0, 2.26, 4.78 ], 0.024 );
		}
		spar( kit, [ 0, 1.25, 3.3 ], [ 0, 1.49, 5.48 ], 0.17, 0x363d3b, 'fittings' );
		for ( const side of [ - 1, 1 ] ) spar( kit, [ side * 0.22, 1.5, 5.1 ], [ 0, 1.47, 5.75 ], 0.05, BRASS, 'fittings' );
	} else if ( kind === 'cutter' ) {
		rig( kit, { mastZ: 0.76, tall: 7.24, width: 3.08, y0: 1.8, color: cloth, lateen: true, flag: 0xdf6744 } );
		spar( kit, [ 0, 1.14, 2.75 ], bow, 0.087 );
		triangle( kit, [ 0, 5.3, 0.76 ], [ 0, 1.74, 4.85 ], [ 0.44, 1.7, 0.98 ], 0xf6e6c0 );
		// Keep the central boarding spot at z=-1.75 unobstructed.
		cabin( kit, 0.52, - 3.02, 0x366174, 0xb18c58, true );
		winch( kit, 0.58, - 0.58 );
	} else if ( kind === 'crabber' ) {
		cabin( kit, 0.32, 1.76, 0x32616a, 0x624631 );
		// Supported stern A-frame crane and real net mesh stretched between spars.
		for ( const side of [ - 1, 1 ] ) {
			spar( kit, [ side * 1.17, 0.68, - 3.10 ], [ side * 0.42, 3.43, - 2.74 ], 0.092 );
			rope( kit, [ side * 0.42, 3.43, - 2.74 ], [ side * 1.05, 0.95, - 3.31 ] );
		}
		spar( kit, [ - 0.44, 3.42, - 2.74 ], [ 0.44, 3.42, - 2.74 ], 0.072 );
		spar( kit, [ 0, 3.4, - 2.72 ], [ 0, 2.24, - 4.36 ], 0.07 );
		for ( let i = 0; i <= 9; i ++ ) for ( let j = 0; j <= 5; j ++ ) {
			const x = - 0.87 + i * 0.174, z = - 2.62 - j * 0.22;
			if ( j < 5 ) rope( kit, [ x, 0.57 + ( j / 5 ) * 0.15, z ], [ x, 0.57 + ( ( j + 1 ) / 5 ) * 0.15, z - 0.22 ], 0.008 );
			if ( i < 9 ) rope( kit, [ x, 0.57 + ( j / 5 ) * 0.15, z ], [ x + 0.174, 0.57 + ( j / 5 ) * 0.15, z ], 0.008 );
		}
		winch( kit, - 0.78, - 1.03 );
		for ( const z of [ - 0.7, - 1.32, - 1.94 ] ) {
			plank( kit, 0.70, 0.87, z, 0.48, 0.48, 0.43, 0x776044 );
			for ( const x of [ 0.47, 0.93 ] ) rope( kit, [ x, 0.61, z - 0.23 ], [ x, 1.12, z + 0.23 ] );
		}
		rig( kit, { mastZ: - 0.37, tall: 4.72, width: 1.5, y0: 2.48, color: cloth, flag: 0x6b9f93 } );
	} else {
		// Lightweight island skiff: an open vessel with two balanced lateen sails,
		// side outriggers tied back to the inner hull by triangulated timber struts.
		rig( kit, { mastZ: 1.18, tall: 5.64, width: 2.05, y0: 1.9, color: cloth, lateen: true, flag: 0xde8047 } );
		rig( kit, { mastZ: - 1.88, tall: 4.33, width: 1.54, y0: 1.65, color: 0xc0eee1, lateen: true, flag: 0x45988e } );
		for ( const side of [ - 1, 1 ] ) {
			for ( const z of [ - 1.45, 1.05 ] ) {
				spar( kit, [ side * 0.82, 0.75, z ], [ side * 2.0, 0.53, z ], 0.066 );
				rope( kit, [ side * 0.92, 0.95, z + 0.18 ], [ side * 2.0, 0.53, z ] );
			}
			spar( kit, [ side * 2.0, 0.53, - 2.16 ], [ side * 2.0, 0.53, 2.22 ], 0.11, rail );
		}
		plank( kit, 0.42, 0.78, - 2.85, 0.75, 0.29, 0.66, 0xb18b53 );
	}
	// Every ship has accessible, structurally supported wheel and night lights.
	for ( const side of [ - 1, 1 ] ) {
		spar( kit, [ side * 1.13, 1.0, - 3.12 ], [ side * 1.13, 1.64, - 3.12 ], 0.038 );
		surf( kit, 'glow', cylinder( 0.105, 0.105, 0.2, 8 ), side > 0 ? 0x7d3a27 : 0x357967,
			mat4( side * 1.13, 1.61, - 3.12 ) );
	}
	parts.wheelCenter = V( - 0.55, 1.52, 0.43 );
	parts.wheelAxis = V( 0, 0, 1 );
	parts.throttlePivot = V( - 0.82, 0.96, 0.14 );
	parts.flagPivot = V( 0, kind === 'cutter' ? 7.23 : kind === 'brig' ? 6.55 : kind === 'crabber' ? 4.72 : kind === 'whaler' ? 6.3 : 5.64,
		kind === 'brig' ? 1.36 : kind === 'crabber' ? - 0.37 : kind === 'whaler' ? 0.95 : 1.18 );

}
