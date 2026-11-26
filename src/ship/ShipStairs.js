import {Group,Mesh,Vector3} from '../engine/index.js';
import {box,rod,prepare,mergePrepared,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
import {DECK_FLIGHTS} from './ShipDeckRoutes.js';
export function installShipStairs(boat){
 const root=new Group(),s=boat.shipScale;root.name='V62 measured fore and aft oak stair flights';root.scale.set(1/s.x,1/s.y,1/s.z);
 const pieces=[];
 for(const f of DECK_FLIGHTS){
   const dz=(f.z1-f.z0)/f.steps,dy=(f.y1-f.y0)/f.steps;
   for(let i=0;i<f.steps;i++){
     const h=dy*(i+1),z=f.z0+dz*(i+.5);
     pieces.push(prepare(box(f.width,h,Math.abs(dz)+.004),{color:i%2?0x735238:0x8b6543,rough:.88,pattern:6,matrix:mat4(f.x,f.y0+h/2,z)}));
     // Brass nosing makes every physical tread legible from either direction.
     pieces.push(prepare(box(f.width,.015,.025),{color:0x9d8054,metal:.55,rough:.6,matrix:mat4(f.x,f.y0+h-.0075,f.z0+dz*i+Math.sign(dz)*.018)}));
   }
   for(const side of [-1,1]){
     const x=f.x+side*(f.width/2+.035),a=new Vector3(x,f.y0+.66,f.z0),b=new Vector3(x,f.y1+.66,f.z1);
     pieces.push(prepare(rod(a,b,.033,8),{color:0x654a33,rough:.85,pattern:1}));
     for(let i=0;i<=3;i++){const t=i/3,z=f.z0+(f.z1-f.z0)*t,y=f.y0+(f.y1-f.y0)*t;
       pieces.push(prepare(box(.05,.67,.05),{color:0x76553c,rough:.9,pattern:1,matrix:mat4(x,y+.335,z)}));}
   }
 }
 const mesh=new Mesh(mergePrepared(pieces),landMaterial);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);boat.group.add(root);boat.deckStairs=root;return root;
}
