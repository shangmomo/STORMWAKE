export class EnemyShotgunBoat {
 constructor({path=[{x:0,z:140},{x:-100,z:150}],hp=100}={}){this.path=path;this.x=path[0].x;this.z=path[0].z;this.yaw=0;this.hp=hp;this.state='patrol';this.target=1;this.cooldown=3;this.distance=Infinity;this.bearingSide=null;this.shots=0;}
 update(dt,playerBoat,damage){if(this.state==='sink')return [];const dx=playerBoat.position.x-this.x,dz=playerBoat.position.z-this.z;this.distance=Math.hypot(dx,dz);
  const yaw=playerBoat.getYaw?.()??0;const vx=this.x-playerBoat.position.x,vz=this.z-playerBoat.position.z;
  this.bearingSide=Math.cos(yaw)*vx-Math.sin(yaw)*vz>0?'port':'starboard';
  if(this.hp<25)this.state='flee';else if(this.distance<180)this.state='engage';else this.state='patrol';
  const aim=this.state==='engage'?playerBoat.position:this.path[this.target];const xx=aim.x-this.x,zz=aim.z-this.z;const rr=Math.hypot(xx,zz)||1;
  const sp=this.state==='flee'?10:this.state==='engage'?5:3;let dirx=xx/rr,dirz=zz/rr;if(this.state==='flee'){dirx=-dirx;dirz=-dirz;}
  this.x+=dirx*sp*dt;this.z+=dirz*sp*dt;this.yaw=Math.atan2(dirx,dirz);
  if(this.state==='patrol'&&rr<9)this.target=(this.target+1)%this.path.length;
  this.cooldown-=dt;const events=[];
  if(this.state==='engage'&&this.distance<125&&this.cooldown<=0){this.cooldown=3+this.shots%3;this.shots++;damage.applyHit(9,'ball');events.push({type:'enemy_fire',damage:9});}
  return events;
 }
 hit(amount){if(this.state==='sink'||!Number.isFinite(amount)||amount<=0)return false;this.hp=Math.max(0,this.hp-amount);if(!this.hp)this.state='sink';return true;}
 snapshot(){return {id:'gunboat_1',x:this.x,z:this.z,yaw:this.yaw,hp:this.hp,state:this.state};}
}
