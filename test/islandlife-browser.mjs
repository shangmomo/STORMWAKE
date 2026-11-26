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
	console.log( 'Browser game initialized:', JSON.stringify( await evaluate( `(() => { const a=window.__islandLifeTest.app; return {gpu:!!navigator.gpu, resources:a.islandLife.collectibles.points.length, homeCount:a.village.homes.length, actor:!!a.companionActor}; })()` ) ) );
	for ( let i = 0; i < 80 && ! await evaluate( `Boolean(window.__ui?._start && document.querySelector('.tw-start-cta'))` ); i ++ ) await wait( 250 );
	await evaluate( `document.querySelector('.tw-start-cta')?.click(); true` );
	await wait( 1500 );
	await waitFor( `Boolean(window.__islandLifeTest.app.game.guide?.open)`, 'First-play guide' );
	await click( '.gm-guide-skip' );
	console.log( 'Play state:', JSON.stringify( await evaluate( `(() => { const a=window.__islandLifeTest.app; return {starting:window.__ui._start, canInteract:a.islandLife._canInteract(), mode:a.player.mode, input:a.input.enabled, gameUI:!!a.game.hud}; })()` ) ) );
	const adapter = await evaluate( `(async () => { const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'}); const i=adapter?.info; return i ? {vendor:i.vendor,architecture:i.architecture,device:i.device,description:i.description} : null; })()` );
	console.log( 'WebGPU adapter:', JSON.stringify( adapter ) );
	const startPos = await evaluate( `(() => { const p=window.__islandLifeTest.app.player.position; return {x:p.x,z:p.z}; })()` );
	await call( 'Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 } ); await wait( 1000 );
	await call( 'Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyW', key: 'w', windowsVirtualKeyCode: 87 } ); await wait( 250 );
	const moved = await evaluate( `(() => { const p=window.__islandLifeTest.app.player.position; return Math.hypot(p.x-(${ startPos.x }),p.z-(${ startPos.z })); })()` );
	if ( moved < 0.15 ) throw new Error( `WASD movement did not respond: ${ moved }m` );
	console.log( `Player walked ${ moved.toFixed( 2 ) }m using W` );
	// Repositioning keeps this smoke check short; all E/B/G interactions and UI
	// transactions below run through the game's normal browser event handlers.
	await evaluate( `window.__v4place=(x,y,z,yaw=0)=>{const a=window.__islandLifeTest.app,p=a.player;p.mode='walk';p.position.set(x,y,z);p.velocity.set(0,0,0);p.yaw=yaw;p._camY=null;a.input.keys.clear();a.input.pressed.clear();}; true` );
	await evaluate( `(() => { const a=window.__islandLifeTest.app,b=a.islandLife.board; window.__v4place(b.x-1.2,b.y,b.z,-Math.PI/2); return true; })()` );
	await wait( 700 ); await key( 'KeyE', 'e' );
	await waitFor( `window.__islandLifeTest.app.islandLife.ui.isOpen && window.__islandLifeTest.app.islandLife.ui.kind==='board'`, 'Quest board' );
	const out = resolve( '..', '.v4-artifacts' ); mkdirSync( out, { recursive: true } );
	writeFileSync( join( out, 'browser-board.png' ), Buffer.from( ( await call( 'Page.captureScreenshot', { format: 'png' } ) ).data, 'base64' ) );
	await click( 'button[data-action="accept"][data-id="1:shell"]' );
	await click( 'button[data-action="close"]' );
	for ( let i = 0; i < 3; i ++ ) {
		const placed = await evaluate( `(() => { const a=window.__islandLifeTest.app,l=a.islandLife,p=l.collectibles.points.find(p=>p.type==='shell'&&!l.state.data.collected.includes(p.id)); if(!p)return false; window.__v4place(p.x+.55,a.terrainData.heightAt(p.x+.55,p.z),p.z,Math.PI/2); a.player.pitch=-0.75; return true; })()` );
		if ( ! placed ) throw new Error( 'No shell available' );
		await wait( 500 );
		if ( i === 0 ) writeFileSync( join( out, 'browser-shell.png' ), Buffer.from( ( await call( 'Page.captureScreenshot', { format: 'png' } ) ).data, 'base64' ) );
		await key( 'KeyE', 'e' );
		await waitFor( `window.__islandLifeTest.app.islandLife.state.data.resources.shell >= ${ i + 1 }`, `Shell ${ i + 1 } pickup` );
	}
	await evaluate( `(() => { const a=window.__islandLifeTest.app,b=a.islandLife.board; window.__v4place(b.x-1.2,b.y,b.z,-Math.PI/2); return true; })()` );
	await wait( 600 ); await key( 'KeyE', 'e' );
	await waitFor( `window.__islandLifeTest.app.islandLife.ui.isOpen && window.__islandLifeTest.app.islandLife.ui.kind==='board'`, 'Return to board' );
	await click( 'button[data-action="claim"][data-id="1:shell"]' );
	await waitFor( `window.__islandLifeTest.app.game.state.money===45`, 'Quest reward' );
	await click( 'button[data-action="close"]' );
	for ( let i = 0; i < 2; i ++ ) {
		await evaluate( `(() => { const a=window.__islandLifeTest.app,l=a.islandLife,p=l.collectibles.points.find(p=>p.type==='driftwood'&&!l.state.data.collected.includes(p.id)); window.__v4place(p.x+.55,a.terrainData.heightAt(p.x+.55,p.z),p.z,Math.PI/2); return true; })()` );
		await wait( 500 ); await key( 'KeyE', 'e' );
		await waitFor( `window.__islandLifeTest.app.islandLife.state.data.resources.driftwood >= ${ i + 1 }`, `Driftwood ${ i + 1 } pickup` );
	}
	await evaluate( `(() => { const a=window.__islandLifeTest.app,h=a.islandLife.shed; window.__v4place(h.door.x+Math.sin(h.yaw)*1.35,h.floorY,h.door.z+Math.cos(h.yaw)*1.35,h.yaw); return true; })()` );
	await wait( 500 ); await key( 'KeyE', 'e' ); await waitFor( `window.__islandLifeTest.app.islandLife.shed.open`, 'Workshop door' );
	await walkUntil( `window.__islandLifeTest.app.islandLife.nearbyRouter.candidates.some(c=>c.id==='workbench')`, 'Walk into workshop' );
	console.log( 'Walked through the opened shed door to the workbench.' );
	await key( 'KeyE', 'e' );
	await waitFor( `window.__islandLifeTest.app.islandLife.ui.isOpen && window.__islandLifeTest.app.islandLife.ui.kind==='workshop'`, 'Workshop bench' );
	writeFileSync( join( out, 'browser-workshop.png' ), Buffer.from( ( await call( 'Page.captureScreenshot', { format: 'png' } ) ).data, 'base64' ) );
	await click( 'button[data-action="craft"][data-id="chair"]' );
	await waitFor( `window.__islandLifeTest.app.islandLife.state.data.furniture.chair===1 && window.__islandLifeTest.app.islandLife.state.data.resources.driftwood===0`, 'Craft chair' );
	await click( 'button[data-action="close"]' );
	// Exercise the other visible tool sheds too, including the yellow door
	// shown in the reported issue. Use actual door, movement, prompt and UI input.
	for ( const name of [ 'shed2', 'shed3', 'shed4' ] ) {
		await evaluate( `(() => { const a=window.__islandLifeTest.app,h=a.village.sheds.find(s=>s.name===${ JSON.stringify( name ) }); window.__v4place(h.door.x+Math.sin(h.yaw)*1.35,h.floorY,h.door.z+Math.cos(h.yaw)*1.35,h.yaw); return true; })()` );
		await wait( 600 ); await key( 'KeyE', 'e' );
		await waitFor( `window.__islandLifeTest.app.village.sheds.find(s=>s.name===${ JSON.stringify( name ) }).open`, `${ name } door` );
		await walkUntil( `window.__islandLifeTest.app.islandLife.nearbyRouter.candidates.some(c=>c.id==='workbench')`, `Walk into ${ name }` );
		await waitFor( `window.__islandLifeTest.app.player.prompt?.text==='使用木工工作台'`, `${ name } workbench prompt` );
		await key( 'KeyE', 'e' );
		await waitFor( `window.__islandLifeTest.app.islandLife.ui.isOpen && window.__islandLifeTest.app.islandLife.ui.kind==='workshop'`, `${ name } workshop` );
		if ( name === 'shed3' ) writeFileSync( join( out, 'browser-yellow-shed-workshop.png' ), Buffer.from( ( await call( 'Page.captureScreenshot', { format: 'png' } ) ).data, 'base64' ) );
		await click( 'button[data-action="close"]' );
		console.log( `${ name }: opened door, walked in, opened workbench` );
	}
	await evaluate( `(() => { const a=window.__islandLifeTest.app,h=a.village.homes.find(h=>h.name==='A'); window.__v4place(h.door.x+Math.sin(h.yaw)*1.35,h.floorY,h.door.z+Math.cos(h.yaw)*1.35,h.yaw); return true; })()` );
	await wait( 500 ); await key( 'KeyE', 'e' );
	await waitFor( `window.__islandLifeTest.app.village.homes.find(h=>h.name==='A').open`, 'Cottage door' );
	await evaluate( `(() => { const a=window.__islandLifeTest.app,h=a.village.homes.find(h=>h.name==='A'),x=h.bed.x+Math.cos(h.yaw)*1.3,z=h.bed.z-Math.sin(h.yaw)*1.3,dx=h.bed.x-x,dz=h.bed.z-z; window.__v4place(x,h.floorY,z,Math.atan2(-dx,-dz)); return true; })()` );
	await wait( 700 ); await key( 'KeyG', 'g' );
	await waitFor( `window.__islandLifeTest.app.homeLife.saveState.home==='A'`, 'Choose home at bed' );
	await key( 'KeyB', 'b' ); await waitFor( `window.__islandLifeTest.app.islandLife.ui.kind==='inventory' && window.__islandLifeTest.app.islandLife.ui.isOpen`, 'Inventory' );
	await click( 'button[data-action="decor"]' ); await click( 'button[data-action="select"][data-id="chair"]' );
	await waitFor( `Boolean(document.querySelector('button[data-action="place"]'))`, 'Furniture preview' );
	const beforePlace = await call( 'Page.captureScreenshot', { format: 'png' } );
	writeFileSync( join( out, 'browser-decoration.png' ), Buffer.from( beforePlace.data, 'base64' ) );
	await click( 'button[data-action="place"]' );
	await waitFor( `(window.__islandLifeTest.app.islandLife.state.data.placements.A||[]).length===1`, 'Place chair' );
	await click( 'button[data-action="move"]' );
	await click( 'button[data-action="rotate"]' );
	await click( 'button[data-action="next"]' );
	await click( 'button[data-action="place"]' );
	await waitFor( `window.__islandLifeTest.app.islandLife.state.data.placements.A[0].rotation===1`, 'Move and rotate chair' );
	await click( 'button[data-action="remove"]' );
	await waitFor( `(window.__islandLifeTest.app.islandLife.state.data.placements.A||[]).length===0 && window.__islandLifeTest.app.islandLife.state.data.furniture.chair===1 && window.__islandLifeTest.app.islandLife.decor.objects.length===0`, 'Store chair and remove collision' );
	await click( 'button[data-action="select"][data-id="chair"]' );
	await click( 'button[data-action="place"]' );
	await waitFor( `(window.__islandLifeTest.app.islandLife.state.data.placements.A||[]).length===1`, 'Place chair again' );
	await click( 'button[data-action="close"]' );
	await evaluate( `(() => { const a=window.__islandLifeTest.app,h=a.village.homes.find(h=>h.name==='A'),p=a.player.position; a.player.yaw=Math.atan2(-(h.bed.x-p.x),-(h.bed.z-p.z)); return true; })()` );
	await wait( 700 ); await key( 'KeyE', 'e' );
	await waitFor( `Boolean(window.__islandLifeTest.app.homeLife.sleeping)`, 'Sleep at bed' );
	await waitFor( `window.__islandLifeTest.app.homeLife.saveState.day===2 && !window.__islandLifeTest.app.homeLife.sleeping && window.__islandLifeTest.app.islandLife.state.data.day===2`, 'Wake and refresh day', 30000 );
	console.log( 'Game loop: accepted request, collected materials, claimed $45, crafted and placed chair, slept to day 2' );
	const beforeReload = await evaluate( `(() => { const a=window.__islandLifeTest.app,d=a.islandLife.state.data; return { money:a.game.state.money, day:a.homeLife.saveState.day, home:a.homeLife.saveState.home, placed:d.placements.A.length, resources:a.islandLife.collectibles.points.length, inventory:d.resources, collected:d.collected.length, quests:d.quests.map(q=>q.id) }; })()` );
	if ( beforeReload.day !== 2 || beforeReload.collected !== 0 || beforeReload.quests.some( id => ! id.startsWith( '2:' ) ) ) throw new Error( 'Day change did not refresh the resource and quest state.' );
	await evaluate( `window.__islandLifeTest.reloadMarker = true` );
	await call( 'Page.reload' );
	await waitFor( `Boolean(window.__islandLifeTest?.app?.islandLife && !window.__islandLifeTest.reloadMarker && window.__islandLifeTest.app.homeLife.saveState.day===2)`, 'Reload saved game', 90000 );
	const afterReload = await evaluate( `(() => { const a=window.__islandLifeTest.app,d=a.islandLife.state.data; return { money:a.game.state.money, day:a.homeLife.saveState.day, home:a.homeLife.saveState.home, placed:(d.placements.A||[]).length, resources:a.islandLife.collectibles.points.length, inventory:d.resources, collected:d.collected.length, quests:d.quests.map(q=>q.id) }; })()` );
	if ( JSON.stringify( beforeReload ) !== JSON.stringify( afterReload ) ) throw new Error( `Saved game mismatch: ${ JSON.stringify( { beforeReload, afterReload } ) }` );
	console.log( 'Saved game restored:', JSON.stringify( afterReload ) );
	await evaluate( `(() => { const a=window.__islandLifeTest.app,h=a.village.homes.find(h=>h.name==='A'); a.player.position.set(h.x,h.floorY,h.z); a.player.velocity.set(0,0,0); return true; })()` );
	await waitFor( `window.__islandLifeTest.app.islandLife.decor.objects.length===1`, 'Restore furniture mesh and collision', 15000 );
	const restoredCollider = await evaluate( `(() => { const a=window.__islandLifeTest.app,o=a.islandLife.decor.objects[0]; return !!o && a.scene.children.includes(o.mesh) && a.colliders.boxes.includes(o.collider); })()` );
	if ( ! restoredCollider ) throw new Error( 'Restored furniture or its collision is missing.' );
	console.log( 'Furniture mesh and collision restored in home A.' );
	// Reproduce the reported stilt-house scenario with an existing different
	// home: enter S1, close its door, switch homes explicitly, place a chair,
	// then sleep while the door remains closed.
	await evaluate( `document.querySelector('.tw-start-cta')?.click(); window.__islandLifeTest.app.game.guide?.close(); true` );
	await waitFor( `window.__islandLifeTest.app.islandLife._canInteract()`, 'Resume after reload' );
	await evaluate( `window.__v4place=(x,y,z,yaw=0)=>{const p=window.__islandLifeTest.app.player;p.mode='walk';p.position.set(x,y,z);p.velocity.set(0,0,0);p.yaw=yaw;p._camY=null;}; true` );
	await key( 'KeyB', 'b' ); await click( 'button[data-action="decor"]' ); await click( 'button[data-action="remove"]' ); await click( 'button[data-action="close"]' );
	await evaluate( `(() => { const a=window.__islandLifeTest.app,h=a.village.homes.find(h=>h.name==='S1'); window.__v4place(h.door.x+Math.sin(h.yaw)*1.35,h.floorY,h.door.z+Math.cos(h.yaw)*1.35,h.yaw); return true; })()` );
	await wait( 600 ); await key( 'KeyE', 'e' ); await waitFor( `window.__islandLifeTest.app.village.homes.find(h=>h.name==='S1').open`, 'S1 door opens' );
	await walkUntil( `(() => {const a=window.__islandLifeTest.app,h=a.village.homes.find(h=>h.name==='S1'),p=a.player.position;return Math.hypot(p.x-h.x,p.z-h.z)<1.5})()`, 'Walk inside S1' );
	await evaluate( `(() => {const a=window.__islandLifeTest.app,h=a.village.homes.find(h=>h.name==='S1');window.__v4place(h.x+Math.sin(h.yaw)*.45,h.floorY,h.z+Math.cos(h.yaw)*.45,h.yaw+Math.PI);return true})()` );
	await wait( 500 ); await key( 'KeyE', 'e' ); await waitFor( `!window.__islandLifeTest.app.village.homes.find(h=>h.name==='S1').open`, 'Close S1 door from inside' );
	await key( 'KeyB', 'b' ); await waitFor( `!!document.querySelector('button[data-action="set-home"]')`, 'Different home explained' );
	await click( 'button[data-action="set-home"]' ); await waitFor( `window.__islandLifeTest.app.homeLife.saveState.home==='S1'`, 'Set S1 as home' );
	await click( 'button[data-action="select"][data-id="chair"]' );
	await waitFor( `!!document.querySelector('button[data-action="place"]')`, 'S1 chair preview' );
	await click( 'button[data-action="place"]' ); await waitFor( `(window.__islandLifeTest.app.islandLife.state.data.placements.S1||[]).length===1`, 'Place chair in S1' );
	await click( 'button[data-action="close"]' );
	await evaluate( `(() => { const a=window.__islandLifeTest.app,h=a.village.homes.find(h=>h.name==='S1'),x=h.bed.x+Math.cos(h.yaw)*1.3,z=h.bed.z-Math.sin(h.yaw)*1.3;window.__v4place(x,h.floorY,z,Math.atan2(-(h.bed.x-x),-(h.bed.z-z)));return true; })()` );
	await wait( 700 ); await key( 'KeyE', 'e' ); await waitFor( `Boolean(window.__islandLifeTest.app.homeLife.sleeping) && !window.__islandLifeTest.app.village.homes.find(h=>h.name==='S1').open`, 'Sleep with S1 door closed' );
	await waitFor( `window.__islandLifeTest.app.homeLife.saveState.day===3 && !window.__islandLifeTest.app.homeLife.sleeping`, 'Wake in S1', 30000 );
	console.log( 'S1: closed the door, selected this home, placed a chair, and slept successfully.' );
	const screenshot = await call( 'Page.captureScreenshot', { format: 'png' } );
	writeFileSync( join( out, 'browser-reload.png' ), Buffer.from( screenshot.data, 'base64' ) );
	console.log( 'Saved isolated browser screenshots to', out );
	if ( errors.length ) throw new Error( `Browser exceptions: ${ JSON.stringify( errors.slice( - 5 ) ) }` );
} finally {
	try { if ( ws?.readyState === WebSocket.OPEN ) await call( 'Browser.close' ); } catch {}
	try { ws?.close(); } catch {}
	child.kill();
}
