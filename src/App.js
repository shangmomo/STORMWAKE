import {cameraLocalVolume} from './post/LocalWaterV81.js';
import {safeFlyLanding} from './player/LandMotorV78.js';
import {localWaterAt} from './land/MineReservoirV80.js';
import {FrameTiming} from './core/FrameTimingV79.js';
import {showRuntimeFailure} from './core/RuntimeRecoveryV78.js';
import {controlContext,modalActive,routeFrameMenus} from './core/ControlPolicy.js';
import { Vector3, Euler, Color, MathUtils, Mesh, Matrix4 } from './engine/index.js';
import { GPU } from './engine/gpu/GPU.js';
import { SunShadows } from './engine/render/Shadows.js';
import { FrameUniforms } from './engine/render/Frame.js';

import { Engine } from './core/Engine.js';
import { Input } from './core/Input.js';
import { CDLOD } from './core/CDLOD.js';
import { G } from './core/Globals.js';
import { Profiler } from './core/Profiler.js';
import { SceneRenderer, LAYERS } from './core/SceneRenderer.js';
import { DEPTH_FORMAT } from './engine/render/SceneRenderer.js';
import { installDebugViews } from './core/DebugViews.js';

import { Atmosphere, SUN_ILLUMINANCE } from './sky/Atmosphere.js';
import { Sky, sunDirectionFromTime } from './sky/Sky.js';
import { Clouds } from './sky/Clouds.js';
import { SkyProClouds } from './sky/SkyProClouds.js';
import { Environment } from './sky/Environment.js';

import { TerrainData } from './world/TerrainData.js';
import { TerrainGPU } from './world/TerrainGPU.js';
import { Terrain } from './world/Terrain.js';
import { computeShoreField } from './world/ShoreField.js';
import { WORLD } from './world/WorldLayout.js';
import { Colliders } from './world/Colliders.js';
import { Village } from './world/Village.js';
import { Reef } from './world/Reef.js';
import { BoatModel } from './world/BoatModel.js';
import { installHeritageArtistShip } from './ship/HeritageAssetRig.js';
import {HeritageDeck} from './ship/HeritageDeck.js';
import {CaptainCabinInterior} from './ship/CaptainCabinInterior.js';
import {installMastLookout} from './ship/MastLookout.js';
import { Rocks } from './world/Rocks.js';
import { Debris } from './world/Debris.js';
import { Wildlife } from './world/wildlife/Wildlife.js';
import { Whale } from './world/marine/Whale.js';

import { OceanFFT } from './ocean/OceanFFT.js';
import { WaterSurface } from './ocean/WaterSurface.js';
import { WaterMaterial } from './ocean/WaterMaterial.js';
import { createFoamTexture } from './ocean/FoamTexture.js';
import { ShoreWaves } from './ocean/ShoreWaves.js';
import { ShoreSim } from './ocean/ShoreSim.js';
import { Caustics } from './ocean/Caustics.js';
import { installUnderwaterLighting } from './ocean/UnderwaterLighting.js';
import { RefractionPass } from './ocean/RefractionPass.js';
import { installGroundBounce } from './materials/GroundBounce.js';
import { LocalLights, addVillageLights, addBoatLights } from './materials/LocalLights.js';
import { WaterQuery } from './ocean/WaterQuery.js';
import { Breakers } from './ocean/Breakers.js';
import { SurfFoam } from './ocean/SurfFoam.js';
import { Spray } from './fx/Spray.js';
import { SeaDetail } from './ocean/SeaDetail.js';
import { MarineSnow } from './fx/MarineSnow.js';
import { AirMotes } from './fx/AirMotes.js';

import { Underwater, LENS_REACH } from './post/Underwater.js';
import { PostFX } from './post/PostFX.js';
import { AirHaze } from './post/AirHaze.js';
import { FlyCamera } from './player/FlyCamera.js';
import { Player } from './player/Player.js';
import { Game } from './game/Game.js';
import { STAND } from './game/FishStand.js';
import { CHANDLERY } from './game/Chandlery.js';
import { BoatController } from './player/BoatController.js';
import { BoatSpray } from './player/BoatSpray.js';
import { WakeSim } from './ocean/WakeSim.js';
import { Vegetation } from './world/Vegetation.js';
import { SoundScape } from './audio/SoundScape.js';
import { updateCameraVelocity, useStaticVelocity } from './post/CameraVelocity.js';
import { AUTO_TIME_SPEED } from './course/HomeLifeLogic.js';
import { LandAdventure } from './land/LandAdventure.js';
import { VoyageM1 } from './voyage/VoyageM1.js';
import {weatherAt,lightningAt} from './offshore/OffshoreField.js';
import {isDryHoldCamera} from './ship/DryHoldCamera.js';
import {OceanEcology} from './world/marine/OceanEcology.js';
import { OffshoreLife } from './world/marine/OffshoreLife.js';

const _up = new Vector3( 0, 1, 0 );

export class App {

	constructor() {

		this.settings = {
			timeOfDay: 16.2,
			sunAzimuth: 0, // degrees: turns the sun's daily path about the vertical
			timeSpeed: 0, // hours per real second
			exposure: 0.55,
			renderScale: 1, // internal resolution (the temporal upscaler reconstructs the output), Performance tab
		};
		this.qs = new URLSearchParams( location.search );
		// Native sun/moon/atmosphere and wildlife already follow this setting.
		// Keep benchmark reference shots at the original frozen time.
		if ( ! this.qs.has( 'bench' ) ) this.settings.timeSpeed = AUTO_TIME_SPEED;

	}

