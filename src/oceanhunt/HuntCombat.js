import {controlContext,modalActive} from '../core/ControlPolicy.js';
import {ELEMENTAL} from './ElementalSkills.js';
import { Mesh, Vector3 } from '../engine/index.js';
import { GeoKit, sphere } from '../world/boat/GeoKit.js';
import { HUNT_KEY_ORDER, HUNT_MATERIALS, HUNT_RECIPES, HUNT_WEAPONS, SEA_TITANS } from './HuntRules.js';
import { HuntProgress } from './HuntProgress.js';
import { SeaBosses } from './SeaBosses.js';
import { DeckArsenal } from './DeckArsenal.js';
import { titanWeaponDamage } from './TitanAI.js';
import { developerAccessEnabled, teleportCaptainAndShip } from './DeveloperTools.js';
import { AbyssRaid } from './AbyssRaid.js';

const V = () => new Vector3();
const _v = V(), _d = V(), _from = V();

export class HuntCombat {
	constructor( app ) {
		this.app = app;
		this.developer = developerAccessEnabled();
		this.progress = new HuntProgress();
		this.bosses = new SeaBosses( app, this.progress );
		this.abyss = new AbyssRaid( app, this.progress, this.developer );
		this.deckArsenal = new DeckArsenal( app.boat, this.progress, this.developer );
		this.ink = document.createElement( 'div' ); this.ink.className = 'hunt-ink'; this.ink.hidden = true;
		document.body.append( this.ink );
		this.selected = this.canEquip( this.progress.data.selected ) ? this.progress.data.selected : 'harpoon';
		this.cooldown = 0;
		this.projectiles = [];
		this.geometries = new Map();
		this._demoSequence = 0;
		this.opened = false;
		this.prevZoom = 1;
		this.zooming = false;
		this.caught = app.game.state.onCatch( event => this.progress.catchFish( event ) );
		this.launch = document.createElement( 'button' );
		this.launch.type = 'button'; this.launch.className = 'hunt-launch';
		this.launch.textContent = '⚒ F3 · 猎兽军械台';
		this.launch.addEventListener( 'click', () => {if(this.available)this.open();} );
		this.hud = document.createElement( 'div' ); this.hud.className = 'hunt-weapon-hud';
		this.hud.innerHTML = '<b></b><span></span><button type="button">F · 发射</button>';
		this.hud.querySelector( 'button' ).addEventListener( 'click', () => this.fire() );
		this.reticle = document.createElement( 'div' );
		this.reticle.className = 'hunt-reticle'; this.reticle.hidden = true;
		this.reticle.innerHTML = '<i class="hunt-reticle-cross"></i><small>瞄准海上巨兽 · F 开火 · T 切换武器</small>';
		this.hitNotice = document.createElement( 'div' );
		this.hitNotice.className = 'hunt-hit-notice'; this.hitNotice.hidden = true;
		this.hitClock = 0;
		this.overlay = document.createElement( 'div' ); this.overlay.className = 'hunt-armory-overlay'; this.overlay.hidden = true;
		this.overlay.addEventListener( 'click', e => {
			const target = e.target.closest?.( '[data-hunt]' );
			if ( target ) {
				const [ action, id, skill ] = target.dataset.hunt.split( ':' );
				if ( action === 'craft' ) this.craft( id );
				if ( action === 'equip' ) this.equip( id );
				if ( action === 'repair' ) { this.bosses.repair(); this.render(); }
				if ( action === 'warp' ) this.teleportToBoss( id );
				if ( action === 'demo' ) this.previewBossAttack( id, skill || null );
				if ( action === 'ink' ) this.previewBossAttack( 'squid', 'ink' );
				if ( action === 'abyss' && (id === 'start'||id==='join') ) {
					this.close();
					void this.abyss.enter(id==='join');
				}
			} else if ( e.target === this.overlay || e.target.closest?.( '[data-close-hunt]' ) ) this.close();
		} );
		document.body.append( this.launch, this.hud, this.reticle, this.hitNotice, this.overlay );
		this.esc = e => {
			if ( ! this.opened || ! [ 'Escape', 'F3' ].includes( e.code ) ) return;
			e.preventDefault(); e.stopImmediatePropagation(); this.close();
		};
		window.addEventListener( 'keydown', this.esc, true );
	}

