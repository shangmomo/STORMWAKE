import {safeCameraBoom} from '../player/LandMotorV78.js';
import { Group, Vector3 } from '../engine/index.js';
import { loadResidentRig } from './LandResidents.js';
import { loadLandRig, assignRigActions, playLandRigAction } from './LandRigRuntime.js';
import { installHumanoidMotionFallback } from './LandHumanoidMotion.js';
import { LandFootPlant } from './LandGrounding.js';
import { attachPirateStyle } from './LandPirateStyle.js';

const _forward = new Vector3();

// Player identity remains a stable actor; camera mode is only a presentation
// choice. The weapon/attack events are shared by first and third person views.
export class LandAvatar {
	constructor( app ) {
		this.app = app;
		this.mode = 'first';
		this.root = new Group();
		this.root.name = 'V32 captain avatar — persistent local actor';
		this.root.visible = false;
		app.scene.add( this.root );
		this.pendingAction = null;
		this.oneShotRemaining = 0;
		if ( typeof document !== 'undefined' ) this.load().catch( e => console.warn( 'Captain rig:', e ) );
	}

	async load() {
		let actor = await loadLandRig( 'captain' );
		if ( !actor ) {
			const rig = await loadResidentRig( ( import.meta.env?.BASE_URL || '/' ) + 'models/characters/joe.glb' );
			actor = { rig, actions: assignRigActions( rig.clipNames() ), slot: 'captain-fallback',
				missing: [ 'walk', 'run', 'attack', 'heavy', 'dodge', 'hit', 'death' ] };
		}
		this.root.clear();
		this.root.add( actor.rig.group );
		this.actor = actor;
		this.footPlant = new LandFootPlant( actor.rig );
		this.footPlant.update( 0 );
		this.pirateStyle=attachPirateStyle(actor,0);
		if ( !actor.actions.walk || !actor.actions.attack || !actor.actions.dodge )
			installHumanoidMotionFallback( actor );
		actor.rig.onClipEnd = () => {
			this.oneShotRemaining = 0; // next update selects actual movement; no mutation of layers mid-iteration
		};
		return actor;
	}

	onAction( event ) {
		if ( !this.actor ) return;
		const key = { light: 'attack', heavy: 'heavy', dodge: 'dodge' }[ event.action ];
		if ( !key ) return;
		if ( this.actor.actions[ key ] ) {
			playLandRigAction( this.actor, key, { oneShot: true, fade: .08 } );
			this.oneShotRemaining = Math.max(.08,this.actor.rig.clipDuration(this.actor.actions[key])||.8);
		} else this.actor.fallbackMotion?.trigger( event.action );
	}

	toggle() { this.mode = this.mode === 'first' ? 'third' : 'first'; return this.mode; }

	update( dt, landPlayable ) {
		const app = this.app, p = app.player;
		const visible = landPlayable && this.mode === 'third' && p.mode === 'walk' && !app.freeCam;
		this.root.visible = visible;
		if ( !visible ) { this.actor?.rig.hold(); return; }
		p.getViewDir( _forward ); _forward.y = 0; _forward.normalize();
		this.root.position.copy( p.position );
		const yaw=Math.atan2(_forward.x,_forward.z),delta=Math.atan2(Math.sin(yaw-this.root.rotation.y),Math.cos(yaw-this.root.rotation.y));
        this.root.rotation.y+=Math.max(-10*dt,Math.min(10*dt,delta));
		if ( this.actor ) {
			this.oneShotRemaining = Math.max( 0, this.oneShotRemaining - dt );
			const speed=p.actualLandSpeed??Math.hypot(p.velocity?.x||0,p.velocity?.z||0);
            const moving = p.grounded&&speed > .32;
			const motion = moving ? ( speed>4.1 ? 'run' : 'walk' ) : 'idle';
			if ( this.oneShotRemaining <= 0 )
				playLandRigAction( this.actor, motion );
			this.actor.fallbackMotion?.update( dt, this.actor.actions[ motion ] ? 'idle' : motion );
			this.actor.rig.update( dt );
			this.footPlant?.update( dt, { moving, locomotion: p.grounded&&this.oneShotRemaining <= 0, root:this.root.position, yaw:this.root.rotation.y, groundProbe:(x,z,y)=>this.app.player.groundAt(x,z,y+1) } );
			this.pirateStyle?.update();
		}
		const eye=p.position.clone().add(new Vector3(0,1.62,0));
        const desired=p.position.clone().add(new Vector3(0,2.55,0)).addScaledVector(_forward,-3.3);
        desired.y=Math.max(desired.y,app.terrainData.heightAt(desired.x,desired.z)+.9);
        const safe=safeCameraBoom(app.colliders,eye,desired);p.cameraOccluded=safe.distanceTo(eye)<.65;if(p.cameraOccluded){this.root.visible=false;app.camera.position.copy(eye);}else app.camera.position.copy(safe);
	}
}
