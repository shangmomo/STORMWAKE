// V37 world-scale wayfinding: ecological districts have recognisable landforms
// and readable destinations instead of scattering enemies randomly.
import {LAKE_LOOKOUT} from './UndergroundHallV84.js';
import {Group,Mesh} from '../engine/index.js';
import {prepare,mergePrepared,box,cylinder,torus,sphere,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from './LandModels.js';
export const LAND_REGIONS = Object.freeze([
  {id:'portage',name:'海风古道',x:20,z:-132,note:'发现旧石路。道路连接港口与密林，注意刻在树根旁的潮汐符号。'},
  {id:'hollow',name:'灰苔密林',x:-56,z:-174,note:'密林的树冠会遮挡远方灯塔。留心深绿色苔石与兽群的足迹。'},
  {id:'eastroad',name:'东部古道',x:93,z:-148,note:'沿东部山路向北，途经峡谷，抵达沉岩洞。'},
  {id:'ravine',name:'沉岩峡谷',x:294,z:-299,note:'沿古道前行，石洞深处有荒潮船长。'},
  {id:'camp',name:'沉岩洞口',x:395,z:-438,note:'前方是真实可步行洞室；荒潮船长在深处营地。先观察其蓄力再出手。'},
  {id:'deep-lake',name:'西侧晶岩湖厅',...LAKE_LOOKOUT,note:'地下湖：沿蓝色箭头从船长战斗区后方向西进入，岸边可步行，湖内可游泳。返回矿井请沿原通道东行。'},
  {id:'grotto74',name:'钟影岩廊',x:453,z:-457,note:'沿支路进入钟影岩廊，深入洞室调查岩层后原路返回。'},
  {id:'fossil',name:'北部化石谷',x:315,z:-650,note:'调查北部古地层。击败沉岩洞首领后可在港口接取三站勘测委托。'},
  {id:'altar',name:'被淹没的石道',x:-82,z:-208,note:'这里曾经是海岛祭坛的旧通道。沿斜坡能抵达断崖灯塔。'},
]);
const part=(g,c,x,y,z,sx=1,sy=sx,sz=sx,ry=0)=>prepare(g,{color:c,rough:.91,matrix:mat4(x,y,z,0,ry,0,sx,sy,sz)});
export function makeRegionWaypoint(land,terrain){
 const g=new Group();g.name='V37 region: '+land.name;
 g.position.set(land.x,terrain.heightAt(land.x,land.z),land.z);
 const parts=[part(cylinder(1.05,1.30,.23,16),0x4d5a54,0,.12,0),
  part(cylinder(.64,.74,.42,10),0x677878,0,.43,0),
  part(box(.19,3.2,.19),0x4e3c2f,0,1.93,0),
  part(box(2.1,.65,.17),0x735f42,0,3.3,0),
  part(box(.92,.08,.10),0xc6ac73,0,3.38,-.14),
  part(torus(.60,.04,6,28),0x83d2c2,0,.68,0)];
 for(let i=0;i<6;i++){const a=i*Math.PI/3;parts.push(part(sphere(.21,8,6),i%2?0x5a756d:0x7a9081,Math.sin(a)*1.1,.24,Math.cos(a)*1.1));}
 const mesh=new Mesh(mergePrepared(parts),landMaterial);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return g;
}
