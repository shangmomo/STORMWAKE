import {titanCannonAim} from './CombatHelm.js';
import {stationLocalMeters} from './StationSites.js';
// V43: moving deck-local crew with a priority job queue. Crew members do not
// teleport to stations. They abandon their job if a player claims it.
import {CREW_NODES,crewRoute,heritageCrewRoute,walkCrew,heritageCrewNodes} from './CrewNavigation.js';
import {HOLD} from './ShipInterior.js';
import {keelBottomAt} from '../world/boat/HullBuilder.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ROLES=[['ai:kael','helm'],['ai:mei','sail_main'],['ai:rowan','cannon_starboard']];
export class CrewAI {
 constructor(stations,{boat=null}={}){
  this.stations=stations;
  this.nodes=boat?.heritageDeck?heritageCrewNodes(boat.shipScale):CREW_NODES;this.routeFor=boat?.heritageDeck?heritageCrewRoute:crewRoute;this.crew=ROLES.map(r=>r[0]);this.active=true;this.waypoint=null;this.lastShots=[];
  this.actors=new Map(ROLES.map(([id,station])=>[id,{id,metricScale:boat?.shipScale||null,station:null,job:station,node:station,route:[],x:this.nodes[station].x,y:this.nodes[station].y,z:this.nodes[station].z,yaw:0,phase:'work',work:0,holding:null,report:''}]));
 }
 getActor(id){return this.actors.get(id)||null;}
 assign(a,job){if(a.job===job)return;
  if(a.station&&this.stations.getOccupant(a.station)===a.id)this.stations.release(a.station,a.id);
  a.station=null;a.job=job;a.phase='moving';a.work=0;a.route=this.routeFor(a.node,job==='patch'?'hold':job==='bail'?'hold':job==='fetch'?'repair':job).slice(1);
 }
 navigate(a,job,dt){const destination=job==='patch'||job==='bail'?'hold':job==='fetch'?'repair':job;
  if(a.node===destination){a.phase='work';return true;}
  if(!a.route.length)a.route=this.routeFor(a.node,destination).slice(1);
  const next=a.route[0];if(!next){a.phase='blocked';return false;}
  a.phase='moving';if(walkCrew(a,this.nodes[next],dt)){
   a.node=next;a.route.shift();if(a.node===destination){a.phase='work';return true;}
  }
  return false;
 }
 update(dt,{boat,wind,enemy,waypoint,damage,inventory,standby=false,autopilot=false,arriving=false,sailTarget=.95,threat=null,assist=null}={}){
  if(!this.active||!boat)return;
  this.waypoint=waypoint||null;
  const human=id=>{const owner=this.stations.getOccupant(id);return owner&&!owner.startsWith('ai:');};
  const holes=damage?.holes?.filter(h=>h.state==='open')||[];
  for(const [i,id] of this.crew.entries()){
   const a=this.actors.get(id);let desired=ROLES[i][1];
   if(i===1&&!autopilot&&!standby&&!assist)desired='mid';
   else if(i===1){
    const target=assist==='furl'||standby?0:assist==='sail'?1:clamp(sailTarget,.12,1);
    const mainGap=Math.abs(target-this.stations.sailMain),jibGap=Math.abs(target-this.stations.sailJib);
    if(human('sail_main')||(!human('sail_jib')&&((a.job==='sail_jib'&&jibGap>.035)||(mainGap<=.035&&jibGap>.035))))desired='sail_jib';
   }
   if(i===2&&assist==='sail'&&this.stations.anchorTravel>.001)desired='anchor';
   if(i===2&&autopilot&&((arriving&&this.stations.anchorTravel<.999)||(!arriving&&this.stations.anchorTravel>.001)))desired='anchor';
   if(i===2&&desired!=='anchor'&&threat){const dx=threat.x-boat.position.x,dz=threat.z-boat.position.z;const rel=Math.atan2(Math.sin(Math.atan2(dx,dz)-boat.getYaw()),Math.cos(Math.atan2(dx,dz)-boat.getYaw()));desired=rel>=0?'cannon_port':'cannon_starboard';}
   if(i===2&&desired!=='anchor'&&holes.length&&(a.holding==='plank'||inventory?.count('plank')>0))desired=a.holding==='plank'?'patch':'fetch';
   else if(i===2&&desired!=='anchor'&&damage?.water>.13)desired='bail';
   if(human(desired))desired=i===0?'cannon_port':i===1?'sail_jib':'bucket';
   if(human(desired))desired='mid';
   if(desired!==a.job){
    if(a.holding==='plank'&&desired!=='patch'&&desired!=='fetch'){inventory?.put('plank');a.holding=null;}
    this.assign(a,desired);
   }
   if(!this.navigate(a,desired,dt))continue;
   if(desired==='fetch'){
    a.work+=dt;
    if(a.work>.7){
     a.work=0;
     if(inventory?.take('plank')){a.holding='plank';this.assign(a,'patch');}
     else{a.report='Plank magazine empty';this.assign(a,'cannon_starboard');}
    }
    continue;
   }
   if(desired==='patch'){
    const h=damage?.holes?.find(h=>h.state==='open');
    if(!h){if(a.holding==='plank')inventory?.put('plank');a.holding=null;this.assign(a,'cannon_starboard');continue;}
    // Reach the actual impact site from *inside* the hold; do not repair
    // a bow hit while standing at the central ladder.
    const sc=boat.shipScale||{x:1,y:1,z:1};
    // Crew nav and rig attachment are authored in the unscaled model frame.
    // Hull damage coordinates use physical boat metres. Convert once here.
    const impact={x:h.local.x/sc.x,y:h.local.y/sc.y,z:h.local.z/sc.z};
    const z=clamp(impact.z,HOLD.z0+.14,HOLD.z1-.14);
    const y=Math.max(HOLD.floorY,keelBottomAt(z)+.12);
    const target={x:clamp(impact.x,-HOLD.halfW+.08,HOLD.halfW-.08),y,z};
    if(!walkCrew(a,target,dt,{speed:1.3})){a.phase='moving';a.work=0;continue;}
    a.phase='work';a.work+=dt;
    if(a.work>=2.2){
     const near=Math.hypot(impact.x-a.x,impact.y-a.y,impact.z-a.z)<1.36;
     if(near&&a.holding==='plank'){damage.patchHole(h.id);a.report='Hull hole patched at '+h.id;a.holding=null;}
     else a.report='Repair target unreachable';
     a.work=0;this.assign(a,'cannon_starboard');
    }
    continue;
   }
   if(desired==='bail'){
    a.work+=dt;
    if(a.work>=1.6){damage?.bail(.20);a.work=0;a.report='Bailed bilge water';}
    continue;
   }
   if(desired==='mid'){a.phase='idle';continue;}
   if(!a.station||this.stations.getStation(id)!==desired){a.station=null;const owner=this.stations.getOccupant(desired);
    if(owner && owner!==id){a.phase='waiting';continue;}
    if(!this.stations.getStation(id)&&this.stations.claim(desired,id))a.station=desired;
   }
   if(this.stations.getOccupant(desired)!==id)continue;
   if(desired==='anchor'){
    const m=boat.model||boat,sc=m.shipScale||{x:1,y:1,z:1},site=stationLocalMeters(m,desired);if(site){a.x=site.x/sc.x;a.y=site.y/sc.y;a.z=site.z/sc.z;a.yaw=Math.atan2(-site.x,-3.65-site.z);}
    const manual=[...this.stations.occupants].some(([s,o])=>s.startsWith('anchor')&&!o.startsWith('ai:'));
    this.stations.setInput(desired,id,{axis:manual?0:arriving?-1:1});
   }else if(desired==='helm'){
    a.yaw=0;let axis=0;const target=this.waypoint;
    if(target){const dx=target.x-boat.position.x,dz=target.z-boat.position.z;
     const wanted=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(wanted-boat.getYaw()),Math.cos(wanted-boat.getYaw()));axis=clamp(delta*1.6,-1,1);}
    this.stations.setInput(desired,id,{axis});
   }else if(desired.startsWith('sail_')){
    const s=desired==='sail_jib'?this.stations.sailJib:this.stations.sailMain;
    const target=assist==='furl'?0:assist==='sail'?1:standby?0:clamp(sailTarget,.12,1);
    this.stations.setInput(desired,id,{axis:Math.abs(target-s)>.03?Math.sign(target-s):0,trimAxis:Math.abs((wind?.idealTrim||0)-this.stations.sailTrim)>.05?Math.sign((wind?.idealTrim||0)-this.stations.sailTrim):0});
   }else if(desired.startsWith('cannon_')){
    const side=desired==='cannon_port'?'port':'starboard',aim=titanCannonAim(boat,threat,side);a.yaw=side==='port'?Math.PI/2:-Math.PI/2;
    this.stations.setInput(desired,id,{...aim,fire:!!aim||(!threat&&!!enemy&&enemy.state==='engage'&&enemy.distance<65&&enemy.bearingSide===side),reload:true});
   }
  }
 }
}
