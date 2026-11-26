// V77: services consume the existing wallet, never a separate shadow currency.
import {canOreForge,forgeWithOre,oreRecipe,sellResources,RESOURCE_NAMES} from '../game/UndergroundLedgerV85.js';
import {PERSONAL_WEAPONS} from './PersonalWeapons.js';
import {SCENERY_SITES} from './ScenerySitesV76.js';
import {strikeLineBlocked} from './LandCombatTiming.js';
import {FORGE_COSTS,REST_COST,WEAPON_IDS,forgedDamage} from '../game/LandForge.js';
export function serviceAccess(a,id){const target=SCENERY_SITES.find(s=>s.id===id)?.service,p=a.app.player?.position;
 if(!target||!p||a.app.player.mode!=='walk'||a.hp<=0||a.deathTimer>0||a.battleTimer>0||a.pendingStrike||a.attackCooldown>0||a.raidActive)return false;
 if(Math.hypot(p.x-target.x,p.z-target.z)>2.5||Math.abs(p.y-target.y)>1.5)return false;
 if(!a.sceneryV76?.items.get(id)?.root)return false;
 return !strikeLineBlocked(a.app.colliders,{x:p.x,y:p.y+1.2,z:p.z},{x:target.x,y:target.y+1.2,z:target.z},.35);
}
export class ExpeditionServicesV77{
 constructor(a){this.a=a;this.app=a.app;this.active=false;this.site=null;this.lastRest=-Infinity;if(typeof document==='undefined')return;
 const el=document.createElement('section');el.className='expedition-service';el.hidden=true;el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','service-title-v77');el.innerHTML='<div class="expedition-service-card"><header><div><small data-service-eyebrow></small><h2 id="service-title-v77"></h2></div><button type="button" data-service-close aria-label="关闭">×</button></header><div class="expedition-service-ledger" data-service-ledger></div><p class="expedition-service-intro" data-service-intro></p><div data-service-options></div><p class="expedition-service-status" role="status" data-service-status></p><footer>Esc 返回探索 · 交易前会重新检查金币、距离和战斗状态</footer></div>';document.body.append(el);this.root=el;
 el.querySelector('[data-service-close]').onclick=()=>this.close();el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();this.close();}else if(e.key==='Tab'){const bs=[...el.querySelectorAll('button:not(:disabled)')],i=bs.indexOf(document.activeElement);if(bs.length&&(e.shiftKey&&i<=0||!e.shiftKey&&i===bs.length-1)){e.preventDefault();bs[e.shiftKey?bs.length-1:0].focus();}}});
 }
 get wallet(){return this.app.game?.state;}
 get coop(){return !!(this.app.crew?.connected||this.app.voyageM1?.net?.connected|| (typeof location!=='undefined'&&new URLSearchParams(location.search).get('coop')==='1'));}
 level(id){return this.wallet?.landForge?.[id]||0;}
 open(id){if(this.active||!this.root||!serviceAccess(this.a,id))return false;this.site=id;this.active=true;this.root.hidden=false;this.savedEnabled=this.app.input.enabled;this.app.input.enabled=false;document.exitPointerLock?.();this.render('');this.root.querySelector('[data-service-close]').focus();return true;}
 close(){if(!this.active)return;this.active=false;this.site=null;this.root.hidden=true;this.app.input.resetPhysicalState?.();if(this.a.deathTimer>0||this.a.hp<=0){this.a.deathInput=this.savedEnabled;this.app.input.enabled=false;}else this.app.input.enabled=this.savedEnabled;}
 update(){if(this.active&&!serviceAccess(this.a,this.site))this.close();}
 act(id){const a=this.a,w=this.wallet;if(!this.active||!serviceAccess(a,this.site)||!w)return '服务已中断，请重新靠近。';if(this.coop)return '联机模式暂不开放本地强化与恢复交易。';
 if(this.site==='forge'&&id==='sell-ore'){const total=sellResources(w);return total?`已出售资源，获得 ${total} 金币。`:'无资源或存档写入失败。';}
 if(this.site==='forge'&&id.startsWith('ore:')){const weapon=id.slice(4);return forgeWithOre(w,weapon)?`${PERSONAL_WEAPONS[weapon].name} 已用矿石强化至 +${this.level(weapon)}。`:'材料不足、已满级或存档失败。';}
 if(this.site==='forge'&&WEAPON_IDS.includes(id)){const result=w.buyLandForge(id);return result.ok?`${PERSONAL_WEAPONS[id].name} 已强化至 +${result.level}。`:({funds:'金币不足。',max:'已达到最高强化等级。',save:'存档写入失败，未扣款。'}[result.reason]||'交易未完成。');}
 if(this.site==='tavern'&&id==='rest'){if(a.hp>=100&&a.stamina>=100)return '生命和体力已满。';if(a.time-this.lastRest<45)return '刚刚休息过，请稍后再来。';if(!w.payLandService(REST_COST))return '金币不足或存档写入失败，未扣款。';this.lastRest=a.time;a.hp=Math.min(100,a.hp+40);a.stamina=Math.min(100,a.stamina+60);return '热食与休息已完成：生命 +40、体力 +60（不超过上限）。';}return '无效服务。';}
 render(message){const e=this.root;if(!e)return;const get=n=>e.querySelector('[data-service-'+n+']');get('eyebrow').textContent=this.site==='forge'?'东部古道 / 武器工坊':'东部古道 / 远征补给';e.querySelector('h2').textContent=this.site==='forge'?'铁匠工坊':'远征酒馆';get('ledger').textContent=`金币 ${Math.floor(this.wallet?.money||0)}   ·   生命 ${Math.ceil(this.a.hp)}/100   ·   体力 ${Math.ceil(this.a.stamina)}/100`;get('intro').textContent=this.coop?'联机模式暂只开放场景参观。':this.site==='forge'?'强化永久提升武器伤害，不改变攻击范围、动画或命中窗口。':'在远征途中补充体力。服务有45秒冷却，不能在战斗中使用。';if(this.site==='forge')get('ledger').textContent+=' · '+Object.entries(RESOURCE_NAMES).map(([k,n])=>n+' '+(this.wallet?.underground?.bag?.[k]||0)).join(' / ');get('status').textContent=message;const options=get('options');options.replaceChildren();
 const add=(id,name,desc,cost,disabled)=>{const b=document.createElement('button');b.type='button';b.className='expedition-service-option';b.disabled=disabled||this.coop;const left=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('small'),right=document.createElement('b');title.textContent=name;detail.textContent=desc;left.append(title,detail);right.textContent=cost; b.append(left,right);b.onclick=()=>{this.render(this.act(id));this.root.querySelector('[data-service-close]').focus();};options.append(b);};
 if(this.site==='forge'){for(const id of WEAPON_IDS){const level=this.level(id),spec=PERSONAL_WEAPONS[id],cost=FORGE_COSTS[level];add(id,`${spec.name} +${level}`,`轻击 ${forgedDamage(spec.light.damage,level)}${cost?' → '+forgedDamage(spec.light.damage,level+1):''} · 重击 ${forgedDamage(spec.heavy.damage,level)}${cost?' → '+forgedDamage(spec.heavy.damage,level+1):''}`,cost?`${cost} 金币`:'已满级',!cost||!this.wallet||this.wallet.money<cost);const recipe=oreRecipe(level);if(recipe)add('ore:'+id,`${spec.name} · 矿石强化`,Object.entries(recipe).filter(([,n])=>n).map(([k,n])=>RESOURCE_NAMES[k]+'×'+n).join(' / '),'不消耗金币',!canOreForge(this.wallet,id));}add('sell-ore','出售全部地下资源','出售不可逆；先预留强化所需矿石','出售',!Object.values(this.wallet?.underground?.bag||{}).some(n=>n>0));}
 else add('rest','热食与休息','恢复生命 40、体力 60',`${REST_COST} 金币`,!this.wallet||this.wallet.money<REST_COST||this.a.hp>=100&&this.a.stamina>=100||this.a.time-this.lastRest<45);
 }
}
