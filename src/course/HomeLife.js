import { HOME_SAVE_KEY, SLEEP_DURATION, SLEEP_MORNING_AT, clockLabel, dayPeriod, nearDoor, facingBed, isNewDay } from './HomeLifeLogic.js';
import './homelife.css';
import { getLocale } from './Localization.js';
import { facingPoint } from '../islandlife/InteractionRouter.js';
import { insideHome } from '../islandlife/HomeDecorLogic.js';

const HOME_NAMES = [ '珊瑚', '晚霞', '海风', '潮汐', '星沙', '贝壳', '椰林', '蓝湾', '雾岛', '晴空', '月光', '鲸歌', '花园', '青柠', '远帆', '浪花', '鸥语' ];
export const homeName = ( id ) => {
	if ( getLocale() === 'en' ) return `Cottage ${ id }`;
	if ( /^S[1-3]$/.test( id ) ) return `海边${ [ '一', '二', '三' ][ Number( id[ 1 ] ) - 1 ] }号小屋（${ id }）`;
	return `${ HOME_NAMES[ Math.max( 0, String( id ).charCodeAt( 0 ) - 65 ) % HOME_NAMES.length ] }小屋（${ id }）`;
};

function load() {

	try {

		const data = JSON.parse( localStorage.getItem( HOME_SAVE_KEY ) || '{}' );
		return {
			day: Number.isInteger( data.day ) && data.day > 0 ? data.day : 1,
			home: typeof data.home === 'string' ? data.home : null,
			nights: Number.isInteger( data.nights ) && data.nights >= 0 ? data.nights : 0,
			openedHomes: Array.isArray( data.openedHomes ) ? data.openedHomes.filter( v => typeof v === 'string' ).slice( 0, 17 ) : [],
			hour: typeof data.hour === 'number' && data.hour >= 0 && data.hour < 24 ? data.hour : null,
		};

	} catch { return { day: 1, home: null, nights: 0, openedHomes: [], hour: null }; }

}

// Small CPU-only simulation layer; the native Tidewater sky, birds, waves and
// night audio already respond to app.settings.timeOfDay. No duplicate shaders.
export class HomeLife {

	constructor( app ) {

		this.app = app;
		this.saveState = load();
		if ( this.saveState.hour !== null ) app.settings.timeOfDay = this.saveState.hour;
		this.lastHour = app.settings.timeOfDay;
		this.uiTime = 0;
		this.clockSaveTime = 0;
		this.toastTime = 0;
		this.status = '';
		this.sleeping = null;
		this._mount();
		this._render();

	}

	_mount() {

		const root = document.createElement( 'section' );
		root.className = 'hl-root';
		root.setAttribute( 'aria-label', '海岛时间与家园' );
		root.innerHTML = `<div class="hl-clock"><span class="hl-icon">☀</span><span class="hl-day">第 1 天</span><strong class="hl-time">16:12</strong><span class="hl-period">午后</span></div>
			<div class="hl-home">🛖 <span>寻找一间小屋，在门边按 E 开门</span></div>
			<div class="hl-toast" role="status" hidden></div><div class="hl-dream" aria-hidden="true"><span>好梦 · 明早见 ☀</span></div>`;
		document.body.append( root );
		this.root = root;
		this.clock = root.querySelector( '.hl-clock' );
		this.dayEl = root.querySelector( '.hl-day' );
		this.timeEl = root.querySelector( '.hl-time' );
		this.periodEl = root.querySelector( '.hl-period' );
		this.icon = root.querySelector( '.hl-icon' );
		this.homeEl = root.querySelector( '.hl-home span' );
		this.toast = root.querySelector( '.hl-toast' );
		this.dream = root.querySelector( '.hl-dream' );

	}

	_save() {

		try { localStorage.setItem( HOME_SAVE_KEY, JSON.stringify( this.saveState ) ); } catch { /* optional storage */ }

	}

	_notice( message, seconds = 4.2 ) {

		this.toast.textContent = message;
		this.toast.hidden = false;
		this.toastTime = seconds;

	}

