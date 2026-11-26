"""Idempotent V51->V52 source edits: door/actual cabin route/night lights."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def update(f,old,new):
 p=root/f;v=p.read_text(encoding='utf-8');assert old in v,(f,old[:90]);p.write_text(v.replace(old,new),encoding='utf-8')
update('src/ship/HeritageAssetRig.js',"dutch: '/models/stormwake_v51/dutch_ship_operable.glb'","dutch: '/models/stormwake_v52/dutch_ship_passable.glb'")
update('src/ship/HeritageAssetRig.js',"  const sourceDoor={x:-1.00,y:1.37,z:-6.64};\n  boat.originalDoor={local:sourceDoor,get open(){return doorTarget>0.5;},\n    toggle(){doorTarget=1-doorTarget;return doorTarget>0.5;},\n    set(open){doorTarget=open?1:0;},\n    update(dt){doorAngle+=(doorTarget*1.62-doorAngle)*(1-Math.exp(-Math.max(0,Math.min(.10,dt))*9));hinge.rotation.y=doorAngle;}\n  };", """  // Source Dutch bulkhead mesh has been topologically cut from the V50
  // hull, not given a second overlay door. The *original* door UV/PBR is
  // retained in an enlarged leaf; player and aperture now share metric bounds.
  const sourceDoor={x:-.96,y:1.08,z:-6.635};
  boat.originalDoor={local:sourceDoor,get open(){return doorTarget>0.5;},
    get passable(){return doorAngle>1.15;},
    get angle(){return doorAngle;},
    toggle(){doorTarget=1-doorTarget;return doorTarget>0.5;},
    set(open){doorTarget=open?1:0;},
    update(dt){doorAngle+=(doorTarget*1.70-doorAngle)*(1-Math.exp(-Math.max(0,Math.min(.10,dt))*9));hinge.rotation.y=doorAngle;}
  };""")
update('src/ship/HeritageDeck.js',"if(inRealHatch(x,z)&&maxY>1.40)return null;", "if(inRealHatch(x,z))return null; // cut aperture remains empty at EVERY height")
update('src/ship/HeritageDeck.js',"    boat.helmEye.set(-.65,deckHeight(-6.85,-.65)+1.62,-6.85);", "    boat.helmEye.set(-.65,deckHeight(-6.85,-.65)+.94,-6.85);")
# The door's lower edge is now at source Y=1.635 -> vessel Y=.826;
# the rear lower deck is hidden beneath the raised quarterdeck. Limit the
# body capsule so avatar can genuinely pass through 1.09m clearance.
p=root/'src/ship/HeritageDeck.js';s=p.read_text(encoding='utf-8');prefix="export const DECK_MAIN_Y=.84;"
assert prefix in s
s=s.replace(prefix,"""// New passage is cut into source Dutch geometry at the aft bulkhead.
// All bounds are in the aligned, authoritative vessel frame (metres).
export const DUTCH_AFT_DOOR=Object.freeze({xMin:-1.45,xMax:-.31,z:-6.635,footMin:.82,roof:1.914,height:1.094});
export const DUTCH_SAILOR=Object.freeze({height:.96,eye:.84,radius:.215});
export function inDoorClearance(x,y){return x>DUTCH_AFT_DOOR.xMin+DUTCH_SAILOR.radius &&
  x<DUTCH_AFT_DOOR.xMax-DUTCH_SAILOR.radius && y>=DUTCH_AFT_DOOR.footMin-.1 &&
  y+DUTCH_SAILOR.height<=DUTCH_AFT_DOOR.roof+.02;}
