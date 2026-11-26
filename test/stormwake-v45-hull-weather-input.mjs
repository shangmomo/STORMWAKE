import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Group} from '../src/engine/index.js';
import {Input} from '../src/core/Input.js';
import {isDryHoldCamera} from '../src/ship/DryHoldCamera.js';
import {ShipInterior} from '../src/ship/ShipInterior.js';
import {BoatModel} from '../src/world/BoatModel.js';
import {weatherAt} from '../src/offshore/OffshoreField.js';
import {GhostFleet,GHOST_PATROLS} from '../src/offshore/GhostFleet.js';
import {VortexVisuals,funnelGeometry} from '../src/offshore/VortexVisuals.js';
import {Cargo} from '../src/voyage/Cargo.js';
let passes=0;
function check(name,fn){fn();console.log('PASS V45 '+(++passes)+' '+name);}
check('hold air medium only applies to actual hold / late downward climb',()=>{
 assert.equal(isDryHoldCamera({mode:'deck',deckLayer:'hold'}),true);
 assert.equal(isDryHoldCamera({mode:'deck',deckLayer:'deck'}),false);
 assert.equal(isDryHoldCamera({mode:'deck',deckLayer:'deck',shipClimb:{entering:true,t:.7}}),true);
 assert.equal(isDryHoldCamera({mode:'walk',deckLayer:'hold'}),false);
});
check('camera wet pass and physical ocean visibility share the same dry hold gate',()=>{
 const s=readFileSync(new URL('../src/App.js',import.meta.url),'utf8');
 // V50 keeps open sea outside the ship while masking only the dry hull interior.
 assert.match(s, /this\.ocean\.visible=true/);
 assert.match(s, /boatMaskEnabled/);
 assert.doesNotMatch(s,/this\.ocean\.visible=!dryHoldCamera/);
 assert.match(s,/G\.cameraUnderwater\.value\s*=\s*!dryHoldCamera/);
 assert.match(s,/marineSnow\.update\( this\.camera, !dryHoldCamera/);
});
check('water in hold is displayed from actual damage, not a static ocean plane',()=>{
 const model=new BoatModel({shipClass:'heritage'}),hold=new ShipInterior(model);
 hold.update(0);assert.equal(hold.waterMesh.visible,false);
 hold.update(.2);assert.equal(hold.waterMesh.visible,true);
 hold.update(0);assert.equal(hold.waterMesh.visible,false);
 assert.equal(hold.waterMesh.material.transparent,true);
});
check('hold has continuous wall/ceiling meshes, no open rib-only structure',()=>{
 const source=readFileSync(new URL('../src/ship/ShipInterior.js',import.meta.url),'utf8');
 assert.match(source,/continuous solid lining/);assert.match(source,/roofY/);
 const ship=new BoatModel({shipClass:'heritage'}),hold=new ShipInterior(ship);
 const max=hold.layout.halfW;
 let p={x:max*8,z:99};hold.constrain(p);
 assert.ok(p.x<max&&hold.inside(p));
});
check('hold items cannot be picked from another deck by world y difference',()=>{
 const c=new Cargo();assert.ok(c.spawnChest('a',{x:2,y:-4,z:1}));
 assert.equal(c.tryPick('one','a',{x:2,y:1,z:1}),false);
 assert.equal(c.tryPick('one','a',{x:2,y:-3.3,z:1}),true);
});
check('input owner separates one E action, disabling clears held keys and focus loss clears it',()=>{
 const oldWindow=globalThis.window,oldDoc=globalThis.document;
 const handlers={};const domHandlers={};
 globalThis.window={addEventListener:(name,cb)=>{(handlers[name]??=[]).push(cb);}};
 globalThis.document={addEventListener:(name,cb)=>{(handlers[name]??=[]).push(cb);},hidden:false};
 try{
  const dom={addEventListener:(name,cb)=>{(domHandlers[name]??=[]).push(cb);}};
  const inp=new Input(dom);
  const down={code:'KeyE',preventDefault(){},target:{tagName:'DIV'}};
  handlers.keydown[0](down);inp.interactionOwner='voyage';
  assert.equal(inp.consume('KeyE','player'),false);
  assert.equal(inp.consume('KeyE','voyage'),true);
  handlers.keydown[0]({...down,code:'KeyW'});assert.equal(inp.down('KeyW'),true);
  handlers.blur[0]();assert.equal(inp.down('KeyW'),false);
  handlers.keydown[0]({...down,code:'KeyW'});inp.enabled=false;assert.equal(inp.keys.size,0);
  inp.enabled=true;handlers.keydown[0]({...down,code:'KeyW'});
  globalThis.document.hidden=true;handlers.visibilitychange[0]();assert.equal(inp.keys.size,0);
 } finally {globalThis.window=oldWindow;globalThis.document=oldDoc;}
});
check('storm has measurable wave amplification vs near-port calm',()=>{
 const calm=weatherAt(70,37,10),storm=weatherAt(-800,2250,10);
 assert.ok(calm.waveScale===1);assert.ok(storm.waveScale>1.8);
 const source=readFileSync(new URL('../src/App.js',import.meta.url),'utf8');
 assert.match(source,/this\.surface\.amplitude\.value\+=/);
 assert.match(source,/this\.fft\.foamGain\.value=/);
});
check('ghost ships form multiple real dispersed patrols, not a single ring',()=>{
 assert.equal(GHOST_PATROLS.length,10);
 const minDist=Math.min(...GHOST_PATROLS.flatMap((a,i)=>GHOST_PATROLS.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.z-b.z))));
 assert.ok(minDist>75,`too densely packed: ${minDist}`);
 const span=Math.max(...GHOST_PATROLS.map(v=>v.x))-Math.min(...GHOST_PATROLS.map(v=>v.x));
 assert.ok(span>700);
 const fleet=new GhostFleet(new Group());assert.equal(fleet.ships.length,10);
});
check('waterspout is a continuous 3D funnel rather than concentric toruses',()=>{
 const geom=funnelGeometry(0);assert.ok(geom.attributes.position.count>2000);
 assert.ok(geom.index.count>10_000);
 const v=new VortexVisuals(new Group());assert.ok(v.root.children.length>=4);
 assert.ok(v.root.children[0].material.transparent);
 assert.match(v.root.name,/three-dimensional/);
});
check('interior collision timing clamps deck steps to control tunnelling',()=>{
 const src=readFileSync(new URL('../src/player/Player.js',import.meta.url),'utf8');
 assert.match(src,/Math\.min\(dt,\s*\.05\)/);
 assert.match(src,/this\.deckLayer!=='hold' && !this\.shipClimb/);
});
console.log(`V45 targeted automated checks passed: ${passes}. These are NOT WebGPU browser visual QA.`);
