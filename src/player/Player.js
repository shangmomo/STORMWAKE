import {localWaterAt} from '../land/MineReservoirV80.js';
import * as THREE from '../engine/index.js';
import {advanceShipClimb,beginShipClimb} from '../ship/ShipLadder.js';
import {actualHalfWidth,deckHeight,BOARDING_LADDERS,ladderLocal,nearbyLadder,railingEscape,measuredFloorAt,inRealHatch,ORIGINAL_AFT_LADDER,originalAftLadderAccess,DUTCH_AFT_DOOR,DUTCH_SAILOR,inDoorClearance} from '../ship/HeritageDeck.js';
import {canCrossAftDoor,doorEyeHeight,inAftCompanionway} from '../ship/HeritageDoorPhysics.js';
import {MAST,MASTS,mastLadderPoint,mastFootY,nearMast,lookoutFloor} from '../ship/MastLookout.js';
import { WORLD } from '../world/WorldLayout.js';
import {moveLand,combinedWorld,canStandAt,triangleBoomFraction} from './LandMotorV78.js';
import {moveDeckCapsule} from './CharacterMotor.js';
import {sailorPosture} from '../ship/SailorPosture.js';

const EYE = 1.62;
const SWIM_EYE = EYE * 0.1; // eyes above the body's float point while swimming
const RADIUS = 0.3;
const HEIGHT = 1.75;
// water depth (mean level over the feet) where you start swimming / find your feet again
const SWIM_DEPTH = 1.35;
const STAND_DEPTH = 1.1;

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler( 0, 0, 0, 'YXZ' );
const _yAxis = new THREE.Vector3( 0, 1, 0 );
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion();
const _wish = new THREE.Vector3();
// walking on the boat
const DECK_RADIUS = 0.24;
const DECK_STEP = 0.48; // original Dutch bow plank rises; still requires a measured triangle
const HELM_REACH = 0.75; // m from the helm seat to take the wheel

// First-person walker / swimmer / boat captain.
//   walk : capsule on terrain + walkable colliders, wading slows you down
//   swim : floats with the head at the surface; look down + W (or C) to dive, Space to rise
//   deck : aboard, walking in the boat's frame (it moves and rocks under you); E at the helm
//          takes the wheel, E near a pier / the beach steps ashore
//   boat : at the helm, driving; V toggles helm (1st person) / chase (3rd person) camera, E stands up
export class Player {

	constructor( { camera, input, terrain, colliders, query, boat, reef = null, audio = null } ) {

		this.camera = camera;
		this.input = input;
		this.terrain = terrain;
		this.colliders = colliders;
		this.query = query;
		this.boat = boat;
		this.reef = reef;
		this.audio = audio;

		this.mode = 'walk';
		this.camMode = 'third';
		const start = WORLD.start || WORLD.spawn;
		this.position = new THREE.Vector3().copy( start.position );
		// standing on whatever is there (the boardwalk planks), not in it
		this.position.y = Math.max( terrain.heightAt( this.position.x, this.position.z ), colliders ? colliders.groundHeightAt( this.position.x, this.position.z, 50 ) : - Infinity );
		this.velocity = new THREE.Vector3();
		this.yaw = start.yaw;
		this.pitch = - 0.05;
		this.grounded = false;
		this.bob = 0;
		this.stepDist = 0;
		this.waterH = 0;
		this.waterMean = null; // water level low-passed over the passing waves (mode decisions)
		this.wade = 0;
		// eye height easing between modes (critically damped offset from the mode's eye height)
		this.camOff = 0;
		this.camOffV = 0;
		this._camY = null;
		this.floating = true; // swimming at the surface (riding the waves) vs. free under water
		this.slot = query.allocate( 'player', 1 );
		this.prompt = null;
		this.surface = 'sand';

		// boat cameras
		this.orbitYaw = 0;
		this.orbitPitch = 0.22;
		this.orbitDist = 13;
		this.helmYaw = 0;
		this.helmPitch = - 0.05;
		this.camPos = new THREE.Vector3();
		this.camInit = false;
		this.wasUnder = false;

		// on deck: position and heading in the boat frame (+Z forward, yaw 0 looks forward)
		this.deckPos = new THREE.Vector3();
		this.deckVel = new THREE.Vector3();
		this.deckYaw = 0;
		this.deckGrounded = true;
		this._ashore = null; // cached step-ashore target
		this._ashoreT = 0;
		// set by the fishing game: while a line is out the helm / step ashore prompts give way
		this.busy = false;
		this.voyageM1 = null;
		this.stationId = null;
		this.deckViewMode='first';
		this.deckLayer='deck';
		this.shipInterior=null;
		this.carryingChest = false;
		this.mastClimb=null; // continuous swept-local climbing, no top teleport
        this.aftLadderClimb=null; // existing mesh ladder at forward side of sterncastle
		this.boardingClimb=null; // physically moving along a hull ladder
		this._boardingCooldown=0;

	}

	// view direction in world space (for casting); works in every mode
	getViewDir( out ) {

		return out.set( 0, 0, - 1 ).applyQuaternion( this.camera.quaternion );

	}

	// ------------------------------------------------------------------ helpers

	waterHeight() {

		const q = this.query;
		if ( ! q.cpuValid ) return 0;
		const h = q.cpu[ this.slot * 4 ];
		return Number.isFinite( h ) ? h : this.waterH || 0;

	}

	groundAt( x, z, maxY ) {

		let g = this.terrain.heightAt( x, z );
		const c = this.colliders.groundHeightAt( x, z, maxY );
		if ( c > g ) g = c;
		if ( this.reef && this.reef.floorHeightAt ) g = Math.max( g, this.reef.floorHeightAt( x, z ) );
		return g;

	}

	nearBoat() {

		if ( ! this.boat ) return false;
		const bp = this.boat.toWorld( this.boat.model.boardPoint, _v );
		const d = Math.hypot( bp.x - this.position.x, bp.z - this.position.z );
		const dy = Math.abs( bp.y - this.position.y );
		return d < 4.2 && dy < 3.2;

	}

	// ------------------------------------------------------------------ update

