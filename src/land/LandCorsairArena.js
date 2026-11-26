import { Group,Mesh } from '../engine/index.js';
import { prepare,mergePrepared,cylinder,box,sphere,torus,mat4 } from '../world/boat/GeoKit.js';
import { landMaterial } from './LandModels.js';
// Land landmark visible from the forest path: circular beach-stone camp,
// torn sail, and four lamp posts. One merged draw call, no expensive lights.
export function createCorsairArena(x,y,z,heightAt=null){
 const root=new Group();root.name='V37 tide-cursed corsair camp';root.position.set(x,y,z);
 const parts=[];
 // Drape each prop's origin onto the terrain; a planar arena suspended above
 // the forest would repeat the V32 stone-platform floating failure.
 const groundOffset=(px,pz)=>heightAt ? heightAt(x+px,z+pz)-y : 0;
 const add=(geo,color,px,py,pz,sx=1,sy=sx,sz=sx,ry=0)=>parts.push(prepare(geo,{color,rough:.9,matrix:mat4(px,py+groundOffset(px,pz),pz,0,ry,0,sx,sy,sz)}));
 for(let i=0;i<32;i++){
  const a=i*Math.PI/16,r=13.2+(i%4)*.1;
  add(box(1.8,.28,1.25),i%3?0x4d696d:0x72887c,Math.sin(a)*r,.02,Math.cos(a)*r,1,1,1,a);
  if(i%8===0){add(cylinder(.16,.25,4.2,8),0x665044,Math.sin(a)*r,2.1,Math.cos(a)*r);
   add(box(.39,.45,.39),0x393a30,Math.sin(a)*r,4.38,Math.cos(a)*r);
   add(sphere(.105,10,7),0xf9b866,Math.sin(a)*r,4.38,Math.cos(a)*r);}
 }
 // Washed-up ribs and a collapsed mast form a readable arena silhouette.
 for(let j=0;j<7;j++){const px=(j-3)*1.55;
  add(box(.32,1.8,2.9),0x4c3830,px,.5,8.5,1,1,1,(j-3)*.07);}
 add(cylinder(.24,.33,8.7,10),0x604b35,-8,4.0,-2);
 add(box(4.8,.13,3.2),0x9ba09a,-7,7.3,-2,1,1,1,.17);
 add(torus(2.2,.18,6,28),0x5c8581,0,.13,0);
 const mesh=new Mesh(mergePrepared(parts),landMaterial);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
 return root;
}
