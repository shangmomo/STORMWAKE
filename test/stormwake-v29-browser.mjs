// Optional V30 WebGPU end-to-end smoke test; runs against a local Vite server.
// node test/stormwake-v29-browser.mjs http://127.0.0.1:5206
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';

const binaries = [ process.env.CHROME_BIN, '/usr/bin/chromium', '/usr/bin/google-chrome',
	'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' ];
const chrome = binaries.find( path => path && existsSync( path ) );
if ( !chrome ) throw new Error( 'Chromium/Edge executable not found. Set CHROME_BIN.' );
const base = ( process.argv[2] || 'http://127.0.0.1:5206' ).replace( /\/$/, '' );
const profile = mkdtempSync( join( tmpdir(), 'tidewater-v29-' ) );
const isLinux = process.platform === 'linux';
const child = spawn( chrome, [ '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
	'--no-first-run', '--no-default-browser-check', '--disable-extensions', '--enable-unsafe-webgpu',
	'--enable-features=Vulkan,WebGPUDeveloperFeatures', '--use-angle=swiftshader',
	'--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--window-size=1280,800',
	...( isLinux ? [ '--no-sandbox', '--disable-dev-shm-usage' ] : [] ), 'about:blank' ],
	{ windowsHide: true, stdio: 'ignore' } );
const delay = ms => new Promise( resolveDelay => setTimeout( resolveDelay, ms ) );
let ws, seq = 0;
const pending = new Map(), errors = [];
const call = ( method, params = {} ) => new Promise( ( yes, no ) => {
	const id = ++seq;
	pending.set( id, { yes, no } );
	ws.send( JSON.stringify( { id, method, params } ) );
} );
async function evaluate( expression ) {
	const result = await call( 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true } );
	if ( result.exceptionDetails ) throw new Error( result.exceptionDetails.exception?.description || result.exceptionDetails.text );
	return result.result.value;
}
async function until( expression, label, timeout = 90000 ) {
	const deadline = Date.now() + timeout;
	while ( Date.now() < deadline ) {
		try { if ( await evaluate( expression ) ) return; } catch ( error ) {
			if ( !/execution context|navigation|Cannot find|Inspected target/i.test( error.message ) ) throw error;
		}
		await delay( 250 );
	}
	throw new Error( `${label}: timed out. Browser errors: ${errors.slice(-4).join(' | ')}` );
}

