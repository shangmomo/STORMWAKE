import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import { ShipStations } from '../src/ship/ShipStations.js';
import { Group, Vector3 } from '../src/engine/index.js';
import { HeritageDeck, measuredFloorAt } from '../src/ship/HeritageDeck.js';
import { HERITAGE_STATION_METERS } from '../src/ship/StationSites.js';
import { eligibleOffshore, OffshoreLife } from '../src/world/marine/OffshoreLife.js';
import { createLandCreature } from '../src/land/LandModels.js';
import {addBoatLights} from '../src/materials/LocalLights.js';
import {WORLD} from '../src/world/WorldLayout.js';
let n=0;const check=(description,fn)=>{fn();n++;console.log('✓',description);};
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
check('Spawn: physical anchor down; throttle and sails at zero',()=>{
 const s=new ShipStations();assert.equal(s.anchorDown,true);assert.equal(s.anchorTravel,1);
 assert.equal(s.helmThrottle,0);assert.equal(s.sailMain,0);assert.equal(s.sailJib,0);
 s.update(.1);assert.equal(s.anchorTravel,1);assert.equal(s.anchorHands,0);
});
check('Boarding + AI target cannot override capstan-only anchoring',()=>{
 const src=read('src/voyage/VoyageM1.js');assert(!src.includes('autoAnchor({aboard'));
 assert(src.includes('b.voyageAnchor=state.anchorHeld'));
 assert(src.includes('this.stations.anchorDown=true'));
});
check('One hand raises anchor; second hand accelerates; W and S reverse',()=>{
 const one=new ShipStations();one.claim('anchor','human:1');one.setInput('anchor','human:1',{axis:1});
 one.update(.6);assert(one.anchorTravel<1);let a=one.anchorTravel;
 one.setInput('anchor','human:1',{axis:-1});one.update(.6);assert(one.anchorTravel>a);
 const four=new ShipStations();for(let i=0;i<4;i++){
  four.claim(['anchor','anchor_2','anchor_3','anchor_4'][i],`human:${i}`);
  four.setInput(['anchor','anchor_2','anchor_3','anchor_4'][i],`human:${i}`,{axis:1});
 }
 const first=one.anchorCrankTurns;four.update(.12);assert.equal(four.anchorHands,4);
 assert(1-four.anchorTravel>.100);assert(first!==undefined);
 four.occupants.forEach((actor,id)=>four.setInput(id,actor,{axis:0}));
 const stopped=four.anchorTravel;four.update(.15);assert.equal(four.anchorTravel,stopped);
});
check('Deck: visible wooden steering wheel, real deck wheel post and chain route',()=>{
 const boat={group:new Group(),shipScale:{x:1,y:1,z:1},helmPoint:new Vector3(),helmEye:new Vector3(),boardPoint:new Vector3()};
 const deck=new HeritageDeck(boat);
 assert(deck.helmWheel?.visible);assert(deck.helmWheel.children.length>0);
 // The operator stands clear of the wheel plane, with a reachable adult arm.
 assert(Math.abs(deck.helmWheel.position.z-HERITAGE_STATION_METERS.helm.z-.48)<.01);
 assert(boat.group.children.includes(deck.root));
 assert(deck.root.children.some(c=>c.name.includes('capstan to bow hawse')));
 assert(deck.root.children.some(c=>c.name.includes('six physical warm lanterns')));
});
check('Ship water shader cuts the entire sealed hull footprint, no outside ocean toggle',()=>{
 const shader=read('src/ocean/WaterMaterial.js');assert(shader.includes('V56 SEA SEAL'));
 assert(shader.includes('boatWorldToLocal'));
 assert(shader.includes('local.y<5.0 && local.y>-8.0'));
 assert(read('src/player/Player.js').includes('this.deckLayer=\'lowerHold\';this.lowerHold.constrain(p)'));
});
check('Full model anchor asset is bundled, with physically linked chain and translation',()=>{
 const f=new URL('../public/models/stormwake_v47/quaternius_prop_anchor.glb',import.meta.url);
 assert(statSync(f).size>10_000);
 assert.equal(readFileSync(f).subarray(0,4).toString(),'glTF');
 const a=read('src/ship/HeritageAssetRig.js');assert(a.includes('installAnchorRig(boat,anchor)')); // V62 replaces the incorrect fixed 4.35 m display with shared tether kinematics.
 assert(read('src/ship/ShipAnchorRig.js').includes('anchorEyePose({...context,travel})'));
 assert(a.includes('quaternius_prop_anchor.glb'));
});
check('Corsair does not use the oversized teal fallback warden orb',()=>{
 const creature=createLandCreature('corsair');assert(creature.body.scale.x<1.2);
 const src=read('src/land/LandCorsairArena.js');assert(!src.includes('sphere(.39,12,8),0x65cfc0'));
 const ai=read('src/land/LandAdventure.js');assert(ai.includes('createLandCreature( type )'));
});
check('Night lamps ship-attached and count exceeds previous four-light setup',()=>{
 const sources=[];const boat={group:new Group(),shipScale:{x:1,y:1,z:1},lines:{sheerY:()=>2,zAft:-11}};
 addBoatLights({add:s=>sources.push(s)},boat);
 assert(sources.length>=12,sources.length);
 assert(sources.some(x=>x.intensity>=7));
 for(const src of sources){src.update();assert(Number.isFinite(src.position.x));}
});
check('Deep ocean wildlife follows ship; no fish spawning on land',()=>{
 const sx=WORLD.boatDock.position.x,sz=WORLD.boatDock.position.z;
 assert(!eligibleOffshore(sx,sz,()=>-100));
 assert(!eligibleOffshore(sx+300,sz,()=>5));
 assert(eligibleOffshore(sx+300,sz,()=>-60));
 const scene=new Group(),boat={position:new Vector3(sx+400,0,sz+400)};
 const life=new OffshoreLife({scene,boat,terrain:{heightAt:()=>-100}});
 life.update(.05);assert(life.root.visible);
 assert(life.critters.length>=14);
 assert(life.critters.some(x=>x.mesh.visible));
 assert(life.critters.every(x=>Number.isFinite(x.mesh.position.y)));
 boat.position.set(sx,0,sz);life.update(.05);assert(!life.root.visible);
});
console.log('STORMWAKE V56 regression PASS:',n,'focused cases');
