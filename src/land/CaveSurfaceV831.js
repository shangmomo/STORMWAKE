import {BufferGeometry,Float32BufferAttribute,Color} from '../engine/index.js';
import {Material} from '../engine/render/Material.js';
import {commonModule} from '../engine/render/wgsl/common.js';
import {CAVE,caveProfile} from './ExpeditionTerrain.js';
import {RESERVOIR,reservoirDistance} from './MineReservoirV80.js';
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const geology=(x,y,z)=>Math.sin(x*.36+y*.57+z*.21)*.54+Math.sin(x*.79-z*.53+y*.23)*.30+Math.sin(z*1.17+x*.41)*.16;
const rockA=new Color(0x383e35),rockB=new Color(0x77776a);
// Preserve the tested inner gallery. Ground the outside and close the end
// with contoured rock surfaces sharing the arch's exact boundary vertices.
export function caveRockGeometry(terrain){
 const {front,back}=CAVE,n=24,m=Math.round((front-back)/2.93),stride=n+1;
 const pos=[],col=[],indices=[],inner=[],outer=[];
 for(let j=0;j<=m;j++){
  const z=front-(front-back)*j/m,p=caveProfile(z),cx=p.x,base=terrain.heightAt(cx,z);
  const width=p.width+Math.sin(j*1.73)*.56+Math.sin(j*.43)*.75;
  const high=p.high+2*Math.sin(j*.49)+.6*Math.cos(j*1.3);
  for(let i=0;i<=n;i++){
   const a=Math.PI*i/n,s=Math.sin(a),c=Math.cos(a),x=cx+c*width;
   const low=mix(base,terrain.heightAt(x,z),Math.pow(Math.abs(c),8))-1;
   const y=low+s*high+.38*Math.sin(i*2.17+j*1.41)*s;
   inner.push([x,y,z]);
   const d=geology(x,y,z),ox=cx+c*(width+3.4+.85*d);
   const foot=terrain.heightAt(ox,z)-1.5;
   const crest=Math.max(y+2.1,base+s*(high+4.0)+1.4*d);
   outer.push([ox,mix(foot,crest,smooth(s/.42)),z]);
  }
 }
 const vertex=p=>{const id=pos.length/3;pos.push(...p);const c=rockA.clone().lerp(rockB,clamp(.47+geology(...p)*.39));col.push(c.r,c.g,c.b);return id;};
 inner.forEach(vertex);outer.forEach(vertex);const offset=inner.length;
 const quad=(a,b,c,d)=>indices.push(a,b,c,a,c,d);
 for(let j=0;j<m;j++)for(let i=0;i<n;i++){const a=j*stride+i,b=a+1,c=b+stride,d=a+stride;quad(a,b,c,d);quad(a+offset,d+offset,c+offset,b+offset);}
 for(let i=0;i<n;i++)quad(i,i+1,i+1+offset,i+offset);
 for(let j=0;j<m;j++)for(const i of [0,n]){const a=j*stride+i,b=a+stride;quad(a,b,b+offset,a+offset);}
 for(const outside of [false,true]){
  const off=outside?offset:0,ring=outside?outer:inner;
  let prev=Array.from({length:stride},(_,i)=>m*stride+i+off);
  for(let r=1;r<=5;r++){
   const t=r/5,row=[];
   for(let i=0;i<=n;i++){
    const [x,y,z]=ring[m*stride+i],a=Math.PI*i/n;
    const zz=z+(outside?-1.3:.32)*Math.sin(Math.PI*t)*Math.sin(a);
    const bottom=Math.min(y-.22,terrain.heightAt(x,zz)-1.6);
    row.push(vertex([x,mix(y,bottom,t),zz]));
   }
   for(let i=0;i<n;i++){if(outside)quad(prev[i],row[i],row[i+1],prev[i+1]);else quad(prev[i],prev[i+1],row[i+1],row[i]);}prev=row;
  }
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('color',new Float32BufferAttribute(col,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function caveRockMaterial(){return new Material({name:'V84 weathered stone',vertexColors:true,roughness:.94,metalness:0,side:'double',underwaterLighting:'lite',modules:[commonModule],surface:`
 let p = in.P;
 let grain = mx_fractal_noise_float3(p * 1.8, 3, 2.1, 0.48);
 let strata = sin(p.y * 1.9 + p.x * 0.45 + p.z * 0.31 + grain * 2.5);
 let fissure = smoothstep(0.79, 0.98, strata);
 let moss = smoothstep(0.08, 0.45, in.N.y) * smoothstep(-0.1, 0.32, mx_noise_float3(p * 0.31));
 s.albedo *= (0.72 + grain * 0.38) * (1.0 - fissure * 0.24);
 s.albedo = mix(s.albedo, s.albedo * vec3f(0.66,0.88,0.48), moss * 0.63);
 // Geometry supplies the normal; avoid derivative instability on sharp folds.
`});}
// Clip the reservoir to the sampled submerged terrain, not a floating ellipse.
export function reservoirGeometry(terrain,pool=RESERVOIR){
 const {x,z,rx,rz,surface}=pool,step=.22,nx=Math.ceil(2.2*rx/step),nz=Math.ceil(2.2*rz/step),pos=[],colors=[];
 const deep=new Color(0x12343a),edge=new Color(0x37665b);
 const sample=(i,j)=>{const px=x-rx*1.1+2.2*rx*i/nx,pz=z-rz*1.1+2.2*rz*j/nz;return [px,pz,Math.min(surface-terrain.heightAt(px,pz),(1.1-reservoirDistance(px,pz,pool))*Math.min(rx,rz))];};
 const emit=p=>{pos.push(p[0],surface,p[1]);const c=edge.clone().lerp(deep,smooth(p[2]/1.5));colors.push(c.r,c.g,c.b);};
 const clip=tri=>{const poly=[];for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3];if(a[2]>0)poly.push(a);if((a[2]>0)!==(b[2]>0)){let t=a[2]/(a[2]-b[2]);poly.push([mix(a[0],b[0],t),mix(a[1],b[1],t),0]);}}for(let i=1;i+1<poly.length;i++){emit(poly[0]);emit(poly[i]);emit(poly[i+1]);}};
 const grid=Array.from({length:nz+1},(_,j)=>Array.from({length:nx+1},(_,i)=>sample(i,j)));
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=grid[j][i],b=grid[j][i+1],c=grid[j+1][i+1],d=grid[j+1][i];clip([a,d,c]);clip([a,c,b]);}
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
export function reservoirMaterial(){return new Material({name:'V83.1 shaded reservoir',vertexColors:true,color:0xffffff,opacity:.84,transparent:true,depthWrite:false,side:'double',metalness:0,roughness:.24,underwaterLighting:'none',surface:`
 let phase = in.P.x * 2.7 + in.P.z * 1.6 + frame.time * 0.9;
 let phase2 = in.P.z * 4.4 - in.P.x * 1.3 - frame.time * 0.65;
 s.normal = normalize(vec3f(0.045 * cos(phase), 1.0, 0.065 * cos(phase2)) * select(-1.0,1.0,in.N.y >= 0.0));
 s.roughness = 0.22 + 0.07 * sin(phase2);
 s.alpha = mix(0.82,0.96,pow(clamp(1.0-abs(dot(s.normal,in.V)),0.0,1.0),3.0));
`});}
