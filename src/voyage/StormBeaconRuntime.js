import {StormBeaconQuest,BEACON,SHIPWRIGHT} from './StormBeaconQuest.js';
import {Group,Mesh,Vector3,Color} from '../engine/index.js';
import {box,cylinder,torus,prepare,mergePrepared,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
import {Material} from '../engine/render/Material.js';
export class StormBeaconRuntime{
 constructor(v){this.v=v;this.quest=new StormBeaconQuest();try{this.quest.deserialize(JSON.parse(localStorage.getItem('stormwake.m1.snapshot.v2')||'null')?.beacon||JSON.parse(localStorage.getItem('stormwake.beacon.v1')));}catch{}this.quest.consumePlank=()=>{if(v.equipment.planks<=0)return false;v.equipment.planks--;return true;};
  this.root=new Group();this.root.position.set(BEACON.x,0,BEACON.z);v.app.scene.add(this.root);
  const pieces=[prepare(cylinder(.4,.8,7,12),{color:0x5d5141,matrix:mat4(0,.5,0)}),prepare(torus(1,.08,8,24),{color:0xa37941,matrix:mat4(0,1,0,Math.PI/2)}),prepare(box(.55,.1,.45),{color:0x4e5b59,matrix:mat4(.65,-2,0)})];
  const body=new Mesh(mergePrepared(pieces),landMaterial);body.castShadow=true;this.root.add(body);
  this.lightMaterial=new Material({lit:false,color:0x232b2b});this.lamp=new Mesh(prepare(cylinder(.32,.32,.8,12)),this.lightMaterial);this.lamp.position.y=4.4;this.root.add(this.lamp);
  this.source=v.app.localLights?.add({position:new Vector3(BEACON.x,4.4,BEACON.z),color:new Color(1,.7,.3),intensity:150,range:45,alwaysOn:true,kind:'stormBeacon',enabled:false});
  v.app.colliders.addCylinder(BEACON.x,BEACON.z,.45,-3,4,{tag:'stormBeacon'});this.clock=0;
  if(v.hud){this.hud=document.createElement('div');this.hud.style.cssText='font-size:12px;max-width:310px;color:#c3d5dd';v.hud.append(this.hud);this.hud.addEventListener('click',e=>{const verb=e.target.dataset?.beacon;if(verb)this.action(verb);});}
 }
 action(verb){const v=this.v,options={tool:v.equipment.active};
  if(verb==='repair'&&v.equipment.planks<=0){v.toast('先从母船维修箱拿取木板');return;}if(v.net.connected){v.app.crew.sendMyPose?.(true);v.net.send('beacon_action',{verb,...options});return;}
  const old=this.quest.phase;if(this.quest.action(verb,v.cartographer.actor(),v.cartographer.ship(),options)){
   if(old==='return'&&this.quest.phase==='completed'){v.voyage.tideCoin+=320;v.voyage.repLighthouse+=2;v.voyage.persist();}
   if(verb.startsWith('route_'))v.app.oceanChart?.setFreeTarget(this.quest.waypoints[0]);if(verb!=='repair')this.persist();
  }
 }
 persist(){this.v._persistCargo();try{localStorage.setItem('stormwake.beacon.v1',JSON.stringify(this.quest.serialize()));}catch{}}
 candidates(){const p=this.v.app.player,q=this.quest,a=[];
  const add=(verb,label,pos,r)=>{if(Math.hypot(p.position.x-pos.x,p.position.y-pos.y,p.position.z-pos.z)<r)a.push({id:'beacon_'+verb,label,position:pos,range:r,priority:verb==='accept'?55:270,perform:()=>this.action(verb)});};
  if(['offer','completed'].includes(q.phase))add('accept','[E] 船匠委托：修复失联风暴航标',SHIPWRIGHT,4);
  if(q.phase==='sailing')add(q.progress<1?'repair':'fit_wick',q.progress<1?'[按住 E] 用木板修复航标接口':'[E] 更换灯芯并重新点灯',BEACON,2.2);
  if(q.phase==='return')add('deliver','[E] 向船匠交付航标修复结果',SHIPWRIGHT,4);return a;
 }
 update(dt){const q=this.quest,v=this.v;if(!v.net.connected)q.update(dt,v.cartographer.ship());if(q.phase==='sailing'&&q.routeIndex!==this._routeIndex){this._routeIndex=q.routeIndex;if(v.net.isHost)v.app.oceanChart?.setFreeTarget(q.waypoints[q.routeIndex]);}this.clock-=dt;
  if(q.phase==='sailing'&&q.progress<1&&v.isHeldInteraction('beacon_repair',this.candidates())&&this.clock<=0){this.action('repair');this.clock=.12;}
  this.saveClock=(this.saveClock||0)-dt;if(this.saveClock<=0&&!v.net.connected){this.saveClock=1;this.persist();}
  const on=['return','completed'].includes(q.phase);this.lightMaterial.uniforms.color.value.set(on?0xffd38a:0x232b2b);this.lightMaterial.uniforms.emissive.value.set(on?0xffba53:0);
  if(this.source)this.source.enabled=on;
  if(this.hud){const text=q.phase==='offer'?'码头船匠发布风暴航标委托':q.phase==='route'?'返回船长室图台选择航路':q.phase==='sailing'?`航标 (-800,2250) · 接口修复 ${Math.round(q.progress*100)}% · 水下 2 米，装备木板`:q.phase==='return'?'航标已点亮，返港找船匠交付':'风暴航标委托完成';
   const route=q.phase==='route'&&v.app.player.deckLayer==='hold';
   if(this._text!==text||this._route!==route){this._text=text;this._route=route;this.hud.innerHTML='风暴航标 · '+text+(route?'<div><button data-beacon="route_coast">沿岸绕行</button><button data-beacon="route_direct">风暴捷径</button></div>':'');}
  }
 }
}
