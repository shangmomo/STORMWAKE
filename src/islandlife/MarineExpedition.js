import { Group, Mesh, Vector3 } from '../engine/index.js';
import { GeoKit, box, cylinder, rod, mat4 } from '../world/boat/GeoKit.js';
import { pickSpecies, rollWeight } from '../game/Bites.js';
import { FISH } from '../game/FishTable.js';
import { OCEAN_ZONES, zoneAt } from './OceanZones.js';
import { getLocale } from '../course/Localization.js';

const V = ( x, y, z ) => new Vector3( x, y, z );
// Real gear, real catches. All CPU logic is O(1) per frame; at most two
// stationary crab-pot models exist. The net is one merged mesh in the boat
// frame. Fish models continue to use the game's original LOD fish renderer.
export class MarineExpedition {

	constructor( app ) {

		this.app = app;
		this.state = app.islandLife.state;
		this.netOn = false;
		this.distance = 0;
		this.revealTime = 0;
		this.elapsed = 0;
		this.targetZone = 'reef';
		this.refresh = 0;
		this.netMesh = this._buildNet();
		this.netMesh.visible = false;
		app.boat.group.add( this.netMesh );
		this.potModels = new Map();
		for ( const pot of this.state.data.marine.pots ) this._addPotModel( pot );
		this.banner = document.createElement( 'div' );
		this.banner.className = 'marine-banner';
		this.banner.hidden = true;
		document.body.append( this.banner );

	}

	get waterDepth() {
		const b = this.app.boatCtl.position;
		return Math.max( 0, - this.app.terrainData.heightAt( b.x, b.z ) );

	}

	_buildNet() {

		const kit = new GeoKit();
		const add = ( a, b, r = 0.011 ) => kit.add( 'fittings', rod( V( ...a ), V( ...b ), r, 6 ), { color: 0xb49d70, rough: 0.88, metal: 0 } );
		// Two drag ropes span to the rear corners; the tapered lattice ends in a
		// cod-end at the stern, well aft of the swimmer's exit/boarding corridor.
		for ( const side of [ - 1, 1 ] ) add( [ side * 0.9, 0.73, - 2.85 ], [ side * 1.05, - 0.48, - 5.95 ], 0.035 );
		for ( let j = 0; j <= 10; j ++ ) {
			const f = j / 10, z = - 4.05 - f * 2.2, w = 1.05 * ( 1 - f * 0.78 );
			for ( let k = 0; k < 9; k ++ ) {
				const x = ( k / 8 * 2 - 1 ) * w;
				if ( k < 8 ) add( [ x, - 0.39 - f * 0.21, z ], [ ( ( k + 1 ) / 8 * 2 - 1 ) * w, - 0.39 - f * 0.21, z ] );
				if ( j < 10 ) add( [ x, - 0.39 - f * 0.21, z ], [ x * 0.92, - 0.39 - ( f + 0.1 ) * 0.21, z - 0.22 ] );
			}
		}
		return new Mesh( kit.merged( 'fittings' ), this.app.boat.materials.fittings );

	}

	_addPotModel( pot ) {

		const kit = new GeoKit();
		const brown = { color: 0x70503a, rough: 0.9 }, brass = { color: 0xada275, rough: 0.65 };
		// Floating buoy, bamboo cradle, metal trap frame and rope running to the
		// seabed. The frame stays shallow for playability; seabed depth is used
		// for interactions/catching, without extra rigid-body simulation.
		kit.add( 'wood', box( 0.48, 0.13, 0.48 ), { ...brown, matrix: mat4( 0, - 0.1, 0 ) } );
		for ( const x of [ - 0.22, 0.22 ] ) for ( const z of [ - 0.22, 0.22 ] ) kit.add( 'wood',
			rod( V( x, - 0.20, z ), V( x, - 0.75, z ), 0.025, 6 ), brown );
		for ( const yy of [ - 0.74, - 0.25 ] ) for ( const x of [ - 0.23, 0.23 ] ) kit.add( 'wood',
			rod( V( x, yy, - 0.23 ), V( x, yy, 0.23 ), 0.025, 6 ), brown );
		kit.add( 'fittings', cylinder( 0.22, 0.21, 0.42, 12 ), { color: 0xd46e3c, rough: 0.65, matrix: mat4( 0, 0.30, 0 ) } );
		kit.add( 'fittings', rod( V( 0, - 0.14, 0 ), V( 0, 0.62, 0 ), 0.022, 7 ), brass );
		kit.add( 'fittings', cylinder( 0.06, 0.06, 0.10, 8 ), { color: 0xf1dc94, rough: 0.32, matrix: mat4( 0, 0.64, 0 ) } );
		const group = new Group();
		for ( const bucket of [ 'wood', 'fittings' ] ) {
			const geometry = kit.merged( bucket );
			if ( geometry ) group.add( new Mesh( geometry, this.app.boat.materials[ bucket ] ) );
		}
		group.name = `FishPot_${ pot.id }`;
		group.position.set( pot.x, 0, pot.z );
		this.app.scene.add( group );
		this.potModels.set( pot.id, group );

	}

