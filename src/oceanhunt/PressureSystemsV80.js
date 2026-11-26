// Deterministic, host-simulated pressure compartments. Units: HP, fractional
// water capacity, fractional breathable air. No rendering dependencies.
export const SECTION_NAMES=['后工程舱','中战斗舱','前驾驶舱'];
export const sectionAt=z=>z < -4 ? 0 : z > 4 ? 2 : 1;
const clamp=(v,l=0,h=1)=>Math.max(l,Math.min(h,v));
const valid=(v,l,h)=>Number.isFinite(v)&&v>=l&&v<=h;
export const newPressure=()=>({sections:Array.from({length:3},()=>({hp:500,water:0,air:1})),doors:[false,false],pump:true}); // false=open
export function validatePressure(p,hull){return !!p&&Array.isArray(p.sections)&&p.sections.length===3&&p.sections.every(s=>s&&valid(s.hp,0,500)&&valid(s.water,0,1)&&valid(s.air,0,1))&&Array.isArray(p.doors)&&p.doors.length===2&&p.doors.every(d=>typeof d==='boolean')&&typeof p.pump==='boolean'&&Math.abs(totalHull(p)-hull)<.01;}
export const totalHull=p=>p.sections.reduce((a,s)=>a+s.hp,0);
export function copyPressure(p){return {sections:p.sections.map(s=>({...s})),doors:[...p.doors],pump:p.pump};}
export function applyPressureDamage(p,amount,z){if(!Number.isFinite(amount)||amount<=0)return 0;const first=sectionAt(z),order=[first,...[0,1,2].filter(i=>i!==first).sort((a,b)=>Math.abs(a-first)-Math.abs(b-first))];let left=amount;for(const i of order){const n=Math.min(p.sections[i].hp,left);p.sections[i].hp-=n;left-=n;if(left<=0)break;}return amount-left;}
export function repairPressure(p,parts){if(!Number.isInteger(parts)||parts<=0||totalHull(p)<=0||totalHull(p)>=1500)return null;const i=[0,1,2].sort((a,b)=>p.sections[a].hp-p.sections[b].hp)[0];const s=p.sections[i],amount=Math.min(180,500-s.hp);s.hp+=amount;return {section:i,amount,parts:parts-1};}
export function pressurePower(p){const s=p.sections[0];return clamp(.25+.75*s.hp/500-.50*s.water,.18,1);}
export function pressureDrive(p){return {power:pressurePower(p),thrust:clamp(pressurePower(p)*(1-.48*p.sections.reduce((a,s)=>a+s.water,0)/3),.12,1),trim:(p.sections[2].water-p.sections[0].water)*.07,air:Math.min(...p.sections.map(s=>s.air))};}
export function stepPressure(p,depth,dt){dt=clamp(Number.isFinite(dt)?dt:0,0,.05);depth=clamp(Number.isFinite(depth)?depth:0,0,700);const power=pressurePower(p);for(const s of p.sections){const breach=clamp((.82-s.hp/500)/.82);s.water=clamp(s.water+(breach*(.012+.00010*depth)-(p.pump?.042*power:0))*dt);}
 // Transfer water conservatively; closure is a real isolation barrier.
 for(let i=0;i<2;i++)if(!p.doors[i]){const a=p.sections[i],b=p.sections[i+1],f=(a.water-b.water)*.18*dt;a.water-=f;b.water+=f;}
 for(const s of p.sections)s.air=clamp(s.air+((1-s.water)*power*.035-s.water*.065)*dt);
 return pressureDrive(p);}
export function nearBulkhead(pos){if(!pos||!Number.isFinite(pos.x)||!Number.isFinite(pos.z)||Math.abs(pos.x)>1.65)return -1;return [-4,4].findIndex(z=>Math.abs(pos.z-z)<=1.45);}
export function toggleBulkhead(p,index,occupants=[]){if(index!==0&&index!==1)return false;const z=[-4,4][index];if(!p.doors[index]&&occupants.some(a=>a&&Math.abs(a.z-z)<.65&&Math.abs(a.x)<1.5))return false;p.doors[index]=!p.doors[index];return true;}
