import assert from 'node:assert/strict';
import {SharedSupplyLedger} from '../src/ship/SharedSupplyLedger.js';
const s=new SharedSupplyLedger({cannonball:18,chainshot:4,plank:9,food:8});s.acceptHost({cannonball:18,chainshot:4,plank:9,food:8},0);s.adjust({cannonball:6});s.adjust({cannonball:6});assert.equal(s.stock.count('cannonball'),30);
s.acceptHost({cannonball:17,chainshot:4,plank:9,food:8},0);assert.equal(s.stock.count('cannonball'),29,'a stale pre-delivery firing snapshot preserves both deliveries and consumes the shell');
s.acceptHost({cannonball:23,chainshot:4,plank:9,food:8},1);assert.equal(s.stock.count('cannonball'),29,'acknowledging the first delivery cannot duplicate its six shells');
s.acceptHost({cannonball:29,chainshot:4,plank:9,food:8},2);assert.equal(s.stock.count('cannonball'),29);s.adjust({food:-1});assert.equal(s.stock.count('food'),7);assert.equal(s.adjust({food:-100}),null);s.changeHost();s.acceptHost({cannonball:29,chainshot:4,plank:8,food:7},3);assert.equal(s.stock.count('plank'),8);console.log('V63 shared supply ledger: concurrent delivery/fire, delayed revisions, duplicate-free acknowledgement, finite food and host handoff PASS');
