import {InstancedMesh,ConeGeometry,SphereGeometry,CylinderGeometry,TorusGeometry,Group,Vector3} from '../engine/index.js';
import {Material} from '../engine/render/Material.js';
import {LAYERS} from '../core/SceneRenderer.js';
import {mat4} from '../world/boat/GeoKit.js';
import {ELEMENTAL,elementalRadius} from './ElementalSkills.js';
const TAU=2*Math.PI, clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const COUNT=96;
// Bounded preallocated native instancing; all cast positions fixed at release.
export class ElementalEffects {
 constructor(scene){
  this.root=new Group();this.root.name='V65 elemental spell pool';scene.add(this.root);this.casts=new Map();this.pools=new Map();
  const geos={ice:new ConeGeometry(1,2,5),bolt:new CylinderGeometry(.25,.4,2,5),meteor:new SphereGeometry(1,8,6),beam:new CylinderGeometry(.6,1,2,8),cage:new CylinderGeometry(.45,.45,2,5),crown:new ConeGeometry(1,2,6),fire:new SphereGeometry(1,8,5)};
  for(const [kind,d] of Object.entries(ELEMENTAL)){
   const fire=d.shape==='fire'||d.shape==='meteor';
   const material=new Material({surface:fire?`let ripple = 0.5 + 0.5*sin(in.uv.y*25.0 + sin(in.uv.x*19.0 + frame.time*6.0)*2.7 - frame.time*9.0); s.albedo = mix(vec3f(0.36,0.022,0.004),vec3f(1.0,0.40,0.055),ripple); s.emissive = s.albedo * (1.0 + 2.0*ripple); s.alpha *= 0.35 + 0.65*ripple;`:undefined,name:'elemental '+kind,color:d.color,emissive:d.color,lit:false,transparent:true,depthWrite:false,opacity:.65,side:'double',velocityWeight:0});
   const mesh=new InstancedMesh(geos[d.shape],material,COUNT);mesh.name=kind;mesh.layers.set(LAYERS.TRANSPARENT);mesh.frustumCulled=false;mesh.visible=false;mesh.count=0;this.root.add(mesh);this.pools.set(kind,mesh);
  }
 }
 release(b,e){if(!ELEMENTAL[e.kind])return;this.casts.set(b.id,{kind:e.kind,x:Number.isFinite(e.x)?e.x:b.brain.x,z:Number.isFinite(e.z)?e.z:b.brain.z,radius:e.radius||ELEMENTAL[e.kind].radius,age:0});}
 reset(id){this.casts.delete(id);}
 update(dt,camera){
  for(const m of this.pools.values())m.count=0;
  for(const [id,c] of this.casts){c.age+=Math.max(0,Math.min(.15,dt));if(c.age>6.2){this.casts.delete(id);continue;}if(camera&&Math.hypot(camera.x-c.x,camera.z-c.z)>420)continue;
   const m=this.pools.get(c.kind),shape=ELEMENTAL[c.kind].shape;const r=elementalRadius(c.radius,c.age),f=clamp(c.age/6.2),fade=Math.max(.01,1-f);const n=Math.min(24,COUNT-m.count);
   for(let i=0;i<n;i++){
    const a=i*TAU/24, j=Math.sin(i*12.37);let x=c.x+Math.cos(a)*r,z=c.z+Math.sin(a)*r;
    let y=1.0,rx=0,ry=-a,rz=0,sx=.45*fade,sy=2.8*fade,sz=sx;
    if(shape==='ice'){y+=1.5+Math.sin(i*2)*.6;rx=Math.PI*.42;ry=Math.PI/2-a;sx=.7*fade;sy=5*fade;sz=sx;}
    if(shape==='crown'){y+=2.4;sy=(3.8+1.5*j)*fade;sx=1.2*fade;sz=sx;rz=j*.28;}
    if(shape==='bolt'||shape==='cage'){y+=3+j;rx=.2*Math.sin(c.age*13+i);rz=.25*j;sy=(shape==='cage'?7:4)*fade;sx=.22+.26*Math.abs(Math.sin(c.age*15+i));sz=sx;}
    if(shape==='meteor'){y+=Math.max(0,11*(1-clamp(c.age/.85)))+Math.abs(Math.sin(i*2+c.age*8))*2;sx=sy=sz=(1.4+.45*j)*fade;}
    if(shape==='beam'){x=c.x+Math.cos(a)*r*.5;z=c.z+Math.sin(a)*r*.5;y+=2;rx=Math.PI/2;ry=Math.PI/2-a;sy=Math.max(.1,r*.5);sx=sz=.45*fade;}
    if(shape==='fire'){const angle=a+c.age*.65,rr=r*(.89+.11*Math.sin(i*2+c.age*4));x=c.x+Math.cos(angle)*rr;z=c.z+Math.sin(angle)*rr;y+=1.7+Math.sin(c.age*7+i)*1.4;const pulse=.8+.4*Math.sin(c.age*5+i);sx=sz=1.2*fade*pulse;sy=2.3*fade*pulse;}
    m.setMatrixAt(m.count++,mat4(x,y,z,rx,ry,rz,sx,sy,sz,'YXZ'));
   }
  }
  for(const m of this.pools.values()){m.visible=m.count>0;if(m.visible)m.instanceMatrix.needsUpdate=true;}
 }
}
