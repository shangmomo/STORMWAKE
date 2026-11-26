// V54 — accessible hold inside the real Dutch hull (distinct from captain's quarters).
// The deck entry is an actual hole cut out of the sourced glTF hull triangles.
// The supplementary floor/ribs are shipbuilding retrofit surfaces, not claimed
// to be components originally supplied as independent GLB mesh nodes.
import {Group,Mesh} from '../engine/index.js';
import {box,prepare,mergePrepared,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
import {Material} from '../engine/render/Material.js';
import {LAYERS} from '../core/SceneRenderer.js';
import {deckHeight} from './HeritageDeck.js';

export const LOWER_HOLD=Object.freeze({
  x:-.86,z:-2.18,hatchHalfX:.39,hatchHalfZ:.48,
  floorY:-.63,halfW:1.48,z0:-4.95,z1:3.48,
  deckExit:Object.freeze({x:.04,z:-2.18})
});
export function insideLowerHold(p){return !!p&&Math.abs(p.x)<LOWER_HOLD.halfW && p.z>LOWER_HOLD.z0 && p.z<LOWER_HOLD.z1;}
export function nearLowerHatch(p){return !!p&&Math.abs(p.x-LOWER_HOLD.x)<LOWER_HOLD.hatchHalfX&&Math.abs(p.z-LOWER_HOLD.z)<LOWER_HOLD.hatchHalfZ;}
// E/C must be available FROM A SOLID DECK PLANK beside the opening;
// do not require the avatar capsule to stand in mid-air over the hole.
export function nearLowerLadder(p){return !!p&&Math.hypot(p.x-LOWER_HOLD.x,p.z-LOWER_HOLD.z)<1.13;}
export class DutchLowerHold {
  constructor(boat){
    this.boat=boat;this.layer='lowerHold';this.scale={x:1,y:1,z:1};this.autoSealHatch=false;
    this.hatchOpen=true;this.layout={x:LOWER_HOLD.x,z:LOWER_HOLD.z,
      floorY:LOWER_HOLD.floorY,deckY:deckHeight(LOWER_HOLD.z,LOWER_HOLD.deckExit.x),halfW:LOWER_HOLD.halfW,
      z0:LOWER_HOLD.z0,z1:LOWER_HOLD.z1,deckExit:{...LOWER_HOLD.deckExit}};
    this.root=new Group();this.root.name='V54 Dutch inner hold built into sourced cut deck';
    this.root.scale.set(1/boat.shipScale.x,1/boat.shipScale.y,1/boat.shipScale.z);
    const planks=[];const piece=(x,y,z,w,h,d,c)=>prepare(box(w,h,d),{color:c,rough:.92,pattern:h>w&&h>d?1:w>d?6:7,matrix:mat4(x,y,z)});
    const zMin=LOWER_HOLD.z0+.12,zMax=LOWER_HOLD.z1-.13;
    // Supported sole and side lining remain *inside* the source model's hull.
    // Bow and stern are capped so the camera cannot see through missing underside mesh.
    for(let z=zMin;z<zMax;z+=.22){
      const dz=Math.min(.224,zMax-z);
      planks.push(piece(0,LOWER_HOLD.floorY-.045,z+dz*.5,3.13,.075,dz,0x72533b));
    }
    for(const side of [-1,1]){
      for(let z=zMin;z<zMax;z+=.41){
        const dz=Math.min(.42,zMax-z);
        planks.push(piece(side*1.55,.02,z+dz*.5,.095,1.48,dz,0x4b382c));
      }
      for(let z=zMin+.25;z<zMax;z+=1.22)
        planks.push(piece(side*1.40,-.05,z,.16,1.45,.14,0x907052));
    }
    for(const z of [zMin,zMax])planks.push(piece(0,.06,z,3.18,1.48,.13,0x4e3a30));
    // Real rung model aligned to the new deck cutout, unobstructed on both ends.
    const top=this.layout.deckY+.02,bottom=LOWER_HOLD.floorY+.10;
    for(const side of [-1,1])planks.push(piece(LOWER_HOLD.x+side*.29,(top+bottom)*.5,LOWER_HOLD.z-.32,.065,top-bottom,.065,0x5b432f));
    for(let y=bottom+.14;y<top-.11;y+=.26)planks.push(piece(LOWER_HOLD.x,y,LOWER_HOLD.z-.32,.64,.055,.08,0x9b784f));
    const dryWood=landMaterial.clone();dryWood.underwaterLighting='none';
    const surface=new Mesh(mergePrepared(planks),dryWood);
    surface.name='V54 original-ship lower-hold rebuilt planked floor + sealed bilge + ladder';
    surface.castShadow=true;surface.receiveShadow=true;this.root.add(surface);
    // Bilge is local to the sealed cargo hold. Each connected basin is
    // driven exclusively by authoritative water volumes, never by sea height.
    this.bilgeMeshes={};
    for(const [key,z0,z1] of [['stern',LOWER_HOLD.z0,-.8],['mid',-.8,1.8],['bow',1.8,LOWER_HOLD.z1]]){
      const geo=mergePrepared([piece(0,LOWER_HOLD.floorY+.024,(z0+z1)/2,LOWER_HOLD.halfW*2-.22,.012,z1-z0,0x267080)]);
      const mesh=new Mesh(geo,new Material({name:'V60Bilge_'+key,lit:false,transparent:true,side:'double',depthWrite:false,vertexColors:true,
        surface:'s.albedo=in.color.rgb*.46;s.emissive=in.color.rgb*.18;s.alpha=.53;'}));
      mesh.layers.set(LAYERS.TRANSPARENT);mesh.visible=false;this.root.add(mesh);this.bilgeMeshes[key]=mesh;
    }
    boat.group.add(this.root);
  }
  floorAt(){return LOWER_HOLD.floorY;}
  inside(p){return insideLowerHold(p);}
  inHatch(p){return nearLowerHatch(p);}
  nearEntrance(p){return nearLowerLadder(p);}
  setHatchOpen(open){this.hatchOpen=!!open;}
  constrain(p){
    const r=.22;
    p.x=Math.max(-LOWER_HOLD.halfW+r,Math.min(LOWER_HOLD.halfW-r,p.x));
    p.z=Math.max(LOWER_HOLD.z0+r,Math.min(LOWER_HOLD.z1-r,p.z));
  }
  update(water,sections=null){
    const levels=sections||{stern:water,mid:water,bow:water};
    for(const [key,mesh] of Object.entries(this.bilgeMeshes)){
      const level=Math.max(0,Math.min(.96,Number(levels[key])||0));
      mesh.visible=level>.012;mesh.position.y=level*.76;
    }
  }
}
