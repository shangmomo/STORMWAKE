import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkSnapshot,compareRoomState,checkScreenshotStats} from '../src/qa/Assertions.js';
import {ShipStations} from '../src/ship/ShipStations.js';
const file=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
let tests=0;const test=(name,fn)=>{fn();console.log('✓ '+name);tests++;};
const good=()=>({ready:true,player:{position:{x:0,y:1,z:0},mode:'walk'},
 ship:{position:{x:69,y:0,z:36},moored:true,speed:0,anchor:{down:true,travel:1,turns:0}},
 world:{hour:16.2,weatherSeconds:110},multiplayer:{connected:false,peerCount:0},water:{dryCamera:false},bosses:[]});
test('QA: valid initialized state has no logical failures',()=>{assert.deepEqual(checkSnapshot(good()).failures,[])});
test('QA: gameplay NaN and invalid anchor/clock are hard failures',()=>{
 const s=good();s.player.position.x=NaN;s.ship.anchor.travel=1.4;s.world.hour=25;
 assert.deepEqual(checkSnapshot(s).failures.map(x=>x.id),['player_nan','clock_range','anchor_range']);
});
test('QA: missing peers is a failure, not a fake success',()=>{
 assert(checkSnapshot(good(),{expectConnected:true,expectPeers:1}).failures.some(x=>x.id==='not_connected'));
});
test('QA: dry cabin falling below hull is caught',()=>{
 const s=good();s.player.mode='deck';s.player.deckLayer='lowerHold';s.player.position.y=-12;
 assert(checkSnapshot(s).failures.some(x=>x.id==='cabin_fall'));
});
test('QA: synchronized weather and cyclic 24-hour clocks',()=>{
 const a=good(),b=good();a.world.hour=23.99;b.world.hour=.01;
 a.multiplayer.connected=true;b.multiplayer.connected=true;b.world.weatherSeconds=110.5;
 assert.deepEqual(compareRoomState(a,b).failures,[]);
 b.world.weatherSeconds=121;b.world.hour=13;
 assert(compareRoomState(a,b).failures.some(x=>x.id==='weather_split'));
 assert(compareRoomState(a,b).failures.some(x=>x.id==='clock_split'));
});
test('QA: image black/flat detection can never claim beauty',()=>{
 assert(checkScreenshotStats({width:1440,height:900,luminanceStd:0,blackRatio:.99}).failures.length>=2);
 assert.equal(checkScreenshotStats({width:1440,height:900,luminanceStd:40}).failures.length,0);
});
test('QA: anchor four-player mechanical travel and one-shot reset',()=>{
 const s=new ShipStations();
 for(let i=0;i<4;i++){const id=i?'anchor_'+(i+1):'anchor';assert(s.claim(id,'human'+i));s.setInput(id,'human'+i,{axis:1});}
 const before=s.anchorTravel;s.update(.1);assert(s.anchorTravel<before);assert.equal(s.anchorHands,4);
 s.release('anchor_4','human3');s.update(.1);assert.equal(s.anchorHands,3);
});
test('QA: test interface is opt-in and dev-only; never forces production',()=>{
 const src=file('../src/qa/AutoQA.js');assert(src.includes('import.meta.env.DEV'));
 assert(src.includes("app.qs.has('qa')"));assert(src.includes('installAutoQA'));
 const main=file('../src/main.js');assert(main.includes("import( './qa/AutoQA.js' )"));
});
test('QA: runner supports two real browser contexts and retains evidence',()=>{
 const py=file('../tools/autoqa/runner.py');
 for(const token of ['browser.new_context','page.screenshot','tracing.start',"second=context('crew')",'requestfailed','record_video_dir','report.json'])
  assert(py.includes(token),token);
});
test('VISUAL: lamp meshes and light sources share the same sites',()=>{
 const art=file('../src/ship/HeritageDeck.js'),lights=file('../src/materials/LocalLights.js');
 assert(art.includes('lanternLocalPositions'));assert(lights.includes('boat.heritageDeck?.lanternLocalPositions'));
 assert(art.includes('lanternMesh.castShadow=true'));
});
test('GAMEPLAY: rescue cannot re-accelerate, auto-weigh anchor, or force boarding',()=>{
 const s=file('../src/voyage/VoyageM1.js');
 const body=s.slice(s.indexOf('rescueSoloShip(){'),s.indexOf(' // Direct, explicit first-person equipment.'));
 assert(!body.includes('helmThrottle=.35'));assert(!body.includes('anchorManual=false'));assert(!body.includes('p.boardBoat()'));
 assert(body.includes('helmThrottle=0'));
});
console.log(`V58 AutoQA source/logic tests: ${tests} PASS. Browser rendering NOT included.`);
