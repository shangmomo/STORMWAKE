import { Group, Mesh, Vector3 } from '../engine/index.js';
import { prepare, mergePrepared, sphere, mat4 } from '../world/boat/GeoKit.js';
import { createPropMaterial, PAT } from '../game/GameMaterials.js';
import { COMPANION_SAVE_KEY, COMPANION_ACTIONS, restoreCompanionState, addMemory, chooseCompanionGoal } from './CompanionBrain.js';
import { CompanionNavigation } from './CompanionNavigation.js';

const COAT = 0x79c6bd, CREAM = 0xffe6cb, DARK = 0x203d48, PINK = 0xe9a5a8;
const part = ( color, x, y, z, sx, sy, sz, pattern = PAT.cloth ) => prepare( sphere( 1, 16, 12 ), { color, rough: 0.92, pattern, matrix: mat4( x, y, z, 0, 0, 0, sx, sy, sz ) } );

// A low-poly plush doll assembled from independent parts. Shared material and
// grouped geometry keep the number of draw calls bounded.
export class CompanionActor {
	constructor( app ) {
		this.app = app;
		let saved = null;
		try { saved = JSON.parse( localStorage.getItem( COMPANION_SAVE_KEY ) || 'null' ); } catch { /* optional storage */ }
		this.state = restoreCompanionState( saved );
		this.material = createPropMaterial( 'xiaoxiPlush' );
		this.material.underwaterLighting = 'lite';
		this.group = new Group();
		this.group.name = 'Xiaoxi';
		this.model = new Group();
		this.group.add( this.model );
		const mesh = ( list, parent = this.model ) => { const m = new Mesh( mergePrepared( list ), this.material ); m.castShadow = false; parent.add( m ); return m; };
		mesh( [ part( COAT, 0, 0.58, 0, 0.27, 0.32, 0.19 ), part( CREAM, 0, 0.57, 0.17, 0.18, 0.22, 0.04 ) ] );
		this.head = new Group(); this.head.position.set( 0, 0.91, 0 ); this.model.add( this.head );
		mesh( [ part( COAT, 0, 0.13, 0, 0.31, 0.29, 0.26 ), part( CREAM, 0, 0.04, 0.21, 0.22, 0.16, 0.07 ),
			part( DARK, - 0.12, 0.17, 0.237, 0.032, 0.042, 0.025, PAT.plain ), part( DARK, 0.12, 0.17, 0.237, 0.032, 0.042, 0.025, PAT.plain ),
			part( DARK, 0, 0.06, 0.28, 0.035, 0.025, 0.016, PAT.plain ), part( PINK, - 0.19, 0.05, 0.23, 0.04, 0.024, 0.018 ), part( PINK, 0.19, 0.05, 0.23, 0.04, 0.024, 0.018 ),
			part( COAT, - 0.25, 0.39, - 0.01, 0.13, 0.2, 0.09 ), part( COAT, 0.25, 0.39, - 0.01, 0.13, 0.2, 0.09 ),
			part( PINK, - 0.25, 0.39, 0.075, 0.07, 0.12, 0.02 ), part( PINK, 0.25, 0.39, 0.075, 0.07, 0.12, 0.02 ) ], this.head );
		this.arms = []; this.legs = [];
		for ( const side of [ - 1, 1 ] ) {
			const arm = new Group(); arm.position.set( side * 0.24, 0.75, 0 ); this.model.add( arm );
			mesh( [ part( COAT, side * 0.06, - 0.12, 0, 0.1, 0.19, 0.1 ) ], arm ); this.arms.push( arm );
			const leg = new Group(); leg.position.set( side * 0.13, 0.32, 0 ); this.model.add( leg );
			mesh( [ part( COAT, 0, - 0.13, 0.02, 0.11, 0.17, 0.12 ), part( CREAM, 0, - 0.25, 0.07, 0.11, 0.06, 0.13 ) ], leg ); this.legs.push( leg );
		}
		const p = app.player.position, yaw = app.player.yaw;
		this.group.position.copy( p );
		this.group.position.x -= Math.sin( yaw ) * 2.4;
		this.group.position.z -= Math.cos( yaw ) * 2.4;
		app.colliders.resolveCapsule( this.group.position, 0.28, 1.2 );
		this.group.position.y = this._ground( this.group.position.x, this.group.position.z, p.y + 0.6 );
		this.group.rotation.y = yaw + Math.PI;
		app.scene.add( this.group );
		this.goal = 'explore'; this.target = null; this.goalTimer = 0; this.saveTimer = 15; this.elapsed = 0; this.eventCooldown = 25;
		this.nextHop = 10 + Math.random() * 8; this.hopStart = - 1; this.wasNear = true;
		this.gesture = null; this.gestureStart = 0; this.gestureUntil = 0; this.homeStage = null; this.homeTarget = null;
		this.nav = null; this.navPath = []; this.navTarget = null; this.navTimer = 0; this.navStartDistance = Infinity; this.navRetry = 0;
		this.lastCatch = app.game?.state?.lastCatch; this.lastHome = app.homeLife?.saveState?.home || null;
	}

