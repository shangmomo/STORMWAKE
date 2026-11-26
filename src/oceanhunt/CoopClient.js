import {stationLocalMeters} from '../ship/StationSites.js';
import {stationHandTargets} from '../ship/StationHandRig.js';
import {SailorActivity} from '../ship/SailorActivity.js';
import {SailorBody} from '../ship/SailorBody.js';
import {Quaternion} from '../engine/index.js';
import { Group, Mesh, Vector3 } from '../engine/index.js';
import { GeoKit, box, rod, sphere, mat4 } from '../world/boat/GeoKit.js';
import { BoatModel } from '../world/BoatModel.js';
import { FLEET } from '../world/boat/FleetVariants.js';
import { RemoteWorldClock } from '../net/SharedWorldClock.js';

const palette = [ 0xa1d9b0, 0xf0cb81, 0xc7ade6, 0xe39a7b ];
const validName = s => String( s || '海上伙伴' ).replace( /[<>\r\n\x00-\x1F]/g, '' ).trim().slice( 0, 18 );

// Animated, independently articulated pirate. The old V56 avatar was one
// permanently fused mesh: even correct network poses looked like a mannequin.
function avatar( material, i ) {
 const paletteColor=palette[i%palette.length], root=new Group();root.name='CoopCrewMate';
 const captain=new Group();captain.scale.setScalar(.72);root.add(captain);
 const meshes=[];
 const part=(parent,name,geometry,color,transform)=>{
  const kit=new GeoKit();kit.add(name,geometry,{color,rough:.79,...(transform?{matrix:transform}:{})});
  const mesh=new Mesh(kit.merged(name),material);mesh.name=name;mesh.frustumCulled=false;
  meshes.push(mesh);parent.add(mesh);return mesh;
 };
 const V=(x,y,z)=>new Vector3(x,y,z);
 part(captain,'pirate coat',box(.75,.90,.48),paletteColor,mat4(0,1.2,0));
 part(captain,'belt',box(.83,.16,.52),0x382c29,mat4(0,.84,0));
 part(captain,'face',sphere(.27,11,8),0xe5b49a,mat4(0,1.91,0));
 part(captain,'pirate hat brim',box(1.03,.12,.62),0x202832,mat4(0,2.2,0));
 part(captain,'pirate hat crown',box(.72,.32,.5),0x22242d,mat4(0,2.36,0));
 part(captain,'white shirt',box(.19,.5,.035),0xe1d7c6,mat4(0,1.19,-.252));
 const legs=[],arms=[];
 for(const sign of [-1,1]){
  const leg=new Group();leg.position.set(sign*.18,.83,0);captain.add(leg);
  part(leg,'animated trouser',rod(V(0,-.10,0),V(0,-.71,0),.13,8),0x353e42);
  part(leg,'pirate boot',box(.29,.18,.40),0x252e32,mat4(0,-.75,-.06));legs.push(leg);
  const arm=new Group();arm.position.set(sign*.46,1.58,0);captain.add(arm);
  part(arm,'animated sleeve',rod(V(0,0,0),V(sign*.12,-.52,0),.14,8),paletteColor);
  part(arm,'sailor hand',sphere(.14,8,6),0xdfb29a,mat4(sign*.12,-.57,0));arms.push(arm);
 }
 return {root,captain,meshes,rig:{legs,arms},vessel:null,vesselModel:null,variant:null};
}