try {
	let port = 0;
	for ( let i=0; i<150; i++ ) {
		try { port = Number( readFileSync( join( profile, 'DevToolsActivePort' ), 'utf8' ).split('\n')[0] ); } catch {}
		if ( port ) break;
		await delay( 100 );
	}
	if ( !port ) throw new Error( 'Headless browser did not open debugging port.' );
	const target = await ( await fetch( `http://127.0.0.1:${port}/json/new?${encodeURIComponent(`${base}/?islandtest=1&noAudio=1`)}`, { method: 'PUT' } ) ).json();
	ws = new WebSocket( target.webSocketDebuggerUrl );
	await new Promise( ( yes, no ) => {
		ws.addEventListener( 'open', yes, { once: true } );
		ws.addEventListener( 'error', no, { once: true } );
	} );
	ws.addEventListener( 'message', event => {
		const message = JSON.parse( event.data );
		if ( message.id && pending.has( message.id ) ) {
			const wait = pending.get( message.id ); pending.delete( message.id );
			message.error ? wait.no( new Error( message.error.message ) ) : wait.yes( message.result );
		} else if ( message.method === 'Runtime.exceptionThrown' ) errors.push( message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text );
		else if ( message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error' )
			errors.push( message.params.args.map( arg => arg.value ?? arg.description ?? '' ).join(' ') );
	} );
	await call( 'Runtime.enable' ); await call( 'Page.enable' );
	console.log( 'Waiting for WebGPU scene...' );
	await until( 'Boolean(window.__islandLifeTest?.app?.hunt?.abyss)', 'game initialization' );
	await until( 'Boolean(document.querySelector(".tw-start-cta"))', 'start overlay', 30000 );
	await evaluate( 'document.querySelector(".tw-start-cta").click(); window.__islandLifeTest.app.game.guide?.close(); true' );
	await delay( 1200 );
	console.log( 'Loading abyss 3D models...' );
	const entered = await evaluate( `window.__islandLifeTest.app.hunt.abyss.developer = true;
		window.__islandLifeTest.app.hunt.abyss.enter()` );
	assert.equal( entered, true );
	await until( 'Boolean(window.__islandLifeTest.app.hunt.abyss.cameraPrimed)', 'submarine camera', 20000 );
	const first = await evaluate( `(() => { const r=window.__islandLifeTest.app.hunt.abyss;
		return {active:r.active, mode:r.helmMode, heading:r.yaw, speed:r.speed, dive:r.diveVelocity,
			model:document.querySelector('[data-abyss-model]').textContent,
			camera: r.app.camera.position.toArray()}; })()` );
	assert.equal( first.mode, 'helm' );
	console.log( 'Entered:', JSON.stringify( first ) );
	// Simulate the same buffered deltas written by the Input pointer-lock handler.
	await evaluate( `(() => { const a=window.__islandLifeTest.app; a.input.look.x=125;
		a.input.keys.add('KeyW'); a.input.pressed.add('KeyW'); a.input.keys.add('ShiftLeft'); return true; })()` );
	await delay( 1300 );
	const cruising = await evaluate( `(() => { const r=window.__islandLifeTest.app.hunt.abyss;
		return {yaw:r.yaw, speed:r.speed, camera:r.cameraMode}; })()` );
	assert.equal( cruising.yaw, first.heading, 'mouse look cannot steer the hull' );
	assert.ok( cruising.speed > 50, 'vessel accelerates under flank throttle' );
	assert.ok( await evaluate( 'window.__islandLifeTest.app.hunt.abyss.throttle > .95' ), 'latched throttle reaches maximum' );
	await evaluate( `(() => { const a=window.__islandLifeTest.app; a.input.keys.delete('KeyW');
		a.input.keys.delete('ShiftLeft'); return true; })()` );
	await delay( 170 );
	assert.ok( await evaluate( 'window.__islandLifeTest.app.hunt.abyss.throttle > .95' ), 'releasing W preserves engine order' );
	await evaluate( `(() => { const a=window.__islandLifeTest.app; a.input.keys.clear();
		a.hunt.abyss.toggleHelm(); return true; })()` );
	assert.equal( await evaluate( 'window.__islandLifeTest.app.hunt.abyss.helmMode' ), 'arcade' );
	await evaluate( `(() => { const a=window.__islandLifeTest.app; a.hunt.abyss.bossLock=true;
		a.hunt.abyss.fireCooldown=0; a.hunt.abyss.fire(); return true; })()` );
	assert.ok( await evaluate( 'window.__islandLifeTest.app.hunt.abyss.torpedoes.some(t=>t.guided)' ), 'lock-on projectile launched' );
	const screenshot = await call( 'Page.captureScreenshot', { format: 'png' } );
	const output = resolve( '..', 'v30-abyss-smoke.png' );
	writeFileSync( output, Buffer.from( screenshot.data, 'base64' ) );
	console.log( 'Screenshot:', output );
	const exit = await evaluate( `(() => { const r=window.__islandLifeTest.app.hunt.abyss;
		r.exit(); return {active:r.active,torpedoes:r.torpedoes.length,impacts:r.impacts.length}; })()` );
	assert.deepEqual( exit, { active: false, torpedoes: 0, impacts: 0 } );
	if ( errors.length ) throw new Error( `Browser console errors: ${errors.slice(-6).join(' | ')}` );
	console.log( 'V30 browser PASS: scene, independent camera, latched throttle, mode toggle, guided shot, cleanup.' );
} finally {
	try { ws?.close(); } catch {}
	child.kill();
	try { rmSync( profile, { recursive: true, force: true } ); } catch {}
}
