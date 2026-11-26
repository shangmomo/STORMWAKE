import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Vector3} from '../src/engine/index.js';
import {BoatModel} from '../src/world/BoatModel.js';
import {DutchLowerHold,LOWER_HOLD} from '../src/ship/DutchLowerHold.js';
import {CaptainCabinInterior} from '../src/ship/CaptainCabinInterior.js';
import {beginShipClimb,beginCabinDoorEnter,beginCabinDoorExit,advanceShipClimb} from '../src/ship/ShipLadder.js';
import {LOWER_HATCH,measuredFloorAt,deckHeight} from '../src/ship/HeritageDeck.js';
import {isDryHoldCamera} from '../src/ship/DryHoldCamera.js';
import {ShipStorageSpace} from '../src/ship/ShipStorageSpace.js';
let count=0;const test=(name,fn)=>{fn();console.log('PASS V53 '+(++count)+' '+name);};
const text=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bytes=path=>fs.readFileSync(new URL('../'+path,import.meta.url));
const manifest=JSON.parse(text('public/models/stormwake_v53/hatch_manifest.json'));
const blob=bytes(manifest.file);
function glb(b){assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(8),b.length);const n=b.readUInt32LE(12);return {j:JSON.parse(b.subarray(20,20+n).toString()),raw:b.subarray(n+28)};}
function read(obj,i){const a=obj.j.accessors[i],b=obj.j.bufferViews[a.bufferView],l=({SCALAR:1,VEC2:2,VEC3:3})[a.type],n=({5125:4,5126:4,5123:2})[a.componentType],o=b.byteOffset+(a.byteOffset||0);const get=a.componentType===5126?(x)=>obj.raw.readFloatLE(x):a.componentType===5123?(x)=>obj.raw.readUInt16LE(x):(x)=>obj.raw.readUInt32LE(x);return Array.from({length:a.count},(_,q)=>Array.from({length:l},(_,k)=>get(o+(q*l+k)*n)));}
const ship=glb(blob),source=glb(bytes(manifest.source));
const hull=ship.j.meshes[0].primitives[0],src=source.j.meshes[0].primitives[0];
const vertices=read(ship,hull.attributes.POSITION),indices=read(ship,hull.indices).flat();
const boat=new BoatModel({shipClass:'heritage'});
const lower=new DutchLowerHold(boat),cabin=new CaptainCabinInterior(boat);
const person=(interior,layer='deck')=>({mode:'deck',stationId:null,deckPos:new Vector3(interior.layout.x,layer==='deck'?interior.layout.deckY:interior.layout.floorY,interior.layout.z),deckVel:new Vector3(),deckLayer:layer,shipClimb:null,deckGrounded:true});
const advance=(p,i)=>{for(let t=0;t<32;t++){if(!p.shipClimb)break;advanceShipClimb(p,.10,i);}assert.equal(p.shipClimb,null);};
test('source Dutch GLB mesh checksum, preserved original rigging/materials',()=>{
 assert.equal(crypto.createHash('sha256').update(blob).digest('hex'),manifest.sha256);
 assert.ok(manifest.hatch_faces_removed>=2&&manifest.new_split_vertices>0);
 assert.deepEqual(ship.j.meshes.slice(1),source.j.meshes.slice(1));
 assert.equal(ship.j.materials.length,source.j.materials.length);
 assert.equal(ship.j.textures.length,source.j.textures.length);
 assert.equal(ship.j.nodes.find(n=>n.name==='original_dutch_door_hinge')?.name,'original_dutch_door_hinge');
 assert.ok(read(ship,hull.indices).length>read(source,src.indices).length);
});
test('actual source-mesh top deck opening: ray samples have no source horizontal triangles',()=>{
 const inside=(x,z)=>{for(let i=0;i<indices.length;i+=3){const a=vertices[indices[i]],b=vertices[indices[i+1]],c=vertices[indices[i+2]];
  if(!(Math.min(a[1],b[1],c[1])>1.48&&Math.max(a[1],b[1],c[1])<2.01))continue;
  const cross=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);if(Math.abs(cross)<1e-6)continue;
  const s=((x-a[0])*(c[2]-a[2])-(z-a[2])*(c[0]-a[0]))/cross;
  const t=((b[0]-a[0])*(z-a[2])-(b[2]-a[2])*(x-a[0]))/cross;
  if(s>0.001&&t>0.001&&s+t<.999)return true;
 }return false;};
 // x,z are SOURCE coordinates; around centre of main cargo hatch
 for(const [x,z] of [[0,-2.8],[-.25,-2.8],[.25,-2.8],[0,-2.55]])assert.equal(inside(x,z),false,`${x} ${z}`);
 // A neighbouring solid plank remains, so this was not whole-mesh deletion.
 assert.ok(indices.length>40000);
});
test('two physically distinct real entry apertures with air below (no invisible floor)',()=>{
 assert.ok(!cabin.inHatch({x:lower.layout.x,z:lower.layout.z}));
 assert.ok(!lower.inHatch({x:cabin.layout.x,z:cabin.layout.z}));
 for(const y of [-2,0,.7,3])assert.equal(measuredFloorAt(0,-3.65,y),null);
 assert.ok(Number.isFinite(measuredFloorAt(lower.layout.deckExit.x,lower.layout.deckExit.z,2.5)));
 assert.ok(Number.isFinite(measuredFloorAt(cabin.layout.deckExit.x,cabin.layout.deckExit.z,2.5)));
 assert.equal(lower.floorAt(),LOWER_HOLD.floorY);
});
test('cargo hatch: step on ladder, descend, move freely inside, climb and LAND on solid decking',()=>{
 const p=person(lower);
 assert.equal(beginShipClimb(p,lower,true),true);advance(p,lower);
 assert.equal(p.deckLayer,'lowerHold');assert.ok(lower.inside(p.deckPos));
 const before=p.deckPos.clone();p.deckPos.z+=1.45;lower.constrain(p.deckPos);assert.ok(lower.inside(p.deckPos)&&p.deckPos.z>before.z+1.0);
 p.deckPos.set(0,lower.layout.floorY,-3.65);
 assert.equal(beginShipClimb(p,lower,false),true);advance(p,lower);
 assert.equal(p.deckLayer,'deck');assert.equal(lower.inHatch(p.deckPos),false);
 assert.ok(Math.abs(p.deckPos.y-deckHeight(p.deckPos.z,p.deckPos.x))<.12);
});
test('captain quarters: hatch ladder returns to supported original quarterdeck, not its hole',()=>{
 const p=person(cabin);assert.equal(beginShipClimb(p,cabin,true),true);advance(p,cabin);
 assert.equal(p.deckLayer,'hold');assert.ok(cabin.inside(p.deckPos));
 assert.equal(beginShipClimb(p,cabin,false),true);advance(p,cabin);
 assert.equal(p.deckLayer,'deck');assert.equal(cabin.inHatch(p.deckPos),false);
 assert.ok(Math.abs(p.deckPos.y-deckHeight(p.deckPos.z,p.deckPos.x))<.12);
});
test('captain original door supports inside-to-outside and outside-to-inside movement',()=>{
 const door={open:false};const p=person(cabin,'hold');p.deckPos.set(-.88,-.37,-7.28);
 assert.equal(beginCabinDoorExit(p,cabin,door),false);
 door.open=true;assert.equal(beginCabinDoorExit(p,cabin,door),true);advance(p,cabin);
 assert.equal(p.deckLayer,'deck');assert.ok(p.deckPos.z>-6.4&&p.deckPos.y>=1);
 assert.equal(beginCabinDoorEnter(p,cabin,door),true);advance(p,cabin);
 assert.equal(p.deckLayer,'hold');assert.ok(cabin.inside(p.deckPos));
});
test('cargo storage uses hold floor and keeps ladder landing clear',()=>{
 const space=new ShipStorageSpace(lower);
 const near=space.nearestFree({x:1.1,z:-1},[],null);
 assert.ok(near);assert.ok(lower.inside(near));assert.ok(Math.abs(near.y-(lower.floorAt()+.07))<.005);
 assert.equal(space.validate({x:0,z:-3.65},[]).ok,false);
});
test('dry below-deck camera states suppress underwater effect for BOTH spaces',()=>{
 assert.equal(isDryHoldCamera({mode:'deck',deckLayer:'lowerHold'}),true);
 assert.equal(isDryHoldCamera({mode:'deck',deckLayer:'hold'}),true);
 assert.equal(isDryHoldCamera({mode:'deck',deckLayer:'deck',deckPos:{x:1,y:2,z:-3}}),false);
 const water=text('src/ocean/WaterMaterial.js');assert.match(water,/boatWorldToLocal/);assert.match(water,/halfBeam-.12/);
});
test('physical cannon aiming, muzzle launch, projectile collision and reload are wired',()=>{
 const voyage=text('src/voyage/VoyageM1.js'),player=text('src/player/Player.js');
 assert.match(voyage,/aimCannonMount\(this\.markerMeshes/);assert.match(voyage,/const direction=cannonDirection/);
 assert.match(voyage,/const socket=cannonMuzzle\(marker\)/);assert.match(voyage,/this\._spawnBall/);
 assert.match(voyage,/cannons\[shot\.stationId\]/);assert.match(voyage,/input\.consume\('KeyR'/);
 assert.match(player,/this\.stationId\?\.startsWith\('cannon_'/);assert.match(player,/inp\.down\('KeyA'/);
});
test('physical racks E-equip working weapon actions F / T / K without conflicts',()=>{
 const voyage=text('src/voyage/VoyageM1.js'),hunt=text('src/oceanhunt/HuntCombat.js'),app=text('src/App.js');
 assert.match(voyage,/add\('arsenal_'\+kind/);assert.match(voyage,/hunt\.equip\(kind\)/);
 assert.match(hunt,/this\.aboard \|\| this\.developer/);
 assert.match(hunt,/this\.app\.voyageM1 \? 'KeyF' : 'KeyC'/);
 assert.match(hunt,/this\.app\.voyageM1 \? 'KeyT' : 'KeyQ'/);
 assert.match(hunt,/this\.bosses\.hitProjectile/);
 assert.match(app,/!\(this\.voyageM1 && \['deck','boat'\]\.includes\(this\.player\.mode\)\)/);
});
console.log(`V53 ${count}/${count} targeted structural, movement, dry cabin and weapon checks passed. GPU/browser walk-through not represented by these assertions.`);