export class CoopClient {
	constructor( app ) {
		this.app = app;
		this.socket = null;
		this.selfId = null;
		this.peers = new Map();
		this.networkClock = 0;
		this.heartbeatClock = 0;
		this.worldClock = new RemoteWorldClock();
		this.rtt = 0;
		this._lastMovement = null;
		this.lastChat = [];
		this.status = '离线 · 点击邀请船员';
		this.name = validName( ( typeof localStorage !== 'undefined' && localStorage.getItem( 'tidewater.crew.name' ) ) || '海上伙伴' );
		this.serverAddress = ( typeof localStorage !== 'undefined' && localStorage.getItem( 'tidewater.crew.server' ) ) || '127.0.0.1:5174';
		this.launch = document.createElement( 'button' );
		this.launch.type = 'button'; this.launch.className = 'crew-launch';
		this.launch.addEventListener( 'click', () => this.open() );
		this.overlay = document.createElement( 'div' ); this.overlay.className = 'crew-overlay'; this.overlay.hidden = true;
		this.overlay.addEventListener( 'click', e => {
			const a = e.target.closest?.( '[data-crew]' )?.dataset.crew;
			if ( a === 'close' ) this.close();
			else if ( a === 'connect' ) {
				this.name = validName( this.overlay.querySelector( '[data-crew-name]' ).value );
				this.serverAddress = this.overlay.querySelector( '[data-crew-server]' ).value.trim(); this.connect();
			}
			else if ( a === 'disconnect' ) this.disconnect();
			else if ( a === 'send' ) this.sendChat();
			else if ( e.target === this.overlay ) this.close();
		} );
		this.overlay.addEventListener( 'keydown', e => {
			if ( e.code === 'Enter' && e.target.matches( '[data-crew-chat]' ) ) { e.preventDefault(); this.sendChat(); }
		} );
		document.body.append( this.launch, this.overlay );
		this.render();
		const params = new URLSearchParams( location.search );
		if ( params.has( 'room' ) ) this.serverAddress = params.get( 'room' );
		if ( params.has( 'coop' ) ) this.connect();
	}
	get connected() { return this.socket?.readyState === WebSocket.OPEN && !! this.selfId; }
	get active() { return this.socket && this.socket.readyState !== WebSocket.CLOSED && this.socket.readyState !== WebSocket.CLOSING; }
	get isHost() { return this.connected && this.app.voyageM1?.net?.hostId === this.selfId; }
	getWorldState() { return this.connected ? this.worldClock.sample() : null; }
	requestWorldControl( controls ) {
		if ( ! this.connected ) return false;
		if ( ! this.isHost ) { this.app.game?.toast?.( '只有房主可以更改房间时间' ); return false; }
		this.send( { type: 'world_control', ...controls } );
		return true;
	}

