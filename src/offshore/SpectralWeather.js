import {Group,Mesh,Vector3} from '../engine/index.js';
import {box,cylinder,prepare,mergePrepared,mat4,alignY} from '../world/boat/GeoKit.js';
import {Material} from '../engine/render/Material.js';
import {LAYERS} from '../core/SceneRenderer.js';
import {lightningAt} from './OffshoreField.js';
// Low storm anvils are world-space bodies. The marine haze separately obscures
// water and hulls at their actual depth; these clouds never replace the ocean.
export class SpectralWeather{
 constructor(scene){
  this.root=new Group();this.root.name='V62 spectral storm cloud banks';this.root.position.set(-600,0,2450);scene.add(this.root);
  const material=new Material({name:'V62 volumetric low storm bank',lit:false,transparent:true,side:'double',depthWrite:false,velocityWeight:0,output:`r.mask=vec4f(0.0,0.0,1.0,s.alpha);`,
   surface:`
    let direction=-normalize(in.V);let origin=frame.cameraPos;
    let lo=vec3f(-1510.0,160.0,1540.0);let hi=vec3f(310.0,420.0,3360.0);
    let safeDir=select(direction,vec3f(.00001),abs(direction)<vec3f(.00001));
    let a=(lo-origin)/safeDir;let b=(hi-origin)/safeDir;
    let t0=max(max(min(a.x,b.x),min(a.y,b.y)),min(a.z,b.z));
    let t1=min(min(max(a.x,b.x),max(a.y,b.y)),max(a.z,b.z));
    let inside=all(origin>lo)&&all(origin<hi);
    if((!inside&&!in.front)||(inside&&in.front)){discard;}
    let start=max(0.0,t0);let stride=max(1.0,(t1-start)/48.0);
    var transmission=1.0;var energy=vec3f(0.0);
    for(var i=0;i<48;i++){
     let p=origin+direction*(start+(f32(i)+.5)*stride);
     let q=p.xz-vec2f(-600.0,2450.0);let h=(p.y-160.0)/260.0;
     let adv=p.xz*.008+vec2f(frame.time*.004,frame.time*.002);
     let turbulence=.52+.17*sin(adv.x+sin(adv.y*1.4))+.14*sin(adv.y*2.7+adv.x*1.8)+.10*sin(adv.x*6.1-adv.y*4.3+p.y*.032)+.07*sin(p.x*.11+p.y*.09+p.z*.075);
     let envelope=smoothstep(0.0,.20,h)*(1.0-smoothstep(.62,1.0,h))*(1.0-smoothstep(550.0,900.0,length(q)));
     let rho=max(0.0,turbulence-.34)*envelope;
     let opacity=1.0-exp(-rho*stride*.045);
     let shade=.16+.21*h+.08*turbulence;
     energy+=transmission*opacity*vec3f(shade*.78,shade*.88,shade);
     transmission*=1.0-opacity;
    }
    s.albedo=vec3f(0.0);s.emissive=energy/max(.001,1.0-transmission)*(frame.skyIrradiance*.65+frame.sunColor*.003+vec3f(.015));s.alpha=1.0-transmission;
   `});
  const clouds=new Mesh(prepare(box(1820,260,1820),{matrix:mat4(0,290,0)}),material);clouds.layers.set(LAYERS.TRANSPARENT);clouds.castShadow=false;this.root.add(clouds);
  this.bolt=new Group();this.bolt.name='V62 forked lightning';scene.add(this.bolt);
  const boltMaterial=new Material({name:'V62 lightning plasma',lit:false,emissive:0xb8e6ff,color:0xe1f4ff});
  const paths=[];let prior=new Vector3(0,270,0);
  for(let i=1;i<=18;i++){const next=new Vector3(Math.sin(i*7.2)*12,(1-i/18)*270,Math.cos(i*4.4)*10);const d=next.clone().sub(prior),mid=next.clone().add(prior).multiplyScalar(.5);paths.push(prepare(cylinder(.7,.4,d.length(),5),{matrix:alignY(mid,d)}));if(i===7||i===11){const end=next.clone().add(new Vector3(32,-45,20));const bd=end.clone().sub(next);paths.push(prepare(cylinder(.35,.1,bd.length(),5),{matrix:alignY(end.clone().add(next).multiplyScalar(.5),bd)}));}prior=next;}
  const mesh=new Mesh(mergePrepared(paths),boltMaterial);mesh.castShadow=false;this.bolt.add(mesh);
 }
 update(time,camera){const distance=Math.hypot(camera.x+600,camera.z-2450);this.root.visible=distance<2300;const strike=lightningAt(time);this.bolt.visible=strike.flash>0&&distance<2300;this.bolt.position.set(strike.x,0,strike.z);}
}
