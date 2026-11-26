// Offshore encounter catalog. Coordinates are real world metres, not screen-space
// map positions. The first boss is over a kilometre from port; the final one
// is more than four kilometres out, beyond the island terrain texture domain.
export const SEA_TITANS = Object.freeze( [
	{ id: 'turtle', name: '苍穹巨海龟', en: 'Ancient shellback', icon: '🐢', region: 'westernShelf', x: - 1350, z: 1510, patrol: 56, patrolSeed: 0.2,
		territory: 310, leash: 355, detection: 135, noiseGain: 0.2, disengage: 200, alertRate: 0.35, lostAfter: 8,
		speed: 2.8, chaseSpeed: 5.5, attackRange: 42, hp: 650, armor: 0.28, radius: 9.6, strike: 22, period: 8.5,
		attack: 'tidal vortex', trophy: 'carapace', loot: { carapace: 1, bone: 8, oil: 4 }, color: 0x71ae88 },
	{ id: 'shark', name: '深蓝大白鲨', en: 'White death', icon: '🦈', region: 'easternBlue', x: 1190, z: 1430, patrol: 105, patrolSeed: 1.3,
		territory: 500, leash: 560, detection: 230, noiseGain: 0.48, disengage: 280, alertRate: 1, lostAfter: 11,
		speed: 8.5, chaseSpeed: 22, attackRange: 38, hp: 560, armor: 0.07, radius: 9, strike: 34, period: 6,
		attack: 'high-speed ram', trophy: 'tooth', loot: { tooth: 2, bone: 7, oil: 3 }, color: 0xb9d3d3 },
	{ id: 'squid', name: '深渊大王乌贼', en: 'Abyssal kraken', icon: '🦑', region: 'abyssalTrench', x: 1510, z: 3010, patrol: 75, patrolSeed: 2.3,
		territory: 410, leash: 465, detection: 180, noiseGain: 0.25, disengage: 260, alertRate: 0.62, lostAfter: 10,
		speed: 3.8, chaseSpeed: 9, attackRange: 55, hp: 850, armor: 0.16, radius: 12, strike: 37, period: 9.4,
		attack: 'tentacle strike + ink', trophy: 'ink', loot: { ink: 2, bone: 9, oil: 6 }, color: 0x9d6e9d },
	{ id: 'leviathan', name: '三首深海魇龙', en: 'Abyssal three-headed hydra', icon: '🐉', region: 'northernAbyss', x: - 1910, z: 3690, patrol: 130, patrolSeed: 3.2,
		territory: 670, leash: 740, detection: 300, noiseGain: 0.4, disengage: 450, alertRate: 0.8, lostAfter: 14,
		speed: 6, chaseSpeed: 14, attackRange: 82, hp: 1560, armor: 0.24, radius: 25, strike: 49, period: 10.4,
		attack: 'triple bite + deep-sea shockwave', trophy: 'scale', loot: { scale: 2, bone: 12, oil: 8, abyssHeart: 1 }, color: 0x5ca4b9 },
] );
export const TITAN_BY_ID = Object.freeze( Object.fromEntries( SEA_TITANS.map( b => [ b.id, b ] ) ) );

export const HUNT_WEAPONS = Object.freeze( {
	harpoon: { name: '甲板捕鲸叉', en: 'Deck harpoon', icon: '🔱', damage: 24, range: 86, reload: 1.45, speed: 48, type: 'pierce' },
	musket: { name: '海盗长枪', en: 'Corsair musket', icon: '🎯', damage: 44, range: 140, reload: 2.5, speed: 122, type: 'pierce' },
	cannon: { name: '舰载黑火药大炮', en: 'Broadside cannon', icon: '💣', damage: 82, range: 182, reload: 4.1, speed: 62, type: 'blast' },
	barbed: { name: '淬骨倒刺重叉', en: 'Barbed leviathan spear', icon: '⚔️', damage: 61, range: 125, reload: 2.05, speed: 82, type: 'pierce' },
	storm: { name: '风暴深水炮', en: 'Stormbreaker bombarde', icon: '⚡', damage: 128, range: 192, reload: 5.1, speed: 78, type: 'blast' },
	spyglass: { name: '黄铜航海望远镜', en: 'Brass spyglass', icon: '🔭', damage: 0, range: 1000, reload: 0, speed: 0, type: 'utility' },
} );

export const HUNT_RECIPES = Object.freeze( {
	musket: { name: '锻造海盗长枪', cost: { bone: 5, oil: 3, scrap: 3 }, note: '中程精确射击' },
	cannon: { name: '装备舰载火炮', cost: { bone: 7, oil: 5, scrap: 7 }, note: '重火力，爆炸伤害' },
	barbed: { name: '升级倒刺捕鲸叉', cost: { tooth: 1, bone: 8, scrap: 4 }, note: '大白鲨战利品，穿刺增伤' },
	storm: { name: '锻造风暴深水炮', cost: { ink: 1, carapace: 1, oil: 8, scrap: 12 }, note: '击败大王乌贼、远古海龟后解锁，用于迎战利维坦' },
	whaler: { name: '建造铁鲸号 · 重装猎兽船', cost: { bone: 16, oil: 9, scrap: 14, tooth: 1 }, note: '双门侧舷炮、船首长叉、绞盘' },
	abyss_sub: { name: '建造深海魔鲸号 · 深渊潜艇', cost: { abyssHeart: 1, scale: 2, bone: 8, oil: 8, scrap: 15, ink: 1 },
		note: '必须击败三首深海魇龙。六自由度潜航、声呐、深海鱼雷与深渊装甲。' },
} );

export const HUNT_MATERIALS = Object.freeze( {
	bone: '鱼骨', oil: '鱼油', scrap: '沉船铁料',
	tooth: '鲨牙', ink: '深渊墨囊', scale: '魇龙鳞', carapace: '古龟甲片',
	abyssHeart: '魇龙深渊心核', seaGodPearl: '海神源质',
} );

export const HUNT_KEY_ORDER = Object.freeze( [ 'harpoon', 'musket', 'cannon', 'barbed', 'storm', 'spyglass' ] );

export function titanNear( x, z, radius = Infinity ) {
	let candidate = null, best = radius;
	for ( const boss of SEA_TITANS ) {
		const d = Math.hypot( boss.x - x, boss.z - z );
		if ( d < best ) { candidate = boss; best = d; }
	}
	return candidate;
}
