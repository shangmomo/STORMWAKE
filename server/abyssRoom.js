import {validatePressure,nearBulkhead} from '../src/oceanhunt/PressureSystemsV80.js';
import {CABIN,ABYSS_STATIONS,cabinMove,nearStation,canStationAction} from '../src/oceanhunt/AbyssCrewRules.js';
import {LEVIATHAN_SPELLS} from '../src/oceanhunt/LeviathanSpells.js';
const fin=(x,m)=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=m;
const vec=(v,m=20000)=>Array.isArray(v)&&v.length===3&&v.every(x=>fin(x,m));
const STATES=new Set(['stalk','windup','charge','bite','pulse','vortex','waterjet','sonic','recovery',...Object.keys(LEVIATHAN_SPELLS)]);
const bounded=(v,max)=>fin(v,max)&&v>=0;
export function validateAbyssSnapshot(s){if(!s||!vec(s.pos)||!vec(s.godPos)||!['yaw','pitch','roll','godYaw','godPitch','godBank'].every(k=>fin(s[k],Math.PI*1000))||!bounded(s.hull,1500)||!bounded(s.godHP,6100)||!fin(s.speed,160)||!fin(s.throttle,1)||!fin(s.rudder,1)||!fin(s.diveVelocity,50)||!STATES.has(s.bossState)||!bounded(s.stateClock,15)||!Number.isInteger(s.parts)||!bounded(s.parts,6)||!Number.isInteger(s.ammo)||!bounded(s.ammo,48))return false;
 if(!['fireCooldown','harpoonCooldown','chargeCooldown','counterPulseCooldown','pingCooldown','repairCooldown'].every(k=>bounded(s[k],20)))return false;
 if(s.cast&&(!LEVIATHAN_SPELLS[s.cast.kind]||!['origin','target','end'].every(k=>vec(s.cast[k]))||!fin(s.cast.age,10)))return false;
 if(!Array.isArray(s.shots)||s.shots.length>40||!s.shots.every(q=>q&&['torpedo','harpoon','jet','charge'].includes(q.kind)&&vec(q.pos)&&vec(q.velocity,250)))return false;
 if(s.waves!==undefined&&(!Array.isArray(s.waves)||s.waves.length>12||!s.waves.every(w=>w&&['sonic','pulse'].includes(w.kind)&&vec(w.pos)&&vec(w.dir,1)&&bounded(w.scale,400))))return false;
 return typeof s.finished==='boolean'&&(s.pressure===undefined||validatePressure(s.pressure,s.hull))&&(s.repairProgress===undefined||bounded(s.repairProgress,1));}