	async init( onProgress = () => {} ) {

		const qs = this.qs;
		// report a stage, then let the page paint it before the (synchronous) stage work starts
		const progress = async ( p, text, until ) => {

			onProgress( p, text, until );
			if ( typeof requestAnimationFrame === 'function' ) await new Promise( ( r ) => requestAnimationFrame( () => setTimeout( r, 0 ) ) );

		};
		await progress( 0.02, 'Starting WebGPU…' );
		const engine = this.engine = new Engine( document.getElementById( 'app' ) );
		await engine.init();
		// systems take `renderer` first as in the three.js version: it is the Engine now (GPU access is global)
		const renderer = engine;
		const { scene, camera } = engine;
		// the near clip plane is the lens: it slices the water surface at the waterline (see Underwater)
		camera.near = 0.1;
		camera.updateProjectionMatrix();
		this.renderer = renderer;
		this.scene = scene;
		this.camera = camera;

		this.input = new Input( engine.domElement );
		this.fly = new FlyCamera( camera, engine.domElement, this.input );
		this.fly.setPose( new Vector3( 20, 6, - 20 ), Math.PI * 0.9, - 0.12 );

		// ---------------------------------------------------------------- sky
		await progress( 0.04, 'Building the atmosphere…' );
		this.atmosphere = new Atmosphere( renderer );
		this.sky = new Sky( this.atmosphere );
		if ( ! qs.has( 'noClouds' ) ) {

			// sky-pro-webgpu's clouds ("Partly cloudy"); ?oldClouds: the previous ones
			this.clouds = qs.has( 'oldClouds' ) ? new Clouds( renderer, this.atmosphere ) : new SkyProClouds( renderer, this.atmosphere );
			if ( this.clouds.ready ) await this.clouds.ready;
			this.sky.clouds = this.clouds;

		}

		// 3 cascades: 0-10 m (~1 cm texels, fine contact detail), 10-60 m, 60-400 m (rough far shadows);
		// contact-hardening filter sized by the sun's disc on the near cascade. Each cascade's depth range
		// is its light margin (200 m) + its extent, which keeps the depth bias small in metres.
		// Shadows come from the opaque and the late (transparent-pass) layers.
		this.csm = this.shadows = new SunShadows( { size: 2048, splits: [ 10, 60, 400 ], lightMargin: 200, normalBias: [ 0.015, 0.06, 0.3 ], bias: 0.00002 } );
		this.shadows.layerMask = ( 1 << LAYERS.OPAQUE ) | ( 1 << LAYERS.TRANSPARENT );

		this.environment = new Environment( renderer, scene, this.sky );

		// ---------------------------------------------------------------- island
		await progress( 0.06, 'Shaping the island…' );
		this.terrainData = new TerrainData();
		this.colliders = new Colliders();
		// the village flattens building pads into the heightmap: build it before any terrain
		// data is derived (shore field, GPU textures, meshes)
		await progress( 0.12, 'Building the village…' );
		this.village = new Village( { scene, terrain: this.terrainData, colliders: this.colliders } );
		if ( ! qs.has( 'noVeg' ) ) {

			await progress( 0.14, 'Planting the island…' );
			this.vegetation = new Vegetation( { scene, terrain: this.terrainData, village: this.village } );
			useStaticVelocity( this.vegetation.group );

		}

		await progress( 0.19, 'Rolling in the swell…' );
		this.shoreField = computeShoreField( this.terrainData, { res: 512, swellDir: [ WORLD.swellDir.x, WORLD.swellDir.y ] } );
		this.terrainGPU = new TerrainGPU( this.terrainData, this.shoreField );
		// terrain and rocks apply the heightfield sun shadow (long hill shadows) in their own lighting
		this.terrain = new Terrain( { scene, terrainData: this.terrainData, terrainGPU: this.terrainGPU, renderer } );
		this.rocks = new Rocks( { scene, terrain: this.terrain, village: this.village, colliders: this.colliders } );
		// driftwood (CC0 photoscans), wrack, pebbles and village clutter
		this.debris = new Debris( { scene, terrain: this.terrain, village: this.village, vegetation: this.vegetation, rocks: this.rocks, colliders: this.colliders } );
		// these apply the heightfield sun shadow in their own lighting model (see UnderwaterLighting)
		this.terrain.mesh.material.appliesHillShadow = true;
		this.rocks.material.appliesHillShadow = true;

		await progress( 0.23, 'Growing the reef…' );
		this.reef = new Reef( { scene, terrain: this.terrainData, shoreField: this.shoreField } );

		this.boat = new BoatModel({shipClass:qs.has('heritageShip')?'heritage':'legacy'});
		scene.add( this.boat.group );
		if ( this.boat.shipScale ) {
			try { await installHeritageArtistShip( this.boat ); this.boat.heritageDeck=new HeritageDeck(this.boat); this.boat.mastLookout=installMastLookout(this.boat); const cabin=new CaptainCabinInterior(this.boat); await cabin.load();this.boat.captainCabin=cabin;this.boat.heritageDeck.realInteriorEnabled=true; }
			catch ( error ) { console.error( '[STORMWAKE V47] Dutch CC0 model load failed; retaining old playable hull', error ); }
		}

		this.boat.group.position.copy( WORLD.boatDock.position );
		this.boat.group.rotation.y = WORLD.boatDock.heading;

		// ---------------------------------------------------------------- ocean
		await progress( 0.3, 'Simulating the ocean…' );
		this.fft = new OceanFFT( renderer );
		if ( this.reef.setOcean ) this.reef.setOcean( this.fft ); // coral / sea fan sway follows the simulated swell
		this.foamTexture = createFoamTexture( renderer );
		this.oceanLOD = new CDLOD( { gridSize: Number( qs.get( 'G' ) || 32 ), leafSize: 8, levels: 12, minY: - 25, maxY: 25 } );
		this.surface = new WaterSurface( { fft: this.fft, cdlod: this.oceanLOD, foamTexture: this.foamTexture } );
		this.surface.terrain = this.terrainGPU;
		this.seaDetail = new SeaDetail();
		this.surface.detail = this.seaDetail;
		this.shore = new ShoreWaves( this.terrainGPU );
		this.surface.shore = this.shore;
		this.caustics = qs.has( 'noCaustics' ) ? null : new Caustics( renderer, this.fft );
		if ( this.caustics ) this.caustics.detail = this.seaDetail;

		if ( ! qs.has( 'noSim' ) ) {

			this.shoreSim = new ShoreSim( renderer, { terrainGPU: this.terrainGPU, shore: this.shore } );
			this.surface.shoreSim = this.shoreSim;
			// WGSL: fn terrainWetness( xz: vec2f, h: f32 ) -> vec2f (x = wetness, y = sand foam)
			this.terrain.wetness = {
				modules: [ this.shoreSim.module ],
				code: /* wgsl */`
fn terrainWetness( xz: vec2f, h: f32 ) -> vec2f {
	let s = shoreSimSample( xz );
	let inside = shoreSimInside( shoreSimUvOf( xz ) );
	// outside the simulated region fall back to a static damp band
	let band = smoothstep( 0.45, 0.0, h );
	// foam left on the sand: the lace the water carried, stranded and popping (ShoreSim.sandFoam)
	return vec2f( max( s.y, band * ( 1.0 - inside ) ), shoreSimSandFoam( xz, s, h ) );
}`,
			};
			this.terrain.finalizeMaterial();
			// surf-zone foam look (whitewater, lace) used by the water shader
			this.surfFoam = new SurfFoam( { shoreSim: this.shoreSim } );
			this.surface.foamShading = ( args ) => this.surfFoam.shading( args );

		}

		// how much of the underwater lighting each group needs (sampler budget, see UnderwaterLighting)
		const underwaterMode = ( root, m ) => root && root.traverse( ( o ) => {

			if ( o.material ) for ( const mat of Array.isArray( o.material ) ? o.material : [ o.material ] ) mat.underwaterLighting = o.userData?.dryInterior?'none':m;

		} );
		underwaterMode( this.village.group, 'lite' );
		underwaterMode( this.boat.group, 'lite' );
		if ( this.vegetation ) underwaterMode( this.vegetation.group, 'none' );

		this.underwaterLighting = installUnderwaterLighting( {
			fft: this.fft, caustics: this.caustics, clouds: this.clouds, terrain: this.terrainGPU,
			shore: this.shore, surface: this.surface, shoreSim: this.shoreSim,
		} );

		// sunlight bounced off the ground (one diffuse bounce, re-baked with the terrain sun shadow)
		installGroundBounce( { terrain: this.terrainGPU, clouds: this.clouds } );
		this.sceneRenderer = new SceneRenderer( engine.meshRenderer, scene, camera );
		// the water's refraction source: the scene below the water only, half resolution
		this.refraction = new RefractionPass( { meshRenderer: engine.meshRenderer, scene, camera, sceneRenderer: this.sceneRenderer, scale: 0.5 } );
		this.sceneRenderer.onBeforeWater = () => this.refraction.render( G.seaLevel.value );
		if ( this.sky.background ) this.sceneRenderer.background = this.sky.background;
		// lanterns, lamp posts, path lights, lit windows, the boat's cabin / navigation lights and the
		// flashlight (L): nearest few packed into one small uniform array each frame
		this.localLights = new LocalLights();
		addVillageLights( this.localLights, this.village );
		addBoatLights( this.localLights, this.boat );
		// rough, large or heavily overdrawn surfaces (ground, rocks, debris, foliage) take the local
		// lights as Lambert only; the village, pier and boat get the full BRDF (glints on wet wood, metal)
		for ( const root of [ this.terrain.mesh, this.rocks.group, this.debris && this.debris.group, this.vegetation && this.vegetation.group ] ) if ( root ) root.traverse( ( o ) => {

			if ( o.material ) for ( const m of Array.isArray( o.material ) ? o.material : [ o.material ] ) m.localLightsCheap = true;

		} );
		// the sea is not drawn inside the boat (its hull volume masks the surface)
		if(!this.boat.shipScale)this.sceneRenderer.addHullMask( this.boat.createHullVolumeGeometry(), this.boat.group );
		this.waterMaterial = new WaterMaterial( {
			surface: this.surface, sky: this.sky, sceneCopy: this.sceneRenderer.opaqueCopy, sceneDepthHalf: this.sceneRenderer.opaqueDepthHalf.texture, refraction: this.refraction,
			hullMask: this.sceneRenderer.hullMaskRT.texture, hullMaskActive: this.sceneRenderer.hullMaskActive,
		} );
		this.waterMaterial.clouds = this.clouds;
		this.ocean = new Mesh( this.oceanLOD.geometry, this.waterMaterial );
		this.ocean.frustumCulled = false;
		this.ocean.receiveShadow = true;
		this.ocean.layers.set( LAYERS.WATER );
		// Thin alpha-tested meshes (nets, cloth, wire traps) are drawn in the late pass: the screen-space
		// AO and the refraction copy only see the opaque pass, so they neither smear dark AO halos over
		// what is behind them nor receive the noisy AO of their own strands. The boat's window glass is
		// blended: in the late pass it goes over the water seen through it (drawn earlier it would be
		// painted over by the water).
		this.scene.traverse( ( o ) => {

			if ( o.isMesh && ( o.name === 'village_fabric' || o.name === 'village_nets' || o.name === 'boat-trap' || o.name === 'boat-glass' ) ) o.layers.set( LAYERS.TRANSPARENT );

		} );
		// Terrain and water place their vertices in the vertex shader (CDLOD), so three's default motion
		// vectors (previous frame = raw grid position) are garbage there. Both are still in the world or
		// nearly so: camera-only reprojection of the real world position is what the temporal resolve needs.
		// ( the water material writes its own velocity + waterline mask outputs )
		useStaticVelocity( this.terrain.mesh );
		useStaticVelocity( this.rocks.group );
		scene.add( this.ocean );

		this.query = new WaterQuery( renderer, this.surface );

		this.marineSnow = new MarineSnow( { fft: this.fft, query: this.query } );
		scene.add( this.marineSnow.mesh );

		// ---- surf: plunging lips along the beach + spray particles (the breakers emit on the GPU;
		// spray.emit() / emitAlongPoints() for boat bow spray and splashes)
		this.spray = new Spray( renderer, { query: this.query, terrain: this.terrainGPU, sceneCopy: this.sceneRenderer.opaqueCopy, clouds: this.clouds } );
		scene.add( this.spray.mesh );
		if ( this.reef.setSpray ) this.reef.setSpray( this.spray ); // splashes of leaping fish
		this.breakers = new Breakers( renderer, {
			surface: this.surface, shore: this.shore, terrainData: this.terrainData, sky: this.sky,
			spray: this.spray, clouds: this.clouds,
		} );
		scene.add( this.breakers.mesh );
		// dust, pollen, salt aerosol, seed fluff and gnats drifting around the camera
		this.airMotes = new AirMotes( { terrain: this.terrainGPU, clouds: this.clouds, csm: this.csm, reversedDepth: true } );
		scene.add( this.airMotes.mesh );
		this.boatCtl = new BoatController( { model: this.boat, query: this.query, terrain: this.terrainData, colliders: this.colliders } );
		// V55: use the actual quay berth shared by BoatController and Pier.
		// Do not teleport into offshore water: spawning at sea made the shoreline
		// opening inaccessible and concealed a broken dock boarding sequence.
		// The mooring spring is active until the anchor is hauled up.
		this.boatCtl.moored = true;
		this.boatSpray = new BoatSpray( { boat: this.boatCtl, spray: this.spray } );
		// humpback cruising the deep water around the island (model fetched from public/models/whale)
		this.whale = new Whale( { scene, terrain: this.terrainData, query: this.query, spray: this.spray } );
		try {

			await this.whale.load();
			if ( this.reef && this.reef.setWhale ) this.reef.setWhale( this.whale ); // escort fish, foam and slick

		} catch ( e ) {

			console.warn( 'whale model failed to load', e );
			this.whale = null;

		}

		// Visible deep-water shoals and breaching dolphins follow the moving ship.
		this.offshoreLife = new OffshoreLife({scene,boat:this.boatCtl,terrain:this.terrainData});
		this.oceanEcology = new OceanEcology({scene,terrain:this.terrainData,stockAt:(x,z)=>this.game?.state.fishStock.fraction(x,z)??1,predator:()=>{const b=this.hunt?.bosses?.get('shark');return b?.health>0&&!b.deadUntil?b.pos:null;}});
		// interactive wake around the boat (Kelvin pattern, bow/stern waves, prop wash foam)
		this.wake = new WakeSim( renderer, { terrainGPU: this.terrainGPU, boat: this.boatCtl, colliders: this.colliders } );
		this.surface.wake = this.wake;
		this.player = new Player( { camera, input: this.input, terrain: this.terrainData, colliders: this.colliders, query: this.query, boat: this.boatCtl, reef: this.reef } );
		// New games start on dry land at WORLD.start; joining multiplayer does not board automatically.
		// birds, beach crabs, sanderlings (after spray / query / boat, which they use)
		this.wildlife = new Wildlife( {
			scene, renderer, terrain: this.terrainData, terrainGPU: this.terrainGPU, shore: this.shore,
			village: this.village, colliders: this.colliders, vegetation: this.vegetation, boat: this.boatCtl, boatModel: this.boat,
			query: this.query, spray: this.spray, csm: this.csm,
		} );
		this.freeCam = qs.has( 'fly' );

		// ---------------------------------------------------------------- post
		await progress( 0.34, 'Preparing the shaders…' );
		this.underwater = new Underwater( {
			depthTexture: this.sceneRenderer.sceneRT.depthTexture, maskTexture: this.sceneRenderer.waterMaskTexture,
			query: this.query, caustics: this.caustics, fft: this.fft,
		} );
		// the camera's height above the water in the same frame (GPU query): decides the side the surface
		// is seen from where the triangle facing can't be trusted
		this.waterMaterial.cameraWaterHeightNode = this.query.cameraState().x;
		// aerial perspective, marine haze and volumetric sun shafts (post)
		this.haze = qs.has( 'noHaze' ) ? null : new AirHaze( {
			depthTexture: this.sceneRenderer.sceneRT.depthTexture,volumeMask:this.sceneRenderer.waterMaskTexture, underwater: this.underwater, atmosphere: this.atmosphere,
			sky: this.sky, clouds: this.clouds, terrain: this.terrainGPU, csm: this.csm,
		} );
		this.post = new PostFX( renderer, { sceneRenderer: this.sceneRenderer, camera, underwater: this.underwater, clouds: this.clouds, sunDir: this.atmosphere.sunDir, haze: this.haze } );
		G.exposure.value = this.settings.exposure;
		if ( qs.has( 'scale' ) ) this.settings.renderScale = Number( qs.get( 'scale' ) ) || 1;
		this.setRenderScale( this.settings.renderScale );

		// ---------------------------------------------------------------- audio
		// recorded field recordings (public/audio, credits in public/audio/CREDITS.md); ?noAudio turns it off
		this.audio = qs.has( 'noAudio' ) ? null : new SoundScape();
		this.player.audio = this.audio;
		// the fishing game (rod, bites, catch, cooler, fish stand)
		this.game = new Game( this );
		// Build the new land models before the engine shader precompile. Loading them
		// after App.init would cause a costly first-use WGSL compilation in combat.
		if ( !qs.has( 'bench' ) ) {
			this.landAdventure = new LandAdventure( this );
			this.player.adventure = this.landAdventure;
			if (qs.get('stormwake') !== '0' && qs.get('voyage') !== '0') {
				this.voyageM1 = new VoyageM1(this);
				this.player.voyageM1 = this.voyageM1;
			}
		}
		// the lanterns at Joe's fish stand and Marta's chandlery (lit from dusk like the village lamps);
		// positions are in each stall's frame (x right, z toward the customer), turned by its yaw
		for ( const [ s, lx, ly, lz ] of [ [ STAND, - 0.9, 1.85, 0.1 ], [ CHANDLERY, - 0.75, 1.58, - 1.45 ] ] ) {

			const c = Math.cos( s.yaw ), sn = Math.sin( s.yaw );
			const x = s.x + lx * c + lz * sn, z = s.z - lx * sn + lz * c;
			this.localLights.add( { position: new Vector3( x, this.terrainData.heightAt( s.x, s.z ) + ly, z ), color: new Color( 1.0, 0.72, 0.42 ), intensity: 5 * 1.5, range: 11, kind: 'lantern', flicker: 0.08 } );

		}

		this.boatCtl.onSlam = ( s ) => this.audio && this.audio.hullSlap( s );
		engine.domElement.addEventListener( 'click', () => {

			if ( modalActive(this)||!this.input.enabled||(window.__ui && window.__ui.isPointerOverUI) ) return;
			// The abyss submarine shares the surface helm's click-to-capture
			// mouse camera. Escape releases the cursor to reach HUD controls.
			this.input.requestLock();
			if ( this.audio ) this.audio.resume();

		} );

		this.profiler = new Profiler( renderer );
		this.profiler.track( 'fft rows', this.fft.rowKernel );
		this.profiler.track( 'fft columns', this.fft.columnKernel );
		this.profiler.track( 'sky view', this.atmosphere.skyViewKernel );

		this.updateSun();
		installDebugViews( this );
		window.__app = this;
		this.gpu = GPU; // console / test access

		// ---- compile pipelines asynchronously (keeps the page responsive), then prime a few
		// frames behind the loading screen so any remaining first-use stalls happen there
		// stage weights: in the browser the pipeline compile below takes far longer than everything before it
		await progress( 0.36, 'Compiling shaders…', 0.95 );
		await this.precompile();
		await progress( 0.96, 'Warming up…' );
		for ( let i = 0; i < 2; i ++ ) {

			this.frame( 1 / 60 );
			await GPU.queue.onSubmittedWorkDone();

		}

	}

