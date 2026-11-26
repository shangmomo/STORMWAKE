import {ElementalEffects} from './ElementalEffects.js';
import {isElemental} from './ElementalSkills.js';
import { CircleGeometry, Mesh, TorusGeometry, Vector3 } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { LAYERS } from '../core/SceneRenderer.js';
import { SPRAY } from '../fx/Spray.js';
import { G } from '../engine/webgpu.js';

const clamp = ( n, lo = 0, hi = 1 ) => Math.max( lo, Math.min( hi, n ) );
const easing = t => t * t * ( 3 - 2 * t );
const ID_COLORS = { turtle: 0xa7dcc6, shark: 0xe0edee, squid: 0x8d86ac, leviathan: 0x87dfe7 };

// Body-weight acting remains available to lower-detail fallback rigs. On the
// new genuine glTF armatures its intensity is reduced, because per-joint posing
// supplies the neck, tentacle, jaw, tail and flipper movement independently.
export function titanPose( id, brain, time, healthFraction = 1, pain = 0, release = 0 ) {
	const fast = clamp( brain.currentSpeed / 22 );
	const wind = brain.state === 'windup' ? clamp( 1 - brain.windup / Math.max( brain.attack?.windup || 2, 0.1 ) ) : 0;
	const charge = brain.state === 'charge' ? 1 : 0;
	const rage = healthFraction <= 0.5 ? 1.3 : 1;
	const pulse = Math.sin( time * ( 1.2 + fast * 3 ) ) * rage;
	const strike = Math.sin( Math.PI * clamp( release ) );
	if ( id === 'shark' ) return {
		y: pulse * ( 0.21 + fast * 0.34 ) - wind * 1.25 + charge * 0.5 + strike * 1.3,
		pitch: wind * - 0.21 + charge * 0.17 - strike * 0.28,
		roll: Math.sin( time * 1.3 ) * ( 0.03 + fast * 0.12 ) + pain * 0.18,
		scale: 1 + wind * 0.08 - pain * 0.025,
	};
	if ( id === 'turtle' ) return {
		y: Math.sin( time * 0.64 ) * 0.4 - wind * 1.3 + strike * 2.0,
		pitch: Math.sin( time * 0.44 ) * 0.045 - wind * 0.15 + strike * 0.19,
		roll: Math.sin( time * 0.52 ) * 0.05 + wind * 0.13 + pain * 0.12,
		scale: 1 + wind * 0.04 + strike * 0.04,
	};
	if ( id === 'squid' ) return {
		y: Math.sin( time * 1.05 ) * 0.7 + wind * 3.6 + strike * 1.2,
		pitch: wind * 0.16 - strike * 0.2 + Math.sin( time * 0.7 ) * 0.04,
		roll: Math.sin( time * 0.82 ) * ( 0.08 + fast * 0.05 ) + pain * 0.14,
		scale: 1 + wind * 0.14 - pain * 0.045,
	};
	return {
		y: Math.sin( time * 0.5 ) * 0.7 + wind * 7.2 + strike * 3.5,
		pitch: wind * 0.32 - strike * 0.26 + Math.sin( time * 0.38 ) * 0.055,
		roll: Math.sin( time * 0.44 ) * 0.06 + wind * 0.12 + pain * 0.15,
		scale: 1 + wind * 0.08 + strike * 0.11,
	};
}

function ringMesh( geometry, hex, name ) {
	const material = new Material( {
		name, color: hex, emissive: hex, lit: false, transparent: true, opacity: 0,
		side: 'double', blending: 'normal', depthWrite: false, velocityWeight: 0,
	} );
	const ring = new Mesh( geometry, material );
	ring.layers.set( LAYERS.TRANSPARENT );
	ring.rotation.x = Math.PI / 2;
	ring.frustumCulled = false; ring.visible = false;
	return ring;
}