	update( dt ) {

		const inp = this.input;
        this.cameraOccluded=false;
        // Only repair local land positions; moving ships and submarines have
        // independent coordinate systems and must not be teleported here.
        if(this.mode==='walk'||this.mode==='swim'){
            const finite=[this.position.x,this.position.y,this.position.z,this.velocity.x,this.velocity.y,this.velocity.z].every(Number.isFinite);
            if(!finite){const safe=this._lastSafeLand||WORLD.start.position;this.position.copy(safe);if(!this._lastSafeLand)this.position.y=this.groundAt(safe.x,safe.z,50);this.velocity.set(0,0,0);this.mode='walk';this.grounded=false;this._camY=null;inp.resetPhysicalState?.();}
            if(this.mode==='walk'&&this.grounded&&this.position.y>this.waterH+.1){
                if(!this._lastSafeLand||this.position.distanceTo(this._lastSafeLand)>1.5){const q=this.position.clone();this.colliders.resolveCapsule(q,RADIUS,HEIGHT,.03,true);if(q.distanceTo(this.position)<.005&&!combinedWorld(this.colliders).capsuleOverlap(this.position,RADIUS,HEIGHT)){this._previousSafeLand=this._lastSafeLand?.clone();this._lastSafeLand=this.position.clone();}}
            }
            if(this.mode==='walk'&&!this.adventure?.app?.qs?.has('coop')&&inp.consume('F6')&&!this.busy&&!this.adventure?.battleTimer&&this._previousSafeLand&&this.position.distanceTo(this._previousSafeLand)<8){const safe=this._previousSafeLand.clone(),q=safe.clone();this.colliders.resolveCapsule(q,RADIUS,HEIGHT,.03,true);if(q.distanceTo(safe)<.005&&!combinedWorld(this.colliders).capsuleOverlap(safe,RADIUS,HEIGHT)){this.position.copy(safe);this.velocity.set(0,0,0);this._camY=null;inp.resetPhysicalState?.();}}
        }
        this.query.setPoint( this.slot, this.position.x, this.position.z );
		const local=(this.mode==='walk'||this.mode==='swim')?localWaterAt(this.position.x,this.position.y,this.position.z,this.terrain):null;
        const changed=(local!==null)!==!!this._localWater;this._localWater=local!==null;
        this.waterH=local??this.waterHeight();
        if(changed||this._localWater)this.waterMean=this.waterH;
		this.waterMean = this.waterMean === null ? this.waterH : this.waterMean + ( this.waterH - this.waterMean ) * ( 1 - Math.exp( - dt / 4 ) );
		this.prompt = null;

		this._boardingCooldown=Math.max(0,this._boardingCooldown-dt);
		if(this.boardingClimb){this.advanceBoarding(dt);return;}

		if ( this.mode === 'boat' ) {

			this.updateBoat( dt );
			return;

		}

		if ( this.mode === 'deck' ) {

			this.updateDeck( dt );
			return;

		}

		const look = inp.consumeLook();
		this.yaw -= look.x * 0.0022;
		this.pitch = THREE.MathUtils.clamp( this.pitch - look.y * 0.0022, - 1.5, 1.5 );

		// (not with a line out or a fish in hand: E belongs to the fishing then)
		if ( !this.boat.model.heritageDeck && this.nearBoat() && ! this.busy && inp.interactionOwner !== 'land' ) {

			this.prompt = { key: 'E', text: this.voyageM1 ? '登上潮醒号甲板 · 找到舵轮和帆索' : 'Captain the ship  ·  Shift+E  walk on deck / fish' };
			if ( inp.consume( 'KeyE', this.voyageM1 ? 'player' : null ) ) {

				this.boardBoat();
				// A pirate skipper should never have to guess where the hidden
				// second interaction is. E boards AND takes the helm immediately;
				// Shift+E keeps the useful walkable/fishing deck mode.
				if ( !this.voyageM1 && ! inp.down( 'ShiftLeft' ) && ! inp.down( 'ShiftRight' ) ) this.takeHelm();
				return;

			}

		}

		const prevMode = this.mode;
		if ( this.mode === 'walk' ) this.updateWalk( dt );
		else this.updateSwim( dt );
		// Dutch ship: approach a boarding gap or climb an actual over-side ladder.
		// This does not consume E and never snaps the pirate to the middle of a hull.
		if(this.boat.model.heritageDeck){
            // An airborne character may land anywhere on a measured Dutch deck
            // when falling onto its actual top surface, not only at four ladders.
            if(this.mode==='walk')this.tryHeritageJumpLanding();
            if(this.mode!=='deck')this.tryHeritageBoarding();
        }

		// camera. Wading out of your depth, finding your feet again or climbing out on a ladder
		// changes the eye height: ease the view there (critically damped) instead of jumping
		const eye = this.position.clone();
		if ( this.mode === 'walk' ) eye.y += EYE + Math.sin( this.bob ) * 0.035 * ( 1 - 0.6 * this.wade );
		else eye.y += SWIM_EYE;
		if ( this._camY === null || this.camera.position.y !== this._camY ) {

			// something else drove the camera since our last frame (free camera, boat): start fresh
			this.camOff = 0;
			this.camOffV = 0;

		} else if ( this.mode !== prevMode ) {

			this.camOff = this._camY - eye.y;

		}

		const w = 6, e = Math.exp( - w * dt ), j = ( this.camOffV + w * this.camOff ) * dt;
		this.camOff = ( this.camOff + j ) * e;
		this.camOffV = ( this.camOffV - w * j ) * e;
		eye.y += this.camOff;
		this.camera.position.copy( eye );
		this._camY = this.camera.position.y;
		this.camera.quaternion.setFromEuler( _e.set( this.pitch, this.yaw, 0 ) );

	}

	updateWalk( dt ) {

		const inp = this.input;
		_fwd.set( - Math.sin( this.yaw ), 0, - Math.cos( this.yaw ) );
		_right.set( - _fwd.z, 0, _fwd.x );
		const wish = new THREE.Vector3();
		if ( inp.down( 'KeyW' ) ) wish.add( _fwd );
		if ( inp.down( 'KeyS' ) ) wish.sub( _fwd );
		if ( inp.down( 'KeyD' ) ) wish.add( _right );
		if ( inp.down( 'KeyA' ) ) wish.sub( _right );
		if ( wish.lengthSq() > 0 ) wish.normalize();

		const depth = this.waterH - this.position.y; // water depth at the feet
		const wade = THREE.MathUtils.clamp( depth / 1.2, 0, 1 );
		this.wade = wade;
		const sprint = inp.down( 'ShiftLeft' ) || inp.down( 'ShiftRight' );
		const speed = ( sprint ? 6.2 : 3.0 ) * THREE.MathUtils.lerp( 1, 0.42, wade ) * (this.carryingChest ? Math.max(.3,.85/(1+(this.carriedMassKg||40)/75)) : 1);
		const accel = this.grounded ? 14 : 2.5;
		const k = 1 - Math.exp( - accel * dt );
		this.velocity.x += ( wish.x * speed - this.velocity.x ) * k;
		this.velocity.z += ( wish.z * speed - this.velocity.z ) * k;
		// A short grounded roll reuses existing capsule collision, step heights and
		// slope constraints. The combat layer grants i-frames separately.
		if ( this.adventure?.dodgeTimer > 0 && !this.input.gameplayBlocked ) {
			this.velocity.x = this.adventure.dodgeDir.x * 9.7;
			this.velocity.z = this.adventure.dodgeDir.z * 9.7;
		}

		if ( this.grounded && inp.hit( 'Space' ) && depth < 0.9 ) {

			this.velocity.y = 4.6*(this.carryingChest?.65:1);
			this.grounded = false;

		}

		this.velocity.y -= 9.81 * dt;
		// water drag while wading
		if ( depth > 0 ) this.velocity.multiplyScalar( Math.exp( - dt * depth * 0.8 ) );

		const p = this.position;
		const old = p.clone();
		const target=p.clone().addScaledVector(this.velocity,dt);
        const hit=moveLand(this.colliders,old,target,{radius:RADIUS,height:HEIGHT,grounded:this.grounded,stepHeight:this.grounded?.4:0,groundAt:this.groundAt.bind(this)});
        p.set(hit.x,hit.y,hit.z);if(hit.stepped&&this.velocity.y<0)this.velocity.y=0;
        if(Math.abs(p.y-target.y)>.006&&this.velocity.y>0)this.velocity.y=0;
		const g = this.groundAt( p.x, p.z, p.y + 0.45 );
		if ( p.y <= g && g-p.y<.025 ) {

			p.y = g;
			if ( this.velocity.y < 0 ) this.velocity.y = 0;
			this.grounded = true;

		} else {

			this.grounded = p.y >= g-.025 && p.y-g < 0.06;
            if(this.grounded&&this.velocity.y<0)this.velocity.y=0;

		}

		// head bob + footsteps
		const moved = Math.hypot( p.x - old.x, p.z - old.z );
        this.actualLandSpeed=dt>0?moved/dt:0;
		if ( this.grounded ) {

			this.bob += moved * 2.4;
			this.stepDist += moved;
			const stride = sprint ? 0.9 : 0.62;
			if ( this.stepDist > stride ) {

				this.stepDist = 0;
				this.surface = this.surfaceType( depth );
				if ( this.audio ) this.audio.footstep( this.surface );

			}

		}

		// out of your depth -> swim. Wading in, the body lifts into the floating position at the
		// surface and the view eases down to it (update()); falling in off the pier plunges under
		// and floats back up.
		if ( this.waterMean - p.y > SWIM_DEPTH ) {

			const wadedIn = this.grounded;
			this.mode = 'swim';
			if ( wadedIn ) p.y = Math.max( p.y, this.waterH - SWIM_EYE + 0.1 );
			this.velocity.y = wadedIn ? 0 : Math.max( this.velocity.y * 0.3, - 2.5 );
			if ( this.audio ) this.audio.splash( wadedIn ? 0.2 : 0.5, p );

		}

	}

	surfaceType( depth ) {

		const p = this.position;
		if ( depth > 0.12 ) return 'water';
		const onWood = this.colliders.groundHeightAt( p.x, p.z, p.y + 0.1 ) > this.terrain.heightAt( p.x, p.z ) + 0.05;
		if ( onWood ) return 'wood';
		const h = this.terrain.heightAt( p.x, p.z );
		if ( h < 0.6 ) return 'wetsand';
		if ( h > 3.6 ) return 'grass';
		return 'sand';

	}

