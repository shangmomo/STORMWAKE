// A local water volume, isolated from the global ocean height. It lies inside
// the excavated extension; its dry bypass never requires swimming.
import {DEEP_LAKE} from './UndergroundHallV84.js';
export const RESERVOIR=Object.freeze({x:353,z:-614,rx:4.8,rz:6.2,surface:36.55,depth:2.8});
export const MINE_SAMPLE=Object.freeze({x:344.65,z:-616.9,name:'沉岩洞 · 废弃采掘站'});
export function reservoirDistance(x,z,pool=RESERVOIR){return Math.hypot((x-pool.x)/pool.rx,(z-pool.z)/pool.rz);}
export function reservoirGround(x,z,h){const r=reservoirDistance(x,z);if(r>=1.16)return h;const t=Math.max(0,Math.min(1,(1.16-r)/.76));const w=t*t*(3-2*t);return h-(h-(RESERVOIR.surface-RESERVOIR.depth))*w;}
export function localWaterPool(x,y,z,terrain=null){if(![x,y,z].every(Number.isFinite))return null;return [RESERVOIR,DEEP_LAKE].find(pool=>y<pool.surface+4&&reservoirDistance(x,z,pool)<1.10&&(!terrain||terrain.heightAt(x,z)<pool.surface))??null;}
export function localWaterAt(x,y,z,terrain=null){return localWaterPool(x,y,z,terrain)?.surface??null;}
