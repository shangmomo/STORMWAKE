export const LIFE_SAVE_KEY = 'tidewater.islandlife.v1';
export const MATERIALS = Object.freeze( { shell: '贝壳', driftwood: '漂流木', sea_glass: '海玻璃' } );
export const RECIPES = Object.freeze( {
	chair: { name: '木椅', icon: '🪑', cost: { driftwood: 2 }, size: [ 0.42, 0.42 ] },
	table: { name: '小木桌', icon: '🪵', cost: { driftwood: 3 }, size: [ 0.55, 0.45 ] },
	shelf: { name: '置物架', icon: '📚', cost: { driftwood: 4 }, size: [ 0.52, 0.32 ] },
	lamp: { name: '床头灯', icon: '💡', cost: { driftwood: 1, sea_glass: 2 }, size: [ 0.3, 0.3 ] },
	chime: { name: '贝壳风铃', icon: '🐚', cost: { shell: 3, driftwood: 1 }, size: [ 0.3, 0.3 ] },
	frame: { name: '海玻璃相框', icon: '🖼', cost: { sea_glass: 2, driftwood: 1 }, size: [ 0.3, 0.3 ] },
} );

const TEMPLATES = Object.freeze( [
	{ id: 'shell', title: '海滩拾贝', description: '接取后拾取 3 个贝壳。', event: 'collect', item: 'shell', target: 3, reward: 45 },
	{ id: 'wood', title: '寻找漂流木', description: '接取后拾取 2 根漂流木。', event: 'collect', item: 'driftwood', target: 2, reward: 40 },
	{ id: 'glass', title: '寻找海玻璃', description: '接取后拾取 2 块海玻璃。', event: 'collect', item: 'sea_glass', target: 2, reward: 50 },
	{ id: 'fish', title: '今天的渔获', description: '接取后钓到 2 条新鱼。', event: 'fish', target: 2, reward: 65 },
	{ id: 'mullet', title: '寻找条纹鲻鱼', description: '接取后钓到 1 条条纹鲻鱼；浅滩和码头常见。', event: 'fish', item: 'mullet', target: 1, reward: 70 },
	{ id: 'reef', title: '珊瑚礁之旅', description: '接取后亲自乘船或游泳抵达珊瑚礁。', event: 'reef', target: 1, reward: 80 },
	{ id: 'chartReef', title: '绘制珊瑚海图', description: '驾驶船前往珊瑚礁海域，按 Y 记录海洋生态。', event: 'survey', item: 'reef', target: 1, reward: 130 },
	{ id: 'chartDeep', title: '驶向远海', description: '出海前往深水航道，按 Y 勘测新的海域。', event: 'survey', item: 'deep', target: 1, reward: 165 },
	{ id: 'chartWest', title: '寻找西部暗礁', description: '驾船探索岛屿西侧水域，按 Y 完成海图勘测。', event: 'survey', item: 'west', target: 1, reward: 150 },
	{ id: 'trawl', title: '拖网丰收', description: '驾船按 N 放下拖网，保持航速，捕获 2 条鱼。', event: 'trawl', target: 2, reward: 155 },
	{ id: 'pot', title: '捕蟹人', description: '按 O 放置蟹笼，稍后返回附近按 U 回收渔获。', event: 'pot', target: 1, reward: 145 },
	{ id: 'blueRunner', title: '追踪蓝鲹鱼群', description: '前往海湾或码头捕获一条蓝鲹。', event: 'fish', item: 'blueRunner', target: 1, reward: 140 },
	{ id: 'deepFish', title: '远海丰收', description: '前往深水区钓到大型远洋鱼类。', event: 'deepFish', target: 1, reward: 165 },
] );
export function dailyQuests( day ) {
	const d = Math.max( 1, Math.floor( Number( day ) || 1 ) );
	// Sea exploration is now the main objective. Land collection survives as an
	// optional first-day tutorial, never as the mandatory daily grind.
	const charts = [ 'chartReef', 'chartDeep', 'chartWest' ];
	const fishing = [ 'trawl', 'pot', 'blueRunner', 'deepFish' ];
	const extras = [ 'shell', 'wood', 'glass', 'fish', 'mullet', 'reef' ];
	const ids = [ charts[ ( d - 1 ) % charts.length ], fishing[ ( d - 1 ) % fishing.length ],
		fishing[ ( d + 1 ) % fishing.length ], extras[ ( d - 1 ) % extras.length ] ];
	return ids.map( id => ( { ...TEMPLATES.find( t => t.id === id ), id: `${ d }:${ id }`, accepted: false, progress: 0, claimed: false } ) );
}
export function createLifeData( day = 1 ) {
	day = Math.max( 1, Math.floor( Number( day ) || 1 ) );
	return { v: 1, day, collected: [], resources: { shell: 0, driftwood: 0, sea_glass: 0 }, furniture: {}, placements: {}, nextId: 1, quests: dailyQuests( day ),
		marine: { pots: [], nextPot: 1, surveys: [], netCatches: 0 } };
}
const count = v => Number.isSafeInteger( v ) && v >= 0 ? Math.min( v, 100000 ) : 0;
export function restoreLifeData( raw, day = 1 ) {
	const d = createLifeData( raw?.v === 1 ? raw.day : day );
	if ( ! raw || raw.v !== 1 ) return d;
	for ( const k of Object.keys( MATERIALS ) ) d.resources[ k ] = count( raw.resources?.[ k ] );
	for ( const k of Object.keys( RECIPES ) ) d.furniture[ k ] = count( raw.furniture?.[ k ] );
	d.collected = Array.isArray( raw.collected ) ? [ ...new Set( raw.collected.filter( x => typeof x === 'string' && x.startsWith( `c:${ d.day }:` ) ).slice( 0, 30 ) ) ] : [];
	d.nextId = Math.max( 1, count( raw.nextId ) );
	if ( raw.marine && typeof raw.marine === 'object' ) {
		d.marine.nextPot = Math.max( 1, count( raw.marine.nextPot ) );
		d.marine.netCatches = count( raw.marine.netCatches );
		d.marine.pots = Array.isArray( raw.marine.pots ) ? raw.marine.pots.filter( p => p && /^pot:\d+$/.test( p.id ) && Number.isFinite( p.x ) && Number.isFinite( p.z ) && Number.isFinite( p.readyAt ) && Math.abs( p.x ) < 1024 && Math.abs( p.z ) < 1024 ).slice( 0, 2 ) : [];
		d.marine.surveys = Array.isArray( raw.marine.surveys ) ? [ ...new Set( raw.marine.surveys.filter( name => [ 'reef', 'deep', 'west', 'lagoon' ].includes( name ) ) ) ] : [];
	}
	if ( raw.placements && typeof raw.placements === 'object' && ! Array.isArray( raw.placements ) ) for ( const [ home, list ] of Object.entries( raw.placements ) ) {
		if ( ! /^[A-Z][0-9]?$/.test( home ) || ! Array.isArray( list ) ) continue;
		d.placements[ home ] = list.filter( p => p && RECIPES[ p.itemId ] && /^s:\d+:\d+$/.test( p.slotId ) && /^f:\d+$/.test( p.instanceId ) && Number.isInteger( p.rotation ) && p.rotation >= 0 && p.rotation < 4 ).slice( 0, 24 ).map( p => ( { itemId: p.itemId, slotId: p.slotId, instanceId: p.instanceId, rotation: p.rotation } ) );
	}
	for ( const list of Object.values( d.placements ) ) for ( const p of list ) { const m = /^f:(\d+)$/.exec( p.instanceId ); if ( m ) d.nextId = Math.max( d.nextId, Number( m[ 1 ] ) + 1 ); }
	if ( Array.isArray( raw.quests ) ) for ( const q of d.quests ) {
		const saved = raw.quests.find( v => v && v.id === q.id );
		if ( saved ) { q.accepted = saved.accepted === true; q.progress = Math.min( q.target, count( saved.progress ) ); q.claimed = saved.claimed === true; }
	}
	return d;
}

