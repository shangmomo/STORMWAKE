import { WORLD } from '../world/WorldLayout.js';
import { FLEET } from '../world/boat/FleetVariants.js';
import { getLocale } from '../course/Localization.js';

const escape = value => String( value ).replace( /[&<>"']/g, ch => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ ch ] ) );

// One active physical vessel, five unique procedural hull/deck/sail variants.
// Refit from the helm at low speed or while standing at the harbor berth.
// Never spawn a second overlapping model (the former island-content bug).
export class Shipyard {

	constructor( app ) {

		this.app = app;
		this.opened = false;
		this.launch = document.createElement( 'button' );
		this.launch.className = 'fleet-launch';
		this.launch.textContent = '⚓ J（步行 Shift+J）· 更换载具 (6)';
		this.launch.hidden = true;
		this.launch.addEventListener( 'click', () => this.open() );
		this.overlay = document.createElement( 'div' );
		this.overlay.className = 'fleet-overlay';
		this.overlay.hidden = true;
		this.overlay.addEventListener( 'click', event => {
			const button = event.target.closest( 'button[data-fleet]' );
			if ( button ) this.choose( button.dataset.fleet );
			else if ( event.target === this.overlay || event.target.closest( '[data-close-fleet]' ) ) this.close();
		} );
		document.body.append( this.launch, this.overlay );
		this.esc = e => {
			if ( ! this.opened || e.code !== 'Escape' ) return;
			e.stopImmediatePropagation(); e.preventDefault(); this.close();
		};
		window.addEventListener( 'keydown', this.esc, true );

	}

	get nearby() {

		const p = this.app.player, b = this.app.boatCtl;
		// A captain can refit directly from the helm (even at a quiet offshore
		// anchorage). On land, only the real harbor berth offers this service.
		// The previous requirement to leave the ship made the five craft nearly
		// impossible to discover, particularly after the first voyage.
		const aboard = p.mode === 'boat' || p.mode === 'deck';
		const shore = p.mode === 'walk' &&
			Math.hypot( p.position.x - WORLD.boatDock.position.x, p.position.z - WORLD.boatDock.position.z ) < 28 &&
			b.position.distanceTo( WORLD.boatDock.position ) < 28;
		return ! this.app.freeCam && ( aboard || shore );

	}

	open() {

		if ( this.app.voyageM1 ) {this.app.game?.toast?.('协作航程使用固定甲板站位；旧船队更换请从 ?stormwake=0 进入。',3500);return false;}
		if ( this.opened || ! this.nearby || this.app.islandLife?.ui.isOpen || this.app.expedition?.isOpen || this.app.oceanChart?.opened ||
			this.app.hunt?.opened || this.app.crew?.overlay.hidden === false ) return false;
		if ( this.app.boatCtl.speed > 1.8 ) {
			this.app.game.toast( getLocale() === 'en' ? 'Slow down below 1.8 m/s before refitting.' : '换船前请把航速降至 1.8 m/s 以下。', 3300 );
			return false;
		}
		this.opened = true;
		this.oldInput = this.app.input.enabled;
		this.app.input.enabled = false;
		if ( document.pointerLockElement ) document.exitPointerLock?.();
		this.overlay.hidden = false;
		this.render();
		return true;

	}

	close() {

		if ( ! this.opened ) return;
		this.opened = false;
		this.overlay.hidden = true;
		this.app.input.pressed.clear(); this.app.input.keys.clear();
		this.app.input.enabled = this.oldInput;

	}

	choose( name ) {

		// M1 station anchors are authored for the current hull only. A live
		// refit would strand players off deck and invalidate networked positions.
		if ( this.app.voyageM1 && !['offer','sold'].includes(this.app.voyageM1.voyage.phase) ) {
			this.app.game.toast('航程期间禁止换船：请先返港完成航程。',3500);return false;
		}
		if ( ! FLEET[ name ] || ! this.nearby || this.app.boatCtl.speed > 1.8 ) return false;
		if ( ! this.app.boat.setVariant( name ) ) return false;
		this.app.game.applyGear();
		this.app.ui?.ui?.toast?.( `${ FLEET[ name ].zh } · 已备航`, 3200 );
		this.close();
		return true;

	}

	render() {

		const en = getLocale() === 'en';
		this.overlay.innerHTML = `<section class="fleet-panel" role="dialog" aria-modal="true" aria-label="${ en ? 'Shipyard' : '海盗船坞' }">
			<header><div><span>STORMWAKE · FLEET</span><h2>${ en ? 'Choose your vessel' : '海盗船队 · 更换座驾' }</h2><p>${ en ? 'DEVELOPER ACCESS: all six hulls are unlocked. Refit from the helm at low speed; the previous vessel is replaced.' : '开发者权限：六种船型全部开放，无需材料或通关。舵位按 Shift+J 低速换船，旧船模型自动替换。' }</p></div><button data-close-fleet aria-label="close">×</button></header>
			<div class="fleet-grid">${ Object.entries( FLEET ).map( ( [ id, profile ] ) => `<button class="fleet-choice ${ this.app.boat.variant === id ? 'active' : '' }" data-fleet="${ id }"><strong>${ escape( en ? profile.en : profile.zh ) }</strong><small>${ escape( profile.role ) }</small><span>${ en ? 'Speed' : '航速' } ${ ( profile.speed * 100 ).toFixed( 0 ) }%　·　${ en ? 'Handling' : '转向' } ${ ( profile.turn * 100 ).toFixed( 0 ) }%</span><em>${ this.app.boat.variant === id ? ( en ? 'CURRENT' : '当前座驾' ) : ( en ? 'SELECT' : '立即换船' ) }</em></button>` ).join( '' ) }</div>
			<footer>${ this.app.voyageM1 ? (en ? 'E: board deck · E at station: helm/sails/cannon · Esc: leave station' : 'E 登上甲板 · 靠近舵轮/帆索/炮位按 E · Esc 离岗') : (en ? 'E: board and helm · Shift+E: walk the deck · W/S: power · A/D: steer · V: camera' : 'E 登船开航 · Shift+E 上甲板钓鱼 · W/S 前后动力 · A/D 转舵 · V 切镜头') }</footer>
		</section>`;

	}

	update() {

		if ( this.opened ) return;
		const near = !this.app.player?.stationId && !this.app.hunt?.abyss?.active && this.nearby && ! this.app.islandLife?.ui.isOpen;
		this.launch.textContent = getLocale() === 'en' ? '⚓ Shift+J · FLEET' : '⚓ Shift+J · 更换载具';
		// Ship station anchors are calibrated for the M1 vessel. Never let a
		// mid-session hull refit invalidate live player/cannon positions.
		this.launch.hidden = ! near || !!this.app.voyageM1;
		const walking = this.app.player.mode === 'walk';
		const shift = this.app.input.down('ShiftLeft') || this.app.input.down('ShiftRight');
		// While a cutlass is drawn, even Shift+J cannot hijack the combat input.
		const combatLocked = walking && this.app.landAdventure?.stance;
		if ( near && !combatLocked && !this.app.hunt?.abyss?.active && !this.app.voyageM1?.deepEcho?.piloting && this.app.input.hit('KeyJ') && shift ) {
			this.app.input.consume('KeyJ'); this.open();
		}

	}

}
