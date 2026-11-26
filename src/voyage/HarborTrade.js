export const HARBOR_CATALOG=Object.freeze({
 planks:{price:30,label:'三块修船木板',contents:{plank:3}},
 cannonballs:{price:24,label:'六枚实心炮弹',contents:{cannonball:6}},
 chainshot:{price:40,label:'两枚链弹',contents:{chainshot:2}},
 rations:{price:15,label:'三份船员口粮',contents:{food:3}},
 deep_optics:{price:450,label:'潜艇探照灯升级',upgrade:'deepOptics'},
 deep_sonar:{price:600,label:'潜艇声呐升级',upgrade:'deepSonar'}
});
export function buyHarborItem(voyage,cargo,kind){
 const item=HARBOR_CATALOG[kind];if(!item||voyage.tideCoin<item.price)return {ok:false,reason:'funds'};
 voyage.upgrades??=[];if(item.upgrade&&voyage.upgrades.includes(item.upgrade))return {ok:false,reason:'owned'};
 if(item.upgrade){voyage.tideCoin-=item.price;voyage.upgrades.push(item.upgrade);voyage.persist();return {ok:true,upgrade:item.upgrade};}
 let serial=(voyage.tradeCounter||0)+1;while(cargo.get('harbor_supply_'+serial))serial++;const id='harbor_supply_'+serial;const slot=[-75,-73.8,-72.6].find(z=>![...cargo.items.values()].some(c=>c.state==='world'&&Math.hypot(c.x-60,c.z-z)<.9));if(slot===undefined)return {ok:false,reason:'occupied'};
 if(!cargo.spawnChest(id,{x:60,y:2.05,z:slot}))return {ok:false,reason:'occupied'};
 Object.assign(cargo.get(id),{origin:'supplies',supplyKind:kind});voyage.tradeCounter=serial;voyage.tideCoin-=item.price;voyage.persist();return {ok:true,id};
}
export function unpackHarborSupply(cargo,itemId,inventory){
 const item=cargo.get(itemId),definition=HARBOR_CATALOG[item?.supplyKind];if(!item||item.origin!=='supplies'||item.state!=='hold'||!definition?.contents)return {ok:false};
 if(Object.entries(definition.contents).some(([kind,amount])=>inventory.count(kind)+amount>999))return {ok:false,reason:'full'};
 for(const [kind,amount] of Object.entries(definition.contents))inventory.put(kind,amount);cargo.remove(itemId);return {ok:true,contents:{...definition.contents}};
}
