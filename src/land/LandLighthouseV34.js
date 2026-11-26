import { Group, Mesh, Vector3 } from '../engine/index.js';
import { prepare, mergePrepared, cylinder, sphere, box, torus, rod, mat4 } from '../world/boat/GeoKit.js';
import { PAT } from '../game/GameMaterials.js';
import { landMaterial } from './LandModels.js';

// All dimensions are in real-world metres; a single source of truth feeds
// visible treads, player collision, the beacon, and interaction distances.
export const LIGHTHOUSE_V34 = Object.freeze( {
    height: 45.25,
    baseRadius: 6.55,
    courses: 60,
    courseHeight: .618,
    stepCount: 154,
    stepRise: .245,
    stairRadius: 4.4,
    stairTurn: Math.PI * 2 / 34,
    beaconHeight: 40.7,
    deckHeight: 38.3,
    doorFront: 6.25,
    doorHalfWidth: 1.55,
} );

const STONE = [ 0x667279, 0x75848b, 0x53636a, 0x819096, 0x5b6c72, 0x6d797c ];
const IRON = 0x36474b, VERDIGRIS = 0x668e88, DARK = 0x1a2c35, CYAN = 0x54e3d6;
const p = ( geo, tint, x = 0, y = 0, z = 0, yaw = 0, rough = .83, pattern = PAT.plain ) =>
    prepare( geo, { color: tint, rough, pattern, matrix: mat4( x, y, z, 0, yaw, 0 ) } );
const combined = ( parts, parent, shadow = true ) => {
    const mesh = new Mesh( mergePrepared( parts ), landMaterial );
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add( mesh );
    return mesh;
};
const radiusAt = y => 6.09 - 1.55 * Math.min( 1, Math.max( 0, y / 37.8 ) );

function isOpening( course, sector, sectors ) {
    // Real apertures: ground-floor entrance and three staggered window tiers.
    const signed = sector <= sectors / 2 ? sector : sector - sectors;
    if ( course < 7 && Math.abs( signed ) <= 2 ) return true;
    if ( [ [ 14, 17, 10 ], [ 29, 32, 30 ], [ 44, 47, 20 ] ].some(
        ( [ first, last, target ] ) => course >= first && course <= last && Math.abs( sector - target ) <= 1 ) ) return true;
    return false;
}

