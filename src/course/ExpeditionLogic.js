// Course extension: independent game objectives. No renderer or DOM dependencies.
// Positions are Tidewater world coordinates (x/z metres, +z faces the sea).
export const EXPEDITION_TASKS = Object.freeze( [
	{ id: 'pier', icon: '⚓', title: '走上海岛码头', hint: '沿木栈道向海边走，到码头中段看看风景。', titleEn: 'Reach the island pier', hintEn: 'Follow the wooden walkway toward the sea and explore the middle of the pier.', x: 55, z: - 9, radius: 12 },
	{ id: 'marta', icon: '🧭', title: '拜访装备商人', hint: '找到码头东侧的 Marta，认识岛上的伙伴。', titleEn: 'Meet the outfitter', hintEn: 'Find Marta east of the pier and meet one of the island locals.', x: 85.5, z: - 60.5, radius: 7 },
	{ id: 'sail', icon: '⛵', title: '第一次出海', hint: '走到码头尽头，按 E 登船，再驾驶或走上甲板。', titleEn: 'Take your first trip', hintEn: 'Head to the end of the pier, press E to board, then take the helm or walk onto the deck.', x: 64.5, z: 36.5, radius: 20 },
	{ id: 'reef', icon: '🐠', title: '探索珊瑚礁', hint: '驾驶小船或游泳，前往岛屿西南侧的珊瑚礁。', titleEn: 'Explore the coral reef', hintEn: 'Take the boat or swim to the coral reef southwest of the island.', x: - 78, z: 58, radius: 58 },
	{ id: 'catch', icon: '🎣', title: '捕获第一条鱼', hint: '按 R 拿出钓竿，抛竿、等待鱼上钩并成功收线。', titleEn: 'Catch your first fish', hintEn: 'Press R to equip your rod, cast, wait for a bite, then reel in a fish.' },
	{ id: 'homeDoor', icon: '🚪', title: '打开真正的小屋', hint: '在住宅门口按 E 开门。', titleEn: 'Open a cottage', hintEn: 'Press E at a cottage door to open it.' },
	{ id: 'settle', icon: '🏡', title: '选择海岛家园', hint: '进入小屋，在床边按 G 安家。', titleEn: 'Choose your island home', hintEn: 'Enter a cottage and press G beside the bed to make it your home.' },
	{ id: 'sleep', icon: '🌙', title: '在海岛睡一晚', hint: '在小屋的床边按 E 睡觉。', titleEn: 'Spend a night on the island', hintEn: 'Press E beside a cottage bed to sleep until morning.' },
] );

export const distanceXZ = ( p, target ) => ! p || ! Number.isFinite( p.x ) || ! Number.isFinite( p.z )
	? Infinity : Math.hypot( p.x - target.x, p.z - target.z );

export function isObjectiveComplete( task, state ) {

	if ( ! task || ! state ) return false;
	if ( task.id === 'catch' ) return Object.values( state.fishLog || {} ).some( ( v ) => Number( v && v.count ) > 0 );
	if ( task.id === 'homeDoor' ) return Number( state.openedHomes ) > 0;
	if ( task.id === 'settle' ) return !! state.home;
	if ( task.id === 'sleep' ) return Number( state.nights ) > 0;
	if ( task.id === 'sail' ) return state.mode === 'boat' || state.mode === 'deck';
	if ( task.id === 'reef' ) return distanceXZ( state.position, task ) <= task.radius &&
		[ 'boat', 'deck', 'swim' ].includes( state.mode );
	return state.mode === 'walk' && distanceXZ( state.position, task ) <= task.radius;

}

export function nextObjective( completedIds = [] ) {

	const done = new Set( completedIds );
	return EXPEDITION_TASKS.find( ( task ) => ! done.has( task.id ) ) || null;

}

export function currentGameSnapshot( app ) {

	const p = app.player;
	return {
		position: p ? { x: p.position.x, z: p.position.z } : null,
		mode: p ? p.mode : 'unknown',
		fishLog: app.game?.state?.log || {},
		timeOfDay: Number( app.settings?.timeOfDay ?? 12 ),
		money: Number( app.game?.state?.money ?? 0 ),
		day: Number( app.homeLife?.saveState?.day ?? 1 ),
		home: app.homeLife?.saveState?.home || null,
		nights: Number( app.homeLife?.saveState?.nights ?? 0 ),
		openedHomes: app.homeLife?.saveState?.openedHomes?.length ?? 0,
	};

}

export function locationHint( snapshot, target = null, language = 'zh' ) {

	const english = language === 'en';
	if ( ! target ) return english ? 'You have completed every island expedition task!' : '全部探索任务已完成！';
	if ( target.id === 'catch' ) return english ? 'Catch any fish with your rod to complete this task.' : '拿出钓竿钓到任意鱼即可完成。';
	if ( target.id === 'sail' ) return english ? 'Board the boat to complete this task automatically.' : '上船后探索任务会自动完成。';
	if ( [ 'homeDoor', 'settle', 'sleep' ].includes( target.id ) ) return english ? target.hintEn : target.hint;
	const distance = distanceXZ( snapshot.position, target );
	const hint = english ? target.hintEn : target.hint;
	if ( ! Number.isFinite( distance ) ) return hint;
	return english ? `About ${ Math.max( 0, Math.round( distance ) ) } m to go. ${ hint }` : `目标还有 ${ Math.max( 0, Math.round( distance ) ) } 米。${ hint }`;

}
