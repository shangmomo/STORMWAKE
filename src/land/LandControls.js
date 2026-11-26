// V32 input ownership: a land combat action is one input edge, handled once.
// These bindings deliberately retain old V30 controls outside combat.
export const LAND_BINDINGS = Object.freeze( {
	stance: 'KeyZ', light: 'KeyJ', heavy: 'KeyK', dodge: 'KeyQ',
	journal: 'KeyP', interact: 'KeyE', mouseLight: 0, mouseGuard: 2,
} );

export const LAND_COMBAT_KEYS = Object.freeze( [ 'KeyZ', 'KeyJ', 'KeyK', 'KeyQ', 'KeyP' ] );

export function landActionContext( app ) {
	const player = app?.player, hud = app?.game?.hud, input = app?.input;
	if ( !player || player.mode !== 'walk' || input?.enabled === false || app.freeCam || app.hunt?.abyss?.active ) return 'unavailable';
	if ( hud?.invOpen || hud?.standOpen || hud?.catchOpen || app.islandLife?.ui?.isOpen || app.homeLife?.sleeping || app.dialogue?.isOpen || app.ui?.ui?._photo || app.ui?.ui?._help ||
		app.expedition?.isOpen || app.companionUI?.isOpen ) return 'ui';
	return 'land';
}

export function landInputEdges( input, stance, prevMouse = false ) {
	const take = code => typeof input.consume === 'function' ? input.consume( code ) : input.hit( code );
	// Shift and modal combinations must be checked before consuming a press.
	const modified = input.down?.( 'ShiftLeft' ) || input.down?.( 'ShiftRight' );
	const toggle = modified ? false : take( LAND_BINDINGS.stance );
	// Shift+P belongs to photo mode, never to the land journal.
	const journal = modified ? false : take( LAND_BINDINGS.journal );
	// A heavy key never opens the companion UI while a sword is equipped.
	const light = stance && ( !modified && take( LAND_BINDINGS.light ) || !! ( input.mouseDown && !prevMouse ) );
	const heavy = stance && !modified && take( LAND_BINDINGS.heavy );
	const dodge = stance && !modified && take( LAND_BINDINGS.dodge );
	return { toggle, journal, light, heavy, dodge, guard: !!input.rightDown };
}

// Every multiplayer action gets a monotonic sequence, local simulation tick,
// action identifier and no client-side damage/reward in the wire payload.
export function makeLandActionEvent( { actorId, sequence, tick, action, direction, held = null } ) {
	if ( ! [ 'equip', 'light', 'heavy', 'dodge', 'guard', 'interact' ].includes( action ) ) throw new Error( 'Unknown combat action' );
	if ( !Number.isSafeInteger( sequence ) || sequence < 1 || !Number.isSafeInteger( tick ) || tick < 0 ) throw new Error( 'Invalid combat event sequence' );
	const d = Array.isArray( direction ) && direction.length === 3 && direction.every( Number.isFinite )
		? direction.map( v => Math.max( -1, Math.min( 1, v ) ) ) : [ 0, 0, -1 ];
	return Object.freeze( { version: 1, actorId: String( actorId || 'local' ).slice( 0, 64 ), sequence, tick,
		action, direction: d, held: action === 'guard' ? !!held : null, damage: null, reward: null } );
}

// Future co-op: only serialize a player's *request*. A server must check
// proximity, prerequisites, ownership and perform the actual state mutation.
const WORLD_VERBS = new Set( [ 'open-door', 'close-door', 'turn-mirror',
	'read-tablet', 'read-board', 'talk' ] );
export function makeLandWorldIntent( { actorId, sequence, tick, verb, targetId } ) {
	if ( !WORLD_VERBS.has( verb ) ) throw new Error( 'Unknown world interaction verb' );
	if ( !Number.isSafeInteger( sequence ) || sequence < 1 ||
		!Number.isSafeInteger( tick ) || tick < 0 ) throw new Error( 'Invalid world intent sequence' );
	const id = String( targetId || '' );
	if ( !/^land:[a-z0-9-]{3,80}$/.test( id ) ) throw new Error( 'Invalid interaction target' );
	return Object.freeze( { version: 1, actorId: String( actorId || 'local' ).slice( 0, 64 ),
		sequence, tick, verb, targetId: id, authoritative: false } );
}
