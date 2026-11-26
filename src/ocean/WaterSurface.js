import { UniformBlock, ShaderModule } from '../engine/webgpu.js';
import { commonModule } from '../engine/render/wgsl/common.js';
import { FFT_SIZE } from './OceanFFT.js';

// Combines every contribution to the water surface: FFT cascades (deep water),
// shoreline waves, and the interactive wake. Provides the WGSL used by the ocean
// vertex/fragment shaders and by compute passes that query the surface.
//
// WGSL (prefix `waterSurface`):
//   surface.attenuationModule (small, for other systems):
//     fn waterSurfaceCascadeAttenuation( c: i32, depth: f32 ) -> f32
//   surface.module (built on first access, once shore / wake / terrain / detail / shoreSim /
//   foamShading are attached — the WaterMaterial builds its shader lazily for the same reason):
//     fn waterSurfaceSeaDepth( xz: vec2f ) -> f32
//     struct WaterSurfaceVertex { position, lagXZ, height, depth, foam, shoreN, shoreFoam, swash, surfMask }
//     fn waterSurfaceVertex( node: vec4f, grid: vec2f ) -> WaterSurfaceVertex     (CDLOD instance data + grid vertex)
//     struct WaterSurfaceFrag { normal, foam, coverage, slopes, jacobian, rough, aeration, gust, slick
//                               [, foamInfo: SurfFoamInfo when surf foam shading is attached] }
//     fn waterSurfaceFragment( lagXZ, footprint, depth, vertexFoam, shoreN: vec3f, shoreFoam, extraFoam,
//                              simState: vec4f, surfMask: vec2f, P: vec3f /* world position of the fragment */ ) -> WaterSurfaceFrag
//   Consumes: fft.module (ocean*), cdlod.module, terrain.module (terrainHeightAt, terrainNormalRock),
//   shore.module (shoreEvaluate), wake.module (wakeDisplacement, wakeFragment), seaDetail.module
//   (seaDetailSample), surfFoam.module (surfFoamShading).
export class WaterSurface {