	get available() {
		const a = this.app;
		return ! this.abyss?.active && ( ! a.voyageM1 || this.aboard || this.developer ) && ! a.freeCam && ! a.islandLife?.ui.isOpen && ! a.shipyard?.opened && ! a.oceanChart?.opened &&
			! a.expedition?.isOpen && ! a.homeLife?.sleeping && ! a.ui?.ui?._photo && ! a.game?.fight && a.crew?.overlay.hidden !== false;
	}
	get aboard() { return [ 'boat', 'deck' ].includes( this.app.player.mode ); }
	canEquip( id ) { return Object.hasOwn( HUNT_WEAPONS, id ) && ( this.developer || this.progress.owned( id ) ); }

	teleportToBoss( id ) {
		if ( ! this.developer ) return false;
        if(this.app.crew?.connected&&!this.app.voyageM1?.net.isHost){this.app.game.toast('联机由房主传送整艘船；船员随船同步。',3500);return false;}
		const destination = teleportCaptainAndShip( this.app, id );
		if ( ! destination ) {
			this.app.game.toast( '传送失败：目标周围未找到足够深的安全海面。', 3500 );
			return false;
		}
		if ( this.opened ) this.close();
		const name = this.bosses.get( id )?.name || '海洋巨兽';
		this.app.game.toast( `⚡ 开发者传送：已携带当前船只抵达${ name }附近（约 ${ Math.round( destination.distance ) }m），可直接攻击。`, 4500 );
		return true;
	}

	previewBossAttack( id, override = null ) {
		if ( ! this.developer || this.app.crew?.connected ) return false;
		const b = this.bosses.get( id );
		if ( ! b || ! b.health || b.deadUntil ) return false;
		const p = this.app.boatCtl.position;
		if ( Math.hypot( b.brain.x - p.x, b.brain.z - p.z ) > 250 ) {
			if ( ! this.teleportToBoss( id ) ) return false;
		}
		const kind = override || { shark: 'charge', turtle: 'vortex', squid: 'grapple', leviathan: 'triple_bite' }[ id ];
		if ( ! kind ) return false;
		if ( this.opened ) this.close();
		this.bosses.effects?.release( b, { kind, sequence: `dev${ ++ this._demoSequence }`, radius: ELEMENTAL[kind]?.radius || b.attackRange, visualOnly:true } );
		this.app.game.toast( `🎬 ${ b.name }「${ kind }」演出测试：纯视觉预览，不扣除船体耐久。`, 3700 );
		return true;
	}

	open() {
		if ( this.opened || ! this.available || modalActive(this.app) || controlContext(this.app)==='research' ) return false;
		this.opened = true; this.beforeInput = this.app.input.enabled;
		this.app.input.enabled = false;
		if ( document.pointerLockElement ) document.exitPointerLock?.();
		this.overlay.hidden = false; this.render(); return true;
	}
	close() {
		if ( ! this.opened ) return;
		this.opened = false; this.overlay.hidden = true;
		this.app.input.keys.clear(); this.app.input.pressed.clear();
		this.app.input.enabled = this.beforeInput;
	}

	equip( id ) {
		if ( ! this.canEquip( id ) ) return false;
		this.selected = id; this.progress.data.selected = id; this.progress.save();
		this.deckArsenal.refresh(); // visible rack state follows actual equipment
		if ( this.opened ) this.render();
		this.app.game.toast( `已装备：${ HUNT_WEAPONS[ id ].name }`, 2400 );
		return true;
	}
	cycle() {
		const available = HUNT_KEY_ORDER.filter( id => this.canEquip( id ) );
		const index = available.indexOf( this.selected );
		return this.equip( available[ ( index + 1 ) % available.length ] );
	}
	craft( id ) {
		if ( ! this.progress.craft( id ) ) {
			this.app.game.toast( '材料不足或已经完成锻造。出海捕捞、拖网或狩猎获取材料。', 3300 );
			return false;
		}
		this.app.game.toast( `⚒ 制作完成：${ HUNT_RECIPES[ id ].name }`, 3500 );
		this.deckArsenal.refresh();
		if ( HUNT_WEAPONS[ id ] ) this.equip( id );
		if ( this.opened ) this.render();
		return true;
	}

	geometryFor( kind ) {
		if ( this.geometries.has( kind ) ) return this.geometries.get( kind );
		const kit = new GeoKit();
		const blast = HUNT_WEAPONS[ kind ].type === 'blast';
		kit.add( 'projectile', sphere( blast ? 0.36 : 0.18, 10, 7 ),
			{ color: kind === 'storm' ? 0xa7edf9 : blast ? 0x2c2724 : 0xc5ac72, rough: 0.4, metal: 0.5 } );
		const geo = kit.merged( 'projectile' ); this.geometries.set( kind, geo ); return geo;
	}

