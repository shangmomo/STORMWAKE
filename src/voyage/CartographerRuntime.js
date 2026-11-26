import {QuestBuoyancy} from './QuestBuoyancy.js';
import {sightActionPoint} from './SightActionPoint.js';
import {CartographerScenery} from '../world/CartographerScenery.js';
import {HARPOON_ROPE,HAUL_BOX_SITE} from '../ship/ArsenalSites.js';
import {CartographerQuest,CARTOGRAPHER as C} from './CartographerQuest.js';
import {Group,Mesh,Vector3} from '../engine/index.js';import {box,cylinder,prepare,mergePrepared,mat4} from '../world/boat/GeoKit.js';import {landMaterial} from '../land/LandModels.js';
const labels={offer:'船长室地图台：失踪海图师的信件',accepted:'前往近岸航路 (130,760)，举望远镜寻找漂流箱，按 E 确认',spotted:'低速靠近漂流箱；船首鱼叉旁瞄准箱子，E 发射',flying:'鱼叉飞行中',latched:'船首鱼叉旁按住 E 绞回，距离过远会断索',salvaged:'下水寻找原沉没点 (130,760) 水下 4 米的日志',log_held:'携日志返回船长室地图台，E 阅读',island:'日志指向灰苔岛登陆点 (-430,430)，上岸调查标记',return:'带回测绘结果，返港找商人交付',completed:'海图师航程完成；地图台可再次接取'};
const prop=(w,h,d,color)=>new Mesh(prepare(box(w,h,d),{color}),landMaterial);
export class CartographerRuntime{
 constructor(v){this.v=v;this.buoyancy=new QuestBuoyancy(v,'cartographerCrate','cartographer_action');this.quest=new CartographerQuest();try{const joint=JSON.parse(localStorage.getItem('stormwake.m1.snapshot.v2')||'null');this.quest.deserialize(joint?.cartographer||JSON.parse(localStorage.getItem('stormwake.cartographer.v1')));}catch{}
 this.crate=prop(1.1,.7,.75,0x775237);this.letter=prop(.34,.015,.25,0xe6cf96);this.log=prop(.28,.12,.36,0x5b4635);this.marker=prop(.45,1.2,.3,0x9f8952);v.app.scene.add(this.crate,this.letter,this.log,this.marker);
 this.rope=new Mesh(prepare(cylinder(.018,.018,1,6),{color:0x806744}),landMaterial);this.rope.frustumCulled=false;v.app.scene.add(this.rope);this.saveClock=0;this.reelClock=0;this.scenery=new CartographerScenery(v.app,C.site,C.island);this.sceneClock=0;
 if(v.hud){this.hud=document.createElement('div');this.hud.style.cssText='font-size:12px;max-width:310px;padding:6px 0;color:#e7d6a3';v.hud.append(this.hud);}
 }
 ship(){const b=this.v.app.boatCtl;return {x:b.position.x,y:b.position.y,z:b.position.z,speed:Math.hypot(b.velocity.x,b.velocity.z),yaw:b.getYaw(),rotation:{x:b.quaternion.x,y:b.quaternion.y,z:b.quaternion.z,w:b.quaternion.w}};}
 actor(){const p=this.v.app.player;return {id:this.v.actorId,...p.position,mode:p.mode,deckLayer:p.deckLayer};}
 action(verb){const v=this.v,p=v.app.player,dir=p.getViewDir(new Vector3()),options={direction:{x:dir.x,y:dir.y,z:dir.z},spyglass:v.equipment.active==='spyglass'&&!!v.equipment.raised};
 if(v.net.connected){v.app.crew.sendMyPose?.(true);v.net.send('cartographer_action',{verb,...options});return;}
 const before=this.quest.phase;if(this.quest.action(verb,this.actor(),this.ship(),options)){if(before==='return'&&this.quest.phase==='completed'){v.voyage.tideCoin+=240;v.voyage.repGoldTide+=2;v.voyage.persist();}if(verb!=='reel')this.persist();}}
 persist(){this.v._persistCargo();try{localStorage.setItem('stormwake.cartographer.v1',JSON.stringify(this.quest.serialize()));}catch{}}
 candidates(){const q=this.quest,v=this.v,p=v.app.player;if(p.stationId)return [];const table=v.localWorld(C.table),gun=v.localWorld(C.harpoon),entries=[];const add=(verb,label,point,range)=>{if(Math.hypot(point.x-p.position.x,point.y-p.position.y,point.z-p.position.z)<range)entries.push({id:'cartographer_'+verb,label,position:point,range,priority:260,perform:()=>this.action(verb)});};
 if(p.mode==='deck'&&p.deckLayer==='hold'&&['offer','completed'].includes(q.phase))add('accept','[E] 阅读信件并接取：失踪的海图师',table,2.2);
 if(q.phase==='accepted'&&v.equipment.active==='spyglass'&&v.equipment.raised)add('spot','[E] 确认望远镜中的漂流线索',sightActionPoint(p),1);
 if(q.phase==='spotted')add('fire','[E] 发射鱼叉：准星对准漂流箱',gun,2.1);
 if(q.phase==='latched')add('reel','[按住 E] 绞回漂流箱',gun,2.1);
 if(q.phase==='salvaged'&&p.mode==='swim')add('take_log','[E] 取回水下航海日志',C.log,2.2);
 if(q.phase==='log_held'&&q.logActor===v.actorId&&p.mode==='deck'&&p.deckLayer==='hold')add('read_log','[E] 将日志放到图台阅读',table,2.2);
 if(q.phase==='island'&&p.mode==='walk')add('inspect','[E] 调查海图师留下的测绘标记',this.marker.position,3);
 if(q.phase==='return'&&p.mode==='walk')add('deliver','[E] 交付测绘结果 · 240 潮币',C.broker,4);return entries;
 }
 update(dt){const v=this.v,q=this.quest,p=v.app.player;this.buoyancy.update(dt,q);this.sceneClock+=dt;this.scenery.update(this.sceneClock,p.position);if(q.phase!==this.lastPhase){this.lastPhase=q.phase;const destination={accepted:C.site,island:C.island,return:{x:69.8,z:42}}[q.phase];if(destination&&v.net.isHost)v.app.oceanChart?.setFreeTarget(destination);}if(!v.net.connected)q.update(dt,this.ship());this.reelClock-=dt;if(q.phase==='latched'&&v.isHeldInteraction('cartographer_reel',this.candidates())&&this.reelClock<=0){this.action('reel');this.reelClock=.12;}
 if(p.mode==='deck'&&['spotted','flying','latched'].includes(q.phase)){const direction=p.getViewDir(new Vector3());v.app.hunt?.deckArsenal.aimHarpoon(q.shot?.direction?new Vector3(q.shot.direction.x,q.shot.direction.y,q.shot.direction.z):direction);}
 this.crate.visible=!['offer','completed'].includes(q.phase);if(['salvaged','log_held','island','return'].includes(q.phase)){this.crate.position.copy(v.localWorld(HAUL_BOX_SITE));this.crate.quaternion.copy(v.app.boatCtl.quaternion);}else{this.crate.quaternion.identity();this.crate.position.set(q.crate.x,q.crate.y,q.crate.z);}this.letter.position.copy(v.localWorld(C.table));this.letter.quaternion.copy(v.app.boatCtl.quaternion);
 this.log.visible=q.phase==='salvaged'||q.phase==='log_held';const peer=q.logActor===v.actorId?p.position:v.app.crew?.peers?.get(q.logActor)?.root?.position;this.log.position.copy(q.phase==='log_held'&&peer?peer:C.log);if(q.phase==='log_held')this.log.position.y+=.55;
 this.marker.visible=q.phase==='island';this.marker.position.set(C.island.x,v.app.terrainData.heightAt(C.island.x,C.island.z)+.6,C.island.z);
 this.rope.visible=['flying','latched'].includes(q.phase);if(this.rope.visible){const a=v.localWorld(HARPOON_ROPE),b=new Vector3(q.crate.x,q.crate.y,q.crate.z);if(q.phase==='flying'&&q.shot){const s=q.shot;b.set(s.origin.x+s.direction.x*s.age*48,s.origin.y+s.direction.y*s.age*48,s.origin.z+s.direction.z*s.age*48);}const d=b.clone().sub(a);this.rope.position.copy(a).add(b).multiplyScalar(.5);this.rope.scale.y=d.length();this.rope.quaternion.setFromUnitVectors(new Vector3(0,1,0),d.normalize());}
 if(this.hud)this.hud.textContent='海图师 · '+labels[q.phase];this.saveClock-=dt;if(this.saveClock<=0&&!v.net.connected){this.persist();this.saveClock=1;}
 }
}
