// Source meshes are measured in metres after applying these transforms.
export const SCENERY_SITES=Object.freeze([
 {id:'rock-east',file:'rock02',x:272,z:-253,scale:2.1,yaw:1.1,offset:-.6,range:125},
 {id:'rock-pass',file:'rock02',x:371,z:-368,scale:2.0,yaw:-.7,offset:-.6,range:125},
 {id:'rock-north',file:'rock02',x:461,z:-528,scale:2.2,yaw:2.4,offset:-.7,range:125},
 {id:'rock-valley',file:'rock02',x:355,z:-666,scale:2.2,yaw:.7,offset:-.7,range:125},
 {id:'mountain-east',file:'mountain',x:321,z:-281,scale:2.1,yaw:.6,offset:-2.8,range:230},
 {id:'mountain-north',file:'mountain',x:464,z:-570,scale:1.65,yaw:2.0,offset:-2.0,range:215},
 {id:'tavern',file:'tavern',x:125,z:-190,scale:20,floor:10,offset:3.62,range:95,service:{x:125,y:10.2,z:-192},label:'远征酒馆 · E 休息',message:'战斗期间不能休息。'},
 {id:'forge',file:'forge',x:155,z:-230,scale:.30,floor:13,offset:1.40,range:95,service:{x:157,y:13.15,z:-228},label:'古道铁匠铺 · E 查看工坊',message:'这里可以调查锻炉与工作台；装备强化尚未开放。'},
]);
export const SERVICE_PADS=Object.freeze([{x:125,z:-190,y:10,rx:10,rz:11},{x:155,z:-230,y:13,rx:9,rz:9}]);
export const SERVICE_SPURS=Object.freeze([[[160,-200,15],[142,-203,12],[125,-203,10],[125,-198,10]],[[160,-200,15],[155,-215,13],[155,-224,13]]]);
export const FERN_PATCHES=Object.freeze([{x:-128,z:-210,seed:1},{x:112,z:-220,seed:2},{x:262,z:-321,seed:3},{x:320,z:-568,seed:4},{x:278,z:-662,seed:5}]);
