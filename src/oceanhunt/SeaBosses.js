import {spawnMonsterSpoil} from '../voyage/MonsterSpoils.js';
import {WorldEventDirector} from '../offshore/WorldEventDirector.js';
import {MonsterContacts} from './MonsterContacts.js';
import { Group, Vector3 } from '../engine/index.js';
import { SEA_TITANS } from './HuntRules.js';
import { createTitanModel } from './CreatureGeometry.js';
import { createCreatureMaterial } from './CreatureMaterials.js';
import { TITAN_ASSETS, createTitanAsset } from './TitanAssets.js';
import { createTitanBrain, provokeTitan, stepTitanAI, titanWeaponDamage } from './TitanAI.js';
import { TitanEffects, titanPose } from './TitanEffects.js';
import { attachTitanSkeleton, updateTitanSkeleton } from './TitanSkeleton.js';

const clamp = ( v, a, b ) => Math.max( a, Math.min( b, v ) );
const temp = new Vector3();
const jointHitPoint = new Vector3();

function skinnedLimbsHit( from, to, boss ) {
	const asset = boss.detailAsset;
	if ( ! asset?.skeleton ) return false;
	const chains = boss.id === 'squid' ? asset.tentacles : boss.id === 'leviathan' ? asset.hydraHeads : null;
	if ( ! chains ) return false;
	const W = asset.skeleton.world;
	for ( const chain of chains ) {
		for ( let j = 0; j < chain.indices.length; j ++ ) {
			const k = chain.indices[ j ] * 16;
			jointHitPoint.set( W[ k + 12 ], W[ k + 13 ], W[ k + 14 ] );
			asset.root.localToWorld( jointHitPoint );
			const boneRadius = boss.id === 'leviathan' ? ( j === chain.indices.length - 1 ? 5 : 2.7 ) : 1.8;
			if ( segmentHitsTitan( from, to, jointHitPoint, boneRadius ) ) return true;
		}
	}
	return false;
}

export function segmentHitsTitan( a, b, center, radius ) {
	const sx = b.x - a.x, sy = b.y - a.y, sz = b.z - a.z;
	const f = clamp( ( ( center.x - a.x ) * sx + ( center.y - a.y ) * sy + ( center.z - a.z ) * sz ) /
		Math.max( sx * sx + sy * sy + sz * sz, 1e-9 ), 0, 1 );
	return ( a.x + sx * f - center.x ) ** 2 + ( a.y + sy * f - center.y ) ** 2 + ( a.z + sz * f - center.z ) ** 2 <= radius * radius;
}

export class SeaBosses {
	constructor( app, progress ) {
		this.app = app;
		this.progress = progress;
		this.clock = 0;this.events=new WorldEventDirector();try{this.events.deserialize(JSON.parse(localStorage.getItem('stormwake.worldEvents.v1')));}catch{}
		this.integrity = 100;this.contacts=new MonsterContacts(this);this.confirmedContacts=new Set();
		this.entities = new Map();
		this.hud = document.createElement( 'div' );
		this.hud.className = 'hunt-boss-hud'; this.hud.hidden = true;
		document.body.append( this.hud );this.eventNotice=document.createElement('div');this.eventNotice.className='sw-v67-sea-notice';this.eventNotice.style.cssText='position:fixed;left:50%;top:105px;transform:translateX(-50%);padding:8px 14px;background:#152b32dc;color:#f4d8a1;border:1px solid #7c6a47;border-radius:8px;font:14px sans-serif;pointer-events:none';document.body.append(this.eventNotice);
		this.inkClock = 0;
		this.networkOffset = 0;
		this.skinMaterials = new Map();
		for ( const b of SEA_TITANS ) {
			const skin = createCreatureMaterial( b.id );
			this.skinMaterials.set( b.id, skin );
			const { root, rig } = createTitanModel( b.id, skin );
			// A dedicated visual pivot preserves procedural attack poses when the
			// fallback is replaced by the much more detailed static GLB.
			const visual = new Group(); visual.name = `TitanPose_${ b.id }`;
			for ( const child of [ ...root.children ] ) { root.remove( child ); visual.add( child ); }
			root.add( visual );
			root.position.set( b.x, - 2, b.z );
			app.scene.add( root );
			this.entities.set( b.id, { ...b, root, visual, rig, brain: createTitanBrain( b ), health: b.hp, deadUntil: 0,
				spawn: `${ Date.now() }:${ b.id }`, strikeClock: b.period, lastStrike: - 100,
				pos: root.position, phase: 0, authoritativeDead: false, serverAIAt: 0 } );
		}
		this.effects = new TitanEffects( app, SEA_TITANS );
	}