	constructor( { fft, cdlod, foamTexture } ) {

		this.fft = fft;
		this.cdlod = cdlod;
		this.foamTexture = foamTexture;
		this.shore = null; // ShoreWaves (optional)
		this.wake = null; // WakeSim (optional)
		this.terrain = null; // TerrainGPU (optional)
		this.detail = null; // SeaDetail: gusts, slicks, windrows (optional)
		this.shoreSim = null; // ShoreSim (optional)
		// surf-zone foam look (SurfFoam instance, or anything with a `.module` defining surfFoamShading)
		this.foamShading = null;

		this.params = new UniformBlock( 'WaterSurfaceParams', {
			amplitude: [ 'f32', 1 ],
			slopeScale: [ 'f32', 1 ],
			foamCoverage: [ 'f32', 1 ],
			foamSharpness: [ 'f32', 2.2 ],
			foamScale: [ 'f32', 0.09 ], // pattern repeats per meter
			// Four rolling, physically displaced impact wavefronts. Inactive waves
			// have zero strength; the same field is sampled by GPU buoyancy queries.
			titanWave0: [ 'vec4f', [ 0, 0, 0, 0 ] ],
			titanWave1: [ 'vec4f', [ 0, 0, 0, 0 ] ],
			titanWave2: [ 'vec4f', [ 0, 0, 0, 0 ] ],
			titanWave3: [ 'vec4f', [ 0, 0, 0, 0 ] ],
			// Ink is part of the same physical sea shading, not a pale purple disk.
			titanInk0: [ 'vec4f', [ 0, 0, 0, 0 ] ],
			titanInk1: [ 'vec4f', [ 0, 0, 0, 0 ] ],
		}, { label: 'waterSurface' } );
		this._titanWaveSlot = 0;
		this._titanInkSlot = 0;
		const F = this.params.fields;
		this.amplitude = F.amplitude;
		this.slopeScale = F.slopeScale;
		this.foamCoverage = F.foamCoverage;
		this.foamSharpness = F.foamSharpness;
		this.foamScale = F.foamScale;
		// per-cascade contribution to the foam coverage
		this.foamWeights = [ 0.35, 0.45, 0.5, 0.25 ];

		// per-cascade amplitude attenuation in shallow water (long waves feel the bottom first)
		const d0 = [], floorAmt = [];
		for ( let c = 0; c < fft.cascades; c ++ ) {

			// long cascades vanish in shallow water, short ones persist until very shallow
			d0.push( Math.min( 40, fft.sizes[ c ] * 0.08 ) );
			floorAmt.push( [ 0.0, 0.05, 0.25, 0.5 ][ c ] ?? 0.5 );

		}

		const arr = ( a ) => `array<f32, ${ a.length }>( ${ a.map( ( x ) => x.toFixed( 5 ) ).join( ', ' ) } )`;
		this.attenuationModule = new ShaderModule( {
			name: 'waterSurfaceAttenuation',
			deps: [ commonModule ],
			code: /* wgsl */`
fn waterSurfaceCascadeAttenuation( c: i32, depth: f32 ) -> f32 {
	let d0 = ${ arr( d0 ) };
	let floorAmt = ${ arr( floorAmt ) };
	let a = smoothstep( 0.0, d0[ c ], depth );
	return mix( floorAmt[ c ] * smoothstep( 0.0, 0.6, depth ), 1.0, a );
}
`,
		} );
		// Keep impact-wave code out of attenuationModule: underwater lighting
		// imports attenuation without the waterSurface uniform block.
		this.titanShockModule = new ShaderModule( {
			name: 'titanShock', deps: [ commonModule ], uniforms: this.params,
			uniformName: 'waterSurface',
			code: /* wgsl */`
// The impact is evaluated by the SAME spectral water surface, material and
// buoyancy code as the existing realistic ocean. It is not a colored VFX ring.
// Multiple sharp and trailing crests create a breaking bore with asymmetric
// displacement. The fragment derivative below adds real optical slopes/foam.
fn titanShockOne( xz: vec2f, hit: vec4f ) -> vec3f {
	let age = frame.time - hit.z;
	if ( hit.w <= 0.0 || age < 0.0 || age > 8.0 ) { return vec3f( 0.0 ); }
	let delta = xz - hit.xy;
	let r = length( delta );
	let front = age * 23.0 + 5.0;
	let width = 11.0 + age * 2.3;
	// Most ocean vertices are far outside the impact. Skip costly trig/exp
	// outside the active crest instead of shading the full infinite sea.
	if ( abs( r - front ) > width * 3.6 ) { return vec3f( 0.0 ); }
	let phase = ( r - front ) / width;
	let envelope = exp( -phase * phase * 2.1 ) * exp( -age * 0.25 );
	let first = ( cos( phase * 3.1415926 ) + 0.38 * cos( phase * 6.283185 ) ) * envelope;
	let following = sin( ( r - front ) * .44 ) * exp( -abs( r - front ) * .058 ) * exp( -age * .46 ) * .22;
	let y = hit.w * ( first * 1.35 + following );
	let outward = select( delta / max( r, 0.001 ), vec2f( 0.0 ), r < 0.001 );
	let push = hit.w * sin( phase * 3.1415926 ) * envelope * .21;
	return vec3f( outward.x * push, y, outward.y * push );
}

fn titanShockDisplacement( xz: vec2f ) -> vec3f {
	return titanShockOne( xz, waterSurface.titanWave0 ) + titanShockOne( xz, waterSurface.titanWave1 ) +
		titanShockOne( xz, waterSurface.titanWave2 ) + titanShockOne( xz, waterSurface.titanWave3 );
}

// Analytic bore slope and air entrainment, evaluated only near a wavefront.
// These terms enter existing FFT normal / foam / BRDF logic, so the wave has
// exactly the same water colour, sky reflection and foam texture as the sea.
fn titanShockDetailOne( xz: vec2f, hit: vec4f ) -> vec4f {
	let age = frame.time - hit.z;
	if ( hit.w <= 0.0 || age < 0.0 || age > 8.0 ) { return vec4f( 0.0 ); }
	let d = xz - hit.xy;
	let r = length( d );
	let front = age * 23.0 + 5.0;
	let width = 11.0 + age * 2.3;
	if ( abs( r - front ) > width * 3.0 ) { return vec4f( 0.0 ); }
	let p = ( r - front ) / width;
	let e = exp( -p*p*2.1 ) * exp( -age*.25 );
	let c1 = cos( p*3.1415926 );
	let c2 = cos( p*6.283185 );
	let deriv = hit.w*1.35*e*( - (3.1415926*sin(p*3.1415926) + .38*6.283185*sin(p*6.283185))
		- 4.2*p*(c1 + .38*c2) ) / width;
	let dir = d / max( r, .001 );
	let breaker = smoothstep( .22, 1.04, abs(deriv)*4.2 + hit.w*e*.19 );
	// A white, aerated crown sits on the plunging crest, while lace trails down
	// its back face. Both go through the normal ocean foam texture and lighting.
	let crown = exp( -abs(p)*3.5 ) * e * clamp( hit.w / 3.4, 0.0, 1.0 );
	let backwash = breaker * ( 1.0 - smoothstep( -.85, .08, p ) );
	let froth = clamp( crown*.85 + backwash*.94, 0.0, 1.6 ) * exp( -age*.17 );
	return vec4f( dir * deriv, froth, breaker * .55 + crown*.25 );
}
fn titanShockSurfaceDetail( xz: vec2f ) -> vec4f {
	return titanShockDetailOne( xz, waterSurface.titanWave0 ) + titanShockDetailOne( xz, waterSurface.titanWave1 ) +
		titanShockDetailOne( xz, waterSurface.titanWave2 ) + titanShockDetailOne( xz, waterSurface.titanWave3 );
}

fn titanInkOne( xz: vec2f, ink: vec4f ) -> f32 {
	let age = frame.time - ink.z;
	if ( ink.w <= 0.0 || age < 0.0 || age > 15.0 ) { return 0.0; }
	let v = xz - ink.xy;
	let radius = 10.0 + age * 4.7;
	if ( dot(v,v) > (radius*1.45)*(radius*1.45) ) { return 0.0; }
	let swirl = perlin2( xz * .076 + vec2f(age*.15, -age*.12) );
	let chunks = perlin2( xz*.19 + vec2f(-age*.21, age*.16) );
	let r = length(v) / radius;
	let ragged = clamp( r + swirl*.23 + chunks*.095, 0.0, 1.6 );
	let density = 1.0-smoothstep( .43, 1.16, ragged );
	return density * ink.w * exp( -age*.066 ) * ( .81 + .19*chunks );
}
fn titanInkConcentration( xz: vec2f ) -> f32 {
	return clamp( titanInkOne(xz,waterSurface.titanInk0)+titanInkOne(xz,waterSurface.titanInk1), 0.0, 1.8 );
}
`,
		} );
		this._module = null;

	}

