// Ship destruction creates one recoverable physical reward, then port delivery.
export function spawnSpectralSpoils(cargo,states,redeemed=new Set()){
 let count=0;for(const ship of states||[]){if(!/^v44_ghost_[0-9]$/.test(ship.id)||ship.hp!==0||ship.state!=='sink')continue;
 const id='spectral_spoil_'+ship.id;if(redeemed.has(id)||!cargo.spawnChest(id,{x:ship.x,y:0,z:ship.z}))continue;
 Object.assign(cargo.get(id),{floating:true,origin:'spectral',reward:ship.id==='v44_ghost_0'?360:140});count++;}return count;
}
export function sellSpectralSpoils(cargo,voyage,shipId='stormwake'){
 let reward=0,count=0;voyage.redeemedSpectral??=new Set();
 for(const item of cargo.listShipHold(shipId)){if(item.origin!=='spectral'||voyage.redeemedSpectral.has(item.id))continue;
 const value=item.id==='spectral_spoil_v44_ghost_0'?360:140;voyage.redeemedSpectral.add(item.id);cargo.remove(item.id);reward+=value;count++;}
 if(count){voyage.tideCoin+=reward;voyage.repHunt+=count;voyage.persist();}return {reward,count};
}
