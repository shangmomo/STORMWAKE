import assert from 'node:assert/strict';
import { makeCoopServer } from '../server/coopServer.js';
import { parseClientFrames } from '../server/coopHub.js';
import { SEA_TITANS, HUNT_WEAPONS } from '../src/oceanhunt/HuntRules.js';
import { titanWeaponDamage } from '../src/oceanhunt/TitanAI.js';

const { server, hub, listen } = makeCoopServer( { host: '127.0.0.1', port: 0 } );
const { port } = await listen();
const url = `ws://127.0.0.1:${ port }/crew-ws`;
const sockets = [];
const pause = n => new Promise( r => setTimeout( r, n ) );

async function client() {
 const ws = new WebSocket( url ); sockets.push( ws );
 const log = [];
 ws.addEventListener( 'message', e => { try { log.push( JSON.parse( e.data ) ); } catch {} } );
 await new Promise( ( resolve, reject ) => {
  ws.addEventListener( 'open', resolve, { once: true } );
  ws.addEventListener( 'error', reject, { once: true } );
 });
 return { ws, log, send: m => ws.send( JSON.stringify( m ) ),
  wait: async ( type, check = () => true, timeout = 1800 ) => {
   const until = Date.now() + timeout;
   while ( Date.now() < until ) {
    const i = log.findIndex( m => m.type === type && check( m ) );
    if ( i !== - 1 ) return log.splice( i, 1 )[ 0 ];
    await pause( 15 );
   }
   throw new Error( `Timed out waiting for ${ type }: ${ JSON.stringify( log.slice( - 6 ) ) }` );
  } };
}

try {
 const health = await fetch( `http://127.0.0.1:${ port }/api/crew/status` ).then( r => r.json() );
 assert.equal( health.multiplayer, true );
 assert.deepEqual( health.players, 0 );
 const a = await client(); const welcomeA = await a.wait( 'welcome' );
 assert.equal( welcomeA.maxPlayers, 4 ); assert.equal( Object.keys( welcomeA.bosses ).length, 4 );
 assert.ok( Math.abs( welcomeA.time - Date.now() ) < 2000, 'server shares clock to keep giant motion aligned' );
 a.send( { type: 'hello', name: '船长甲' } );
 const b = await client(); await b.wait( 'welcome' );
 b.send( { type: 'hello', name: '船长乙' } );
 const joined = await a.wait( 'joined', m => m.peer.name === '船长乙' );
 assert.ok( joined.peer.id !== welcomeA.id );
 assert.equal( hub.size, 2 );

 const c = await client(); await c.wait( 'welcome' ); c.send( { type: 'hello', name: '船员丙' } );
 const d = await client(); await d.wait( 'welcome' ); d.send( { type: 'hello', name: '船员丁' } );
 await a.wait( 'joined', m => m.peer.name === '船员丁' );
 assert.equal( hub.size, 4, 'room supports four real simultaneous sockets' );
 const extra = await client();
 await extra.wait( 'error', m => m.reason === 'room_full' );
 assert.equal( hub.size, 4, 'fifth connection refused' );
 const remoteShark = SEA_TITANS.find( v => v.id === 'shark' );
 a.send( { type: 'move', x: remoteShark.x, y: 1, z: remoteShark.z, yaw: 1.3, mode: 'boat', boat: 'whaler' } );
 const moved = await b.wait( 'moved', m => m.peer.name === '船长甲' );
 assert.equal( moved.peer.boat, 'whaler' );
 a.send( { type: 'chat', text: '准备攻击大白鲨！' } );
 const chat = await b.wait( 'chat' ); assert.equal( chat.text, '准备攻击大白鲨！' );
 a.send( { type: 'attack', boss: 'shark', weapon: 'cannon' } );
 const first = await b.wait( 'boss-hit', m => m.boss === 'shark' );
 assert.equal( first.hp, SEA_TITANS.find( v => v.id === 'shark' ).hp - titanWeaponDamage( remoteShark, { ...HUNT_WEAPONS.cannon, id: 'cannon' } ) );
 const sameFirst = await a.wait( 'boss-hit', m => m.boss === 'shark' );
 assert.equal( sameFirst.hp, first.hp, 'the same authoritative HP reaches both clients' );
 a.send( { type: 'attack', boss: 'shark', weapon: 'cannon' } );
 await pause( 75 );
 assert.equal( hub.bosses.shark.hp, first.hp, 'server blocks cooldown cheating' );
 b.send( { type: 'attack', boss: 'leviathan', weapon: 'cannon' } );
 await pause( 40 );
 assert.equal( hub.bosses.leviathan.hp, SEA_TITANS.find( v => v.id === 'leviathan' ).hp, 'server blocks unboarded remote attacks' );
 const fresh = await fetch( `http://127.0.0.1:${ port }/api/crew/status` ).then( r => r.json() );
 assert.equal( fresh.players, 4 );
 assert.throws( () => parseClientFrames( Buffer.from( [ 0x81, 0x01, 0x20 ] ) ), /unmasked/ );
 b.ws.close(); await a.wait( 'left', m => m.id === joined.peer.id );
 console.log( 'V13 coop: PASS four simultaneous RFC6455 players, fifth refused, position sync, chat, shared boss damage, cooldown/security, leave, HTTP status' );
} finally {
 for ( const s of sockets ) if ( s.readyState === WebSocket.OPEN ) s.close();
 await pause( 65 );
 for ( const s of sockets ) if ( s.readyState !== WebSocket.CLOSED ) s.terminate?.();
 await new Promise( resolve => server.close( resolve ) );
}
