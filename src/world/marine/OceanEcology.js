import {Group,InstancedMesh,BufferGeometry,Float32BufferAttribute,SphereGeometry,ConeGeometry,CylinderGeometry,Vector3} from '../../engine/index.js';
import {Material} from '../../engine/render/Material.js';
import {mat4,prepare,mergePrepared,sphere,rod} from '../boat/GeoKit.js';
import {createPropMaterial} from '../../game/GameMaterials.js';
import {WORLD} from '../WorldLayout.js';
import {mulberry32} from '../../util/Noise.js';
const TAU=Math.PI*2, CELL=48, N=24, MAX_FISH=9*2*N, MAX_PLANTS=9*40, MAX_LIFE=18;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function ecologySeed(x,z){return (Math.imul(x,73856093)^Math.imul(z,19349663)^0x6e21b3)>>>0;}
export function habitatAt(x,z,heightAt){const y=heightAt(x,z);if(!Number.isFinite(y)||y>=-3)return null;return {floor:y,kind:y>-35?'kelp':y>-85?'sponge':'abyss'};}
export function makeHabitat(cx,cz,heightAt){
 const rnd=mulberry32(ecologySeed(cx,cz)),items=[];const centerX=(cx+.5)*CELL,centerZ=(cz+.5)*CELL;
 for(let i=0;i<40;i++){
  const angle=rnd()*TAU,r=Math.sqrt(rnd())*CELL*.46;
  const x=centerX+Math.cos(angle)*r,z=centerZ+Math.sin(angle)*r;
  const h=habitatAt(x,z,heightAt);if(!h)continue;
  // The existing hand-authored bay reef already has its own dense ecology.
  if(Math.hypot(x-WORLD.reef.center.x,z-WORLD.reef.center.z)<WORLD.reef.radius+18)continue;
  const size=h.kind==='kelp'?Math.min(2.8+rnd()*4.8,(-h.floor-1)*.8):.45+rnd()*1.7;
  items.push({x,z,y:h.floor+.06,kind:h.kind,size,angle:rnd()*TAU});
 }
 // Rock clusters give the seabed structure without modifying collision geometry.
 for(let i=0;i<8;i++){const x=centerX+(rnd()-.5)*CELL*.86,z=centerZ+(rnd()-.5)*CELL*.86,h=habitatAt(x,z,heightAt);if(!h||Math.hypot(x-WORLD.reef.center.x,z-WORLD.reef.center.z)<WORLD.reef.radius+18)continue;items.push({x,z,y:h.floor+.04,kind:'rock',size:Math.min(1.3+rnd()*3,(-h.floor-1)*.7),angle:rnd()*TAU});}
 return items;
}
function fishGeometry(){return mergePrepared([
 prepare(sphere(1,9,6),{color:0x8cabb3,metal:.18,rough:.36,matrix:mat4(0,0,0,0,0,0,.13,.22,.61)}),
 prepare(sphere(1,7,5),{color:0xd3ded6,rough:.45,matrix:mat4(0,-.09,.03,0,0,0,.11,.12,.50)}),
 prepare(new ConeGeometry(.24,.42,3),{color:0x6c8490,matrix:mat4(0,0,-.68,-Math.PI/2,0,0,.46,1,1)}),
 prepare(new ConeGeometry(.16,.29,3),{color:0x536d7b,matrix:mat4(0,.22,-.08,0,0,0,.35,1,1)})]);}
function kelpGeometry(){
 const pos=[],idx=[];for(let blade=0;blade<7;blade++){const a=blade*2.39996,dx=Math.cos(a),dz=Math.sin(a),base=pos.length/3;
  for(let j=0;j<=8;j++){const t=j/8,w=.13*Math.sin(Math.PI*t)+.015;const x=dx*t*t*.6,z=dz*t*t*.6,y=t*(.75+.25*Math.sin(blade*2));pos.push(x-dz*w,y,z+dx*w,x+dz*w,y,z-dx*w);if(j<8){const q=base+j*2;idx.push(q,q+1,q+2,q+1,q+3,q+2);}}
 }const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function rayGeometry(){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([0,0,.85,-1.8,0,-.2,-.6,-.1,-.65,0,0,-.8,.6,-.1,-.65,1.8,0,-.2,0,0,-2.3,0,.14,.05],3));g.setIndex([0,1,7,1,2,7,2,3,7,3,4,7,4,5,7,5,0,7,2,6,3,3,6,4]);g.computeVertexNormals();return g;}
