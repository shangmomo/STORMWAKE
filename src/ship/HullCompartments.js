// V43: Each hole is a physical defect at a location in the hull, rather than a
// single global leakage percentage. Positions are metres in the ship frame.
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const validPoint=p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k]));
export class HullCompartments {
 constructor(data={}){
  this.holes=[];this.nextId=1;
  if(Array.isArray(data.holes))for(const hole of data.holes.slice(0,32)){
   if(!validPoint(hole.local)||!Number.isFinite(hole.radius))continue;
   this.holes.push({id:String(hole.id||`hole_${this.nextId}`),local:{...hole.local},radius:clamp(hole.radius,.06,.65),state:hole.state==='sealed'?'sealed':'open',progress:0});this.nextId++;
  }
  this.bounds={x:2,yLow:-1,yHigh:2,z:4.5};
  this.water=clamp(Number(data.water)||0,0,1);
  this.sections={stern:this.water,mid:this.water,bow:this.water};
  if(data.sections){for(const key of Object.keys(this.sections))
    if(Number.isFinite(data.sections[key]))this.sections[key]=clamp(data.sections[key],0,1);}
  this.water=this.totalWater();
 }
 setShipScale(scale={x:1,y:1,z:1}){
  const s={x:Number(scale.x)||1,y:Number(scale.y)||1,z:Number(scale.z)||1};
  if(Object.values(s).some(v=>v<=0||!Number.isFinite(v)))throw Error('Invalid ship hull bounds');
  this.bounds={x:2*s.x,yLow:-1*s.y,yHigh:2*s.y,z:4.5*s.z};
 }
 addHole(local,{radius=.15}={}){
  if(!validPoint(local)||this.holes.length>=32)return null;
  const hole={id:`hole_${this.nextId++}`,local:{x:clamp(local.x,-this.bounds.x,this.bounds.x),y:clamp(local.y,this.bounds.yLow,this.bounds.yHigh),z:clamp(local.z,-this.bounds.z,this.bounds.z)},radius:clamp(radius,.06,.65),state:'open',progress:0};
  this.holes.push(hole);return hole;
 }
 sectionFor(z){return z<-.8?'stern':z>1.8?'bow':'mid';}
 totalWater(){return (this.sections.stern+this.sections.mid+this.sections.bow)/3;}
 setWater(value){const target=clamp(Number(value)||0,0,1),old=this.totalWater();
   if(old<1e-7){for(const k of Object.keys(this.sections))this.sections[k]=target;}
   else{const ratio=target/old;for(const k of Object.keys(this.sections))this.sections[k]=clamp(this.sections[k]*ratio,0,1);}
   this.water=this.totalWater();return this.water;}
 getSection(z){return this.sections[this.sectionFor(z)]||0;}
 get(id){return this.holes.find(h=>h.id===id)||null;}
 nearest(local,{maxDistance=1.35}={}){
  if(!validPoint(local))return null;
  const holes=this.holes.filter(h=>h.state==='open');
  holes.sort((a,b)=>Math.hypot(a.local.x-local.x,a.local.y-local.y,a.local.z-local.z)-Math.hypot(b.local.x-local.x,b.local.y-local.y,b.local.z-local.z));
  const h=holes[0];return h&&Math.hypot(h.local.x-local.x,h.local.y-local.y,h.local.z-local.z)<=maxDistance?h:null;
 }
 patch(id){const hole=this.get(id);if(!hole||hole.state!=='open')return false;hole.state='sealed';hole.progress=1;return true;}
 // Pose-aware flow: a hole above the current waterline cannot flood the hold.
 flowRate({waterline=0,worldPoint=null}={}){
  return this.holes.reduce((sum,h)=>{
   if(h.state!=='open')return sum;
   const y=typeof worldPoint==='function'?worldPoint(h.local).y:h.local.y;
   const submersion=clamp(waterline-y,0,2);
   // A dry impact never pumps water into the hull. Deeper/larger holes
   // progressively flood the bilge, forcing timely repair and bailing.
   return sum+(submersion>.005?h.radius*h.radius*(.10+.37*Math.sqrt(submersion)):0);
  },0);
 }
 update(dt,options={}){
  const step=clamp(dt,0,.1),waterline=options.waterline??0;
  for(const hole of this.holes){
   if(hole.state!=='open')continue;
   const y=typeof options.worldPoint==='function'?options.worldPoint(hole.local).y:hole.local.y;
   const below=clamp(waterline-y,0,2);
   if(below>.005){const key=this.sectionFor(hole.local.z);
     this.sections[key]=clamp(this.sections[key]+(hole.radius*hole.radius*(.10+.37*Math.sqrt(below)))*step*3,0,1);}
  }
  // The three bilge basins are connected by slow openings below the planks.
  const delta=.085*step;
  for(const [a,b] of [['stern','mid'],['mid','bow']]){
   const flow=clamp((this.sections[a]-this.sections[b])*delta,-.02,.02);
   this.sections[a]=clamp(this.sections[a]-flow,0,1);
   this.sections[b]=clamp(this.sections[b]+flow,0,1);
  }
  this.water=this.totalWater();return this.water;
 }
 bail(amount,atZ=null){
  const before=this.water,qty=Math.max(0,amount);
  // When a sailor stands in the hold they pump from their own section. The
  // old API, with no position, always starts at the wettest section.
  const keys=atZ===null?Object.keys(this.sections).sort((a,b)=>this.sections[b]-this.sections[a]):
   [this.sectionFor(atZ),...Object.keys(this.sections).filter(k=>k!==this.sectionFor(atZ))];
  let remaining=qty*3;
  for(const k of keys){const take=Math.min(this.sections[k],remaining);this.sections[k]-=take;remaining-=take;if(remaining<1e-8)break;}
  this.water=this.totalWater();return before-this.water;
 }
 get breach(){return clamp(this.holes.filter(h=>h.state==='open').reduce((n,h)=>n+h.radius*h.radius*2,0),0,1);}
 serialize(){return {holes:this.holes.map(h=>({id:h.id,local:{...h.local},radius:h.radius,state:h.state})),water:this.water,sections:{...this.sections}};}
}
