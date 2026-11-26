import {Group,Mesh,Vector3,BufferGeometry,Float32BufferAttribute} from '../engine/index.js';
import {Material} from '../engine/render/Material.js';
import {GeoKit,sphere,rod,torus,mat4} from '../world/boat/GeoKit.js';
// The nest is on the dry west ledge, separated from the lift, mine bench,
// reservoir and central return route. The creature is a rooted cave ambusher.
export const LURKER=Object.freeze({x:337.2,z:-615.7,hp:380,radius:1.29,height:1.6,reward:220,receipt:'land:v83:lurker',prerequisite:'land:v81:gallery-inspection'});
const PATTERNS=Object.freeze({claw:{windup:1.05,recovery:1.8,range:3.15,arc:.85,damage:23},pulse:{windup:1.6,recovery:2.2,range:4.2,arc:Math.PI,damage:28},lunge:{windup:.82,recovery:1.65,range:3.7,arc:.42,damage:34}});
export const lurkerEnabled=(wallet,online,pending)=>!online&&!!wallet?.rewardReceipts?.includes(LURKER.prerequisite)&&!wallet.rewardReceipts.includes(LURKER.receipt)&&!pending?.has(LURKER.receipt);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function advanceLurker(e,p,dt,{active=true}={}){dt=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0));const dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);e.vx=e.vz=0;const idle={strike:false,moving:false,distance:d};if(e.dead)return idle;
 if(!active||!Number.isFinite(d)||d>9){e.state='idle';e.timer=0;e.cooldown=.6;return idle;}
 e.cooldown=Math.max(0,(e.cooldown||0)-dt);if(e.state==='telegraph'){e.timer-=dt;if(e.timer>1e-8)return idle;const cfg=PATTERNS[e.attackStyle]||PATTERNS.claw;e.state='recover';e.timer=cfg.recovery;e.attackSerial++;return {...idle,strike:true,style:e.attackStyle,damage:cfg.damage,range:cfg.range};}
 if(['recover','stagger'].includes(e.state)){e.timer-=dt;if(e.timer<=0){e.state='idle';e.cooldown=.32;}return idle;}
 e.yaw+=Math.max(-dt*2.8,Math.min(dt*2.8,wrap(angle-e.yaw)));const phase=e.hp<e.maxHp*.5;const order=phase?['lunge','pulse','claw']:['claw','pulse'];const style=order[e.attackSerial%order.length],cfg=PATTERNS[style];
 if(d<=cfg.range+.7&&e.cooldown<=0&&Math.abs(wrap(angle-e.yaw))<.2){e.attackStyle=style;e.state='telegraph';e.timer=cfg.windup;e.windupTotal=cfg.windup;e.attackYaw=e.yaw;}
 return idle;}
export function lurkerFacing(e,p){const cfg=PATTERNS[e.attackStyle]||PATTERNS.claw;return Math.abs(wrap(Math.atan2(p.x-e.x,p.z-e.z)-e.attackYaw))<=cfg.arc+.06;}
export function lurkerRange(style){return (PATTERNS[style]||PATTERNS.claw).range;}
const V=(x,y,z)=>new Vector3(x,y,z);
const material=new Material({vertexColors:true,roughness:.83,metalness:.15,underwaterLighting:'none'});
const glow=new Material({color:0x68e8cc,emissive:0x37ab8f,lit:false,underwaterLighting:'none'});
export function createLurkerModel(){const group=new Group(),body=new Group(),claw=new Group(),limbs=[];group.name='V83 Lurker cave ambusher';group.add(body);body.add(claw);
 const mesh=(parent,parts,m=material)=>{const k=new GeoKit();for(const [g,c,x,y,z,sx=1,sy=sx,sz=sx] of parts)k.add('a',g,{color:c,matrix:mat4(x,y,z,0,0,0,sx,sy,sz)});const o=new Mesh(k.merged('a'),m);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const shell=0x394a4b,bone=0x8c9f85,black=0x17252b,green=0x507a6e;
 mesh(body,[[sphere(1,20,12),shell,0,.88,-.12,.88,.70,1.05],[sphere(1,15,10),black,0,.68,.65,.57,.42,.43],...Array.from({length:7},(_,i)=>[sphere(1,10,7),i%2?green:bone,0,1.4-i*.025,-.94+i*.23,.37,.16,.14])]);
 for(const side of [-1,1]){mesh(body,[[sphere(.105,10,8),0x68e8cc,side*.26,1,.94]],glow);for(let i=0;i<3;i++){const leg=new Group();leg.position.set(side*.52,.73,-.7+i*.55);body.add(leg);const joint=V(side*.53,.05,.07),foot=V(side*.76,-.72,.26);mesh(leg,[[rod(V(0,0,0),joint,.12,9),shell,0,0,0],[rod(joint,foot,.105,8),bone,0,0,0],[sphere(.14,8,6),black,foot.x,foot.y,foot.z]]);limbs.push(leg);}
  const arm=new Group();arm.position.set(side*.51,.65,.55);claw.add(arm);mesh(arm,[[rod(V(0,0,0),V(side*.40,.03,.48),.17,10),shell,0,0,0],[sphere(1,12,8),bone,side*.43,.03,.63,.31,.26,.48],[rod(V(side*.39,.11,.8),V(side*.27,.10,1.15),.09,8),black,0,0,0],[rod(V(side*.54,-.08,.8),V(side*.39,-.05,1.15),.09,8),black,0,0,0]]);}
 // Range indicators are separately drawn in world-space; the mesh is scaled to
 // precisely match the attack radius. Directional attacks use a forward arc.
 const ring=new Group();ring.position.y=.055;group.add(ring);const indicators={};for(const [id,cfg] of Object.entries(PATTERNS)){const g=new BufferGeometry(),vertices=[],indices=[];const n=64,lo=-cfg.arc,hi=cfg.arc;for(let i=0;i<=n;i++){const a=lo+(hi-lo)*i/n;for(const r of [.965,1])vertices.push(Math.sin(a)*r,0,Math.cos(a)*r);if(i<n){const b=i*2;indices.push(b,b+1,b+2,b+1,b+3,b+2);}}g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const warning=new Mesh(g,new Material({color:0xf5aa62,emissive:0x9f3b1b,lit:false,side:'double',underwaterLighting:'none'}));warning.visible=false;ring.add(warning);indicators[id]=warning;}ring.visible=false;group.visible=false;return {group,body,claw,limbs,ring,indicators};}
export function poseLurker(e,t){const m=e.model,charging=e.state==='telegraph',recover=e.state==='recover';m.body.position.y=.018*Math.sin(t*3);m.body.rotation.x=charging?-.10:recover?.08:0;m.claw.rotation.x=charging?-.72:recover?.28:0;m.claw.scale.z=charging?1:recover&&e.attackStyle==='lunge'?1.12:1;for(const [i,leg] of m.limbs.entries())leg.rotation.x=.025*Math.sin(t*3+i);m.ring.visible=charging;for(const [id,o] of Object.entries(m.indicators))o.visible=id===e.attackStyle;const r=lurkerRange(e.attackStyle);m.ring.scale.set(r,r,r);}