	updateSwim( dt ) {

		const inp = this.input;
		const p = this.position;
		const surfaceY = this.waterH;
        const old=p.clone();
		// look-relative movement (diving follows the view)
		_fwd.set( 0, 0, - 1 ).applyEuler( _e.set( this.pitch, this.yaw, 0 ) );
		_right.set( - Math.cos( this.yaw ), 0, Math.sin( this.yaw ) ).negate();
		const wish = new THREE.Vector3();
		if ( inp.down( 'KeyW' ) ) wish.add( _fwd );
		if ( inp.down( 'KeyS' ) ) wish.sub( _fwd );
		if ( inp.down( 'KeyD' ) ) wish.add( _right );
		if ( inp.down( 'KeyA' ) ) wish.sub( _right );
		if ( inp.down( 'Space' ) ) wish.y += 1;
		if ( inp.down( 'KeyC' ) || inp.down( 'ControlLeft' ) ) wish.y -= 1;
		if ( wish.lengthSq() > 0 ) wish.normalize();

		const atSurface = this.floating && p.y > surfaceY - 0.45;
		// at the surface W along a level view keeps you on top; looking down dives
		if ( atSurface && wish.y > - 0.25 && ! inp.down( 'KeyC' ) ) wish.y = Math.max( wish.y, 0 );

		const sprint = inp.down( 'ShiftLeft' ) || inp.down( 'ShiftRight' );
		const speed = sprint ? 2.5 : 1.5;
		const k = 1 - Math.exp( - dt * 3.0 );
		this.velocity.lerp( wish.multiplyScalar( speed ), k );

		// A swimmer at the surface floats with the head riding the waves; one who dives stays where
		// they swim to (neutral buoyancy, nothing pulls them back up) until they swim up to the
		// surface again.
		const eyeTarget = surfaceY - SWIM_EYE + 0.1; // eyes ~10 cm above the water; waves still wash over
		const diving = inp.down( 'KeyC' ) || ( inp.down( 'KeyW' ) && this.pitch < - 0.35 ) || wish.y < - 0.1;
		if ( diving ) this.floating = false;
		else if ( p.y > eyeTarget - 0.15 ) this.floating = true;
		if ( this.floating ) {

			p.y += ( eyeTarget - p.y ) * ( 1 - Math.exp( - dt * 5 ) );
			if ( this.velocity.y > 0 ) this.velocity.y *= 0.5;

		}

		p.addScaledVector( this.velocity, dt );
		p.y = Math.min( p.y, surfaceY + 0.05 );
		const hit=moveLand(this.colliders,old,p,{radius:RADIUS,height:1,stepHeight:0});p.set(hit.x,hit.y,hit.z);
		const g = this.groundAt( p.x, p.z, p.y + 0.3 );
		if ( p.y < g + 0.25 ) p.y = g + 0.25;

		// strokes / bubbles
		this.stepDist += this.velocity.length() * dt;
		if ( this.stepDist > 1.3 ) {

			this.stepDist = 0;
			if ( this.audio ) this.audio.swimStroke();

		}

		const under = this.camera.position.y < surfaceY - 0.05;
		if ( under !== this.wasUnder && this.audio ) {

			if ( under ) this.audio.submerge();
			else this.audio.emerge();

		}

		this.wasUnder = under;

		// shallow enough to stand -> walk (update() eases the view up to standing height). The mean
		// level decides, so a passing wave doesn't flip you between swimming and standing.
		if ( this.waterMean - g < STAND_DEPTH && canStandAt(this.colliders,{x:p.x,y:g,z:p.z},RADIUS,HEIGHT) ) {

			this.mode = 'walk';
			p.y = g;
			this.velocity.set( this.velocity.x, 0, this.velocity.z );

		}

		// ladders on the pier: climb out when swimming into them
		if ( this.colliders.boxes ) {

			for ( const b of this.colliders.boxes ) {

				if ( b.tag !== 'ladder' ) continue;
				if ( Math.hypot( b.center.x - p.x, b.center.z - p.z ) < 1.1 ) {

					this.prompt = { key: 'Space', text: 'Climb ladder' };
					if ( inp.down( 'Space' ) || inp.down( 'KeyW' ) ) {

						const top = this.colliders.groundHeightAt( b.center.x, b.center.z, 10 );
						if ( top > p.y ) {

							p.y += dt * 1.6;
							if ( p.y > top - 1.0 ) {

								// step onto the deck
								const deck = WORLD.pier.deckHeight;
								p.set( b.center.x - Math.sign( b.center.x - WORLD.pier.x ) * 1.2, deck, b.center.z );
								this.mode = 'walk';
								this.velocity.set( 0, 0, 0 );

							}

						}

					}

					break;

				}

			}

		}

	}

	// Land on actual artist faces from any dock/airborne spot.
	// A ship side is never a permitted entrance from BELOW the local deck.
	tryHeritageJumpLanding(){
	  if(!this.boat?.model?.heritageDeck||this.velocity.y>0||this.busy)return false;
	  const b=this.boat, inv=b.quaternion.clone().invert();
	  const next=this.position.clone().sub(b.position).applyQuaternion(inv);
	  if(Math.abs(next.x)>actualHalfWidth(next.z)-DECK_RADIUS||next.z>10.3||next.z< -10.45)return false;
	  const ground=measuredFloorAt(next.x,next.z,next.y+.45);
	  if(ground===null || next.y<ground-.36 || next.y>ground+.13)return false;
	  const vertical=this.velocity.clone().sub(b.velocity).applyQuaternion(inv).y;
	  if(vertical>.3 || this._boardingCooldown>.1)return false;
	  this.boardBoatAt(new THREE.Vector3(next.x,ground,next.z));
	  return true;
	}

