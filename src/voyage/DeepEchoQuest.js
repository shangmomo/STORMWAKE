import {worldToShip,shipToWorld} from './CargoReach.js';
import {CABIN_COMPONENT} from './VoyageSites.js';
import {Vector3} from '../engine/math/Vector3.js';
import {movingJawHullContact,closestSegmentPoints} from '../oceanhunt/AbyssCombatPhysics.js';
import {stepSubmarineDynamics} from '../oceanhunt/SubmarineDynamics.js';
import {trenchDepthAt,DEEP_TRENCH} from '../world/DeepBathymetry.js';
export const DEEP_SAMPLE={x:-3180,y:-357,z:4900};
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const nearPort=p=>p.mode==='walk'&&Math.hypot(p.x-62,p.z+73)<4;
export class DeepEchoQuest{
 constructor(){this.phase='locked';this.parts=0;this.members=[];this.pilot=null;this.sub={x:75,y:-.5,z:42,yaw:0,speed:0,yawRate:0,rudder:0,pitch:0,subRoll:0,diveVelocity:0};this.clock=0;this.input={thrust:0,turn:0,ballast:0};this.inputUntil=0;this.hull=100;this.emergency=false;this.sample=0;this.sampleUntil=0;this.carrier=null;this.sonarUntil=0;this.sonarTier=0;this.torpedoes=[];this.ammo=8;this.shotUntil=0;this.monster={x:-3020,y:-270,z:4900,yaw:0,state:'patrol',timer:0,hp:500};this.contact=null;this.towOffset=null;this.cabinPositions={};this.cabinInputs=new Map();}
 serialize(){return {version:1,phase:this.phase,parts:this.parts,members:[...this.members],pilot:this.pilot,sub:{...this.sub},hull:this.hull,emergency:this.emergency,sample:this.sample,carrier:this.carrier,sonarUntil:this.sonarUntil,sonarTier:this.sonarTier,clock:this.clock,torpedoes:this.torpedoes.map(t=>({...t})),ammo:this.ammo,monster:{...this.monster},contact:this.contact,towOffset:this.towOffset,cabinPositions:structuredClone(this.cabinPositions)};}
 deserialize(s){if(s?.version!==1||!['locked','parts','prepared','diving','return','completed'].includes(s.phase)||!s.sub||!['x','y','z','yaw','speed'].every(k=>Number.isFinite(s.sub[k])))return false;for(const k of ['phase','parts','pilot','hull','emergency','sample','carrier','sonarUntil','sonarTier','clock','ammo','contact','towOffset','cabinPositions'])if(s[k]!==undefined)this[k]=s[k];this.sub={...s.sub};this.members=[...(s.members||[])];this.monster={...s.monster};this.torpedoes=(s.torpedoes||[]).map(t=>({...t}));return true;}
 unlock(a,b,c){if(this.phase==='locked'&&(a?.rewards>0||a?.phase==='completed')&&(b?.delivered>0||b?.phase==='completed')&&(c?.delivered>0||c?.phase==='completed')){this.phase='parts';this.parts=0;}}
 action(verb,p,mother,options={}){if(!p||!mother)return false;
  if(verb==='refit'&&nearPort(p)&&!this.members.length&&Math.hypot(mother.x-69.8,mother.z-42)<55&&(this.phase==='completed'||this.hull<=0)){this.phase='prepared';this.hull=100;this.ammo=8;this.sample=0;this.carrier=null;this.emergency=false;this.torpedoes=[];this.monster.hp=500;this.monster.state='patrol';this.monster.timer=0;return true;}
  if(verb==='take_part'&&this.phase==='parts'&&Number.isInteger(options.part)&&options.part>=0&&options.part<3&&!(this.parts&(1<<options.part))){const at=options.part===0?shipToWorld(mother,CABIN_COMPONENT):options.part===1?{x:56,y:1,z:-71}:{x:45,y:1,z:-80};const local=options.part===0?worldToShip(mother,p):null;const reached=options.part===0?p.mode==='deck'&&p.deckLayer==='hold'&&local&&Math.hypot(local.x-CABIN_COMPONENT.x,local.y-CABIN_COMPONENT.y,local.z-CABIN_COMPONENT.z)<2.2:p.mode==='walk'&&length(p,at)<3;if(reached){this.parts|=1<<options.part;return true;}}
  if(verb==='assemble'&&this.phase==='parts'&&this.parts===7&&nearPort(p)){this.phase='prepared';this.hull=100;this.ammo=8;return true;}
  if(verb==='board'&&['prepared','diving','return'].includes(this.phase)&&this.sub.y>-3&&length(p,{x:this.sub.x,y:this.sub.y+1,z:this.sub.z})<3&&!this.members.includes(p.id)&&this.members.length<4){this.cabinPositions[p.id]={x:this.members.length? (this.members.length%2?-.45:.45):0,z:this.members.length?-.6:.2};this.members.push(p.id);if(!this.pilot)this.pilot=p.id;if(this.carrier===p.id)this.carrier=null;return true;}
  if(!this.members.includes(p.id)){
   if(verb==='deliver'&&this.phase==='return'&&this.carrier===p.id&&nearPort(p)&&Math.hypot(mother.x-69.8,mother.z-42)<55){this.phase='completed';this.carrier=null;return true;}return false;
  }
  if(verb==='release_helm'&&p.id===this.pilot){this.pilot=null;this.inputUntil=0;return true;}
  if(verb==='take_helm'&&!this.pilot&&Math.hypot(this.cabinPositions[p.id]?.x||0,(this.cabinPositions[p.id]?.z||0)-.2)<.65){this.pilot=p.id;this.cabinPositions[p.id]={x:0,z:.2};return true;}
  if(verb==='cabin_move'&&p.id!==this.pilot&&Number.isFinite(options.x)&&Number.isFinite(options.z)&&Math.abs(options.x)<=1&&Math.abs(options.z)<=1){this.cabinInputs.set(p.id,{x:options.x,z:options.z,until:this.clock+.28});return true;}
  if(verb==='release'&&p.id===this.pilot&&this.phase==='prepared'&&Math.hypot(mother.x-DEEP_TRENCH.x,mother.z-DEEP_TRENCH.z)<1000){this.phase='diving';this.towOffset=null;return true;}
  if(verb==='control'&&p.id===this.pilot&&['diving','return'].includes(this.phase)&&['thrust','turn','ballast'].every(k=>Number.isFinite(options[k])&&Math.abs(options[k])<=1)){this.input={thrust:options.thrust*.08,turn:options.turn,ballast:options.ballast*.06};this.inputUntil=this.clock+.3;return true;}
  if(verb==='sonar'&&this.clock>=this.sonarUntil){this.sonarUntil=this.clock+(this.sonarTier?4:6);return true;}
  if(verb==='sample'&&this.phase==='diving'&&length(this.sub,DEEP_SAMPLE)<6&&Math.abs(this.sub.speed)<1){this.sampleUntil=this.clock+.28;return true;}
  if(verb==='torpedo'&&p.id===this.pilot&&['diving','return'].includes(this.phase)&&this.ammo>0&&this.clock>this.shotUntil){this.ammo--;this.shotUntil=this.clock+1.2;this.torpedoes.push({x:this.sub.x,y:this.sub.y,z:this.sub.z,vx:Math.sin(this.sub.yaw)*32,vy:0,vz:Math.cos(this.sub.yaw)*32,age:0});return true;}
  if(verb==='leave'&&this.sub.y>-2&&Math.abs(this.sub.speed)<1&&(this.sample<1||this.hull<=0||Math.hypot(this.sub.x-mother.x,this.sub.z-mother.z)<15)){this.members=this.members.filter(id=>id!==p.id);if(this.pilot===p.id)this.pilot=this.members[0]||null;if(this.sample>=1&&!this.carrier)this.carrier=p.id;if(!this.members.length&&Math.hypot(this.sub.x-mother.x,this.sub.z-mother.z)<15){const dx=this.sub.x-mother.x,dz=this.sub.z-mother.z,c=Math.cos(mother.yaw),s=Math.sin(mother.yaw);this.towOffset={x:c*dx-s*dz,y:this.sub.y-(mother.y||0),z:s*dx+c*dz};}return true;}
  if(verb==='emergency'){this.emergency=!this.emergency;return true;}return false;
 }
 update(dt,mother){dt=Math.max(0,Math.min(.1,dt));this.clock+=dt;this.contact=null;for(const id of this.members){const move=this.cabinInputs.get(id),position=this.cabinPositions[id]||={x:0,z:.2};if(id!==this.pilot&&move?.until>this.clock){const norm=Math.max(1,Math.hypot(move.x,move.z));position.x=Math.max(-.62,Math.min(.62,position.x+move.x/norm*dt*.8));position.z=Math.max(-.78,Math.min(.85,position.z+move.z/norm*dt*.8));}}
  if((this.phase==='prepared'||this.towOffset&&['return','completed'].includes(this.phase))&&mother){const tow=this.towOffset||{x:5,y:-.5,z:0};const c=Math.cos(mother.yaw),s=Math.sin(mother.yaw);this.sub.x=mother.x+c*tow.x+s*tow.z;this.sub.z=mother.z-s*tow.x+c*tow.z;this.sub.y=(mother.y||0)+tow.y;this.sub.yaw=mother.yaw;return;}
  if(!['diving','return'].includes(this.phase))return;
  const input=this.clock<this.inputUntil?{...this.input}:{thrust:0,turn:0,ballast:0};if(!this.members.length||this.hull<=0||this.emergency)Object.assign(input,{thrust:0,turn:0,ballast:.06});
  const steps=Math.max(1,Math.ceil(dt/.05)),h=dt/steps;for(let i=0;i<steps;i++){stepSubmarineDynamics(this.sub,input,h);const next={x:this.sub.x+Math.sin(this.sub.yaw)*this.sub.speed*h,z:this.sub.z+Math.cos(this.sub.yaw)*this.sub.speed*h};let floor=Math.max(-90-trenchDepthAt(next.x,next.z),-90-trenchDepthAt(next.x+Math.sin(this.sub.yaw)*5.4,next.z+Math.cos(this.sub.yaw)*5.4),-90-trenchDepthAt(next.x-Math.sin(this.sub.yaw)*5.4,next.z-Math.cos(this.sub.yaw)*5.4));
   if(this.sub.y<floor+2){this.sub.speed=0;this.hull=Math.max(0,this.hull-h*3);floor=-90-trenchDepthAt(this.sub.x,this.sub.z);}else{this.sub.x=next.x;this.sub.z=next.z;}
   this.sub.y=Math.max(floor+2,Math.min(-.5,this.sub.y+this.sub.diveVelocity*h));
  }
  if(this.sub.y> -1&&this.emergency)this.emergency=false;
  if(this.sampleUntil>this.clock&&this.phase==='diving'){this.sample=Math.min(1,this.sample+dt/4);if(this.sample>=1)this.phase='return';}
  const m=this.monster;m.timer+=dt;const d=length(m,this.sub);
  if(m.hp>0){if(m.state==='patrol'){m.x=-3180+160*Math.cos(this.clock/45);m.z=4900+160*Math.sin(this.clock/45);m.y=-260;m.yaw=this.clock/45+Math.PI;if(d<110){m.state='warning';m.timer=0;}}
   else if(m.state==='warning'){m.yaw=Math.atan2(this.sub.x-m.x,this.sub.z-m.z);m.pitch=Math.atan2(this.sub.y-m.y,Math.hypot(this.sub.x-m.x,this.sub.z-m.z));if(m.timer>2){m.state='commit';m.timer=0;}}
   else if(m.state==='commit'){const cos=Math.cos(m.pitch||0),sin=Math.sin(m.pitch||0),fx=Math.sin(m.yaw)*cos,fz=Math.cos(m.yaw)*cos;const before=new Vector3(m.x+fx*34.8,m.y+sin*34.8+1.5,m.z+fz*34.8);m.x+=fx*14*dt;m.y+=sin*14*dt;m.z+=fz*14*dt;const after=new Vector3(m.x+fx*34.8,m.y+sin*34.8+1.5,m.z+fz*34.8);const hit=movingJawHullContact(before,after,new Vector3(this.sub.x,this.sub.y,this.sub.z),new Vector3(Math.sin(this.sub.yaw),0,Math.cos(this.sub.yaw)),{mouthRadius:2.2,hullRadius:1.2,halfHull:5.4});if(hit.contact){this.hull=Math.max(0,this.hull-30);this.contact={x:hit.hull.x,y:hit.hull.y,z:hit.hull.z};m.state='recover';m.timer=0;}else if(m.timer>5){m.state='recover';m.timer=0;}}
   else if(m.state==='recover'&&m.timer>3){m.state='patrol';m.timer=0;}
  }
  for(const t of this.torpedoes){const before=new Vector3(t.x,t.y,t.z);t.age+=dt;t.x+=t.vx*dt;t.y+=t.vy*dt;t.z+=t.vz*dt;const f=new Vector3(Math.sin(m.yaw)*Math.cos(m.pitch||0),Math.sin(m.pitch||0),Math.cos(m.yaw)*Math.cos(m.pitch||0)).multiplyScalar(29),center=new Vector3(m.x,m.y,m.z);if(m.hp>0&&closestSegmentPoints(before,new Vector3(t.x,t.y,t.z),center.clone().sub(f),center.clone().add(f)).distance<6.1){m.hp=Math.max(0,m.hp-85);t.age=20;}}
  this.torpedoes=this.torpedoes.filter(t=>t.age<12);if(m.hp<=0)m.y-=dt*.8;
 }
 disconnect(id){delete this.cabinPositions[id];this.cabinInputs.delete(id);this.members=this.members.filter(x=>x!==id);if(this.pilot===id)this.pilot=this.members[0]||null;if(this.carrier===id)this.carrier=null;}
}
