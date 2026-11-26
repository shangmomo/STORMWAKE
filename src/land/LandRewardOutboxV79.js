const KEY='stormwake:land-reward-outbox:v79';
// Only awards emitted by the actual land runtime are eligible for replay.
const FIXED=new Map([['land:v73:forest-bear',60],['land:v37:corsair',180],['land:v31:lighthouse',250],['land:v31:shrine',30],['land:v31:forest-cache',40],['land:v74:grotto',45],['land:v78:deep-survey',95],['land:v80:mine-sample',120],['land:v81:gallery-inspection',80],['land:v83:lurker',220]]);
export function validLandReward(id,amount){return FIXED.has(id)&&FIXED.get(id)===amount||typeof id==='string'&&/^land:v31:raid:[1-9]\d{0,7}$/.test(id)&&amount===75;}
export class LandRewardOutbox {
 constructor(storage){this.storage=storage;this.pending=new Map();try{const entries=JSON.parse(storage?.getItem(KEY)||'[]');if(Array.isArray(entries))for(const e of entries.slice(0,512)){if(Array.isArray(e)&&validLandReward(e[0],e[1]))this.pending.set(e[0],e[1]);}}catch{}}
 save(){if(!this.storage)return false;try{this.storage.setItem(KEY,JSON.stringify([...this.pending]));return true;}catch{return false;}}
 claim(wallet,amount,id){if(!validLandReward(id,amount))return {status:'invalid',durable:false};if(wallet?.rewardReceipts?.includes(id)){this.pending.delete(id);this.save();return {status:'already',durable:true};}this.pending.set(id,amount);const durable=this.save();return this.tryOne(wallet,id,durable);}
 tryOne(wallet,id,durable=false){if(!this.pending.has(id))return {status:'invalid',durable:false};const amount=this.pending.get(id),already=wallet?.rewardReceipts?.includes(id);if(already||wallet?.grantMoney?.(amount,id)===true){this.pending.delete(id);this.save();return {status:already?'already':'paid',amount,durable:!!wallet?.storage};}return {status:'pending',durable};}
 retry(wallet){if(!wallet)return [];const durable=this.save(),paid=[];for(const [id] of this.pending){const result=this.tryOne(wallet,id,durable);if(result.status==='paid')paid.push({id,amount:result.amount});}return paid;}
}
