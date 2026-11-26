// STORMWAKE V49 — AUTHORITATIVE DUTCH HULL GEOMETRY, NOT A SECOND SHIP.
// Floor samples were baked from the user-uploaded ORIGINAL uncut Blender hull.
// There is NO custom captain's cabin, overlay deck, bulkhead, or false hold here.
// Only four outboard boarding ladders are new geometry. Their metric coordinates
// agree with the ship-local boarding mechanism and the original hull envelope.
import { Group, Mesh, Vector3 } from '../engine/index.js';
import {box,rod,torus,cylinder,sphere,prepare,mergePrepared,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
import {outerHalfWidth} from './DutchHullOuterProfile.js';
import {DUTCH_WALKMAP} from './DutchHullWalkmap.js';
import {flightHeight} from './ShipDeckRoutes.js';
import {ANCHOR_HAWSE} from './AnchorKinematics.js';

export const ART_ALIGNMENT=Object.freeze({scaleX:1.064,scaleY:.75,scaleZ:1.064,offsetY:-.40,offsetZ:-.70});
// New passage is cut into source Dutch geometry at the aft bulkhead.
// All bounds are in the aligned, authoritative vessel frame (metres).
export const DUTCH_AFT_DOOR=Object.freeze({xMin:-1.45,xMax:-.31,z:-6.635,footMin:.82,roof:1.914,height:1.094});
export const DUTCH_SAILOR=Object.freeze({height:1.75,doorwayHeight:1.02,eye:1.62,doorwayEye:.89,radius:.26});
export function inDoorClearance(x,y){return x>DUTCH_AFT_DOOR.xMin+DUTCH_SAILOR.radius &&
  x<DUTCH_AFT_DOOR.xMax-DUTCH_SAILOR.radius && y>=DUTCH_AFT_DOOR.footMin-.1 &&
  y+DUTCH_SAILOR.doorwayHeight<=DUTCH_AFT_DOOR.roof+.02;}
export const DECK_MAIN_Y=.84; // source hull ~1.65m high, after ONE model alignment
// The *uncut* original model has no proper ladder/hatch penetration into a hold.
// Do not revive V47's 2.07x2.84m artificial hole in the visible source deck.
export const HATCH=Object.freeze({x:0,z:-4.0,halfX:0,halfZ:0,available:false});
export const CABIN=Object.freeze({integrated:true,asset:'/models/stormwake_v50/captains_quarters_access.glb'});
export const REAL_HATCH=Object.freeze({x0:-.235,x1:.83,z0:-7.94,z1:-6.97});
// Main hold hatch is cut from ORIGINAL source deck triangles in V54, separate
// from the quarterdeck captain's-room hatch.
export const LOWER_HATCH=Object.freeze({x0:-1.25,x1:-.47,z0:-2.66,z1:-1.70});
// Actual source-Dutch aft-bulkhead ladder, not procedural parts.
// The closed original door panel is immediately to its left.
export const ORIGINAL_AFT_LADDER=Object.freeze({x:1.03,z:-6.62,lowerZ:-5.93,upperZ:-7.12});
export function originalAftLadderAccess(p){
 return p&&Math.abs(p.x-ORIGINAL_AFT_LADDER.x)<.67&&Math.abs(p.z-ORIGINAL_AFT_LADDER.z)<1.0;
}
export function inRealHatch(x,z){return x>REAL_HATCH.x0&&x<REAL_HATCH.x1&&z>REAL_HATCH.z0&&z<REAL_HATCH.z1;}
export const BOARDING_LADDERS=Object.freeze([
  Object.freeze({side:1,z:-4.9}),Object.freeze({side:-1,z:-4.9}),
  Object.freeze({side:1,z:1.9}),Object.freeze({side:-1,z:1.9})
]);
export function actualHalfWidth(z){
  return Math.max(.40,outerHalfWidth(z)-.34);
}
// Sampling stays inside the ORIGINAL boat geometry. A missing triangle sample
// never becomes an invented platform. Values are heights encoded in centimetres.
export function measuredFloorAt(x,z,maxY=Infinity){
  if(!Number.isFinite(x)||!Number.isFinite(z))return null;
  const stair=flightHeight(x,z);if(stair!==null&&stair<=maxY+.018)return stair;
  const m=DUTCH_WALKMAP;
  if((x>LOWER_HATCH.x0&&x<LOWER_HATCH.x1&&z>LOWER_HATCH.z0&&z<LOWER_HATCH.z1))return null; // both physical source-mesh apertures remain open at every height
  const fx=(x-m.x0)/m.step,fz=(z-m.z0)/m.step;
  const ix=Math.round(fx),iz=Math.round(fz);
  if(ix<0||ix>=m.nx||iz<0||iz>=m.nz)return null;
  const options=[];
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const cx=ix+dx,cz=iz+dz;
    if(cx<0||cx>=m.nx||cz<0||cz>=m.nz)continue;
    const d=Math.hypot(x-(m.x0+cx*m.step),z-(m.z0+cz*m.step));
    if(d>.41)continue;
    const index=cz*m.nx+cx;
    for(const layer of [m.low,m.high]){
      if(layer[index]<=0)continue;
      const y=layer[index]/100-2;
      if(y<=maxY+.012)options.push({y,d});
    }
  }
  if(!options.length)return null;
  // Do not borrow a platform >15cm taller from a different cell unless the
  // player is already there. This avoids false steps at overhead details.
  options.sort((a,b)=>a.d-b.d || b.y-a.y);
  const nearest=options[0];
  const close=options.filter(v=>v.d<=nearest.d+.07&&Math.abs(v.y-nearest.y)<.23);
  return close.reduce((sum,v)=>sum+v.y,0)/close.length;
}
export function deckHeight(z,x=0){
  // In the waist choose the authored main deck, not the top of a capstan,
  // rail ornament or hatch rim. At the raised castles use the upper surface.
  const limit=z<-6.2||z>3.85?2.18:1.17;
  const sampleX=(x>LOWER_HATCH.x0&&x<LOWER_HATCH.x1&&z>LOWER_HATCH.z0&&z<LOWER_HATCH.z1)?.82:x; // sample uncut rail-side quarterdeck alongside physical hole
  const base=measuredFloorAt(sampleX,z,limit)??measuredFloorAt(sampleX,z,3.10);
  return base===null?DECK_MAIN_Y:base;
}
export function insideHatch(){return false;}
export function ladderLocal(ladder,{outside=false}={}){
  const w=outerHalfWidth(ladder.z);
  const x=ladder.side*(outside?w+.38:w-.70);
  const y=deckHeight(ladder.z,ladder.side*(w-.62));
  return {x,y,z:ladder.z};
}
export function nearbyLadder(x,z,maxDist=1.2){
  let best=null,dist=maxDist;
  for(const l of BOARDING_LADDERS){const foot=ladderLocal(l,{outside:true});
    const d=Math.hypot(x-foot.x,z-foot.z);
    if(d<dist){best=l;dist=d;}}
  return best;
}
export function railingEscape(x,z,footY){
  if(Math.abs(x)<actualHalfWidth(z)-.18)return false;
  const y=deckHeight(z,x>0?actualHalfWidth(z)-.65:-actualHalfWidth(z)+.65);
  return footY>y+.35;
}
// Deliberately retired: V48 had a fabricated solid rectangle that did not
// correspond to ANY wall of the author's ship. Never keep its invisible wall.
export function cabinCollision(x,z){return {x,z};}
const plank=(w,h,d,x,y,z,color)=>prepare(box(w,h,d),{color,rough:.93,matrix:mat4(x,y,z)});
export class HeritageDeck {
  constructor(boat){
    this.boat=boat;
    this.originalHullOnly=true;
    this.realInteriorEnabled=false; // set true by App after the sourced interior loads
    this.doorOpen=false;
    this.root=new Group();this.root.name='V55 CC0 Dutch hull: slim ship-attached rope ladders';
    // Old V44 helm and boarding camera coordinates were attached to a very
    // different 8m hull. Place cameras above ACTUAL author-created decks.
    boat.helmPoint.set(.75,deckHeight(-8.43,.75),-8.43);
    boat.helmEye.set(.75,deckHeight(-8.43,.75)+1.65,-8.43);
    boat.boardPoint.set(0,deckHeight(-4.75),-4.75);
    const s=boat.shipScale;
    this.root.scale.set(1/s.x,1/s.y,1/s.z);
    boat.group.add(this.root);
    const rungs=[];
    for(const l of BOARDING_LADDERS){
      const outside=ladderLocal(l,{outside:true});
      // Rope tails extend past the wave surface; upper ends go INTO the
      // bulwark's timber cleats instead of looking like freestanding fences.
      const top=outside.y+.76, bottom=-2.05,beam=outerHalfWidth(l.z);
      const x=l.side*(beam+.15),z=l.z;
      const rope=(a,b,r,c)=>rungs.push(prepare(rod(new Vector3(...a),new Vector3(...b),r,7),{color:c,rough:.96}));
      for(const dz of [-.32,.32]){
        // Anchored top, shallow bow-shaped rope run, and extended submerged tail.
        rope([l.side*(beam-.09),top+.03,z+dz],[x,top-.28,z+dz],.027,0x7e6542);
        const N=14;
        for(let i=0;i<N;i++){
          const y0=top-.28+(bottom-top+.28)*i/N;
          const y1=top-.28+(bottom-top+.28)*(i+1)/N;
          const sway=t=>Math.sin(t*2.1+l.z)*.048;
          rope([x+sway(i/N),y0,z+dz],[x+sway((i+1)/N),y1,z+dz],.025,0xb39a6c);
        }
      }
      // Narrow rope-and-oak treads, not thick full-height rigid vertical posts.
      for(let y=bottom+.20;y<top-.33;y+=.285){
        const fx=x+Math.sin((top-y)*.8+l.z)*.047;
        rungs.push(plank(.068,.042,.67,fx,y,z,0x987049));
      }
      for(const dz of [-.32,.32]){
        rungs.push(plank(.14,.08,.10,l.side*(beam-.08),top+.03,z+dz,0x685039));
      }
    }
    const mesh=new Mesh(mergePrepared(rungs),landMaterial);
    mesh.name='V55 ship-fixed rope ladder with cleats, two flexible lines and submerged treads';
    mesh.castShadow=true;mesh.receiveShadow=true;this.root.add(mesh);
    // Every operator pushes the same shaft: authored Dutch GLB hub rotates in
    // HeritageAssetRig; these wooden handholds turn together at its speed.
    this.windlass=new Group();this.windlass.name='V55 linked multi-crew windlass crossbars';
    const cx=0,cz=-3.65,cy=deckHeight(cz)+.85;
    this.windlass.position.set(cx,cy,cz);
    const spokes=[];
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2,ux=Math.cos(a),uz=Math.sin(a);
      spokes.push(prepare(rod(new Vector3(ux*.12,0,uz*.12),new Vector3(ux*1.05,0,uz*1.05),.070,9),{color:0x765039,rough:.91}));
      spokes.push(prepare(rod(new Vector3(ux*1.03,-.12,uz*1.03),new Vector3(ux*1.03,.31,uz*1.03),.058,8),{color:0x89684d,rough:.92}));
    }
    const crossbars=new Mesh(mergePrepared(spokes),landMaterial);
    crossbars.name='four rotating wooden grips on shared axle';crossbars.castShadow=true;
    this.windlass.add(crossbars);this.root.add(this.windlass);
    // The sourced exterior hull does not contain an independent steerable helm
    // node. V55 hid the only fallback wheel. Build a genuinely visible wheel
    // aligned to the physically reachable station, not through the cabin door.
    const wx=.75,wz=-7.95,wy=deckHeight(wz,wx)+.98;
    const wheelParts=[];
    wheelParts.push(prepare(torus(.48,.065,10,36),{color:0x8e6035,rough:.87}));
    wheelParts.push(prepare(cylinder(.125,.135,.24,12),{color:0x74604a,metal:.25,rough:.67,
      matrix:mat4(0,0,0,Math.PI/2)}));
    for(let i=0;i<8;i++){
      const a=Math.PI*i/4,dx=Math.cos(a),dy=Math.sin(a);
      wheelParts.push(prepare(rod(new Vector3(0,0,0),new Vector3(dx*.59,dy*.59,0),.040,8),{color:0xb28859,rough:.86}));
      wheelParts.push(prepare(rod(new Vector3(dx*.54,dy*.54,0),new Vector3(dx*.69,dy*.69,0),.058,8),{color:0xa37b48,rough:.87}));
    }
    const pedestal=[prepare(box(.29,.82,.32),{color:0x493321,rough:.9,matrix:mat4(wx,wy-.54,wz-.18)}),
      prepare(rod(new Vector3(wx,wy-.37,wz-.18),new Vector3(wx,wy,wz),.095,10),{color:0x74604a,metal:.2,rough:.75})];
    const wheelStand=new Mesh(mergePrepared(pedestal),landMaterial);wheelStand.castShadow=true;this.root.add(wheelStand);
    this.helmWheel=new Group();this.helmWheel.name='V56 visible functional helm, linked to rudder';
    this.helmWheel.position.set(wx,wy,wz);
    const wheelMesh=new Mesh(mergePrepared(wheelParts),landMaterial);wheelMesh.castShadow=true;
    this.helmWheel.add(wheelMesh);this.root.add(this.helmWheel);
    // The capstan drives a chain lead along the starboard deck to a raised
    // hawse fairlead. No disconnected hovering chain: hardware remains attached
    // to the existing wooden hull and its original shared turning capstan.
    const cablePoints=[new Vector3(.45,deckHeight(-3.45,.45)+.20,-3.45),
      new Vector3(1.55,deckHeight(-1.9,1.55)+.16,-1.9),
      new Vector3(2.05,deckHeight(1.1,1.50)+.15,1.10),
      new Vector3(2.10,deckHeight(3.5,1.45)+.18,3.5),
      new Vector3(ANCHOR_HAWSE.x,ANCHOR_HAWSE.y,ANCHOR_HAWSE.z)];
    const chainLead=[];
    for(let i=1;i<cablePoints.length;i++)chainLead.push(prepare(rod(cablePoints[i-1],cablePoints[i],.045,10),
      {color:0x6c7174,metal:.52,rough:.58}));
    for(const pt of [cablePoints[1],cablePoints[2],cablePoints[3],cablePoints[4]]){
      chainLead.push(prepare(torus(.13,.045,8,16),{color:0x555f63,metal:.62,rough:.53,
        matrix:mat4(pt.x,pt.y,pt.z,Math.PI/2)}));
    }
    const chainLeadMesh=new Mesh(mergePrepared(chainLead),landMaterial);
    chainLeadMesh.name='V56 capstan to bow hawse, visible starboard chain route';
    chainLeadMesh.castShadow=true;this.root.add(chainLeadMesh);
    // Physical housings complement the shader-based warm lantern sources. The
    // lanterns are mounted on oak posts rather than floating in space.
    // V58 art pass: replace six solid 'boxes with bright balls' with
    // legible lantern silhouettes: oak bracket, cast-bronze cage, mullions,
    // chimney, glass-coloured core and a small suspension ring. The source
    // hull is untouched. One merged draw call for all six fixtures.
    const lanternParts=[];
    this.lanternLocalPositions=[];
    for(const [x,z] of [[-1.65,-3.0],[1.65,-3.0],[-1.65,1.75],[1.65,1.75],[-1.35,-8.05],[1.35,-8.05]]){
      const y=deckHeight(z,x),lampY=y+1.28;
      this.lanternLocalPositions.push(Object.freeze({x,y:lampY,z}));
      // Foot and iron bracket clearly connect the lantern to the deck.
      lanternParts.push(prepare(box(.13,.94,.13),{color:0x4a3428,rough:.91,matrix:mat4(x,y+.47,z)}));
      lanternParts.push(prepare(box(.39,.09,.43),{color:0x69503a,rough:.86,matrix:mat4(x,y+.95,z)}));
      for(const h of [lampY-.23,lampY+.25])
        lanternParts.push(prepare(cylinder(.215,.215,.064,12),{color:0x705b43,metal:.58,rough:.52,matrix:mat4(x,h,z)}));
      // Lantern side ribs and seam rings are true geometry, not texture bars.
      for(let i=0;i<4;i++){
        const a=i*Math.PI*.5,dx=Math.cos(a)*.17,dz=Math.sin(a)*.17;
        lanternParts.push(prepare(rod(new Vector3(x+dx,lampY-.23,z+dz),
          new Vector3(x+dx,lampY+.25,z+dz),.028,7),{color:0x554735,metal:.52,rough:.55}));
      }
      lanternParts.push(prepare(sphere(.135,12,10),{color:0xffc17a,metal:0,rough:.32,
        matrix:mat4(x,lampY,z)}));
      lanternParts.push(prepare(cylinder(.13,.20,.18,12),{color:0x473b32,metal:.38,rough:.63,
        matrix:mat4(x,lampY+.35,z)}));
      lanternParts.push(prepare(torus(.097,.018,8,16),{color:0x9c8157,metal:.7,rough:.42,
        matrix:mat4(x,lampY+.50,z,Math.PI/2)}));
    }
    const lanternMesh=new Mesh(mergePrepared(lanternParts),landMaterial);
    lanternMesh.name='V58 six physical warm lanterns: brass cage, glass core, chimney, oak mounting';
    lanternMesh.castShadow=true;lanternMesh.receiveShadow=true;
    this.root.add(lanternMesh);
    // Real stock props are loaded from CC0 GLBs by HeritageAssetRig; these
    // coordinates are ON top of sampled original deck geometry.
    const site=(x,z)=>({x,y:deckHeight(z,x)+.08,z});
    this.objects=Object.freeze({ammo:site(-1.14,2.05),chain:site(1.14,2.05)});
    this.collisionBoxes=Object.freeze([
      {center:{x:0,y:deckHeight(-1.64,0)+7,z:-1.64},half:{x:.30,y:7,z:.30},solid:true},
      {center:{x:0,y:deckHeight(6.20,0)+6.5,z:6.20},half:{x:.30,y:6.5,z:.30},solid:true}
    ]);
  }
  setDoor(){return false;}
}
