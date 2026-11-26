// STORMWAKE V56 — lightweight open-ocean life.
// Pool is attached to the *actual sea around the boat*, not to a fixed island
// waypoint. Outside the deep-water threshold all meshes are hidden. No network
// or physics authority is changed by visual wildlife.
import { Group, Mesh, Vector3 } from '../../engine/index.js';
import { box, sphere, rod, prepare, mergePrepared, mat4 } from '../boat/GeoKit.js';
import { landMaterial } from '../../land/LandModels.js';
import { WORLD } from '../WorldLayout.js';

const TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const OFFSHORE_THRESHOLD=150;
export function eligibleOffshore(x,z,heightAt){
  return Math.hypot(x-WORLD.boatDock.position.x,z-WORLD.boatDock.position.z)>=OFFSHORE_THRESHOLD &&
    (typeof heightAt!=='function'||heightAt(x,z)<-4);
}
function fishGeometry(isDolphin=false,color=0x688c9b){
  const l=isDolphin?1.7:.66,h=isDolphin?.28:.17,w=isDolphin?.33:.17;
  const parts=[prepare(sphere(1,13,9),{color,rough:.63,matrix:mat4(0,0,0,0,0,0,w,h,l)}),
    prepare(sphere(1,9,7),{color:isDolphin?0xd7d5c6:0xbdc4ad,rough:.74,matrix:mat4(0,-h*.55,l*.15,0,0,0,w*.83,h*.55,l*.68)}),
    prepare(box(w*.23,h*1.8,l*.23),{color:0x516879,matrix:mat4(0,0,-l*1.02,0,0,0)}),
    prepare(rod(new Vector3(0,h*.70,-.14),new Vector3(0,h*1.90,-l*.26),.028,6),{color:0x374d62,rough:.72})];
  for(const side of [-1,1])parts.push(prepare(rod(new Vector3(side*w*.75,-.03,0),
    new Vector3(side*w*2.0,-.16,-l*.4),.025,6),{color:0x476c78,rough:.71}));
  return mergePrepared(parts);
}
export class OffshoreLife {
  constructor({scene,boat,terrain}){
    this.scene=scene;this.boat=boat;this.terrain=terrain;this.time=0;this.active=false;
    this.root=new Group();this.root.name='V56 dynamically spawned open-sea fish and breaching dolphins';
    scene.add(this.root);
    this.critters=[];
    const fishColors=[0x6f95a4,0x96a8a7,0xc5aa79,0x79959b];
    for(let i=0;i<16;i++){
      const dolphin=i<3,mesh=new Mesh(fishGeometry(dolphin,fishColors[i%fishColors.length]),landMaterial);
      mesh.name=dolphin?'ocean dolphin '+i:'ocean pelagic fish '+i;
      this.root.add(mesh);
      this.critters.push({mesh,i,dolphin,phase:i*2.3999632297,radius:dolphin?28+i*12:24+i*3.8,
        angularSpeed:(i%2?1:-1)*(dolphin?.13:.19),liftPeriod:3.4+i*.52});
    }
    this.root.visible=false;
  }
  update(dt){
    this.time+=Math.min(.1,Math.max(0,dt));
    const boat=this.boat?.position;
    if(!boat)return;
    const heightAt=this.terrain?.heightAt?.bind(this.terrain);
    const ocean=eligibleOffshore(boat.x,boat.z,heightAt);
    this.active=ocean;this.root.visible=ocean;
    if(!ocean)return;
    for(const item of this.critters){
      const {mesh,i,phase,radius,dolphin}=item;
      const angle=this.time*item.angularSpeed+phase;
      let x=boat.x+Math.cos(angle)*radius,z=boat.z+Math.sin(angle)*radius;
      // Keep individual sea life out of beaches/islands and shoreline whitewater.
      if(heightAt && heightAt(x,z)>-3){mesh.visible=false;continue;}
      mesh.visible=true;
      const period=this.time/item.liftPeriod+phase;
      const fraction=period-Math.floor(period);
      // Fish shoals remain just below the surface, but individual tuna and
      // dolphins breach at deterministic intervals and can be seen from deck.
      const leaper=dolphin||i%4===0;
      const jump=leaper&&fraction<.35?Math.sin(Math.PI*fraction/.35)*(dolphin?2.8:1.2):0;
      const cruise=dolphin?-.75:-.40-(i%3)*.22;
      mesh.position.set(x,cruise+jump+.08*Math.sin(this.time*3+phase),z);
      mesh.rotation.y=-angle+(item.angularSpeed>0?0:Math.PI);
      mesh.rotation.x=jump>0?-.2*Math.cos(fraction*TAU):.03*Math.sin(this.time*4+phase);
      mesh.rotation.z=.12*Math.sin(this.time*(dolphin?3:7)+phase);
    }
  }
}