	// Build every pipeline up front, then wait for the GPU (keeps first-use compiles behind the loading
	// screen). The precompile frame visits every mesh of every pass, hidden or out of view, and the
	// pipelines compile in parallel in the background (GPU.renderPipeline); the refraction pass and
	// the hull mask are forced on so their variants are built too.
	async precompile() {

		const mr = this.engine.meshRenderer;
		const refr = this.refraction.enabled;
		// compute / post pipelines were requested while the systems were built: let them finish first
		// (the frame below would otherwise compile each one again, synchronously); the post chain
		// builds its passes on first use, so build it now
		if ( ! this.post._built ) {

			this.post._build();
			this.post._outW = 0; // as PostFX.beginFrame: size the new targets

		}

		await GPU.pipelinesReady();
		mr.precompiling = true;
		this.refraction.enabled = true;
		const sr = this.sceneRenderer, hm = sr.hullMaskRT;
		if ( sr.hullMasks.length ) mr.render( sr.hullMaskScene, {
			label: 'hull mask', kind: 'color', camera: this.camera, colorViews: [ hm.texture.view() ], colorFormats: hm.formats,
			clearColors: [ [ 0, 0, 0, 0 ] ], depthView: hm.depthTexture.view(), depthFormat: DEPTH_FORMAT, clearDepth: 0, cull: false,
		} );
		try {

			// both water variants: with the hull-mask discard (a hull on screen) and without
			for ( const hull of [ 0, 1 ] ) {

				this.waterMaterial.hullOverride = hull;
				this.frame( 1 / 60 );

			}

		} catch ( e ) {

			console.warn( 'precompile failed', e );

		}

		this.waterMaterial.hullOverride = null;
		mr.precompiling = false;
		this.refraction.enabled = refr;
		await GPU.pipelinesReady();
		await GPU.queue.onSubmittedWorkDone();

	}

