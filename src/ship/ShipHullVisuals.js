// Hull-hole render cues are attached to the same boat local frame as physics.
// External charred rim and an inner dark wet patch represent the *same* hole ID.
import {Group,Mesh} from '../engine/index.js';
import {prepare,mergePrepared,torus,sphere,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
import {HOLD} from './ShipInterior.js';
const punctureGeo=()=>mergePrepared([
 prepare(torus(.27,.07,8,18),{color:0xd8ac76,rough:.8,matrix:mat4(0,0,0)}),
 prepare(sphere(.20,12,8),{color:0x101c22,rough:1,matrix:mat4(0,0,-.025)})
]);
export class ShipHullVisuals {
 constructor(boat,damage){this.boat=boat;this.damage=damage;this.root=new Group();this.root.name='V44 metric ship-local through-hull impact cues';
  // The hull parent is scaled for the 23m preview. Damage coordinates are already physical
  // metres, so cancel that visual scale to avoid placing holes two ship-lengths away.
  const s=boat.shipScale||{x:1,y:1,z:1};this.root.scale.set(1/s.x,1/s.y,1/s.z);
  boat.group.add(this.root);this.meshes=new Map();}
 update(){const ids=new Set();for(const h of this.damage.holes){ids.add(h.id);let group=this.meshes.get(h.id);
   if(!group){
    group=new Group();group.name='Hull hole '+h.id;
    const outer=new Mesh(punctureGeo(),landMaterial);outer.name='Charred exterior rim';group.add(outer);
    const inner=new Mesh(punctureGeo(),landMaterial);inner.name='Visible interior repair target';group.add(inner);
    group.userData={outer,inner};this.root.add(group);this.meshes.set(h.id,group);
   }
   const sign=h.local.x>=0?1:-1;
   group.visible=h.state==='open';group.position.set(h.local.x,h.local.y,h.local.z);
   group.scale.setScalar(Math.max(.5,h.radius/.15));
   const inner=group.userData.inner,outer=group.userData.outer;
   const scale=group.scale.x;
   outer.rotation.y=sign*Math.PI/2;
   // Offset into the walkable inner side so the solid original hull does not
   // hide the repair cue behind its (uncut) watertight visual envelope.
   inner.position.x=(sign*(HOLD.halfW*(this.boat.shipScale?.x||1)-.055)-h.local.x)/scale;
   inner.rotation.y=-sign*Math.PI/2;
  }
  for(const [id,mesh] of this.meshes)if(!ids.has(id)){
   this.root.remove(mesh);
   for(const child of mesh.children)child.geometry?.dispose?.();
   this.meshes.delete(id);
  }
 }
}
