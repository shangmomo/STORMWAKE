import {Group,Vector3} from '../engine/index.js';
import {SailorBody} from './SailorBody.js';
import {createVillageResident} from '../land/LandModels.js';
const ACTORS=[['ai:kael','resident_watchman'],['ai:mei','resident_herbalist'],['ai:rowan','resident_apprentice']];
export class CrewVisuals{
 constructor(boat,stations,crew=null){
  this.boat=boat;this.stations=stations;this.crew=crew;this.elapsed=0;
  this.metricRoot=new Group();this.metricRoot.name='V64 rigid metre crew frame';const s=boat.shipScale;if(s)this.metricRoot.scale.set(1/s.x,1/s.y,1/s.z);boat.group.add(this.metricRoot);
  this.people=ACTORS.map(([id,slot],i)=>{const holder=new Group();holder.name='V64 articulated crew '+id;this.metricRoot.add(holder);const fallback=createVillageResident(i+40);holder.add(fallback.group);const body=new SailorBody(holder,{slot,style:i+2});return {id,slot,holder,fallback,body,rig:null,actor:null};});
 }
 update(dt,{aboard=true}={}){this.elapsed+=dt;
  for(const p of this.people){const a=this.crew?.getActor(p.id);p.holder.visible=aboard&&!!a;if(!a||!aboard)continue;const s=this.boat.shipScale||{x:1,y:1,z:1};p.holder.position.set(a.x*s.x,a.y*s.y,a.z*s.z);p.holder.rotation.y=a.yaw;
   let activity=a.phase==='moving'?'walk':a.job==='patch'?'repair':a.job==='bail'?'bail':a.phase==='work'?a.station==='helm'?'steer':a.station?.startsWith('anchor')?'capstan':a.station?.startsWith('sail')?'sail_pull':a.station?.startsWith('cannon')?'cannon_aim':'idle':'idle';
   p.fallback.group.visible=!p.body.ready;p.rig=p.body.actor?.rig;p.actor=p.body.actor;
   p.body.update(dt,{visible:true,activity,station:a.phase==='work'?a.station:null,boat:this.boat,feet:p.holder.getWorldPosition(new Vector3()),gear:a.holding==='plank'?'plank':'hands',working:Math.abs(this.stations.inputs.get(p.id)?.axis||0)>.01||['patch','bail'].includes(a.job)});
  }
 }
}
