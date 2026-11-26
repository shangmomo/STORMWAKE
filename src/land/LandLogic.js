import {advanceLurker,LURKER} from './LurkerV83.js';
import {advanceBear} from './BearBrainV73.js';
import { advanceCorsair, CORSAIR } from './LandCorsairBrain.js';
// STORMWAKE V31: CPU-only land expedition, enemy AI and safe save migration.
// Keeping this module independent of the renderer makes encounter timing testable.

export const LAND_SAVE_KEY = 'tidewater:land-expedition:v31';

export const LAND_SITES = Object.freeze( {
	board: { x: 57, z: -80 },
	forest: { x: -43, z: -167 },
	lighthouse: { x: -140, z: -260 },
	// Terrain-tested switchbacks: path replanned at 2m lattice resolution and
	// compressed only where sub-meter interpolation stays under 0.60 gradient.
	trail: [ [ 57, -80 ], [ 20, -132 ], [ -30, -164 ], [ -82, -208 ],
		[ -98, -220 ], [ -136, -220 ], [ -138, -220 ], [ -142, -220 ],
		[ -144, -254 ], [ -140, -260 ] ],
	// These are walkable terrain placements; height is sampled at runtime.
	mirrors: [ [ -151, -257 ], [ -136, -247 ], [ -129, -265 ] ],
} );

export const LAND_SPECIES = Object.freeze( {
	lurker:{name:'岩湖潜伏者 · Lurker',hp:LURKER.hp,speed:0,sight:9,reach:3.15,windup:1.05,recovery:1.8,damage:23,reward:LURKER.reward},
	bear: {name:'灰苔棕熊',hp:235,speed:4.6,sight:15,reach:2.4,windup:.85,recovery:3.15,damage:23,reward:60},
	crab: { name: '潮蚀寄居兽', hp: 68, speed: 2.0, sight: 16, reach: 2.0, windup: .82, recovery: .95, damage: 12, reward: 8 },
	hound: { name: '夜影猎犬', hp: 52, speed: 3.6, sight: 24, reach: 1.9, windup: .48, recovery: .72, damage: 10, reward: 11 },
	wraith: { name: '失落水手', hp: 92, speed: 2.3, sight: 22, reach: 2.5, windup: .95, recovery: 1.05, damage: 16, reward: 17 },
	warden: { name: '灯塔守望者', hp: 520, speed: 2.75, sight: 36, reach: 3.65, windup: 1.26, recovery: 1.05, damage: 22, reward: 250 },
	corsair: { name: '荒潮掠影 · 凯洛', hp: CORSAIR.hp, speed: CORSAIR.speed, sight: 26, reach: CORSAIR.reach, windup: .72, recovery: .8, damage: 17, reward: 180 },
} );

export function restoreLandSave( raw ) {
	const data = raw && typeof raw === 'object' ? raw : {};
	return {
		stage: Number.isInteger( data.stage ) ? Math.max( 0, Math.min( 4, data.stage ) ) : 0,
		mirrors: Array.from( { length: 3 }, ( _, i ) => Number.isInteger( data.mirrors?.[ i ] ) ?
			( ( data.mirrors[ i ] % 4 ) + 4 ) % 4 : 0 ),
		kills: Number.isInteger( data.kills ) ? Math.max( 0, Math.min( 99999, data.kills ) ) : 0,
		shrineFound: data.shrineFound === true,
		lastRaidDay: Number.isInteger( data.lastRaidDay ) ? Math.max( 0, data.lastRaidDay ) : 0,
	};
}

export function landPhase( hour, restored = false ) {
	const h = ( ( Number.isFinite( hour ) ? hour : 12 ) % 24 + 24 ) % 24;
	if ( restored ) return h >= 20 || h < 4 ? 'guarded-night' : 'calm';
	if ( h >= 20 || h < 4 ) return 'invasion';
	if ( h >= 18.5 && h < 20 ) return 'warning';
	return 'calm';
}

export function allMirrorsAligned( angles ) {
	return Array.isArray( angles ) && angles.length === 3 && angles.every( ( a, i ) => a === [ 2, 1, 3 ][ i ] );
}

export function rotateMirror( angles, index ) {
	if ( !Array.isArray( angles ) || index < 0 || index > 2 ) return false;
	angles[ index ] = ( ( angles[ index ] || 0 ) + 1 ) % 4;
	return allMirrorsAligned( angles );
}

export function createLandEnemy( id, type, x, z, options = {} ) {
	const cfg = LAND_SPECIES[ type ];
	if ( !cfg ) throw new Error( `Unknown land creature ${type}` );
	return { id, type, x, z, homeX: x, homeZ: z, yaw: 0, hp: cfg.hp, maxHp: cfg.hp,
		state: 'idle', timer: 0, cooldown: .4, vx: 0, vz: 0, alert: 0, attackSerial: 0, attackStyle: 'claw',
		persistent: !! options.persistent, raid: !! options.raid, dead: false, ...options };
}

