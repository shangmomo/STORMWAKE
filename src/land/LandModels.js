import { Group, Mesh, Vector3 } from '../engine/index.js';
import { prepare, mergePrepared, cylinder, sphere, box, torus, rod, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial, PAT } from '../game/GameMaterials.js';

// One terrain-compatible WGSL material is shared across all new land models.
// Static towers merge dozens of parts into ONE draw call. Animated creatures
// use a small handful of articulated groups, not one mesh per decorative bolt.
export const landMaterial = createPropMaterial( 'stormwakeLandV31' );
landMaterial.underwaterLighting = 'lite';

const stone = 0x576c75, stoneHi = 0x81969b, dark = 0x202c37,
	bronze = 0xa08054, cyan = 0x50f6dc, bone = 0xc7c6a9, red = 0xdd6d76;
const part = ( g, color, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, ry = 0, rough = .82, pattern = PAT.plain ) =>
	prepare( g, { color, rough, pattern, matrix: mat4( x, y, z, 0, ry, 0, sx, sy, sz ) } );
const object = ( parts, parent, shadows = false ) => {
	const m = new Mesh( mergePrepared( parts ), landMaterial );
	m.castShadow = shadows;
	m.receiveShadow = true;
	parent.add( m );
	return m;
};

export function createLighthouse( x, y, z ) {
	const group = new Group();
	group.name = 'V32 Stormwake lighthouse — layered masonry, glazed lantern and keeper outbuildings';
	group.position.set( x, y, z );
	const brass = 0xa68d5c, copper = 0x6d8986, basalt = 0x34474c, windowBlack = 0x111e26;
	const parts = [
		part( cylinder( 4.55, 5.15, 1.25, 36 ), basalt, 0, .45, 0 ),
		part( cylinder( 2.84, 4.12, 17.8, 40 ), stone, 0, 9.82, 0 ),
		part( cylinder( 3.55, 3.55, .80, 40 ), basalt, 0, 19.08, 0 ),
		part( cylinder( 2.52, 2.52, 3.45, 32 ), windowBlack, 0, 21.2, 0 ),
		part( cylinder( 2.97, 2.97, .54, 40 ), stoneHi, 0, 23.22, 0 ),
		part( cylinder( 0, 3.42, 2.10, 40 ), copper, 0, 24.55, 0 ),
		part( sphere( .76, 18, 12 ), cyan, 0, 21.3, 0 ),
	];
	// 30 offset masonry courses. Small uneven blocks and joints produce a
	// readable silhouette even without external photogrammetry textures.
	const shades = [ 0x52636c, 0x667981, 0x6c7c83, 0x425761, 0x819097, 0x60737a ];
	for ( let course = 0; course < 30; course ++ ) {
		const h = 1.3 + course * .575, radius = 4.12 - h * 1.28 / 18;
		const blocks = 28;
		for ( let j = 0; j < blocks; j ++ ) {
			const angle = ( j + ( course % 2 ) * .5 ) * Math.PI * 2 / blocks;
			const skipWindow = ( course === 8 || course === 17 || course === 25 ) &&
				( j === 0 || j === 1 || j === 14 || j === 15 );
			if ( skipWindow ) continue;
			const hash = ( course * 73 + j * 29 ) % shades.length;
			const chipped = ( ( course * 19 + j * 7 ) % 13 ) === 0;
			parts.push( part( box( .805, .512, chipped ? .26 : .18 ), shades[ hash ],
				Math.sin( angle ) * ( radius + .005 ), h, Math.cos( angle ) * ( radius + .005 ),
				1, 1, 1, angle ) );
		}
		if ( course % 5 === 0 ) parts.push( part( cylinder( radius + .13, radius + .17, .095, 40 ), stoneHi, 0, h - .33, 0 ) );
	}
	// Three recessed double-faced windows: individual lintels, jambs and sill.
	for ( const h of [ 6, 11.2, 16.4 ] ) for ( const side of [ -1, 1 ] ) {
		const r = 4.1 - h * 1.28 / 18;
		parts.push( part( box( 1.00, 1.58, .22 ), windowBlack, 0, h, side * ( r + .11 ) ) );
		parts.push( part( box( 1.30, .21, .36 ), stoneHi, 0, h + .86, side * ( r + .18 ) ) );
		parts.push( part( box( 1.28, .23, .43 ), basalt, 0, h - .91, side * ( r + .22 ) ) );
		for ( const l of [ -.57, .57 ] ) parts.push( part( box( .19, 1.61, .33 ), stoneHi, l, h, side * ( r + .20 ) ) );
		parts.push( part( box( .075, 1.46, .30 ), copper, 0, h, side * ( r + .27 ) ) );
	}
	// Actual timber door, iron bands and raised stone arch at the entrance.
	parts.push( part( box( 1.9, 3.08, .32 ), 0x433c31, 0, 1.97, 4.21, 1, 1, 1, 0, .96, PAT.wood ) );
	for ( const xx of [ -.70, -.35, 0, .35, .70 ] ) parts.push( part( box( .045, 2.72, .04 ), 0x88644b, xx, 1.96, 4.40, 1, 1, 1, 0, .91, PAT.wood ) );
	for ( const hh of [ .88, 2.55 ] ) parts.push( part( box( 2.12, .11, .15 ), basalt, 0, hh, 4.43, 1, 1, 1, 0, .55, PAT.rusty ) );
	parts.push( part( sphere( .095, 12, 8 ), brass, .67, 1.95, 4.50 ) );
	for ( const side of [ -1, 1 ] ) parts.push( part( box( .28, 3.18, .52 ), stoneHi, side * 1.12, 2.0, 4.16 ) );
	parts.push( part( box( 2.6, .35, .62 ), stoneHi, 0, 3.64, 4.15 ) );
	// Lantern room: glass panes framed by narrow oxidized copper mullions.
	for ( let i = 0; i < 20; i ++ ) {
		const a = i * Math.PI * 2 / 20, r = 2.65;
		parts.push( part( box( .12, 3.28, .15 ), copper, Math.sin( a ) * r, 21.25,
			Math.cos( a ) * r, 1, 1, 1, a, .34, PAT.rusty ) );
		parts.push( part( box( .69, 2.68, .062 ), 0x6aafbd, Math.sin( a + .15 ) * ( r - .015 ), 21.25,
			Math.cos( a + .15 ) * ( r - .015 ), 1, 1, 1, a + .15, .15 ) );
	}
	for ( const hh of [ 19.9, 22.75 ] ) parts.push( part( cylinder( 2.90, 2.90, .17, 36 ), brass, 0, hh, 0 ) );
	// 32 guard rails around the platform, roof ribs and a weather vane.
	for ( let i = 0; i < 32; i ++ ) {
		const a = i * Math.PI * 2 / 32;
		parts.push( part( box( .085, .95, .095 ), brass, Math.sin( a ) * 3.36, 20.0, Math.cos( a ) * 3.36, 1, 1, 1, a, .42, PAT.rusty ) );
		parts.push( part( box( .17, .095, .14 ), brass, Math.sin( a ) * 3.36, 20.47, Math.cos( a ) * 3.36, 1, 1, 1, a ) );
		if ( i % 2 === 0 ) parts.push( part( rod( new Vector3( Math.sin(a) * 2.85, 23.55, Math.cos(a) * 2.85 ),
			new Vector3( 0, 25.48, 0 ), .06, 6 ), copper ) );
	}
	parts.push( part( rod( new Vector3( 0, 25.5, 0 ), new Vector3( 0, 27.3, 0 ), .07, 8 ), dark ) );
	parts.push( part( box( 1.15, .10, .30 ), brass, 0, 26.7, 0 ) );
	parts.push( part( box( .18, .50, .12 ), cyan, .42, 26.7, 0 ) );
	// Keeper's shed and storm-battered supply platform around the tower base.
	parts.push( part( box( 4.2, 2.30, 3.1 ), 0x4b5959, -6.4, 1.15, 2.2 ) );
	parts.push( part( box( 4.9, .33, 3.7 ), 0x574b46, -6.4, 2.49, 2.2, 1, 1, 1, 0, .94, PAT.wood ) );
	for ( const hx of [ -8.4, -4.5 ] ) parts.push( part( box( .16, 2.25, .23 ), brass, hx, 1.2, 3.80 ) );
	parts.push( part( box( 1.4, 1.35, .13 ), windowBlack, -5.9, 1.43, 3.82 ) );
	for ( const cx of [ -10.8, -10.1 ] ) for ( const cz of [ .8, 1.5 ] )
		parts.push( part( box( .62, .55, .62 ), 0x706348, cx, .33, cz, 1, 1, 1, 0, .95, PAT.wood ) );
	object( parts, group, true );
	const beacon = new Group(); beacon.position.y = 21.5; group.add( beacon );
	object( [ part( torus( 1.20, .1, 6, 28 ), cyan, 0, 0, 0, 1, 1, 1 ),
		part( sphere( .24, 10, 8 ), bone, 0, 0, 0 ) ], beacon );
	const beaconGlow = object( [ part( sphere( 1, 12, 8 ), cyan, 0, 21.5, 0, .7, .7, .7 ) ], group );
	beaconGlow.visible = false;
	return { group, beacon, beaconGlow };
}

