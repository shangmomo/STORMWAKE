import {reservoirGround} from './MineReservoirV80.js';
import {SCENERY_SITES,SERVICE_PADS,SERVICE_SPURS} from './ScenerySitesV76.js';
// V70 shared, deterministic terrain authoring. All units in metres.
export const EXPEDITION_ROUTES = Object.freeze([
 [[90,-150,6],[160,-200,15],[200,-230,28],[240,-255,41],[290,-300,54],[350,-350,62],[390,-410,62],[390,-445,56],[390,-500,49],[390,-540,49]],
 [[390,-410,62],[430,-440,62],[435,-530,52],[385,-610,45],[378,-636,46],[371,-651,46],[337,-656,46],[310,-650,46]]
]);
export const CAVE = Object.freeze({x:390,z:-500,front:-445,back:-626,halfWidth:21,arenaRadius:16,floor:49});
// Continuous, bent lower gallery: transition from the existing boss chamber
// into a narrow descent, then widen into a separate archive chamber.
export function caveProfile(z){
 const u=Math.max(0,Math.min(1,(-z-533)/58)),bend=u*u*(3-2*u);
 const depth=Math.max(0,Math.min(1,(-z-535)/56));
 const width=z>=-530?20.5:20.5-11.5*Math.sin(Math.PI*Math.min(1,(-z-530)/73)*.78)+(z<-603?Math.min(2,(-z-603)*.15):0);
 return {x:390-44*bend,width,floor:z>=-500?49+7*Math.max(0,Math.min(1,(z+500)/55)):49-12*depth,high:z>=-530?14:10+2*Math.cos((-z-530)*.085)};
}
export const DEEP_SURVEY=Object.freeze({x:346,z:-592,name:'沉岩洞 · 深层岩心'});
export const FOSSIL = Object.freeze({x:310,z:-650,r:33,y:46});
export const GROTTO_SITE=Object.freeze({x:448,z:-475,y:58.5,offsetY:3.1,scale:2,rx:6,rz:18});
const GROTTO_SPUR=[[431,-458,60],[448,-458,58.5],[448,-475,58.5]];
export const ART_SITES=Object.freeze([
 {id:'house',file:'house.glb',name:'东部古道 · 石木旅舍（闭门）',x:113,z:-112,y:5,scale:.9,rx:13,rz:13},
 {id:'interior',file:'interior.glb',name:'古道远征会馆',x:190,z:-190,y:18,scale:.8,rx:18,rz:10}
]);
// V75: approved photogrammetry rock clusters, deliberately outside routes.
export const ROCK_SITES=Object.freeze([
 {id:'east-ridge',x:355,z:-330,scale:1.55,yaw:.36,sink:1.65},
 {id:'high-pass',x:402,z:-394,scale:1.65,yaw:2.0,sink:1.5},
 {id:'north-pass',x:431,z:-424,scale:1.3,yaw:1.05,sink:1.65},
 {id:'fossil-approach',x:410,z:-595,scale:1.4,yaw:-.64,sink:1.55},
 {id:'fossil-ridge',x:348,z:-644,scale:1.45,yaw:2.68,sink:.65}
]);
const rockClearance=(x,z)=>ROCK_SITES.some(s=>Math.hypot(x-s.x,z-s.z)<5*s.scale+1);
const siteClearance=(x,z)=>ART_SITES.some(s=>Math.abs(x-s.x)<s.rx+5&&Math.abs(z-s.z)<s.rz+5);
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function nearest(x,z,route){let best=Infinity,y=0;for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],dx=b[0]-a[0],dz=b[1]-a[1];const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));const d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);if(d<best){best=d;y=a[2]+(b[2]-a[2])*t;}}return {d:best,y};}
export function expeditionClearance(x,z){if(SERVICE_PADS.some(s=>Math.abs(x-s.x)<s.rx+2&&Math.abs(z-s.z)<s.rz+2)||SERVICE_SPURS.some(r=>nearest(x,z,r).d<5)||SCENERY_SITES.some(s=>!s.service&&Math.hypot(x-s.x,z-s.z)<(s.file==='mountain'?6:2.6)*s.scale)||rockClearance(x,z)||siteClearance(x,z)||Math.abs(x-GROTTO_SITE.x)<10&&Math.abs(z-GROTTO_SITE.z)<22||nearest(x,z,GROTTO_SPUR).d<5)return true;if(x<78||x>465||z> -138||z< -695)return false;const cp=caveProfile(z),cave=Math.abs(x-cp.x)<cp.width+5&&z>=CAVE.back-5&&z<=CAVE.front+5;return cave||Math.hypot(x-FOSSIL.x,z-FOSSIL.z)<FOSSIL.r+2||EXPEDITION_ROUTES.some(r=>nearest(x,z,r).d<7);}
export function bakeExpeditionTerrain(t){
 const {origin,res,texel,heights}=t;
 // Widen the route into a sheltered ravine and a distinct northern basin.
 for(let j=Math.max(0,Math.floor((-705-origin)/texel));j<Math.min(res,Math.ceil((-90-origin)/texel));j++)for(let i=Math.max(0,Math.floor((60-origin)/texel));i<Math.min(res,Math.ceil((475-origin)/texel));i++){
  const x=origin+(i+.5)*texel,z=origin+(j+.5)*texel,k=j*res+i;let h=heights[k];let a=nearest(x,z,EXPEDITION_ROUTES[0]),b=nearest(x,z,EXPEDITION_ROUTES[1]);let s=a.d<b.d?a:b;
  const w=1-smooth((s.d-4)/18);if(w>0){h+=(s.y-h)*w;t.path[k]=Math.max(t.path[k],Math.round(225*(1-smooth((s.d-2)/3))));t.rock[k]*=1-w*.7;}
  // Cave is a broad excavated corridor with a roof added as actual geometry.
  const cp=caveProfile(z),xDist=Math.abs(x-cp.x),zd=z<CAVE.back?CAVE.back-z:z>CAVE.front?z-CAVE.front:0;
  const cw=(1-smooth((xDist-cp.width)/12))*(1-smooth(zd/12))*(z< -540?smooth((b.d-5)/13):1);
  if(cw>0){h+=(cp.floor-h)*cw;t.rock[k]=Math.max(t.rock[k],cw*.65);t.path[k]=Math.max(t.path[k],Math.round(cw*120));}
  const fd=Math.hypot(x-FOSSIL.x,z-FOSSIL.z),fw=1-smooth((fd-FOSSIL.r)/18);if(fw>0){h+=(FOSSIL.y+1.1*Math.sin(x*.09)*Math.sin(z*.07)-h)*fw;t.rock[k]=Math.max(t.rock[k],fw*.38);}
  const spur=nearest(x,z,GROTTO_SPUR),sw=1-smooth((spur.d-3)/7);if(sw>0){h+=(spur.y-h)*sw;t.path[k]=Math.max(t.path[k],Math.round(190*sw));}
  for(const site of [...ART_SITES,GROTTO_SITE]){const wx=1-smooth((Math.abs(x-site.x)-site.rx)/8),wz=1-smooth((Math.abs(z-site.z)-site.rz)/8),w=wx*wz;if(w>0){h+=(site.y-h)*w;t.rock[k]*=1-w*.8;}}
  const oldHeight=h;
  for(const r of SERVICE_SPURS){const n=nearest(x,z,r),w=1-smooth((n.d-2.5)/8);if(w>0){h+=(n.y-h)*w;t.path[k]=Math.max(t.path[k],Math.round(w*195));}}
  for(const site of SERVICE_PADS){const wx=1-smooth((Math.abs(x-site.x)-site.rx)/8),wz=1-smooth((Math.abs(z-site.z)-site.rz)/8),w=wx*wz;if(w>0){h+=(site.y-h)*w;t.rock[k]*=1-w*.8;}}
  // Preserve the original route shoulders and prevent branch grading from creating a step.
  h=oldHeight+(h-oldHeight)*smooth((s.d-3)/7);
  // The excavation is deliberately west of the fossil approach. Retain its
  // road and fossil terrain; flatten only the newly roofed central corridor.
  if(z<-603&&z>=CAVE.back-2&&xDist<cp.width){const ew=(1-smooth((xDist-cp.width+3)/3))*smooth((-z-603)/4)*smooth((b.d-5)/10);h+=(cp.floor-h)*ew;}
  // Preserve the mine's rear bank independently of the rerouted fossil road.
  // The pool is carved last so its original wet/dry path remains continuous.
  if(z<-618.5&&z>=CAVE.back-2&&xDist<cp.width){const bank=smooth((-z-618.5)/2.5)*(1-smooth((xDist-cp.width+4)/4));h=Math.max(h,cp.floor+7.5*bank);}
  h=reservoirGround(x,z,h);
  heights[k]=h;
 }
 t.paths=[...t.paths,...[...EXPEDITION_ROUTES,GROTTO_SPUR,...SERVICE_SPURS].map(r=>({w:4,pts:r.map(p=>p.slice(0,2))}))];
 t.rockSites=t.rockSites.filter(s=>!expeditionClearance(s.x,s.z));
}