function jellyGeometry(){const parts=[prepare(sphere(1,12,6,0,TAU,0,Math.PI*.56),{color:0x7cd4ec,matrix:mat4(0,0,0,0,0,0,.62,.40,.62)})];for(let i=0;i<6;i++){const a=i*TAU/6;parts.push(prepare(rod(new Vector3(Math.cos(a)*.25,0,Math.sin(a)*.25),new Vector3(Math.cos(a)*.32,-1.1,Math.sin(a)*.32),.024,4),{color:0x8edee9}));}return mergePrepared(parts);}
function school(cx,cz,band,heightAt){const x=(cx+.5)*CELL,z=(cz+.5)*CELL,h=habitatAt(x,z,heightAt);if(!h||band&&h.floor>-16)return null;
 const rnd=mulberry32(ecologySeed(cx,cz)^Math.imul(band+1,0x9e3779b9));const phase=rnd()*TAU,fish=[];
 for(let i=0;i<N;i++){const a=rnd()*TAU,r=2+rnd()*7;fish.push({x:Math.cos(a)*r,z:Math.sin(a)*r,y:(rnd()-.5)*4,vx:Math.cos(phase)*2,vz:Math.sin(phase)*2,vy:0,scale:.42+rnd()*.65});}
 return {x,z,band,phase,fish,centerX:x,centerZ:z,centerY:band?h.floor+6:-7};}
