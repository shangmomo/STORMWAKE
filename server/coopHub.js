import {MineLiftRoomV83} from './mineLiftRoomV83.js';
import {AbyssRoom} from './abyssRoom.js';
import {SAILOR_ACTIVITY_SET} from '../src/ship/SailorActivity.js';
import {HAUL_CARGO_SITE} from '../src/ship/ArsenalSites.js';
import {releaseSunkenCargo} from '../src/voyage/SunkenCargo.js';
import {buyHarborItem,unpackHarborSupply} from '../src/voyage/HarborTrade.js';
import {ShipInventory} from '../src/ship/ShipInventory.js';
import {SharedSupplyLedger} from '../src/ship/SharedSupplyLedger.js';
import {SharedDeckSupplies} from '../src/ship/SharedDeckSupplies.js';
import {deckSupplyAction,publishDeckSupplies,requestCannonLoad,finishCannonLoad} from './deckSupplies.js';
import {spawnMonsterSpoil,sellMonsterSpoils} from '../src/voyage/MonsterSpoils.js';
import {WorldEventDirector} from '../src/offshore/WorldEventDirector.js';
import {titanSkill} from '../src/oceanhunt/TitanAI.js';
import {waveFrontTouches,PHYSICAL_SKILLS} from '../src/oceanhunt/MonsterContacts.js';
import {outerHalfWidth} from '../src/ship/DutchHullOuterProfile.js';
import {DeepEchoQuest} from '../src/voyage/DeepEchoQuest.js';
import {GhostLanternQuest} from '../src/voyage/GhostLanternQuest.js';
import {MerchantRescueQuest} from '../src/voyage/MerchantRescueQuest.js';
import {StormBeaconQuest} from '../src/voyage/StormBeaconQuest.js';
import {CartographerQuest} from '../src/voyage/CartographerQuest.js';
import {spawnSpectralSpoils,sellSpectralSpoils} from '../src/voyage/SpectralSpoils.js';
import { createHash, randomUUID } from 'node:crypto';
import { HUNT_WEAPONS, SEA_TITANS } from '../src/oceanhunt/HuntRules.js';
import { FLEET } from '../src/world/boat/FleetVariants.js';
import { createTitanBrain, provokeTitan, stepTitanAI, titanWeaponDamage } from '../src/oceanhunt/TitanAI.js';
import { ShipStations } from '../src/ship/ShipStations.js';
import { VoyageDirector } from '../src/voyage/VoyageDirector.js';
import { Cargo } from '../src/voyage/Cargo.js';
import { canManipulateCargo } from '../src/voyage/CargoReach.js';
import {worldToShip} from '../src/voyage/CargoReach.js';
import {stationLocalMeters} from '../src/ship/StationSites.js';
import { VOYAGE_GOLD_MOSS } from '../src/voyage/VoyageDefs.js';
import { RoomClock } from '../src/net/SharedWorldClock.js';

const MAX_PLAYERS = 4;
const MAX_FRAME_BYTES = 16384;
const MODE = new Set( [ 'walk', 'swim', 'boat', 'deck' ] );
const num = ( v, max ) => typeof v === 'number' && Number.isFinite( v ) && Math.abs( v ) <= max ? v : null;
const clean = ( str, n = 22 ) => String( str || '' ).replace( /[<>\r\n\x00-\x1F]/g, '' ).trim().slice( 0, n );

function frame( body, opcode = 1 ) {
	const payload = opcode === 1 ? Buffer.from( JSON.stringify( body ) ) : Buffer.from( body );
	const header = payload.length < 126 ? Buffer.from( [ 0x80 | opcode, payload.length ] ) :
		Buffer.from( [ 0x80 | opcode, 126, ( payload.length >> 8 ) & 255, payload.length & 255 ] );
	return Buffer.concat( [ header, payload ] );
}

// Minimal RFC6455 binary framing, sufficient for bounded single-frame JSON.
// No dependencies and no eval / binary serialization of client content.
export function parseClientFrames( buffer ) {
	const frames = []; let offset = 0;
	while ( buffer.length - offset >= 2 ) {
		const first = buffer[ offset ], second = buffer[ offset + 1 ];
		if ( ( first & 0x70 ) || ! ( second & 0x80 ) ) throw Error( 'unmasked or unsupported frame' );
		let n = second & 127, start = offset + 2;
		if ( n === 126 ) { if ( buffer.length - start < 2 ) break; n = buffer.readUInt16BE( start ); start += 2; }
		else if ( n === 127 ) throw Error( 'large frames unsupported' );
		if ( n > MAX_FRAME_BYTES ) throw Error( 'frame too large' );
		if ( buffer.length < start + 4 + n ) break;
		const mask = buffer.subarray( start, start + 4 ); start += 4;
		const payload = Buffer.allocUnsafe( n );
		for ( let i = 0; i < n; i ++ ) payload[ i ] = buffer[ start + i ] ^ mask[ i & 3 ];
		frames.push( { opcode: first & 15, payload, final: !! ( first & 0x80 ) } );
		offset = start + n;
	}
	return { frames, rest: buffer.subarray( offset ) };
}

