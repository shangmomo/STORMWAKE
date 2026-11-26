import {Group,Mesh,Vector3} from '../engine/index.js';
import {Material} from '../engine/render/Material.js';
import {box} from '../world/boat/GeoKit.js';
import {CABIN,cabinInput} from './AbyssCrewRules.js';
import {cutMetricOpening} from '../ship/MetricOpening.js';
export const HATCH=Object.freeze({half:.76,chamber:2.58,deck:4.50,inside:CABIN.floor,speed:1.25,cycle:1.4,oxygen:60,limit:.99});
export const HATCH_CUT=Object.freeze({min:[-HATCH.half,2.13,-HATCH.half],max:[HATCH.half,4.55,HATCH.half]});
export function canOpenHatch(raid){const p=raid.interior?.p,s=raid.pressure?.sections?.[1];return !!(raid.active&&raid.finished&&!raid.networkRaid&&!raid.app?.crew?.connected&&!raid.app?.voyageM1?.net?.connected&&raid.cameraMode==='interior'&&!raid.interior.station&&p&&Math.hypot(p.x,p.z)<=1.05&&s&&s.hp>=410&&s.water<=.12&&s.air>=.75&&Number.isFinite(raid.pos?.y)&&raid.pos.y>=-20&&raid.pos.y<=-11&&Math.abs(raid.speed)<=.4&&Math.abs(raid.diveVelocity)<=.15&&Math.abs(raid.pitch)<=.12&&Math.abs(raid.subRoll)<=.12);}
const approach=(x,target,d)=>x+Math.sign(target-x)*Math.min(Math.abs(target-x),d);
export class HatchCycleV83{
 constructor(){this.reset();}
 reset(){this.phase='idle';this.x=this.z=0;this.y=HATCH.inside;this.inner=false;this.outer=false;this.wet=false;this.timer=0;this.oxygen=HATCH.oxygen;}
 get active(){return this.phase!=='idle';}
 start(p){if(this.active||!p||!Number.isFinite(p.x)||!Number.isFinite(p.z)||Math.hypot(p.x,p.z)>1.05)return false;this.reset();this.x=p.x;this.z=p.z;this.phase='align-in';return true;}
 requestReturn(){if(this.phase!=='outside')return false;this.phase='align-out';return true;}
 step(dt,{dx=0,dz=0}={}){dt=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0));const move=y=>{this.y=approach(this.y,y,HATCH.speed*dt);return Math.abs(this.y-y)<1e-8;},align=()=>{this.x=approach(this.x,0,dt*1.35);this.z=approach(this.z,0,dt*1.35);return Math.abs(this.x)+Math.abs(this.z)<1e-8;};
  switch(this.phase){case'align-in':if(align()){this.inner=true;this.phase='climb-in';}break;
   case'climb-in':if(move(HATCH.chamber)){this.inner=false;this.phase='flood';this.timer=HATCH.cycle;}break;
   case'flood':if((this.timer-=dt)<=0){this.wet=true;this.outer=true;this.phase='climb-out';}break;
   case'climb-out':if(move(HATCH.deck)){this.outer=false;this.phase='outside';}break;
   case'outside':this.x=Math.max(-HATCH.limit,Math.min(HATCH.limit,this.x+(Number.isFinite(dx)?Math.max(-.1,Math.min(.1,dx)):0)));this.z=Math.max(-HATCH.limit,Math.min(HATCH.limit,this.z+(Number.isFinite(dz)?Math.max(-.1,Math.min(.1,dz)):0)));if((this.oxygen-=dt)<=0)this.requestReturn();break;
   case'align-out':if(align()){this.outer=true;this.phase='descend-out';}break;
   case'descend-out':if(move(HATCH.chamber)){this.outer=false;this.phase='drain';this.timer=HATCH.cycle;}break;
   case'drain':if((this.timer-=dt)<=0){this.wet=false;this.inner=true;this.phase='descend-in';}break;
   case'descend-in':if(move(HATCH.inside)){this.inner=false;this.reset();}break;
  }
 }
}
export class AbyssHatchV83{
 constructor(sub){this.sub=sub;this.root=new Group();this.root.name='V83 pressure lock and inspection balcony';sub.add(this.root);this.cycle=new HatchCycleV83();this.ready=false;const steel=new Material({color:0x354f58,roughness:.62,metalness:.6,underwaterLighting:'none'}),trim=new Material({color:0xaf8a4d,metalness:.6,roughness:.45,underwaterLighting:'none'}),deck=new Material({color:0x435c60,roughness:.72,metalness:.35,underwaterLighting:'none'});
  const p=(w,h,d,x,y,z,m=steel,parent=this.root)=>{const o=new Mesh(box(w,h,d),m);o.position.set(x,y,z);parent.add(o);return o;};
  // Actual 1.52m clear shaft. Closed gates slide sideways into boxed pockets.
  const mid=(2.3+HATCH.deck)/2;for(const s of [-1,1]){p(.18,2.22,1.88,s*.85,mid,0);p(1.52,2.22,.18,0,mid,s*.85);p(.28,.14,1.9,s*.9,2.32,0,trim);p(.28,.14,1.9,s*.9,4.44,0,trim);}
  this.inner=p(1.53,.14,1.53,0,2.37,0,trim);this.outer=p(1.53,.14,1.53,0,4.43,0,trim);
  // Rail feet stand on the continuous platform, with a real opening at centre.
  for(const s of [-1,1]){p(.66,.18,2.84,s*1.09,4.41,0,deck);p(1.52,.18,.66,0,4.41,s*1.09,deck);p(.12,1.05,2.84,s*1.39,5.025,0,trim);p(2.84,1.05,.12,0,5.025,s*1.39,trim);}
  this.ladder=new Group();this.root.add(this.ladder);for(const s of [-1,1])p(.07,6.4,.07,s*.52,1.3,-.61,trim,this.ladder);for(let y=-1.65;y<=4.4;y+=.3)p(1.04,.07,.10,0,y,-.61,trim,this.ladder);this.sync(false);
 }
 install(root){const r=cutMetricOpening(root,{group:this.sub},HATCH_CUT);this.ready=r.affected>0;return r;}
 get active(){return this.cycle.active;}
 get wetView(){return this.active&&this.cycle.wet;}
 reset(){this.cycle.reset();this.sync(false);}
 start(raid){return this.ready&&canOpenHatch(raid)&&this.cycle.start(raid.interior.p);}
 sync(inside){const s=this.cycle;this.root.visible=true;this.inner.visible=!s.inner;this.outer.visible=!s.outer;this.ladder.visible=s.active;}
 step(raid,dt,input,look){const c=this.cycle,interior=raid.interior;const dx=Number.isFinite(look.x)?look.x:0,dy=Number.isFinite(look.y)?look.y:0;interior.yaw=Math.atan2(Math.sin(interior.yaw-dx*.0025*raid.mouseSensitivity*(raid.invertX?-1:1)),Math.cos(interior.yaw-dx*.0025*raid.mouseSensitivity*(raid.invertX?-1:1)));interior.pitch=Math.max(-1.1,Math.min(1.1,interior.pitch+dy*.0023*raid.mouseSensitivity*(raid.invertY?-1:1)));const d=input.enabled&&!input.gameplayBlocked?cabinInput({up:input.down('KeyW'),down:input.down('KeyS'),left:input.down('KeyA'),right:input.down('KeyD')},interior.yaw,dt):{};c.step(dt,d);interior.p={x:c.x,z:c.z};this.sync(true);const high=c.active&&c.y+1.65>2.56;interior.root.visible=!high;if(raid.subAsset?.root)raid.subAsset.root.visible=high;}
 pose(interior){const c=this.cycle,p=new Vector3(c.x,c.y+1.65,c.z),t=p.clone().add(new Vector3(Math.sin(interior.yaw)*Math.cos(interior.pitch),-Math.sin(interior.pitch),Math.cos(interior.yaw)*Math.cos(interior.pitch)));return {position:this.sub.localToWorld(p),target:this.sub.localToWorld(t)};}
 status(){const c=this.cycle;return c.phase==='outside'?`舱外检修平台 · 氧气 ${Math.ceil(Math.max(0,c.oxygen))}s · O 返回气密舱`:`气密舱 · ${({'align-in':'进入梯位','climb-in':'爬升','flood':'充水均压','climb-out':'爬向外平台','align-out':'返回梯位','descend-out':'下降','drain':'排水均压','descend-in':'返回舱内'})[c.phase]||'待命'}`;}
}
