// Poly Haven Rock Face 01. One decoded PBR geometry/material shared by all placements.
// All contact geometry is the actual converted source mesh, not a bounding box.
import {Vector3,Quaternion,Matrix4} from '../engine/index.js';
import {loadGLB} from '../engine/loaders/GLTF.js';
import {loadStaticArtistModel} from '../ship/HeritageAssetRig.js';
import {CollisionWorld} from '../systems/CollisionWorld.js';
import {ROCK_SITES} from './ExpeditionTerrain.js';
export const ROCK_URL='/models/expedition/v75/rock.glb';
export function rockPlacement(site,terrain){return {...site,y:terrain(site.x,site.z)-site.sink};}
export function rockTriangles(g,site){
 const matrix=new Matrix4().compose(new Vector3(site.x,site.y,site.z),new Quaternion().setFromAxisAngle(new Vector3(0,1,0),site.yaw),new Vector3(site.scale,site.scale,site.scale));
 const p=g.meshes[0][0],a=p.attributes.POSITION.array,ids=p.indices,out=[],v=new Vector3();
 if(g.roots.length!==1||g.meshes.length!==1||g.nodes[g.roots[0]].mesh!==0||ids.length!==60522)throw Error('Unreviewed rock geometry');
 for(let k=0;k<ids.length;k+=3){const vertices=[];for(let j=0;j<3;j++){const i=ids[k+j]*3;v.set(a[i],a[i+1],a[i+2]).applyMatrix4(matrix);vertices.push(v.toArray());}out.push({vertices,id:'v75:rock:'+site.id});}return out;
}
export class ExpeditionRockV75{
 constructor(adventure){this.app=adventure.app;this.items=[];this.loading=false;this.failed=false;this.enabled=typeof document!=='undefined';}
 async load(){this.loading=true;try{
  const g=await loadGLB(ROCK_URL),art=await loadStaticArtistModel(ROCK_URL,g);
  const height=this.app.terrainData.heightAt.bind(this.app.terrainData),items=[];
  for(const s of ROCK_SITES){const site=rockPlacement(s,height),root=art.root.clone(true);root.name='V75 Poly Haven '+s.id;root.position.set(site.x,site.y,site.z);root.rotation.y=site.yaw;root.scale.setScalar(site.scale);root.visible=false;const world=new CollisionWorld(rockTriangles(g,site));if(world.triangles.length<20000)throw Error('Rock collision incomplete');items.push({site,root,world});}
  for(const item of items){this.app.colliders.triangleWorlds.push(item.world);this.app.scene.add(item.root);}this.items=items;
 }catch(e){this.failed=true;console.warn('[V75] rock art unavailable',e);}finally{this.loading=false;}}
 update(){if(!this.enabled)return;const p=this.app.camera?.position||this.app.player?.position;if(!p)return;const d=s=>Math.hypot(p.x-s.x,p.z-s.z);if(!this.items.length&&!this.loading&&!this.failed&&ROCK_SITES.some(s=>d(s)<200))this.load();for(const item of this.items)item.root.visible=d(item.site)<195;}
}
