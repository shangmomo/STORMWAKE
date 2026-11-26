import {bossGuide,landObserver,landDistance,corsairAvailable} from './LandEncounterGuideV832.js';
import {LURKER,lurkerEnabled,createLurkerModel,poseLurker,lurkerFacing} from './LurkerV83.js';
import {LandRewardOutbox} from './LandRewardOutboxV79.js';
import {ExpeditionServicesV77} from './ExpeditionServicesV77.js';
import {forgedDamage} from '../game/LandForge.js';
import {ExpeditionSceneryV76} from './ExpeditionSceneryV76.js';
import {ExpeditionRockV75} from './ExpeditionRockV75.js';
import {ExpeditionWildlifeV74} from './ExpeditionWildlifeV74.js';
import {ExpeditionAssetsV73,loadBearActor,BEAR_HOME,bearContact,BEAR_CONTACT} from './ExpeditionAssetsV73.js';
import {bearFacing} from './BearBrainV73.js';
import {Group} from '../engine/index.js';
import {RexEncounter} from './RexEncounter.js';
import {FossilSurvey} from './FossilSurvey.js';
import {corsairAttackFacing} from "./LandCorsairBrain.js";
import {buildExpeditionCave,buildHarborRoom} from './ExpeditionSites.js';
import {EXPEDITION_ROUTES,CAVE,caveProfile,DEEP_SURVEY} from './ExpeditionTerrain.js';
import {canPersonal,personalSelection,controlContext} from '../core/ControlPolicy.js';
import {PERSONAL_WEAPONS,personalStrike,createPersonalWeapon,updateHeldWeapon} from './PersonalWeapons.js';
import { Vector3, Color } from '../engine/index.js';
import { WORLD } from '../world/WorldLayout.js';
import { LAND_SAVE_KEY, LAND_SITES, LAND_SPECIES, landPhase, restoreLandSave,
	allMirrorsAligned, rotateMirror, createLandEnemy, advanceLandEnemy, landEnemyHit,
	targetWithinStrike } from './LandLogic.js';
import { createTrailMarker, createMirror, createMirrorRay, createExplorerBoard, createForestShrine, createCorruptionMote,
	createLandCreature, createLandAnimal, createSlashArc, createTideBlade } from './LandModels.js';
import { LandResidents } from './LandResidents.js';
import { LAND_BINDINGS, landActionContext, landInputEdges, makeLandActionEvent, makeLandWorldIntent } from './LandControls.js';
import { loadLandRig, playLandRigAction } from './LandRigRuntime.js';
import { makeStrikeWindow, strikeActive, sweptBladeContact, strikeLineBlocked } from './LandCombatTiming.js';
import { LandAvatar } from './LandAvatar.js';
import { LandCombatFX } from './LandCombatFX.js';
import { LandInteractionDirector } from './LandInteractionDirector.js';
import { installLandSiteColliders } from './LandSiteColliders.js';
import { LandDialoguePanel } from './LandDialoguePanel.js';
import { createLighthouseV34, LIGHTHOUSE_V34 } from './LandLighthouseV34.js';
import { installLighthouseV34Colliders } from './LandLighthouseV34Colliders.js';
import { CORSAIR } from './LandCorsairBrain.js';
import { attachPirateStyle } from './LandPirateStyle.js';
import { LandFootPlant, groundSurface } from './LandGrounding.js';
import { LAND_REGIONS, makeRegionWaypoint } from './LandRegionWaypoints.js';

const clamp = ( x, a, b ) => Math.max( a, Math.min( b, x ) );
const dist = ( a, b ) => Math.hypot( a.x - b.x, a.z - b.z );
const _view = new Vector3();
const _tmp = new Vector3();
const _weaponRight = new Vector3(), _weaponUp = new Vector3();
const MIRROR_GOALS = [ 2, 1, 3 ];
const CORSAIR_SAVE_KEY = 'tidewater:land-corsair:v37';