export class CoopHub {
	constructor( { now = () => Date.now() } = {} ) {
		this.now = now;
		this.players = new Map();
		this.world = new RoomClock( now() );
		this.hostId = null;
        this.abyssRoom=new AbyssRoom(this);this.mineLift=new MineLiftRoomV83(this);
		this.stations = new ShipStations();
		this.stations.onChange = (stationId,actorId)=>this.broadcast({type:'station_update',stationId,actorId});
		this.deepEcho=new DeepEchoQuest();this.ghostLantern=new GhostLanternQuest();this.merchant=new MerchantRescueQuest();this.beacon=new StormBeaconQuest();this.cartographer=new CartographerQuest();this.voyage = new VoyageDirector();
		this.cargo = new Cargo();
		this.shipState = null;
		this.sourceDoorOpen = false;
		this.navigationTarget=null;this.supplies=new SharedSupplyLedger();this.deckSupplies=new SharedDeckSupplies(this.supplies);this.pendingLoads=new Map();this.loadSequence=0;const consume=actor=>{const p=this.players.get(actor);if(!p||!this.deckSupplies.consume(actor,'plank'))return false;publishDeckSupplies(this,p);return true;};this.merchant.consumePlank=consume;this.beacon.consumePlank=consume;this.titanAttacks=new Map();this.events=new WorldEventDirector();
		this.digStart = new Map();
		this.digLast = new Map();
		this.bosses = Object.fromEntries( SEA_TITANS.map( b => [ b.id, { hp: b.hp, spawn: `${ now() }:${ b.id }`, deadUntil: 0, brain: createTitanBrain( b ) } ] ) );
		this.lastAIStep = now();
	}
	get size() { return this.players.size; }
	publicPlayer( p ) { return { id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw, mode: p.mode, deckLayer: p.deckLayer || 'deck', boat: p.boat, activity:p.activity||'idle',gear:p.gear||'hands',crouched:!!p.crouched,poseHeight:p.poseHeight||1.75,stationId:this.stations.getStation(p.id)||null,supply:{...this.deckSupplies.hand(p.id)},workAxis:this.stations.inputs.get(p.id)?.axis||0,stride: p.stride || 0, ready: !! p.ready }; }
	publicAI( brain ) { return { x: + brain.x.toFixed( 2 ), z: + brain.z.toFixed( 2 ), y:+brain.y.toFixed(2),pitch:+brain.pitch.toFixed(3),bank:+brain.bank.toFixed(3), heading: + brain.heading.toFixed( 3 ),
		state: brain.state, targetId: brain.targetId, speed: + brain.currentSpeed.toFixed( 1 ), windup: + brain.windup.toFixed( 1 ),
		attackKind: brain.attack?.kind || null, attackWindup: brain.attack?.windup || 0 }; }
	publicBosses() { return Object.fromEntries( Object.entries( this.bosses ).map( ( [ id, b ] ) => [ id, { hp: b.hp, spawn: b.spawn, ai: this.publicAI( b.brain ) } ] ) ); }
	send( p, data ) { try { if ( ! p.socket.destroyed ) p.socket.write( frame( data ) ); } catch { this.leave( p.id ); } }
	broadcast( msg, except = null ) { for ( const p of this.players.values() ) if ( p.id !== except ) this.send( p, msg ); }
	join( socket ) {
		if ( this.size >= MAX_PLAYERS ) { socket.write( frame( { type: 'error', reason: 'room_full' } ) ); socket.end(); return null; }
		const p = { id: randomUUID().slice( 0, 8 ), socket, name: '航海者', x: 69.8, y: 0, z: 36.5,
			yaw: 0, mode: 'walk', deckLayer: 'deck', boat: 'corsair', inbox: Buffer.alloc( 0 ), lastMove: 0, activity: 'idle', stride: 0, ready: false, lastAttacks: {}, lastFire: {}, joined: false, lastVoyageSeq:0, lastStationInput:0, carriedPlanks:3 };
		this.players.set( p.id, p );
		if(!this.hostId)this.hostId=p.id;
		this.send( p, { type: 'welcome',deckSupplies:this.deckSupplies.snapshot(),supplyHand:{...this.deckSupplies.hand(p.id)},inventoryRevision:this.supplies.revision,events:this.events.serialize(),deepEcho:this.deepEcho.serialize(),ghostLantern:this.ghostLantern.serialize(),merchant:this.merchant.serialize(),beacon:this.beacon.serialize(),cartographer:this.cartographer.serialize(),hostId:this.hostId,stations:this.stations.snapshot(),voyage:this.voyage.serialize(),cargo:this.cargo.serialize(),shipState:this.shipState,sourceDoorOpen:this.sourceDoorOpen,navigationTarget:this.navigationTarget, id: p.id, time: this.now(), world: this.world.snapshot( this.now() ), peers: [ ...this.players.values() ].filter( v => v !== p && v.joined && v.ready ).map( v => this.publicPlayer( v ) ),
			bosses: this.publicBosses(), maxPlayers: MAX_PLAYERS } );
		return p;
	}
	leave( id ) {
        this.abyssRoom.leave(id);this.deepEcho.disconnect(id);this.merchant.disconnect(id);this.beacon.disconnect(id);this.cartographer.disconnect(id);
		const p = this.players.get( id );
		if ( ! p ) return;
		for(const load of this.pendingLoads.values())if(load.actorId===id&&!load.detached){load.detached=this.deckSupplies.consume(id,load.kind);}
        const baseAmmo=this.supplies.stock.serialize();this.deckSupplies.disconnect(id,p.mode==='deck'&&this.shipState?worldToShip(this.shipState,p):null);publishDeckSupplies(this,null,{baseAmmo,ammo:this.supplies.stock.serialize(),inventoryRevision:this.supplies.revision});
		const held=this.cargo.heldBy.get(id);
		if(held){
		  let deck=null;const ship=this.shipState;
		  if(ship&&p.mode==='deck'&&Math.hypot(p.x-ship.x,p.z-ship.z)<16){
		    const dx=p.x-ship.x,dz=p.z-ship.z,c=Math.cos(ship.yaw),s=Math.sin(ship.yaw);
		    deck={x:c*dx-s*dz,y:p.y-ship.y,z:s*dx+c*dz};
		  }
		  this.cargo.tryDrop(id,p,deck);
		}
		this.players.delete( id );
		this.stations.releaseActor(id);
		if(held)this.broadcast({type:'cargo_update',items:this.cargo.serialize()});
		this.digStart.delete(id);this.digLast.delete(id);
		if(this.hostId===id){this.hostId=[...this.players.keys()][0]||null;this.supplies.changeHost();this.broadcast({type:'ship_host',hostId:this.hostId});for(const [requestId,load] of this.pendingLoads)this.broadcast({type:'cannon_load_request',requestId,...load});}
		if ( p.joined ) this.broadcast( { type: 'left', id } );
		try { p.socket.end(); } catch { /* disconnected */ }
	}
	handle( p, msg ) {
		if ( ! msg || typeof msg !== 'object' || Array.isArray( msg ) ) return;
		if ( msg.type === 'hello' ) {
			p.name = clean( msg.name, 18 ) || '航海者';
			if ( ! p.joined ) { p.joined = true;
				// Membership notice is not a spawn: ready=false avoids a frozen
				// placeholder sailor at the server's default port coordinate.
				this.broadcast( { type: 'joined', peer: this.publicPlayer( p ) }, p.id );
			}
			return;
		}
		if ( ! p.joined ) return;
        if(typeof msg.type==='string'&&msg.type.startsWith('mine_lift_')){this.mineLift.handle(p,msg);return;}
        if(typeof msg.type==='string'&&msg.type.startsWith('abyss_')){this.abyssRoom.handle(p,msg);return;}
		if ( msg.type === 'net_ping' ) {
			if ( Number.isFinite( msg.sentAt ) ) this.send( p, { type: 'net_pong', sentAt: msg.sentAt, serverNow: this.now() } );
			return;
		}
		if ( msg.type === 'world_control' ) {
			if ( p.id !== this.hostId ) return;
			if ( this.world.control( msg, this.now() ) ) this.broadcast( { type: 'world_state', world: this.world.snapshot( this.now() ) } );
			return;
		}
		if(this.abyssRoom.members[p.id])return;
		if (this.handleVoyage(p,msg)) return;
		if(msg.type==='actor_pose'){if(!p.ready||!Number.isSafeInteger(msg.poseSeq)||msg.poseSeq<=(p.lastPoseSeq||0)||this.now()-(p.lastPoseAt||0)<10||!SAILOR_ACTIVITY_SET.has(msg.activity))return;p.lastPoseAt=this.now();p.lastPoseSeq=msg.poseSeq;p.activity=msg.activity;p.crouched=msg.crouched===true;p.poseHeight=typeof msg.poseHeight==='number'&&Number.isFinite(msg.poseHeight)?Math.min(1.8,Math.max(.9,msg.poseHeight)):1.75;p.gear=['hands','cutlass','polearm','rod','bucket','shovel','lantern','spyglass','plank'].includes(msg.gear)?msg.gear:'hands';this.broadcast({type:'actor_pose',peer:this.publicPlayer(p),serverTick:this.now()},p.id);return;}
		if ( msg.type === 'move' ) {
			if ( p.ready && this.now() - p.lastMove < 65 ) return;
			const x = num( msg.x, 6000 ), y = num( msg.y, 800 ), z = num( msg.z, 6000 ), yaw = num( msg.yaw, 200 );
			if ( x === null || y === null || z === null || yaw === null || ! MODE.has( msg.mode ) ) return;
			const activity = SAILOR_ACTIVITY_SET.has(msg.activity) ? msg.activity : 'idle';
			const stride = num( msg.stride, 1 );
			Object.assign( p, { x, y, z, yaw, mode: msg.mode, activity, stride: stride === null ? 0 : Math.max( 0, stride ),
				gear:['hands','cutlass','polearm','rod','bucket','shovel','lantern','spyglass','plank'].includes(msg.gear)?msg.gear:'hands',crouched:msg.crouched===true,poseHeight:typeof msg.poseHeight==='number'&&Number.isFinite(msg.poseHeight)?Math.min(1.8,Math.max(.9,msg.poseHeight)):1.75,
                deckLayer: msg.mode === 'deck' && ['deck','hold','lowerHold'].includes(msg.deckLayer) ? msg.deckLayer : 'deck',
                boat: Object.hasOwn( FLEET, msg.boat || '' ) ? msg.boat : 'corsair', lastMove: this.now() } );
			p.ready = true;
			this.broadcast( { type: 'moved', peer: this.publicPlayer( p ) }, p.id );
			return;
		}
		if(msg.type==='nav_target'){
			const x=num(msg.x,6000),z=num(msg.z,6000);
			const named=typeof msg.id==='string' && /^(reef|deep|west|lagoon|outer_storm|ghost_fleet|maelstrom|whale|boss:[a-z_-]+)$/.test(msg.id);
			if(msg.id==='none')this.navigationTarget={id:'none'};
            else if(msg.id==='custom'&&x!==null&&z!==null&&x>=-4200&&x<=2500&&z>=-1100&&z<=5800)
				this.navigationTarget={id:'custom',x,z};
			else if(named)this.navigationTarget={id:msg.id};
			else return;
			this.broadcast({type:'nav_target',...this.navigationTarget});return;
		}
		if ( msg.type === 'chat' ) {
			const body = clean( msg.text, 140 );
			if ( body ) this.broadcast( { type: 'chat', id: p.id, name: p.name, text: body } );
			return;
		}
		if ( msg.type === 'fire' ) {
			const w = HUNT_WEAPONS[ msg.weapon ];
			if ( ! w?.damage || ! [ 'boat', 'deck' ].includes( p.mode ) ||
				! Array.isArray( msg.origin ) || msg.origin.length !== 3 ||
				! Array.isArray( msg.aim ) || msg.aim.length !== 3 ) return;
			const origin = msg.origin.map( n => num( n, 6000 ) ), aim = msg.aim.map( n => num( n, 1.1 ) );
			if ( [ ...origin, ...aim ].includes( null ) ) return;
			if ( Math.hypot( origin[ 0 ] - p.x, origin[ 1 ] - p.y, origin[ 2 ] - p.z ) > 18 ) return;
			if ( Math.abs( Math.hypot( ...aim ) - 1 ) > 0.14 ) return;
			const now = this.now(), last = p.lastFire[ msg.weapon ] || 0;
			if ( now - last < w.reload * 1000 * 0.76 ) return;
			p.lastFire[ msg.weapon ] = now;
			this.broadcast( { type: 'fire', id: p.id, weapon: msg.weapon, origin, aim }, p.id );
			return;
		}
		if ( msg.type === 'attack' ) {
			const definition = SEA_TITANS.find( b => b.id === msg.boss );
			const weapon = HUNT_WEAPONS[ msg.weapon ];
			if ( ! definition || ! weapon || ! weapon.damage || ! [ 'boat', 'deck' ].includes( p.mode ) ) return;
			const state = this.bosses[ definition.id ];
			if ( state.hp <= 0 ) return;
			if ( Math.hypot( p.x - definition.x, p.z - definition.z ) > definition.leash + 20 ) return;
			if ( Math.hypot( p.x - state.brain.x, p.z - state.brain.z ) > weapon.range + definition.radius + 12 ) return;
			const last = p.lastAttacks[ msg.weapon ] || 0;
			if ( this.now() - last < weapon.reload * 1000 * 0.84 ) return;
			p.lastAttacks[ msg.weapon ] = this.now();
			state.hp = Math.max( 0, state.hp - titanWeaponDamage( definition, { ...weapon, id: msg.weapon } ) );
			provokeTitan( state.brain, p.id );
			const defeated = state.hp === 0;
			if ( defeated ){state.deadUntil = this.now() + 180000;if(this.shipState?.shipClass==='heritage'){spawnMonsterSpoil(this.cargo,definition.id,state.spawn,{x:state.brain.x,z:state.brain.z},this.voyage.redeemedSpectral);this.broadcast({type:'cargo_update',items:this.cargo.serialize()});}}
			this.broadcast( { type: 'boss-hit', boss: definition.id, weapon: msg.weapon, hp: state.hp, spawn: state.spawn, by: p.id, defeated } );
			return;
		}
	}
  // V39 M1 wire protocol. Ignore invalid ownership, repeated sequence and
  // high-frequency station inputs before they reach simulation state.
  handleVoyage(p,msg) {
    const types=new Set(['supply_action','cannon_load_result','harbor_trade','titan_cut','titan_contact_host','deep_echo_action','ghost_lantern_action','ghost_lamp_hit','merchant_action','beacon_action','cartographer_action','station_claim','station_release','station_input','ship_state_host','enemy_ship_host','cannon_fire_host','voyage_event','cargo_event','ship_tool','ship_door']);
    if(!types.has(msg.type))return false;
    if(!Number.isSafeInteger(msg.seq)||msg.seq<=p.lastVoyageSeq||msg.seq>1000000000)return true;
    p.lastVoyageSeq=msg.seq;
    if(msg.type==='supply_action'){deckSupplyAction(this,p,msg);return true;}
    if(msg.type==='cannon_load_result'){finishCannonLoad(this,p,msg);return true;}
    if(msg.type==='harbor_trade'){
      if(msg.verb==='buy'){
        if(p.mode!=='walk'||Math.hypot(p.x-62,p.z+73)>4||Math.abs(p.y-1.8)>2.5||!this.shipState||Math.hypot(this.shipState.x-69.8,this.shipState.z-42)>55)return true;
        const result=buyHarborItem(this.voyage,this.cargo,msg.kind);this.deepEcho.sonarTier=this.voyage.upgrades.includes('deepSonar')?1:0;
        this.send(p,{type:'harbor_trade_receipt',...result});if(result.ok){this.broadcast({type:'economy',state:this.voyage.serialize()});this.broadcast({type:'cargo_update',items:this.cargo.serialize()});this.broadcast({type:'deep_echo_state',state:this.deepEcho.serialize()});}return true;
      }
      if(msg.verb==='unpack'){
        const item=this.cargo.get(msg.itemId);if(!item||item.origin!=='supplies'||!canManipulateCargo({player:p,ship:this.shipState,local:item.holdLocal,layer:item.holdLayer,action:'retrieve',items:this.cargo.serialize(),ignoreId:item.id}))return true;
        const stock=new ShipInventory(this.supplies.stock.serialize()),result=unpackHarborSupply(this.cargo,item.id,stock);if(result.ok){const update=this.supplies.adjust(result.contents);if(this.shipState){this.shipState.ammo={...update.ammo};this.shipState.inventoryRevision=update.inventoryRevision;}this.broadcast({type:'supply_unpacked',...update,contents:result.contents});this.broadcast({type:'cargo_update',items:this.cargo.serialize()});}return true;
      }return true;
    }
    if(msg.type==='titan_cut'){
      if(p.mode!=='deck'||this.now()<(p.cutUntil||0)||!/^Arm[0-7]$/.test(msg.bone)||!msg.direction||['x','y','z'].some(k=>num(msg.direction[k],1)===null))return true;
      const a=[...this.titanAttacks.entries()].find(([key,a])=>key.startsWith('squid:')&&a.until>=this.now()&&a.grips?.has(msg.bone));if(!a)return true;
      const point=a[1].grips.get(msg.bone),d={x:point.x-p.x,y:point.y-(p.y+.8),z:point.z-p.z},length=Math.hypot(d.x,d.y,d.z),dot=d.x*msg.direction.x+d.y*msg.direction.y+d.z*msg.direction.z;
      if(length>3||dot<length*.35)return true;p.cutUntil=this.now()+650;this.broadcast({type:'titan_cut',bone:msg.bone,actorId:p.id});return true;
    }
    if(msg.type==='titan_contact_host'){
      if(p.id!==this.hostId||this.shipState?.shipClass!=='heritage'||!msg.point||['x','y','z'].some(k=>num(msg.point[k],6000)===null))return true;
      const key=msg.boss+':'+msg.sequence,attack=this.titanAttacks.get(key),state=this.bosses[msg.boss];if(!attack||this.now()>attack.until||!state||state.hp<=0)return true;
      const bone=String(msg.bone||''),valid=msg.boss==='squid'?/^Arm[0-7]$/.test(bone):msg.boss==='leviathan'?/^Head[0-2]$/.test(bone):msg.boss==='shark'?bone==='jaw':bone==='shell';
      if(PHYSICAL_SKILLS.has(attack.kind)){if(!valid)return true;const local=worldToShip(this.shipState,msg.point);if(!local||Math.abs(local.z)>11.7||Math.abs(local.x)>outerHalfWidth(local.z)+.3||local.y< -3.5||local.y>4.5)return true;
       const reach={shark:24,turtle:26,squid:55,leviathan:90}[msg.boss];if(Math.hypot(msg.point.x-state.brain.x,msg.point.z-state.brain.z)>reach)return true;
      }else{if(bone!=='wave')return true;const expected=waveFrontTouches(attack,this.shipState,(this.now()-attack.start)/1000);if(!expected||Math.hypot(expected.x-msg.point.x,expected.y-msg.point.y,expected.z-msg.point.z)>5)return true;}
      if(attack.hits.has(bone))return true;attack.hits.add(bone);if(attack.kind==='grapple'){attack.grips||=new Map();attack.grips.set(bone,{...msg.point});}const factor=attack.kind==='grapple'?.22:attack.kind==='triple_bite'?.34:1;
      this.broadcast({type:'titan_contact',boss:msg.boss,sequence:msg.sequence,kind:attack.kind,bone,point:{...msg.point},damage:Math.round(attack.damage*factor),attackId:msg.boss+':'+state.spawn+':'+msg.sequence});return true;
    }
    if(msg.type==='deep_echo_action'){const before=this.deepEcho.phase;if(this.deepEcho.action(msg.verb,p,this.shipState,{thrust:msg.thrust,turn:msg.turn,ballast:msg.ballast,part:msg.part,x:msg.x,z:msg.z})){if(before==='return'&&this.deepEcho.phase==='completed'){this.voyage.tideCoin+=900;this.voyage.repHunt+=4;this.broadcast({type:'economy',state:this.voyage.serialize()});}this.broadcast({type:'deep_echo_state',state:this.deepEcho.serialize()});}return true;}
    if(msg.type==='ghost_lamp_hit'){if(p.id===this.hostId&&msg.a&&msg.b&&[msg.a,msg.b].every(v=>['x','y','z'].every(k=>num(v[k],6000)!==null))&&Math.hypot(msg.a.x-msg.b.x,msg.a.y-msg.b.y,msg.a.z-msg.b.z)<15){this.ghostLantern.hitSegment(msg.a,msg.b,this.shipState?.ghostFleet);this.broadcast({type:'ghost_lantern_state',state:this.ghostLantern.serialize()});}return true;}
    if(msg.type==='ghost_lantern_action'){if(msg.verb==='sea'){const q=this.ghostLantern.haul;if(p.id===this.hostId&&this.ghostLantern.phase==='haul'&&num(msg.height,10)!==null&&!q.hoistStart&&['spotted','flying','latched'].includes(q.phase))q.crate.y+=(msg.height-q.crate.y)*.4;return true;}const before=this.ghostLantern.phase;if(this.ghostLantern.action(msg.verb,p,this.shipState,{direction:msg.direction,spyglass:msg.spyglass===true,tool:msg.tool},this.shipState?.ghostFleet)){
      if(msg.verb==='accept')this.broadcast({type:'ghost_fleet_reset'});if(before==='return'&&this.ghostLantern.phase==='completed'){this.cargo.remove(this.ghostLantern.cargoId);this.voyage.tideCoin+=600;this.voyage.repHunt+=3;this.broadcast({type:'economy',state:this.voyage.serialize()});this.broadcast({type:'cargo_update',items:this.cargo.serialize()});}this.broadcast({type:'ghost_lantern_state',state:this.ghostLantern.serialize()});}return true;}
    if(msg.type==='merchant_action'){if(msg.verb==='repair'&&!this.deckSupplies.hand(p.id).planks)return true;if(['scoop','throw'].includes(msg.verb)&&!this.deckSupplies.hand(p.id).bucket)return true;if(msg.verb==='sea'){if(p.id===this.hostId&&num(msg.height,10)!==null)this.merchant.ship.y+=(msg.height-this.merchant.ship.y)*.2;return true;}const before=this.merchant.phase;if(this.merchant.action(msg.verb,p,this.shipState,{tool:msg.tool,holeId:msg.holeId})){
      if(msg.verb==='accept'){const q=this.merchant;this.cargo.spawnChest(q.cargoId,{x:q.ship.x,y:1,z:q.ship.z});Object.assign(this.cargo.get(q.cargoId),{origin:'rescue',merchantLocal:{x:.2,y:1,z:1}});this.broadcast({type:'cargo_update',items:this.cargo.serialize()});}
      if(before==='return'&&this.merchant.phase==='completed'){this.cargo.remove(this.merchant.cargoId);this.voyage.tideCoin+=420;this.voyage.repGoldTide+=2;this.broadcast({type:'economy',state:this.voyage.serialize()});this.broadcast({type:'cargo_update',items:this.cargo.serialize()});}
      this.broadcast({type:'merchant_state',state:this.merchant.serialize()});}return true;}
    if(msg.type==='beacon_action'){if(msg.verb==='repair'&&!this.deckSupplies.hand(p.id).planks)return true;const before=this.beacon.phase;if(this.beacon.action(msg.verb,p,this.shipState,{tool:msg.tool})){if(before==='return'&&this.beacon.phase==='completed'){this.voyage.tideCoin+=320;this.voyage.repLighthouse+=2;this.broadcast({type:'economy',state:this.voyage.serialize()});}this.broadcast({type:'beacon_state',state:this.beacon.serialize()});}return true;}
    if(msg.type==='cartographer_action'){
      if(msg.verb==='sea'){const q=this.cartographer;if(p.id===this.hostId&&num(msg.height,10)!==null&&!q.hoistStart&&['accepted','spotted','flying','latched'].includes(q.phase))q.crate.y+=(msg.height-q.crate.y)*.4;return true;}
      const before=this.cartographer.phase;
      if(this.cartographer.action(msg.verb,p,this.shipState,{direction:msg.direction,spyglass:msg.spyglass===true})){
        if(before==='return'&&this.cartographer.phase==='completed'){this.voyage.tideCoin+=240;this.voyage.repGoldTide+=2;this.broadcast({type:'economy',state:this.voyage.serialize()});}
        this.broadcast({type:'cartographer_state',state:this.cartographer.serialize()});
      }return true;
    }
    if(msg.type==='ship_door'){
      // An enclosed-ship door is a shared physical obstacle: sync it for all
      // peers, including a future player joining the same vessel.
      if(p.mode!=='deck'||typeof msg.open!=='boolean')return true;
      if(this.shipState&&Math.hypot(p.x-this.shipState.x,p.z-this.shipState.z)>20)return true;
      if(this.shipState?.shipClass==='heritage'){
        const local=worldToShip(this.shipState,p);
        if(!local||Math.hypot(local.x+.88,local.z+6.635)>2.0)return true;
      }
      this.sourceDoorOpen=msg.open;
      this.broadcast({type:'ship_door',open:this.sourceDoorOpen,actorId:p.id},p.id);
      return true;
    }
    const stationId=msg.stationId;
    if(msg.type.startsWith('station_')) {
      if(!this.stations.valid(stationId))return true;
      if(msg.type==='station_claim') {
        if(this.shipState?.shipClass==='heritage'){
          const local=worldToShip(this.shipState,p),site=stationLocalMeters({shipScale:{x:1,y:1,z:1},heritageDeck:true,
            heritageArt:{capstan:{rotation:{y:this.shipState.anchorCrankTurns||0}}}},stationId);
          if(p.mode!=='deck'||p.deckLayer!=='deck'||!local||!site||Math.hypot(local.x-site.x,local.z-site.z)>2.65||Math.abs(local.y-site.y)>.75){
            this.send(p,{type:'station_rejected',stationId,reason:'out_of_range'});return true;
          }
        }
        const owner=this.stations.getOccupant(stationId);
        const valid=!owner||owner.startsWith('ai:');
        if(valid){if(!this.stations.claim(stationId,p.id,{replaceAI:true}))this.send(p,{type:'station_rejected',stationId,reason:'already_assigned'});}
        else this.send(p,{type:'station_rejected',stationId,reason:'occupied'});
      }else if(msg.type==='station_release')this.stations.release(stationId,p.id);
      else {
        if(this.stations.getOccupant(stationId)!==p.id || this.now()-p.lastStationInput<30)return true;
        const axis=num(msg.axis,1),throttleAxis=msg.throttleAxis===undefined?0:num(msg.throttleAxis,1),trimAxis=msg.trimAxis===undefined?0:num(msg.trimAxis,1);if(axis===null||throttleAxis===null||trimAxis===null||!Number.isInteger(msg.buttons)||msg.buttons<0||msg.buttons>15)return true;
        p.lastStationInput=this.now();
        const aimYaw=msg.aimYaw===undefined?undefined:num(msg.aimYaw,6.3);
        const aimPitch=msg.aimPitch===undefined?undefined:num(msg.aimPitch,1.6);
        if((msg.aimYaw!==undefined&&aimYaw===null)||(msg.aimPitch!==undefined&&aimPitch===null))return true;
        if(this.shipState?.shipClass==='heritage'&&stationId.startsWith('cannon')&&(msg.buttons&2)){requestCannonLoad(this,p,stationId);msg.buttons&=~2;}
        const cmd={axis,throttleAxis,trimAxis,aimYaw,aimPitch,fire:!!(msg.buttons&1),reload:!!(msg.buttons&2),repair:!!(msg.buttons&4),bucket:!!(msg.buttons&8)};
        this.stations.setInput(stationId,p.id,cmd);
        this.broadcast({type:'station_input',stationId,actorId:p.id,axis,throttleAxis,trimAxis,aimYaw,aimPitch,buttons:msg.buttons},p.id);
      }
      return true;
    }
    if(msg.type==='ship_tool'){
      if(!['bail','douse','patch'].includes(msg.verb)||p.mode!=='deck'||!this.shipState)return true;
      if(msg.verb==='patch'&&(!/^[a-zA-Z0-9_-]{1,48}$/.test(msg.holeId||'')||p.carriedPlanks<=0))return true;
      if(this.shipState.shipClass==='heritage'){if(['bail','douse'].includes(msg.verb)&&!this.deckSupplies.hand(p.id).bucket)return true;if(msg.verb==='patch'){const hole=this.shipState.holes?.find(h=>h.id===msg.holeId&&h.state==='open'),local=worldToShip(this.shipState,p);if(!hole||!local||Math.hypot(local.x-hole.local.x,local.y-hole.local.y,local.z-hole.local.z)>1.9)return true;}}
      if(Math.hypot(p.x-this.shipState.x,p.z-this.shipState.z)>22)return true;
      const now=this.now();
      if(now-(p.lastToolAction||0)<330)return true;
      if(msg.verb==='patch'&&now-(p.lastPatch||0)<2100)return true;
      p.lastToolAction=now;if(msg.verb==='patch'){p.lastPatch=now;if(this.shipState.shipClass==='heritage'){if(!this.deckSupplies.consume(p.id,'plank'))return true;publishDeckSupplies(this,p);}else p.carriedPlanks--;}
      this.broadcast({type:'ship_tool',actorId:p.id,verb:msg.verb,holeId:msg.verb==='patch'?msg.holeId:undefined},p.id);return true;
    }
    if(msg.type==='ship_state_host') {
      if(p.id!==this.hostId)return true;
      const keys=['x','y','z','yaw','vx','vz','sailMain','sailJib','integrity','breach','fire'];
      if(msg.rotation!==undefined&&(!msg.rotation||['x','y','z','w'].some(k=>num(msg.rotation[k],1)===null)||Math.abs(Math.hypot(msg.rotation.x,msg.rotation.y,msg.rotation.z,msg.rotation.w)-1)>.01))return true;
      if(msg.vy!==undefined&&num(msg.vy,120)===null)return true;
      if(msg.angular!==undefined&&(!msg.angular||['x','y','z'].some(k=>num(msg.angular[k],20)===null)))return true;
      if(msg.sailTrim!==undefined&&num(msg.sailTrim,1)===null)return true;
      if(msg.water!==undefined&&(num(msg.water,1)===null||msg.water<0))return true;
      if(msg.bilgeSections!==undefined&&(!msg.bilgeSections||['stern','mid','bow'].some(k=>!Number.isFinite(msg.bilgeSections[k])||msg.bilgeSections[k]<0||msg.bilgeSections[k]>1)))return true;
      if(msg.anchorTravel!==undefined&&(num(msg.anchorTravel,1)===null||msg.anchorTravel<0))return true;
      if(msg.anchorCrankTurns!==undefined&&num(msg.anchorCrankTurns,100000)===null)return true;
      if(msg.anchorHands!==undefined&&(!Number.isInteger(msg.anchorHands)||msg.anchorHands<0||msg.anchorHands>4))return true;
      if(msg.anchorState!==undefined&&!['STOWED','NO_BOTTOM_CONTACT','HOLDING','DRAGGING'].includes(msg.anchorState))return true;
      if(msg.anchorTension!==undefined&&(num(msg.anchorTension,10000000)===null||msg.anchorTension<0))return true;
      if(msg.ghostFleet!==undefined&&(!Array.isArray(msg.ghostFleet)||msg.ghostFleet.length!==10||new Set(msg.ghostFleet.map(s=>s?.id)).size!==10||msg.ghostFleet.some(s=>!s||!/^v44_ghost_[0-9]$/.test(s.id)||['x','z'].some(k=>num(s[k],6000)===null)||['yaw','vx','vz','turnRate','cooldown','shots'].some(k=>num(s[k],100000)===null)||num(s.hp,210)===null||s.hp<0||!['patrol','engage','flee','sink'].includes(s.state)||!Number.isInteger(s.target)||s.target<0||s.target>1||num(s.rigDamage,1)===null||s.rigDamage<0||['heave','pitch','roll'].some(k=>s[k]!==undefined&&num(s[k],k==='heave'?10:1.6)===null))))return true;
      if(msg.anchorTether!==undefined){const a=msg.anchorTether;
        if(!a||!['STOWED','NO_BOTTOM_CONTACT','HOLDING','DRAGGING'].includes(a.state)||!Number.isFinite(a.chain)||a.chain<0||a.chain>34||num(a.tension,10000000)===null||a.tension<0||
          (a.depth!==null&&(!Number.isFinite(a.depth)||a.depth<0||a.depth>10000))||
          (a.point!==null&&(!a.point||['x','z'].some(k=>num(a.point[k],6000)===null))))return true;
      }
      if(msg.repairStock!==undefined&&(!Number.isInteger(msg.repairStock)||msg.repairStock<0||msg.repairStock>999))return true;
      if(msg.helmThrottle!==undefined && num(msg.helmThrottle,1)===null)return true;
      if(msg.rudder!==undefined&&num(msg.rudder,1)===null)return true;
      if(msg.ammo!==undefined && (!msg.ammo||!['cannonball','chainshot','plank'].every(k=>Number.isInteger(msg.ammo[k])&&msg.ammo[k]>=0&&msg.ammo[k]<=999)))return true;
      if(msg.holes!==undefined && (!Array.isArray(msg.holes)||msg.holes.length>32||msg.holes.some(h=>!h||typeof h.id!=='string'||!/^hole_[0-9]{1,5}$/.test(h.id)||!h.local||['x','y','z'].some(k=>num(h.local[k],k==='z'&&msg.shipClass==='heritage'?12:6)===null)||num(h.radius,1)===null||h.radius<=0||!['open','sealed'].includes(h.state))))return true;
      if(msg.crew!==undefined && (!Array.isArray(msg.crew)||msg.crew.length>3||msg.crew.some(c=>!c||!['ai:kael','ai:mei','ai:rowan'].includes(c.id)||['x','y','z','yaw'].some(k=>num(c[k],10)===null)||typeof c.job!=='string'||c.job.length>32)))return true;
      if(msg.cannons!==undefined&&(!msg.cannons||['cannon_port','cannon_starboard'].some(id=>!msg.cannons[id]||!['EMPTY','READY','RECOIL','LOADING'].includes(msg.cannons[id].phase)||num(msg.cannons[id].loadRemaining,5)===null)))return true;
      if(keys.some(k=>typeof msg[k]!=='number'||!Number.isFinite(msg[k])))return true;
      if(Math.abs(msg.x)>6000||Math.abs(msg.z)>6000||Math.abs(msg.y)>800||Math.abs(msg.vx)>120||Math.abs(msg.vz)>120||
        Math.abs(msg.yaw)>10000||msg.sailMain<0||msg.sailMain>1||msg.sailJib<0||msg.sailJib>1||
        msg.integrity<0||msg.integrity>100||msg.breach<0||msg.breach>1||msg.fire<0||msg.fire>1||typeof msg.anchor!=='boolean')return true;
      if(msg.floodCollapse!==undefined&&(num(msg.floodCollapse,1)===null||msg.floodCollapse<0))return true;
      if(msg.inventoryRevision!==undefined&&(!Number.isSafeInteger(msg.inventoryRevision)||msg.inventoryRevision<0||msg.inventoryRevision>this.supplies.revision))return true;const sharedAmmo=msg.ammo?this.supplies.acceptHost(msg.ammo,msg.inventoryRevision||0):null;
      this.shipState={type:'ship_state',inventoryRevision:this.supplies.revision,...Object.fromEntries(keys.map(k=>[k,msg[k]])),helmThrottle:msg.helmThrottle??.35,rudder:msg.rudder??0,sailTrim:msg.sailTrim??0,water:msg.water??0,bilgeSections:msg.bilgeSections||null,anchorTravel:msg.anchorTravel??0,anchorCrankTurns:msg.anchorCrankTurns??0,anchorHands:msg.anchorHands??0,anchorState:msg.anchorState??'STOWED',anchorTension:msg.anchorTension??0,repairStock:msg.repairStock??12,ammo:sharedAmmo,holes:msg.holes||[],crew:msg.crew||[],cannons:msg.cannons||null,anchor:msg.anchor,hostId:this.hostId};
      // Old hull protocols remain readable; current Dutch rooms advertise the
      // geometry frame so claims can be validated against the actual stations.
      if(msg.shipClass==='heritage')this.shipState.shipClass='heritage';
      if(msg.rotation)this.shipState.rotation={...msg.rotation};
      if(msg.angular)this.shipState.angular={...msg.angular};
      if(msg.vy!==undefined)this.shipState.vy=msg.vy;if(msg.floodCollapse!==undefined)this.shipState.floodCollapse=msg.floodCollapse;
      if((this.shipState.integrity<=0||this.shipState.water>=.98)&&releaseSunkenCargo(this.cargo,this.shipState))this.broadcast({type:'cargo_update',items:this.cargo.serialize()});
      if(msg.anchorTether){const a=msg.anchorTether;this.shipState.anchorTether={state:a.state,chain:a.chain,depth:a.depth,tension:a.tension,point:a.point?{x:a.point.x,z:a.point.z}:null};}
      if(msg.ghostFleet)this.shipState.ghostFleet=msg.ghostFleet.map(s=>Object.fromEntries(['id','x','z','heave','pitch','roll','yaw','hp','state','vx','vz','turnRate','cooldown','target','shots','rigDamage'].map(k=>[k,s[k]])));
      if(msg.ghostFleet&&spawnSpectralSpoils(this.cargo,msg.ghostFleet,this.voyage.redeemedSpectral))this.broadcast({type:'cargo_update',items:this.cargo.serialize()});
      this.broadcast(this.shipState,p.id);return true;
    }
    if(msg.type==='cannon_fire_host'){
      if(p.id!==this.hostId)return true;
      const shot={};for(const k of ['x','y','z','vx','vy','vz']){
        shot[k]=num(msg[k],k.startsWith('v')?130:6000);
        if(shot[k]===null)return true;
      }
      if(Math.hypot(shot.vx,shot.vy,shot.vz)>130)return true;
      if(this.shipState&&Math.hypot(shot.x-this.shipState.x,shot.z-this.shipState.z)>15)return true;
      this.broadcast({type:'cannon_fire',...shot,source:msg.source==='enemy'?'enemy':'player',ammoType:msg.ammoType==='chainshot'?'chainshot':'cannonball'},p.id);
      return true;
    }
    if(msg.type==='enemy_ship_host') {
      if(p.id!==this.hostId)return true;
      const {x,z,yaw,hp,state}=msg;
      if([x,z,yaw,hp].some(v=>typeof v!=='number'||!Number.isFinite(v))||Math.abs(x)>6000||Math.abs(z)>6000||hp<0||hp>100||!['patrol','engage','flee','sink'].includes(state))return true;
      this.broadcast({type:'enemy_ship',id:'gunboat_1',x,z,yaw,hp,state},p.id);return true;
    }
    if(msg.type==='voyage_event') {
      if(msg.voyageId!==VOYAGE_GOLD_MOSS.id)return true;
      if(msg.verb==='sell_spectral'){
        if(p.mode==='walk'&&Math.hypot(p.x-56,p.z+71)<5&&this.shipState&&Math.hypot(this.shipState.x-69.8,this.shipState.z-42)<55){sellSpectralSpoils(this.cargo,this.voyage);const hunt=sellMonsterSpoils(this.cargo,this.voyage);if(hunt.count)this.broadcast({type:'hunt_delivery',receipts:hunt.receipts});this.broadcast({type:'cargo_update',items:this.cargo.serialize()});this.broadcast({type:'economy',state:this.voyage.serialize()});}
      }else if(msg.verb==='accept'){
        if(this.voyage.accept()){
          this.digStart.clear();this.digLast.clear();
          this.cargo.remove('chest_moss_01');
          this.broadcast({type:'voyage_state',state:this.voyage.serialize()});
          this.broadcast({type:'cargo_update',items:this.cargo.serialize()});
        }
      }else if(msg.verb==='dig_cancel'){
        this.digStart.delete(p.id);this.digLast.delete(p.id);
      }else if(msg.verb==='dig_progress'){
        const point={x:-176,z:-42};
        if(this.voyage.phase!=='accepted'||p.mode!=='walk'||Math.hypot(p.x-point.x,p.z-point.z)>8){this.digStart.delete(p.id);this.digLast.delete(p.id);return true;}
        const now=this.now(),last=this.digLast.get(p.id);
        // A complete 4-second hold requires an uninterrupted stream of progress events.
        // Leaving, releasing E or starving the network resets progress.
        if(last===undefined || now-last>450){this.digStart.set(p.id,now);}
        this.digLast.set(p.id,now);
        if(now-this.digStart.get(p.id)>=4000&&this.voyage.digDone()){
          this.cargo.spawnChest('chest_moss_01',{x:point.x,y:0,z:point.z});
          this.broadcast({type:'voyage_state',state:this.voyage.serialize()});
          this.broadcast({type:'cargo_spawn',itemId:'chest_moss_01',x:point.x,y:0,z:point.z});
        }
      }else if(msg.verb==='sell'){
        const hold=this.cargo.listShipHold('stormwake'),chest=hold.find(item=>!item.origin);
        const ship=this.shipState;
        if(chest&&Math.hypot(p.x-56,p.z+71)<8&&ship&&Math.hypot(ship.x-69.8,ship.z-36.5)<55&&this.voyage.sell(chest.id)){
          this.cargo.remove(chest.id);
          this.broadcast({type:'cargo_despawn',itemId:chest.id});
          this.broadcast({type:'economy',id:p.id,state:this.voyage.serialize()});
          this.broadcast({type:'voyage_state',state:this.voyage.serialize()});
        }
      }
      return true;
    }
    if(msg.type==='cargo_event'){
      const itemId=String(msg.itemId||'').slice(0,80);
      // A dropped cargo item on deck retains a *ship-local* transform. Before
      // validating another player's pickup, update its world range coordinates
      // from the latest authoritative hull pose. This survives a moving ship.
      const ship=this.shipState;const item=this.cargo.get(itemId);
      if(item?.onDeck&&item.deckLocal&&ship){
        const c=Math.cos(ship.yaw),s=Math.sin(ship.yaw),local=item.deckLocal;
        item.x=ship.x+c*local.x+s*local.z;
        item.z=ship.z-s*local.x+c*local.z;
        item.y=ship.y+(local.y||0);
      }
      if(msg.verb==='pick')this.cargo.tryPick(p.id,itemId,p);
      if(msg.verb==='drop'&&Number.isFinite(p.x)&&Number.isFinite(p.z)){
        let deck=null;
        if(p.mode==='deck'&&ship&&Math.hypot(p.x-ship.x,p.z-ship.z)<15){
          const dx=p.x-ship.x,dz=p.z-ship.z,c=Math.cos(ship.yaw),s=Math.sin(ship.yaw);
          deck={x:c*dx-s*dz,y:p.y-ship.y,z:s*dx+c*dz};
        }
        this.cargo.tryDrop(p.id,p,deck);
      }
      if(['stow','retrieve'].includes(msg.verb)&&ship){
        const slot=msg.verb==='retrieve'?item?.holdLocal:msg.holdLocal;
        const layer=msg.verb==='retrieve'?item?.holdLayer:msg.holdLayer;
        const valid=canManipulateCargo({player:p,ship,local:slot,layer,
          items:this.cargo.items.values(),ignoreId:msg.verb==='retrieve'?itemId:this.cargo.heldBy.get(p.id),action:msg.verb});
        if(valid){
          if(msg.verb==='stow'){
            const heldId=this.cargo.heldBy.get(p.id);
            if(heldId&&(!itemId||heldId===itemId)&&this.cargo.tryStow(p.id,'stormwake',slot)){
              this.cargo.get(heldId).holdLayer=layer;
              if(!this.cargo.get(heldId)?.origin)this.voyage.stow();
            }
          }else if(item&&item.state==='hold'&&this.cargo.tryRetrieve(p.id,itemId,'stormwake')){
            // A chest stays in the same actor's hands until it is dropped or restowed.
          }
        }else this.send(p,{type:'cargo_rejected',reason:'out_of_reach'});
      }
      this.broadcast({type:'cargo_update',items:this.cargo.serialize()});
      this.broadcast({type:'voyage_state',state:this.voyage.serialize()});
      return true;
    }
    return true;
  }

