// Optional CC BY 4.0 T. rex asset. No placeholder, no remote game-time requests.
// Asset calibration is fail-closed: unknown rigs remain unavailable, not invisible enemies.
import {Group,Vector3} from '../engine/index.js';
import {loadGLB} from '../engine/loaders/GLTF.js';
import {SkinnedModel} from '../engine/render/Skinning.js';
import {sweptBladeContact,strikeLineBlocked} from './LandCombatTiming.js';
import {REX,newRex,advanceRex} from './RexBrain.js';
import {REX_CLIPS,BITE_FRAME,adaptRexAsset,makeMouthAnchors,mouthWorld,mouthHits} from './RexAsset.js';
const BASE=(import.meta.env?.BASE_URL||'/')+'models/land/';
const SAVE='stormwake:trex:v71';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function nodeNames(rig){return rig.gltf.skins[0].joints.map(i=>rig.gltf.nodes[i].name).filter(Boolean);}
function chooseBone(names,patterns){for(const p of patterns){const n=names.find(v=>p.test(v));if(n)return n;}return null;}
function modelBounds(rig){
 const lo=new Vector3(Infinity,Infinity,Infinity),hi=new Vector3(-Infinity,-Infinity,-Infinity),pt=new Vector3();
 const M=rig.jointData;
 for(const n of rig.gltf.nodes){if(n.skin!==0||n.mesh==null)continue;for(const p of rig.gltf.meshes[n.mesh]){
  const v=p.attributes.POSITION.array,j=p.attributes.JOINTS_0.array,w=p.attributes.WEIGHTS_0.array;
  const norm=w instanceof Uint8Array?255:w instanceof Uint16Array?65535:1;
  for(let i=0;i<v.length/3;i+=2){let x=0,y=0,z=0,sum=0;for(let k=0;k<4;k++){const a=w[i*4+k]/norm,b=j[i*4+k]*16;if(a<=0)continue;const vx=v[i*3],vy=v[i*3+1],vz=v[i*3+2];x+=(M[b]*vx+M[b+4]*vy+M[b+8]*vz+M[b+12])*a;y+=(M[b+1]*vx+M[b+5]*vy+M[b+9]*vz+M[b+13])*a;z+=(M[b+2]*vx+M[b+6]*vy+M[b+10]*vz+M[b+14])*a;sum+=a;}if(sum>.5){pt.set(x/sum,y/sum,z/sum);lo.min(pt);hi.max(pt);}}
 }}
 return {lo,hi};
}
export function calibrateRex(rig){
 const names=nodeNames(rig),head=chooseBone(names,[/(^|[_. -])head$/i,/skull/i,/head/i]),hip=chooseBone(names,[/pelvis/i,/(^|[_. -])hips?$/i,/hip/i]),tail=chooseBone(names,[/tail[_. -]?0?1$/i,/tail/i]);
 if(!head||!hip||!tail)throw Error('T. rex head/hip/tail joint names could not be safely calibrated');
 const H=rig.nodeWorld(head,new Vector3()),P=rig.nodeWorld(hip,new Vector3()),T=rig.nodeWorld(tail,new Vector3());
 const {lo,hi}=modelBounds(rig),span=hi.clone().sub(lo),length=Math.max(span.x,span.z);
 if(!Number.isFinite(length)||length<.1||length>100||span.y/length<.12||span.y/length>.8||distance(H,T)<length*.15)throw Error('T. rex model bounds inconsistent');
 const yaw=-Math.atan2(H.x-T.x,H.z-T.z),scale=12/length;
 const anchor=P.clone().applyAxisAngle(new Vector3(0,1,0),yaw).multiplyScalar(scale);
 rig.group.scale.setScalar(scale);rig.group.rotation.y=yaw;rig.group.position.set(-anchor.x,-lo.y*scale,-anchor.z);
 const legs=names.filter(n=>/thigh|femur|ankle|shin|tibia|foot/i.test(n)).slice(0,12);
 return {head,hip,tail,legs,scale};
}
export class RexEncounter{
 constructor(adventure){this.a=adventure;this.app=adventure.app;this.e=newRex();this.status='missing';this.root=null;this.cylinders=[];try{this.e.dead=localStorage.getItem(SAVE)==='1';}catch{}
  if(typeof document==='undefined'||new URLSearchParams(location.search).get('coop')==='1')return;
  this.ready=this._load().catch(e=>{this.status='rejected';console.warn('[V72] T. rex not loaded:',e.message);return false;});
 }
 async _load(){const manifest=await fetch(BASE+'trex-v71.json');if(!manifest.ok)throw Error('Missing bundled T. rex manifest');const record=await manifest.json();if(record.file!=='trex-v71.glb'||record.license!=='CC-BY-4.0'||!record.sha256)throw Error('Invalid bundled T. rex manifest');
  const gltf=await loadGLB(BASE+record.file);if(gltf.skins.length!==1||gltf.skins[0].joints.length<30)throw Error('Unexpected T. rex rig');
  const clips=REX_CLIPS;if(Object.values(clips).some(n=>!gltf.animations.some(a=>a.name===n)))throw Error('Expected four authored clips missing');
  const rig=await SkinnedModel.create(adaptRexAsset(gltf),{maxTextureSize:2048});const calibration=calibrateRex(rig);this.mouth=makeMouthAnchors(rig);rig.play(clips.idle,{fade:.01});rig.update(0);
  this.rig=rig;this.clips=clips;this.calibration=calibration;this.root=new Group();this.root.name='V72 Animal Animator Tyrannosaurus rex';this.root.add(rig.group);this.root.visible=false;this.app.scene.add(this.root);
  for(const bone of [calibration.hip,...calibration.legs.filter(n=>/thigh|femur|shin|tibia/i.test(n)).slice(0,4)])this.cylinders.push({bone,c:this.app.colliders.addCylinder(0,0,bone===calibration.hip?1.2:.45,0,0,{solid:false,tag:'v71:rex-body'})});
  this.root.position.set(this.e.x,this._terrain(this.e.x,this.e.z),this.e.z);this.root.rotation.y=this.e.yaw;this._syncColliders(false);this.status='ready';return true;
 }
 _bone(name){const p=this.rig.nodeWorld(name,new Vector3());return p?this.rig.group.localToWorld(p):null;}
 _enable(on){if(this.root)this.root.visible=on;for(const {c} of this.cylinders)c.solid=on;}
 _terrain(x,z){return this.app.terrainData.heightAt(x,z);}
 update(dt,active){if(this.status!=='ready'||this.e.dead||!this.a.fossilSurvey?.state.returned){this._enable(false);return;}
  const p=this.app.player.position,e=this.e,near=distance(p,e)<100;this._enable(near);if(!near){this.rig.hold();return;}
  // Disable our own moving contact proxies while checking other obstacles.
  for(const {c} of this.cylinders)c.solid=false;
  if(!active){this._syncColliders(true);this.rig.hold();return;}
  const result=advanceRex(e,p,dt,{canMove:(x,z)=>{const h=this._terrain(x,z);if(Math.abs(h-this._terrain(e.x,e.z))>.3)return false;const q=new Vector3(x,h,z);this.app.colliders.resolveCapsule(q,1.25,3.2,.25);return distance(q,{x,z})<.12;}});
  const clip=this.clips[result.style]||this.clips.idle;
  if(e.state==='windup'&&this.lastSerial!==e.serial+1){
   this.lastSerial=e.serial+1;this.attackLayer=this.rig.play(this.clips.attack,{fade:.10,loop:false,speed:BITE_FRAME/Math.max(.1,e.timer),from:0});
   // play() can return an existing layer; explicitly restart the authored clip.
   this.attackLayer.time=0;this.attackLayer.ended=false;
  }else if(result.style!=='attack'&&this.rig.current!==clip){this.rig.play(clip,{fade:.25});this.attackLayer=null;}
  this.root.position.set(e.x,this._terrain(e.x,e.z),e.z);this.root.rotation.y=e.yaw;
  if(result.strike&&this.attackLayer){this.attackLayer.time=BITE_FRAME;this.rig.update(0);this.attackLayer.speed=(this.rig.clipDuration(this.clips.attack)-BITE_FRAME)/REX.recover;}
  else this.rig.update(dt);
  this._syncColliders(true);
  if(result.strike){const points=mouthWorld(this.rig,this.mouth),target={x:p.x,y:p.y+1.1,z:p.z};if(mouthHits(points,p)&&!this._blocked(points[1],target))this.a._takeDamage(REX.biteDamage*(e.phase===2?1.15:1));}
 }
 _syncColliders(on){for(const {bone,c} of this.cylinders){const b=this._bone(bone);if(!b)continue;c.x=b.x;c.z=b.z;c.yMin=Math.max(this.root.position.y,b.y-(bone===this.calibration.hip?1.3:.7));c.yMax=b.y+(bone===this.calibration.hip?1.1:.65);c.solid=on;}}
 _blocked(origin,target){const c=Object.create(this.app.colliders);c.cylinders=this.app.colliders.cylinders.filter(x=>x.tag!=='v71:rex-body');return strikeLineBlocked(c,origin,target);}
 strike(swing,p,direction){if(this.status!=='ready'||!this.root?.visible||this.e.dead||swing.targetsHit.has('v71:rex'))return false;
  const attacker={x:p.x,y:p.y+1,z:p.z};for(const name of [this.calibration.hip,...this.calibration.legs,this.calibration.head,this.calibration.tail]){const b=this._bone(name);if(!b||!sweptBladeContact(swing,attacker,direction,b,name===this.calibration.hip?1.3:.8)||this._blocked(attacker,b))continue;
   swing.targetsHit.add('v71:rex');this.e.hp=Math.max(0,this.e.hp-swing.damage*(this.e.state==='recover'?1.35:1));if(this.e.hp===0){this.e.dead=true;this._enable(false);try{localStorage.setItem(SAVE,'1');}catch{}this.a._reward(350,'land:v71:rex','暴龙已击败，获得 350 金币。');}return true;
  }return false;
 }
 reset(){if(!this.e.dead){this.e=newRex();this.lastSerial=-1;this.attackLayer=null;if(this.rig)this.rig.play(this.clips.idle,{fade:.1});this._enable(false);}}
 journal(p){if(this.status!=='ready'||!this.a.fossilSurvey?.state.returned||this.e.dead)return null;return {task:'化石谷远征 · 追踪暴龙（单人）',distance:Math.round(distance(p,REX.home))};}
 hud(p){if(this.root?.visible&&!this.e.dead&&distance(p,this.e)<35)return `暴龙 · HP ${Math.ceil(this.e.hp)}/${REX.hp} · ${this.e.state==='windup'?'蓄力：咬击':this.e.state==='recover'?'收招窗口':this.e.state==='return'?'归巢':'保持距离'}`;return null;}
}