export function createTrailMarker( x, y, z ) {
	const group = new Group(); group.position.set( x, y, z ); group.name = 'V31 luminous trailstone';
	object( [ part( cylinder( .46, .72, .68, 8 ), stone, 0, .29, 0 ),
		part( cylinder( .12, .31, 1.25, 7 ), cyan, 0, 1.12, 0 ),
		part( sphere( .22, 8, 6 ), bone, 0, 1.79, 0 ) ], group );
	return group;
}

export function createMirror( x, y, z ) {
	const group = new Group(); group.position.set( x, y, z ); group.name = 'V31 movable optical mirror';
	const plinth = [ part( cylinder( .95, 1.25, .52, 12 ), dark, 0, .28, 0 ),
		part( cylinder( .34, .48, 1.65, 10 ), stoneHi, 0, 1.13, 0 ),
		part( torus( .78, .10, 7, 22 ), bronze, 0, 2.12, 0 ) ];
	for ( let i = 0; i < 8; i ++ ) {
		const a = i * Math.PI / 4;
		plinth.push( part( box( .12, .33, .10 ), bronze, Math.sin( a ) * .76, .55, Math.cos( a ) * .76,
			1, 1, 1, a, .54, PAT.rusty ) );
		plinth.push( part( sphere( .08, 7, 6 ), cyan, Math.sin( a ) * .98, .37, Math.cos( a ) * .98 ) );
	}
	object( plinth, group );
	const lens = new Group(); lens.position.y = 2.12; group.add( lens );
	object( [ part( box( 1.36, 1.55, .12 ), cyan, 0, 0, 0 ),
		part( box( .16, 1.64, .19 ), bronze, -.7, 0, 0 ),
		part( box( .16, 1.64, .19 ), bronze, .7, 0, 0 ),
		part( box( 1.60, .14, .22 ), bronze, 0, -.84, 0 ),
		part( box( 1.60, .14, .22 ), bronze, 0, .84, 0 ),
		part( torus( .49, .035, 5, 24 ), bone, 0, 0, .15 ),
		part( sphere( .15, 9, 7 ), cyan, 0, 0, .18 ) ], lens );
	return { group, lens };
}

