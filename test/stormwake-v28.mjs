import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGLB } from '../src/engine/loaders/GLTF.js';
import { Vector3 } from '../src/engine/index.js';
import { upgradeLeviathanRig, animateLeviathanRig } from '../src/oceanhunt/LeviathanRig.js';
import { stepSubmarineDynamics, SUBMARINE_DRIVE } from '../src/oceanhunt/SubmarineDynamics.js';
import { AbyssRaid, ABYSS_STATS, sonarConeHit, abyssCameraPose, abyssRenderScale, cameraInsideLeviathan } from '../src/oceanhunt/AbyssRaid.js';

assert.equal( abyssRenderScale( 2438, 1419, 1 ), .6 );
assert.equal( abyssRenderScale( 1280, 720, 1 ), 1 );
assert.equal( abyssRenderScale( 2438, 1419, .5 ), .5 );
assert.equal( cameraInsideLeviathan( new Vector3( 0, 0, 0 ) ), true );
assert.equal( cameraInsideLeviathan( new Vector3( 150, 0, 0 ) ), false );
const scaleApp = { settings: { renderScale: .6 }, setRenderScale( v ) { this.settings.renderScale = v; } };
const scaleRaid = Object.assign( Object.create( AbyssRaid.prototype ), {
	app: scaleApp, abyssRenderScale: { previous: 1, applied: .6 },
} );
scaleRaid.restoreRenderScale();
assert.equal( scaleApp.settings.renderScale, 1 );
scaleRaid.abyssRenderScale = { previous: 1, applied: .6 };
scaleApp.settings.renderScale = .5;
scaleRaid.restoreRenderScale();
assert.equal( scaleApp.settings.renderScale, .5, 'respect manual quality changes during the encounter' );

const file = p => readFileSync( new URL( '../' + p, import.meta.url ), 'utf8' );
const app = file( 'src/App.js' );
const raid = file( 'src/oceanhunt/AbyssRaid.js' );
assert.match( app, /this\.input\.requestLock\(\)/ );
assert.doesNotMatch( raid, /this\.app\.input\.lookMode = 'rightDrag'/ );
assert.match( raid, /stepSubmarineDynamics\(/ );
assert.match( raid, /KeyG/ ); assert.match( raid, /KeyT/ ); assert.match( raid, /KeyZ/ );
assert.match( raid, /'waterjet', 'sonic'/ );

function vessel() { return { speed:0, yaw:0, yawRate:0, diveVelocity:0, pitch:0, subRoll:0 }; }
const sub = vessel();
for ( let n=0; n<180; n++ ) stepSubmarineDynamics( sub, { thrust: 1 }, 1/60 );
assert.ok( sub.speed >= SUBMARINE_DRIVE.cruise - .5, `cruise reached: ${sub.speed}` );
assert.ok( SUBMARINE_DRIVE.cruise > 60, 'sub outruns max Leviathan charge' );
for ( let n=0; n<60; n++ ) stepSubmarineDynamics( sub, { thrust: 1, turn: 1, flank: true }, 1/60 );
assert.ok( sub.yaw < -.85 && sub.yaw > -1.04, `screen-right helm is negative world yaw: ${sub.yaw}` );
assert.ok( sub.speed > 100 && sub.speed <= SUBMARINE_DRIVE.flank + .01, 'flank power advances beyond chase speed' );
for ( let n=0; n<60; n++ ) stepSubmarineDynamics( sub, { ballast: 1 }, 1/60 );
assert.ok( sub.diveVelocity > 24, 'independent ballast controls ascent even without thrust' );
for ( let n=0; n<100; n++ ) stepSubmarineDynamics( sub, { ballast:-1 }, 1/60 );
assert.ok( sub.diveVelocity < -24, 'independent dive works in neutral gear' );
assert.ok( ABYSS_STATS.maxSpeed >= 72 );

const center = new Vector3( 0, -100, 0 ), forward = new Vector3( 0, 0, 1 );
assert.equal( sonarConeHit( center, forward, new Vector3( 0,-100,110 ), 99, 111 ), true );
assert.equal( sonarConeHit( center, forward, new Vector3( 110,-100,0 ), 99, 111 ), false,
 'sonic projectile must not damage off-axis player' );
assert.equal( sonarConeHit( center, forward, new Vector3( 0,-100,-110 ), 99, 111 ), false,
 'sonic attack must not hit targets behind the creature' );
const poseA = abyssCameraPose( center, 0, 0, .24, 38 );
const poseB = abyssCameraPose( center, 0, .6, .24, 38 );
assert.notEqual( poseA.position.x, poseB.position.x );

// This uses the *actual licensed* GLB, not a fabricated joint-count fixture.
const bytes = readFileSync( new URL( '../public/models/titans/external/leviathan-monster.glb', import.meta.url ) );
const gltf = parseGLB( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ) );
const baseBoneCount = gltf.skins[0].joints.length;
const rig = upgradeLeviathanRig( gltf );
assert.ok( rig, 'licensed glTF supports real rig extension' );
assert.equal( baseBoneCount, 66 );
assert.equal( rig.addedBones, 70 );
assert.equal( rig.totalBones, 136 );
assert.equal( gltf.skins[0].inverseBindMatrices.length, 136*16 );
assert.ok( rig.influencedVertices > 5000, 'new bones have actual weighted vertices' );
const tailBone = rig.parts.find( x=>x.name === 'Caudal_R' ).bones[7];
const parentOfTail = gltf.nodes.findIndex( n => n.children.includes( tailBone.node ) );
assert.ok( /^GodSpine5[0-9]$/.test( gltf.nodes[parentOfTail].name ),
 'tail fin joints inherit the distal spine animation, not a rigid head attachment' );