	// Attached ladder climb. Both endpoints are ship-local; a rolling and
	// translating boat carries the climber continuously without a world teleport.
	beginBoardingClimb(ladder){
		if(!this.boat?.model?.heritageDeck||this.boardingClimb||this._boardingCooldown>0)return false;
		const b=this.boat, inv=b.quaternion.clone();inv.invert();
		const start=this.position.clone().sub(b.position).applyQuaternion(inv);
		const finish=ladderLocal(ladder);
		this.boardingClimb={start,finish,t:0,duration:1.8,descend:false,manual:true};
		this.velocity.set(0,0,0);return true;
	}
	advanceBoarding(dt){
		const c=this.boardingClimb;if(!c)return;
		const axis=c.manual?(Number(this.input.down('KeyW'))-Number(this.input.down('KeyS')))*(c.descend?-1:1):1;
        c.t=Math.max(0,Math.min(1,c.t+axis*Math.min(dt,.05)/c.duration));
		const l=c.finish,side=Math.sign(l.x||1);
        const deckY=l.y,railY=deckY+1.0;
        const smooth=t=>t*t*(3-2*t);
        let local;
        if(c.descend){
            const outside=c.outside,foot=c.foot;
            if(c.t<.20){const t=smooth(c.t/.20);local=new THREE.Vector3(c.start.x,c.start.y+(railY-c.start.y)*t,c.start.z);}
            else if(c.t<.40){const t=smooth((c.t-.20)/.20);local=new THREE.Vector3(c.start.x+(outside.x-c.start.x)*t,railY,c.start.z+(outside.z-c.start.z)*t);}
            else{const t=smooth((c.t-.40)/.60);local=new THREE.Vector3(outside.x,railY+(foot.y-railY)*t,outside.z);}
        }else if(c.t<.60){const t=smooth(c.t/.60);
            local=new THREE.Vector3(c.start.x,c.start.y+(railY-c.start.y)*t,c.start.z);
        }else if(c.t<.85){const t=smooth((c.t-.60)/.25);
            local=new THREE.Vector3(c.start.x+(l.x-c.start.x)*t,railY,c.start.z+(l.z-c.start.z)*t);
        }else{const t=smooth((c.t-.85)/.15);
            local=new THREE.Vector3(l.x,railY+(deckY-railY)*t,l.z);
        }
		this.boat.toWorld(local,this.position);
		this.camera.position.copy(this.position).add(new THREE.Vector3(0,c.t>.65?EYE:.65,0));
		this.camera.quaternion.setFromEuler(_e.set(this.pitch,this.yaw,0));
		this.prompt={key:'W / S',text:'W 上 / S 下，松键停在舷梯上'};
        if(c.manual&&axis<0&&c.t<=0){this.boardingClimb=null;if(c.descend)this.boardBoatAt(c.start);else{this.mode='swim';this.velocity.set(0,0,0);}this._boardingCooldown=.65;return;}
		if(c.t>=1){
			this.boardingClimb=null;
			if(c.descend){
				this.mode='swim';this.stationId=null;this.deckGrounded=false;
				this.waterH=this.waterMean=this.boat.position.y;
				this.velocity.set(0,0,0);this._camY=null;this._boardingCooldown=.8;
				// When the ship is against a real quay, finish on the quay instead
				// of dipping a dry sailor through water below its planks.
				const shore=this.ashoreTarget();
				if(shore&&this.boat.position.distanceTo(WORLD.boatDock.position)<14){
					this.position.set(shore.out.x,shore.g,shore.out.z);this.mode='walk';
				}
			}else this.boardBoatAt(local);
			this._boardingCooldown=.65;
		}
	}
	tryHeritageBoarding(){
		if(this.busy||this._boardingCooldown>0||!this.boat||!['walk','swim'].includes(this.mode))return false;
		const inv=this.boat.quaternion.clone();inv.invert();
		const at=this.position.clone().sub(this.boat.position).applyQuaternion(inv);
		const ladder=nearbyLadder(at.x,at.z,1.25);
		if(!ladder)return false;
		const dy=at.y-ladderLocal(ladder).y;
		// Shore-to-ship and water-to-ship both grab the SAME attached rope.
		// A tall dock can be above the ship's deck: never require matching feet Y.
		if(dy>-3.1&&dy<2.30){
			this.prompt={key:'W / S',text:'面向舷梯，按住 W 登船，S 返回'};
            const forward=this.getViewDir(new THREE.Vector3()).applyQuaternion(inv);
            const grab=this.input.down('KeyW')&&-ladder.side*forward.x>.75;
			if(grab)return this.beginBoardingClimb(ladder);
		}
		return false;
	}
	boardBoatAt(local){
		const b=this.boat;
		this.mode='deck';this.deckLayer='deck';this.deckViewMode='first';
		this.stationId=null;this.shipClimb=null;
		this.deckPos.set(local.x,measuredFloorAt(local.x,local.z,local.y+.22)??local.y,local.z);this.deckVel.set(0,0,0);
		this.deckYaw=this.yaw-(b.getYaw()+Math.PI);this.deckGrounded=true;
		this.velocity.set(0,0,0);this._camY=null;this.deckToWorld();
	}
	fallOverboard(){
		const b=this.boat;
		b.toWorld(this.deckPos,this.position);
		const motion=this.deckVel.clone().applyQuaternion(b.quaternion);
		this.velocity.copy(b.velocity).add(motion);
		this.mode='walk';this.grounded=false;this.deckGrounded=false;
		this.waterMean=this.waterH;this._camY=null;
		this._boardingCooldown=.9;
		this.audio?.splash?.(.15,this.position);
	}

	// ------------------------------------------------------------------ boat

	// step aboard from the pier / beach / water: onto the cockpit sole at the boarding point
	boardBoat() {

		const b = this.boat;
		this.mode = 'deck';
		this.deckLayer='deck';
		this.deckViewMode='first';
		if(b.model.heritageDeck){this.deckPos.set(0,deckHeight(-4.75,0),-4.75);}
		else this.deckPos.copy( b.model.boardPoint );
		this.deckVel.set( 0, 0, 0 );
		// keep looking where you looked (relative to the boat)
		this.deckYaw = this.yaw - ( b.getYaw() + Math.PI );
		this.deckGrounded = true;
		this._ashore = null;
		this._ashoreT = 0;
		this.velocity.set( 0, 0, 0 );
		this._camY = null;
		this.deckToWorld();

	}

	// sit down at the helm and drive (the old "enter boat")
	takeHelm() {

		this.mode = 'boat';
		this.boat.driven = true;
		this.boat.moored = false;
		this.helmYaw = 0;
		this.helmPitch = - 0.05;
		this.orbitYaw = this.boat.getYaw() + Math.PI;
		this.camInit = false;
		if ( this.audio ) this.audio.engineStart();

	}

	// get up from the helm: stand beside the seat, looking forward
	leaveHelm() {

		const b = this.boat;
		b.driven = false;
		b.throttle = 0;
		this.mode = 'deck';
		if(b.model.heritageDeck) this.deckPos.set(b.model.helmPoint.x+.32,deckHeight(b.model.helmPoint.z-.18,b.model.helmPoint.x+.32),b.model.helmPoint.z-.18);
		else this.deckPos.set( b.model.helmPoint.x + 0.45, b.model.lines.deckY, b.model.helmPoint.z - 0.1 );
		this.deckVel.set( 0, 0, 0 );
		this.deckYaw = this.helmYaw;
		this.pitch = this.helmPitch;
		this.deckGrounded = true;
		this._camY = null;
		if ( this.audio ) this.audio.engineStop();
		this.deckToWorld();

	}

	// enterBoat() kept for callers: straight to the helm
	enterBoat() {

		this.boardBoat();
		this.takeHelm();

	}

	// target: an ashoreTarget() spot; side: +1 / -1 jumps overboard on the starboard / port side
	exitBoat( target = null, side = 0 ) {

		const b = this.boat;
		const wasDriving = b.driven;
		b.driven = false;
		b.throttle = 0;
		// the exit point closest to something walkable (pier deck / sand)
		let best = side ? null : this.ashoreTarget();

		const dock = WORLD.boatDock.position;
		if ( b.position.distanceTo( dock ) < 14 && b.speed < 1.5 ) {

			b.moored = true;
			b.mooring.anchor.set( b.position.x, 0, b.position.z );
			b.mooring.heading = b.getYaw();

		}

		if ( target ) best = target;
		if ( best ) {

			this.position.set( best.out.x, best.g, best.out.z );
			this.mode = 'walk';

		} else {

			const w = b.toWorld( new THREE.Vector3( 2.2 * ( side || 1 ), 0, 0 ), new THREE.Vector3() );
			// (the boat floats at the water line: the walker's water height is stale while aboard)
			this.waterH = this.waterMean = b.position.y;
			this.position.set( w.x, b.position.y - 0.2, w.z );
			this.mode = 'swim';
			if ( this.audio ) this.audio.splash( 0.8, this.position );

		}

		this.velocity.set( 0, 0, 0 );
		this.yaw = b.getYaw() + Math.PI;
		this._camY = null;
		if ( this.audio && wasDriving ) this.audio.engineStop();

	}

	// best walkable spot next to the boat (pier deck / sand / shallows), or null. Looks straight out
	// from the rail at each exit point (square to the hull, a few reaches: the boat swings on its
	// mooring) for ground from a little below the rail up to a pier deck a climb above it.
	ashoreTarget() {

		const b = this.boat;
		const water = this.query.cpuValid ? this.query.cpu[ 0 ] : 0;
		// the boat's starboard (local +x) direction in the world, level
		const sx = _v2.set( 1, 0, 0 ).applyQuaternion( b.quaternion ).setY( 0 ).normalize();
		const rx = sx.x, rz = sx.z;
		let best = null, bestScore = Infinity;
		for ( const ep of b.model.exitPoints ) {

			const w = b.toWorld( ep, new THREE.Vector3() );
			const sgn = Math.sign( ep.x ) || 1;
			for ( const reach of [ 0.9, 1.4, 2.0 ] ) {

				const out = new THREE.Vector3( w.x + rx * sgn * reach, w.y, w.z + rz * sgn * reach );
				const g = this.groundAt( out.x, out.z, w.y + 2.5 );
				const up = g - w.y;
				if ( up > 1.7 || up < - 1.2 || g < water - 0.3 ) continue;
				const score = Math.abs( up ) + reach * 0.2;
				if ( score < bestScore ) { bestScore = score; best = { out, g, ep }; }

			}

		}

		return best;

	}

	// ------------------------------------------------------------------ deck

