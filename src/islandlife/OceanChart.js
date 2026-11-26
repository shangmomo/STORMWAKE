import {modalActive,controlContext} from '../core/ControlPolicy.js';
import { getLocale } from '../course/Localization.js';
import { OCEAN_ZONES, OCEAN_CHART_BOUNDS, chartPoint } from './OceanZones.js';
import { nearestSea } from '../ship/FreeSeaNavigation.js';
import { SEA_TITANS } from '../oceanhunt/HuntRules.js';

// A navigable, north-up sea chart, using the actual minimap terrain raster,
// rather than fabricated screen-space points. Its markers share coordinates
// with the real survey triggers. One active waypoint follows the vessel.
export class OceanChart {

	constructor( app ) {
		this.app = app;
		this.opened = false;
		this.refresh = 0;
		this.selectedWaypoint = null; // absent until a sailor clicks the chart
		this.customTarget = null;
		this.launch = document.createElement( 'button' );
		this.launch.className = 'ocean-chart-launch';
		this.launch.type = 'button';
		this.launch.textContent = '🧭 F2 · 航海图';
		this.launch.addEventListener( 'click', () => this.open() );
		this.overlay = document.createElement( 'div' );
		this.overlay.className = 'ocean-chart-overlay';
		this.overlay.hidden = true;
		this.overlay.addEventListener( 'click', event => {
			if(event.target.closest?.('[data-stop-navigation]')){this.clearNavigation();return;}
			const warp = event.target.closest?.( '[data-boss-warp]' );
			if ( warp ) { this.teleportToBoss( warp.dataset.bossWarp ); return; }
			const target = event.target.closest?.( '[data-waypoint]' );
			if ( target ) this.select( target.dataset.waypoint );
			else if(event.target.matches?.('.oc-map-wrap canvas')){
				this.selectAtMap(event.clientX,event.clientY,event.target.getBoundingClientRect());
			}else if ( event.target === this.overlay || event.target.closest?.( '[data-close-chart]' ) ) this.close();
		} );
		document.body.append( this.launch, this.overlay );
		this.onEscape = e => {
			if ( ! this.opened || ! [ 'Escape', 'F2' ].includes( e.code ) ) return;
			e.preventDefault(); e.stopImmediatePropagation(); this.close();
		};
		window.addEventListener( 'keydown', this.onEscape, true );
	}

	get available() {
		const app = this.app;
		return ! app.hunt?.abyss?.active && ! app.freeCam && ! app.shipyard?.opened && ! app.islandLife?.ui.isOpen &&
			! app.expedition?.isOpen && ! app.homeLife?.sleeping && ! app.ui?.ui?._photo && ! app.hunt?.opened && app.crew?.overlay.hidden !== false;
	}

	get navigatorPosition() {
		const p = this.app.player;
		return p.mode === 'boat' || p.mode === 'deck' ? this.app.boatCtl.position : p.position;
	}

	open() {
		if ( this.opened || ! this.available || modalActive(this.app) || controlContext(this.app)==='research' ) return false;
		this.opened = true;
		this.beforeInput = this.app.input.enabled;
		this.app.input.enabled = false;
		if ( document.pointerLockElement ) document.exitPointerLock?.();
		this.overlay.hidden = false;
		this.render();
		this.updateMarkers();
		return true;
	}

	close() {
		if ( ! this.opened ) return;
		this.opened = false;
		this.overlay.hidden = true;
		this.app.input.pressed.clear(); this.app.input.keys.clear();
		this.app.input.enabled = this.beforeInput;
	}

	select( id, {remote=false}={} ) {
		const boss = id.startsWith( 'boss:' ) ? SEA_TITANS.find( b => b.id === id.slice( 5 ) ) : null;
		const zone = boss ? { id, number: boss.icon, zh: boss.name, en: boss.en } : id === 'whale' && this.app.whale?.ready ?
			{ id: 'whale', number: '🐋', zh: '座头鲸观赏航线', en: 'Humpback whale' } : OCEAN_ZONES.find( z => z.id === id );
		if ( ! zone ) return false;
		if(!remote&&this.app.player.stationId==='helm')this.app.voyageM1?.leaveStation();
        this.app.marineExpedition.targetZone = id;
		this.customTarget=null;
		this.selectedWaypoint=id;
		if(!remote)this.broadcastTarget();
		const en = getLocale() === 'en';
		this.close();
		this.app.game.toast( en ? `Waypoint ${ zone.number }: ${ zone.en }. Follow the yellow map marker.` : `航海目标 ${ zone.number }：${ zone.zh }。跟随地图上的金色标记。`, 3800 );
		return true;
	}

