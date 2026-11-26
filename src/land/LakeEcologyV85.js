import {Group,Mesh} from '../engine/index.js';
import {Material} from '../engine/render/Material.js';
import {fishGeometry} from '../world/fish/FishGeometry.js';
import {SPECIES} from '../world/fish/FishSpecies.js';
import {DEEP_LAKE} from './UndergroundHallV84.js';
export class LakeEcologyV85{
 constructor(root,terrain){this.t=terrain;this.root=new Group();this.root.name='V85 crystal lake shoals';root.add(this.root);const models=[fishGeometry(SPECIES.silverside,{lod:1,pose:'swim'}),fishGeometry(SPECIES.grunt,{lod:1,pose:'swim'})],mats=[new Material({color:0xb4c9bb,roughness:.37,metalness:.18,side:'double'}),new Material({color:0x538b83,roughness:.48,metalness:.12,side:'double'})];this.fish=Array.from({length:16},(_,i)=>{const g=new Mesh(models[i<12?0:1],mats[i<12?0:1]);g.scale.setScalar(i<12?.32+.04*(i%4):.66+.06*(i%4));this.root.add(g);return g;});this.update(0,{x:DEEP_LAKE.x,z:DEEP_LAKE.z},1);}
 update(t,eye,stock=1){this.root.visible=Math.hypot(eye.x-DEEP_LAKE.x,eye.z-DEEP_LAKE.z)<90;if(!this.root.visible)return;for(let i=0;i<this.fish.length;i++){const f=this.fish[i],a=t*(i<12?.38:.24)+i*2.39996,rx=4.2+(i%3)*.4,rz=5.7+(i%4)*.25,x=DEEP_LAKE.x+Math.cos(a)*rx,z=DEEP_LAKE.z+Math.sin(a)*rz,h=this.t.heightAt(x,z);f.visible=i<Math.ceil(16*Math.max(0,Math.min(1,stock)))&&h<DEEP_LAKE.surface-.85;f.position.set(x,Math.max(h+.42,DEEP_LAKE.surface-1.1-(i%4)*.40+.15*Math.sin(a*2)),z);f.rotation.set(.025*Math.sin(a*2),Math.atan2(-Math.sin(a)*rx,Math.cos(a)*rz)+.06*Math.sin(t*6+i),.035*Math.sin(t*3+i));}}
}
