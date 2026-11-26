import {LIFT,canCallLift,liftThreshold,stepLiftY} from '../src/land/MineLiftRulesV83.js';
export class MineLiftRoomV83{
 constructor(hub){this.hub=hub;this.y=LIFT.bottom;this.target=this.y;this.phase='idle';this.pending=null;this.revision=0;}
 state(){return {type:'mine_lift_state',y:this.y,target:this.target,phase:this.phase,revision:this.revision,pending:!!this.pending};}
 publish(){this.revision++;this.hub.broadcast(this.state());}
 player(id){const p=this.hub.players.get(id);return p?.joined&&p.ready&&p.mode==='walk'&&!this.hub.abyssRoom.members[id]?p:null;}
 blocked(){return [...this.hub.players.keys()].some(id=>liftThreshold(this.player(id)));}
 handle(p,m){if(m.type==='mine_lift_status'){this.hub.send(p,this.state());return true;}if(m.type!=='mine_lift_call')return false;
  if(this.phase!=='idle'||this.pending||this.blocked()||!canCallLift(this.player(p.id),this.y,m.target)){this.hub.send(p,{type:'mine_lift_result',ok:false,reason:'blocked_or_distance'});return true;}
  this.pending={id:p.id,target:m.target,at:this.hub.now()+350};this.publish();return true;}
 step(dt){if(this.pending&&this.hub.now()>=this.pending.at){const r=this.pending;this.pending=null;if(!this.blocked()&&canCallLift(this.player(r.id),this.y,r.target)){this.target=r.target;this.phase='moving';this.publish();return;}const p=this.hub.players.get(r.id);if(p)this.hub.send(p,{type:'mine_lift_result',ok:false,reason:'obstruction'});this.publish();}
  if(this.phase!=='moving')return;this.y=stepLiftY(this.y,this.target,dt);if(Math.abs(this.y-this.target)<1e-7){this.y=this.target;this.phase='idle';}this.publish();}
}
