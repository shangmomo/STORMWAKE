// Sealed cabin camera uses air, not the exterior ocean medium.
// Boat frame coordinates are not needed: the layer transition is authoritative.
export function isDryHoldCamera(player){
  if(!player||player.mode!=='deck')return false;
  if(player.deckLayer==='hold'||player.deckLayer==='lowerHold')return true;
  return !!(player.shipClimb?.entering&&player.shipClimb.t>.45) ||
    !!(player.deckPos&&player.deckPos.y<.72&&
      (player.shipInterior?.inside(player.deckPos)||player.lowerHold?.inside(player.deckPos)));
}