	_render() {

		const hour = this.app.settings.timeOfDay;
		const en = getLocale() === 'en';
		const sharedDay = this.app.crew?.getWorldState?.()?.day;
		const day = sharedDay ?? this.saveState.day;
		this.dayEl.textContent = en ? `Day ${ day }` : `第 ${ day } 天`;
		this.timeEl.textContent = clockLabel( hour );
		this.periodEl.textContent = en ? ( { '深夜': 'Late night', '清晨': 'Early morning', '上午': 'Morning', '午间': 'Noon', '午后': 'Afternoon', '傍晚': 'Evening', '夜晚': 'Night' }[ dayPeriod( hour ) ] ) : dayPeriod( hour );
		this.icon.textContent = hour >= 6 && hour < 18 ? '☀' : hour >= 18 && hour < 20 ? '🌅' : '☾';
		this.homeEl.textContent = this.saveState.home ? ( en ? `Home: ${ homeName( this.saveState.home ) } · ${ this.saveState.nights } nights` : `我的家：${ homeName( this.saveState.home ) } · 已睡 ${ this.saveState.nights } 晚` ) : ( en ? 'Explore the village · E opens doors · G sets your home at a bed' : '去村庄探索，按 E 开门 · 床边按 G 安家' );
		this.clock.classList.toggle( 'hl-night', hour < 6 || hour >= 19 );
		this.clock.title = en ? `Press T to ${ this.app.settings.timeSpeed ? 'pause' : 'resume' } time` : `按 T ${ this.app.settings.timeSpeed ? '暂停' : '继续' }昼夜循环`;
		this.dream.firstElementChild.textContent = this.sleeping?.morning ? ( en ? 'Good morning ☀' : '早上好 ☀' ) : ( en ? 'Resting · See you in the morning' : '正在休息 · 明早见' );

	}

	_sleep( home ) {

		if ( this.sleeping ) return;
		this.sleeping = { home, elapsed: 0, morning: false, timeSpeed: this.app.settings.timeSpeed, inputEnabled: this.app.input.enabled };
		this.app.settings.timeSpeed = 0;
		this.app.input.enabled = false;
		this.dream.classList.remove( 'hl-sleeping' );
		void this.dream.offsetWidth;
		this.dream.classList.add( 'hl-sleeping' );
		this._render();

	}

	_wake( home ) {

		const s = this.app.settings;
		s.timeOfDay = 7;
		if ( this.app.crew?.connected ) this.app.crew.requestWorldControl( { hour: 7 } );
		this.lastHour = 7;
		this.saveState.day ++;
		this.saveState.nights ++;
		this.saveState.hour = 7;
		if ( ! this.saveState.home ) this.saveState.home = home.name;
		this._save();
		this._render();

	}