	_removePotModel( id ) {

		const obj = this.potModels.get( id );
		if ( ! obj ) return;
		this.app.scene.remove( obj );
		obj.traverse( child => child.geometry?.dispose?.() );
		this.potModels.delete( id );

	}

	_notify( zh, en = zh ) {

		this.app.game.toast( getLocale() === 'en' ? en : zh, 3200 );

	}

	catchFish( source, point=null ) {

		const boat=this.app.boatCtl,p=point||boat.position,depth=Math.max(0,-this.app.terrainData.heightAt(p.x,p.z));
		const habitat=this.app.game.habitatAtPoint(p.x,p.z,depth);
		const species = pickSpecies( habitat, this.app.settings.timeOfDay );
		if ( ! species ) return false;
		const kg = rollWeight( species );
		const kept = this.app.game.state.addFish( species, kg, this.app.settings.timeOfDay,p );
		if ( kept ) {
			if ( source === 'trawl' ) { this.state.trawlCatch(); this.app.hunt?.progress.trawlSalvage(); }
			this._notify( `${ source === 'trawl' ? '拖网' : '蟹笼' }收获：${ FISH[ species ].name } ${ kg.toFixed( 2 ) } kg`,
				`${ source === 'trawl' ? 'Trawl' : 'Pot' } catch: ${ FISH[ species ].name } ${ kg.toFixed( 2 ) } kg` );
		} else if(this.app.game.state.lastCatch?.failed==='stock')this._notify('本海域鱼群需要恢复。','Local fish stock needs time to recover.');
		else if(this.app.game.state.lastCatch?.failed==='save')this._notify('存档失败，本次渔获未入舱。','Save failed; catch not retained.');
		else this._notify( '渔获舱已满！先到鱼市出售渔获。', 'Hold full. Sell some fish at the market.' );
		return !! kept;

	}

	deployPot() {

		const b = this.app.boatCtl, depth = this.waterDepth;
		if ( depth < 2 || depth > 35 || b.speed > 4.5 ) return this._notify( '蟹笼需要水深 2–35 米且低速航行。', 'Crab pot needs 2–35m water and low speed.' );
		const pos = b.toWorld( V( 0, 0, - 4.0 ), new Vector3() );
		const pot = this.state.deployPot( pos.x, pos.z, Date.now() );
		if ( ! pot ) return this._notify( '最多部署两只蟹笼；彼此相隔至少 14 米。', 'Max 2 pots; space them at least 14m apart.' );
		this._addPotModel( pot );
		this._notify( '已放下带浮标的蟹笼，24 秒后返回附近按 U 收获。', 'Pot set! Return after 24s, then press U nearby.' );

	}

	haulPot() {

		const b = this.app.boatCtl, pots = this.state.data.marine.pots;
		let target = null, best = Infinity;
		for ( const pot of pots ) {
			const dist = Math.hypot( pot.x - b.position.x, pot.z - b.position.z );
			if ( dist < best ) { best = dist; target = pot; }
		}
		if ( ! target || best > 13 ) return this._notify( '附近没有蟹笼。看海面上的橙色浮标。', 'No pot nearby. Look for orange buoys.' );
		if ( b.speed > 2.2 ) return this._notify( '先减速至约 2 m/s 再收笼。', 'Slow down below 2 m/s before hauling.' );
		const remaining = Math.ceil( ( target.readyAt - Date.now() ) / 1000 );
		if ( remaining > 0 ) return this._notify( `还需等待 ${ remaining } 秒；潮水正在带来鱼群。`, `Wait ${ remaining }s for the pot.` );
		if ( this.state.haulPot( target.id, Date.now() ) ) {
			this._removePotModel( target.id );
			this.catchFish( 'pot',target );
		}

	}