	emitTitanWave( x, z, intensity, time ) {
		if ( ! [ x, z, intensity, time ].every( Number.isFinite ) || intensity <= 0 ) return false;
		const slot = this._titanWaveSlot;
		this._titanWaveSlot = ( slot + 1 ) % 4;
		this.params.set( `titanWave${ slot }`, [ x, z, time, Math.min( intensity, 5 ) ] );
		return true;
	}
	emitTitanInk( x, z, intensity, time ) {
		if ( ! [ x, z, intensity, time ].every( Number.isFinite ) || intensity <= 0 ) return false;
		const slot = this._titanInkSlot;
		this._titanInkSlot = ( slot + 1 ) % 2;
		this.params.set( `titanInk${ slot }`, [ x, z, time, Math.min( intensity, 2.0 ) ] );
		return true;
	}

	get surfFoam() {

		const f = this.foamShading;
		if ( f && f.module ) return f;
		// the TSL-era hook ( args ) => surfFoam.shading( args ): SurfFoam.shading() returns its module
		if ( typeof f === 'function' ) {

			const r = f( {} );
			if ( r && r.isShaderModule ) return { module: r };
			if ( r && r.module ) return r;

		}

		return null;

	}

	// the composed module (see the header); built once, when first needed by a shader
	get module() {

		if ( ! this._module ) this._module = this._buildModule();
		return this._module;

	}