	// A canvas click is a geographical coordinate, not a fixed marker lookup.
	// For a land click, pilot goes to nearest safe anchorage instead of
	// attempting to drive through an island. The requested pin stays visible.
	selectAtMap(clientX,clientY,rect){
		if(!rect?.width||!rect?.height)return false;
		const rx=Math.min(1,Math.max(0,(clientX-rect.left)/rect.width));
		const rz=Math.min(1,Math.max(0,(clientY-rect.top)/rect.height));
		const b=OCEAN_CHART_BOUNDS;
		const raw={x:b.minX+rx*(b.maxX-b.minX),z:b.minZ+rz*(b.maxZ-b.minZ)};
		return this.setFreeTarget(raw);
	}
	setFreeTarget(raw,{remote=false}={}){
		if(!Number.isFinite(raw?.x)||!Number.isFinite(raw?.z))return false;
		const b=OCEAN_CHART_BOUNDS;
		if(raw.x<b.minX||raw.x>b.maxX||raw.z<b.minZ||raw.z>b.maxZ)return false;
		const safe=nearestSea(raw,this.app.terrainData);
		if(!safe){this.app.game?.toast?.('附近没有可通航水域，请选择海面',3000);return false;}
		this.customTarget={id:'custom',number:'⌖',zh:'自由航点',en:'Free waypoint',x:raw.x,z:raw.z,safeX:safe.x,safeZ:safe.z};
		if(!remote&&this.app.player.stationId==='helm')this.app.voyageM1?.leaveStation();
        this.selectedWaypoint='custom';
		this.app.marineExpedition.targetZone='custom';
		if(!remote)this.broadcastTarget();
		this.close();
		this.app.game?.toast?.(`已设自由航点 (${Math.round(raw.x)}, ${Math.round(raw.z)})；AI 将绕避陆地`,4000);
		return true;
	}
 clearNavigation({remote=false}={}){this.selectedWaypoint=null;this.customTarget=null;if(!remote)this.app.crew?.send?.({type:'nav_target',id:'none'});this.close();}

	getNavigationTarget(){
		const id=this.selectedWaypoint;
		if(!id)return null;
		if(id==='custom')return this.customTarget&&{x:this.customTarget.safeX,z:this.customTarget.safeZ};
		if(id.startsWith('boss:'))return this.app.hunt?.bosses.getPosition(id.slice(5))||null;
		if(id==='whale')return this.app.whale?.brain.position||null;
		return OCEAN_ZONES.find(z=>z.id===id)||null;
	}
	broadcastTarget(){
		if(this.app.crew?.connected)this.app.crew.send({type:'nav_target',id:this.selectedWaypoint,
			x:this.customTarget?.x,z:this.customTarget?.z});
	}

	teleportToBoss( id ) {
		const arrived = this.app.hunt?.teleportToBoss( id ) || false;
		if ( arrived ) this.close();
		return arrived;
	}