	// camera base orientation on the boat: its heading, with roll and pitch half stabilised
	deckBase( out ) {

		const b = this.boat;
		_qa.setFromAxisAngle( _yAxis, b.getYaw() + Math.PI );
		_qb.copy( b.quaternion ).multiply( _qc.setFromAxisAngle( _yAxis, Math.PI ) );
		return out.slerpQuaternions( _qb, _qa, 0.55 );

	}

	// world position / heading of the player from the deck state (feet)
	deckToWorld() {

		const b = this.boat;
		b.toWorld( this.deckPos, this.position );
		this.yaw = b.getYaw() + Math.PI + this.deckYaw;

	}

	// highest walkable box top under the point (boat frame), not above maxY; the sole otherwise
	deckGroundAt( x, z, maxY ) {

		const L = this.boat.model.lines;
		let g = this.boat.model.heritageDeck ? (this.boat.model.collisionWorld ? (this.boat.model.collisionWorld.floorAt(x,z,maxY,-4)??-Infinity) : (measuredFloorAt(x,z,maxY)??-Infinity)) : L.deckY;
        if(this.boat.model.mastLookout) g=Math.max(g,lookoutFloor(x,z,maxY));
		for ( const c of this.boat.model.heritageDeck ? [] : this.boat.model.colliders ) {

			if ( ! c.walkable ) continue;
			if ( Math.abs( x - c.center.x ) > c.half.x || Math.abs( z - c.center.z ) > c.half.z ) continue;
			const top = c.center.y + c.half.y;
			if ( top <= maxY && top > g ) g = top;

		}

		return g;

	}

