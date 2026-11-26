// Pure common validation for land and ship directors. Explicit bounds prevent
// NaN values from winning a candidate sort or bypassing distance checks.
export function interactionDistance(candidate,point,defaultRange,defaultHeight){
 const pos=candidate?.position;if(!pos||!point||typeof candidate.perform!=='function'||typeof candidate.id!=='string'||!candidate.id)return null;
 if(![pos.x,pos.y,pos.z,point.x,point.y,point.z].every(Number.isFinite))return null;
 const range=candidate.range??defaultRange,height=candidate.heightRange??defaultHeight,priority=candidate.priority??0;
 if(!Number.isFinite(range)||range<0||!Number.isFinite(height)||height<0||!Number.isFinite(priority))return null;
 const distance=Math.hypot(pos.x-point.x,pos.z-point.z);
 if(distance>range||Math.abs(pos.y-point.y)>height)return null;
 return {distance,range,height,priority};
}

// The initial physical press owns the entire hold. A candidate disappearing
// never transfers the held key to a different target; require a fresh press.
export function heldInteraction(input,id,candidates,point){return !!(id&&input.enabled&&!input.gameplayBlocked&&input.interactionOwner==='voyage'&&input.down('KeyE')&&!input.hit('KeyE')&&candidates.some(c=>c.id===id&&interactionDistance(c,point,3.2,4)));}
