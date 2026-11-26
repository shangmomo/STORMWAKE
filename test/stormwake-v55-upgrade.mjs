import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {navigable,nearestSea,lineSafe,buildSafeSeaRoute} from '../src/ship/FreeSeaNavigation.js';
import {ShipStations} from '../src/ship/ShipStations.js';
import {CoopHub} from '../server/coopHub.js';
const root=fileURLToPath(new URL('../', import.meta.url));
const source=(rel)=>readFileSync(join(root,rel),'utf-8');
const pass=(name)=>console.log('✓',name);

// Flat sea, direct non-waypoint voyage: arbitrary 2D point target.
const open={heightAt(){return -40;}};
assert.deepEqual(buildSafeSeaRoute({x:3,z:18},{x:217,z:109},open),[{x:217,z:109}]);
pass('Any precise chart coordinate routes on unobstructed ocean');

// Island in the center must be bypassed without sailing through land.
const island={heightAt(x,z){return (Math.abs(x)<75&&Math.abs(z)<96) ? 8:-24;}};
const src={x:-220,z:0},dest={x:220,z:0};
const safePath=buildSafeSeaRoute(src,dest,island);
assert(safePath?.length>=2,JSON.stringify(safePath));
let at=src;
for(const p of safePath){assert(lineSafe(at,p,island,{ignoreStart:0}),'leg cannot cut through island');at=p;}
assert(Math.hypot(at.x-dest.x,at.z-dest.z)<1);
pass('Route actually bypasses solid island and reaches free destination');

const land={x:0,z:0}; const resolved=nearestSea(land,island);
assert(resolved&&navigable(island,resolved.x,resolved.z));
pass('Land chart click snaps to reachable open water');

// Four physically distinct crank seats control a single shared shaft.
const ship=new ShipStations();
for(let i=0;i<4;i++) {
 const station=i?'anchor_'+(i+1):'anchor';
 assert(ship.claim(station,'sailor'+i));
 ship.setInput(station,'sailor'+i,{axis:1});
}
ship.anchorTravelReady=true;ship.anchorTravel=1;ship.anchorDown=true;ship.update(.1);
assert.equal(ship.anchorHands,4);assert(ship.anchorTravel<.93,ship.anchorTravel);
const fourProgress=1-ship.anchorTravel;
const one=new ShipStations(); assert(one.claim('anchor','one'));
one.anchorTravelReady=true;one.anchorTravel=1;one.anchorDown=true;
one.setInput('anchor','one',{axis:1});one.update(.1);
assert.equal(one.anchorHands,1);assert(fourProgress>3.8*(1-one.anchorTravel));
const crank=ship.anchorCrankTurns; ship.update(.1);assert(ship.anchorCrankTurns>crank);
for(let i=0;i<4;i++)ship.releaseActor('sailor'+i);
ship.update(.1);assert.equal(ship.anchorHands,0);
pass('Four-crew shared windlass: speed scales, shaft rotates, release stops');

// Live multiplayer state: custom arbitrary point broadcast and late-join snapshots.
function fakeSocket(){const messages=[];return {destroyed:false,messages,write(frame){const len=(frame[1]&127)===126?frame.readUInt16BE(2):frame[1]&127;const n=(frame[1]&127)===126?4:2;messages.push(JSON.parse(frame.subarray(n,n+len).toString()));},end(){this.destroyed=true;}};}
const hub=new CoopHub(); const s1=fakeSocket(),s2=fakeSocket();
const p1=hub.join(s1),p2=hub.join(s2);
assert(p1&&p2);hub.handle(p1,{type:'hello',name:'captain'});hub.handle(p2,{type:'hello',name:'deckhand'});
hub.handle(p1,{type:'nav_target',id:'custom',x:-417.5,z:1762.33});
assert.equal(hub.navigationTarget.x,-417.5);
assert(s2.messages.some(x=>x.type==='nav_target'&&x.x===-417.5));
hub.handle(p2,{type:'nav_target',id:'custom',x:9000,z:-33});
assert.equal(hub.navigationTarget.x,-417.5,'reject out of chart bounds');
const s3=fakeSocket();const p3=hub.join(s3);assert(p3);
assert.deepEqual(s3.messages.find(x=>x.type==='welcome').navigationTarget,hub.navigationTarget);
pass('Co-op broadcast, bounds validation, late-join target synchronization');

const app=source('src/App.js');
assert(!app.includes('boatCtl.teleportTo( 92, 120')&&!app.includes('boatCtl.teleportTo(92,120')); 
assert(app.includes('this.boatCtl.moored = true'));
assert(app.includes('dryHoldCamera'));
assert(source('src/player/Player.js').includes('advanceBoarding(dt)'));
assert(source('src/islandlife/OceanChart.js').includes('selectAtMap(clientX,clientY,rect)'));
assert(source('src/land/LandAdventure.js').includes('LandFootPlant'));
assert(existsSync(join(root,'START_STORMWAKE_V55.cmd'))&&existsSync(join(root,'start_v55.py')));
pass('Source integration: land spawn, berth, hold mask, boarding, boss rig, startup');
console.log('STORMWAKE V55 focused regression PASS');
