// V37 island-boss encounter: deterministic, bounded, server-portable AI.
// A sea-cursed corsair, never instant-teleports: all movement is expressed as
// velocity and goes through the same terrain/collider layer as other enemies.
const hypot = Math.hypot;
const unit = (x,z) => {const d=hypot(x,z)||1;return [x/d,z/d];};
const finite = n => Number.isFinite(n) ? n : 0;
export const CORSAIR = Object.freeze({
  arena:{x:390,z:-512,radius:16}, hp:720, speed:3.8, reach:2.8, leash:18,
  attacks:Object.freeze({cutlass:{windup:.72,recovery:.68,damage:17,range:3.0},
    lunge:{windup:.87,recovery:.88,damage:24,range:2.8},
    whirl:{windup:1.10,recovery:1.05,damage:20,range:4.2},
    feint:{windup:.54,recovery:.62,damage:12,range:2.6}})
});
export function newCorsairState(x=CORSAIR.arena.x,z=CORSAIR.arena.z){
  return {x,z,homeX:x,homeZ:z,yaw:0,hp:CORSAIR.hp,maxHp:CORSAIR.hp,
    state:'idle',timer:0,cooldown:.8,attackSerial:0,attackStyle:'cutlass',
    vx:0,vz:0,strafeSign:1,phase:1,hitSerial:-1,dead:false};
}
export function advanceCorsair(e, target, rawDt, {active=true}={}){
  const dt=Math.min(.05,Math.max(0,finite(rawDt)));
  if(e.dead||!active||dt===0)return {moving:false,strike:false,style:e.attackStyle};
  const dx=target.x-e.x,dz=target.z-e.z,dist=hypot(dx,dz);
  const [ux,uz]=unit(dx,dz), leash=hypot(e.x-e.homeX,e.z-e.homeZ);
  const phase=e.hp<e.maxHp*.42?2:1;
  e.strafeSign=Number.isFinite(e.strafeSign)&&e.strafeSign!==0?e.strafeSign:1;
  const turnTo=angle=>{const d=Math.atan2(Math.sin(angle-e.yaw),Math.cos(angle-e.yaw));e.yaw+=Math.max(-3.5*dt,Math.min(3.5*dt,d));};
  e.phase=phase;e.cooldown=Math.max(0,e.cooldown-dt);
  let moving=false,strike=false;
  e.vx=0;e.vz=0;
  // Recovering or staggered bosses visibly leave an opening; do not chase.
  if(['telegraph','recover','stagger','lunge'].includes(e.state)){
    e.timer-=dt;
    if(e.state==='lunge'){
      e.vx=e.dashX*(phase===2?11.5:9.0);
      e.vz=e.dashZ*(phase===2?11.5:9.0);
      moving=true;strike=true; // the caller de-duplicates by attackSerial
      if(e.timer<=0){e.state='recover';e.timer=CORSAIR.attacks.lunge.recovery;}
    } else if(e.timer<=0){
      if(e.state==='telegraph'){
        const style=e.attackStyle;
        e.attackSerial++;
        if(style==='lunge') {
          e.state='lunge';e.timer=.34;
          [e.dashX,e.dashZ]=[Math.sin(e.yaw),Math.cos(e.yaw)];
          strike=true;
        } else {e.state='recover';e.timer=CORSAIR.attacks[style].recovery;strike=true;}
      } else {e.state='circle';e.timer=.48;}
    }
  }else if(leash>CORSAIR.leash || (dist>=26&&leash>.5)){
    e.state='return';
    const [bx,bz]=unit(e.homeX-e.x,e.homeZ-e.z);
    e.vx=bx*5;e.vz=bz*5;moving=true;turnTo(Math.atan2(bx,bz));
  }else if(dist<26){
    const heading=Math.atan2(ux,uz);turnTo(heading);
    if(e.cooldown<=0&&dist<(phase===2?8.5:6.6)&&Math.abs(Math.atan2(Math.sin(heading-e.yaw),Math.cos(heading-e.yaw)))<.35){
      e.state='telegraph';
      const patterns=phase===1?['cutlass','lunge','feint','whirl']:['feint','lunge','whirl','cutlass'];
      e.attackStyle=patterns[e.attackSerial%patterns.length];
      e.timer=CORSAIR.attacks[e.attackStyle].windup*(phase===2?.82:1);
      e.cooldown=e.timer+CORSAIR.attacks[e.attackStyle].recovery+.38;
      // Freeze attack heading to preserve readable telegraphs.

    } else {
      e.state='circle';
      e.timer-=dt;
      if(e.timer<=0){e.strafeSign*=-1;e.timer=1.0+((e.attackSerial%3)*.35);}
      const distanceDrive=dist>5.2?1:dist<3.2?-.55:0;
      const side=phase===2?2.65:1.85;
      e.vx=(ux*distanceDrive*CORSAIR.speed-uz*e.strafeSign*side);
      e.vz=(uz*distanceDrive*CORSAIR.speed+ux*e.strafeSign*side);
      moving=true;
    }
  }else {e.state='idle';}
  if(moving && leash>=CORSAIR.leash && (e.vx*(e.x-e.homeX)+e.vz*(e.z-e.homeZ))>0){
    e.vx=0;e.vz=0;moving=false;
  }
  const cfg=CORSAIR.attacks[e.attackStyle] || CORSAIR.attacks.cutlass;
  return {moving,strike,style:e.attackStyle,range:cfg.range,damage:cfg.damage*(phase===2?1.12:1),
    phase,telegraph:e.state==='telegraph',exposed:e.state==='recover',speed:hypot(e.vx,e.vz)};
}

export function corsairAttackFacing(e,target){if(e.attackStyle==='whirl')return true;const angle=Math.atan2(target.x-e.x,target.z-e.z);return Math.abs(Math.atan2(Math.sin(angle-e.yaw),Math.cos(angle-e.yaw)))<(e.attackStyle==='lunge'?.62:1.0);}
