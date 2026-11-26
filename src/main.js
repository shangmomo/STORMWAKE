import './core/BenchSeed.js';
import {showRuntimeFailure} from './core/RuntimeRecoveryV78.js';
import { App } from './App.js';
import { HUDMode } from './ui/HUDMode.js';
import './ui/hud-v67.css';
import { UI } from './ui/UI.js';
import { AppUI } from './ui/AppUI.js';
import { IslandCompanion } from './course/IslandCompanion.js';
import { initLocalization } from './course/Localization.js';
import { HomeLife } from './course/HomeLife.js';
import { CompanionActor } from './course/CompanionActor.js';
import { IslandLife } from './islandlife/IslandLife.js';
import { Shipyard } from './islandlife/Shipyard.js';
import './islandlife/shipyard.css';
import { MarineExpedition } from './islandlife/MarineExpedition.js';
import './islandlife/marine.css';
import { OceanChart } from './islandlife/OceanChart.js';
import './islandlife/ocean-chart.css';
import { BoatRecovery } from './islandlife/BoatRecovery.js';
import './islandlife/boat-recovery.css';
import { HuntCombat } from './oceanhunt/HuntCombat.js';
import './oceanhunt/ocean-hunt.css';
import './oceanhunt/abyss-raid.css';
import { CoopClient } from './oceanhunt/CoopClient.js';
import './oceanhunt/crew.css';
import './land/land-adventure.css';
import './voyage/voyage-m1.css';

// ?bench runs in background tabs too (automation): rAF does not fire in a hidden page
if ( /[?&]bench\b/.test( location.search ) ) {

	const raf = window.requestAnimationFrame.bind( window ), caf = window.cancelAnimationFrame.bind( window );
	window.requestAnimationFrame = ( cb ) => document.visibilityState === 'hidden' ? setTimeout( () => cb( performance.now() ), 16 ) : raf( cb );
	window.cancelAnimationFrame = ( id ) => ( clearTimeout( id ), caf( id ) );

}

initLocalization();
const ui = new UI();
const app = new App();
app.playState = 'loading';
window.__ui = ui;

let bootWatchdog;
function bootProgress(p,text,until){ui.setLoading(p,text,until);clearTimeout(bootWatchdog);bootWatchdog=setTimeout(()=>showRuntimeFailure(app,new Error('启动阶段超过180秒无进度：'+text)),180000);}
app.init( bootProgress ).then( async () => {
    clearTimeout(bootWatchdog);if(app._runtimeFailed)return;

	app.ui = new AppUI( app, ui );
	// Course edition: persistent island quests and optional DeepSeek companion.
	// Bench mode deliberately skips the extra UI for upstream reproducibility.
	if ( ! app.qs.has( 'bench' ) ) {

		app.expedition = new IslandCompanion( app );
		app.homeLife = new HomeLife( app );
		app.companionActor = new CompanionActor( app );
		app.islandLife = new IslandLife( app );
		app.shipyard = new Shipyard( app );
		app.marineExpedition = new MarineExpedition( app );
		app.hunt = new HuntCombat( app );
		app.crew = new CoopClient( app );
		app.oceanChart = new OceanChart( app );
		app.boatRecovery = new BoatRecovery( app );
        app.hudMode = new HUDMode(app);
		// Opt-in hook for the isolated browser acceptance test; never included in production builds.
		if ( import.meta.env.DEV && app.qs.has( 'islandtest' ) ) window.__islandLifeTest = { app };

	}
	// V58 automation probes load only in local DEV builds with the explicit ?qa=1 flag.
	if ( import.meta.env.DEV && app.qs.has( 'qa' ) ) {
		const { installAutoQA } = await import( './qa/AutoQA.js' );
		installAutoQA( app );
	}
	ui.setLoading( 1, 'Ready' );
	await ui.hideLoader();
	// frame-time benchmark and reference shots (see core/Bench.js): it drives the frames itself
	if ( app.qs.has( 'bench' ) ) {

		window.__bench = new ( await import( './core/Bench.js' ) ).Bench( app );
		if ( app.qs.has( 'auto' ) ) window.__job = window.__bench.auto( app.qs.get( 'auto' ), { runs: Number( app.qs.get( 'runs' ) ) || 1 } );
		// ?bench&shots=view1,view2[&tag=name][&dt=seconds][&seq=n&every=frames]: reference shots of the named views only (core/DebugViews.js; dt > 0: the clock runs, e.g. for the eased lens flare)
		// &wdbg=N: the water shader's debug view (WaterMaterial debugMode) in the shots
		if ( app.qs.has( 'wdbg' ) && app.waterMaterial ) app.waterMaterial.debugMode.value = Number( app.qs.get( 'wdbg' ) );
		if ( app.qs.has( 'shots' ) ) window.__job = window.__bench.shots( app.qs.get( 'shots' ).split( ',' ), { tag: app.qs.get( 'tag' ) || 'shot', dt: Number( app.qs.get( 'dt' ) ) || 0, seq: Number( app.qs.get( 'seq' ) ) || 1, every: Number( app.qs.get( 'every' ) ) || 1 } );

	} else app.start();
	app.playState = 'awaiting_start';
	app.input.enabled = false;
	ui.showStartOverlay( () => {

		app.playState = 'playing';
		app.input.enabled = true;
		app.input.requestLock();
		if ( app.audio ) app.audio.resume();

	} );

} ).catch( ( e ) => {

	clearTimeout(bootWatchdog);
    console.error( e );
	ui.setLoadingError( 'Something went wrong: ' + e.message );

} );
