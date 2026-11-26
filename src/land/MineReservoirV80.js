// A local water volume, isolated from the global ocean height. It lies inside
// the excavated extension; its dry bypass never requires swimming.
export const RESERVOIR=Object.freeze({x:353,z:-614,rx:4.8,rz:6.2,surface:36.55,depth:2.8});
export const MINE_SAMPLE=Object.freeze({x:344.65,z:-616.9,name:'沉岩洞 · 废弃采掘站'});
export function reservoirDistance(x,z){return Math.hypot((x-RESERVOIR.x)/RESERVOIR.rx,(z-RESERVOIR.z)/RESERVOIR.rz);}
export function reservoirGround(x,z,h){const r=reservoirDistance(x,z);if(r>=1.16)return h;const t=Math.max(0,Math.min(1,(1.16-r)/.76));const w=t*t*(3-2*t);return h-(h-(RESERVOIR.surface-RESERVOIR.depth))*w;}
export function localWaterAt(x,y,z){return y<RESERVOIR.surface+4&&reservoirDistance(x,z)<1.10?RESERVOIR.surface:null;}
