import {Vector3} from '../engine/index.js';
// A raised spyglass is a targeted action. Project its prompt along the view
// ray so a nearby weapon rack cannot outrank it merely for being aimed at.
export function sightActionPoint(player){const d=player.getViewDir(new Vector3());return {x:player.position.x+d.x*.75,y:player.position.y+d.y*.75,z:player.position.z+d.z*.75};}
