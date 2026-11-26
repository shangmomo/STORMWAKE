import {worldToShip} from '../src/voyage/CargoReach.js';
import {deckHeight} from '../src/ship/HeritageDeck.js';
import {outerHalfWidth} from '../src/ship/DutchHullOuterProfile.js';
import {HERITAGE_STATION_METERS} from '../src/ship/StationSites.js';
const sites={plank:HERITAGE_STATION_METERS.repair,bucket:HERITAGE_STATION_METERS.bucket,cannonball:{x:-1.14,z:2.05},chainshot:{x:1.14,z:2.05}};
export function publishDeckSupplies(hub,p,stock=null){
 if(stock){if(hub.shipState){hub.shipState.ammo=stock.ammo;hub.shipState.inventoryRevision=stock.inventoryRevision;}hub.broadcast({type:'supply_stock',...stock});}
 if(p){const hand=hub.deckSupplies.hand(p.id);p.carriedPlanks=hand.planks;hub.send(p,{type:'supply_personal',...hand});}
 hub.broadcast({type:'supply_loose',...hub.deckSupplies.snapshot()});
}
export function deckSupplyAction(hub,p,msg){
 const ship=hub.shipState,local=worldToShip(ship,p);if(ship?.shipClass!=='heritage'||p.mode!=='deck'||p.deckLayer!=='deck'||!local||Math.abs(local.z)>11||Math.abs(local.x)>outerHalfWidth(local.z)||hub.cargo.heldBy.has(p.id)||Math.abs(local.y-deckHeight(local.z,local.x))>.8)return;
 const s=hub.deckSupplies,kind=msg.kind;let stock=null;
 if(msg.verb==='take'){const site=sites[kind];if(!site||Math.hypot(local.x-site.x,local.z-site.z)>1.85)return;const result=s.take(p.id,kind);if(!result)return;stock=result.stock;}
 else if(msg.verb==='drop'){if([...hub.pendingLoads.values()].some(load=>load.actorId===p.id&&load.kind===kind))return;if(!s.drop(p.id,kind,{x:local.x,y:deckHeight(local.z,local.x)+.02,z:local.z}))return;}
 else if(msg.verb==='pick'){const item=s.loose.get(msg.itemId);if(!item||Math.hypot(local.x-item.local.x,local.z-item.local.z)>1.35||!s.pick(p.id,msg.itemId))return;}
 else return;
 publishDeckSupplies(hub,p,stock);
}
export function requestCannonLoad(hub,p,stationId){
 const kind=hub.deckSupplies.hand(p.id).ammo;if(!kind){hub.send(p,{type:'supply_notice',text:'请先从弹药箱拿取一发炮弹或链弹'});return;}
 // Reserve the hand item until the simulation host acknowledges the mechanical
 // state. A READY/recoiling gun must never swallow the player's ammunition.
 const pending=[...hub.pendingLoads.entries()].find(([,v])=>v.actorId===p.id);if(pending){hub.broadcast({type:'cannon_load_request',requestId:pending[0],...pending[1]});return;}
 const requestId=p.id+':'+(++hub.loadSequence);hub.pendingLoads.set(requestId,{actorId:p.id,stationId,kind,until:hub.now()+4000});
 hub.broadcast({type:'cannon_load_request',requestId,actorId:p.id,stationId,kind});
}
export function finishCannonLoad(hub,p,msg){
 if(p.id!==hub.hostId)return;const load=hub.pendingLoads.get(msg.requestId);if(!load)return;hub.pendingLoads.delete(msg.requestId);
 if(!msg.accepted){if(load.detached){publishDeckSupplies(hub,null,hub.supplies.adjust({[load.kind]:1}));return;}const actor=hub.players.get(load.actorId);if(actor)hub.send(actor,{type:'supply_notice',text:'火炮尚未复位，手中的弹药已保留'});return;}
 if(load.detached)return;
 if(hub.deckSupplies.consume(load.actorId,load.kind)){const actor=hub.players.get(load.actorId);if(actor)publishDeckSupplies(hub,actor);}
}