	// ---------------------------------------------------------------- sun / sky

	updateSun() {

		const s = this.settings;
		const dir = sunDirectionFromTime( s.timeOfDay ).applyAxisAngle( _up, MathUtils.degToRad( s.sunAzimuth || 0 ) );
		// the sky is always scattered sunlight, even with the sun below the horizon (twilight)
		this.atmosphere.sunDir.value.copy( dir );
		// below the horizon the moon takes over as the key light
		const night = MathUtils.smoothstep( - dir.y, 0.02, 0.18 );
		G.night.value = night;
		this.sky.starIntensity.value = night;
		const moon = new Vector3( - dir.x, Math.abs( dir.y ) * 0.8 + 0.25, - dir.z ).normalize();
		this.sky.moonDir.value.copy( moon );

		// key light: the sun until it is well below the horizon (it gives no direct light in
		// twilight anyway), then the moon
		const light = dir.y > - 0.07 ? dir : moon;
		G.sunDir.value.copy( light );

	}

	applyAtmosphereReadback() {

		const a = this.atmosphere;
		if ( ! a.sunTransmittance ) return;
		const sunTrue = a.sunDir.value;
		const sunUp = sunTrue.y > - 0.07; // same switch as updateSun()
		const T = a.sunTransmittance;
		const horizonFade = MathUtils.smoothstep( sunTrue.y, - 0.03, 0.02 );
		let c;
		if ( sunUp ) c = new Color( T[ 0 ], T[ 1 ], T[ 2 ] ).multiplyScalar( SUN_ILLUMINANCE * horizonFade );
		else c = new Color( 0.6, 0.7, 1.0 ).multiplyScalar( 0.42 * G.night.value );
		G.sunColor.value.copy( c );
		const irr = a.skyIrradiance;
		const nightAmb = 0.09 * G.night.value;
		G.skyIrradiance.value.setRGB( irr[ 0 ] + nightAmb * 0.6, irr[ 1 ] + nightAmb * 0.7, irr[ 2 ] + nightAmb );
		G.horizonColor.value.setRGB( a.horizon[ 0 ], a.horizon[ 1 ], a.horizon[ 2 ] );

	}

