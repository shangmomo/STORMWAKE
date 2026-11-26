import {Group,Mesh} from '../engine/index.js';
import {sphere,prepare} from './boat/GeoKit.js';
import {Material} from '../engine/render/Material.js';

// Individually moving volume puffs remain three dimensional from every view.
export class DistressSmoke extends Group{
 constructor(){super();this.name='Merchant distress smoke';this.puffs=Array.from({length:22},(_,i)=>{const material=new Material({color:0x514a40,transparent:true,opacity:.18,depthWrite:false,roughness:1});const mesh=new Mesh(prepare(sphere(1,8,6)),material);mesh.castShadow=false;this.add(mesh);return mesh;});}
 update(clock){for(let i=0;i<this.puffs.length;i++){const age=(clock*.07+i/this.puffs.length)%1,spread=.4+age*4;const puff=this.puffs[i];puff.position.set(age*7+Math.sin(i*9.7+clock*.2)*age,2+age*27,Math.cos(i*3.2+clock*.15)*age*1.5);puff.scale.set(spread,spread*1.3,spread);puff.rotation.y=clock*.08+i;puff.material.opacity=.32*Math.sin(age*Math.PI);}}
}
