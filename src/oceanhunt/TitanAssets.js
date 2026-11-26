// Licensed, locally bundled CC0 PBR creature models. They load only when a
// player approaches their distant encounter region, avoiding a large startup
// texture upload and leaving the procedural fallback available offline.
import { Group, Mesh, BufferGeometry, BufferAttribute, Color, Matrix4, Quaternion, Vector3 } from '../engine/index.js';
import { loadGLB, decodeImage } from '../engine/loaders/GLTF.js';
import { Texture } from '../engine/gpu/Texture.js';
import { generateMipmaps } from '../engine/gpu/Mipmaps.js';
import { Material } from '../engine/render/Material.js';
import { SkinnedModel } from '../engine/render/Skinning.js';
import { upgradeLeviathanRig } from './LeviathanRig.js';

export const TITAN_ASSETS = Object.freeze( {
	shark: { url: '/models/titans/great-white-shark.glb', length: 27, axis: 'z' },
	turtle: { url: '/models/titans/sea-turtle.glb', length: 27, axis: 'z' },
	squid: { url: '/models/titans/kraken.glb', length: 25, axis: 'y' },
	leviathan: { url: '/models/titans/abyssal-hydra.glb', fallbackUrl: '/models/titans/leviathan.glb', length: 70, axis: 'z' },
} );

// Keep the V16-V22 four-creature registry stable for saves and regression
// checks. V23's final creature and player vehicle form a separate chapter.
export const ABYSS_ASSETS = Object.freeze( {
	// Optional artist-authored replacement. Never ship / substitute an unverified
	// Sketchfab asset: install only with the creator's license and model ZIP.
	sea_god: { url: '/models/titans/rigged/sea-god-skeleton.glb',
		externalUrl: '/models/titans/external/leviathan-monster.glb', length: 250, axis: 'z', artistAxis: 'z' },
	abyss_sub: { url: '/models/abyss/deepsea-demon-whale.glb',
		externalUrl: '/models/abyss/external/nautilus-sdc.glb', length: 36, axis: 'z', artistAxis: 'x', artistYaw: -Math.PI / 2 },
} );

export const TITAN_SKELETONS = Object.freeze( {
	shark: '/models/titans/rigged/shark-skeleton.glb',
	turtle: '/models/titans/rigged/turtle-skeleton.glb',
	squid: '/models/titans/rigged/kraken-skeleton.glb',
	leviathan: '/models/titans/rigged/downloaded-hydra-skeleton.glb',
	sea_god: '/models/titans/rigged/sea-god-skeleton.glb',
} );