	_drawMap() {
		const canvas = this.overlay.querySelector( 'canvas' );
		if ( ! canvas ) return;
		const ctx = canvas.getContext( '2d' );
		const backdrop = ctx.createLinearGradient( 0, 0, 540, 640 );
		backdrop.addColorStop( 0, '#153c55' ); backdrop.addColorStop( 0.58, '#0b314d' ); backdrop.addColorStop( 1, '#09233b' );
		ctx.fillStyle = backdrop; ctx.fillRect( 0, 0, 640, 640 );
		// Low-contrast depth contours make the open water read as actual territory.
		// They are cartographic cues, not a falsely detailed generated seabed map.
		ctx.strokeStyle = 'rgba(132,196,204,0.10)'; ctx.lineWidth = 1;
		for ( let i = 0; i < 9; i ++ ) {
			ctx.beginPath(); ctx.ellipse( 330 + i * 13, 360 + i * 17, 130 + i * 35, 95 + i * 31, -0.5, 0, Math.PI * 2 ); ctx.stroke();
		}
		const src = this.app.game.minimap?.canvas;
		const b = OCEAN_CHART_BOUNDS;
		// The detailed island chart covers [-640,+640] x [-820,+460] metres.
		// Project it INTO the larger ocean chart, not the other way around: the
		// old source-crop implementation broke as soon as offshore bounds grew.
		if ( src ) {
			const nw = chartPoint( -640, -820 ), se = chartPoint( 640, 460 );
			ctx.drawImage( src, 0, 0, src.width, src.height,
				nw.x * 640, nw.y * 640, ( se.x - nw.x ) * 640, ( se.y - nw.y ) * 640 );
		}
		// Accurate meter-scale hostile home waters; these are no-spawn-safe
		// hunting territories, not arbitrary circles around the harbour.
		for ( const beast of SEA_TITANS ) {
			const p = chartPoint( beast.x, beast.z );
			ctx.beginPath();
			ctx.ellipse( p.x * 640, p.y * 640,
				beast.territory / ( b.maxX - b.minX ) * 640,
				beast.territory / ( b.maxZ - b.minZ ) * 640, 0, 0, Math.PI * 2 );
			ctx.fillStyle = beast.id === 'leviathan' ? 'rgba(176,43,51,0.17)' : 'rgba(236,134,74,0.11)';
			ctx.fill(); ctx.lineWidth = beast.id === 'leviathan' ? 2.3 : 1.4;
			ctx.strokeStyle = beast.id === 'leviathan' ? 'rgba(255,95,101,0.76)' : 'rgba(255,183,111,0.52)';
			ctx.setLineDash( [ 7, 5 ] ); ctx.stroke(); ctx.setLineDash( [] );
		}
		ctx.lineWidth = 1; ctx.strokeStyle = '#eee0b742';
		for ( let n = 1; n <= 7; n ++ ) {
			const v = n * 80;
			ctx.beginPath(); ctx.moveTo( v, 0 ); ctx.lineTo( v, 640 ); ctx.stroke();
			ctx.beginPath(); ctx.moveTo( 0, v ); ctx.lineTo( 640, v ); ctx.stroke();
		}
		ctx.fillStyle = 'rgba(210,229,224,0.70)'; ctx.font = '600 13px Georgia, serif';
		for ( const [ label, x, z ] of [ [ 'WESTERN SHELF', -1700, 2050 ], [ 'EASTERN BLUE', 1100, 2350 ],
			[ 'ABYSSAL TRENCH', 1100, 3560 ], [ 'THE NORTHERN ABYSS', -1700, 4130 ] ] ) {
			const p = chartPoint( x, z ); ctx.fillText( label, p.x * 640, p.y * 640 );
		}
		ctx.strokeStyle = 'rgba(244,223,152,0.85)'; ctx.beginPath(); ctx.moveTo( 25, 611 );
		ctx.lineTo( 25 + 1000 / ( b.maxX - b.minX ) * 640, 611 ); ctx.stroke();
		ctx.fillText( '1 km', 25, 603 );
	}

