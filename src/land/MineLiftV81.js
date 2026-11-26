import {Group,Mesh,Vector3} from '../engine/index.js';
import {Material} from '../engine/render/Material.js';
import {box} from '../world/boat/GeoKit.js';
// A physically stacked upper inspection gallery inside the existing rock shell.
// All contact dimensions derive from the visible timber/steel geometry.
import {LIFT,onLift,liftThreshold,validLiftTarget} from './MineLiftRulesV83.js';
export {LIFT};
const V=(x,y,z)=>new Vector3(x,y,z),near=(p,q,r=1.45,h=.85)=>Math.hypot(p.x-q.x,p.z-q.z)<=r&&Math.abs(p.y-q.y)<=h;
const mat=(color,metalness=0)=>new Material({color,roughness:.79,metalness,underwaterLighting:'none'});
export class MineLiftV81{
 constructor(root,colliders){this.root=new Group();this.root.name='V81 inspection gallery and timber lift';root.add(this.root);this.c=colliders;this.y=LIFT.bottom;this.target=this.y;this.phase='idle';this.clock=0;this.remoteRevision=-1;this.networkReady=false;this.networkPending=false;const {x,z,bottom,top,halfX,halfZ}=LIFT;
  const wood=mat(0x785938),iron=mat(0x485658,.55),dark=mat(0x4b3828),brass=mat(0xc4a15d,.35);this.materials={wood,iron};
  const part=(w,h,d,px,py,pz,m=wood,walkable=false,solid=true)=>{const mesh=new Mesh(box(w,h,d),m);mesh.position.set(px,py,pz);mesh.castShadow=true;mesh.receiveShadow=true;this.root.add(mesh);const b=solid?colliders.addBox(V(px,py,pz),V(w/2,h/2,d/2),0,{tag:'v81:gallery',walkable}):null;return {mesh,b};};
  this.part=part;
  // Shaft walls protect the vertical envelope. North lower and south upper portals are the only entrances.
  for(const s of [-1,1]){part(.18,top-bottom+1.25,2.8,x+s*(halfX+.1),(bottom+top+1.25)/2,z,iron);part(.22,.22,2.9,x+s*(halfX+.1),top+1.38,z,dark);}
  part(2.5,top-bottom-.18,.18,x,(top+bottom-.18)/2,z-halfZ-.09,wood); // south, below top landing
  part(2.5,top-bottom-2.28+1.25,.18,x,(bottom+2.28+top+1.25)/2,z+halfZ+.09,wood); // north, above lower landing
  this.platform=part(2.48,.22,2.58,x,bottom-.11,z,wood,true);
  // Physical landing gates. They are moved vertically out of the portal only while docked.
  this.lowerGate=part(2.5,2.1,.14,x,bottom+1.05,z+halfZ+.1,iron);
  this.upperGate=part(2.5,2.1,.14,x,top+1.05,z-halfZ-.1,iron);
  this.carGates=[part(2.48,2.1,.11,x,bottom+1.05,z+halfZ-.04,iron),part(2.48,2.1,.11,x,bottom+1.05,z-halfZ+.04,iron)];
  // Gallery floor and protective sides. Both landings and the stairs meet without gaps.
  part(2.5,.24,5,x,top-.12,-605.8,wood,true);
  for(const s of [-1,1]){part(.11,1.13,5,x+s*1.25,top+.565,-605.8,dark);}
  const steps=14,rise=(top-bottom)/steps,run=.54,start=-608.3;
  for(let i=0;i<steps;i++){const y=top-(i+1)*rise,zz=start-(i+.5)*run;part(2.5,.22,run+.012,x,y-.11,zz,wood,true);for(const s of [-1,1])part(.12,1.14,run+.018,x+s*1.25,y+.57,zz,dark);}
  // Decorative hoist pulley housing, visible controls and inspection plaque.
  part(2.8,.35,.52,x,top+2.75,z,iron,false,false);part(.18,.45,.3,x+1.34,bottom+1.05,z+1.6,brass,false,false);part(.18,.45,.3,x+1.34,top+1.05,z-1.7,brass,false,false);part(.32,.32,.10,x+1.16,top+1.26,-605.6,brass,false,false);
  this.lower=V(x,bottom,z+2.35);this.upper=V(x,top,z-2.35);this.inspection=V(x,top,-606.2);this.sync();
 }
 movePart(p,y){p.mesh.position.y=y;p.b.center.y=y;p.b.top=y+p.b.half.y;p.b.bottom=y-p.b.half.y;}
 gate(p,open,y){p.mesh.visible=!open;p.b.solid=!open;this.movePart(p,y+p.b.half.y);}
 sync(){const {bottom,top}=LIFT;this.movePart(this.platform,this.y-.11);this.gate(this.lowerGate,this.phase==='idle'&&Math.abs(this.y-bottom)<.001,bottom);this.gate(this.upperGate,this.phase==='idle'&&Math.abs(this.y-top)<.001,top);this.gate(this.carGates[0],this.phase==='idle'&&this.y===bottom,this.y);this.gate(this.carGates[1],this.phase==='idle'&&this.y===top,this.y);}
 cabin(){return V(LIFT.x,this.y,LIFT.z);}
 onPlatform(p){return onLift(p,this.y,.09);}
 threshold(p){return liftThreshold(p);}
 wants(p){return !!p&&(near(p,this.lower)||near(p,this.upper)||this.onPlatform(p)||near(p,this.inspection,1.5,.7));}
 request(target,player){if(!player||player.mode!=='walk'||this.phase!=='idle'||![LIFT.bottom,LIFT.top].includes(target)||target===this.y)return false;const p=player.position;if(this.threshold(p))return false;const dock=target===LIFT.bottom?this.lower:this.upper;if(!this.onPlatform(p)&&!near(p,dock))return false;this.target=target;this.phase='moving';this.sync();return true;}
 // Reconcile the authoritative platform before the next movement frame. A
 // passenger is carried with it; a late-closing portal never traps a walker.
 receiveRemote(s,player){if(!s||!Number.isSafeInteger(s.revision)||s.revision<=this.remoteRevision||!Number.isFinite(s.y)||s.y<LIFT.bottom||s.y>LIFT.top||!validLiftTarget(s.target)||!['idle','moving'].includes(s.phase)||s.phase==='idle'&&s.y!==s.target)return false;
  const p=player?.position,riding=player?.mode==='walk'&&player.grounded&&onLift(p,this.y,.16);if(player?.mode==='walk'&&p&&!riding&&liftThreshold(p)&&(s.phase==='moving'||Math.abs(s.y-(Math.abs(p.y-LIFT.bottom)<Math.abs(p.y-LIFT.top)?LIFT.bottom:LIFT.top))>.001)){const lower=Math.abs(p.y-LIFT.bottom)<Math.abs(p.y-LIFT.top),sign=lower?1:-1,gate=LIFT.z+sign*(LIFT.halfZ+.1);p.z=gate+sign*.76;player.velocity?.set?.(0,0,0);}
  if(riding){p.y+=s.y-this.y;if(player.velocity)player.velocity.y=0;}this.y=s.y;this.target=s.target;this.phase=s.phase;this.networkReady=true;this.networkPending=!!s.pending;this.remoteRevision=s.revision;this.sync();return true;}
 disconnectRemote(){this.networkReady=false;this.networkPending=false;this.remoteRevision=-1;}
 step(dt,player){if(this.phase!=='moving')return;dt=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0));const old=this.y,delta=this.target-old,dy=Math.sign(delta)*Math.min(Math.abs(delta),LIFT.speed*dt);const riding=player?.mode==='walk'&&player.grounded&&this.onPlatform(player.position);this.y+=dy;if(riding){player.position.y+=dy;if(player.velocity)player.velocity.y=0;}if(Math.abs(this.y-this.target)<1e-6){this.y=this.target;if(!this.networkReady)this.phase='idle';}this.sync();}
 register(director,player,adventure){if(!player||player.mode!=='walk')return;const p=player.position,coop=!!(adventure.app.crew?.connected||adventure.app.voyageM1?.net?.connected);const add=(id,position,label,perform,range=1.45)=>director.add({id:'v81:'+id,position,range,heightRange:.85,priority:96,label,perform},player);
  const go=target=>{if(coop){const crew=adventure.app.crew;if(!crew?.connected||!this.networkReady||this.networkPending||this.phase!=='idle')return adventure._message('升降机正在同步或运行，可使用备用楼梯。',4);crew.sendMyPose?.(true);crew.send({type:'mine_lift_call',target});this.networkPending=true;return;}if(!this.request(target,player))adventure._message('升降机正在运行、已经停层或门口有阻挡。请站稳后操作。',4);};
  if(this.onPlatform(p))add('lift-car',this.cabin(),this.phase==='moving'?'升降机运行中':'升降机 · E 前往'+(this.y<LIFT.top?'上层':'下层'),()=>go(this.y<LIFT.top?LIFT.top:LIFT.bottom),1.75);
  else if(near(p,this.lower))add('lift-low',this.lower,'下层呼叫 · E',()=>go(LIFT.bottom));else if(near(p,this.upper))add('lift-high',this.upper,'上层呼叫 · E',()=>go(LIFT.top));
  if(near(p,this.inspection,1.5,.7))add('inspection',this.inspection,'采掘站上层 · E 登记矿脉',()=>{const w=adventure.app.game?.state;if(coop)return adventure._message('联机调查奖励尚未由服务器结算。',5);if(!w?.rewardReceipts?.includes('land:v80:mine-sample'))return adventure._message('先登记下层采掘站矿样。',5);adventure._reward(80,'land:v81:gallery-inspection','上层矿脉登记完成，获得80金币。西侧岩湖潜伏者巢穴已解锁；沿蓝色地面箭头绕柱前往，可由楼梯或升降机返程。');});
 }
}
