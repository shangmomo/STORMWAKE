import {trenchDepthAt} from '../world/DeepBathymetry.js';
import { elementalSkill, isElemental } from './ElementalSkills.js';
// Deterministic, headless four-species territorial AI. Used by both offline
// gameplay and the LAN host; no GPU, DOM, or frame-rate dependency.
const clamp = ( x, lo, hi ) => Math.max( lo, Math.min( hi, x ) );
const dist = ( x, z, a, b ) => Math.hypot( x - a, z - b );
const afloat = p => p && ( p.mode === 'boat' || p.mode === 'deck' || p.mode === 'submarine' );
export const SWIM_PROFILES=Object.freeze({
 turtle:{depth:19,amplitude:9,turn:.48,accel:2.2,vertical:3.4,bank:.08,surface:-2.9},
 shark:{depth:29,amplitude:17,turn:1.05,accel:13,vertical:11,bank:.35,surface:-1.5},
 squid:{depth:40,amplitude:20,turn:.76,accel:5.5,vertical:8,bank:.15,surface:-2.7},
 leviathan:{depth:53,amplitude:17,turn:.64,accel:7,vertical:8,bank:.23,surface:-3.5}
});
const profile=def=>SWIM_PROFILES[def.id]||SWIM_PROFILES.shark;
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const approach=(a,b,n)=>a+clamp(b-a,-n,n);
const targetY=p=>Number.isFinite(p?.y)?p.y:0;
const distance3=(brain,p)=>Math.hypot(brain.x-p.x,brain.z-p.z,brain.y-targetY(p));
// All stock territories are offshore; use the same bathymetry fallback as the world.
export const offshoreFloor=(x,z)=>-90-trenchDepthAt(x,z);


export function createTitanBrain( def ) {
	return { x: def.x + def.patrol * 0.45, z: def.z, y:-profile(def).depth, heading: Math.atan2(Math.sin(def.patrolSeed)*def.patrol-def.patrol*.45,Math.cos(def.patrolSeed)*def.patrol*.72), pitch:0, bank:0,yawRate:0,verticalSpeed:0, state: 'patrol', targetId: null,
		alert: 0, lost: 0, cooldown: def.period * 0.45, windup: 0, charge: 0,
		attackIndex: 0, attack: null, patrolClock: 0, currentSpeed: 0 };
}

export function provokeTitan( brain, targetId = 'local' ) {
	brain.alert = 1;
	brain.targetId = targetId;
	if ( brain.state === 'patrol' || brain.state === 'alert' || brain.state === 'return' ) brain.state = 'chase';
}

export function titanSkill( def, attackIndex, enraged = false ) {
	const baseCount = def.id === 'squid' ? 2 : def.id === 'leviathan' ? ( enraged ? 3 : 2 ) : 1;
	const elemental = elementalSkill(def, attackIndex, baseCount);
	if (elemental) return elemental;
	attackIndex %= baseCount;
	if ( def.id === 'turtle' ) return { name: '旋涡壁垒', kind: 'vortex', radius: 46, damage: def.strike, windup: 2.4 };
	if ( def.id === 'shark' ) return { name: '深蓝破浪冲锋', kind: 'charge', radius: 19, damage: def.strike, windup: 1.3 };
	if ( def.id === 'squid' ) return attackIndex % 2 === 0
		? { name: '深渊腕足绞杀', kind: 'grapple', radius: 30, damage: def.strike, windup: 2.0 }
		: { name: '黑潮喷墨', kind: 'ink', radius: 66, damage: Math.round( def.strike * 0.7 ), windup: 1.5 };
	const stage = attackIndex % ( enraged ? 3 : 2 );
	if ( stage === 0 ) return { name: '三首狂噬', kind: 'triple_bite', radius: 35, damage: Math.round( def.strike * 1.55 ), windup: 1.7 };
	if ( stage === 1 ) return { name: '深海震荡波', kind: 'shockwave', radius: 88, damage: def.strike, windup: 2.6 };
	return { name: '灭港海啸', kind: 'maelstrom', radius: 110, damage: Math.round( def.strike * 1.22 ), windup: 3.2 };
}