	survey() {

		const b = this.app.boatCtl.position;
		const near = zoneAt( b.x, b.z );
		if ( ! near ) return this._notify( '按 F2 查看航海地图，跟随编号航海标记，在目标海域按 Y 勘测。', 'Press F2 for the sea chart, follow its numbered markers, then press Y.' );
		const first = this.state.survey( near.id );
		this._notify( first ? `航海日志记录了新海域：${ near.zh }。打开背包查看海图档案。` : `已勘测过：${ near.zh }。`, first ? `Expedition journal recorded: ${ near.en }` : `Already surveyed: ${ near.en }` );

	}

	update( dt ) {

		const app = this.app, p = app.player, b = app.boatCtl, input = app.input;
		this.elapsed += dt;
		// Floating markers rock independently of the rigid boat. Keep the
		// amplitude below the buoy's radius so no pot hovers above the sea.
		for ( const [ id, marker ] of this.potModels ) {
			const phase = Number( id.slice( 4 ) ) * 1.7;
			marker.position.y = 0.08 * Math.sin( this.elapsed * 1.65 + phase );
		}
		const aboard = p.mode === 'boat' || p.mode === 'deck';
		const inAbyss = !!app.hunt?.abyss?.active||!!app.voyageM1?.deepEcho?.piloting;
		const active = aboard && !p.stationId && !app.landAdventure?.stance && !inAbyss && input.enabled && ! app.islandLife.ui.isOpen && ! app.shipyard?.opened;
		if ( ! aboard && this.netOn ) this.netOn = false;
		if ( active && input.hit( 'KeyN' ) ) {
			this.netOn = ! this.netOn;
			this.distance = 0;
			this._notify( this.netOn ? '拖网已展开：保持前进，航行约 55 米收获一次。' : '拖网已收起。', this.netOn ? 'Trawl deployed: travel ~55m for a catch.' : 'Net stowed.' );
		}
		// P/H are global photo/settings shortcuts, K calls the companion.
		// Maritime controls get their own keys so none of those modes
		// accidentally open while hauling a pot or charting a reef.
		if ( active && input.hit( 'KeyO' ) ) this.deployPot();
		if ( active && input.hit( 'KeyU' ) ) this.haulPot();
		if ( active && input.hit( 'KeyY' ) ) this.survey();
		this.netMesh.visible = this.netOn && !inAbyss;
		if ( this.netOn && !inAbyss && this.waterDepth > 2 && b.speed > 1.2 && b.speed < 12 ) {
			this.distance += Math.min( b.speed * dt, 2 );
			if ( this.distance >= 55 ) {
				this.distance -= 55;
				this.catchFish( 'trawl' );
			}
		}
		this.refresh -= dt;
		if ( this.refresh > 0 ) return;
		this.refresh = 0.33;
		this.banner.hidden = ! aboard;
		if ( ! aboard ) return;
		const en = getLocale() === 'en', pots = this.state.data.marine.pots;
		const custom=app.oceanChart?.customTarget;
		const target = this.targetZone==='custom'?custom:this.targetZone.startsWith( 'boss:' ) && app.hunt?.bosses.getPosition( this.targetZone.slice( 5 ) ) ?
			{ number: '⚔', ...app.hunt.bosses.getPosition( this.targetZone.slice( 5 ) ) } : this.targetZone === 'whale' && app.whale?.ready ?
			{ number: '🐋', x: app.whale.brain.position.x, z: app.whale.brain.position.z } :
			OCEAN_ZONES.find( zone => zone.id === this.targetZone );
		const away = target ? Math.round( Math.hypot( b.position.x - target.x, b.position.z - target.z ) ) : 0;
		const nav = target ? ( en ? `  •  Z chart ${ target.number }: ${ away }m` : `　·　Z 海图 ${ target.number }号 ${ away }m` ) : '';
		this.banner.textContent = en ?
			`⚓ ${ app.boat.variant.toUpperCase() }  •  N net ${ this.netOn ? `${ Math.round( this.distance ) }/55m` : 'off' }  •  O pot ${ pots.length }/2  •  U haul  •  Y survey  •  Q weapon  •  C fire  •  G forge${ nav }` :
			`⚓ ${ app.boat.variant.toUpperCase() }　·　N 拖网 ${ this.netOn ? `${ Math.round( this.distance ) }/55m` : '收起' }　·　O 蟹笼 ${ pots.length }/2　·　U 回收　·　Y 勘测　·　Q 换武器　·　C 射击　·　G 锻造${ nav }`;

	}

}