	updateDeck( dt ) {

		const inp = this.input;
		const b = this.boat;
		const L = b.model.lines;
		const look = inp.consumeLook();
        const cabin=this.shipInterior,feet=this.deckPos;
        if(b.model.heritageDeck&&cabin&&b.model.originalDoor?.passable&&!this.shipClimb){
          if(this.deckLayer==='hold'&&feet.z> -6.48)this.deckLayer='deck';
          else if(this.deckLayer==='deck'&&feet.x> -1.16&&feet.x<-.60&&feet.z< -6.68&&feet.z> -7.80&&feet.y<1.16)this.deckLayer='hold';
        }
		const inLowerHold=this.deckLayer==='lowerHold' && !!this.lowerHold;
		const inHold = (this.deckLayer==='hold' && !!this.shipInterior)||inLowerHold;if(inHold)this.deckViewMode='first';
		const activeInterior=inLowerHold?this.lowerHold:this.shipInterior;
		const heritage=!!b.model.heritageDeck;
		if(this.pendingStation){
			this.deckVel.set(0,0,0);this.deckToWorld();
			this.prompt={key:'Esc',text:'等待房间确认岗位…'};return;
		}
		this.deckYaw -= look.x * 0.0022;
		this.pitch = THREE.MathUtils.clamp( this.pitch - look.y * 0.0022, - 1.5, 1.5 );
        // V53: physical cannon traverse/elevation can be driven with the mouse
        // OR the keyboard even when pointer-lock is unavailable in the browser.
        if(this.stationId?.startsWith('cannon_')){
            this.deckYaw += (Number(inp.down('KeyA'))-Number(inp.down('KeyD')))*Math.min(dt,.05)*.75;
            this.pitch += (Number(inp.down('KeyW'))-Number(inp.down('KeyS')))*Math.min(dt,.05)*.55;
        }
		if ( this.voyageM1 && inp.consume('KeyV','voyage') && !this.stationId ) {
			this.deckViewMode=this.deckViewMode==='first'?'third':'first';
		}
		if ( this.stationId?.startsWith('cannon_') ) {
			// Gunner view cannot turn through the ship's own bulwark.
			const center=this.stationId==='cannon_port'?Math.PI/2:-Math.PI/2;
			const delta=Math.atan2(Math.sin(this.deckYaw-center),Math.cos(this.deckYaw-center));
			this.deckYaw=center+THREE.MathUtils.clamp(delta,-Math.PI/4.8,Math.PI/4.8);
			this.pitch=THREE.MathUtils.clamp(this.pitch,-.30,.42);
		}


		if ( this.voyageM1 && this.stationId ) {
			if(this.stationId.startsWith('anchor')){const angle=b.model.heritageArt?.capstan?.rotation.y||0;if(this.anchorViewAngle!==undefined)this.deckYaw+=angle-this.anchorViewAngle;this.anchorViewAngle=angle;}else this.anchorViewAngle=undefined;
			// Station owner is a fixed deck-local body. Only view direction moves.
			const site = this.voyageM1.stationLocal(this.stationId);
			if (site) this.deckPos.set(site.x,Math.max(site.y,this.deckGroundAt(site.x,site.z,site.y+.5)),site.z);
			this.deckVel.set(0,0,0); this.deckGrounded = true;
			this.deckToWorld();
			const eye = _v.set(this.deckPos.x,this.deckPos.y+(heritage?DUTCH_SAILOR.eye:EYE),this.deckPos.z);
			b.toWorld(eye,this.camera.position);
			this.deckBase(_q);
			this.camera.quaternion.copy(_q).multiply(_qa.setFromEuler(_e.set(this.pitch,this.deckYaw,0)));
			this.prompt = {key:'E',text:`${this.voyageM1.stationName(this.stationId)} · E 离岗`};
			return;
		}
        this.anchorViewAngle=undefined;
		// C at the deck-side rope landing makes a guided, reversible descent.
		// No free-fall or automatic teleport through the hull plating.
		if(heritage&&!inHold&&!this.stationId&&!this.shipClimb&&!this.mastClimb&&!this.aftLadderClimb){
			for(const ladder of BOARDING_LADDERS){
				const inner=ladderLocal(ladder);
				if(Math.hypot(this.deckPos.x-inner.x,this.deckPos.z-inner.z)>.98)continue;
				this.prompt={key:'W / S',text:'面向船内对准绳梯，S 下船、W 上船'};
				if(inp.down('KeyS')&&-ladder.side*Math.sin(this.deckYaw)>.82){
					const outside=ladderLocal(ladder,{outside:true});
					const start=this.deckPos.clone();
					this.boardingClimb={descend:true,start,finish:inner,outside,
						foot:{x:outside.x,y:Math.min(-.32,this.boat.position.y-.30),z:outside.z},t:0,duration:2.0,manual:true};
					this.deckVel.set(0,0,0);return;
				}
				break;
			}
		}
        if(heritage&&this.lowerHold&&!this.shipClimb&&!this.stationId&&!this.mastClimb&&this.lowerHold.nearEntrance(this.deckPos)){
          const h=this.lowerHold.layout,dx=h.x-this.deckPos.x,dz=h.z-.32-this.deckPos.z;
          const facing=(Math.sin(this.deckYaw)*dx+Math.cos(this.deckYaw)*dz)/(Math.hypot(dx,dz)||1);
          if(facing>.75&&((inLowerHold&&inp.down('KeyW'))||(!inHold&&inp.down('KeyS')))){
            if(beginShipClimb(this,this.lowerHold,!inLowerHold)){this.shipClimb.manual=true;}
          }
        }
        // Grab the EXISTING Dutch bulkhead ladder (already part of the hull GLB).
        // C on its lower or upper landing; W ascends, S descends. The endpoints
        // remain ship local; no invented staircase or teleport is inserted.
    if(heritage && !b.model.deckStairs && !inHold && !this.stationId && !this.shipClimb && !this.mastClimb &&
           originalAftLadderAccess(this.deckPos) && inp.hit('KeyC') && !this.aftLadderClimb &&
           !this.shipInterior?.inHatch(this.deckPos) && !this.lowerHold?.inHatch(this.deckPos)){
           const l=ORIGINAL_AFT_LADDER;
           const lower=this.deckGroundAt(l.x,l.lowerZ,1.65);
           const upper=deckHeight(l.upperZ,l.x);
           if(Number.isFinite(lower)&&upper>lower+.30){
             this.aftLadderClimb={y:THREE.MathUtils.clamp(this.deckPos.y,lower,upper),lower,upper};
             this.deckVel.set(0,0,0);
           }
        }
        if(this.aftLadderClimb){
           const c=this.aftLadderClimb,l=ORIGINAL_AFT_LADDER;
           const dir=(inp.down('KeyW')?1:0)-(inp.down('KeyS')?1:0);
           c.y=THREE.MathUtils.clamp(c.y+dir*1.34*Math.min(dt,.05),c.lower,c.upper);
           this.deckPos.set(l.x,c.y,l.z);this.deckVel.set(0,0,0);this.deckGrounded=true;
           if(c.y>=c.upper-.012 && dir>0){this.aftLadderClimb=null;this.deckPos.set(l.x,c.upper,l.upperZ);}
           else if(c.y<=c.lower+.012&&dir<0){this.aftLadderClimb=null;this.deckPos.set(l.x,c.lower,l.lowerZ);}
           this.deckToWorld();
           b.toWorld(_v.set(this.deckPos.x,this.deckPos.y+1.25,this.deckPos.z),this.camera.position);
           this.deckBase(_q);this.camera.quaternion.copy(_q).multiply(_qa.setFromEuler(_e.set(this.pitch,this.deckYaw,0)));
           this.prompt={key:'W / S',text:'原船尾楼梯 · W 上 / S 下'};return;
        }
        if(heritage&&!inHold&&!this.stationId&&!this.shipClimb&&!this.mastClimb&&Math.cos(this.deckYaw)>.82){
          const mast=MASTS.find(m=>nearMast(this.deckPos,.40,m)&&
            ((this.deckPos.y<mastFootY(m)+.35&&inp.down('KeyW'))||
             (Math.abs(this.deckPos.y-m.top)<.30&&inp.down('KeyS'))));
          if(mast){this.mastClimb={y:this.deckPos.y,mast};this.deckVel.set(0,0,0);}
        }
        if(this.mastClimb){
          const c=this.mastClimb,m=c.mast||MAST,base=mastFootY(m),f=mastLadderPoint(m),dir=Number(inp.down('KeyW'))-Number(inp.down('KeyS'));
          c.y=THREE.MathUtils.clamp(c.y+dir*2.05*Math.min(.05,dt),base,m.top);
          this.deckPos.set(f.x,c.y,f.z);this.deckVel.set(0,0,0);this.deckGrounded=true;
          if(c.y>=m.top-.005&&dir>0){this.mastClimb=null;this.deckPos.y=m.top;}
          else if(c.y<=base+.005&&dir<0){this.mastClimb=null;this.deckPos.z=f.z-.20;this.deckPos.y=base;}
          this.deckToWorld();b.toWorld(_v.set(this.deckPos.x,this.deckPos.y+1.35,this.deckPos.z),this.camera.position);
          this.deckBase(_q);this.camera.quaternion.copy(_q).multiply(_qa.setFromEuler(_e.set(this.pitch,this.deckYaw,0)));
          this.prompt={key:'W / S',text:'W 上 / S 下，松键停留在梯子上'};return;
        }

		if ( this.shipClimb && this.shipInterior ) {
			// Capture the actual destination room before advanceShipClimb clears
			// shipClimb at its final frame (especially the independent cargo hold).
			const climbingInterior=this.shipClimb.interior||this.shipInterior;
			advanceShipClimb(this,dt,climbingInterior);
			this.deckToWorld();
			const h=climbingInterior.layout;
			const eye=Math.max(.30,Math.min(DUTCH_SAILOR.eye,h.deckY-this.deckPos.y-.18));
			b.toWorld(_v.set(this.deckPos.x,this.deckPos.y+eye,this.deckPos.z),this.camera.position);
			this.deckBase(_q);
			this.camera.quaternion.copy(_q).multiply(_qa.setFromEuler(_e.set(this.pitch,this.deckYaw,0)));
			this.prompt={key:'',text:'攀爬舱口梯中…'};
			return;
		}
		// movement in the boat frame (camera base looks along +Z at deckYaw 0)
		const sy = Math.sin( this.deckYaw ), cy = Math.cos( this.deckYaw );
		_fwd.set( sy, 0, cy );
		_right.set( - cy, 0, sy );
		_wish.set( 0, 0, 0 );
		if ( inp.down( 'KeyW' ) ) _wish.add( _fwd );
		if ( inp.down( 'KeyS' ) ) _wish.sub( _fwd );
		if ( inp.down( 'KeyD' ) ) _wish.add( _right );
		if ( inp.down( 'KeyA' ) ) _wish.sub( _right );
		if ( _wish.lengthSq() > 0 ) _wish.normalize();
		let speed = (inHold ? .93 : ( inp.down( 'ShiftLeft' ) ? 2.6 : 1.6 )) * (this.carryingChest ? Math.max(.3,.85/(1+(this.carriedMassKg||40)/75)) : 1);
		if(this.adventure?.stance&&this.adventure.dodgeTimer>0&&!inHold&&!this.input.gameplayBlocked){_wish.copy(this.adventure.dodgeDir).applyQuaternion(b.quaternion.clone().invert());_wish.y=0;_wish.normalize();speed=4.4;}
        const k = 1 - Math.exp( - 12 * dt );
		const v = this.deckVel;
		v.x += ( _wish.x * speed - v.x ) * k;
		v.z += ( _wish.z * speed - v.z ) * k;
		if ( !inHold && this.deckGrounded && inp.hit( 'Space' ) ) {

			v.y = 3.2*(this.carryingChest?.65:1);
			this.deckGrounded = false;

		}

		v.y -= 9.81 * dt;
		const p = this.deckPos;
		const previousFeet={x:p.x,y:p.y,z:p.z};
		const oldX = p.x, oldZ = p.z;
		// Limit a single collision step; a tab returning from background must
        // never tunnel the avatar through an interior bulkhead.
		p.addScaledVector( v, Math.min(dt, .05) );
		let motorSupport=null;
		if(heritage&&b.model.collisionWorld){
			const hit=moveDeckCapsule(b.model.collisionWorld,previousFeet,p,{
				radius:DUTCH_SAILOR.radius,height:Math.min(sailorPosture(b.model.collisionWorld,previousFeet).height,sailorPosture(b.model.collisionWorld,p).height,sailorPosture(b.model.collisionWorld,{x:p.x,y:p.y+(inLowerHold?.12:.23),z:p.z}).height,inHold?Math.max(.98,activeInterior.layout.deckY-p.y-.1):DUTCH_SAILOR.height),
				grounded:this.deckGrounded,stepHeight:inLowerHold?.12:.23,dynamic:b.model.originalDoor?.collider?[b.model.originalDoor.collider]:[]
			});
			if(hit.stepped){motorSupport=hit.support;v.y=0;}
			p.set(hit.x,hit.y,hit.z);
			for(const {normal:n} of hit.contacts){const inward=v.x*n[0]+v.y*n[1]+v.z*n[2];
				if(inward<0){v.x-=inward*n[0];v.y-=inward*n[1];v.z-=inward*n[2];}}
			this.collisionContacts=hit.contacts;
		}

		if ( inHold ) {
            if(heritage){const posture=sailorPosture(b.model.collisionWorld,p);this.poseHeight=Math.min(posture.height,Math.max(.98,activeInterior.layout.deckY-p.y-.1));this.crouched=this.poseHeight<DUTCH_SAILOR.height-.08;}
			// Low crawl-space is rigidly attached to the hull. Deck-level cannons,
			// mast and bulwark colliders must not push a sailor through hold walls.
			activeInterior.constrain(p,previousFeet);
            const realFloor=b.model.collisionWorld?.floorAt(p.x,p.z,previousFeet.y+.24,activeInterior.layout.floorY-.1);
            p.y=motorSupport??realFloor??activeInterior.floorAt(p.z);
			v.y=0;this.deckGrounded=true;
			this.stepDist+=Math.hypot(p.x-oldX,p.z-oldZ);
			if(this.stepDist>.65){this.stepDist=0;this.audio?.footstep?.('wood');}
			this.deckToWorld();
			const head=heritage?sailorPosture(b.model.collisionWorld,p):{height:1.75,eye:DUTCH_SAILOR.eye,crouched:false};this.poseHeight=head.height;this.crouched=head.crouched;
            const eye=_v.set(p.x,p.y+Math.max(.25,Math.min(head.eye,activeInterior.layout.deckY-p.y-.20)),p.z);
			b.toWorld(eye,this.camera.position);
			this.deckBase(_q);
			this.camera.quaternion.copy(_q).multiply(_qa.setFromEuler(_e.set(this.pitch,this.deckYaw,0)));
			this.prompt={key:'W / S',text:inLowerHold?'对准货舱梯：W 上 / S 下':'船长室：WASD 行走，沿门内阶梯步行出入'};
			return;
		}

		// walls: push out of the solid boxes you can't step onto (boat frame, axis aligned)
		for ( let iter = 0; iter < 2; iter ++ ) for ( const c of heritage ? [...b.model.heritageDeck.collisionBoxes, ...(b.model.mastLookout?.colliders || [])] : b.model.colliders ) {

			if ( ! c.solid ) continue;
			const top = c.center.y + c.half.y, bot = c.center.y - c.half.y;
            if ( top <= p.y + DECK_STEP || bot >= p.y + (heritage?DUTCH_SAILOR.height:HEIGHT) ) continue;
			const ex = c.half.x + DECK_RADIUS, ez = c.half.z + DECK_RADIUS;
			const dx = p.x - c.center.x, dz = p.z - c.center.z;
			if ( Math.abs( dx ) >= ex || Math.abs( dz ) >= ez ) continue;
			const px = ex - Math.abs( dx ), pz = ez - Math.abs( dz );
			if ( px < pz ) { p.x += Math.sign( dx || ( oldX - c.center.x ) || 1 ) * px; v.x = 0; }
			else { p.z += Math.sign( dz || ( oldZ - c.center.z ) || 1 ) * pz; v.z = 0; }

		}

        // V52 source-geometry door aperture: a body-sized swept crossing is
        // accepted only when the REAL hinged panel has swung clear. Beside the
        // aperture, the bulkhead is solid. Raised deck feet (>1.7m) still
        // traverse above the wall using the existing source ladder/upper deck.
        if(heritage && !this.mastClimb && !this.aftLadderClimb &&
           !canCrossAftDoor({x:oldX,y:p.y,z:oldZ},p,b.model.originalDoor)){
           p.z=oldZ;v.z=0;
        }
		// Heritage ship: local metre envelope corresponds to the actual Dutch
		// art, not an 8m hydro hull multiplied again. A genuine jump above the
		// rail or a designated ladder cutout permits leaving the ship freely.
		if(heritage){
            // Walk ONLY on faces projected from the supplied uncut hull. There
            // is no invented rectangle under the player. A jump above the
            // original bulwark may leave the ship naturally.
            // The source GLB has an actual open hatch: collision cannot invent a
            // transparent floor over the hole. Walkers can descend physically.
            const inOpenHatch=!!this.shipInterior?.inHatch(p)||!!this.lowerHold?.inHatch(p);
            const inOpenCompanionway=!!this.shipInterior&&inAftCompanionway(p);
            const geometry=b.model.collisionWorld;
            const floor=geometry?geometry.floorAt(p.x,p.z,p.y+DECK_STEP,-4):measuredFloorAt(p.x,p.z,p.y+DECK_STEP);
            const railEscape=railingEscape(p.x,p.z,p.y);
            const outsideHull=Math.abs(p.x)>actualHalfWidth(p.z)-DECK_RADIUS || p.z>10.45||p.z< -10.55;
            if(outsideHull&&railEscape&&floor===null){this.fallOverboard();return;}
            if(floor===null&&!inOpenHatch&&!inOpenCompanionway&&!Number.isFinite(lookoutFloor(p.x,p.z,p.y+DECK_STEP))){
                // Swept axis slide: reject a step without authored floor
                // support instead of pushing the avatar into a false wall.
                const fx=geometry?geometry.floorAt(oldX,p.z,p.y+DECK_STEP,-4):measuredFloorAt(oldX,p.z,p.y+DECK_STEP);
                const fz=geometry?geometry.floorAt(p.x,oldZ,p.y+DECK_STEP,-4):measuredFloorAt(p.x,oldZ,p.y+DECK_STEP);
                if(fx!==null){p.x=oldX;v.x=0;}
                else if(fz!==null){p.z=oldZ;v.z=0;}
                else{p.x=oldX;p.z=oldZ;v.x=0;v.z=0;}
            }
        }else{
			p.z = THREE.MathUtils.clamp( p.z, L.zAft + L.shell + DECK_RADIUS, L.zBow - .3 );
			const halfIn = Math.max(.15,L.halfBreadth(L.tAtSheerZ(p.z),Math.max(p.y,L.deckY))-L.shell-DECK_RADIUS);
			p.x=THREE.MathUtils.clamp(p.x,-halfIn,halfIn);
		}

		let g = motorSupport??this.deckGroundAt( p.x, p.z, p.y + DECK_STEP );
        if(heritage && !inHold && v.y<=0 && b.model.collisionWorld && !this.shipInterior?.inHatch(p) && !this.lowerHold?.inHatch(p) && !inAftCompanionway(p)){
            // Catch a crossed roof/deck plane even when a long falling step has
            // already passed below the normal step-up query height.
            const support=b.model.collisionWorld.footprintFloorAt(p.x,p.z,DUTCH_SAILOR.radius*.65,previousFeet.y+.025,p.y-.04);
            if(support!==null && support>=p.y-.025 && previousFeet.y>=support-.025)g=Math.max(g,support);
        }
        // The open source aperture has no walkable collision even when the
        // scripted ladder animation is not active.
        // If the sailor steps through the genuinely cut quarterdeck hatch,
        // the room floor is the only solid surface below it.
        if(heritage && this.shipInterior && g===-Infinity){
            const lowerHatch=this.lowerHold?.inHatch(p);
            const hatch=this.shipInterior.inHatch(p);
            const room=this.shipInterior.layout;
            // The new source-mesh main hatch opens into a distinct, walkable
            // 8 m hold; it never reuses the captain's furnished room layer.
            if(lowerHatch && p.y<=this.lowerHold.floorAt(p.z)+.08 && v.y<=0){
                this.deckLayer='lowerHold';this.lowerHold.constrain(p);
                p.y=this.lowerHold.floorAt(p.z);v.y=0;g=p.y;
            }
            // The rebuilt source door leads below the raised Dutch quarterdeck.
            // Walking inward follows gravity; once feet reach the actual fitted
            // captain-room floor, use that room's furniture collisions.
            const inDoorwayCabin=(p.z<room.z1-.08 && p.z>room.z0 &&
                Math.abs(p.x)<room.halfW-DUTCH_SAILOR.radius && p.y<1.25);
            const cabinFloor=this.shipInterior.floorAt(p.z);
            if((hatch||inDoorwayCabin) && !lowerHatch && p.y<=cabinFloor+.08 && v.y<=0){
                this.deckLayer='hold';this.shipInterior.constrain(p);
                p.y=cabinFloor;v.y=0;g=cabinFloor;
            }
        }
        // A missing/badly triangulated authored walkmap cell must not send a
        // sailor through the bottom of an intact sealed compartment.
        if(heritage && this.deckLayer==='deck' && this.lowerHold?.inside(p) &&
           p.y<.11 && v.y<=0 && !this.mastClimb && !this.aftLadderClimb &&
           !railingEscape(p.x,p.z,p.y)){
            this.deckLayer='lowerHold';this.lowerHold.constrain(p);
            p.y=this.lowerHold.floorAt(p.z);g=p.y;v.y=0;
        }
        // A separate sealed aft cabin needs its own safety floor. Never
        // reclassify it as the *main* hold when a seam is missed.
        if(heritage && this.deckLayer==='deck' && this.shipInterior?.inside(p) &&
           p.y<.10 && v.y<=0 && !this.shipClimb && !this.aftLadderClimb){
            this.deckLayer='hold';this.shipInterior.constrain(p);
            p.y=this.shipInterior.floorAt(p.z);g=p.y;v.y=0;
        }
		if ( p.y <= g ) {

			p.y = g;
			if ( v.y < 0 ) v.y = 0;
			this.deckGrounded = true;

		} else this.deckGrounded = p.y - g < 0.04;

		// footsteps on the deck
		const moved = Math.hypot( p.x - oldX, p.z - oldZ );
		if ( this.deckGrounded ) {

			this.bob += moved * 2.4;
			this.stepDist += moved;
			if ( this.stepDist > 0.6 ) {

				this.stepDist = 0;
				if ( this.audio ) this.audio.footstep( 'wood' );

			}

		}

		this.deckToWorld();

		// prompts: take the helm, or step ashore
		const hx = b.model.helmPoint.x, hz = b.model.helmPoint.z;
		const nearHelm = Math.hypot( p.x - hx, p.z - hz ) < HELM_REACH && ! this.busy;
		this._ashoreT -= dt;
		if ( this._ashoreT <= 0 ) {

			this._ashoreT = 0.25;
			this._ashore = b.speed < 2.5 ? this.ashoreTarget() : null;

		}

		if ( nearHelm && !this.voyageM1 ) {

			this.prompt = { key: 'E', text: 'Take the helm' };
			if ( inp.consume( 'KeyE' ) ) {

				this.takeHelm();
				return;

			}

		} else if ( ! this.busy && !heritage && ( !this.voyageM1 || (inp.down('ShiftLeft') || inp.down('ShiftRight')) ) ) {

			// M1 deliberately uses Shift+E for disembark: E alone belongs to
			// station equipment, several pieces of which overlap the rail exit points.
			// at the rail: step ashore where there is ground on that side, else jump into the sea
			const ep = this._ashore && this._ashore.ep;
			const atRail = b.model.exitPoints.some( ( e ) => Math.hypot( p.x - e.x, p.z - e.z ) < 1.3 );
			if ( ep && Math.hypot( p.x - ep.x, p.z - ep.z ) < 1.3 ) {

				this.prompt = { key: this.voyageM1 ? 'Shift+E' : 'E', text: 'Step ashore' };
				if ( inp.consume( 'KeyE', this.voyageM1 ? 'voyage' : null ) ) {

					this.exitBoat( this._ashore );
					return;

				}

			} else if ( atRail ) {

				this.prompt = { key: this.voyageM1 ? 'Shift+E' : 'E', text: 'Jump overboard' };
				if ( inp.consume( 'KeyE', this.voyageM1 ? 'voyage' : null ) ) {

					this.exitBoat( null, Math.sign( p.x ) || 1 );
					return;

				}

			}

		}

		// camera: eye above the feet, following the boat's motion
		const posture=heritage?sailorPosture(b.model.collisionWorld,p):{eye:EYE,crouched:false};this.crouched=posture.crouched;this.poseHeight=posture.height;
		this.deckEye=this.deckEye===undefined?posture.eye:this.deckEye+(posture.eye-this.deckEye)*Math.min(1,dt*15);
		const eyeL = _v.set( p.x, p.y + this.deckEye + Math.sin( this.bob ) * 0.02, p.z );
		b.toWorld( eyeL, this.camera.position );
		this._camY = this.camera.position.y;
		this.deckBase( _q );
		this.camera.quaternion.copy( _q ).multiply( _qa.setFromEuler( _e.set( this.pitch, this.deckYaw, 0 ) ) );
		if(this.voyageM1 && this.deckViewMode==='third' && this.deckLayer!=='hold' && !this.shipClimb){
			// Optional third-person navigation: only presentation changes; physical
			// deck feet/colliders and ship-station inputs remain authoritative.
			const facing=b.getYaw()+Math.PI+this.deckYaw;
			const target=this.camera.position.clone();
			this.camera.position.set(target.x+Math.sin(facing)*3.4,target.y+1.18,target.z+Math.cos(facing)*3.4);
			// Do not let the chase camera travel inside the bow planking:
            // clearance is computed in the authoritative moving boat frame.
            const localCam=this.camera.position.clone().sub(b.position).applyQuaternion(b.quaternion.clone().invert());
            if(localCam.z>3.6 && localCam.z<10.5 && Math.abs(localCam.x)<actualHalfWidth(localCam.z)+.08){
                const minY=deckHeight(localCam.z,localCam.x)+.65;
                if(localCam.y<minY){localCam.y=minY;this.camera.position.copy(localCam.applyQuaternion(b.quaternion).add(b.position));}
            }
			this.camera.position.y=Math.max(this.camera.position.y,this.waterH+.6);
            if(heritage&&b.model.collisionWorld){const inv=b.quaternion.clone().invert(),a=target.clone().sub(b.position).applyQuaternion(inv),end=this.camera.position.clone().sub(b.position).applyQuaternion(inv),length=a.distanceTo(end);const f=triangleBoomFraction(b.model.collisionWorld,a,end,b.model.originalDoor?.collider?[b.model.originalDoor.collider]:[]);if(f<1)this.camera.position.lerp(target,1-Math.max(0,f-.14/Math.max(.01,length)));}
            if(this.camera.position.distanceTo(target)<.65){this.camera.position.copy(target);this.cameraOccluded=true;}else this.camera.lookAt(target);
		}

	}

