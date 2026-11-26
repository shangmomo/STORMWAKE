// Room-owned hands and loose objects. Every transfer consumes its source once.
export class SharedDeckSupplies {
 constructor(ledger){this.ledger=ledger;this.hands=new Map();this.loose=new Map();this.bucketStock=true;this.next=1;}
 hand(id){if(!this.hands.has(id))this.hands.set(id,{planks:0,ammo:null,bucket:false});return this.hands.get(id);}
 fits(h,kind){return kind==='plank'?h.planks<3:kind==='bucket'?!h.bucket:['cannonball','chainshot'].includes(kind)&&!h.ammo;}
 give(h,kind){if(kind==='plank')h.planks++;else if(kind==='bucket')h.bucket=true;else h.ammo=kind;}
 consume(id,kind){const h=this.hand(id);if(kind==='plank'){if(!h.planks)return false;h.planks--;}else if(kind==='bucket'){if(!h.bucket)return false;h.bucket=false;}else{if(h.ammo!==kind)return false;h.ammo=null;}return true;}
 take(id,kind){const h=this.hand(id);if(!this.fits(h,kind))return null;let stock=null;
  if(kind==='bucket'){if(!this.bucketStock)return null;this.bucketStock=false;}
  else{stock=this.ledger.adjust({[kind]:-1});if(!stock)return null;}
  this.give(h,kind);return {stock,hand:{...h}};
 }
 drop(id,kind,local){if(!local||['x','y','z'].some(k=>!Number.isFinite(local[k]))||!this.consume(id,kind))return null;
  const item={id:'shared_supply_'+this.next++,kind,local:{...local}};this.loose.set(item.id,item);return item;
 }
 pick(id,itemId){const item=this.loose.get(itemId),h=this.hand(id);if(!item||!this.fits(h,item.kind))return false;this.loose.delete(itemId);this.give(h,item.kind);return true;}
 disconnect(id,local){const h=this.hands.get(id);if(!h)return;if(local){while(h.planks)this.drop(id,'plank',local);if(h.ammo)this.drop(id,h.ammo,local);if(h.bucket)this.drop(id,'bucket',local);}else{const contents={};if(h.planks)contents.plank=h.planks;if(h.ammo)contents[h.ammo]=1;if(Object.keys(contents).length)this.ledger.adjust(contents);if(h.bucket)this.bucketStock=true;}this.hands.delete(id);}
 snapshot(){return {bucketStock:this.bucketStock,items:[...this.loose.values()]};}
}
