// V60 deterministic acceptance: physics, separate bilges, spatial cargo and authoritative server.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ShipAnchorTether} from '../src/ship/ShipAnchorTether.js';
import {HullCompartments} from '../src/ship/HullCompartments.js';
import {ShipDamage} from '../src/ship/ShipDamage.js';
import {canManipulateCargo,worldToShip} from '../src/voyage/CargoReach.js';
import {CoopHub} from '../server/coopHub.js';

let count=0;
const test=(name,fn)=>{fn();count++;console.log('✓ V60 '+name);};
const mock=()=>({write(){},end(){},destroyed:false});
const ship={x:70,y:0,z:38,yaw:0};
const pos=(local,layer='deck')=>({mode:'deck',deckLayer:layer,x:ship.x+local.x,y:ship.y+local.y,z:ship.z+local.z});

test('raised anchor clears tether state and force',()=>{
 const t=new ShipAnchorTether();let f=t.update({x:70,z:38,ground:-4,travel:0,dt:1/120});
 assert.equal(f.state,'STOWED');assert.equal(t.point,null);
 t.update({x:70,z:38,ground:-4,travel:1});
 t.update({x:95,z:38,vx:8,ground:-4,travel:1});
 f=t.update({x:95,z:38,vx:8,ground:-4,travel:0});
 assert.equal(f.state,'STOWED');assert.equal(f.x,0);assert.equal(t.point,null);
});
test('deep sea anchor sinks without freezing hull and shallow one takes tension',()=>{
 const t=new ShipAnchorTether();
 assert.equal(t.update({x:0,z:0,ground:-100,travel:1}).state,'NO_BOTTOM_CONTACT');
 assert.equal(t.update({x:0,z:0,ground:-5,travel:1}).state,'HOLDING');
 const force=t.update({x:10,z:0,ground:-5,vx:2,travel:1});
 assert(force.x<0);assert(force.tension>0);assert(['HOLDING','DRAGGING'].includes(force.state));
});
test('high load drags anchor gradually instead of teleporting ship',()=>{
 const t=new ShipAnchorTether({holdingForce:900});
 t.update({x:0,z:0,ground:-3,travel:1});const f=t.update({x:35,z:0,ground:-3,vx:22,travel:1,dt:.1});
 assert.equal(f.state,'DRAGGING');assert(f.tension<=900);assert(t.point.x>0&&t.point.x<1);
});
test('stern breach floods stern first; sealed breach stops inflow and bucket drains it',()=>{
 const h=new HullCompartments(),hole=h.addHole({x:-1,y:-.9,z:-3.7},{radius:.32});
 for(let i=0;i<110;i++)h.update(.1,{waterline:0});
 assert(h.sections.stern>h.sections.mid*2.5,'local breach must not flood all sections equally');
 const before=h.water;assert(before>0);assert(h.patch(hole.id));
 const dry=h.update(.05,{waterline:0});assert(dry<=before+1e-8);
 h.bail(.025,-3);assert(h.water<dry);
 const hydrated=new HullCompartments(h.serialize());assert.deepEqual(hydrated.serialize().sections,h.serialize().sections);
});
test('ship rain and legacy breach cannot leave segmented bilge visually dry',()=>{
 const dmg=new ShipDamage();dmg.water=.4;dmg.update(.1);
 assert(Math.abs(dmg.hull.totalWater()-.4)<1e-7);
 dmg.bail(.1);assert(dmg.water<.4);assert(Math.abs(dmg.hull.totalWater()-dmg.water)<1e-7);
});
test('cargo locations use shared ship frame, deck layer and reachability',()=>{
 const local={x:0,y:1.03,z:-5.5};assert(canManipulateCargo({player:pos(local),ship,local,layer:'deck'}));
 assert(!canManipulateCargo({player:pos({x:12,y:1,z:-5.5}),ship,local,layer:'deck'}));
 assert(!canManipulateCargo({player:pos(local,'lowerHold'),ship,local,layer:'deck'}));
 assert(!canManipulateCargo({player:pos(local),ship,local:{...local,z:-30},layer:'deck'}));
 const low={x:1.0,y:-.57,z:1.1};assert(canManipulateCargo({player:pos(low,'lowerHold'),ship,local:low,layer:'lowerHold'}));
 assert(!canManipulateCargo({player:pos({x:0,y:-.55,z:0},'lowerHold'),ship,local:{x:0,y:-.56,z:-2.18},layer:'lowerHold'}),'hatch landing must stay empty');
 const rotated=worldToShip({...ship,yaw:Math.PI/2},{x:70,y:0,z:37});
 assert(Math.abs(rotated.x-1)<1e-8&&Math.abs(rotated.z)<1e-8);
});
test('server stow/retrieve is authoritative: remote, wrong layer and duplicate operations rejected',()=>{
 const h=new CoopHub({now:()=>25000}),captain=h.join(mock()),crew=h.join(mock());
 h.handle(captain,{type:'hello',name:'Captain'});h.handle(crew,{type:'hello',name:'Crew'});
 h.voyage.accept();h.voyage.digDone();h.cargo.spawnChest('v60_chest',{x:70,y:1,z:32.5});
 h.shipState={...ship};
 Object.assign(captain,pos({x:0,y:1,z:-5.5}));Object.assign(crew,pos({x:0,y:1,z:-5.5}));
 let seq1=0,seq2=0;
 const send=(actor,msg)=>h.handleVoyage(actor,{type:'cargo_event',seq:actor===captain?++seq1:++seq2,...msg});
 send(captain,{verb:'pick',itemId:'v60_chest'});
 assert.equal(h.cargo.get('v60_chest').state,'held');
 send(crew,{verb:'pick',itemId:'v60_chest'});
 assert.equal(h.cargo.heldBy.size,1);
 send(captain,{verb:'stow',itemId:'v60_chest',holdLocal:{x:0,y:1.03,z:-5.5},holdLayer:'lowerHold'});
 assert.equal(h.cargo.get('v60_chest').state,'held','cannot stow from wrong level');
 Object.assign(captain,pos({x:10,y:1,z:1}));
 send(captain,{verb:'stow',itemId:'v60_chest',holdLocal:{x:0,y:1.03,z:-5.5},holdLayer:'deck'});
 assert.equal(h.cargo.get('v60_chest').state,'held','cannot stow remotely');
 Object.assign(captain,pos({x:0,y:1.03,z:-5.5}));
 send(captain,{verb:'stow',itemId:'v60_chest',holdLocal:{x:0,y:1.03,z:-5.5},holdLayer:'deck'});
 assert.equal(h.cargo.get('v60_chest').state,'hold');assert.equal(h.cargo.get('v60_chest').holdLayer,'deck');assert.equal(h.voyage.phase,'stowed');
 Object.assign(crew,pos({x:0,y:1.03,z:-5.5}));
 send(crew,{verb:'retrieve',itemId:'v60_chest'});
 assert.equal(h.cargo.get('v60_chest').state,'held');assert.equal(h.cargo.heldBy.get(crew.id),'v60_chest');
 send(captain,{verb:'retrieve',itemId:'v60_chest'});assert.equal(h.cargo.heldBy.size,1);
 send(crew,{verb:'stow',itemId:'v60_chest',holdLocal:{x:0,y:1.03,z:-5.5},holdLayer:'deck'});
 assert.equal(h.cargo.listShipHold('stormwake').length,1);
});
test('disconnect releases carried chest as a real world object; another sailor can recover it',()=>{
 const h=new CoopHub(),a=h.join(mock()),b=h.join(mock());
 h.handle(a,{type:'hello'});h.handle(b,{type:'hello'});h.shipState={...ship};
 Object.assign(a,pos({x:0,y:1.03,z:-5.5}));Object.assign(b,pos({x:0,y:1.03,z:-5.5}));
 h.cargo.spawnChest('disconnect_chest',{x:a.x,y:a.y,z:a.z});
 assert(h.cargo.tryPick(a.id,'disconnect_chest',a));
 h.leave(a.id);
 const item=h.cargo.get('disconnect_chest');
 assert.equal(item.state,'world');assert.equal(item.actorId,null);assert.equal(item.onDeck,true);
 assert.equal(h.cargo.heldBy.size,0);assert(h.cargo.tryPick(b.id,'disconnect_chest',b));
});
test('legacy global-ocean hiding and anchored velocity overwrite are absent',()=>{
 const app=readFileSync(new URL('../src/App.js',import.meta.url),'utf8');
 const physics=readFileSync(new URL('../src/player/BoatController.js',import.meta.url),'utf8');
 assert(!app.includes('this.ocean.visible=!dryHoldCamera'));
 assert(!physics.includes('this.velocity.x *= Math.exp(-dt*12)'));
 assert(physics.includes('anchorTether.update'));
});
console.log(`V60 focused physics/network tests: ${count} passed`);
