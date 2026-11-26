// V83.2: separate observation from actor position and report real encounter state.
import {REX} from './RexBrain.js';
import {CORSAIR} from './LandCorsairBrain.js';
import {LURKER} from './LurkerV83.js';
import {BEAR_HOME} from './ExpeditionAssetsV73.js';
export const landCoop=app=>app?.qs?.get('coop')==='1'||!!(app?.crew?.connected||app?.voyageM1?.net?.connected||app?.landAdventure?.servicesV77?.coop);
export const landObserver=app=>app.freeCam&&app.camera?.position?app.camera.position:app.player.position;
export const landDistance=(p,q)=>Math.hypot(p.x-q.x,p.z-q.z);
export const corsairAvailable=(stage,app)=>stage>=1||!landCoop(app);
export function bossGuide(a){
 const p=landObserver(a.app),online=landCoop(a.app)||!!a.servicesV77?.coop,stage=a.progress.stage,w=a.app.game?.state;
 const find=type=>a.enemies?.find(e=>e.type===type),receipt=id=>!!w?.rewardReceipts?.includes(id);
 const bear=find('bear'),rex=a.rex,cor=find('corsair'),warden=find('warden'),lurker=find('lurker');
 const model=e=>e?.actor?'可挑战':e?.assetState==='failed'?'模型加载失败（自动重试）':'模型加载中';
 const rows=[
 ['灯塔守望者',warden||{x:-143,z:-275},stage===4||warden?.dead?'已击败':stage<3?'待解锁：灯塔三面镜片':'可挑战'],
 ['荒潮船长',cor||CORSAIR.arena,a.progress.corsairDefeated||cor?.dead?'已击败':online&&stage<1?'待解锁：海风镇告示板':'可挑战'],
 ['灰苔棕熊',bear||BEAR_HOME,online?'仅单人':bear?.dead?'已击败':model(bear)],
 ['暴龙',rex?.e?.dead?{x:310,z:-638}:rex?.e||REX.home,online?'仅单人':rex?.e?.dead&&rex?.status==='ready'?'已击败 · E 复战路牌':rex?.status==='ready'?'可挑战':rex?.status==='rejected'?'模型加载失败（自动重试）':'模型加载中'],
 ['岩湖潜伏者',lurker||LURKER,online?'仅单人':receipt(LURKER.receipt)||lurker?.dead?'已击败':!receipt(LURKER.prerequisite)?'待解锁：上层矿脉':a.rewardOutbox?.pending?.has(LURKER.receipt)?'奖励结算中':'可挑战']
 ];
 return rows.map(([name,q,status])=>({name,status,distance:Math.round(landDistance(p,q)),bearing:(Math.round(Math.atan2(q.x-p.x,p.z-q.z)*180/Math.PI)+360)%360})).sort((a,b)=>a.distance-b.distance);
}
