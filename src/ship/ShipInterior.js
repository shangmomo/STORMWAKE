// V43 hold and working hatch. The source hull is only 8.2 metres; the
// under-deck interior is deliberately a *crouching* hold, not a galleon cabin.
// The sole rises toward the bow where the real keel becomes shallower.
import {Group,Mesh} from '../engine/index.js';
import {box,prepare,mergePrepared,mat4} from '../world/boat/GeoKit.js';
import {keelBottomAt} from '../world/boat/HullBuilder.js';
import {landMaterial} from '../land/LandModels.js';
import {Material} from '../engine/render/Material.js';
import {LAYERS} from '../core/SceneRenderer.js';
export const HOLD={x:0,z:-1.4,floorY:-.48,deckY:.35,halfW:.77,z0:-3.05,z1:2.85};
const plank=(w,h,d,x,y,z,color=0x785337)=>prepare(box(w,h,d),{color,rough:.88,matrix:mat4(x,y,z)});
export class ShipInterior {
 constructor(boat){this.boat=boat;this.scale=boat.shipScale||{x:1,y:1,z:1};this.layout={x:0,z:HOLD.z*this.scale.z,floorY:HOLD.floorY*this.scale.y,deckY:HOLD.deckY*this.scale.y,halfW:HOLD.halfW*this.scale.x,z0:HOLD.z0*this.scale.z,z1:HOLD.z1*this.scale.z};this.hatchOpen=false;this.root=new Group();this.root.name=boat.shipScale?'V44 heritage standing hold preview':'V43 ship-attached crouching hold';
  const parts=[];
  for(let z=HOLD.z0+.09;z<HOLD.z1-.02;z+=.174){
   const y=this.baseFloorAt(z)-.04;
   parts.push(plank(1.54,.045,.173,0,y,z,(Math.round(z*100)%3===0)?0x4d362c:0x785337));
  }
  for(const side of [-1,1]){
   for(let z=HOLD.z0+.17;z<HOLD.z1;z+=.38){
    const y=this.baseFloorAt(z),height=Math.max(.20,HOLD.deckY-y-.1);
    parts.push(plank(.08,height,.095,side*.77,y+height/2,z,0x50392b));
   }
   for(let z=HOLD.z0+.36;z<HOLD.z1-.2;z+=1.18){
    const span=Math.min(1.18,HOLD.z1-z),y=this.baseFloorAt(z)+.14;
    parts.push(plank(.10,.11,span,side*.80,y,z+span*.5,0x987048));
   }
  }
  // V45: continuous solid lining + roof. The P2 hold had scattered ribs
  // but no continuous wall/ceiling, creating unrestricted views through hull.
  const segment=.24;
  for(let z=HOLD.z0+segment/2;z<HOLD.z1;z+=segment){
    const floor=this.baseFloorAt(z),wallH=Math.max(.20,HOLD.deckY-floor-.075);
    for(const side of [-1,1]){
      parts.push(plank(.085,wallH,segment+.012,side*.785,floor+wallH/2,z,0x46342a));
      parts.push(plank(.027,.018,segment+.014,side*.728,floor+.14,z,0x946743));
    }
    const hatchZ=z>HOLD.z-.61&&z<HOLD.z+.61;
    const roofY=HOLD.deckY-.076;
    if(hatchZ){
      for(const side of [-1,1])parts.push(plank(.21,.049,segment+.012,side*.675,roofY,z,0x78583b));
    }else parts.push(plank(1.52,.048,segment+.012,0,roofY,z,0x63452e));
  }
  for(const z of [HOLD.z0,HOLD.z1]){
   const y=this.baseFloorAt(z),height=Math.max(.2,HOLD.deckY-y);
   parts.push(plank(1.6,height,.08,0,y+height/2,z,0x62452f));
  }
  // A real removable hatch cover and ladder occupy the same local aperture.
  for(let i=0;i<6;i++)parts.push(plank(.56,.045,.09,0,HOLD.floorY+i*.15,HOLD.z+.46,0x9c6f43));
  for(const x of [-.31,.31])parts.push(plank(.05,1.07,.065,x,-.02,HOLD.z+.46,0x634129));
  for(const x of [-.53,.53])parts.push(plank(.11,.11,1.03,x,HOLD.deckY+.045,HOLD.z,0xc09e69));
  for(const z of [-1.98,-.86])parts.push(plank(1.14,.10,.11,0,HOLD.deckY+.045,z,0xc09e69));
  // Equipment racks and cargo shelving do not block the crawl corridor.
  for(const side of [-1,1]){
   for(const z of [-2.58,.72,1.88]){
    const floor=this.baseFloorAt(z);
    parts.push(plank(.22,.10,.60,side*.63,floor+.20,z,0x4c3529));
    parts.push(plank(.22,.09,.60,side*.63,floor+.48,z,0x6d4b35));
   }
  }
  const hull=new Mesh(mergePrepared(parts),landMaterial);hull.castShadow=true;hull.receiveShadow=true;this.root.add(hull);
  this.coverMesh=new Mesh(mergePrepared([plank(1.17,.08,1.15,0,HOLD.deckY+.02,HOLD.z,0x503927),plank(1.26,.045,.12,0,HOLD.deckY+.10,HOLD.z,0xc09e69)]),landMaterial);
  this.coverMesh.name='Working removable deck hatch';this.root.add(this.coverMesh);
  // Physical water fill is one source of truth: ShipDamage.water [0..1].
  this.waterMesh=new Mesh(mergePrepared([plank(1.38,.012,HOLD.z1-HOLD.z0-.22,0,HOLD.floorY+.036,(HOLD.z0+HOLD.z1)/2,0x235f6d)]),new Material({
    name:'V45PhysicalBilgeFill',lit:false,transparent:true,side:'double',depthWrite:false,vertexColors:true,
    surface:`s.albedo=in.color.rgb*.45;s.emissive=in.color.rgb*.16;s.alpha=.58;`
  }));
  this.waterMesh.layers.set(LAYERS.TRANSPARENT);
  this.waterMesh.visible=false;this.root.add(this.waterMesh);
  boat.group.add(this.root);
 }
 baseFloorAt(z){return Math.max(HOLD.floorY,keelBottomAt(Math.max(-3.02,Math.min(3.65,z)))+.12);}
 floorAt(z){return this.baseFloorAt(z/this.scale.z)*this.scale.y;}
 setHatchOpen(open){this.hatchOpen=!!open;this.coverMesh.visible=!this.hatchOpen;}
 inHatch(p){return Math.abs(p.x)<.65*this.scale.x&&Math.abs(p.z-this.layout.z)<.70*this.scale.z;}
 inside(p){const h=this.layout;return p.x>=-h.halfW&&p.x<=h.halfW&&p.z>=h.z0+.12*this.scale.z&&p.z<=h.z1-.12*this.scale.z;}
 constrain(p){const h=this.layout;const r=.26;
    const maxX=Math.max(.15,h.halfW-.06*this.scale.x-r);
    p.x=Math.max(-maxX,Math.min(maxX,p.x));
    p.z=Math.max(h.z0+(.12*this.scale.z+r),Math.min(h.z1-(.12*this.scale.z+r),p.z));}
 update(water){this.waterMesh.visible=water>.015;this.waterMesh.position.y=Math.max(0,Math.min(.66,water))*.7;}
}
