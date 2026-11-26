import {SailorBody} from '../ship/SailorBody.js';
import {Group,Mesh,Vector3,Color} from '../engine/index.js';
import {Material} from '../engine/render/Material.js';
import {box,sphere,torus,GeoKit,mat4} from '../world/boat/GeoKit.js';
import {CABIN,ABYSS_STATIONS,cabinMove,cabinInput,nearStation} from './AbyssCrewRules.js';
import {newPressure} from './PressureSystemsV80.js';
const V=(x=0,y=0,z=0)=>new Vector3(x,y,z);
// All geometry is attached to the same submarine transform, in metres.
// Merged static groups keep draw calls independent of panel count.
export class AbyssInterior{
 constructor(sub){this.root=new Group();this.root.name='V66 pressure hull walkable interior';sub.add(this.root);this.root.visible=false;this.avatars=new Map();this.p={x:0,z:7.8};this.yaw=0;this.pitch=0;this.station=null;this.active=false;this.pressure=newPressure();
  const groups=new Map();const part=(color,geometry,x,y,z,rx=0,ry=0,rz=0,glow=false)=>{const key=color+':'+glow;if(!groups.has(key))groups.set(key,{color,glow,kit:new GeoKit()});groups.get(key).kit.add('part',geometry,{color,matrix:mat4(x,y,z,rx,ry,rz)});};
  const steel=0x314b52,trim=0x73818a,dark=0x172c34,brass=0xa6884d,light=0x83e2e9;
  part(steel,box(6.8,.28,26.2),0,CABIN.floor-.14,0);for(const side of [-1,1]){part(dark,box(2.64,.24,26.2),side*2.08,CABIN.ceiling+.12,0);part(dark,box(1.52,.24,12.34),0,CABIN.ceiling+.12,side*6.93);}
  // Actual openings into the shared world, not painted images. Invisible hull
  // collision in cabinMove retains the pressure boundary at every viewport.
  const windowY=.35,windowH=1.55,lo=windowY-windowH/2,hi=windowY+windowH/2;
  for(const side of [-1,1]){const x=side*3.36;
   part(steel,box(.22,lo+2.05,26.2),x,(lo-2.05)/2,0);part(steel,box(.22,2.45-hi,26.2),x,(hi+2.45)/2,0);
   const windows=[-9.5,-6.5,-1.4,1.5,6.5,9.5],w=1.7;let start=-13.1;
   for(const z of windows){const end=z-w/2;if(end>start)part(steel,box(.22,windowH,end-start),x,windowY,(start+end)/2);start=z+w/2;
    for(const y of [lo,hi])part(brass,box(.30,.12,w+.18),x,y,z);
    for(const dz of [-w/2,w/2])part(trim,box(.30,windowH,.12),x,windowY,z+dz);
   }if(start<13.1)part(steel,box(.22,windowH,13.1-start),x,windowY,(start+13.1)/2);
   part(brass,box(.09,.12,25.5),side*3.20,-.65,0);part(trim,box(.08,.15,25.5),side*3.2,1.65,0);
  }
  part(steel,box(6.8,4.5,.28),0,.2,-13);
  // Panoramic forward bridge glazing with three mullions.
  part(steel,box(6.8,lo+2.05,.28),0,(lo-2.05)/2,13);part(steel,box(6.8,2.45-hi,.28),0,(hi+2.45)/2,13);
  for(const x of [-3.25,-1.08,1.08,3.25])part(trim,box(.22,windowH,.28),x,windowY,13);
  for(const y of [lo,hi])part(brass,box(6.8,.13,.32),0,y,13);

  for(const z of CABIN.bulkheads){for(const side of [-1,1])part(trim,box(2.18,4.2,.20),side*2.25,.2,z);part(trim,box(2.3,.7,.24),0,1.95,z);}
  for(let z=-11.5;z<13;z+=2.8){for(const side of [-1,1]){part(dark,box(.12,4.15,.15),side*3.18,.2,z);part(light,box(.12,.12,.88),side*2.95,2.1,z,0,0,0,true);}part(trim,box(6.45,.055,.07),0,CABIN.floor+.03,z);}
  for(const [id,s] of Object.entries(ABYSS_STATIONS)){const side=Math.sign(s.x),cz=s.z+(side?0:id==='helm'?1.35:-1.35),cx=s.x+side*.8;
   part(dark,box(side?.7:2.5,.92,side?2.3:.65),cx,-1.37,cz);part(trim,box(side?.82:2.55,.14,side?2.4:.75),cx,-.84,cz);
   for(let i=-1;i<=1;i++)part(id==='engine'?0xf4b455:light,box(side?.08:.56,.33,side?.52:.08),cx+(side?-side*.4:i*.65),-.46,cz+(side?i*.65:id==='helm'?-.35:.35),0,0,0,true);
   part(brass,box(.14,.055,1.2),s.x,CABIN.floor+.035,s.z);
  }
  for(const side of [-1,1]){for(const z of [-11.5,-4.8,4.8,11.5]){part(dark,box(.28,.32,.36),side*3.05,-.8,z);part(light,sphere(.09,8,6),side*2.83,-.78,z,0,0,0,true);}}
  for(const {color,glow,kit} of groups.values()){const m=new Material({color,roughness:.56,metalness:.28,emissive:new Color(color).multiplyScalar(glow?.85:.18),underwaterLighting:'none',receiveShadows:false,lit:!glow});const mesh=new Mesh(kit.merged('part'),m);mesh.userData.dryInterior=true;this.root.add(mesh);}
  this.dynamic=new Group();this.dynamic.name="V80 dynamic pressure systems";this.root.add(this.dynamic);
  this.doorMeshes=CABIN.bulkheads.map(z=>{const group=new Group();group.position.z=z;const m=new Material({color:0x52676b,metalness:.65,roughness:.38,underwaterLighting:'none'});const door=new Mesh(box(2.3,3.5,.22),m);door.position.y=-.15;group.add(door);const bar=new Mesh(box(.92,.12,.28),new Material({color:0xc0a26a,underwaterLighting:'none'}));bar.position.y=-.15;group.add(bar);group.visible=false;this.dynamic.add(group);return group;});
  this.waterMeshes=[[-8.4,8.8],[0,7.8],[8.4,8.8]].map(([z,d])=>{const mesh=new Mesh(box(6.45,1,d),new Material({color:0x186579,opacity:.38,transparent:true,depthWrite:false,underwaterLighting:'none',side:'double',roughness:.2}));mesh.position.z=z;mesh.userData.dryInterior=true;mesh.visible=false;this.dynamic.add(mesh);return mesh;});
 }
 setPressure(p){this.pressure=p;for(let i=0;i<2;i++)this.doorMeshes[i].visible=p.doors[i];for(let i=0;i<3;i++){const h=p.sections[i].water*3.4,m=this.waterMeshes[i];m.visible=h>.015;m.scale.y=Math.max(.001,h);m.position.y=CABIN.floor+h/2;}}
 reset(){this.p={x:0,z:7.8};this.yaw=0;this.pitch=0;this.station=null;this.active=false;this.root.visible=false;this.syncPeers({},null);this.setPressure(newPressure());}
 near(){return Object.keys(ABYSS_STATIONS).find(id=>nearStation(this.p,id))||null;}
 step(input,look,dt,{sensitivity=1,invertX=false,invertY=false}={}){const dx=look.x*sensitivity*(invertX?-1:1),dy=look.y*sensitivity*(invertY?-1:1);this.yaw=Math.atan2(Math.sin(this.yaw-dx*.0025),Math.cos(this.yaw-dx*.0025));if(this.station==='helm')this.yaw=Math.max(-1.25,Math.min(1.25,this.yaw));this.pitch=Math.max(-1.1,Math.min(1.1,this.pitch+dy*.0023));if(!this.station){const d=cabinInput({up:input.down('KeyW'),down:input.down('KeyS'),left:input.down('KeyA'),right:input.down('KeyD')},this.yaw,dt);this.p=cabinMove(this.p,d.dx,d.dz,this.pressure.doors);}}
 pose(sub){const origin=V(this.p.x,CABIN.floor+1.65,this.p.z);const target=origin.clone().add(V(Math.sin(this.yaw)*Math.cos(this.pitch),-Math.sin(this.pitch),Math.cos(this.yaw)*Math.cos(this.pitch)));return {position:sub.localToWorld(origin),target:sub.localToWorld(target)};}
 syncPeers(members,self){for(const id of this.avatars.keys())if(!members[id]||id===self){this.root.remove(this.avatars.get(id));this.avatars.get(id).body?.dispose();this.avatars.get(id).fallback?.traverse(o=>{if(o.isMesh)o.geometry.dispose?.();});this.avatars.delete(id);}for(const [id,p] of Object.entries(members)){if(id===self)continue;let a=this.avatars.get(id);if(!a){a=new Group();const m=new Material({color:0xba9364,emissive:0x302518,underwaterLighting:'none'});const body=new Mesh(box(.54,.84,.34),m),head=new Mesh(sphere(.22,10,8),m),legs=new Mesh(box(.43,.63,.27),m);body.position.y=1.02;head.position.y=1.65;legs.position.y=.34;const fallback=new Group();fallback.add(body,head,legs);a.add(fallback);a.fallback=fallback;a.body=new SailorBody(a,{slot:'captain',style:this.avatars.size+1});a.position.set(p.x,CABIN.floor,p.z);a.rotation.y=p.yaw||0;this.root.add(a);this.avatars.set(id,a);}a.target={x:p.x,z:p.z,yaw:p.yaw||0,station:p.station};}}
 stepPeers(dt){dt=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0));if(!dt)return;for(const a of this.avatars.values()){const p=a.target;if(!p)continue;const before=a.position.clone(),t=1-Math.exp(-dt*12);const target=cabinMove(a.position,(p.x-a.position.x)*t,(p.z-a.position.z)*t,this.pressure.doors);a.position.set(target.x,CABIN.floor,target.z);if(CABIN.bulkheads.some((z,i)=>this.pressure.doors[i]&&(a.position.z-z)*(p.z-z)<0))a.position.set(p.x,CABIN.floor,p.z);const speed=a.position.distanceTo(before)/dt;let yaw=p.yaw;if(p.station&&ABYSS_STATIONS[p.station]){const s=ABYSS_STATIONS[p.station];const dx=s.x+(Math.sign(s.x)*.8)-a.position.x,dz=s.z+(s.x?0:p.station==='helm'?1.35:-1.35)-a.position.z;if(Math.hypot(dx,dz)>.05)yaw=Math.atan2(dx,dz);}a.rotation.y+=Math.atan2(Math.sin(yaw-a.rotation.y),Math.cos(yaw-a.rotation.y))*t;a.fallback.visible=!a.body.ready;a.body.update(dt,{visible:this.active,activity:p.station?'cannon_aim':speed>.18?'walk':'idle',gear:'hands',feet:a.getWorldPosition(new Vector3()),yaw:a.rotation.y});}}

}
