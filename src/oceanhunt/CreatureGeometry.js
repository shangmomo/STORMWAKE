import { Group, Mesh, Vector3 } from '../engine/index.js';
import { GeoKit, sphere, rod, cylinder, torus, tube, fanCap, mat4 } from '../world/boat/GeoKit.js';

const V = ( x, y, z ) => new Vector3( x, y, z );

// All creature parts carry vertex colours, normal, uv and material roughness.
// A whole non-articulated body is merged into a single draw call. Only limbs
// that actually move are separate meshes; no 200-object primitive stack.
function paint( kit, geo, color, matrix, metal = 0 ) {
	kit.add( 'skin', geo, { color, rough: 0.77, metal, ...( matrix ? { matrix } : {} ) } );
}
function oval( k, x, y, z, sx, sy, sz, c, quality = 16 ) {
	paint( k, sphere( 1, quality, 11 ), c, mat4( x, y, z, 0, 0, 0, sx, sy, sz ) );
}
function line( k, p, q, r, c, n = 8, endRadius = r ) {
	paint( k, rod( V( ...p ), V( ...q ), r, n, endRadius ), c );
}
function cone( k, x, y, z, h, r, c, rx = 0, rz = 0 ) {
	paint( k, cylinder( 0, r, h, 9 ), c, mat4( x, y, z, rx, 0, rz ) );
}
function wing( k, a, b, c, color ) {
	const geo = fanCap( [ V( ...a ), V( ...b ), V( ...c ) ], V( 0, 0, 1 ) );
	paint( k, geo, color );
}
function mesh( kit, material, name ) {
	const geo = kit.merged( 'skin' );
	const m = new Mesh( geo, material );
	m.name = name;
	m.castShadow = false; m.receiveShadow = true;
	return m;
}

function shark( root, material ) {
	const k = new GeoKit();
	oval( k, 0, 0, - 0.7, 3.3, 2.45, 9.1, 0x6a8791, 24 );
	oval( k, 0, - 1.38, 0.55, 2.65, 1.15, 7.15, 0xe0ddd0, 22 );
	oval( k, 0, 0.23, 7.22, 1.8, 1.13, 2.6, 0x839ba1 );
	cone( k, 0, 4.1, - 0.6, 5.5, 1.85, 0x425c66, 0.49 );
	for ( const side of [ - 1, 1 ] ) {
		wing( k, [ side * 2.25, 0.25, 1.3 ], [ side * 9.3, - 1.95, - 4.5 ], [ side * 1.95, - 0.55, - 3.5 ], 0x3d6671 );
		wing( k, [ side * 1.05, - 0.2, - 5.75 ], [ side * 3.25, - 0.16, - 8.9 ], [ side * 0.8, - 0.63, - 8.1 ], 0x4a7480 );
		oval( k, side * 1.65, 0.49, 5.47, 0.32, 0.31, 0.30, 0x101d27 );
		oval( k, side * 1.82, 0.52, 5.59, 0.075, 0.07, 0.08, 0xf7edc7 );
		for ( let j = 0; j < 5; j ++ ) line( k, [ side * ( 2.56 + j * 0.03 ), 0.16, 3.25 - j * 0.51 ], [ side * 2.65, - 1.32, 3.2 - j * 0.51 ], 0.055, 0x324550, 5 );
		for ( let i = 0; i < 9; i ++ ) cone( k, side * ( 0.25 + i * 0.19 ), - 1.98, 6.30 - i * 0.28, 0.39, 0.12, 0xf3edd3, Math.PI );
	}
	root.add( mesh( k, material, 'GreatWhite_BodyFinsGillsTeeth' ) );
	const tail = new Group(); tail.position.set( 0, 0, - 9.1 );
	const t = new GeoKit(); line( t, [ 0, 0, 0 ], [ 0, 0, - 3.3 ], 0.7, 0x567581 );
	wing( t, [ 0, 0, - 3 ], [ 0, 5.8, - 5.4 ], [ 0, 0, - 4.5 ], 0x426271 );
	wing( t, [ 0, 0, - 3 ], [ 0, - 4.6, - 4.1 ], [ 0, 0, - 4.5 ], 0x527580 );
	tail.add( mesh( t, material, 'GreatWhite_Tail' ) ); root.add( tail );
	return [ { group: tail, speed: 3.6, amount: 0.28, axis: 'y' } ];
}

