import {readFileSync} from 'node:fs';
import {Group,Mesh,BufferGeometry,BufferAttribute,Vector3,Quaternion,PerspectiveCamera} from '../../src/engine/index.js';
import {parseGLB} from '../../src/engine/loaders/GLTF.js';
import {HeritageDeck} from '../../src/ship/HeritageDeck.js';
import {CaptainCabinInterior} from '../../src/ship/CaptainCabinInterior.js';
import {DutchLowerHold} from '../../src/ship/DutchLowerHold.js';
import {installMastLookout} from '../../src/ship/MastLookout.js';
import {installShipStairs} from '../../src/ship/ShipStairs.js';
import {bakeShipCollision} from '../../src/ship/ShipCollisionWorld.js';
import {Player} from '../../src/player/Player.js';
export async function geometryModel(path){
 const b=readFileSync(new URL('../../public'+path.replace('/models','/models'),import.meta.url)),gltf=parseGLB(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),root=new Group(),groups=new Map();
 const nodes=gltf.nodes.map(n=>{const g=new Group();g.name=n.name;g.position.fromArray(n.t);g.quaternion.fromArray(n.r);g.scale.fromArray(n.s);groups.set(g.name,g);
  if(n.mesh!==undefined)for(const p of gltf.meshes[n.mesh]){const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(p.attributes.POSITION.array,3));if(p.indices)geometry.setIndex(new BufferAttribute(p.indices,1));const mesh=new Mesh(geometry,{});mesh.name=n.name;g.add(mesh);}return g;});
 gltf.nodes.forEach((n,i)=>{for(const child of n.children)nodes[i].add(nodes[child]);});for(const i of gltf.roots)root.add(nodes[i]);return {root,groups};
}
export async function actualShip(){
 const loaded=await geometryModel('/models/stormwake_v64/dutch_ship_lower_hold.glb'),group=new Group(),art=new Group();art.scale.set(1.064,.75,1.064);art.position.set(0,-.4,-.7);art.add(loaded.root);group.add(art);
 const model={group,shipScale:{x:1,y:1,z:1},heritageArt:{objects:loaded.groups},lines:{},helmPoint:new Vector3(),helmEye:new Vector3(),boardPoint:new Vector3(),exitPoints:[]};model.heritageDeck=new HeritageDeck(model);model.mastLookout=installMastLookout(model);model.captainCabin=new CaptainCabinInterior(model);await model.captainCabin.load(geometryModel);model.lowerHold=new DutchLowerHold(model);installShipStairs(model);bakeShipCollision(model);model.originalDoor={open:true,passable:true};
 const boat={model,position:new Vector3(),velocity:new Vector3(),quaternion:new Quaternion(),speed:0,getYaw:()=>0,toWorld:(v,out)=>out.copy(v)};
 const input={enabled:true,keys:new Set(),down(k){return this.keys.has(k)},hit:()=>false,consume:()=>false,consumeLook:()=>({x:0,y:0})};
 const player=new Player({camera:new PerspectiveCamera(),input,terrain:{heightAt:()=>-50},colliders:{groundHeightAt:()=>-Infinity,boxes:[]},query:{allocate:()=>0},boat});player.mode='deck';player.voyageM1={};player.shipInterior=model.captainCabin;player.lowerHold=model.lowerHold;
 return {model,boat,input,player};
}
