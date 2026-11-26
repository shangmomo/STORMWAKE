import assert from 'node:assert/strict';
import {RigTwoBoneIK} from '../src/ship/RigTwoBoneIK.js';
import {Matrix4,Vector3,Quaternion} from '../src/engine/index.js';
const rig={gltf:{nodes:[{name:'upper',children:[1]},{name:'lower',children:[2]},{name:'hand',children:[]}]}},ik=new RigTwoBoneIK(rig,['upper','lower','hand']),rest=[{t:[0,0,0],r:[0,0,0,1],s:[1,1,1]},{t:[.34,0,0],r:[0,0,0,1],s:[1,1,1]},{t:[.32,0,0],r:[0,0,0,1],s:[1,1,1]}],fresh=()=>rest.map(p=>({t:Float32Array.from(p.t),r:Float32Array.from(p.r),s:Float32Array.from(p.s)}));
const frame=new Matrix4().compose(new Vector3(3,2,-7),new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.7),new Vector3(2,2,2));
for(let i=0;i<200;i++){const local=fresh(),target=new Vector3(.3+Math.sin(i*.05)*.08,.2,.1).applyMatrix4(frame),pole=new Vector3(0,0,1).applyMatrix4(frame),result=ik.solve(local,frame,target,pole);assert.ok(result.error<1e-5,result.error);assert.ok(Math.abs(result.upperLength-.68)<1e-6);assert.ok(Math.abs(result.lowerLength-.64)<1e-6);for(let j=0;j<local.length;j++){assert.deepEqual(Array.from(local[j].t),Array.from(Float32Array.from(rest[j].t)));assert.deepEqual(Array.from(local[j].s),rest[j].s);}}
const result=ik.solve(fresh(),new Matrix4(),new Vector3(3,0,0),new Vector3(0,0,1));assert.ok(result.error>2);assert.ok(Math.abs(result.wrist.length()-.66)<.0001,'cannot stretch bones to remote targets');
console.log('V63 real skeleton IK: scaled/rotated frames, 200 changing wrist targets, fixed translations/scales and unreachable-target clamp PASS');
