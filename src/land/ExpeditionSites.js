import {MineLiftV81} from './MineLiftV81.js';
import {RESERVOIR,MINE_SAMPLE} from './MineReservoirV80.js';
import {Material} from '../engine/render/Material.js';
import {upgradeRoomArt,installCaveArt} from './ExpeditionArt.js';
import {Group,Mesh,Vector3,Color,BufferGeometry,Float32BufferAttribute} from '../engine/index.js';
import {prepare,mergePrepared,box,cylinder,rod,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from './LandModels.js';
import {PAT} from '../game/GameMaterials.js';
import {CollisionWorld} from '../systems/CollisionWorld.js';
import {CAVE,EXPEDITION_ROUTES,caveProfile} from './ExpeditionTerrain.js';
const rockColors=[0x505d57,0x626860,0x49534f,0x7a7968,0x535b52,0x656d61];
const partsMesh=(parts,root,name)=>{const m=new Mesh(mergePrepared(parts),landMaterial);m.name=name;m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
const solidFromMesh=(colliders,mesh)=>{mesh.updateWorldMatrix(true,false);const geo=mesh.geometry,p=geo.attributes.position,idx=geo.index?.array;const tris=[];for(let i=0;i<(idx?.length??p.count);i+=3){const vs=[];for(let j=0;j<3;j++){const v=new Vector3().fromBufferAttribute(p,idx?idx[i+j]:i+j).applyMatrix4(mesh.matrixWorld);vs.push([v.x,v.y,v.z]);}tris.push({vertices:vs,id:mesh.name});}const world=new CollisionWorld(tris);colliders.triangleWorlds.push(world);return world;};
export function buildExpeditionCave(scene,terrain,colliders){
 const root=new Group();root.name='V70 沉岩洞：真实可步行岩顶';scene.add(root);
 // Closed arch shell with two independently shaped rock surfaces. Every triangle
 // is also baked into the swept capsule collision world; no invisible roof proxy.
 const {x,front,back}=CAVE, n=24,m=Math.round((front-back)/2.93),span=front-back;
 const vertices=[],indices=[];const inner=[],outer=[];
 for(let j=0;j<=m;j++){
  const z=front-span*j/m,profile=caveProfile(z),cx=profile.x,base=terrain.heightAt(cx,z),ripple=Math.sin(j*1.73)*.56+Math.sin(j*.43)*.75;
  const width=profile.width+ripple,high=profile.high+2*Math.sin(j*.49)+.6*Math.cos(j*1.3);
  for(let i=0;i<=n;i++){
   const a=Math.PI*i/n,s=Math.sin(a),c=Math.cos(a),u=cx+c*width;
   const sideBase=terrain.heightAt(u,z);const low=base+(sideBase-base)*Math.pow(Math.abs(c),8)-1.0;
   const rough=.38*Math.sin(i*2.17+j*1.41)*s;
   inner.push([u,low+s*high+rough,z]);
   outer.push([cx+c*(width+3.4),low+s*(high+5.5)+rough+1.0,z]);
  }
 }
 const stride=n+1,offset=inner.length;vertices.push(...inner.flat(),...outer.flat());
 const quad=(a,b,c,d)=>indices.push(a,b,c,a,c,d);
 for(let j=0;j<m;j++)for(let i=0;i<n;i++){const a=j*stride+i,b=a+1,c=b+stride,d=a+stride;quad(a,b,c,d);quad(a+offset,d+offset,c+offset,b+offset);}
 for(const j of [0,m])for(let i=0;i<n;i++){const a=j*stride+i; if(j===0)quad(a,a+1,a+1+offset,a+offset);else quad(a+1,a,a+offset,a+1+offset);}
 for(let j=0;j<m;j++)for(const i of [0,n]){const a=j*stride+i,b=a+stride;quad(a,b,b+offset,a+offset);}
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
 const colors=[],uvs=[],palette=rockColors.map(v=>new Color(v));for(let j=0;j<vertices.length/3;j++){const a=j%stride,b=Math.floor((j%offset)/stride);const rgb=palette[(a*17+b*13)%palette.length];colors.push(rgb.r,rgb.g,rgb.b);uvs.push(vertices[j*3]/4,vertices[j*3+2]/4);}g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setAttribute('uv',new Float32BufferAttribute(uvs,2));
 const roof=partsMesh([prepare(g,{rough:.97})],root,'V70 natural rock arch');const world=solidFromMesh(colliders,roof);
 // Close the back, but leave the front as a physically open portal.
 const parts=[];const add=(w,h,d,px,py,pz,color,pattern=0,rx=0)=>parts.push(prepare(box(w,h,d),{color,rough:.9,pattern,matrix:mat4(px,py,pz,rx,0,0)}));
 const end=caveProfile(back),endY=terrain.heightAt(end.x,back),wallHalf=end.width+2;add(wallHalf*2,18,2,end.x,endY+8,back,0x48524d);colliders.addBox(new Vector3(end.x,endY+8,back),new Vector3(wallHalf,9,1),0,{tag:'v70:cave-back'});
 // Supporting timber frames: posts remain outside central walking route.
 for(const z of [-455,-474,-493,-526]){const y=terrain.heightAt(x,z);for(const dx of [-8,8]){add(.38,6,.44,x+dx,y+3,z,0x634831,PAT.wood);colliders.addBox(new Vector3(x+dx,y+3,z),new Vector3(.19,3,.22),0,{tag:'v70:cave-support'});}add(17,.45,.6,x,y+6,z,0x634831,PAT.wood);colliders.addBox(new Vector3(x,y+6,z),new Vector3(8.5,.225,.3),0,{tag:"v70:cave-beam"});}
 // Real torches on posts, non-blocking visual fixture above player height.
 for(const z of [-451,-470,-489,-521]){const y=terrain.heightAt(x,z);for(const side of [-1,1]){const px=x+side*8;parts.push(prepare(cylinder(.16,.09,.48,10),{color:0xe7a45c,matrix:mat4(px,y+2.8,z)}));}}
 for(const z of [-545,-565,-584,-595,-606,-623]){const cp=caveProfile(z),side=cp.width*.65;for(const sign of [-1,1]){const px=cp.x+sign*side,y=terrain.heightAt(px,z);add(.28,3.4,.34,px,y+1.7,z,0x634831,PAT.wood);colliders.addBox(new Vector3(px,y+1.7,z),new Vector3(.14,1.7,.17),0,{tag:'v78:cave-support'});parts.push(prepare(cylinder(.13,.08,.42,10),{color:0xe7a45c,matrix:mat4(px,y+2.8,z)}));}}
 // Functional mine furnishings keep a clear central corridor; visual and
 // collision geometry are emitted together. The reservoir is off the route.
 for(const z of [-608,-611,-617,-620]){const px=339.8,y=terrain.heightAt(px,z);add(.44,3.5,.44,px,y+1.75,z,0x604832,PAT.wood);colliders.addBox(new Vector3(px,y+1.75,z),new Vector3(.22,1.75,.22),0,{tag:'v80:mine-post'});}
 for(const z of [-608,-612,-616,-620]){const px=340.8,y=terrain.heightAt(px,z);for(const dx of [-.55,.55]){add(.08,.08,3.95,px+dx,y+.08,z,0x545d5a);}}
 for(let z=-608;z>=-620;z-=.65){const px=340.8,y=terrain.heightAt(px,z);add(1.5,.09,.15,px,y+.04,z,0x58442f,PAT.wood);}
 const sx=MINE_SAMPLE.x,sz=MINE_SAMPLE.z,sy=terrain.heightAt(sx,sz);add(1.6,.85,.7,sx,sy+.425,sz,0x70563d,PAT.wood);colliders.addBox(new Vector3(sx,sy+.425,sz),new Vector3(.8,.425,.35),0,{tag:'v80:mine-bench'});add(1.7,.13,.8,sx,sy+.915,sz,0x9c7f56,PAT.wood);colliders.addBox(new Vector3(sx,sy+.915,sz),new Vector3(.85,.065,.4),0,{tag:'v80:mine-bench'});
 for(let i=0;i<4;i++)parts.push(prepare(cylinder(.16,.24,.35,6),{color:0x8faea1,matrix:mat4(sx-.5+i*.33,sy+1.12,sz)}));
 partsMesh(parts,root,'V80 cave braces, mining track and archive station');
 const lake=new BufferGeometry(),lv=[RESERVOIR.x,RESERVOIR.surface,RESERVOIR.z],li=[];for(let i=0;i<=64;i++){const a=i/64*2*Math.PI;lv.push(RESERVOIR.x+Math.cos(a)*RESERVOIR.rx*1.10,RESERVOIR.surface,RESERVOIR.z+Math.sin(a)*RESERVOIR.rz*1.10);if(i<64)li.push(0,i+2,i+1);}lake.setAttribute('position',new Float32BufferAttribute(lv,3));lake.setIndex(li);lake.computeVertexNormals();const surface=new Mesh(lake,new Material({color:0x2b7580,emissive:0x092f37,opacity:.67,transparent:true,depthWrite:false,side:'double',metalness:.15,roughness:.14,underwaterLighting:'none'}));surface.name='V80 local underground reservoir';root.add(surface);

 // Route navigation uses the same position as the road centre, markers kept
 // outside the walking channel. No invisible walls at the entrance.
 const artReady=installCaveArt(scene,terrain,colliders,x);
 // Flush, non-blocking mineral trail arrows follow the verified dry path.
 const arrows=new BufferGeometry(),av=[],ai=[];for(const [px,pz,dx,dz] of [[345.8,-598,0,1],[343.5,-597,-1,0],[340,-597,-1,0],[338,-599,0,-1],[338,-604,0,-1],[338,-609,0,-1],[338,-612,0,-1]]){const n=av.length/3;for(const [u,w] of [[0,.48],[-.24,-.16],[-.10,-.16],[-.10,-.48],[.10,-.48],[.10,-.16],[.24,-.16]]){const xx=px+dz*u+dx*w,zz=pz-dx*u+dz*w;av.push(xx,terrain.heightAt(xx,zz)+.035,zz);}ai.push(n,n+1,n+2,n,n+2,n+5,n,n+5,n+6,n+2,n+3,n+4,n+2,n+4,n+5);}
 arrows.setAttribute('position',new Float32BufferAttribute(av,3));arrows.setIndex(ai);arrows.computeVertexNormals();const trail=new Mesh(arrows,new Material({color:0x5de5d8,emissive:0x236e78,lit:false,side:'double',underwaterLighting:'none'}));trail.name='V83 dry route guidance';root.add(trail);
 const lift=new MineLiftV81(root,colliders);return {root,roof,world,artReady,sample:new Vector3(sx,sy,sz),lake:surface,lift};
}

// Open-front, sheltered functional room. Mesh and collision dimensions share
// one local spec: floor boards, wall segments, posts, counter, shelves, rafters.
export function buildHarborRoom(app,{x,z,role,width=4.4,depth=4.5,notice=false}){
 const {terrainData:t,colliders:c,scene}=app, root=new Group();root.name='V70 '+role+' working building';
 const y=t.heightAt(x,z),parts=[],boxes=[],zBack=-depth+.75,zFront=.75;root.position.set(x,y,z);scene.add(root);
 const add=(w,h,d,lx,ly,lz,color,pattern=PAT.wood,solid=false,walkable=false,rx=0,kind="shell")=>{
  boxes.push({w,h,d,x:lx,y:ly,z:lz,color,pattern,rx,kind});
  parts.push(prepare(box(w,h,d),{color,rough:.88,pattern,matrix:mat4(lx,ly,lz,rx,0,0)}));
  if(solid)c.addBox(new Vector3(x+lx,y+ly,z+lz),new Vector3(w/2,h/2,d/2),0,{tag:'v70:'+role,walkable});
 };
 const timber=0x674a35,beam=0x423b30,plaster=0xb5aa8f,slate=0x3d5054;
 // Open front. No fake door. Foundation conforms to the terrain while the
 // raised platform top stays at most one stair above the service position.
 const floor=.12;
 add(width,.24,depth,0,floor-.12,(zBack+zFront)/2,0x75644c,PAT.woodX,true,true);
 for(let i=0;i<Math.ceil(width/.23);i++){let px=-width/2+.115+i*.23;if(px<width/2-.05)add(.21,.025,depth,px,floor+.012,(zBack+zFront)/2,i%3?0x8a7154:0x927b5c,PAT.woodZ);}
 add(width,2.72,.18,0,1.48,zBack,plaster,PAT.plain,true);
 for(const side of [-1,1]){
  const px=side*(width/2-.10);
  // Side walls only at the rear; front remains open for entry/exit.
  add(.18,2.72,depth-1.5,px,1.48,zBack+(depth-1.5)/2,plaster,PAT.plain,true);
  for(const zz of [zBack,zFront])add(.24,3.1,.24,px,1.67,zz,beam,PAT.wood,true);
  add(.18,.24,depth,px,3.13,(zBack+zFront)/2,beam);
 }
 for(let j=0;j<6;j++)add(width,.09,.12,0,.35+j*.45,zBack+.12,timber,PAT.woodX);
 for(let j=0;j<7;j++){const px=-width/2+.15+j*(width-.3)/6;add(.09,2.65,.11,px,1.49,zBack+.13,beam);}
 // Real pitched tiled roof; overhang and staggered courses; above head height.
 const angle=.28,half=(depth+.5)/2,centerZ=(zBack+zFront)/2;
 for(const sign of [-1,1])for(let row=0;row<8;row++){
  const zz=sign*(row+.5)*half/8;const yy=3.68-Math.abs(zz)*Math.tan(angle);
  for(let i=0;i<Math.ceil((width+.5)/.48);i++){
   const px=-(width+.5)/2+.24+i*.48;add(.47,.09,half/8+.055,px,yy,centerZ+zz,(i+row)%4===0?0x536165:slate,PAT.plain,false,false,sign*angle);
  }
 }
 add(width+.6,.2,.22,0,3.73,centerZ,beam);add(width+.25,.30,.22,0,3.04,zFront+.13,timber);
 // Furniture is placed on the customer-side boundary of the NPC work zone.
 // Counter at +Z; NPC stands at z, no walking across the countertop.
 if(!notice){
 add(width*.48,.91,.58,0,.575,.46,timber,PAT.wood,true,false,0,"counter");
 add(width*.52,.13,.76,0,1.10,.46,0x937451,PAT.woodX,true,false,0,"counter");
 for(const px of [-.65,0,.65])add(.06,.78,.07,px,.6,.78,beam,PAT.wood,false,false,0,"counter");
 for(const h of [.55,1.25,1.96])add(width-.65,.12,.49,0,h,zBack+.34,timber,PAT.woodX,true,false,0,"shelf");
 for(let i=0;i<5;i++){
  const px=(i-2)*.55;add(.36,.33,.33,px,.78,zBack+.35,0x8a7154,PAT.wood,false,false,0,"stock");add(.35,.28,.32,px,1.48,zBack+.35,0x9a8260,PAT.wood,false,false,0,"stock");
 }
 }
 const mesh=partsMesh(parts,root,'V70 '+role+' detailed timber and stone room');const artReady=upgradeRoomArt(root,mesh,boxes,{width,depth,notice,role});return {root,mesh,boxes,artReady,floor:y+floor,service:new Vector3(x,y+floor,z-.8),customer:new Vector3(x,y,z+1.35)};
}
