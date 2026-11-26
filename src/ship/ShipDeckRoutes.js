// Metric retrofit flights at the original Dutch fore/aft stair openings.
// The same definitions cut the source mesh, build treads, and provide support.
export const DECK_FLIGHTS=Object.freeze([
 Object.freeze({id:'aft',x:1.03,width:.86,z0:-5.56,z1:-7.23,y0:.97,y1:1.925,steps:6}),
 Object.freeze({id:'fore_well_port',x:.82,width:.78,z0:6.72,z1:5.6,y0:1.44,y1:1.93,steps:4}),
 Object.freeze({id:'fore_well_starboard',x:-.82,width:.78,z0:6.72,z1:5.6,y0:1.44,y1:1.93,steps:4}),
 Object.freeze({id:'fore',x:1.03,width:.86,z0:1.88,z1:3.62,y0:.84,y1:1.835,steps:6})
]);
export function flightAt(x,z,padding=0){return DECK_FLIGHTS.find(f=>Math.abs(x-f.x)<=f.width/2+padding&&z>=Math.min(f.z0,f.z1)-padding&&z<=Math.max(f.z0,f.z1)+padding)||null;}
export function flightHeight(x,z){const f=flightAt(x,z);if(!f)return null;
 const t=Math.max(0,Math.min(1,(z-f.z0)/(f.z1-f.z0)));
 return f.y0+(f.y1-f.y0)*Math.min(f.steps,Math.floor(t*f.steps)+1)/f.steps;
}