	update( dt ) {

		const app = this.app;
		const player = app.player;
		const s = app.settings;
		if ( this.sleeping ) {

			const sleep = this.sleeping;
			sleep.elapsed += Math.max( 0, dt );
			if ( ! sleep.morning && sleep.elapsed >= SLEEP_MORNING_AT ) {

				sleep.morning = true;
				this._wake( sleep.home );

			}
			if ( sleep.elapsed >= SLEEP_DURATION ) {

				s.timeSpeed = sleep.timeSpeed;
				app.input.enabled = sleep.inputEnabled && ! app.expedition?.isOpen;
				this.sleeping = null;
				this.dream.classList.remove( 'hl-sleeping' );
				this._render();
				this._notice( getLocale() === 'en' ? `☀ A new day! Rested at ${ homeName( sleep.home.name ) }.` : `☀ 新的一天！已在${ homeName( sleep.home.name ) }休息。`, 5.5 );

			}
			return;

		}
		if ( isNewDay( this.lastHour, s.timeOfDay, s.timeSpeed ) ) {

			this.saveState.day ++;
			this._save();
			this._notice( getLocale() === 'en' ? '🌅 A new day begins! Go fishing or exploring, then rest at home.' : '🌅 新的一天开始了！可以去钓鱼、探索，晚上回家休息。' );

		}
		this.lastHour = s.timeOfDay;
		this.uiTime -= dt;
		if ( this.uiTime <= 0 ) { this.uiTime = 0.25; this._render(); }
		this.clockSaveTime -= dt;
		if ( this.clockSaveTime <= 0 ) {

			this.clockSaveTime = 15;
			this.saveState.hour = s.timeOfDay;
			this._save();

		}
		if ( this.toastTime > 0 ) {

			this.toastTime -= dt;
			if ( this.toastTime <= 0 ) this.toast.hidden = true;

		}
		const hud = app.game?.hud, overlay = app.ui?.ui;
		if ( app.hunt?.abyss?.active || app.freeCam || player.mode !== 'walk' || player.busy || player.prompt?.key === 'E' || app.game?.guide?.open || hud?.invOpen || hud?.standOpen || hud?.catchOpen || overlay?._start || overlay?._photo || overlay?._panelOpen || app.expedition?.isOpen || app.islandLife?.ui?.isOpen ) return;
		let nearestDoor = null, nearestBed = null, doorDistance = Infinity, bedDistance = Infinity;
		for ( const home of app.village.enterable ) {

			if ( nearDoor( player.position, home ) ) {

				const d = Math.hypot( player.position.x - home.door.x, player.position.z - home.door.z );
				if ( d < doorDistance ) { nearestDoor = home; doorDistance = d; }

			}
			if ( home.bed && insideHome( home, player.position ) && facingBed( player.position, player.yaw, home ) ) {

				const d = Math.hypot( player.position.x - home.bed.x, player.position.z - home.bed.z );
				if ( d < bedDistance ) { nearestBed = home; bedDistance = d; }

			}

		}
		const inp = app.input;
		if ( nearestBed ) {

			const text = getLocale() === 'en' ? `Sleep at ${ homeName( nearestBed.name ) } · G to set home` : `在${ homeName( nearestBed.name ) }睡觉 · G 设为我的家`;
			if ( app.islandLife ) app.islandLife.router.add( { id: `bed:${ nearestBed.name }`, distance: bedDistance, range: 1.85, priority: 90, label: text, perform: () => this._sleep( nearestBed ) } );
			else player.prompt = { key: 'E', text };
			if ( inp.hit( 'KeyG' ) ) {

				this.saveState.home = nearestBed.name;
				this._save();
				this._notice( getLocale() === 'en' ? `🏡 ${ homeName( nearestBed.name ) } is now your home.` : `🏡 已把${ homeName( nearestBed.name ) }设为你的家。` );

			}
			if ( ! app.islandLife && inp.consume( 'KeyE' ) ) this._sleep( nearestBed );

		} else if ( nearestDoor ) {

			const home = nearestDoor;
			const en = getLocale() === 'en';
			const label = home.bed ? homeName( home.name ) : ( en ? 'Tool shed' : '工具棚' );
			const text = en ? `${ home.open ? 'Close' : 'Open' } the door to ${ label }` : `${ home.open ? '关上' : '打开' }${ label }的门`;
			const perform = () => {

				if ( home.open && doorDistance < 1.2 ) {

					this._notice( en ? 'Step away from the door before closing it.' : '请先离门远一点，再关门。', 2 );

				} else {

					home.open = ! home.open;
					home.door.door.solid = ! home.open;
					if ( home.open && home.bed && ! this.saveState.openedHomes.includes( home.name ) ) {

						this.saveState.openedHomes.push( home.name );
						this._save();

					}
					this._notice( en ? ( home.open ? `🚪 ${ label } is open.` : '🚪 Door closed.' ) : ( home.open ? `🚪 ${ label }的门打开了，进去看看吧。` : '🚪 门已关好。' ), 3 );

				}

			};
			if ( app.islandLife ) app.islandLife.router.add( { id: `door:${ home.name }`, distance: doorDistance, range: 2.1, priority: facingPoint( player, home.door ) ? 50 : 20, label: text, perform } );
			else { player.prompt = { key: 'E', text }; if ( inp.consume( 'KeyE' ) ) perform(); }

		}

	}

}
