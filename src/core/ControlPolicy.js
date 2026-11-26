// V67: single ownership of shortcuts, independent of rendering and frame order.
export const PERSONAL_SLOTS=Object.freeze({Digit1:'cutlass',Digit2:'polearm',Digit3:'rod',Numpad1:'cutlass',Numpad2:'polearm',Numpad3:'rod'});
export const TOOL_SLOTS=Object.freeze({Digit0:'hands',Digit4:'lantern',Digit5:'spyglass',Digit6:'plank',Digit7:'bucket',Digit8:'shovel'});
export function controlContext(app){const p=app?.player;if(!p)return 'none';if(app.hunt?.abyss?.active)return 'abyss';if(app.voyageM1?.deepEcho?.piloting)return 'research';if(app.freeCam)return 'free';if(p.stationId||p.pendingStation)return 'station';if(p.foreignShip)return 'foreign';if(p.shipClimb||p.mastClimb||p.aftLadderClimb||p.boardingClimb)return 'climb';if(p.mode==='walk'||p.mode==='deck')return 'personal';return p.mode;}
export function modalActive(app){const h=app?.game?.hud,u=app?.ui?.ui,v=app?.voyageM1;return !!(h?.invOpen||h?.standOpen||h?.catchOpen||u?._start||u?._help||u?._panelOpen||app?.expedition?.isOpen||app?.homeLife?.sleeping||app?.islandLife?.ui?.isOpen||app?.shipyard?.opened||app?.oceanChart?.opened||app?.hunt?.opened||app?.crew?.overlay?.hidden===false||v?.harborTrade?.opened||v?.journal?.hidden===false||app?.landAdventure?.dialogue?.active||app?.landAdventure?.servicesV77?.active);}
export function canPersonal(app){return controlContext(app)==='personal'&&!modalActive(app)&&!app.player.busy&&app.input?.enabled!==false&&!app.input?.gameplayBlocked&&!app.ui?.ui?._photo&&!app.voyageM1?.cargo?.heldBy?.has(app.voyageM1.actorId)&&!app.voyageM1?.heldAmmo;}
export function personalSelection(input){for(const [key,id] of Object.entries(PERSONAL_SLOTS))if(input.consume(key,'personal'))return id;return null;}
export function toolSelection(input){for(const [key,id] of Object.entries(TOOL_SLOTS))if(input.consume(key,'tools'))return id;return null;}
export function typingTarget(target){return !!(target&&(target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.closest?.('[contenteditable="true"]')));}
export function acceptsKey(e){if(typingTarget(e.target)||e.metaKey||e.altKey)return false;const ctrl=e.code==='ControlLeft'||e.code==='ControlRight';return ctrl||!e.ctrlKey||['KeyW','KeyA','KeyS','KeyD','KeyQ','Space','ShiftLeft','ShiftRight'].includes(e.code);}
export function menuAllowed(app){return !!app?.input?.enabled&&!modalActive(app)&&!['abyss','research','station','climb'].includes(controlContext(app));}
// Process menus before any player, ship, or weapon updates. A closing menu
// discards its opening key and stale held buttons; no same-frame fallthrough.
export function routeFrameMenus(app){
 const i=app.input,h=app.game?.hud,u=app.ui?.ui,v=app.voyageM1;
 const ctx=controlContext(app),blocked=modalActive(app);
 if(i.gameplayBlocked!==blocked)i.setGameplayBlocked(blocked);
 const take=k=>i.menuConsume(k);
 if(!i.enabled)return;
 if(h?.catchOpen){if(take('KeyE')||take('Escape'))app.game.endLanding();return;}
 if(h?.standOpen){if(take('KeyE')||take('Escape'))h.closeStand();return;}
 if(h?.invOpen){if(take('KeyI')||take('Tab')||take('Escape'))h.toggleInventory(false);return;}
 if(blocked||['abyss','research','climb','none'].includes(ctx))return;
 if(ctx==='station'){if(take('F2')&&app.oceanChart?.available&&app.oceanChart.open())i.setGameplayBlocked(true);return;}
 let opened=false;
 if((take('KeyI')||take('Tab'))&&h){h.toggleInventory(true);opened=true;}
 else if(!i.down('ShiftLeft')&&!i.down('ShiftRight')&&v?.journal&&take('KeyP')){v._toggleJournal(true);opened=true;}
 else if(take('F2')&&app.oceanChart?.available){opened=!!app.oceanChart.open();}
 else if(take('F3')&&app.hunt?.available){opened=!!app.hunt.open();}
 else if(take('F4')&&app.expedition){app.expedition.toggle(true);opened=app.expedition.isOpen;}
 if(opened)i.setGameplayBlocked(true);
}