const p = gltf.meshes[0][0].attributes;
assert.ok( p.JOINTS_0.array.some( joint => joint >= 66 ), 'actual vertex skin data references new joints' );
for ( let i=0; i<p.POSITION.array.length/3; i+=47 ) {
 const o = i*4, w = p.WEIGHTS_0.array;
 assert.ok( Math.abs( w[o] + w[o+1] + w[o+2] + w[o+3] - 1 ) < 0.012 );
}
const locals = gltf.nodes.map( n => ({ r: Float32Array.from( n.r ) }) );
const mockSkinned = {};
animateLeviathanRig( mockSkinned, rig, .3, 24, 'stalk', 0 );
mockSkinned.poseModifier( locals );
const fin = rig.parts.find( x=>x.name === 'Pectoral_L' ).bones[6];
const firstPose = Array.from( locals[ fin.node ].r );
animateLeviathanRig( mockSkinned, rig, .8, 48, 'charge', 1 );
mockSkinned.poseModifier( locals );
assert.notDeepEqual( Array.from( locals[fin.node].r ), firstPose, 'real additional fin bone flaps in swim' );
const jaw = rig.parts.find( x=>x.name === 'Mandible' ).bones[5];
assert.ok( Math.abs(locals[jaw.node].r[0]) > .025, 'jaw uses articulated bone motion' );

// Test real projectile path and swept hit volumes without a renderer.
const game = Object.create( AbyssRaid.prototype );
game.active = true; game.finished = false; game.godHP = 6100;
game.harpoonCooldown = 0; game.chargeCooldown = 0; game.counterPulseCooldown = 0;
game.pos = new Vector3( 0,-80,0 ); game.yaw = 0; game.pitch = 0;
game.forward = new Vector3(0,0,1); game.speed = 50;
game.godPos = new Vector3(0,-80,190); game.godForward = new Vector3(0,0,-1);
game.bossLock = true; game.torpedoes = []; game.depthCharges = []; game.waterJets = [];
game.projectileGeometry = {}; game.harpoonMaterial = {}; game.chargeMaterial = {}; game.jetMaterial = {};
game.sonarRing = { visible:false, position:{ copy(){} } };
game.app = { scene:{ add(){},remove(){} } }; game.showImpact = () => {};
assert.equal( game.fireHarpoon(), true );
assert.equal( game.torpedoes[0].kind, 'harpoon' );
assert.equal( game.dropDepthCharge(), true );
assert.equal( game.depthCharges.length, 1 );
game.launchWaterJet( 2 );
assert.equal( game.waterJets.length, 1 );
assert.ok( Math.abs( game.waterJets[0].velocity.length()-126 ) < 1e-5 );
game.counterPulse();
assert.ok( game.counterClock > 1 );

console.log( `V28 regression OK: pointer-lock helm, modernized ${SUBMARINE_DRIVE.flank}m/s flank, independent ballast, 136 live skin bones (${rig.influencedVertices} vertices), water cannon, sonar cone, harpoon, depth charge & counterpulse.` );