	get( id ) { return this.entities.get( id ) || null; }

	// Remote beasts get their full PBR meshes only on approach. A load failure
	// leaves the animated, low-cost fallback intact rather than hiding the boss.
	async loadDetailed( b ) {
		if ( ! TITAN_ASSETS[ b.id ] || b.detailLoading || b.detailReady || b.detailFailed ) return;
		b.detailLoading = true;
		try {
			const asset = await createTitanAsset( b.id );
			for ( const child of [ ...b.visual.children ] ) b.visual.remove( child );
			b.visual.add( asset.root );
			b.rig = [];
			b.detailReady = true;
			b.detailAsset = asset;
			if ( asset.skeleton ) attachTitanSkeleton( asset );
		} catch ( err ) {
			b.detailFailed = true;
			console.warn( `Titan ${ b.id }: retaining animated fallback`, err );
		} finally { b.detailLoading = false; }
	}
	getPosition( id ) { return this.entities.get( id )?.pos || null; }
	get nearest() {
		const p = this.app.boatCtl.position;
		let target = null, dist = Infinity;
		for ( const boss of this.entities.values() ) {
			const d = Math.hypot( boss.pos.x - p.x, boss.pos.z - p.z );
			if ( d < dist && ! boss.deadUntil && boss.health > 0 ) { target = boss; dist = d; }
		}
		return { boss: target, dist };
	}

	// The impact is evaluated in actual world coordinates, with continuous
	// segment-vs-creature collision to prevent fast shells passing through.
	hitProjectile( from, to, weapon ) {
		let best = null, closest = Infinity;
		for ( const b of this.entities.values() ) {
			if ( b.health <= 0 || b.deadUntil ) continue;
			const body = temp.copy( b.pos ); body.y += b.id === 'squid' ? 4.3 : b.id === 'leviathan' ? 2 : 0.3;
			const radius = b.id === 'leviathan' ? 24 : b.id === 'squid' ? 10 : b.radius;
			if ( ! segmentHitsTitan( from, to, body, radius ) && ! skinnedLimbsHit( from, to, b ) ) continue;
			const d = from.distanceTo( body );
			if ( d < closest ) { best = b; closest = d; }
		}
		if ( ! best ) return null;
		this.effects?.impact( best, weapon?.id === 'storm' ? 1.5 : 1 );
		if ( this.app.crew?.connected ) this.app.crew.sendAttack( best.id, weapon.id );
		else {
			provokeTitan( best.brain, 'local' );
			this.damage( best.id, titanWeaponDamage( best, weapon ), { source: 'solo' } );
		}
		return best;
	}

	damage( id, amount, { source = 'solo', spawn = null, remaining = null, killer = null } = {} ) {
		const b = this.get( id );
		if ( ! b || b.health <= 0 || b.deadUntil ) return false;
		if(source !== 'server' && (!Number.isFinite(amount) || amount <= 0)) return false;
		if(source === 'server' && remaining != null && !Number.isFinite(remaining)) return false;
		const before = b.health;
		if ( source === 'server' ) {
			if ( spawn ) b.spawn = spawn;
			b.health = clamp( remaining ?? b.health, 0, b.hp );
		} else b.health = Math.max( 0, b.health - clamp( amount, 0, 150 ) );
		b.phase = b.health / b.hp < 0.48 ? 2 : 1;
		if ( before > b.health ) this.effects?.impact( b, 0.8 );
		if ( before / b.hp >= 0.48 && b.phase === 2 ) this.effects?.enrage( b );
		if ( b.health === 0 ) this.defeat( b, source, killer );
		return true;
	}

