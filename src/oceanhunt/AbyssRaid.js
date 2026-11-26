import {AbyssHatchV83} from './AbyssHatchV83.js';
import {newPressure,copyPressure,validatePressure,totalHull,applyPressureDamage,repairPressure,stepPressure,pressureDrive,SECTION_NAMES,nearBulkhead,toggleBulkhead} from './PressureSystemsV80.js';
import {AbyssInterior} from './AbyssInterior.js';
import {ABYSS_STATIONS,canStationAction,helmOwner,resolveAbyssDrive} from './AbyssCrewRules.js';
import {LeviathanSpells,LEVIATHAN_SPELLS,createLeviathanCast,spellContact,encodeCast,decodeCast} from './LeviathanSpells.js';
import { Group, Mesh, Vector3, Color } from '../engine/index.js';
import { Material } from '../engine/render/Material.js';
import { sphere, torus } from '../world/boat/GeoKit.js';
import { createTitanAsset } from './TitanAssets.js';
import { attachTitanSkeleton, updateTitanSkeleton } from './TitanSkeleton.js';
import { G } from '../core/Globals.js';
import { returnCaptainToMainIsland } from './DeveloperTools.js';
import { approachSpeed, leviathanMouthPosition, movingJawHullContact, closestSegmentPoints } from './AbyssCombatPhysics.js';
import { SUBMARINE_DRIVE, stepSubmarineDynamics, adjustSubmarineThrottle, orbitSubmarineCamera } from './SubmarineDynamics.js';
import { animateLeviathanRig } from './LeviathanRig.js';

// V23 final encounter occupies an actual region below the offshore sea,
// without replacing V22's surface giants, ocean simulation or captain.
export const ABYSS_ZONE = Object.freeze( {
	name: '无光王庭 · 海神之渊', x: -3180, z: 4900,
	startX: -3250, startZ: 5150, startDepth: 52, bossDepth: 225,
	// Advisory patrol radius, NOT a solid invisible wall.
	radius: 1800, maxDepth: 390, safeDepth: 295,
} );
export const ABYSS_STATS = Object.freeze( {
	hull: 1500, leviathan: 6100, torpedo: 155, torpedoReload: 1.16,
	sonarRecharge: 9, maxSpeed: SUBMARINE_DRIVE.cruise, pressureDamage: 14,
} );

const clamp = ( x, a, b ) => Math.max( a, Math.min( b, x ) );
const smooth = ( a, b, dt, rate = 4 ) => a + ( b - a ) * ( 1 - Math.exp( - dt * rate ) );
const bearing = ( dx, dz ) => Math.atan2( dx, dz );
const angleDiff = ( a, b ) => Math.atan2( Math.sin( a - b ), Math.cos( a - b ) );
// New key deliberately resets V29's stored mouse-steering preference: the
// player's first V30 sortie must use the physically separate ship helm.
const HELM_PREF_KEY = 'tidewater:abyss-helm:v66';
const SENSITIVITIES = [ .7, 1, 1.35 ];
function savedHelmPreferences() {
	try {
		const saved = JSON.parse( localStorage.getItem( HELM_PREF_KEY ) || '{}' );
		return { mode: saved.mode === 'helm' ? 'helm' : 'arcade',
			sensitivity: SENSITIVITIES.includes( saved.sensitivity ) ? saved.sensitivity : 1, invertX:!!saved.invertX, invertY:!!saved.invertY };
	} catch { return { mode: 'arcade', sensitivity: 1,invertX:false,invertY:false }; }
}
// The abyss combines a large animated creature, multiple lights and full-screen
// underwater effects. Limit its internal pixel count on large displays; the
// post chain still reconstructs the image at the window's output resolution.
export function abyssRenderScale( width, height, current ) {
	const pixels = width * height;
	const limit = pixels > 2500000 ? .6 : pixels > 1600000 ? .75 : 1;
	return Math.min( current, limit );
}

// The 250 m boss can pass over the chase camera. Do not draw its opaque
// body from inside its volume or it can fill the entire view during a bite.
export function cameraInsideLeviathan( local, wasHidden = false ) {
	const padding = wasHidden ? 1.12 : 1;
	return ( local.x / ( 55 * padding ) ) ** 2 +
		( local.y / ( 64 * padding ) ) ** 2 + ( local.z / ( 130 * padding ) ) ** 2 < 1;
}
export const abyssSteering = ( angle, target, rate, dt ) => angle +
	clamp( angleDiff( target, angle ), -rate * dt, rate * dt );
const forward = ( yaw, pitch, out ) => out.set( Math.sin( yaw ) * Math.cos( pitch ), - Math.sin( pitch ), Math.cos( yaw ) * Math.cos( pitch ) );
const _f = new Vector3(), _d = new Vector3(), _p = new Vector3(), _q = new Vector3();

// Separates the vehicle heading from the camera's aim. Both camera modes use
// the same continuous orientation, avoiding the fixed-forward V23 blind spot.
export function abyssCameraPose( origin, heading, orbitYaw, orbitElevation, distance, mode = 'chase' ) {
	const viewYaw = heading + orbitYaw;
	// Positive elevation raises the third-person camera, so its sight must
	// look DOWN, not up. It also corrects the periscope's inverted mouse Y.
	const sight = forward( viewYaw, orbitElevation, new Vector3() );
	if ( mode === 'bridge' ) {
		const position = origin.clone().addScaledVector( forward( heading, 0, new Vector3() ), 8 );
		position.y += 8.5; // above the armored conning tower, not inside an opaque mesh
		return { position, target: position.clone().addScaledVector( sight, 90 ) };
	}
	const anchor = origin.clone().addScaledVector( forward( heading, 0, new Vector3() ), 8 );
	anchor.y += 3;
	const orbitRay = forward( viewYaw, orbitElevation, new Vector3() );
	const position = anchor.clone().addScaledVector( orbitRay, -distance );
	position.y += 2.8;
	return { position, target: anchor.clone().addScaledVector( sight, 9 ) };
}

// Purely geometric 3-D capsule test: attack contact must be against a real
// section of the creature, never the distance to a flat screen-space icon.
export function distanceToSegment( point, a, b ) {
	const d = _d.subVectors( b, a ), length2 = d.lengthSq();
	const t = length2 > 1e-6 ? clamp( _p.subVectors( point, a ).dot( d ) / length2, 0, 1 ) : 0;
	return _q.copy( a ).addScaledVector( d, t ).distanceTo( point );
}
export function phaseAt( healthFraction ) {
	return healthFraction > .70 ? 1 : healthFraction > .30 ? 2 : 3;
}
export function pressureAt( depth, safe = ABYSS_ZONE.safeDepth ) {
	return Math.max( 0, depth - safe );
}
export function beyondAbyssPatrol( x, z, zone = ABYSS_ZONE ) {
	return Math.hypot( x - zone.x, z - zone.z ) > zone.radius;
}
export function shockfrontHit( oldRadius, newRadius, targetDistance, halfWidth = 12 ) {
	return targetDistance + halfWidth >= oldRadius && targetDistance - halfWidth <= newRadius;
}
export function sonarConeHit( origin, heading, target, oldRadius, newRadius, halfAngle = .61 ) {
	const delta = target.clone().sub( origin );
	const range = delta.length();
	return range > 1e-4 && shockfrontHit( oldRadius, newRadius, range, 10 ) &&
		delta.multiplyScalar( 1 / range ).dot( heading ) >= Math.cos( halfAngle );
}

function material( hex, rough = .35, metal = .1 ) {
	return new Material( { color: hex, roughness: rough, metalness: metal } );
}

export class AbyssRaid {
	constructor( app, progress, developer = false ) {
		this.app = app;
		this.progress = progress;
		this.developer = developer;
		this.active = false;
		this.loaded = false;
		this.loading = null;
		this.elapsed = 0;
		this.sub = new Group(); this.sub.name = 'V23_DemonWhale_Submarine';
		this.god = new Group(); this.god.name = 'V23_OceanGod_Leviathan';
		// Artist's static display includes a huge illuminated stage and dozens of
		// very high-polygon motes. The actual boss keeps the sculpted whale body;
		// these low-cost emissive spheres recreate its quiet bioluminescent halo.
		this.godMotes = [];
		const moteGeometry = sphere( 1, 12, 8 );
		const moteMaterial = new Material( { color: 0x39a9cc,
			emissive: new Color( .13, .73, 1.3 ), roughness: .14, metalness: .05 } );
		for ( let i = 0; i < 18; i ++ ) {
			const phase = i * 2.399963;
			const base = new Vector3( Math.sin( phase ) * ( 17 + i % 4 * 5 ),
				Math.cos( phase * 1.4 ) * ( 14 + i % 3 * 6 ), -102 + i * 12.0 );
			const mote = new Mesh( moteGeometry, moteMaterial );
			mote.name = `ArtistLeviathan_BioluminescentMote_${ i }`;
			mote.scale.setScalar( .54 + i % 3 * .22 );
			mote.position.copy( base );
			this.god.add( mote );
			this.godMotes.push( { mote, base, phase } );
		}
		// Emissive lamp lenses remain visible from the chase camera even when
		// almost all ambient sunlight has been absorbed by deep water.
		const glass = new Material( { color: 0x74cbe6, emissive: new Color( .37, .94, 1.16 ),
			roughness: .12, metalness: .08 } );
		for ( const x of [ -5.2, 5.2 ] ) {
			const lens = new Mesh( sphere( 1.05, 20, 12 ), glass );
			lens.name = 'DemonWhale_PhysicalForwardSearchlightLens';
			lens.position.set( x, .8, 14 );
			this.sub.add( lens );
		}
		const markerGlass = new Material( { color: 0x386d85,
			emissive: new Color( .10, .49, .75 ), roughness: .23 } );
		for ( const x of [ -2.8, 2.8 ] ) {
			const cabin = new Mesh( sphere( .65, 16, 10 ), markerGlass );
			cabin.name = 'DemonWhale_ConningTowerBlueWindow';
			cabin.position.set( x, 8.6, 3.0 );
			this.sub.add( cabin );
		}
		this.sub.visible = false; this.god.visible = false;
		this.app.scene.add( this.sub, this.god );
        this.interior=new AbyssInterior(this.sub);this.hatch=new AbyssHatchV83(this.sub); this.spells=new LeviathanSpells(this.app.scene);this.members={};this.roomHost=null;this.netShots=[];this.netWaves=[];this.netClock=0;this.crewDrive=null;this.remotePose=null;this.parts=6;this.ammo=48;this.repairCooldown=0;
		this.pos = new Vector3();
		this.godPos = new Vector3();
		this.forward = new Vector3();
		this.godForward = new Vector3();
		this.torpedoes = [];
		this.impacts = [];
		this.torpedoGeometry = sphere( .58, 14, 8 );
		this.torpedoMaterial = material( 0xc6a86d, .32, .77 );
		this.burstMaterial = material( 0x65d3e6, .25, .05 );
		this.ringMaterial = material( 0x3ac5de, .19, .05 );
		this.shockMaterial = new Material( { color: 0x3f9db1, opacity: .65, transparent: true,
			roughness: .17, metalness: .04, depthWrite: false } );
		this.impactGeometry = sphere( .36, 9, 6 );
		this.sonarGeometry = torus( 1, .09, 8, 56 );
		this.sonarRing = new Mesh( this.sonarGeometry, this.ringMaterial );
		this.sonarRing.visible = false;
		this.sonarRing.rotation.x = Math.PI / 2;
		this.app.scene.add( this.sonarRing );
		this.shockwaves = [];
		this.sonarClock = 0;
		this.pingClock = 0;
		this.notice = '';
		this.noticeClock = 0;
		this.cameraMode = 'chase';
		this.bossLock = false;
		this.orbitYaw = 0;
		this.orbitElevation = .23;
		this.cameraDistance = 46;
		this.cameraPrimed = false;
		this.cameraAim = new Vector3();
		const helmPrefs = savedHelmPreferences();
		this.helmMode = helmPrefs.mode;
		this.mouseSensitivity = helmPrefs.sensitivity;this.invertX=!!helmPrefs.invertX;this.invertY=!!helmPrefs.invertY;
		this.throttle = 0;
		this.throttleHold = 0;
		this.rudder = 0;
		this.orbitTargetYaw = 0;
		this.orbitTargetElevation = .23;
		this.godYawRate = 0;
		this.godPitch = 0;
		this.godBank = 0;
		this.jawOpen = 0;
		this.biteClock = 0;
		this.bossHitFlash = 0;
		this.godHurt = 0;
	this.subImpulse = new Vector3();
		this.yawRate = 0;
		this.subRoll = 0;
		this.diveVelocity = 0;
		this.waterJets = [];
		this.depthCharges = [];
		this.harpoonCooldown = 0;
		this.chargeCooldown = 0;
		this.counterPulseCooldown = 0;
		this.projectileGeometry = sphere( 2.25, 16, 10 );
		this.jetMaterial = new Material( { color: 0x43c7f8,
			emissive: new Color( .21, 1.0, 1.95 ), roughness: .08, metalness: .04 } );
		this.harpoonMaterial = new Material( { color: 0xf1af68,
			emissive: new Color( 1.3, .64, .15 ), roughness: .17, metalness: .35 } );
		this.chargeMaterial = new Material( { color: 0xffcf72,
			emissive: new Color( .92, .42, .07 ), roughness: .24, metalness: .43 } );
		this.lampsOn = true;
		this.installDiveLights();
		this.hud = document.createElement( 'div' );
		this.hud.className = 'abyss-raid-hud';
		this.hud.hidden = true;
		this.hud.innerHTML = `<header><div class="abyss-title"><small>STORMWAKE · FINAL CHAPTER</small><strong>🐋 深海魔鲸号 · 海神猎场</strong></div><nav aria-label="潜艇航行"><button data-abyss="cabin">进入舱内 / 外视角</button><button data-abyss="exit">返回海面</button><button data-abyss="home" class="abyss-home">⌂ 传送回主岛</button></nav></header>
			<div class="abyss-stat"><span data-abyss-hp>船体 1500 / 1500</span><span data-abyss-depth>深度 0 m</span><span data-abyss-god>海神未知</span>
			<span data-abyss-nav>◉ 声呐目标：定位中</span><span data-abyss-telemetry>潜艇推进待命</span><span data-abyss-model>3D 美术加载中</span></div>
			<div class="abyss-instruments"><span class="abyss-gauge-caption">实际航速</span><span data-abyss-speed>0.0 m/s</span><div class="abyss-speed-track"><i data-abyss-speed-fill></i></div><span data-abyss-target-speed>目标航速 0.0 m/s</span><span data-abyss-thrust>车钟：停车</span><div class="abyss-throttle-track"><i data-abyss-throttle-fill></i><b data-abyss-throttle-zero></b></div><span data-abyss-rudder>方向舵 居中</span><span data-abyss-bearing>航向 000°</span><span data-abyss-helm-label>标准船舵 · 鼠标只观察</span><div class="abyss-telegraph-actions"><button data-abyss="throttle-down" title="降一档 / 倒车">− 降档</button><button data-abyss="throttle-stop" title="紧急停车 N">停 N</button><button data-abyss="throttle-up" title="升一档">＋ 升档</button></div></div>
			<section class="abyss-crew-station"><strong data-abyss-station>舱内岗位</strong><span data-abyss-crew></span><span data-abyss-supplies></span><span data-abyss-task></span><span data-abyss-pressure></span><button data-abyss="hatch">气密舱 O</button><button data-abyss="door">隔舱门 · U</button><button data-abyss="pump">排水泵 · J</button><button data-abyss="station">E · 操作 / 离开岗位</button><button data-abyss="repair">Y · 修复船体</button></section><div class="abyss-aim" aria-hidden="true"><span></span><small data-abyss-aim>航行准星</small></div>
			<div class="abyss-weapon"><span class="abyss-shortcuts">W/S 调车钟，松开保持航速 · A/D 左右打舵，松开回中 · 鼠标只环视 · N 停车 · Shift 急速 · Space 上浮 · Q/Ctrl 下潜 · B 应急上浮 · F 锁定 · C 鱼雷 · G 鱼叉 · T 深弹 · Z 防御 · R 声呐 · V 镜头 · X 回正 · H 模式 · Esc 释放</span>
			<div class="abyss-actions"><button data-abyss="fire">鱼雷 C</button><button data-abyss="harpoon">磁轨鱼叉 G</button><button data-abyss="charge">深水炸弹 T</button><button data-abyss="counter">反声波 Z</button><button data-abyss="sonar">声呐 R</button>
			<button data-abyss="emergency">应急上浮 B</button>
			<button data-abyss="helm">标准船舵 H</button><button data-abyss="sensitivity">镜头灵敏度：中</button><button data-abyss="invert-x">水平：正常</button><button data-abyss="invert-y">垂直：正常</button>
			<button data-abyss="camera">视角 V</button><button data-abyss="reset">镜头回正 X</button>
			<button data-abyss="lights">探照灯：开 L</button></div></div><p data-abyss-alert role="status"></p>`;
		this.hud.addEventListener( 'click', event => {
			const action = event.target.closest( '[data-abyss]' )?.dataset.abyss;
			if ( action === 'exit' ) this.exit();
			if ( action === 'home' ) this.returnHome();
			if ( action === 'fire' ) this.requestAction('fire');
			if ( action === 'harpoon' ) this.requestAction('harpoon');
			if ( action === 'charge' ) this.requestAction('charge');
			if ( action === 'counter' ) this.requestAction('counter');
			if ( action === 'sonar' ) this.requestAction('sonar');
			if ( action === 'camera' ) this.switchCamera();
            if(action==='cabin')this.setCabin(this.cameraMode!=='interior');
            if(action==='station')this.useStation();if(action==='hatch')this.requestHatch();
            if(action==='repair')this.requestAction('repair');if(action==='pump')this.requestAction('pump');if(action==='door')this.requestDoor();
			if ( action === 'reset' ) this.resetCamera();
			if ( action === 'lights' ) this.toggleDiveLights();
			if ( action === 'emergency' && this.localHelm() && !this.remoteClient() ) this.toggleEmergencyAscent();
			if ( action === 'throttle-up' && this.localHelm() ) this.changeThrottle( SUBMARINE_DRIVE.throttleNotch );
			if ( action === 'throttle-down' && this.localHelm() ) this.changeThrottle( -SUBMARINE_DRIVE.throttleNotch );
			if ( action === 'throttle-stop' && this.localHelm() ) {this.allStop();if(this.app.crew?.connected&&this.roomHost)this.app.crew.send({type:'abyss_command',action:'stop'});}
			if ( action === 'helm' && this.localHelm() ) this.toggleHelm();
			if ( action === 'sensitivity' ) this.cycleSensitivity();
            if(action==='invert-x'||action==='invert-y'){const key=action==='invert-x'?'invertX':'invertY';this[key]=!this[key];this.saveHelm();this.renderHud();}
		} );
		document.body.append( this.hud );
		this.esc = event => {
			if ( this.active && event.code === 'Escape' ) {
				event.preventDefault(); event.stopImmediatePropagation();
				if ( document.pointerLockElement ) document.exitPointerLock?.();
				else this.exit();
			}
		};
		window.addEventListener( 'keydown', this.esc, true );
	}

