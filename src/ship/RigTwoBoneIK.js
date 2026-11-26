import {Matrix4,Vector3,Quaternion} from '../engine/index.js';
// Rotate real skeleton joints after the authored clip. Translations and bone
// scales are never changed; unreachable targets remain visibly out of reach.
export class RigTwoBoneIK{
 constructor(rig,names){this.rig=rig;this.chain=names.map(name=>rig.gltf.nodes.findIndex(n=>n.name===name));this.valid=this.chain.every(i=>i>=0);this.parents=rig.gltf.nodes.map(()=>-1);rig.gltf.nodes.forEach((n,i)=>{for(const child of n.children||[])this.parents[child]=i;});this.matrices=rig.gltf.nodes.map(()=>new Matrix4());}
 evaluate(local,frame){const done=new Set(),visit=i=>{if(done.has(i))return;const parent=this.parents[i];if(parent>=0)visit(parent);const pose=local[i],m=this.matrices[i];m.compose(new Vector3(...pose.t),new Quaternion(...pose.r),new Vector3(...pose.s));m.premultiply(parent>=0?this.matrices[parent]:frame);done.add(i);};for(let i=0;i<local.length;i++)visit(i);}
 point(i){return new Vector3().setFromMatrixPosition(this.matrices[i]);}
 rotation(matrix){const q=new Quaternion();matrix.decompose(new Vector3(),q,new Vector3());return q;}
 rotate(local,joint,from,to,frame){if(from.lengthSq()<1e-10||to.lengthSq()<1e-10)return;const delta=new Quaternion().setFromUnitVectors(from.normalize(),to.normalize()),rotation=this.rotation(this.matrices[joint]),parent=this.parents[joint],parentRotation=this.rotation(parent>=0?this.matrices[parent]:frame);rotation.premultiply(delta).premultiply(parentRotation.invert());local[joint].r.set([rotation.x,rotation.y,rotation.z,rotation.w]);this.evaluate(local,frame);}
 solve(local,frame,target,pole){if(!this.valid)return null;this.evaluate(local,frame);const [upper,lower,hand]=this.chain,s=this.point(upper),e=this.point(lower),w=this.point(hand),a=s.distanceTo(e),b=e.distanceTo(w);if(a<1e-5||b<1e-5)return null;
  const axis=target.clone().sub(s),raw=axis.length();if(raw<1e-6)return null;axis.normalize();const distance=Math.min(a+b-1e-5,Math.max(Math.abs(a-b)+1e-5,raw)),along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along)),bend=pole.clone().sub(s);bend.addScaledVector(axis,-bend.dot(axis));if(bend.lengthSq()<1e-8)bend.crossVectors(axis,new Vector3(0,1,0));bend.normalize();const elbow=s.clone().addScaledVector(axis,along).addScaledVector(bend,height),goal=s.clone().addScaledVector(axis,distance);
  this.rotate(local,upper,e.clone().sub(s),elbow.clone().sub(s),frame);const movedElbow=this.point(lower);this.rotate(local,lower,this.point(hand).sub(movedElbow),goal.sub(movedElbow),frame);return {error:this.point(hand).distanceTo(target),upperLength:a,lowerLength:b,wrist:this.point(hand),shoulder:s,targetDistance:raw};
 }
}