export class TitanEffects {
	constructor( app, species ) {
		this.app = app;
		this.units = new Map();
		this.elemental = new ElementalEffects(app.scene);
		this.geometry = new TorusGeometry( 1, 0.025, 5, 96 );
		this.inkGeometry = new CircleGeometry( 1, 64 ).rotateX( - Math.PI / 2 );
		this.flash = 0; this.shake = 0; this.shakeTick = 0;
		this.overlay = document.createElement( 'div' );
		this.overlay.className = 'hunt-cinematic-impact';
		// The game uses a DOM; older headless combat suites provide a minimal
		// element stub without CSSStyleDeclaration.
		this.overlay.style ||= {};
		this.overlay.setAttribute?.( 'aria-hidden', 'true' );
		document.body.append( this.overlay );
		this.callout = document.createElement( 'div' );
		this.callout.className = 'hunt-attack-callout';
		this.callout.style ||= {};
		document.body.append( this.callout );
		for ( const boss of species ) {
			const warning = ringMesh( this.geometry, 0xf7bd74, `TitanWarning_${ boss.id }` );
			const wave = ringMesh( this.geometry, ID_COLORS[ boss.id ], `TitanWave_${ boss.id }` );
			const echo = ringMesh( this.geometry, ID_COLORS[ boss.id ], `TitanWaveEcho_${ boss.id }` );
			const ink = new Mesh( this.inkGeometry, new Material( {
				name: `KrakenInk_${ boss.id }`, color: 0x100d23, emissive: 0x120a20,
				lit: false, transparent: true, opacity: 0, depthWrite: false, side: 'double',
			} ) );
			ink.layers.set( LAYERS.TRANSPARENT ); ink.visible = false;
			app.scene.add( warning, wave, echo, ink );
			const unit = { warning, wave, warnLeft: 0, warnTotal: 0, warnRadius: 0,
				echo, ink, inkLeft: 0, inkTotal: 0, inkRadius: 0,
				waveLeft: 0, waveTotal: 0, waveRadius: 0, crestLeft: 0, crestStep: 0, kind: null, skill: '', pulse: 0, trail: 0, hurt: 0,
				lastRelease: null };
			this.units.set( boss.id, unit );
		}
	}

	nearEnough( b ) {
		const p = this.app.boatCtl.position;
		return Math.hypot( b.brain.x - p.x, b.brain.z - p.z ) < 390;
	}

	telegraph( b, event ) {
		const u = this.units.get( b.id );
		if ( ! u || ! this.nearEnough( b ) ) return;
		u.warnTotal = Math.max( 0.4, event.windup || 1.5 );
		u.warnLeft = u.warnTotal; u.warnRadius = event.radius || b.attackRange;
		u.kind = event.kind; u.skill = event.skill || b.attack;
	}