// Velocity follows the body's forward direction; the creature cannot snap to
// a bearing or translate sideways. Depth and bank are continuous state, too.
function moveTo(def,brain,x,z,speed,dt,y=-profile(def).depth,terrain=offshoreFloor){
 const p=profile(def),dx=x-brain.x,dz=z-brain.z,length=Math.hypot(dx,dz);
 const clearance=Math.max(4,def.radius*.55),floor=terrain(brain.x,brain.z),ahead=Math.max(12,brain.currentSpeed*2+def.radius);
 let heading=length>.05?Math.atan2(dx,dz):brain.heading;
 // Anticipate shoals; select the deeper of two alternatives, not a teleport.
 const sample=a=>terrain(brain.x+Math.sin(a)*ahead,brain.z+Math.cos(a)*ahead);
 if(sample(heading)>-clearance-2){const l=heading-.85,r=heading+.85;heading=sample(l)<sample(r)?l:r;}
 const error=angleDiff(heading,brain.heading);
 const maxRate=p.turn/(1+brain.currentSpeed/Math.max(1,def.chaseSpeed)*.45);
 brain.yawRate=approach(brain.yawRate||0,clamp(error*2.5,-maxRate,maxRate),p.turn*2.3*dt);
 brain.heading=angleDiff(brain.heading+brain.yawRate*dt,0);
 const desiredSpeed=Math.min(speed,length/Math.max(dt,.001))*Math.max(.18,Math.cos(error));
 brain.currentSpeed=approach(brain.currentSpeed,desiredSpeed,p.accel*dt);
 const minY=Math.min(-.65,floor+clearance),goal=clamp(y,minY,-.65);
 const dy=goal-brain.y,desiredV=clamp(dy*.7,-p.vertical,p.vertical);
 brain.verticalSpeed=approach(brain.verticalSpeed||0,desiredV,p.vertical*1.5*dt);
 const travel=brain.currentSpeed*dt;
 const nx=brain.x+Math.sin(brain.heading)*travel,nz=brain.z+Math.cos(brain.heading)*travel;
 const newFloor=terrain(nx,nz);
 const home=dist(nx,nz,def.x,def.z);
 if(home<=def.leash && newFloor+clearance<-.65 && newFloor+clearance<=brain.y+p.vertical*dt){brain.x=nx;brain.z=nz;}
 else {brain.currentSpeed=approach(brain.currentSpeed,0,p.accel*dt);}
 brain.y=clamp(brain.y+brain.verticalSpeed*dt,Math.min(-.65,terrain(brain.x,brain.z)+clearance),-.65);
 brain.pitch=approach(brain.pitch||0,clamp(-Math.atan2(brain.verticalSpeed,Math.max(2,brain.currentSpeed)),-.52,.52),.85*dt);
 brain.bank=approach(brain.bank||0,clamp(-brain.yawRate*p.bank*1.8,-p.bank,p.bank),.8*dt);
}

function nearestDetectable( def, brain, players ) {
	let best = null, bestDistance = Infinity;
	for ( const p of players ) {
		if ( ! afloat( p ) || ! Number.isFinite( p.x ) || ! Number.isFinite( p.z ) ) continue;
		const homeDistance = dist( p.x, p.z, def.x, def.z );
		if ( homeDistance > def.territory ) continue;
		const d = distance3(brain,p);
		const noise = clamp( Number( p.noise ) || 0, 0, 1 );
		const sense = def.detection * ( 1 + noise * def.noiseGain );
		if ( d < sense && d < bestDistance ) { bestDistance = d; best = p; }
	}
	return { target: best, distance: bestDistance };
}

