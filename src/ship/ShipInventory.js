// Ship-wide supply is authoritative on the host. A chambered cannonball is
// tracked separately from the magazine and cannot be fired twice.
const DEFAULT={cannonball:18,chainshot:4,plank:12,food:8};
export class ShipInventory {
 constructor(initial=DEFAULT){this.stock=new Map();for(const [kind,count] of Object.entries(initial))this.set(kind,count);}
 count(kind){return this.stock.get(kind)||0;}
 set(kind,count){if(!Object.hasOwn(DEFAULT,kind)||!Number.isSafeInteger(count)||count<0||count>999)return false;this.stock.set(kind,count);return true;}
 take(kind,count=1){if(!Number.isSafeInteger(count)||count<1||this.count(kind)<count)return false;this.stock.set(kind,this.count(kind)-count);return true;}
 put(kind,count=1){if(!Number.isSafeInteger(count)||count<1||this.count(kind)+count>999||!Object.hasOwn(DEFAULT,kind))return false;this.stock.set(kind,this.count(kind)+count);return true;}
 serialize(){return Object.fromEntries(this.stock);}
}
