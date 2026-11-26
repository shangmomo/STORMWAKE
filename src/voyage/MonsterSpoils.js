const values={shark:450,turtle:450,squid:450,leviathan:1200};
export function spawnMonsterSpoil(cargo,boss,spawn,position,redeemed=new Set()){
 if(!Object.hasOwn(values,boss)||typeof spawn!=='string')return false;const id='hunt_spoil_'+boss+'_'+spawn;
 if(redeemed.has(id)||!cargo.spawnChest(id,{x:position.x,y:0,z:position.z}))return false;
 Object.assign(cargo.get(id),{origin:'monster',floating:true,boss,receipt:spawn});return true;
}
export function sellMonsterSpoils(cargo,voyage,shipId='stormwake'){
 const receipts=[];let reward=0;voyage.redeemedSpectral??=new Set();
 for(const item of cargo.listShipHold(shipId)){if(item.origin!=='monster'||!Object.hasOwn(values,item.boss)||voyage.redeemedSpectral.has(item.id))continue;voyage.redeemedSpectral.add(item.id);reward+=values[item.boss];receipts.push({boss:item.boss,receipt:item.id});cargo.remove(item.id);}
 if(receipts.length){voyage.tideCoin+=reward;voyage.repHunt+=receipts.length*2;voyage.persist();}return {reward,count:receipts.length,receipts};
}
