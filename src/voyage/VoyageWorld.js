import {Group,Mesh,Vector3} from '../engine/index.js';
import {prepare,mergePrepared,box,cylinder,sphere,torus,rod,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
import {SHIP_STATION_SITES,stationLocalMeters} from '../ship/StationSites.js';
// Named M1 waypoints. The second area is a marked main-island coast landing;
// the existing 2048m terrain, foliage and FFT ocean are intentionally untouched.
export const STORMWAKE_M1=Object.freeze({
  noticeBoard:{x:48,z:-75},broker:{x:56,z:-71},
  mossIsland:{center:{x:-176,z:-42},radius:80},
  digSite:{x:-176,z:-42},mossLanding:{x:-130,z:10},
  gunboatPatrol:[{x:-155,z:130},{x:-80,z:155}],
  returnPort:{x:69.8,z:42},shipId:'stormwake'
});
const piece=(geo,color,x,y,z,sx=1,sy=sx,sz=sx,ry=0,metal=0)=>prepare(geo,{color,rough:metal?.46:.85,metal,matrix:mat4(x,y,z,0,ry,0,sx,sy,sz)});
const timber=0x62412a, brass=0xd3ae69, jade=0x4ccfbd, slate=0x3c4c56;
function root(name,x,y,z,parts){const g=new Group();g.name=name;g.position.set(x,y,z);const m=new Mesh(mergePrepared(parts),landMaterial);m.castShadow=true;m.receiveShadow=true;g.add(m);return g;}
export function makeVoyageNotice(x,y,z){const parts=[
 piece(box(2.4,1.55,.17),timber,0,1.7,0),piece(box(2.1,1.15,.03),0xd5b887,0,1.76,.11),
 piece(box(.17,2.75,.16),timber,-1.0,1.35,-.14),piece(box(.17,2.75,.16),timber,1.0,1.35,-.14),
 piece(torus(.42,.05,8,28),jade,0,1.84,.19),piece(box(2.7,.15,.34),brass,0,2.52,.01)];
 return root('V39 Gold Tide notice board',x,y,z,parts);}
export function makeBroker(x,y,z){const parts=[
 piece(box(2.6,.95,1.0),timber,0,.48,0),piece(box(2.75,.16,1.25),0x7b573c,0,1.0,0),
 piece(box(2.25,.54,.11),brass,0,1.35,-.4),piece(box(.9,.21,.1),jade,0,1.41,-.47),
 piece(cylinder(.32,.34,.33,16),0xc18d42,-.85,1.31,0),piece(cylinder(.25,.25,.36,16),0xe3b75f,-.4,1.33,.15)];
 return root('V39 Gold Tide broker',x,y,z,parts);}
export function makeDigMarker(x,y,z){const parts=[
 piece(cylinder(1.8,1.95,.22,20),slate,0,.06,0),piece(torus(1.20,.08,8,35),jade,0,.23,0),
 piece(box(.18,2.8,.19),timber,-1.3,1.4,-.8),piece(box(1.85,.48,.18),0x68553d,-1.3,2.62,-.8),
 piece(sphere(.24,10,8),jade,1,.54,.35)];
 return root('V39 Moss dig site',x,y,z,parts);}
export function makeChest(){const parts=[
 piece(box(.95,.63,.63),0x8b5633,0,.30,0),piece(box(1.0,.21,.7),0x663f2a,0,.71,0),
 ...[-.36,.36].flatMap(x=>[piece(box(.095,.76,.72),brass,x,.42,0),piece(box(.095,.74,.72),0x342b2c,x,.42,0,.8,1,1)]),
 piece(box(.16,.20,.10),jade,0,.52,.4)];
 return root('V39 movable treasure chest',0,0,0,parts);}
// Distinctive, native geometry for each real station (not nine identical dummy beacons).
// These meshes have no collision; standing/interaction use the actual hull floor.
export function makeStationMarkers(boatModel){
 const out={};
 for(const [id,l] of Object.entries(SHIP_STATION_SITES)){
  // V49: On the original Dutch ship, do NOT instantiate decorative procedural
  // plates, fictional winches, cannons or cabin furnishings over the source art.
  // Keep an invisible interaction transform, and attach only measured CC0 props.
  if(boatModel.heritageDeck){
    const p=stationLocalMeters(boatModel,id),sc=boatModel.shipScale;
    const g=new Group();g.name='V49 metric-only operation transform '+id;
    g.position.set(p.x/sc.x,p.y/sc.y,p.z/sc.z);
    g.scale.set(1/sc.x,1/sc.y,1/sc.z);g.userData.metric=true;
    if(id.startsWith('cannon_')){
      const tube=new Group();tube.name='V49 CC0 real cannon aim pivot '+id;
      tube.position.set(0,.17,0);g.add(tube);g.userData.tube=tube;g.userData.cannonSide=id==='cannon_port'?1:-1;
    }
    boatModel.group.add(g);out[id]=g;continue;
  }
  const parts=[piece(cylinder(.30,.33,.07,16),slate,0,.035,0),piece(torus(.30,.028,6,24),jade,0,.10,0)];
  if(id==='helm'){
   // The actual wheel is animated by BoatModel.setSteering(); this is its
   // deck-mounted brass compass and navigation dial.
   parts.push(piece(cylinder(.14,.17,.11,12),brass,0,.15,0),piece(torus(.14,.024,6,20),0xe4dbba,0,.23,0));
  }else if(id.startsWith('sail_')){
   // Working rope winch: axle, lashings, turning handle.
   parts.push(piece(cylinder(.25,.25,.31,12),timber,0,.30,0),
    piece(torus(.24,.055,6,18),0xb4a285,0,.48,0),piece(cylinder(.045,.045,.45,8),brass,.22,.44,0));
  }else if(id==='anchor'){
   parts.push(piece(cylinder(.38,.42,.20,14),timber,0,.21,0),
    piece(torus(.39,.055,8,24),brass,0,.34,0),piece(cylinder(.08,.08,.60,12),brass,0,.53,0));
  }else if(id.startsWith('cannon_')){
   parts.push(piece(box(.43,.22,.37),timber,0,.20,0),
    piece(cylinder(.19,.22,.30,12),0x343b3b,0,.38,0),
    piece(torus(.19,.045,8,24),brass,0,.59,0));
  }else if(id==='repair'){
   // Riveted repair barrel with useful silhouette, matching native boat timbers.
   parts.push(piece(cylinder(.33,.28,.54,12),timber,0,.29,0),
    piece(torus(.31,.035,6,18),brass,0,.15,0),piece(torus(.31,.035,6,18),brass,0,.43,0),
    piece(box(.30,.04,.16),0xd4c6a4,0,.60,0));
  }else if(id==='bucket'){
   parts.push(piece(cylinder(.23,.16,.34,12),0x616c69,0,.24,0),
    piece(torus(.23,.025,7,22),brass,0,.42,0),piece(torus(.28,.032,7,18),jade,0,.62,0));
  }else if(id==='carry'){
   parts.push(piece(box(.68,.09,.55),timber,0,.10,0),
    piece(box(.09,.065,.62),brass,-.30,.18,0),piece(box(.09,.065,.62),brass,.30,.18,0));
  }
  const point=stationLocalMeters(boatModel,id);
  const scale=boatModel.shipScale||{x:1,y:1,z:1};
  const g=root('STORMWAKE operational station '+id,point.x/scale.x,point.y/scale.y,point.z/scale.z,parts);
  // The old BoatModel root is enlarged for buoyancy. Operational instruments
  // and hand-height proportions must remain exactly one real metre.
  g.scale.set(1/scale.x,1/scale.y,1/scale.z);g.userData.metric=!!boatModel.heritageDeck;
  // A small instrument needle can move without reallocating combined geometry.
  if(['sail_main','sail_jib','anchor'].includes(id)){
   const dial=root('STORMWAKE '+id+' status needle',0,.63,0,[
    piece(box(.32,.035,.052),jade,.15,0,0),piece(sphere(.055,8,6),brass,0,.015,0)]);
   g.add(dial);g.userData.needle=dial;
  }
  if(id.startsWith('cannon_')){
   const tube=new Group();tube.name='V42 actual movable gun barrel '+id;
   tube.position.set(0,.40,0);
   const side=id==='cannon_port'?1:-1;
   const assembly=buildCannonTube(side);tube.add(assembly);
   g.add(tube);g.userData.tube=tube;g.userData.cannonSide=id==='cannon_port'?1:-1;
  }
  boatModel.group.add(g);out[id]=g;
 }
 return out;
}
function buildCannonTube(side){
 const parts=[
  // Cylinder defaults to +Y; rotate into the broadside +X/-X axis.
  prepare(cylinder(.15,.19,.83,14),{color:0x2b3336,rough:.48,metal:.35,matrix:mat4(side*.48,0,0,0,0,Math.PI/2)}),
  prepare(torus(.17,.032,8,18),{color:0xd2b77b,rough:.5,matrix:mat4(side*.90,0,0,0,Math.PI/2,0)}),
  prepare(box(.38,.10,.30),{color:0x755038,rough:.83,matrix:mat4(0,-.18,0)})
 ];
 return new Mesh(mergePrepared(parts),landMaterial);
}
// V42: one clear, readable ship fire source for bucket targeting. The actual
// intensity comes from ShipDamage.fire; this is not a free-floating HUD icon.
export function makeDeckFire(boatModel){
 const station=stationLocalMeters(boatModel,'repair');
 const scale=boatModel.shipScale||{x:1,y:1,z:1};
 const flames=[
  piece(sphere(.22,10,8),0xf5a434,0,.22,0),
  piece(sphere(.17,10,8),0xf26a26,-.17,.47,.07),
  piece(sphere(.14,10,8),0xffd86d,.15,.63,-.07),
  piece(sphere(.10,10,8),0xfce6b5,-.02,.81,0),
  piece(sphere(.19,10,8),0x453b38,0,.11,0)
 ];
 const flame=root('STORMWAKE damage fire · bucket target',(station.x+.5)/scale.x,(station.y+.35)/scale.y,(station.z+.2)/scale.z,flames);
 flame.scale.set(1/scale.x,1/scale.y,1/scale.z);
 flame.visible=false;boatModel.group.add(flame);return flame;
}
export function makeCannonBall(){const g=root('V39 cannonball',0,0,0,[piece(sphere(.18,12,8),0x252c31,0,0,0),piece(torus(.2,.02,6,16),0xeead68,0,0,0)]);return g;}