	render() {
		const en = getLocale() === 'en';
		const found = this.app.islandLife.state.data.marine.surveys;
		const active = this.app.marineExpedition.targetZone;
		const custom=this.customTarget;
		const freePin=custom?(()=>{const p=chartPoint(custom.x,custom.z);return `<span class="oc-free-pin" style="left:${(p.x*100).toFixed(2)}%;top:${(p.y*100).toFixed(2)}%" title="自由航点">⌖</span>`;})():'';
		const buttons = OCEAN_ZONES.map( zone => {
			const pos = chartPoint( zone.x, zone.z );
			return `<button type="button" class="oc-pin ${ zone.id === active ? 'is-active' : '' }" data-waypoint="${ zone.id }" style="left:${ ( pos.x * 100 ).toFixed( 2 ) }%;top:${ ( pos.y * 100 ).toFixed( 2 ) }%" title="${ en ? zone.en : zone.zh }">${ zone.number }</button>`;
		} ).join( '' );
		const whale = this.app.whale?.ready ? this.app.whale.brain.position : null;
		const whalePoint = whale ? chartPoint( whale.x, whale.z ) : null;
		const whaleButton = whalePoint ? `<button type="button" class="oc-pin oc-whale ${ active === 'whale' ? 'is-active' : '' }" data-waypoint="whale" style="left:${ ( whalePoint.x * 100 ).toFixed( 2 ) }%;top:${ ( whalePoint.y * 100 ).toFixed( 2 ) }%" title="${ en ? 'Humpback whale' : '座头鲸' }">🐋</button>` : '';
		const bossButtons = SEA_TITANS.map( beast => {
			const live = this.app.hunt?.bosses.get( beast.id );
			const pos = chartPoint( live?.pos.x ?? beast.x, live?.pos.z ?? beast.z );
			return `<button type="button" class="oc-pin oc-boss ${ live?.health <= 0 ? 'is-defeated' : '' } ${ active === `boss:${ beast.id }` ? 'is-active' : '' }" data-waypoint="boss:${ beast.id }" style="left:${ ( pos.x * 100 ).toFixed( 2 ) }%;top:${ ( pos.y * 100 ).toFixed( 2 ) }%" title="${ beast.name }">${ beast.icon }</button>`;
		} ).join( '' );
		const entries = OCEAN_ZONES.map( zone => `<button type="button" class="oc-entry ${ zone.id === active ? 'is-active' : '' }" data-waypoint="${ zone.id }"><b>${ zone.number }</b><span><strong>${ en ? zone.en : zone.zh }</strong><small>${ found.includes( zone.id ) ? ( en ? 'CHARTED' : '已勘测' ) : ( en ? 'UNSURVEYED' : '尚未勘测' ) }</small></span><em>⌖</em></button>` ).join( '' ) +
			( whale ? `<button type="button" class="oc-entry ${ active === 'whale' ? 'is-active' : '' }" data-waypoint="whale"><b>🐋</b><span><strong>${ en ? 'Follow the humpback' : '跟随座头鲸' }</strong><small>${ en ? 'MOVING · VIEWING EXPERIENCE' : '动态位置 · 靠近观赏' }</small></span><em>⌖</em></button>` : '' ) +
			SEA_TITANS.map( beast => {
				const b = this.app.hunt?.bosses.get( beast.id );
				const waypoint = `<button type="button" class="oc-entry ${ active === `boss:${ beast.id }` ? 'is-active' : '' }" data-waypoint="boss:${ beast.id }"><b>${ beast.icon }</b><span><strong>${ en ? beast.en : beast.name }</strong><small>${ b?.health <= 0 ? ( en ? 'Defeated · respawning' : '已击败 · 等待复活' ) : `⚔ ${ b?.health ?? beast.hp }/${ beast.hp } HP · ${ en ? 'territory' : '领地半径' } ${ beast.territory }m` }</small></span><em>⌖</em></button>`;
				return this.app.hunt?.developer ? `<div class="oc-boss-row">${ waypoint }<button type="button" class="oc-warp" data-boss-warp="${ beast.id }">⚡ ${ en ? 'Warp ship' : '带船传送' }</button></div>` : waypoint;
			} ).join( '' );
		this.overlay.innerHTML = `<section class="oc-panel" role="dialog" aria-modal="true" aria-label="${ en ? 'Captain sea chart' : '航海地图' }"><header><div><small>STORMWAKE · NAVIGATION</small><h2>${ en ? 'Captain’s sea chart' : '船长航海图' }</h2><p>${ this.app.hunt?.developer ? ( en ? 'Developer mode: warp your current ship to any titan, or set a normal waypoint.' : '开发者模式：可带当前船型直达任何海怪附近，也可选择常规航点。' ) : ( en ? 'Choose a survey area or a moving titan. Follow the golden marker.' : '点击地图任意位置设自由航点；AI 绕开陆地驶向可通航目标。也可选择右侧固定地标。' ) }</p></div><button type="button" data-close-chart aria-label="close">×</button></header><div class="oc-body"><div class="oc-map-wrap"><canvas width="640" height="640"></canvas><svg class="oc-route" viewBox="0 0 1000 1000" preserveAspectRatio="none"><line class="oc-course" x1="0" y1="0" x2="0" y2="0"/></svg>${ buttons }${ whaleButton }${ bossButtons }${ freePin }<div class="oc-teammates" aria-label="team positions"></div><div class="oc-vessel" aria-label="current position">▲</div><span class="oc-north">N ↑</span><span class="oc-caption">${ en ? 'Actual survey triggers · moving sea titans · crew positions' : '真实勘测区域 · 巨兽巡游位置 · 队友位置' }</span></div><aside><h3>${ en ? 'Ocean destinations · sea titans' : '海域目标 · 四海巨兽' }</h3>${ entries }<button type="button" data-stop-navigation>Stop navigation / 取消领航</button><div class="oc-direction"></div><p class="oc-hint">${ en ? 'Y to survey · Q weapon · C fire · Whale is peaceful.' : 'Y 勘测 · Q 切武器 · C 开火 · 座头鲸是友善的观赏生物。' }</p></aside></div></section>`;
		this._drawMap();
	}