function squid( root, material ) {
	const k = new GeoKit();
	oval( k, 0, 4.65, - 0.65, 3.4, 7.15, 3.25, 0xa87997, 24 );
	oval( k, 0, - 1.38, 0.6, 2.7, 2.75, 2.1, 0x86618b );
	// two angular upper fins, a proper crown and eight prominent eyes/suckers
	for ( const s of [ - 1, 1 ] ) {
		wing( k, [ s * 2.1, 6.3, - 0.65 ], [ s * 6.9, 10.4, - 3.55 ], [ s * 2.9, 11.8, - 0.7 ], 0x76597f );
		oval( k, s * 2.07, - 1.35, 2.14, 0.77, 0.84, 0.55, 0xe6c990 );
		oval( k, s * 2.44, - 1.35, 2.52, 0.27, 0.38, 0.16, 0x11172c );
	}
	cone( k, 0, - 3.26, 1.45, 2.0, 0.72, 0x2f273d, Math.PI );
	root.add( mesh( k, material, 'Kraken_MantleFinEyesBeak' ) );
	const limbs = [];
	for ( let j = 0; j < 10; j ++ ) {
		const a = Math.PI * 2 * j / 10, s = j < 8 ? 1 : 1.35;
		const x = Math.cos( a ) * 1.5, z = Math.sin( a ) * 1.35;
		const points = [];
		for ( let i = 0; i <= 9; i ++ ) {
			const t = i / 9;
			points.push( V( x + Math.cos( a ) * ( 12 * s * t + Math.sin( t * 2 * Math.PI ) * 1.3 ),
				- 3.2 + Math.sin( t * 2.9 ) * ( 5.4 * s ) + t * 2.2,
				z + Math.sin( a ) * ( 13 * s * t ) + Math.sin( t * 4 ) * 1.9 ) );
		}
		const t = new GeoKit();
		paint( t, tube( points, j >= 8 ? 0.36 : 0.52, 26, 9 ), j % 2 ? 0xa77ba1 : 0x84648e );
		for ( let i = 2; i < 9; i += 2 ) {
			const p = points[ i ];
			oval( t, p.x, p.y - 0.45, p.z, 0.38, 0.11, 0.41, 0xe4bac0, 9 );
		}
		const limb = new Group(); limb.add( mesh( t, material, `Kraken_Tentacle_${ j }` ) );
		root.add( limb );
		limbs.push( { group: limb, speed: 0.7 + j * 0.07, amount: 0.12, axis: j % 2 ? 'z' : 'x', phase: j * 1.7 } );
	}
	return limbs;
}

function turtle( root, material ) {
	const k = new GeoKit();
	oval( k, 0, 0, 0, 8.2, 3.75, 9.6, 0x486d54, 24 );
	oval( k, 0, - 1.9, 0, 7.6, 1.34, 8.8, 0xbcaa7d, 20 );
	oval( k, 0, 0.1, 9.25, 2.55, 2.2, 4.5, 0x7e9f75 );
	oval( k, 0, - 1.35, 12.35, 1.45, 0.7, 1.75, 0xb0b084 );
	for ( const s of [ - 1, 1 ] ) {
		oval( k, s * 1.5, 0.85, 11.55, 0.32, 0.34, 0.32, 0x101f1e );
		oval( k, s * 1.7, 0.95, 11.7, 0.075, 0.075, 0.065, 0xe5f6db );
	}
	// raised hex-like carapace scutes in concentric ridges (not a flat dome)
	for ( let ring = 0; ring < 3; ring ++ ) {
		const rx = 2.3 + ring * 2.22, rz = 2.7 + ring * 2.4;
		for ( let i = 0; i < 10; i ++ ) {
			const a = i / 10 * Math.PI * 2, b = ( i + 1 ) / 10 * Math.PI * 2;
			const y1 = 3.7 * Math.sqrt( Math.max( 0.04, 1 - rx * rx / ( 8.7 * 8.7 ) ) ), y2 = y1;
			line( k, [ rx * Math.cos( a ), y1 + 0.17, rz * Math.sin( a ) ], [ rx * Math.cos( b ), y2 + 0.17, rz * Math.sin( b ) ], 0.11, 0xbca775, 6 );
		}
	}
	for ( const s of [ - 1, 1 ] ) for ( const z of [ - 5.7, 5.5 ] ) oval( k, s * 6.2, - 2.0, z, 2.3, 1.7, 2.1, 0x6a8e6f );
	root.add( mesh( k, material, 'Shellback_CarapaceScutesNeckHead' ) );
	const flippers = [];
	for ( const side of [ - 1, 1 ] ) for ( const fore of [ - 1, 1 ] ) {
		const f = new GeoKit(), z = fore * 5.3;
		line( f, [ side * 6.1, - 1.9, z ], [ side * 13.6, - 3.6, z + fore * 4.3 ], 1.0, 0x749f88, 12, 0.35 );
		oval( f, side * 13.4, - 3.6, z + fore * 4.3, 1.9, 0.35, 1.05, 0x83ac8c );
		const g = new Group(); g.add( mesh( f, material, `Shellback_Flipper_${ side }_${ fore }` ) ); root.add( g );
		flippers.push( { group: g, speed: 0.75, amount: 0.13, axis: 'z', phase: side * 1.6 + fore * 0.65 } );
	}
	return flippers;
}

