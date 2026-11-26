// Authoritative, deterministic placement in ship-local metres.
// No cargo is allowed to be created by storage; only existing item IDs move.
const finite=(p)=>p&&[p.x,p.z].every(Number.isFinite);
export class ShipStorageSpace {
 constructor(interior,{clearance=.72,capacity=24}={}){
  this.interior=interior;this.clearance=clearance;this.capacity=capacity;
 }
 occupied(items,ignoreId=null){
  return [...items].filter(i=>i.id!==ignoreId&&(i.state==='hold'||(i.state==='world'&&i.onDeck&&i.deckLocal&&this.interior.inside(i.deckLocal))))
   .map(i=>({id:i.id,position:i.state==='hold'?i.holdLocal:i.deckLocal})).filter(i=>finite(i.position));
 }
 validate(pos,items,ignoreId=null){
  if(!finite(pos)||!this.interior.inside(pos))return {ok:false,reason:'outside'};
  const h=this.interior.layout,s=this.interior.scale;
  const padding=Math.min(.25,.10*s.x);
  if(Math.abs(pos.x)>h.halfW-padding)return {ok:false,reason:'bulkhead'};
  // The hatch landing must stay clear for players and AI; blocking it would
  // otherwise trap the only exit from the hold.
  if(Math.abs(pos.x)<.63*s.x&&Math.abs(pos.z-h.z)<.66*s.z)return {ok:false,reason:'hatch'};
  const existing=this.occupied(items,ignoreId);
  if(existing.length>=this.capacity)return {ok:false,reason:'capacity'};
  const tooClose=existing.some(i=>Math.hypot(pos.x-i.position.x,pos.z-i.position.z)<this.clearance*s.x);
  if(tooClose)return {ok:false,reason:'occupied'};
  return {ok:true,reason:'ready'};
 }
 nearestFree(request,items,ignoreId=null){
  if(!finite(request))return null;
  const inventory=[...items];
  const h=this.interior.layout,s=this.interior.scale;
  const xMax=Math.max(0,h.halfW-.15*s.x);
  const x=Math.max(-xMax,Math.min(xMax,request.x));
  const z=Math.max(h.z0+.28*s.z,Math.min(h.z1-.28*s.z,request.z));
  const offsets=[[0,0]];
  // Search in a small, stable, local spiral rather than teleporting the item
  // to an arbitrary rack or a station on a different deck.
  for(let ring=1;ring<=3;ring++)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]])
   offsets.push([dx*ring*.34*s.x,dz*ring*.34*s.z]);
  for(const [dx,dz] of offsets){const trial={x:Math.max(-xMax,Math.min(xMax,x+dx)),z:Math.max(h.z0+.28*s.z,Math.min(h.z1-.28*s.z,z+dz))};
   if(this.validate(trial,inventory,ignoreId).ok)return {...trial,y:this.interior.floorAt(trial.z)+.07};}
  return null;
 }
}
