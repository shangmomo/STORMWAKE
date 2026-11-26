export class Cargo {
 constructor(){this.items=new Map();this.heldBy=new Map();this.holds=new Map();}
 spawnChest(id,worldPos){if(!id||this.items.has(id))return false;this.items.set(id,{id,kind:'treasure_chest_small',state:'world',x:worldPos.x,y:worldPos.y||0,z:worldPos.z,actorId:null,shipId:null});return true;}
 get(id){return this.items.get(id)||null;}
 tryPick(actorId,itemId,actorPos=null){if(this.heldBy.has(actorId))return false;const item=this.get(itemId);if(!item||item.state!=='world')return false;if(actorPos&&Math.hypot(actorPos.x-item.x,actorPos.z-item.z)>3.5)return false;
  if(actorPos&&Number.isFinite(actorPos.y)&&Number.isFinite(item.y)&&Math.abs(actorPos.y-item.y)>(item.floating?8:2.3))return false;
  delete item.merchantLocal;item.state='held';item.actorId=actorId;this.heldBy.set(actorId,itemId);return true;}
 tryStow(actorId,shipId,holdLocal=null){const id=this.heldBy.get(actorId);if(!id||!shipId)return false;const item=this.get(id);if(!item||item.state!=='held')return false;item.state='hold';item.actorId=null;item.shipId=shipId;item.onDeck=false;item.deckLocal=null;item.holdLocal=holdLocal&&[holdLocal.x,holdLocal.y,holdLocal.z].every(Number.isFinite)?{x:holdLocal.x,y:holdLocal.y,z:holdLocal.z}:{x:0,y:-.48,z:-1.25};this.heldBy.delete(actorId);if(!this.holds.has(shipId))this.holds.set(shipId,new Set());this.holds.get(shipId).add(id);return true;}
 tryRetrieve(actorId,itemId,shipId){
  if(this.heldBy.has(actorId))return false;const item=this.get(itemId);if(!item||item.state!=='hold'||item.shipId!==shipId)return false;
  this.holds.get(shipId)?.delete(itemId);item.state='held';item.actorId=actorId;item.shipId=null;this.heldBy.set(actorId,itemId);return true;
 }
 tryDrop(actorId,pos,deckLocal=null){const id=this.heldBy.get(actorId);if(!id)return false;const item=this.get(id);if(!item)return false;Object.assign(item,{state:'world',actorId:null,x:pos.x,y:pos.y||0,z:pos.z,onDeck:!!deckLocal,deckLocal:deckLocal?{...deckLocal}:null,holdLocal:null,shipId:null});this.heldBy.delete(actorId);return true;}
 remove(id){const item=this.get(id);if(!item)return false;if(item.actorId)this.heldBy.delete(item.actorId);if(item.shipId)this.holds.get(item.shipId)?.delete(id);return this.items.delete(id);}
 listShipHold(shipId){return [...(this.holds.get(shipId)||[])].map(id=>this.get(id)).filter(Boolean);}
 serialize(){return [...this.items.values()].map(item=>({...item}));}
 deserialize(items=[]){this.items.clear();this.heldBy.clear();this.holds.clear();for(const v of items){if(!v?.id||typeof v.id!=='string'||!['world','held','hold'].includes(v.state))continue;this.items.set(v.id,{...v});if(v.state==='held')this.heldBy.set(v.actorId,v.id);if(v.state==='hold'){if(!this.holds.has(v.shipId))this.holds.set(v.shipId,new Set());this.holds.get(v.shipId).add(v.id);}}}
}