	installDiveLights() {
		const lights = this.app.localLights;
		this.diveLights = [];
		if ( !lights ) return;
		const defs = [
			{ side: -5.2, rise: .8, front: 14, intensity: 52000, range: 230, color: [ .62, .86, 1 ], beam: true },
			{ side: 5.2, rise: .8, front: 14, intensity: 52000, range: 230, color: [ .62, .86, 1 ], beam: true },
			{ side: 0, rise: -3, front: 12, intensity: 16000, range: 130, color: [ .30, .72, .98 ], beam: false },
		];
		for ( const d of defs ) {
			this.diveLights.push( lights.add( {
				position: new Vector3(), dir: d.beam ? new Vector3( 0, 0, 1 ) : null,
				color: new Color( ...d.color ), intensity: d.intensity, range: d.range,
				cosInner: d.beam ? Math.cos( .21 ) : undefined,
				cosOuter: d.beam ? Math.cos( .61 ) : undefined,
				kind: 'abyssSubSearchlight', alwaysOn: true, enabled: false, spec: d,
			} ) );
		}
		this.bossLight = lights.add( {
			position: new Vector3(), color: new Color( .15, .75, .92 ),
			intensity: 72000, range: 320, kind: 'abyssGodBioluminescence',
			alwaysOn: true, enabled: false, flicker: .08,
		} );
	}

	updateDiveLights() {
		const right = new Vector3( Math.cos( this.yaw ), 0, -Math.sin( this.yaw ) );
		for ( const source of this.diveLights ) {
			const d = source.spec;
			source.position.copy( this.pos ).addScaledVector( this.forward, d.front )
				.addScaledVector( right, d.side );
			source.position.y += d.rise;
			if ( source.dir ) source.dir.copy( this.forward );
		}
		if ( this.bossLight ) this.bossLight.position.copy( this.godPos ).addScaledVector( this.godForward, 93 ).add( new Vector3( 0, 12, 0 ) );
		const fl = this.app.localLights?.flashlight;
		if ( fl && this.active ) {
			// Volumetric scattering is driven by the same actual vehicle spotlight.
			fl.overridePosition.copy( this.diveLights[0]?.position || this.pos );
			fl.overrideDir.copy( this.forward );
		}
	}

	toggleDiveLights( on = !this.lampsOn ) {
		this.lampsOn = on;
		for ( const s of this.diveLights ) s.enabled = this.active && on;
		if ( this.bossLight ) this.bossLight.enabled = this.active;
		const fl = this.app.localLights?.flashlight;
		if ( fl && this.active ) fl.on = on;
		this.renderHud();
		return on;
	}

	switchCamera() {
        if(this.hatch?.active)return;
		this.cameraMode = this.cameraMode === 'interior' ? 'bridge' : this.cameraMode === 'bridge' ? 'chase' : 'interior';
        this.setCabin(this.cameraMode==='interior',true);
		// Blend between views in update(); only the first abyss entry snaps.
	}


