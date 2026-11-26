import {modalActive,typingTarget} from '../core/ControlPolicy.js';
export const HUD_MODES=['compact','pure','full'];
export class HUDMode {
 constructor(app){this.app=app;this.mode='compact';this.previous='compact';try{const m=localStorage.getItem('stormwake:hud');if(HUD_MODES.includes(m))this.mode=m;}catch{}this.button=document.createElement('button');this.button.type='button';this.button.className='sw-hud-switch';this.button.title='F8 切换 HUD · F7 纯净/恢复';this.button.addEventListener('click',e=>{e.stopPropagation();this.cycle();this.button.blur();});document.body.append(this.button);this.set(this.mode);window.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.altKey||e.metaKey||typingTarget(e.target)||app.playState!=='playing'||!['F7','F8'].includes(e.code))return;e.preventDefault();if(e.code==='F7')this.togglePure();else this.cycle();});}
 set(mode){if(!HUD_MODES.includes(mode))return false;if(mode==='pure'&&this.mode!=='pure')this.previous=this.mode;this.mode=mode;document.body.dataset.swHud=mode;this.button.textContent=({compact:'精简',pure:'纯净',full:'完整'})[mode]+' HUD · F8';this.button.setAttribute('aria-label',this.button.textContent);try{localStorage.setItem('stormwake:hud',mode);}catch{}return true;}
 cycle(){return this.set(HUD_MODES[(HUD_MODES.indexOf(this.mode)+1)%HUD_MODES.length]);}
 togglePure(){return this.set(this.mode==='pure'?this.previous:'pure');}
 updateContext(context){document.body.dataset.swContext=context;this.button.hidden=this.app.playState!=='playing'||modalActive(this.app)||this.mode==='pure';}
}
