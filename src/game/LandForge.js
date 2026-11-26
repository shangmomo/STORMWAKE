export const FORGE_COSTS=Object.freeze([70,140,250]);
export const REST_COST=18;
export const WEAPON_IDS=Object.freeze(['cutlass','polearm','rod']);
export function restoreForge(raw){return Object.fromEntries(WEAPON_IDS.map(id=>[id,Number.isInteger(raw?.[id])?Math.max(0,Math.min(3,raw[id])):0]));}
export function forgedDamage(base,level){return Math.round(base*(1+.12*Math.max(0,Math.min(3,Number.isInteger(level)?level:0))));}