    remoteClient(){return !!(this.app.crew?.connected && this.roomHost && this.roomHost!==this.app.crew.selfId);}
    localHelm(){if(this.hatch?.active)return false;if(!this.interior)return true;const crew=this.app.crew;if(crew?.connected&&this.roomHost)return this.members[crew.selfId]?.station==='helm';return this.cameraMode!=='interior'||this.interior.station==='helm';}
    setCabin(on,keepMode=false){if(this.hatch?.active)return;if(!this.interior)return;this.interior.active=on;this.interior.root.visible=on;if(!keepMode)this.cameraMode=on?'interior':'chase';this.cameraPrimed=false;
      if(this.subAsset?.root)this.subAsset.root.visible=!on;
      for(const child of this.sub.children)if(child!==this.interior.root&&child!==this.subAsset?.root)child.visible=!on;
      this.hatch?.sync(on);if(on){this.orbitTargetYaw=0;this.orbitTargetElevation=.2;this.bossLock=false;}
    }
    useStation(){if(this.hatch?.active)return false;if(!this.interior||this.cameraMode!=='interior')return false;const next=this.interior.station?null:this.interior.near();if(!this.interior.station&&!next){this.notice='靠近发光的控制台后按 E：前舱驾驶、中舱武器/声呐、后舱维修。';this.noticeClock=2.5;return false;}
      if(this.app.crew?.connected&&this.roomHost){const p=this.interior.p;this.app.crew.send({type:'abyss_pose',x:p.x,z:p.z,yaw:this.interior.yaw});this.app.crew.send({type:'abyss_station',station:next});return true;}
      this.interior.station=next;if(next==='helm'){this.interior.yaw=0;this.interior.pitch=0;this.resetCamera();}return true;}
    requestAction(action){if(this.hatch?.active)return false;if(!this.active||this.finished&&!['repair','pump'].includes(action))return false;const online=this.app.crew?.connected&&this.roomHost;const station=this.interior?.station;
      if((online||this.cameraMode==='interior'||['repair','pump'].includes(action))&&!canStationAction(station,action)){this.notice='需要在对应岗位操作：武器台、声呐台或工程台。';this.noticeClock=2;return false;}
      if(online){const aim=this.weaponAim().toArray();this.app.crew.send({type:'abyss_command',action,aim});return true;}
      return this.applyAction(action,this.weaponAim());}
    weaponAim(){if(this.bossLock)return this.godPos.clone().sub(this.pos).normalize();if(this.cameraMode==='interior'){const pose=this.interior?.pose(this.sub);if(pose)return pose.target.sub(pose.position).normalize();return forward(this.yaw,this.pitch,new Vector3());}const pose=abyssCameraPose(this.pos,this.yaw,this.orbitYaw||0,this.orbitElevation||0,this.cameraDistance,this.cameraMode);return pose.target.sub(pose.position).normalize();}
    applyAction(action,aim,actor=null){if(!this.active)return false;const table={fire:'fire',harpoon:'fireHarpoon',charge:'dropDepthCharge',counter:'counterPulse',sonar:'sonar',repair:'repair',pump:'togglePump'};if(!table[action])return false;if(action==='repair')return this.repair(actor);return this[table[action]](aim);}
    togglePump(){if(!this.pressure)return false;this.pressure.pump=!this.pressure.pump;this.notice=this.pressure.pump?'排水泵开启':'排水泵停止';this.noticeClock=2;return true;}
    requestDoor(){if(this.hatch?.active)return false;if(!this.active||this.cameraMode!=='interior'||this.interior.station)return false;const i=nearBulkhead(this.interior.p);if(i<0)return false;if(this.app.crew?.connected&&this.roomHost){const p=this.interior.p;this.app.crew.send({type:'abyss_pose',x:p.x,z:p.z,yaw:this.interior.yaw});this.app.crew.send({type:'abyss_command',action:'door',index:i});return true;}return this.operateDoor(i);}
    operateDoor(i){if(!this.pressure)return false;const people=this.app.crew?.connected&&this.roomHost?Object.values(this.members):[this.interior.p];const ok=toggleBulkhead(this.pressure,i,people);this.notice=ok?(this.pressure.doors[i]?'隔舱门关闭 · 阻断水流':'隔舱门开启'):'隔舱门被人员阻挡';this.noticeClock=2;this.interior.setPressure(this.pressure);return ok;}
    repair(actor=null){if(!this.active||this.repairCooldown>0||this.repairJob||!this.pressure||this.parts<=0||totalHull(this.pressure)>=1500||totalHull(this.pressure)<=0)return false;
      const station=actor?this.members?.[actor]?.station:this.interior?.station;if(station!=='engine')return false;
      this.repairJob={actor,age:0};this.repairProgress=0;this.notice='工程台正在加压补漏（2.5秒） · 离岗取消，完成才消耗维修件。';this.noticeClock=3;return true;}
    stepRepair(dt){const j=this.repairJob;if(!j)return;const station=j.actor?this.members?.[j.actor]?.station:this.interior?.station;if(station!=='engine'||!this.active||this.parts<=0||this.hull<=0){this.repairJob=null;this.repairProgress=0;this.notice='维修中断 · 未消耗维修件';this.noticeClock=2;return;}
      j.age+=dt;this.repairProgress=Math.min(1,j.age/2.5);if(j.age<2.5)return;this.repairJob=null;this.repairProgress=0;const result=repairPressure(this.pressure,this.parts);if(!result)return;this.parts=result.parts;this.hull=totalHull(this.pressure);this.repairCooldown=8;this.notice=`${SECTION_NAMES[result.section]} 修复 +${Math.round(result.amount)} · 消耗 1 维修件`;this.noticeClock=3;}
    receiveCrew(msg){if(msg.type==='abyss_doors'){if(this.active&&Array.isArray(msg.doors)&&msg.doors.length===2&&msg.doors.every(d=>typeof d==='boolean')&&this.pressure){this.pressure.doors=[...msg.doors];if(this.remotePose?.pressure)this.remotePose.pressure.doors=[...msg.doors];this.interior?.setPressure(this.pressure);if([0,1].includes(msg.index)){this.notice=msg.doors[msg.index]?'隔舱门关闭 · 阻断水流':'隔舱门开启';this.noticeClock=2;}}return;}if(msg.type==='abyss_station_result'){if(!msg.ok){this.notice=msg.reason==='occupied'?'驾驶或操作岗位已有人，请原操作者按 E 离岗。':'靠近控制台后再按 E。';this.noticeClock=3;}return;}if(msg.type==='abyss_members'){const priorHelm=helmOwner(this.members),previousHost=this.roomHost;this.roomHost=msg.host;this.members=msg.members||{};if(priorHelm!==helmOwner(this.members))this.crewDrive=null;const me=this.members[this.app.crew?.selfId];if(this.active&&this.networkRaid&&this._crewSpawned&&!me){this.exit(true);return;}if(me&&this.interior){const previous=this.interior.station;this.interior.station=me.station;if(previous!==me.station){this.pilotIntent={throttle:0,throttleHold:0};this.driveNetClock=0;if(me.station==='helm'){this.interior.yaw=0;this.interior.pitch=0;this.resetCamera();this.notice='你已接管驾驶台 · W/S 推进 · A/D 左右转向';this.noticeClock=3;}}if(!this._crewSpawned){this.interior.p={x:me.x,z:me.z};this.interior.yaw=me.yaw;this._crewSpawned=true;}else if(Math.hypot(me.x-this.interior.p.x,me.z-this.interior.p.z)>1.1||[-4,4].some((z,i)=>this.pressure?.doors[i]&&(me.z-z)*(this.interior.p.z-z)<0))this.interior.p={x:me.x,z:me.z};this.interior.syncPeers(this.members,this.app.crew.selfId);if(this.active&&previousHost&&previousHost!==this.roomHost&&this.roomHost===this.app.crew.selfId)this.resumeMigratedHost();}return;}
      if(msg.type==='abyss_snapshot'&&this.active&&this.remoteClient()){this.remotePose=msg.state;this.snapshotAge=0;return;}
      if(msg.type==='abyss_command'&&this.active&&!this.remoteClient()){
       if(msg.action==='door'){if(typeof msg.closed==='boolean'&&[0,1].includes(msg.index)&&this.pressure){this.pressure.doors[msg.index]=msg.closed;this.interior?.setPressure(this.pressure);}else this.operateDoor(msg.index);return;}
       if(msg.action==='drive'){this.crewDrive={...msg,at:this.elapsed};return;}
       if(msg.action==='stop'){this.crewDrive={actor:msg.actor,thrust:0,turn:0,ballast:0,flank:false,at:this.elapsed};this.allStop();return;}
       this.applyAction(msg.action,Array.isArray(msg.aim)?new Vector3(...msg.aim).normalize():undefined,msg.actor);}
    }
    resumeMigratedHost(){const s=this.remotePose;if(!s)return false;
      // Apply the exact committed state, never interpolate into a new authority.
      this.stepRemote(0);this.pos.set(...s.pos);this.godPos.set(...s.godPos);this.yaw=s.yaw;this.pitch=s.pitch;this.subRoll=s.roll;this.godYaw=s.godYaw;this.godPitch=s.godPitch;this.godBank=s.godBank;
      this.repairJob=null;this.repairProgress=0;this.crewDrive=null;this.pilotIntent={throttle:0,throttleHold:0};this.throttleHold=0;this.yawRate=0;this.godYawRate=0;this.godSpeed=13;this.subImpulse?.set(0,0,0);this.emergencyAscent=false;this.app.input?.resetPhysicalState?.();this.counterClock=0;this.pingClock=0;this.elementCast=null;this.spells?.draw(null);
      for(const key of ['torpedoes','waterJets','depthCharges','shockwaves','impacts']){for(const q of this[key]||[])this.app.scene.remove(q.mesh);this[key]=[];}
      for(const m of [...this.netShots,...this.netWaves])this.app.scene.remove(m);this.netShots=[];this.netWaves=[];this.remotePose=null;
      forward(this.yaw,0,this.forward);forward(this.godYaw,this.godPitch,this.godForward);this.previousMouth=leviathanMouthPosition(this.godPos,this.godForward);this.sub.position.copy(this.pos);this.sub.rotation.set(-this.pitch,this.yaw,this.subRoll,'YXZ');this.god.position.copy(this.godPos);this.god.rotation.set(this.godPitch,this.godYaw,this.godBank,'YXZ');this.updateDiveLights();this.notice='原房主离开，已接管最近确认的潜艇状态；未完成攻击与维修安全中止。';this.noticeClock=5;return true;
    }
    sendCrewPose(dt){if(!this.app.crew?.connected||!this.roomHost||!this.interior)return;this.netClock-=dt;if(this.netClock>0)return;this.netClock=.10;const p=this.interior.p;this.app.crew.send({type:'abyss_pose',x:p.x,z:p.z,yaw:this.interior.yaw});
     if(!this.remoteClient()&&this.members[this.app.crew.selfId])this.app.crew.send({type:'abyss_snapshot',state:this.snapshot()});}
    snapshot(){const shots=[...this.torpedoes.map(q=>({...q,kind:q.kind||'torpedo'})),...this.waterJets.map(q=>({...q,kind:'jet'})),...this.depthCharges.map(q=>({...q,kind:'charge'}))].slice(0,40).map(q=>({kind:q.kind,pos:q.pos.toArray(),velocity:q.velocity.toArray()}));return {pos:this.pos.toArray(),godPos:this.godPos.toArray(),yaw:this.yaw,pitch:this.pitch,roll:this.subRoll,godYaw:this.godYaw,godPitch:this.godPitch,godBank:this.godBank, speed:this.speed,throttle:this.throttle,rudder:this.rudder,diveVelocity:this.diveVelocity,hull:this.hull,pressure:copyPressure(this.pressure),godHP:this.godHP,bossState:this.bossState,stateClock:Math.max(0,this.stateClock),parts:this.parts,ammo:this.ammo,finished:this.finished,fireCooldown:this.fireCooldown,harpoonCooldown:this.harpoonCooldown,chargeCooldown:this.chargeCooldown,counterPulseCooldown:this.counterPulseCooldown,pingCooldown:this.pingCooldown,repairCooldown:this.repairCooldown,repairProgress:this.repairProgress||0,cast:encodeCast(this.elementCast),shots,waves:this.shockwaves.slice(0,12).map(w=>({kind:w.kind==='sonic'?'sonic':'pulse',pos:w.mesh.position.toArray(),scale:w.mesh.scale.x,dir:w.direction?.toArray()||[0,1,0]}))};}
    stepRemote(dt){const s=this.remotePose;if(!s)return;this.snapshotAge=(this.snapshotAge||0)+dt;const t=1-Math.exp(-dt*13);this.pos.lerp(new Vector3(...s.pos),t);this.godPos.lerp(new Vector3(...s.godPos),t);this.yaw+=angleDiff(s.yaw,this.yaw)*t;this.godYaw+=angleDiff(s.godYaw,this.godYaw)*t;this.pitch+=(s.pitch-this.pitch)*t;this.subRoll+=(s.roll-this.subRoll)*t;this.godPitch+=(s.godPitch-this.godPitch)*t;this.godBank+=(s.godBank-this.godBank)*t;
      const won=!this.finished&&s.finished;for(const k of ['speed','throttle','rudder','diveVelocity','hull','godHP','bossState','stateClock','parts','ammo','finished','fireCooldown','harpoonCooldown','chargeCooldown','counterPulseCooldown','pingCooldown','repairCooldown'])this[k]=s[k];this.repairProgress=s.repairProgress||0;if(validatePressure(s.pressure,s.hull)){this.pressure=copyPressure(s.pressure);this.interior?.setPressure(this.pressure);}if(won){this.progress.defeatSeaGod('seagod:royal-abyss');this.app.game.toast('海神利维坦已被共同击败！',5000);}this.elementCast=decodeCast(s.cast);if(this.elementCast)this.elementCast.age+=this.snapshotAge;this.spells?.draw(this.elementCast);
      forward(this.yaw,0,this.forward);forward(this.godYaw,this.godPitch,this.godForward);this.sub.position.copy(this.pos);this.sub.rotation.set(-this.pitch,this.yaw,this.subRoll,'YXZ');this.god.position.copy(this.godPos);this.god.rotation.set(this.godPitch,this.godYaw,this.godBank,'YXZ');this.godAsset?.skeleton?.update(dt);
      const shots=s.shots||[];for(let i=0;i<shots.length;i++){const q=shots[i];let m=this.netShots[i];const material=q.kind==='jet'?this.jetMaterial:q.kind==='harpoon'?this.harpoonMaterial:q.kind==='charge'?this.chargeMaterial:this.torpedoMaterial;if(!m){m=new Mesh(this.projectileGeometry,material);this.netShots[i]=m;this.app.scene.add(m);}m.material=material;m.visible=true;m.position.set(...q.pos);m.scale.set(q.kind==='jet'?1.3:.4,q.kind==='jet'?1.3:.4,q.kind==='jet'?1.3:1.7);m.lookAt(m.position.clone().add(new Vector3(...q.velocity)));}for(let i=shots.length;i<this.netShots.length;i++)this.netShots[i].visible=false;
      const waves=s.waves||[];for(let i=0;i<waves.length;i++){const w=waves[i];let m=this.netWaves[i];if(!m){m=new Mesh(this.sonarGeometry,this.shockMaterial);this.netWaves[i]=m;this.app.scene.add(m);}m.material=w.kind==='sonic'?this.jetMaterial:this.shockMaterial;m.visible=true;m.position.set(...w.pos);m.scale.setScalar(w.scale);m.lookAt(m.position.clone().add(new Vector3(...w.dir)));}for(let i=waves.length;i<this.netWaves.length;i++)this.netWaves[i].visible=false;
      if(this.snapshotAge>2){this.notice='联机状态延迟，请检查房主连接。';this.noticeClock=.5;}else if(this.elementCast){this.notice=`${LEVIATHAN_SPELLS[this.elementCast.kind].name} · ${this.elementCast.age<0?'蓄力 '+(-this.elementCast.age).toFixed(1)+'s':'攻击中'}`;this.noticeClock=.5;}this.updateDiveLights();
    }

	resetCamera() {
		this.bossLock = false;
		this.orbitYaw = 0;
		this.orbitElevation = .20;
		this.orbitTargetYaw = 0;
		this.orbitTargetElevation = .20;
        if(this.cameraMode==='interior'&&this.interior){this.interior.yaw=0;this.interior.pitch=0;}
		this.cameraDistance = 46;
	}

	saveHelm() {
		try { localStorage.setItem( HELM_PREF_KEY, JSON.stringify( {
			mode: this.helmMode, sensitivity: this.mouseSensitivity,invertX:this.invertX,invertY:this.invertY,
		} ) ); } catch { /* Private browsing can deny local storage. */ }
	}

	toggleHelm() {
		this.helmMode = this.helmMode === 'helm' ? 'arcade' : 'helm';
		// Switching to persistent engine orders takes over at the CURRENT speed,
		// so toggling during combat never abruptly reverses the throttle.
		this.throttle = this.helmMode === 'helm' ? clamp( this.speed / SUBMARINE_DRIVE.cruise, -1, 1 ) : 0;if(this.pilotIntent){this.pilotIntent.throttle=this.throttle;this.pilotIntent.throttleHold=0;}
		this.throttleHold = 0;
		this.yawRate *= .25;
		this.saveHelm();
		this.notice = this.helmMode === 'helm' ?
			'标准船舵：W/S 调整并保持目标航速，A/D 左右打舵，鼠标只控制镜头。' :
			'即时推进：按住 W/S 才推进，松开会减速；鼠标依然只负责观察。';
		this.noticeClock = 4;
		this.renderHud();
	}

	changeThrottle( change ) {
		if ( !this.active ) return false;
		if ( this.helmMode !== 'helm' ) this.toggleHelm();
		const pilot=this.app.crew?.connected&&this.roomHost?(this.pilotIntent??={throttle:0,throttleHold:0}):this;
        pilot.throttle=clamp((pilot.throttle||0)+change,-1,1);pilot.throttleHold=0;this.throttle=pilot.throttle;
		this.throttleHold = 0;
		this.renderHud();
		return true;
	}