export function createMirrorRay( from, to ) {
	const ray = object( [ prepare( rod( from, to, .060, 7 ), { color: cyan, rough: .16,
		pattern: PAT.plain } ) ], new Group() );
	ray.name = 'V31 aligned mirror ray';
	ray.frustumCulled = false;
	ray.visible = false;
	return ray;
}

export function createExplorerBoard( x, y, z ) {
	const group = new Group(); group.position.set( x, y, z ); group.name = 'V31 adventure notice board';
	const parts = [ part( box( .18, 2.0, .18 ), dark, -1, 1, 0 ),
		part( box( .18, 2.0, .18 ), dark, 1, 1, 0 ),
		part( box( 2.45, 1.35, .24 ), bronze, 0, 1.65, 0 ),
		part( box( 2.0, 1.0, .26 ), stone, 0, 1.62, .05 ),
		part( torus( .22, .05, 6, 16 ), cyan, 0, 1.67, .19 ) ];
	for ( let i = 0; i < 7; i ++ ) {
		parts.push( part( box( 2.15, .135, .10 ), 0x675342, 0, 1.12 + i * .185, .18,
			1, 1, 1, 0, .9, PAT.wood ) );
	}
	for ( const [ xx, yy, ww, hh ] of [ [ -.60, 1.83, .59, .55 ], [ .52, 1.76, .67, .58 ], [ -.05, 1.33, .46, .35 ] ] ) {
		parts.push( part( box( ww, hh, .03 ), 0xd0c4a4, xx, yy, .25, 1, 1, 1, 0, .96 ) );
		parts.push( part( sphere( .042, 7, 6 ), red, xx, yy + hh * .35, .29 ) );
		for ( let i = 0; i < 3; i ++ ) parts.push( part( box( ww * .65, .017, .012 ), stone,
			xx, yy + hh * ( .18 - i * .23 ), .273 ) );
	}
	for ( const s of [ -1, 1 ] ) {
		parts.push( part( rod( new Vector3( s * 1.24, 1.83, 0 ),
			new Vector3( s * 1.41, 2.27, -.22 ), .045, 6 ), dark ) );
		parts.push( part( sphere( .12, 8, 6 ), cyan, s * 1.41, 2.34, -.22 ) );
	}
	object( parts, group, true );
	return group;
}