	connect() {
		if ( this.active || typeof WebSocket === 'undefined' ) return false;
		try {
			localStorage?.setItem( 'tidewater.crew.name', this.name );
			localStorage?.setItem( 'tidewater.crew.server', this.serverAddress );
		} catch { /* optional */ }
		// Players run the WebGPU page on localhost (trusted browser origin),
		// while the shared socket may target the host computer's LAN address.
		const address = this.serverAddress.replace( /^wss?:\/\//, '' ).replace( /\/.*$/, '' );
		if ( ! /^[a-zA-Z0-9.-]+:\d{2,5}$/.test( address ) ) {
			this.status = '服务器地址格式：192.168.1.20:5174'; this.render(); return false;
		}
		const path = `${ location.protocol === 'https:' ? 'wss:' : 'ws:' }//${ address }/crew-ws`;
		this.status = '正在加入船员房间…'; this.render();
		let s;
		try { s = this.socket = new WebSocket( path ); } catch ( e ) { this.status = `无法连接：${ e.message }`; this.render(); return false; }
		s.onopen = () => { this.send( { type: 'hello', name: this.name } ); this.status = '已连接，正在同步海域…'; this.render(); };
		s.onmessage = e => { let data; try { data = JSON.parse( e.data ); } catch { return; } this.receive( data ); };
		s.onerror = () => { this.status = '连接失败：请用联机启动器开启房间，再通过局域网地址进入。'; this.render(); };
		s.onclose = () => { this.app.landAdventure?.expeditionCave?.lift?.disconnectRemote();if(this.app.hunt?.abyss?.networkRaid)this.app.hunt.abyss.exit(true);this.app.hunt?.abyss?.receiveCrew({type:"abyss_members",host:null,members:{}});this.worldClock = new RemoteWorldClock(); this._lastMovement = null; this.selfId = null; this.status = '已断开连接'; this.app.hunt?.bosses.leaveRoom(); for ( const id of [ ...this.peers.keys() ] ) this.removePeer( id ); this.render(); };
		return true;
	}
	disconnect() { this.socket?.close(); this.selfId = null; this.status = '离线'; this.render(); }
	send( data ) { if ( this.socket?.readyState === WebSocket.OPEN ) this.socket.send( JSON.stringify( data ) ); }
	sendAttack( bossId, weaponId ) { if ( this.connected ) this.send( { type: 'attack', boss: bossId, weapon: weaponId } ); }
	sendFire( weaponId, start, aim ) {
		if ( ! this.connected ) return;
		const round = v => Math.round( v * 100 ) / 100;
		this.send( { type: 'fire', weapon: weaponId, origin: [ start.x, start.y, start.z ].map( round ),
			aim: [ aim.x, aim.y, aim.z ].map( round ) } );
	}
	sendChat() {
		const input = this.overlay.querySelector( '[data-crew-chat]' );
		const body = String( input?.value || '' ).replace( /[<>\r\n]/g, '' ).trim().slice( 0, 140 );
		if ( ! body || ! this.connected ) return false;
		this.send( { type: 'chat', text: body } );
		// The room server echoes to sender and peers. Do not optimistically add a
		// second local copy; otherwise every sent message appears twice.
		input.value = ''; return true;
	}

	addPeer( peer ) {
		if ( ! peer || ! peer.id || peer.id === this.selfId || peer.ready === false ) return;
		let p = this.peers.get( peer.id );
		if ( ! p ) {
			const avatarInfo = avatar( this.app.boat.materials.fittings, this.peers.size + 1 );
			this.app.scene.add( avatarInfo.root );
			p = { ...avatarInfo, id: peer.id, name: validName( peer.name ), target: new Vector3(), mode: peer.mode || 'walk', activity: 'idle', stride: 0, animationTime: 0 };
			if(typeof document!=='undefined')p.sailorBody=new SailorBody(p.root,{slot:'captain',style:this.peers.size+1});
			this.peers.set( peer.id, p );
		}
		p.name = validName( peer.name );
		p.target.set( peer.x || 0, peer.y || 0, peer.z || 0 );
		p.yaw = Number.isFinite( peer.yaw ) ? peer.yaw : 0;
		p.mode = peer.mode || 'walk';
		p.activity=peer.activity||'idle';p.gear=peer.gear||'hands';p.crouched=!!peer.crouched;p.poseHeight=peer.poseHeight||1.75;p.stationId=peer.stationId||null;p.supply=peer.supply||{};p.workAxis=peer.workAxis||0;p.deckLayer=peer.deckLayer||'deck';
		p.stride = Number.isFinite( peer.stride ) ? Math.max( 0, Math.min( 1, peer.stride ) ) : 0;
		const aboard = [ 'boat', 'deck' ].includes( p.mode );
		if ( aboard ) {
			// Build the real fleet skin only when this peer first boards; a walking
			// player doesn't allocate a 3D ship unnecessarily. The boat frame is
			// identical to the local ship, so the waterline, helm and sails line up.
			if ( !this.app.voyageM1 && ! p.vesselModel ) {
				p.vesselModel = new BoatModel();
				p.vessel = p.vesselModel.group;
				p.root.add( p.vessel );
			}
			const variant = Object.hasOwn( FLEET, peer.boat || '' ) ? peer.boat : 'corsair';
			if ( p.vesselModel && p.variant !== variant ) {
				p.vesselModel.setVariant( variant );
				p.variant = variant;
			}
			p.captain.position.set( - 0.55, 0.22, 0.27 );
		} else p.captain.position.set( 0, 0, 0 );
		if ( p.vessel ) p.vessel.visible = aboard && !this.app.voyageM1;
		if ( ! p.initialized || p.root.position.distanceToSquared( p.target ) > 10000 ) { p.root.position.copy( p.target ); p.initialized = true; }
	}
	removePeer( id ) {
		const p = this.peers.get( id ); if ( ! p ) return;
		p.sailorBody?.dispose();this.app.scene.remove( p.root );
		// BoatModel owns its shaders and its animated meshes; dispose exactly
		// once. The pirate avatar shares the local ship's fitting material.
		for ( const mesh of p.meshes ) mesh.geometry?.dispose?.();
		p.vesselModel?.dispose();
		this.peers.delete( id );
	}

	receive( msg ) {
		if ( ! msg || typeof msg !== 'object' ) return;
        if(msg.type==='mine_lift_state'){this.app.landAdventure?.expeditionCave?.lift?.receiveRemote(msg,this.app.player);return;}if(msg.type==='mine_lift_result'){const land=this.app.landAdventure;if(land?.expeditionCave?.lift)land.expeditionCave.lift.networkPending=false;if(!msg.ok)land?._message('升降机门口有人、距离不足或正在运行；请让开通道后重试。',4);return;}
        if(typeof msg.type==='string'&&msg.type.startsWith('abyss_')){this.app.hunt?.abyss?.receiveCrew(msg);return;}
		if(msg.type==='nav_target' || (msg.type==='welcome'&&msg.navigationTarget)){
			const target=msg.type==='welcome'?msg.navigationTarget:msg;
			const chart=this.app.oceanChart;
			if(chart&&target){
				if(target.id==='none')chart.clearNavigation({remote:true});
                else if(target.id==='custom')chart.setFreeTarget({x:target.x,z:target.z},{remote:true});
				else chart.select(target.id,{remote:true});
			}
			if(msg.type==='nav_target')return;
		}
		if(msg.type==='actor_pose'){const p=this.peers.get(msg.peer?.id);if(p){p.activity=msg.peer.activity;p.gear=msg.peer.gear;p.crouched=msg.peer.crouched;p.poseHeight=msg.peer.poseHeight||1.75;p.stationId=msg.peer.stationId;p.supply=msg.peer.supply;p.workAxis=msg.peer.workAxis;}return;}
		if ( msg.type === 'welcome' ) {
            this.app.hunt?.bosses.events.deserialize(msg.events);
			this.worldClock.set( msg.world );
			this.app.voyageM1?.net?.receive( msg );
		} else if ( msg.type === 'world_state' || msg.type === 'room_snapshot' ) {
			this.worldClock.set( msg.world, Date.now(), this.rtt );
			if ( msg.type === 'room_snapshot' ) {
                this.app.hunt?.bosses.events.deserialize(msg.events);
				const previousCount = this.peers.size;
				for ( const peer of msg.peers || [] ) if ( peer.id !== this.selfId ) this.addPeer( peer );
				for ( const id of [ ...this.peers.keys() ] ) if ( ! ( msg.peers || [] ).some( p => p.id === id ) ) this.removePeer( id );
				if ( msg.hostId ) this.app.voyageM1?.net?.receive( { type: 'ship_host', hostId: msg.hostId } );
				if ( previousCount !== this.peers.size ) this.render();
			}
			return;
		} else if ( msg.type === 'net_pong' ) {
			if ( Number.isFinite( msg.sentAt ) ) { this.rtt = Math.max( 0, Math.min( 3000, Date.now() - msg.sentAt ) ); this.worldClock.rtt = this.rtt; }
			return;
		}
		else if (['supply_stock','supply_personal','supply_loose','supply_notice','cannon_load_request','harbor_trade_receipt','supply_unpacked','hunt_delivery','cartographer_state','beacon_state','merchant_state','ghost_lantern_state','ghost_fleet_reset','deep_echo_state','titan_contact','titan_cut'].includes(msg.type)){this.app.voyageM1?.net?.receive(msg);return;}
        else if (msg.type.startsWith('station_') || msg.type.startsWith('ship_') || msg.type.startsWith('voyage_') || msg.type.startsWith('cargo_') || msg.type === 'economy' || msg.type === 'enemy_ship') {this.app.voyageM1?.net?.receive(msg);return;}
		if ( msg.type === 'welcome' ) {
			this.selfId = msg.id; this.networkClock = 0; this.status = `联机成功 · ${ ( msg.peers || [] ).length + 1 } / ${ msg.maxPlayers } 人`;
			this.app.hunt.bosses.networkOffset = Number.isFinite( msg.time ) ? msg.time - Date.now() : 0;
			this.app.hunt.bosses.applyServerSnapshot( msg.bosses );
			for ( const p of msg.peers || [] ) this.addPeer( p );
			this.sendMyPose( true ); this.send({type:"abyss_status"});this.send({type:"mine_lift_status"});this.render();
		} else if ( msg.type === 'joined' || msg.type === 'moved' ) {
			const previousCount=this.peers.size; this.addPeer( msg.peer ); if ( previousCount!==this.peers.size || msg.type === 'joined' ) this.render();
		} else if ( msg.type === 'left' ) { this.removePeer( msg.id ); this.render(); }
		else if ( msg.type === 'fire' && msg.id !== this.selfId ) this.app.hunt.remoteFire( msg.weapon, msg.origin, msg.aim );
		else if ( msg.type === 'boss-hit' ) {
			this.app.hunt.bosses.damage( msg.boss, 0, { source: 'server', spawn: msg.spawn, remaining: msg.hp, killer: msg.by } );
			if ( msg.by === this.selfId ) this.app.hunt.confirmHit( msg.boss, msg.weapon, msg.hp );
		}
		else if ( msg.type === 'boss-respawn' ) this.app.hunt.bosses.applyServerSnapshot( { [ msg.boss ]: { hp: msg.hp, spawn: msg.spawn } } );
		else if ( msg.type === 'boss-ai' ) this.app.hunt.bosses.applyServerAI( msg.bosses );
		else if ( msg.type === 'boss-strike' ) this.app.hunt.bosses.applyServerStrike( msg, this.selfId );
		else if ( msg.type === 'boss-telegraph' ) {
			const b = this.app.hunt.bosses.get( msg.boss );
			if ( b ) this.app.hunt.bosses.effects?.telegraph( b, msg );
			if ( msg.targetId === this.selfId ) this.app.game.toast( `⚠ ${ b?.name || '海洋巨兽' }蓄力「${ msg.skill }」！${ Number( msg.windup ).toFixed( 1 ) }秒后攻击！`, 2300 );
		}
		else if ( msg.type === 'boss-release' ) {
			const b = this.app.hunt.bosses.get( msg.boss );
			if ( b ) this.app.hunt.bosses.effects?.release( b, msg );
		}
		else if ( msg.type === 'chat' ) { this.lastChat.push( { name: validName( msg.name ), text: String( msg.text ).slice( 0, 140 ) } ); this.lastChat = this.lastChat.slice( -16 ); this.render(); }
		else if ( msg.type === 'error' ) { this.status = msg.reason === 'room_full' ? '房间已满（最多四人）' : '连接异常'; this.render(); }
	}

	open() {
		if ( this.overlay.hidden && ! this.app.oceanChart?.opened && ! this.app.shipyard?.opened && ! this.app.hunt?.opened ) {
			this.overlay.hidden = false; this.beforeInput = this.app.input.enabled; this.app.input.enabled = false;
			if ( document.pointerLockElement ) document.exitPointerLock?.(); this.render();
		}
	}
	close() {
		if ( this.overlay.hidden ) return;
		this.overlay.hidden = true; this.app.input.pressed.clear(); this.app.input.keys.clear(); this.app.input.enabled = this.beforeInput;
	}
	render() {
		this.launch.textContent = `👥 船员 ${ this.connected ? `${ this.peers.size + 1 }/4 · 同步` : '联机' }`;
		if ( this.overlay.hidden ) return;
		const escape = s => String( s ).replace( /[&<>"']/g, c => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ c ] ) );
		this.overlay.innerHTML = `<section class="crew-panel" role="dialog" aria-modal="true"><header><div><small>STORMWAKE · COOPERATIVE SEA</small><h2>👥 四人海盗船队</h2><p>同一房间共享船只、玩家动作、时间、风暴天气及巨兽战斗。房主控制昼夜，最多四人。</p></div><button data-crew="close">×</button></header><div class="crew-status">${ escape( this.status ) }</div><label>船长名字 <input data-crew-name maxlength="18" value="${ escape( this.name ) }" ${ this.connected ? 'disabled' : '' }></label><label>房间服务器 <input data-crew-server value="${ escape( this.serverAddress ) }" placeholder="192.168.1.20:5174" ${ this.active ? 'disabled' : '' }></label><div class="crew-actions"><button data-crew="connect" ${ this.active ? 'disabled' : '' }>加入 / 创建房间</button><button data-crew="disconnect" ${ ! this.active ? 'disabled' : '' }>离开房间</button></div><div class="crew-players"><b>航海者名单</b><span>${ this.connected ? escape( this.name ) + '（我）' : '离线' }</span>${ [ ...this.peers.values() ].map( p => `<span>${ escape( p.name ) } · ${ [ 'boat', 'deck' ].includes( p.mode ) && p.variant && Object.hasOwn( FLEET, p.variant ) ? escape( FLEET[ p.variant ].zh ) : '步行 / 游泳' }</span>` ).join( '' ) }</div><div class="crew-chat"><b>团队通讯</b><div class="crew-log">${ this.lastChat.map( m => `<p><strong>${ escape( m.name ) }：</strong>${ escape( m.text ) }</p>` ).join( '' ) || '<p>暂无消息。组队挑战四种海洋巨兽吧。</p>' }</div><div><input data-crew-chat maxlength="140" placeholder="发送给所有船员…" ${ this.connected ? '' : 'disabled' }><button data-crew="send" ${ this.connected ? '' : 'disabled' }>发送</button></div></div><small class="crew-hint">V60：房主通过一键启动选择创建房间，船员选择加入房间并填写房主 IPv4:5174，5174/TCP 需允许通过防火墙。两端都需要用自己的 localhost 页面运行 WebGPU；世界时钟、区域天气种子、同船动作和船体状态共享。部分单人任务与背包仍是本地进度。</small></section>`;
	}
	// Real local world-space feet transform, not the ship's origin. In deck
	// mode subtract the ship's movement to avoid walking in place while sailing.
	sendMyPose( force = false ) {
		if ( ! this.connected || this.app.hunt?.abyss?.active ) return;
		const player = this.app.player, boat = this.app.boatCtl;
		const pos = player.position;
		const now = performance.now();
		let speed = 0;
		if ( this._lastMovement ) {
			const before = this._lastMovement, elapsed = Math.max( .03, ( now - before.at ) / 1000 );
			let dx = pos.x - before.x, dz = pos.z - before.z;
			if ( player.mode === 'deck' || player.mode === 'boat' ) {
				dx -= boat.position.x - before.boatX;
				dz -= boat.position.z - before.boatZ;
			}
			speed = Math.hypot( dx, dz ) / elapsed;
		}
		this._lastMovement = { at: now, x: pos.x, z: pos.z, boatX: boat.position.x, boatZ: boat.position.z };
		const activity = this.currentActivity || (player.boardingClimb ? 'climb' : player.mode === 'swim' ? 'swim' :
			player.mode === 'boat' ? 'helm' : player.stationId ? 'station' :
			speed > 3.2 ? 'run' : speed > .19 ? 'walk' : 'idle');
		this.send( { type: 'move', x: + pos.x.toFixed( 2 ), y: + pos.y.toFixed( 2 ), z: + pos.z.toFixed( 2 ),
			yaw: + Math.atan2(Math.sin(player.mode==='deck'?boat.getYaw()+Math.PI+(player.deckYaw||0):player.yaw),Math.cos(player.mode==='deck'?boat.getYaw()+Math.PI+(player.deckYaw||0):player.yaw)).toFixed(3), mode: player.mode, deckLayer: player.mode === 'deck' ? ( player.deckLayer || 'deck' ) : null, boat: this.app.boat.variant,
			activity,gear:this.app.landAdventure?.stance?this.app.landAdventure.weaponId:(this.app.voyageM1?.equipment?.active||'hands'),crouched:!!player.crouched,poseHeight:player.poseHeight||1.75,stride: +( Math.min( 1, speed / 4.5 ) ).toFixed( 2 ) } );
	}
	update( dt ) {
        this.localActivity??=new SailorActivity();const player=this.app.player,voyage=this.app.voyageM1,velocity=player.mode==='deck'?player.deckVel:player.velocity,speed=Math.hypot(velocity?.x||0,velocity?.z||0);this.currentActivity=this.localActivity.update(dt,{player,voyage,land:this.app.landAdventure,input:this.app.input,speed});
        const gear=this.app.landAdventure?.stance?this.app.landAdventure.weaponId:(voyage?.equipment?.active||'hands');const poseKey=this.currentActivity+'/'+gear+'/'+!!player.crouched;if(this.connected&&poseKey!==this.lastPoseActivity){this.lastPoseActivity=poseKey;this.poseSeq=(this.poseSeq||0)+1;this.send({type:'actor_pose',poseSeq:this.poseSeq,activity:this.currentActivity,gear,crouched:!!player.crouched,poseHeight:player.poseHeight||1.75});}
		if ( this.connected ) {
			this.networkClock -= dt;
			if ( this.networkClock <= 0 ) { this.networkClock = .10; this.sendMyPose(); }
			this.heartbeatClock -= dt;
			if ( this.heartbeatClock <= 0 ) { this.heartbeatClock = 2; this.send( { type: 'net_ping', sentAt: Date.now() } ); }
		}
		for ( const peer of this.peers.values() ) {
            peer.root.visible=!(this.app.hunt?.abyss?.members?.[peer.id]);
			if ( this.app.voyageM1 && [ 'boat', 'deck' ].includes( peer.mode ) ) peer.captain.position.set( 0, 0, 0 );
			peer.root.position.lerp( peer.target, Math.min( 1, dt * 10 ) );
			const delta = Math.atan2( Math.sin( peer.yaw - peer.root.rotation.y ), Math.cos( peer.yaw - peer.root.rotation.y ) );
			peer.root.rotation.y += delta * Math.min( 1, dt * 9 );
            if(this.app.voyageM1?.stations&&peer.mode==='deck'){peer.stationId=this.app.voyageM1.stations.getStation(peer.id)||null;if(peer.stationId){const site=stationLocalMeters(this.app.boat,peer.stationId);if(site)this.app.boatCtl.toWorld(new Vector3(site.x,site.y,site.z),peer.root.position);const hands=stationHandTargets(this.app.boat,peer.stationId);if(hands){const target=hands[0].clone().add(hands[1]).multiplyScalar(.5).sub(peer.root.position);peer.root.rotation.y=Math.atan2(-target.x,-target.z);}}}
			if(peer.sailorBody){const body=peer.sailorBody;peer.captain.visible=!body.ready;body.root.position.copy(peer.captain.position);const boat=this.app.boatCtl;if(peer.mode==='deck'&&this.app.voyageM1){let relative=peer.root.rotation.y-boat.getYaw()-Math.PI;const targets=peer.stationId?stationHandTargets(this.app.boat,peer.stationId):null;if(targets){const inward=targets[0].clone().add(targets[1]).multiplyScalar(.5).sub(peer.root.position).applyQuaternion(boat.quaternion.clone().invert());relative=Math.atan2(inward.x,inward.z);}body.root.quaternion.copy(peer.root.quaternion).invert().multiply(boat.quaternion).multiply(new Quaternion().setFromAxisAngle({x:0,y:1,z:0},relative));}else body.root.rotation.set(peer.mode==='swim'?Math.PI/2:0,Math.PI,0);if(peer.mode==='swim')body.root.position.y+=.9;const cargo=this.app.voyageM1?.cargo.heldBy.has(peer.id);body.update(dt,{activity:peer.activity,station:peer.stationId,boat:this.app.boat,feet:peer.root.position,yaw:peer.root.rotation.y+Math.PI,gear:peer.gear,supply:peer.supply?.ammo,cargo,crouched:peer.crouched,poseHeight:peer.poseHeight,working:Math.abs(peer.workAxis||0)>.01});}
			peer.animationTime += dt * ( 3.6 + peer.stride * 7 );
			const moving = [ 'walk', 'run', 'swim', 'climb' ].includes( peer.activity );
			const swing = moving ? Math.sin( peer.animationTime ) * ( .20 + .50 * peer.stride ) : 0;
			peer.rig.legs[ 0 ].rotation.x = swing;
			peer.rig.legs[ 1 ].rotation.x = -swing;
			peer.rig.arms[ 0 ].rotation.x = -swing * .7;
			peer.rig.arms[ 1 ].rotation.x = swing * .7;
			if ( peer.activity === 'helm' ) { peer.rig.arms[ 0 ].rotation.x = -.55; peer.rig.arms[ 1 ].rotation.x = -.55; }
			if ( peer.activity === 'station' ) { peer.rig.arms[ 0 ].rotation.x = -.85; peer.rig.arms[ 1 ].rotation.x = -.85; }
			if ( peer.activity === 'climb' ) { peer.rig.arms[ 0 ].rotation.x = -1.2 + swing; peer.rig.arms[ 1 ].rotation.x = -1.2 - swing; }
			if ( peer.activity === 'swim' ) { peer.rig.arms[ 0 ].rotation.x = -1.1 + swing; peer.rig.arms[ 1 ].rotation.x = -1.1 - swing; }
		}
	}
}
