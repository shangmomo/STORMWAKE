import {Vector3} from '../engine/index.js';
import {titanSkill} from './TitanAI.js';
export const PHYSICAL_SKILLS=new Set(['charge','grapple','triple_bite','vortex']);
export function waveFrontTouches(attack,ship,age){
 if(age<0||age>6.2)return null;const dx=ship.x-attack.x,dz=ship.z-attack.z,d=Math.hypot(dx,dz),radius=5+age*23;
 const yaw=ship.yaw||0,nx=dx/Math.max(d,.001),nz=dz/Math.max(d,.001),c=Math.cos(yaw),s=Math.sin(yaw);
 const halfLength=ship.shipClass==='heritage'?11.5:4.1,halfBeam=ship.shipClass==='heritage'?2.7:1.55;
 const extent=Math.abs(c*nx-s*nz)*halfBeam+Math.abs(s*nx+c*nz)*halfLength;
 if(Math.abs(d-radius)>extent+1.5||d>attack.radius+extent||Math.abs((ship.y||0)-(attack.y||0))>7)return null;
 return {x:ship.x-nx*extent,y:0,z:ship.z-nz*extent};
}
export class MonsterContacts{
 constructor(owner){this.owner=owner;this.pending=new Map();this.previous=new Map();}
 release(b,event){if(!this.owner.app.voyageM1||!this.owner.app.boat.collisionWorld)return;const skill=titanSkill(b,event.sequence||0,b.health/b.hp<=.5);const prior=this.pending.get(b.id);if(prior?.id===b.id+':'+b.spawn+':'+(event.sequence||0))return;this.pending.set(b.id,{id:b.id+':'+b.spawn+':'+(event.sequence||0),sequence:event.sequence||0,kind:event.kind,skill:event.skill,damage:Number.isFinite(event.damage)?event.damage:skill.damage,radius:event.radius||skill.radius,x:Number.isFinite(event.x)?event.x:b.brain.x,z:Number.isFinite(event.z)?event.z:b.brain.z,y:Number.isFinite(event.y)?event.y:(b.brain.y||0),start:this.owner.clock,hits:new Set()});}
 hullContact(point,previous,radius){const boat=this.owner.app.boatCtl,world=boat.model.collisionWorld,inv=boat.quaternion.clone().invert(),local=point.clone().sub(boat.position).applyQuaternion(inv);let hit=world.sphereContact(local,radius);
  if(!hit&&previous){const from=previous.clone().sub(boat.position).applyQuaternion(inv);from.y-=radius;const to=local.clone();to.y-=radius;const sweep=world.move(from,to,{radius,height:radius*2,step:-1000});if(sweep.contacts.length)hit=world.sphereContact({x:sweep.x,y:sweep.y+radius,z:sweep.z},radius+.02);}
  return hit?boat.toWorld(new Vector3(hit.point.x,hit.point.y,hit.point.z),new Vector3()):null;
 }
 confirm(b,attack,bone,point){if(attack.hits.has(bone))return;attack.hits.add(bone);const v=this.owner.app.voyageM1,payload={boss:b.id,sequence:attack.sequence,kind:attack.kind,bone,point:{x:point.x,y:point.y,z:point.z}};
  if(v.net.connected)v.net.send('titan_contact_host',payload);else this.owner.applyConfirmedContact({...payload,damage:Math.round(attack.damage*(attack.kind==='grapple'?.22:attack.kind==='triple_bite'?.34:1)),attackId:attack.id});
 }
 clear(b){this.pending.delete(b.id);for(const key of this.previous.keys())if(key.startsWith(b.id+':'))this.previous.delete(key);}
 update(b){const app=this.owner.app,v=app.voyageM1,a=this.pending.get(b.id);if(!v||!a)return;if(this.owner.clock-a.start>7||b.health<=0){this.clear(b);return;}if(!v.net.isHost)return;
  if(!PHYSICAL_SKILLS.has(a.kind)){const ctl=app.boatCtl,point=waveFrontTouches(a,{x:ctl.position.x,y:ctl.position.y,z:ctl.position.z,yaw:ctl.getYaw(),shipClass:'heritage'},this.owner.clock-a.start);if(point)this.confirm(b,a,'wave',point);return;}
  for(const hit of b.detailAsset?.contactEvents||[])this.confirm(b,a,hit.boneId||hit.type,hit.position);
  const asset=b.detailAsset,model=asset?.skeleton;if(!model||!['shark','turtle'].includes(b.id))return;
  const names=b.id==='shark'?['SharkJaw0']:['TurtleHead',...Array.from({length:10},(_,i)=>'Shell'+i)];
  for(const name of names){const i=model.gltf.nodes.findIndex(n=>n.name===name);if(i<0)continue;const p=new Vector3(model.world[i*16+12],model.world[i*16+13],model.world[i*16+14]);asset.root.localToWorld(p);const key=b.id+':'+name,previous=this.previous.get(key);this.previous.set(key,p.clone());const point=this.hullContact(p,previous,b.id==='shark'?.85:3.1);if(point){this.confirm(b,a,b.id==='shark'?'jaw':'shell',point);break;}}
 }
}
