import {loadCaptainMotion,beginCaptainConversation,stepCaptainConversation} from './CaptainMotionV75.js';
// Reviewed artist assets. Geometry and animation are original; derived GLBs only
// resize textures and adapt the bear's legacy PBR extension. No remote fetches.
import {Group,Matrix4,Quaternion,Vector3} from '../engine/index.js';
import {loadGLB} from '../engine/loaders/GLTF.js';
import {SkinnedModel} from '../engine/render/Skinning.js';
import {loadStaticArtistModel} from '../ship/HeritageAssetRig.js';
import {CollisionWorld} from '../systems/CollisionWorld.js';
import {strikeLineBlocked} from './LandCombatTiming.js';
import {ART_SITES} from './ExpeditionTerrain.js';
const BASE='/models/land/v73/';
export const BEAR_ACTIONS=Object.freeze({idle:'Stand_Idle_01',walk:'Walk',run:'Trot',graze:'Stand_Eating_01',attack:'Attack_StandAngry_01_Low',hit:'Hit_Stand_F01',death:'Death_Stand_R01'});
export const BEAR_HOME={x:-106,z:-191};
// Root-motion clips move ~1.75m and ~4.38m per cycle respectively. Strip
// locomotion translation only, preserving authored limb and pelvis movement.
export function adaptBear(g){
 const root=g.nodes.findIndex(n=>n.name==='RigRoot_01');if(root<0||g.skins[0]?.joints.length!==37)throw Error('Unexpected bear rig');
 for(const a of g.animations){if(!['Walk','Run','Trot','WalkSlow','Sneak','Sprint'].includes(a.name))continue;for(const ch of a.channels){if(ch.node!==root||ch.path!=='translation')continue;const v=ch.values;for(let i=0;i<v.length;i+=3){v[i]=v[0];v[i+2]=v[2];}}}
 for(const n of Object.values(BEAR_ACTIONS))if(!g.animations.some(a=>a.name===n))throw Error('Missing bear clip '+n);return g;
}
export const BEAR_CONTACT=.85;
export function bearContact(rig,p){const paw=rig.nodeWorld('RigRFLegDigit11_033',new Vector3());if(!paw)return false;rig.group.localToWorld(paw);for(const y of [.35,.75,1.15,1.55])if(Math.hypot(paw.x-p.x,paw.y-p.y-y,paw.z-p.z)<.85)return true;return false;}
export async function loadBearActor(){const g=adaptBear(await loadGLB(BASE+'bear.glb')),rig=await SkinnedModel.create(g,{maxTextureSize:2048});rig.group.scale.setScalar(1.18);rig.group.position.y=.026;rig.play(BEAR_ACTIONS.idle,{fade:.01});rig.update(0);return {rig,actions:BEAR_ACTIONS,slot:'bear'};}
// Bake exactly the visible interior's authored triangles into world collision.
export function interiorTriangles(g,site){const out=[],placement=new Matrix4().compose(new Vector3(site.x,site.y,site.z),new Quaternion(),new Vector3(site.scale,site.scale,site.scale));const v=new Vector3();function visit(i,parent){const n=g.nodes[i],m=parent.clone().multiply(new Matrix4().compose(new Vector3(...n.t),new Quaternion(...n.r),new Vector3(...n.s)));if(n.mesh!=null){for(const p of g.meshes[n.mesh]){const a=p.attributes.POSITION.array,ids=p.indices;for(let k=0;k<(ids?.length||a.length/3);k+=3){let vs=[];for(let j=0;j<3;j++){let q=(ids?ids[k+j]:k+j)*3;v.set(a[q],a[q+1],a[q+2]).applyMatrix4(m);vs.push([v.x,v.y,v.z]);}if(vs.every(q=>q[1]<site.y-.25))continue;out.push({vertices:vs,id:'v73:interior:'+i});}}}for(const c of n.children)visit(c,m);}for(const i of g.roots)visit(i,placement);return out;}
export class ExpeditionAssetsV73{
 constructor(adventure){this.a=adventure;this.app=adventure.app;this.items=[];if(typeof document==='undefined')return;this.ready=this.load().catch(e=>console.warn('[V73] expedition art:',e));}
 async load(){const app=this.app;
  // Build independently: a rejected asset cannot disable the other sites.
  const results=await Promise.allSettled(ART_SITES.map(async site=>{
   const loaded=await loadStaticArtistModel(BASE+site.file);const root=loaded.root;root.position.set(site.x,site.y,site.z);root.scale.setScalar(site.scale);root.name=site.name;
   if(site.id==='interior'){const raw=await loadGLB(BASE+site.file);const world=new CollisionWorld(interiorTriangles(raw,site));app.colliders.triangleWorlds.push(world);this.interiorWorld=world;}
   else { // Source door is sealed; preserve it as a landmark, not a fictitious enterable shop.
    app.colliders.addBox(new Vector3(site.x,site.y+site.scale*2,site.z+site.scale*1.1),new Vector3(site.scale*5.15,site.scale*2,site.scale*4.3),0,{tag:'v73:closed-house'});
   }
   app.scene.add(root);this.items.push({site,root});
  }));
  for(const [i,result] of results.entries())if(result.status==='rejected')console.warn('[V73] rejected site',ART_SITES[i].id,result.reason);
  const site=ART_SITES.find(s=>s.id==='interior');if(!this.interiorWorld)return;
  const g=await loadCaptainMotion(await loadGLB(BASE+'captain.glb')),rig=await SkinnedModel.create(g,{maxTextureSize:2048});if(!rig.clipNames().includes('Take 001'))return;
  rig.play('Take 001',{fade:.01});rig.update(0);const p=new Vector3(site.x-15.7,site.y+.02,site.z+2.6);p.y=app.terrainData.heightAt(p.x,p.z)+.025;rig.group.position.copy(p);rig.group.rotation.y=-Math.PI/2;app.scene.add(rig.group);this.captain={rig,p,conversation:0};this.app.colliders.addCylinder(p.x,p.z,.31,p.y,p.y+1.70,{tag:'v73:captain'});
 }
 update(dt){if(!this.captain)return;const {rig,p}=this.captain,q=this.app.player.position;const d=Math.hypot(q.x-p.x,q.z-p.z);rig.group.visible=d<100;stepCaptainConversation(this.captain,dt,d);if(d<100){if(d<7){const goal=Math.atan2(q.x-p.x,q.z-p.z),delta=Math.atan2(Math.sin(goal-rig.group.rotation.y),Math.cos(goal-rig.group.rotation.y));rig.group.rotation.y+=Math.max(-2*dt,Math.min(2*dt,delta));}rig.update(dt);}else rig.hold();}
 wants(point){const p=this.captain?.p;return !!p&&Math.hypot(point.x-p.x,point.z-p.z)<3&&Math.abs(point.y-p.y)<2;}
 register(director,player){if(!this.captain)return;const {p}=this.captain;const q=player.position;if(Math.hypot(q.x-p.x,q.z-p.z)>3)return;if(strikeLineBlocked(this.app.colliders,{x:q.x,y:q.y+1.3,z:q.z},{x:p.x,y:p.y+1.3,z:p.z},.42))return;director.add({id:'v73:expedition-captain',position:p,range:3,priority:90,label:'远征船长 · E 获取情报',perform:()=>{beginCaptainConversation(this.captain);this.a._message('荒潮船长藏在沉岩洞深处；灰苔密林有熊出没。沿东部古道继续向北，前往峡谷与化石谷；钟影岩廊有一条岩层调查支路。',8);}},player);}
}
