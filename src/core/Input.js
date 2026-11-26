import {acceptsKey,typingTarget} from './ControlPolicy.js';
// Keyboard / mouse input with pointer lock support.
export class Input {

	constructor( dom ) {

		this.dom = dom;
		this.keys = new Set();
		this.pressed = new Set();
		this.look = { x: 0, y: 0 };
		this.wheel = 0;
		this._mouseDown = false;
        this._rightDown = false;
        this.gameplayBlocked = false;
        for(const [name,field] of [['mouseDown','_mouseDown'],['rightDown','_rightDown']]) Object.defineProperty(this,name,{get:()=>this.enabled&&!this.gameplayBlocked&&this[field],set:v=>{this[field]=!!v;}});
		this.locked = false;
		this.lookMode = 'normal'; // both the surface helm and abyss submarine
		this._enabled = true;
		// Disabling input for any modal must discard held keys and stale
		// edge presses; otherwise closing dialogue can fire an old attack.
		Object.defineProperty(this,'enabled',{get:()=>this._enabled,set:enabled=>{
			if(!enabled && this._enabled) this.resetPhysicalState();
			this._enabled=!!enabled;
		}});
		this.interactionOwner = null;

		window.addEventListener( 'keydown', ( e ) => {

            if (!this.enabled || !acceptsKey(e)) return;
            // After a modal/focus reset, OS auto-repeat must not resurrect a held key.
            if (e.repeat && !this.keys.has(e.code)) return;
            if (!this.keys.has(e.code)) this.pressed.add(e.code);
            this.keys.add(e.code);
            if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','F1','F2','F3','F4','F6','F7','F8'].includes(e.code) || (this.locked && /^(Key|Digit|Numpad|Control)/.test(e.code))) e.preventDefault();

		} );
		window.addEventListener( 'keyup', ( e ) => this.keys.delete( e.code ) );
		window.addEventListener( 'blur', () => this.resetPhysicalState() );
        document.addEventListener('visibilitychange',()=>{if(document.hidden)this.resetPhysicalState();});
        document.addEventListener('focusin',e=>{if(typingTarget(e.target))this.resetPhysicalState();});

		dom.addEventListener( 'mousedown', ( e ) => {

            if(!this.enabled||this.gameplayBlocked)return;
			if ( e.button === 0 ) this.mouseDown = true;
			if ( e.button === 2 ) this.rightDown = true;

		} );
		window.addEventListener( 'mouseup', ( e ) => {

			if ( e.button === 0 ) this.mouseDown = false;
			if ( e.button === 2 ) this.rightDown = false;

		} );
		dom.addEventListener( 'contextmenu', ( e ) => e.preventDefault() );
		window.addEventListener( 'mousemove', ( e ) => {

            if(!this.enabled||this.gameplayBlocked)return;
			if ( this.lookMode === 'rightDrag' ? this.rightDown : ( this.locked || this.mouseDown || this.rightDown ) ) {

				if(Number.isFinite(e.movementX))this.look.x += e.movementX;
				if(Number.isFinite(e.movementY))this.look.y += e.movementY;

			}

		} );
		dom.addEventListener( 'wheel', ( e ) => {

            if(!this.enabled||this.gameplayBlocked)return;
			if(Number.isFinite(e.deltaY))this.wheel += Math.sign( e.deltaY );
			e.preventDefault();

		}, { passive: false } );

		document.addEventListener( 'pointerlockchange', () => {

			const was=this.locked;this.locked = document.pointerLockElement === dom;if(was&&!this.locked)this.resetPhysicalState();

		} );

	}

	resetPhysicalState() {
		this.keys.clear(); this.pressed.clear(); this.mouseDown=false;this.rightDown=false;
		this.look.x=0;this.look.y=0;this.wheel=0;
	}

	requestLock() {

		if ( ! this.locked ) this.dom.requestPointerLock?.()?.catch?.( () => {} );

	}

	down( code ) {

		return this.enabled && !this.gameplayBlocked && this.keys.has( code );

	}

	// true once per physical key press
	hit( code ) {

		return this.enabled && !this.gameplayBlocked && this.pressed.has( code );

	}

	// A contextual action owns a physical press once it has executed.
	consume( code, owner = null ) {
		if ( ! this.enabled || this.gameplayBlocked || ! this.pressed.has( code ) || ( code === 'KeyE' && this.interactionOwner && this.interactionOwner !== owner ) ) return false;
		this.pressed.delete( code );
		return true;
	}

    // Soft modal: preserve menu keyboard edges but never deliver movement or attacks.
    setGameplayBlocked(blocked) {
        blocked=!!blocked;if(blocked!==this.gameplayBlocked){this.resetPhysicalState();this.gameplayBlocked=blocked;if(blocked&&document.pointerLockElement)document.exitPointerLock?.();}
    }
    menuConsume(code) {if(!this.enabled||!this.pressed.has(code))return false;this.pressed.delete(code);return true;}

	consumeLook() {

		const l = this.enabled&&!this.gameplayBlocked ? { x: this.look.x, y: this.look.y } : {x:0,y:0};
		this.look.x = 0;
		this.look.y = 0;
		return l;

	}

	consumeWheel() {

		const w = this.enabled&&!this.gameplayBlocked ? this.wheel : 0;
		this.wheel = 0;
		return w;

	}

	endFrame() {

		this.pressed.clear();
		this.interactionOwner = null;

	}

}