	// T: let the day run (about 8 minutes per day) or stop it
	toggleTime() {

		const s = this.settings;
		if ( this.crew?.connected ) {
			const nextSpeed = s.timeSpeed ? 0 : ( this._timeSpeed || 0.05 );
			if ( nextSpeed ) this._timeSpeed = nextSpeed;
			this.crew.requestWorldControl( { speed: nextSpeed } );
			return;
		}
		if ( s.timeSpeed !== 0 ) {

			this._timeSpeed = s.timeSpeed;
			s.timeSpeed = 0;

		} else {

			s.timeSpeed = this._timeSpeed || 0.05;

		}

		if ( this.ui ) {

			this.ui.s.advance = s.timeSpeed !== 0;
			this.ui.ui.refresh();
			this.ui.ui.toast( s.timeSpeed !== 0 ? 'Time running' : 'Time paused' );

		}

	}

	// Free camera is separated from the actor. Do not freeze a passenger in a
	// moving shaft or allow a network player to teleport through world geometry.
	setFreeCam( on ) {
		if(on===this.freeCam)return true;
		const p=this.player,lift=this.landAdventure?.expeditionCave?.lift;
		if(on&&!this.qs?.has('bench')&&!this.qs?.has('debug')){
			if(!p||p.mode!=='walk'||!p.grounded||p.busy||p.stationId||p.pendingStation||p.shipClimb||p.boardingClimb||this.landAdventure?.stance||this.landAdventure?.battleTimer>0||this.hunt?.abyss?.active||this.voyageM1?.deepEcho?.piloting||lift?.onPlatform(p.position)||lift?.threshold(p.position))return false;
		}
		this.freeCam=on;
		if(on){
			const e=new Euler().setFromQuaternion(this.camera.quaternion,'YXZ');
			this.fly.setPose(this.camera.position.clone(),e.y,e.x);this.fly.velocity.set(0,0,0);
		}else if(p&&['walk','swim'].includes(p.mode)){
			if(!this.qs?.has('coop')&&!this.crew?.connected&&!this.voyageM1?.net?.connected)this.dropPlayerAtCamera();
			p.velocity.set(0,0,0);p._camY=null;p.camOff=0;p.camOffV=0;
		}
		this.input?.resetPhysicalState?.();return true;
	}

