#!/usr/bin/env python3
from pathlib import Path
p=Path('src/voyage/VoyageM1.js')
s=p.read_text()
s=s.replace("import {beginShipClimb} from '../ship/ShipLadder.js';", "import {beginShipClimb,beginCabinDoorExit,beginCabinDoorEnter} from '../ship/ShipLadder.js';\nimport {DutchLowerHold} from '../ship/DutchLowerHold.js';")
s=s.replace("this.storageSpace=new ShipStorageSpace(this.interior);app.player.shipInterior=this.interior;app.player.deckLayer='deck';", "this.storageSpace=new ShipStorageSpace(this.interior);\n  this.lowerHold=app.boat.heritageDeck?new DutchLowerHold(app.boat):null;\n  this.lowerStorageSpace=this.lowerHold?new ShipStorageSpace(this.lowerHold):null;\n  app.player.shipInterior=this.interior;app.player.lowerHold=this.lowerHold;app.player.deckLayer='deck';")
old="""    if(p.deckLayer==='hold'){
      // V44.1: stored chest remains an actual visible ship-local item."""
new="""    if(p.deckLayer==='lowerHold'){
      // Source-mesh main hatch: lower cargo deck, not the captain's quarters.
      if(this.cargo.heldBy.has(this.actorId))
        add('lower_stow',L('[E] 将宝箱放在下层货舱','[E] Stow chest in lower hold'),p.position,1.35,235,()=>this.stow());
      for(const item of this.cargo.listShipHold(STORMWAKE_M1.shipId)){
        const point=this.localWorld(item.holdLocal||{x:0,y:this.lowerHold.layout.floorY,z:0});
        add('lower_take:'+item.id,L('[E] 拿取船舱货物','[E] Take lower hold cargo'),point,1.65,240,()=>this.retrieve(item.id));
      }
      if(this.lowerHold?.inHatch(p.deckPos))
        add('lower_exit',L('[E] 爬真实货舱梯返回甲板','[E] Climb cargo ladder to main deck'),this.holdWorldAt(this.lowerHold),1.8,280,()=>this.toggleLowerHold());
      return items;
    }
    if(p.deckLayer==='hold'){
      // V44.1: stored chest remains an actual visible ship-local item."""
assert old in s;s=s.replace(old,new)
needle="""      if(this.interior.inHatch(p.deckPos))add('climb',L('[E] 爬上舱口梯回甲板','[E] Climb ladder back to deck'),ladder,1.6,190,()=>this.toggleHold());
      return items;"""
replacement="""      if(this.interior.inHatch(p.deckPos))add('climb',L('[E] 爬上舱口梯回甲板','[E] Climb ladder back to deck'),ladder,1.8,285,()=>this.toggleHold());
      // This E action was unreachable in V52: the source door was only offered
      // when deckLayer==='deck', but crossing into the room set layer='hold'.
      const originalDoor=this.app.boat.originalDoor;
      const innerDoor={x:-.88,y:this.interior.floorAt(-7.28)+.40,z:-7.26};
      if(originalDoor && Math.hypot(p.deckPos.x-innerDoor.x,p.deckPos.z-innerDoor.z)<.92){
        add('cabin_door_exit',originalDoor.open?L('[E] 沿原船门内台阶走出船长室','[E] Climb steps out through original door'):L('[E] 从室内打开原船门','[E] Open original door from inside'),
          this.localWorld(innerDoor),1.35,299,()=>{
            if(!originalDoor.open){originalDoor.set(true);return true;}
            return beginCabinDoorExit(p,this.interior,originalDoor);
          });
      }
      return items;"""
assert needle in s;s=s.replace(needle,replacement)
needle="""    if(originalDoor && p.deckPos && p.deckLayer==='deck' &&
       Math.hypot(p.deckPos.x-originalDoor.local.x,p.deckPos.z-originalDoor.local.z)<1.35){
      add('dutch_original_door',originalDoor.open?L('[E] 关闭原船门板','[E] Close original door'):L('[E] 打开原船门板','[E] Open original door'),
          this.localWorld(originalDoor.local),1.55,255,()=>{originalDoor.toggle();return true;});
    }
    if(!p.stationId&&p.deckPos&&this.interior.inHatch(p.deckPos)){const hatch=this.holdWorld(this.interior.layout.deckY);"""
replacement="""    if(originalDoor && p.deckPos && p.deckLayer==='deck' &&
       Math.hypot(p.deckPos.x-originalDoor.local.x,p.deckPos.z-originalDoor.local.z)<1.35){
      add('dutch_original_door',originalDoor.open?L('[E] 沿原船门进入船长室','[E] Enter captain quarters through original door'):L('[E] 打开原船门板','[E] Open original Dutch door'),
          this.localWorld(originalDoor.local),1.65,265,()=>{
            if(!originalDoor.open){originalDoor.set(true);return true;}
            return beginCabinDoorEnter(p,this.interior,originalDoor);
          });
    }
    if(this.lowerHold&&!p.stationId&&p.deckPos&&this.lowerHold.inHatch(p.deckPos)){
      add('lower_hatch',L('[E] 沿主甲板货舱梯进入船舱','[E] Climb down into real lower cargo hold'),
          this.holdWorldAt(this.lowerHold,true),1.8,282,()=>this.toggleLowerHold());
    }
    if(!p.stationId&&p.deckPos&&this.interior.inHatch(p.deckPos)){const hatch=this.holdWorld(this.interior.layout.deckY);"""
