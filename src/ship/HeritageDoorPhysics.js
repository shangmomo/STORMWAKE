import {DUTCH_AFT_DOOR,DUTCH_SAILOR,inDoorClearance} from './HeritageDeck.js';
import {flightAt} from './ShipDeckRoutes.js';

/** Boat-local swept door collision. Keeps all of the original bulkhead solid
 * when the original hinged leaf is closed or too near the opening. Upper
 * quarterdeck traffic travels above the bulkhead via its authored ladder. */
export function canCrossAftDoor(from,to,door){
  if(!from||!to||!Number.isFinite(from.z)||!Number.isFinite(to.z))return false;
  const d=DUTCH_AFT_DOOR;
  if(flightAt(from.x,from.z,.03)?.id==='aft'&&flightAt(to.x,to.z,.03)?.id==='aft')return true;
  if(Math.min(from.y,to.y)>d.roof-.04)return true;
  if(Math.abs(from.z-to.z)<1e-7 ||
     (from.z-d.z)*(to.z-d.z)>0)return true;
  const t=Math.max(0,Math.min(1,(d.z-from.z)/(to.z-from.z)));
  const x=from.x+(to.x-from.x)*t;
  const feet=from.y+(to.y-from.y)*t;
  return !!door?.passable && inDoorClearance(x,feet);
}
export function doorEyeHeight(deckPos){
  if(!deckPos)return DUTCH_SAILOR.eye;
  const d=DUTCH_AFT_DOOR;
  // Automatically duck below the historic bulkhead. Outside the opening the
  // player returns to normal ship-scale height; no KeyC/KeyE conflict.
  return deckPos.x>d.xMin-.04 && deckPos.x<d.xMax+.04 &&
    Math.abs(deckPos.z-d.z)<.60 && deckPos.y<d.roof
    ?DUTCH_SAILOR.doorwayEye:DUTCH_SAILOR.eye;
}

/** Real opening from aft lower deck under the raised Dutch quarterdeck.
 * The source has no wooden lower floor at the companionway: allow gravity
 * through it into the fitted captain room, instead of the V51 no-floor blocker
 * treating the entrance as an invisible wall. */
export function inAftCompanionway(p){
  if(!p)return false;
  const d=DUTCH_AFT_DOOR;
  return p.x>d.xMin+DUTCH_SAILOR.radius &&
    p.x<d.xMax-DUTCH_SAILOR.radius &&
    p.z<d.z+.055 && p.z>-7.68 && p.y<d.roof-.15;
}
