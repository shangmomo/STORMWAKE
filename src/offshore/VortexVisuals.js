// V62: finite 3D density march inside each waterspout; no billboard textures.
import {Group,Mesh,Vector4} from '../engine/index.js';
import {cylinder,sphere,prepare,mergePrepared,mat4} from '../world/boat/GeoKit.js';
import {Material} from '../engine/render/Material.js';
import {LAYERS} from '../core/SceneRenderer.js';
import {stormCells} from './OffshoreField.js';
function volumeMaterial(){return new Material({name:'V62WaterspoutDensityMarch',lit:false,transparent:true,side:'front',depthWrite:false,velocityWeight:0,output:`r.mask=vec4f(0.0,0.0,1.0,s.alpha);`,
 uniforms:{cell:['vec4f',new Vector4(0,0,235,1)]},
 surface:`
 let ray=-normalize(in.V); var transmission=1.0; var sum=vec3f(0.0);
 for(var i=0;i<48;i++){
  let p=in.P+ray*(f32(i)*3.8+1.9);
  let h=p.y/mat.cell.z;
  let center=mat.cell.xy+vec2f(sin(h*5.0+frame.time*.17)*6.0,cos(h*4.0+frame.time*.13)*7.0);
  let d=p.xz-center;let a=atan2(d.y,d.x)+frame.time*1.4-h*8.0;
  let r=(9.0+17.0*pow(abs(h-.42)/.58,1.8)+18.0*pow(clamp(h,0.0,1.0),4.0))*mat.cell.w;
  let turbulence=.58+.22*sin(a*5.0+p.y*.12)+.14*sin(a*11.0-p.y*.27+frame.time*2.0)+.06*sin(p.x*.7+p.z*.5+p.y*.8);
  let radial=1.0-smoothstep(r*.28,r*1.2,length(d));
  let vertical=smoothstep(0.0,.035,h)*(1.0-smoothstep(.9,1.02,h));
  let density=clamp(radial*vertical*turbulence*.17,0.0,.26);
  let light=.15+.31*clamp(length(d)/max(r,1.0),0.0,1.0)+.12*h;
  sum+=transmission*density*vec3f(light*.77,light*.91,light);
  transmission*=1.0-density;
 }
 s.albedo=vec3f(0.0);s.emissive=sum/max(1.0-transmission,.001)*(frame.skyIrradiance*.8+frame.sunColor*.004+vec3f(.02));s.alpha=1.0-transmission;
 `});}
export class VortexVisuals{
 constructor(scene){
  this.cells=stormCells(0).map((cell,i)=>{
   const root=new Group();root.name='V62 volumetric waterspout '+cell.id;
   const material=volumeMaterial();
   const volume=new Mesh(prepare(cylinder(82,82,300,32),{matrix:mat4(0,150,0)}),material);
   volume.layers.set(LAYERS.TRANSPARENT);volume.castShadow=false;root.add(volume);
   const spray=new Material({name:'V62 spray '+i,lit:false,transparent:true,side:'double',depthWrite:false,
    surface:`let n=sin(in.P.x*.47+frame.time*2.0)*sin(in.P.z*.31-frame.time*1.7);let rim=abs(dot(normalize(in.N),normalize(in.V)));s.albedo=vec3f(.23,.32,.34);s.alpha=pow(rim,1.8)*(.10+.07*n);`});
   const pockets=[];for(let j=0;j<20;j++){const a=j*2.3999,r=20+j%4*11;pockets.push(prepare(sphere(1,12,8),{matrix:mat4(Math.cos(a)*r,3+j%3*3,Math.sin(a)*r,0,a,0,13+j%3*5,4,9+j%4*3)}));}
   const mist=new Mesh(mergePrepared(pockets),spray);mist.layers.set(LAYERS.TRANSPARENT);mist.castShadow=false;root.add(mist);
   root.userData.volumeMaterial=material;scene.add(root);return root;
  });this.root=this.cells[0];
 }
 update(time,camera){
  stormCells(time).forEach((cell,i)=>{const root=this.cells[i];root.position.set(cell.x,0,cell.z);root.visible=Math.hypot(camera.x-cell.x,camera.z-cell.z)<2100;root.userData.volumeMaterial.uniforms.cell.value.set(cell.x,cell.z,cell.height,cell.scale);});
 }
}
