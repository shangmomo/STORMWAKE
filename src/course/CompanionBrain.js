// Small, deterministic local controller. Model output is never executed as code.
export const COMPANION_SAVE_KEY = 'tidewater.course.companion.life.v1';
export const COMPANION_COMMANDS = Object.freeze( [ 'auto', 'follow', 'wait', 'home', 'sit', 'sleep' ] );
export const COMPANION_ACTIONS = Object.freeze( [ ...COMPANION_COMMANDS, 'stand', 'jump', 'wave', 'dance', 'spin' ] );
export const MEMORY_LIMIT = 24;

export function newCompanionState() {
	return { command: 'auto', energy: 85, curiosity: 65, bond: 0, mood: 'content', memories: [] };
}

export function restoreCompanionState( raw ) {
	const initial = newCompanionState();
	if ( ! raw || typeof raw !== 'object' ) return initial;
	const bounded = ( n, fallback ) => Number.isFinite( n ) ? Math.max( 0, Math.min( 100, n ) ) : fallback;
	return { ...initial, command: COMPANION_COMMANDS.includes( raw.command ) ? raw.command : 'auto',
		energy: bounded( raw.energy, initial.energy ), curiosity: bounded( raw.curiosity, initial.curiosity ), bond: bounded( raw.bond, 0 ),
		memories: Array.isArray( raw.memories ) ? raw.memories.filter( m => m && typeof m.type === 'string' && Number.isFinite( m.day ) ).slice( - MEMORY_LIMIT ).map( m => ( { type: m.type.slice( 0, 32 ), day: m.day, detail: String( m.detail || '' ).slice( 0, 60 ) } ) ) : [] };
}

export function addMemory( state, type, day, detail = '', once = false ) {
	if ( once && state.memories.some( m => m.type === type ) ) return false;
	state.memories.push( { type, day: Math.max( 1, Math.floor( day || 1 ) ), detail: String( detail ).slice( 0, 60 ) } );
	state.memories = state.memories.slice( - MEMORY_LIMIT );
	state.bond = Math.min( 100, state.bond + 1 );
	return true;
}

export function chooseCompanionGoal( state, { hour = 12, hasHome = false, playerMode = 'walk' } = {} ) {
	if ( state.command === 'sit' || state.command === 'sleep' ) return 'rest';
	if ( state.command === 'wait' ) return 'wait';
	if ( state.command === 'home' ) return hasHome ? 'home' : 'wait';
	if ( state.command === 'follow' ) return playerMode === 'walk' ? 'follow' : 'wait';
	if ( state.energy < 18 || hour >= 20 || hour < 6 ) return hasHome ? 'home' : 'rest';
	if ( playerMode !== 'walk' ) return 'wait';
	if ( hour >= 11 && hour < 14 && state.energy < 65 ) return 'rest';
	return state.curiosity > 45 ? 'explore' : 'follow';
}

// Common instructions work offline too; do not turn a negated request into an action.
export function parseCompanionCommand( message ) {
	const text = String( message || '' ).trim().toLowerCase();
	if ( /不要(?:再)?跟|别跟|不用跟|停止跟随|取消跟随|别过来|别走|不要走|停止跳舞|停止转圈|停下来|do not follow|don't follow|stop following/.test( text ) ) return 'wait';
	if ( /(?:不要|不许|别|禁止|不要再).{0,4}(?:跳|坐|挥手|跳舞|转|躺|趴|睡|回家|跟随|跟着|过来)|\b(?:don't|do not|stop)\s+(?:jump|sit|wave|dance|spin|sleep|follow)/.test( text ) ) return null;
	if ( /跳(?:一(?:个|段)?|个|支)?舞|dance/.test( text ) ) return 'dance';
	if ( /转一圈|转个圈|转圈|转身|旋转|\bspin\b|turn around/.test( text ) ) return 'spin';
	if ( /挥挥手|挥下手|挥手|打(?:个)?招呼|招招手|wave/.test( text ) ) return 'wave';
	if ( /跳一下|跳一跳|跳起来|跳跃|跳跳|跳一个|跳一次|^(?:小汐[，, ]*)?(?:请)?跳[。！! ]*$|\bjump\b/.test( text ) ) return 'jump';
	if ( /站起来|起立|站起身|站直|stand up/.test( text ) ) return 'stand';
	if ( /坐下|坐一会|坐着|坐一下|坐一坐|\bsit\b/.test( text ) ) return 'sit';
	if ( /去睡觉|睡觉|睡一会|睡下|躺下|趴下|休息一下|\bsleep\b|lie down|take a rest/.test( text ) ) return 'sleep';
	if ( /回家|回小屋|返回家园|回到家|go home|return home/.test( text ) ) return 'home';
	if ( /等我|等等|等一下|原地等|这里等|停下|站住|别动|等在|\bwait\b|stay here|stop moving/.test( text ) ) return 'wait';
	if ( /跟我|跟着|跟随|过来|来我身边|陪我走|一起走|follow|come here|come with me/.test( text ) ) return 'follow';
	if ( /自由活动|自主活动|自己玩|自己去|去探索|四处走|随便走|走一走|动一动|动起来|go explore|explore on your own/.test( text ) ) return 'auto';
	return null;
}
