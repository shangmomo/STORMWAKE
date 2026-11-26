// Source-asset and gameplay logic QA; does not imply a real WebGPU playthrough.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Vector3} from '../src/engine/index.js';
import {BoatModel} from '../src/world/BoatModel.js';
import {CaptainCabinInterior,CAPTAIN_ROOM} from '../src/ship/CaptainCabinInterior.js';
import {beginShipClimb,advanceShipClimb} from '../src/ship/ShipLadder.js';
import {heritageCrewNodes,heritageCrewRoute} from '../src/ship/CrewNavigation.js';
import {ORIGINAL_AFT_LADDER,originalAftLadderAccess,measuredFloorAt,inRealHatch} from '../src/ship/HeritageDeck.js';
const root=new URL('../',import.meta.url);
const bytes=p=>fs.readFileSync(new URL(p,root));
function glb(p){const b=bytes(p);assert.equal(b.toString('ascii',0,4),'glTF');const length=b.readUInt32LE(12);const j=JSON.parse(b.subarray(20,20+length).toString());const binary=b.subarray(28+length);return {j,b,binary};}
function accessor(asset,i){const a=asset.j.accessors[i],v=asset.j.bufferViews[a.bufferView];const start=v.byteOffset+(a.byteOffset||0),length=a.count;const read=({5123:(p)=>asset.binary.readUInt16LE(p),5125:(p)=>asset.binary.readUInt32LE(p)})[a.componentType];assert.ok(read);const stride=a.componentType===5123?2:4;return Array.from({length},(_,k)=>read(start+k*stride));}
let n=0;function verify(name,fn){fn();console.log(`PASS V51 ${++n} ${name}`);}
const original=glb('public/models/stormwake_v50/dutch_ship_cabin_access.glb');
const operated=glb('public/models/stormwake_v51/dutch_ship_operable.glb');
verify('new art is checksummed and has exactly original mesh groups plus original door skin',()=>{
 const meta=JSON.parse(bytes('public/models/stormwake_v51/asset_manifest.json').toString())[0];
 assert.equal(crypto.createHash('sha256').update(operated.b).digest('hex'),meta.sha256);
 assert.deepEqual(operated.j.meshes.slice(0,3).map(m=>m.name),original.j.meshes.map(m=>m.name));
 assert.equal(operated.j.meshes.length,4);
 assert.equal(operated.j.images.length,original.j.images.length);
 assert.equal(operated.j.materials.length,original.j.materials.length);
 assert.equal(operated.j.textures.length,original.j.textures.length);
 assert.equal(operated.j.accessors.length,original.j.accessors.length+2);
});
verify('original hull is preserved except two source triangles transferred into animated door',()=>{
 const a=original.j.meshes[0].primitives[0],b=operated.j.meshes[0].primitives[0],leaf=operated.j.meshes[3].primitives[0];
 assert.deepEqual(b.attributes,a.attributes);
 assert.deepEqual(leaf.attributes,a.attributes);
 assert.equal(leaf.material,a.material);
 const base=accessor(original,a.indices),changed=accessor(operated,b.indices),door=accessor(operated,leaf.indices);
 assert.equal(door.length,6);
 assert.deepEqual(door,base.slice(6300*3,6302*3));
 assert.deepEqual(changed,[...base.slice(0,6300*3),...base.slice(6302*3)]);
 assert.equal(changed.length+door.length,base.length);
});
verify('hinge has a single leaf child and restores the exact original closed geometry',()=>{
 const h=operated.j.nodes.findIndex(n=>n.name==='original_dutch_door_hinge');
 const leaf=operated.j.nodes.findIndex(n=>n.name==='original_dutch_door_leaf');
 assert.ok(h>=0&&leaf>=0);assert.deepEqual(operated.j.nodes[h].children,[leaf]);
 assert.equal(operated.j.nodes[leaf].mesh,3);
 const a=operated.j.nodes[h].translation,b=operated.j.nodes[leaf].translation;
 for(let k=0;k<3;k++)assert.ok(Math.abs(a[k]+b[k])<1e-6);
 assert.ok(operated.j.scenes.some(s=>s.nodes.includes(h)));
});
const boat=new BoatModel({shipClass:'heritage'}),cab=new CaptainCabinInterior(boat);
verify('ship hatch remains aperture on the original model, not a guessed room floor',()=>{
 assert.equal(measuredFloorAt(CAPTAIN_ROOM.hatchX,CAPTAIN_ROOM.hatchZ,2.5),null);
 assert.equal(inRealHatch(CAPTAIN_ROOM.hatchX,CAPTAIN_ROOM.hatchZ),true);
});
verify('cabin ladder reaches same real hatch x and z while boat is moving',()=>{
 const u={mode:'deck',stationId:null,deckPos:new Vector3(CAPTAIN_ROOM.hatchX,cab.layout.deckY,CAPTAIN_ROOM.hatchZ),deckVel:new Vector3(),deckLayer:'deck',shipClimb:null};
 assert.equal(beginShipClimb(u,cab,true),true);
 assert.equal(u.shipClimb.end.x,CAPTAIN_ROOM.hatchX);
 assert.equal(u.shipClimb.end.z,CAPTAIN_ROOM.hatchZ);
 for(let i=0;i<16;i++)advanceShipClimb(u,.1,cab);
 assert.equal(u.deckLayer,'hold');assert.equal(u.shipClimb,null);
 assert.equal(beginShipClimb(u,cab,false),true);
 for(let i=0;i<16;i++)advanceShipClimb(u,.1,cab);
 assert.equal(u.deckLayer,'deck');assert.equal(u.shipClimb,null);
 // V53 intentional regression fix: ladder must end on adjacent SOLID deck.
 assert.equal(u.deckPos.x,cab.layout.deckExit.x);assert.equal(cab.inHatch(u.deckPos),false);
});
verify('authored sterncastle ladder offers a continuous user route from upper and lower landings',()=>{
 const l=ORIGINAL_AFT_LADDER;
 assert.ok(originalAftLadderAccess({x:l.x,z:l.upperZ}));
 assert.ok(originalAftLadderAccess({x:l.x,z:l.lowerZ}));
 const n=heritageCrewNodes(boat.shipScale);
 for(const key of ['aft_upper','aft_ladder','aft_lower'])assert.ok(n[key]);
 const route=heritageCrewRoute('helm','forward');
 assert.ok(route.indexOf('aft_ladder')>route.indexOf('aft_upper'));
 assert.ok(route.indexOf('aft_lower')>route.indexOf('aft_ladder'));
 assert.ok(route.indexOf('mid')>route.indexOf('aft_lower'));
 assert.ok(heritageCrewRoute('forward','helm').includes('aft_ladder'));
});
verify('boats use single sourced shell without obsolete hydro depth silhouette',()=>{
 const app=bytes('src/App.js').toString();
 assert.match(app,/if\(!this\.boat\.shipScale\)this\.sceneRenderer\.addHullMask/);
 const rig=bytes('src/ship/HeritageAssetRig.js').toString();
 assert.match(rig,/dutch_ship_(?:operable|passable|lower_hold)\.glb/);
 assert.match(rig,/loaded\.groups\.get\('original_dutch_door_hinge'\)/);
 assert.match(rig,/\['wheel','throttle','rudder','propeller'\]/);
});
verify('capsize damping, source-lantern toggle and crew size update are shipped',()=>{
 const phy=bytes('src/player/BoatController.js').toString();assert.match(phy,/this\.com\.y-=\.35/);
 const l=bytes('src/materials/LocalLights.js').toString();assert.match(l,/boat\.originalLampsOn===false/);
 const crew=bytes('src/ship/CrewVisuals.js').toString();assert.match(crew,/\.(?:76|58)\/s\.x/);
 const player=bytes('src/player/Player.js').toString();assert.match(player,/this\.aftLadderClimb/);
 assert.match(player,/this\.deckPos\.y>MAST\.top-\.32/);
 assert.match(player,/const inOpenHatch=!!this\.shipInterior\?\.inHatch\(p\)/);
});
console.log(`STORMWAKE V51 ${n}/${n} source and gameplay checks passed. Hardware/WebGPU visuals NOT certified.`);