	release( b, event ) {
		const u = this.units.get( b.id );
		if ( ! u ) return;
		const key = `${ b.spawn }:${ event.kind }:${ event.sequence }`;
		if ( u.lastRelease === key ) return; // Co-op AOE has multiple victims.
		u.lastRelease = key;
		if (!event.visualOnly) this.app.hunt?.bosses?.contacts?.release(b,event);
		if (!this.nearEnough(b)) return;
		this.elemental.release(b,event);
		u.warnLeft = 0;
		u.castX = Number.isFinite(event.x)?event.x:b.brain.x; u.castZ = Number.isFinite(event.z)?event.z:b.brain.z;
		// The real ocean bore lasts long enough to sweep across the ship;
		// spray follows the same 23 m/s front for several seconds.
		u.waveTotal = 6.2;
		u.waveLeft = u.waveTotal;
		u.waveRadius = event.radius || b.attackRange;
		u.pulse = 1;
		u.kind = event.kind;
		// This drives actual ocean height and the GPU boat-water queries, not
		// merely the visible warning circle. Each skill has its own energy.
		const displacement = { vortex: 2.7, charge: 3.1, grapple: 3.2, ink: 2.5,
			triple_bite: 4.0, shockwave: 4.6, maelstrom: 5.0 }[ event.kind ] ?? 2.8;
		if (!event.visualOnly) this.app.surface?.emitTitanWave?.( u.castX, u.castZ, displacement, G.time.value );
		if ( !event.visualOnly && (event.kind === 'ink' || event.kind === 'grapple') ) this.app.surface?.emitTitanInk?.(
			u.castX, u.castZ, event.kind === 'ink' ? 1.85 : 1.15, G.time.value );
		u.crestLeft = 0;
		u.crestStep = 0;
		if ( event.kind === 'ink' || event.kind === 'grapple' ) {
			u.inkTotal = event.kind === 'ink' ? 5.2 : 2.8;
			u.inkLeft = u.inkTotal;
			u.inkRadius = event.kind === 'ink' ? 43 : 24;
		}
		// A sufficiently close miss still produces a low-frequency scene jolt;
		// the red damage flash remains reserved for genuine hull collisions.
		const p = this.app.boatCtl.position;
		const proximity = clamp( 1 - Math.hypot( b.brain.x - p.x, b.brain.z - p.z ) / Math.max( u.waveRadius * 2, 110 ) );
		this.shake = Math.max( this.shake, proximity * ( event.kind === 'maelstrom' ? 0.22 : 0.11 ) );
		this.splash( b, event.kind, event.kind === 'maelstrom' ? 1.7 : 1 );
		this.app.audio?.seaTitanImpact?.( b.pos, event.kind === 'maelstrom' ? 1.4 : 0.85 );
	}

	impact( b, scale = 1 ) {
		const u = this.units.get( b.id );
		if ( ! u || ! this.nearEnough( b ) ) return;
		u.hurt = 0.65;
		this.splash( b, 'hit', scale * 0.32 );
	}

	enrage( b ) {
		this.app.surface?.emitTitanWave?.( b.brain.x, b.brain.z, 1.25, G.time.value );
		this.splash( b, 'enrage', 1.3 );
		const u = this.units.get( b.id );
		if ( u ) { u.waveTotal = 1.4; u.waveLeft = 1.4; u.waveRadius = Math.min( 90, b.radius * 4 ); u.pulse = 1; }
	}

	death( b ) {
		this.app.surface?.emitTitanWave?.( b.brain.x, b.brain.z, 2.5, G.time.value );
		const u = this.units.get( b.id );
		if ( u ) { u.warnLeft = 0; u.waveTotal = 2; u.waveLeft = 2; u.waveRadius = b.radius * 3.1; u.pulse = 1; }
		this.splash( b, 'death', 1.8 );
		this.app.audio?.seaTitanImpact?.( b.pos, 1.2 );
	}

	shipHit( damage ) {
		const strength = clamp( damage / 75, 0.18, 1 );
		this.flash = Math.max( this.flash, strength );
		this.shake = Math.max( this.shake, strength * 0.36 );
		this.app.audio?.hullSlap?.( strength );
	}

	// Contact-driven response emitted at the real, pose-sampled jaw or sucker
	// endpoint. It perturbs the existing physically shaded ocean surface, never
	// introduces a differently coloured decal or a duplicate water material.
	contact( boss, position, type, strength = 1 ) {
		this.shake = Math.max( this.shake, clamp( strength * ( type === 'bite' ? .18 : .075 ), 0, .34 ) );
		this.app.surface?.emitTitanWave?.( position.x, position.z, type === 'bite' ? 1.1 : .62, G.time.value );
		const spray = this.app.spray;
		if ( spray && spray.nReq < 22 ) {
			const count = type === 'bite' ? 8 : 5;
			for ( let j = 0; j < count && spray.nReq < 29; j ++ ) {
				const a = j * Math.PI * 2 / count;
				const origin = new Vector3( position.x + Math.cos( a ) * .6, .5, position.z + Math.sin( a ) * .6 );
				const velocity = new Vector3( Math.cos( a ) * 2.4, 3.8 + strength * 2.3, Math.sin( a ) * 2.4 );
				spray.emit( origin, velocity, 12, .14, SPRAY.SPRAY, { spread: 1.5, jitter: .22, life: 1.05 } );
			}
		}
		this.app.audio?.hullSlap?.( type === 'bite' ? .36 : .16 );
	}

