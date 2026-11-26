const active=new Set(['sighting','warning','approaching','engaged']);
export class WorldEventDirector{
 constructor(seed=61015){this.seed=seed>>>0;this.clock=0;this.next=600;this.event=null;this.serial=0;}
 random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
 serialize(){return {version:1,seed:this.seed,clock:this.clock,next:this.next,event:this.event?{...this.event}:null,serial:this.serial};}
 deserialize(s){if(s?.version!==1||![s.clock,s.next,s.seed].every(Number.isFinite)||s.clock<0)return false;Object.assign(this,{seed:s.seed>>>0,clock:s.clock,next:s.next,event:s.event?{...s.event}:null,serial:s.serial||0});return true;}
 update(dt,{ship,candidates=[],integrity=100,water=0,crew=1,fleet=false}={}){
  this.clock+=Math.max(0,Math.min(1.5,dt));if(!ship)return;
  const nearest=candidates.filter(b=>b.hp>0).map(b=>({...b,d:Math.hypot(ship.x-b.x,ship.z-b.z)})).sort((a,b)=>a.d-b.d)[0];
  if(!this.event&&this.clock>=this.next&&integrity>45&&water<.45&&nearest?.d<550){this.event={id:++this.serial,boss:nearest.id,phase:'sighting',since:this.clock,x:nearest.x,z:nearest.z,crew:Math.max(1,Math.min(4,crew)),fleet:!!fleet};}
  const e=this.event;if(!e)return;const target=candidates.find(b=>b.id===e.boss),distance=target?Math.hypot(ship.x-target.x,ship.z-target.z):Infinity,age=this.clock-e.since;
  const change=phase=>{e.phase=phase;e.since=this.clock;};
  if(active.has(e.phase)&&(!target||target.hp<=0||distance>650||integrity<20||water>.72)){change('aftermath');this.next=this.clock+480+this.random()*420;}
  else if(e.phase==='sighting'&&age>8)change('warning');
  else if(e.phase==='warning'&&age>10&&distance<400)change('approaching');
  else if(e.phase==='approaching'&&age>8&&distance<250)change('engaged');
  else if(e.phase==='engaged'&&age>180){change('aftermath');this.next=this.clock+480+this.random()*420;}
  else if(e.phase==='aftermath'&&age>15)change('cooloff');
  else if(e.phase==='cooloff'&&this.clock>=this.next)this.event=null;
 }
 permits(id){return this.event?.boss===id&&this.event.phase==='engaged';}
}
