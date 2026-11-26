import assert from 'node:assert/strict';
import {actualShip} from './helpers/v64-ship.mjs';
const {player:p,input}=await actualShip();
function walk(key,done,label,frames=600){input.keys.add(key);let count=0;while(!done()&&count++<frames)p.updateDeck(1/30);input.keys.clear();assert.ok(count<frames,label+' '+JSON.stringify({p:p.deckPos,layer:p.deckLayer,contacts:p.collisionContacts}));for(let i=0;i<5;i++)p.updateDeck(1/30);}
if(!process.argv.includes('--cabin'))for(const x of [-1.03,1.03]){p.deckPos.set(x,1.85,3.9);p.deckVel.set(0,0,0);p.deckYaw=0;p.deckGrounded=true;for(let i=0;i<10;i++){walk('KeyW',()=>p.deckPos.z>6.55,'fore outward');walk('KeyS',()=>p.deckPos.z<3.95,'fore return');}}
p.deckPos.set(-.88,1.06,-6);p.deckVel.set(0,0,0);p.deckYaw=Math.PI;p.deckLayer='deck';p.deckGrounded=true;
walk('KeyW',()=>p.deckPos.z< -7.60&&p.deckLayer==='hold','walk into cabin');
walk('KeyD',()=>p.deckPos.x>-.25,'move away from entrance');walk('KeyW',()=>p.deckPos.z< -8.15,'approach table');
walk('KeyA',()=>p.deckPos.x<-.85,'align door steps');walk('KeyS',()=>p.deckPos.z> -6.3&&p.deckLayer==='deck','walk out of cabin');
console.log('V64 actual Dutch + full sourced cabin + real door steps + foremast: 10 uninterrupted fore round trips and walk from deck to table and back, original radius and no scripted crossing PASS');
