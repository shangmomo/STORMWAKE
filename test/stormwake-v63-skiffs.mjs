import assert from 'node:assert/strict';
import {GhostLanternQuest} from '../src/voyage/GhostLanternQuest.js';
import {Cargo} from '../src/voyage/Cargo.js';
const ship={x:30,y:0,z:50,yaw:.7},q=new GhostLanternQuest();q.beginBoarding(ship);const before=q.boarders.map(b=>({...b.world}));q.update(.1,ship);for(let i=0;i<2;i++){const b=q.boarders[i];assert.equal(b.phase,'approach');assert.ok(Math.hypot(b.world.x-before[i].x,b.world.z-before[i].z)<=.280001,'skiff travels at its own bounded world speed');}
for(let i=0;i<50;i++)q.update(.1,ship);assert.ok(q.boarders.every(b=>b.phase==='climb'),'boats reach the hull before sailors begin climbing');const saved=new GhostLanternQuest();assert.ok(saved.deserialize(q.serialize()));assert.deepEqual(saved.boarders,q.boarders);
const evade=new GhostLanternQuest(),cargo=new Cargo();evade.beginBoarding(ship);cargo.spawnChest(evade.cargoId,{x:0,y:0,z:0});cargo.tryPick('crew',evade.cargoId);cargo.tryStow('crew','stormwake');for(let i=0;i<400&&evade.phase==='defend';i++){ship.z+=1;evade.update(.1,ship,cargo);}assert.equal(evade.phase,'return');assert.ok(evade.boarders.every(b=>b.phase==='retreat'),'a fast departing mother ship can outrun the boats rather than dragging them along in its frame');
console.log('V63 boarding skiffs: bounded same-world approach, reach before climb, shared serialized actors and genuine sailing escape alternative PASS');
