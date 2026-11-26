// Controlled headless Edge comparison. Run once per local server, e.g.
// node test/islandlife-perf.mjs http://localhost:5175 baseline
// node test/islandlife-perf.mjs http://localhost:5173 v4
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
if ( ! existsSync( edge ) ) throw new Error( 'Microsoft Edge executable not found.' );
const base = ( process.argv[ 2 ] || 'http://localhost:5173' ).replace( /\/$/, '' ), label = process.argv[ 3 ] || 'v4';
if ( ! [ 'baseline', 'v4' ].includes( label ) ) throw new Error( 'Label must be baseline or v4.' );
const profile = mkdtempSync( join( tmpdir(), `tidewater-perf-${ label }-` ) );
const child = spawn( edge, [ '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${ profile }`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--no-proxy-server', '--enable-unsafe-webgpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-precise-memory-info', '--window-size=1920,1080', 'about:blank' ], { windowsHide: true, stdio: 'ignore' } );
const wait = ms => new Promise( r => setTimeout( r, ms ) );
let ws, seq = 0; const pending = new Map(), errors = [];
function call( method, params = {} ) { return new Promise( ( ok, fail ) => { const id = ++ seq; pending.set( id, { ok, fail } ); ws.send( JSON.stringify( { id, method, params } ) ); } ); }
async function evaluate( expression ) { const r = await call( 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true } ); if ( r.exceptionDetails ) throw new Error( r.exceptionDetails.exception?.description || r.exceptionDetails.text ); return r.result.value; }
async function until( expression, seconds = 100 ) { for ( let i = 0; i < seconds * 2; i ++ ) { if ( await evaluate( expression ) ) return; await wait( 500 ); } throw new Error( 'Game initialization timed out.' ); }
try {
	let port;
	for ( let i = 0; i < 100; i ++ ) { try { port = Number( readFileSync( join( profile, 'DevToolsActivePort' ), 'utf8' ).split( '\n' )[ 0 ] ); if ( port ) break; } catch {} await wait( 100 ); }
	if ( ! port ) throw new Error( 'Edge did not open its debugging port.' );
	const target = await ( await fetch( `http://127.0.0.1:${ port }/json/new?${ encodeURIComponent( `${ base }/?islandtest=1` ) }`, { method: 'PUT' } ) ).json();
	ws = new WebSocket( target.webSocketDebuggerUrl ); await new Promise( ( ok, fail ) => { ws.addEventListener( 'open', ok, { once: true } ); ws.addEventListener( 'error', fail, { once: true } ); } );
	ws.addEventListener( 'message', event => { const m = JSON.parse( event.data ); if ( m.id && pending.has( m.id ) ) { const p = pending.get( m.id ); pending.delete( m.id ); m.error ? p.fail( new Error( m.error.message ) ) : p.ok( m.result ); } else if ( m.method === 'Runtime.exceptionThrown' ) errors.push( m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text ); } );
	await call( 'Runtime.enable' ); await call( 'Page.enable' );
	await call( 'Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false } );
	await call( 'Page.bringToFront' );
	await until( `Boolean(window.__islandLifeTest?.app && window.__ui?._start && window.__islandLifeTest.app.game?.guide)` );
	await evaluate( `document.querySelector('.tw-start-cta')?.click(); window.__islandLifeTest.app.game.guide?.close(); true` );
	await wait( 2000 ); await evaluate( `window.__islandLifeTest.app.game.guide?.close(); true` );
	const settings = await evaluate( `(() => {const a=window.__islandLifeTest.app;return {width:innerWidth,height:innerHeight,renderScale:a.post.scale,time:a.settings.timeOfDay,hidden:document.hidden,webgpu:!!navigator.gpu};})()` );
	if ( settings.width !== 1920 || settings.height !== 1080 || settings.hidden ) throw new Error( `Unexpected benchmark setup: ${ JSON.stringify( settings ) }` );
	const adapter = await evaluate( `(async()=>{const a=await navigator.gpu.requestAdapter({powerPreference:'high-performance'}),i=a?.info;return i?{vendor:i.vendor,architecture:i.architecture,device:i.device,description:i.description}:null})()` );
	const out = resolve( '..', '.v4-artifacts' ); mkdirSync( out, { recursive: true } );
	const result = { label, base, settings, adapter, sampleTimeOfDay: 12, warmupSeconds: 5, sampleSeconds: 30, scenes: {} };
	for ( const view of [ 'beach', 'village', 'workshop', 'bedroom' ] ) {
		await evaluate( `(() => {
			const a=window.__islandLifeTest.app,p=a.player, view=${ JSON.stringify( view ) };
			let x,z,y,yaw;
			if(view==='beach'){x=18;z=-60;y=Math.max(a.terrainData.heightAt(x,z),a.colliders.groundHeightAt(x,z,50));yaw=Math.PI;}
			if(view==='village'){x=43;z=-96;y=Math.max(a.terrainData.heightAt(x,z),a.colliders.groundHeightAt(x,z,50));yaw=-0.6;}
			if(view==='workshop'){const h=a.village.sheds.find(s=>s.name==='shed1');yaw=h.door.yaw;x=h.x+Math.sin(yaw)*.15;z=h.z+Math.cos(yaw)*.15;y=h.floorY;}
			if(view==='bedroom'){const h=a.village.homes.find(s=>s.name==='A');yaw=h.door.yaw;x=h.x;z=h.z;y=h.floorY;}
			p.mode='walk';p.position.set(x,y,z);p.velocity.set(0,0,0);p.yaw=yaw;p.pitch=-0.1;p._camY=null;a.input.keys.clear();a.input.pressed.clear();a.settings.timeOfDay=12;a.settings.timeSpeed=0;
			if(view==='bedroom' && a.islandLife){const h=a.village.homes.find(s=>s.name==='A'),l=a.islandLife;a.homeLife.saveState.home='A';l.state.data.furniture.chair=1;const slot=l.decor.slots(h).find(s=>l.decor.valid(h,s,'chair',0));if(!slot || !l.decor.place('chair',slot.id,0))throw new Error('Could not set up bedroom chair');}
			return true;
		})()` );
		console.log( `${ label }: ${ view } — 5s warm-up + 30s sample` );
		const measurements = await evaluate( `(async()=>await new Promise(resolve=>{let start=performance.now(),last=null,frames=[];function tick(now){if(now-start>=5000){if(last!==null)frames.push(now-last);last=now;}if(now-start>=35000){frames.sort((a,b)=>a-b);const sum=frames.reduce((a,b)=>a+b,0),mean=sum/frames.length;resolve({frames:frames.length,meanMs:mean,fps:1000/mean,p95Ms:frames[Math.floor(frames.length*.95)],p99Ms:frames[Math.floor(frames.length*.99)],jsHeapBytes:performance.memory?.usedJSHeapSize??null});return;}requestAnimationFrame(tick)}requestAnimationFrame(tick)}))()` );
		result.scenes[ view ] = measurements; console.log( `${ label }: ${ view } ${ JSON.stringify( measurements ) }` );
		const shot = await call( 'Page.captureScreenshot', { format: 'png' } ); writeFileSync( join( out, `perf-${ label }-${ view }.png` ), Buffer.from( shot.data, 'base64' ) );
		writeFileSync( join( out, `perf-${ label }.json` ), JSON.stringify( result, null, 2 ) );
	}
	if ( errors.length ) throw new Error( `Browser exceptions: ${ JSON.stringify( errors.slice( - 5 ) ) }` );
	console.log( `${ label }: complete` );
} finally {
	try { if ( ws?.readyState === WebSocket.OPEN ) await call( 'Browser.close' ); } catch {}
	try { ws?.close(); } catch {}
	child.kill();
}