	allStop() {
		if ( !this.active ) return false;
		this.throttle = 0;
		this.throttleHold = 0;if(this.pilotIntent){this.pilotIntent.throttle=0;this.pilotIntent.throttleHold=0;}
		this.notice = '◉ 车钟已置中位，推进器减速停车。按 W 可重新加速。';
		this.noticeClock = 2.6;
		this.renderHud();
		return true;
	}

	cycleSensitivity() {
		const index = SENSITIVITIES.indexOf( this.mouseSensitivity );
		this.mouseSensitivity = SENSITIVITIES[ ( index + 1 ) % SENSITIVITIES.length ];
		this.saveHelm();
		this.renderHud();
	}

	toggleEmergencyAscent() {
		if ( ! this.active ) return false;
		if ( this.emergencyAscent && this.hull < ABYSS_STATS.hull * .23 &&
			-this.pos.y > ABYSS_ZONE.safeDepth ) {
			this.notice = '⚠ 船体临界受损且水压过高，必须先上浮到安全深度。';
			this.noticeClock = 3;
			return true;
		}
		this.emergencyAscent = !this.emergencyAscent;
		this.notice = this.emergencyAscent ? '⚠ 应急上浮：自动控制压载舱恢复浅水深度，按 B 可取消。' :
			'应急上浮已取消，压载舱恢复手动控制。';
		this.noticeClock = 3.5;
		return this.emergencyAscent;
	}

	async ensureAssets() {
		if ( this.loaded ) return true;
		if ( this.loading ) return this.loading;
		this.loading = ( async () => {
			// The project ships its own Blender-generated, legally independent
			// GLBs, with an optional drop-in licensed model replacement path.
			const [ subAsset, godAsset ] = await Promise.all( [
				createTitanAsset( 'abyss_sub' ), createTitanAsset( 'sea_god' ),
			] );
			this.subAsset = subAsset;
			this.godAsset = godAsset;
			this.hud.querySelector( '[data-abyss-model]' ).textContent =
				`外形：${ subAsset.externalLicensed ? 'SDC Nautilus' : '原创潜艇' } · ${ godAsset.externalLicensed ? 'Lebin Leviathan' : '原创海神' }`;
			this.sub.add( subAsset.root );
            try{this.hatch.install(subAsset.root);}catch(e){console.warn("Hatch asset cut failed; access disabled",e);this.hatch.ready=false;}
			this.god.add( godAsset.root );
			if ( subAsset.externalLicensed ) {
				// The Nautilus already has sculpted armored portholes and a conning
				// tower. Hide V24's floating placeholder windows, shrink the bow
				// lenses, and attach the real light beams near its pointed prow.
				for ( const child of this.sub.children ) {
					if ( child.name === 'DemonWhale_ConningTowerBlueWindow' ) child.visible = false;
					if ( child.name === 'DemonWhale_PhysicalForwardSearchlightLens' ) {
						const side = Math.sign( child.position.x );
						child.position.set( side * 1.95, .25, 15.4 );
						child.scale.setScalar( .37 );
					}
				}
				for ( const source of this.diveLights ) if ( source.spec?.beam ) {
					source.spec.side = Math.sign( source.spec.side ) * 1.95;
					source.spec.rise = .25; source.spec.front = 15.4;
				}
			}
			this.rigged = godAsset.externalAnimationClips?.length ? false : attachTitanSkeleton( godAsset );
			this.loaded = true;
			return true;
		} )();
		try { return await this.loading; }
		finally { this.loading = null; }
	}

	async enter(join=false) {
		if ( this.active || this.loading || ( !join && ! this.progress.owned( 'abyss_sub' ) && ! this.developer ) ) return false;
		const online=!!this.app.crew?.connected;if(online&&((join&&!this.roomHost)||(!join&&!this.app.crew.isHost))){this.app.game.toast('请由房主开启深渊，再由船员加入。');return false;}
        const previousScale = this.app.settings.renderScale;
		const safeScale = abyssRenderScale( this.app.engine.width, this.app.engine.height, previousScale );
		this.abyssRenderScale = safeScale < previousScale ? { previous: previousScale, applied: safeScale } : null;
		if ( this.abyssRenderScale ) this.app.setRenderScale( safeScale );
		this.app.game.toast( '🐋 正在打开深海魔鲸号船坞与海神王庭…', 3600 );
		try { await this.ensureAssets(); }
		catch ( error ) {
			this.restoreRenderScale();
			console.error( 'V23 deep-sea GLB initialization failed', error );
			this.app.game.toast( '潜航模型加载失败，请检查 public/models/abyss 与 rigged/sea-god-skeleton.glb。', 5500 );
			return false;
		}
		this.active = true;
        this.networkRaid=online;this._crewSpawned=false;this.pilotIntent={throttle:0,throttleHold:0};this.driveNetClock=0;this.interior?.reset();this.remotePose=null;this.netClock=0;this.crewDrive=null;this.parts=6;this.ammo=48;this.repairCooldown=0;this.counterClock=0;this.elementCast=null;this.spells?.draw(null);
		this.finished = false;
		this.elapsed = 0;
		this.pos.set( ABYSS_ZONE.startX, - ABYSS_ZONE.startDepth, ABYSS_ZONE.startZ );
		// Its first silhouette appears below the submarine, not 173m straight
		// down in black water where the player cannot perceive its approach.
		this.godPos.set( ABYSS_ZONE.x, - (ABYSS_ZONE.startDepth + 86), ABYSS_ZONE.z );
		// Spawn facing the encounter. V23 faced away from the boss on entry.
		this.yaw = bearing( ABYSS_ZONE.x - this.pos.x, ABYSS_ZONE.z - this.pos.z );
		this.pitch = .12; this.speed = 0;
		this.throttle = 0;
		this.throttleHold = 0;
		this.rudder = 0;
		this.yawRate = 0; this.subRoll = 0; this.diveVelocity = 0;
		this.emergencyAscent = false;
		this.outOfPatrol = false;
		this.driveCommand = 0;
		this.boostCommand = false;
		this.godYaw = bearing( this.pos.x - this.godPos.x, this.pos.z - this.godPos.z );
		this.godSpeed = 13;
		this.godYawRate = 0; this.godPitch = 0; this.godBank = 0;
		this.chargeYaw = this.godYaw;
		this.chargePitch = this.godPitch;
		this.jawOpen = 0; this.biteClock = 0; this.bossHitFlash = 0;
		this.godHurt = 0;
		this.subImpulse.set( 0, 0, 0 );
		this.repairJob=null;this.repairProgress=0;this.pressure=newPressure();this.interior?.setPressure(this.pressure);this.hull = ABYSS_STATS.hull; this.godHP = ABYSS_STATS.leviathan;
		this.fireCooldown = 0; this.pingCooldown = 0;
		this.harpoonCooldown = 0; this.chargeCooldown = 0; this.counterPulseCooldown = 0;
		this.jetClock = 0; this.sonicHit = false;
		this.bossState = 'stalk'; this.stateClock = 8; this.chargeHit = false;
		this.bossAttackIndex = 0; this.bossAttackType = 'ram'; this.vortexDamageClock = 0;
		this.sonarClock = 0; this.pingClock = 0;
		this.cameraMode = 'chase'; this.shakeClock = 0;
		this.bossLock = false;
		this.resetCamera(); this.cameraPrimed = false;
		G.abyssVision.value = 1;
		document.body.classList.add( 'abyss-raid-active' );
		this.lampsOn = true;
		this.torpedoes.forEach( s => this.app.scene.remove( s.mesh ) );
		this.torpedoes.length = 0;
		this.impacts.forEach( v => this.app.scene.remove( v.mesh ) );
		this.impacts.length = 0;
		this.shockwaves.forEach( s => this.app.scene.remove( s.mesh ) );
		this.shockwaves.length = 0;
		this.waterJets.forEach( s => this.app.scene.remove( s.mesh ) ); this.waterJets.length = 0;
		this.depthCharges.forEach( s => this.app.scene.remove( s.mesh ) ); this.depthCharges.length = 0;
		this.beforeInput = this.app.input.enabled;
		this.beforeLookMode = this.app.input.lookMode;
		this.beforeFreeCam = this.app.freeCam;
		this.app.freeCam = false;
		this.app.input.enabled = true;
		this.app.input.lookMode = 'normal';
		this.app.input.keys.clear(); this.app.input.pressed.clear();
		this.app.input.mouseDown = false; this.app.input.rightDown = false;
		// Identical to the surface boat: clicking the canvas captures the mouse;
		// Escape releases it to click the combat controls and return-home button.
		if ( document.pointerLockElement ) document.exitPointerLock?.();
		this.app.input.consumeLook(); this.app.input.consumeWheel();
		const flashlight = this.app.localLights?.flashlight;
		if ( flashlight ) {
			this.savedFlashlight = {
				on: flashlight.on, intensity: flashlight.intensity, range: flashlight.range,
				color: flashlight.color.clone(), cosInner: flashlight.cosInner, cosOuter: flashlight.cosOuter,
				alwaysOn: flashlight.alwaysOn,
			};
			flashlight.overridePosition = new Vector3();
			flashlight.overrideDir = new Vector3( 0, 0, 1 );
			flashlight.on = true;
			flashlight.alwaysOn = true;
			flashlight.intensity = 64000;
			flashlight.range = 240;
			flashlight.color.setRGB( .40, .82, 1 );
			flashlight.cosInner = Math.cos( .17 );
			flashlight.cosOuter = Math.cos( .65 );
		}
		for ( const source of this.diveLights ) source.enabled = true;
		if ( this.bossLight ) this.bossLight.enabled = true;
		this.wasBoatVisible = this.app.boat.group.visible;
		this.app.boat.group.visible = false;
		this.sub.visible = true; this.god.visible = true;
		this.hud.hidden = false;this.sub.position.copy(this.pos);this.sub.rotation.set(-this.pitch,this.yaw,this.subRoll,'YXZ');this.god.position.copy(this.godPos);this.setCabin(true);
        if(online){this.roomHost=join?this.roomHost:this.app.crew.selfId;this.app.crew.send({type:join?'abyss_join':'abyss_start'});}
		forward( this.yaw, this.pitch, this.forward );
		forward( this.godYaw, 0, this.godForward );
		this.previousMouth = leviathanMouthPosition( this.godPos, this.godForward );
		this.updateDiveLights();
		this.notice = '深度警报：主动声呐已启动。海神利维坦正在王庭中苏醒。';
		this.noticeClock = 5;
		this.renderHud();
		return true;
	}

	restoreRenderScale() {
		const saved = this.abyssRenderScale;
		this.abyssRenderScale = null;
		if ( saved && this.app.settings.renderScale === saved.applied ) this.app.setRenderScale( saved.previous );
	}

	exit(remote=false) {
		if ( ! this.active ) return false;
        if(this.networkRaid&&!remote)this.app.crew?.send({type:'abyss_leave'});this.networkRaid=false;this.hatch?.reset();this.interior?.syncPeers({},null);this.setCabin(false);this.spells?.draw(null);this.elementCast=null;for(const m of this.netShots||[])this.app.scene.remove(m);this.netShots=[];for(const m of this.netWaves||[])this.app.scene.remove(m);this.netWaves=[];this.remotePose=null;
		this.active = false;this.repairJob=null;this.repairProgress=0;
		this.restoreRenderScale();
		G.abyssVision.value = 0;
		document.body.classList.remove( 'abyss-raid-active' );
		this.sub.visible = false; this.god.visible = false;
		if ( this.godAsset?.root ) this.godAsset.root.visible = true;
		for ( const source of this.diveLights ) source.enabled = false;
		if ( this.bossLight ) this.bossLight.enabled = false;
		const fl = this.app.localLights?.flashlight;
		if ( fl && this.savedFlashlight ) {
			Object.assign( fl, this.savedFlashlight );
			delete fl.overridePosition; delete fl.overrideDir;
			fl.primed = false;
			this.savedFlashlight = null;
		}
		this.sonarRing.visible = false;
		// An interrupted raid must not leave frozen torpedoes or particles in
		// the surface world; V28 only cleaned these on the NEXT entry.
		for ( const shot of this.torpedoes ) this.app.scene.remove( shot.mesh );
		for ( const impact of this.impacts ) this.app.scene.remove( impact.mesh );
		this.torpedoes.length = 0;
		this.impacts.length = 0;
		this.shockwaves.forEach( s => this.app.scene.remove( s.mesh ) );
		this.shockwaves.length = 0;
		this.waterJets.forEach( s => this.app.scene.remove( s.mesh ) ); this.waterJets.length = 0;
		this.depthCharges.forEach( s => this.app.scene.remove( s.mesh ) ); this.depthCharges.length = 0;
		this.hud.hidden = true;
		this.app.boat.group.visible = this.wasBoatVisible;
		this.app.input.keys.clear(); this.app.input.pressed.clear();
		this.app.input.consumeLook(); this.app.input.consumeWheel();
		if ( document.pointerLockElement === this.app.input.dom ) document.exitPointerLock?.();
		this.app.input.lookMode = this.beforeLookMode || 'normal';
		this.app.input.enabled = this.beforeInput;
		this.app.freeCam = this.beforeFreeCam;
		// The captain's surface pose remains untouched. The next frame resumes
		// the existing Player/BoatController without a world-origin teleport.
		this.app.game.toast( '🐋 深海魔鲸号已返航。海上船只与原有装备均已保留。', 3800 );
		return true;
	}