// Returns a single contact event when windup expires. No direct damage is dealt
// here: the game layer decides whether a timed dodge, guard or range check wins.
export function advanceLandEnemy( e, target, dt, { active = true, illuminated = false } = {} ) {
	dt = Math.max( 0, Math.min( .05, Number.isFinite( dt ) ? dt : 0 ) );
	const cfg = LAND_SPECIES[ e.type ];
	if(e.type==='lurker')return advanceLurker(e,target,dt,{active});
	if(e.type==='bear')return advanceBear(e,target,dt,{active});
	if (e.type === 'corsair') return advanceCorsair(e,target,dt,{active});
	if ( !cfg || e.dead || !active ) return { strike: false, moving: false };
	const dx = target.x - e.x, dz = target.z - e.z, distance = Math.hypot( dx, dz );
	const speed = cfg.speed * ( e.type === 'warden' && e.hp < cfg.hp * .5 ? 1.32 : 1 );
	const retreat = e.type === 'wraith' && illuminated;
	const approachX = distance > .001 ? dx / distance : 0;
	const approachZ = distance > .001 ? dz / distance : 0;
	e.cooldown = Math.max( 0, e.cooldown - dt );
	const heading = Math.atan2( dx, dz );
	const turn = (goal) => { const delta = Math.atan2(Math.sin(goal-e.yaw),Math.cos(goal-e.yaw)); const rate=e.type==='warden'?1.9:4.5; e.yaw+=Math.max(-rate*dt,Math.min(rate*dt,delta)); };
	const homeDistance=Math.hypot(e.x-e.homeX,e.z-e.homeZ);
	const leash=e.type==='warden'?18:34;
	const returning=homeDistance>leash||(distance>=cfg.sight&&homeDistance>1.5&&!retreat);
	if (!returning&&!['telegraph','recover','stagger'].includes(e.state)) turn(heading);
	let strike = false, moving = false, strikeStyle = 'claw';
	if ( e.state === 'stagger' || e.state === 'telegraph' || e.state === 'recover' ) {
		e.timer -= dt;
		if ( e.timer <= 0 ) {
			if ( e.state === 'telegraph' ) {
				strike = true;
				strikeStyle = e.attackStyle;
				e.attackSerial ++;
				e.state = 'recover';
				e.timer = cfg.recovery;
			} else e.state = 'chase';
		}
	} else if (returning) {
		e.state='return'; const homeHeading=Math.atan2(e.homeX-e.x,e.homeZ-e.z);turn(homeHeading);
		e.vx=(e.homeX-e.x)/homeDistance*cfg.speed*.7;e.vz=(e.homeZ-e.z)/homeDistance*cfg.speed*.7; moving=true;
	} else if ( distance < cfg.sight && !retreat ) {
		e.state = 'chase';
		e.alert = 2.5;
		if ( distance < ( e.type === 'warden' ? 6.2 : cfg.reach ) && e.cooldown <= 0 ) {
			e.state = 'telegraph';
			e.attackStyle = e.type === 'warden' ? [ 'sweep', 'shockwave', 'rush' ][ e.attackSerial % 3 ] : 'claw';
			const windup = cfg.windup * ( e.attackStyle === 'shockwave' ? 1.18 : e.attackStyle === 'rush' ? .73 : 1 ) *
				( e.type === 'warden' && e.hp < cfg.hp * .5 ? .78 : 1 );
			e.timer = windup;
			e.cooldown = windup + cfg.recovery + .18;
		} else if ( distance > cfg.reach * .72 ) {
			const alignment=Math.max(.12,Math.cos(heading-e.yaw));
			e.vx = Math.sin(e.yaw) * speed * alignment;
			e.vz = Math.cos(e.yaw) * speed * alignment;
			moving = true;
		}
	} else {
		e.alert = Math.max( 0, e.alert - dt );
		if ( retreat && distance < 11 ) {
			e.state = 'flee';
			e.vx = -approachX * cfg.speed * 1.3;
			e.vz = -approachZ * cfg.speed * 1.3;
			moving = true;
		} else {
			e.state = 'idle';
		}
	}
	if ( !moving ) { e.vx *= Math.exp( -dt * 12 ); e.vz *= Math.exp( -dt * 12 ); }
	return { strike, moving, distance, style: strikeStyle,
		damage: strikeStyle === 'shockwave' ? cfg.damage * .85 : strikeStyle === 'rush' ? cfg.damage * 1.12 : cfg.damage,
		range: strikeStyle === 'shockwave' ? 6.1 : strikeStyle === 'rush' ? 4.7 : cfg.reach + .35 };
}

export function landEnemyHit( e, amount ) {
	if ( e.dead || !( amount > 0 ) ) return false;
	e.hp = Math.max( 0, e.hp - amount );
	if ( e.hp === 0 ) { e.dead = true; e.state = 'dead'; e.timer = 0; }
	else { e.state = 'stagger'; e.timer = e.type==='bear'?2.87:e.type === 'warden' ? .18 : e.type === 'corsair' ? .28 : .34; e.cooldown = Math.max( e.cooldown, .6 ); }
	return e.dead;
}

export function targetWithinStrike( attacker, victim, range, vertical = 2.8 ) {
	return Math.hypot( attacker.x - victim.x, attacker.z - victim.z ) <= range &&
		Math.abs( ( attacker.y || 0 ) - ( victim.y || 0 ) ) <= vertical;
}

