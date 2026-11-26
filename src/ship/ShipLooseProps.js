// Reusable local-world supply entities. Picking up moves an existing ID into
// a player's hand; dropping creates one tangible, ship-attached deck object.
import {Group,Mesh,Vector3} from '../engine/index.js';
import {prepare,mergePrepared,box,cylinder,sphere,torus,mat4} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
const prep=(g,color,x,y,z)=>prepare(g,{color,rough:.84,matrix:mat4(x,y,z)});
function make(kind){
 const m=[];
 if(kind==='cannonball'||kind==='chainshot'){
  m.push(prep(sphere(.165,12,8),0x283138,0,.17,0));
  if(kind==='chainshot')m.push(prep(box(.26,.036,.04),0xaeb6b6,0,.21,0));
 }else if(kind==='plank'){
  m.push(prep(box(.78,.09,.17),0x936d4d,0,.065,0),prep(box(.065,.10,.18),0x483c30,-.30,.07,0));
 }else if(kind==='bucket'){
  m.push(prep(cylinder(.23,.18,.33,12),0x77604a,0,.18,0),prep(torus(.23,.025,8,20),0xd1b47e,0,.39,0));
 }
 const root=new Group(),mesh=new Mesh(mergePrepared(m),landMaterial);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);root.name='STORMWAKE tangible '+kind;return root;
}
export class ShipLooseProps{
 constructor(scene,boat){this.scene=scene;this.boat=boat;this.byId=new Map();this.next=1;}
 add(kind,local,canonicalId=null){if(!['cannonball','chainshot','plank','bucket'].includes(kind))return null;
  const id=canonicalId||'loose_'+this.next++;if(this.byId.has(id))return this.byId.get(id);const group=make(kind);
  const entity={id,kind,local:{x:local.x,y:local.y,z:local.z},group};this.byId.set(id,entity);this.scene.add(group);this.update();return entity;
 }
 take(id){const item=this.byId.get(id);if(!item)return null;this.byId.delete(id);this.scene.remove(item.group);return item;}
 sync(items){const ids=new Set(items.map(i=>i.id));for(const id of this.byId.keys())if(!ids.has(id))this.take(id);for(const item of items){const entity=this.add(item.kind,item.local,item.id);if(entity)entity.local={...item.local};}this.update();}
 update(){for(const v of this.byId.values()){this.boat.toWorld(new Vector3(v.local.x,v.local.y,v.local.z),v.group.position);v.group.quaternion.copy(this.boat.quaternion);} }
 clear(){for(const id of [...this.byId.keys()])this.take(id);}
}