	updateBoat( dt ) {

		const inp = this.input;
		const b = this.boat;
		const look = inp.consumeLook();
		const wheel = inp.consumeWheel();

		if ( inp.hit( 'KeyV' ) ) this.camMode = this.camMode === 'first' ? 'third' : 'first';
		if ( inp.consume( 'KeyE' ) ) {

			this.leaveHelm();
			return;

		}

		let throttle = 0;
		if ( inp.down( 'KeyW' ) ) throttle = inp.down( 'ShiftLeft' ) ? 1 : 0.7;
		if ( inp.down( 'KeyS' ) ) throttle = - 0.6;
		let steer = 0;
		if ( inp.down( 'KeyA' ) ) steer += 1;
		if ( inp.down( 'KeyD' ) ) steer -= 1;
		b.setInput( throttle, steer, dt );
		this.prompt = { key: 'E', text: 'Leave helm   ·   V  camera' };

		// keep the player attached (for audio / queries)
		b.toWorld( b.model.helmEye, this.position );
		this.position.y -= EYE;

		if ( this.camMode === 'first' ) {

			this.helmYaw = THREE.MathUtils.clamp( this.helmYaw - look.x * 0.0022, - 2.2, 2.2 );
			this.helmPitch = THREE.MathUtils.clamp( this.helmPitch - look.y * 0.0022, - 1.2, 1.0 );
			const eye = b.toWorld( b.model.helmEye, new THREE.Vector3() );
			this.camera.position.copy( eye );
			// head partially stabilises against roll and pitch (feels natural, less nausea)
			const boatQ = b.quaternion;
			const yawOnly = new THREE.Quaternion().setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), b.getYaw() + Math.PI );
			const base = new THREE.Quaternion().slerpQuaternions( boatQ.clone().multiply( new THREE.Quaternion().setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), Math.PI ) ), yawOnly, 0.55 );
			const local = new THREE.Quaternion().setFromEuler( _e.set( this.helmPitch, this.helmYaw, 0 ) );
			this.camera.quaternion.copy( base ).multiply( local );

		} else {

			this.orbitYaw -= look.x * 0.003;
			this.orbitPitch = THREE.MathUtils.clamp( this.orbitPitch + look.y * 0.003, - 0.05, 1.2 );
			this.orbitDist = THREE.MathUtils.clamp( this.orbitDist * ( 1 + wheel * 0.08 ), 6, 40 );
			// gently swing behind the boat when moving
			if ( b.speed > 2 && Math.abs( look.x ) < 0.5 ) {

				const behind = b.getYaw() + Math.PI;
				let d = behind - this.orbitYaw;
				d = Math.atan2( Math.sin( d ), Math.cos( d ) );
				this.orbitYaw += d * ( 1 - Math.exp( - dt * 0.8 ) );

			}

			const target = b.toWorld( new THREE.Vector3( 0, 1.4, 0 ), new THREE.Vector3() );
			const off = new THREE.Vector3(
				Math.sin( this.orbitYaw ) * Math.cos( this.orbitPitch ),
				Math.sin( this.orbitPitch ),
				Math.cos( this.orbitYaw ) * Math.cos( this.orbitPitch )
			).multiplyScalar( this.orbitDist );
			const want = target.clone().add( off );
			want.y = Math.max( want.y, this.waterH + 0.7 );
			if ( ! this.camInit ) {

				this.camPos.copy( want );
				this.camInit = true;

			}

			this.camPos.lerp( want, 1 - Math.exp( - dt * 6 ) );
			this.camera.position.copy( this.camPos );
			this.camera.lookAt( target );

		}

	}

}
