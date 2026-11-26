import { standard } from '../materials/Materials.js';

// Biological skin is not polished brass. GeoKit supplies linear vertex albedo;
// the material adds continuous fine surface breakup in world-scale model units.
// Every creature owns one material and each articulated part uses that material,
// keeping one draw call per moving limb without allocating textures every frame.
const DETAILS = {
	shark: { name: 'shark denticles', scale: 10.0, grain: 38.0, rough: 0.66, stain: 0.16, shine: 0.08 },
	squid: { name: 'cephalopod chromatophores', scale: 3.3, grain: 19.0, rough: 0.68, stain: 0.26, shine: 0.05 },
	turtle: { name: 'ancient shell keratin', scale: 2.2, grain: 14.0, rough: 0.88, stain: 0.36, shine: 0.02 },
	leviathan: { name: 'abyssal scutes', scale: 5.0, grain: 29.0, rough: 0.77, stain: 0.30, shine: 0.04 },
};

export function createCreatureMaterial( species ) {
	const d = DETAILS[ species ];
	if ( ! d ) throw new Error( `Unknown creature material: ${ species }` );
	const mat = standard( {
		name: d.name,
		vertexColors: true,
		metalness: 0,
		roughness: d.rough,
		varyings: { vSkinLocal: 'vec3f' },
		vertex: 'o.vSkinLocal = v.position;',
	} );
	const f = x => Number( x ).toFixed( 5 );
	mat.surface = /* wgsl */`
	let p = in.vs.vSkinLocal;
	let mottled = mx_fractal_noise_float3( p * ${ f( d.scale ) }, 3, 2.0, 0.5 );
	let pores = mx_noise_float3( p * ${ f( d.grain ) } );
	let uneven = mx_noise_float3( p * vec3f( 0.34, 0.56, 0.46 ) );
	let shade = 0.78 + mottled * ${ f( d.stain ) } + pores * 0.12 + uneven * 0.12;
	let w = clamp( shade, 0.38, 1.16 );
	s.albedo = in.color.rgb * w;
	s.metalness = 0.0;
	s.roughness = clamp( ${ f( d.rough ) } + pores * 0.08 - mottled * ${ f( d.shine ) }, 0.43, 0.97 );
	`;
	return mat;
}

export const CREATURE_MATERIAL_PROFILES = Object.freeze( DETAILS );
