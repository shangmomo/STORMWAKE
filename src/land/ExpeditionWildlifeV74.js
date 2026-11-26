// V74 artist ecology. All new actors use authored GLB clips; no generated mesh fallback.
// New wildlife is observation-only, so it cannot create unsynchronised combat/rewards.
import {Group,Vector3,Quaternion,Matrix4,Color} from '../engine/index.js';
import {loadGLB} from '../engine/loaders/GLTF.js';
import {SkinnedModel} from '../engine/render/Skinning.js';
import {loadStaticArtistModel} from '../ship/HeritageAssetRig.js';
import {CollisionWorld} from '../systems/CollisionWorld.js';
import {strikeLineBlocked} from './LandCombatTiming.js';
import {GROTTO_SITE} from './ExpeditionTerrain.js';
const BASE='/models/expedition/v74/';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const horizontal=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const ECOLOGY=Object.freeze({
 ptero:{name:'无齿翼龙',kind:'air',file:'ptero.glb',home:{x:349,z:-625},radius:45,scale:1,turn:.63,accel:1.9,brake:2.8,speed:8,altitude:18,verticalSpeed:2.8,clips:{move:'04_Flapping_Flight',idle:'05_Soaring_Glide'},rig:69},
 wolf:{name:'灰苔灰狼',kind:'land',file:'wolf.glb',home:{x:-128,z:-226},radius:12,scale:1,turn:1.8,accel:2,brake:3,speed:1.7,clips:{move:'Wolf|Wolf_WalkFast_F',idle:'Wolf|Wolf_Howl'},rig:123},
 ray:{name:'深渊魔鬼鱼',kind:'water',file:'ray.glb',home:{x:530,z:490},radius:23,scale:2.8,turn:.48,accel:.65,brake:1.2,speed:2.5,altitude:-12,verticalSpeed:1.2,clips:{move:'Armature|Swim',idle:'Armature|Idle',warn:'Armature|Intimidate'},rig:244}
});
export function initialEcology(spec,terrain,phase=0){const x=spec.home.x+Math.sin(phase)*4,z=spec.home.z+Math.cos(phase)*4,y=spec.kind==='air'?terrain(x,z)+spec.altitude:spec.kind==='water'?spec.altitude:terrain(x,z);return {x,y,z,yaw:phase,speed:0,vy:0,bank:0,pitch:0,time:0,state:'move',pause:0,phase,waypoint:phase,blocked:0};}
export function stepEcology(e,s,p,dt,terrain,clear=()=>true){
 dt=clamp(Number.isFinite(dt)?dt:0,0,.05);if(!dt)return;e.time+=dt;
 let heading=e.yaw,speed=s.speed,yGoal=e.y,clip='move';
 const near=horizontal(e,p),home=horizontal(e,s.home);
 if(s.kind==='land'){
  if(e.pause>0){e.pause=Math.max(0,e.pause-dt);speed=0;clip='idle';}
  else{const angle=e.waypoint,tx=s.home.x+Math.cos(angle)*s.radius*.63,tz=s.home.z+Math.sin(angle)*s.radius*.63;
   if(near<7){heading=Math.atan2(e.x-p.x,e.z-p.z);if(home>s.radius*.85)heading=Math.atan2(s.home.x-e.x,s.home.z-e.z);speed=s.speed;}
   else{heading=Math.atan2(tx-e.x,tz-e.z);if(Math.hypot(tx-e.x,tz-e.z)<1.1){e.waypoint+=1.28;e.pause=6.04;speed=0;clip='idle';}}
  }
 }else if(s.kind==='air'){
  const a=e.phase+e.time*.10,tx=s.home.x+Math.cos(a)*s.radius,tz=s.home.z+Math.sin(a)*s.radius;
  heading=Math.atan2(tx-e.x,tz-e.z);speed=s.speed;clip=Math.sin(e.time*.24+e.phase)>.2?'move':'idle';
  // Look ahead rather than snapping to a changing terrain height.
  yGoal=Math.max(terrain(e.x,e.z),terrain(e.x+Math.sin(e.yaw)*12,e.z+Math.cos(e.yaw)*12),terrain(tx,tz))+s.altitude+3*Math.sin(e.time*.12);
 }else{
  const a=e.phase+e.time*.075,tx=s.home.x+Math.cos(a)*s.radius,tz=s.home.z+Math.sin(a)*s.radius;
  heading=Math.atan2(tx-e.x,tz-e.z);yGoal=s.altitude+3*Math.sin(e.time*.14+e.phase);
  if(near<9&&Math.abs(p.y-e.y)<7){heading=Math.atan2(e.x-p.x,e.z-p.z);speed=s.speed*.7;clip='warn';if(home>s.radius*1.25)heading=Math.atan2(s.home.x-e.x,s.home.z-e.z);}
 }
 if(e.blocked>0){e.blocked=Math.max(0,e.blocked-dt);heading=e.yaw+.8;speed*=.45;}
 const d=delta(heading,e.yaw),turn=clamp(d,-s.turn*dt,s.turn*dt);e.yaw+=turn;
 speed*=Math.max(s.kind==='air'?.55:.04,Math.cos(d));e.speed+=clamp(speed-e.speed,-s.brake*dt,s.accel*dt);
 let nx=e.x+Math.sin(e.yaw)*e.speed*dt,nz=e.z+Math.cos(e.yaw)*e.speed*dt;
 const h=terrain(nx,nz),limit=s.kind==='air'?s.radius*1.8:s.radius*1.5;
 if(!Number.isFinite(h)||horizontal({x:nx,z:nz},s.home)>limit||(s.kind==='water'&&h>-16)||(s.kind==='land'&&(h<1||Math.abs(h-e.y)>Math.max(.22,e.speed*dt*.85)))||!clear(e,nx,nz,h)){
  nx=e.x;nz=e.z;e.speed=Math.max(0,e.speed-s.brake*dt);e.blocked=.8;if(s.kind==='land'){e.pause=0;e.waypoint+=.65;}
 }
 e.x=nx;e.z=nz;
 if(s.kind==='land'){e.y=terrain(nx,nz);e.pitch=0;e.bank=0;}
 else{
  const ground=terrain(nx,nz);
  if(s.kind==='water')yGoal=clamp(yGoal,ground+4,-5);
  const targetV=clamp((yGoal-e.y)*.8,-s.verticalSpeed,s.verticalSpeed);e.vy+=clamp(targetV-e.vy,-2*dt,2*dt);e.y+=e.vy*dt;
  if(s.kind==='water'){e.y=clamp(e.y,ground+4,-5);}else e.y=Math.max(e.y,ground+8);
  e.pitch+=(clamp(-Math.atan2(e.vy,Math.max(1,e.speed)),-.35,.35)-e.pitch)*Math.min(1,dt*2);
  e.bank+=(clamp(-turn/Math.max(dt,.001)*.45,-.42,.42)-e.bank)*Math.min(1,dt*2);
 }
 e.state=clip;
}
export function validateEcologyAsset(g,s){if(g.skins.length!==1||g.skins[0].joints.length!==s.rig||Object.values(s.clips).some(c=>!g.animations.some(a=>a.name===c)))throw Error('Unexpected original wildlife rig '+s.file);if(g.nodes.some(n=>n.mesh!=null&&n.skin!==0))throw Error('Unsupported multipart mesh '+s.file);return g;}
export function grottoTriangles(g,site=GROTTO_SITE){
 const triangles=[],placement=new Matrix4().compose(new Vector3(site.x,site.y+site.offsetY,site.z),new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI),new Vector3(site.scale,site.scale,site.scale));
 const v=new Vector3();function visit(i,parent){const n=g.nodes[i],m=parent.clone().multiply(new Matrix4().compose(new Vector3(...n.t),new Quaternion(...n.r),new Vector3(...n.s)));if(n.mesh!=null)for(const p of g.meshes[n.mesh]){const a=p.attributes.POSITION.array,idx=p.indices;for(let k=0;k<(idx?.length||a.length/3);k+=3){const vertices=[];for(let j=0;j<3;j++){const q=(idx?idx[k+j]:k+j)*3;v.set(a[q],a[q+1],a[q+2]).applyMatrix4(m);vertices.push(v.toArray());}triangles.push({vertices,id:'v74:grotto:'+i});}}for(const child of n.children)visit(child,m);}for(const i of g.roots)visit(i,placement);return triangles;
}
export class ExpeditionWildlifeV74{
 constructor(adventure){this.a=adventure;this.app=adventure.app;this.actors=[];this.sites=[];this.loading=new Set();this.failed=new Set();this.enabled=typeof document!=='undefined'&&new URLSearchParams(location.search).get('coop')!=='1';this.grottoEnabled=typeof document!=='undefined';}
 async load(key){const s=ECOLOGY[key];this.loading.add(key);try{const g=validateEcologyAsset(await loadGLB(BASE+s.file),s),n=key==='wolf'?2:1;
  const actors=[];for(let i=0;i<n;i++){const rig=await SkinnedModel.create(g,{maxTextureSize:2048}),root=new Group();root.name='V74 '+s.name;root.visible=false;root.add(rig.group);rig.group.scale.setScalar(s.scale);rig.play(s.clips.move,{fade:.01});rig.update(0);const e=initialEcology(s,this.app.terrainData.heightAt.bind(this.app.terrainData),i*2.6+.5);root.position.set(e.x,e.y,e.z);actors.push({key,s,e,root,rig});}for(const actor of actors){this.app.scene.add(actor.root);this.actors.push(actor);}
 }catch(err){this.failed.add(key);console.warn('[V74] unavailable '+key,err);}finally{this.loading.delete(key);}}
 async loadGrotto(){this.loading.add('grotto');try{const g=await loadGLB(BASE+'grotto.glb'),art=await loadStaticArtistModel(BASE+'grotto.glb',g);const site=GROTTO_SITE;art.root.position.set(site.x,site.y+site.offsetY,site.z);art.root.scale.setScalar(site.scale);art.root.rotation.y=Math.PI;art.root.name='V74 钟影岩廊（原作者 Grotto）';const world=new CollisionWorld(grottoTriangles(g));if(world.triangles.length<9000)throw Error('Incomplete grotto collision');this.app.colliders.triangleWorlds.push(world);this.app.scene.add(art.root);this.grotto={root:art.root,world};for(const z of [site.z+5,site.z-7])this.app.localLights?.add({position:new Vector3(site.x,site.y+2.6,z),color:new Color(0xe0ae79),intensity:1.8,range:11,kind:'lantern',flicker:.03});}catch(err){this.failed.add('grotto');console.warn('[V74] grotto unavailable',err);}finally{this.loading.delete('grotto');}}
 update(dt){const p=this.app.player?.position;if(!p)return;const eye=this.app.camera?.position||p;const terrain=this.app.terrainData.heightAt.bind(this.app.terrainData);
  if(this.grottoEnabled&&!this.grotto&&!this.loading.has('grotto')&&!this.failed.has('grotto')&&horizontal(eye,GROTTO_SITE)<170)this.loadGrotto();
  if(!this.enabled||this.app.crew?.connected){for(const a of this.actors){a.root.visible=false;a.rig.hold();}return;}
  for(const [key,s] of Object.entries(ECOLOGY)){if(horizontal(eye,s.home)<(s.kind==='air'?210:150)&&!this.actors.some(a=>a.key===key)&&!this.loading.has(key)&&!this.failed.has(key))this.load(key);}
  for(const a of this.actors){const {s,e,rig,root}=a,visible=horizontal(eye,e)<(s.kind==='air'?220:125);root.visible=visible;if(!visible){rig.hold();continue;}const clear=(old,x,z,h)=>{if(s.kind!=='land')return true;const q=new Vector3(x,h,z);if(this.app.colliders.resolveCapsule(q,.27,1.15,.22)&&Math.hypot(q.x-x,q.z-z)>.02)return false;for(const w of this.app.colliders.triangleWorlds||[]){const r=w.move(old,{x,y:h,z},{radius:.27,height:1.15,step:.22});if(Math.hypot(r.x-x,r.z-z)>.02)return false;}return !this.actors.some(b=>b!==a&&b.s.kind==='land'&&Math.hypot(b.e.x-x,b.e.z-z)<1.35);};
   stepEcology(e,s,p,dt,terrain,clear);root.position.set(e.x,e.y,e.z);root.rotation.set(e.pitch,e.yaw,e.bank,'YXZ');const clip=s.clips[e.state]||s.clips.move;if(rig.current!==clip)rig.play(clip,{fade:.4,loop:true});const layer=rig.layers.find(l=>l.target===1);if(layer&&s.kind==='land'&&e.state==='move')layer.speed=clamp(e.speed/1.8,.1,1.4);rig.update(dt);
  }
 }
 register(director,player){if(!this.grotto)return;const site=GROTTO_SITE,p=player.position,target={x:site.x,y:site.y,z:site.z-5};if(horizontal(p,target)>2.5||Math.abs(p.y-target.y)>1.8)return;if(strikeLineBlocked(this.app.colliders,{x:p.x,y:p.y+1,z:p.z},{...target,y:target.y+1},.2))return;director.add({id:'v74:grotto-survey',position:target,range:2.5,priority:92,label:'钟影岩廊 · E 记录岩层',perform:()=>{let seen=!!this.grottoSurveyed;try{seen=seen||localStorage.getItem('stormwake:v74:grotto')==='1';if(!seen)localStorage.setItem('stormwake:v74:grotto','1');}catch{}if(!seen){this.grottoSurveyed=true;this.a._reward(45,'land:v74:grotto','钟影岩廊调查完成，获得 45 金币。');}else this.a._message('岩层已记录。可由原入口返回北部古道。',5);}},player);}
}
