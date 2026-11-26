export function bearFacing(e,p){return Math.abs(Math.atan2(Math.sin(Math.atan2(p.x-e.x,p.z-e.z)-e.yaw),Math.cos(Math.atan2(p.x-e.x,p.z-e.z)-e.yaw)))<.92;}
export function advanceBear(e,p,dt,{active=true}={}){
 const result={strike:false,moving:false,style:'claw',damage:23,range:2.6};dt=Math.min(.05,Math.max(0,dt));if(!active||e.dead||!dt)return result;
 const d=Math.hypot(p.x-e.x,p.z-e.z),home=Math.hypot(e.x-e.homeX,e.z-e.homeZ);e.cooldown=Math.max(0,e.cooldown-dt);e.bearClock=(e.bearClock||0)+dt;
 let targetSpeed=0,heading=e.yaw;
 if(['telegraph','recover','stagger'].includes(e.state)){e.timer-=dt;if(e.timer<=0){if(e.state==='telegraph'){e.attackSerial++;e.state='recover';e.timer=3.15;result.strike=true;}else e.state='idle';}}
 else if(home>25||(d>23&&home>8)){e.state='return';heading=Math.atan2(e.homeX-e.x,e.homeZ-e.z);targetSpeed=1.25;}
 else if(d<15){heading=Math.atan2(p.x-e.x,p.z-e.z);if(d<2.4&&e.cooldown<=0&&bearFacing(e,p)){e.state='telegraph';e.timer=.85;e.cooldown=4.2;}else{e.state='chase';targetSpeed=d>2.05?4.6:0;}}
 else{const angle=e.bearClock*.085;const x=e.homeX+Math.sin(angle)*7,z=e.homeZ+Math.cos(angle)*7;heading=Math.atan2(x-e.x,z-e.z);e.state='patrol';targetSpeed=Math.hypot(x-e.x,z-e.z)>1?1.25:0;}
 const a=Math.atan2(Math.sin(heading-e.yaw),Math.cos(heading-e.yaw));e.yaw+=Math.max(-1.65*dt,Math.min(1.65*dt,a));targetSpeed*=Math.max(0,Math.cos(a));e.bearSpeed=e.bearSpeed||0;e.bearSpeed+=Math.max(-5*dt,Math.min(2.6*dt,targetSpeed-e.bearSpeed));if(e.state==='telegraph'||e.state==='recover'||e.state==='stagger')e.bearSpeed=0;e.vx=Math.sin(e.yaw)*e.bearSpeed;e.vz=Math.cos(e.yaw)*e.bearSpeed;result.moving=e.bearSpeed>.03;return result;
}