function saveStore() {
	try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export class LandAdventure {
	constructor( app ) {
		this.app = app;
		this.time = 0;
		this.stance = false;this.weaponId='cutlass';
		this.hp = 100;
		this.stamina = 100;
		this.dodgeTimer = 0;
		this.dodgeDir = new Vector3();
		this.attackTimer = 0;
		this.attackCooldown = 0;
		this.pendingStrike = null;
		this.invulnerableTimer = 0;
		this.hurtTimer = 0;
		this.battleTimer = 0;
		this.leftPrev = false;
		this.rightPrev = false;
		this.combatSequence = 0;
		this.simulationTick = 0;
		this.combatEventLog = [];
		this.worldIntentLog = [];
		this.notice = '';
		this.noticeTimer = 0;
		this.companionAidUsed = false;
		this.trailIndex = 1;
		this.journalExpanded = true;
		this.progress = this._load();
        this.rewardOutbox=new LandRewardOutbox(saveStore());
        this.rewardRetryClock=0;
		try{this.progress.corsairDefeated=saveStore()?.getItem(CORSAIR_SAVE_KEY)==='1';}catch{this.progress.corsairDefeated=false;}
		try { this.eastQuest=JSON.parse(saveStore()?.getItem('stormwake:expedition:v70')||'null')||{};if(typeof this.eastQuest!=='object'||Array.isArray(this.eastQuest))this.eastQuest={}; }catch{this.eastQuest={};}
		this.lastPhase = null;
		this.lastDay = -1;
		this.raidActive = false;
		this.raidTimer = 0;
		this.enemies = [];
		this.animals = [];
		this.interactions = new LandInteractionDirector();

		const scene = app.scene, terrain = app.terrainData;
		const board = LAND_SITES.board;
		this.board = createExplorerBoard( board.x, terrain.heightAt( board.x, board.z ), board.z );
		scene.add( this.board );
		this.noticeHall=buildHarborRoom(app,{x:board.x,z:board.z+.85,role:"expedition-notice",width:4.8,depth:4.5,notice:true});
		this.shrine = createForestShrine( -82, terrain.heightAt( -82, -208 ), -208 );
		scene.add( this.shrine );
		const tower = LAND_SITES.lighthouse;
		this.tower = createLighthouseV34( tower.x, terrain.heightAt( tower.x, tower.z ), tower.z );
		scene.add( this.tower.group );
		this.trail = LAND_SITES.trail.slice( 1, -1 ).map( ( [ x, z ] ) => {
			const marker = createTrailMarker( x, terrain.heightAt( x, z ), z );
			scene.add( marker ); return marker;
		} );
		this.mirrors = LAND_SITES.mirrors.map( ( [ x, z ], i ) => {
			const mirror = createMirror( x, terrain.heightAt( x, z ), z );
			mirror.lens.rotation.y = this.progress.mirrors[ i ] * Math.PI / 2;
			scene.add( mirror.group ); return mirror;
		} );
		this.mirrorRays = this.mirrors.map( ( mirror ) => {
			const ray = createMirrorRay( mirror.group.position.clone().add( new Vector3( 0, 2.12, 0 ) ),
				this.tower.group.position.clone().add( new Vector3( 0, this.tower.beaconHeight, 0 ) ) );
			scene.add( ray ); return ray;
		} );
		this.attackArc = createSlashArc(); scene.add( this.attackArc );
		this.combatFX = new LandCombatFX( scene );
		this.tideBlade = createTideBlade(); this.tideBlade.visible = false; scene.add( this.tideBlade );
        this.weaponViews={cutlass:this.tideBlade,polearm:createPersonalWeapon('polearm'),rod:createPersonalWeapon('rod')};scene.add(this.weaponViews.polearm,this.weaponViews.rod);this.heldWeapons=Object.fromEntries(Object.keys(PERSONAL_WEAPONS).map(id=>[id,createPersonalWeapon(id)]));
		this.motes = [];
		for ( let i = 0; i < 8; i ++ ) {
			const x = -83 - ( i % 4 ) * 14, z = -203 - Math.floor( i / 4 ) * 29;
			const mote = createCorruptionMote();
			mote.position.set( x, terrain.heightAt( x, z ) + 1.6, z );
			scene.add( mote );
			this.motes.push( { model: mote, x, z, y: mote.position.y, seed: i * 1.73 } );
		}
		// Physical collision is independent of visual geometry and E-key volumes.
		this.siteColliders = installLandSiteColliders( app.colliders, terrain, {
			tower: null, shrine: this.shrine, mirrors: this.mirrors, board: this.board,
		} );
		this.lighthouseColliders = installLighthouseV34Colliders( app.colliders, this.tower );

		this._addEnemy( 'forest-crab', 'crab', -28, -159 );
		this._addEnemy( 'forest-hound', 'hound', -65, -192 );
		this._addEnemy( 'marsh-wraith', 'wraith', -104, -223 );
		this._addEnemy( 'lighthouse-warden', 'warden', -143, -275, { persistent: true } );
		this.expeditionCave=buildExpeditionCave(scene,terrain,app.colliders);
        this.lurker=this._addEnemy('v83-lurker','lurker',LURKER.x,LURKER.z,{persistent:true});
        this.deepSurvey=makeRegionWaypoint(DEEP_SURVEY,terrain);this.deepSurvey.name='V78 deep survey marker';scene.add(this.deepSurvey);
        const dp=this.deepSurvey.position;app.colliders.addCylinder(dp.x,dp.z,1.30,dp.y,dp.y+.23,{tag:'v78:deep-survey',walkable:true});app.colliders.addCylinder(dp.x,dp.z,.74,dp.y+.23,dp.y+.65,{tag:'v78:deep-survey'});app.colliders.addBox(new Vector3(dp.x,dp.y+1.95,dp.z),new Vector3(.10,1.6,.10),0,{tag:'v78:deep-survey'});
		this.regionWaypoints=LAND_REGIONS.map(data=>{const group=makeRegionWaypoint(data,terrain);scene.add(group);const {x,y,z}=group.position;app.colliders.addCylinder(x,z,1.30,y,y+.23,{tag:"v70:waypoint-base",walkable:true});app.colliders.addCylinder(x,z,.74,y+.23,y+.65,{tag:"v70:waypoint-stone"});app.colliders.addBox(new Vector3(x,y+1.95,z),new Vector3(.10,1.6,.10),0,{tag:"v70:waypoint-post"});return {...data,group};});
		// The open-air corsair camp has been retired in favour of the actual cave.
		if(!this.progress.corsairDefeated) this._addEnemy('island-corsair','corsair',CORSAIR.arena.x,CORSAIR.arena.z,{persistent:true});
		for ( const [ kind, x, z ] of [ [ 'fox', -12, -158 ], [ 'deer', -39, -180 ],
			[ 'boar', -63, -208 ], [ 'deer', 13, -150 ], [ 'fox', -93, -216 ] ] ) {
			const model = createLandAnimal( kind );
			model.group.position.set( x, terrain.heightAt( x, z ), z );
			model.group.rotation.y = .4;
			scene.add( model.group );
			const animal = { kind, x, z, homeX: x, homeZ: z, angle: .4, speed: 0, panic: 0,
				model, seed: x * .07 - z * .03, t: 0 };
			this.animals.push( animal );
			if ( typeof document !== 'undefined' ) loadLandRig( kind ).then( actor => {
				if ( !actor ) return;
				model.body.visible = false;
				model.group.add( actor.rig.group );
				animal.actor = actor;
			} );
		}
		this.fossilSurvey=new FossilSurvey(this);
        this.artistSites=new ExpeditionAssetsV73(this);
        if(typeof document!=='undefined'&&new URLSearchParams(location.search).get('coop')!=='1')this._addEnemy('forest-bear','bear',BEAR_HOME.x,BEAR_HOME.z);
		this.rex=new RexEncounter(this);
        this.ecologyV74=new ExpeditionWildlifeV74(this);
        this.rockV75=new ExpeditionRockV75(this);
        this.sceneryV76=new ExpeditionSceneryV76(this);
        this.servicesV77=new ExpeditionServicesV77(this);
		this.residents = new LandResidents( app );
		this.dialogue = new LandDialoguePanel( app );
		this.avatar = new LandAvatar( app );
		this.onCombatAction = event => this.avatar.onAction( event );
		if ( app.localLights ) {
			for(const z of [-451,-470,-489,-521])for(const side of [-1,1]){const x=CAVE.x+side*8;app.localLights.add({position:new Vector3(x,terrain.heightAt(CAVE.x,z)+2.8,z),color:new Color(0xffae62),intensity:3.7,range:18,kind:"lantern",flicker:.12});}
			for(const z of [-545,-565,-584,-595,-606,-623]){const cp=caveProfile(z);for(const sign of [-1,1]){const x=cp.x+sign*cp.width*.65;app.localLights.add({position:new Vector3(x,terrain.heightAt(x,z)+2.8,z),color:new Color(0xffb273),intensity:4,range:15,kind:'lantern',flicker:.08});}}
            this.lighthouseLight = app.localLights.add( { position: new Vector3( tower.x, this.tower.group.position.y + this.tower.beaconHeight, tower.z ),
				color: new Color( 0x56decf ), intensity: 6.4, range: 35, kind: 'beacon', flicker: .14 } );
		}
		this._createHUD();
		this._syncQuestVisuals();
	}

	_load() {
		const store = saveStore(); let raw = null;
		try { raw = JSON.parse( store?.getItem( LAND_SAVE_KEY ) || 'null' ); } catch { /* corrupted data falls back safely */ }
		return restoreLandSave( raw );
	}

	_save() {
		try { const storage=saveStore(); storage?.setItem( LAND_SAVE_KEY, JSON.stringify( this.progress ) );
			storage?.setItem(CORSAIR_SAVE_KEY,this.progress.corsairDefeated?'1':'0');
		} catch { /* private/incognito browser */ }
	}

	_message( message, seconds = 4 ) {
		this.notice = message;
		this.noticeTimer = seconds;
	}

	_companion( message ) {
		this._message( `✦ 小汐：${message}`, 6 );
	}

	_addEnemy( id, type, x, z, extra = {} ) {
		const model = type==='lurker'?createLurkerModel():type==='bear'?{group:new Group(),body:new Group(),claw:new Group(),ring:new Group(),limbs:[]}:createLandCreature(type);
        if(type==='bear')model.group.visible=false;
		const enemy = createLandEnemy( id, type, x, z, extra );
		enemy.model = model;
		model.group.position.set( x, this.app.terrainData.heightAt( x, z ), z );
		this.app.scene.add( model.group );
		this.enemies.push( enemy );
		if(type==='lurker'){enemy.bodyCollider=this.app.colliders.addCylinder(x,z,LURKER.radius,model.group.position.y,model.group.position.y+LURKER.height,{tag:'v83:lurker',solid:false});return enemy;}
		if ( typeof document !== 'undefined' ) {
          enemy.assetAttempts=0;enemy.retryAsset=()=>{enemy.assetAttempts++;enemy.assetState='loading';return (type==='bear'?loadBearActor():loadLandRig(type)).then( actor => {
			if(enemy.dead)return;if(!actor)throw Error('No actor returned');
			// Keep the procedural silhouette until the fully loaded animated body
			// and ground-contact correction are ready (no invisible boss on load).
			model.group.add( actor.rig.group );
			enemy.actor = actor;
			if(type==='bear'){enemy.bodyCollider=this.app.colliders.addCylinder(x,z,.68,model.group.position.y,model.group.position.y+1.75,{tag:'v73:bear-body',solid:false});}
            if(type!=='bear'){enemy.footPlant = new LandFootPlant(actor.rig,{clearance:.018});
			enemy.footPlant.update(0,{root:model.group.position});}
			model.body.visible = false;
			if(type==='corsair') {
				// V38 boss source uses a human rig; size was calibrated in the manifest.
				enemy.pirateStyle=attachPirateStyle(actor,0,{boss:true});
			}
			enemy.assetState='ready';
		} ).catch(error=>{enemy.assetState='failed';enemy.assetRetryAt=this.time+8;console.warn('Land actor failed',type,error);});};enemy.retryAsset();
        }
		return enemy;
	}

	_createHUD() {
		if ( typeof document === 'undefined' ) return;
		this.hud = document.createElement( 'section' );
		this.hud.className = 'land-v31-hud';
		this.hud.setAttribute( 'aria-label', 'Tidewater 陆地冒险日志' );
		this.hud.innerHTML = `<div class="land-v31-header"><span>✦ 陆地冒险 · 灯塔下的低语</span><span data-land-phase>平静期</span></div>
			<div class="land-v31-body"><div class="land-v31-task" data-land-task></div>
			<div class="land-v31-sub" data-land-distance></div>
			<div class="land-v31-vitals"><span>生命</span><div><i data-land-hp></i></div><b data-land-hp-label>100</b></div>
			<div class="land-v31-vitals"><span>体力</span><div><i class="land-v31-stamina" data-land-stamina></i></div><b data-land-stamina-label>100</b></div>
			<div class="land-v31-enemy" data-land-enemy></div>
            <div class="sw-land-boss-guide" data-land-boss-guide></div>
			<div class="land-v31-gear" data-land-gear>探索姿态</div>
			<div class="land-v66-weaponbar" data-land-weaponbar>${Object.entries(PERSONAL_WEAPONS).map(([id,w])=>`<button type="button" data-weapon="${id}" aria-label="装备${w.name}"><b>${w.key}</b> ${w.name}</button>`).join('')}</div><div class="land-v66-recovery"><i data-land-recovery></i></div><div class="land-v31-controls">1/2/3 武器 · Z 收起 · 左键/J 轻击 · K 重击 · Q 闪避 · 右键格挡 · V 视角 · E 交互 · P 任务</div></div>
			<div class="land-v31-message" data-land-message></div>`;
		document.body.appendChild( this.hud );
        this.hud.addEventListener('click',e=>{const slot=e.target.closest('[data-weapon]');if(slot)this.selectWeapon(slot.dataset.weapon);});
		this.ui = key => this.hud.querySelector( `[data-land-${key}]` );
	}

	_isPlayable() {
		return landActionContext( this.app ) === 'land' && controlContext(this.app)==='personal' && !this.app.input?.gameplayBlocked;
	}

	// Global listeners (photo mode and Xiaoxi's chat) must respect combat input.
	claimsGlobalKey( code ) {
		return this._isPlayable() && ( code === LAND_BINDINGS.journal || code === LAND_BINDINGS.stance ||
			( this.stance && [ LAND_BINDINGS.heavy, LAND_BINDINGS.light, LAND_BINDINGS.dodge ].includes( code ) ) );
	}

	// Evaluated BEFORE Player.update: an E press at a land object belongs to
	// the land interaction director, never the ship's generic boarding handler.
	wantsLandInteraction( point ) {
		if ( !point || this.app.player?.mode !== 'walk' || !canPersonal(this.app) ) return false;
		const near = ( pos, reach, vertical=3.25 ) =>
			Math.hypot( pos.x-point.x, pos.z-point.z ) < reach && Math.abs(pos.y-point.y) < vertical;
		if ( near(this.board.position,3.6) || near(this.shrine.position,3.55) ) return true;
		for (const m of this.mirrors) if(near(m.group.position,3.2)) return true;
		const t=this.tower.group.position;
		if(near({x:t.x,y:t.y+1.2,z:t.z+LIGHTHOUSE_V34.doorFront},3.4)) return true;
		if(this.regionWaypoints?.some(r=>near(r.group.position,3.4)))return true;
		if(this.deepSurvey&&this.progress.corsairDefeated&&near(this.deepSurvey.position,3.4,1.8))return true;
        if(this.expeditionCave?.sample&&near(this.expeditionCave.sample,3,1.8))return true;
        if(this.expeditionCave?.lift?.wants(point))return true;
        if(this.fossilSurvey?.wants(point)||this.artistSites?.wants(point)||this.sceneryV76?.wants(point))return true;
		return this.residents.residents.some(r=>r.model.group.visible && near(r.model.group.position,3));
	}

	_emitCombatAction( action, held = null ) {
		const direction = this.app.player.getViewDir( _view );
		const event = makeLandActionEvent( { actorId: 'local', sequence: ++this.combatSequence,
			tick: this.simulationTick, action, held, direction: [ direction.x, direction.y, direction.z ] } );
		this.combatEventLog.push( event );
		if ( this.combatEventLog.length > 96 ) this.combatEventLog.shift();
		// Optional replication adapter. The server will own validation, damage and rewards.
		this.onCombatAction?.( event );
		return event;
	}

	_emitWorldIntent( verb, targetId ) {
		const intent = makeLandWorldIntent( { actorId: 'local', sequence: ++this.combatSequence,
			tick: this.simulationTick, verb, targetId } );
		this.worldIntentLog.push( intent );
		if ( this.worldIntentLog.length > 96 ) this.worldIntentLog.shift();
		this.onWorldIntent?.( intent );
		return intent;
	}

    _combatPlayable(){return canPersonal(this.app);}
    selectWeapon(id){
        if(!PERSONAL_WEAPONS[id]||!this._combatPlayable())return false;
        // A swing keeps its own weapon and damage until contact ends; queue the
        // requested weapon instead of losing the key press during recovery.
        if(this.pendingStrike||this.attackCooldown>0){this.queuedWeapon=id;this._message('已排队：'+PERSONAL_WEAPONS[id].name,1.2);return true;}
        this.queuedWeapon=null;this.weaponId=id;
        this.app.voyageM1?.equipment?.equip?.('hands');
        if(!this.stance)this._toggleStance();
        this._message(PERSONAL_WEAPONS[id].name+' · '+PERSONAL_WEAPONS[id].description,1.5);return true;
    }
	_toggleStance() {
		if ( !this._combatPlayable() ) return;
		this.stance = !this.stance;
        if(this.stance)this.app.voyageM1?.equipment?.equip?.('hands');
        else {this.queuedWeapon=null;this.pendingStrike=null;this.attackTimer=0;}
		if ( this.stance && this.app.game?.rod ) {
			this.app.game.cancelLine( true );
			this.app.game.rod.equip( false );
		}
		this._message( this.stance ? `已装备${PERSONAL_WEAPONS[this.weaponId]?.name||'潮纹短刃'}：1/2/3 切换，左键/J 轻击，K 重击。` : '收起战斗武器，R 可恢复钓鱼。', 4 );
		this._emitCombatAction( 'equip' );
	}

	_dodge() {
		if ( !this.stance || this.stamina < 22 || this.dodgeTimer > 0 ) return false;
		const inp = this.app.input, p = this.app.player;
		p.getViewDir( _view ); _view.y = 0; _view.normalize();
		const right = new Vector3( -_view.z, 0, _view.x );
		const lateral = Number( inp.down( 'KeyD' ) ) - Number( inp.down( 'KeyA' ) );
		const forward = Number( inp.down( 'KeyW' ) ) - Number( inp.down( 'KeyS' ) );
		this.dodgeDir.copy( _view ).multiplyScalar( forward || ( lateral ? 0 : -1 ) ).addScaledVector( right, lateral ).normalize();
		this.dodgeTimer = .34;
		this.invulnerableTimer = .25;
		this.stamina -= 22;
		this._emitCombatAction( 'dodge' );
		return true;
	}

	_swing( heavy = false ) {
		const spec=personalStrike(this.weaponId,heavy);
        if(!this.servicesV77?.coop)spec.damage=forgedDamage(spec.damage,this.app.game?.state?.landForge?.[this.weaponId]||0);
        if ( !this.stance || !this._combatPlayable() || this.attackCooldown > 0 || this.dodgeTimer>0 || this.stamina < spec.cost ) return false;
        this.stamina -= spec.cost;this.attackTimer=spec.window;this.attackCooldown=spec.cooldown;this.attackCooldownTotal=spec.cooldown;
		this.attackArc.visible = true;
		this._emitCombatAction( heavy ? 'heavy' : 'light' );
		this._message(`${PERSONAL_WEAPONS[this.weaponId]?.name||'潮纹短刃'} · ${heavy?'重击':'轻击'}`, .65 );
		// Swept 3D blade window: a target crossing the weapon during the swing
		// can be contacted, but each creature may be hurt only once per swing.
		this.app.player.getViewDir(_view);_view.y=0;_view.normalize();
        this.pendingStrike = { heavy, age: 0, previousAge: 0, ...spec, weapon:this.weaponId||'cutlass', direction:_view.clone(),targetsHit: new Set() };
		return true;
	}

	_resolveStrikeContacts() {
		const swing = this.pendingStrike;
		if ( !strikeActive( swing ) || !this._combatPlayable() || !this.stance ) return;
        if(this.app.player.mode==='deck'){
            if(!swing.deckContact){swing.deckContact=true;const v=this.app.voyageM1,p=this.app.player;
                this.app.hunt?.bosses?.tryCutTentacle(this.app.camera.position,p.getViewDir(new Vector3()));
                if(v?.ghostLantern?.quest?.phase==='defend')v.ghostLantern.action('swing');
            }return;
        }
		const p = this.app.player;
		p.getViewDir( _view ); _view.y = 0; _view.normalize();if(swing.direction)_view.copy(swing.direction);
		let hit = 0;
		for ( const e of this.enemies ) {
			if ( swing.targetsHit.has( e.id ) || e.dead || (e.type==='lurker'&&!this._lurkerEnabled()) || (e.type==='bear'&&!e.actor) || (e.type==='corsair'&&!corsairAvailable(this.progress.stage,this.app)) || ( e.type === 'warden' && this.progress.stage < 3 ) ||
				!targetWithinStrike( { ...p.position, y: p.position.y + 1 },
					{ x: e.x, z: e.z, y: this.app.terrainData.heightAt( e.x, e.z ) + 1 }, swing.reach, 3 ) ) continue;
			if ( !sweptBladeContact( swing,
				{ x: p.position.x, y: p.position.y + 1, z: p.position.z }, _view,
				{ x: e.x, y: this.app.terrainData.heightAt( e.x, e.z ) + 1, z: e.z },
				e.type === 'warden' ? 1.0 : .72 ) ) continue;
			const savedSolid=e.bodyCollider?.solid;if(e.bodyCollider)e.bodyCollider.solid=false;
            const blocked = strikeLineBlocked( this.app.colliders,
				{ x: p.position.x, y: p.position.y + 1.2, z: p.position.z },
				{ x: e.x, y: this.app.terrainData.heightAt( e.x, e.z ) + 1.2, z: e.z } );if(e.bodyCollider)e.bodyCollider.solid=savedSolid;if(blocked)continue;
			swing.targetsHit.add( e.id );
			hit ++;
			const bonus=e.type==='corsair' && e.state==='recover' ? 1.35:1;
			const dead = landEnemyHit( e, swing.damage*bonus );
			if(!dead)e.lastAnimatedSerial=-1;
			this.combatFX.spawn( swing.heavy ? 'heavy' : 'light', {
				x: e.x, y: this.app.terrainData.heightAt( e.x, e.z ) + ( e.type === 'warden' ? 2.2 : 1.1 ), z: e.z,
			}, this.app.camera.quaternion );
			e.visualHurtTimer = .18;
			if ( dead ) {
                if(e.bodyCollider)e.bodyCollider.solid=false;
				e.deathVisualRemaining = e.actor?.actions.death ? e.actor.rig.clipDuration( e.actor.actions.death ) : 0;
				if ( e.actor?.actions.death ) playLandRigAction( e.actor, 'death', { oneShot: true, fade: .05 } );
				this._defeated( e );
			} else if ( e.actor?.actions.hit ) {
				playLandRigAction( e.actor, 'hit', { oneShot: true, fade: .05 } );
				e.reactionRemaining = e.actor.rig.clipDuration( e.actor.actions.hit );
			}
		}
		if(this.rex?.strike(swing,p.position,_view))hit++;
		if ( hit ) this._message( `⚔ ${ swing.heavy ? '重击' : '斩击' }命中 ${hit} 个目标`, 1.15 );
	}

	_defeated( e ) {
		this.progress.kills ++;
        if(e.type==='lurker'){this._save();this._reward(LURKER.reward,LURKER.receipt,'岩湖潜伏者已击败！首次奖励220金币。沿原干路返回。');return;}
        if(e.type==='bear'){this._save();this._reward(60,'land:v73:forest-bear','灰苔棕熊狩猎完成，首次奖励 60 金币。');return;}
		if ( e.type === 'corsair' ) {
			this.progress.corsairDefeated=true;(this.eastQuest??={}).completed=true;this._saveEast();
			this._save();
			this._companion('他刚才竟然绕过了你的正面！趁收招的间隙才能安全反击。');
            this._reward(180,'land:v37:corsair','荒潮掠影已击败！获得 180 金币，沉岩洞营地恢复安全。');
			return;
		}
		if ( e.type === 'warden' ) {
			this.progress.stage = 4;
			this._save();
			this._companion( '我们成功了！从灯塔可以看清更远的深海航路！' );
            this._reward( 250, 'land:v31:lighthouse', '灯塔守望者已击败！获得 250 金币，灯塔重新照亮海湾。' );
			this._syncQuestVisuals();
			return;
		}
		this._save();
		if ( this.progress.kills === 1 ) this._companion( '它们真的怕你的短刃！小心，它们攻击前会停下来蓄力。' );
	}

	_saveEast(){try{saveStore()?.setItem('stormwake:expedition:v70',JSON.stringify(this.eastQuest));}catch{}}
	_reward( money, id, message ) {
		const wallet=this.app.game?.state;
        const outbox=this.rewardOutbox??=new LandRewardOutbox(saveStore());
        const r=outbox.claim(wallet,money,id);
        if(r.status==='paid')this._message(message,7);
        else if(r.status==='already')this._message('目标已完成，首次奖励已领取。',5);
        else this._message(r.durable?'奖励暂未到账；已保存待发放记录，将自动重试。':'奖励暂未到账；请勿退出，当前会话会重试保存。',7);
        return r.status==='paid'||r.status==='already';
	}

	_interact() {
		if ( !this._isPlayable() ) return;
		const player = this.app.player, p = player.position;
		const director = this.interactions;
		director.beginFrame();
        this.artistSites?.register(director,player);
        this.sceneryV76?.register(director,player);
        this.ecologyV74?.register(director,player);
        this.fossilSurvey?.register(director,player);
        this.expeditionCave?.lift?.register(director,player,this);
        if(this.deepSurvey&&this.progress.corsairDefeated){const dp=this.deepSurvey.position;if(!strikeLineBlocked(this.app.colliders,{x:p.x,y:p.y+1.2,z:p.z},{x:dp.x,y:dp.y+1.2,z:dp.z},.85))director.add({id:'v78:deep-survey',position:dp,range:3.4,heightRange:1.8,priority:94,label:'深层岩心 · E 记录地下地层',perform:()=>{const wallet=this.app.game?.state,id='land:v78:deep-survey';if(wallet?.rewardReceipts?.includes(id))this._message('岩心已记录。从灯火引导的原路返回。',5);else this._reward(95,id,'地下岩心调查完成，获得95金币；沿灯火继续深入或返回洞口。');}},player);}
        const sample=this.expeditionCave?.sample;if(sample&&dist(p,sample)<3&&Math.abs(p.y-sample.y)<1.8&&!strikeLineBlocked(this.app.colliders,{x:p.x,y:p.y+1.35,z:p.z},{x:sample.x,y:sample.y+1.35,z:sample.z},.2)){director.add({id:'v80:mine-sample',position:sample,range:3,heightRange:1.8,priority:95,label:'废弃采掘站 · E 调查矿样',perform:()=>{const wallet=this.app.game?.state,id='land:v80:mine-sample';if(!this.progress.corsairDefeated||!wallet?.rewardReceipts?.includes('land:v78:deep-survey'))return this._message('先击败荒潮船长并调查深层岩心。',5);if(wallet.rewardReceipts.includes(id))return this._message('矿样已登记；沿木梁灯火返回。',5);this._reward(120,id,'矿样登记完成，获得120金币。西侧干路可原路返回。');}},player);}
        if(this.eastQuest.accepted&&!this.eastQuest.completed){
          const route=EXPEDITION_ROUTES[0];let index=Math.max(0,Math.min(route.length-1,this.eastQuest.index||0));
          if(dist(p,{x:route[index][0],z:route[index][1]})<18&&index<route.length-1){this.eastQuest.index=index+1;this._saveEast();}
        }
        const expeditionSite=this.regionWaypoints.find(r=>r.id==='eastroad')?.group.position??{x:90,z:-150,y:this.app.terrainData.heightAt(90,-150)};
        if(this.progress.stage>=1)director.add({id:'land:v70-expedition',position:expeditionSite,range:3.3,priority:86,
          label:this.eastQuest.completed||this.progress.corsairDefeated?'沉岩洞调查已完成 · E 查看':this.eastQuest.accepted?'东部远征 · E 查看路线':'东部远征 · E 接取调查任务',
          perform:()=>{if(this.eastQuest.completed||this.progress.corsairDefeated){this._message('沉岩洞已恢复安全；北部古道通往化石谷。',6);return;}this.eastQuest.accepted=true;this._saveEast();this._message('沿东部古道穿越峡谷，深入沉岩洞击败荒潮船长。日志显示路线距离。',7);}},player);

		// Reaching the structure unlocks the optical chapter irrespective of
		// whether the player looks at a mirror on that particular frame.
		if ( this.progress.stage === 1 && dist( p, LAND_SITES.lighthouse ) < 42 ) {
			this.progress.stage = 2;
			this._companion( '灯塔的聚光装置被封锁了，我们需要重新对准三面镜片。' );
			this._save();
		}
		director.add( {
			id: 'land:board', position: this.board.position, range: 3.6, priority: 85,
			label: '✦ 灯塔告示牌 · E 阅读 / 接取任务',
			perform: () => {
				this._emitWorldIntent( 'read-board', 'land:board' );
				if ( this.progress.stage === 0 ) {
					this.progress.stage = 1;
					this.app.companionActor?.command?.( 'follow' );
					this._companion( '远处的灯塔熄灭了……一起沿着发光石柱去看看吧！' );
					this._save(); this._syncQuestVisuals();
				} else this._message( '灯塔在西北密林；东部古道（90,-150）另有远征委托，通往沉岩洞。', 5 );
			},
		}, player );
		director.add( {
			id: 'land:shrine', position: this.shrine.position, range: 3.55, priority: 95,
			label: '◈ 潮蚀石碑 · E 解读铭文',
			perform: () => {
				this._emitWorldIntent( 'read-tablet', 'land:shrine' );
				if ( !this.progress.shrineFound ) {
					this.progress.shrineFound = true;
					this._save();
					this._reward( 30, 'land:v31:shrine', '发现隐蔽石碑：获得 30 金币。刻文记录了灯塔的三面反光镜。' );
					this._companion( '我看懂了！三面镜片要分别朝向后方、右方和左方。' );
				} else this._message( '石碑铭文：依次向后、右方、左方调整三个反光镜。', 5 );
			},
		}, player );
		for(const region of this.regionWaypoints){
			director.add({id:`land:district-${region.id}`,position:region.group.position,range:3.1,priority:62,
				label:`◈ ${region.name} · E 调查路牌`,perform:()=>this._message(region.note,7)},player);
		}
		director.add( {
			id: 'land:lighthouse-door',
			position: new Vector3( this.tower.group.position.x, this.tower.group.position.y + 1.2,
				this.tower.group.position.z + LIGHTHOUSE_V34.doorFront ),
			range: 3.4, heightRange: 3.25, priority: 125,
			label: this.tower.doorOpen ? '⌂ 灯塔入口 · E 关闭厚木门' : '⌂ 灯塔入口 · E 打开厚木门',
			perform: () => {
				if ( this.tower.doorOpen && dist( p,
					{ x: this.tower.group.position.x, z: this.tower.group.position.z + LIGHTHOUSE_V34.doorFront } ) < 1.85 ) {
					this._message( '门道有人，无法安全关门。请先退后再操作。', 3 );
					return;
				}
				this.tower.doorOpen = !this.tower.doorOpen;
				this._emitWorldIntent( this.tower.doorOpen ? 'open-door' : 'close-door', 'land:lighthouse-door' );
				this._message( this.tower.doorOpen ? '⚙ 厚重铜铰链转动。灯塔的螺旋阶梯已经可以进入。' :
					'⚙ 已关闭灯塔入口。', 3.5 );
			},
		}, player );
		for ( let i = 0; i < this.mirrors.length; i ++ ) {
			const pos = this.mirrors[ i ].group.position;
			const locked = this.progress.stage !== 2;
			const hint = this.progress.stage === 0 ? '先从村庄告示牌接取任务' :
				this.progress.stage === 1 ? '先靠近灯塔调查供电装置' : '光路已锁定';
			director.add( {
				id: `land:mirror-${i}`, position: pos, range: 3.2, priority: 110,
				label: locked ? `◈ 第 ${i + 1} 面反光镜 · E 查看（${hint}）` :
					`◈ 第 ${i + 1} 面反光镜 · E 旋转 · ${this.progress.mirrors[ i ] === MIRROR_GOALS[ i ] ? '已对准' : '未对准'}`,
				perform: () => {
					if ( this.progress.stage !== 2 ) { this._message( hint, 3.5 ); return; }
				this._emitWorldIntent( 'turn-mirror', `land:mirror-${i}` );
				const aligned = rotateMirror( this.progress.mirrors, i );
				this.mirrors[ i ].lens.rotation.y = this.progress.mirrors[ i ] * Math.PI / 2;
				const ally = this.app.companionActor;
				if ( i === 1 && !this.companionAidUsed && ally && dist( ally.group.position, pos ) < 6 ) {
					this.companionAidUsed = true;
					this.progress.mirrors[ i ] = MIRROR_GOALS[ i ];
					this.mirrors[ i ].lens.rotation.y = Math.PI * .5;
					this._companion( '我来帮你固定第二面镜片！现在光路应该通畅了。' );
				} else this._message( this.progress.mirrors[ i ] === MIRROR_GOALS[ i ] ? '✓ 镜片已对准青色光路。' : '镜片正在转动……继续按 E 调整方向。', 2.6 );
				this.mirrorRays[ i ].visible = this.progress.mirrors[ i ] === MIRROR_GOALS[ i ];
				if ( aligned || allMirrorsAligned( this.progress.mirrors ) ) this._unlockWarden();
				this._save();
				},
			}, player );
		}
	}

	_unlockWarden() {
		if ( this.progress.stage !== 2 ) return;
		this.progress.stage = 3;
		this._save(); this._syncQuestVisuals();
		this._message( '⚠ 三面反光镜已校准！地面正在震动——灯塔守望者苏醒了。', 7 );
	}

	_syncQuestVisuals() {
		const finished = this.progress.stage === 4;
		// V58: a solid cyan sphere is not volumetric light. Keep the actual beacon/lamp,
		// but never show the oversized placeholder globe in the forest view.
		this.tower.beaconGlow.visible = false;
		if ( this.lighthouseLight ) this.lighthouseLight.enabled = finished;
		for ( let i = 0; i < this.mirrors.length; i ++ ) this.mirrors[ i ].lens.rotation.y = this.progress.mirrors[ i ] * Math.PI / 2;
		for ( let i = 0; i < this.mirrorRays.length; i ++ ) this.mirrorRays[ i ].visible =
			this.progress.mirrors[ i ] === MIRROR_GOALS[ i ];
		for ( const e of this.enemies ) if ( e.type === 'warden' ) {
			e.dead = finished;
			e.model.group.visible = ( !finished && this.progress.stage >= 3 ) || e.deathVisualRemaining > 0;
		}
	}

	_startRaid( day ) {
		if ( this.raidActive || this.progress.lastRaidDay >= day ) return;
		this.raidActive = true;
		this.raidTimer = 105;
		this.progress.lastRaidDay = day;
		this._save();
		this._addEnemy( `raid-${day}-a`, 'crab', 17, -68, { raid: true } );
		this._addEnemy( `raid-${day}-b`, 'hound', -8, -81, { raid: true } );
		this._addEnemy( `raid-${day}-c`, 'crab', 89, -77, { raid: true } );
		this._message( '⚠ 港口警钟：潮蚀生物正在登陆！105 秒内消灭三只入侵者。', 8 );
	}

	_updateRaid( dt ) {
		if ( !this.raidActive ) return;
		const remaining = this.enemies.filter( e => e.raid && !e.dead );
		this.raidTimer = Math.max( 0, this.raidTimer - dt );
		if ( remaining.length === 0 ) {
			this.raidActive = false;
			const day = this.progress.lastRaidDay;
			this._reward( 75, `land:v31:raid:${day}`, '✓ 港口守卫成功！获得 75 金币和海风镇居民的感谢。' );
		} else if ( this.raidTimer <= 0 ) {
			this.raidActive = false;
			this._message( '港口入侵事件结束。下一天还可以再次防守。', 5 );
		}
		if ( !this.raidActive ) {
			for ( const e of this.enemies.filter( e => e.raid ) ) this.app.scene.remove( e.model.group );
			this.enemies = this.enemies.filter( e => !e.raid );
		}
	}

    _lurkerEnabled(){return lurkerEnabled(this.app.game?.state,!!(this.app.crew?.connected||this.app.voyageM1?.net?.connected||this.servicesV77?.coop),this.rewardOutbox?.pending);}
	_updateEnemy( e, dt, interactive, phase ) {
		const p = this.app.player.position;
		const d = dist( p, e );
        const visibleDistance=landDistance(landObserver(this.app),e);
        if(e.bodyCollider)e.bodyCollider.solid=false;
        if(e.type==='lurker'&&!this._lurkerEnabled()){e.model.group.visible=false;e.state='idle';e.collisionArmed=false;return;}
        if(e.type==='bear'&&!e.actor){e.model.group.visible=false;if(e.assetState==='failed'&&e.assetAttempts<3&&visibleDistance<150&&this.time>=e.assetRetryAt)e.retryAsset?.();return;}
		if ( e.type === 'warden' && this.progress.stage < 3 ) { e.model.group.visible = false; return; }
		if ( e.dead ) {
			if ( e.deathVisualRemaining > 0 && e.actor ) {
				e.deathVisualRemaining = Math.max( 0, e.deathVisualRemaining - dt );
				e.model.group.visible = e.deathVisualRemaining > 0;
				e.actor.rig.update( dt );
			} else e.model.group.visible = false;
			return;
		}
		const enabled = (e.type !== 'corsair' || corsairAvailable(this.progress.stage,this.app)) &&
			( e.type !== 'wraith' || phase === 'invasion' || this.progress.stage >= 2 ) &&
			( !e.raid || this.raidActive );
		const visible = enabled && Math.min(d,visibleDistance) < 130;
		e.model.group.visible = visible;
		if ( !visible ) return;
		// A spectral sailor only retreats when the existing flashlight actually
		// points toward it at close range, not merely because L is switched on.
		let bright = false;
		if ( this.app.localLights?.flashlight?.on && d < 19 ) {
			this.app.player.getViewDir( _view ); _view.y = 0; _view.normalize();
			_tmp.set( e.x - p.x, 0, e.z - p.z ).normalize();
			bright = _view.dot( _tmp ) > .72;
		}
		const result = advanceLandEnemy( e, p, dt, { active: interactive && d < 66 && (e.type!=='lurker'||Math.abs(p.y-this.app.terrainData.heightAt(e.x,e.z))<2.0), illuminated: bright } );
		if ( e.actor ) {
			e.reactionRemaining = Math.max( 0, ( e.reactionRemaining || 0 ) - dt );
			if ( e.state==='telegraph' && e.actor.actions.attack && e.lastAnimatedSerial !== e.attackSerial+1 ) {
                e.lastAnimatedSerial=e.attackSerial+1;
                const action=e.type==='corsair'&&['lunge','whirl'].includes(e.attackStyle) && e.actor.actions.heavy ? 'heavy' :
                    e.type==='corsair'&&e.attackStyle==='feint'&&e.actor.actions.dodge ? 'dodge' : 'attack';
                const clip=e.actor.actions[action],duration=e.actor.rig.clipDuration(clip);
                // Align an authored strike to the AI contact window; exact contact
                // marker is an estimate until the asset's animation is reviewed visually.
                const speed=e.type==='bear'?1:clamp(duration*.55/Math.max(.08,e.timer),.35,3);
                e.actor.rig.play(clip,{fade:.08,loop:false,speed});
                e.reactionRemaining=duration/speed;
            } else if ( e.reactionRemaining <= 0 ) {if(e.type==='bear'){const key=result.moving?(e.bearSpeed>2?'run':'walk'):'idle',clip=e.actor.actions[key],rate=key==='walk'?Math.max(.25,e.bearSpeed/1.24):key==='run'?Math.max(.25,e.bearSpeed/5.81):1;if(e.actor.rig.current!==clip)e.actor.rig.play(clip,{fade:.18,speed:rate});else{const layer=e.actor.rig.layers.find(l=>l.clip.name===clip&&l.target>0);if(layer)layer.speed=rate;}}else playLandRigAction(e.actor,result.moving?'run':'idle');}
			// Real ghost rig floats on its own axis; keep the collision capsule
			// ground-relative so it still takes hits and cannot phase through walls.
			if ( e.type === 'wraith' ) e.actor.rig.group.position.y = .18 + Math.sin( this.time * 2.35 + e.x ) * .16;
			e.actor.rig.update( dt );
            if(e.type==='bear'&&result.strike){const l=e.actor.rig.layers.find(l=>l.clip.name===e.actor.actions.attack&&l.target>0);if(l){l.time=BEAR_CONTACT;e.actor.rig.update(0);}}
			if(e.footPlant) e.footPlant.update(dt,{moving:result.moving,
				root:e.model.group.position,yaw:e.yaw,
				groundProbe:(x,z,y)=>groundSurface(this.app.terrainData,this.app.colliders,x,z,y)});
			e.pirateStyle?.update();
		}
		if ( result.moving ) {
			const oldPos={x:e.x,y:this.app.terrainData.heightAt(e.x,e.z),z:e.z};
			const tx = e.x + e.vx * dt, tz = e.z + e.vz * dt;
			const height = this.app.terrainData.heightAt( e.x, e.z );
			const nextHeight = this.app.terrainData.heightAt( tx, tz );
			// No teleport through vertical cliff faces. Slide on each axis when needed.
			if ( Math.abs( nextHeight - height ) < .60 ) { e.x = tx; e.z = tz; }
			else if ( Math.abs( this.app.terrainData.heightAt( tx, e.z ) - height ) < .40 ) e.x = tx;
			else if ( Math.abs( this.app.terrainData.heightAt( e.x, tz ) - height ) < .40 ) e.z = tz;
			if ( this.app.colliders?.resolveCapsule ) {
				_tmp.set( e.x, this.app.terrainData.heightAt( e.x, e.z ), e.z );
				if(e.type==='bear')for(const world of this.app.colliders.triangleWorlds||[]){const moved=world.move(oldPos,_tmp,{radius:.65,height:1.8,step:.3});_tmp.set(moved.x,moved.y,moved.z);}
                if(e.type==='corsair'&&this.expeditionCave?.world){const moved=this.expeditionCave.world.move(oldPos,_tmp,{radius:1,height:2.4,step:.2});_tmp.set(moved.x??moved.position?.x??_tmp.x,moved.y??moved.position?.y??_tmp.y,moved.z??moved.position?.z??_tmp.z);}
				this.app.colliders.resolveCapsule( _tmp, e.type === 'warden' || e.type === 'corsair' ? 1.0 : e.type==='bear'?.75:.42, 2.4, .20 );
				e.x = _tmp.x; e.z = _tmp.z;
			}
		}
		const model = e.model, t = this.time;
		e.hitEffectClock = Math.max( 0, ( e.hitEffectClock || 0 ) - dt );
		e.visualHurtTimer = Math.max( 0, ( e.visualHurtTimer || 0 ) - dt );
		if ( result.strike ) e.hitEffectClock = result.style === 'shockwave' ? .52 : .22;
		model.group.position.set( e.x, this.app.terrainData.heightAt( e.x, e.z ), e.z );
		model.group.rotation.y = e.yaw;
		model.body.position.y = ( result.moving ? .08 : .03 ) * Math.sin( t * ( result.moving ? 12 : 3 ) + e.x );
		model.body.rotation.x = e.state === 'telegraph' ? -.17 : Math.sin( t * 2.2 + e.z ) * .018;
		model.claw.rotation.x = e.state === 'telegraph' ? -.65 : e.state === 'recover' ? .66 : .04;
		for ( let j = 0; j < model.limbs.length; j ++ ) model.limbs[ j ].rotation.x =
			Math.sin( t * ( result.moving ? 10 : 2 ) + j * Math.PI ) * ( result.moving ? .34 : .07 );
		model.ring.visible = e.state === 'telegraph' || e.hitEffectClock > 0 || e.visualHurtTimer > 0;
		if ( model.ring.visible ) {
			const s = e.visualHurtTimer > 0 ? 1 + ( .18 - e.visualHurtTimer ) * 5 : e.hitEffectClock > 0 ? 1 + ( 1 - e.hitEffectClock / ( e.attackStyle === 'shockwave' ? .52 : .22 ) ) * 1.5 :
				( e.attackStyle === 'shockwave' ? 1.45 : e.attackStyle === 'rush' ? .75 : 1 ) * ( 1 + .13 * Math.sin( t * 18 ) );
			model.ring.scale.set( s, s, s );
		}

        if(e.type==='lurker')poseLurker(e,t);
		if ( result.strike && (e.type!=='lurker'||lurkerFacing(e,p)) && e.lastDamageSerial !== e.attackSerial && (e.type!=='corsair'||corsairAttackFacing(e,p)) && (e.type!=='bear'||(bearFacing(e,p)&&bearContact(e.actor.rig,p))) &&
			!strikeLineBlocked(this.app.colliders,{x:e.x,y:model.group.position.y+1.2,z:e.z},
				{x:p.x,y:p.y+1.2,z:p.z}) &&
			targetWithinStrike( { x: e.x, z: e.z, y: model.group.position.y },
			{ x: p.x, z: p.z, y: p.y }, result.range, 2.8 ) ) {
			e.lastDamageSerial=e.attackSerial; this._takeDamage(result.damage);
		}
        if(e.bodyCollider){const c=e.bodyCollider;c.x=e.x;c.z=e.z;c.yMin=model.group.position.y;c.yMax=c.yMin+(e.type==='lurker'?LURKER.height:1.75);if(e.type==='lurker'){if(!e.collisionArmed&&d>=LURKER.radius+.40)e.collisionArmed=true;c.solid=!!e.collisionArmed;}else c.solid=true;}
	}

	_takeDamage( amount ) {
		if ( this.invulnerableTimer > 0 || this.dodgeTimer > 0 ) return false;
		if ( this.stance && this.app.input.rightDown && this.stamina >= 11 ) {
			this.stamina -= 11;
			amount = Math.ceil( amount * .24 );
			this._message( '🛡 格挡成功，伤害大幅降低。', 1.3 );
			this.combatFX.spawn( 'block', { x: this.app.player.position.x,
				y: this.app.player.position.y + 1.18, z: this.app.player.position.z }, this.app.camera.quaternion );
		}
		else this.combatFX.spawn( 'hurt', { x: this.app.player.position.x,
			y: this.app.player.position.y + 1.16, z: this.app.player.position.z }, this.app.camera.quaternion );
		this.hp = Math.max( 0, this.hp - amount );
        // Close the service before capturing the death/respawn input state.
        if(this.servicesV77?.active){const previous=this.servicesV77.savedEnabled;this.servicesV77.close();this.app.input.enabled=previous;}
		this.hurtTimer = .35;
		this.battleTimer = 7;
		this.invulnerableTimer = .52;
		if(this.hp===0&&!this.deathTimer){this.deathTimer=2.2;this.deathInput=this.app.input.enabled;this.app.input.enabled=false;this.pendingStrike=null;this.app.player.velocity.set(0,0,0);const v=this.app.voyageM1;if(v?.cargo.heldBy.has(v.actorId)){if(v.net.connected)v.net.send('cargo_event',{verb:'drop',...this.app.player.position});else{v.cargo.tryDrop(v.actorId,this.app.player.position);v._persistCargo();}}this._message('你倒下了，船员正前来救援；携带货物留在倒下的位置。',3);}
		return true;
	}

	_respawn() {
		const p = this.app.player;
		p.mode = 'walk';
		p.position.copy( WORLD.start.position );
		p.position.y = p.groundAt( p.position.x, p.position.z, 30 );
		p.velocity.set( 0, 0, 0 );
		this.hp = 100; this.stamina = 100; this.stance = false;
		this.rex?.reset();
		this.invulnerableTimer = 3;
		for ( const e of this.enemies ) if ( !e.dead ) {
			e.x = e.homeX; e.z = e.homeZ; e.state = 'idle'; e.cooldown = 1;if(e.type==='lurker'){e.hp=e.maxHp;e.collisionArmed=false;}
		}
		this._message( '你被小汐救回了海风镇。灯塔机关和已有探险进度不会丢失。', 7 );
	}

	_updateFauna( dt, player, phase ) {
		for ( const a of this.animals ) {
			const d = dist( a, player ), near = Math.min(d,landDistance(landObserver(this.app),a)) < 74;
			a.model.group.visible = near;
			if ( !near || d>=74 ) continue;
			a.t += dt;
			if ( d < 9 || phase === 'invasion' || phase === 'warning' ) a.panic = Math.max( a.panic, phase === 'calm' ? 5 : 1 );
			a.panic = Math.max( 0, a.panic - dt );
			if ( a.panic > 0 ) {
				const desired=Math.atan2(a.x-player.x,a.z-player.z),delta=Math.atan2(Math.sin(desired-a.angle),Math.cos(desired-a.angle));
				a.angle+=clamp(delta,-2.8*dt,2.8*dt);
				a.speed+=clamp(3.8-a.speed,-3*dt,2.6*dt);
			} else {
				a.angle += Math.sin( a.t * .28 + a.seed ) * dt * .30;
				const desired=Math.sin(a.t*.45+a.seed)>.25?.46:0; a.speed+=clamp(desired-a.speed,-1.9*dt,1.2*dt);
		}
			const nx = a.x + Math.sin( a.angle ) * a.speed * dt;
			const nz = a.z + Math.cos( a.angle ) * a.speed * dt;
			const ground = this.app.terrainData.heightAt( a.x, a.z );
			if ( Math.hypot( nx - a.homeX, nz - a.homeZ ) < 34 &&
				Math.abs( this.app.terrainData.heightAt( nx, nz ) - ground ) < .26 ) {
				const actual = _tmp.set( nx, this.app.terrainData.heightAt( nx, nz ), nz );
				this.app.colliders?.resolveCapsule?.( actual, a.kind === 'deer' ? .4 : .30,
					a.kind === 'deer' ? 1.8 : 1.1, .24 );
				if ( Math.hypot( actual.x - nx, actual.z - nz ) < .14 ) {
					a.x = actual.x; a.z = actual.z;
				} else {
					// Turn away from the physical obstacle instead of sliding the animal
					// sideways through a fence and resuming the same doomed direction.
					a.angle += ( a.seed % 2 > 0 ? 1 : -1 ) * 2.8 * dt;
					a.speed = Math.min( a.speed, 1.6 );
				}
			}
			a.model.group.position.set( a.x, this.app.terrainData.heightAt( a.x, a.z ), a.z );
			a.model.group.rotation.y = a.angle;
			if ( a.actor ) {
				// Natural action rotation: alert ears, walk, fast escape, forage.
				// Every pose comes from its authored glTF clip if available.
				const mood = a.speed > 2 ? 'run' : a.speed > .25 ? 'walk' :
					Math.sin( a.t * .31 + a.seed ) > .15 ? 'graze' :
					Math.sin( a.t * .21 - a.seed ) > .72 ? 'alert' : 'idle';
				playLandRigAction( a.actor, mood, { fade: .36 } );
				a.actor.rig.update( dt );
			}
			const gallop = a.speed > 2.0, moving = a.speed > .1;
			const cycle = a.t * ( gallop ? 12.4 : 6.1 ) + a.seed;
			a.model.body.position.y = moving ? Math.abs( Math.sin( cycle ) ) * ( gallop ? .075 : .025 ) : 0;
			a.model.body.rotation.x = Math.sin( cycle ) * ( gallop ? .034 : .014 );
			a.model.tail.rotation.y = Math.sin( a.t * 3.2 + a.seed ) * .23;
			for ( let j = 0; j < a.model.legs.length; j ++ ) {
				const diagonal = ( j === 0 || j === 3 ) ? 0 : Math.PI;
				a.model.legs[ j ].rotation.x = Math.sin( cycle + diagonal ) * ( moving ? ( gallop ? .44 : .24 ) : .018 );
			}
		}
	}

	_updateHUD( active, phase ) {
		if ( !this.hud ) return;
		this.hud.style.display = active ? '' : 'none';
		if ( !active ) return;
        const scout=!!this.app.freeCam;this.hud.classList.toggle('sw-land-scout',scout);
        const guide=this.ui('boss-guide');if(guide){const label=(scout?'自由视角侦察 · F 返回步行':'陆地首领 · 方位北0°')+'\n'+bossGuide(this).map(b=>b.name+' · '+b.distance+'m / '+b.bearing+'° · '+b.status).join('\n');if(guide.textContent!==label)guide.textContent=label;}
        if(scout)return;
		const p = this.app.player.position, stage = this.progress.stage;
		const tasks = [ '前往海风镇告示板，与小汐展开灯塔调查',
			'沿翡翠密林的荧光石柱寻找断崖灯塔',
			`校准三面反光镜：${this.progress.mirrors.filter( ( a, i ) => a === MIRROR_GOALS[ i ] ).length}/3`,
			'灯塔守望者苏醒！拔刀战斗，观察红色蓄力环并闪避',
			'✓ 灯塔已修复，海湾安全航路已经恢复' ];
		const target = stage === 0 ? LAND_SITES.board : stage === 1 ?
			{ x: LAND_SITES.trail[ this.trailIndex ][ 0 ], z: LAND_SITES.trail[ this.trailIndex ][ 1 ] } :
			stage === 2 ? this.mirrors.reduce( ( best, m, i ) => this.progress.mirrors[ i ] === MIRROR_GOALS[ i ] ? best :
				( !best || dist( p, m.group.position ) < dist( p, best ) ? m.group.position : best ), null ) : LAND_SITES.lighthouse;
		const direction = target ? _tmp.set( target.x - p.x, 0, target.z - p.z ).normalize() : _tmp.set( 0, 0, 1 );
		this.app.player.getViewDir( _view ); _view.y = 0; _view.normalize();
		const side = direction.x * -_view.z + direction.z * _view.x;
		const facing = _view.x * direction.x + _view.z * direction.z;
		const marker = facing < -.35 ? '↶ 后方' : side > .28 ? '↗ 右前方' : side < -.28 ? '↖ 左前方' : '↑ 正前方';
		this.ui( 'task' ).textContent = tasks[ stage ];
        const eastActive=this.eastQuest.accepted&&!this.eastQuest.completed&&!this.progress.corsairDefeated;
        if(eastActive)this.ui('task').textContent='东部远征 · 沉岩洞：深入山体，调查荒潮船长';
		this.ui( 'distance' ).textContent = this.raidActive ? `⚠ 港口防御剩余 ${Math.ceil(this.raidTimer)} 秒 · 尚有 ${this.enemies.filter(e=>e.raid&&!e.dead).length} 个入侵者` :
			`${marker} ${ target ? Math.round( dist( p, target ) ) : 0 } m · ${stage === 1 ? `第 ${this.trailIndex} 个路标` : `击败敌人 ${this.progress.kills}`}`;
		if(eastActive){const r=EXPEDITION_ROUTES[0],i=Math.min(r.length-1,this.eastQuest.index||0),point=i===r.length-1?CORSAIR.arena:{x:r[i][0],z:r[i][1]};const angle=Math.atan2(point.x-p.x,point.z-p.z);this.ui('distance').textContent=`东部远征：${Math.round(dist(p,point))}m · 路段 ${i+1}/${r.length} · 方位 ${Math.round((angle*180/Math.PI+180+360)%360)}°（北0°）`; }
		if ( !this.progress.corsairDefeated && dist(p,CORSAIR.arena) < 75 )
			this.ui('distance').textContent += ' · 支线：沉岩洞 · 荒潮船长';
		const survey=this.fossilSurvey?.journal(p)||this.rex?.journal(p);if(survey&&!this.raidActive&&!eastActive){this.ui('task').textContent=survey.task;this.ui('distance').textContent=`距目标 ${survey.distance} m · 沿北部古道行进`;}
		this.ui( 'phase' ).textContent = { calm: '☀ 平静期', warning: '◈ 潮蚀预警', invasion: '☂ 风暴侵袭', 'guarded-night': '✦ 灯塔守夜' }[ phase ];
		this.ui( 'hp' ).style.width = `${this.hp}%`;
		this.ui( 'stamina' ).style.width = `${this.stamina}%`;
		this.ui( 'hp-label' ).textContent = `${Math.ceil(this.hp)}`;
		this.ui( 'stamina-label' ).textContent = `${Math.ceil(this.stamina)}`;
		const w=PERSONAL_WEAPONS[this.weaponId]||PERSONAL_WEAPONS.cutlass;this.ui('gear').textContent=this.stance?`${w.name}${!this.servicesV77?.coop&&this.servicesV77?.level(this.weaponId)?" +"+this.servicesV77.level(this.weaponId):""} · ${w.description} · ${this.attackCooldown>0?'恢复 '+this.attackCooldown.toFixed(1)+'s':'就绪'}`:'探索 · 1/2/3 直接拔出武器 · R 钓鱼';
        const bar=this.ui('weaponbar');if(bar?.children)for(const slot of bar.children){slot.classList.toggle('selected',this.stance&&slot.dataset.weapon===this.weaponId);slot.classList.toggle('queued',slot.dataset.weapon===this.queuedWeapon);slot.setAttribute('aria-pressed',String(this.stance&&slot.dataset.weapon===this.weaponId));}const rec=this.ui('recovery');if(rec)rec.style.width=`${this.attackCooldown>0?100*(1-this.attackCooldown/(this.attackCooldownTotal||1)):100}%`;
		const near = this.enemies.filter( e => !e.dead && e.model.group.visible && dist( p, e ) < 18 )
			.sort( ( a, b ) => dist( p, a ) - dist( p, b ) )[ 0 ];
		if(this._lurkerEnabled()&&dist(p,LURKER)<42&&!eastActive&&!this.raidActive){this.ui('task').textContent='岩湖潜伏者：沿蓝色地面箭头进入西侧干燥巢穴';this.ui('distance').textContent=`距离巢穴 ${Math.round(dist(p,LURKER))}m · 返程沿原路绕开木柱`; }
		const bossAttack = { sweep:'横扫', pulse:'岩湖震荡', shockwave:'震荡波', rush:'冲锋', claw:'爪击',
			cutlass:'潮纹快斩', lunge:'前冲刺击', whirl:'旋风斩', feint:'虚晃突刺' };
		this.ui( 'enemy' ).textContent = near ? `⚠ ${LAND_SPECIES[ near.type ].name} · HP ${Math.ceil(near.hp)}/${near.maxHp}${near.type==='corsair'?` · 第${near.phase||1}阶段`:''} · ${near.state==='telegraph'?`蓄力：${bossAttack[near.attackStyle]||'危险攻击'}！`:near.state==='recover'?'收招破绽：可以反击':'保持距离'}` : '';
		const rexHUD=this.rex?.hud(p);if(rexHUD)this.ui('enemy').textContent=rexHUD;
		this.ui( 'message' ).textContent = this.noticeTimer > 0 ? this.notice : '';
		this.hud.classList.toggle( 'land-v31-hit', this.hurtTimer > 0 );
		this.hud.classList.toggle( 'land-v31-collapsed', !this.journalExpanded );
	}

	update( dt ) {
		dt = clamp( Number.isFinite( dt ) ? dt : 0, 0, .05 );
		const app = this.app, input = app.input;
		this.time += dt;
        this.rewardRetryClock=(this.rewardRetryClock||0)+dt;
        if(this.rewardOutbox?.pending.size&&this.rewardRetryClock>=2){this.rewardRetryClock=0;const paid=this.rewardOutbox.retry(this.app.game?.state);if(paid.length)this._message(`补发远征奖励：${paid.reduce((n,r)=>n+r.amount,0)} 金币。`,6);}
		this.simulationTick ++;if(this.deathTimer>0){this.deathTimer=Math.max(0,this.deathTimer-dt);if(this.deathTimer===0){this._respawn();this.app.input.enabled=this.deathInput!==false;}}
		this.noticeTimer = Math.max( 0, this.noticeTimer - dt );
		this.attackCooldown = Math.max( 0, this.attackCooldown - dt );
		this.attackTimer = Math.max( 0, this.attackTimer - dt );
		if ( this.pendingStrike ) {
			this.pendingStrike.previousAge = this.pendingStrike.age;
			this.pendingStrike.age += dt;
			if ( this.pendingStrike.age > this.pendingStrike.window ) this.pendingStrike = null;
		}
		this.invulnerableTimer = Math.max( 0, this.invulnerableTimer - dt );
		this.dodgeTimer = Math.max( 0, this.dodgeTimer - dt );
		this.hurtTimer = Math.max( 0, this.hurtTimer - dt );
		this.battleTimer = Math.max( 0, this.battleTimer - dt );
		const active = !app.player.foreignShip && this._isPlayable();
        const combatActive=this._combatPlayable();
        // A previous frame's candidates must not survive a carry, modal or other context change.
        if(!active||!combatActive)this.interactions.beginFrame();
        const preserveStance=controlContext(app)==='personal';
        if(this.queuedWeapon&&combatActive&&!this.pendingStrike&&this.attackCooldown<=0)this.selectWeapon(this.queuedWeapon);
		const phase = landPhase( app.settings.timeOfDay, this.progress.stage === 4 );
		if ( this.lastPhase !== phase ) {
			if ( this.lastPhase && phase === 'warning' && active ) this._message( '◈ 潮汐变得异常，海鸟惊飞，夜间请留意海滩。', 5 );
			this.lastPhase = phase;
		}
		const day = app.homeLife?.saveState?.day || 1;
		if ( phase === 'invasion' && active && this.progress.kills > 0 && this.progress.stage > 0 &&
			this.progress.lastRaidDay < day && !this.raidActive &&
			dist( app.player.position, LAND_SITES.board ) < 125 ) this._startRaid( day );
		if ( this.raidActive && active ) this._updateRaid( dt );
		if ( combatActive ) {
			const action = landInputEdges( input, this.stance, this.leftPrev );
			if ( active && input.consume( 'KeyV' ) ) this._message( this.avatar.toggle() === 'third' ?
				'第三人称模式：可观察船长角色和战斗动画。' : '第一人称模式：进入近身攻击视角。', 3.5 );
			if ( action.toggle ) this._toggleStance();
            const selected=personalSelection(input);if(selected)this.selectWeapon(selected);
			if ( this.stance && input.rightDown !== this.rightPrev ) this._emitCombatAction( 'guard', input.rightDown );
			if ( action.journal && !app.voyageM1 ) this.journalExpanded = !this.journalExpanded;
			if ( action.dodge ) this._dodge();
			if ( action.heavy ) this._swing( true ); else if ( action.light ) this._swing( false );
			if(active)this._interact();
			if ( active && this.progress.stage === 1 && this.trailIndex < LAND_SITES.trail.length - 1 &&
				dist( app.player.position, { x: LAND_SITES.trail[ this.trailIndex ][ 0 ], z: LAND_SITES.trail[ this.trailIndex ][ 1 ] } ) < 16 ) {
				this.trailIndex ++;
				if ( this.trailIndex === 3 ) {
					this._reward( 40, 'land:v31:forest-cache', '✦ 发现密林旅行者留下的补给箱：获得 40 金币。' );
					this._companion( '这里有人来过！光石沿着山脊通往灯塔。' );
				}
			}
			if ( this.stance ) this.stamina = Math.min( 100, this.stamina + dt * ( this.attackCooldown ? 11 : 19 ) );
			else this.stamina = Math.min( 100, this.stamina + dt * 23 );
			if ( this.hp>0 && this.battleTimer <= 0 ) this.hp = Math.min( 100, this.hp + dt * ( dist( app.player.position, LAND_SITES.board ) < 65 ? 7 : 1.4 ) );
		} else if(preserveStance){this.pendingStrike=null;this.attackTimer=0;}else if(!preserveStance){this.stance=false;this.queuedWeapon=null;this.pendingStrike=null;this.attackTimer=0;}
		this.leftPrev = input.mouseDown;
		this.rightPrev = input.rightDown;
		const player = app.player?.position || LAND_SITES.board;
		for ( const enemy of this.enemies ) this._updateEnemy( enemy, dt, active, phase );
		this.rex?.update(dt,active);
        this.artistSites?.update(dt);
        this.ecologyV74?.update(dt);
        this.rockV75?.update();
        this.sceneryV76?.update();
        this.servicesV77?.update();
		if ( this.pendingStrike && combatActive ) this._resolveStrikeContacts();
		this._updateFauna( dt, player, phase );
		const conversation = this.residents.update( dt, {
			raid: this.raidActive, missionComplete: this.progress.stage === 4,
			interactions: active && combatActive ? this.interactions : null,
			onConversation: ({ speaker, line }, person ) => {
				this._emitWorldIntent( 'talk', `land:resident-${person.id}` );
				if ( this.dialogue.open( person, { missionComplete: this.progress.stage === 4,
					phase: person.phase, stage: this.progress.stage,
					timeOfDay: app.settings.timeOfDay } ) ) {
					person.conversing = true;
					this.dialogue.onClose = () => { person.conversing = false; };
				} else this._message( `${speaker}：${line}`, 6 );
			},
		} );
		if ( conversation && active ) this._message( `${conversation.speaker}：${conversation.line}`, 6 );
		if ( active && combatActive && this._isPlayable() && this._combatPlayable() ) this.interactions.dispatch( input, app.player );
		const doorTarget = this.tower.doorOpen ? 1.38 : 0;
		const doorNext=this.tower.doorAnim+(doorTarget-this.tower.doorAnim)*(1-Math.exp(-dt*4.8));
        const doorPeople=['walk','swim'].includes(app.player.mode)?[app.player.position]:[];
        for(const peer of app.crew?.peers?.values?.()||[])if(['walk','swim'].includes(peer.mode)&&peer.root?.position)doorPeople.push(peer.root.position);
        this.tower.doorAnim=this.lighthouseColliders?.advanceDoor(this.tower.doorAnim,doorNext,doorPeople)??doorNext;
		this.tower.door.rotation.y = this.tower.doorAnim;
		this.tower.beacon.rotation.y += dt * ( this.progress.stage === 4 ? .9 : .13 );
		for ( const m of this.motes ) {
			m.model.visible = phase === 'warning' || phase === 'invasion';
			if ( m.model.visible ) {
				m.model.position.y = m.y + Math.sin( this.time * 1.45 + m.seed ) * .46;
				m.model.rotation.y += dt * .5;
			}
		}
		for ( let i = 0; i < this.trail.length; i ++ ) {
			const m = this.trail[ i ];
			m.visible = dist( player, m.position ) < 120;
			m.rotation.y += dt * .12;
		}
		if ( this.attackTimer > 0 && combatActive ) {
			app.player.getViewDir( _view );
			this.attackArc.position.copy( app.camera.position ).addScaledVector( _view, 1.7 );
			this.attackArc.position.y -= .27;
			this.attackArc.quaternion.copy( app.camera.quaternion );
			const swing = this.pendingStrike;
			const phase = swing ? clamp( ( swing.age - swing.windup ) / ( swing.activeEnd - swing.windup ), 0, 1 ) : 0;
			this.attackArc.rotation.z = -1.15 + phase * 2.30;
			this.attackArc.visible = true;
		} else this.attackArc.visible = false;
		this.avatar.update( dt, preserveStance&&app.player.mode==='walk' );
		this.combatFX.update( dt );
		for(const [id,w] of Object.entries(this.heldWeapons||{}))updateHeldWeapon(w,this.avatar,preserveStance&&app.player.mode==='walk'&&this.stance&&this.avatar.mode==='third'&&id===this.weaponId);
        const viewWeapon=this.weaponViews?.[this.weaponId]||this.tideBlade;for(const w of Object.values(this.weaponViews||{}))w.visible=false;viewWeapon.visible=preserveStance&&this.stance&&(app.player.mode==='deck'?app.player.deckViewMode!=='third':this.avatar.mode==='first');
        if(viewWeapon.visible){
			app.player.getViewDir( _view );
			_weaponRight.set( 1, 0, 0 ).applyQuaternion( app.camera.quaternion );
			_weaponUp.set( 0, 1, 0 ).applyQuaternion( app.camera.quaternion );
			viewWeapon.position.copy( app.camera.position ).addScaledVector( _view, 1.08 )
				.addScaledVector( _weaponRight, .52 ).addScaledVector( _weaponUp, -.58 );
			viewWeapon.quaternion.copy( app.camera.quaternion );
			const swing = this.pendingStrike;
			const t = swing ? clamp( ( swing.age - swing.windup ) / ( swing.activeEnd - swing.windup ), 0, 1 ) : 0;
			const bladeAngle = swing ? -.38 - swing.sweep + swing.sweep * 2 * ( t*t*(3-2*t) ) : -.38 + Math.sin( this.time * 1.8 ) * .012;
			viewWeapon.rotateZ( bladeAngle );
			viewWeapon.rotateX( -.32 + ( swing ? .24 + .20 * Math.sin( Math.PI*t ) : 0 ) );
            if(this.weaponId==='polearm'&&swing){viewWeapon.position.addScaledVector(_view,.55*Math.sin(Math.PI*t));viewWeapon.rotateX(-.55*Math.sin(Math.PI*t));}if(this.weaponId==='rod')viewWeapon.rotateZ(.24*Math.sin(this.time*2));
		}
		this.hud?.classList.toggle('sw-deck-combat',app.player.mode==='deck');
        this._updateHUD( (preserveStance&&(app.player.mode==='walk'||this.stance))||(app.freeCam&&!app.hunt?.abyss?.active&&!app.voyageM1?.deepEcho?.piloting), phase );
	}
}