	_ground( x, z, maxY ) {
		const terrain = this.app.terrainData.heightAt( x, z );
		return Math.max( terrain, this.app.colliders.groundHeightAt( x, z, maxY ) );
	}
	_navigationSample( from, x, z ) {
		let ground = this._ground( x, z, from.y + 0.45 );
		if ( ! Number.isFinite( ground ) || ground < - 0.05 || ground - from.y >= 0.45 || ground - from.y < - 0.6 ) return null;
		const probe = new Vector3( x, ground, z );
		this.app.colliders.resolveCapsule( probe, 0.28, 1.2, 0.4 );
		if ( Math.hypot( probe.x - x, probe.z - z ) > 0.1 ) return null;
		ground = this._ground( probe.x, probe.z, from.y + 0.45 );
		if ( ! Number.isFinite( ground ) || ground < - 0.05 || ground - from.y >= 0.45 || ground - from.y < - 0.6 ) return null;
		return { x: probe.x, y: ground, z: probe.z };
	}

	_save() { try { localStorage.setItem( COMPANION_SAVE_KEY, JSON.stringify( this.state ) ); } catch { /* optional storage */ } }
	command( command ) {
		if ( ! COMPANION_ACTIONS.includes( command ) ) return false;
		const homeId = this.app.homeLife?.saveState?.home;
		if ( command === 'home' && ! this.app.village.enterable.some( h => h.name === homeId && h.bed && h.door ) ) return false;
		if ( [ 'jump', 'wave', 'dance', 'spin' ].includes( command ) ) {
			if ( command === 'jump' || command === 'dance' || command === 'spin' ) { this.state.command = 'wait'; this.goal = 'wait'; this.target = null; }
			this.gesture = command; this.gestureStart = this.elapsed; this.gestureUntil = this.elapsed + ( command === 'dance' ? 4 : command === 'wave' ? 2.5 : command === 'spin' ? 2 : 1 );
			if ( command === 'jump' ) this.hopStart = this.elapsed;
			this._save(); return true;
		}
		this.state.command = command === 'stand' ? 'wait' : command;
		this.gesture = null; this.target = null; this.goalTimer = 0; this.homeStage = null; this.homeTarget = null;
		this.nav = null; this.navPath = []; this.navTarget = null; this.navTimer = 0; this.navRetry = 0;
		this.goal = chooseCompanionGoal( this.state, { hour: this.app.settings.timeOfDay, hasHome: !! homeId, playerMode: this.app.player.mode } );
		this._save(); return true;
	}
	remember( type, detail = '', once = false ) {
		const day = this.app.homeLife?.saveState?.day || 1;
		const added = addMemory( this.state, type, day, detail, once );
		if ( added ) this._save();
		return added;
	}
	_announce( zh, en ) {
		if ( this.eventCooldown > 0 || this.app.expedition?.isOpen || this.app.settings.timeOfDay < 6 || this.app.settings.timeOfDay >= 21 ) return;
		this.eventCooldown = 100;
		this.app.expedition?.companionEvent( zh, en );
	}
	update( dt ) {
		if ( ! Number.isFinite( dt ) || dt <= 0 ) return;
		dt = Math.min( dt, 0.1 ); this.elapsed += dt; this.eventCooldown -= dt; this.saveTimer -= dt; this.goalTimer -= dt;
		const app = this.app, player = app.player, time = app.settings.timeOfDay;
		const homeId = app.homeLife?.saveState?.home;
		const home = app.village.enterable.find( h => h.name === homeId && h.bed );
		const distanceToPlayer = Math.hypot( player.position.x - this.group.position.x, player.position.z - this.group.position.z );
		const near = distanceToPlayer < 2.8 && Math.abs( player.position.y - this.group.position.y ) < 2;
		if ( near && ! this.wasNear ) this._announce( '你来啦！今天想一起做什么？', 'There you are! What shall we do today?' );
		this.wasNear = near;
		const catchInfo = app.game?.state?.lastCatch;
		if ( catchInfo && catchInfo !== this.lastCatch ) {
			this.lastCatch = catchInfo;
			if ( this.remember( 'first_fish', `${ catchInfo.species } ${ catchInfo.kg }kg`, true ) ) this._announce( '我们一起见证了第一条鱼！', 'We saw our first fish together!' );
			if ( catchInfo.kg >= 5 && this.remember( 'large_fish', `${ catchInfo.species } ${ catchInfo.kg }kg`, true ) ) this._announce( '这条鱼真大，我会记住这次收获！', 'That is a big fish! I will remember this catch.' );
		}
		if ( homeId && homeId !== this.lastHome ) { this.lastHome = homeId; this.remember( 'first_home', homeId, true ); this._announce( '我们有海岛家园了，真想好好看看！', 'We have an island home! I would love to explore it.' ); }
		if ( this.saveTimer <= 0 ) { this.saveTimer = 15; this._save(); }
		if ( app.homeLife?.sleeping ) { this.state.energy = Math.min( 100, this.state.energy + dt * 2 ); this.goal = 'rest'; this._animate( dt, false ); return; }
		if ( this.goalTimer <= 0 ) {
			this.goalTimer = 1;
			const old = this.goal;
			this.goal = chooseCompanionGoal( this.state, { hour: time, hasHome: !! home, playerMode: player.mode } );
			if ( old !== this.goal ) this.target = null;
			const dist = Math.hypot( player.position.x - this.group.position.x, player.position.z - this.group.position.z );
			if ( this.goal === 'follow' || ( this.goal === 'explore' && dist > 8 ) ) this.target = { x: player.position.x, z: player.position.z, stop: 1.5 };
			else if ( this.goal === 'home' && home ) {
				if ( this.homeTarget !== home.name ) { this.homeTarget = home.name; this.homeStage = home.approach ? 'approach' : 'door'; }
				const doorDistance = Math.hypot( this.group.position.x - home.door.x, this.group.position.z - home.door.z );
				const bedDistance = Math.hypot( this.group.position.x - home.bed.x, this.group.position.z - home.bed.z );
				if ( bedDistance < 1.5 && Math.abs( this.group.position.y - home.floorY ) < 1 ) this.homeStage = 'bed';
				if ( this.homeStage === 'approach' && ( ( doorDistance < 1.8 && Math.abs( this.group.position.y - home.floorY ) < 0.4 ) || Math.hypot( this.group.position.x - home.approach.x, this.group.position.z - home.approach.z ) < 0.75 ) ) this.homeStage = 'door';
				if ( this.homeStage !== 'bed' && doorDistance < 1.35 && Math.abs( this.group.position.y - home.floorY ) < 1 ) {
					home.open = true; home.door.door.solid = false; this.homeStage = 'bed';
				}
				this.target = this.homeStage === 'bed' ? { x: home.bed.x, z: home.bed.z, stop: 1 } : this.homeStage === 'approach' ? { x: home.approach.x, z: home.approach.z, stop: 0.45 } : { x: home.door.x, z: home.door.z, stop: 0.9 };
			}
			else if ( this.goal === 'explore' && ( ! this.target || Math.hypot( this.target.x - this.group.position.x, this.target.z - this.group.position.z ) < 0.8 ) ) {
				const a = Math.random() * Math.PI * 2, radius = 1.5 + Math.random() * 2;
				this.target = { x: player.position.x + Math.cos( a ) * radius, z: player.position.z + Math.sin( a ) * radius, stop: 0.45 };
			} else if ( this.goal === 'wait' || this.goal === 'rest' ) this.target = null;
		}
		let moving = false;
		if ( this.target ) {
			const p = this.group.position;
			if ( ! this.navTarget || Math.hypot( this.target.x - this.navTarget.x, this.target.z - this.navTarget.z ) > 1.5 ) {
				this.nav = null; this.navPath = []; this.navTarget = { ...this.target }; this.navTimer = 0; this.navStartDistance = Math.hypot( this.target.x - p.x, this.target.z - p.z );
			}
			this.navRetry = Math.max( 0, this.navRetry - dt );
			while ( this.navPath.length && Math.hypot( this.navPath[ 0 ].x - p.x, this.navPath[ 0 ].z - p.z ) < 0.38 ) this.navPath.shift();
			if ( this.nav ) {
				const result = this.nav.step( 5 );
				if ( result.status === 'found' ) { this.navPath = result.path; this.nav = null; this.navTimer = 0; }
				else if ( result.status === 'failed' ) { this.nav = null; this.navRetry = 8; this.navTimer = 0; }
			}
			const finalDistance = Math.hypot( this.target.x - p.x, this.target.z - p.z );
			if ( ! this.nav && ! this.navPath.length && finalDistance > this.target.stop + 0.5 ) {
				this.navTimer += dt;
				if ( this.navTimer >= 3 ) {
					if ( this.navStartDistance - finalDistance < 0.35 && this.navRetry <= 0 ) this.nav = new CompanionNavigation( p, this.target, ( from, x, z ) => this._navigationSample( from, x, z ) );
					this.navTimer = 0; this.navStartDistance = finalDistance;
				}
			} else if ( this.navPath.length ) { this.navTimer = 0; this.navStartDistance = finalDistance; }
			const destination = this.navPath[ 0 ] || this.target;
			const dx = destination.x - p.x, dz = destination.z - p.z, distance = Math.hypot( dx, dz );
			if ( ! this.nav && distance > destination.stop ) {
				const step = Math.min( distance - destination.stop, dt * 1.05 );
				const angle = Math.atan2( dx, dz );
				let best = null, bestScore = Infinity;
				for ( const offset of [ 0, 0.7, - 0.7, 1.35, - 1.35 ] ) {
					const heading = angle + offset;
					const next = new Vector3( p.x + Math.sin( heading ) * step, p.y, p.z + Math.cos( heading ) * step );
					app.colliders.resolveCapsule( next, 0.28, 1.2, 0.4 );
					let ground = this._ground( next.x, next.z, p.y + 0.45 );
					next.y = ground;
					if ( Number.isFinite( ground ) ) app.colliders.resolveCapsule( next, 0.28, 1.2, 0.4 );
					ground = this._ground( next.x, next.z, p.y + 0.45 );
					const travel = Math.hypot( next.x - p.x, next.z - p.z );
					// Colliders can push an already-overlapping capsule clear by more
					// than one frame's step when terrain height changes near a wall.
					const maxDrop = this.goal === 'home' && home && Math.abs( p.y - home.floorY ) < 0.4 ? 0.3 : 0.6;
					if ( ! Number.isFinite( ground ) || ground < - 0.05 || ground - p.y >= 0.45 || ground - p.y < - maxDrop || travel < step * 0.2 || travel > Math.max( 0.4, step * 2.5 ) ) continue;
					const score = Math.hypot( destination.x - next.x, destination.z - next.z );
					if ( score < bestScore ) { best = { next, ground, heading }; bestScore = score; }
					if ( offset === 0 && score < distance - step * 0.4 ) break;
				}
				if ( best ) {
					p.set( best.next.x, best.ground, best.next.z ); moving = true;
					const delta = Math.atan2( Math.sin( best.heading - this.group.rotation.y ), Math.cos( best.heading - this.group.rotation.y ) );
					this.group.rotation.y += delta * Math.min( 1, dt * 5 );
				} else if ( this.goal === 'explore' && ! this.navPath.length ) this.target = null;
			}
		} else { this.nav = null; this.navPath = []; this.navTarget = null; this.navTimer = 0; }
		this.state.energy = Math.max( 0, Math.min( 100, this.state.energy + dt * ( moving ? - 0.025 : 0.045 ) ) );
		if ( ! moving && this.goal === 'follow' && distanceToPlayer > 0.1 ) {
			const toward = Math.atan2( player.position.x - this.group.position.x, player.position.z - this.group.position.z );
			const turn = Math.atan2( Math.sin( toward - this.group.rotation.y ), Math.cos( toward - this.group.rotation.y ) );
			this.group.rotation.y += turn * Math.min( 1, dt * 4 );
		}
		if ( this.state.command === 'sleep' ) this.state.energy = Math.min( 100, this.state.energy + dt * 0.3 );
		this.state.curiosity = Math.max( 0, Math.min( 100, this.state.curiosity + dt * ( moving ? - 0.015 : 0.025 ) ) );
		this.state.mood = this.state.energy < 25 ? 'tired' : near && this.state.bond > 0 ? 'happy' : 'content';
		if ( moving && this.elapsed >= this.nextHop ) { this.hopStart = this.elapsed; this.nextHop = this.elapsed + 14 + Math.random() * 12; }
		this._animate( dt, moving );
	}
	_animate( dt, moving ) {
		const t = this.elapsed, sitting = this.goal === 'rest' || ( this.goal === 'home' && ! moving );
		const hopPhase = t - this.hopStart;
		const hopping = this.hopStart >= 0 && hopPhase >= 0 && hopPhase < 0.85;
		const hop = hopping ? Math.sin( hopPhase / 0.85 * Math.PI ) * 0.34 : 0;
		const sleepingPose = this.state.command === 'sleep' && ! moving;
		if ( this.gesture && t >= this.gestureUntil ) this.gesture = null;
		const dancing = this.gesture === 'dance';
		this.model.rotation.y = this.gesture === 'spin' ? ( t - this.gestureStart ) / 2 * Math.PI * 2 : 0;
		this.model.position.y = sleepingPose ? 0.28 : sitting ? - 0.18 : ( moving ? Math.abs( Math.sin( t * 5 ) ) * 0.045 : Math.sin( t * 2 ) * 0.008 ) + hop;
		this.model.rotation.z = sleepingPose ? 1.35 : dancing ? Math.sin( t * 7 ) * 0.24 : Math.sin( t * ( moving ? 5 : 1 ) ) * ( moving ? 0.07 : 0.018 );
		this.head.rotation.z = Math.sin( t * 1.2 ) * 0.035;
		for ( let i = 0; i < 2; i ++ ) {
			const swing = moving ? Math.sin( t * 7 + i * Math.PI ) : 0;
			this.legs[ i ].rotation.x = sitting ? - 1.05 : swing * 0.55;
			this.arms[ i ].rotation.x = - swing * 0.35;
			this.arms[ i ].rotation.z = this.gesture === 'wave' && i === 1 ? 2.1 + Math.sin( t * 10 ) * 0.3 : dancing ? ( i ? 1 : - 1 ) * ( 1.1 + Math.sin( t * 7 ) * 0.3 ) : 0;
		}
	}
}
