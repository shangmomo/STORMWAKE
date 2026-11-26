import {Group,Mesh,Vector3,Matrix4} from '../engine/index.js';
import {Material} from '../engine/render/Material.js';
import {GeoKit,box,rod,sphere,torus,mat4} from '../world/boat/GeoKit.js';
import {makeStrikeWindow} from './LandCombatTiming.js';
export const PERSONAL_WEAPONS=Object.freeze({
 cutlass:{name:'潮纹短刃',key:'1',description:'均衡 · 快速横斩',light:{cost:12,damage:32,reach:3.15,cooldown:.39},heavy:{cost:27,damage:58,reach:4.1,cooldown:.70}},
 polearm:{name:'猎潮长矛',key:'2',description:'长距离刺击 · 窄攻击角',light:{cost:14,damage:38,reach:4.5,cooldown:.52,windup:.15,activeEnd:.32,window:.43,sweep:.26},heavy:{cost:29,damage:72,reach:5.5,cooldown:.94,windup:.26,activeEnd:.49,window:.62,sweep:.34}},
 rod:{name:'潮钩钓竿',key:'3',description:'远距抽击 · 低伤害、低消耗',light:{cost:8,damage:20,reach:4.8,cooldown:.48,windup:.14,activeEnd:.34,window:.43,sweep:.78},heavy:{cost:20,damage:43,reach:6.2,cooldown:.83,windup:.22,activeEnd:.49,window:.60,sweep:.53}}
});
export function personalStrike(id,heavy){const w=PERSONAL_WEAPONS[id]||PERSONAL_WEAPONS.cutlass;return {...makeStrikeWindow(heavy),...(heavy?w.heavy:w.light)};}
export function createPersonalWeapon(id){const g=new Group();const k=new GeoKit(),V=(x,y,z)=>new Vector3(x,y,z);const add=(geo,color,x=0,y=0,z=0)=>k.add('weapon',geo,{color,matrix:mat4(x,y,z)});
 const wood=0x59402e,bronze=0xbda16a,steel=0xb3cfda,cord=0xb3a280;
 if(id==='polearm'){add(rod(V(0,-.48,0),V(0,1.6,0),.04,9),wood);add(rod(V(0,1.4,0),V(0,2.1,0),.075,6,.005),steel);add(box(.31,.07,.10),bronze,0,1.36,0);}
 else if(id==='rod'){add(rod(V(0,-.40,0),V(0,.30,0),.065,10,.04),wood);add(rod(V(0,.30,0),V(.1,1.3,0),.033,8,.018),0x9a6a43);add(rod(V(.1,1.3,0),V(.27,2.06,0),.018,8,.007),0x718b82);add(torus(.13,.035,8,16),bronze,.11,.16,0);add(rod(V(.27,2.06,0),V(.65,1.05,.04),.008,5),cord);add(torus(.065,.018,6,12),steel,.65,1.02,.04);}
 else {add(box(.11,1.00,.055),steel,0,.61,0);add(box(.047,.78,.085),0x58b4b3,0,.66,.027);add(rod(V(0,-.32,0),V(0,.12,0),.07,9),wood);add(box(.45,.095,.11),bronze,0,.12,0);add(sphere(.10,9,6),bronze,0,-.36,0);}
 const mesh=new Mesh(k.merged('weapon'),new Material({vertexColors:true,roughness:.42,metalness:.28,emissive:0x171717}));mesh.frustumCulled=false;g.add(mesh);g.name='V66 '+id;g.visible=false;return g;
}
// Use the real right-hand node, the exact same pose basis as the corsair prop.
export function updateHeldWeapon(weapon,avatar,active){if(!weapon)return;const actor=avatar?.actor,hand=avatar?.pirateStyle?.hand,rig=actor?.rig;weapon.visible=false;if(!active||!rig||!hand)return;const idx=rig.gltf.nodes.findIndex(n=>n.name===hand),p=new Vector3();if(idx<0||!rig.nodeWorld(hand,p))return;if(weapon.parent!==rig.group)rig.group.add(weapon);weapon.position.copy(p);weapon.quaternion.setFromRotationMatrix(new Matrix4().fromArray(rig.world,idx*16));weapon.rotateZ(-Math.PI/2);weapon.scale.setScalar(.67);weapon.visible=true;}
