// Development-only instrumentation; deliberately not installed in production
// or normal games. Never expose mutating probes without ?qa=1 and DEV.
import {WORLD} from '../world/WorldLayout.js';
import {stationLocalMeters} from '../ship/StationSites.js';
import {isDryHoldCamera} from '../ship/DryHoldCamera.js';
import {checkSnapshot} from './Assertions.js';
import {GPU} from '../engine/gpu/GPU.js';
const finite = x => Number.isFinite(x) ? +x.toFixed(4) : null;
const point = p => p ? {x:finite(p.x),y:finite(p.y),z:finite(p.z)} : null;
const LOG_LIMIT=150;

export function installAutoQA(app){
  if(!import.meta.env.DEV || !app.qs.has('qa'))return null;
  if(window.__stormwakeQA)return window.__stormwakeQA;
  const started=performance.now(), events=[];
  const log=(severity,id,details)=>{
    const event={time:Date.now(),elapsed:+((performance.now()-started)/1000).toFixed(2),severity,id,details:String(details).slice(0,320)};
    events.push(event);if(events.length>LOG_LIMIT)events.shift();return event;
  };
  const onError=e=>log('error','window_error',e.message||e.error?.message||String(e));
  const onRejection=e=>log('error','unhandled_rejection',e.reason?.message||String(e.reason));
  window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);
  let lastPosition=null, lastMotionTime=performance.now();
  const snapshot=()=>{
    const p=app.player,b=app.boatCtl,v=app.voyageM1,c=app.crew;
    const hour=app.settings.timeOfDay;
    const target=app.oceanChart?.selected || app.oceanChart?.freeTarget || null;
    const bosses=(app.landAdventure?.enemies||[]).filter(e=>['warden','corsair'].includes(e.type)).map(e=>({
      id:e.id,type:e.type,health:finite(e.hp),dead:!!e.dead,present:!e.dead,
      visible:!!e.model?.group?.visible,rigLoaded:!!e.actor,proceduralVisible:!!e.model?.body?.visible,
      position:{x:finite(e.x),z:finite(e.z)},
    }));
    const peers=[...(c?.peers?.values()||[])].map(peer=>({id:peer.id,mode:peer.mode,activity:peer.activity,
      visible:!!peer.root?.visible,position:point(peer.root?.position),target:point(peer.target),activity:peer.activity,animationTime:finite(peer.animationTime),legAngle:finite(peer.rig?.legs?.[0]?.rotation.x)}));
    return {
      ready:!!(app.scene && app.player && app.engine),version:'V78',playState:app.playState,elapsedSeconds:finite((performance.now()-started)/1000),
      rendering:{scale:app.settings.renderScale,width:app.engine?.width,height:app.engine?.height,
        seed:app.qs.get('seed'),adapter:GPU.adapter?.info?{vendor:GPU.adapter.info.vendor,device:GPU.adapter.info.device,description:GPU.adapter.info.description}:null,
        displayedFps:finite(app.fps),gpuProfile:app.profiler?.enabled?app.profiler.result:null},
      interaction:{overlayActive:!!document.querySelector('.tw-start.is-on'),inputEnabled:!!app.input?.enabled,
        candidates:app.voyageM1?.interact?.candidates?.map(c=>({id:c.id,priority:c.priority,distance:finite(c.distance)}))||[],
        selected:app.voyageM1?.selected?.id||null},
      player:{mode:p?.mode,deckLayer:p?.deckLayer,position:point(p?.position),velocity:point(p?.velocity),
        deckPosition:point(p?.deckPos),station:p?.stationId||null,grounded:!!p?.grounded,
        deckYaw:finite(p?.deckYaw),
        climbing:!!p?.shipClimb,collision:app.boat?.collisionWorld?.stats||null},
      ship:{position:point(b?.position),rotation:b?{x:finite(b.quaternion.x),y:finite(b.quaternion.y),z:finite(b.quaternion.z),w:finite(b.quaternion.w)}:null,speed:finite(b?.speed),moored:!!b?.moored,heritage:!!app.boat?.shipScale,helmVisible:!!app.boat?.heritageDeck?.helmWheel?.visible,
        anchor:v?.stations?{down:!!v.stations.anchorDown,travel:finite(v.stations.anchorTravel),turns:finite(v.stations.anchorCrankTurns),
          hands:v.stations.anchorHands,hasRig:!!app.boat?.heritageArt?.anchorRig,
          tether:b?.anchorTether?.snapshot?.(),eyeLocal:point(app.boat?.heritageArt?.anchorRig?.eyeLocal),visibleSpan:finite(app.boat?.heritageArt?.anchorRig?.visibleSpan)}:null,
        throttle:finite(v?.stations?.helmThrottle??b?.throttle),sails:finite(v?.stations?.sailMain)},
      world:{hour:finite(hour),weatherSeconds:finite(app.fft?.time?.value ?? 0),night:finite(app.sky?.night ?? 0),
        remoteWorld:c?.getWorldState?.() || null},
      water:{dryCamera:isDryHoldCamera(p),bilge:{...v?.damage?.hull?.sections},
        oceanVisible:!!app.ocean?.visible,underwaterPost:(app.underwater?.enabled?.value??1)>.5,
        hullMaskActive:!!app.sceneRenderer?.hullMaskActive,waterShaderReady:!!app.waterMaterial},
      multiplayer:{connected:!!c?.connected,peerCount:c?.peers?.size||0,peers,rttMs:finite(c?.rtt||0),selfId:c?.selfId||null},
      bosses,offshore:{active:!!app.offshoreLife?.active,
        fleet:v?.ghostFleet?.snapshot?.(),weather:app.offshoreWeather,animalsVisible:app.offshoreLife?.critters?.filter(x=>x.mesh.visible && app.offshoreLife.root.visible).length||0},
      lighting:{active:app.localLights?.active||0,total:app.localLights?.sources?.length||0},
      camera:{position:point(app.camera?.position)},navigation:target,
    };
  };
  function moveTo(name){
    const p=app.player,b=app.boatCtl;
    if(p.stationId && app.voyageM1)app.voyageM1.leaveStation();
    if(['boat','helm','anchor','anchor_2','anchor_3','anchor_4','cabin','lower_hold','lower_entry','cabin_entry','aft_stairs','fore_stairs'].includes(name)){
      if(p.mode!=='deck')p.boardBoat();
      p.stationId=null;
      if(name==='aft_stairs'||name==='fore_stairs'){
        const aft=name==='aft_stairs';p.deckPos.set(1.03,aft?.97:.84,aft?-5.30:1.63);p.deckLayer='deck';p.deckYaw=aft?Math.PI:0;p.pitch=0;p.deckGrounded=true;
      }else if(name==='lower_entry'){
        const h=app.voyageM1.lowerHold.layout;p.deckPos.set(h.deckExit.x,h.deckY,h.deckExit.z);p.deckLayer='deck';p.deckYaw=0;p.pitch=-.1;
      }else if(name==='cabin_entry'){
        p.deckPos.set(-.88,1.06,-6.0);p.deckLayer='deck';p.deckYaw=Math.PI;p.pitch=-.1;
      }else if(name.startsWith('anchor')){
        const loc=stationLocalMeters(app.boat,name);if(!loc)throw Error('No anchor station');
        p.deckPos.set(loc.x,loc.y,loc.z+.12);p.deckLayer='deck';p.deckYaw=Math.PI;p.pitch=-.4;
      } else if(name==='helm') {
        const loc=stationLocalMeters(app.boat,'helm');if(!loc)throw Error('No helm station');
        p.deckPos.set(loc.x,loc.y,loc.z+.5);p.deckLayer='deck';
      } else if(name==='cabin'||name==='lower_hold') {
        // QA test entry; if native collision invalidates this position the
        // subsequent recorded snapshot exposes the actual fall-through.
        p.deckLayer=name==='cabin'?'hold':'lowerHold';
        p.deckPos.set(name==='cabin'?.15:-.25, name==='cabin'?.48:-.75, name==='cabin'?-8.1:-2.9);
      }
      else {p.deckPos.set(0,1.2,-4.5);p.deckLayer='deck';}
      p.deckVel.set(0,0,0);p.deckToWorld();if(name.startsWith('anchor'))app.voyageM1._faceStation(name);return true;
    }
    if(name==='open_sea'){
      // V60: search deep water in this world's actual coordinate space.
      // A guessed point may be a mountain even when it looks offshore on a map.
      const sites=[[250,330],[500,700],[700,1100],[-800,1100],[-950,500],[-700,-450],[850,-550],[1050,1450]];
      const target=sites.find(([x,z])=>Number.isFinite(app.terrainData.heightAt(x,z)) && app.terrainData.heightAt(x,z)<-8);
      if(!target||!b.teleportTo(target[0],target[1],.8))throw Error('No deep-water QA site found (terrain checked)');
      p.boardBoat();p.deckPos.set(0,1.2,-4.5);p.deckToWorld();return true;
    }
    const boss=app.landAdventure?.enemies?.find(e=>e.type==='corsair'&&!e.dead)||app.landAdventure?.enemies?.find(e=>e.type==='warden'&&!e.dead);
    const places={spawn:WORLD.start.position,dock:WORLD.boatDock.position,beach:WORLD.spawn.position,
      boss:boss?{x:boss.x+7,y:0,z:boss.z+9}:null,
      cave_entry:{x:390,z:-440},cave_mid:{x:390,z:-517},cave_lower:{x:354,z:-575},tavern_entry:{x:125,z:-200},forge_entry:{x:157,z:-223}};
    const loc=places[name];if(!loc)throw Error(`Unknown scene: ${name}`);
    p.mode='walk';p.stationId=null;p.deckLayer='deck';p.position.set(loc.x,app.terrainData.heightAt(loc.x,loc.z)+.09,loc.z);
    p.velocity.set(0,0,0);p.grounded=false;p._camY=null;
    if(name==='boss')p.yaw=Math.atan2(p.position.x-boss.x,p.position.z-boss.z);
    return true;
  }
  function setHour(hour){
    if(!Number.isFinite(hour)||hour<0||hour>=24)throw Error('hour must be in [0,24)');
    if(app.crew?.connected){if(!app.crew.isHost)throw Error('Only room host may set world time');
      return app.crew.requestWorldControl({hour});}
    app.settings.timeOfDay=hour;return true;
  }
  const probe={
    version:'V78',get ready(){return ['awaiting_start','playing'].includes(app.playState);},snapshot,events:()=>events.slice(),check:opts=>checkSnapshot(snapshot(),opts),
    go:moveTo,setHour,view:name=>window.__view?.(name)||null,
    interactionTrace:()=>({playerLocal:point(app.player?.deckPos),focusOwner:app.input?.interactionOwner,
      overlayActive:!!document.querySelector('.tw-start.is-on'),playState:app.playState,
      ...app.voyageM1?.interact?.trace?.()}),
    checkAnchor:()=>{const s=snapshot();return s.ship.anchor;},
    checkBosses:()=>snapshot().bosses,
    clearEvents:()=>{events.length=0;},
    report:()=>({snapshot:snapshot(),events:events.slice(),checks:checkSnapshot(snapshot())}),
  };
  window.__stormwakeQA=probe;
  log('info','qa_ready','QA probes installed; available only in development with ?qa=1');
  // Never use polling to modify simulation state. Passive watchdog only.
  let prevIds=new Set();
  const watch=window.setInterval(()=>{
    const s=snapshot(),p=s.player.position; if(!p)return;
    if(lastPosition){
      const d=Math.hypot(p.x-lastPosition.x,p.z-lastPosition.z);
      if(d>.15)lastMotionTime=performance.now();
      if(d>70)log('warn','player_teleport',`Large player jump ${d.toFixed(1)}m; inspect intentional QA warp`);
    }
    lastPosition=p;
    const ids=new Set(checkSnapshot(s).failures.map(x=>x.id));
    for(const x of checkSnapshot(s).failures)if(!prevIds.has(x.id))log('error',x.id,x.message);
    prevIds=ids;
  },1400);
  window.addEventListener('pagehide',()=>{clearInterval(watch);window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection);},{once:true});
  return probe;
}
