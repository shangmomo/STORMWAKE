// V71 optional fossil encounter. The simulation is independent of the visual asset.
export const REX=Object.freeze({home:{x:310,z:-650},radius:27,hp:560,walk:1.35,run:5.2,turn:.95,accel:1.9,brake:3.2,windup:1.20,recover:1.5,biteDamage:28});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function newRex(){return {x:REX.home.x,z:REX.home.z,yaw:0,speed:0,state:'patrol',timer:0,time:0,serial:0,hp:REX.hp,dead:false,phase:1};}
export function advanceRex(e,p,dt,{canMove=()=>true}={}){
 dt=clamp(Number.isFinite(dt)?dt:0,0,.05);if(!dt||e.dead)return {strike:false,moving:false};e.time+=dt;
 const distance=Math.hypot(p.x-e.x,p.z-e.z),homeDistance=Math.hypot(e.x-REX.home.x,e.z-REX.home.z),pHome=Math.hypot(p.x-REX.home.x,p.z-REX.home.z);
 e.phase=e.hp<REX.hp*.45?2:1;let targetSpeed=0,heading=e.yaw,strike=false;
 if(e.state==='windup'||e.state==='recover'){
  e.timer-=dt;
  if(e.timer<=0){if(e.state==='windup'){e.serial++;strike=true;e.state='recover';e.timer=REX.recover;}else e.state='patrol';}
 }else if(homeDistance>REX.radius-3||pHome>REX.radius+6&&homeDistance>4){
  e.state='return';heading=Math.atan2(REX.home.x-e.x,REX.home.z-e.z);targetSpeed=REX.walk;
 }else if(distance<23&&pHome<REX.radius+4){
  e.state='chase';heading=Math.atan2(p.x-e.x,p.z-e.z);
  if(distance<6.4&&distance>3.8&&Math.abs(Math.atan2(Math.sin(heading-e.yaw),Math.cos(heading-e.yaw)))<.34&&e.speed<2.3){e.state='windup';e.timer=REX.windup*(e.phase===2?.85:1);targetSpeed=0;heading=e.yaw;}
  else if(distance<=3.8){heading=Math.atan2(e.x-p.x,e.z-p.z);targetSpeed=REX.walk;}else targetSpeed=distance>10?REX.run:distance>5.6?REX.walk:0;
 }else{e.state='patrol';const angle=e.time*.055,tx=REX.home.x+Math.cos(angle)*10,tz=REX.home.z+Math.sin(angle)*10;heading=Math.atan2(tx-e.x,tz-e.z);targetSpeed=Math.hypot(tx-e.x,tz-e.z)>1.2?REX.walk:0;}
 if(!['windup','recover'].includes(e.state)){
  const d=Math.atan2(Math.sin(heading-e.yaw),Math.cos(heading-e.yaw));const turn=REX.turn/(1+e.speed*.18);e.yaw+=clamp(d,-turn*dt,turn*dt);targetSpeed*=Math.max(.05,Math.cos(d));
 }
 e.speed+=clamp(targetSpeed-e.speed,-REX.brake*dt,REX.accel*dt);
 const nx=e.x+Math.sin(e.yaw)*e.speed*dt,nz=e.z+Math.cos(e.yaw)*e.speed*dt;
 if(Math.hypot(nx-REX.home.x,nz-REX.home.z)<=REX.radius&&canMove(nx,nz)){e.x=nx;e.z=nz;}else{e.speed=0;if(!['windup','recover'].includes(e.state))e.state='return';}
 return {strike,moving:e.speed>.12,style:e.state==='windup'||e.state==='recover'?'attack':e.speed>2.2?'run':e.speed>.12?'walk':'idle'};
}
