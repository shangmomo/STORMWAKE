// V71 northern field expedition: three unique survey records and a return-to-port reward.
// No invented dinosaur model is substituted when the licensed asset is absent.
import {Group,Mesh,Vector3} from '../engine/index.js';
import {KitBuilder,loadStallAssets} from '../game/StallKit.js';
import {fitScan} from './ExpeditionArt.js';
import {makeRegionWaypoint} from './LandRegionWaypoints.js';
export const SURVEY=Object.freeze([
 {id:'strata',name:'化石谷 · 岩层调查站',x:329,z:-636,note:'观察沉积层，记录岩层分布。'},
 {id:'tracks',name:'化石谷 · 西侧调查站',x:292,z:-637,note:'记录泥地与古地层的痕迹，避免破坏样本。'},
 {id:'basin',name:'化石谷 · 北部调查站',x:308,z:-674,note:'测量盆地边缘，建立返程路线。'},
]);
export function restoreSurvey(raw){const accepted=raw?.accepted===true,records=accepted?SURVEY.map(p=>p.id).filter(id=>Array.isArray(raw?.records)&&raw.records.includes(id)):[];return {accepted,records,returned:accepted&&raw?.returned===true&&records.length===SURVEY.length};}
export function surveyAction(state,action){const next=restoreSurvey(state);if(action==='accept'){next.accepted=true;}else if(action==='return'){if(next.accepted&&next.records.length===SURVEY.length&&!next.returned)next.returned=true;}else if(next.accepted&&!next.returned&&SURVEY.some(p=>p.id===action)&&!next.records.includes(action))next.records.push(action);return next;}
const STORE='stormwake:fossil-survey:v71';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export class FossilSurvey {
 constructor(adventure){this.adventure=adventure;this.app=adventure.app;let saved=null;try{saved=JSON.parse(localStorage.getItem(STORE));}catch{}this.state=restoreSurvey(saved);
  const {scene,terrainData,colliders}=this.app;this.sites=SURVEY.map(site=>{const root=makeRegionWaypoint(site,terrainData);root.name='V71 '+site.name;scene.add(root);const p=root.position;
   colliders?.addCylinder?.(p.x,p.z,1.30,p.y,p.y+.23,{tag:'v71:survey-marker',walkable:true});colliders?.addCylinder?.(p.x,p.z,.74,p.y+.23,p.y+.65,{tag:'v71:survey-marker'});colliders?.addBox?.(new Vector3(p.x,p.y+1.95,p.z),new Vector3(.10,1.6,.10),0,{tag:'v71:survey-marker'});return {...site,root};});
  this.artReady=typeof document==='undefined'?Promise.resolve(false):loadStallAssets().then(assets=>{
   const K=new KitBuilder(assets,713),props=[];
   for(const site of this.sites){for(const [dx,name,size] of [[2.2,'wooden_crate_02',[.68,.44,.92]],[-2.2,'wooden_crate_01',[.78,.34,.42]]]){const x=site.x+dx,z=site.z,y=terrainData.heightAt(x,z);K.prop(name,fitScan(K.bounds(name),[x,y+size[1]/2,z],size));props.push({x,y,z,size});}
    const x=site.x-2.2,z=site.z,y=terrainData.heightAt(x,z);K.prop('wooden_lantern_01',fitScan(K.bounds('wooden_lantern_01'),[x,y+.34+.25,z],[.22,.50,.22]));}
   const mesh=new Mesh(K.build(),assets.material);mesh.name='V71 Poly Haven field supplies';mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);for(const p of props)colliders?.addBox?.(new Vector3(p.x,p.y+p.size[1]/2,p.z),new Vector3(...p.size).multiplyScalar(.5),0,{tag:'v71:survey-supply'});return true;
  }).catch(e=>{console.warn('[V71] Survey supplies not loaded',e);return false;});
 }
 _save(){try{localStorage.setItem(STORE,JSON.stringify(this.state));}catch{}}
 _apply(action){const before=this.state;this.state=surveyAction(before,action);this._save();return before;}
 wants(point){return this.state.accepted&&!this.state.returned&&this.sites.some(s=>dist(s.root.position,point)<3.4&&Math.abs(s.root.position.y-point.y)<3.2);}
 register(director,player){const a=this.adventure;if(!a.progress.corsairDefeated)return;
  const p=player.position,board=a.board.position;
  if(!this.state.returned&&(!this.state.accepted||this.state.records.length===SURVEY.length))director.add({id:'land:v71-survey-board',position:board,range:3.6,priority:90,label:this.state.accepted?'北部调查 · E 提交三份记录':'北部化石谷 · E 接取勘测委托',perform:()=>{if(!this.state.accepted){this._apply('accept');a._message('前往沉岩峡谷岔路，沿北部古道抵达化石谷，调查三个标记点。',7);}else{const wallet=a.app.game?.state,id='land:v71:fossil-survey';if(wallet&&(wallet.rewardReceipts?.includes(id)||wallet.grantMoney?.(160,id))){this._apply('return');a._message('三份野外调查记录已提交，获得 160 金币。单人模式可返回化石谷追踪暴龙。',7);}else a._message('提交未成功，请重试。',4);}}},player);
  if(!this.state.accepted||this.state.returned)return;
  for(const site of this.sites)director.add({id:'land:v71-survey-'+site.id,position:site.root.position,range:3.4,priority:90,label:this.state.records.includes(site.id)?`${site.name} · 已记录`:`${site.name} · E 调查`,perform:()=>{const old=this._apply(site.id);if(old.records.length!==this.state.records.length)a._message(`${site.note} 已记录 ${this.state.records.length}/3。`,6);else a._message('该站已经记录。',3);}},player);
 }
 journal(point){if(!this.state.accepted||this.state.returned)return null;if(this.state.records.length===SURVEY.length)return {task:'北部调查 · 返回海风港任务公告厅',distance:Math.round(dist(point,this.adventure.board.position))};const remaining=this.sites.filter(s=>!this.state.records.includes(s.id));const s=remaining.sort((a,b)=>dist(point,a.root.position)-dist(point,b.root.position))[0];return {task:`北部调查 · ${this.state.records.length}/3 · ${s.name}`,distance:Math.round(dist(point,s.root.position))};}
}
