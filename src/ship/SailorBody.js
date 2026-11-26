import {Group,Mesh,Vector3,Quaternion,Matrix4} from '../engine/index.js';
import {loadLandRig,playLandRigAction} from '../land/LandRigRuntime.js';
import {LandFootPlant} from '../land/LandGrounding.js';
import {attachPirateStyle} from '../land/LandPirateStyle.js';
import {RigTwoBoneIK} from './RigTwoBoneIK.js';
import {stationHandTargets} from './StationHandRig.js';
import {prepare,mergePrepared,box,cylinder,sphere,torus,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
const X=new Vector3(1,0,0),Z=new Vector3(0,0,1);
const piece=(g,color,x=0,y=0,z=0)=>prepare(g,{color,rough:.8,matrix:mat4(x,y,z)});
function tool(kind){const a=[];
 if(kind==='cutlass')a.push(piece(cylinder(.025,.025,.18,8),0x513d2e,0,-.05),piece(box(.21,.035,.045),0xb99b58,0,.06),piece(box(.055,.68,.025),0xb7cbce,0,.42));
 if(kind==='polearm')a.push(piece(cylinder(.025,.025,1.55,8),0x735039,0,.46),piece(cylinder(0,.06,.34,6),0xb7cbce,0,1.35));
 if(kind==='rod')a.push(piece(cylinder(.016,.035,1.5,8),0x826342,0,.45),piece(torus(.075,.018,6,12),0xb99b58,.08,.1),piece(cylinder(.004,.004,.85,5),0xb3b19b,.05,.75,.03));
 if(kind==='plank')a.push(piece(box(.7,.08,.16),0x936c43));
 if(kind==='hammer')a.push(piece(cylinder(.018,.018,.25,8),0x815b35,0,-.1),piece(box(.16,.07,.07),0x4c5659,0,-.24));
 if(kind==='bucket')a.push(piece(cylinder(.2,.15,.3,12),0x7d6549,0,-.35),piece(torus(.2,.02,8,18),0xb8a478,0,-.15));
 if(kind==='cannonball'||kind==='chainshot'){a.push(piece(sphere(.16,12,8),0x30373c,0,.07));if(kind==='chainshot')a.push(piece(box(.3,.03,.035),0x9ba6aa,0,.07));}
 if(kind==='spyglass')a.push(piece(cylinder(.045,.065,.38,10),0xb99550,0,.18),piece(cylinder(.051,.051,.025,10),0x426e78,0,.38));
 if(kind==='lantern')a.push(piece(cylinder(.09,.09,.23,10),0xb39051,0,-.19),piece(sphere(.055,8,6),0xf7cb78,0,-.19),piece(torus(.075,.012,6,12),0x8e794b,0,-.035));
 if(kind==='shovel')a.push(piece(cylinder(.018,.018,.65,8),0x745738,0,-.18),piece(box(.19,.23,.035),0x7f9198,0,-.59));
 const mesh=new Mesh(mergePrepared(a),landMaterial);mesh.castShadow=true;mesh.visible=false;return mesh;
}
export class SailorBody{
 constructor(parent,{slot='captain',style=0}={}){this.root=new Group();this.root.name='V63 articulated sailor '+slot;this.root.visible=false;parent.add(this.root);this.slot=slot;this.style=style;this.clock=0;this.activity='idle';this.handErrors=[];this.ready=false;this.disposed=false;if(typeof document!=='undefined')this.loading=this.load().catch(e=>console.warn('[STORMWAKE] sailor body unavailable',e));}
 async load(){const actor=await loadLandRig(this.slot);if(!actor)throw Error('Missing bundled adult sailor rig');if(this.disposed){actor.rig.dispose();return;}this.install(actor);}
 install(actor){this.actor=actor;this.root.add(actor.rig.group);this.feet=new LandFootPlant(actor.rig);this.feet.update(0);this.styleRig=attachPirateStyle(actor,this.style);if(this.styleRig)this.styleRig.coat.visible=false;
  const nodes=actor.rig.gltf.nodes;this.bones=new Map(nodes.map((n,i)=>[n.name,i]));this.spine=['Torso','Spine','Chest'].find(n=>this.bones.has(n));this.head=['Head','head'].find(n=>this.bones.has(n));this.hands=['L','R'].map(side=>nodes.find(n=>new RegExp('^(Palm|Fist|Hand)[._]'+side+'$','i').test(n.name))?.name);this.ik=this.hands.map((hand,i)=>new RigTwoBoneIK(actor.rig,['UpperArm.'+(i?'R':'L'),'LowerArm.'+(i?'R':'L'),hand]));
  this.ik[0].evaluate(actor.rig.rest,new Matrix4());this.restAxes=this.ik[0].matrices.map(m=>this.ik[0].rotation(m).invert());
  this.tools=new Map(['cutlass','polearm','rod','plank','hammer','bucket','cannonball','chainshot','spyglass','lantern','shovel'].map(k=>{const mesh=tool(k);actor.rig.group.add(mesh);mesh.scale.setScalar(1/actor.rig.group.scale.x);return [k,mesh];}));const prior=actor.rig.poseModifier;actor.rig.poseModifier=(local,rest)=>{prior?.(local,rest);this.pose(local);};this.ready=true;
 }
 turn(local,name,axis,angle){const i=this.bones.get(name);if(i===undefined||!angle)return;const q=new Quaternion().fromArray(local[i].r).multiply(new Quaternion().setFromAxisAngle(axis.clone().applyQuaternion(this.restAxes[i]),angle));local[i].r.set([q.x,q.y,q.z,q.w]);}
 pose(local){const state=this.activity,c=this.context||{},phase=this.clock*6,turn=(name,a)=>this.turn(local,name,X,a),crouch=this.crouchBlend||0;
  if(crouch){for(const side of ['L','R']){turn('UpperLeg.'+side,-1.15*crouch);turn('LowerLeg.'+side,2.3*crouch);turn('Foot.'+side,-1.15*crouch);}turn(this.spine,.55*crouch);turn(this.head,-.18*crouch);}
  if(state==='climb'){for(const [i,side] of ['L','R'].entries()){const wave=Math.sin(phase+i*Math.PI);turn('UpperArm.'+side,-1.2+wave*.28);turn('LowerArm.'+side,-.8);turn('UpperLeg.'+side,wave*.55);turn('LowerLeg.'+side,-.45+Math.max(0,wave)*.35);}}
  else if(state==='swim'){for(const [i,side]of ['L','R'].entries()){turn('UpperArm.'+side,Math.sin(phase+i*Math.PI)*.8);turn('LowerArm.'+side,-.4);turn('UpperLeg.'+side,Math.sin(phase*1.6+i*Math.PI)*.3);}}
  else if(state==='jump'||state==='fall'){turn('UpperLeg.L',.65);turn('UpperLeg.R',.3);turn('LowerLeg.L',-.9);turn('LowerLeg.R',-.7);for(const side of ['L','R'])turn('UpperArm.'+side,-.55);}
  else if(state==='capstan'&&c.working){for(const [i,side]of ['L','R'].entries()){this.turn(local,'UpperLeg.'+side,Z,Math.sin(phase+i*Math.PI)*.28);turn('LowerLeg.'+side,Math.max(0,Math.sin(phase+i*Math.PI))*.32);}}
  else if(state==='sail_pull'){for(const side of ['L','R']){turn('UpperArm.'+side,-.65-(c.working?.25*Math.sin(phase):0));turn('LowerArm.'+side,-.8-(c.working?.2*Math.sin(phase):0));}turn(this.spine,.12*Math.sin(phase));}
  else if(state==='cannon_load'||state==='cannon_aim'||state==='fire'){for(const side of ['L','R']){turn('UpperArm.'+side,-.65+(state==='fire'?.12:0));turn('LowerArm.'+side,-.75+(state==='cannon_load'?.25*Math.sin(phase):0));}}
  else if(state==='repair'){turn('UpperArm.R',-.65-.2*Math.sin(phase*1.8));turn('LowerArm.R',-.9-.3*Math.sin(phase*1.8));turn('UpperArm.L',-.65);turn('LowerArm.L',-.9);}
  else if(state==='bail'){turn('UpperArm.R',-.7-.55*Math.sin(phase));turn('LowerArm.R',-.5);turn(this.spine,.18+.15*Math.sin(phase));}
  else if(state==='recover'){turn(this.spine,.25*(1-Math.min(1,this.stateAge/.8)));}
  this.handErrors=[];this.handDiagnostics=[];let targets=c.station&&c.boat?stationHandTargets(c.boat,c.station):null;
  if(state==='carry'&&c.cargo){targets=[-.26,.26].map(x=>this.root.localToWorld(new Vector3(x,.85,.48)));}
  if(targets&&this.ik.every(ik=>ik.valid)){this.actor.rig.group.updateWorldMatrix(true,false);for(let i=0;i<2;i++){const pole=this.root.localToWorld(new Vector3(i?.7:-.7,1.05,.15)),result=this.ik[i].solve(local,this.actor.rig.group.matrixWorld,targets[i],pole);this.handErrors.push(result?.error??Infinity);this.handDiagnostics.push(result);}}
 }
 clip(state){const a=this.actor.actions,names=this.actor.rig.clipNames();if(['walk','run','sprint'].includes(state))return state==='walk'?'walk':'run';if(state==='sword_strike')return 'attack';if(state==='hit')return 'hit';if(state==='death')return 'death';if(state==='recover')return a.dodge?'dodge':'idle';if(['jump','land'].includes(state)){const name=names.find(n=>/jump/i.test(n));if(name){this.actor.actions.jump=name;return 'jump';}}return 'idle';}
 update(dt,{visible=true,activity='idle',...context}={}){this.root.visible=visible&&this.ready;if(!this.ready)return;this.context=context;this.clock+=Math.max(0,dt);if(activity==='helm')activity='steer';if(activity==='station')activity=context.station?.startsWith('anchor')?'capstan':'cannon_aim';if(this.activity!==activity){this.activity=activity;this.stateAge=0;const clip=this.actor.actions[this.clip(activity)]||this.actor.actions.idle,layer=this.actor.rig.play(clip,{fade:.15,loop:!['death','hit','recover'].includes(activity),speed:activity==='sprint'?1.35:1});layer.speed=activity==='sprint'?1.35:1;}this.stateAge=(this.stateAge||0)+dt;if(!visible){this.actor.rig.hold();return;}
  const wanted=context.crouched||activity==='crouch'?Math.min(1,Math.max(.1,(1.75-(context.poseHeight||1.02))/.7)):activity==='capstan'?.45:['repair','cannon_load','cannon_aim','fire','land'].includes(activity)?.36:0;this.crouchBlend=(this.crouchBlend||0)+(wanted-(this.crouchBlend||0))*(1-Math.exp(-Math.max(0,dt)*12));
  this.actor.rig.update(dt);const previousFootOffset=this.actor.rig.group.position.y;this.feet.update(dt,{moving:['walk','run','sprint','climb'].includes(activity),locomotion:!['jump','fall','swim','climb','death'].includes(activity),root:context.feet,yaw:context.yaw||0,groundProbe:context.groundProbe});if(this.crouchBlend>.02){const sole=this.feet.anchor.soleY();if(Number.isFinite(sole)){this.feet.offset=-sole*this.actor.rig.group.scale.y+.025;this.actor.rig.group.position.y=this.feet.offset;}}if(context.station&&Math.abs(previousFootOffset-this.actor.rig.group.position.y)>1e-6)this.actor.rig.update(0);this.styleRig?.update();this.attachTools(context);
 }
 attachTools(c){for(const mesh of this.tools.values())mesh.visible=false;let kind=c.supply||c.gear||'hands';if(c.station)kind='hands';if(this.activity==='repair')kind='hammer';if(this.activity==='death'||c.cargo)kind='hands';const attach=(name,side)=>{const mesh=this.tools.get(name),bone=this.hands[side];if(!mesh||!bone)return;const index=this.bones.get(bone);this.actor.rig.nodeWorld(bone,mesh.position);const matrix=new Matrix4().fromArray(this.actor.rig.world,index*16);matrix.decompose(new Vector3(),mesh.quaternion,new Vector3());mesh.visible=true;};attach(kind,1);if(this.activity==='repair')attach('plank',0);}
 dispose(){this.disposed=true;this.root.parent?.remove(this.root);for(const mesh of this.tools?.values()||[])mesh.geometry.dispose?.();this.actor?.rig.dispose();}
}
