import { GPU } from './gpu/GPU.js';
import { PerspectiveCamera } from './scene/Camera.js';
import { Scene } from './scene/Scene.js';
import { Timer } from './math/Timer.js';
import { MeshRenderer } from './render/MeshRenderer.js';
import { FrameUniforms } from './render/Frame.js';

// Canvas, device, main camera / scene and the frame loop.
export class Engine {

	constructor( container ) {

		this.container = container;
		this.renderScale = 1;
		this.clock = new Timer();
		this.frame = 0;
		this.onResize = [];

	}

	async init() {

		const canvas = document.createElement( 'canvas' );
		canvas.tabIndex = 0;
		this.container.appendChild( canvas );
		this.canvas = canvas;
		this.domElement = canvas;
		await GPU.init( { canvas } );
		this.meshRenderer = new MeshRenderer();
		this.meshRenderer.syncPipelines = false; // compile in the background (App.precompile waits for them)
		this.camera = new PerspectiveCamera( 62, window.innerWidth / window.innerHeight, 0.06, 60000 );
		this.scene = new Scene();
		window.addEventListener( 'resize', () => this.resize() );
		this.resize();

	}

	setRenderScale( s ) {

		this.renderScale = s;
		this.resize();

	}

	// output (canvas) size in pixels
	get width() {

		return this.canvas.width;

	}

	get height() {

		return this.canvas.height;

	}

	resize() {

		const w = window.innerWidth, h = window.innerHeight;
		const dpr = this.renderScale;
		this.canvas.width = Math.max( 1, Math.floor( w * dpr ) );
		this.canvas.height = Math.max( 1, Math.floor( h * dpr ) );
		this.canvas.style.width = w + 'px';
		this.canvas.style.height = h + 'px';
		this.camera.aspect = w / h;
		this.camera.updateProjectionMatrix();
		FrameUniforms.fields.outputResolution.value.set( this.canvas.width, this.canvas.height );
		for ( const f of this.onResize ) f( w, h );

	}

	// the canvas texture of this frame (render target of the final post pass)
	currentTexture() {

		return GPU.context.getCurrentTexture();

	}

	start( update, onError = error => console.error(error) ) {
        if(this._running)return;
        this._running=true;
        this.clock.reset();
		const requested=Number(new URLSearchParams(location.search).get('maxFps'));
		this.maxFps=Number.isFinite(requested)&&requested>=15?Math.min(240,requested):0;
		let previousFrame=null;

		const loop = ( t ) => {
            if(!this._running)return;
			const limit=document.hidden?Math.min(this.maxFps||20,20):this.maxFps;
			if(limit&&previousFrame!==null&&t-previousFrame<1000/limit-.5){this._raf=requestAnimationFrame(loop);return;}
			const wallDt=previousFrame===null?null:Math.max(0,(t-previousFrame)/1000);
			previousFrame=t;

			this.clock.update( t );
			let dt = this.clock.getDelta();
			dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;
			this.frame ++;
			try{update( dt, this.clock.getElapsed(), wallDt );}catch(error){this.stop();onError(error);return;}
            if(this._running)this._raf = requestAnimationFrame( loop );

		};

		this._raf = requestAnimationFrame( loop );

	}

	stop() {

		this._running=false;
        cancelAnimationFrame( this._raf );

	}

}
