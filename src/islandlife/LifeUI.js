import { MATERIALS, RECIPES } from './IslandLifeState.js';
import { getLocale } from '../course/Localization.js';
import { toLocal } from './HomeDecorLogic.js';
import { homeName } from '../course/HomeLife.js';
import './islandlife.css';

const E = x => String( x ?? '' ).replace( /[&<>"']/g, c => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ c ] ) );
const EN_ITEMS = { shell: 'Shell', driftwood: 'Driftwood', sea_glass: 'Sea glass', chair: 'Wooden chair', table: 'Small table', shelf: 'Shelf', lamp: 'Bedside lamp', chime: 'Shell chime', frame: 'Sea-glass frame' };
const SEA_ZONES = { reef: [ '珊瑚迷宫', 'Coral labyrinth' ], deep: [ '外海深水航道', 'Outer deep channel' ], west: [ '西部失落礁群', 'Western reef' ], lagoon: [ '南部蓝湾', 'Southern blue bay' ] };
const EN_QUESTS = { shell: [ 'Beach shells', 'Collect 3 shells after accepting.' ], wood: [ 'Driftwood', 'Collect 2 pieces of driftwood after accepting.' ], glass: [ 'Sea glass', 'Collect 2 pieces of sea glass after accepting.' ], fish: [ 'Fresh catch', 'Catch 2 fish after accepting.' ], mullet: [ 'Striped mullet', 'Catch a striped mullet after accepting.' ], reef: [ 'Visit the reef', 'Reach the coral reef by boat or swimming after accepting.' ], chartReef: [ 'Map the reef', 'Sail to the coral reef and press Y to survey.' ], chartDeep: [ 'Into deep water', 'Reach the outer channel and press Y to chart.' ], chartWest: [ 'Western reefs', 'Sail west of the island and press Y to chart.' ], trawl: [ 'Trawl the shoals', 'Press N at the helm to deploy the net. Keep moving and catch two fish.' ], pot: [ 'Crab pot', 'Press O to lower a pot. Come back and press U when ready.' ], blueRunner: [ 'Blue runner', 'Catch a blue runner near the bay.' ], deepFish: [ 'Ocean bounty', 'Catch an offshore deep-water fish.' ] };

export class LifeUI {
	constructor( app, state, decor ) {
		this.app = app; this.state = state; this.decor = decor; this.isOpen = false; this.kind = ''; this.selected = null; this.movingId = null; this.slotIndex = 0; this.rotation = 0; this.message = '';
		this.root = document.createElement( 'div' ); this.root.className = 'il-overlay'; this.root.hidden = true;
		this.root.addEventListener( 'click', e => this._click( e ) ); document.body.append( this.root );
		this._key = e => { if ( this.isOpen && e.code === 'Escape' ) { e.preventDefault(); e.stopImmediatePropagation(); this.close(); } };
		window.addEventListener( 'keydown', this._key, true );
	}
	t( zh, en ) { return getLocale() === 'en' ? en : zh; }
	name( id ) { return this.t( MATERIALS[ id ] || RECIPES[ id ]?.name || id, EN_ITEMS[ id ] || id ); }
	open( kind ) {
		if ( this.isOpen || this.app.homeLife?.sleeping ) return false;
		this.kind = kind; this.isOpen = true; this.message = ''; this.selected = null; this.movingId = null; this.rotation = 0; this.slotIndex = 0;
		this.previousInput = this.app.input.enabled; this.app.input.enabled = false;
		if ( this.app.player.velocity ) { this.app.player.velocity.x = 0; this.app.player.velocity.z = 0; }
		if ( document.pointerLockElement ) document.exitPointerLock?.();
		this.root.hidden = false; this.render(); return true;
	}
	close() {
		if ( ! this.isOpen ) return;
		this.decor.hidePreview(); this.isOpen = false; this.root.hidden = true; this.root.replaceChildren();
		this.app.input.pressed.clear(); this.app.input.keys.clear();
		this.app.input.enabled = this.previousInput && ! this.app.expedition?.isOpen && ! this.app.homeLife?.sleeping;
	}
	button( label, action, id = '', disabled = false ) { return `<button type="button" data-action="${ E( action ) }" data-id="${ E( id ) }" ${ disabled ? 'disabled' : '' }>${ E( label ) }</button>`; }
	render() {
		const d = this.state.data, en = getLocale() === 'en';
		const titles = { inventory: this.t( '海岛背包', 'Island inventory' ), board: this.t( '每日委托', 'Daily requests' ), workshop: this.t( '木工坊', 'Workshop' ), decor: this.t( '布置我的家', 'Decorate my home' ) };
		let body = '';
		if ( this.kind === 'inventory' ) {
			body += `<h3>${ E( this.t( '采集材料', 'Materials' ) ) }</h3><div class="il-grid">${ Object.keys( MATERIALS ).map( k => `<div class="il-card"><strong>${ E( this.name( k ) ) }</strong><b>× ${ d.resources[ k ] }</b></div>` ).join( '' ) }</div>`;
			body += `<h3>${ E( this.t( '海洋探险装备', 'Maritime equipment' ) ) }</h3><div class="il-grid"><div class="il-card"><strong>🕸 ${ E( this.t( '船尾拖网 · N 切换', 'Trawl net · N' ) ) }</strong><b>${ E( this.t( '已装配', 'Equipped' ) ) }</b></div><div class="il-card"><strong>🦀 ${ E( this.t( '蟹笼 · O 投放 / U 回收', 'Crab pots · O / U' ) ) }</strong><b>${ d.marine.pots.length } / 2</b></div><div class="il-card"><strong>🧭 ${ E( this.t( '海图勘测 · Y', 'Charting · Y' ) ) }</strong><b>${ d.marine.surveys.length } / 4</b></div></div>`;
			body += `<h3>${ E( this.t( '航海日志 · 已勘测海域', 'Captain’s journal · surveyed waters' ) ) }</h3><div class="il-grid">${ Object.entries( SEA_ZONES ).map( ( [ key, names ] ) => `<div class="il-card"><strong>🧭 ${ E( names[ en ? 1 : 0 ] ) }</strong><b>${ d.marine.surveys.includes( key ) ? E( this.t( '已发现', 'Charted' ) ) : E( this.t( '尚未发现', 'Uncharted' ) ) }</b></div>` ).join( '' ) }</div>`;
			body += `<h3>${ E( this.t( '家具库存', 'Furniture inventory' ) ) }</h3><div class="il-grid">${ Object.keys( RECIPES ).map( k => `<div class="il-card"><strong>${ RECIPES[ k ].icon } ${ E( this.name( k ) ) }</strong><b>× ${ d.furniture[ k ] || 0 }</b></div>` ).join( '' ) }</div>`;
			const home = this.decor.getHome(), room = this.decor.currentRoom();
			if ( room && room.name !== home?.name ) {
				body += `<p>${ E( this.t( `当前位置：${ homeName( room.name ) }；你的家：${ home ? homeName( home.name ) : '尚未设置' }。`, `Current room: ${ homeName( room.name ) }; home: ${ home ? homeName( home.name ) : 'not set' }.` ) ) }</p>${ this.button( this.t( '将这间设为家并布置', 'Make this cottage home and decorate' ), 'set-home' ) }`;
			} else {
				body += `<p>${ E( room ? this.t( `当前位置：${ homeName( room.name ) }。选择家具并摆放。`, `Current room: ${ homeName( room.name ) }. Choose furniture to place.` ) : this.t( '请先进入自己的小屋，再选择家具并摆放。', 'Enter your own cottage to place furniture.' ) ) }</p>${ this.button( this.t( '布置家园', 'Decorate home' ), 'decor', '', ! this.decor.inside() ) }`;
			}
		} else if ( this.kind === 'board' ) {
			body += `<p>${ E( this.t( `第 ${ d.day } 天 · 接取后开始计算进度`, `Day ${ d.day } · Progress starts after accepting` ) ) }</p>`;
			body += `<p>${ E( this.t( '🧭 今日航海任务：出海调查、拖网捕鱼、投放蟹笼。按 Shift+J 可在码头换船。', '🧭 Sail, survey, trawl or set crab pots. Press Shift+J at the harbor to switch ships.' ) ) }</p>`;
			body += d.quests.map( q => {
				const enText = EN_QUESTS[ q.id.split( ':' )[ 1 ] ] || [ q.title, q.description ];
				return `<article class="il-quest"><strong>${ E( en ? enText[ 0 ] : q.title ) }</strong><p>${ E( en ? enText[ 1 ] : q.description ) }</p><div>${ q.progress } / ${ q.target } · 💰 $${ q.reward } ${ q.claimed ? E( this.t( '已领取', 'Claimed' ) ) : ! q.accepted ? this.button( this.t( '接取', 'Accept' ), 'accept', q.id ) : this.button( this.t( '领取奖励', 'Claim reward' ), 'claim', q.id, q.progress < q.target ) }</div></article>`;
			} ).join( '' );
		} else if ( this.kind === 'workshop' ) {
			body += `<p>${ E( this.t( '用海滩材料制作家具，成品放入背包。', 'Craft furniture from collected materials.' ) ) }</p>`;
			body += Object.entries( RECIPES ).map( ( [ id, recipe ] ) => {
				const cost = Object.entries( recipe.cost ).map( ( [ k, n ] ) => `${ this.name( k ) } ${ d.resources[ k ] }/${ n }` ).join( ' · ' );
				const enough = Object.entries( recipe.cost ).every( ( [ k, n ] ) => d.resources[ k ] >= n );
				return `<article class="il-quest"><strong>${ recipe.icon } ${ E( this.name( id ) ) }</strong><p>${ E( cost ) }</p>${ this.button( this.t( '制作', 'Craft' ), 'craft', id, ! enough ) }</article>`;
			} ).join( '' );
		} else if ( this.kind === 'decor' ) body = this._decorBody();
		this.root.innerHTML = `<section class="il-panel" role="dialog" aria-modal="true" aria-label="${ E( titles[ this.kind ] ) }"><header><div><small>${ E( this.t( '潮汐岛生活', 'ISLAND LIFE' ) ) }</small><h2>${ E( titles[ this.kind ] ) }</h2></div><button type="button" class="il-close" data-action="close" aria-label="${ E( this.t( '关闭', 'Close' ) ) }">×</button></header><div class="il-content">${ this.state.persistent ? '' : `<p class="il-warning">${ E( this.t( '本次进度仅保存在当前会话：浏览器存储不可用。', 'Storage is unavailable; progress lasts only for this session.' ) ) }</p>` }${ this.message ? `<p class="il-message">${ E( this.message ) }</p>` : '' }${ body }</div><footer>${ E( this.t( 'Esc 关闭 · 点击游戏画面恢复视角', 'Esc to close · Click the game to resume' ) ) }</footer></section>`;
	}
	_decorBody() {
		const home = this.decor.getHome(), data = this.state.data;
		if ( ! home || ! this.decor.inside() ) { this.decor.hidePreview(); return `<p>${ E( this.t( '请先在住宅床边按 G 安家，再进入自己的屋内。', 'Choose a home at a bed, then enter your cottage.' ) ) }</p>`; }
		const list = data.placements[ home.name ] || [], slots = this.decor.slots( home );
		const available = Object.keys( RECIPES ).filter( id => data.furniture[ id ] > 0 );
		if ( this.selected && ! this.movingId && ! available.includes( this.selected ) ) this.selected = null;
		let out = `<p>${ E( this.t( `家园 ${ home.name } · 只能选择不挡门、不穿墙的位置。`, `Home ${ home.name } · Slots avoid walls, furniture and the doorway.` ) ) }</p><h3>${ E( this.t( '选择背包里的家具', 'Choose furniture from inventory' ) ) }</h3><div class="il-actions">`;
		out += available.map( id => this.button( `${ RECIPES[ id ].icon } ${ this.name( id ) } ×${ data.furniture[ id ] }`, 'select', id ) ).join( '' ) || `<span>${ E( this.t( '暂无家具，请先去木工坊制作。', 'No furniture yet. Craft some at the workshop.' ) ) }</span>`;
		out += '</div>';
		if ( this.selected ) {
			const valid = slots.filter( slot => this.decor.valid( home, slot, this.selected, this.rotation, this.movingId ) );
			if ( valid.length ) {
				this.slotIndex = ( ( this.slotIndex % valid.length ) + valid.length ) % valid.length;
				const slot = valid[ this.slotIndex ]; this.previewSlot = slot.id; this.decor.showPreview( home, slot, this.selected, this.rotation );
				const dot = ( x, z, cls, title ) => `<span class="${ cls }" style="left:${ Math.max( 0, Math.min( 100, ( x / home.width + 0.5 ) * 100 ) ) }%;top:${ Math.max( 0, Math.min( 100, ( z / home.depth + 0.5 ) * 100 ) ) }%" title="${ E( title ) }"></span>`;
				const bed = toLocal( home, home.bed.x, home.bed.z );
				const occupied = list.map( p => { const s = slots.find( s => s.id === p.slotId ); return s ? dot( s.localX, s.localZ, 'il-map-item', this.name( p.itemId ) ) : ''; } ).join( '' );
				const plan = `<div class="il-floorplan" aria-label="${ E( this.t( '房屋位置示意', 'Cottage layout' ) ) }">${ dot( bed.x, bed.z, 'il-map-bed', this.t( '床', 'Bed' ) ) }${ occupied }${ dot( slot.localX, slot.localZ, 'il-map-preview', this.t( '预览', 'Preview' ) ) }<span class="il-map-door">${ E( this.t( '门', 'Door' ) ) }</span></div>`;
				out += `<div class="il-editor"><strong>${ E( this.name( this.selected ) ) } · ${ this.slotIndex + 1 }/${ valid.length } · ${ this.rotation * 90 }°</strong><p>${ E( this.t( '场景中显示浮起的预览；圆点表示位置，门在示意图下方。', 'The raised object and highlighted dot show the preview; the door is at the bottom.' ) ) }</p>${ plan }<div class="il-actions">${ this.button( this.t( '上一个位置', 'Previous slot' ), 'prev' ) }${ this.button( this.t( '下一个位置', 'Next slot' ), 'next' ) }${ this.button( this.t( '旋转 90°', 'Rotate 90°' ), 'rotate' ) }${ this.button( this.t( this.movingId ? '确认移动' : '摆放', this.movingId ? 'Move' : 'Place' ), 'place' ) }${ this.button( this.t( '取消预览', 'Cancel' ), 'cancel' ) }</div></div>`;
			} else { this.previewSlot = null; this.decor.hidePreview(); out += `<p class="il-warning">${ E( this.t( '没有可用位置，请收回其他家具或换一种家具。', 'No safe slot is available. Remove another item or choose a smaller one.' ) ) } ${ this.button( this.t( '取消', 'Cancel' ), 'cancel' ) }</p>`; }
		} else { this.previewSlot = null; this.decor.hidePreview(); }
		out += `<h3>${ E( this.t( '已摆放', 'Placed furniture' ) ) }</h3>`;
		out += list.map( p => `<div class="il-placed"><span>${ RECIPES[ p.itemId ].icon } ${ E( this.name( p.itemId ) ) }</span><div>${ this.button( this.t( '移动', 'Move' ), 'move', p.instanceId ) } ${ this.button( this.t( '收回', 'Store' ), 'remove', p.instanceId ) }</div></div>` ).join( '' ) || `<p>${ E( this.t( '还没有摆放家具。', 'No furniture placed yet.' ) ) }</p>`;
		return out;
	}
	_click( event ) {
		const b = event.target.closest( 'button[data-action]' ); if ( ! b || ! this.root.contains( b ) ) return;
		const action = b.dataset.action, id = b.dataset.id; this.message = '';
		if ( action === 'close' ) { this.close(); return; }
		if ( action === 'set-home' ) { const room = this.decor.currentRoom(); if ( room ) { this.app.homeLife.saveState.home = room.name; this.app.homeLife._save(); this.app.homeLife._render(); this.decor.dirty = true; this.decor.sync(); this.kind = 'decor'; this.selected = null; } }
		if ( action === 'decor' && this.decor.inside() ) { this.kind = 'decor'; this.selected = null; }
		if ( action === 'accept' ) this.message = this.state.accept( id ) ? this.t( '已接取，完成后回来领奖。', 'Accepted. Return to claim your reward.' ) : this.t( '无法接取。', 'Cannot accept.' );
		if ( action === 'claim' ) this.message = this.state.claim( id ) ? this.t( '奖励已存入原有金币钱包。', 'Reward added to your wallet.' ) : this.t( '尚未完成、已领取，或钱包保存失败。', 'Incomplete, already claimed, or wallet could not be saved.' );
		if ( action === 'craft' ) this.message = this.state.craft( id ) ? this.t( '制作成功，家具已放入背包。', 'Crafted and added to inventory.' ) : this.t( '材料不足。', 'Not enough materials.' );
		if ( action === 'select' && this.state.data.furniture[ id ] > 0 ) { this.selected = id; this.movingId = null; this.slotIndex = 0; this.rotation = 0; }
		if ( action === 'move' ) { const h = this.decor.getHome(), p = ( this.state.data.placements[ h?.name ] || [] ).find( p => p.instanceId === id ); if ( p ) { this.selected = p.itemId; this.movingId = p.instanceId; this.rotation = p.rotation; this.slotIndex = 0; } }
		if ( action === 'prev' ) this.slotIndex --;
		if ( action === 'next' ) this.slotIndex ++;
		if ( action === 'rotate' ) { this.rotation = ( this.rotation + 1 ) % 4; this.slotIndex = 0; }
		if ( action === 'cancel' ) { this.selected = null; this.movingId = null; }
		if ( action === 'place' ) { const ok = this.decor.place( this.selected, this.previewSlot, this.rotation, this.movingId ); this.message = ok ? this.t( '已放置。', 'Placed.' ) : this.t( '位置不可用。', 'This slot is unavailable.' ); if ( ok ) { this.selected = null; this.movingId = null; } }
		if ( action === 'remove' ) this.message = this.decor.remove( id ) ? this.t( '已收回背包。', 'Returned to inventory.' ) : this.t( '无法收回。', 'Cannot store this item.' );
		this.render();
	}
}