	returnHome() {
		if ( ! this.active ) return false;
		// Locate a safe landing first. The user should not lose the boss scene
		// if the harbor's physics/depth data are not yet available.
		if ( ! this.app.terrainData?.heightAt ) {
			this.notice = '港口水深数据尚未准备好，请稍后再试。'; this.noticeClock = 4;
			this.renderHud(); return false;
		}
		this.exit();
		const arrival = returnCaptainToMainIsland( this.app );
		if ( ! arrival ) {
			this.app.game.toast( '未找到主岛港外安全深水位置；已正常返回海面。', 5000 );
			return false;
		}
		this.app.game.toast( '⌂ 已传送回主岛港外，可驾船靠岸。', 4800 );
		return true;
	}

	emitShockwave( speed = 84, damage = 150, maxRadius = 270 ) {
		const mesh = new Mesh( this.sonarGeometry, this.shockMaterial );
		mesh.name = 'OceanGod_SphericalPressureShockfront';
		mesh.position.copy( this.godPos );
		mesh.rotation.x = Math.PI / 2;
		this.app.scene.add( mesh );
		this.shockwaves.push( { mesh, radius: 8, speed, damage, maxRadius, hit: false } );
		this.showImpact( this.godPos.clone(), 8 );
	}

	emitSonicWave( phase = 1 ) {
		const origin = leviathanMouthPosition( this.godPos, this.godForward );
		const mesh = new Mesh( this.sonarGeometry, this.jetMaterial );
		mesh.name = 'Leviathan_DirectionalBioSonicWave';
		mesh.position.copy( origin );
		mesh.lookAt( origin.clone().add( this.godForward ) );
		this.app.scene.add( mesh );
		this.shockwaves.push( { mesh, radius: 6, speed: phase === 3 ? 145 : 117,
			damage: phase === 3 ? 225 : 165, maxRadius: 340, hit: false,
			kind: 'sonic', origin, direction: this.godForward.clone() } );
		this.showImpact( origin, 13 );
	}

	stepShockwaves( dt ) {
		for ( let i = this.shockwaves.length - 1; i >= 0; i -- ) {
			const wave = this.shockwaves[ i ];
			const last = wave.radius;
			wave.radius += wave.speed * dt;
			// Two independent 3-D distance tests keep the simulation distinct from
			// the decorative torus visual. The expanding shell cannot hit twice.
			const distance = this.pos.distanceTo( wave.mesh.position );
			const collided = wave.kind === 'sonic' ?
				sonarConeHit( wave.origin, wave.direction, this.pos, last, wave.radius ) :
				shockfrontHit( last, wave.radius, distance );
			if ( ! wave.hit && collided ) {
				wave.hit = true;
				if ( this.counterClock > 0 ) this.showImpact( this.pos, 15 );
				else this.damageHull( wave.damage, this.pos );
			}
			if ( wave.kind === 'sonic' ) {
				wave.mesh.position.copy( wave.origin ).addScaledVector( wave.direction, wave.radius );
				wave.mesh.scale.setScalar( Math.max( 1, wave.radius * Math.sin( .61 ) ) );
			} else wave.mesh.scale.setScalar( wave.radius );
			if ( wave.radius > wave.maxRadius ) {
				this.app.scene.remove( wave.mesh );
				this.shockwaves.splice( i, 1 );
			}
		}
	}

	fire(aim) {
		if ( ! this.active || this.finished || this.fireCooldown > 0 || this.ammo===0 ) return false;
        if(Number.isFinite(this.ammo))this.ammo--;
		this.fireCooldown = ABYSS_STATS.torpedoReload;
		forward( this.yaw, this.pitch, _f );if(aim?.lengthSq()>0)_f.copy(aim).normalize();
		if ( this.bossLock ) {
			// A lock-on helps the initial vertical solution, but the torpedo still
			// has a finite turn rate and must intersect the real boss capsule.
			_f.lerp( _d.subVectors( this.godPos, this.pos ).normalize(), .62 ).normalize();
		}
		const origin = this.pos.clone().addScaledVector( _f, 19 );
		const projectile = new Mesh( this.torpedoGeometry, this.torpedoMaterial );
		projectile.name = 'DemonWhale_SonarGuidedTorpedo';
		projectile.position.copy( origin );
		projectile.scale.set( .9, .9, 3.2 );
		projectile.lookAt( origin.clone().add( _f ) );
		this.app.scene.add( projectile );
		this.torpedoes.push( { mesh: projectile, pos: origin, velocity: _f.clone().multiplyScalar( 125 ),
			ttl: 7, course: 0, damage: ABYSS_STATS.torpedo, kind: 'torpedo', guided: this.bossLock } );
		return true;
	}

	fireHarpoon(aim) {
		if ( !this.active || this.finished || this.harpoonCooldown > 0 || this.ammo===0 ) return false;
        if(Number.isFinite(this.ammo))this.ammo--;
		this.harpoonCooldown = 3.2;
		const dir = aim?.lengthSq()>0?aim.clone().normalize():forward( this.yaw, this.pitch, new Vector3() );
		// Stabilised magnetic rail-lance. Lock supplies gentle aim assist, not a
		// guaranteed hit; all actual damage still requires a swept 3D contact.
		if ( this.bossLock ) dir.lerp( this.godPos.clone().sub( this.pos ).normalize(), .43 ).normalize();
		const origin = this.pos.clone().addScaledVector( dir, 18 );
		const mesh = new Mesh( this.projectileGeometry, this.harpoonMaterial );
		mesh.name = 'DemonWhale_MagneticRailHarpoon';
		mesh.position.copy( origin ); mesh.scale.set( .55, .55, 2.3 );
		mesh.lookAt( origin.clone().add( dir ) );
		this.app.scene.add( mesh );
		this.torpedoes.push( { mesh, pos: origin, velocity: dir.multiplyScalar( 210 ),
			ttl: 3, damage: 290, kind: 'harpoon' } );
		return true;
	}

	dropDepthCharge() {
		if ( !this.active || this.finished || this.chargeCooldown > 0 || this.ammo===0 ) return false;
        if(Number.isFinite(this.ammo))this.ammo--;
		this.chargeCooldown = 6.0;
		const origin = this.pos.clone().add( new Vector3( 0, -7.5, 0 ) );
		const mesh = new Mesh( this.projectileGeometry, this.chargeMaterial );
		mesh.name = 'DemonWhale_PressureDepthCharge'; mesh.position.copy( origin );
		this.app.scene.add( mesh );
		this.depthCharges.push( { mesh, pos: origin, velocity: new Vector3( 0, -23, 0 ), fuse: 1.55 } );
		return true;
	}

	counterPulse() {
		if ( !this.active || this.finished || this.counterPulseCooldown > 0 ) return false;
		this.counterPulseCooldown = 13;
		this.counterClock = 1.75;
		for ( let i = this.waterJets.length - 1; i >= 0; i -- ) {
			const jet = this.waterJets[i];
			if ( jet.pos.distanceTo( this.pos ) > 115 ) continue;
			this.showImpact( jet.pos, 12 );
			this.app.scene.remove( jet.mesh ); this.waterJets.splice( i, 1 );
		}
		if ( this.godPos.distanceTo( this.pos ) < 95 && this.bossState === 'windup' ) {
			this.bossState = 'recovery'; this.stateClock = 1.25;
		}
		this.sonarRing.visible = true; this.sonarClock = 1.6;
		this.sonarRing.position.copy( this.pos );
		this.notice = '✦ 反相声波已发射：拦截水炮，短暂抵消声压伤害！';
		this.noticeClock = 3; return true;
	}

	launchWaterJet( phase ) {
		const origin = leviathanMouthPosition( this.godPos, this.godForward );
		const lead = this.forward.clone().multiplyScalar( this.speed * .48 );
		const target = this.pos.clone().add( lead );
		const heading = target.sub( origin ).normalize();
		const mesh = new Mesh( this.projectileGeometry, this.jetMaterial );
		mesh.name = 'Leviathan_HydrodynamicPressureProjectile';
		mesh.position.copy( origin ); mesh.scale.setScalar( phase === 3 ? 1.8 : 1.35 );
		this.app.scene.add( mesh );
		this.waterJets.push( { mesh, pos: origin, velocity: heading.multiplyScalar( phase === 3 ? 155 : 126 ),
			ttl: 4.0, damage: phase === 3 ? 200 : 145 } );
		this.showImpact( origin, 5 );
	}

	stepWaterJets( dt ) {
		for ( let i = this.waterJets.length - 1; i >= 0; i -- ) {
			const s = this.waterJets[i], previous = s.pos.clone();
			s.ttl -= dt;
			s.pos.addScaledVector( s.velocity, dt );
			s.mesh.position.copy( s.pos );
			s.mesh.scale.setScalar( 1.3 + .25 * Math.sin( this.elapsed * 24 ) );
			s.trailClock = ( s.trailClock || 0 ) - dt;
			if ( s.trailClock <= 0 ) {
				this.showImpact( s.pos, 1 );
				s.trailClock = .13;
			}
			const axis=forward(this.yaw,this.pitch,new Vector3());const hit=closestSegmentPoints(previous,s.pos,this.pos.clone().addScaledVector(axis,-12.8),this.pos.clone().addScaledVector(axis,12.8));const contact=hit.distance<6.65;
			if ( contact ) {
				this.showImpact( hit.hull, 18 );
				if ( this.counterClock <= 0 ) this.damageHull( s.damage, hit.hull );
			}
			if ( contact || s.ttl <= 0 ) {
				this.app.scene.remove( s.mesh ); this.waterJets.splice( i, 1 );
			}
		}
		for ( let i = this.depthCharges.length - 1; i >= 0; i -- ) {
			const s = this.depthCharges[i]; s.fuse -= dt;
			s.pos.addScaledVector( s.velocity, dt ); s.mesh.position.copy( s.pos );
			s.mesh.rotation.y += dt * 2;
			if ( s.fuse > 0 ) continue;
			const near = this.godPos.clone().addScaledVector( this.godForward, 38 ).distanceTo( s.pos );
			this.showImpact( s.pos, 27 );
			if ( near < 52 && !this.finished ) {
				this.godHP = Math.max( 0, this.godHP - 390 * (1 - near/105) );
				this.godHurt = 1;
				if ( this.godHP <= 0 ) this.defeatGod();
			}
			this.app.scene.remove( s.mesh ); this.depthCharges.splice( i, 1 );
		}
	}

	sonar() {
		if ( ! this.active || this.pingCooldown > 0 ) return false;
		this.pingCooldown = ABYSS_STATS.sonarRecharge;
		this.sonarClock = 1.6; this.pingClock = 4.5;
		this.sonarRing.visible = true;
		this.sonarRing.position.copy( this.pos );
		this.notice = '◉ 声呐回波：检测到超巨型活体，距离 ' +
			Math.round( this.pos.distanceTo( this.godPos ) ) + ' 米';
		this.noticeClock = 3.5;
		return true;
	}

	showImpact( position, count = 9 ) {
		for ( let i = 0; i < Math.min(count,Math.max(0,180-this.impacts.length)); i ++ ) {
			const mesh = new Mesh( this.impactGeometry, this.burstMaterial );
			mesh.position.copy( position );
			this.app.scene.add( mesh );
			const a = i * 2.399, s = .9 + i * .12;
			this.impacts.push( { mesh, ttl: .55 + ( i % 5 ) * .13,
				velocity: new Vector3( Math.cos( a ) * s, .8 + i * .16, Math.sin( a ) * s ) } );
		}
	}

	damageHull( amount, impact ) {
		if ( ! this.active || this.finished || !Number.isFinite(amount) || amount<=0 ) return;
		if(this.pressure){let localZ=0;if(impact&&[impact.x,impact.y,impact.z].every(Number.isFinite)){localZ=(impact.x-this.pos.x)*Math.sin(this.yaw)+(impact.z-this.pos.z)*Math.cos(this.yaw);}applyPressureDamage(this.pressure,amount,localZ);this.hull=totalHull(this.pressure);}else this.hull=Math.max(0,this.hull-amount);
		this.speed *= .76;
		this.pitch += .13;
		this.shakeClock = .65;
		this.bossHitFlash = .55;
		if ( this.subImpulse ) this.subImpulse.addScaledVector( this.godForward, Math.min( 13, amount * .037 ) );
		this.subRoll += Math.min( .09, amount / 3700 );
		this.app.audio?.hullSlap?.( 1 );
		this.showImpact( impact, 17 );
		this.notice = `⚠ 船体受击：-${ Math.round( amount ) }，请检查分舱进水与电力。`;
		this.noticeClock = 2.8;
		if ( this.hull <= 0 ) {
			this.notice = '深海魔鲸号失去动力，紧急浮升即将启动。';
			this.app.game.toast( '深渊挑战失败：潜艇已执行紧急返航。', 4500 );
			this.exit();
		}
	}

	defeatGod() {
		if ( this.finished ) return;
		this.finished = true;
        this.elementCast=null;this.spells?.draw(null);
		this.godHP = 0;
		const rewarded = this.progress.defeatSeaGod( 'seagod:royal-abyss' );
		this.app.game.toast( rewarded ? '🏆 海神利维坦已被击败！获得「海神源质」×1。' :
			'🏆 海神利维坦已被击败！无光王庭再次陷入沉寂。', 7500 );
		this.notice = '🏆 终局胜利 · 深海魔鲸号赢得了诸海的认可。可以返回海面。';
		this.noticeClock = Infinity;
	}

