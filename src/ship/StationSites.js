import {Vector3} from '../engine/index.js';
import {deckHeight} from './HeritageDeck.js';
// Legacy stations remain unchanged for old save games and historic hull tests.
export const SHIP_STATION_SITES=Object.freeze({
  helm:{x:-.60,y:.35,z:.30,name:'舵轮',en:'Helm'},
  sail_main:{x:.4,y:.35,z:1.55,name:'主帆索',en:'Main sail'},
  sail_jib:{x:.35,y:.74,z:2.95,name:'前帆索',en:'Jib'},
  anchor:{x:0,y:.79,z:3.45,name:'锚绞盘',en:'Anchor'},
  anchor_2:{x:-.8,y:.79,z:3.45,name:'锚绞盘第二臂',en:'Capstan arm 2'},
  anchor_3:{x:.8,y:.79,z:3.45,name:'锚绞盘第三臂',en:'Capstan arm 3'},
  anchor_4:{x:0,y:.79,z:4.2,name:'锚绞盘第四臂',en:'Capstan arm 4'},
  cannon_port:{x:1.0,y:.35,z:-.30,name:'左舷炮',en:'Port cannon'},
  cannon_starboard:{x:-1.0,y:.35,z:-.30,name:'右舷炮',en:'Starboard cannon'},
  repair:{x:.8,y:.35,z:-1.75,name:'维修桶',en:'Repair'},
  bucket:{x:-.7,y:.35,z:-1.85,name:'水桶',en:'Bucket'},
  carry:{x:0,y:.35,z:-1.55,name:'货舱',en:'Hold'},
});
// The real Dutch CC0 hull is ~22m, rather than the old 8m boat. Positions
// in metres are laid out on physically reachable decks, not scaled old jobs.
// Placement follows the exact polygon-derived Dutch hull walk surface. A
// station at the wrong V48 height is a source of visible prop penetration.
const originalStation=(x,z)=>Object.freeze({x,y:deckHeight(z,x),z});
export const HERITAGE_STATION_METERS=Object.freeze({
  helm: originalStation(.75,-8.43),
  sail_main: originalStation(1.18,-.55),
  sail_jib: originalStation(.78,4.85),
  anchor: originalStation(1.22,-3.65),
  anchor_2: originalStation(-1.22,-3.65),
  anchor_3: originalStation(0,-2.43),
  anchor_4: originalStation(0,-4.87),
  cannon_port: originalStation(1.35,1.30),
  cannon_starboard: originalStation(-1.35,1.30),
  repair: originalStation(1.28,-1.06),
  bucket: originalStation(-1.28,-.95),
  carry: originalStation(0,-5.50)
});

export function stationLocalMeters(boat,id){
  const raw=SHIP_STATION_SITES[id];if(!boat||!raw)return null;
  if(boat.shipScale && boat.heritageDeck){const measured=HERITAGE_STATION_METERS[id];if(!measured)return null;
    if(id.startsWith('anchor')){
      const angle=boat.heritageArt?.capstan?.rotation?.y||0,c=Math.cos(angle),s=Math.sin(angle);
      const dx=measured.x,dz=measured.z+3.65,x=dx*c+dz*s,z=-3.65-dx*s+dz*c;
      return {x,y:deckHeight(z,x),z};
    }return {...measured};}
  if(boat.shipScale){const sc=boat.shipScale;return {x:raw.x*sc.x,y:raw.y*sc.y,z:raw.z*sc.z};}
  return {x:raw.x,y:raw.y,z:raw.z};
}
export function shipPoint(boat,id){
  const l=stationLocalMeters(boat.model||boat,id);if(!l)return null;
  if(typeof boat.toWorld==='function'){
    const world=boat.toWorld(new Vector3(l.x,l.y,l.z),new Vector3());
    return {x:world.x,y:world.y,z:world.z};
  }
  const s=Math.sin(boat.getYaw()),c=Math.cos(boat.getYaw());
  return {x:boat.position.x+l.x*c+l.z*s,y:boat.position.y+l.y,z:boat.position.z-l.x*s+l.z*c};
}
