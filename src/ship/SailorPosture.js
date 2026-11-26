import {DUTCH_SAILOR} from './HeritageDeck.js';
import {doorEyeHeight} from './HeritageDoorPhysics.js';

export function sailorPosture(world,p){
 let height=doorEyeHeight(p)<DUTCH_SAILOR.eye?DUTCH_SAILOR.doorwayHeight:DUTCH_SAILOR.height;
 if(world?.ceilingAt)for(let i=0;i<9;i++){const angle=i*Math.PI/4,r=i===8?0:DUTCH_SAILOR.radius+.04,ceiling=world.ceilingAt(p.x+Math.cos(angle)*r,p.z+Math.sin(angle)*r,p.y+.75,p.y+DUTCH_SAILOR.height+.05);if(ceiling!==null)height=Math.min(height,Math.max(.98,ceiling-p.y-.055));}
 return {height,eye:Math.min(DUTCH_SAILOR.eye,height-.13),crouched:height<DUTCH_SAILOR.height-.08};
}
