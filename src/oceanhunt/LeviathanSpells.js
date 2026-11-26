import {LAYERS} from '../core/SceneRenderer.js';
// V66 original volumetric-space mechanics (not the surface boss's 2D rings).
import {Group,Mesh,InstancedMesh,Vector3,Quaternion,Matrix4,Color,ConeGeometry,CylinderGeometry,SphereGeometry,TorusGeometry} from '../engine/index.js';
import {Material} from '../engine/render/Material.js';
import {mat4} from '../world/boat/GeoKit.js';
export const LEVIATHAN_SPELLS=Object.freeze({
 frost_lance:{name:'霜晶穿刺',color:0x92dfff,windup:2.5,hold:1.2,radius:20,damage:180,shape:'line'},
 storm_lance:{name:'雷霆裂隙',color:0xbcadff,windup:2.35,hold:1.15,radius:25,damage:205,shape:'line'},
 cinder_fall:{name:'热泉陨潮',color:0xff8552,windup:3,hold:2.3,radius:48,damage:235,shape:'sphere'},
 nova_beam:{name:'王庭新星光束',color:0x69f4ff,windup:3,hold:2.5,radius:27,damage:250,shape:'line'},
 voltaic_snare:{name:'深海电牢',color:0xa76fff,windup:2.7,hold:3,radius:44,damage:215,shape:'shell'},
 glacial_crown:{name:'极寒王冠',color:0x97ecff,windup:2.8,hold:2.6,radius:52,damage:230,shape:'shell'},
 flame_field:{name:'深渊热液力场',color:0xffa64e,windup:2.9,hold:3.1,radius:60,damage:275,shape:'sphere'}
});
const V=p=>new Vector3(p.x,p.y,p.z), clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function createLeviathanCast(kind,origin,target,phase=1){const d=LEVIATHAN_SPELLS[kind];if(!d)return null;const a=V(origin),b=V(target),dir=b.clone().sub(a);if(dir.lengthSq()<1)dir.set(0,0,1);dir.normalize();return {kind,origin:a,target:b,end:a.clone().addScaledVector(dir,Math.min(440,Math.max(140,a.distanceTo(b)+90))),age:-d.windup,phase,hit:false};}
export function spellContact(c,point,margin=8){const s=LEVIATHAN_SPELLS[c.kind];if(!s||c.age<0||c.age>s.hold)return false;const p=V(point);if(s.shape==='line'){const ab=V(c.end).sub(c.origin),ap=p.sub(c.origin),t=clamp(ap.dot(ab)/(ab.lengthSq()||1),0,1);return ap.addScaledVector(ab,-t).length()<=s.radius+margin;}
 const r=p.distanceTo(c.target);return s.shape==='shell'?Math.abs(r-s.radius)<=10+margin:r<=s.radius+margin;}
export function encodeCast(c){return c?{kind:c.kind,origin:c.origin.toArray(),target:c.target.toArray(),end:c.end.toArray(),age:c.age,phase:c.phase}:null;}
export function decodeCast(c){if(!c||!LEVIATHAN_SPELLS[c.kind]||!['origin','target','end'].every(k=>Array.isArray(c[k])&&c[k].length===3&&c[k].every(Number.isFinite))||!Number.isFinite(c.age))return null;return {...c,origin:new Vector3(...c.origin),target:new Vector3(...c.target),end:new Vector3(...c.end)};}
export class LeviathanSpells{
 constructor(scene){this.root=new Group();this.root.name='V66 Leviathan elemental FX';scene.add(this.root);this.meshes={};
  for(const [k,s] of Object.entries(LEVIATHAN_SPELLS)){const m=new Material({color:s.color,emissive:new Color(s.color).multiplyScalar(.7),roughness:.25,lit:false,transparent:true,depthWrite:false,opacity:.65,side:'double',underwaterLighting:'none'});const geom=s.shape==='line'?new CylinderGeometry(1,1,2,10):s.shape==='shell'?new ConeGeometry(1,2,6):new SphereGeometry(1,10,7);const pool=new InstancedMesh(geom,m,40);pool.layers.set(LAYERS.TRANSPARENT);pool.frustumCulled=false;pool.visible=false;pool.count=0;this.root.add(pool);this.meshes[k]=pool;}
 }
 draw(c){for(const m of Object.values(this.meshes)){m.visible=false;m.count=0;}if(!c)return;const s=LEVIATHAN_SPELLS[c.kind],m=this.meshes[c.kind];if(!s||!m||c.age>s.hold)return;const pre=c.age<0,progress=pre?clamp(1+c.age/s.windup,0,1):clamp(c.age/s.hold,0,1),fade=pre?.35+.3*progress:Math.max(.13,1-progress*.65);m.material.uniforms.opacity.value=pre?.28:.68*fade;const n=s.shape==='line'?28:40;
  const d=V(c.end).sub(c.origin),len=d.length();d.normalize();const yaw=Math.atan2(d.x,d.z),pitch=-Math.asin(clamp(d.y,-1,1));
  for(let i=0;i<n;i++){let p,scale,rx,ry,rz=0,sx,sy,sz;
   if(s.shape==='line'){const t=(i+.5)/n;p=V(c.origin).lerp(c.end,t);const a=i*2.4+c.age*3;const rr=pre?s.radius*.95:(c.kind==='nova_beam'?s.radius*.34:s.radius*.17);p.x+=Math.cos(a)*rr;p.z+=Math.sin(a)*rr;p.y+=Math.sin(a*.8)*rr*.55;rx=Math.PI/2+pitch;ry=yaw;scale=pre?1.0:Math.max(2,s.radius*.19);sx=sz=scale*fade;sy=Math.max(2,len/n*.67);}
   else {const phi=Math.acos(1-2*(i+.5)/n),a=i*2.399963+c.age*.35,rr=s.radius*(s.shape==='sphere'&&!pre?.50+.50*progress:1);p=V(c.target).add(new Vector3(Math.sin(phi)*Math.cos(a),Math.cos(phi),Math.sin(phi)*Math.sin(a)).multiplyScalar(rr));rx=phi-Math.PI/2;ry=a;rz=Math.sin(i)*.3;sx=sz=pre?1.3:3.0+1.5*Math.sin(i*2);sy=pre?1.3:s.shape==='shell'?9*fade:4.5*fade;}
   m.setMatrixAt(i,s.shape==='line'?new Matrix4().compose(p,new Quaternion().setFromUnitVectors(new Vector3(0,1,0),d),new Vector3(sx,sy,sz)):mat4(p.x,p.y,p.z,rx,ry,rz,sx,sy,sz,'YXZ'));
  }m.count=n;m.visible=true;m.instanceMatrix.needsUpdate=true;
 }
}
