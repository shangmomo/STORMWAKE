import {Matrix4,Vector3,BufferAttribute} from '../engine/index.js';
export function placeMetricObject(root,boat,name,target){
 const object=root.getObjectByName(name);if(!object)return false;
 boat.group.updateWorldMatrix(true,true);const s=boat.shipScale||{x:1,y:1,z:1},frame=new Matrix4().makeScale(s.x,s.y,s.z).multiply(new Matrix4().copy(boat.group.matrixWorld).invert()),min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity),v=new Vector3();
 object.traverse(mesh=>{const p=mesh.geometry?.attributes.position;if(!p)return;const m=new Matrix4().multiplyMatrices(frame,mesh.matrixWorld);for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);min.min(v);max.max(v);}});
 if(!Number.isFinite(min.x))return false;
 const delta=new Vector3(target.x-(min.x+max.x)/2,target.y-min.y,target.z-(min.z+max.z)/2),inverse=new Matrix4().multiplyMatrices(frame,object.parent.matrixWorld).invert(),origin=new Vector3().applyMatrix4(inverse);
 object.position.add(delta.applyMatrix4(inverse).sub(origin));return true;
}
// Subtract a measured boat-metre opening from the displayed static geometry.
// Intersections interpolate original normals/UVs; materials stay attached.
export function cutMetricOpening(root,boat,opening){
 boat.group.updateWorldMatrix(true,true);const s=boat.shipScale||{x:1,y:1,z:1},frame=new Matrix4().makeScale(s.x,s.y,s.z).multiply(new Matrix4().copy(boat.group.matrixWorld).invert()),point=new Vector3();let affected=0;
 const clip=(poly,axis,plane,high)=>{const inside=[],outside=[];
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=high?a[axis]>=plane:a[axis]<=plane,ib=high?b[axis]>=plane:b[axis]<=plane;(ia?inside:outside).push(a);
   if(ia!==ib){const t=(plane-a[axis])/(b[axis]-a[axis]),p=a.map((v,k)=>v+(b[k]-v)*t);p[axis]=plane;inside.push(p);outside.push(p);}}
  return [inside,outside];
 };
 root.traverse(mesh=>{const g=mesh.geometry,pos=g?.attributes?.position;if(!pos)return;
  const matrix=new Matrix4().multiplyMatrices(frame,mesh.matrixWorld),inverse=matrix.clone().invert(),normal=g.attributes.normal,uv=g.attributes.uv,rows=[],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<pos.count;i++){point.fromBufferAttribute(pos,i).applyMatrix4(matrix);const p=[point.x,point.y,point.z];for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}rows.push([...p,normal?.array[i*3]||0,normal?.array[i*3+1]||0,normal?.array[i*3+2]||0,uv?.array[i*2]||0,uv?.array[i*2+1]||0]);}
  if(min.some((v,k)=>v>=opening.max[k]||max[k]<=opening.min[k]))return;
  const indices=g.index?.array||Array.from({length:pos.count},(_,i)=>i),out=[];
  for(let i=0;i<indices.length;i+=3){const triangle=[rows[indices[i]],rows[indices[i+1]],rows[indices[i+2]]];
   if([0,1,2].some(k=>Math.max(...triangle.map(p=>p[k]))<=opening.min[k]||Math.min(...triangle.map(p=>p[k]))>=opening.max[k])){out.push(...triangle);continue;}
   affected++;let remaining=[triangle],survivors=[];
   for(let axis=0;axis<3;axis++)for(const [plane,high]of [[opening.min[axis],true],[opening.max[axis],false]]){const next=[];for(const polygon of remaining){const [inner,outer]=clip(polygon,axis,plane,high);if(outer.length>=3)survivors.push(outer);if(inner.length>=3)next.push(inner);}remaining=next;}
   for(const poly of survivors)for(let j=1;j<poly.length-1;j++)out.push(poly[0],poly[j],poly[j+1]);
  }
  const positions=new Float32Array(out.length*3),normals=new Float32Array(out.length*3),texcoords=new Float32Array(out.length*2);
  out.forEach((r,i)=>{point.set(r[0],r[1],r[2]).applyMatrix4(inverse);positions.set([point.x,point.y,point.z],i*3);const len=Math.hypot(r[3],r[4],r[5])||1;normals.set([r[3]/len,r[4]/len,r[5]/len],i*3);texcoords.set([r[6],r[7]],i*2);});
  g.setAttribute('position',new BufferAttribute(positions,3));g.setAttribute('normal',new BufferAttribute(normals,3));g.setAttribute('uv',new BufferAttribute(texcoords,2));g.setIndex(new BufferAttribute(Uint32Array.from({length:out.length},(_,i)=>i),1));g.computeBoundingBox();g.computeBoundingSphere();
 });
 return {affected,opening};
}