	ping() {
		const dt = Math.max( 0, Math.min( 1.5, ( this.now() - this.lastAIStep ) / 1000 ) );
		this.lastAIStep = this.now();this.mineLift.step(dt);
        const advance=(quest,...args)=>{for(let t=0;t<dt;t+=.05)quest.update(Math.min(.05,dt-t),...args);};
        this.deepEcho.unlock(this.cartographer,this.merchant,this.ghostLantern);advance(this.deepEcho,this.shipState);if(this.deepEcho.phase!=='locked')this.broadcast({type:'deep_echo_state',state:this.deepEcho.serialize()});
        const ghostBefore=this.ghostLantern.phase;advance(this.ghostLantern,this.shipState,this.cargo);
        if(ghostBefore==='haul'&&this.ghostLantern.phase==='defend'&&this.shipState){const id=this.ghostLantern.cargoId;this.cargo.spawnChest(id,{x:this.shipState.x,y:this.shipState.y+1,z:this.shipState.z});Object.assign(this.cargo.get(id),{origin:'ghostMission',onDeck:true,deckLocal:{...HAUL_CARGO_SITE}});this.broadcast({type:'cargo_update',items:this.cargo.serialize()});}
        if(!['offer','completed'].includes(this.ghostLantern.phase))this.broadcast({type:'ghost_lantern_state',state:this.ghostLantern.serialize()});
        advance(this.merchant,this.shipState,this.cargo);if(!['offer','completed'].includes(this.merchant.phase))this.broadcast({type:'merchant_state',state:this.merchant.serialize()});advance(this.beacon,this.shipState);if(!['offer','completed'].includes(this.beacon.phase))this.broadcast({type:'beacon_state',state:this.beacon.serialize()});advance(this.cartographer,this.shipState);
        if(!['offer','completed'].includes(this.cartographer.phase))this.broadcast({type:'cartographer_state',state:this.cartographer.serialize()});
		const players = [ ...this.players.values() ].filter( p => p.joined && p.ready && !this.abyssRoom.members[p.id] ).map( p => ( {
			id: p.id, y:this.shipState?.shipClass==='heritage'&&['boat','deck'].includes(p.mode)?(this.shipState.y||0):p.y, x: this.shipState?.shipClass==='heritage'&&['boat','deck'].includes(p.mode)?this.shipState.x:p.x, z: this.shipState?.shipClass==='heritage'&&['boat','deck'].includes(p.mode)?this.shipState.z:p.z, mode: p.mode,shipClass:this.shipState?.shipClass||'legacy', noise: p.mode === 'boat' ? 0.55 : 0.15,
		} ) );
		for(const [key,a] of this.titanAttacks)if(a.until<this.now())this.titanAttacks.delete(key);
		const positions = {};if(this.shipState?.shipClass==='heritage')this.events.update(dt,{ship:this.shipState,integrity:this.shipState.integrity,water:this.shipState.water||0,crew:players.length,candidates:Object.entries(this.bosses).map(([id,b])=>({id,x:b.brain.x,z:b.brain.z,hp:b.hp}))});
		for ( const [ id, state ] of Object.entries( this.bosses ) ) {
			const def = SEA_TITANS.find( b => b.id === id );
			if ( state.hp <= 0 ) {
				if ( state.deadUntil && this.now() >= state.deadUntil ) {
					for(const key of this.titanAttacks.keys())if(key.startsWith(id+':'))this.titanAttacks.delete(key);
					Object.assign( state, { hp: def.hp, deadUntil: 0, spawn: `${ this.now() }:${ id }`, brain: createTitanBrain( def ) } );
					this.broadcast( { type: 'boss-respawn', boss: id, hp: state.hp, spawn: state.spawn } );
				}
				continue;
			}
			for ( const event of stepTitanAI( def, state.brain, players, dt, state.hp / def.hp ) ) {
				// Spread the AI payload FIRST. Otherwise event.type overwrites the
				// wire-protocol name, silently dropping attack effects and hull hits
				// on every network client.
				if ( event.type === 'telegraph' ) this.broadcast( { ...event, type: 'boss-telegraph', boss: id } );
				if ( event.type === 'release' ) {if(this.shipState?.shipClass==='heritage'){const skill=titanSkill(def,event.sequence,state.hp/def.hp<=.5);this.titanAttacks.set(id+':'+event.sequence,{kind:event.kind,damage:event.damage??skill.damage,radius:event.radius,x:event.x??state.brain.x,z:event.z??state.brain.z,y:event.y??state.brain.y,start:this.now(),until:this.now()+7000,hits:new Set()});}this.broadcast( { ...event, type: 'boss-release', boss: id } );}
				if ( event.type === 'strike' && this.shipState?.shipClass!=='heritage' ) this.broadcast( { ...event, type: 'boss-strike', boss: id } );
			}
			positions[ id ] = this.publicAI( state.brain );
		}
		this.broadcast( { type: 'boss-ai', bosses: positions } );
		// Periodic keyframes heal dropped pose updates and keep all sailors +
		// weather on one authoritative room timeline, including late joiners.
		this.broadcast( { type: 'room_snapshot', hostId: this.hostId,events:this.events.serialize(),
			peers: [ ...this.players.values() ].filter( p => p.joined && p.ready ).map( p => this.publicPlayer( p ) ),
			world: this.world.snapshot( this.now() ) } );
	}
	attach( httpServer ) {
		httpServer.on( 'upgrade', ( req, socket, head ) => {
			if ( new URL( req.url || '/', 'http://localhost' ).pathname !== '/crew-ws' ) return;
			const key = req.headers[ 'sec-websocket-key' ];
			if ( ! key || ! /^[A-Za-z0-9+/]{22}==$/.test( key ) || req.headers[ 'sec-websocket-version' ] !== '13' ) {
				socket.write( 'HTTP/1.1 400 Bad Request\r\n\r\n' ); socket.destroy(); return;
			}
			const accept = createHash( 'sha1' ).update( key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11' ).digest( 'base64' );
			socket.write( `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${ accept }\r\n\r\n` );
			const p = this.join( socket );
			if ( ! p ) return;
			const receive = chunk => {
				try {
					p.inbox = Buffer.concat( [ p.inbox, chunk ] );
					if ( p.inbox.length > MAX_FRAME_BYTES * 2 ) throw Error( 'inbox overflow' );
					const parsed = parseClientFrames( p.inbox ); p.inbox = parsed.rest;
					for ( const f of parsed.frames ) {
						if ( ! f.final ) throw Error( 'fragmentation disabled' );
						if ( f.opcode === 8 ) { this.leave( p.id ); return; }
						if ( f.opcode === 9 ) { socket.write( frame( f.payload, 10 ) ); continue; }
						if ( f.opcode !== 1 ) continue;
						try { this.handle( p, JSON.parse( f.payload.toString( 'utf8' ) ) ); } catch { /* bad JSON ignored */ }
					}
				} catch { socket.destroy(); this.leave( p.id ); }
			};
			socket.on( 'data', receive );
			socket.on( 'close', () => this.leave( p.id ) );
			socket.on( 'error', () => this.leave( p.id ) );
			if ( head.length ) receive( head );
		} );
		const interval = setInterval( () => this.ping(), 100 );
		interval.unref?.();
		return this;
	}
}

export function createCoopHub( opts ) { return new CoopHub( opts ); }
