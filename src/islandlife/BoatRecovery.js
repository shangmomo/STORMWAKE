import { getLocale } from '../course/Localization.js';

export class BoatRecovery {
	constructor( app ) {
		this.app = app;
		this.button = document.createElement( 'button' );
		this.button.type = 'button';
		this.button.className = 'boat-recovery';
		this.button.hidden = true;
		this.notified = false;
		this.button.textContent = '⟳ X · 翻船回正';
		this.button.addEventListener( 'click', () => this.recover() );
		document.body.append( this.button );
	}

	get accessible() {
		const app = this.app, p = app.player;
		const aboard = p.mode === 'boat' || p.mode === 'deck';
		const swimmingNear = p.mode === 'swim' &&
			Math.hypot( p.position.x - app.boatCtl.position.x, p.position.z - app.boatCtl.position.z ) < 12;
		return ! app.hunt?.abyss?.active && !app.voyageM1?.deepEcho?.piloting && ! app.freeCam && ( aboard || swimmingNear ) && ! app.islandLife?.ui.isOpen &&
			! app.shipyard?.opened && ! app.oceanChart?.opened && ! app.expedition?.isOpen;
	}

	recover() {
		if ( ! this.accessible || ! this.app.boatCtl.rightCapsizedBoat() ) return false;
		this.app.game.toast( getLocale() === 'en' ? 'Vessel righted in place · momentum stabilized' : '船体已原地回正 · 角速度与浪涌冲量已稳定', 3600 );
		return true;
	}

	update() {
		const can = this.accessible && this.app.boatCtl.needsRecovery;
		this.button.hidden = ! can;
		this.button.textContent = getLocale() === 'en' ? '⟳ X · VESSEL RESCUE' : '⟳ X · 船只回正 / 脱困';
		if ( can && ! this.notified ) this.app.game.toast( getLocale() === 'en' ? 'Vessel capsized! Press X or click Recover to right it.' : '船体翻覆！按 X 或点击右侧「翻船回正」按钮。', 4500 );
		this.notified = can;
		if ( can && this.app.input.enabled && this.app.input.hit( 'KeyX' ) ) this.recover();
	}
}
