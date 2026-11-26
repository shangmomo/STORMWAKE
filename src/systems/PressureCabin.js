import {BufferGeometry,BufferAttribute,Group,Mesh,Matrix4} from '../engine/index.js';

// Subtract a rectangular pressure cabin from static triangles. Splitting the
// crossing polygons preserves a real aperture, UVs and the exterior silhouette.
export function subtractCabin(geometry,min,max){
 const attrs=Object.entries(geometry.attributes).filter(([,a])=>!a.isInstancedBufferAttribute),stride=attrs.reduce((n,[,a])=>n+a.itemSize,0),posOffset=attrs.slice(0,attrs.findIndex(([n])=>n==='position')).reduce((n,[,a])=>n+a.itemSize,0);
 const read=i=>attrs.flatMap(([,a])=>Array.from(a.array.slice(i*a.itemSize,(i+1)*a.itemSize)));
 const planes=[[0,min[0],1],[0,max[0],-1],[1,min[1],1],[1,max[1],-1],[2,min[2],1],[2,max[2],-1]],out=[];
 const side=(poly,axis,bound,sign,inside)=>{const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[posOffset+axis]-bound)*sign,db=(b[posOffset+axis]-bound)*sign,keepA=inside?da>=0:da<=0,keepB=inside?db>=0:db<=0;if(keepA)result.push(a);if(keepA!==keepB){const t=da/(da-db);result.push(a.map((v,k)=>v+(b[k]-v)*t));}}return result;};
 const emit=poly=>{for(let i=1;i+1<poly.length;i++)out.push(poly[0],poly[i],poly[i+1]);};
 const indices=geometry.index?.array||Array.from({length:geometry.attributes.position.count},(_,i)=>i);
 for(let i=0;i<indices.length;i+=3){let poly=[read(indices[i]),read(indices[i+1]),read(indices[i+2])];for(const [axis,bound,sign] of planes){if(!poly.length)break;emit(side(poly,axis,bound,sign,false));poly=side(poly,axis,bound,sign,true);}}
 const g=new BufferGeometry();let offset=0;for(const [name,a] of attrs){const values=new Float32Array(out.length*a.itemSize);for(let i=0;i<out.length;i++)for(let k=0;k<a.itemSize;k++)values[i*a.itemSize+k]=out[i][offset+k];g.setAttribute(name,new BufferAttribute(values,a.itemSize));offset+=a.itemSize;}if(g.attributes.normal)g.normalizeNormals();g.computeBoundingSphere();return g;
}

export function openPressureCabin(frame,model){
 frame.updateWorldMatrix(true,true);const inv=new Matrix4().copy(frame.matrixWorld).invert(),cut=new Group();cut.name='Nautilus pressure cabin aperture';
 model.traverse(mesh=>{if(!mesh.isMesh)return;const transform=new Matrix4().multiplyMatrices(inv,mesh.matrixWorld),geometry=mesh.geometry.clone().applyMatrix4(transform);const exterior=new Mesh(subtractCabin(geometry,[-.89,-.31,-.98],[.89,1.01,6]),mesh.material);exterior.castShadow=false;cut.add(exterior);});
 frame.remove(model);frame.add(cut);return cut;
}