	stepGod( dt ) {
		if ( this.finished ) return;
		if ( ! Number.isFinite( this.jawOpen ) ) this.jawOpen = 0;
		const phase = phaseAt( this.godHP / ABYSS_STATS.leviathan );
		const dx = this.pos.x - this.godPos.x, dz = this.pos.z - this.godPos.z;
		const separation = Math.hypot( dx, dz );
		const turn = bearing( dx, dz );
		this.stateClock -= dt;
		if ( this.bossState === 'stalk' && this.stateClock <= 0 ) {
			const pattern = phase === 1 ? [ 'waterjet', 'frost_lance', 'ram', 'sonic', 'storm_lance' ] :
                phase === 2 ? [ 'waterjet', 'ram', 'sonic', 'pulse', 'voltaic_snare', 'glacial_crown', 'cinder_fall' ] :
                [ 'waterjet', 'sonic', 'ram', 'vortex', 'nova_beam', 'flame_field', 'pulse', 'glacial_crown' ];
			this.bossAttackType = pattern[ this.bossAttackIndex ++ % pattern.length ];
			this.bossState = 'windup'; const spell=LEVIATHAN_SPELLS[this.bossAttackType];this.stateClock=spell?spell.windup:phase===3?1.05:1.45;
            if(spell)this.elementCast=createLeviathanCast(this.bossAttackType,leviathanMouthPosition(this.godPos,this.godForward),this.pos,phase);
			this.notice = {
				ram: '⚠ 巨眼锁定：利维坦张开巨颚，蓄力深渊冲撞！',
				pulse: '⚠ 海神脊骨亮起：巨型球状声压冲击正向外蓄积！',
				vortex: '⚠ 无光王庭开始塌缩：远离海神，准备反向推进！',
				waterjet: '⚠ 利维坦鳃腔聚能：高压水炮即将从巨口连续射出！',
				sonic: '⚠ 巨鲸低吼：定向声波锥即将覆盖前方水域！',
			}[ this.bossAttackType ] || `⚠ ${spell?.name||'元素攻击'} · ${spell?.shape==='line'?'离开预警射线':spell?.shape==='shell'?'避开环形边界':'驶离蓄力范围'}！`;
			this.noticeClock = 3.5;
		} else if ( this.bossState === 'windup' && this.stateClock <= 0 ) {
			this.bossState = this.bossAttackType === 'ram' ? 'charge' : this.bossAttackType;
			// Fix a lunge heading/vertical attack plane. Mild correction remains
			// possible, but a giant cannot track a moving submarine like a turret.
			if ( this.bossState === 'charge' ) {
				this.chargeYaw = this.godYaw;
				this.chargePitch = this.godPitch;
			}
			this.stateClock = this.bossAttackType === 'vortex' ? 3.3 :
				this.bossAttackType === 'waterjet' ? 2.15 : phase === 3 ? 3.15 : 3.55;
			this.chargeHit = false;
            if(LEVIATHAN_SPELLS[this.bossAttackType]){this.stateClock=LEVIATHAN_SPELLS[this.bossAttackType].hold;if(this.elementCast)this.elementCast.age=0;}
			if ( this.bossAttackType === 'pulse' ) this.emitShockwave( phase === 3 ? 112 : 86, phase === 3 ? 220 : 150 );
			if ( this.bossAttackType === 'sonic' ) this.emitSonicWave?.( phase );
			if ( this.bossAttackType === 'waterjet' ) this.jetClock = .05;
			if ( this.bossAttackType === 'vortex' ) {
				this.emitShockwave( 59, 70, 185 );
				this.vortexDamageClock = 0;
			}
		} else if ( [ 'charge', 'pulse', 'vortex', 'bite', 'waterjet', 'sonic', ...Object.keys(LEVIATHAN_SPELLS) ].includes( this.bossState ) && this.stateClock <= 0 ) {
			this.bossState = 'recovery'; this.stateClock = phase === 3 ? 1.0 : 1.55;
		} else if ( this.bossState === 'recovery' && this.stateClock <= 0 ) {
			this.bossState = 'stalk'; this.stateClock = phase === 3 ? 1.7 : 2.5;
		}
		if(this.elementCast){const cast=this.elementCast,d=LEVIATHAN_SPELLS[cast.kind];if(this.bossState==='windup'&&this.bossAttackType===cast.kind)cast.age=-Math.max(.001,this.stateClock);else if(this.bossState===cast.kind){cast.age=Math.max(0,d.hold-this.stateClock);if(!cast.hit&&spellContact(cast,this.pos)){cast.hit=true;if(this.counterClock<=0)this.damageHull(d.damage*(cast.phase===3?1.10:1),this.pos);}}else this.elementCast=null;}this.spells?.draw(this.elementCast);
        const charging = this.bossState === 'charge';
		const sucking = this.bossState === 'vortex';
		const biting = this.bossState === 'bite';
		if ( this.bossState === 'waterjet' ) {
			this.jetClock -= dt;
			if ( this.jetClock <= 0 ) {
				this.launchWaterJet?.( phase );
				this.jetClock = phase === 3 ? .46 : .68;
			}
		}
		const closeOrbit = separation < 90 && ! charging && ! biting;
		const turnTarget = charging ?
			this.chargeYaw + clamp( angleDiff( turn, this.chargeYaw ), -.25, .25 ) :
			closeOrbit ? turn + .44 : turn;
		const turnLimit = charging ? .36 : biting ? .18 : phase === 3 ? .55 : .43;
		const targetYawRate = clamp( angleDiff( turnTarget, this.godYaw ) * 2.15, -turnLimit, turnLimit );
		// Responsive but inertia-limited yaw; bank and body motion share this
		// same actual angular velocity, with no lateral body translation.
		this.godYawRate = smooth( this.godYawRate, targetYawRate, dt, charging ? 4.6 : 3.5 );
		this.godYaw += this.godYawRate * dt;
		const targetSpeed = charging ? ( phase === 3 ? 60 : phase === 2 ? 55 : 49 ) :
			biting ? 4.2 : this.bossState === 'windup' || sucking || LEVIATHAN_SPELLS[this.bossState] ? 5.5 :
			closeOrbit ? 17 : separation > 170 ? ( phase === 3 ? 38 : 31 ) : 23;
		this.godSpeed = approachSpeed( this.godSpeed, targetSpeed,
			charging ? 82 : biting ? 115 : this.bossState === 'windup' ? 39 : 25, dt );
		const toHeight = this.pos.y - ( this.godPos.y + 5 );
		const ahead=this.godPos.clone().addScaledVector(this.godForward,Math.max(45,this.godSpeed*2));
        const floor=this.app.terrainData?.heightAt?.(ahead.x,ahead.z)??-390;
        const clearance=floor+35;
        const desiredPitch = clamp( - Math.atan2( Math.max(toHeight,clearance-this.godPos.y), Math.max( 40, separation - 92 ) ), -.38, .38 );
		const pitchTarget = charging ?
			this.chargePitch + clamp( desiredPitch - this.chargePitch, -.17, .17 ) : desiredPitch;
		this.godPitch = smooth( this.godPitch, pitchTarget, dt, charging ? 3.2 : 2.1 );
		this.godBank = smooth( this.godBank, clamp( -this.godYawRate * .33, -.27, .27 ), dt, 2.6 );
		forward( this.godYaw, this.godPitch, this.godForward );
		// Reuse the last frame's *actual* world-space mouth position so a
		// turning 250m creature sweeps its snout through the correct arc.
		const mouthBefore = this.previousMouth?.clone() ||
			leviathanMouthPosition( this.godPos, this.godForward );
		// Swimming velocity is THREE-DIMENSIONAL and forward-aligned. Previous
		// versions independently eased world Y, visibly sliding the animal
		// sideways/upwards while its spine faced somewhere else.
		this.godPos.addScaledVector( this.godForward, this.godSpeed * dt );
		this.godPos.y = clamp( this.godPos.y, Math.min(-18,Math.max(-ABYSS_ZONE.maxDepth,(this.app.terrainData?.heightAt?.(this.godPos.x,this.godPos.z)??-425)+25)), -18 );
		const mouthAfter = leviathanMouthPosition( this.godPos, this.godForward );
		this.previousMouth = mouthAfter.clone();
		const hullForward = this.forward || forward( this.yaw || 0, this.pitch || 0, new Vector3() );
		const jawContact = movingJawHullContact( mouthBefore, mouthAfter, this.pos, hullForward );
		// Only the actual sweeping jaw volume intersecting the 3-D hull can
		// cause physical bite damage. A missed charge is a genuine dodge.
		if ( charging && !this.chargeHit && jawContact.contact ) {
			this.chargeHit = true;
			this.bossState = 'bite';
			this.stateClock = .49;
			this.biteClock = .49;
			const damage = phase === 3 ? 345 : phase === 2 ? 255 : 195;
			this.damageHull?.( damage, jawContact.hull );
			this.showImpact?.( jawContact.mouth, 23 );
			this.notice = '⚠ 巨颚咬合！真实船体接触，推进器正在抗冲击！';
			this.noticeClock = 3.2;
		}
		const jawTarget = this.bossState === 'windup' || charging ? 1 :
			this.bossState === 'stalk' ? .075 + .025 * Math.sin( this.elapsed * 2.1 ) : 0;
		this.jawOpen = smooth( this.jawOpen, jawTarget, dt, jawTarget > this.jawOpen ? 5.4 : 11.0 );
		if ( sucking ) {
			const toCenter = this.godPos.clone().sub( this.pos );
			const range = toCenter.length();
			if ( range > 14 && range < 240 ) {
				const pull = (1 - range / 240) * 23;
				this.pos.addScaledVector( toCenter.normalize(), pull * dt );
				this.shakeClock = Math.max( this.shakeClock, .18 );
				this.vortexDamageClock -= dt;
				if ( range < 48 && this.vortexDamageClock <= 0 ) {
					this.damageHull( 115, this.pos );
					this.vortexDamageClock = 1.4;
				}
			}
		}
		this.god.position.copy( this.godPos );
		this.god.rotation.set( this.godPitch, this.godYaw, this.godBank + Math.sin( this.elapsed * .33 ) * .012, 'YXZ' );
		for ( const light of this.godMotes ) {
			light.mote.position.set( light.base.x + Math.sin( this.elapsed * .45 + light.phase ) * 2.4,
				light.base.y + Math.sin( this.elapsed * .63 + light.phase ) * 3.0,
				light.base.z + Math.cos( this.elapsed * .36 + light.phase ) * 2.8 );
		}
		if ( this.godAsset?.externalAnimationClips?.length ) {
			// Original keyframes remain intact under a lightweight procedural
			// lower-jaw overlay; the mouth no longer depends on a nonexistent
			// jaw bone in this specific 66-bone artist model.
			const clips = this.godAsset.externalAnimationClips;
			const desired = charging ? 'Charge' :
				( this.bossState === 'windup' || this.bossState === 'bite' ||
					this.bossState === 'sonic' || this.bossState === 'waterjet' ) ? 'Attack' : 'Swim';
			const chosen = clips.find( s => s.toLowerCase() === desired.toLowerCase() ) || clips[ 0 ];
			if ( this.godAsset.skeleton.current !== chosen ) this.godAsset.skeleton.play( chosen, { fade: .30 } );
			const layer = this.godAsset.skeleton.layers.find( s => s.target === 1 );
			if ( layer ) layer.speed = smooth( layer.speed,
				charging ? 2.6 : biting ? 2.2 : clamp( this.godSpeed / 11, .95, 2.4 ), dt, 5 );
			for ( const m of this.godAsset.materials || [] ) {
				if ( m.uniforms.biteOpen ) m.uniforms.biteOpen.value = this.jawOpen;
				if ( m.uniforms.titanPain ) m.uniforms.titanPain.value = Math.max( 0, this.godHurt || 0 );
			}
			animateLeviathanRig( this.godAsset.skeleton, this.godAsset.anatomicalRig,
				this.elapsed, this.godSpeed, this.bossState, this.jawOpen, this.godBank );
			this.godAsset.skeleton.update( dt );
		} else if ( this.godAsset?.skeleton ) {
			const pseudo = { id: 'sea_god', chaseSpeed: 33,
				brain: { x: this.godPos.x, z: this.godPos.z, heading: this.godYaw,
					currentSpeed: this.godSpeed, state: this.bossState,
					windup: this.bossState === 'windup' ? this.stateClock : 0,
					attack: { windup: 2.6, kind: charging ? 'ocean_ram' : sucking ? 'abyss_vortex' : '' } } };
			updateTitanSkeleton( this.godAsset, pseudo, this.pos, this.elapsed, dt,
				charging ? 1 : sucking ? .75 : this.bossState === 'windup' ? .5 : 0,
				charging ? 'ocean_ram' : sucking ? 'abyss_vortex' : this.bossState === 'pulse' ? 'ocean_pulse' : '' );
		}
	}