// A departing simulator may leave in-flight attacks whose contact flags are not
// replicated. Resume a committed checkpoint at a safe recovery boundary instead
// of replaying damage or refunding ammunition. No checkpoint means no migration.
export function migrationCheckpoint(snapshot,doors){if(!snapshot||!validateAbyssSnapshot(snapshot)||!validatePressure(snapshot.pressure,snapshot.hull))return null;const s=structuredClone(snapshot);Object.assign(s,{throttle:0,rudder:0,diveVelocity:0,speed:0,bossState:'recovery',stateClock:1.55,cast:null,shots:[],waves:[],repairProgress:0});if(s.pressure)s.pressure.doors=[...doors];return s;}
export class AbyssRoom{
 constructor(hub){this.hub=hub;this.session=null;this.members={};this.last={};this.snapshot=null;this.doors=[false,false];}
 publish(){this.hub.broadcast({type:'abyss_members',active:!!this.session,host:this.session,members:this.members});}
 sendStatus(p){this.hub.send(p,{type:'abyss_members',active:!!this.session,host:this.session,members:this.members});if(this.snapshot)this.hub.send(p,{type:'abyss_snapshot',state:this.snapshot});if(this.session)this.hub.send(p,{type:'abyss_doors',doors:[...this.doors]});}
 leave(id){if(!this.members[id])return;const lastSnap=this.last[id]?.snap;delete this.members[id];delete this.last[id];if(id!==this.session){this.publish();return;}
  const next=Object.keys(this.members).find(key=>this.hub.players.has(key));const checkpoint=Number.isFinite(lastSnap)&&this.hub.now()-lastSnap<=3000?migrationCheckpoint(this.snapshot,this.doors):null;
  if(!next||!checkpoint){this.session=null;this.members={};this.last={};this.snapshot=null;this.doors=[false,false];this.publish();return;}
  this.session=next;this.snapshot=checkpoint;
  // Send the checkpoint before announcing the new host, on the same ordered socket.
  for(const key of Object.keys(this.members)){const peer=this.hub.players.get(key);if(peer)this.hub.send(peer,{type:'abyss_snapshot',state:checkpoint});}
  this.publish();
 }
 handle(p,m){const id=p.id,now=this.hub.now();
  if(m.type==='abyss_status'){this.sendStatus(p);return;}
  if(m.type==='abyss_start'){if(id!==this.hub.hostId||this.session)return;this.session=id;this.members={[id]:{x:0,z:7.8,yaw:0,station:null}};this.snapshot=null;this.doors=[false,false];this.publish();return;}
  if(m.type==='abyss_join'){if(!this.session||this.members[id])return;const i=Object.keys(this.members).length;this.members[id]={x:i%2?-.6:.6,z:7.8-i*.75,yaw:0,station:null};this.publish();if(this.snapshot)this.hub.send(p,{type:'abyss_snapshot',state:this.snapshot});this.hub.send(p,{type:'abyss_doors',doors:[...this.doors]});return;}
  if(m.type==='abyss_leave'){this.leave(id);return;}
  const actor=this.members[id];if(!actor)return;const prev=this.last[id]??(this.last[id]={pose:now-100,drive:0,action:0,snap:0});
  if(m.type==='abyss_pose'){if(now-prev.pose<60||!fin(m.x,20)||!fin(m.z,20)||!fin(m.yaw,Math.PI*1000))return;const max=.45+Math.min(.35,(now-prev.pose)/1000)*3.7,dx=m.x-actor.x,dz=m.z-actor.z,d=Math.hypot(dx,dz);prev.pose=now;if(actor.station||d>max)return;const next=cabinMove(actor,dx,dz,this.doors);actor.x=next.x;actor.z=next.z;actor.yaw=m.yaw;this.publish();return;}
  if(m.type==='abyss_station'){if(m.station===null){actor.station=null;this.publish();this.hub.send(p,{type:'abyss_station_result',ok:true,station:null});return;}const occupied=Object.entries(this.members).some(([key,a])=>key!==id&&a.station===m.station);if(!ABYSS_STATIONS[m.station]||!nearStation(actor,m.station)||occupied){this.hub.send(p,{type:'abyss_station_result',ok:false,reason:occupied?'occupied':'distance'});return;}actor.station=m.station;this.publish();this.hub.send(p,{type:'abyss_station_result',ok:true,station:m.station});return;}
  if(m.type==='abyss_command'){if(m.action==='door'){if(actor.station||nearBulkhead(actor)!==m.index||![0,1].includes(m.index))return;const z=[-4,4][m.index];if(!this.doors[m.index]&&Object.values(this.members).some(a=>Math.abs(a.z-z)<.65&&Math.abs(a.x)<1.5))return;}else if(!canStationAction(actor.station,m.action))return;
   if(m.action==='drive'){if(now-prev.drive<60||!['thrust','turn','ballast'].every(k=>fin(m[k],1)))return;prev.drive=now;}
   else {if(now-prev.action<130)return;prev.action=now;}
   const command={type:'abyss_command',actor:id,action:m.action};if(m.action==='door'){this.doors[m.index]=!this.doors[m.index];command.index=m.index;command.closed=this.doors[m.index];if(this.snapshot?.pressure)this.snapshot.pressure.doors=[...this.doors];for(const key of Object.keys(this.members)){const to=this.hub.players.get(key);if(to)this.hub.send(to,{type:'abyss_doors',doors:[...this.doors],index:m.index,actor:id});}}if(m.action==='drive')Object.assign(command,{thrust:m.thrust,turn:m.turn,ballast:m.ballast,flank:m.flank===true});if(['fire','harpoon'].includes(m.action)&&vec(m.aim,1)&&Math.hypot(...m.aim)>.95)command.aim=m.aim;
   const host=this.hub.players.get(this.session);if(host)this.hub.send(host,command);return;}
  if(m.type==='abyss_snapshot'&&id===this.session&&now-prev.snap>=60&&validateAbyssSnapshot(m.state)){prev.snap=now;this.snapshot=m.state;if(this.snapshot.pressure)this.snapshot.pressure.doors=[...this.doors];for(const key of Object.keys(this.members))if(key!==id){const to=this.hub.players.get(key);if(to)this.hub.send(to,{type:'abyss_snapshot',state:this.snapshot});}return;}
 }
}
