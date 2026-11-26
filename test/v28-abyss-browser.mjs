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
const child = spawn( edge, [ '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${ profile }`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--no-proxy-server', '--enable-unsafe-webgpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--window-size=2438,1419', 'about:blank' ], { windowsHide: true, stdio: 'ignore' } );
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
	ws.addEventListener('message', event => { const m=JSON.parse(event.data); if(m.method==='Runtime.consoleAPICalled' && m.params.type==='error') errors.push(m.params.args.map(a=>a.value ?? a.description ?? '').join(' ')); }); await call( 'Runtime.enable' ); await call( 'Page.enable' );
	let ready = false;
	for ( let i = 0; i < 180; i ++ ) { if ( await evaluate( 'Boolean(window.__islandLifeTest?.app?.islandLife)' ) ) { ready = true; break; } if ( i && i % 30 === 0 ) console.log( `Waiting for WebGPU scene: ${ i / 2 }s` ); await wait( 500 ); }
	if ( ! ready ) throw new Error( `Game scene did not initialize. Browser errors: ${ errors.slice( - 4 ).join( ' | ' ) }` );
	await waitFor( `Boolean(window.__ui?._start && document.querySelector('.tw-start-cta'))`, 'Start screen', 60000 );
	console.log('ready start'); await click('.tw-start-cta'); console.log('clicked');
	await wait(2500);
	await evaluate(`window.__islandLifeTest.app.game.guide?.close(); window.__islandLifeTest.app.hunt.abyss.developer=true; true`);
	console.log('starting enter'); await evaluate(`window.__islandLifeTest.app.hunt.abyss.enter().then(v=>window.__abyssResult=v).catch(e=>console.error(e)); true`); await waitFor(`window.__abyssResult !== undefined`, 'enter abyss', 90000); console.log('enter', await evaluate(`window.__abyssResult`), 'scale', await evaluate(`window.__islandLifeTest.app.settings.renderScale`));
	await call('Input.dispatchKeyEvent',{type:'keyDown',code:'ControlLeft',key:'Control',windowsVirtualKeyCode:17}); await wait(3000); await call('Input.dispatchKeyEvent',{type:'keyUp',code:'ControlLeft',key:'Control',windowsVirtualKeyCode:17}); await wait(2000);
	console.log('rig-info',JSON.stringify(await evaluate(`(()=>{const r=window.__islandLifeTest.app.hunt.abyss, s=r.godAsset.skeleton, d=s.jointData; let m=0,bad=0;for(let i=0;i<s.joints*16;i++){if(!Number.isFinite(d[i]))bad++;m=Math.max(m,Math.abs(d[i]))}return {max:m,bad,original:Array.from(d.slice(0,16)), extra:Array.from(d.slice(66*16,67*16)),bounds:r.godAsset.bounds, size:r.godAsset.root.scale,cam:r.app.camera.position,sub:r.pos,god:r.godPos};})()`)));
	let shot0=await call('Page.captureScreenshot',{format:'png'}); writeFileSync(resolve('..','v28-abyss-dive.png'),Buffer.from(shot0.data,'base64'));
	await wait(25000);
	console.log('state', JSON.stringify(await evaluate(`(()=>{let a=window.__islandLifeTest.app,r=a.hunt.abyss;return {active:r.active,hull:r.hull, godHP:r.godHP, pos:r.pos,camera:a.camera?.position,mode:r.cameraMode}})()`)));
	const shot=await call('Page.captureScreenshot',{format:'png'}); writeFileSync(resolve('..','v28-abyss-hires.png'),Buffer.from(shot.data,'base64'));
	console.log('visibility', JSON.stringify(await evaluate(`(()=>{let r=window.__islandLifeTest.app.hunt.abyss;let p=r.god.worldToLocal(r.app.camera.position.clone());return {local:p,visible:r.godAsset.root.visible}})()`))); console.log('ERRORS',JSON.stringify(errors.slice(0,15))); if(errors.length) throw new Error('GPU or browser errors'); console.log('exit and restore', await evaluate(`(()=>{const a=window.__islandLifeTest.app; a.hunt.abyss.exit();return a.settings.renderScale})()`));

} finally {
	try { if ( ws?.readyState === WebSocket.OPEN ) await call( 'Browser.close' ); } catch {}
	try { ws?.close(); } catch {}
	child.kill();
}
