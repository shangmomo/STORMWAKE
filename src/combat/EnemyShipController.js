// V43: inertial gunboat helm with limited turn rate and real ballistic shots.
// The legacy V39 bot remains for compatibility tests, but the active voyage
// uses this controller. Only the host advances and applies projectiles.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export class EnemyShipController {
 constructor({path=[{x:0,z:140},{x:-100,z:150}],hp=100}={}){
  this.path=path;this.x=path[0].x;this.z=path[0].z;this.yaw=0;
  this.vx=0;this.vz=0;this.turnRate=0;this.hp=hp;this.state='patrol';
  this.target=path.length>1?1:0;this.cooldown=3;this.distance=Infinity;this.bearingSide=null;this.shots=0;
 }
 update(dt,playerBoat){
  if(this.state==='sink')return [];
  const step=clamp(dt,0,.15),px=playerBoat.position.x,pz=playerBoat.position.z;
  const dx=px-this.x,dz=pz-this.z;this.distance=Math.hypot(dx,dz);
  this.state=this.hp<25?'flee':this.distance<175?'engage':'patrol';
  const playerYaw=playerBoat.getYaw?.()??0;
  const dxShip=this.x-px,dzShip=this.z-pz;
  this.bearingSide=Math.cos(playerYaw)*dxShip-Math.sin(playerYaw)*dzShip>0?'port':'starboard';
  let tx=0,tz=0;
  if(this.state==='patrol'){const wp=this.path[this.target];tx=wp.x;tz=wp.z;if(Math.hypot(tx-this.x,tz-this.z)<12)this.target=(this.target+1)%this.path.length;}
  else if(this.state==='flee'){tx=this.x-dx;tz=this.z-dz;}
  else{
   // Sail a perpendicular firing course at broadside distance. Never spin
   // instantly toward the player or chase the player's exact center.
   const norm=Math.max(1,this.distance),side=this.shots%2?1:-1;
   tx=px-side*dz/norm*65-dx/norm*18;
   tz=pz+side*dx/norm*65-dz/norm*18;
  }
  const desired=Math.atan2(tx-this.x,tz-this.z);
  const yawError=wrap(desired-this.yaw);
  const commanded=clamp(yawError*1.1,-.46,.46);
  this.turnRate+=(commanded-this.turnRate)*Math.min(1,step*1.6);
  this.yaw=wrap(this.yaw+this.turnRate*step);
  const desiredSpeed=this.state==='flee'?7.1:this.state==='engage'?4.0:3.4;
  const forward={x:Math.sin(this.yaw),z:Math.cos(this.yaw)};
  const thrust=desiredSpeed*1.15;
  this.vx+=forward.x*thrust*(1-(this.rigDamage||0)*.75)*step;this.vz+=forward.z*thrust*(1-(this.rigDamage||0)*.75)*step;
  const drag=Math.exp(-step*1.5);this.vx*=drag;this.vz*=drag;
  const speed=Math.hypot(this.vx,this.vz);if(speed>desiredSpeed){this.vx*=desiredSpeed/speed;this.vz*=desiredSpeed/speed;}
  this.x+=this.vx*step;this.z+=this.vz*step;
  this.cooldown-=step;
  const rel=wrap(Math.atan2(px-this.x,pz-this.z)-this.yaw);
  const broadside=Math.abs(Math.abs(rel)-Math.PI/2)<.48;
  if(this.state==='engage'&&this.distance<115&&this.distance>15&&broadside&&this.cooldown<=0){
   this.cooldown=3.2+(this.shots%3)*.45;this.shots++;
   const reach=Math.max(1,this.distance),flight=reach/47;
   const aimX=(px+(playerBoat.velocity?.x||0)*flight-this.x)/reach;
   const aimZ=(pz+(playerBoat.velocity?.z||0)*flight-this.z)/reach;
   const aimLength=Math.hypot(aimX,aimZ)||1;
   const launch={x:this.x+aimX/aimLength*1.9,y:1.08,z:this.z+aimZ/aimLength*1.9,
    vx:aimX/aimLength*47+this.vx,vy:clamp(.8+9.81*flight/2,.8,14),vz:aimZ/aimLength*47+this.vz};
   return [{type:'enemy_projectile',launch}];
  }
  return [];
 }
 hit(amount,kind='ball'){if(kind==='chainshot')this.rigDamage=Math.min(1,(this.rigDamage||0)+.25);if(this.state==='sink'||!Number.isFinite(amount)||amount<=0)return false;this.hp=Math.max(0,this.hp-amount);if(!this.hp)this.state='sink';return true;}
 snapshot(){return {id:'gunboat_1',x:this.x,z:this.z,yaw:this.yaw,hp:this.hp,state:this.state,vx:this.vx,vz:this.vz};}
}
