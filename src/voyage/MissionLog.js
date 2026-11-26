// V66 mission projection: no duplicate quest counters, rewards or completion writes.
import {CARTOGRAPHER} from './CartographerQuest.js';
import {BEACON,SHIPWRIGHT} from './StormBeaconQuest.js';
import {MERCHANT_SAFE,MERCHANT_START} from './MerchantRescueQuest.js';
import {GHOST_CONTACT} from './GhostLanternQuest.js';
import {DEEP_SAMPLE} from './DeepEchoQuest.js';
const port={x:69.8,z:42},board={x:48,z:-75};
const titles={gold:['金潮 · 灰苔藏宝','Gold Tide · Moss treasure'],cartographer:['失落的制图师','The lost cartographer'],beacon:['风暴信标','Storm beacon'],merchant:['遇险商船','Merchant rescue'],ghost:['幽灵灯笼','Ghost lantern'],deep:['深渊回声','Deep echo']};
const step=(zh,en,target=null)=>({zh,en,target});
const defs={
 gold:{phases:['offer','accepted','dug','stowed','sold'],reward:120,steps:[step('前往海风镇告示板接取航程','Accept at Gold Tide notice board',board),step('驶向灰苔岛，登岛挖掘宝箱','Sail to Moss Isle and dig', {x:-176,z:-42}),step('把宝箱搬入船舱货架','Carry and stow the chest'),step('返港找经纪人出售宝箱','Return to harbor and sell',port)]},
 cartographer:{phases:['offer','accepted','spotted','flying','latched','salvaged','log_held','island','return','completed'],reward:240,steps:[step('在船舱桌上接受制图师委托','Accept at the cabin table'),step('驶向目标，用望远镜确认漂浮箱','Sail to and spot the floating crate',CARTOGRAPHER.site),step('在鱼叉台瞄准并发射；减速至 2m/s 以下','Aim the harpoon at the crate',CARTOGRAPHER.site),step('等待鱼叉命中；失败可重试','Wait for the harpoon hit'),step('在鱼叉台按住 E 回收货箱','Hold E at the harpoon station'),step('潜水取出海底日志','Dive for the log',CARTOGRAPHER.log),step('回船舱桌前阅读日志','Read the log at the cabin table'),step('前往岛屿检查标记','Inspect the island marker',CARTOGRAPHER.island),step('返港与经纪人交付','Return to harbor and deliver',port)]},
 beacon:{phases:['offer','route','sailing','return','completed'],reward:320,steps:[step('找船匠接受信标委托','Accept from shipwright',SHIPWRIGHT),step('到船舱桌选择沿岸或直达路线','Choose route at cabin table'),step('沿航线抵达信标；携带木板下水维修并安装灯芯','Repair beacon with plank and fit wick',BEACON),step('返回港口船匠领取报酬','Return to shipwright',port)]},
 merchant:{phases:['offer','rescue','escort','return','completed'],reward:420,steps:[step('在港口接受商船救援','Accept merchant rescue',port),step('驶近遇险船，堵漏、排水并转移货物','Repair and bail the distressed ship',MERCHANT_START),step('保持在商船附近，护送到安全区','Escort to safe waters',MERCHANT_SAFE),step('返港交付货物','Deliver cargo in harbor',port)]},
 ghost:{phases:['offer','sighting','battle','haul','defend','return','completed'],reward:600,steps:[step('在港口找幽灵任务联系人','Talk to ghost contact',GHOST_CONTACT),step('用望远镜确认幽灵舰队','Spot the ghost fleet'),step('用炮火摧毁三艘船的灯笼','Destroy three spectral lanterns'),step('用鱼叉拖回战利品','Harpoon and recover spoils'),step('抵御登船敌人并存放货物','Defend against boarders and stow cargo'),step('返回港口交付','Return to harbor',port)]},
 deep:{phases:['locked','parts','prepared','diving','return','completed'],reward:900,steps:[step('完成制图师、商船救援及幽灵灯笼委托','Complete cartographer, merchant and ghost quests'),step('寻找 3 个潜艇部件，在港口组装','Find three parts and assemble at harbor'),step('母船驶近深渊区，登艇释放','Sail near trench and release research sub',DEEP_SAMPLE),step('潜航至样本点，停车并采样','Dive to sample and hold still',DEEP_SAMPLE),step('携带样本返回港口','Return sample to harbor',port)]}
};
export function missionLog(v,english=false){const q={gold:v.voyage,cartographer:v.cartographer?.quest,beacon:v.beacon?.quest,merchant:v.merchant?.quest,ghost:v.ghostLantern?.quest,deep:v.deepEcho?.quest};const fleet=['sighting','battle','haul'].includes(q.ghost?.phase)?v.ghostFleet?.snapshot?.()||[]:[];
 return Object.entries(defs).map(([id,d])=>{const state=q[id]||{},phase=state.phase||d.phases[0],index=Math.max(0,d.phases.indexOf(phase)),done=index===d.steps.length;let detail='',target=d.steps[index]?.target||null;
 if(id==='cartographer'&&['accepted','spotted','flying','latched'].includes(phase))target=state.crate||target;
 if(id==='beacon'&&phase==='sailing'){target=state.waypoints?.[state.routeIndex]||BEACON;detail=english?`Repair ${Math.round((state.progress||0)*100)}% · ${state.wick?'wick pending':'wick fitted'}`:`维修 ${Math.round((state.progress||0)*100)}% · ${state.wick?'待装灯芯':'灯芯已装'}`;}
 if(id==='merchant'&&phase==='rescue'){target=state.ship||MERCHANT_START;const damage=state.damage;detail=damage?`Hull / 船体 ${Math.round(damage.integrity??damage.hull?.integrity??0)}%` : '';}
 if(id==='ghost'&&['sighting','battle','haul'].includes(phase)){target=fleet[0]||null;if(phase==='battle')detail=`${english?'Lanterns':'灯笼耐久'} ${state.lamps?.join(' / ')||'–'}`;}
 if(id==='ghost'&&phase==='defend')detail=`${english?'Boarders':'登船敌人'} ${state.boarders?.filter(b=>b.hp>0).length||0}`;
 if(id==='deep'&&phase==='parts')detail=`${english?'Parts':'部件'} ${[0,1,2].filter(i=>(state.parts||0)&(1<<i)).length}/3`;
 if(id==='deep'&&phase==='diving')detail=`${english?'Sample':'采样'} ${Math.round((state.sample||0)*100)}%`;
 const status=done?'done':phase==='failed'?'failed':phase==='locked'?'locked':phase==='offer'?'offer':'active';
 return {id,title:titles[id][english?1:0],phase,status,reward:d.reward,completed:done?d.steps.length:index,total:d.steps.length,target:target&&Number.isFinite(target.x)&&Number.isFinite(target.z)?{x:target.x,z:target.z}:null,detail,steps:d.steps.map((s,i)=>({title:english?s.en:s.zh,status:i<index?'done':i===index?'active':'locked'}))};});
}
export function journalSignature(v){return missionLog(v).map(q=>`${q.id}:${q.phase}:${q.detail}`).join('|');}