async function createSkinnedTitanAsset( id, gltf, { preserveArtistPBR = false } = {} ) {
	const config = TITAN_ASSETS[ id ] || ABYSS_ASSETS[ id ];
	if ( ! gltf.skins?.length ) throw new Error( `Skinned GLB ${ id } has no armature` );
	const anatomicalRig = id === 'sea_god' && preserveArtistPBR ? upgradeLeviathanRig( gltf ) : null;
	const skinNodes = gltf.nodes.filter( n => n.mesh !== undefined && n.skin === 0 );
	if ( ! skinNodes.length ) throw new Error( `Skinned GLB ${ id } has no skin-linked mesh` );
	const min = [ Infinity, Infinity, Infinity ], max = [ -Infinity, -Infinity, -Infinity ];
	for ( const node of skinNodes ) for ( const primitive of gltf.meshes[ node.mesh ] ) {
		const positions = asFloat( primitive.attributes.POSITION );
		for ( let i = 0; i < positions.length; i += 3 ) for ( let j = 0; j < 3; j ++ ) {
			min[ j ] = Math.min( min[ j ], positions[ i + j ] );
			max[ j ] = Math.max( max[ j ], positions[ i + j ] );
		}
	}
	const skeleton = await SkinnedModel.create( gltf, {
		materials( { gltfMaterial } ) {
			const p = gltfMaterial.pbrMetallicRoughness || {};
			const color = p.baseColorFactor || [ 1, 1, 1, 1 ];
			return {
				color: new Color( color[ 0 ], color[ 1 ], color[ 2 ] ),
				roughness: preserveArtistPBR ? ( p.roughnessFactor ?? .72 ) : Math.max( 0.65, p.roughnessFactor ?? 0.91 ),
				metalness: preserveArtistPBR ? ( p.metallicFactor ?? 0 ) : Math.min( 0.05, p.metallicFactor ?? 0 ),
				uniforms: { titanAgitation: [ 'f32', 0 ], titanPain: [ 'f32', 0 ],
					biteOpen: [ 'f32', 0 ] },
				// The licensed Leviathan's 66-joint rig has no distinct mandible
				// joint. Deform ONLY the anatomically lower front lip in bind
				// coordinates, with a feathered hinge. At full open this creates
				// an ~14m mouth gape at the 250m final-boss scale; body, eyes,
				// flippers and upper muzzle retain the artist's original shape.
				vertexMotion: id === 'sea_god' && preserveArtistPBR ? /* wgsl */`
					let muzzle = smoothstep( 0.064, 0.124, v.position.z );
					let jaw = 1.0 - smoothstep( 0.156, 0.168, v.position.y );
					let opening = clamp( mat.biteOpen, 0.0, 1.0 ) * muzzle * jaw;
					v.position.y -= 0.0140 * opening;
					v.position.z -= 0.0016 * opening;
				` : '',
				surface: preserveArtistPBR ? /* wgsl */`
					s.albedo = mix( s.albedo, vec3f( 0.75, 0.18, 0.11 ), clamp( mat.titanPain * 0.26, 0.0, 0.26 ) );
				` : /* wgsl */`
					s.roughness = clamp( s.roughness, 0.52, 0.98 );
					s.albedo = mix( s.albedo, vec3f( 0.48, 0.075, 0.065 ), clamp( mat.titanPain * 0.32, 0.0, 0.32 ) );
				`,
			};
		},
	} );
	const axis = config.axis === 'y' ? 1 : 2;
	const scale = config.length / Math.max( 1e-3, max[ axis ] - min[ axis ] );
	const root = skeleton.group;
	root.name = `TrueSkinnedTitan_${ id }`;
	root.scale.setScalar( scale );
	root.position.set( -( min[ 0 ] + max[ 0 ] ) * 0.5 * scale,
		-( min[ 1 ] + max[ 1 ] ) * 0.5 * scale, -( min[ 2 ] + max[ 2 ] ) * 0.5 * scale );
	for ( const mesh of skeleton.meshes ) mesh.castShadow = false;
	return { root, skeleton, materials: skeleton.materials, bounds: { min, max, scale }, trueSkin: true, anatomicalRig };
}

function asFloat( data ) {
	if ( data.array instanceof Float32Array ) return data.array;
	const normalized = data.normalized;
	const divisor = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[ data.componentType ] || 1;
	const out = new Float32Array( data.array.length );
	for ( let i = 0; i < out.length; i ++ ) out[ i ] = normalized ? Math.max( - 1, data.array[ i ] / divisor ) : data.array[ i ];
	return out;
}

