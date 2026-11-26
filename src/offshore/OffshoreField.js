// V44.1: deterministic, spatially continuous offshore weather and vortex forces.
// Pure math: no GPU, DOM, random calls or frame-rate dependent state.
export const HARBOUR = Object.freeze({x:69.8,z:36.5,safe:600});
export const OFFSHORE_SITES = Object.freeze([
  {id:'fairwater',name:'近岸商路',en:'Fairwater trade route',x:130,z:760,radius:360,level:1},
  {id:'outer_storm',name:'外海风暴走廊',en:'Outer storm belt',x:-800,z:2250,radius:780,level:4},
  {id:'ghost_fleet',name:'幽焰舰队',en:'Spectral fleet',x:-600,z:2450,radius:490,level:4},
  {id:'maelstrom',name:'水龙卷海域',en:'Maelstrom Reach',x:-500,z:3570,radius:560,level:5},
  {id:'eastern_blue',name:'东部深蓝航线',en:'Eastern Blue',x:970,z:1200,radius:450,level:2}
]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=x=>{const v=clamp(x,0,1);return v*v*(3-2*v);};
const len=(x,z)=>Math.hypot(x,z);
export function vortexCenter(time=0){const t=Number.isFinite(time)?time:0;return {x:-500+90*Math.sin(t/215),z:3570+105*Math.sin(t/307+.4)};}
export function stormCells(time=0){
 const c=vortexCenter(time);
 return [{id:'reach',...c,height:235,scale:1,radius:560},
 {id:'western',x:-1120+75*Math.sin(time/247+.8),z:3230+80*Math.cos(time/281),height:190,scale:.72,radius:380},
 {id:'eastern',x:65+95*Math.sin(time/311+2),z:3790+65*Math.cos(time/203),height:280,scale:1.17,radius:470}];
}
export function lightningAt(time=0){
 const cycle=Math.floor(time/13),phase=time-cycle*13;
 const angle=cycle*2.399963;
 return {id:cycle,x:-600+Math.cos(angle)*330,z:2450+Math.sin(angle)*310,
 flash:phase<.075?1:phase>.15&&phase<.22?.7:0,phase};
}
export function weatherAt(x,z,time=0){
 if(![x,z,time].every(Number.isFinite))throw new TypeError('weatherAt requires finite coordinates/time');
 // Calm at port, no hard boundary, moving storm cells far offshore.
 let danger=0;
 for(const cell of OFFSHORE_SITES){
  if(cell.level<2)continue;
  const shift=cell.id==='outer_storm'?{x:180*Math.sin(time/289),z:125*Math.cos(time/337)}:{x:0,z:0};
  const distance=len(x-cell.x-shift.x,z-cell.z-shift.z);
  const t=smooth((cell.radius+260-distance)/480);
  danger=Math.max(danger,t*cell.level/5);
 }
 const port=len(x-HARBOUR.x,z-HARBOUR.z);
 danger*=smooth((port-410)/380);
 const gust=1.5*Math.sin(time*.09+x*.002+z*.0019);
 const windSpeed=clamp(5.5+danger*22+gust*(.25+danger*.7),2,35);
 const a=2.71+.25*Math.sin(time/180+z*.001)+danger*.55;
 const wind={x:Math.cos(a)*windSpeed,z:Math.sin(a)*windSpeed};
 const spectral=smooth((750-len(x+600,z-2450))/480);
 return {wind,windSpeed,windDirection:a,rain:clamp((danger-.28)*1.5,0,1),cloud:clamp(.27+danger*.76,0,1),visibility: Math.round(9000-7950*Math.max(danger,spectral*.98)),seaState:clamp(Math.round(danger*5),0,5),danger,lightning:clamp((danger-.65)*3.0,0,1),waveScale:1+danger*1.25,fog:Math.max(danger*.8,spectral),spectral,gust:gust*danger};
}
export function vortexForceAt(x,z,vx=0,vz=0,time=0,{radius=560,pull=1.05,swirl=.55}={}){
 if(![x,z,vx,vz,time,radius,pull,swirl].every(Number.isFinite)||radius<=0)throw new TypeError('Invalid vortex input');
 let ax=0,az=0,intensity=0,nearest=Infinity,center=vortexCenter(time);
 for(const cell of stormCells(time)){
 const dx=x-cell.x,dz=z-cell.z,r=len(dx,dz),range=cell.radius*radius/560;
 if(r<nearest){nearest=r;center=cell;}
 if(r>=range)continue;
 const q=smooth(1-r/range),inv=1/Math.max(.01,r);const nx=r>.01?dx*inv:1,nz=r>.01?dz*inv:0;
 // The water spiral is a damped acceleration field, never a position teleport.
 ax+=-nx*pull*q*q-nz*swirl*q;
 az+=-nz*pull*q*q+nx*swirl*q;
 // Damping prevents the core from accumulating infinite orbital speed.
 ax-=vx*.028*q;az-=vz*.028*q;
 intensity=Math.max(intensity,q);
 }
 const a=Math.hypot(ax,az);if(a>1.8){ax*=1.8/a;az*=1.8/a;}
 return {ax,az,intensity,r:nearest,center};
}
export function safeFromHarbour(x,z,radius=850){return len(x-HARBOUR.x,z-HARBOUR.z)>=radius;}
