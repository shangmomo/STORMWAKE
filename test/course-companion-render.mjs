// Optional headless WebGPU smoke check: node test/course-companion-render.mjs path/to/output.png
import { writePNG } from './headless.mjs';
import { GPU } from '../src/engine/gpu/GPU.js';
import { RenderTarget } from '../src/engine/gpu/Texture.js';
import { readTexture } from '../src/engine/gpu/Readback.js';
import { G, setFrameCamera } from '../src/engine/render/Frame.js';
import { Material } from '../src/engine/render/Material.js';
import { MeshRenderer } from '../src/engine/render/MeshRenderer.js';
import { SunShadows } from '../src/engine/render/Shadows.js';
import { FullscreenPass } from '../src/engine/render/FullscreenPass.js';
import * as E from '../src/engine/index.js';
import { CompanionActor } from '../src/course/CompanionActor.js';

if ( ! process.argv[ 2 ] ) throw new Error( 'Provide a writable PNG output path.' );
await GPU.init( { headless: true } );
const W = 640, H = 480, scene = new E.Scene();
const ground = new E.Mesh( new E.PlaneGeometry( 20, 20 ).rotateX( - Math.PI / 2 ), new Material( { name: 'ground', color: 0x849a83, roughness: 0.9 } ) );
scene.add( ground );
const app = { player: { position: new E.Vector3( 0, 0, 2.4 ), yaw: 0, mode: 'walk' }, scene,
	colliders: { resolveCapsule() {}, groundHeightAt() { return - Infinity; } }, terrainData: { heightAt() { return 0; } },
	village: { enterable: [] }, settings: { timeOfDay: 12 }, game: { state: {} }, homeLife: { saveState: {} } };
const actor = new CompanionActor( app );
actor.group.rotation.y = 0;
if ( process.argv[ 3 ] ) {
	if ( ! actor.command( process.argv[ 3 ] ) ) throw new Error( `Unsupported companion action: ${ process.argv[ 3 ] }` );
	for ( let i = 0; i < 5; i ++ ) actor.update( 0.1 );
}
const camera = new E.PerspectiveCamera( 35, W / H, 0.1, 100 );
camera.position.set( 2.5, 2, 5 ); camera.lookAt( 0, 0.7, 0 );
G.sunDir.value.set( 0.5, 0.7, 0.3 ).normalize();
G.sunColor.value.setRGB( 3, 2.9, 2.7 );
G.skyIrradiance.value.setRGB( 0.25, 0.32, 0.45 );
const rt = new RenderTarget( W, H, { colors: [ 'rgba16float', 'rgba16float', 'rgba8unorm' ], depth: 'depth32float', label: 'companion scene' } );
const mr = new MeshRenderer();
const shadows = new SunShadows();
const tonemap = new FullscreenPass( { label: 'tonemap', colorFormats: [ 'rgba8unorm' ], bindings: { hdr: { texture: () => rt.texture } },
	code: `fn fragment( in: FSIn ) -> vec4f { let c = textureLoad( hdr, vec2i( in.pos.xy ), 0 ).rgb; let a = c * 0.8; let t = ( a * ( 2.51 * a + 0.03 ) ) / ( a * ( 2.43 * a + 0.59 ) + 0.14 ); return vec4f( linearToSrgb( sat3( t ) ), 1.0 ); }` } );
const ldr = new RenderTarget( W, H, { colors: [ 'rgba8unorm' ], label: 'ldr' } );
for ( let f = 0; f < 2; f ++ ) {
	GPU.beginFrame(); setFrameCamera( camera, W, H );
	shadows.render( scene, mr, shadows.update( camera, G.sunDir.value ) );
	mr.render( scene, { camera, kind: 'main', colorViews: rt.textures.map( t => t.view() ), colorFormats: rt.formats,
		clearColors: [ [ 0.3, 0.4, 0.5, 1 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ] ], depthView: rt.depthTexture.view(), depthFormat: 'depth32float', clearDepth: 0 } );
	tonemap.render( { colorViews: [ ldr.texture ] } ); GPU.submit();
}
const img = await readTexture( ldr.texture );
writePNG( process.argv[ 2 ], W, H, new Uint8Array( img.data ) );
console.log( 'ok companion WebGPU render', mr.stats );
await new Promise( r => setTimeout( r, 200 ) );
process.exit( 0 );
