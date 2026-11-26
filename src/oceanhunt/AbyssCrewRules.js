// V66: shared pure simulation contract for pressure-hull local coordinates.
export const CABIN = Object.freeze({halfWidth:3.25, minZ:-12.8,maxZ:12.8,floor:-1.9,ceiling:2.3,doorHalf:1.15,bulkheads:[-4,4]});
export const ABYSS_STATIONS = Object.freeze({helm:{x:0,z:10.4,name:'驾驶台'},gun:{x:2,z:1.5,name:'武器台'},sonar:{x:-2,z:1.5,name:'声呐台'},engine:{x:0,z:-10.4,name:'工程台'}});
const cap=(v,a,b)=>Math.max(a,Math.min(b,v));
export const finite=(v,d=0)=>Number.isFinite(v)?v:d;
export const nearStation=(p,id)=>!!ABYSS_STATIONS[id]&&Math.hypot(p.x-ABYSS_STATIONS[id].x,p.z-ABYSS_STATIONS[id].z)<=1.8;
// The same swept movement is used by the renderer and server. Console bounds
// include the capsule radius. Each bulkhead includes its visible thickness.
export const CABIN_BLOCKS=Object.freeze([[-1.6,1.6,11.05,12.45],[-1.6,1.6,-12.45,-11.05],[2.07,3.25,-.02,3.02],[-3.25,-2.07,-.02,3.02]].map(Object.freeze));
export function cabinMove(p,dx,dz,doors=[false,false]){
 const r=.32, gap=CABIN.doorHalf-r,thickness=.42;let x=cap(finite(p?.x),-CABIN.halfWidth+r,CABIN.halfWidth-r),z=cap(finite(p?.z),CABIN.minZ+r,CABIN.maxZ-r);
 if(!Number.isFinite(dx)||!Number.isFinite(dz)||Math.hypot(dx,dz)>8)return {x,z};
 const blocks=[...CABIN_BLOCKS];for(const [i,w] of CABIN.bulkheads.entries()){if(doors[i])blocks.push([-4,4,w-thickness,w+thickness]);else blocks.push([-4,-gap,w-thickness,w+thickness],[gap,4,w-thickness,w+thickness]);}
 // Sweep each axis through every rectangle, not only the final destination.
 // A boundary is passable tangentially; if a previously invalid pose is inside
 // a rectangle, it can leave by its nearest edge instead of becoming stuck.
 const axis=(a,b,target,swap)=>{let next=target;for(const rect of blocks){const [lo,hi,otherLo,otherHi]=swap?[rect[2],rect[3],rect[0],rect[1]]:rect;if(b<=otherLo+1e-8||b>=otherHi-1e-8)continue;if(a<=lo+1e-8&&next>lo)next=Math.min(next,lo);else if(a>=hi-1e-8&&next<hi)next=Math.max(next,hi);else if(a>lo&&a<hi){const exit=a-lo<hi-a?lo:hi;if((exit===lo&&next>a)||(exit===hi&&next<a))next=a;}}return next;};
 const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));for(let i=0;i<n;i++){x=axis(x,z,cap(x+dx/n,-CABIN.halfWidth+r,CABIN.halfWidth-r),false);z=axis(z,x,cap(z+dz/n,CABIN.minZ+r,CABIN.maxZ-r),true);}return {x:Math.round(x*1e12)/1e12,z:Math.round(z*1e12)/1e12};
}
export const STATION_ACTIONS=Object.freeze({helm:['drive','stop'],gun:['fire','harpoon','charge'],sonar:['sonar','counter'],engine:['repair','pump']});
export const canStationAction=(station,action)=>!!STATION_ACTIONS[station]?.includes(action);
export function repairHull(hull,parts,max=1500){if(!Number.isFinite(hull)||!Number.isInteger(parts)||parts<=0||hull<=0||hull>=max-1)return null;return {hull:Math.min(max,hull+180),parts:parts-1};}
export function cabinInput(input,yaw,dt){const f=Number(!!input.up)-Number(!!input.down),r=Number(!!input.right)-Number(!!input.left),n=Math.max(1,Math.hypot(f,r));const s=3.4*cap(finite(dt),0,.05)/n;return {dx:(Math.sin(yaw)*f-Math.cos(yaw)*r)*s,dz:(Math.cos(yaw)*f+Math.sin(yaw)*r)*s};}

export const helmOwner=members=>Object.entries(members||{}).find(([,p])=>p.station==='helm')?.[0]||null;
export function resolveAbyssDrive(members,self,local,remote,elapsed){
 const helm=helmOwner(members);if(helm&&helm===self)return local;
 if(helm&&remote?.actor===helm&&elapsed-remote.at>=0&&elapsed-remote.at<.6)return remote;
 return {thrust:0,turn:0,ballast:0,flank:false};
}
