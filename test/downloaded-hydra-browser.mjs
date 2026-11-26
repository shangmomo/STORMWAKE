// Isolated Edge profile: this test never opens the player's regular browser data.
// Run against the development server with: node test/islandlife-browser.mjs http://localhost:5173
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
if ( ! existsSync( edge ) ) throw new Error( 'Microsoft Edge executable not found.' );
const base = ( process.argv[ 2 ] || 'http://localhost:5173' ).replace( /\/$/, '' );
const profile = mkdtempSync( join( tmpdir(), 'tidewater-v4-browser-' ) );
const child = spawn( edge, [ '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${ profile }`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--no-proxy-server', '--enable-unsafe-webgpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--window-size=1280,720', 'about:blank' ], { windowsHide: true, stdio: 'ignore' } );
const wait = ms => new Promise( r => setTimeout( r, ms ) );
let ws, seq = 0; const pending = new Map(), errors = [];
function call( method, params = {} ) { return new Promise( ( resolveCall, reject ) => { const id = ++ seq; pending.set( id, { resolve: resolveCall, reject } ); ws.send( JSON.stringify( { id, method, params } ) ); } ); }
async function evaluate( expression ) {
	const result = await call( 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true } );
	if ( result.exceptionDetails ) throw new Error( result.exceptionDetails.exception?.description || result.exceptionDetails.text );
	return result.result.value;
}
async function waitFor( expression, label, timeout = 12000 ) {
	const end = Date.now() + timeout;
	while ( Date.now() < end ) { try { if ( await evaluate( expression ) ) return; } catch ( e ) { if ( ! /context|navigation|Cannot find|Inspected target/i.test( e.message ) ) throw e; } await wait( 200 ); }
	const state = await evaluate( `(() => { const a=window.__islandLifeTest?.app; return a && { prompt:a.player.prompt, mode:a.player.mode, input:a.input.enabled, busy:a.player.busy, ui:a.islandLife.ui.kind, open:a.islandLife.ui.isOpen, can:a.islandLife._canInteract() }; })()` );
	throw new Error( `${ label } timed out: ${ JSON.stringify( state ) }` );
}
async function key( code, character ) {
	const keyCode = character.toUpperCase().charCodeAt( 0 );
	await call( 'Input.dispatchKeyEvent', { type: 'keyDown', code, key: character, windowsVirtualKeyCode: keyCode } );
	await wait( 180 );
	await call( 'Input.dispatchKeyEvent', { type: 'keyUp', code, key: character, windowsVirtualKeyCode: keyCode } );
	await wait( 300 );
}
async function click( selector ) {
	const ok = await evaluate( `(() => { const el=document.querySelector(${ JSON.stringify( selector ) }); if (!el || el.disabled) return false; el.click(); return true; })()` );
	if ( ! ok ) throw new Error( `Button unavailable: ${ selector }` );
	await wait( 250 );
}
async function walkUntil( expression, label, timeout = 12000 ) {
	await call( 'Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 } );
	try { await waitFor( expression, label, timeout ); }
	finally { await call( 'Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 } ); }
	await wait( 350 );
}
try {
	let port;
	for ( let i = 0; i < 100; i ++ ) { try { port = Number( readFileSync( join( profile, 'DevToolsActivePort' ), 'utf8' ).split( '\n' )[ 0 ] ); if ( port ) break; } catch {} await wait( 100 ); }
	if ( ! port ) throw new Error( 'Edge did not open its debugging port.' );
	const target = await ( await fetch( `http://127.0.0.1:${ port }/json/new?${ encodeURIComponent( `${ base }/?islandtest=1` ) }`, { method: 'PUT' } ) ).json();
	ws = new WebSocket( target.webSocketDebuggerUrl );
	await new Promise( ( ok, fail ) => { ws.addEventListener( 'open', ok, { once: true } ); ws.addEventListener( 'error', fail, { once: true } ); } );
	ws.addEventListener( 'message', event => { const m = JSON.parse( event.data ); if ( m.id && pending.has( m.id ) ) { const p = pending.get( m.id ); pending.delete( m.id ); m.error ? p.reject( new Error( m.error.message ) ) : p.resolve( m.result ); } else if ( m.method === 'Runtime.exceptionThrown' ) errors.push( m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text ); } );
	await call( 'Runtime.enable' ); await call( 'Page.enable' );
	let ready = false;
	for ( let i = 0; i < 180; i ++ ) { if ( await evaluate( 'Boolean(window.__islandLifeTest?.app?.islandLife)' ) ) { ready = true; break; } if ( i && i % 30 === 0 ) console.log( `Waiting for WebGPU scene: ${ i / 2 }s` ); await wait( 500 ); }
	if ( ! ready ) throw new Error( `Game scene did not initialize. Browser errors: ${ errors.slice( - 4 ).join( ' | ' ) }` );
	await evaluate(`document.querySelector('.tw-start-cta')?.click(); true`);
	await wait(1500); await evaluate(`window.__islandLifeTest.app.game.guide?.close(); true`);
	const moved=await evaluate(`window.__islandLifeTest.app.hunt.teleportToBoss('leviathan')`);
	if (!moved) throw new Error('Failed to teleport to hydra');
	await waitFor(`Boolean(window.__islandLifeTest.app.hunt.bosses.get('leviathan').detailReady)`, 'Hydra loads in world', 90000);
	const result = await evaluate(`(()=>{const a=window.__islandLifeTest.app,b=a.hunt.bosses.get('leviathan'),d=b.detailAsset; return {name:d?.root?.name,trueSkin:d?.trueSkin,joints:d?.skeleton?.joints,heads:d?.hydraHeads?.length,materials:d?.materials?.length,detailFailed:b.detailFailed,mode:a.player.mode};})()`);
	console.log(JSON.stringify(result));
	if(!result.trueSkin || result.joints!==90 || result.heads!==3) throw new Error('New hydra rig was not installed');
	await wait(8000);
	const shot=await call('Page.captureScreenshot',{format:'png'});writeFileSync(resolve('..','hydra-v28-world.png'),Buffer.from(shot.data,'base64'));
	if (errors.length) throw new Error(JSON.stringify(errors.slice(-5)));
	console.log('PASS real WebGPU game loaded three independently rigged heads');
} finally {
	try { if ( ws?.readyState === WebSocket.OPEN ) await call( 'Browser.close' ); } catch {}
	try { ws?.close(); } catch {}
	child.kill();
}