export function createLighthouseV34( x, y, z ) {
    const C = LIGHTHOUSE_V34;
    const group = new Group();
    group.name = 'V34 44m walk-in lighthouse — hollow stone courses, spiral stairs, keeper annex';
    group.position.set( x, y, z );
    const parts = [
        p( cylinder( 6.63, 6.8, .8, 48 ), 0x3e4d57, 0, 0, 0 ),
        p( cylinder( 6.55, 6.55, .21, 48 ), 0xa19684, 0, .49, 0 ),
        p( cylinder( 1.08, 1.14, 38.1, 24 ), DARK, 0, 19.1, 0 ),
    ];
    // Face-by-face masonry is geometry, not a solid cylinder: entering the door
    // exposes a real empty shaft. Brick shifts break vertical seam repetition.
    const sectors = 40;
    for ( let course = 0; course < C.courses; course ++ ) {
        const cy = .60 + course * C.courseHeight;
        const radius = radiusAt( cy );
        const width = 2 * Math.PI * radius / sectors * 1.075;
        for ( let j = 0; j < sectors; j ++ ) {
            if ( isOpening( course, j, sectors ) ) continue;
            const a = j * Math.PI * 2 / sectors;
            const hash = ( course * 17 + j * 31 + ( course * j ) % 9 ) % STONE.length;
            const brickHeight = C.courseHeight * ( .965 + ( ( j * 7 + course ) % 5 ) * .004 );
            parts.push( p( box( width, brickHeight, .82 ), STONE[ hash ],
                Math.sin( a ) * radius, cy, Math.cos( a ) * radius, a ) );
        }
        if ( course % 10 === 0 ) {
            // Slightly projecting string courses help the silhouette at distance.
            parts.push( p( cylinder( radius + .38, radius + .38, .16, 48, 1, true ), 0x9da69e, 0, cy - .29, 0 ) );
        }
    }
    // Window frames are real holes in masonry, with mullions, sills and trim.
    for ( const [ h, a ] of [ [ 10.1, Math.PI / 2 ], [ 19.4, - Math.PI / 2 ], [ 28.7, Math.PI ] ] ) {
        const r = radiusAt( h );
        const cx = Math.sin( a ) * ( r + .37 ), cz = Math.cos( a ) * ( r + .37 );
        parts.push( p( box( 2.45, .24, .95 ), 0x9a9f96, cx, h + 1.3, cz, a ) );
        parts.push( p( box( 2.5, .23, 1.02 ), 0x464e50, cx, h - 1.25, cz, a ) );
        for ( const side of [ -1, 1 ] ) {
            const tx = cx + Math.cos( a ) * side * 1.14;
            const tz = cz - Math.sin( a ) * side * 1.14;
            parts.push( p( box( .25, 2.45, .55 ), 0xadb0a7, tx, h, tz, a ) );
        }
        parts.push( p( box( .09, 2.05, .24 ), VERDIGRIS, cx, h, cz, a ) );
        parts.push( p( box( 1.88, .09, .24 ), VERDIGRIS, cx, h, cz, a ) );
    }
    // Entry portal projects from the tower. The door itself is a separate
    // pivoted object, not welded to the static masonry mesh.
    for ( const sign of [ -1, 1 ] ) {
        parts.push( p( box( .54, 4.22, 1.03 ), 0xb6ae9f, sign * 1.87, 2.4, 6.07 ) );
        parts.push( p( box( .29, 3.82, .7 ), IRON, sign * 1.54, 2.32, 6.31 ) );
    }
    parts.push( p( box( 4.3, .56, 1.06 ), 0xa2a39a, 0, 4.61, 6.12 ) );
    parts.push( p( box( 3.85, .24, .8 ), 0x455a62, 0, 5.01, 6.10 ) );
    parts.push( p( box( 3.55, .23, 1.34 ), 0x8c9188, 0, .18, 6.08 ) );
    // A separate one-floor keeper's annex, roof and recessed windows.
    parts.push( p( box( 7.2, 3.65, 5.2 ), 0x555e5a, -11, 1.87, 1.1 ) );
    parts.push( p( box( 8.1, .52, 6.14 ), 0x504443, -11, 4.05, 1.1, 0, .92, PAT.wood ) );
    for ( const bx of [ -13.9, -8.2 ] ) {
        parts.push( p( box( 1.25, 1.6, .17 ), DARK, bx, 2.12, 3.78 ) );
        parts.push( p( box( 1.42, .16, .45 ), 0x9fa9a6, bx, 3.03, 3.80 ) );
        parts.push( p( box( .16, 1.72, .35 ), VERDIGRIS, bx, 2.13, 3.91 ) );
    }
    combined( parts, group );

    const stairParts = [], steps = [];
    for ( let i = 0; i < C.stepCount; i ++ ) {
        const a = i * C.stairTurn;
        const top = .5 + ( i + 1 ) * C.stepRise;
        const r = radiusAt( top ) - 1.65;
        const xx = Math.sin( a ) * r, zz = Math.cos( a ) * r;
        const width = Math.min( 1.13, Math.max( .75, r * C.stairTurn * 1.06 ) );
        // Tangential stair tread with 10cm overlap, supported by the central
        // steel stringer. This is a physical, continuous 154-step stairway.
        stairParts.push( p( box( width, .20, 1.65 ), i % 3 ? 0x7c8887 : 0xa1a79f,
            xx, top - .10, zz, a, .63 ) );
        if ( i % 3 === 0 ) {
            const ir = r - 1.0, ax = Math.sin( a ) * ir, az = Math.cos( a ) * ir;
            stairParts.push( p( rod( new Vector3( ax, top, az ), new Vector3( ax, top + 1.0, az ), .04, 6 ), IRON ) );
            const b = a + 3 * C.stairTurn;
            const r2 = radiusAt( top + 3 * C.stepRise ) - 2.65;
            stairParts.push( p( rod( new Vector3( ax, top + 1, az ),
                new Vector3( Math.sin( b ) * r2, top + 1 + 3 * C.stepRise, Math.cos( b ) * r2 ), .056, 6 ), VERDIGRIS ) );
        }
        steps.push( { x: xx, z: zz, y: top, yaw: a, width, depth: 1.65, step: i } );
    }
    combined( stairParts, group );
    const galleryParts = [
        p( cylinder( 5.28, 5.28, .25, 48, 1, true ), 0xb69d71, 0, C.deckHeight + .15, 0 ),
        p( cylinder( 4.67, 4.67, 4.1, 48, 1, true ), 0x3a737c, 0, 40.65, 0 ),
        p( cylinder( 5.21, 5.21, .34, 48 ), 0x9b9f96, 0, 42.82, 0 ),
        p( cylinder( 0, 5.45, 1.34, 48 ), VERDIGRIS, 0, 43.65, 0 ),
        p( rod( new Vector3( 0, 44.25, 0 ), new Vector3( 0, 45.25, 0 ), .07, 8 ), IRON ),
    ];
    // Glassed beacon panels, mullions and a protective outer balustrade.
    for ( let i = 0; i < 32; i ++ ) {
        const a = i * Math.PI / 16;
        galleryParts.push( p( box( .12, 4.0, .22 ), VERDIGRIS,
            Math.sin( a ) * 4.7, 40.68, Math.cos( a ) * 4.7, a ) );
        galleryParts.push( p( box( .095, 1.18, .13 ), 0xbaaa87,
            Math.sin( a ) * 5.28, 38.91, Math.cos( a ) * 5.28, a ) );
        if ( i % 2 === 0 ) {
            const b = a + Math.PI / 16;
            galleryParts.push( p( rod( new Vector3( Math.sin( a ) * 5.28, 39.43, Math.cos( a ) * 5.28 ),
                new Vector3( Math.sin( b ) * 5.28, 39.43, Math.cos( b ) * 5.28 ), .045, 6 ), VERDIGRIS ) );
        }
    }
    // An annular mezzanine leaves the central helical stair void open. A solid
    // disk here would be an invisible ceiling in the last two metres of climb.
    for ( let j = 0; j < 48; j ++ ) {
        const a = j * 2 * Math.PI / 48;
        const r = 4.45;
        galleryParts.push( p( box( .66, .22, 1.55 ), j % 4 ? 0x657579 : 0x8f9290,
            Math.sin( a ) * r, C.deckHeight - .11, Math.cos( a ) * r, a ) );
    }
    combined( galleryParts, group );

    const hinge = new Group();
    hinge.position.set( C.doorHalfWidth, .52, C.doorFront );
    hinge.name = 'lighthouse hinged oak entrance';
    group.add( hinge );
    const doorParts = [ p( box( 3.1, 3.67, .17 ), 0x5f4734, -C.doorHalfWidth, 1.835, 0, 0, .9, PAT.wood ) ];
    for ( const yy of [ .45, 1.82, 3.15 ] ) {
        doorParts.push( p( box( 2.96, .13, .28 ), 0x3a4b4b, -C.doorHalfWidth, yy, 0, 0, .5, PAT.rusty ) );
    }
    for ( const bx of [ -2.80, -2.26, -1.72, -1.18, -.64 ] )
        doorParts.push( p( box( .035, 3.45, .04 ), 0x937357, bx, 1.82, .12, 0, .93, PAT.wood ) );
    doorParts.push( p( sphere( .12, 12, 8 ), 0xe4bd6f, -2.75, 1.65, .25 ) );
    combined( doorParts, hinge );

    const beacon = new Group(); beacon.position.y = C.beaconHeight; group.add( beacon );
    combined( [ p( torus( 1.16, .13, 7, 30 ), 0xffd78c ),
        p( sphere( .42, 16, 12 ), CYAN ) ], beacon, false );
    const beaconGlow = combined( [ p( sphere( 1.5, 16, 12 ), CYAN, 0, C.beaconHeight, 0 ) ], group, false );
    beaconGlow.visible = false;
    return { group, door: hinge, beacon, beaconGlow, steps,
        beaconHeight: C.beaconHeight, height: C.height, doorOpen: false, doorAnim: 0 };
}
