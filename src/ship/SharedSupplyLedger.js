import {ShipInventory} from './ShipInventory.js';
const KINDS=['cannonball','chainshot','plank','food'];
export class SharedSupplyLedger{
 constructor(initial={cannonball:18,chainshot:4,plank:9,food:8}){this.stock=new ShipInventory(initial);this.revision=0;this.grants=[];this.hostSeen={ammo:this.stock.serialize(),revision:0};}
 changeHost(){this.hostSeen={ammo:this.stock.serialize(),revision:this.revision};}
 acceptHost(ammo,revision=0){
  if(!Number.isSafeInteger(revision)||revision<0||revision>this.revision)return this.stock.serialize();
  if(revision<this.hostSeen.revision)return this.stock.serialize();
  for(const kind of KINDS){if(!Number.isSafeInteger(ammo[kind])||ammo[kind]<0||ammo[kind]>999)continue;
   if(revision===this.revision)this.stock.set(kind,ammo[kind]);
   else{const supplied=this.grants.filter(g=>g.revision>this.hostSeen.revision&&g.revision<=revision).reduce((sum,g)=>sum+(g.contents[kind]||0),0),expected=(this.hostSeen.ammo[kind]??this.stock.count(kind))+supplied,delta=ammo[kind]-expected;this.stock.set(kind,Math.max(0,Math.min(999,this.stock.count(kind)+delta)));}
  }
  this.hostSeen={ammo:{...ammo},revision};return this.stock.serialize();
 }
 adjust(contents){
  if(Object.entries(contents).some(([kind,count])=>!KINDS.includes(kind)||!Number.isSafeInteger(count)||this.stock.count(kind)+count<0||this.stock.count(kind)+count>999))return null;
  const baseAmmo=this.stock.serialize();for(const [kind,count] of Object.entries(contents))this.stock.set(kind,this.stock.count(kind)+count);this.revision++;this.grants.push({revision:this.revision,contents:{...contents}});this.grants=this.grants.filter(g=>g.revision>this.hostSeen.revision);return {baseAmmo,ammo:this.stock.serialize(),inventoryRevision:this.revision};
 }
}
