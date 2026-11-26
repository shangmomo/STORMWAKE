// Original native-WebGPU adaptation of elemental skill concepts. Shared by
// client and authoritative server; no dependency on a second renderer.
export const ELEMENTAL = Object.freeze({
 frost_lance: {name:'霜枪裂潮', radius:42, windup:2.1, factor:.82, color:0x8deaff, shape:'ice'},
 storm_lance: {name:'雷枪风暴', radius:55, windup:2.3, factor:.88, color:0xaab6ff, shape:'bolt'},
 cinder_fall: {name:'熔火陨潮', radius:58, windup:2.8, factor:.90, color:0xff7a32, shape:'meteor'},
 nova_beam: {name:'新星光束阵', radius:86, windup:3.0, factor:1.0, color:0x7ffcff, shape:'beam'},
 voltaic_snare: {name:'伏雷电牢', radius:50, windup:2.5, factor:.78, color:0xbb8bff, shape:'cage'},
 glacial_crown: {name:'冰冠环阵', radius:45, windup:2.6, factor:.85, color:0x7cd9ff, shape:'crown'},
 flame_field: {name:'深渊焰潮力场', radius:68, windup:2.8, factor:.92, color:0xffa046, shape:'fire'},
});
const rotations={turtle:['glacial_crown','voltaic_snare'],shark:['frost_lance','storm_lance'],squid:['cinder_fall','voltaic_snare'],leviathan:['nova_beam','flame_field','storm_lance']};
export function elementalSkill(def,index,baseCount){
 const list=rotations[def.id]; if(!list||index<0||!Number.isInteger(index))return null;
 const slot=index%(baseCount+list.length); if(slot<baseCount)return null;
 const kind=list[slot-baseCount],s=ELEMENTAL[kind];return {kind,name:s.name,radius:s.radius,windup:s.windup,damage:Math.max(1,Math.round(def.strike*s.factor))};
}
export const isElemental=kind=>Object.hasOwn(ELEMENTAL,kind);
export const elementalRadius=(radius,age)=>Math.min(radius,5+Math.max(0,age)*23);