export function createForestShrine( x, y, z ) {
	const group = new Group(); group.position.set( x, y, z );
	group.name = 'V34 ancient carved standing stone, physical plinth and reactive glyph';
	const shale = [ 0x64736b, 0x7b8577, 0x59665b, 0x8c907e, 0x52615c, 0x717c71 ];
	const weathered = 0x6c776f, carved = 0x333e39, oxidized = 0x497c74;
	const pieces = [
		part( cylinder( 1.94, 2.25, .58, 11 ), 0x454f49, 0, .265, 0, 1, 1, 1, 0, .95 ),
		part( cylinder( 1.82, 1.98, .19, 11 ), shale[ 1 ], 0, .51, 0, 1, 1, 1, 0, .93 ),
		// Relic silhouette and relief details stay within the physical tablet box.
		part( box( 1.26, 2.40, .55 ), weathered, 0, 1.67, 0, 1, 1, 1, 0, .97 ),
		part( box( 1.08, .22, .65 ), shale[ 3 ], 0, 3.0, 0, 1, 1, 1, 0, .94 ),
		part( box( 1.35, .19, .68 ), 0x474f49, 0, .61, 0, 1, 1, 1, 0, .96 ),
	];
	// Hundreds of small offset chisel scars break up the cuboid front surface.
	for ( let row = 0; row < 20; row ++ ) {
		for ( let col = 0; col < 7; col ++ ) {
			const seed = ( row * 71 + col * 43 + row * col * 17 ) % 37;
			if ( seed < 10 ) continue;
			const bx = -.54 + col * .18 + ( row % 2 ) * .028;
			const by = .70 + row * .113, depth = .284 + seed * .00033;
			pieces.push( part( box( .135, .081, .014 ), shale[ seed % shale.length ],
				bx, by, depth, 1, 1, 1, 0, .96, PAT.plain ) );
		}
	}
	for ( const yy of [ .72, 2.77 ] ) {
		pieces.push( part( box( 1.27, .077, .098 ), carved, 0, yy, .323 ) );
	}
	for ( const bx of [ -.57, .57 ] ) {
		pieces.push( part( box( .08, 2.08, .11 ), oxidized, bx, 1.75, .321 ) );
	}
	// Actual approach stairs match the V33 collision surfaces: no invisible steps.
	for ( const [ zz, top, depth ] of [ [ 3.62, .18, .96 ], [ 3.04, .36, .98 ], [ 2.51, .53, .94 ] ] ) {
		pieces.push( part( box( 1.92, top, depth ), shale[ ( Math.round( zz * 9 ) ) % shale.length ],
			0, top / 2, zz, 1, 1, 1, 0, .98, PAT.plain ) );
		for ( const side of [ -.83, .83 ] ) pieces.push( part( box( .11, .04, .70 ), carved,
			side, top + .021, zz, 1, 1, 1, 0, .96 ) );
	}
	for ( let i = 0; i < 12; i ++ ) {
		const a = i * Math.PI / 6, rr = 2.18;
		pieces.push( part( cylinder( .16, .25, i % 3 ? .45 : .58, 8 ), shale[ i % shale.length ],
			Math.sin( a ) * rr, .19, Math.cos( a ) * rr ) );
		if ( i % 3 === 0 ) pieces.push( part( sphere( .075, 8, 6 ), oxidized,
			Math.sin( a ) * rr, .52, Math.cos( a ) * rr ) );
	}
	// Subtle triangular language made of jointed cutstone inlay. Separate mesh
	// can be lit during the discovery task without changing collision physics.
	object( pieces, group, true );
	const glyph = new Group(); group.add( glyph ); glyph.name = 'stone inscription activation';
	const lines = [ part( torus( .29, .022, 7, 32 ), oxidized, 0, 1.82, .31 ),
		part( sphere( .055, 9, 7 ), 0x9cc8aa, 0, 1.82, .345 ) ];
	for ( let j = 0; j < 8; j ++ ) {
		const a = j * Math.PI / 4, radius = .47;
		lines.push( part( box( .11, .028, .012 ), j % 2 ? 0x819e87 : oxidized,
			Math.cos( a ) * radius, 1.82 + Math.sin( a ) * radius, .337, 1, 1, 1, 0, .70 ) );
	}
	object( lines, glyph );
	group.glyph = glyph;
	return group;
}

