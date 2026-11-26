import {Matrix4,Vector3} from '../engine/index.js';
import {RESERVOIR,localWaterAt} from '../land/MineReservoirV80.js';
import {CABIN} from '../oceanhunt/AbyssCrewRules.js';
import {sectionAt} from '../oceanhunt/PressureSystemsV80.js';
// Shared camera-side volume definition. Shape 1 = ellipse; 2 = box.
// Coordinates are in metres; a moving submarine uses its own rigid transform.
const poolMatrix=new Matrix4().makeTranslation(-RESERVOIR.x,0,-RESERVOIR.z);
export function cameraLocalVolume(camera,raid,terrain=null){
 if(!camera||![camera.x,camera.y,camera.z].every(Number.isFinite))return null;
 if(raid?.hatch?.wetView)return null;
 if(raid?.active&&raid.cameraMode==='interior'&&raid.sub&&raid.pressure){
  raid.sub.updateWorldMatrix(true,false);const worldToSub=raid.sub.matrixWorld.clone().invert(),p=new Vector3(camera.x,camera.y,camera.z).applyMatrix4(worldToSub),i=sectionAt(p.z),water=raid.pressure.sections[i]?.water??0;
  const center=[-8.4,0,8.4][i],halfZ=[4.4,3.9,4.4][i],surface=CABIN.floor+Math.max(0,Math.min(1,water))*3.4;
  return {shape:2,matrix:new Matrix4().makeTranslation(0,0,-center).multiply(worldToSub),rx:3.225,rz:halfZ,floor:CABIN.floor,surface,dry:water*3.4<=.015,depth:surface-p.y};
 }
 const surface=localWaterAt(camera.x,camera.y,camera.z,terrain);return surface===null?null:{shape:1,matrix:poolMatrix,rx:RESERVOIR.rx*1.10,rz:RESERVOIR.rz*1.10,floor:surface-RESERVOIR.depth,surface,dry:false,depth:surface-camera.y};
}
export function pointInLocalWater(v,point){if(!v||v.dry)return false;const q=new Vector3(point.x,point.y,point.z).applyMatrix4(v.matrix);if(q.y>=v.surface||q.y<v.floor)return false;const x=q.x/v.rx,z=q.z/v.rz;return v.shape===1?x*x+z*z<=1:Math.abs(x)<=1&&Math.abs(z)<=1;}
