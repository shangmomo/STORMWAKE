import {HERITAGE_STATION_METERS} from './StationSites.js';
import {deckHeight,ORIGINAL_AFT_LADDER} from './HeritageDeck.js';
// Deterministic ship-local graph. All coordinates follow ship pitch/roll when
// attached under boat.group; jobs walk between stations rather than teleport.
import {SHIP_STATION_SITES} from './StationSites.js';
export const CREW_NODES=Object.freeze({
 aft:{x:0,y:.35,z:-2.6},mid:{x:0,y:.35,z:-.8},forward:{x:.38,y:.35,z:1.72},bow:{x:0,y:.79,z:3.25},
 helm:{...SHIP_STATION_SITES.helm},sail_main:{...SHIP_STATION_SITES.sail_main},sail_jib:{...SHIP_STATION_SITES.sail_jib},anchor:{...SHIP_STATION_SITES.anchor},
 cannon_port:{...SHIP_STATION_SITES.cannon_port},cannon_starboard:{...SHIP_STATION_SITES.cannon_starboard},
 repair:{...SHIP_STATION_SITES.repair},bucket:{...SHIP_STATION_SITES.bucket},hold:{x:0,y:-.47,z:-1.3},hatch:{x:0,y:.35,z:-1.3}
});
const edges={
 aft:['mid'],mid:['aft','forward','helm','sail_main','cannon_port','cannon_starboard','repair','bucket','hatch'],
 forward:['mid','bow','sail_main','sail_jib'],bow:['forward','anchor'],
 helm:['mid'],sail_main:['mid','forward'],sail_jib:['forward'],anchor:['bow'],
 cannon_port:['mid'],cannon_starboard:['mid'],repair:['mid'],bucket:['mid'],hatch:['mid','hold'],hold:['hatch']
};
export function crewRoute(from,to){if(!CREW_NODES[from]||!CREW_NODES[to])return [];
 const queue=[[from]],seen=new Set([from]);while(queue.length){const route=queue.shift(),last=route.at(-1);if(last===to)return route;
 for(const next of edges[last]||[])if(!seen.has(next)){seen.add(next);queue.push([...route,next]);}}
 return [];
}
// Upper sterncastle is NOT directly linked to midships. The source GLB has a
// narrow original ladder at x~1.03 z~-6.62. Avoid AI clipping directly through
// its bulkhead when switching between helm and midships tasks.
const heritageEdges={...edges,
 aft:['aft_upper'],aft_upper:['aft','aft_ladder','helm'],aft_ladder:['aft_upper','aft_lower'],
 aft_lower:['aft_ladder','mid'],helm:['aft_upper'],
 anchor:['mid'],
 mid:['anchor','aft_lower','fore_lower','sail_main','cannon_port','cannon_starboard','repair','bucket','hatch'],
 fore_lower:['mid','fore_step'],fore_step:['fore_lower','fore_upper'],fore_upper:['fore_step','forward'],
 forward:['fore_upper','bow','sail_jib'],sail_main:['mid']
};
export function heritageCrewRoute(from,to){
 if(!heritageEdges[from]||!heritageEdges[to])return [];
 const queue=[[from]],visited=new Set([from]);
 while(queue.length){const route=queue.shift(),last=route.at(-1);
  if(last===to)return route;
  for(const next of heritageEdges[last])if(!visited.has(next)){visited.add(next);queue.push([...route,next]);}
 }
 return [];
}
export function walkCrew(actor,target,dt,{speed=1.75}={}){
 const dx=target.x-actor.x,dz=target.z-actor.z,dy=target.y-actor.y;const sc=actor.metricScale||{x:1,y:1,z:1},len=Math.hypot(dx*sc.x,dz*sc.z,dy*sc.y);
 if(len<.045){Object.assign(actor,{x:target.x,y:target.y,z:target.z});return true;}
 const t=Math.min(1,Math.max(0,dt)*speed/len);
 actor.x+=dx*t;actor.y+=dy*t;actor.z+=dz*t;actor.yaw=Math.atan2(dx*sc.x,dz*sc.z);
 return t===1;
}

// A separate metric deck route for the 22m ship, converted to the old visual
// group's native local units ONLY at the rendering/navigation boundary.
export function heritageCrewNodes(shipScale){
 const raw={
  aft:{x:0,y:deckHeight(-7.4,0),z:-7.4},
  aft_upper:{x:ORIGINAL_AFT_LADDER.x,y:deckHeight(ORIGINAL_AFT_LADDER.upperZ,ORIGINAL_AFT_LADDER.x),z:ORIGINAL_AFT_LADDER.upperZ},
  aft_ladder:{x:ORIGINAL_AFT_LADDER.x,y:(deckHeight(ORIGINAL_AFT_LADDER.upperZ,ORIGINAL_AFT_LADDER.x)+deckHeight(ORIGINAL_AFT_LADDER.lowerZ,ORIGINAL_AFT_LADDER.x))/2,z:ORIGINAL_AFT_LADDER.z},
  aft_lower:{x:ORIGINAL_AFT_LADDER.x,y:deckHeight(ORIGINAL_AFT_LADDER.lowerZ,ORIGINAL_AFT_LADDER.x),z:ORIGINAL_AFT_LADDER.lowerZ},
  mid:{x:0,y:deckHeight(-2.25,0),z:-2.25},
  fore_lower:{x:1.03,y:deckHeight(1.6,1.03),z:1.6},
  fore_step:{x:1.03,y:deckHeight(2.7,1.03),z:2.7},
  fore_upper:{x:1.03,y:deckHeight(3.85,1.03),z:3.85},
  forward:{x:0,y:deckHeight(4,0),z:4},
  bow:{x:0,y:deckHeight(5,0),z:5},
  ...HERITAGE_STATION_METERS,
  hold:{...HERITAGE_STATION_METERS.repair},hatch:{...HERITAGE_STATION_METERS.carry}
 };
 return Object.fromEntries(Object.entries(raw).map(([id,p])=>[id,{
  x:p.x/shipScale.x,y:p.y/shipScale.y,z:p.z/shipScale.z
 }]));
}