export function createCorruptionMote() {
	const group = new Group(); group.name = 'V31 tidal corruption firefly';
	object( [ part( sphere( .24, 9, 7 ), 0x9168dc ),
		part( torus( .37, .025, 5, 13 ), cyan ) ], group );
	return group;
}

const creatureColors = { crab: 0x314f55, hound: 0x344252, wraith: 0x576a7e, warden: 0x55676d, corsair: 0x364655 };
export function createLandCreature( type ) {
	const group = new Group(); group.name = `V31 ${type}`;
	const body = new Group(); group.add( body );
	const scale = type === 'warden' ? 2.15 : type === 'corsair' ? 1.08 : type === 'crab' ? 1.13 : 1;
	body.scale.setScalar( scale );
	const base = creatureColors[ type ];
	const isCrab = type === 'crab';
	const isWarden = type === 'warden';
    const isCorsair = type === 'corsair';
	object( [ part( sphere( 1, 13, 9 ), base, 0, isCrab ? .73 : 1.05, 0, isCrab ? 1.15 : .58, isCrab ? .54 : .95, isCrab ? .78 : .44 ),
		part( sphere( 1, 10, 8 ), dark, 0, isCrab ? .70 : 1.6, .4, .42, .37, .33 ),
		part( sphere( .055, 8, 6 ), isCorsair ? 0xddd2a8 : cyan, -.18, isCrab ? .84 : 1.64, .68 ),
		part( sphere( .055, 8, 6 ), isCorsair ? 0xddd2a8 : cyan, .18, isCrab ? .84 : 1.64, .68 ),
		part( cylinder( .18, .35, .66, 7 ), red, 0, isCrab ? 1.42 : 2.22, .02 ) ], body, true );
	// Silhouette-specific forms replace the former colour-swapped generic blob.
	// These meshes are still intentional in-game fallback art until real rigged
	// creature GLBs pass the skin/animation/asset license audit.
	const details = [];
	if ( type === 'crab' ) {
		details.push( part( sphere( 1, 20, 12 ), 0x647b6b, 0, 1.02, -.06, 1.26, .30, .99 ) );
		for ( let j = -3; j <= 3; j ++ ) details.push( part( rod(
			new Vector3( j * .27, 1.20, -.75 ), new Vector3( j * .31, 1.38, .64 ), .027, 6 ), bone ) );
		for ( const s of [ -1, 1 ] ) {
			details.push( part( rod( new Vector3( s * .23, 1.02, .50 ), new Vector3( s * .31, 1.42, .64 ), .09, 7 ), dark ) );
			details.push( part( sphere( .14, 9, 7 ), cyan, s * .31, 1.48, .65 ) );
		}
	} else if ( type === 'hound' ) {
		details.push( part( sphere( 1, 14, 10 ), 0x455769, 0, 1.10, .69, .33, .30, .73 ) );
		details.push( part( sphere( 1, 12, 9 ), dark, 0, .94, 1.17, .37, .21, .27 ) );
		for ( const s of [ -1, 1 ] ) {
			details.push( part( cylinder( .02, .22, .56, 7 ), 0x394d60, s * .29, 2.06, .39, 1, 1, 1, s * .21 ) );
			details.push( part( rod( new Vector3( s * .35, 1.00, -.60 ),
				new Vector3( s * .38, 1.45, -1.21 ), .13, 8 ), 0x455769 ) );
			for ( const zz of [ .20, .57 ] ) details.push( part( cylinder( 0, .095, .29, 5 ), bone,
				s * .27, .77, zz, 1, 1, 1, s * .25 ) );
		}
	} else if ( type === 'wraith' ) {
		details.push( part( cylinder( .15, .88, 1.88, 12 ), 0x516377, 0, .64, -.07 ) );
		details.push( part( cylinder( .55, .37, 1.16, 12 ), dark, 0, 1.91, .21 ) );
		details.push( part( sphere( 1, 12, 8 ), 0x263848, 0, 1.68, .52, .34, .36, .13 ) );
		for ( const s of [ -1, 1 ] ) for ( let i = 0; i < 3; i ++ ) details.push( part( rod(
			new Vector3( s * ( .30 + i * .22 ), 1.34, -.21 ),
			new Vector3( s * ( .52 + i * .31 ), -.50 - i * .15, -.34 ), .09, 6 ), 0x637788 ) );
	} else if ( type === 'warden' || isCorsair ) {
		details.push( part( box( .92, 1.45, .58 ), 0x263d48, 0, 1.40, .22, 1, 1, 1, 0, .54, PAT.rusty ) );
		for ( const s of [ -1, 1 ] ) {
			details.push( part( sphere( 1, 13, 9 ), stoneHi, s * .70, 1.74, -.05, .52, .28, .57 ) );
			details.push( part( rod( new Vector3( s * .30, 2.20, .13 ),
				new Vector3( s * .80, 3.03, -.22 ), .10, 9 ), bone ) );
			details.push( part( box( .13, .64, .18 ), bronze, s * .27, 1.30, .62 ) );
		}
		details.push( part( sphere( 1, 11, 9 ), dark, 0, 2.14, .32, .39, .47, .35 ) );
		details.push( part( box( .60, .13, .12 ), cyan, 0, 2.18, .68 ) );
		for ( let i = 0; i < 4; i ++ ) details.push( part( box( .73 - i * .09, .12, .33 ), bronze,
			0, .95 + i * .21, .57 ) );
		// A high shoulder-mounted corrosion blade gives the boss its own outline.
		details.push( part( rod( new Vector3( 1.05, .74, -.18 ),
			new Vector3( 1.12, 3.26, -.38 ), .09, 9 ), dark ) );
		details.push( part( box( .22, 1.48, .13 ), stoneHi, 1.12, 2.56, -.38 ) );
	}
	if ( details.length ) object( details, body, true );
	const limbs = [];
	for ( const side of [ -1, 1 ] ) for ( let j = 0; j < ( isCrab ? 3 : 2 ); j ++ ) {
		const leg = new Group(); leg.position.set( side * ( isCrab ? .82 : .40 ), isCrab ? .72 : .85, ( j - .5 ) * .55 ); body.add( leg );
		object( [ part( rod( new Vector3( 0, 0, 0 ), new Vector3( side * .46, -.66, .1 ), isCrab ? .13 : .16, 7 ), base ),
			part( sphere( .19, 8, 6 ), bone, side * .46, -.67, .1, 1, .42, 1 ) ], leg );
		limbs.push( leg );
	}
	const claw = new Group(); claw.position.set( 0, isCrab ? .88 : 1.42, .5 ); body.add( claw );
	object( [ part( sphere( .35, 9, 7 ), dark, -.32, 0, .3, .68, 1, 1 ),
		part( sphere( .35, 9, 7 ), dark, .32, 0, .3, .68, 1, 1 ),
		part( sphere( .16, 8, 6 ), red, 0, -.11, .52, 1.3, 1, 1 ) ], claw );
	const ring = new Group(); ring.visible = false; group.add( ring );
	object( [ part( torus( isWarden ? 4.0 : 1.85, .065, 6, 28 ), red ) ], ring );
	ring.position.y = .09; ring.rotation.x = -Math.PI / 2;
	return { group, body, limbs, claw, ring, scale };
}