export class IslandLifeState {
	constructor( { storage = null, day = 1, wallet = null, notify = () => {} } = {} ) {
		this.storage = storage; this.wallet = wallet; this.notify = notify; this.persistent = !! storage;
		let raw; try { raw = JSON.parse( storage?.getItem( LIFE_SAVE_KEY ) || 'null' ); } catch { raw = null; }
		this.data = restoreLifeData( raw, day ); this.syncDay( day );
	}
	save() { try { if ( ! this.storage ) { this.persistent = false; return false; } this.storage.setItem( LIFE_SAVE_KEY, JSON.stringify( this.data ) ); this.persistent = true; return true; } catch { this.persistent = false; return false; } }
	syncDay( day ) {
		day = Math.floor( Number( day ) || 1 );
		if ( day <= this.data.day ) return false;
		this.data.day = day; this.data.collected = []; this.data.quests = dailyQuests( day ); this.data.marine.surveys = []; this.save(); return true;
	}
	accept( id ) { const q = this.data.quests.find( q => q.id === id ); if ( ! q || q.accepted || q.claimed ) return false; q.accepted = true; this.save(); return true; }
	event( kind, item = '' ) {
		let changed = false;
		for ( const q of this.data.quests ) if ( q.accepted && ! q.claimed && q.progress < q.target && q.event === kind && ( ! q.item || q.item === item ) ) {
			q.progress ++; changed = true;
			if ( q.progress === q.target ) this.notify( 'quest:completed', { id: q.id } );
		}
		if ( changed ) this.save();
	}
	deployPot( x, z, now ) {
		const m = this.data.marine;
		if ( m.pots.length >= 2 || ! Number.isFinite( x ) || ! Number.isFinite( z ) || ! Number.isFinite( now ) ||
			m.pots.some( p => Math.hypot( p.x - x, p.z - z ) < 14 ) ) return null;
		const pot = { id: `pot:${ m.nextPot ++ }`, x: Math.round( x * 10 ) / 10, z: Math.round( z * 10 ) / 10, readyAt: now + 24000 };
		m.pots.push( pot ); this.save(); return pot;
	}
	haulPot( id, now ) {
		const m = this.data.marine, i = m.pots.findIndex( p => p.id === id && p.readyAt <= now );
		if ( i < 0 ) return false;
		m.pots.splice( i, 1 ); this.event( 'pot' ); this.save(); return true;
	}
	survey( zone ) {
		if ( ! [ 'reef', 'deep', 'west', 'lagoon' ].includes( zone ) ) return false;
		const recorded = this.data.marine.surveys.includes( zone );
		if ( ! recorded ) { this.data.marine.surveys.push( zone ); this.save(); }
		this.event( 'survey', zone );
		return ! recorded;
	}
	trawlCatch() { this.data.marine.netCatches ++; this.event( 'trawl' ); this.save(); }
	collect( point ) {
		if ( ! point || typeof point.id !== 'string' || ! MATERIALS[ point.type ] || point.day !== this.data.day || ! point.id.startsWith( `c:${ this.data.day }:${ point.type }:` ) || this.data.collected.includes( point.id ) ) return false;
		this.data.collected.push( point.id ); this.data.resources[ point.type ] ++;
		this.event( 'collect', point.type ); this.save(); this.notify( 'resource:collected', { item: point.type } ); return true;
	}
	claim( id ) {
		const q = this.data.quests.find( q => q.id === id );
		if ( ! q || ! q.accepted || q.claimed || q.progress < q.target || ! this.wallet ) return false;
		const receipt = `islandlife:quest:${ q.id }`;
		if ( ! this.wallet.rewardReceipts.includes( receipt ) && ! this.wallet.grantMoney( q.reward, receipt ) ) return false;
		q.claimed = true; this.save(); this.notify( 'quest:claimed', { id: q.id } ); return true;
	}
	craft( itemId ) {
		const recipe = RECIPES[ itemId ];
		if ( ! recipe || Object.entries( recipe.cost ).some( ( [ k, n ] ) => this.data.resources[ k ] < n ) ) return false;
		for ( const [ k, n ] of Object.entries( recipe.cost ) ) this.data.resources[ k ] -= n;
		this.data.furniture[ itemId ] = ( this.data.furniture[ itemId ] || 0 ) + 1;
		this.save(); this.notify( 'furniture:crafted', { item: itemId } ); return true;
	}
	place( home, itemId, slotId, rotation, valid ) {
		if ( ! /^[A-Z][0-9]?$/.test( home || '' ) || ! RECIPES[ itemId ] || ! slotId || ! Number.isInteger( rotation ) || rotation < 0 || rotation > 3 || ! valid || ! this.data.furniture[ itemId ] ) return null;
		const list = this.data.placements[ home ] || ( this.data.placements[ home ] = [] );
		if ( list.length >= 24 || list.some( p => p.slotId === slotId ) ) return null;
		const p = { itemId, slotId, rotation, instanceId: `f:${ this.data.nextId ++ }` }; list.push( p ); this.data.furniture[ itemId ] --;
		this.save(); this.notify( 'furniture:placed', { item: itemId, home } ); return p;
	}
	remove( home, instanceId ) {
		const list = this.data.placements[ home ] || [], i = list.findIndex( p => p.instanceId === instanceId );
		if ( i < 0 ) return false;
		const [ item ] = list.splice( i, 1 ); this.data.furniture[ item.itemId ] = ( this.data.furniture[ item.itemId ] || 0 ) + 1; this.save(); return true;
	}
	move( home, instanceId, slotId, rotation, valid ) {
		const list = this.data.placements[ home ] || [], item = list.find( p => p.instanceId === instanceId );
		if ( ! item || ! valid || ! slotId || ! Number.isInteger( rotation ) || rotation < 0 || rotation > 3 || list.some( p => p !== item && p.slotId === slotId ) ) return false;
		item.slotId = slotId; item.rotation = rotation; this.save(); return true;
	}
}