function oceanMotion( species ) {
	if ( species === 'abyss_sub' || species === 'sea_god' ) return '';
	if ( species === 'shark' ) return /* wgsl */`
		let caudal = smoothstep( 0.2, 2.5, max( 0.0, -v.position.z ) );
		v.position.x += sin( frame.time * ( 2.7 + mat.titanAgitation * 2.1 ) - v.position.z * 1.25 ) * caudal * ( 0.18 + mat.titanAgitation * 0.36 );
		v.position.y += sin( frame.time * 4.0 - v.position.z ) * caudal * mat.titanAgitation * 0.075;
	`;
	if ( species === 'turtle' ) return /* wgsl */`
		let fin = smoothstep( 0.2, 0.55, abs( v.position.x ) );
		v.position.y += sin( frame.time * ( 1.4 + mat.titanAgitation * 1.5 ) + v.position.z * 2.5 ) * fin * ( 0.05 + mat.titanAgitation * 0.11 );
	`;
	if ( species === 'squid' ) return /* wgsl */`
		let tentacle = smoothstep( 0.1, 2.0, abs( v.position.y ) );
		v.position.x += sin( frame.time * ( 0.95 + mat.titanAgitation * 0.85 ) + v.position.y * 2.3 + v.position.z ) * ( 0.065 + mat.titanAgitation * 0.18 ) * tentacle;
	`;
	return /* wgsl */`
		v.position.x += sin( frame.time * ( 0.55 + mat.titanAgitation * 0.8 ) + v.position.z * 0.22 ) * ( 0.32 + mat.titanAgitation * 0.5 );
		v.position.y += sin( frame.time * 1.3 + v.position.x * 0.17 ) * mat.titanAgitation * 0.12;
	`;
}

function pbrMaterial( species, name, gltfMaterial, textures, preserveArtistPBR = false ) {
	const p = gltfMaterial.pbrMetallicRoughness || {};
	const mechanical = species === 'abyss_sub';
	const rgb = p.baseColorFactor || [ 1, 1, 1, 1 ];
	const glow = gltfMaterial.emissiveFactor || [ 0, 0, 0 ];
	const strength = preserveArtistPBR ? ( gltfMaterial.extensions?.KHR_materials_emissive_strength?.emissiveStrength || 1 ) : 1;
	const translucency = gltfMaterial.alphaMode === 'BLEND';
	const normalScale = Math.max( 0, Math.min( 2, Number( gltfMaterial.normalTexture?.scale ?? 1 ) ) ).toFixed( 3 );
	const has = { ALBEDO: !! textures.albedo, ORM: !! textures.orm, NORMAL: !! textures.normal };
	return new Material( {
		name: 'titan-pbr-' + name,
		color: new Color( rgb[ 0 ], rgb[ 1 ], rgb[ 2 ] ),
		emissive: new Color( glow[ 0 ] * strength, glow[ 1 ] * strength, glow[ 2 ] * strength ),
		opacity: rgb[ 3 ] ?? 1,
		transparent: translucency,
		depthWrite: !translucency,
		roughness: p.roughnessFactor ?? ( mechanical ? .35 : .94 ),
		metalness: preserveArtistPBR ? ( p.metallicFactor ?? 0 ) : mechanical ? ( p.metallicFactor ?? .6 ) : Math.min( 0.05, p.metallicFactor ?? 0 ),
		uniforms: { titanAgitation: [ 'f32', 0 ], titanPain: [ 'f32', 0 ] },
		vertex: oceanMotion( species ),
		side: gltfMaterial.doubleSided ? 'double' : 'front',
		textures: {
			...( has.ALBEDO ? { titanAlbedo: textures.albedo } : {} ),
			...( has.ORM ? { titanOrm: textures.orm } : {} ),
			...( has.NORMAL ? { titanNormal: textures.normal } : {} ),
		},
		defines: { TITAN_ALBEDO: has.ALBEDO ? 1 : 0, TITAN_ORM: has.ORM ? 1 : 0, TITAN_NORMAL: has.NORMAL ? 1 : 0 },
		surface: /* wgsl */`
#if TITAN_ALBEDO
	let albedo = textureSample( titanAlbedo, smpAnisoRepeat, in.uv );
	s.albedo *= albedo.rgb;
	s.alpha *= albedo.a;
#endif
#if TITAN_ORM
	let orm = textureSample( titanOrm, smpAnisoRepeat, in.uv );
	s.roughness = clamp( s.roughness * orm.g, ${ mechanical ? '0.16, 0.85' : '0.55, 0.98' } );
	s.metalness = ${ mechanical ? 'clamp( s.metalness * orm.b, 0.0, 1.0 )' : 'min( 0.06, s.metalness * orm.b )' };
#endif
#if TITAN_NORMAL
	let nm = textureSample( titanNormal, smpAnisoRepeat, in.uv ).xyz * 2.0 - 1.0;
	s.normal = perturbNormalByMap( in.P, in.N, in.uv, vec3f( nm.xy * ${ normalScale }, nm.z ) );
#endif
	${ mechanical || preserveArtistPBR ? '' : 's.albedo = mix( s.albedo, vec3f( 0.54, 0.12, 0.085 ), clamp( mat.titanPain * 0.35, 0.0, 0.35 ) );' }
`,
	} );
}