	dropPlayerAtCamera() {
		const p=this.player,c=this.camera.position;
		const water=localWaterAt(c.x,c.y,c.z,this.terrainData)??this.cameraWaterHeight??0;
		const landing=safeFlyLanding(this.terrainData,this.colliders,c,water);
		if(!landing){this.ui?.ui?.toast?.('未找到安全落脚点，已返回角色位置。');return false;}
		const e=new Euler().setFromQuaternion(this.camera.quaternion,'YXZ');
		p.yaw=e.y;p.pitch=MathUtils.clamp(e.x,-1.5,1.5);p.mode='walk';p.position.copy(landing);p.grounded=true;p.waterH=water;p.waterMean=water;return true;
	}

	// ---------------------------------------------------------------- loop

	start() {

		GPU.device?.lost?.then(info=>showRuntimeFailure(this,new Error("WebGPU device lost: "+info.message)));
        this.engine.start( ( dt, t, wallDt ) => this.frame( dt, t, wallDt ),error=>showRuntimeFailure(this,error) );

	}

	updateFPS( wallDt ) {
        const timing=this._frameTiming ||= new FrameTiming();
        if(!timing.record(wallDt))return;
        const result=timing.window();
        if(!result)return;
        const el=document.getElementById('fps');
        let text=`${result.fps.toFixed(0)} fps · ${result.meanMs.toFixed(1)} ms · p99 ${result.p99Ms.toFixed(1)} ms · max ${result.maxMs.toFixed(1)} ms`;
        if(this.profiler?.enabled){const p=this.profiler.result;text+=` · GPU c ${p.compute.toFixed(2)} r ${p.render.toFixed(2)}`;}
        if(el)el.textContent=text;
        this.fps=result.fps;
        this.frameTimingReport=result;
    }

	frame( dt, t, wallDt = dt ) {

		const t0 = performance.now();
		this._frame( dt, wallDt );
		const ms = performance.now() - t0;
		this.cpuMs = this.cpuMs === undefined ? ms : this.cpuMs * 0.95 + ms * 0.05;

	}

