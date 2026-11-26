import {Group,Mesh,Vector3} from '../engine/index.js';
import {cylinder,box,sphere,prepare} from '../world/boat/GeoKit.js';
import {Material} from '../engine/render/Material.js';
const up=new Vector3(0,1,0);
export function solveArm(shoulder,target,pole,upper=.34,lower=.32){
 const delta=target.clone().sub(shoulder),distance=delta.length(),axis=delta.clone().normalize();
 if(distance>upper+lower-.001||distance<Math.abs(upper-lower)+.001)return null;
 const along=(upper*upper-lower*lower+distance*distance)/(2*distance),lift=Math.sqrt(Math.max(0,upper*upper-along*along));
 const bend=pole.clone().sub(shoulder);bend.addScaledVector(axis,-bend.dot(axis));if(bend.lengthSq()<1e-7)bend.crossVectors(axis,up);bend.normalize();
 return {elbow:shoulder.clone().addScaledVector(axis,along).addScaledVector(bend,lift),wrist:target.clone()};
}
export function stationHandTargets(boat,id){
 const deck=boat.heritageDeck;if(!deck)return null;
 if(id==='helm'&&deck.helmWheel)return [Math.PI/4,3*Math.PI/4].map(a=>deck.helmWheel.localToWorld(new Vector3(Math.cos(a)*.61,Math.sin(a)*.61,-.11)));
 if(id?.startsWith('anchor')&&deck.windlass){const index={anchor:0,anchor_2:2,anchor_3:1,anchor_4:3}[id];if(index===undefined)return null;const a=index*Math.PI/2;return [-.065,.15].map(y=>deck.windlass.localToWorld(new Vector3(Math.cos(a)*1.03,y,Math.sin(a)*1.03)));}
 return null;
}
export class StationHandRig{
 constructor(scene){this.root=new Group();this.root.name='Socket constrained sailor arms';scene.add(this.root);const cloth=new Material({color:0x426767,roughness:.9}),skin=new Material({color:0xd3a47d,roughness:.8});
  this.arms=Array.from({length:2},()=>{const upper=new Mesh(prepare(cylinder(.063,.075,1,10)),cloth),lower=new Mesh(prepare(cylinder(.045,.06,1,10)),cloth),hand=new Mesh(prepare(box(.09,.12,.08)),skin),knuckle=new Mesh(prepare(sphere(.052,8,6)),skin);this.root.add(upper,lower,hand,knuckle);return {upper,lower,hand,knuckle};});this.root.visible=false;this.errors=[];
 }
 update(boat,station,feet,bodyRotation){const targets=stationHandTargets(boat,station);this.root.visible=!!targets;this.errors=[];if(!targets)return false;
  const center=targets[0].clone().add(targets[1]).multiplyScalar(.5),forward=center.clone().sub(feet);const bodyUp=bodyRotation?up.clone().applyQuaternion(bodyRotation):up;forward.addScaledVector(bodyUp,-forward.dot(bodyUp));forward.normalize();const right=new Vector3().crossVectors(bodyUp,forward);
  const shoulders=[-1,1].map(sign=>feet.clone().addScaledVector(forward,station.startsWith('anchor')?.12:0).addScaledVector(bodyUp,station.startsWith('anchor')?1.22:1.34).addScaledVector(right,sign*.22));
  for(let i=0;i<2;i++){const shoulder=shoulders[i],pole=shoulder.clone().addScaledVector(right,i? .45:-.45).addScaledVector(bodyUp,-.4),pose=solveArm(shoulder,targets[i],pole);const arm=this.arms[i];for(const mesh of Object.values(arm))mesh.visible=!!pose;if(!pose){this.errors.push(Infinity);continue;}
   for(const [mesh,a,b] of [[arm.upper,shoulder,pose.elbow],[arm.lower,pose.elbow,pose.wrist]]){const direction=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=direction.length();mesh.quaternion.setFromUnitVectors(up,direction.normalize());}
   arm.hand.position.copy(pose.wrist);arm.knuckle.position.copy(pose.wrist);if(bodyRotation)arm.hand.quaternion.copy(bodyRotation);this.errors.push(arm.hand.position.distanceTo(targets[i]));
  }return this.errors.every(Number.isFinite);
 }
}