	splash( b, kind, intensity = 1 ) {
		const spray = this.app.spray;
		if ( ! spray || ! this.nearEnough( b ) || spray.nReq >= 22 ) return;
		const count = kind === 'hit' ? 3 : kind === 'charge' ? 2 : kind === 'death' ? 11 : 8;
		const front = kind === 'triple_bite' ? b.radius * 0.85 : kind === 'charge' ? b.radius * 0.9 : 0;
		const fx = Math.sin( b.brain.heading ), fz = Math.cos( b.brain.heading );
		for ( let j = 0; j < count && spray.nReq < 29; j ++ ) {
			const a = j * Math.PI * 2 / count;
			const r = ( kind === 'maelstrom' ? 29 : kind === 'vortex' ? 23 : b.radius * 0.48 ) * intensity;
			const p = new Vector3( b.brain.x + fx * front + Math.cos( a ) * r, 0.55,
				b.brain.z + fz * front + Math.sin( a ) * r );
			const v = new Vector3( Math.cos( a ) * ( 2.5 + intensity * 4 ), 5 + intensity * 5,
				Math.sin( a ) * ( 2.5 + intensity * 4 ) );
			spray.emit( p, v, Math.round( 14 * intensity ), 0.18 + intensity * 0.055, SPRAY.SPRAY,
				{ spread: 1.8 + intensity * 1.5, jitter: 0.25, life: 1.5 + intensity * 0.55 } );
		}
	}

	reset(b){const u=this.units.get(b.id);if(u){u.warnLeft=u.waveLeft=u.inkLeft=u.pulse=u.hurt=0;u.lastRelease=null;u.warning.visible=u.wave.visible=u.echo.visible=u.ink.visible=false;}this.elemental.reset(b.id);}