	_frame( dt, wallDt = dt ) {

		GPU.beginFrame();
		FrameUniforms.fields.frameIndex.value = GPU.frame;
		const s = this.settings;
        routeFrameMenus(this);
        const control=controlContext(this),submerged=control==='abyss'||control==='research';
        this.hudMode?.updateContext(control);
		this.updateFPS( wallDt );
		G.dt.value = dt;
		const roomWorld = this.crew?.getWorldState?.();
		if ( roomWorld ) {
			// World time and weather evolve from the room server, not each local
			// browser's frame delta, tab visibility, saved time, or load order.
			s.timeOfDay = roomWorld.hour;
			s.timeSpeed = roomWorld.speed;
			s.sunAzimuth = roomWorld.azimuth;
			G.time.value = roomWorld.weatherSeconds;
		} else {
			G.time.value += dt;
			if ( s.timeSpeed !== 0 ) s.timeOfDay = ( s.timeOfDay + dt * s.timeSpeed + 24 ) % 24;
		}

		// ---- player / boat (boat physics first so the cameras follow this frame's pose)
		const playerCanBoard = (this.player.mode==='walk'||this.player.mode==='swim') && !this.player.busy && !this.boat?.heritageDeck && this.player.nearBoat();
		this.input.interactionOwner = this.game?.hud?.catchOpen ? 'catch' : this.game?.hud?.standOpen ? 'vendor' :
            playerCanBoard ? 'player' :
			(this.voyageM1 && this.player.mode==='deck' && (this.input.down('ShiftLeft')||this.input.down('ShiftRight'))) ? 'voyage' :
			this.voyageM1?.wantsInteraction?.() ? 'voyage' : this.landAdventure?.wantsLandInteraction?.( this.player.position ) ? 'land' : null;
		if ( this.input.hit( 'KeyF' ) && (this.freeCam||!submerged) ) this.setFreeCam( ! this.freeCam );
		if ( this.input.hit( 'KeyT' ) && !submerged && !this.landAdventure?.stance && !(this.voyageM1 && ['deck','boat'].includes(this.player.mode)) ) this.toggleTime();
		if ( this.input.hit( 'KeyL' ) && !submerged ) {

			const on = this.localLights.toggleFlashlight();
			if ( this.ui ) this.ui.ui.toast( on ? 'Flashlight on' : 'Flashlight off' );

		}

		if ( this.input.hit( 'KeyM' ) && this.audio ) {

			this.audio.setMuted( ! this.audio.muted );
			if ( this.ui ) this.ui.ui.toast( this.audio.muted ? 'Sound off' : 'Sound on' );

		}
		// The abyss is a separate controllable vehicle. Preserve the surface
		// ship's pose, throttle, fuel and wake until the captain returns.
		if ( !this.hunt?.abyss?.active ) {
			// A single spatial weather sample drives sails and camera-side wind VFX.
			// Spectrum stays fixed to avoid FFT discontinuities in older water code.
			if(this.voyageM1){
				const b=this.boatCtl, wx=weatherAt(b.position.x,b.position.z,G.time.value);
				b.offshoreTime=G.time.value;
				b.voyageWind.wind={x:wx.wind.x,z:wx.wind.z};
				this.offshoreWeather=wx;
			}
			this.voyageM1?.beforePhysics(dt);
			if(!this.voyageM1 || this.voyageM1.net.isHost) this.boatCtl.update( dt );
			this.boatSpray.update( dt );
			this.wake.update( dt );
		}
		if ( this.freeCam ) this.fly.update( dt );
		else if ( ! this.hunt?.abyss?.active && !this.voyageM1?.deepEcho?.piloting ) {this.landAdventure?.expeditionCave?.lift?.step(dt,this.player);this.player.update( dt );}
		// R/C/LMB have dedicated submarine actions. The surface fishing loop
		// must not run a hidden rod, burn diesel or react to those same keys.
		// V31: land combat, lighthouse puzzles, companion hints and tidal incursions.
		// Input ownership runs before fishing and shipyard actions, so an attack
		// cannot be observed by two independent systems in the same frame.
		if ( this.voyageM1 && !this.hunt?.abyss?.active ) this.voyageM1.update(dt);
		if ( this.landAdventure ) this.landAdventure.update( dt );
		if ( !this.hunt?.abyss?.active && !this.voyageM1?.deepEcho?.piloting && !this.player.foreignShip ) this.game.update( dt );
		if ( this.islandLife ) this.islandLife.beginFrame();
		if ( this.homeLife ) this.homeLife.update( dt );
		// HomeLife/sleeping is local progression. It cannot change the
		// authoritative room sky and weather on only one machine.
		if ( roomWorld ) { s.timeOfDay = roomWorld.hour; s.timeSpeed = roomWorld.speed; }
		if ( this.companionActor ) this.companionActor.update( dt );
		if ( this.islandLife ) this.islandLife.update( dt );
		if ( this.shipyard ) this.shipyard.update( dt );
		if ( this.voyageM1 && !submerged ) this.voyageM1.afterPlayer(dt);else if(submerged&&this.voyageM1){this.voyageM1.hands.root.visible=false;this.voyageM1.deckBody.root.visible=false;this.voyageM1.stationHands.root.visible=false;}
		if ( this.marineExpedition ) this.marineExpedition.update( dt );
		if ( this.hunt ) this.hunt.update( dt );
		if ( this.crew ) this.crew.update( dt );
		if ( this.oceanChart ) this.oceanChart.update( dt );
		if ( this.boatRecovery ) this.boatRecovery.update( dt );
		if(this.voyageM1){
			const w=weatherAt(this.camera.position.x,this.camera.position.z,G.time.value);
			const a=Math.min(1,Math.max(0,dt)*.8);
			G.windSpeed.value += ( w.windSpeed - G.windSpeed.value ) * ( roomWorld ? 1 : a );
            // FFT spectrum itself is fixed; scale its displacement smoothly
            // rather than rebuilding FFT waves (which would teleport the hull).
            const waterTarget=Math.min(2.35,Math.max(.88,w.waveScale||1));
            this.surface.amplitude.value += ( waterTarget - this.surface.amplitude.value ) * ( roomWorld ? 1 : Math.min( 1, dt * .28 ) );
            this.fft.foamGain.value=3+2.2*w.danger;
            this.fft.choppiness.value=.9+.33*w.danger;
			G.windDir.value.x += ( Math.cos( w.windDirection ) - G.windDir.value.x ) * ( roomWorld ? 1 : a );
			G.windDir.value.y += ( Math.sin( w.windDirection ) - G.windDir.value.y ) * ( roomWorld ? 1 : a );
			// SkyPro's TAA/panorama history is invalidated whenever coverage changes.
			// Throttle adjustments rather than forcing expensive rebuilds each frame.
			this.offshoreCloudClock=(this.offshoreCloudClock||0)+dt;
			if(this.offshoreCloudClock>3 && this.clouds?.coverage){
				this.offshoreCloudClock=0;
				const v=this.clouds.coverage.value,target=Math.min(.94,Math.max(.27,w.cloud));
				if ( roomWorld ) this.clouds.coverage.value = target;
				else if(Math.abs(target-v)>.035)this.clouds.coverage.value=v+Math.sign(target-v)*Math.min(.06,Math.abs(target-v));
			}
		}
		this.updateSun();
        if(this.haze?.density){const target=1.6+16*(this.offshoreWeather?.fog||0);this.haze.density.value+=(target-this.haze.density.value)*Math.min(1,dt*.65);}

		this.atmosphere.update( dt, this.camera.position.y );
		this.applyAtmosphereReadback();
        const strike=lightningAt(G.time.value),lightDistance=Math.hypot(this.camera.position.x-strike.x,this.camera.position.z-strike.z);
        const flash=strike.flash*Math.max(0,1-lightDistance/1600);
        if(flash>0){G.sunColor.value.multiplyScalar(1+flash*8);G.skyIrradiance.value.r+=flash*.9;G.skyIrradiance.value.g+=flash;G.skyIrradiance.value.b+=flash*1.2;}
        if(this.lastThunder!==strike.id&&strike.phase>=lightDistance/343&&lightDistance<1800){this.lastThunder=strike.id;this.audio?.thunder?.(1-lightDistance/2000);}

		// ---- water simulation
		if ( roomWorld ) this.fft.time.value = roomWorld.weatherSeconds - dt * this.fft.timeScale;
		this.fft.update( dt );
		this.seaDetail.update( dt );
		this.query.setCamera( this.camera.position.x, this.camera.position.z );
		this.boatCtl.queueQueries();
		this.query.update();
		// A below-waterline wooden cabin is an enclosed dry air space. The outer
		// ocean is NOT a bilge water surface, and must not be drawn through walls.
		const localVolume=cameraLocalVolume(this.camera.position,this.hunt?.abyss,this.terrainData);
        const raid=this.hunt?.abyss;const dryHoldCamera=raid?.active?(raid.cameraMode==='interior'&&!raid.hatch?.wetView&&(!localVolume||localVolume.dry)):(!localVolume&&isDryHoldCamera(this.player));
        this.cameraLocalVolume=localVolume;this.cameraDryHold=dryHoldCamera;this.underwater.setLocalVolume(dryHoldCamera?null:localVolume);
		// V50: never disable the WORLD ocean from a cabin viewpoint.
		// The boat-local shader mask excludes seawater only from the sealed hull.
		// Do not render the infinite FFT ocean sheet through sealed rooms. The
        // historic camera-independent hull mask missed grazing wave crests,
        // causing the bright horizontal sea line in the furnished quarters.
        // Restore water immediately when the camera exits to an open deck.
        // V60: leave the ocean and exterior spray visible from every camera.
        // Seawater exclusion is boat-local in WaterMaterial: closing the entire
        // ocean made the sea disappear through the original Dutch hull windows.
        this.ocean.visible=true;
        if(this.breakers?.mesh)this.breakers.mesh.visible=true;
        if(this.spray?.mesh)this.spray.mesh.visible=true;
		this.underwater.enabled.value=dryHoldCamera?0:1;
		if(this.boat.shipScale && this.waterMaterial){
		  const b=this.boatCtl;
		  this._v50WorldToBoat=this._v50WorldToBoat||new Matrix4();
		  this._v50WorldToBoat.compose(b.position,b.quaternion,new Vector3(1,1,1)).invert();
		  this.waterMaterial.uniforms.boatWorldToLocal.value=this._v50WorldToBoat;
		  this.waterMaterial.uniforms.boatMaskEnabled.value=this.camera.position.distanceTo(b.position)<90?1:0;
		}
		if(this.query.cpuValid&&Number.isFinite(this.query.cpu[0]))this.oceanCameraHeight=this.query.cpu[0];
        const h=localVolume&&!localVolume.dry?this.camera.position.y+localVolume.depth:(this.oceanCameraHeight??0);
        G.cameraUnderwater.value=!dryHoldCamera&&this.camera.position.y<h-LENS_REACH?1:0;
        G.cameraWaterHeight.value=h;this.cameraWaterHeight=h;

		if ( this.caustics ) this.caustics.update();
		// drawn while any part of the view can be under water (the specks above the surface are dropped)
		this.marineSnow.update( this.camera, !localVolume && !dryHoldCamera && this.camera.position.y < ( this.cameraWaterHeight ?? 0 ) + LENS_REACH );
		this.airMotes.update( dt, this.camera, this.cameraWaterHeight ?? 0 );
		if ( this.shoreSim ) this.shoreSim.update();
		this.underwaterLighting.update( this.camera );
		this.breakers.update( this.camera );
		this.spray.update();
		if ( this.clouds ) this.clouds.update( dt, this.camera );
		this.environment.update( dt );

		// ---- world
		this.oceanLOD.update( this.camera );
		this.terrain.update( this.camera );
		this.rocks.update( this.camera );
		this.debris.update( this.camera );
		this.reef.update( dt, this.camera.position );
		this.village.update( dt );
		if ( this.vegetation ) this.vegetation.update( dt, this.camera );
		if ( this.whale ) this.whale.update( dt, this.camera );
		this.offshoreLife?.update(dt);
		this.oceanEcology?.update(dt,this.camera.position);
		if ( this.hunt ) this.hunt.bosses.update( dt );
		this.boat.update( dt );
		this.wildlife.update( dt, this.camera, this.freeCam ? null : this.player );
		this.localLights.update( this.camera, dt );

		// ---- render
		G.exposure.value = s.exposure * (1 + G.night.value * 1.2);
		updateCameraVelocity( this.camera );
		this.post.lens.update( dt, !dryHoldCamera && !this.voyageM1?.deepEcho?.piloting && this.camera.position.y < ( this.cameraWaterHeight ?? 0 ) );
		if ( this.post.flare ) {

			this.post.flare.setDepthHeight( this.sceneRenderer.sceneRT.height );
			this.post.flare.update( this.camera, dt, { aboveWater: dryHoldCamera || this.camera.position.y > ( this.cameraWaterHeight ?? 0 ) - 0.02 } );

		}

		// the post chain sets the TAAU jitter + internal size and writes the camera into the frame
		// uniforms (setFrameCamera); shadows then render with this frame's sun and camera
		this.post.beginFrame();
		this.underwater.updateCamera( this.camera );
		this.shadows.render( this.scene, this.engine.meshRenderer, this.shadows.update( this.camera, G.sunDir.value ) );
		this.sceneRenderer.render();
		if ( this.post.flare ) this.post.flare.kernel.dispatch( 1 );
		this.post.render();
		this.post.endFrame();
		GPU.submit();
		this.profiler.update( dt );

		this.updateAudio( dt );
		if ( this.ui ) this.ui.update( dt );
		this.input.endFrame();

	}

