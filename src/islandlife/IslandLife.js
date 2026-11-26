import { Vector3 } from '../engine/index.js';
import { WORLD } from '../world/WorldLayout.js';
import { getLocale } from '../course/Localization.js';
import { IslandLifeState } from './IslandLifeState.js';
import { InteractionRouter, facingPoint } from './InteractionRouter.js';
import { Collectibles } from './Collectibles.js';
import { LifeModels } from './LifeModels.js';
import { HomeDecor } from './HomeDecor.js';
import { insideHome, toWorld } from './HomeDecorLogic.js';
import { LifeUI } from './LifeUI.js';
import { FISH } from '../game/FishTable.js';

function localStorageIfAvailable() { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }

export class IslandLife {
	constructor( app ) {
		this.app = app; this.router = new InteractionRouter(); this.nearbyRouter = new InteractionRouter(); this.timer = 0; this.pendingCatches = [];
		this.state = new IslandLifeState( { storage: localStorageIfAvailable(), day: app.homeLife.saveState.day, wallet: app.game.state, notify: ( type, detail ) => this._event( type, detail ) } );
		this.models = new LifeModels();
		this.collectibles = new Collectibles( app, this.state );
		this.decor = new HomeDecor( app, this.state, this.models );
		this.ui = new LifeUI( app, this.state, this.decor );
		this.board = { x: 47, z: - 86 }; this.board.y = app.terrainData.heightAt( this.board.x, this.board.z );
		const board = this.models.mesh( 'board' ); board.position.set( this.board.x, this.board.y, this.board.z ); board.rotation.y = - 0.25; app.scene.add( board );
		app.colliders.addBox( new Vector3( this.board.x, this.board.y + 0.8, this.board.z ), new Vector3( 0.64, 0.8, 0.1 ), - 0.25, { tag: 'lifeBoard' } );
		this.workbenches = app.village.sheds.map( shed => {
			const position = toWorld( shed, 0, - shed.depth / 2 + 0.3 );
			const bench = this.models.mesh( 'workbench' ); bench.position.set( position.x, shed.floorY, position.z ); bench.rotation.y = shed.yaw; app.scene.add( bench );
			app.colliders.addBox( new Vector3( position.x, shed.floorY + 0.37, position.z ), new Vector3( 0.53, 0.37, 0.22 ), shed.yaw, { tag: 'lifeWorkbench' } );
			return { shed, position };
		} );
		// Keep the first shed aliases used by the existing browser smoke test.
		this.shed = this.workbenches[ 0 ]?.shed;
		this.workbench = this.workbenches[ 0 ]?.position;
		this.unsubscribeCatch = app.game.state.onCatch( info => this.pendingCatches.push( { species: info.species } ) );
		this.button = document.createElement( 'button' ); this.button.type = 'button'; this.button.className = 'il-launch'; this.button.textContent = 'B · 海岛背包';
		this.button.addEventListener( 'click', () => { if ( this._canInteract() ) this.ui.open( 'inventory' ); } ); document.body.append( this.button );
	}
	_event( type, detail ) {
		if ( typeof window !== 'undefined' && typeof CustomEvent !== 'undefined' ) window.dispatchEvent( new CustomEvent( 'tidewater:islandlife', { detail: { type, ...detail } } ) );
		// Existing companion memory API is optional; no network request is made.
		const actor = this.app.companionActor;
		if ( type === 'furniture:placed' ) { actor?.remember( 'furniture', detail.item, true ); actor?._announce( '新家具让我们的家更温暖了！', 'The new furniture makes our home feel warmer!' ); }
		if ( type === 'resource:collected' ) actor?._announce( '这份海边的材料可以带去木工坊。', 'We can take this material to the workshop.' );
		if ( type === 'quest:claimed' ) actor?._announce( '委托完成啦，今天也有新的收获！', 'We finished a request today!' );
	}
	_canInteract() {
		const app = this.app, hud = app.game.hud, ui = app.ui?.ui;
		return ! this.ui.isOpen && ! app.hunt?.abyss?.active && ! app.freeCam && app.player.mode === 'walk' && ! app.player.busy && ! app.game.fight && ! app.game.guide?.open && ! hud?.catchOpen && ! hud?.standOpen && ! hud?.invOpen && ! ui?._start && ! ui?._photo && ! ui?._panelOpen && ! app.expedition?.isOpen && ! app.homeLife?.sleeping && app.input.enabled;
	}
	beginFrame() { this.router.clear(); }
	_candidates() {
		const p = this.app.player, en = getLocale() === 'en', router = this.nearbyRouter; router.clear();
		this.collectibles.nearby( p, router );
		const bd = Math.hypot( p.position.x - this.board.x, p.position.z - this.board.z );
		if ( Math.abs( p.position.y - this.board.y ) < 1.8 ) router.add( { id: 'board', distance: bd, range: 2.1, priority: 40, label: en ? 'Read daily requests' : '查看每日委托', perform: () => this.ui.open( 'board' ) } );
		for ( const { shed, position } of this.workbenches ) {
			if ( ! shed.open || ! insideHome( shed, p.position ) ) continue;
			const wd = Math.hypot( p.position.x - position.x, p.position.z - position.z );
			router.add( { id: 'workbench', distance: wd, range: 1.5, priority: facingPoint( p, position ) ? 60 : 10, label: en ? 'Use the workshop' : '使用木工工作台', perform: () => this.ui.open( 'workshop' ) } );
		}
	}
	update( dt ) {
		const app = this.app, day = app.homeLife.saveState.day;
		if ( this.state.syncDay( day ) ) { this.collectibles.refresh(); if ( this.ui.isOpen ) this.ui.render(); }
		for ( const f of this.pendingCatches.splice( 0 ) ) {
			this.state.event( 'fish', f.species );
			if ( FISH[ f.species ]?.habitat?.deep >= 0.6 ) this.state.event( 'deepFish', f.species );
		}
		const p = app.player;
		this.timer -= dt;
		if ( this.timer <= 0 ) {
			this.timer = 0.2; this.decor.sync();
			if ( [ 'boat', 'deck', 'swim' ].includes( p.mode ) && Math.hypot( p.position.x - WORLD.reef.center.x, p.position.z - WORLD.reef.center.z ) <= WORLD.reef.radius ) this.state.event( 'reef' );
			const label = getLocale() === 'en' ? 'B · Island inventory' : 'B · 海岛背包';
			if ( this.button.textContent !== label ) this.button.textContent = label;
		}
		if ( ! this._canInteract() ) { this.router.clear(); this.nearbyRouter.clear(); return; }
		if ( app.input.hit( 'KeyB' ) ) { this.ui.open( 'inventory' ); return; }
		// E is consumed only by the winning interaction; refresh candidates on
		// keypress so a press between the 5 Hz proximity scans is never lost.
		if ( this.timer >= 0.19 || app.input.hit( 'KeyE' ) ) this._candidates();
		for ( const candidate of this.nearbyRouter.candidates ) this.router.add( candidate );
		this.router.dispatch( app.input, p );
	}
}
