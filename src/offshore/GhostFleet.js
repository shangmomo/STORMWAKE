// V44.1 offshore spectral fleet: ten damageable armed ghost hull controllers.
// Distant vessels are simulation-culled, not non-interactive scenery. Renderer is deliberately provisional;
// GLB replacements must preserve per-ship transform and hit IDs.
import {Group,Mesh} from '../engine/index.js';
import {box,cylinder,prepare,mergePrepared,mat4} from '../world/boat/GeoKit.js';
import {Material} from '../engine/render/Material.js';
import {loadStaticArtistModel} from '../ship/HeritageAssetRig.js';
import {LAYERS} from '../core/SceneRenderer.js';
import {EnemyShipController} from '../combat/EnemyShipController.js';
import {safeFromHarbour} from './OffshoreField.js';
import {MovingSurfaceWorld} from '../systems/MovingSurfaceWorld.js';
const CENTER={x:-600,z:2450};
// A ghost must remain visible in the dark without looking like painted timber.
// Dedicated double-sided, translucent WebGPU material; never reuse opaque land shading.
const ghostMaterial=new Material({
 name:'V44GhostEtherealHull',lit:false,transparent:true,blending:'normal',
 side:'double',depthWrite:false,velocityWeight:.1,vertexColors:true,
 surface:`
  let face=abs(dot(normalize(in.N),normalize(in.V)));
  let rim=pow(1.0-clamp(face,0.0,1.0),1.55);
  let pulse=.83+.17*sin(frame.time*2.1+in.P.y*.3+in.P.x*.14);
  s.albedo=in.color.rgb*.18;
  s.emissive=in.color.rgb*(.62+2.2*rim)*pulse;
  s.alpha=clamp(.34+.38*rim+.14*in.color.g,.27,.81);
 `
});
// Three offshore patrol groups, not a ten-ship ring in front of the player.
// Every ship has its own path and continues to use combat hit IDs.
export const GHOST_PATROLS=Object.freeze([
 {x:-1030,z:2160},{x:-910,z:2250},{x:-915,z:2380},
 {x:-685,z:2330},{x:-565,z:2260},{x:-475,z:2460},{x:-595,z:2550},
 {x:-365,z:2710},{x:-225,z:2630},{x:-290,z:2860}
]);
const AMOUNT=GHOST_PATROLS.length;
const types=['hollow_flagship','drowned_brig','drowned_brig','wisp_cutter','wisp_cutter','wisp_cutter','wisp_cutter','wisp_cutter','wisp_cutter','wisp_cutter'];
const plank=(w,h,d,x,y,z,color)=>prepare(box(w,h,d),{color,rough:.92,matrix:mat4(x,y,z)});
function buildGhost(type){
 const leader=type==='hollow_flagship', scale=leader?1.5:type==='drowned_brig'?1.14:.85;
 const hull=0x163b3c,edge=0x2a8e77,flame=0x79ffc1,dark=0x092529;
 const parts=[plank(2.9,1.2,7.3,0,0,0,hull),plank(3.25,.3,6.6,0,.75,0,edge),plank(2.4,.25,2.2,0,1.12,-2.45,dark),
  plank(2.3,.35,1.6,0,1.32,-2.55,hull),plank(1.9,.15,2.5,0,.99,2.4,dark),
  plank(.2,8,.2,0,4.0,0.0,dark),plank(.16,6,.16,0,3.2,2.45,dark),
  plank(4.1,3.1,.09,0,5.6,.15,0x27594f),plank(2.1,2.0,.08,0,4.7,2.55,0x245951),
  plank(4.4,.16,.12,0,7.2,.13,edge),plank(2.6,.11,.12,0,5.65,2.55,edge),
  plank(.5,.7,.6,-1.2,1.18,-2.3,flame),plank(.5,.7,.6,1.2,1.18,-2.3,flame),
  plank(.35,.65,.35,0,7.8,.1,flame),plank(.33,.64,.3,0,6.5,2.55,flame)];
 for(const side of [-1,1])for(const z of [-1.1,1.1])parts.push(plank(.56,.32,.33,side*1.62,.65,z,dark),plank(.15,.20,.18,side*1.88,.65,z,flame));
 // Blank gaps in the luminous sails allow the hull to read as broken timber.
 parts.push(plank(.82,.26,.12,.95,5.25,.21,dark),plank(.9,.24,.11,-1.25,4.47,.18,dark));
 if(leader)parts.push(plank(3,.6,1.45,0,1.85,-2.7,dark),plank(1,.5,.2,0,2.40,-2.8,flame));
 const group=new Group();group.name='V44 spectral '+type;group.scale.set(scale,scale,scale);
 const mesh=new Mesh(mergePrepared(parts),ghostMaterial);mesh.layers.set(LAYERS.TRANSPARENT);mesh.receiveShadow=false;mesh.castShadow=false;group.add(mesh);
 return group;
}
export class GhostFleet{
 constructor(scene,{query=null,terrain=null,colliders=null,player=null}={}){
  this.colliders=colliders;this.player=player;
  this.query=query;this.terrain=terrain;this.waterSlot=query?query.allocate('spectralFleet',10):-1;
  this.scene=scene;this.time=0;this.ships=[];
  for(let i=0;i<AMOUNT;i++){
   const {x,z}=GHOST_PATROLS[i];
   const angle=.52+i*.39, radius=95+(i%3)*32;
   if(!safeFromHarbour(x,z))throw Error('Ghost fleet too near port');
   const model=buildGhost(types[i]);model.position.set(x,0,z);model.visible=false;scene.add(model);
   const controller=new EnemyShipController({path:[{x,z},{x:x+Math.cos(angle+.55)*radius,z:z+Math.sin(angle+.55)*radius}],hp:i===0?210:i<3?120:70});
   this.ships.push({id:`v44_ghost_${i}`,type:types[i],model,controller,x,z,yaw:angle,hp:controller.hp,state:'patrol',down:false});
  }
  if(typeof window!=='undefined')this.loadSpectralShips().catch(error=>console.warn('[V47] CC0 spectral artists unavailable; fallback visuals retained',error));
 }
 async loadSpectralShips(){
  // Actual Quaternius CC0 wooden ship replaces each of the low-poly glowing
  // blocks. The 10 gameplay hit IDs, routes and independent HP remain.
  const source=await loadStaticArtistModel('/models/stormwake_v63/ghost_ship_separated.glb');
  const t=source.materials[0]?.bindings?.albedoMap?.texture;
  const spectral=new Material({
    name:'V47_CC0_Spectral_Ship_Wood',lit:false,transparent:true,side:'double',
    depthWrite:false,velocityWeight:.15,
    ...(t?{textures:{ghostAtlas:t},defines:{GHOST_ATLAS:1}}:{defines:{GHOST_ATLAS:0}}),
    surface:`
#if GHOST_ATLAS
      let ink=textureSample(ghostAtlas,smpAnisoRepeat,in.uv).rgb;
#else
      let ink=vec3f(.44,.50,.46);
#endif
      let edge=pow(1.0-abs(dot(normalize(in.N),normalize(in.V))),1.7);
      let aura=.76+.24*sin(frame.time*1.27+in.P.y*.9+in.P.z*.07);
      s.albedo=ink*vec3f(.07,.37,.25);
      s.emissive=(vec3f(.08,.9,.49)*edge*1.65+ink*vec3f(.05,.37,.18))*aura;
      s.alpha=clamp(.41+.38*edge,.35,.84);
    `,
  });
  const solid=new Material({name:'V63_Ghost_Opaque_Timber_Iron',lit:true,transparent:false,depthWrite:true,side:'double',roughness:.84,metalness:.12,...(t?{textures:{ghostAtlas:t},defines:{GHOST_ATLAS:1}}:{defines:{GHOST_ATLAS:0}}),surface:`
#if GHOST_ATLAS
 let ink=textureSample(ghostAtlas,smpAnisoRepeat,in.uv).rgb;
#else
 let ink=vec3f(.24,.19,.13);
#endif
 s.albedo=ink*vec3f(.72,.95,.82);s.emissive=ink*vec3f(.015,.065,.035);s.alpha=1.0;`});
  this.spectralMaterials={wood:solid,canvas:spectral,atlas:!!t};
  for(const vessel of this.ships){
   const original=vessel.model.children.filter(x=>x.isMesh);
   const visual=new Group();visual.name='Quaternius CC0 full ghost hull '+vessel.id;
   visual.rotation.y=Math.PI/2;visual.scale.setScalar(.67);
   visual.add(source.root.clone(true));
   visual.traverse(obj=>{if(obj.isMesh){const cloth=obj.material.name.includes('GhostCanvas');obj.material=cloth?spectral:solid;obj.layers.set(cloth?LAYERS.TRANSPARENT:LAYERS.OPAQUE);obj.castShadow=!cloth;obj.receiveShadow=!cloth;}});
   vessel.model.add(visual);
   for(const mesh of original)mesh.visible=false;
   vessel.artistVisual=visual;
   vessel.surface=new MovingSurfaceWorld(vessel.model,{world:this.sharedHullWorld});this.sharedHullWorld??=vessel.surface.world;this.colliders?.triangleWorlds.push(vessel.surface);
  }
  return this.ships.length;
 }
 update(dt,playerBoat,{host=true,time=null,camera=playerBoat.position}={}){
  const step=Math.min(.1,Math.max(0,dt));this.time=Number.isFinite(time)?time:this.time+step;
  const p=playerBoat.position,events=[];
  for(let i=0;i<this.ships.length;i++){
   const ship=this.ships[i],d=Math.hypot(ship.x-p.x,ship.z-p.z),sailor=this.player,oldYaw=ship.model.rotation.y;
   const passenger=ship.surface&&sailor?.mode==='walk'&&sailor.grounded&&Math.abs((ship.surface.floorAt(sailor.position.x,sailor.position.z,sailor.position.y+.15,sailor.position.y-.25)??-10000)-sailor.position.y)<.2?ship.surface.local(sailor.position):null;
   if(ship.down){ship.model.visible=false;continue;}
   if(ship.controller){
    // Host simulates close encounters; all ten ships can be struck/sunk.
    // Only authority advances controllers; snapshots preserve combat on handoff.
    if(host&&d<580){for(const event of ship.controller.update(step,playerBoat))events.push({...event,shipId:ship.id});}
    ship.x=ship.controller.x;ship.z=ship.controller.z;ship.yaw=ship.controller.yaw;
    ship.hp=ship.controller.hp;ship.down=ship.controller.state==='sink';
   }else{
    const phase=i*2*Math.PI/AMOUNT+this.time*.025;
    const r=38+(i%3)*11;const home=GHOST_PATROLS[i];
    ship.x=home.x+Math.cos(phase)*r;
    ship.z=home.z+Math.sin(phase)*r;
    ship.yaw=phase+Math.PI/2;
   }
   ship.model.visible=!ship.down && Math.hypot(ship.x-camera.x,ship.z-camera.z)<1350;
   if(this.query){
    const slot=this.waterSlot+i;this.query.setPoint(slot,ship.x,ship.z);
    if(this.query.cpuValid&&Math.hypot(this.query.resultInputs[slot*4]-ship.x,this.query.resultInputs[slot*4+1]-ship.z)<40){
     const w=this.query.get(slot),ny=Math.sqrt(Math.max(.05,1-w.nx*w.nx-w.nz*w.nz));
     ship.waterY=w.height;ship.pitch=Math.atan2(-(w.nx*Math.sin(ship.yaw)+w.nz*Math.cos(ship.yaw)),ny);ship.roll=Math.atan2(w.nx*Math.cos(ship.yaw)-w.nz*Math.sin(ship.yaw),ny);
    }
   }
   if(ship.model.visible){const a=Math.min(1,step*3);ship.model.position.set(ship.x,ship.model.position.y+((ship.waterY||0)+.14-ship.model.position.y)*a,ship.z);ship.model.rotation.set((ship.pitch||0)*.7,ship.yaw,(ship.roll||0)*.7,'YXZ');}
   if(passenger&&ship.model.visible){sailor.position.copy(ship.surface.global(passenger));sailor.yaw+=Math.atan2(Math.sin(ship.yaw-oldYaw),Math.cos(ship.yaw-oldYaw));}
   if(ship.surface&&sailor?.mode==='walk'&&ship.surface.near(sailor.position)){const l=ship.surface.local(sailor.position);if(Math.abs(l.x)<2.7&&Math.abs(l.z)<7&&l.y>-.5&&l.y<7)sailor.foreignShip=ship.id;}
   // Probe the hull's next reach before entering a reef. Steering and drag act
   // on its inertial controller, using the same terrain as the player's boat.
   if(host&&this.terrain&&ship.controller&&this.terrain.heightAt(ship.x+ship.controller.vx*5,ship.z+ship.controller.vz*5)>-2){ship.controller.yaw+=step*.8;ship.controller.vx*=Math.exp(-step*2);ship.controller.vz*=Math.exp(-step*2);}

  }
  return events;
 }
 resetLanternPatrol(){for(let i=0;i<3;i++){const s=this.ships[i];if(s.down||s.controller.hp<=0){s.controller.hp=i===0?210:120;s.controller.state='patrol';s.down=false;s.hp=s.controller.hp;}}}
 snapshot(){return this.ships.map(s=>{const c=s.controller;return {id:s.id,x:c.x,z:c.z,heave:s.model.position.y,pitch:s.model.rotation.x,roll:s.model.rotation.z,yaw:c.yaw,hp:c.hp,state:c.state,vx:c.vx,vz:c.vz,turnRate:c.turnRate,cooldown:c.cooldown,target:c.target,shots:c.shots,rigDamage:c.rigDamage||0};});}
 applySnapshot(states){if(!Array.isArray(states))return;for(const state of states){const s=this.ships.find(s=>s.id===state.id);if(!s)continue;Object.assign(s.controller,state);s.x=state.x;s.z=state.z;s.yaw=state.yaw;s.hp=state.hp;s.down=state.state==='sink';}}
 // Narrow-phase segment test for all ten ships; prevents fast projectiles tunnelling.
 findHullHit(from,to){let best=null;for(const ship of this.ships){if(ship.down||!ship.surface)continue;const hit=ship.surface.segmentHit(from,to);if(hit&&(!best||hit.t<best.t))best={ship,...hit};}return best;}
 findHitSegment(ax,az,bx,bz,radius=4.7){
  let best=null;const dx=bx-ax,dz=bz-az,len2=dx*dx+dz*dz;
  for(const ship of this.ships){if(ship.down||!ship.controller)continue;
   const t=len2>1e-9?Math.max(0,Math.min(1,((ship.x-ax)*dx+(ship.z-az)*dz)/len2)):0;
   const d=Math.hypot(ship.x-ax-dx*t,ship.z-az-dz*t);
   const rr=ship.type==='hollow_flagship'?7.5:ship.type==='drowned_brig'?6.5:5.5;
   if(d<Math.max(radius,rr) && (!best||t<best.t))best={ship,t,d};
  }
  return best;
 }
 hit(shipId,amount,type='cannonball'){
  const ship=this.ships.find(s=>s.id===shipId&&s.controller&&!s.down);
  if(!ship||!(amount>0))return false;
  ship.controller.hit(amount,type);ship.hp=ship.controller.hp;ship.down=ship.controller.state==='sink';
  if(ship.down)ship.model.visible=false;
  return true;
 }
 get liveCount(){return this.ships.filter(s=>!s.down).length;}
}