	stepTorpedoes( dt ) {
		for ( let i = this.torpedoes.length - 1; i >= 0; i -- ) {
			const shot = this.torpedoes[i];
			shot.ttl -= dt;
			const previous = shot.pos.clone();
			// Gradual steering; a real launched torpedo does not instantly pivot
			// onto the target, and it cannot make abrupt 180-degree turns.
			if ( ( this.pingClock > 0 || shot.guided ) && shot.kind !== 'harpoon' ) {
				const to = this.godPos.clone().sub( shot.pos ).normalize();
				shot.velocity.lerp( to.multiplyScalar( 125 ), 1 - Math.exp( - dt * ( shot.guided ? 2.3 : .85 ) ) )
					.normalize().multiplyScalar( 125 );
			}
			shot.pos.addScaledVector( shot.velocity, dt );
			shot.mesh.position.copy( shot.pos );
			shot.mesh.lookAt( shot.pos.clone().add( shot.velocity ) );
			const axis = this.godForward;
			const a = this.godPos.clone().addScaledVector( axis, -108 );
			const b = this.godPos.clone().addScaledVector( axis, 111 );
			const hit = !this.finished && closestSegmentPoints( previous, shot.pos, a, b ).distance < 14.2;
			if ( hit ) {
				this.godHP = Math.max( 0, this.godHP - shot.damage );
				this.godHurt = Math.max( this.godHurt || 0, 1 );
				this.showImpact( shot.pos, 12 );
				this.notice = `✦ ${ shot.kind === 'harpoon' ? '磁轨鱼叉' : '鱼雷' }穿透海神生物装甲 -${ shot.damage } · 剩余 ${ Math.ceil( this.godHP ) } HP`;
				this.noticeClock = 1.9;
				if ( this.godHP <= 0 ) this.defeatGod();
			}
			if ( hit || shot.ttl <= 0 ) {
				this.app.scene.remove( shot.mesh );
				this.torpedoes.splice( i, 1 );
			}
		}
		for ( let i = this.impacts.length - 1; i >= 0; i -- ) {
			const p = this.impacts[i];
			p.ttl -= dt;
			p.mesh.position.addScaledVector( p.velocity, dt * 4 );
			p.mesh.scale.setScalar( clamp( p.ttl * 1.2, .15, 1 ) );
			if ( p.ttl <= 0 ) {
				this.app.scene.remove( p.mesh );
				this.impacts.splice( i, 1 );
			}
		}
	}

	renderHud() {
		if ( ! this.active ) return;
		const depth = - this.pos.y;
		this.hud.querySelector( '[data-abyss-hp]' ).textContent = `船体 ${ Math.ceil( this.hull ) } / ${ ABYSS_STATS.hull }`;
		this.hud.querySelector( '[data-abyss-depth]' ).textContent = `深度 ${ Math.round( depth ) } m · ${ this.emergencyAscent ? '⚠ 自动上浮' : depth >= ABYSS_ZONE.maxDepth - 1 ? '⚠ 最大深度' : depth > ABYSS_ZONE.safeDepth ? '⚠ 危险水压' : '水压正常' }`;
		this.hud.querySelector( '[data-abyss-god]' ).textContent = `🐉 海神 ${ this.finished ? '已击败' : `${ Math.ceil( this.godHP ) }/${ ABYSS_STATS.leviathan } HP · P${ phaseAt( this.godHP / ABYSS_STATS.leviathan ) }` }`;
		const deltaDepth = this.pos.y - this.godPos.y;
		const rel = angleDiff( bearing( this.godPos.x - this.pos.x, this.godPos.z - this.pos.z ), this.yaw );
		// World +yaw is screen-left from a camera looking along world +Z.
		const direction = Math.abs( rel ) < .3 ? '正前方' : rel > 0 ? '左转寻找' : '右转寻找';
		this.hud.querySelector( '[data-abyss-nav]' ).textContent = `◉ 距离 ${ Math.round( this.pos.distanceTo( this.godPos ) ) }m · ${ this.bossLock ? '已锁定目标 F' : direction } · ${ Math.abs( Math.round( deltaDepth ) ) }m ${ deltaDepth > 0 ? '下方' : '上方' }`;
		this.hud.querySelector( '[data-abyss-telemetry]' ).textContent =
			`实际航速 ${ ( this.speed || 0 ).toFixed( 1 ) } m/s · 升沉 ${ Math.round( this.diveVelocity || 0 ) } m/s · ${ this.godAsset?.anatomicalRig?.totalBones || 66 } 根驱动骨骼`;
		this.hud.querySelector( '[data-abyss-speed]' ).textContent = `${ ( this.speed || 0 ).toFixed( 1 ) } m/s`;
		this.hud.querySelector( '[data-abyss-speed-fill]' ).style.width = `${ clamp( Math.abs( this.speed ) / SUBMARINE_DRIVE.flank * 100, 0, 100 ) }%`;
		const telegraph = clamp( this.throttle || 0, -1, 1 );
		const ordered = telegraph >= 0 ? telegraph * ( this.boostCommand ? SUBMARINE_DRIVE.flank : SUBMARINE_DRIVE.cruise ) :
			telegraph * SUBMARINE_DRIVE.reverse;
		this.hud.querySelector( '[data-abyss-target-speed]' ).textContent = `目标航速 ${ (ordered*(this.pressure?pressureDrive(this.pressure).thrust:1)).toFixed( 1 ) } m/s`;
		const lever = this.hud.querySelector( '[data-abyss-throttle-fill]' );
		lever.style.left = `${ 50 + Math.min( 0, telegraph ) * 50 }%`;
		lever.style.width = `${ Math.abs( telegraph ) * 50 }%`;
		lever.style.background = telegraph < 0 ? '#f6a97b' : '#77e9d8';
		const orderLabel = telegraph > .01 ? `前进 ${ Math.round( telegraph * 100 ) }%` :
			telegraph < -.01 ? `倒车 ${ Math.round( -telegraph * 100 ) }%` : '停车';
		this.hud.querySelector( '[data-abyss-thrust]' ).textContent =
			`车钟：${ orderLabel }${ this.boostCommand ? ' · 急速' : '' }${ this.emergencyAscent ? ' · ⚠ 自动上浮' : '' }`;
		const rudder = this.rudder || 0;
		this.hud.querySelector( '[data-abyss-rudder]' ).textContent =
			Math.abs( rudder ) < .02 ? '方向舵：居中' : `方向舵：${ rudder > 0 ? '右' : '左' } ${ Math.round( Math.abs( rudder ) * 100 ) }%`;
		const heading = ( Math.round( Math.atan2( Math.sin( this.yaw ), -Math.cos( this.yaw ) ) * 180 / Math.PI ) + 360 ) % 360;
		this.hud.querySelector( '[data-abyss-bearing]' ).textContent = `航向 ${ String( heading ).padStart( 3, '0' ) }°`;
		this.hud.querySelector( '[data-abyss-helm-label]' ).textContent = this.helmMode === 'arcade' ? '即时推进 · 鼠标仅观察' : '标准船舵 · 油门保持';
		this.hud.querySelector( '[data-abyss-aim]' ).textContent = this.bossLock ? '目标锁定 · 追踪鱼雷' : '按 F 锁定海神';
		this.hud.classList.toggle( 'abyss-locked', this.bossLock );
		this.hud.querySelector( '[data-abyss-alert]' ).textContent = this.noticeClock > 0 ? this.notice : '';
		this.hud.querySelector( '[data-abyss="fire"]' ).disabled = this.fireCooldown > 0 || this.finished;
		this.hud.querySelector( '[data-abyss="harpoon"]' ).disabled = this.harpoonCooldown > 0 || this.finished;
		this.hud.querySelector( '[data-abyss="charge"]' ).disabled = this.chargeCooldown > 0 || this.finished;
		this.hud.querySelector( '[data-abyss="counter"]' ).disabled = this.counterPulseCooldown > 0 || this.finished;
		this.hud.querySelector( '[data-abyss="sonar"]' ).disabled = this.pingCooldown > 0;
		this.hud.querySelector( '[data-abyss="lights"]' ).textContent = `探照灯：${ this.lampsOn ? '开' : '关' } L`;
		this.hud.querySelector('[data-abyss="invert-x"]').textContent='水平：'+(this.invertX?'反转':'正常');this.hud.querySelector('[data-abyss="invert-y"]').textContent='垂直：'+(this.invertY?'反转':'正常');
        this.hud.querySelector( '[data-abyss="camera"]' ).textContent = this.cameraMode === 'chase' ? '外部视角 V' : this.cameraMode==='interior'?'舱内 V':'潜望镜 V';
		this.hud.querySelector( '[data-abyss="helm"]' ).textContent = this.helmMode === 'arcade' ? '即时推进 H' : '标准船舵 H';
		this.hud.querySelector( '[data-abyss="sensitivity"]' ).textContent =
			`镜头灵敏度：${ this.mouseSensitivity < 1 ? '低' : this.mouseSensitivity > 1 ? '高' : '中' }`;
		this.hud.querySelector( '[data-abyss="emergency"]' ).textContent = this.emergencyAscent ? '取消上浮 B' : '应急上浮 B';
		const help = this.helmMode === 'helm' ?
			'标准船舵：W/S 调整并保持油门 · A/D 左右打舵 · 鼠标只环视 · N 停车 · Shift 急速 · Space 上浮 · Q/Ctrl 下潜 · B 应急上浮 · F 锁定追踪 · C 鱼雷 · G 鱼叉 · T 深弹 · Z 防御 · R 声呐 · V 镜头 · X 回正 · H 模式 · Esc 释放' :
			'即时推进：按住 W/S 移动，松开刹车 · A/D 左右转向 · 鼠标独立环视 · N 停车 · Shift 急速 · Space 上浮 · Q/Ctrl 下潜 · B 应急上浮 · F 锁定 · C 鱼雷 · G 鱼叉 · T 深弹 · Z 防御 · R 声呐 · V 镜头 · X 回正 · H 标准船舵 · Esc 释放';
		const shortcuts = this.hud.querySelector( '.abyss-shortcuts' );
        if(this.pressure){const p=this.pressure,drive=pressureDrive(p),status=this.hud.querySelector('[data-abyss-pressure]');status.textContent=p.sections.map((s,i)=>`${SECTION_NAMES[i]} ${Math.ceil(s.hp)}HP / 水${Math.round(s.water*100)}% / 氧${Math.round(s.air*100)}%`).join(' · ')+` · 电力 ${Math.round(drive.power*100)}%`;const pump=this.hud.querySelector('[data-abyss="pump"]'),door=this.hud.querySelector('[data-abyss="door"]'),i=nearBulkhead(this.interior?.p);pump.textContent=`排水泵 ${p.pump?'开':'关'} J`;pump.disabled=this.interior?.station!=='engine';door.textContent=i<0?'靠近隔舱门 U':`${p.doors[i]?'打开':'关闭'}隔舱门 U`;door.disabled=i<0||this.cameraMode!=='interior'||!!this.interior?.station;}
        const inside=this.cameraMode==='interior';this.hud.classList.toggle('abyss-inside',inside);
        const station=this.interior?.station,near=this.interior?.near(),crew=this.app.crew;const role=station?ABYSS_STATIONS[station]?.name:'自由走动';
        if(this.interior){this.hud.querySelector('[data-abyss-station]').textContent=`${role} · ${inside?(near?ABYSS_STATIONS[near].name+'附近':'舱内通道'):'外部观察'}`;this.hud.querySelector('[data-abyss-crew]').textContent=crew?.connected?`船员 ${Object.keys(this.members).length}/4 · 驾驶：${Object.entries(this.members).find(([,p])=>p.station==='helm')?.[0]===crew.selfId?'你':Object.values(this.members).some(p=>p.station==='helm')?'队友（E 离岗后可交接）':'空闲'}`:'单人模式 · 依次操作岗位';this.hud.querySelector('[data-abyss-supplies]').textContent=`弹药 ${this.ammo}/48 · 维修件 ${this.parts}/6`;this.hud.querySelector('[data-abyss-task]').textContent=this.finished?'海神已击败 · 可返航':`目标：躲避蓄力攻击 · 消灭利维坦`;this.hud.querySelector('[data-abyss="station"]').disabled=!inside||!station&&!near;for(const action of ['fire','harpoon','charge','counter','sonar']){const b=this.hud.querySelector(`[data-abyss="${action}"]`);b.disabled=b.disabled||((inside||crew?.connected)&&!canStationAction(station,action))||(['fire','harpoon','charge'].includes(action)&&!this.ammo);}const repairBtn=this.hud.querySelector('[data-abyss="repair"]');repairBtn.disabled=this.repairCooldown>0||this.repairProgress>0||!this.parts||this.hull>=ABYSS_STATS.hull||station!=='engine';repairBtn.textContent=this.repairProgress>0?`维修中 ${Math.round(this.repairProgress*100)}%`:this.repairCooldown>0?`维修冷却 ${Math.ceil(this.repairCooldown)}s`:'Y · 启动维修';}
        const helpText=inside?(station==='helm'?'驾驶台：W/S 加减速 · A/D 转向 · Space 上浮 / Ctrl/Q 下潜 · E 离岗 · 船首观察窗':station==='gun'?'武器台：C 鱼雷 · G 鱼叉 · T 深弹 · 侧窗观察 / F 锁定 · E 离岗':station==='sonar'?'声呐台：R 扫描 · Z 反声波 · E 离岗':station==='engine'?'工程台：Y 修复 · E 离岗':'舱内：WASD 行走 · 鼠标观察 · E 操作附近控制台 · 从侧窗观察外界 · V 可选视角'):help;
		if ( shortcuts.textContent !== helpText ) shortcuts.textContent = helpText;const hb=this.hud.querySelector('[data-abyss="hatch"]');if(hb){hb.textContent=this.hatch?.active?this.hatch.status():'气密舱 · O';hb.disabled=!this.hatch?.ready||!!(this.hatch?.active&&this.hatch.cycle.phase!=='outside');}if(this.hatch?.active)for(const id of ['cabin','camera','station','repair','door','pump','fire','harpoon','charge','sonar','counter','emergency','helm','throttle-up','throttle-down','throttle-stop']){const b=this.hud.querySelector(`[data-abyss="${id}"]`);if(b)b.disabled=true;}else for(const id of ['cabin','camera','emergency','helm','throttle-up','throttle-down','throttle-stop']){const b=this.hud.querySelector(`[data-abyss="${id}"]`);if(b)b.disabled=false;}
	}