export async function createTitanAsset( id ) {
	const config = TITAN_ASSETS[ id ] || ABYSS_ASSETS[ id ];
	if ( ! config ) throw new Error( 'No licensed detailed asset for ' + id );
	let external = null;
	if ( config.externalUrl ) {
		try {
			external = await loadGLB( config.externalUrl );
			if ( !external.meshes?.length ) throw new Error( 'artist model has no meshes' );
			if ( id === 'sea_god' && external.skins?.length && external.animations?.length ) {
				try {
					const result = await createSkinnedTitanAsset( id, external, { preserveArtistPBR: true } );
					result.externalAnimationClips = result.skeleton.clipNames();
					if ( result.externalAnimationClips.length ) {
						result.externalLicensed = true;
						return result;
					}
				} catch ( skinError ) { console.info( 'Licensed Leviathan uses the static-PBR path:', skinError.message ); }
			}
		} catch ( error ) {
			// Keep the known playable internal art if optional model decoding fails.
			console.info( `Licensed artist model for ${ id } unavailable; using local fallback:`, error.message );
			external = null;
		}
	}
	if ( !external && TITAN_SKELETONS[ id ] ) {
		try { return await createSkinnedTitanAsset( id, await loadGLB( TITAN_SKELETONS[ id ] ) ); }
		catch ( error ) { console.warn( `Titan ${ id }: skinned rig unavailable; fallback detail retained`, error ); }
	}
	let gltf = external;
	if ( !gltf ) {
		try { gltf = await loadGLB( config.url ); }
		catch ( error ) {
			if ( ! config.fallbackUrl ) throw error;
			console.warn( 'Optional CC0 hydra asset unavailable; retaining bundled offline leviathan skin.', error );
			gltf = await loadGLB( config.fallbackUrl );
		}
	}
	if ( ! gltf.meshes.length ) throw new Error( 'Detailed asset contains no meshes: ' + id );
	const textureCache = new Map();
	const materialCache = new Map();
	const root = new Group(); root.name = `DetailedTitan_${ id }`;
	const art = new Group(); art.name = `LicensedMeshCoordinates_${ id }`;
	root.add( art );
	const min = [ Infinity, Infinity, Infinity ], max = [ - Infinity, - Infinity, - Infinity ];

	async function texture( info, srgb ) {
		if ( ! info ) return null;
		const source = gltf.textures[ info.index ]?.source;
		if ( source === undefined ) return null;
		const key = `${ source }:${ srgb }`;
		if ( ! textureCache.has( key ) ) {
			const im = gltf.images[ source ];
			if ( ! im?.bytes ) return null;
			const px = await decodeImage( im.bytes, im.mimeType );
			const t = new Texture( {
				label: `titan-${ id }-${ key }`, width: px.width, height: px.height,
				format: srgb ? 'rgba8unorm-srgb' : 'rgba8unorm',
				data: px.data, mips: true, usage: [ 'sample', 'copyDst' ], sampler: 'anisoRepeat',
			} );
			t.getGPU();
			generateMipmaps( t );
			textureCache.set( key, t );
		}
		return textureCache.get( key );
	}

	async function material( index ) {
		if ( ! materialCache.has( index ) ) {
			const gm = gltf.materials[ index ] || {};
			const pbr = gm.pbrMetallicRoughness || {};
			const maps = {
				albedo: await texture( pbr.baseColorTexture, true ),
				normal: await texture( gm.normalTexture, false ),
				orm: await texture( pbr.metallicRoughnessTexture, false ),
			};
			materialCache.set( index, pbrMaterial( id, gm.name || id, gm, maps, !!external ) );
		}
		return materialCache.get( index );
	}

	async function buildNode( index, parent, parentWorld ) {
		const n = gltf.nodes[ index ];
		const g = new Group();
		g.name = n.name || `titan-node-${ index }`;
		g.position.set( ...n.t );
		g.quaternion.set( ...n.r );
		g.scale.set( ...n.s );
		parent.add( g );
		const world = parentWorld.clone().multiply( new Matrix4().compose(
			new Vector3( ...n.t ), new Quaternion( ...n.r ), new Vector3( ...n.s ) ) );
		if ( n.mesh !== undefined ) {
			for ( const p of gltf.meshes[ n.mesh ] ) {
				if ( p.mode !== 4 || ! p.attributes.POSITION ) continue;
				const A = p.attributes, positions = asFloat( A.POSITION );
				const geometry = new BufferGeometry();
				geometry.setAttribute( 'position', new BufferAttribute( positions, 3 ) );
				if ( A.NORMAL ) geometry.setAttribute( 'normal', new BufferAttribute( asFloat( A.NORMAL ), 3 ) );
				geometry.setAttribute( 'uv', new BufferAttribute( A.TEXCOORD_0 ? asFloat( A.TEXCOORD_0 ) : new Float32Array( positions.length / 3 * 2 ), 2 ) );
				if ( p.indices ) geometry.setIndex( new BufferAttribute( p.indices instanceof Uint8Array ? Uint16Array.from( p.indices ) : p.indices, 1 ) );
				geometry.computeBoundingSphere();
				const point = new Vector3();
				for ( let i = 0; i < positions.length; i += 3 ) {
					point.set( positions[ i ], positions[ i + 1 ], positions[ i + 2 ] ).applyMatrix4( world );
					for ( let k = 0; k < 3; k ++ ) {
						const v = k === 0 ? point.x : k === 1 ? point.y : point.z;
						min[ k ] = Math.min( min[ k ], v ); max[ k ] = Math.max( max[ k ], v );
					}
				}
				const mesh = new Mesh( geometry, await material( p.material ) );
				mesh.name = `BossPBR_${ id }`;
				mesh.castShadow = false;
				mesh.receiveShadow = true;
				mesh.frustumCulled = false;
				g.add( mesh );
			}
		}
		for ( const child of n.children ) await buildNode( child, g, world );
	}
	for ( const r of gltf.roots ) await buildNode( r, art, new Matrix4() );
	const modelAxis = external ? config.artistAxis || config.axis : config.axis;
	const axis = modelAxis === 'x' ? 0 : modelAxis === 'y' ? 1 : 2;
	const span = Math.max( max[ axis ] - min[ axis ], 1e-3 );
	const scale = config.length / span;
	root.scale.setScalar( scale );
	// Artist files routinely have FBX-centimeter units, non-zero transforms,
	// and X-forward meshes. Normalize the *transformed* bounds in native space,
	// then rotate the whole visible assembly into +Z (ship's actual heading).
	art.position.set( - ( min[ 0 ] + max[ 0 ] ) * 0.5,
		- ( min[ 1 ] + max[ 1 ] ) * 0.5, - ( min[ 2 ] + max[ 2 ] ) * 0.5 );
	if ( external && config.artistYaw ) root.rotation.y = config.artistYaw;
	return { root, materials: [ ...materialCache.values() ], bounds: { min, max, scale },
		externalLicensed: !!external, trueSkin: false };
}