// Local all-pairs flocking within 24-member schools, never global O(n²).
export function stepSchool(s,dt,time,heightAt,predator){
 const a=time*.12+s.phase;s.centerX=s.x+Math.cos(a)*8;s.centerZ=s.z+Math.sin(a)*8;
 const bottom=heightAt(s.centerX,s.centerZ);s.centerY=s.band?Math.min(-3,bottom+7):Math.max(-9,bottom+3);
 const next=[];for(let i=0;i<s.fish.length;i++){const f=s.fish[i];let sx=0,sz=0,ax=0,az=0,cx=0,cz=0,n=0;
  for(let j=0;j<s.fish.length;j++){if(i===j)continue;const g=s.fish[j],dx=g.x-f.x,dz=g.z-f.z,d2=dx*dx+dz*dz;if(d2>64)continue;n++;ax+=g.vx;az+=g.vz;cx+=dx;cz+=dz;if(d2<2.25){sx-=dx/(d2+.25);sz-=dz/(d2+.25);}}
  let vx=f.vx+dt*((n?(ax/n-f.vx)*.65+cx/n*.22:0)+sx*2.2-f.x*.15+Math.cos(a)*.7),vz=f.vz+dt*((n?(az/n-f.vz)*.65+cz/n*.22:0)+sz*2.2-f.z*.15+Math.sin(a)*.7);
  if(predator){const dx=s.centerX+f.x-predator.x,dz=s.centerZ+f.z-predator.z,d=Math.hypot(dx,dz);if(d<25&&d>.01){const force=(25-d)*.45;vx+=dt*dx/d*force;vz+=dt*dz/d*force;}}
  const speed=Math.hypot(vx,vz);if(speed>5){vx*=5/speed;vz*=5/speed;}else if(speed<.3){vx+=Math.cos(a)*.3;vz+=Math.sin(a)*.3;}
  const x=f.x+vx*dt,z=f.z+vz*dt;const floor=heightAt(s.centerX+x,s.centerZ+z);if(floor>-3){vx=-vx;vz=-vz;next.push({...f,vx,vz});continue;}
  const y=clamp(f.y+Math.sin(time*.8+i)*dt*.4,Math.max(-4,floor+1-s.centerY),Math.max(Math.max(-4,floor+1-s.centerY),-1.5-s.centerY));next.push({...f,x:clamp(x,-21,21),z:clamp(z,-21,21),y,vx,vz});
 }s.fish=next;
}
function batch(geo,mat,cap,name,root){const mesh=new InstancedMesh(geo,mat,cap);mesh.name=name;mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;root.add(mesh);return mesh;}
export class OceanEcology {
 constructor({scene,terrain,predator,stockAt}){
  this.terrain=terrain;this.predator=predator;this.stockAt=stockAt;this.heightAt=terrain.heightAt.bind(terrain);this.root=new Group();this.root.name='V65 streamed ocean habitats';scene.add(this.root);this.cells=new Map();this.time=0;this.acc=0;this.key='';
  const fishMat=createPropMaterial('V65 shoal fish',{vertex:`v.position.x += sin(frame.time * 8.0 + f32(v.instance) * 0.31 + v.position.z * 3.0) * max(0.0,-v.position.z) * 0.12;`});fishMat.underwaterLighting='lite';
  this.fish=batch(fishGeometry(),fishMat,MAX_FISH,'pelagic and demersal schools',this.root);
  const kelpMat=new Material({name:'V65 flowing kelp',color:0x406a36,side:'double',roughness:.8,vertex:`let sway = sin(frame.time * 1.2 + v.model[3].x * 0.15 + v.model[3].z * 0.11); v.position.x += sway * v.position.y * v.position.y * 0.24; v.position.z += cos(frame.time * 0.9 + v.model[3].z * 0.2) * v.position.y * v.position.y * 0.18;`});kelpMat.underwaterLighting='lite';
  this.kelp=batch(kelpGeometry(),kelpMat,MAX_PLANTS,'kelp forests',this.root);
  const rockGeo=new SphereGeometry(1,7,5);this.sponge=batch(rockGeo,new Material({name:'V65 sponges',color:0xb17c4e,roughness:.95}),MAX_PLANTS,'deep sponges',this.root);
  this.abyss=batch(new ConeGeometry(.55,1,7),new Material({name:'V65 abyss polyps',color:0x347c83,emissive:0x124649,roughness:.75}),MAX_PLANTS,'abyssal bioluminescent polyps',this.root);
  this.rock=batch(new SphereGeometry(1,7,5),new Material({name:'V65 bathyal rock',color:0x47545b,roughness:.97}),MAX_PLANTS,'seabed rock clusters',this.root);
  const rayMat=new Material({name:'V65 ray',color:0x567887,side:'double',roughness:.65,vertex:`v.position.y += sin(frame.time * 2.2 + abs(v.position.x)*1.7 + f32(v.instance)) * abs(v.position.x)*0.21;`});rayMat.underwaterLighting='lite';
  this.rays=batch(rayGeometry(),rayMat,MAX_LIFE,'gliding rays',this.root);
  const jellyMat=new Material({name:'V65 glowing jellyfish',color:0x6ac9e5,emissive:0x17596e,side:'double',transparent:true,opacity:.55,depthWrite:false,lit:false,vertex:`v.position.x *= 1.0 + sin(frame.time*2.0+f32(v.instance))*.09; v.position.z *= 1.0 + sin(frame.time*2.0+f32(v.instance))*.09;`});
  this.jellies=batch(jellyGeometry(),jellyMat,MAX_LIFE,'pulsing jellyfish',this.root);this.jellies.layers.set(2);
 }
 refresh(camera){const cx=Math.floor(camera.x/CELL),cz=Math.floor(camera.z/CELL),key=cx+','+cz;if(key===this.key)return;this.key=key;const active=new Map();
  for(let z=cz-1;z<=cz+1;z++)for(let x=cx-1;x<=cx+1;x++){const k=x+','+z;active.set(k,this.cells.get(k)||{plants:makeHabitat(x,z,this.heightAt),schools:[school(x,z,0,this.heightAt),school(x,z,1,this.heightAt)].filter(Boolean)});}
  this.cells=active;for(const m of [this.kelp,this.sponge,this.abyss,this.rock])m.count=0;
  for(const cell of active.values())for(const p of cell.plants){const m=this[p.kind];if(m.count>=MAX_PLANTS)continue;const sy=p.kind==='kelp'?p.size:p.kind==='rock'?p.size*.45:p.size*.75;const sx=p.kind==='kelp'?p.size*.55:p.kind==='rock'?p.size:p.size*.65;m.setMatrixAt(m.count++,mat4(p.x,p.y+(p.kind==='kelp'?0:sy*.45),p.z,0,p.angle,0,sx,sy,sx));}
  for(const m of [this.kelp,this.sponge,this.abyss,this.rock]){m.instanceMatrix.needsUpdate=true;m.visible=m.count>0;}
 }
 update(dt,camera){if(!camera||![camera.x,camera.y,camera.z,dt].every(Number.isFinite))return;this.time+=clamp(dt,0,.15);this.acc+=clamp(dt,0,.15);this.refresh(camera);
  const bottom=this.heightAt(camera.x,camera.z),showFloor=camera.y<3&&camera.y-bottom<65;for(const m of [this.kelp,this.sponge,this.abyss,this.rock])m.visible=showFloor&&m.count>0;
  if(this.acc<.10)return;const step=Math.min(.2,this.acc);this.acc=0;this.fish.count=0;this.rays.count=this.jellies.count=0;const predator=this.predator?.();
  for(const cell of this.cells.values())for(const s of cell.schools){stepSchool(s,step,this.time,this.heightAt,predator);if(Math.abs(camera.y-s.centerY)>55)continue;
   const fraction=clamp(this.stockAt?.(s.x,s.z)??1,0,1);for(let i=0;i<Math.floor(s.fish.length*fraction);i++){const f=s.fish[i],x=s.centerX+f.x,z=s.centerZ+f.z,floor=this.heightAt(x,z);if(floor>-3)continue;const y=clamp(s.centerY+f.y,floor+1,-1.5);if(this.fish.count>=MAX_FISH)break;this.fish.setMatrixAt(this.fish.count++,mat4(x,y,z,0,Math.atan2(f.vx,f.vz),0,f.scale,f.scale,f.scale));}
  }
  for(const cell of this.cells.values())for(const s of cell.schools){
   const a=this.time*.14+s.phase, x=s.x+Math.cos(a)*12,z=s.z+Math.sin(a)*12,floor=this.heightAt(x,z);if(floor>-9)continue;
   const m=s.band?this.jellies:this.rays;const y=s.band?Math.min(-4,floor+9+Math.sin(a*2)):Math.max(floor+3,-12+Math.sin(a)*2);
   if(Math.abs(y-camera.y)>50||m.count>=MAX_LIFE)continue;const scale=s.band?.8:1.6;m.setMatrixAt(m.count++,mat4(x,y,z,0,-a,0,scale,scale,scale));
  }for(const m of [this.rays,this.jellies]){m.visible=m.count>0;if(m.visible)m.instanceMatrix.needsUpdate=true;}
  this.fish.visible=this.fish.count>0;if(this.fish.visible)this.fish.instanceMatrix.needsUpdate=true;
 }
}
