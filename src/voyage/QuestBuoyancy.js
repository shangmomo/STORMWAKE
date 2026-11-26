export class QuestBuoyancy{
 constructor(v,name,message){this.v=v;this.message=message;this.slot=v.app.query.allocate(name,1);this.sendClock=0;}
 update(dt,q){const v=this.v,query=v.app.query;if(q.hoistStart)return;if(!['accepted','spotted','flying','latched'].includes(q.phase))return;query.setPoint(this.slot,q.crate.x,q.crate.z);if(!query.cpuValid||Math.hypot(query.resultInputs[this.slot*4]-q.crate.x,query.resultInputs[this.slot*4+1]-q.crate.z)>20)return;
  const height=query.get(this.slot).height+.18;if(!Number.isFinite(height))return;
  if(!v.net.connected)q.crate.y+=(height-q.crate.y)*Math.min(1,dt*4);
  else if(v.net.isHost){this.sendClock-=dt;if(this.sendClock<=0){this.sendClock=.15;v.net.send(this.message,{verb:'sea',height});}}
 }
}
