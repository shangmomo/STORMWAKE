export const CARTOGRAPHER_ISLET={x:-430,z:430,radius:115};
export function isletHeight(x,z){const dx=x-CARTOGRAPHER_ISLET.x,dz=z-CARTOGRAPHER_ISLET.z;return 9-.0045*(dx*dx+dz*dz)+.65*Math.sin(dx*.08)*Math.sin(dz*.1);}
export function bakeAdventureIslet(terrain){
 const c=CARTOGRAPHER_ISLET,{res,origin,texel}=terrain,minX=Math.max(0,Math.floor((c.x-c.radius-origin)/texel)),maxX=Math.min(res-1,Math.ceil((c.x+c.radius-origin)/texel)),minZ=Math.max(0,Math.floor((c.z-c.radius-origin)/texel)),maxZ=Math.min(res-1,Math.ceil((c.z+c.radius-origin)/texel));
 for(let j=minZ;j<=maxZ;j++)for(let i=minX;i<=maxX;i++){const x=origin+(i+.5)*texel,z=origin+(j+.5)*texel,index=j*res+i,top=isletHeight(x,z);if(top<=terrain.heights[index])continue;terrain.heights[index]=top;terrain.rock[index]=top>5?.2:0;terrain.sand[index]=top<5?255:170;terrain.seagrass[index]=top< -1.5&&top> -9?120:0;terrain.rubble[index]=0;terrain.gully[index]=0;terrain.path[index]=0;}
}
