import {cutMetricOpening,placeMetricObject} from './MetricOpening.js';
// STORMWAKE V50: the actual user supplied Sketchfab Captain's Quarters GLB.
// Licensed CC BY 4.0 (TheMadraver). The whole authored room is fitted under
// the original Dutch quarterdeck, not replaced by a synthetic wooden cuboid.
import {Group,Mesh} from '../engine/index.js';
import {box,prepare,mergePrepared,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
import {loadStaticArtistModel} from './HeritageAssetRig.js';
import {deckHeight} from './HeritageDeck.js';
import {CAPTAIN_FURNITURE_COLLIDERS} from './CaptainCabinColliders.js';

export const CAPTAIN_ROOM=Object.freeze({
  x:-.70,y:-.32,z:-8.36,scaleXZ:.37,scaleY:.58,
  floorY:-.37,z0:-9.86,z1:-7.03,halfW:1.18,
  hatchX:.17,hatchZ:-7.43,hatchHalfX:.61,hatchHalfZ:.58,
  // desk as measured inside the uploaded GLB, in its own author coordinates
  chartX:-1.0,chartY:.863,chartZ:1.39
});
export function inCaptainHatch(p){return !!p&&Math.abs(p.x-CAPTAIN_ROOM.hatchX)<CAPTAIN_ROOM.hatchHalfX-.02&&Math.abs(p.z-CAPTAIN_ROOM.hatchZ)<CAPTAIN_ROOM.hatchHalfZ-.02;}
export function cabinInside(p){return !!p&&Math.abs(p.x)<CAPTAIN_ROOM.halfW&&p.z>CAPTAIN_ROOM.z0&&p.z<CAPTAIN_ROOM.z1&&p.y<1.65;}
export class CaptainCabinInterior {
  constructor(boat){
    this.boat=boat;
    this.root=new Group();this.root.name='V50 sourced TheMadraver Captain Quarters - under real Dutch quarterdeck';
    this.root.scale.set(1/boat.shipScale.x,1/boat.shipScale.y,1/boat.shipScale.z);
    boat.group.add(this.root);
    this.room=null;this.chart=null;this.hatchOpen=false;this.autoSealHatch=false;this.layer='hold';
    this.scale={x:1,y:1,z:1};
    this.layout={x:CAPTAIN_ROOM.hatchX,z:CAPTAIN_ROOM.hatchZ,floorY:CAPTAIN_ROOM.floorY,
      deckY:deckHeight(CAPTAIN_ROOM.hatchZ,CAPTAIN_ROOM.hatchX),halfW:CAPTAIN_ROOM.halfW,
      z0:CAPTAIN_ROOM.z0,z1:CAPTAIN_ROOM.z1,deckExit:{x:-.64,z:CAPTAIN_ROOM.hatchZ}};
  }
  async load(loadModel=loadStaticArtistModel){
    const room=await loadModel('/models/stormwake_v50/captains_quarters_access.glb');
    const align=new Group();align.name='Sourced quarters, geometrically fitted to Dutch aft cabin';
    align.position.set(CAPTAIN_ROOM.x,CAPTAIN_ROOM.y,CAPTAIN_ROOM.z);
    align.rotation.y=-Math.PI/2;
    align.scale.set(CAPTAIN_ROOM.scaleXZ,CAPTAIN_ROOM.scaleY,CAPTAIN_ROOM.scaleXZ);
    align.add(room.root);this.root.add(align);this.room=align;
    // The fitted source room has a second closed leaf behind the Dutch door.
    // Remove only that duplicate leaf from rendering and solid geometry.
    const duplicate=room.root.getObjectByName('Door002_Door_0');if(duplicate)duplicate.visible=false;
    this.relocatedBarrel=placeMetricObject(align,this.boat,'Barrel001',{x:.92,y:-.33,z:-7.38});
    this.relocatedCrate=placeMetricObject(align,this.boat,'OpenSmallCrate003',{x:.62,y:.20,z:-7.60});
    this.entryOpening=cutMetricOpening(align,this.boat,{min:[-1.23,-.29,-7.80],max:[-.53,2.03,-6.80]});
    room.root.traverse(o=>{o.userData.dryInterior=true;if(o.material)o.material.underwaterLighting='none';});
    // A visible, climbable ladder connects both real openings; unlike the V48
    // hatch trigger it has individual rungs and remains boat-local in storms.
    const bottom=CAPTAIN_ROOM.floorY+.08,top=this.layout.deckY+.14;
    const ladder=[];const make=(w,h,d,x,y,z,color)=>prepare(box(w,h,d),{color,rough:.93,matrix:mat4(x,y,z)});
    for(const x of [CAPTAIN_ROOM.hatchX-.32,CAPTAIN_ROOM.hatchX+.32])
      ladder.push(make(.055,top-bottom,.060,x,(top+bottom)/2,CAPTAIN_ROOM.hatchZ-.24,0x705138));
    for(let y=bottom+.18;y<top-.12;y+=.28)
      ladder.push(make(.69,.055,.080,CAPTAIN_ROOM.hatchX,y,CAPTAIN_ROOM.hatchZ-.24,0x96714d));
    const ladderMesh=new Mesh(mergePrepared(ladder),landMaterial);ladderMesh.name='V50 roof-hatch ladder, actual physical ship-local rungs';
    ladderMesh.castShadow=true;ladderMesh.receiveShadow=true;this.root.add(ladderMesh);this.ladderMesh=ladderMesh;ladderMesh.visible=false; // rear source door now serves as sole quarters entrance
    // Hinged-plank hatch cover occupies exactly the opening in the sourced
    // quarterdeck; CLOSED by default, OPEN only during ladder transit.
    // It is not a second floating deck or a substitute room wall.
    const cover=new Mesh(mergePrepared([make(1.105,.075,1.01,.2975,this.layout.deckY-.0375,-7.455,0x806044)]),landMaterial);
    cover.name='V50 quarterdeck structural hatch lid - stands over UV-cut Dutch planks';
    cover.castShadow=true;cover.receiveShadow=true;this.root.add(cover);this.hatchCover=cover;
    // Retain the source's visible cut-out, don't draw a custom closed slab.
    cover.visible=true; // flush, solid removable hatch cover; no wheel-obstructing ladder
    // V53: four walkable-looking, ship-local treads leading from the fitted
    // quarters floor towards the original Dutch bulkhead's raised sill.
    // This is a visible structural retrofit, not a second decorative door.
    const steps=[];
    const rise=(.86-CAPTAIN_ROOM.floorY)/7,z0=-7.76,run=.96/7;
    for(let i=0;i<7;i++){const h=rise*(i+1);steps.push(make(.69,h,run+.004,-.88,CAPTAIN_ROOM.floorY+h/2,z0+run*(i+.5),0x79583d));}
    steps.push(make(.69,1.23,.96,-.88,CAPTAIN_ROOM.floorY+1.23/2,-6.32,0x79583d));
    const stairMesh=new Mesh(mergePrepared(steps),landMaterial);
    stairMesh.name='V53 real cabin door threshold access steps (no new door leaf)';
    stairMesh.castShadow=true;stairMesh.receiveShadow=true;
    this.root.add(stairMesh);this.doorSteps=stairMesh;
    const chart=await loadModel('/models/stormwake_v50/captain_sea_chart.glb');
    chart.root.position.set(CAPTAIN_ROOM.chartX,CAPTAIN_ROOM.chartY,CAPTAIN_ROOM.chartZ);
    align.add(chart.root);this.chart=chart.root;
    return this;
  }
  floorAt(){return CAPTAIN_ROOM.floorY;}
  inHatch(_p){return false;} // sealed quarterdeck hatch; use original aft bulkhead door
  inside(p){return cabinInside(p);}
  setHatchOpen(_open){this.hatchOpen=false;if(this.hatchCover)this.hatchCover.visible=true;}
  constrain(p,previousFeet=null){
    if(previousFeet&&this.boat.collisionWorld){
      const radius=.26,passage=p.x> -1.16&&p.x<-.60&&p.z> -7.80&&p.z< -6.18;
      p.x=Math.max(-CAPTAIN_ROOM.halfW+radius,Math.min(CAPTAIN_ROOM.halfW-radius,p.x));
      p.z=Math.max(CAPTAIN_ROOM.z0+radius,Math.min(passage?-6.18:CAPTAIN_ROOM.z1-radius,p.z));return;
    }
    // An independent collision enclosure follows the ship's single rigid-body
    // frame. The supplied model is decoration, NOT a magical walk-through shell.
    const radius=.23; // shoulder/body collision radius in the fitted historic room
    const startX=p.x,startZ=p.z;
    p.x=Math.max(-CAPTAIN_ROOM.halfW+radius,Math.min(CAPTAIN_ROOM.halfW-radius,p.x));
    p.z=Math.max(CAPTAIN_ROOM.z0+radius,Math.min(CAPTAIN_ROOM.z1-radius,p.z));
    // Six rounds of conservative contact response against geometry-baked
    // furniture bodies. These volumes, not a guessed empty cuboid, prevent
    // walking THROUGH the supplied bed, desk, table, chair and cargo barrels.
    for(let iter=0;iter<6;iter++){
      let resolved=false;
      for(const body of CAPTAIN_FURNITURE_COLLIDERS){
        if(p.y+.96<body.min[1]||p.y>body.max[1])continue;
        const lx=body.min[0]-radius,rx=body.max[0]+radius;
        const lz=body.min[2]-radius,rz=body.max[2]+radius;
        if(p.x<=lx||p.x>=rx||p.z<=lz||p.z>=rz)continue;
        const candidates=[{v:lx-p.x,axis:'x'},{v:rx-p.x,axis:'x'},
                          {v:lz-p.z,axis:'z'},{v:rz-p.z,axis:'z'}];
        candidates.sort((a,b)=>Math.abs(a.v)-Math.abs(b.v));
        if(candidates[0].axis==='x')p.x+=candidates[0].v;
        else p.z+=candidates[0].v;
        resolved=true;
      }
      p.x=Math.max(-CAPTAIN_ROOM.halfW+radius,Math.min(CAPTAIN_ROOM.halfW-radius,p.x));
      p.z=Math.max(CAPTAIN_ROOM.z0+radius,Math.min(CAPTAIN_ROOM.z1-radius,p.z));
      if(!resolved)break;
    }
    // When adjacent pieces form a tight passage, repeated axis projections can
    // bounce between them. Find the nearest measured free capsule spot rather
    // than accepting penetration or teleporting outside the hull.
    const clear=(x,z)=>{
      if(x<-CAPTAIN_ROOM.halfW+radius||x>CAPTAIN_ROOM.halfW-radius||
         z<CAPTAIN_ROOM.z0+radius||z>CAPTAIN_ROOM.z1-radius)return false;
      return CAPTAIN_FURNITURE_COLLIDERS.every(c=>
        p.y+.96<c.min[1]||p.y>c.max[1]||
        x<=c.min[0]-radius||x>=c.max[0]+radius||
        z<=c.min[2]-radius||z>=c.max[2]+radius);
    };
    if(!clear(p.x,p.z)){
      let best=null,bestDist=Infinity;
      for(let step=0;step<=18;step++)for(let ax=-step;ax<=step;ax++)for(let az=-step;az<=step;az++){
        if(step&&Math.max(Math.abs(ax),Math.abs(az))!==step)continue;
        const x=startX+ax*.10,z=startZ+az*.10;
        if(!clear(x,z))continue;
        const d=Math.hypot(x-startX,z-startZ);
        if(d<bestDist){best={x,z};bestDist=d;}
      }
      if(best){p.x=best.x;p.z=best.z;}
    }

  }
  update(_water){ /* seawater is NOT tied to decorative cabin floor */ }
}
