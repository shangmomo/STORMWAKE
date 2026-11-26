import * as THREE from '../engine/index.js';
import { WORLD } from '../world/WorldLayout.js';
import { SailWind } from '../ship/SailWind.js';
import { ShipAnchorTether } from '../ship/ShipAnchorTether.js';
import {vortexForceAt} from '../offshore/OffshoreField.js';
import {ANCHOR_HAWSE,ANCHOR_HEIGHT} from '../ship/AnchorKinematics.js';

const RHO = 1025; // sea water density
const GRAV = 9.81;
const DEG = Math.PI / 180;

const sstep = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;

// scratch (the integrator runs at 120 Hz: no allocations in the loop)
const _F = new THREE.Vector3();
const _T = new THREE.Vector3();
const _com = new THREE.Vector3();
const _p = new THREE.Vector3();
const _r = new THREE.Vector3();
const _f = new THREE.Vector3();
const _vp = new THREE.Vector3();
const _vl = new THREE.Vector3();
const _a = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _side = new THREE.Vector3();
const _up = new THREE.Vector3();
const _v = new THREE.Vector3();
const _rud = new THREE.Vector3();
const _g = new THREE.Vector3();
const _t = new THREE.Vector3();
const _c1 = new THREE.Vector3();
const _c2 = new THREE.Vector3();
const _c3 = new THREE.Vector3();
const _c4 = new THREE.Vector3();
const _c5 = new THREE.Vector3();
const _invQ = new THREE.Quaternion();
const _dq = new THREE.Quaternion();

// Rigid-body model of an 8.2 m, 3.2 t Downeast lobster boat (semi-displacement hull, full keel).
//
// Hydrostatics come from the hull model's buoyancy samples (waterplane patches, water heights
// queried on the GPU). The samples are laid out as a slightly narrower / shorter "effective"
// waterplane so the boat has a lobster boat's feel rather than the stiffness of the bare canoe
// body: GM ~0.6 m, roll ~3.3 s, pitch ~1.8 s, heave ~1.25 s, all well damped. Added mass and
// inertia (heave, pitch, sway...) scale with how much of the hull is in the water.
//
// Manoeuvring: calm-water resistance curve with the wave-making hump past hull speed; propeller
// thrust from a spooling engine (falls off towards the pitch speed); rudder as a lifting surface
// in the propeller race; hull lift and cross-flow drag along the keel (directional stability, the
// turning circle, speed lost in turns, outward heel); running trim and rise with speed (the bow
// lifts over the hump, then runs at a few degrees); prop walk astern. Grounding, pier piles and
// mooring lines as before.
export class BoatController {

