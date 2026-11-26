import {MerchantRescueQuest} from './MerchantRescueQuest.js';
import {Group,Mesh,Vector3} from '../engine/index.js';
import {loadStaticArtistModel} from '../ship/HeritageAssetRig.js';
import {MovingSurfaceWorld} from '../systems/MovingSurfaceWorld.js';
import {box,torus,prepare,mergePrepared,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
import {Material} from '../engine/render/Material.js';
import {DistressSmoke} from '../world/DistressSmoke.js';
export class MerchantRescueRuntime{
 constructor(v){this.v=v;this.quest=new MerchantRescueQuest();try{this.quest.deserialize(JSON.parse(localStorage.getItem('stormwake.m1.snapshot.v2')||'null')?.merchant||JSON.parse(localStorage.getItem('stormwake.merchant.v1')));}catch{}this.quest.consumePlank=()=>{if(v.equipment.planks<=0)return false;v.equipment.planks--;return true;};
  this.root=new Group();this.root.name='Rescue merchant: same-world boardable CC0 vessel';v.app.scene.add(this.root);this.holes=new Map();
  this.smoke=new DistressSmoke();this.smoke.position.z=-2;this.root.add(this.smoke);this.smokeClock=0;
  this.water=new Mesh(prepare(box(2.1,.035,6),{color:0x203f43}),new Material({color:0x203f43,transparent:true,opacity:.7}));this.root.add(this.water);this.water.position.y=.3;
  this.slot=v.app.query.allocate('rescueMerchant',1);this.timer=0;
  loadStaticArtistModel('/models/stormwake_v47/quaternius_ship_large.glb').then(asset=>{const art=new Group();art.rotation.y=Math.PI/2;art.scale.setScalar(.67);art.add(asset.root);this.root.add(art);
   const initial=new MovingSurfaceWorld(this.root);let deck=initial.world.floorAt(.5,0,3,-.5);if(deck===null)deck=initial.world.floorAt(0,1,3,-.5);if(deck===null)throw Error('Merchant has no measured deck');this.deckY=deck;
   // Visible rescue gangway rises over the existing rail, then ends inside
   // the measured deck. No invisible ramp and no boarding teleport.
   const parts=[];for(let i=0;i<16;i++){const top=-.55+(deck+1.3)*(i+1)/16;parts.push(prepare(box(.27,.09,1),{color:0x805c3b,matrix:mat4(-4+(i+.5)*.25,top-.045,0)}));}
   this.root.add(new Mesh(mergePrepared(parts),landMaterial));this.surface=new MovingSurfaceWorld(this.root);v.app.colliders.triangleWorlds.push(this.surface);
  }).catch(e=>{this.loadError=String(e);console.error('Merchant boarding asset failed',e);});
  if(v.hud){this.hud=document.createElement('div');this.hud.style.cssText='font-size:12px;max-width:310px;color:#c5ddd0';v.hud.append(this.hud);}
 }
 spawnCargo(cargo){const id=this.quest.cargoId,p=this.world({x:.2,y:(this.deckY||1)+.15,z:1});if(cargo.spawnChest(id,p))Object.assign(cargo.get(id),{origin:'rescue',merchantLocal:{x:.2,y:(this.deckY||1)+.15,z:1}});}
 world(p){const s=this.quest.ship,c=Math.cos(s.yaw),n=Math.sin(s.yaw);return {x:s.x+c*p.x+n*p.z,y:s.y+p.y,z:s.z-n*p.x+c*p.z};}
 action(verb,holeId){const v=this.v,options={tool:v.equipment.active,holeId};if(v.net.connected){v.app.crew.sendMyPose?.(true);v.net.send('merchant_action',{verb,...options});return;}
  if(verb==='repair'&&v.equipment.planks<=0){v.toast('先从母船维修箱拿取木板');return;}if(['scoop','throw'].includes(verb)&&!v.hasBucket){v.toast('先从母船拿取水桶');return;}const old=this.quest.phase;if(this.quest.action(verb,v.cartographer.actor(),v.cartographer.ship(),options)){if(verb==='accept'){this.spawnCargo(v.cargo);v.app.oceanChart?.setFreeTarget(this.quest.ship);}if(old==='return'&&this.quest.phase==='completed'){v.cargo.remove(this.quest.cargoId);v.voyage.tideCoin+=420;v.voyage.repGoldTide+=2;v.voyage.persist();}if(verb!=='repair')this.persist();}
 }
 persist(){try{localStorage.setItem('stormwake.merchant.v1',JSON.stringify(this.quest.serialize()));}catch{}this.v._persistCargo();}
 candidates(){const v=this.v,p=v.app.player,q=this.quest,a=[];const add=(verb,label,pos,r,holeId)=>{if(Math.hypot(pos.x-p.position.x,pos.y-p.position.y,pos.z-p.position.z)<r)a.push({id:'merchant_'+verb+(holeId||''),label,position:pos,range:r,priority:verb==='accept'?60:275,perform:()=>this.action(verb,holeId)});};
  if(['offer','completed','failed'].includes(q.phase))add('accept','[E] 商人求救：破帆的商船',{x:56,y:1,z:-71},4);
  if(q.phase==='rescue'){if(v.equipment.active==='plank')for(const h of q.damage.holes)if(h.state==='open')add('repair',`[按住 E] 木板封堵破口 ${Math.round(h.progress*100)}%`,this.world(h.local),2,h.id);
   if(v.equipment.active==='bucket'&&q.buckets.has(v.actorId))add('throw','[E] 在船舷倒出积水',this.world({x:1.5,y:this.deckY||1,z:0}),2);
   else if(v.equipment.active==='bucket')add('scoop','[E] 水桶舀出商船积水',this.world({x:0,y:this.deckY||1,z:0}),1.6);
  }if(q.phase==='return')add('deliver','[E] 交付商船救援 · 420 潮币',{x:56,y:1,z:-71},4);return a;
 }
 update(dt){const v=this.v,q=this.quest;
  this.smokeClock+=dt;this.smoke.visible=q.phase==='rescue';if(this.smoke.visible)this.smoke.update(this.smokeClock);
  v.app.query.setPoint(this.slot,q.ship.x,q.ship.z);if(!v.net.connected){v.app.query.setPoint(this.slot,q.ship.x,q.ship.z);if(v.app.query.cpuValid){const w=v.app.query.get(this.slot);if(Math.hypot(v.app.query.resultInputs[this.slot*4]-q.ship.x,v.app.query.resultInputs[this.slot*4+1]-q.ship.z)<20)q.ship.y+=(w.height-q.ship.y)*Math.min(1,dt*2);}q.update(dt,v.cartographer.ship(),v.cargo);}
  if(v.net.connected&&v.net.isHost){this.seaClock=(this.seaClock||0)-dt;if(this.seaClock<=0&&v.app.query.cpuValid&&Math.hypot(v.app.query.resultInputs[this.slot*4]-q.ship.x,v.app.query.resultInputs[this.slot*4+1]-q.ship.z)<20){this.seaClock=.15;v.net.send('merchant_action',{verb:'sea',height:v.app.query.get(this.slot).height});}}
  const p=v.app.player;const local=this.surface?.local(p.position);p.foreignShip=this.root.visible&&local&&Math.abs(local.x)<5&&Math.abs(local.z)<8&&local.y>-1&&local.y<4?'merchant':null;const standing=this.surface&&p.mode==='walk'&&Math.abs((this.surface.floorAt(p.position.x,p.position.z,p.position.y+.15)??-100)-p.position.y)<.2;
  this.root.position.set(q.ship.x,q.ship.y,q.ship.z);this.root.rotation.y=q.ship.yaw;this.root.visible=!['offer','completed','failed'].includes(q.phase);if(standing&&this.root.visible&&local)p.position.copy(this.surface.global(local));
  this.water.visible=q.damage.water>.005;this.water.position.y=(this.deckY||1)-.2+q.damage.water*.45;
  for(const h of q.damage.holes){let mesh=this.holes.get(h.id);if(!mesh){mesh=new Mesh(prepare(torus(.2,.055,8,16),{color:0x342a23}),landMaterial);this.root.add(mesh);this.holes.set(h.id,mesh);}mesh.position.set(h.local.x,h.local.y,h.local.z);mesh.rotation.y=Math.PI/2;mesh.visible=h.state==='open';}
  const item=v.cargo.get(q.cargoId);if(item?.state==='world'&&item.merchantLocal){const at=this.world(item.merchantLocal);Object.assign(item,at);const mesh=v.chestMeshes.get(item.id);if(mesh)mesh.position.set(at.x,at.y,at.z);}
  this.timer-=dt;if(this.timer<=0){this.timer=.12;if(q.phase==='rescue'&&v.input.down('KeyE')&&!v.input.hit('KeyE')&&v.input.interactionOwner==='voyage'&&!p.stationId&&!v.app.freeCam){const id=v.heldInteractionId;const candidates=this.candidates(),candidate=candidates.find(c=>c.id===id&&c.id.startsWith('merchant_repair'));if(candidate&&v.isHeldInteraction(id,candidates))candidate.perform();}}this.saveTimer=(this.saveTimer||0)-dt;if(this.saveTimer<=0&&!v.net.connected){this.saveTimer=1;this.persist();}
  if(this.hud)this.hud.textContent='商船救援 · '+({offer:'码头商人有一封求救信',rescue:`商船 (270,920) · 漏水 ${Math.round(q.damage.water*100)}% · 登船修补、舀水，搬货入己船`,escort:'商船已稳住；保持 140 米内，护送到安全航道',return:'护送完成，返回码头商人处结算',completed:'救援已完成',failed:'商船沉没；可返港重新接取'})[q.phase];
 }
}
