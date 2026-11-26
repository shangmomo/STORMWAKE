// Keep the physical winch authoritative after deliberate human use.
// Auto-crew parks at a destination or when the last sailor steps ashore.
// A human helm keeps control of navigation near waypoints.
export function autoAnchor({aboard,goalDistance=Infinity,humanHelm=false,manual=false}={}) {
 if(manual) return null;
 if(!aboard) return true;
 if(humanHelm) return false;
 return Number.isFinite(goalDistance) && goalDistance < 18;
}
