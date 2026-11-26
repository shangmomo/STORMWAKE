// V53: ship-local ladder, accessible floor entry and a *supported* exit footpoint.
// The previous version ended a climb directly above a hole: on the next physics
// frame the sailor fell back down, which made the ladder appear one-way.
const smooth=t=>t*t*(3-2*t);
export function beginShipClimb(player,interior,entering,{duration=1.2}={}){
 if(player.shipClimb||player.stationId||player.mode!=='deck'||!player.deckPos||!(interior.nearEntrance?.(player.deckPos)??interior.inHatch(player.deckPos)))return false;
 const h=interior.layout;
 const start={x:player.deckPos.x,y:player.deckPos.y,z:player.deckPos.z};
 const exit=h.deckExit||{x:h.x-.75,z:h.z};
 const end=entering?{x:h.x,y:interior.floorAt(h.z),z:h.z}:{x:exit.x,y:h.deckY,z:exit.z};
 player.shipClimb={start,end,entering,t:0,duration,interior,layer:interior.layer||'hold',kind:'hatch',
    landing:{x:h.x,y:h.deckY,z:h.z}};
 interior.setHatchOpen(true);player.deckVel?.set?.(0,0,0);return true;
}
// The original hinged door has a high raised threshold. The source room is
// lower than that threshold: a direct flat walking transition is impossible.
// An attached timber stair and guided climb bridge this measured difference.
// Door must be OPEN first; the action is never a teleport to another ship.
export function beginCabinDoorExit(player,interior,door,{duration=1.35}={}){
 if(player.shipClimb||player.stationId||player.mode!=='deck'||player.deckLayer!=='hold'||!door?.open||door.passable===false)return false;
 const from={x:player.deckPos.x,y:player.deckPos.y,z:player.deckPos.z};
 const landing={x:-.88,y:.86,z:-6.80};
 const end={x:-.88,y:1.06,z:-6.28};
 player.shipClimb={start:from,landing,end,entering:false,t:0,duration,interior,layer:'hold',kind:'doorExit'};
 player.deckVel?.set?.(0,0,0);return true;
}
export function beginCabinDoorEnter(player,interior,door,{duration=1.35}={}){
 if(player.shipClimb||player.stationId||player.mode!=='deck'||player.deckLayer!=='deck'||!door?.open||door.passable===false)return false;
 const start={x:player.deckPos.x,y:player.deckPos.y,z:player.deckPos.z};
 const landing={x:-.88,y:.86,z:-6.80};
 const end={x:-.88,y:interior.floorAt(-7.34),z:-7.34};
 player.shipClimb={start,landing,end,entering:true,t:0,duration,interior,layer:'hold',kind:'doorEnter'};
 player.deckVel?.set?.(0,0,0);return true;
}
export function advanceShipClimb(player,dt,interior){
 const c=player.shipClimb;if(!c)return false;
 interior=c.interior||interior;
 const axis=c.manual?(Number(player.input.down('KeyW'))-Number(player.input.down('KeyS')))*(c.entering?-1:1):(c.reversing?-1:1);
 c.t=Math.max(0,Math.min(1,c.t+axis*Math.max(0,Math.min(c.manual?.05:.10,dt))/Math.max(.35,c.duration)));
 const u=smooth(c.t);
 let a=c.start,b=c.end,t=u;
 if(c.kind==='doorExit'){
  // Rise within the cabin before passing through the source bulkhead portal.
  if(u<.68){b=c.landing;t=smooth(u/.68);}
  else{a=c.landing;t=smooth((u-.68)/.32);}
 }else if(c.kind==='hatch'&&!c.entering){
  // Remain on the ladder axis until the feet are almost level with the deck.
  // Only the last 14% steps SIDEWAYS onto a sampled solid plank.
  if(u<.86){b=c.landing;t=smooth(u/.86);}
  else{a=c.landing;t=smooth((u-.86)/.14);}
 }else if(c.kind==='doorEnter'){
  if(u<.32){b=c.landing;t=smooth(u/.32);}
  else{a=c.landing;t=smooth((u-.32)/.68);}
 }
 player.deckPos.set(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);
 player.deckVel?.set?.(0,0,0);player.deckGrounded=true;
 if((c.reversing||c.manual&&axis<0)&&c.t<=0){
  player.deckLayer=c.entering?'deck':c.layer;player.shipClimb=null;
  interior?.setHatchOpen(c.entering?false:true);
 }else if(c.t>=1){
  player.deckLayer=c.entering?c.layer:'deck';player.shipClimb=null;
  if(c.entering)interior?.constrain(player.deckPos);
  interior?.setHatchOpen(interior?.autoSealHatch?false:c.entering);
  // Prevent the step immediately after arrival from inheriting free-fall momentum.
  player.deckVel?.set?.(0,0,0);player.deckGrounded=true;
 }
 return true;
}
