import {Group,Mesh} from '../engine/index.js';
import {box,prepare,mergePrepared,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
import {deckHeight} from './HeritageDeck.js';
// Measured source-mesh mast centres; platforms sit above the sewn canvas.
export const MASTS=Object.freeze([
 Object.freeze({id:'main',x:0,z:-1.64,top:13.0,radius:1.10}),
 Object.freeze({id:'fore',x:0,z:6.20,top:12.2,radius:1.10})
]);
export const MAST=MASTS[0];
export function mastFootY(mast=MAST){return deckHeight(mast.z-.70,mast.x);}
export function mastLadderPoint(mast){return {x:mast.x,z:mast.z-.70};}
export function nearMast(p,r=1.0,mast=MAST){const f=mastLadderPoint(mast);return Math.hypot(p.x-f.x,p.z-f.z)<r;}
export function lookoutFloor(x,z,topY){let y=-Infinity;for(const m of MASTS)if(Math.abs(x-m.x)<m.radius&&Math.abs(z-m.z)<m.radius&&topY>=m.top-.15)y=Math.max(y,m.top);return y;}
const plank=(w,h,d,x,y,z,c)=>prepare(box(w,h,d),{color:c,rough:.93,matrix:mat4(x,y,z)});
export function installMastLookout(boat){
 if(!boat.shipScale)return null;
 const root=new Group();root.name='V64 source-aligned fore and main mast lookouts';root.scale.set(1/boat.shipScale.x,1/boat.shipScale.y,1/boat.shipScale.z);boat.group.add(root);
 const arr=[],colliders=[];
 for(const m of MASTS){const base=mastFootY(m),wood=0x705139,edge=0x98764d;
  for(const dx of [-.27,.27])arr.push(plank(.065,m.top-base+.12,.072,m.x+dx,(m.top+base)/2,m.z-.47,wood));
  for(let y=base+.18;y<m.top-.10;y+=.29)arr.push(plank(.60,.045,.085,m.x,y,m.z-.47,edge));
  arr.push(plank(2.2,.13,2.2,m.x,m.top-.065,m.z,wood));
  for(const x of [-1.03,1.03])for(const z of [-1.03,1.03])arr.push(plank(.065,1.02,.065,m.x+x,m.top+.51,m.z+z,wood));
  for(const x of [-1.03,1.03]){arr.push(plank(.065,.08,2.12,m.x+x,m.top+1.0,m.z,edge));colliders.push({solid:true,center:{x:m.x+x,y:m.top+.52,z:m.z},half:{x:.035,y:.52,z:1.06}});}
  arr.push(plank(2.12,.08,.065,m.x,m.top+1,m.z+1.03,edge));colliders.push({solid:true,center:{x:m.x,y:m.top+.52,z:m.z+1.03},half:{x:1.06,y:.52,z:.035}});
  for(const dx of [-.73,.73])arr.push(plank(.60,.08,.065,m.x+dx,m.top+1,m.z-1.03,edge));
 }
 const mesh=new Mesh(mergePrepared(arr),landMaterial);mesh.name='Visible paired lookout platforms and continuous ladders';mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return {root,mesh,colliders,masts:MASTS};
}