export function createLandAnimal( kind ) {
	const group = new Group(), body = new Group(); group.add( body );
	const fox = kind === 'fox', boar = kind === 'boar';
	const fur = fox ? 0xb98249 : boar ? 0x675144 : 0xa99062;
	const height = fox ? .56 : boar ? .82 : 1.2;
	object( [ part( sphere( 1, 10, 8 ), fur, 0, height, 0, fox ? .52 : .72, fox ? .34 : .49, fox ? .84 : .9 ),
		part( sphere( .55, 10, 8 ), fur, 0, height + .25, .68, .77, .68, .78 ),
		part( sphere( .14, 8, 6 ), dark, 0, height + .16, 1.10 ),
		part( sphere( .09, 6, 5 ), dark, -.20, height + .42, 1.02 ),
		part( sphere( .09, 6, 5 ), dark, .20, height + .42, 1.02 ) ], body );
	const markings = [];
	if ( fox ) {
		markings.push( part( sphere( 1, 12, 8 ), 0xe8cda3, 0, height - .10, .34, .42, .13, .68 ) );
		for ( const s of [ -1, 1 ] ) markings.push( part( cylinder( 0, .15, .42, 5 ), fur,
			s * .28, height + .62, .62, 1, 1, 1, s * .21 ) );
	} else if ( boar ) {
		markings.push( part( sphere( 1, 13, 9 ), 0x806650, 0, height + .15, .65, .63, .53, .47 ) );
		markings.push( part( sphere( 1, 12, 8 ), 0xb0907b, 0, height + .05, 1.28, .39, .25, .19 ) );
		for ( const s of [ -1, 1 ] ) {
			markings.push( part( cylinder( 0, .13, .38, 7 ), bone, s * .38, height + .14, 1.11, 1, 1, 1, s * .22 ) );
			for ( let k = 0; k < 4; k ++ ) markings.push( part( cylinder( 0, .11, .22, 5 ), dark,
				s * ( .14 + k * .10 ), height + .63, -.38 + k * .12 ) );
		}
	} else {
		// Antlers, long neck and wide attentive ears for the deer.
		markings.push( part( cylinder( .23, .32, .92, 9 ), fur, 0, height + .64, .62, 1, 1, 1, -.28 ) );
		for ( const s of [ -1, 1 ] ) {
			markings.push( part( sphere( 1, 10, 8 ), fur, s * .46, height + .58, .72, .38, .12, .18 ) );
			markings.push( part( rod( new Vector3( s * .20, height + .83, .71 ),
				new Vector3( s * .58, height + 1.90, .58 ), .058, 7 ), 0x76634a ) );
			for ( let j = 0; j < 3; j ++ ) markings.push( part( rod(
				new Vector3( s * ( .31 + .09 * j ), height + 1.18 + j * .26, .65 ),
				new Vector3( s * ( .60 + .13 * j ), height + 1.40 + j * .26, .92 ), .035, 6 ), 0x76634a ) );
		}
	}
	if ( markings.length ) object( markings, body );
	const legs = [];
	for ( const side of [ -1, 1 ] ) for ( const front of [ -1, 1 ] ) {
		const limb = new Group(); limb.position.set( side * .35, height * .9, front * .48 ); body.add( limb );
		object( [ part( cylinder( .07, .12, height * .75, 6 ), fur, 0, -height * .38, 0 ) ], limb );
		legs.push( limb );
	}
	const tail = new Group(); tail.position.set( 0, height + .16, -.77 ); body.add( tail );
	object( [ part( sphere( .33, 8, 6 ), fox ? 0xe3bf82 : fur, 0, 0, -.32, .7, .48, 1.6 ) ], tail );
	return { group, body, legs, tail };
}