assert needle in s;s=s.replace(needle,replacement)
needle=""" holdWorld(y){const b=this.app.boatCtl;if(typeof b.toWorld==='function')return b.toWorld(new Vector3(this.interior.layout.x,y,this.interior.layout.z),new Vector3());"""
replacement=""" holdWorldAt(interior,upper=false){const h=interior.layout;return this.localWorld({x:h.x,y:upper?h.deckY:h.floorY,z:h.z});}
 holdWorld(y){const b=this.app.boatCtl;if(typeof b.toWorld==='function')return b.toWorld(new Vector3(this.interior.layout.x,y,this.interior.layout.z),new Vector3());"""
assert needle in s;s=s.replace(needle,replacement)
needle=""" toggleHold(){
  if(this.app.boat.heritageDeck && !this.app.boat.captainCabin)return false;"""
replacement=""" toggleHatchAt(){
  const p=this.app.player;
  if(p?.deckLayer==='lowerHold'||(p?.deckLayer==='deck'&&this.lowerHold?.inHatch(p.deckPos)))return this.toggleLowerHold();
  return this.toggleHold();
 }
 toggleLowerHold(){
  const p=this.app.player,room=this.lowerHold;
  if(!room||p.mode!=='deck'||p.stationId||!p.deckPos||p.shipClimb||!room.inHatch(p.deckPos))return false;
  const entering=p.deckLayer!=='lowerHold';
  if(!entering&&p.deckLayer!=='lowerHold'||entering&&p.deckLayer!=='deck')return false;
  if(!beginShipClimb(p,room,entering))return false;
  this.toast(entering?L('进入真正的下层货舱，C/E 可爬梯返回。','Inside lower hold, C/E climb out.'):L('已从下层货舱回到甲板。','Returned to main deck.'),2.1);
  return true;
 }
 toggleHold(){
  if(this.app.boat.heritageDeck && !this.app.boat.captainCabin)return false;"""
assert needle in s;s=s.replace(needle,replacement)
s=s.replace("if(p.mode!=='deck'||p.stationId||!p.deckPos||!this.interior.inHatch(p.deckPos))return false;", "if(p.mode!=='deck'||p.stationId||!p.deckPos||p.shipClimb||!['deck','hold'].includes(p.deckLayer)||!this.interior.inHatch(p.deckPos))return false;")
s=s.replace("if(player?.mode!=='deck'||(player.deckLayer!=='hold' && !this.app.boat.heritageDeck)||!player.deckPos||", "if(player?.mode!=='deck'||(player.deckLayer!=='lowerHold'&&player.deckLayer!=='hold' && !this.app.boat.heritageDeck)||!player.deckPos||")
# Treasure storage uses real interior when in lowerHold rather than an aft raised-rail box.
needle="""  if(this.app.boat.heritageDeck){
    const site=this.stationLocal('carry');
    if(p.mode!=='deck'||p.deckLayer!=='deck'||Math.hypot(p.deckPos.x-site.x,p.deckPos.z-site.z)>1.8){"""
replacement="""  if(this.app.boat.heritageDeck&&p.deckLayer==='lowerHold'&&this.lowerHold){
    if(this.net.connected){this.toast(L('联机货舱存储尚未验收','Network cargo hold storage not yet verified'));return false;}
    const id=this.cargo.heldBy.get(this.actorId);
    const slot=this.lowerStorageSpace.nearestFree(p.deckPos,this.cargo.items.values(),id);
    if(!id||!slot)return false;
    if(!this.cargo.tryStow(this.actorId,STORMWAKE_M1.shipId,slot))return false;
    this.voyage.stow();this._persistCargo();
    this.toast(L('已放在真实下层货舱。','Cargo stowed below deck.'));return true;
  }
  if(this.app.boat.heritageDeck){
    const site=this.stationLocal('carry');
    if(p.mode!=='deck'||p.deckLayer!=='deck'||Math.hypot(p.deckPos.x-site.x,p.deckPos.z-site.z)>1.8){"""
assert needle in s;s=s.replace(needle,replacement)
s=s.replace("const bilge=p.mode==='deck'&&p.deckLayer==='hold';", "const bilge=p.mode==='deck'&&['hold','lowerHold'].includes(p.deckLayer);")
s=s.replace("const hole=p.mode==='deck'&&p.deckLayer==='hold'?", "const hole=p.mode==='deck'&&['hold','lowerHold'].includes(p.deckLayer)?")
s=s.replace("if(p.stationId||!p.deckPos||p.deckLayer==='hold')", "if(p.stationId||!p.deckPos||p.deckLayer!=='deck')")
s=s.replace("if(!this.stations.valid(id)||this.cargo.heldBy.has(this.actorId)||this.app.player.deckLayer==='hold')", "if(!this.stations.valid(id)||this.cargo.heldBy.has(this.actorId)||this.app.player.deckLayer!=='deck')")
s=s.replace("const lower=this.hud.querySelector('[data-v43-hold]');if(lower)lower.textContent=player.mode==='deck'?(player.deckLayer==='hold'?", "const lower=this.hud.querySelector('[data-v43-hold]');if(lower)lower.textContent=player.mode==='deck'?(player.deckLayer==='lowerHold'?L('【真实下层货舱】WASD 移动 · 到梯口按 C/E 上甲板','[Lower cargo hold] WASD · C/E at ladder to exit'):player.deckLayer==='hold'?L('【船长室】舱口梯 C/E 返回；后舱小门 E 开门后出入','[Captain quarters] C/E hatch, E original door'):" )
p.write_text(s)