	_buildModule() {

		const fft = this.fft;
		const C = fft.cascades;
		const T = !! this.terrain, SH = !! this.shore, WK = !! this.wake, DT = !! this.detail;
		const SF = this.surfFoam;
		const SIM = !! this.shoreSim;
		const cd = this.cdlod.module.name;
		const CdV = cd[ 0 ].toUpperCase() + cd.slice( 1 ) + 'Vertex';
		const f = ( x ) => Number( x ).toFixed( 6 );

		// ------------------------------------------------------------------ vertex

		let cascadesV = '';
		for ( let c = 0; c < C; c ++ ) {

			const L = fft.sizes[ c ];
			const texel = L / FFT_SIZE;
			cascadesV += /* wgsl */`
	{
		// band-limit to the mesh spacing to avoid aliasing / swimming
		let level = max( log2( spacing / ${ f( texel ) } ) + 0.7, 0.0 );
		let att = waterSurfaceCascadeAttenuation( ${ c }, depth );
		let uv = worldXZ / ocean.sizes[ ${ c } ].x;
		let s = textureSampleLevel( oceanDisplacement, smpLinearRepeat, uv, ${ c }, level );
		disp += s.xyz * att;
		// foam coverage is smooth enough to evaluate per vertex (sampled at a fixed detail level,
		// the displacement sample itself from there on)
		var fv = s.w;
		if ( level < 1.5 ) { fv = textureSampleLevel( oceanDisplacement, smpLinearRepeat, uv, ${ c }, 1.5 ).w; }
		foam += fv * ${ f( this.foamWeights[ c ] ?? 0.25 ) } * att;
	}`;

		}

		const vertex = /* wgsl */`
const WATER_SHORE_DEEP: f32 = 26.0; // m: ShoreWaves' envelope smoothstep( 26, 13, depth ) is 0 beyond

struct WaterSurfaceVertex {
	position: vec3f,
	lagXZ: vec2f,
	height: f32,
	depth: f32,
	foam: f32,
	shoreN: vec3f,
	shoreFoam: f32,
	swash: f32,
	surfMask: vec2f, // clear plunging face, whitewater roller relief (m)
};

// depth of the sea floor below mean sea level at xz (m)
fn waterSurfaceSeaDepth( xz: vec2f ) -> f32 {
	return ${ T ? 'frame.seaLevel - terrainHeightAt( xz )' : '500.0' };
}

fn waterSurfaceVertex( node: vec4f, grid: vec2f ) -> WaterSurfaceVertex {
	let lod: ${ CdV } = ${ cd }Morph( node, grid, frame.cameraPos, 0.0 );
	let worldXZ = lod.worldXZ;
	let spacing = lod.spacing;
	let ground = ${ T ? 'terrainHeightAt( worldXZ )' : '-500.0' };
	let depth = ${ T ? 'frame.seaLevel - ground' : '500.0' };

	var disp = vec3f( 0.0 );
	var foam = 0.0;
${ cascadesV }

	disp *= waterSurface.amplitude;

	var extra = vec3f( 0.0 );
	var shoreN = vec3f( 0.0, 1.0, 0.0 );
	var shoreFoam = 0.0;
	var swash = 0.0;
	var surfMask = vec2f( 0.0 ); // clear plunging face, whitewater roller relief (m)
${ SH ? /* wgsl */`
	// Offshore of WATER_SHORE_DEEP the shore waves have faded out completely (their envelope is 0 from 26 m
	// of depth, see ShoreWaves) and there is no swash: most of the sea skips their evaluation.
	let nearShore = depth < WATER_SHORE_DEEP;
	var swashLevel = -1e4;
	if ( nearShore ) {
		let sw = shoreEvaluate( worldXZ, depth, ground );
		extra += sw.disp;
		shoreN = clamp( sw.nShore, vec3f( -1.0 ), vec3f( 1.0 ) );
		// (the foam line on the swash front is added per pixel in the water shader: on this coarse mesh
		// it would end short of the front and follow the triangles)
		shoreFoam = sw.foam;
		surfMask = vec2f( sw.face, sw.roller );
		swashLevel = sw.swashLevel;
	}` : '' }
${ WK ? '	extra += wakeDisplacement( worldXZ );' : '' }
	extra += titanShockDisplacement( worldXZ );

	var total = disp + extra;
	var y = frame.seaLevel + total.y;
${ SH ? /* wgsl */`
	if ( nearShore ) {
		// thin run-up sheet on the sand: take whichever surface is higher (smooth max)
		let k = 0.04;
		// no run-up sheet on steep rock (cliffs, sea stacks): waves break against it instead
		let nr = ${ T ? 'terrainNormalRockLevel( worldXZ, 0.0 )' : 'vec4f( 0.0 )' };
		let gentle = ${ T ? 'smoothstep( 0.45, 0.25, length( nr.xy ) )' : '1.0' };
		let hmx = sat( ( swashLevel - y ) / k * 0.5 + 0.5 ) * gentle;
		let smax = mix( y, swashLevel, hmx ) + hmx * ( 1.0 - hmx ) * k;
		swash = smoothstep( -0.02, 0.03, swashLevel - y );
		y = smax;
		// Where the sheet is the surface it is the sheet that is seen, not the wave below it: the sheet
		// lies on the sand (the sand's slope, no horizontal wave motion, no plunging face / roller).
		// Otherwise the backwash sheet over the lower beach face, exposed by the trough of the next
		// wave, keeps the trough's tilted normal and motion and reads as a separate dark strip
		// between the sea and the thin film further up.
		shoreN = normalize( mix( shoreN, vec3f( nr.x, 1.0, nr.y ), hmx ) );
		let still = 1.0 - hmx;
		total = vec3f( total.x * still, total.y, total.z * still );
		surfMask *= still;
	}` : '' }
${ T ? /* wgsl */`
	// hide the water sheet below dry land (beyond the swash zone)
	let below = select( ground - 0.06, min( ground - 2.0, frame.seaLevel - 1.0 ), depth < -3.0 );
	y = select( y, min( y, below ), y < ground );` : '' }

	var o: WaterSurfaceVertex;
	o.position = vec3f( worldXZ.x + total.x, y, worldXZ.y + total.z );
	o.lagXZ = worldXZ;
	o.height = total.y;
	o.depth = depth;
	o.foam = foam;
	o.shoreN = shoreN;
	o.shoreFoam = shoreFoam;
	o.swash = swash;
	o.surfMask = surfMask;
	return o;
}
`;

		// ------------------------------------------------------------------ fragment

		let cascadesF = '';
		for ( let c = 0; c < C; c ++ ) {

			let att = `waterSurfaceCascadeAttenuation( ${ c }, depth )`;
			if ( DT && c >= C - 2 ) att += ' * rough';
			else if ( DT && c === C - 3 ) att += ' * mix( 1.0, rough, 0.4 )';
			// (4x anisotropy: 8x only sharpened the far grazing sea imperceptibly, at ~0.1 ms)
			cascadesF += `\td += textureSample( oceanDerivatives, smpAniso4Repeat, lagXZ / ocean.sizes[ ${ c } ].x, ${ c } ) * ( ${ att } );\n`;

		}

		const cN = C - 1;
		const Lf = fft.sizes[ cN ];
		const k1 = 7.3, k2 = 3.1;
		const texel1 = Lf / k1 / FFT_SIZE, texel2 = Lf / k2 / FFT_SIZE;
		const rot = ( v, a ) => `vec2f( ${ v }.x * ${ f( Math.cos( a ) ) } - ${ v }.y * ${ f( Math.sin( a ) ) }, ${ v }.x * ${ f( Math.sin( a ) ) } + ${ v }.y * ${ f( Math.cos( a ) ) } )`;

		const fragment = /* wgsl */`
struct WaterSurfaceFrag {
	normal: vec3f,
	foam: f32,
	coverage: f32,
	slopes: vec2f,
	jacobian: f32,
	rough: f32,
	aeration: f32,
	gust: f32,
	slick: f32,
${ SF ? '	foamInfo: SurfFoamInfo,' : '' }
};

// extraFoam: foam carried by the water (ShoreSim); simState: ShoreSim.sample() here; surfMask
// (clear face of a plunging wave, whitewater roller relief, from the vertex stage)
fn waterSurfaceFragment( lagXZ: vec2f, footprint: f32, depth: f32, vertexFoam: f32, shoreN: vec3f, shoreFoam: f32, extraFoam: f32, simState: vec4f, surfMask: vec2f, P: vec3f ) -> WaterSurfaceFrag {
	var d = vec4f( 0.0 );
	var foamSum = 0.0;
	// the clear concave face of a plunging wave overhangs the trough: the foam carried by the
	// (depth-averaged, world-space) shore simulation below it is not on the face
	let face = ${ SH ? 'sat( surfMask.x )' : '0.0' };
	// (some of it stays: the lace of the previous wave is drawn up the face)
	let simFoam = ${ SIM ? 'extraFoam * ( 1.0 - face * 0.72 )' : '0.0' };
	foamSum += simFoam;
	// bubbles mixed into the water (milky, turquoise, hides the bottom): surf and wake
	var aeration = 0.0;

	// world-space gusts / slicks modulate the short wind waves (non-repeating dark and bright patches)
${ DT ? '	let det = seaDetailSample( lagXZ );\n	let rough = det.rough;' : '	let rough = 1.0;' }

${ cascadesF }
	d *= waterSurface.amplitude;
	var slopes = vec2f( d.x / max( d.z + 1.0, 0.2 ), d.y / max( d.w + 1.0, 0.2 ) );

	// Near-field capillary ripples. Within a few metres of the camera a pixel covers less than
	// the finest cascade's texel (~3 cm), so the surface looks glassy. Re-sample that cascade at
	// ~1 m and ~2.3 m tiles (rotated, so they never line up with it) wherever the footprint is
	// small. Damped in slicks with the short wind waves. Explicit LOD: this runs in a branch.
	let near = smoothstep( 0.04, 0.01, footprint ) * rough;
	if ( near > 0.002 ) {
		let c1 = textureSampleLevel( oceanDerivatives, smpLinearRepeat, ${ rot( 'lagXZ', 0.63 ) } * ${ f( k1 / Lf ) }, ${ cN }, max( log2( footprint / ${ f( texel1 ) } ), 0.0 ) );
		let c2 = textureSampleLevel( oceanDerivatives, smpLinearRepeat, ${ rot( 'lagXZ', 2.14 ) } * ${ f( k2 / Lf ) }, ${ cN }, max( log2( footprint / ${ f( texel2 ) } ), 0.0 ) );
		// gradients back into world axes (transpose of the rotation)
		let g1 = c1.xy; let g2 = c2.xy;
		let g = ${ rot( 'g1', - 0.63 ) } * 0.55 + ${ rot( 'g2', - 2.14 ) } * 0.35;
		slopes += g * near;
	}
	let shock = titanShockSurfaceDetail( lagXZ );
	slopes += shock.xy;
	foamSum += shock.z * 1.8;
	aeration += shock.w;
	let jac = ( d.z + 1.0 ) * ( d.w + 1.0 );
${ WK ? /* wgsl */`
	{
		let w = wakeFragment( lagXZ );
		slopes += w.slopes;
		foamSum += w.foam;
		aeration += w.aeration;
	}` : '' }

	// base normal: large shoreline waves (per-vertex, can overhang) perturbed by FFT detail
	var normal: vec3f;
	var baseNormal = vec3f( 0.0, 1.0, 0.0 );
${ SH ? /* wgsl */`
	{
		// On a coarse mesh the shore normal can flip between the vertices of a folding crest: the
		// interpolated vector then cancels out (or is NaN). Keep it finite and facing up; NaN
		// would otherwise surface as a white-hot cell after the output clamp.
		let sn = clamp( shoreN, vec3f( -1.0 ), vec3f( 1.0 ) ) + vec3f( 0.0, 1e-3, 0.0 );
		let Ns0 = sn / max( length( sn ), 1e-4 );
		let Ns = normalize( vec3f( Ns0.x, max( Ns0.y, 0.12 ), Ns0.z ) );
		baseNormal = Ns;
		// the ripples and chop ride on the wave: the detail normal is rotated onto the tilted face
		// (reoriented normal mapping) instead of being flattened by it, so a steep face keeps the
		// full texture of the sea surface rather than turning into smooth plastic
		let nd = normalize( vec3f( - slopes.x, 1.0, - slopes.y ) );
		let tq = Ns + vec3f( 0.0, 1.0, 0.0 );
		let uq = vec3f( slopes.x, 1.0, slopes.y ) * nd.y;
		normal = normalize( tq * ( dot( tq, uq ) / tq.y ) - uq );
		foamSum += shoreFoam * ${ SIM ? '0.55' : '1.0' };
		// the roller and the water behind the plunge point are full of bubbles, decaying behind the
		// bore with the foam it sheds; the clear face of a plunging wave is not
		aeration += sat( shoreFoam * 1.2 + simFoam * 0.7 ) * ( 1.0 - face ) * smoothstep( -0.1, 0.3, depth );
	}` : /* wgsl */`
	normal = normalize( vec3f( - slopes.x, 1.0, - slopes.y ) );` }

	// whitecaps: persistent (per vertex) + fresh where the surface is compressed right now;
	// more of them inside gusts, plus windrow lines in fresh wind
	let fresh = sat( ( ocean.foamBias - 0.15 - jac ) * 2.0 );
	var whitecaps = vertexFoam + fresh;
${ DT ? '	whitecaps = whitecaps * mix( 0.5, 1.5, det.gust ) + det.streak * 0.5;' : '' }
	let coverage = sat( ( foamSum + whitecaps ) * waterSurface.foamCoverage );

	// foam pattern: an irregular bubbly mat thresholded by coverage, so foam grows, tears into
	// lace and dissolves naturally
	let fuv = lagXZ * waterSurface.foamScale;
	let p1 = textureSample( waterFoamTex, smpAniso4Repeat, fuv );
	// second layer at another scale, rotated, to break repetition
	let r2 = vec2f( fuv.x * 0.8 - fuv.y * 0.6, fuv.x * 0.6 + fuv.y * 0.8 );
	let p2 = textureSample( waterFoamTex, smpAniso4Repeat, r2 * 2.37 + vec2f( 0.31, 0.77 ) );
	let pattern = p1.x * 0.62 + p2.x * 0.38;
	let thresh = 1.05 - coverage * 1.1;
	let soft = 0.06 + footprint * 0.1;
	let detail = smoothstep( thresh - soft, thresh + soft, pattern ) * ( p1.y * 0.25 + 0.8 );
	// at distance the pattern averages out -> use coverage directly
	let far = smoothstep( 0.15, 1.2, footprint );
	var foam = mix( detail, coverage * 0.85, far );

	var o: WaterSurfaceFrag;
${ SF ? /* wgsl */`
	// foam look (surf zone whitewater / lace, see SurfFoam)
	var fa: SurfFoamArgs;
	fa.coverage = coverage; fa.foam = foam; fa.footprint = footprint; fa.depth = depth; fa.bubbles = p1.y;
	fa.lagXZ = lagXZ; fa.normal = normal; fa.baseNormal = baseNormal;
	fa.fresh = ${ SH ? 'shoreFoam' : '0.0' }; fa.sim = simFoam; fa.simState = simState; fa.roller = ${ SH ? 'surfMask.y' : '0.0' }; fa.P = P;
	o.foamInfo = surfFoamShading( fa );
	foam = o.foamInfo.foam;` : '' }

	o.normal = normal;
	o.foam = foam;
	o.coverage = coverage;
	o.slopes = slopes;
	o.jacobian = jac;
	o.rough = rough;
	o.aeration = sat( aeration );
	o.gust = ${ DT ? 'det.gust' : '0.5' };
	o.slick = ${ DT ? 'det.slick' : '0.0' };
	return o;
}
`;

		return new ShaderModule( {
			name: 'waterSurface',
			deps: [ commonModule, fft.module, this.cdlod.module, this.attenuationModule, this.titanShockModule, T && this.terrain.module, SH && this.shore.module,
				WK && this.wake.module, DT && this.detail.module, SF && SF.module ],
			uniforms: this.params,
			uniformName: 'waterSurface',
			bindings: { waterFoamTex: { texture: this.foamTexture } },
			code: vertex + fragment,
		} );

	}

	// Three-compatible helpers returning WGSL (for callers that composed TSL before).
	seaDepth( xz ) {

		return `waterSurfaceSeaDepth( ${ xz } )`;

	}

	cascadeAttenuation( c, depth ) {

		return `waterSurfaceCascadeAttenuation( ${ c }, ${ depth } )`;

	}

}
