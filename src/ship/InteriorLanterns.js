import {Group,Mesh} from '../engine/index.js';
import {box,cylinder,rod,prepare,mergePrepared,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
import {Material} from '../engine/render/Material.js';
import {Vector3} from '../engine/index.js';
export const INTERIOR_LAMPS=Object.freeze([
  {p:[-.65,.35,-8.5],color:[1,.69,.4],intensity:3.2,range:4.0},
  {p:[.65,.48,-8.1],color:[1,.72,.43],intensity:3.0,range:4.0},
  {p:[1.32,.38,-3.8],color:[1,.67,.35],intensity:4.0,range:5.0},
  {p:[-1.32,.38,2.6],color:[1,.69,.35],intensity:4.0,range:5.0}
].map(l=>Object.freeze({...l,alwaysOn:true,kind:'boatInterior'})));
export function installInteriorLanterns(boat){
  const root=new Group(),s=boat.shipScale;root.scale.set(1/s.x,1/s.y,1/s.z);
  root.name='V61 interior brass lanterns at authoritative light sockets';
  const parts=[],cores=[];
  for(const {p:[x,y,z]} of INTERIOR_LAMPS){
    const ceiling=boat.collisionWorld?.ceilingAt(x,z,y+.16);
    if(ceiling!==null&&ceiling!==undefined){
      parts.push(prepare(rod(new Vector3(x,y+.14,z),new Vector3(x,ceiling,z),.012,6),{color:0x463a2c,metal:.65,rough:.5}));
      parts.push(prepare(box(.11,.025,.11),{color:0x463a2c,metal:.6,rough:.5,matrix:mat4(x,ceiling-.005,z)}));
    }
    for(const h of [-.12,.12])parts.push(prepare(box(.18,.035,.18),{color:0x735536,metal:.65,rough:.48,matrix:mat4(x,y+h,z)}));
    for(const dx of [-.075,.075])for(const dz of [-.075,.075])parts.push(prepare(rod(new Vector3(x+dx,y-.12,z+dz),new Vector3(x+dx,y+.12,z+dz),.012,6),{color:0x5c4530,metal:.6,rough:.48}));
    cores.push(prepare(cylinder(.006,.026,.10,8),{color:0xffb75b,matrix:mat4(x,y,z)}));
  }
  const material=landMaterial.clone();material.underwaterLighting='none';
  const fixtures=new Mesh(mergePrepared(parts),material);fixtures.castShadow=true;root.add(fixtures);
  root.add(new Mesh(mergePrepared(cores),new Material({name:'V61 lantern flame',lit:false,vertexColors:true,surface:'s.albedo=in.color.rgb;s.emissive=in.color.rgb*.8;'})));
  boat.group.add(root);return root;
}
