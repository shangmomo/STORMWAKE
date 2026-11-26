// The source has four disconnected sewn canvases in one mesh. Keep each
// canvas at its own yard instead of crushing every sail into the top mast.
export class SailReefing {
 constructor(geometry){this.geometry=geometry;const a=geometry.attributes.position.array;this.rest=new Float32Array(a);const count=a.length/3,parent=Array.from({length:count},(_,i)=>i),seen=new Map();
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},join=(a,b)=>{parent[find(a)]=find(b);};
  for(let i=0;i<count;i++){const key=[a[i*3],a[i*3+1],a[i*3+2]].map(v=>Math.round(v*10000)).join(',');if(seen.has(key))join(i,seen.get(key));else seen.set(key,i);}
  const indices=geometry.index?.array||Array.from({length:count},(_,i)=>i);for(let i=0;i<indices.length;i+=3){join(indices[i],indices[i+1]);join(indices[i],indices[i+2]);}
  const groups=new Map();for(let i=0;i<count;i++){const root=find(i);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(i);}
  this.panels=[...groups.values()].map(vertices=>{let top=-Infinity,z=0,x=0;for(const i of vertices){top=Math.max(top,a[i*3+1]);z+=a[i*3+2];x+=a[i*3];}const upper=vertices.filter(i=>a[i*3+1]>top-.06);return {vertices,top,z:z/vertices.length,centerX:x/vertices.length,yardZ:upper.reduce((n,i)=>n+a[i*3+2],0)/upper.length};});this.previous='';
 }
 set(main,jib,trim=0){trim=Math.max(-1,Math.min(1,trim));main=Math.max(0,Math.min(1,main));jib=Math.max(0,Math.min(1,jib));const key=main.toFixed(3)+':'+jib.toFixed(3)+':'+trim.toFixed(2);if(key===this.previous)return;this.previous=key;
  const position=this.geometry.attributes.position,a=position.array,r=this.rest;
  for(const panel of this.panels){const amount=.035+.965*(panel.z>4?jib:main);for(const i of panel.vertices){a[i*3+1]=panel.top-(panel.top-r[i*3+1])*amount;const x=r[i*3]-panel.centerX,z=(r[i*3+2]-panel.yardZ)*amount,angle=trim*.38,c=Math.cos(angle),s=Math.sin(angle);a[i*3]=panel.centerX+x*c+z*s;a[i*3+2]=panel.yardZ+z*c-x*s;}}
  position.needsUpdate=true;this.geometry.computeVertexNormals();this.geometry.computeBoundingBox();this.geometry.computeBoundingSphere();
 }
}