export function createVillageResident( variant = 0 ) {
	const root = new Group(); root.name = `V31 living villager ${variant}`;
	const main = new Group(); root.add( main );
	const shirt = [ 0xb68258, 0x567f88, 0x85805a ][ variant % 3 ];
	const hat = [ 0x665346, 0x374c59, 0x756249 ][ variant % 3 ];
	object( [ part( sphere( 1, 12, 8 ), shirt, 0, 1.06, 0, .31, .46, .20 ),
		part( sphere( 1, 12, 8 ), 0xe1b38c, 0, 1.65, .03, .24, .28, .22 ),
		part( cylinder( .29, .29, .16, 12 ), hat, 0, 1.92, 0 ),
		part( cylinder( .47, .47, .055, 12 ), hat, 0, 1.84, 0 ),
		part( box( .56, .25, .27 ), dark, 0, .64, -.02 ),
		part( sphere( .025, 6, 5 ), dark, -.082, 1.68, .24 ),
		part( sphere( .025, 6, 5 ), dark, .082, 1.68, .24 ) ], main );
	const arms = [], legs = [];
	for ( const side of [ -1, 1 ] ) {
		const arm = new Group(); arm.position.set( side * .33, 1.32, 0 ); main.add( arm );
		object( [ part( cylinder( .095, .11, .55, 7 ), shirt, side * .035, -.25, 0 ),
			part( sphere( .12, 8, 6 ), 0xe1b38c, side * .035, -.55, 0 ) ], arm );
		arms.push( arm );
		const leg = new Group(); leg.position.set( side * .15, .63, 0 ); main.add( leg );
		object( [ part( cylinder( .11, .12, .50, 7 ), dark, 0, -.23, 0 ),
			part( box( .25, .13, .31 ), hat, 0, -.50, .08 ) ], leg );
		legs.push( leg );
	}
	return { group: root, main, arms, legs };
}

export function createSlashArc() {
	const group = new Group(); group.visible = false;
	object( [ part( torus( .75, .035, 6, 26, Math.PI * 1.25 ), cyan ),
		part( sphere( .11, 7, 5 ), bone, -.62, .35, 0 ) ], group );
	return group;
}

export function createTideBlade() {
	const group = new Group(); group.name = 'V31 first person tideblade';
	const blade = object( [
		part( box( .11, 1.00, .055 ), 0x9bcfd6, 0, .61, 0, 1, 1, 1, 0, .28 ),
		part( box( .047, .78, .085 ), cyan, 0, .66, .027, 1, 1, 1, 0, .25 ),
		part( cylinder( .07, .07, .40, 9 ), dark, 0, -.12, 0 ),
		part( box( .45, .095, .11 ), bronze, 0, .12, 0 ),
		part( sphere( .11, 9, 6 ), stone, 0, -.37, 0 ),
	], group );
	blade.frustumCulled = false;
	return group;
}

