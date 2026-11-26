// V42 - first-person hand-held models. Geometries authored locally, no borrowed
// Sea of Thieves assets. Position follows the real camera (not the player origin).
import {Group,Mesh,Vector3} from '../engine/index.js';
import {prepare,mergePrepared,box,cylinder,sphere,torus,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
const P=(geo,color,x,y,z,sx=1,sy=sx,sz=sx,rx=0,ry=0,rz=0)=>prepare(geo,{color,rough:.82,matrix:mat4(x,y,z,rx,ry,rz,sx,sy,sz)});
const wood=0x735039,cloth=0x264f55,skin=0xb8835e,metal=0xd3ac62,steel=0xa9b9bc,leather=0x46362b;
function build(parts){const m=new Mesh(mergePrepared(parts),landMaterial);m.castShadow=false;m.receiveShadow=false;return m;}
const arm=(x,angle=0)=>[
 P(box(.18,.23,.52),cloth,x,-.29,-.38,1,1,1,-.48,angle),
 P(box(.18,.15,.18),skin,x,-.17,-.62,1,1,1,-.34,angle),
 P(box(.20,.085,.16),leather,x,-.25,-.53)];
function gearShape(kind){
 const a=[...arm(.27,-.17)];
 if(kind==='hands'||kind==='helm'||kind==='sail_main'||kind==='sail_jib'||kind==='anchor')return build([...arm(-.27,.17),...a]);
 if(kind==='cannonball'||kind==='chainshot')return build([...arm(-.27,.17),...a,P(sphere(.17,12,9),0x2d3336,0,-.13,-.84),...(kind==='chainshot'?[P(box(.20,.035,.04),metal,0,-.08,-.80)]:[])]);
 if(kind==='cannon_port'||kind==='cannon_starboard')return build([...arm(-.27,.17),...a,
  P(sphere(.17,10,8),0x303437,.06,-.02,-.82),P(cylinder(.027,.027,.58,8),wood,.37,-.13,-.91,1,1,1,.35)]);
 if(kind==='cutlass')return build([...a,
  P(cylinder(.034,.034,.35,9),leather,.30,-.12,-.79,1,1,1,.22),
  P(box(.42,.05,.065),metal,.30,.045,-.82,1,1,1,0,.1),
  P(box(.09,.73,.058),steel,.30,.39,-.88,1,1,1,.22),
  P(box(.16,.08,.065),steel,.30,.73,-.92,1,1,1,.22)]);
 if(kind==='shovel')return build([...a,
  P(cylinder(.038,.035,1.0,9),wood,.28,.08,-.91,1,1,1,.20),
  P(box(.29,.37,.065),steel,.28,.69,-1.04,1,1,1,.18),
  P(torus(.085,.025,7,15),metal,.28,-.45,-.81)]);
 if(kind==='bucket')return build([...arm(-.30,.12),...a,
  P(cylinder(.27,.22,.45,12),wood,0,-.16,-.86),
  P(torus(.26,.033,8,22),metal,0,.07,-.86),P(torus(.23,.027,8,22),metal,0,-.37,-.86),
  P(box(.05,.33,.05),steel,-.27,.16,-.86),P(box(.05,.33,.05),steel,.27,.16,-.86),
  P(torus(.28,.023,8,20),leather,0,.33,-.86)]);
 if(kind==='plank')return build([...arm(-.27,.17),...a,
  P(box(.83,.15,.21),wood,0,-.08,-.88,1,1,1,0,.3),
  P(box(.10,.16,.22),metal,-.30,-.08,-.88),P(box(.10,.16,.22),metal,.30,-.08,-.88)]);
 if(kind==='spyglass')return build([...a,
  P(cylinder(.11,.13,.65,12),metal,.25,-.05,-.95,1,1,1,1.16),
  P(torus(.14,.025,8,20),steel,.24,.21,-1.18),
  P(torus(.13,.02,8,20),leather,.25,-.16,-.72)]);
 if(kind==='lantern')return build([...a,
  P(cylinder(.13,.14,.29,9),metal,.3,-.2,-.85),
  P(sphere(.14,10,8),0xfacb69,.3,-.08,-.85),
  P(cylinder(.17,.17,.06,12),leather,.3,-.37,-.85),
  P(torus(.14,.024,8,18),metal,.3,.07,-.85)]);
 if(kind==='chest')return build([...arm(-.42,.2),...arm(.42,-.2),
  P(box(.85,.57,.44),wood,0,-.10,-.92),P(box(.92,.16,.5),leather,0,.24,-.92),
  P(box(.09,.73,.52),metal,-.31,.02,-.92),P(box(.09,.73,.52),metal,.31,.02,-.92),
  P(box(.14,.20,.055),metal,0,.05,-.64)]);
 return gearShape('hands');
}
const offset=new Vector3();
export class PirateHands {
 constructor(scene){this.root=new Group();this.root.name='STORMWAKE V42 genuine equipped tools / held treasure';this.root.visible=false;this.pose=new Group();this.root.add(this.pose);this.models=new Map();for(const name of ['hands','helm','sail_main','sail_jib','anchor','cutlass','bucket','shovel','plank','spyglass','lantern','chest','cannonball','chainshot','cannon_port','cannon_starboard']){
   const mesh=gearShape(name);mesh.visible=false;
   if(name==='bucket'){mesh.userData.waterSurface=build([P(cylinder(.21,.21,.025,12),0x4c9db5,0,.042,-.86)]);mesh.add(mesh.userData.waterSurface);mesh.userData.waterSurface.visible=false;}
   this.models.set(name,mesh);this.pose.add(mesh);
  }scene.add(this.root);this.equipped=null;this.time=0;}
 update(dt,{player,camera,equipment,carrying=false,freeCam=false,thirdPerson=false,landSword=false,supply=null}={}){
  const show=!landSword&&!freeCam&&!thirdPerson&&['walk','deck'].includes(player?.mode);
  this.root.visible=show;if(!show)return;
  const gear=carrying?'chest':supply&&this.models.has(supply)?supply:player.stationId?(this.models.has(player.stationId)?player.stationId:'hands'):(landSword?'cutlass':equipment.active);
  if(gear!==this.equipped){for(const m of this.models.values())m.visible=false;this.models.get(gear).visible=true;this.equipped=gear;}
  this.time+=dt;const bucket=this.models.get('bucket');
  if(bucket?.userData?.waterSurface)bucket.userData.waterSurface.visible=!!equipment.bucketFull;
  const action=equipment.actionAge<.45?equipment.action:'idle';
  const move=player.mode==='deck'?player.deckVel?.length?.()||0:player.velocity?.length?.()||0;
  const sway=Math.sin(this.time*8)*Math.min(.018,move*.007);
  this.root.quaternion.copy(camera.quaternion);
  const shift=gear==='chest'?.04:gear==='spyglass'?.12:.0;
  this.root.position.copy(camera.position).add(offset.set(0,-.18+shift,-.05).applyQuaternion(camera.quaternion));
  this.pose.rotation.set(0,0,0);this.pose.position.set(sway,Math.cos(this.time*8)*Math.min(.013,move*.004),0);
  if(gear==='spyglass'&&equipment.raised){this.pose.position.set(-.23,.17,.50);this.pose.rotation.x=-.12;}
  else if(action==='swing')this.pose.rotation.z=-.40*Math.max(0,1-equipment.actionAge/.32);
  else if(action==='scoop')this.pose.rotation.x=.65*Math.max(0,1-equipment.actionAge/.45);
  else if(action==='throw')this.pose.rotation.x=-.85*Math.max(0,1-equipment.actionAge/.4);
  else if(action==='hammer')this.pose.rotation.z=.18*Math.sin(this.time*18);
  else if(action==='reload')this.pose.position.z=-.18+.28*Math.min(1,equipment.actionAge/.45);
  else if(action==='haul'||action==='crank')this.pose.rotation.z=.23*Math.sin(this.time*10);
  else if(player.stationId?.startsWith('cannon'))this.pose.position.z=-.15;
 }
}