export function stepTitanAI( def, brain, players, delta, healthFraction = 1, terrain = offshoreFloor ) {
	const dt = Number.isFinite(delta) ? clamp( delta, 0, 1.5 ) : 0, events = [];
 if(dt>.051){const n=Math.ceil(dt/.05);for(let i=0;i<n;i++)events.push(...stepTitanAI(def,brain,players,dt/n,healthFraction,terrain));return events;}
 const p=profile(def);
	if ( ! dt ) return events;
	brain.cooldown = Math.max( 0, brain.cooldown - dt );
	const enraged = healthFraction <= 0.5;
	const { target: seen, distance: sightDistance } = nearestDetectable( def, brain, players );
	const active = players.find( p => p.id === brain.targetId && afloat( p ) );
	const homeDistance = active ? dist( active.x, active.z, def.x, def.z ) : Infinity;
	const activeDistance = active ? distance3(brain,active) : Infinity;
 const horizontal = active ? dist(brain.x,brain.z,active.x,active.z):Infinity;
 const attackY=active?clamp(targetY(active)+p.surface,-80,-.65):p.surface;
	const canFollow = active && homeDistance <= def.leash && activeDistance <= def.disengage;

	if ( brain.state === 'patrol' || brain.state === 'alert' ) {
		if ( seen ) {
			const proximity = clamp( 1 - sightDistance / def.detection, 0, 1 );
			brain.alert = clamp( brain.alert + dt * ( 0.23 + proximity * def.alertRate ), 0, 1 );
			brain.targetId = seen.id;
			if ( brain.alert >= 1 ) { brain.state = 'chase'; brain.lost = 0;
				events.push( { type: 'aggro', targetId: seen.id } ); }
			else brain.state = 'alert';
		} else {
			brain.alert = Math.max( 0, brain.alert - dt * 0.24 );
			brain.state = 'patrol';
			if ( brain.alert === 0 ) brain.targetId = null;
		}
	}

	if ( [ 'chase', 'windup', 'charge' ].includes( brain.state ) ) {
		if ( ! canFollow ) brain.lost += dt;
		else brain.lost = 0;
		if ( brain.lost > def.lostAfter || dist( brain.x, brain.z, def.x, def.z ) >= def.leash - 0.5 ) {
			brain.state = 'return'; brain.targetId = null; brain.attack = null; brain.windup = 0;
			brain.charge = 0; events.push( { type: 'disengage' } );
		}
	}

	if ( brain.state === 'patrol' || brain.state === 'alert' ) {
		brain.patrolClock += dt * def.speed / Math.max( def.patrol, 10 );
		const a = brain.patrolClock + def.patrolSeed;
		moveTo( def, brain, def.x + Math.sin( a ) * def.patrol, def.z + Math.cos( a ) * def.patrol * 0.72,
			def.speed * ( brain.state === 'alert' ? 0.65 : 1 ), dt, -p.depth+p.amplitude*Math.sin(a*1.7),terrain );
	} else if ( brain.state === 'return' ) {
		brain.alert = Math.max( 0, brain.alert - dt * 0.28 );
		moveTo( def, brain, def.x, def.z, def.speed * 1.25, dt,-p.depth,terrain );
		if ( dist( brain.x, brain.z, def.x, def.z ) < 8 ) {
			brain.state = 'patrol'; brain.alert = 0; brain.lost = 0; brain.patrolClock = 0;
		}
	} else if ( brain.state === 'chase' && canFollow ) {
		const nextSkill = titanSkill( def, brain.attackIndex, enraged );
		// Grapple and mouth attacks need the real skinned tip to reach the hull.
		// Long-range ink/vortex/shockwave keep their original attack radii.
		const attackDistance = nextSkill.kind === 'grapple' ? 26 : nextSkill.kind === 'triple_bite' ? 30 : isElemental(nextSkill.kind) ? nextSkill.radius : def.attackRange;
		
		if ( brain.cooldown <= 0 && activeDistance <= attackDistance && Math.abs(brain.y-attackY)<Math.max(5,def.radius*.4) ) {
			brain.attack = nextSkill;
			brain.state = 'windup'; brain.windup = brain.attack.windup;
			events.push( { type: 'telegraph', targetId: active.id, skill: brain.attack.name, kind: brain.attack.kind,
				windup: brain.windup, radius: brain.attack.radius, damage: brain.attack.damage, x: brain.x, y:brain.y, z: brain.z, sequence: brain.attackIndex } );
		 } else {
            // During cooldown peel away along a broad orbit and dive again.
            const preparing=brain.cooldown<Math.max(3,p.depth/p.vertical*.8)||horizontal>attackDistance*1.3;
            const angle=Math.atan2(brain.x-active.x,brain.z-active.z)+.55;
            const orbit=attackDistance*.78;
            const tx=preparing?active.x:active.x+Math.sin(angle)*orbit,tz=preparing?active.z:active.z+Math.cos(angle)*orbit;
            const speed=def.chaseSpeed*(enraged?1.2:1)*(preparing&&horizontal<attackDistance*.55?.30:.85);
            moveTo(def,brain,tx,tz,speed,dt,preparing?attackY:Math.max(-p.depth,attackY-p.depth*.55),terrain);
        }
	} else if ( brain.state === 'windup' ) {
		brain.windup -= dt;
        moveTo(def,brain,active?.x??brain.x,active?.z??brain.z,0,dt,attackY,terrain);
		if ( brain.windup <= 0 ) {
			const skill = brain.attack;
			// An attack must be visible even on a successful dodge; 'strike' only
			// represents a damage victim, while 'release' always drives VFX/audio.
			events.push( { type: 'release', targetId: brain.targetId, skill: skill.name, kind: skill.kind,
				radius: skill.radius, damage: skill.damage, x: brain.x, y:brain.y, z: brain.z, sequence: brain.attackIndex } );
			if ( skill.kind === 'charge' || skill.kind === 'vortex'&&def.id==='turtle'&&active?.shipClass==='heritage' ) {
				brain.charge = def.id==='turtle'?2.2:1.3; brain.state = 'charge';
			} else {
				// A vortex, ink cloud, or shockwave threatens EVERY vessel actually
				// in its area. Narrow triple-bite and grapple retain a single target.
				const area = isElemental(skill.kind) || [ 'vortex', 'ink', 'shockwave', 'maelstrom' ].includes( skill.kind );
				const victims = area ? players.filter( p => afloat( p ) &&
					distance3(brain,p) <= skill.radius &&
					dist( p.x, p.z, def.x, def.z ) <= def.leash ) :
					active && activeDistance <= skill.radius && canFollow ? [ active ] : [];
				for ( const victim of victims )
					events.push( { type: 'strike', targetId: victim.id, skill: skill.name, kind: skill.kind,
						damage: skill.damage, sequence: brain.attackIndex } );
				brain.attackIndex ++; brain.cooldown = def.period / ( enraged ? 1.35 : 1 );
				brain.state = 'chase'; brain.attack = null;
			}
		}
	} else if ( brain.state === 'charge' ) {
		const burst = def.chaseSpeed * ( enraged ? 2.6 : 2.2 );
		moveTo( def, brain, brain.x + Math.sin( brain.heading ) * burst * 2,
			brain.z + Math.cos( brain.heading ) * burst * 2, burst, dt,attackY,terrain );
		brain.charge -= dt;
		if ( active && activeDistance <= (def.id==='turtle'&&active.shipClass==='heritage'?def.radius+11:brain.attack.radius) && canFollow ) {
			events.push( { type: 'strike', targetId: active.id, skill: brain.attack.name,
				kind: brain.attack.kind, damage: brain.attack.damage, sequence: brain.attackIndex } );
			brain.charge = 0;
		}
		if ( brain.charge <= 0 ) {
			brain.attackIndex ++; brain.cooldown = def.period / ( enraged ? 1.35 : 1 );
			brain.state = 'chase'; brain.attack = null;
		}
	} else if(brain.state==='chase'){moveTo(def,brain,def.x,def.z,def.speed*.5,dt,-p.depth,terrain);}
	return events;
}

export function titanWeaponDamage( def, weapon ) {
	const armor = clamp( def.armor || 0, 0, 0.9 );
	const mitigation = weapon.type === 'pierce' ? armor * 0.42 : armor;
	const weakness = def.id === 'squid' && weapon.id === 'barbed' ? 1.18 :
		def.id === 'leviathan' && weapon.id === 'storm' ? 1.25 : 1;
	return Math.max( 1, Math.round( weapon.damage * ( 1 - mitigation ) * weakness ) );
}