	fire() {
		const a = this.app, w = HUNT_WEAPONS[ this.selected ];
		if ( modalActive(this.app)||this.app.landAdventure?.stance|| ! this.available || this.opened || ! this.aboard || ! w || this.cooldown > 0 || ( ! this.developer && this.bosses.integrity <= 0 ) ) return false;
		if ( w.type === 'utility' ) return false;
		this.cooldown = w.reload;
		// Fire from the player's actual camera rather than an invented fixed bow
		// coordinate. Target attraction is only applied if the captain is already
		// looking toward a giant creature in the weapon's firing arc.
		const start = a.camera.position.clone();
		const aim = a.camera.getWorldDirection( _d ).normalize();
		let best = null, score = 0.73;
		for ( const b of this.bosses.entities.values() ) {
			if ( b.health <= 0 || b.deadUntil ) continue;
			const target = _v.copy( b.pos ); target.y += b.id === 'squid' ? 4.2 : b.id === 'leviathan' ? 1.9 : 0.4;
			const distance = target.distanceTo( start );
			const dot = _from.copy( target ).sub( start ).normalize().dot( aim );
			if ( distance <= w.range && dot > score ) { best = target.clone(); score = dot; }
		}
		if ( best ) aim.copy( best ).sub( start ).normalize();
		start.addScaledVector( aim, 1.4 );
		const m = new Mesh( this.geometryFor( this.selected ), a.boat.materials.fittings );
		m.name = `HuntProjectile_${ this.selected }`; m.frustumCulled = false;
		m.position.copy( start ); a.scene.add( m );
		this.projectiles.push( { mesh: m, weapon: { ...w, id: this.selected }, v: aim.clone().multiplyScalar( w.speed ), remaining: w.range / w.speed * 1.15 } );
		a.crew?.sendFire( this.selected, start, aim );
		this.reticle.classList.add( 'firing' );
		this.muzzleClock = 0.12;
		return true;
	}

	remoteFire( weaponId, origin, direction ) {
		// Purely cosmetic replica of another crew member's round. Its collision
		// is never evaluated locally: only the shared room host can accept and
		// broadcast damage, so one shot cannot double-hit a giant.
		const weapon = HUNT_WEAPONS[ weaponId ];
		if ( ! weapon?.damage || ! Array.isArray( origin ) || ! Array.isArray( direction ) ||
			origin.length !== 3 || direction.length !== 3 || ! [ ...origin, ...direction ].every( Number.isFinite ) ) return false;
		const aim = new Vector3( ...direction );
		if ( aim.lengthSq() < 0.5 || aim.lengthSq() > 1.5 ) return false;
		aim.normalize();
		const m = new Mesh( this.geometryFor( weaponId ), this.app.boat.materials.fittings );
		m.name = `CrewProjectile_${ weaponId }`; m.frustumCulled = false;
		m.position.set( ...origin ); this.app.scene.add( m );
		this.projectiles.push( { mesh: m, cosmetic: true, weapon, v: aim.multiplyScalar( weapon.speed ),
			remaining: weapon.range / weapon.speed * 1.15 } );
		return true;
	}

	showImpact( boss, weapon, confirmed ) {
		this.hitClock = 1.8;
		this.hitNotice.hidden = false;
		this.hitNotice.textContent = confirmed ? `✦ 命中 ${ boss.name } · ${ titanWeaponDamage( boss, weapon ) } 伤害` : `✦ 命中 ${ boss.name } · 正在同步船队战果`;
	}

	confirmHit( id, weaponId, remaining ) {
		const boss = this.bosses.get( id ), weapon = HUNT_WEAPONS[ weaponId ];
		if ( boss && weapon ) {
			this.showImpact( boss, { ...weapon, id: weaponId }, true );
			this.hitNotice.textContent += ` · 剩余 ${ Math.ceil( remaining ) } HP`;
		}
	}

	updateProjectiles( dt ) {
		for ( let i = this.projectiles.length - 1; i >= 0; i -- ) {
			const shot = this.projectiles[ i ], p = shot.mesh.position;
			_from.copy( p );
			shot.v.y -= ( shot.weapon.type === 'blast' ? 1.2 : 0.25 ) * dt;
			p.addScaledVector( shot.v, dt ); shot.remaining -= dt;
			const hit = shot.cosmetic ? null : this.bosses.hitProjectile( _from, p, shot.weapon );
			if ( hit ) this.showImpact( hit, shot.weapon, ! this.app.crew?.connected );
			if ( hit || shot.remaining <= 0 || p.y < - 8 ) {
				this.app.scene.remove( shot.mesh );
				this.projectiles.splice( i, 1 );
			}
		}
	}

