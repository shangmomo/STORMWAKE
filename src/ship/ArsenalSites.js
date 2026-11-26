import {deckHeight} from './HeritageDeck.js';
// Real metre positions shared by rendered equipment and quest interactions.
export const ARSENAL_SITES=Object.freeze({
 harpoon:Object.freeze({x:.70,y:deckHeight(7.20,.70)+.43,z:7.20}),
 musket:Object.freeze({x:-1.55,y:deckHeight(-5.10,-1.55)+.46,z:-5.10}),
 spyglass:Object.freeze({x:-1.00,y:deckHeight(-8.80,-1.00)+.33,z:-8.80}),
 storm:Object.freeze({x:-.70,y:deckHeight(7.00,-.70)+.48,z:7.00})
});
export const HARPOON_PIVOT=Object.freeze({x:.70,y:ARSENAL_SITES.harpoon.y+.12,z:6.93});
export const HARPOON_BARREL=1.31;
export const HARPOON_ROPE=Object.freeze({x:1.00,y:ARSENAL_SITES.harpoon.y-.05,z:7.06});
export const HAUL_BOX_SITE=Object.freeze({x:.5,y:deckHeight(4.4,.5)+.35,z:4.4});
export const HAUL_CARGO_SITE=Object.freeze({x:.5,y:deckHeight(4.4,.5)+.02,z:4.4});
export const ARSENAL_OFFSETS=Object.freeze({
 'swivel-harpoon':{x:.09,y:ARSENAL_SITES.harpoon.y-1.05,z:4.73},'barbed-upgrade':{x:.09,y:ARSENAL_SITES.harpoon.y-1.05,z:4.73},
 'musket-rack':{x:-2.48,y:ARSENAL_SITES.musket.y-1.05,z:-3.09},'navigation-optics':{x:-1.55,y:ARSENAL_SITES.spyglass.y-1.21,z:-5.73},
 'storm-coil':{x:.05,y:ARSENAL_SITES.storm.y-1.12,z:4.85}
});
