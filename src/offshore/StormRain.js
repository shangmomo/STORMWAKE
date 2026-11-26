// V44 P1 — camera-centered physically located rain streaks.
// A single transparent mesh uses deterministic per-vertex positions and the
// shared GPU clock. The complete rain field follows the camera, not the port;
// particles only render when the sampled regional weather actually rains.
import {Group,Mesh} from '../engine/index.js';
import {box,prepare,mergePrepared,mat4} from '../world/boat/GeoKit.js';
import {Material} from '../engine/render/Material.js';
import {LAYERS} from '../core/SceneRenderer.js';
const N=640;
const fract=x=>x-Math.floor(x);
const rnd=(i,seed)=>fract(Math.sin(i*127.1+seed*311.7)*43758.5453123);
export class StormRain {
 constructor(scene){
  const parts=[];
  for(let i=0;i<N;i++){
   const x=(rnd(i,1)-.5)*64,z=(rnd(i,2)-.5)*64,y=rnd(i,3)*26;
   const streak=prepare(box(.022,.48,.024),{color:i%5===0?0xb1d6d4:0x749cac,
    rough:1,anim:rnd(i,3),matrix:mat4(x,y,z)});
   parts.push(streak);
  }
  this.material=new Material({name:'V44LocalRainStreaks',lit:false,transparent:true,depthWrite:false,
   side:'double',vertexColors:true,velocityWeight:0,uniforms:{rainStrength:['f32',0]},
   attributes:{aux:'vec4f'},
   vertex:`
    let fall=frame.time*(13.0+v.aux.w*6.0);
    // Wrap each particle's shared centre, never individual box vertices:
    // wrapping endpoints separately stretched a 48cm drop into a 26m stripe.
    let center=v.aux.w*26.0;
    v.position.y+=fract((center-fall)/26.0)*26.0-center;
    v.position.x+=sin(frame.time*.7+v.aux.w*6.0)*.2;
   `,
   surface:`
    s.albedo=in.color.rgb*.25;
    s.emissive=in.color.rgb*.50;
    s.alpha=clamp(mat.rainStrength*.43,0.0,.43);
   `});
  this.root=new Group();this.root.name='V44 spatial offshore rain';
  const rain=new Mesh(mergePrepared(parts),this.material);rain.castShadow=false;rain.receiveShadow=false;
  rain.layers.set(LAYERS.TRANSPARENT);rain.frustumCulled=false;
  this.root.add(rain);scene.add(this.root);this.root.visible=false;
 }
 update(weather,camera,{indoors=false}={}){
  const strength=indoors?0:(weather?.rain||0);
  this.root.visible=strength>.1;
  if(!this.root.visible)return;
  this.material.set('rainStrength',strength);
  this.root.position.set(camera.x,camera.y-4,camera.z);
  // Wind-tilted mesh, based on the same vector that drives the ship sails.
  this.root.rotation.y=weather.windDirection||0;
 }
}