	spyglass( want ) {
		const cam = this.app.camera;
		if ( want === this.zooming ) return;
		this.zooming = want;
		if ( want ) this.prevZoom = cam.zoom;
		cam.zoom = want ? 3.15 : this.prevZoom;
		cam.updateProjectionMatrix();
	}

	render() {
		const d = this.progress.data;
		const materials = Object.entries( HUNT_MATERIALS ).map( ( [ key, value ] ) => `<div><small>${ value }</small><b>${ d.stock[ key ] || 0 }</b></div>` ).join( '' );
		const weapons = HUNT_KEY_ORDER.map( id => {
			const w = HUNT_WEAPONS[ id ], owned = this.canEquip( id );
			return `<article class="hunt-weapon-card ${ this.selected === id ? 'current' : '' }"><h4>${ w.icon } ${ w.name }</h4><p>${ w.type === 'utility' ? '放大 3.15× · F 持续观察' : `伤害 ${ w.damage } · 射程 ${ w.range }m · 装填 ${ w.reload }s` }</p><button data-hunt="equip:${ id }" ${ owned ? '' : 'disabled' }>${ ! owned ? '尚未锻造' : this.selected === id ? '已装备' : '装备' }</button></article>`;
		} ).join( '' );
		const recipes = Object.entries( HUNT_RECIPES ).map( ( [ id, recipe ] ) => {
			const enough = this.progress.canCraft( id ), owned = this.progress.owned( id );
			const cost = Object.entries( recipe.cost ).map( ( [ key, n ] ) => `${ HUNT_MATERIALS[ key ] } ${ n }/${ d.stock[ key ] }` ).join( ' · ' );
			return `<article class="hunt-recipe"><div><h4>${ recipe.name }</h4><p>${ recipe.note }</p><small>${ cost }</small></div><button data-hunt="craft:${ id }" ${ enough ? '' : 'disabled' }>${ owned ? '已完成' : '锻造' }</button></article>`;
		} ).join( '' );
		const developerWarps = this.developer ? `<h3>⚡ 开发者快速传送与巨兽演出测试</h3><p class="hunt-dev-tip">全部武器/望远镜开放；可带当前船型传送至安全深水，也可立即预览每只海怪的原始与元素攻击（单机、纯视觉、不扣耐久）。</p><div class="hunt-dev-warps">${ SEA_TITANS.map( b => `<button type="button" data-hunt="warp:${ b.id }">${ b.icon } 传送至${ b.name }</button><button type="button" data-hunt="demo:${ b.id }">🎬 测试${ b.name }攻击</button>` ).join( '' ) }<button type="button" data-hunt="ink:squid">🖤 巨妖浓墨喷发测试</button>${ Object.entries(ELEMENTAL).map(([kind,s])=>{const id=({frost_lance:'shark',storm_lance:'shark',glacial_crown:'turtle',voltaic_snare:'turtle',cinder_fall:'squid',nova_beam:'leviathan',flame_field:'leviathan'})[kind];return `<button type="button" data-hunt="demo:${id}:${kind}">测试 ${s.name}</button>`;}).join('') }</div>` : '';
		const unlocked = this.progress.owned( 'abyss_sub' ) || this.developer;
		const abyssPanel = `<h3>🌑 终章 · 无光王庭</h3><article class="hunt-recipe hunt-abyss-gate"><div><h4>🐋 深海魔鲸号 → 海神利维坦</h4><p>击败三首深海魇龙取得深渊心核，制造潜艇后进入可操控的立体深海战场。独立骨骼海神、声呐追踪鱼雷、潜航水压、三阶段终局战。</p><small>魇龙已击败 ${ d.hunts.leviathan } 次 · 海神战果 ${ d.hunts.sea_god || 0 } 次${ this.developer ? ' · 开发模式可跳过建造' : '' }</small></div><button data-hunt="abyss:start" ${ unlocked ? '' : 'disabled' }>${ unlocked ? '🚢 驾驶魔鲸号，进入深渊' : '先建造深海魔鲸号' }</button>${this.app.crew?.connected&&this.abyss.roomHost&&this.abyss.roomHost!==this.app.crew.selfId?'<button data-hunt="abyss:join">加入房主魔鲸号</button>':''}</article>`;
		this.overlay.innerHTML = `<section class="hunt-panel" role="dialog" aria-modal="true"><header><div><small>STORMWAKE · ABYSSAL HUNT</small><h2>⚒ 深海猎兽 · 军械锻造</h2><p>${ this.developer ? '开发者模式：全部武器开放，可直接换装、跳转到巨兽领地；原锻造资源与狩猎进度仍然保留。' : '钓鱼、拖网与捕捞获得鱼骨、鱼油和沉船铁料 → 锻造武器 → 挑战四海巨兽 → 以战利品开启终极装备。' }</p></div><button data-close-hunt aria-label="关闭">×</button></header>${ developerWarps }<div class="hunt-stock">${ materials }</div><h3>武器与望远镜</h3><div class="hunt-weapons">${ weapons }</div><h3>锻造进度与船只维修</h3><div class="hunt-recipes">${ recipes }</div><article class="hunt-recipe"><div><h4>⚓ 修复船体</h4><p>当前船体 ${ Math.round( this.bosses.integrity ) }/100，每次恢复 34。</p><small>消耗鱼骨 2、沉船铁料 1</small></div><button data-hunt="repair:ship" ${ this.bosses.integrity >= 100 || d.stock.bone < 2 || d.stock.scrap < 1 ? 'disabled' : '' }>维修</button></article>${ abyssPanel }<h3>巨兽狩猎图鉴</h3><div class="hunt-bestia">${ SEA_TITANS.map( b => `<span>${ b.icon } ${ b.name } <b>×${ d.hunts[ b.id ] }</b></span>` ).join( '' ) }</div></section>`;
	}

