import {Vector3} from '../engine/index.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function cargoMass(item){return Number.isFinite(item.massKg)?clamp(item.massKg,1,500):item.origin==='supplies'?{planks:21,cannonballs:72,chainshot:24,rations:9}[item.supplyKind]||35:item.origin==='rescue'?65:40;}
export class ShipLoadDynamics{
 constructor(boat){this.enabled=Number.isFinite(boat.mass)&&!!boat.com&&!!boat.inertia;if(this.enabled){this.dryMass=boat.mass;this.dryCOM=boat.com.clone();this.dryInertia=boat.inertia.clone();}this.collapse=0;}
 update(dt,boat,damage,items=[]){if(!this.enabled)return;const water=clamp(damage.water||0,0,1),sinking=!!damage.isSinking?.();this.collapse=sinking?Math.min(1,(boat.voyageFloodCollapse||0)+Math.min(.1,dt)*.065):0;boat.voyageFloodCollapse=this.collapse;
  const parts=[];for(const item of items){const at=item.state==='hold'?item.holdLocal:item.state==='world'&&item.onDeck?item.deckLocal:null;if(at&&[at.x,at.y,at.z].every(Number.isFinite))parts.push({mass:cargoMass(item),at});}
  this.cargoKg=parts.reduce((n,p)=>n+p.mass,0);const sections=damage.hull?.sections||{stern:water,mid:water,bow:water},sum=sections.stern+sections.mid+sections.bow,gravity=new Vector3(0,-1,0).applyQuaternion(boat.quaternion.clone().invert());
  if(water>0)parts.push({mass:this.dryMass*.48*water,at:{x:clamp(gravity.x*.85,-.7,.7),y:-.55,z:sum>0?(-6*sections.stern+5*sections.bow)/sum:0}});
  let total=this.dryMass;const center=this.dryCOM.clone().multiplyScalar(this.dryMass);for(const p of parts){total+=p.mass;center.addScaledVector(p.at,p.mass);}center.multiplyScalar(1/total);boat.mass=total;boat.com.copy(center);boat.inertia.copy(this.dryInertia);
  // Parallel-axis contribution from cargo and flooded water. The rigid dry
  // hull's inertia remains fixed; no accumulating mass after repeated updates.
  for(const p of [{mass:this.dryMass,at:this.dryCOM},...parts]){const x=p.at.x-center.x,y=p.at.y-center.y,z=p.at.z-center.z;boat.inertia.x+=p.mass*(y*y+z*z);boat.inertia.y+=p.mass*(x*x+z*z);boat.inertia.z+=p.mass*(x*x+y*y);}
  boat.voyageBuoyancyScale=(1-.55*water)*(1-this.collapse*.97);this.floodKg=this.dryMass*.48*water;
 }
}
