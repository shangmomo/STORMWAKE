import {BufferGeometry,Float32BufferAttribute,Color} from '../engine/index.js';
import {CAVE,caveProfile} from './ExpeditionTerrain.js';
import {hallProfile} from './UndergroundHallV84.js';
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const noise=(x,y,z)=>.54*Math.sin(x*.36+y*.57+z*.21)+.30*Math.sin(x*.79-z*.53+y*.23)+.16*Math.sin(z*1.17+x*.41);
export function caveRockGeometry84(terrain){
 const {front,back}=CAVE,n=48,m=Math.round((front-back)/1.465),stride=n+1,inner=[],outer=[],positions=[],colors=[],indices=[];
 const aColor=new Color(0x3e4237),bColor=new Color(0x777569);
 const add=p=>{const i=positions.length/3;positions.push(...p);const c=aColor.clone().lerp(bColor,smooth(.5+.42*noise(...p)));colors.push(c.r,c.g,c.b);return i;};
 for(let j=0;j<=m;j++){
  const z=front-(front-back)*j/m,old=caveProfile(z),p=hallProfile(old,z),base=terrain.heightAt(old.x,z),t=j*.5;
  const width=p.width+Math.sin(t*1.73)*.56+Math.sin(t*.43)*.75,high=p.high+2*Math.sin(t*.49)+.6*Math.cos(t*1.3);
  const inRow=[],outRow=[];
  for(let i=0;i<=n;i++){
   const angle=Math.PI*i/n,s=Math.sin(angle),c=Math.cos(angle),x=p.x+c*width;
   const low=mix(base,terrain.heightAt(x,z),Math.pow(Math.abs(c),8))-1.0;
   const y=low+s*high+.38*Math.sin(i*1.085+t*1.41)*s;
   const nx=noise(x,y,z),ox=p.x+c*(width+3.4+.55*Math.sin(t*.81));
   const foot=terrain.heightAt(ox,z)-1.5,crest=y+2.7+1.2*s+1.05*nx*s;
   inRow.push(add([x,y,z]));outRow.push(add([ox,mix(foot,crest,smooth(s/.42)),z]));
  }
  inner.push(inRow);outer.push(outRow);
 }
 const q=(a,b,c,d)=>indices.push(a,b,c,a,c,d);
 for(let j=0;j<m;j++)for(let i=0;i<n;i++){q(inner[j][i],inner[j][i+1],inner[j+1][i+1],inner[j+1][i]);q(outer[j][i],outer[j+1][i],outer[j+1][i+1],outer[j][i+1]);}
 // Front rim faces the entrance; opposite sides use opposite winding.
 for(let i=0;i<n;i++)q(inner[0][i+1],inner[0][i],outer[0][i],outer[0][i+1]);
 for(let j=0;j<m;j++){q(inner[j][0],inner[j+1][0],outer[j+1][0],outer[j][0]);q(inner[j+1][n],inner[j][n],outer[j][n],outer[j+1][n]);}
 const caps=[];
 for(const outside of [false,true]){
  const ring=(outside?outer:inner)[m],rows=[ring];
  for(let r=1;r<=5;r++){const u=r/5,row=[];for(let i=0;i<=n;i++){const k=ring[i]*3,x=positions[k],y=positions[k+1],z=positions[k+2]+(outside?-1.3:.32)*Math.sin(Math.PI*u)*Math.sin(Math.PI*i/n),bottom=Math.min(y-.22,terrain.heightAt(x,z)-1.6);row.push(add([x,mix(y,bottom,u),z]));}const prev=rows.at(-1);for(let i=0;i<n;i++){if(outside)q(prev[i],row[i],row[i+1],prev[i+1]);else q(prev[i],prev[i+1],row[i+1],row[i]);}rows.push(row);}caps.push(rows);
 }
 const [a,b]=caps;for(let r=0;r<5;r++){q(a[r][0],b[r][0],b[r+1][0],a[r+1][0]);q(a[r][n],a[r+1][n],b[r+1][n],b[r][n]);}for(let i=0;i<n;i++)q(a[5][i],b[5][i],b[5][i+1],a[5][i+1]);
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