	update( dt ) {
		this.abyss.update( dt );
		this.cooldown = Math.max( 0, this.cooldown - dt );
		this.hitClock = Math.max( 0, this.hitClock - dt );
		this.hitNotice.hidden = this.hitClock <= 0;
		this.muzzleClock = Math.max( 0, ( this.muzzleClock || 0 ) - dt );
		if ( this.muzzleClock <= 0 ) this.reticle.classList.remove( 'firing' );
		this.ink.hidden = this.bosses.inkClock <= 0;
		this.updateProjectiles( dt );
		const indoors=this.app.player?.mode==='deck'&&['hold','lowerHold'].includes(this.app.player.deckLayer);
		const input = this.app.input, climbing=!!(this.app.player.shipClimb||this.app.player.mastClimb||this.app.player.boardingClimb), usable = this.available && this.aboard && !indoors&&!climbing && !this.app.player?.stationId && ! this.opened && !this.app.landAdventure?.stance && !modalActive(this.app) && !['abyss','research'].includes(controlContext(this.app));
		this.launch.hidden = ! this.available || indoors;
		this.hud.hidden = ! usable;
		this.reticle.hidden = ! usable;
		this.reticle.classList.toggle( 'is-scope', this.zooming );
		if ( ! usable ) this.hitNotice.hidden = true;
		// On foot G belongs to HomeLife's "set home" interaction beside a bed.
		// The forge remains clickable anywhere, keyboard G opens it aboard.

		if ( usable && input.consume( this.app.voyageM1 ? 'KeyT' : 'KeyQ','hunt' ) ) this.cycle();
		if ( usable && input.consume( this.app.voyageM1 ? 'KeyF' : 'KeyC','hunt' ) && this.selected !== 'spyglass' ) this.fire();
		this.spyglass( usable && this.selected === 'spyglass' && input.down( this.app.voyageM1 ? 'KeyF' : 'KeyC' ) );
		if ( usable ) {
			const w = HUNT_WEAPONS[ this.selected ];
			this.hud.querySelector( 'b' ).textContent = `${ w.icon } ${ w.name }`;
			this.hud.querySelector( 'span' ).textContent = `${ this.app.voyageM1 ? 'T' : 'Q' } 切换 · ${ this.cooldown > 0 ? `${ this.cooldown.toFixed( 1 ) }s 装填` : w.type === 'utility' ? this.app.voyageM1 ? '按住 F 望远镜' : '按住 C 望远镜' : this.app.voyageM1 ? 'F 开火' : 'C 开火' }`;
			const button = this.hud.querySelector( 'button' );
			button.disabled = this.cooldown > 0 || this.selected === 'spyglass' || ( ! this.developer && this.bosses.integrity <= 0 );
			button.textContent = w.type === 'utility' ? this.app.voyageM1 ? '🔭 按住 F' : '🔭 按住 C' : this.app.voyageM1 ? '🎯 F · 发射' : '🎯 C · 发射';
		}
	}
}
