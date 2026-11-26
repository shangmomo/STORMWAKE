import assert from 'node:assert/strict';
import { makeCoopServer } from '../server/coopServer.js';
import { TITAN_BY_ID } from '../src/oceanhunt/HuntRules.js';

const { server, listen } = makeCoopServer( { host: '127.0.0.1', port: 0 } );
const { port } = await listen();
const sockets = [];
const pause = ms => new Promise( resolve => setTimeout( resolve, ms ) );

async function connect( name ) {
 const ws = new WebSocket( `ws://127.0.0.1:${ port }/crew-ws` );
 sockets.push( ws );
 const log = [];
 ws.addEventListener( 'message', e => log.push( JSON.parse( e.data ) ) );
 await new Promise( ( resolve, reject ) => {
  ws.addEventListener( 'open', resolve, { once: true } );
  ws.addEventListener( 'error', reject, { once: true } );
 } );
 const member = { ws, log, send: m => ws.send( JSON.stringify( m ) ),
  wait: async ( type, timeout = 1600 ) => {
   const until = Date.now() + timeout;
   while ( Date.now() < until ) {
    const index = log.findIndex( m => m.type === type );
    if ( index >= 0 ) return log.splice( index, 1 )[ 0 ];
    await pause( 12 );
   }
   throw Error( `Timed out on ${ type }; received ${ JSON.stringify( log ) }` );
  } };
 await member.wait( 'welcome' ); member.send( { type: 'hello', name } );
 return member;
}

try {
 const a = await connect( '赤帆船长' ), b = await connect( '雾海船员' );
 await a.wait( 'joined' );
 const shark = TITAN_BY_ID.shark;
 a.send( { type: 'move', x: shark.x, y: 0, z: shark.z, yaw: 1, mode: 'boat', boat: 'whaler' } );
 const moving = await b.wait( 'moved' );
 assert.equal( moving.peer.boat, 'whaler' );
 const shot = { type: 'fire', weapon: 'cannon', origin: [ shark.x, 1, shark.z ], aim: [ 0, 0, 1 ] };
 a.send( shot );
 const fire = await b.wait( 'fire' );
 assert.equal( fire.weapon, 'cannon' );
 assert.equal( fire.id, moving.peer.id );
 assert.deepEqual( fire.origin, shot.origin );
 assert.deepEqual( fire.aim, shot.aim );
 assert.equal( a.log.some( m => m.type === 'fire' ), false, 'sender does not receive a duplicate local round' );
 a.send( shot );
 await pause( 70 );
 assert.equal( b.log.filter( m => m.type === 'fire' ).length, 0, 'rate limiter prevents cannon spam' );
 a.send( { ...shot, weapon: 'harpoon', origin: [ 999, 0, 999 ] } );
 await pause( 35 );
 assert.equal( b.log.filter( m => m.type === 'fire' ).length, 0, 'impossible distant muzzle rejected' );
 a.send( { type: 'attack', boss: 'shark', weapon: 'cannon' } );
 const impact = await b.wait( 'boss-hit' );
 assert.equal( impact.weapon, 'cannon', 'synchronized damage includes weapon metadata for confirmation HUD' );
 console.log( 'V14 coop: PASS remote cannon visuals via real sockets, correct ship skin, sender de-dup, cooldown, muzzle validation, server-authoritative hit feedback' );
} finally {
 for ( const ws of sockets ) if ( ws.readyState === WebSocket.OPEN ) ws.close();
 await pause( 65 );
 for ( const ws of sockets ) if ( ws.readyState !== WebSocket.CLOSED ) ws.terminate?.();
 await new Promise( resolve => server.close( resolve ) );
}
