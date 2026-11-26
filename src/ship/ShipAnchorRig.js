import {Group,Mesh,InstancedMesh,Vector3,Matrix4,Quaternion} from '../engine/index.js';
import {torus,box,prepare,mergePrepared,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
import {ANCHOR_HAWSE as H,ANCHOR_HEIGHT,anchorEyePose} from './AnchorKinematics.js';
export function installAnchorRig(boat,asset){
 const root=new Group(),s=boat.shipScale;root.scale.set(1/s.x,1/s.y,1/s.z);root.name='V62 physical CC0 bow anchor and shared seabed chain';boat.group.add(root);
 const carrier=new Group();carrier.position.set(H.x,H.y,H.z);
 const model=asset.root.clone(true);model.rotation.x=Math.PI/2;model.position.y=-.44674280285835266;
 const scale=new Group();scale.scale.setScalar(1.38);scale.rotation.y=Math.PI/2;scale.add(model);carrier.add(scale);root.add(carrier);
 const bracket=new Mesh(mergePrepared([
   prepare(box(.38,.15,.35),{color:0x594b39,metal:.65,rough:.55,matrix:mat4(H.x-.08,H.y+.02,H.z)}),
   prepare(torus(.11,.025,8,20),{color:0x62696a,metal:.8,rough:.4,matrix:mat4(H.x,H.y,H.z,Math.PI/2)})
 ]),landMaterial);bracket.castShadow=true;root.add(bracket);
 const link=prepare(torus(.055,.013,6,12),{color:0x62696a,metal:.8,rough:.5,matrix:mat4(0,0,0,0,0,0,1,1.5,1)});
 const chain=new InstancedMesh(link,landMaterial,300);chain.name='V62 linked anchor chain, one instanced draw';chain.castShadow=true;chain.frustumCulled=false;root.add(chain);
 const start=new Vector3(H.x,H.y,H.z),point=new Vector3(),tangent=new Vector3(),q=new Quaternion(),matrix=new Matrix4(),unit=new Vector3(1,1,1),up=new Vector3(0,1,0),twist=new Quaternion().setFromAxisAngle(up,Math.PI/2);
 const rig={source:'/models/stormwake_v47/quaternius_prop_anchor.glb',root,carrier,chain,height:ANCHOR_HEIGHT,eyeLocal:{...H},contact:false,
  update(dt,travel){
   const context=boat.anchorContext?.();
   if(!context)return;
   const pose=anchorEyePose({...context,travel});if(!pose.eyeLocal)return;
   this.eyeLocal=pose.eyeLocal;this.contact=pose.contact;this.chainLength=pose.chain;
   carrier.position.set(pose.eyeLocal.x,pose.eyeLocal.y,pose.eyeLocal.z);
   // The anchor stays upright in world gravity while the hull rolls around it.
   if(pose.contact)carrier.quaternion.copy(context.inverseRotation);else carrier.quaternion.identity();
   const end=carrier.position,distance=start.distanceTo(end),sag=Math.min(2.0,Math.max(0,pose.chain-distance)*.15);
   const count=Math.max(1,Math.min(300,Math.ceil((distance+sag*2)/.14)));
   chain.count=count;
   for(let i=0;i<count;i++){
     const t=count===1?0:i/(count-1);
     point.lerpVectors(start,end,t);point.y-=Math.sin(Math.PI*t)*sag;
     tangent.copy(end).sub(start);tangent.y-=Math.cos(Math.PI*t)*Math.PI*sag;
     if(tangent.lengthSq()<1e-8)tangent.copy(up);else tangent.normalize();
     q.setFromUnitVectors(up,tangent);if(i%2)q.multiply(twist);
     matrix.compose(point,q,unit);chain.setMatrixAt(i,matrix);
   }
   chain.instanceMatrix.needsUpdate=true;this.visibleSpan=distance;
  }
 };
 boat.heritageArt.anchorRig=rig;return rig;
}
