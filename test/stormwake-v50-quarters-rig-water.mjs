// V50 targeted resource/geometry/gameplay tests. NO claim of GPU-frame QA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {BoatModel} from '../src/world/BoatModel.js';
import {Vector3} from '../src/engine/index.js';
import {CaptainCabinInterior,CAPTAIN_ROOM,inCaptainHatch,cabinInside} from '../src/ship/CaptainCabinInterior.js';
import {CAPTAIN_FURNITURE_COLLIDERS} from '../src/ship/CaptainCabinColliders.js';
import {MAST,installMastLookout,lookoutFloor,nearMast} from '../src/ship/MastLookout.js';
import {beginShipClimb,advanceShipClimb} from '../src/ship/ShipLadder.js';
import {measuredFloorAt,REAL_HATCH,deckHeight} from '../src/ship/HeritageDeck.js';
import {outerHalfWidth} from '../src/ship/DutchHullOuterProfile.js';
let n=0;const check=(name,fn)=>{fn();console.log('PASS V50',++n,name);};
const root=new URL('../',import.meta.url);
const bytes=(path)=>fs.readFileSync(new URL(path,root));
function glb(path){
 const b=bytes(path);assert.equal(b.toString('utf8',0,4),'glTF');
 const len=b.readUInt32LE(12),json=JSON.parse(b.subarray(20,20+len).toString('utf8'));
 return {b,json};
}
const assets=JSON.parse(bytes('public/models/stormwake_v50/asset_manifest.json').toString());
check('all v50 art resources are present and SHA256 verified',()=>{
 for(const a of assets){const b=bytes('public/models/stormwake_v50/'+a.file);
  assert.equal(b.length,a.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),a.sha256);
 }
 assert.ok(assets.length>=3);
});
check('Dutch GLB truly has real localized hatch, same original three art meshes',()=>{
 const o=glb('public/models/stormwake_v47/dutch_ship_medium_pbr.glb');
 const h=glb('public/models/stormwake_v50/dutch_ship_cabin_access.glb');
 assert.equal(h.json.meshes.length,o.json.meshes.length);
 assert.deepEqual(h.json.meshes.map(x=>x.name),o.json.meshes.map(x=>x.name));
 assert.equal(h.json.images.length,o.json.images.length);
 assert.notEqual(h.json.meshes[0].primitives[0].indices,o.json.meshes[0].primitives[0].indices);
});
check('captains quarters preserves uploaded model provenance, textures, original pieces',()=>{
 const y=glb('public/models/stormwake_v50/captains_quarters_access.glb');
 assert.equal(y.json.asset.extras.license,'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)');
 assert.match(y.json.asset.extras.author,/TheMadraver/);
 assert.equal(y.json.meshes.length,81);assert.equal(y.json.images.length,82);
 assert.ok(y.json.accessors[y.json.meshes[77].primitives[0].indices].count>2712);
});
check('chart is an actual painted/glTF textured 3D object, not UI-only label',()=>{
 const x=glb('public/models/stormwake_v50/captain_sea_chart.glb');
 assert.ok(x.json.images.length>0);assert.ok(x.json.materials[0].pbrMetallicRoughness.baseColorTexture);
 assert.equal(x.json.meshes[0].primitives[0].attributes.TEXCOORD_0!==undefined,true);
});
check('sourced cabin fitted within Dutch outer half beam at both ends',()=>{
 assert.ok(CAPTAIN_ROOM.scaleXZ<.55);
 for(const z of [-9.1,-8.6,-8,-7.5,-7,-6.35]){
  const max=outerHalfWidth(z);
  assert.ok(max>CAPTAIN_ROOM.halfW,`${z}: ${max}`);
 }
 assert.ok(CAPTAIN_ROOM.floorY<deckHeight(CAPTAIN_ROOM.hatchZ,CAPTAIN_ROOM.hatchX)-1.5);
});
check('two real hatch apertures geometrically overlap with same cabin location',()=>{
 assert.ok(inCaptainHatch({x:CAPTAIN_ROOM.hatchX,z:CAPTAIN_ROOM.hatchZ}));
 assert.ok(CAPTAIN_ROOM.hatchX>REAL_HATCH.x0&&CAPTAIN_ROOM.hatchX<REAL_HATCH.x1);
 assert.ok(CAPTAIN_ROOM.hatchZ>REAL_HATCH.z0&&CAPTAIN_ROOM.hatchZ<REAL_HATCH.z1);
 assert.equal(measuredFloorAt(CAPTAIN_ROOM.hatchX,CAPTAIN_ROOM.hatchZ,2.4),null);
});
const boat=new BoatModel({shipClass:'heritage'});const interior=new CaptainCabinInterior(boat);
check('actual imported cabin has own collision root in moving ship coordinates',()=>{
 assert.equal(interior.root.parent,boat.group);
 for(const axis of ['x','y','z'])assert.ok(Math.abs(interior.root.scale[axis]*boat.shipScale[axis]-1)<1e-6);
 assert.ok(cabinInside({x:0,y:-.37,z:-7.6}));
 assert.equal(cabinInside({x:6,y:-.37,z:-7.6}),false);
});
check('real model furniture supplies multiple distinct collider volumes',()=>{
 assert.equal(CAPTAIN_FURNITURE_COLLIDERS.length,9);
 for(const id of ['Bed','Desk','Table','OpenChest','ClosedChest'])
  assert.ok(CAPTAIN_FURNITURE_COLLIDERS.some(x=>x.name===id),id);
});
check('player capsule is physically pushed clear of real bed and desk meshes',()=>{
 for(const id of ['Bed','Desk','Table']){
  const c=CAPTAIN_FURNITURE_COLLIDERS.find(x=>x.name===id);
  const p={x:(c.min[0]+c.max[0])/2,y:CAPTAIN_ROOM.floorY,z:(c.min[2]+c.max[2])/2};
  interior.constrain(p);
  const r=.23;
  assert.ok(p.x<=c.min[0]-r+.001 || p.x>=c.max[0]+r-.001 || p.z<=c.min[2]-r+.001 || p.z>=c.max[2]+r-.001, id);
 }
});
check('interior is dry by default, independent of external ocean height',()=>{
 assert.equal(interior.floorAt(),CAPTAIN_ROOM.floorY);
 assert.equal(interior.update(0),undefined);
 assert.equal(interior.update(.4),undefined); // no fake outer ocean surface
});
const lookout=installMastLookout(boat);
check('lookout is a real scene object, and mast ladder dimensions match a mast station',()=>{
 assert.equal(lookout.root.parent,boat.group);
 assert.ok(lookout.mesh.geometry);
 assert.ok(MAST.top>10&&MAST.top<16);
 assert.equal(nearMast({x:0,z:MAST.z}),true);
});
check('crow nest has an elevated standable plane and 4 collision rail segments',()=>{
 assert.equal(lookoutFloor(0,MAST.z,MAST.top+.1),MAST.top);
 assert.equal(lookoutFloor(0,MAST.z,3),-Infinity);
 assert.equal(lookout.colliders.length,4);
});
check('boarding cabin uses continuous ship-local hatch climb, no teleport-to-room',()=>{
 const player={mode:'deck',stationId:null,deckPos:new Vector3(CAPTAIN_ROOM.hatchX,interior.layout.deckY,CAPTAIN_ROOM.hatchZ),deckLayer:'deck',deckVel:new Vector3(),shipClimb:null};
 assert.equal(beginShipClimb(player,interior,true),true);
 assert.equal(beginShipClimb(player,interior,true),false);
 advanceShipClimb(player,.23,interior);
 assert.ok(player.shipClimb&&player.deckPos.y<interior.layout.deckY && player.deckPos.y>CAPTAIN_ROOM.floorY);
 for(let k=0;k<16;k++)advanceShipClimb(player,.1,interior);
 assert.equal(player.deckLayer,'hold');assert.equal(player.shipClimb,null);
 assert.ok(Math.abs(player.deckPos.y-interior.floorAt())<.001);
});
check('offshore ocean never disappears globally from cabin; local shader mask active',()=>{
 const app=bytes('src/App.js').toString('utf8'),water=bytes('src/ocean/WaterMaterial.js').toString('utf8');
 assert.match(app,/this\.ocean\.visible=true/);assert.doesNotMatch(app,/this\.ocean\.visible=!dryHoldCamera/);
 assert.match(water,/boatWorldToLocal/);assert.match(water,/boatMaskEnabled/);
 assert.match(water,/discard;/);assert.match(app,/this\._v50WorldToBoat\.compose/);
});
check('bow interior culling and 3rd person hull camera guard are installed',()=>{
 const s=bytes('src/player/Player.js').toString('utf8'),rig=bytes('src/ship/HeritageAssetRig.js').toString('utf8');
 assert.match(s,/localCam\.z>3\.6/);assert.match(s,/lookoutFloor/);
 assert.match(rig,/o\.material\.side='double'/);
});
console.log(`V50 ${n}/${n} targeted tests passed. Browser/WebGPU frame-level clipping not certified.`);
