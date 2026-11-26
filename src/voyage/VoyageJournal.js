// V42: factual task journal. Each step derives from the authoritative
// VoyageDirector, never from a decorative counter or an invented objective.
import {VOYAGE_GOLD_MOSS} from './VoyageDefs.js';
const STEPS=[
 {zh:'在海风镇接取金潮委托',en:'Accept a Gold Tide commission at harbor',detailZh:'靠近海风镇金潮告示板，按 E 接受。',detailEn:'Approach the Gold Tide notice board and press E.'},
 {zh:'航行到灰苔藏宝区并挖掘',en:'Sail to Moss Isle and dig',detailZh:'在甲板调整舵、主帆与锚；登岛找到绿色石碑，在挖点按住 E 四秒。',detailEn:'Operate helm, sail and anchor; go ashore by the green stones and hold E for four seconds.'},
 {zh:'抱起宝箱并放入货舱',en:'Carry the chest into the hold',detailZh:'按 E 抱起宝箱；携带时无法操作岗位；登船后靠近货舱 E 放入，G 可暂放。',detailEn:'Press E to carry, use E at the hold to stow, or G to set it down temporarily.'},
 {zh:'安全返港并出售',en:'Return safely and sell',detailZh:'将船驶回海风镇码头；下船走到金潮经纪人按 E，领取 120 潮币和 1 声望。',detailEn:'Sail back to the harbor and press E at the broker for 120 TideCoin and 1 reputation.'}
];
export function voyageJournal(phase='offer',english=false){
 const count={offer:0,accepted:1,dug:2,stowed:3,sold:4}[phase]??0;
 return {title:english?VOYAGE_GOLD_MOSS.en:VOYAGE_GOLD_MOSS.zh,
  reward:VOYAGE_GOLD_MOSS.reward,rep:VOYAGE_GOLD_MOSS.rep,completed:count,
  steps:STEPS.map((s,i)=>({title:english?s.en:s.zh,detail:english?s.detailEn:s.detailZh,
   status:i<count?'done':i===count?'active':'locked'}))};
}