	defeat( b, source, killer ) {
		this.contacts.clear(b);
		b.deadUntil = this.clock + 180;
		// Stay in the world for a short physical death sequence: the giant rolls
		// and sinks instead of simply popping out of existence at zero HP.
		b.deathStart = this.clock;
		b.deathY = b.pos.y;
		b.root.visible = true;
		this.effects?.death( b );
		const receipt = `${ source === 'server' ? 'coop' : 'solo' }:${ b.id }:${ b.spawn }`;
		if(this.app.voyageM1){const v=this.app.voyageM1;if(!v.net.connected){spawnMonsterSpoil(v.cargo,b.id,b.spawn,b.pos,v.voyage.redeemedSpectral);v._persistCargo();}return;}
		if ( this.progress.defeat( b.id, receipt ) ) {
			this.app.game.toast( `🏆 ${ b.name }已击败！已获得${ Object.entries( b.loot ).map( ( [ k, v ] ) => `${ k }×${ v }` ).join( '、' ) }。`, 6000 );
			this.app.game.state.grantMoney( b.id === 'leviathan' ? 1200 : 450, `hunt:${ receipt }` );
		}
	}

	applyServerSnapshot( bossStates ) {
		for ( const [ id, state ] of Object.entries( bossStates || {} ) ) {
			const b = this.get( id );
			if ( ! b || ! Number.isFinite( state.hp ) ) continue;
			const changed = !!state.spawn && String(state.spawn) !== b.spawn;
			if(changed || (b.health <= 0 && state.hp > 0)) { this.respawn(b); }
			b.spawn = String( state.spawn || b.spawn );
			if ( state.hp <= 0 ) { this.contacts.clear(b); b.health = 0; b.deadUntil = Infinity; b.root.visible = false; }
			else if ( state.hp > 0 ) { b.health = clamp( state.hp, 0, b.hp ); b.deadUntil = 0; b.root.visible = true; }
			b.phase = b.health / b.hp < 0.48 ? 2 : 1;
			if ( state.ai ) this.applyServerAI( { [ id ]: state.ai } );
		}
	}

	applyServerAI( bosses ) {
		for ( const [ id, state ] of Object.entries( bosses || {} ) ) {
			const boss = this.get( id );
			if ( ! boss || ! state || ! Number.isFinite( state.x ) || ! Number.isFinite( state.z ) ) continue;
			const heading = Number.isFinite( state.heading ) ? state.heading : boss.brain.heading;
			boss.serverTarget = { x: state.x, y: Number.isFinite(state.y)?state.y:boss.brain.y, z: state.z, heading,pitch:state.pitch||0,bank:state.bank||0 };
			if ( boss.serverAIAt === 0 ) Object.assign( boss.brain, boss.serverTarget );
			Object.assign( boss.brain, { state: state.state || 'patrol', targetId: state.targetId || null,
				currentSpeed: Number( state.speed ) || 0, windup: Number( state.windup ) || 0,
				attack: state.attackKind ? { kind: state.attackKind, windup: Number( state.attackWindup ) || 2 } : null } );
			boss.serverAIAt = this.clock;
		}
	}

	applyServerStrike( event, myId ) {
        if(this.app.voyageM1&&this.app.boat.collisionWorld)return;
		const b = this.get( event.boss );
		if ( ! b || event.targetId !== myId || this.integrity <= 0 ) return;
		this.strike( b, 0, { name: String( event.skill || b.attack ), kind: event.kind, damage: Number( event.damage ) || b.strike } );
	}

