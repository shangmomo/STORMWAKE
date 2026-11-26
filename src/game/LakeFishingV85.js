import {DEEP_LAKE,lakeDistance} from '../land/UndergroundHallV84.js';
export function lakeFishDepth(terrain,x,z){if(!terrain||![x,z].every(Number.isFinite)||lakeDistance(x,z)>=1.10)return 0;return Math.max(0,DEEP_LAKE.surface-terrain.heightAt(x,z));}
export function lakeCastStart(terrain,eye){return !!(terrain&&eye&&lakeDistance(eye.x,eye.z)<1.9&&eye.y>=DEEP_LAKE.surface+.25&&eye.y<DEEP_LAKE.surface+9&&terrain.heightAt(eye.x,eye.z)>=DEEP_LAKE.surface-.15);}
export function lakeFishHabitat(terrain,x,z,stock=1){return {cave:lakeFishDepth(terrain,x,z)>.25?Math.max(0,Math.min(1,stock)):0};}
