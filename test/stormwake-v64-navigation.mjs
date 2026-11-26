import assert from 'node:assert/strict';
import {SailWind} from '../src/ship/SailWind.js';
import {SailingCourse} from '../src/ship/SailingCourse.js';
import {CrewAI} from '../src/ship/CrewAI.js';
import {ShipStations} from '../src/ship/ShipStations.js';
const wind=new SailWind({wind:{x:0,z:10}}),state={heading:0,velocity:{x:0,z:0},sailMain:1,sailJib:1,sailTrim:0};
assert.equal(wind.evaluate({...state,sailMain:0,sailJib:0}).thrust,0);assert.equal(new SailWind({wind:{x:0,z:0}}).evaluate(state).thrust,0);assert.equal(wind.evaluate({...state,heading:Math.PI}).thrust,0,'cannot sail straight into the wind');assert.ok(wind.evaluate(state).thrust>1000);
const course=new SailingCourse(),boat={position:{x:0,z:0},getYaw:()=>0},target={x:0,z:-300},point=course.update(.1,boat,target,wind.wind,{heightAt:()=>-50});assert.ok(course.tacking);assert.notEqual(point.x,0);assert.ok(wind.evaluate({...state,heading:Math.atan2(point.x,point.z)}).thrust>0);assert.deepEqual(boat.position,{x:0,z:0},'pilot chooses a course without moving or assigning speed to the ship');assert.equal(new SailingCourse().update(.1,boat,target,wind.wind,{heightAt:()=>20}),null,'unsafe tack cannot cut through land');
const model={shipScale:{x:1,y:1,z:1},heritageDeck:{}},stations=new ShipStations({cooperativeCapstan:true}),crew=new CrewAI(stations,{boat:model}),samples=[],vessel={...boat,model};
for(let i=0;i<600;i++){crew.update(.05,{boat:vessel,wind:wind.evaluate(state),waypoint:{x:0,z:300},autopilot:true,damage:{holes:[],water:0}});stations.update(.05);samples.push(stations.anchorTravel);}
assert.ok(samples.some(x=>x>.1&&x<.9),'a moving sailor must actually wind the mechanical capstan');assert.ok(stations.anchorTravel<.001);assert.ok(stations.sailMain>.9);
for(let i=0;i<600;i++){crew.update(.05,{boat:vessel,wind:wind.evaluate(state),autopilot:true,arriving:true,standby:true,damage:{holes:[],water:0}});stations.update(.05);}
assert.ok(stations.anchorTravel>.999);assert.ok(stations.sailMain<.03,'arrival furls the physical sail');
const manual=new ShipStations(),manualCrew=new CrewAI(manual,{boat:model});manual.sailMain=.4;
for(let i=0;i<100;i++){manualCrew.update(.05,{boat:vessel,damage:{holes:[],water:0}});manual.update(.05);}assert.equal(manual.sailMain,.4,'without a waypoint AI cannot silently change manually set sails');
console.log('V64 sailing: no cloth/no wind/no-go zero thrust, safe 70-degree tacking, no position/speed shortcuts, actual walking crew and gradual capstan/sail operation, arrival furling and manual control preservation PASS');