	leaveRoom() {
		// Infinity means the room host controls the respawn. On disconnect,
		// switch to the local encounter clock rather than leaving dead models
		// permanently invisible until a full page refresh.
		for ( const b of this.entities.values() ) {
			if ( b.deadUntil === Infinity ) b.deadUntil = this.clock + 12;
			b.brain = createTitanBrain( b ); b.serverAIAt = 0; b.serverTarget = null; this.contacts.clear(b); this.effects?.reset(b);
		}
	}

	respawn( b ) {
		this.contacts.clear(b); this.effects?.reset(b); b.serverTarget=null; b.serverAIAt=0; b.deathStart=undefined;
		b.health = b.hp; b.phase = 1; b.deadUntil = 0; b.root.visible = true;
		b.brain = createTitanBrain( b );
		b.root.rotation.set( 0, 0, 0 );
		b.visual?.rotation.set( 0, 0, 0 );
		b.visual?.scale.setScalar( 1 );
		b.spawn = `${ Date.now() }:${ b.id }`;
	}

	repair() {
		if ( this.integrity >= 100 ) return false;
		const stock = this.progress.data.stock;
		if ( stock.bone < 2 || stock.scrap < 1 ) return false;
		stock.bone -= 2; stock.scrap --; this.progress.save();
		this.integrity = Math.min( 100, this.integrity + 34 );
		this.app.game.toast( '🔧 船体修补 +34（消耗鱼骨×2、铁料×1）', 3200 );
		return true;
	}

 tryCutTentacle(origin,direction){
  const v=this.app.voyageM1,b=this.get('squid');if(!v||this.clock<(this.cutUntil||0))return false;
  const tip=b?.detailAsset?.tentacles?.find(arm=>{if(!arm.latched||arm.cutRemaining)return false;const d=arm.actualTipWorld.clone().sub(origin),length=d.length();return length<3&&d.dot(direction)>length*.45;});if(!tip)return false;
  this.cutUntil=this.clock+.65;
  if(v.net.connected){v.app.crew.sendMyPose?.(true);v.net.send('titan_cut',{bone:'Arm'+tip.armId,direction:{x:direction.x,y:direction.y,z:direction.z}});}else this.applyTentacleCut({bone:'Arm'+tip.armId});return true;
 }
 applyTentacleCut(event){
  const b=this.get('squid'),arm=b?.detailAsset?.tentacles?.find(a=>'Arm'+a.armId===event.bone);if(!arm)return;
  arm.cutHits=(arm.cutHits||0)+1;arm.cutRemaining=arm.cutHits>=3?6:.45;arm.latched=false;arm.targetRank=-1;if(arm.cutHits>=3)arm.cutHits=0;
  this.effects?.contact(b,arm.actualTipWorld,'grip',.65);
 }
 applyConfirmedContact(event){
  const v=this.app.voyageM1,b=this.get(event.boss);if(!v||!b||!event.point)return;
  const id=(event.attackId||event.boss+':'+event.sequence)+':'+event.bone;
  if(this.confirmedContacts.has(id))return;this.confirmedContacts.add(id);if(this.confirmedContacts.size>256)this.confirmedContacts.delete(this.confirmedContacts.values().next().value);
  const at=new Vector3(event.point.x,event.point.y,event.point.z);this.effects?.contact(b,at,event.kind==='grapple'?'grip':'bite',1);
  if(!v.net.isHost)return;
  const local=at.clone().sub(this.app.boatCtl.position).applyQuaternion(this.app.boatCtl.quaternion.clone().invert());
  v.damage.applyHit(event.damage,'ram',local);this.integrity=v.damage.integrity;
  const d=this.app.boatCtl.position.clone().sub(b.pos);d.y=0;if(d.lengthSq()>.01)this.app.boatCtl.velocity.addScaledVector(d.normalize(),Math.min(3,event.damage*.06));
  this.effects?.shipHit(event.damage);
 }