"""+prefix)
p.write_text(s,encoding='utf-8')
# Fix real crossing collision, even if there is no old procedural wall collider.
update('src/player/Player.js',"ORIGINAL_AFT_LADDER,originalAftLadderAccess} from '../ship/HeritageDeck.js'", "ORIGINAL_AFT_LADDER,originalAftLadderAccess,DUTCH_AFT_DOOR,DUTCH_SAILOR,inDoorClearance} from '../ship/HeritageDeck.js'")
update('src/player/Player.js',"const inHold = this.deckLayer==='hold' && !!this.shipInterior;", "const inHold = this.deckLayer==='hold' && !!this.shipInterior;")
update('src/player/Player.js',"const top = c.center.y + c.half.y, bot = c.center.y - c.half.y;\n\t\t\tif ( top <= p.y + DECK_STEP || bot >= p.y + HEIGHT ) continue;", "const top = c.center.y + c.half.y, bot = c.center.y - c.half.y;\n            if ( top <= p.y + DECK_STEP || bot >= p.y + (heritage?DUTCH_SAILOR.height:HEIGHT) ) continue;")
needle="\t\t// Heritage ship: local metre envelope corresponds to the actual Dutch"
insert="""        // V52 source-geometry door aperture: a body-sized swept crossing is
        // accepted only when the REAL hinged panel has swung clear. Beside the
        // aperture, the bulkhead is solid. Raised deck feet (>1.7m) still
        // traverse above the wall using the existing source ladder/upper deck.
        if(heritage && !this.mastClimb && !this.aftLadderClimb && p.y<1.65 &&
           (oldZ-DUTCH_AFT_DOOR.z)*(p.z-DUTCH_AFT_DOOR.z)<=0 &&
           Math.abs(oldZ-p.z)>1e-7){
           if(!b.model.originalDoor?.passable || !inDoorClearance(p.x,p.y)){
             p.z=oldZ;v.z=0;
           }
        }
"""
assert needle in (s:=(root/'src/player/Player.js').read_text(encoding='utf-8'))
s=s.replace(needle,insert+needle)
# IMPORTANT: physical doorway is 1.09m tall. A 1.40m camera would clip roof.
s=s.replace("(heritage?1.40:EYE)","(heritage?DUTCH_SAILOR.eye:EYE)")
s=s.replace("const eye=_v.set(p.x,p.y+Math.max(.25,Math.min(EYE,this.shipInterior.layout.deckY-p.y-.20)),p.z);", "const eye=_v.set(p.x,p.y+Math.max(.25,Math.min(DUTCH_SAILOR.eye,this.shipInterior.layout.deckY-p.y-.20)),p.z);")
s=s.replace("const eye=Math.max(.30,Math.min(EYE,h.deckY-this.deckPos.y-.18));", "const eye=Math.max(.30,Math.min(DUTCH_SAILOR.eye,h.deckY-this.deckPos.y-.18));")
s=s.replace("p.y+1.58", "p.y+1.58") # No-op: cabin colliders handled in their own module
(root/'src/player/Player.js').write_text(s,encoding='utf-8')
update('src/ship/CaptainCabinInterior.js',"p.y+1.58", "p.y+.96")
update('src/ship/CrewVisuals.js',"holder.scale.set(.76/s.x,.76/s.y,.76/s.z)","holder.scale.set(.58/s.x,.58/s.y,.58/s.z)")
# The vessel lamps now share the same authoritative twilight -> night fade as
# island house lamps, with no user-interaction override. Hand lantern unaffected.
update('src/materials/LocalLights.js',"this.scale=boat.shipScale && boat.originalLampsOn===false ? 0 : 1;", "this.scale=1; // V52: automatic G.night fade, no boat.originalLampsOn===false override")
start="""    if(this.app.boat.heritageArt && p.deckPos && p.deckLayer==='deck' &&
       Math.hypot(p.deckPos.x,p.deckPos.z+7.40)<1.2){
       add('original_lanterns',this.app.boat.originalLampsOn===false?L('[E] 点亮原船灯','[E] Light the ship lanterns'):L('[E] 熄灭原船灯','[E] Extinguish ship lanterns'),
           this.localWorld({x:-.3,y:deckHeight(-7.4,-.3),z:-7.4}),1.50,170,()=>{
            this.app.boat.originalLampsOn=this.app.boat.originalLampsOn===false;return true;});
    }
"""
update('src/voyage/VoyageM1.js',start,"    // V52: ship lanterns use the world's day-night cycle, not the E key.\n")
# Ensure original true hatch can be entered without a hidden plane. Return
# through a continuous climb to the identical ship-local x/z coordinate.
update('src/voyage/VoyageM1.js',"p.deckPos.set(0,entering?this.interior.floorAt(this.interior.layout.z):this.interior.layout.deckY,this.interior.layout.z)","p.deckPos.set(this.interior.layout.x,entering?this.interior.floorAt(this.interior.layout.z):this.interior.layout.deckY,this.interior.layout.z)")
print('Applied V52 game patch')