	constructor( { model, query, terrain, colliders } ) {

		this.model = model;
		this.query = query;
		this.terrain = terrain;
		this.colliders = colliders;

		const hydro = model.hydro || {};
		this.mass = hydro.suggestedMass || 3200;
		this.com = hydro.centerOfMass ? new THREE.Vector3().copy( hydro.centerOfMass ) : new THREE.Vector3( 0, 0.3, - 0.74 );
        if(model.shipScale)this.com.y-=.35; // low ballast on the heritage full-rigged ship
		// principal inertia in the boat frame (+Z forward, +X port): x = pitch, y = yaw, z = roll. Gear
		// high on deck (traps, hauler, wheelhouse) gives a larger roll radius than the bare hull.
		this.inertia = hydro.inertia ? hydro.inertia.clone() : new THREE.Vector3( 14600, 15700, 3500 );
		this.inertia.z *= model.shipScale ? 1.60 : 1.24;
		// added mass / inertia when fully wet (fraction of the rigid-body value): surge, sway, heave;
		// pitch, yaw, roll
		this.addedMass = new THREE.Vector3( 0.6, 0.7, 0.05 ); // x (sway), y (heave), z (surge)
		this.addedInertia = new THREE.Vector3( 1.0, 0.4, 0.2 ); // x (pitch), y (yaw), z (roll)

		// effective waterplane: lateral / longitudinal lever arms of the buoyancy samples
		const cbz = hydro.centerOfBuoyancy ? hydro.centerOfBuoyancy.z : this.com.z;
		const sx = 0.79, sz = 0.9;
		this.samples = model.hullSamples.map( ( s ) => ( {
			p: new THREE.Vector3( s.position.x * sx, s.position.y, cbz + ( s.position.z - cbz ) * sz ),
			area: s.area, bottom: s.bottomY ?? s.position.y,
		} ) );
		let pitchK = 0;
		for ( const s of this.samples ) pitchK += s.area * ( s.p.z - cbz ) ** 2;
		this.pitchStiffness = RHO * GRAV * pitchK; // N m / rad (for the running-trim moment)
		this.slot = query.allocate( 'boatHull', this.samples.length );

		// lateral stations along the keel: (z, lateral area m^2) for hull lift and cross-flow drag
		const shipS=model.shipScale||{x:1,y:1,z:1};
		const shipVolume=this.shipVolume=shipS.x*shipS.y*shipS.z;
		this.stations = [ [ - 3.4, 0.73 ], [ - 2.3, 0.78 ], [ - 1.2, 0.8 ], [ - 0.1, 0.77 ], [ 1.0, 0.62 ], [ 2.1, 0.33 ], [ 3.2, 0.14 ] ].map(([z,a])=>[z*shipS.z,a*shipS.y*shipS.z]);
		this.lateralY = 0.06*shipS.y; // height of the centre of lateral resistance (boat frame)
		this.bank = 0; // roll moment per (u * drift velocity): hull bottom lift banking into turns
		this.hullLift = 0.5; // lift coefficient of the hull + keel per radian of drift
		this.rudderLift = 2.8; // rudder lift slope (x area 0.12 m^2), includes the hull's flap effect

		// state (position = model origin at the design waterline)
		this.position = new THREE.Vector3().copy( WORLD.boatDock.position );
		this.quaternion = new THREE.Quaternion().setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), WORLD.boatDock.heading );
		this.velocity = new THREE.Vector3();
		this.angular = new THREE.Vector3();

		this.throttle = 0; // lever -1..1 (moves with some inertia)
		this.steer = 0; // wheel -1..1
		this.rpm = 0; // engine 0..1 (spools after the lever)
		this.maxThrust = 26000*shipVolume; // N, bollard pull at full rpm
		this.pitchSpeed = 16; // m/s, propeller pitch speed at full rpm (thrust -> 0 there)
		this.reverseFactor = 0.45; // astern thrust relative to ahead
		this.driven = false;
		this.voyageEnabled = false;
		this.voyageSails = { main: 0, jib: 0, trim: 0 };
		this.voyageWind = new SailWind();
		this.voyageSailForce = 0;
		this.offshoreTime = 0; // world clock, set once per frame by App
		this.voyageAnchor = false;
        this.anchorTravel = 0;
        this.anchorTether = new ShipAnchorTether();
		this.voyageAuxPower = .25;
		this.moored = true;
		this.mooring = { anchor: WORLD.boatDock.position.clone(), heading: WORLD.boatDock.heading };

		const n = this.samples.length;
		this.waterH = new Float32Array( n ); // latest read-back
		this.waterV = new Float32Array( n ); // vertical velocity of the water (m/s)
		this.waterOff = new Float32Array( n ); // blends the step when a new read-back arrives
		this.hEff = new Float32Array( n ); // water height used by the integrator (interpolated)
		this.qx = new Float32Array( n ); // query point + slope of the last result
		this.qz = new Float32Array( n );
		this.gx = new Float32Array( n );
		this.gz = new Float32Array( n );
		this.hasWater = false;
		this.wetFraction = 0;
		this.speed = 0;
		this.forwardSpeed = 0;
		this.thrust = 0;
		this.slam = 0;
		this.onSlam = null;
		this._acc = 0;
		this._age = 0; // s since the latest read-back was issued

		this.bowWorld = new THREE.Vector3();
		this.sternWorld = new THREE.Vector3();

		this.apply();

	}

	// world position of a local point
	toWorld( local, out ) {

		return out.copy( local ).applyQuaternion( this.quaternion ).add( this.position );

	}

	forward( out ) {

		return out.set( 0, 0, 1 ).applyQuaternion( this.quaternion );

	}

	// True capsize, not a normal wave-induced heel. Kept separate from the
	// original reset() because reset teleports the ship to the initial berth.
	get capsized() {
		return _up.set( 0, 1, 0 ).applyQuaternion( this.quaternion ).y < 0.6;
	}

	get hullWaterline() {
		if ( ! this.hasWater || ! this.waterH.length ) return 0;
		let height = 0, count = 0;
		for ( const h of this.waterH ) if ( Number.isFinite( h ) ) { height += h; count ++; }
		return count ? height / count : 0;
	}

	// A severely submerged but still upright hull is another recoverable soft-lock:
	// the helm can remain active even when its deck is well under water.
	get needsRecovery() {
		return this.capsized || ( this.hasWater && this.position.y < this.hullWaterline - 1.45 );
	}

	rightCapsizedBoat() {
		if ( ! this.needsRecovery ) return false;
		const heading = this.getYaw();
		const currentX = this.position.x, currentZ = this.position.z;
		const water = this.hullWaterline;
		// Only recover roll and pitch at the *same* ocean location. Zero angular
		// momentum to prevent immediate re-capsize; damp forward momentum rather
		// than accelerating or teleporting the vessel over the island.
		this.quaternion.setFromAxisAngle( _up.set( 0, 1, 0 ), heading );
		this.position.set( currentX, water + 0.15, currentZ );
		this.angular.set( 0, 0, 0 );
		this.velocity.multiplyScalar( 0.16 );
		this.waterOff.fill( 0 );
		this.waterV.fill( 0 );
		this._acc = 0;
		this.throttle = 0;
		this.rpm = 0;
		this.moored = false;
		this.apply();
		return true;
	}

	// Developer-only overseas relocation. Unlike reset(), this keeps the
	// selected hull, clears the old berth/mooring and invalidates water samples
	// from the previous location before another buoyancy integration step.
	teleportTo( x, z, heading = 0 ) {
		if ( ! [ x, z, heading ].every( Number.isFinite ) || Math.abs( x ) > 6000 || Math.abs( z ) > 6000 ) return false;
		if ( this.terrain?.heightAt && this.terrain.heightAt( x, z ) > - 6 ) return false;
		this.position.set( x, 0.35, z );
		this.quaternion.setFromAxisAngle( _up.set( 0, 1, 0 ), heading );
		this.velocity.set( 0, 0, 0 ); this.angular.set( 0, 0, 0 );
		this.throttle = 0; this.throttleTarget = 0; this.steer = 0; this.rpm = 0;
		this.speed = 0; this.forwardSpeed = 0; this.wetFraction = 0;
		this.moored = false;
        this.anchorTether.reset();
		this.mooring.anchor.set( x, 0, z ); this.mooring.heading = heading;
		this.waterH.fill( 0 ); this.hEff.fill( 0 ); this.waterOff.fill( 0 ); this.waterV.fill( 0 );
		this.gx.fill( 0 ); this.gz.fill( 0 );
		this.hasWater = false;
		this._acc = 0; this._age = 0;
		this._qVersion = this.query.version;
		this._qTime = this.query.resultTime;
		this.apply();
		return true;
	}

	setInput( throttle, steer, dt ) {

		// the throttle lever moves with some inertia (the engine then spools after it); the rudder
		// follows the wheel
		this.throttleTarget = throttle;
		this.throttle += ( throttle - this.throttle ) * ( 1 - Math.exp( - dt * 2.2 ) );
		this.steer += ( steer - this.steer ) * ( 1 - Math.exp( - dt * 1.2 ) );

	}

	// Queue this frame's water height queries at the hull sample positions. The results arrive
	// q.latency seconds later, so ask where the samples will be by then (at speed the hull moves
	// ~0.5 m in that time).
	queueQueries() {

		const q = this.query;
		const lead = q.latency;
		for ( let i = 0; i < this.samples.length; i ++ ) {

			this.toWorld( this.samples[ i ].p, _v ).addScaledVector( this.velocity, lead );
			q.setPoint( this.slot + i, _v.x, _v.z );

		}

	}

	// New read-backs arrive every 1-3 frames. The vertical velocity of the water under each sample is
	// the local rate of the surface, dh/dt at a fixed point: the height change between consecutive
	// results, minus the part caused by the sample moving across the slope (at speed a wave face would
	// otherwise read as fast-rising water and launch the hull), over the time between the results.
	// Between read-backs the heights are extrapolated with that rate, and the small jump when a new
	// result lands is blended out, so the hull is never kicked by a step in the forcing.
	readQueries() {

		const q = this.query;
		if ( ! q.cpuValid || q.version === this._qVersion ) return;
		// An in-flight GPU readback can finish AFTER a developer warp. Old water
		// heights must never be applied to a hull several kilometres away.
		const first = this.slot * 4;
		if ( Math.hypot( q.resultInputs[ first ] - this.position.x, q.resultInputs[ first + 1 ] - this.position.z ) > 80 ) {
			this._qVersion = q.version;
			return;
		}
		const dt = q.resultTime - ( this._qTime ?? q.resultTime );
		this._qVersion = q.version;
		this._qTime = q.resultTime;
		const c = q.cpu, pts = q.resultInputs;
		for ( let i = 0; i < this.samples.length; i ++ ) {

			const k = ( this.slot + i ) * 4;
			// never let a bad GPU sample into the integrator (keep the last good value)
			let h = c[ k ];
			if ( ! Number.isFinite( h ) ) h = this.hasWater ? this.waterH[ i ] : 0;
			const nx = Number.isFinite( c[ k + 1 ] ) ? c[ k + 1 ] : 0, nz = Number.isFinite( c[ k + 2 ] ) ? c[ k + 2 ] : 0;
			const ny = Math.sqrt( Math.max( 1 - nx * nx - nz * nz, 0.05 ) );
			const gx = - nx / ny, gz = - nz / ny; // surface slope dh/dx, dh/dz
			let w = 0;
			if ( this.hasWater && dt > 1e-4 ) {

				const dx = pts[ k ] - this.qx[ i ], dz = pts[ k + 1 ] - this.qz[ i ];
				w = ( h - this.waterH[ i ] - 0.5 * ( ( gx + this.gx[ i ] ) * dx + ( gz + this.gz[ i ] ) * dz ) ) / dt;

			}

			if ( this.hasWater ) this.waterOff[ i ] = this.hEff[ i ] - h; // where the interpolation was
			else this.waterOff[ i ] = 0;
			this.waterV[ i ] += ( clamp( w, - 3, 3 ) - this.waterV[ i ] ) * 0.5;
			this.waterH[ i ] = h;
			this.hEff[ i ] = h + this.waterOff[ i ];
			this.qx[ i ] = pts[ k ];
			this.qz[ i ] = pts[ k + 1 ];
			this.gx[ i ] = gx;
			this.gz[ i ] = gz;

		}

		this._age = 0;
		this.hasWater = true;

	}

	update( dt ) {

		this.readQueries();
		if ( ! this.hasWater ) {

			this.apply();
			return;

		}

		// engine: spools up after the lever (~0.9 s), a little slower down; idles while driven
		const lever = this.driven ? Math.abs( this.throttle ) : 0;
		const target = this.voyageEnabled&&this.model.heritageDeck ? 0 : Math.max( lever, this.driven ? 0.15 : 0 );
		const tau = target > this.rpm ? 0.9 : 1.3;
		this.rpm += ( target - this.rpm ) * ( 1 - Math.exp( - Math.min( dt, 0.1 ) / tau ) );

		const h = 1 / 120;
		this._acc += Math.min( dt, 0.1 );
		let steps = 0;
		while ( this._acc >= h && steps < 12 ) {

			this.step( h );
			this._acc -= h;
			steps ++;

		}

		if ( ! this.isFinite() ) this.reset();

		// V60: do not overwrite hull velocity on anchoring; tether tension is a physical force in step().
		this.model.setThrottle( this.throttle );
		this.model.setSteering( this.steer );
		this.model.setPropellerRPM( this.rpm * 2400 * Math.sign( this.throttle || 1 ) );
		this.apply();

	}

	step( h ) {

		const m = this.mass;
		const F = _F.set( 0, - m * GRAV, 0 );
		const T = _T.set( 0, 0, 0 ); // torque about COM (world)
		const comW = this.toWorld( this.com, _com );
		const invQ = _invQ.copy( this.quaternion ).invert();

		const addForceAt = ( f, pw ) => {

			F.add( f );
			T.add( _r.copy( pw ).sub( comW ).cross( f ) );

		};

		// water heights at the samples: latest read-back, extrapolated with the water's vertical
		// velocity (up to ~0.12 s), step blended out over ~0.06 s
		this._age = Math.min( this._age + h, 0.12 );
		const blend = Math.exp( - h / 0.06 );

		// ---- buoyancy + vertical damping per hull sample
		let wetArea = 0, totalArea = 0, immersion = 0;
		for ( let i = 0; i < this.samples.length; i ++ ) {

			const s = this.samples[ i ];
			this.waterOff[ i ] *= blend;
			const hw = this.waterH[ i ] + this.waterV[ i ] * this._age + this.waterOff[ i ];
			this.hEff[ i ] = hw;
			const pw = this.toWorld( s.p, _p );
			const depth = hw - pw.y;
			totalArea += s.area;
			if ( depth <= 0 ) continue;
			const sub = Math.min( depth, 1.6 );
			const wet = Math.min( 1, depth / 0.3 );
			wetArea += s.area * wet;
			immersion += s.area * Math.min( sub / Math.max( - s.p.y, 0.05 ), 1.5 );
			// buoyancy + heave damping against the water's own vertical motion, along world up (in the
			// boat frame a trimmed hull would turn forward speed into an upward push)
			_vp.copy( this.angular ).cross( _r.copy( pw ).sub( comW ) ).add( this.velocity );
			const vy = _vp.y - this.waterV[ i ] * 0.6;
			const wetK = Math.min( 1, sub / 0.25 ) * s.area;
			_f.set( 0, RHO * GRAV * s.area * sub * (this.voyageBuoyancyScale??1) - ( 1800 * vy + 900 * vy * Math.abs( vy ) ) * wetK, 0 );
			addForceAt( _f, pw );

		}

		const wet = this.wetFraction = totalArea > 0 ? wetArea / totalArea : 0;
		// how deep the hull sits relative to its design draft (lift fades as it rises out)
		const imm = totalArea > 0 ? clamp( immersion / totalArea, 0, 1 ) : 0;
		const wetD = Math.min( 1, wet * 1.6 ); // hydrodynamic forces: most of the hull in the water
		const fwd = this.forward( _fwd );
		const side = _side.set( 1, 0, 0 ).applyQuaternion( this.quaternion ); // port
		const up = _up.set( 0, 1, 0 ).applyQuaternion( this.quaternion );
		_vl.copy( this.velocity ).applyQuaternion( invQ ); // boat frame: x port, z forward
		const u = _vl.z, vs = _vl.x;
		this.speed = this.velocity.length();
		this.forwardSpeed = u;
		const aLoc = _a.copy( this.angular ).applyQuaternion( invQ ); // x pitch, y yaw, z roll rates

		// ---- calm-water resistance (friction + the wave-making hump past hull speed + planing)
		const au = Math.abs( u );
		const R = ( 40 * au + 22 * au * au + 3000 * sstep( au, 2.8, 5.4 ) + 55 * au * au * sstep( au, 7, 11 ) ) * wetD;
		_p.set( 0, - 0.2, this.com.z );
		this.toWorld( _p, _p );
		addForceAt( _f.copy( fwd ).multiplyScalar( - R * Math.sign( u ) ), _p );
		// air drag on hull + house (Cd ~0.9, ~6 m^2 frontal area)
		F.addScaledVector( this.velocity, - 3.3 * this.speed );

		// ---- lateral hydrodynamics along the keel: hull lift ~ u * v and cross-flow drag ~ v|v| at
		// each station (v includes the yaw rate): directional stability, the turning circle, speed
		// lost to the drift angle in turns and the outward heel (lateral resistance below the COM)
		let induced = 0;
		for ( const [ sz, A ] of this.stations ) {

			const dz = sz - this.com.z;
			// lateral velocity at the station: drift + yaw rate (about +Y) + roll rate (about +Z, the
			// keel swinging sideways below the COM)
			const vk = vs + aLoc.y * dz - aLoc.z * ( this.lateralY - this.com.y );
			const Y = - 0.5 * RHO * A * ( this.hullLift * au * vk + 1.1 * vk * Math.abs( vk ) ) * wetD;
			induced += Y * vk;
			_p.set( 0, this.lateralY, sz );
			this.toWorld( _p, _p );
			addForceAt( _f.copy( side ).multiplyScalar( Y ), _p );

		}

		// the drift angle also banks the hull into the turn (bottom pressure on the outer side),
		// leaving only a slight outward heel
		T.addScaledVector( fwd, this.bank * au * vs * wetD );

		// ---- propeller: thrust from the engine rpm, falling off towards the pitch speed; prop walk
		// astern (stern to port)
		const propW = this.toWorld( this.model.propeller, _p );
		const propSub = this.sampleWaterAt( propW ) - propW.y;
		const propWet = clamp( propSub / 0.3 + 0.5, 0, 1 );
		const dir = this.driven ? Math.sign( this.throttle ) : 0;
		const n = this.rpm * ( this.driven && Math.abs( this.throttle ) > 0.02 ? 1 : 0 );
		let thrust = 0;
		if ( dir > 0 ) thrust = this.maxThrust * n * n * Math.max( 0, 1 - Math.max( u, 0 ) / ( this.pitchSpeed * Math.max( n, 0.2 ) ) );
		else if ( dir < 0 ) thrust = - this.reverseFactor * this.maxThrust * n * n * Math.max( 0, 1 - Math.max( - u, 0 ) / ( this.pitchSpeed * 0.6 * Math.max( n, 0.2 ) ) );
		thrust *= propWet;
		if (this.voyageEnabled) {
			thrust *= this.model.heritageDeck ? 0 : this.voyageAuxPower;
			const wind = this.voyageWind.evaluate({ heading: this.getYaw(), velocity: this.velocity, sailMain: this.voyageSails.main, sailJib: this.voyageSails.jib, sailTrim: this.voyageSails.trim });
			this.voyageSailForce = wind.thrust * (this.model.shipScale?this.model.shipScale.x*this.model.shipScale.y:1) * (this.position.y+6.5>this.sampleWaterAt(this.position)?1:0);
			thrust += this.voyageSailForce;
		}
		this.thrust = thrust;
		addForceAt( _f.copy( fwd ).multiplyScalar( thrust ), propW );
		if ( thrust < 0 ) addForceAt( _f.copy( side ).multiplyScalar( - thrust * 0.08 ), propW );

		// ---- rudder: lifting surface in the propeller race (actuator-disc slipstream); the local
		// flow angle at the stern (drift + yaw) reduces its angle of attack
		// the rudder's side force is partly carried by the aft hull (flap effect), so it acts higher
		// than the blade's centre: less heel kick when the wheel goes over
		const rudW = this.toWorld( _rud.set( 0, - 0.15, this.model.rudder.z ), _rud );
		const race = Math.max( thrust, 0 ) * 2 / ( RHO * 0.14 ) * (this.model.heritageDeck ? .22 : 1); // slipstream dynamic pressure term (m^2/s^2)
		const Ur2 = u * Math.abs( u ) + 0.9 * race;
		const Ur = Math.sqrt( Math.abs( Ur2 ) ) * Math.sign( Ur2 );
		const vRud = vs + aLoc.y * ( this.model.rudder.z - this.com.z );
		const delta = this.steer * 0.6 + ( Math.abs( Ur ) > 0.3 ? Math.atan2( vRud, Math.abs( Ur ) ) * Math.sign( Ur ) : 0 );
		const d = clamp( delta, - 0.7, 0.7 );
		const lift = 0.5 * RHO * (this.model.heritageDeck ? 0.12*this.model.shipScale.y*this.model.shipScale.z*1.6 : 0.12) * Math.abs( Ur2 ) * this.rudderLift * Math.sin( d ) * Math.cos( d ) * propWet * Math.sign( Ur2 || 1 );
		addForceAt( _f.copy( side ).multiplyScalar( - lift ), rudW );
        if(this.model.heritageDeck&&!this.voyageAnchor&&this.driven){
          const w=this.voyageWind.wind,canvas=Math.max(this.voyageSails.main,this.voyageSails.jib);
          const assist=clamp(Math.hypot(w.x,w.z)/8,0,1)*canvas*clamp(1-Math.abs(u)/2.4,0,1);
          T.addScaledVector(up,this.steer*m*1.6*assist);
        }
		// rudder drag (induced + form) slows the boat in a turn
		addForceAt( _f.copy( fwd ).multiplyScalar( - Math.abs( lift * Math.sin( d ) ) * 0.8 * Math.sign( u || 1 ) ), rudW );

		// ---- running trim and rise: the bow lifts over the hump, then the hull runs at a few degrees
		// with some dynamic lift (only while the hull is in the water)
		const trim = ( 2.8 * sstep( u, 2.5, 4.8 ) - 0.8 * sstep( u, 4.8, 7.5 ) - 0.4 * sstep( u, 7.5, 10.5 ) ) * DEG;
		T.addScaledVector( side, this.pitchStiffness * trim * imm * - 1 );
		F.addScaledVector( up, m * GRAV * 0.15 * sstep( u, 3.5, 9 ) * imm );

		// ---- small extra angular damping (appendages, bilge), scaled by wetness
		const wd = 0.2 + wetD;
		// the keel's lift resists roll in proportion to speed (a boat underway rolls much less)
		_v.set( - aLoc.x * (this.model.shipScale?60000:25000), - aLoc.y * 2000, - aLoc.z * ( (this.model.shipScale?32000:4500) + 900 * au ) ).multiplyScalar( wd ).applyQuaternion( this.quaternion );
		T.add( _v );

		// ---- mooring lines when docked and not driven
		if ( this.moored && ! this.driven ) {

			const a = this.mooring.anchor;
			const k = 5500, c = 4200;
			const dx = a.x - this.position.x, dz = a.z - this.position.z;
			F.x += dx * k - this.velocity.x * c;
			F.z += dz * k - this.velocity.z * c;
			let dy = this.mooring.heading - this.getYaw();
			dy = Math.atan2( Math.sin( dy ), Math.cos( dy ) );
			T.y += dy * 60000 - this.angular.y * 30000;

		}

        // V60: a laid anchor is a depth-dependent tether, not an invisible
        // fixed-world position lock. It holds in shallows and drags at high load.
        if(this.voyageEnabled){
            const hawse=this.model.heritageDeck?this.toWorld(_t.set(ANCHOR_HAWSE.x,ANCHOR_HAWSE.y,ANCHOR_HAWSE.z),_t):this.position;
            const contactPoint=this.anchorTether.point&&['HOLDING','DRAGGING'].includes(this.anchorTether.state)?this.anchorTether.point:hawse;
              const ground=this.terrain?.heightAt?.(contactPoint.x,contactPoint.z);
              const rx=hawse.x-comW.x,ry=hawse.y-comW.y,rz=hawse.z-comW.z;
              const hawseVX=this.velocity.x+this.angular.y*rz-this.angular.z*ry;
              const hawseVZ=this.velocity.z+this.angular.x*ry-this.angular.y*rx;
            const pull=this.anchorTether.update({x:hawse.x,z:hawse.z,
                y:hawse.y-(this.model.heritageDeck?ANCHOR_HEIGHT:0),vx:hawseVX,vz:hawseVZ,
                ground:Number.isFinite(ground)?ground:-Infinity,
                travel:this.voyageAnchor?this.anchorTravel:0,dt:h});
            F.x+=pull.x;F.z+=pull.z;
            if(this.model.heritageDeck){T.x+=ry*pull.z;T.y+=rz*pull.x-rx*pull.z;T.z-=ry*pull.x;}
        }
		// ---- V44.1 genuine offshore vortex force; enters the existing rigid-body
		// integrator as Newtons, never writes world position directly. Anchored or
		// moored vessels are exempt; port is well beyond the influence radius.
		if (this.voyageEnabled && !this.moored) {
			const vtx=vortexForceAt(this.position.x,this.position.z,this.velocity.x,this.velocity.z,this.offshoreTime);
			F.x+=m*vtx.ax;F.z+=m*vtx.az;
			if(vtx.intensity>.05)T.y+=m*2.8*vtx.intensity*(vtx.az*Math.cos(this.getYaw())-vtx.ax*Math.sin(this.getYaw()));
		}

		// ---- grounding on terrain + contact with pier piles
		this.contacts( F, T, comW );

		// ---- integrate (semi-implicit Euler) with added mass / inertia in the boat frame
		const fl = _vl.copy( F ).applyQuaternion( invQ );
		fl.x /= m * ( 1 + this.addedMass.x * wetD );
		fl.y /= m * ( 1 + this.addedMass.y * wetD );
		fl.z /= m * ( 1 + this.addedMass.z * wetD );
		this.velocity.addScaledVector( fl.applyQuaternion( this.quaternion ), h );
		const tl = T.applyQuaternion( invQ );
		const I = this.inertia, ai = this.addedInertia;
		tl.set( tl.x / ( I.x * ( 1 + ai.x * wetD ) ), tl.y / ( I.y * ( 1 + ai.y * wetD ) ), tl.z / ( I.z * ( 1 + ai.z * wetD ) ) );
		this.angular.addScaledVector( tl.applyQuaternion( this.quaternion ), h );
		// integrate position of COM, then derive origin
		comW.addScaledVector( this.velocity, h );
		const w = this.angular;
		const angle = w.length() * h;
		if ( angle > 1e-8 ) {

			_dq.setFromAxisAngle( _v.copy( w ).normalize(), angle );
			this.quaternion.premultiply( _dq ).normalize();

		}

		// origin = com - R * comLocal
		this.position.copy( comW ).sub( _v.copy( this.com ).applyQuaternion( this.quaternion ) );

	}

	isFinite() {

		const ok = ( v ) => Number.isFinite( v.x ) && Number.isFinite( v.y ) && Number.isFinite( v.z );
		return ok( this.position ) && ok( this.velocity ) && ok( this.angular ) && Number.isFinite( this.quaternion.w );

	}

	// back to the berth, at rest (safety net if the integration ever blows up)
	reset() {

		this.position.copy( WORLD.boatDock.position );
		this.quaternion.setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), WORLD.boatDock.heading );
		this.velocity.set( 0, 0, 0 );
		this.angular.set( 0, 0, 0 );
		this.throttle = 0;
		this.steer = 0;
		this.rpm = 0;
		this.anchorTether?.reset();
		this.moored = true;
		this.mooring.anchor.copy( WORLD.boatDock.position );
		this.mooring.heading = WORLD.boatDock.heading;

	}

	getYaw() {

		const f = this.forward( _g );
		return Math.atan2( f.x, f.z );

	}

	sampleWaterAt( p ) {

		// nearest hull sample's water height (good enough for the prop / rudder)
		let best = 0, bd = Infinity;
		for ( let i = 0; i < this.samples.length; i ++ ) {

			this.toWorld( this.samples[ i ].p, _t );
			const d = ( _t.x - p.x ) ** 2 + ( _t.z - p.z ) ** 2;
			if ( d < bd ) { bd = d; best = this.hasWater ? this.hEff[ i ] : 0; }

		}

		return best;

	}

	contacts( F, T, comW ) {

		const pts = this.contactPoints || ( this.contactPoints = [
			new THREE.Vector3( 0, - 0.7, 3.2 ), new THREE.Vector3( 0, - 0.75, 0 ), new THREE.Vector3( 0, - 0.72, - 3.4 ),
			new THREE.Vector3( 1.1, - 0.4, 1.5 ), new THREE.Vector3( - 1.1, - 0.4, 1.5 ), new THREE.Vector3( 1.2, - 0.35, - 2.5 ), new THREE.Vector3( - 1.2, - 0.35, - 2.5 ),
			new THREE.Vector3( 0, 0.2, 4.2 ),
		] );
		const pw = _c1, vp = _c2, f = _c3, r = _c4;
		for ( const lp of pts ) {

			this.toWorld( lp, pw );
			const ground = this.terrain.heightAt( pw.x, pw.z );
			const pen = ground - pw.y;
			if ( pen > 0 ) {

				vp.copy( this.angular ).cross( r.copy( pw ).sub( comW ) ).add( this.velocity );
				const fn = pen * 400000 - Math.min( vp.y, 0 ) * 30000;
				f.set( - vp.x * 6000, Math.max( fn, 0 ), - vp.z * 6000 );
				F.add( f );
				T.add( r.copy( pw ).sub( comW ).cross( f ) );

			}

		}

		// pier piles: keep the hull outline out of vertical cylinders / solid boxes near the waterline
		if ( this.colliders ) {

			const outline = this.outline || ( this.outline = [
				new THREE.Vector3( 0, 0.3, 4.1 ), new THREE.Vector3( 1.2, 0.3, 2.0 ), new THREE.Vector3( - 1.2, 0.3, 2.0 ),
				new THREE.Vector3( 1.4, 0.3, - 1.0 ), new THREE.Vector3( - 1.4, 0.3, - 1.0 ), new THREE.Vector3( 1.2, 0.3, - 3.8 ), new THREE.Vector3( - 1.2, 0.3, - 3.8 ),
			] );
			const tmp = _c5;
			for ( const lp of outline ) {

				this.toWorld( lp, pw );
				tmp.copy( pw );
				tmp.y -= 0.9;
				if ( this.colliders.resolveCapsule( tmp, 0.25, 1.6, 0 ) ) {

					vp.copy( this.angular ).cross( r.copy( pw ).sub( comW ) ).add( this.velocity );
					f.set( ( tmp.x - pw.x ) * 260000 - vp.x * 8000, 0, ( tmp.z - pw.z ) * 260000 - vp.z * 8000 );
					F.add( f );
					T.add( r.copy( pw ).sub( comW ).cross( f ) );

				}

			}

		}

	}

	apply() {

		const g = this.model.group;
		g.position.copy( this.position );
		g.quaternion.copy( this.quaternion );
		g.updateMatrixWorld( true );
		this.toWorld( _v.set( 0, 0, 3.9 ), this.bowWorld );
		this.toWorld( _v.set( 0, 0, - 3.8 ), this.sternWorld );

	}

}