function leviathan( root, material ) {
	const k = new GeoKit();
	for ( let i = 0; i < 18; i ++ ) {
		const z = 20.5 - i * 2.7, x = Math.sin( i * 0.4 ) * 2.8;
		const taper = 1 - i / 25;
		oval( k, x, Math.sin( i * 0.54 ) * 2, z, 3.15 * taper, 3.4 * taper, 3.25, i % 3 ? 0x426d78 : 0x55818a, 11 );
		if ( i % 2 === 0 ) cone( k, x, 3.9 * taper + Math.sin( i * 0.54 ) * 2, z, 3.7 * taper, 1.08 * taper, 0x9bd2cc, - 0.22 );
	}
	oval( k, 0, 0.95, 22, 4.5, 3.45, 6.5, 0x56808d, 23 );
	oval( k, 0, - 0.95, 27, 3.7, 1.4, 3.4, 0x2d5565, 16 );
	for ( const s of [ - 1, 1 ] ) {
		oval( k, s * 3.95, 1.9, 25.5, 0.64, 0.65, 0.28, 0xffc97b );
		oval( k, s * 4.24, 1.9, 25.65, 0.21, 0.25, 0.17, 0x233a42 );
		line( k, [ s * 2.45, 3.25, 24.2 ], [ s * 5.0, 7.8, 19.7 ], 0.59, 0x7fb4bb, 10, 0.1 );
		line( k, [ s * 2.6, - 0.3, 23.0 ], [ s * 7.2, - 3.45, 18.7 ], 0.44, 0x7fa0a8, 9, 0.13 );
		for ( let i = 0; i < 6; i ++ ) cone( k, s * ( 0.75 + i * 0.44 ), - 2, 27.45 - i * 0.3, 0.78, 0.26, 0xcbded6, Math.PI );
	}
	root.add( mesh( k, material, 'Leviathan_ArmoredSpineJawHorns' ) );
	const tail = new Group();
	const t = new GeoKit();
	wing( t, [ 0, 0, - 25 ], [ 10.2, 4.3, - 31.8 ], [ 0, 2, - 32 ], 0x78b4b1 );
	wing( t, [ 0, 0, - 25 ], [ - 10.2, 4.3, - 31.8 ], [ 0, 2, - 32 ], 0x78b4b1 );
	tail.add( mesh( t, material, 'Leviathan_TailFlukes' ) ); root.add( tail );
	return [ { group: tail, speed: 0.65, amount: 0.19, axis: 'y' } ];
}

export function createTitanModel( id, material ) {
	const root = new Group(); root.name = `SeaTitan_${ id }`;
	const rig = id === 'shark' ? shark( root, material ) : id === 'squid' ? squid( root, material ) :
		id === 'turtle' ? turtle( root, material ) : id === 'leviathan' ? leviathan( root, material ) : null;
	if ( ! rig ) throw new Error( 'Unknown sea titan: ' + id );
	root.traverse( child => { if ( child.isMesh ) child.frustumCulled = false; } );
	return { root, rig };
}
