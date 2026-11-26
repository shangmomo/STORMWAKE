// V44 P2 opt-in 23.4m heritage cutter. All dimensions below describe one
// boat-local metre frame; geometry and hydrostatics must be transformed together.
// A preview / engineering profile, not a substitute for the final licensed GLB.
export const HERITAGE_SCALE=Object.freeze({x:2.05,y:2.45,z:2.85});
const scaleVector=(p,s)=>{p.x*=s.x;p.y*=s.y;p.z*=s.z;return p;};
export function scaledLines(base,s){
 const mapped={
  zAft:base.zAft*s.z,zBow:base.zBow*s.z,length:base.length*s.z,
  deckY:base.deckY*s.y,shell:base.shell*s.x,
  wlStart:base.wlStart*s.z,wlEnd:base.wlEnd*s.z,
  houseBack:base.houseBack*s.z,houseFront:base.houseFront*s.z,
  sheerX:t=>base.sheerX(t)*s.x,
  sheerY:t=>base.sheerY(t)*s.y,
  keelY:t=>base.keelY(t)*s.y,
  tAtSheerZ:z=>base.tAtSheerZ(z/s.z),
  sheerZ:t=>base.sheerZ(t)*s.z,
  halfBeamAt:z=>base.halfBeamAt(z/s.z)*s.x,
  halfBreadth:(t,y)=>base.halfBreadth(t,y/s.y)*s.x,
  draftAt:z=>base.draftAt(z/s.z)*s.y,
 };
 return new Proxy(base,{get(target,name){return Object.hasOwn(mapped,name)?mapped[name]:Reflect.get(target,name);}});
}
export function enableHeritageProfile(model,scale=HERITAGE_SCALE){
 if(model.shipScale)throw Error('Boat already scaled');
 const s={...scale};
 if(!Object.values(s).every(v=>Number.isFinite(v)&&v>0.5&&v<4))throw Error('Invalid ship scale');
 model.shipScale=Object.freeze(s);
 model.group.scale.set(s.x,s.y,s.z);model.group.name='STORMWAKE_DutchShip_Original_Hull';
 const volume=s.x*s.y*s.z;
 for(const prop of ['helmEye','helmPoint','boardPoint','propeller','rudder'])scaleVector(model[prop],s);
 for(const prop of ['exitPoints','bowSprayPoints'])for(const p of model[prop])scaleVector(p,s);
 for(const h of model.hullSamples){scaleVector(h.position,s);h.area*=s.x*s.z;if(Number.isFinite(h.bottomY))h.bottomY*=s.y;}
 for(const c of model.colliders){scaleVector(c.center,s);scaleVector(c.half,s);}
 const d=model.dimensions;
 d.length*=s.z;d.beam*=s.x;d.draft*=s.y;d.freeboard*=s.y;d.freeboardBow*=s.y;d.deckHeight*=s.y;d.hullDepth*=s.y;
 d.waterlineLength*=s.z;d.waterlineBeam*=s.x;d.houseRoofHeight*=s.y;
 const h=model.hydro;
 h.waterplaneArea*=s.x*s.z;h.canoeVolume*=volume;h.keelVolume*=volume;h.displacedVolume*=volume;
 h.suggestedMass*=volume;h.massWithKeel*=volume;
 scaleVector(h.centerOfBuoyancy,s);h.centerOfFlotationZ*=s.z;scaleVector(h.centerOfMass,s);
 h.waterlineStart*=s.z;h.waterlineEnd*=s.z;
 h.inertia.set(h.inertia.x*volume*s.z*s.z,h.inertia.y*volume*s.z*s.z,h.inertia.z*volume*s.x*s.x);
 h.metacentricRadius*=s.x*s.x/s.y;
 model.lines=scaledLines(model.lines,s);
 return model;
}
