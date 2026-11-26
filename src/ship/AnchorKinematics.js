import {outerHalfWidth} from './DutchHullOuterProfile.js';
import {worldToShip} from '../voyage/CargoReach.js';
export const ANCHOR_HAWSE=Object.freeze({x:outerHalfWidth(6.65)+.18,y:1.65,z:6.65});
export const ANCHOR_HEIGHT=1.312;
export const ANCHOR_MAX_CHAIN=34;
export function anchorEyePose({hawseWorld,ship,travel,tether=null}){
 const chain=Math.max(0,Math.min(ANCHOR_MAX_CHAIN,(Number(travel)||0)*ANCHOR_MAX_CHAIN));
 const depth=Number.isFinite(tether?.depth)?Math.max(0,tether.depth):chain+1;
 const contact=chain>.01&&depth<=chain&&!!tether?.point;
 const eyeWorld=contact?{x:tether.point.x,y:hawseWorld.y-depth,z:tether.point.z}:{x:hawseWorld.x,y:hawseWorld.y-chain,z:hawseWorld.z};
 const eyeLocal=worldToShip(ship,eyeWorld);
 return {eyeWorld,eyeLocal,chain,contact,depth};
}
