import {VOYAGE_GOLD_MOSS,VOYAGE_SAVE_KEY} from './VoyageDefs.js';
const PHASES=['offer','accepted','dug','stowed','sold'];
export class VoyageDirector {
 constructor({storage=null}={}){this.storage=storage;this.phase='offer';this.voyageId=null;this.tideCoin=0;this.repGoldTide=0;this.repLighthouse=0;this.repHunt=0;this.sold=new Set();this.redeemedSpectral=new Set();this.upgrades=[];this.tradeCounter=0;if(storage){try{this.deserialize(JSON.parse(storage.getItem(VOYAGE_SAVE_KEY)||'null'));}catch{}}}
 offer(id=VOYAGE_GOLD_MOSS.id){return id===VOYAGE_GOLD_MOSS.id?VOYAGE_GOLD_MOSS:null;}
 accept(){if(this.phase!=='offer'&&this.phase!=='sold')return false;this.sold.clear();this.phase='accepted';this.voyageId=VOYAGE_GOLD_MOSS.id;this.persist();return true;}
 abandon(){this.phase='offer';this.voyageId=null;this.persist();}
 digDone(){if(this.phase!=='accepted')return false;this.phase='dug';this.persist();return true;}
 stow(){if(this.phase!=='dug')return false;this.phase='stowed';this.persist();return true;}
 sell(itemId){if(this.phase!=='stowed'||this.sold.has(itemId))return false;this.sold.add(itemId);this.phase='sold';this.tideCoin+=VOYAGE_GOLD_MOSS.reward;this.repGoldTide+=VOYAGE_GOLD_MOSS.rep;this.persist();return true;}
 getState(){return {phase:this.phase,voyageId:this.voyageId,objectives:VOYAGE_GOLD_MOSS.objectives,objectiveIndex:{offer:0,accepted:1,dug:3,stowed:4,sold:5}[this.phase]??0,tideCoin:this.tideCoin,repGoldTide:this.repGoldTide};}
 serialize(){return {version:1,phase:this.phase,tradeCounter:this.tradeCounter,upgrades:[...this.upgrades],voyageId:this.voyageId,tideCoin:this.tideCoin,repGoldTide:this.repGoldTide,repLighthouse:this.repLighthouse,repHunt:this.repHunt,redeemedSpectral:[...this.redeemedSpectral].slice(-100),sold:[...this.sold].slice(-100)};}
 deserialize(v){if(!v||typeof v!=='object'||v.version!==1)return false;this.tradeCounter=Number.isSafeInteger(v.tradeCounter)&&v.tradeCounter>=0?v.tradeCounter:0;this.upgrades=Array.isArray(v.upgrades)?v.upgrades.filter(k=>['deepOptics','deepSonar'].includes(k)):[];this.phase=PHASES.includes(v.phase)?v.phase:'offer';this.voyageId=this.phase==='offer'?null:VOYAGE_GOLD_MOSS.id;for(const k of ['tideCoin','repGoldTide','repLighthouse','repHunt'])this[k]=Number.isFinite(v[k])&&v[k]>=0?Math.min(v[k],1e9):0;this.redeemedSpectral=new Set(Array.isArray(v.redeemedSpectral)?v.redeemedSpectral.filter(x=>typeof x==='string'&&x.length<160&&(/^spectral_spoil_v44_ghost_[0-9]$/.test(x)||/^hunt_spoil_(shark|turtle|squid|leviathan)_[a-zA-Z0-9:_-]+$/.test(x))):[]);this.sold=new Set(Array.isArray(v.sold)?v.sold.filter(x=>typeof x==='string').slice(-100):[]);return true;}
 persist(){try{this.storage?.setItem(VOYAGE_SAVE_KEY,JSON.stringify(this.serialize()));}catch{}}
}