	strike( b, dist, skill = null ) {
		if ( this.integrity <= 0 || ( ! skill && dist > b.attackRange ) ) return;
		const impact = skill?.damage ?? b.strike;
		this.integrity = clamp( this.integrity - impact, 0, 100 );
		const ctl = this.app.boatCtl;
		const direction = temp.copy( ctl.position ).sub( b.pos ); direction.y = 0; direction.normalize();
		// Physical impulse on the actual buoyant craft; damage does not destroy
		// steering, recovery, camera, fishing or control bindings.
		if ( b.id === 'shark' ) {
			// Heavy line-of-charge impact: directional speed + short roll.
			ctl.velocity.addScaledVector( direction, 4.4 ); ctl.angular.z += 0.24;
		} else if ( b.id === 'turtle' ) {
			// A vortex induces yaw, pushing the hull sideways around the turtle.
			const side = temp.set( - direction.z, 0, direction.x );
			ctl.velocity.addScaledVector( side, 2.5 ); ctl.angular.y += 0.34;
		} else if ( b.id === 'squid' ) {
			// Six limbs converge on real bow/rail/stern hull points. A landed
			// grapple drags the buoyant hull toward the squid and twists it, while
			// leaving steering and recovery fully operable.
			ctl.velocity.multiplyScalar( 0.70 );
			ctl.velocity.addScaledVector( direction, -1.8 );
			ctl.angular.x += 0.35; ctl.angular.y += 0.12; ctl.angular.z -= 0.15;
			this.inkClock = 4;
		} else {
			// The leviathan's large shockwave rolls and launches the whole vessel.
			ctl.velocity.addScaledVector( direction, 3.3 ); ctl.angular.x += 0.29; ctl.angular.z += 0.35;
		}
		this.effects?.shipHit( impact );
		this.app.game.toast( `⚠ ${ b.name }发动「${ skill?.name || b.attack }」！船体耐久 ${ Math.round( this.integrity ) }/100`, 3500 );
		if ( this.integrity === 0 ) this.app.game.toast( '船体严重受损！打开 G 军械台修船。所有驾驶和求生操作仍可使用。', 4800 );
	}

