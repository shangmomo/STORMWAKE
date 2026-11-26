import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Vector3} from '../src/engine/index.js';
import {BoatModel} from '../src/world/BoatModel.js';
import {LOWER_HATCH,measuredFloorAt,deckHeight} from '../src/ship/HeritageDeck.js';
import {DutchLowerHold,LOWER_HOLD,nearLowerHatch,nearLowerLadder} from '../src/ship/DutchLowerHold.js';
import {CaptainCabinInterior} from '../src/ship/CaptainCabinInterior.js';
import {beginShipClimb,advanceShipClimb,beginCabinDoorExit,beginCabinDoorEnter} from '../src/ship/ShipLadder.js';
import {ShipStations} from '../src/ship/ShipStations.js';
import {HERITAGE_STATION_METERS} from '../src/ship/StationSites.js';
import {makeCoopServer} from '../server/coopServer.js';
const base=new URL('../',import.meta.url);
const read=f=>fs.readFileSync(new URL(f,base));const text=f=>read(f).toString('utf8');
const report=[];
function test(label,fn){fn();report.push(label);console.log('PASS V54',report.length,label);}
const manifest=JSON.parse(text('public/models/stormwake_v54/hatch_manifest.json'));
const model=read(manifest.file);const source=read(manifest.source);
const parseGlb=raw=>{assert.equal(raw.toString('ascii',0,4),'glTF');assert.equal(raw.readUInt32LE(8),raw.length);const n=raw.readUInt32LE(12);const j=JSON.parse(raw.subarray(20,20+n).toString());return {j,buffer:raw.subarray(28+n)};};
const glb=parseGlb(model),original=parseGlb(source);
const values=(g,idx)=>{const a=g.j.accessors[idx],v=g.j.bufferViews[a.bufferView];const n=({SCALAR:1,VEC2:2,VEC3:3})[a.type],size=({5125:4,5126:4,5123:2})[a.componentType];const start=(v.byteOffset||0)+(a.byteOffset||0);return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,k)=>{const at=start+(i*n+k)*size;return a.componentType===5126?g.buffer.readFloatLE(at):a.componentType===5123?g.buffer.readUInt16LE(at):g.buffer.readUInt32LE(at);}));};
const prim=glb.j.meshes[0].primitives[0],verts=values(glb,prim.attributes.POSITION),faces=values(glb,prim.indices).flat();
// Measured source asset coordinates, not a visual-only collision mask.
function sourceDeckAt(x,z){let count=0;for(let i=0;i<faces.length;i+=3){const a=verts[faces[i]],b=verts[faces[i+1]],c=verts[faces[i+2]];if(Math.min(a[1],b[1],c[1])<1.48||Math.max(a[1],b[1],c[1])>2.01)continue;const denominator=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(denominator)<1e-8)continue;const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/denominator;const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/denominator;if(u>1e-4&&v>1e-4&&u+v<1-1e-4)count++;}return count;}
const toSource=(x,z)=>[x/1.064,(z+.7)/1.064];
test('source hull mesh recut in new lateral passage with no overlap over capstan',()=>{
 assert.equal(crypto.createHash('sha256').update(model).digest('hex'),manifest.sha256);
 assert.ok(manifest.hatch_faces_removed>=8);assert.ok(manifest.source_capstan_rotatable_faces>=30);
 assert.equal(original.j.materials.length,glb.j.materials.length);
 assert.ok(glb.j.nodes.some(n=>n.name==='original_dutch_door_hinge'));
 assert.ok(glb.j.nodes.some(n=>n.name==='original_dutch_capstan_turntable'));
 for(const p of [[-.86,-2.18],[-.72,-2.18],[-1,-2.18]])assert.equal(sourceDeckAt(...toSource(...p)),0,'open aperture '+p);
 // Old central hole is completely restored because the new GLB was rebuilt from V52.
 assert.ok(sourceDeckAt(...toSource(0,-3.65))>0,'capstan deck must not be an open pit');
});
test('new hatch clearance, side-of-hole reachable from actual supported deck',()=>{
 assert.ok(LOWER_HATCH.x1<-.4 && LOWER_HATCH.z0>-3.1);
 assert.equal(measuredFloorAt(-.86,-2.18,3),null);
 assert.ok(Number.isFinite(measuredFloorAt(0,-3.65,3)));
 assert.equal(nearLowerHatch({x:.04,z:-2.18}),false);
 assert.equal(nearLowerLadder({x:.04,z:-2.18}),true);
 assert.ok(Number.isFinite(measuredFloorAt(.04,-2.18,3)));
});
const boat=new BoatModel({shipClass:'heritage'}),lower=new DutchLowerHold(boat),cabin=new CaptainCabinInterior(boat);
const person=(interior,layer='deck')=>({mode:'deck',stationId:null,deckPos:new Vector3(interior.layout.deckExit.x,layer==='deck'?interior.layout.deckY:interior.layout.floorY,interior.layout.z),deckVel:new Vector3(),deckLayer:layer,shipClimb:null,deckGrounded:true});
const run=(p,i)=>{for(let j=0;j<28&&p.shipClimb;j++)advanceShipClimb(p,.10,i);assert.equal(p.shipClimb,null);};
test('cargo deck -> hold -> walk -> deck, end at supported plank and never fall into hole',()=>{
 const p=person(lower);assert.equal(lower.inHatch(p.deckPos),false);
 assert.equal(beginShipClimb(p,lower,true),true);run(p,lower);
 assert.equal(p.deckLayer,'lowerHold');assert.ok(lower.inside(p.deckPos));
 p.deckPos.z+=1;p.deckPos.x+=.35;lower.constrain(p.deckPos);assert.ok(lower.inside(p.deckPos));
 p.deckPos.set(lower.layout.x,lower.floorAt(),lower.layout.z);
 assert.equal(beginShipClimb(p,lower,false),true);run(p,lower);
 assert.equal(p.deckLayer,'deck');assert.ok(!lower.inHatch(p.deckPos));
 assert.ok(Math.abs(p.deckPos.y-deckHeight(p.deckPos.z,p.deckPos.x))<.1);
});
test('quarters roof hatch is sealed; source bulkhead door remains bidirectional',()=>{
 assert.equal(cabin.inHatch({x:.17,z:-7.43}),false);
 const door={open:true},p=person(cabin,'hold');p.deckPos.set(-.88,cabin.floorAt(),-7.28);
 assert.equal(beginCabinDoorExit(p,cabin,door),true);run(p,cabin);assert.equal(p.deckLayer,'deck');
 assert.equal(beginCabinDoorEnter(p,cabin,door),true);run(p,cabin);assert.equal(p.deckLayer,'hold');
 assert.match(text('src/ship/CaptainCabinInterior.js'),/ladderMesh.visible=false/);
});
test('world ocean remains visible through windows and is masked in the dry hull',()=>{
 assert.match(text('src/App.js'),/this\.ocean\.visible=true/);
 assert.match(text('src/ocean/WaterMaterial.js'),/boatWorldToLocal/);
 assert.match(text('src/ship/DryHoldCamera.js'),/lowerHold/);
});
test('capstan split from ORIGINAL GLB and animated by same multiplayer authority as anchor',()=>{
 assert.ok(glb.j.meshes.some(m=>m.name.includes('Source Dutch windlass top')));
 assert.match(text('src/ship/HeritageAssetRig.js'),/loaded\.groups\.get\('original_dutch_capstan_turntable'\)/);
 assert.match(text('src/voyage/VoyageM1.js'),/capstan\.rotation\.y=this\.stations\.anchorCrankTurns/);
 assert.ok(HERITAGE_STATION_METERS.anchor.z<0);
});
test('multiplayer free-moving deck avatar reports its own position, not ship centre',()=>{
 const client=text('src/oceanhunt/CoopClient.js');
 // V57: even a helmsman's model uses their real feet, never the vessel origin.
 assert.match(client,/const pos = player.position/);
 assert.match(client,/const activity = this.currentActivity \|\| \(player.boardingClimb/);
 assert.doesNotMatch(client,/shipWorld\(sid \|\| 'carry'\)/);
 assert.match(client,/peer.captain.position.set\( 0, 0, 0 \)/);
});
test('two and four simultaneous windlass operators move more chain per second, stop on release',()=>{
 const sim=people=>{const s=new ShipStations();s.anchorDown=true;s.anchorTravel=1;s.anchorTravelReady=true;s.anchorManual=true;
   for(let i=0;i<people;i++){const id=i?'anchor_'+(i+1):'anchor';assert.equal(s.claim(id,'user'+i),true);s.setInput(id,'user'+i,{axis:1});}
   s.update(.1);return s;};
 const one=sim(1),two=sim(2),four=sim(4);
 assert.ok(two.anchorTravel<one.anchorTravel&&four.anchorTravel<two.anchorTravel);
 assert.equal(four.anchorHands,4);assert.equal(four.anchorManual,true);
 const before=four.anchorTravel;for(const id of ['anchor','anchor_2','anchor_3','anchor_4'])four.setInput(id,'user'+(['anchor','anchor_2','anchor_3','anchor_4'].indexOf(id)),{axis:0});four.update(.1);assert.equal(four.anchorTravel,before);
 four.setInput('anchor','user0',{axis:-1});four.update(.1);assert.ok(four.anchorTravel>before,'S pays out chain');
});
async function coopIntegration(){
 const {server,listen,hub}=makeCoopServer({host:'127.0.0.1',port:0});const addr=await listen();const url=`ws://127.0.0.1:${addr.port}/crew-ws`;
 const close=()=>new Promise(resolve=>server.close(resolve));
 const clients=[];
 const waitFor=(client,pred,ms=3000)=>new Promise((resolve,reject)=>{
   const existing=client.inbox.find(pred);if(existing){resolve(existing);return;}
   const t=setTimeout(()=>{client.listeners.delete(listener);reject(Error('WebSocket message timeout'))},ms);
   const listener=msg=>{if(pred(msg)){clearTimeout(t);client.listeners.delete(listener);resolve(msg)}};client.listeners.add(listener);
 });
 const join=async(name)=>{
  const ws=new WebSocket(url),c={ws,inbox:[],listeners:new Set()};clients.push(c);
  ws.addEventListener('message',e=>{const msg=JSON.parse(e.data);c.inbox.push(msg);for(const fn of [...c.listeners])fn(msg)});
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
  const welcome=await waitFor(c,m=>m.type==='welcome');c.id=welcome.id;ws.send(JSON.stringify({type:'hello',name}));return c;
 };
 try{
  assert.equal(typeof globalThis.WebSocket,'function','Node >=22 WebSocket required');
  const a=await join('captain'),b=await join('sailor'),c=await join('third');
  assert.equal(hub.size,3);
  a.ws.send(JSON.stringify({type:'station_claim',seq:1,stationId:'anchor'}));
  b.ws.send(JSON.stringify({type:'station_claim',seq:1,stationId:'anchor_2'}));
  c.ws.send(JSON.stringify({type:'station_claim',seq:1,stationId:'anchor_3'}));
  await waitFor(a,m=>m.type==='station_update'&&m.stationId==='anchor_3');
  assert.equal(hub.stations.getOccupant('anchor'),a.id);
  assert.equal(hub.stations.getOccupant('anchor_2'),b.id);
  assert.equal(hub.stations.getOccupant('anchor_3'),c.id);
  await new Promise(r=>setTimeout(r,38));
  a.ws.send(JSON.stringify({type:'station_input',seq:2,stationId:'anchor',axis:1,throttleAxis:0,trimAxis:0,buttons:0}));
  b.ws.send(JSON.stringify({type:'station_input',seq:2,stationId:'anchor_2',axis:1,throttleAxis:0,trimAxis:0,buttons:0}));
  c.ws.send(JSON.stringify({type:'station_input',seq:2,stationId:'anchor_3',axis:1,throttleAxis:0,trimAxis:0,buttons:0}));
  await waitFor(a,m=>m.type==='station_input'&&m.stationId==='anchor_3');
  assert.equal(hub.stations.inputs.get(a.id).axis,1);assert.equal(hub.stations.inputs.get(b.id).axis,1);assert.equal(hub.stations.inputs.get(c.id).axis,1);
  a.ws.send(JSON.stringify({type:'ship_state_host',seq:3,x:5,y:0,z:2,yaw:0,vx:0,vz:0,sailMain:.4,sailJib:.3,integrity:100,breach:0,fire:0,anchor:true,anchorTravel:.5,anchorCrankTurns:9.2,anchorHands:3}));
  const replicated=await waitFor(b,m=>m.type==='ship_state'&&m.anchorCrankTurns===9.2);
  assert.equal(replicated.anchorHands,3);assert.equal(replicated.anchorTravel,.5);
  // The captain's source bulkhead door must not be open only in one browser.
  // Client mode is deck and near the host's current ship position.
  a.ws.send(JSON.stringify({type:'move',x:5,y:1,z:2,yaw:0,mode:'deck',boat:'corsair'}));
  await new Promise(r=>setTimeout(r,50));
  a.ws.send(JSON.stringify({type:'ship_door',seq:4,open:true}));
  await waitFor(b,m=>m.type==='ship_door'&&m.open===true);
  assert.equal(hub.sourceDoorOpen,true);
  const late=await join('new joiner');
  const lateWelcome=late.inbox.find(m=>m.type==='welcome');
  assert.equal(lateWelcome.sourceDoorOpen,true,'late peer sees opened source door');
  a.ws.send(JSON.stringify({type:'chat',text:'anchor test'}));await waitFor(c,m=>m.type==='chat'&&m.text==='anchor test');
  console.log('PASS V54 real TCP WebSocket 3-player join + 3 simultaneous station claims + shared turn + chat + door sync + late join + host ship replication');
 }finally{
  for(const c of clients)try{c.ws.close()}catch{}
  await new Promise(r=>setTimeout(r,100));await close();
 }
}
await coopIntegration();
console.log(`PASS V54 ${report.length} focused tests + live WebSocket networking integration. Browser/WebGPU rendering NOT covered.`);