    requestHatch(){if(!this.active||!this.hatch)return false;if(this.hatch.active)return this.hatch.cycle.requestReturn();if(!this.hatch.start(this)){this.notice='气密舱：单人胜利后，停稳于12–20米浅水，中舱无严重损伤，离岗并靠近中央梯位。';this.noticeClock=5;return false;}this.speed=this.throttle=this.rudder=this.diveVelocity=this.yawRate=this.throttleHold=0;this.subImpulse?.set(0,0,0);this.emergencyAscent=false;this.repairJob=null;this.repairProgress=0;this.pilotIntent={throttle:0,throttleHold:0};this.notice=this.hatch.status();this.noticeClock=3;return true;}
	update( dt ) {
		if ( ! this.active ) return;
		dt = Math.min( dt, .05 );
		this.elapsed += dt;
		this.noticeClock -= dt;this.repairCooldown=Math.max(0,(this.repairCooldown||0)-dt);
		this.godHurt = Math.max( 0, ( this.godHurt || 0 ) - dt * 1.9 );
		this.bossHitFlash = Math.max( 0, ( this.bossHitFlash || 0 ) - dt );
		this.hud.classList.toggle( 'abyss-hit', this.bossHitFlash > 0 );
		this.fireCooldown = Math.max( 0, this.fireCooldown - dt );
		this.harpoonCooldown = Math.max( 0, this.harpoonCooldown - dt );
		this.chargeCooldown = Math.max( 0, this.chargeCooldown - dt );
		this.counterPulseCooldown = Math.max( 0, this.counterPulseCooldown - dt );
		this.counterClock = Math.max( 0, (this.counterClock || 0) - dt );
		this.pingCooldown = Math.max( 0, this.pingCooldown - dt );
		this.pingClock = Math.max( 0, this.pingClock - dt );
		const input = this.app.input;
        if(input.hit('KeyO'))this.requestHatch();
        if(this.hatch?.active){this.hatch.step(this,dt,input,input.consumeLook());this.notice=this.hatch.active?this.hatch.status():'已返回中舱，气密门关闭。';this.noticeClock=3;this.updateCamera(dt);this.renderHud();return;}
		if ( input.hit( 'KeyC' ) ) this.requestAction('fire');
		if ( input.hit( 'KeyG' ) ) this.requestAction('harpoon');
		if ( input.hit( 'KeyT' ) ) this.requestAction('charge');
		if ( input.hit( 'KeyZ' ) ) this.requestAction('counter');
		if ( input.hit( 'KeyR' ) ) this.requestAction('sonar');
		if ( input.hit( 'KeyV' ) ) this.switchCamera();
        if(input.hit('KeyE')&&this.cameraMode==='interior')this.useStation();
        if(input.hit('KeyY'))this.requestAction('repair');if(input.hit('KeyJ'))this.requestAction('pump');if(input.hit('KeyU'))this.requestDoor();
		if ( input.hit( 'KeyX' ) ) this.resetCamera();
		if ( input.hit( 'KeyF' ) ) this.bossLock = ! this.bossLock;
		if ( input.hit( 'KeyL' ) ) this.toggleDiveLights();
		if ( input.hit( 'KeyH' ) && this.localHelm() ) this.toggleHelm();
		if ( input.hit( 'KeyB' ) && this.localHelm() && !this.remoteClient() ) this.toggleEmergencyAscent();
		if ( input.hit( 'KeyN' ) && this.localHelm() ){this.allStop();if(this.pilotIntent){this.pilotIntent.throttle=0;this.pilotIntent.throttleHold=0;}if(this.app.crew?.connected&&this.roomHost)this.app.crew.send({type:'abyss_command',action:'stop'});}
		const look = input.consumeLook();
        if(this.cameraMode==='interior')this.interior?.step(input,look,dt,{sensitivity:this.mouseSensitivity,invertX:this.invertX,invertY:this.invertY});
        const cameraLook=this.cameraMode==='interior'?{x:0,y:0}:look;
        let turn = Number( input.down( 'KeyD' ) ) - Number( input.down( 'KeyA' ) );
		// Like a ship helm: the pointer is always a CAMERA control. It can never
		// be interpreted as a hull heading, even while firing or accelerating.
		const manualCamera = Math.abs( look.x ) + Math.abs( look.y ) > 0;
		if ( manualCamera ) this.bossLock = false;
		const orbit = orbitSubmarineCamera( this.orbitTargetYaw, this.orbitTargetElevation,
			cameraLook.x, cameraLook.y, this.mouseSensitivity,this.invertX,this.invertY );
		this.orbitTargetYaw = orbit.yaw;
		this.orbitTargetElevation = orbit.elevation;
		this.orbitTargetYaw -= ( Number( input.down( 'ArrowRight' ) ) -
			Number( input.down( 'ArrowLeft' ) ) ) * dt * .94;
		this.orbitTargetYaw = angleDiff( this.orbitTargetYaw, 0 );
		this.orbitTargetElevation = clamp( this.orbitTargetElevation +
			( Number( input.down( 'ArrowDown' ) ) - Number( input.down( 'ArrowUp' ) ) ) * dt * .65,
			-.40, 1.02 );
		if ( this.bossLock ) {
			const targetYaw = bearing( this.godPos.x - this.pos.x, this.godPos.z - this.pos.z ) - this.yaw;
			this.orbitTargetYaw = angleDiff( targetYaw, 0 );
			const horizontal = Math.max( 1, Math.hypot( this.godPos.x - this.pos.x, this.godPos.z - this.pos.z ) );
			const targetElevation = clamp( Math.atan2( this.pos.y - this.godPos.y, horizontal ), -.28, .80 );
			this.orbitTargetElevation = targetElevation;
		}
		// Critical damping of the TARGET orbit, independent of the hull steering.
		// Smoothing speed uses seconds, so the feel is stable at 30/60/144 FPS.
		this.orbitYaw = angleDiff( this.orbitYaw + angleDiff( this.orbitTargetYaw, this.orbitYaw ) *
			( 1 - Math.exp( -dt * 17 ) ), 0 );
		this.orbitElevation = smooth( this.orbitElevation, this.orbitTargetElevation, dt, 15 );
		this.cameraDistance = clamp( this.cameraDistance * ( 1 + input.consumeWheel() * .075 ), 30, 96 );
		const pilot=this.app.crew?.connected&&this.roomHost?(this.pilotIntent??={throttle:0,throttleHold:0}):this;
        let thrust = this.localHelm()&&input.enabled&&!input.gameplayBlocked?adjustSubmarineThrottle( pilot, {
			up: input.down( 'KeyW' ), down: input.down( 'KeyS' ),
			upPressed: input.hit( 'KeyW' ), downPressed: input.hit( 'KeyS' ),
			stop: input.down( 'KeyN' ), arcade: this.helmMode === 'arcade',
		}, dt ):0;
		let rise = Number( input.down( 'Space' ) ) - Number( input.down( 'ControlLeft' ) || input.down( 'ControlRight' ) || input.down('KeyQ') );
		this.driveCommand = thrust;
		this.boostCommand = input.down( 'ShiftLeft' ) || input.down( 'ShiftRight' );
        if(!this.localHelm()||!input.enabled||input.gameplayBlocked){turn=0;rise=0;this.boostCommand=false;if(!this.localHelm())this.throttle=0;}
        if(this.app.crew?.connected&&this.roomHost){if(this.localHelm()){this.driveNetClock=(this.driveNetClock||0)-dt;if(this.driveNetClock<=0){this.driveNetClock=.1;this.app.crew.send({type:'abyss_command',action:'drive',thrust,turn,ballast:rise,flank:this.boostCommand});}}
          if(this.remoteClient()){this.stepRemote(dt);this.interior?.stepPeers(dt);this.updateCamera(dt);this.sendCrewPose(dt);this.renderHud();return;}
          const cmd=resolveAbyssDrive(this.members,this.app.crew.selfId,{thrust,turn,ballast:rise,flank:this.boostCommand},this.crewDrive,this.elapsed);thrust=cmd.thrust;turn=cmd.turn;rise=cmd.ballast;this.boostCommand=cmd.flank;this.throttle=thrust;
        }
        this.driveCommand=thrust;
		const depthBefore = -this.pos.y;
		if ( !this.emergencyAscent && this.hull < ABYSS_STATS.hull * .23 && depthBefore > ABYSS_ZONE.safeDepth + 8 ) {
			this.emergencyAscent = true;
			this.notice = '⚠ 船体结构严重受损！安全系统自动启动紧急上浮。';
			this.noticeClock = 4;
		}
		if ( this.emergencyAscent && depthBefore <= 75 ) {
			this.emergencyAscent = false;
			this.notice = '✓ 已回到浅水安全区域，压载控制恢复手动。';
			this.noticeClock = 3;
		}
		this.stepRepair(dt);
        const systems=this.pressure?stepPressure(this.pressure,depthBefore,dt):{thrust:1,power:1,trim:0,air:1};
        if(this.pressure)this.interior?.setPressure(this.pressure);
        if(systems.air<.15&&depthBefore>75)this.emergencyAscent=true;
        stepSubmarineDynamics( this, { thrust:thrust*systems.thrust, turn:turn*systems.power,
			ballast: this.emergencyAscent ? 1 : rise*systems.power, flank: this.boostCommand, comfort: !!this.interior }, dt );
        this.pitch+=systems.trim*dt;
		forward( this.yaw, 0, this.forward );
		this.pos.addScaledVector( this.forward, this.speed * dt );
		// Heavy collision impulse decays, with no teleport or permanent drift.
		this.pos.addScaledVector( this.subImpulse, dt );
		this.subImpulse.multiplyScalar( Math.exp( -dt * 3.5 ) );
		this.pos.y += this.diveVelocity * dt;
		this.pos.y = clamp( this.pos.y, - ABYSS_ZONE.maxDepth, - 12 );
		// Never report downward motion while the hull is pinned at the floor.
		if ( ( this.pos.y <= -ABYSS_ZONE.maxDepth && this.diveVelocity < 0 ) ||
			( this.pos.y >= -12 && this.diveVelocity > 0 ) ) this.diveVelocity = 0;
		// The patrol zone is only navigation guidance. V29's hard cylindrical
		// clamp set speed=0 each frame, stranding players in fatal pressure.
		const outOfPatrol = beyondAbyssPatrol( this.pos.x, this.pos.z );
		if ( outOfPatrol && !this.outOfPatrol ) {
			this.notice = '◉ 已离开海神核心巡逻区，潜艇仍可自由航行。按 R 查看声呐方位。';
			this.noticeClock = 5;
		}
		this.outOfPatrol = outOfPatrol;
		this.sub.position.copy( this.pos );
		this.sub.rotation.set( - this.pitch, this.yaw, this.subRoll, 'YXZ' );
		const depthExcess = pressureAt( - this.pos.y );
		if ( depthExcess > 0 ){const damage=depthExcess / 65 * ABYSS_STATS.pressureDamage * dt;if(this.pressure){applyPressureDamage(this.pressure,damage,0);this.hull=totalHull(this.pressure);}else this.hull=Math.max(0,this.hull-damage);}
		if ( this.hull <= 0 ) { this.damageHull( 1, this.pos ); return; }
		this.stepGod( dt );if(!this.active)return;
		// Vortex physics modifies the actual player pose, so skin and camera
		// consume the corrected transform in the same frame, never one late.
		this.sub.position.copy( this.pos );
		this.stepTorpedoes( dt );
		this.stepWaterJets( dt );if(!this.active)return;
		this.stepShockwaves( dt );if(!this.active)return;
		this.updateDiveLights();
		if ( this.sonarClock > 0 ) {
			this.sonarClock -= dt;
			const scale = (1.6 - this.sonarClock) * 65;
			this.sonarRing.scale.setScalar( Math.max( 1, scale ) );
			if ( this.sonarClock <= 0 ) this.sonarRing.visible = false;
		}
		this.interior?.stepPeers(dt);this.updateCamera(dt);this.sendCrewPose(dt);this.renderHud();
    }
    updateCamera(dt){
        const camera = this.app.camera;
		const pose = this.hatch?.active?this.hatch.pose(this.interior):this.cameraMode==='interior'&&this.interior?this.interior.pose(this.sub):abyssCameraPose( this.pos, this.yaw, this.orbitYaw,
			this.orbitElevation, this.cameraDistance, this.cameraMode );
		if ( this.cameraMode==='interior' || ! this.cameraPrimed || camera.position.distanceToSquared( pose.position ) > 10000 ) {
			// First-frame snap prevents a seconds-long fly-through from the
			// surface captain's camera; later camera mode switches interpolate.
			camera.position.copy( pose.position );
			this.cameraAim.copy( pose.target );
			this.cameraPrimed = true;
		} else {
			camera.position.lerp( pose.position, 1 - Math.exp( - dt * 5.2 ) );
			this.cameraAim.lerp( pose.target, 1 - Math.exp( - dt * 6 ) );
		}
		camera.lookAt( this.cameraAim );
		if ( this.shakeClock > 0 ) {
			this.shakeClock -= dt;
			camera.position.x += Math.sin( this.elapsed * 79 ) * .18 * this.shakeClock;
			camera.position.y += Math.sin( this.elapsed * 101 ) * .13 * this.shakeClock;
		}
		if ( this.godAsset?.root ) {
			const localCamera = this.god.worldToLocal( camera.position.clone() );
			this.godAsset.root.visible = ! cameraInsideLeviathan( localCamera, ! this.godAsset.root.visible );
		}
	}
}