	update( dt, bosses ) {
		this.elemental.update(dt,this.app.camera?.position);
		this.flash = Math.max( 0, this.flash - dt * 1.95 );
		this.shake = Math.max( 0, this.shake - dt * 0.62 );
		this.overlay.style.opacity = String( clamp( this.flash ) * 0.85 );
		if ( this.shake > 0.001 && ! this.app.freeCam ) {
			this.shakeTick += dt * 30;
			this.app.camera.position.x += Math.sin( this.shakeTick * 1.97 ) * this.shake * 0.42;
			this.app.camera.position.y += Math.sin( this.shakeTick * 2.69 ) * this.shake * 0.32;
		}
		let mostUrgent = null;
		for ( const b of bosses ) {
			const u = this.units.get( b.id );
			if ( ! u ) continue;
			u.hurt = Math.max( 0, u.hurt - dt );
			u.pulse = Math.max( 0, u.pulse - dt * 1.35 );
			u.trail -= dt;
			const visible = this.nearEnough( b ) && b.health > 0;
			if ( visible && b.brain.state === 'charge' && u.trail <= 0 ) {
				u.trail = 0.15;
				this.splash( b, 'charge', 0.6 );
			}
			u.warnLeft = Math.max( 0, u.warnLeft - dt );
			u.waveLeft = Math.max( 0, u.waveLeft - dt );
			u.crestLeft -= dt;
			u.inkLeft = Math.max( 0, u.inkLeft - dt );
			const warn = u.warnLeft > 0 && visible && b.brain.state !== 'return';
			u.warning.visible = warn;
			if ( warn ) {
				if ( ! mostUrgent || u.warnLeft < mostUrgent.time ) mostUrgent = { name: b.name, skill: u.skill, time: u.warnLeft, portion: u.warnLeft / u.warnTotal };
				const completion = 1 - u.warnLeft / u.warnTotal;
				const k = 1 + Math.sin( completion * Math.PI * 9 ) * 0.018;
				u.warning.position.set( b.brain.x, 1.4, b.brain.z );
				u.warning.scale.setScalar( u.warnRadius * k );
				u.warning.material.opacity = 0.19 + 0.36 * completion;
			}
			const wave = u.waveLeft > 0 && this.nearEnough( b );
			// No colored torus decal: actual sea vertices, FFT normal/foam,
			// water BRDF and spray now render the attack coherently.
			u.wave.visible = false;
			u.echo.visible = false;
			if ( wave ) {
				const t = easing( 1 - u.waveLeft / u.waveTotal );
				if ( u.crestLeft <= 0 && u.crestStep < 38 && (!isElemental(u.kind) || 5+(u.waveTotal-u.waveLeft)*23 <= u.waveRadius) ) {
					u.crestLeft = 0.155;
					u.crestStep ++;
					this.crestSpray( b, 5 + ( u.waveTotal - u.waveLeft ) * 23, u.crestStep, u.castX, u.castZ );
				}
				u.wave.position.set( b.brain.x, 1.7 + t * 0.16, b.brain.z );
				u.wave.scale.setScalar( Math.max( 1, b.radius * 0.55 + ( u.waveRadius - b.radius * 0.55 ) * t ) );
				u.wave.material.opacity = 0.58 * ( 1 - t ) ** 0.85;
				u.echo.position.set( b.brain.x, 1.55, b.brain.z );
				u.echo.scale.setScalar( Math.max( 1, b.radius * 0.4 + ( u.waveRadius * 0.72 - b.radius * 0.4 ) * easing( clamp( t * 0.82 ) ) ) );
				u.echo.material.opacity = 0.31 * ( 1 - t );
			}
			const ink = u.inkLeft > 0 && this.nearEnough( b );
			// Ink darkness, motion and diffusion are sampled within WaterMaterial.
			// The old semi-transparent purple disk is intentionally disabled.
			u.ink.visible = false;
			if ( ink ) {
				const t = 1 - u.inkLeft / u.inkTotal;
				u.ink.position.set( b.brain.x, 1.3, b.brain.z );
				u.ink.scale.setScalar( u.inkRadius * ( 0.25 + 0.75 * Math.min( 1, t * 3 ) ) );
				u.ink.material.opacity = ( 0.39 + 0.10 * Math.sin( t * 13 ) ) * ( 1 - easing( clamp( ( t - 0.55 ) / 0.45 ) ) );
			}
		}
		this.callout.textContent = mostUrgent ? `⚠ ${ mostUrgent.name } · ${ mostUrgent.skill } · ${ mostUrgent.time.toFixed( 1 ) } 秒` : '';
		this.callout.style.opacity = mostUrgent ? String( 0.65 + 0.35 * ( 1 - mostUrgent.portion ) ) : '0';
	}

	crestSpray( b, radius, sequence, castX=b.brain.x, castZ=b.brain.z ) {
		const spray = this.app.spray;
		if ( ! spray || spray.nReq > 19 || ! this.nearEnough( b ) ) return;
		// Concentrate real foam spray on the arc seen from the ship. Distributed
		// full-circle decals were too faint and wasted GPU particles offscreen.
		const ship = this.app.boatCtl.position;
		const bearing = Math.atan2( ship.z - castZ, ship.x - castX );
		for ( let i = 0; i < 6 && spray.nReq < 24; i ++ ) {
			const angle = bearing + ( i - 2.5 ) * .23 + Math.sin( sequence * 1.7 + i ) * .11;
			const x = Math.cos( angle ), z = Math.sin( angle );
			const px = castX + x * radius, pz = castZ + z * radius;
			if ( Math.hypot( px - ship.x, pz - ship.z ) > 115 ) continue;
			spray.emit( new Vector3( px, 1.15, pz ),
				new Vector3( x * 7.2, 5.2 + ( b.id === 'leviathan' ? 4.0 : 0 ), z * 7.2 ),
				15, 0.21, SPRAY.SPRAY, { spread: 3.6, jitter: 0.34, life: 1.3 } );
		}
	}
}
