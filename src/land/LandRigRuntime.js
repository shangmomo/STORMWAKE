// Optional V32 art slots: real GLB skinning + authored action clips.
// No source asset is downloaded by the browser at runtime. Installed files
// must have a reviewed license/provenance entry in manifest.json.
import { loadGLB } from '../engine/loaders/GLTF.js';
import { SkinnedModel } from '../engine/render/Skinning.js';
import {Vector3} from '../engine/index.js';

// Bundled Quaternius humanoids face +Z. Anatomical left is +X when
// the actor faces +Z in this right-handed Y-up frame. Shoulder names alone
// must not be used to flip their authored face and locomotion direction.
export function inferPirateForward(_rig,_entry){return 0;}

const ROOT = ( import.meta.env?.BASE_URL || '/' ) + 'models/land/';
const CHARACTERS_ROOT = ( import.meta.env?.BASE_URL || '/' ) + 'models/characters/';
const ACTION_MATCH = Object.freeze( {
	// Ordered exact matches first. The imported packs often prefix clips with
	// AnimalArmature|, HumanArmature| or SkeletonArmature|SkeletonArmature|.
	idle: [ /^idle$/i, /(?:^|[|])(?:man_)?idle$/i, /^survey$/i, /^flying_idle$/i, /(?:^|[|_])idle$/i, /(?:^|[|_])idle(?:[_|]|$)/i, /rest/i ],
	walk: [ /^walk$/i, /(?:^|[|_])walk$/i, /locomotion.*walk/i ],
	run: [ /^run$/i, /^gallop$/i, /^fast_flying$/i, /(?:^|[|_])(?:run|running|gallop)$/i, /sprint/i, /jog/i, /flying$/i ],
	graze: [ /^eating$/i, /(?:^|[|_])eating$/i, /graze/i ],
	alert: [ /^idle_2$/i, /idle.*headlow/i, /(?:^|[|_])idle_2$/i ],
	attack: [ /^attack$/i, /^punch$/i, /^headbutt$/i, /(?:^|[|_])attack(?:[_|]|$)/i, /punch|headbutt|swing|slash/i ],
	heavy: [ /heavy/i, /attack.*(2|b)/i, /sword/i, /weapon/i ],
	hit: [ /^hitreact$/i, /(?:^|[|_])hit(?:react)?(?:[_|]|$)/i, /hurt/i, /damage/i, /recievehit/i ],
	dodge: [ /dodge/i, /roll/i, /evade/i, /^duck$/i ],
	block: [ /block/i, /guard/i ],
	death: [ /^death$/i, /(?:^|[|_])death$/i, /^die/i ],
	talk: [ /talk/i, /gestic/i ],
	greet: [ /^wave/i, /greet/i ],
} );

export function assignRigActions( clipNames ) {
	const names = [ ...clipNames ];
	const actions = {};
	for ( const [ action, expressions ] of Object.entries( ACTION_MATCH ) ) {
		const found = expressions.map( re => names.find( name => re.test( name ) ) ).find( Boolean );
		if ( found ) actions[ action ] = found;
	}
	return actions;
}

export function validateRigDefinition( entry ) {
	if ( !entry || typeof entry.file !== 'string' || !/^[a-z0-9_-]+\.glb$/i.test( entry.file ) )
		return { ok: false, reason: 'Only local, single-file GLB assets are allowed' };
	if ( entry.collection != null && entry.collection !== 'land' && entry.collection !== 'characters' )
		return { ok: false, reason: 'Unrecognized asset collection' };
	if ( ![ 'CC0', 'CC-BY-4.0', 'MIT' ].includes( entry.license ) )
		return { ok: false, reason: 'Missing or unreviewed redistribution license' };
	const scale = Number( entry.scale ?? 1 );
	if ( !Number.isFinite( scale ) || scale < .001 || scale > 30 ) return { ok: false, reason: 'Invalid model scale' };
	const yOffset = Number( entry.yOffset ?? 0 );
	if ( !Number.isFinite( yOffset ) || Math.abs( yOffset ) > 5 )
		return { ok: false, reason: 'Invalid ground-contact offset' };
	const yawOffset = Number( entry.yawOffset ?? 0 );
	if ( !Number.isFinite( yawOffset ) || Math.abs( yawOffset ) > Math.PI + .0001 )
		return { ok: false, reason: 'Invalid forward-axis correction' };
	return { ok: true, scale, yOffset, yawOffset };
}

// Parse shared source files once. Each actor still receives independent
// joint buffers and animation time, without decoding the same 5-MB GLB 20x.
const assetPromises = new Map();
function sharedGLB( url ) {
	if ( !assetPromises.has( url ) ) assetPromises.set( url, loadGLB( url ).catch( error => {
		assetPromises.delete( url ); throw error;
	} ) );
	return assetPromises.get( url );
}

let manifestPromise = null;
export async function landAssetManifest() {
	if ( typeof document === 'undefined' ) return null;
	if ( !manifestPromise ) manifestPromise = Promise.all( [
		fetch( ROOT + 'manifest.json' ).then( r => r.ok ? r.json() : null ),
		fetch( ROOT + 'v38_pirate_cast_manifest.json' ).then( r => r.ok ? r.json() : null ).catch( () => null ),
	] ).then( ( [ base, pirates ] ) => base ? ( {
		...base, actors: { ...base.actors, ...( pirates?.actors || {} ) },
	} ) : null ).catch( () => null );
	return manifestPromise;
}

export async function loadLandRig( slot ) {
	const manifest = await landAssetManifest();
	const entry = manifest?.actors?.[ slot ];
	const validation = validateRigDefinition( entry );
	if ( !validation.ok ) return null;
	try {
		const base = entry.collection === 'characters' ? CHARACTERS_ROOT : ROOT;
		const gltf = await sharedGLB( base + entry.file );
		if ( !gltf.skins.length || !gltf.animations.length ) throw new Error( 'Missing skeleton/animation' );
		const rig = await SkinnedModel.create( gltf );
		for ( const material of rig.materials ) material.underwaterLighting = 'lite';
		const actions = assignRigActions( rig.clipNames() );
		if ( !actions.idle ) throw new Error( 'No idle clip; model needs a compatible animation export' );
		const animalScale={fox:1.15,deer:1.15,boar:1.25};
		rig.group.scale.setScalar( validation.scale*(animalScale[slot]||1) );
		rig.group.position.y = validation.yOffset;
		const forwardCorrection=inferPirateForward(rig,entry);rig.group.rotation.y = validation.yawOffset+forwardCorrection;
		rig.play( actions.idle, { fade: .01 } );
		rig.update( 0 );
		return { rig, actions, slot,forwardCorrection, origin: entry.collection || 'land', license: entry.license, attribution: entry.attribution || '',
			missing: [ 'walk', 'run', 'attack', 'hit', 'death' ].filter( a => !actions[ a ] ) };
	} catch ( error ) {
		console.warn( `[Tidewater] ${ slot } external GLB rejected; preserving game fallback`, error );
		return null;
	}
}

export function playLandRigAction( actor, action, { oneShot = false, fade = .24 } = {} ) {
	if ( !actor?.rig ) return false;
	const clip = actor.actions[ action ] || ( action === 'run' ? actor.actions.walk : null ) || actor.actions.idle;
	if ( !clip ) return false;
	if ( actor.rig.current === clip && !oneShot ) return true;
	const layer=actor.rig.play( clip, { fade, loop: !oneShot } );
    if(oneShot&&layer?.ended){layer.time=0;layer.ended=false;layer.loop=false;}
	return !!actor.actions[ action ];
}