	// Internal render resolution relative to the output (0.5..1), set by hand: changing it re-creates
	// the scene / post / cloud targets, so nothing adjusts it automatically.
	setRenderScale( v ) {

		const scale = MathUtils.clamp( Math.round( v * 20 ) / 20, 0.5, 1 );
		this.settings.renderScale = scale;
		this.post.setScale( scale );
		if ( this.clouds ) this.clouds.resolutionScale = scale;

	}

	updateAudio( dt ) {

		if ( ! this.audio || ! this.audio.enabled ) return;
		const cam = this.camera;
		const p = cam.position;
		const f = this._af || ( this._af = { fwd: new Vector3(), up: new Vector3() } );
		cam.getWorldDirection( f.fwd );
		f.up.set( 0, 1, 0 ).applyQuaternion( cam.quaternion );
		const h = this.cameraWaterHeight ?? 0;
		const coast = this.terrainData.coastDistance( p.x, p.z ).d;
		this.audio.update( dt, {
			listener: { position: p, forward: f.fwd, up: f.up },
			underwater: !this.cameraDryHold&&p.y<h?1:0,
			depthBelowSurface: this.cameraDryHold?0:Math.max(0,h-p.y),
			surfIntensity: Math.min( 1, this.shore.amplitude.value / 0.6 ),
			distanceToShore: Math.abs( coast ),
			coastDistance: coast,
			waveHeight: this.shore.amplitude.value * 2,
			windSpeed: G.windSpeed.value,
			windDir: G.windDir.value,
			daylight: 1 - G.night.value,
			nearPier: Math.abs( p.x - WORLD.pier.x ) < 12 && p.z > WORLD.pier.zStart - 5 && p.z < WORLD.pier.zEnd + 8,
			boat: {
				active: this.boatCtl.driven, rpm: this.boatCtl.rpm, throttle: this.boatCtl.throttle, speed: this.boatCtl.velocity.length(),
				position: this.boat.group.position, listenerInside: this.player.mode === 'boat' && this.player.camMode === 'first',
			},
		} );

	}

}