	update( dt ) {
		this.clock += dt;
        if(this.app.voyageM1&&!this.app.crew?.connected){const ctl=this.app.boatCtl,v=this.app.voyageM1;this.events.update(dt,{ship:ctl.position,integrity:v.damage.integrity,water:v.damage.water,candidates:[...this.entities.values()].map(b=>({id:b.id,x:b.brain.x,z:b.brain.z,hp:b.health}))});if(Math.floor(this.clock)!==this.eventSaved){this.eventSaved=Math.floor(this.clock);try{localStorage.setItem('stormwake.worldEvents.v1',JSON.stringify(this.events.serialize()));}catch{}}}

        if(this.app.voyageM1)this.integrity=this.app.voyageM1.damage.integrity;
		this.inkClock = Math.max( 0, this.inkClock - dt );
		// The same deterministic AI runs locally; the LAN host sends authoritative
		// positions and strike events when connected, preventing client divergence.
		const simTime = this.clock;const e=this.events.event;this.eventNotice.hidden=!e||['cooloff','aftermath'].includes(e.phase);if(e)this.eventNotice.textContent=(this.get(e.boss)?.name||e.boss)+' \u00b7 '+({sighting:'\u8fdc\u5904\u51fa\u73b0\u5de8\u5927\u80cc\u9ccd',warning:'\u6d77\u9762\u5f02\u52a8\uff0c\u53ef\u8f6c\u5411\u7ed5\u884c',approaching:'\u5de8\u517d\u6b63\u5728\u63a5\u8fd1\uff0c\u51c6\u5907\u8239\u70ae',engaged:'\u4ea4\u6218\u4e2d \u00b7 \u53ef\u64a4\u79bb\u9886\u5730'})[e.phase];
		const playerPos = this.app.boatCtl.position, mode = this.app.player.mode;
		let nearest = null, nearestDistance = Infinity;
		for ( const b of this.entities.values() ) {
			if ( b.deadUntil ) {
				if ( ! this.app.crew?.connected && b.deadUntil <= this.clock ) this.respawn( b );
				else {
					const elapsed = this.clock - ( b.deathStart ?? - Infinity );
					b.root.visible = elapsed < 6;
					if ( elapsed < 6 ) {
						b.pos.y = ( b.deathY ?? - 2 ) - elapsed * 2.4;
						b.root.rotation.z += dt * 0.11;
						b.root.rotation.x += dt * 0.065;
					}
					continue;
				}
			}
			if ( this.app.crew?.connected && b.serverTarget ) {
				const k = Math.min( 1, dt * 9 );
				b.brain.x += ( b.serverTarget.x - b.brain.x ) * k;
				b.brain.z += ( b.serverTarget.z - b.brain.z ) * k;
                for(const key of ['y','pitch','bank'])b.brain[key]+=(b.serverTarget[key]-b.brain[key])*k;
				const angle = Math.atan2( Math.sin( b.serverTarget.heading - b.brain.heading ),
					Math.cos( b.serverTarget.heading - b.brain.heading ) );
				b.brain.heading += angle * k;
			} else if ( ! this.app.crew?.connected ) {
				const players = [ { id: 'local', x: playerPos.x, y:playerPos.y, z: playerPos.z, mode,shipClass:this.app.boat.heritageDeck?'heritage':'legacy',
					noise: clamp( this.app.boatCtl.velocity.length() / 20, 0, 1 ) } ];
				for ( const event of stepTitanAI( b, b.brain, players, dt, b.health / b.hp, this.app.terrainData?.heightAt?.bind(this.app.terrainData) ) ) {
					if ( event.type === 'telegraph' ) {
						this.effects?.telegraph( b, event );
						this.app.game.toast( `⚠ ${ b.name }正在蓄力「${ event.skill }」！立即转向规避！`, 2400 );
					}
					if ( event.type === 'release' ) this.effects?.release( b, event );
					if ( event.type === 'strike' && event.targetId === 'local' && !(this.app.voyageM1&&this.app.boat.collisionWorld) ) this.strike( b, 0, { name: event.skill, kind: event.kind, damage: event.damage } );
				}
			}
            b.pos.set(b.brain.x,b.brain.y,b.brain.z);
            b.root.rotation.set(b.brain.pitch,b.brain.heading,b.brain.bank,'YXZ');
			const fx = this.effects?.units.get( b.id );
			const pose = titanPose( b.id, b.brain, simTime, b.health / b.hp, fx?.hurt || 0, fx?.pulse || 0 );
			// Retain the body-weight acting, but give deformable bones priority.
			// Full-size translation/scaling on top of skinning looked rubbery.
			const jointed = !! b.detailAsset?.skeleton;
			b.visual.position.y = pose.y * ( jointed ? 0.36 : 1 );
			b.visual.rotation.x = pose.pitch * ( jointed ? 0.4 : 1 );
			b.visual.rotation.z = pose.roll * ( jointed ? 0.65 : 1 );
			b.visual.scale.setScalar( jointed ? 1 + ( pose.scale - 1 ) * 0.22 : pose.scale );
			if ( b.detailAsset ) for ( const material of b.detailAsset.materials ) {
				material.uniforms.titanAgitation.value = clamp( ( b.brain.currentSpeed / Math.max( b.chaseSpeed, 1 ) ) * 0.6 +
					( b.brain.state === 'windup' ? 0.8 : 0 ) + ( b.brain.state === 'charge' ? 1.4 : 0 ) +
					( fx?.pulse || 0 ) * 1.3, 0, 2 );
				material.uniforms.titanPain.value = fx?.hurt || 0;
			}
			for ( const limb of b.rig ) limb.group.rotation[ limb.axis ] = Math.sin( simTime * limb.speed + ( limb.phase || 0 ) ) * limb.amount;
			const d = Math.hypot( playerPos.x - b.pos.x, playerPos.z - b.pos.z );
			if ( jointed ) {
				if ( d < 430 ) {
					updateTitanSkeleton( b.detailAsset, b, playerPos, simTime, dt, fx?.pulse || 0, fx?.kind || '', this.app.boatCtl );
					// An actual skinned tip must enter a moving hull socket before
					// a grapple/bite produces localized spray and collision sound.
					for ( const hit of b.detailAsset.contactEvents || [] ) {
						this.effects?.contact( b, hit.position, hit.type, hit.strength );
						if ( hit.type === 'bite' ) {
							this.app.boatCtl.angular.z += ( hit.head - 1 ) * 0.035;
							this.app.boatCtl.angular.x += 0.042;
						}
					}
					// The anchored limbs are still connected to the monster and the
					// buoyant boat: resolve a sustained, capped tow impulse instead of
					// a single visually disconnected damage flash.
					if ( b.id === 'squid' && ( b.detailAsset.gripCount || 0 ) > 0 && (!this.app.voyageM1||this.app.voyageM1.net.isHost) ) {
						const boat = this.app.boatCtl;
						const tug = temp.copy( b.pos ).sub( boat.position ); tug.y = 0;
						if ( tug.lengthSq() > 0.01 ) {
							const intensity = Math.min( 3.5, 0.7 + b.detailAsset.gripStrength * .48 );
							boat.velocity.addScaledVector( tug.normalize(), intensity * Math.min( dt, .04 ) );
							boat.angular.x += Math.sin( this.clock * 2.1 ) * .075 * dt;
							boat.angular.z += Math.sin( this.clock * 1.35 + 1 ) * .085 * dt;
						}
					}
				} 
				else b.detailAsset.skeleton.hold();
			}
            this.contacts.update(b);
			if ( d < 510 && TITAN_ASSETS[ b.id ] ) this.loadDetailed( b );
			b.root.visible = d < 420;
			if ( d < nearestDistance ) { nearest = b; nearestDistance = d; }
		}
		this.effects?.update( dt, this.entities.values() );
		const show = nearest && nearestDistance < 175;
		this.hud.hidden = ! show;
		if ( show ) {
			const f = Math.round( nearest.health / nearest.hp * 100 );
			const asset = nearest.detailAsset;
			const gripStatus = nearest.id === 'squid' && asset?.tentacles
				? ` · 实际锁船 ${ asset.gripCount || 0 }/6` : '';
			const biteStatus = nearest.id === 'leviathan' && ( asset?.biteRemaining || 0 ) > 0
				? ` · 龙首咬合 ${ asset.hydraHeads?.filter( h => h.biteLanded ).length || 0 }/3` : '';
			const states = { patrol: '巡逻', alert: '侦测', chase: '追击', windup: '攻击蓄力', charge: '高速冲锋', return: '返回领地' };
			this.hud.innerHTML = `<div class="hunt-boss-name"><span>${ nearest.icon } ${ nearest.name }</span><small>${ Math.round( nearestDistance ) } m · 深度 ${Math.round(-nearest.brain.y)}m · ${ nearest.phase === 2 ? '狂暴 · ' : '' }${ states[ nearest.brain.state ] || '游荡' }${ gripStatus }${ biteStatus }</small></div><div class="hunt-boss-meter"><i style="width:${ f }%"></i></div><div class="hunt-hull">船体 ${ Math.round( this.integrity ) } / 100 · 领地半径 ${ nearest.territory }m · G 锻造/修船</div>`;
		}
	}
}
