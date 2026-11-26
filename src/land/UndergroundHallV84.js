// A second, separately graded lake chamber; the old mine reservoir stays intact.
export const DEEP_LAKE=Object.freeze({x:350,z:-551,rx:10,rz:13,surface:43.4,depth:6});
export const LAKE_LOOKOUT=Object.freeze({x:364,z:-549});
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function hallProfile(p,z){const f=smooth((-z-524)/13)*smooth((z+579)/13),ext=36*f;return {...p,x:p.x-ext*.5,width:p.width+ext*.5,high:p.high+9*f};}
export function lakeDistance(x,z,p=DEEP_LAKE){return Math.hypot((x-p.x)/p.rx,(z-p.z)/p.rz);}
export function deepLakeGround(x,z,h){const r=lakeDistance(x,z);if(r>=1.45)return h;const bank=Math.max(h,DEEP_LAKE.surface+.9);const land=h+(bank-h)*(1-smooth((r-1.12)/.33));const w=1-smooth((r-.35)/.77);return land+(DEEP_LAKE.surface-DEEP_LAKE.depth-land)*w;}
