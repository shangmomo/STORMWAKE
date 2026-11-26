import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Group,Mesh,BufferGeometry,BufferAttribute,Matrix4,Vector3,Quaternion,PerspectiveCamera} from '../src/engine/index.js';
import {parseGLB} from '../src/engine/loaders/GLTF.js';
import {installShipStairs} from '../src/ship/ShipStairs.js';
import {bakeShipCollision} from '../src/ship/ShipCollisionWorld.js';
import {measuredFloorAt} from '../src/ship/HeritageDeck.js';
import {DECK_FLIGHTS} from '../src/ship/ShipDeckRoutes.js';
import {Player} from '../src/player/Player.js';
const bytes=readFileSync(new URL('../public/models/stormwake_v63/dutch_ship_lower_hold.glb',import.meta.url));
const gltf=parseGLB(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const group=new Group(),art=new Group(),hull=new Group();art.scale.set(1.064,.75,1.064);art.position.set(0,-.4,-.7);group.add(art);art.add(hull);
for(const primitive of gltf.meshes[0]){
 const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(primitive.attributes.POSITION.array,3));g.setIndex(new BufferAttribute(primitive.indices,1));hull.add(new Mesh(g,{}));
}
const model={group,shipScale:{x:1,y:1,z:1},heritageDeck:{collisionBoxes:[]},heritageArt:{objects:new Map([['dutch_ship_medium_hull',hull]])},lines:{},helmPoint:new Vector3(.75,1.92,-7.95),exitPoints:[]};
installShipStairs(model);bakeShipCollision(model);
const control={model,position:new Vector3(),velocity:new Vector3(),quaternion:new Quaternion(),speed:0,getYaw:()=>0,toWorld:(local,out)=>out.copy(local)};
const input={enabled:true,keys:new Set(),down(k){return this.keys.has(k)},hit:()=>false,consume:()=>false,consumeLook:()=>({x:0,y:0})};
const player=new Player({camera:new PerspectiveCamera(),input,terrain:{heightAt:()=>-50},colliders:{groundHeightAt:()=>-Infinity,boxes:[]},query:{allocate:()=>0},boat:control});
player.mode='deck';player.voyageM1={};

for(const [x,z,maxY,minY] of [[1.03,-7.5,2.02,1.75],[1.03,3.9,1.98,1.65]])assert.notEqual(model.collisionWorld.floorAt(x,z,maxY,minY),null,'landing floor must remain physical after clearing headroom');
for(const dt of [1/60,1/30,1/20])for(const f of DECK_FLIGHTS.filter(f=>['aft','fore'].includes(f.id))){
 const dir=Math.sign(f.z1-f.z0);player.deckPos.set(f.x,f.y0,f.z0-dir*.25);player.deckVel.set(0,0,0);player.deckGrounded=true;player.deckYaw=dir>0?0:Math.PI;
 for(let cycle=0;cycle<20;cycle++)for(const reverse of [false,true]){
  const sign=dir*(reverse?-1:1),target=reverse?f.z0-dir*.25:f.z1+dir*.12;input.keys.add(reverse?'KeyS':'KeyW');
  let n=0;while((player.deckPos.z-target)*sign<0&&n++<600)player.updateDeck(dt);input.keys.clear();
  assert(n<600,`${f.id} cycle ${cycle} reverse ${reverse} blocked ${JSON.stringify(player.deckPos)} ${JSON.stringify(player.collisionContacts)}`);
  for(let i=0;i<5;i++)player.updateDeck(dt);
 }
 console.log(f.id,dt,'20 W/S round trips preserving actual momentum and lateral displacement PASS');
}