	updateMarkers() {
		if ( ! this.opened ) return;
		const selected = this.app.marineExpedition.targetZone;
		const boss = selected.startsWith( 'boss:' ) ? this.app.hunt?.bosses.get( selected.slice( 5 ) ) : null;
		const active = selected==='custom'?this.customTarget:boss ? { number: boss.icon, x: boss.pos.x, z: boss.pos.z } : selected === 'whale' && this.app.whale?.ready ?
			{ number: '🐋', x: this.app.whale.brain.position.x, z: this.app.whale.brain.position.z } :
			OCEAN_ZONES.find( z => z.id === this.app.marineExpedition.targetZone );
		const p = this.navigatorPosition;
		const here = chartPoint( p.x, p.z );
		const marker = this.overlay.querySelector( '.oc-vessel' );
		if ( marker ) {
			marker.style.left = `${ ( Math.min( 0.98, Math.max( 0.02, here.x ) ) * 100 ).toFixed( 2 ) }%`;
			marker.style.top = `${ ( Math.min( 0.98, Math.max( 0.02, here.y ) ) * 100 ).toFixed( 2 ) }%`;
		}
		const crewContainer = this.overlay.querySelector( '.oc-teammates' );
		if ( crewContainer ) {
			// Labels use textContent, so network nicknames cannot inject markup.
			// A maximum of three peers keeps this legible and cheap to refresh.
			crewContainer.replaceChildren();
			for ( const peer of this.app.crew?.peers.values() || [] ) {
				const xy = chartPoint( peer.root.position.x, peer.root.position.z );
				const chip = document.createElement( 'span' );
				chip.className = 'oc-teammate';
				chip.style.left = `${ ( xy.x * 100 ).toFixed( 2 ) }%`;
				chip.style.top = `${ ( xy.y * 100 ).toFixed( 2 ) }%`;
				chip.textContent = `${ [ 'boat', 'deck' ].includes( peer.mode ) ? '⛵' : '●' } ${ peer.name }`;
				crewContainer.append( chip );
			}
		}
		const whaleMarker = this.overlay.querySelector( '.oc-whale' );
		if ( whaleMarker && this.app.whale?.ready ) {
			const wp = chartPoint( this.app.whale.brain.position.x, this.app.whale.brain.position.z );
			whaleMarker.style.left = `${ ( wp.x * 100 ).toFixed( 2 ) }%`;
			whaleMarker.style.top = `${ ( wp.y * 100 ).toFixed( 2 ) }%`;
		}
		for ( const beast of SEA_TITANS ) {
			const live = this.app.hunt?.bosses.get( beast.id );
			const marker = this.overlay.querySelector( `.oc-pin[data-waypoint="boss:${ beast.id }"]` );
			if ( ! marker || ! live ) continue;
			const bp = chartPoint( live.pos.x, live.pos.z );
			marker.style.left = `${ ( bp.x * 100 ).toFixed( 2 ) }%`;
			marker.style.top = `${ ( bp.y * 100 ).toFixed( 2 ) }%`;
			marker.classList.toggle( 'is-defeated', live.health <= 0 );
		}
		if ( ! active ) return;
		const dest = chartPoint( active.x, active.z );
		const line = this.overlay.querySelector( '.oc-course' );
		if ( line ) {
			line.setAttribute( 'x1', Math.max( 0, Math.min( 1000, here.x * 1000 ) ) );
			line.setAttribute( 'y1', Math.max( 0, Math.min( 1000, here.y * 1000 ) ) );
			line.setAttribute( 'x2', dest.x * 1000 );
			line.setAttribute( 'y2', dest.y * 1000 );
		}
		const dx = active.x - p.x, dz = active.z - p.z;
		const dist = Math.round( Math.hypot( dx, dz ) );
		const bearing = ( Math.round( Math.atan2( dx, - dz ) * 180 / Math.PI ) + 360 ) % 360;
		const bearingCode = [ 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW' ][ Math.round( bearing / 45 ) % 8 ];
		const en = getLocale() === 'en';
		const rangeText = dist >= 1000 ? `${ ( dist / 1000 ).toFixed( 2 ) } km` : `${ dist } m`;
		this.overlay.querySelector( '.oc-direction' ).textContent = en ? `Waypoint ${ active.number } · ${ rangeText } · ${ bearingCode } ${ bearing }°` :
			`目标 ${ active.number } 号 · 距离 ${ rangeText } · ${ bearingCode } ${ bearing }°`;
	}

	update( dt ) {
		this.launch.hidden = ! this.available;
		this.launch.textContent = getLocale() === 'en' ? '🧭 F2 · SEA CHART' : '🧭 F2 · 航海图';

		if ( ! this.opened ) return;
		this.refresh -= dt;
		if ( this.refresh <= 0 ) { this.refresh = 0.2; this.updateMarkers(); }
	}
}
