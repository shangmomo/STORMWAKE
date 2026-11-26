// V60: validate shared hold storage against the actual player/ship positions.
// This is deliberately dependency-free: use in the WebSocket room host and Node QA.
const finite=p=>!!p&&['x','y','z'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k]));
export function shipToWorld(ship,local){
 if(!finite(ship)||!finite(local)||!Number.isFinite(ship.yaw))return null;const q=ship.rotation;
 if(q&&['x','y','z','w'].every(k=>Number.isFinite(q[k]))){const norm=Math.hypot(q.x,q.y,q.z,q.w);if(norm<.99||norm>1.01)return null;const x=q.x/norm,y=q.y/norm,z=q.z/norm,w=q.w/norm,tx=2*(y*local.z-z*local.y),ty=2*(z*local.x-x*local.z),tz=2*(x*local.y-y*local.x);return {x:ship.x+local.x+w*tx+y*tz-z*ty,y:ship.y+local.y+w*ty+z*tx-x*tz,z:ship.z+local.z+w*tz+x*ty-y*tx};}
 const c=Math.cos(ship.yaw),s=Math.sin(ship.yaw);return {x:ship.x+c*local.x+s*local.z,y:ship.y+local.y,z:ship.z-s*local.x+c*local.z};
}
export function worldToShip(ship,world){
 if(!finite(ship)||!finite(world)||!Number.isFinite(ship.yaw))return null;
 const dx=world.x-ship.x,dz=world.z-ship.z,c=Math.cos(ship.yaw),s=Math.sin(ship.yaw);
 const q=ship.rotation;
 if(q&&['x','y','z','w'].every(k=>Number.isFinite(q[k]))){
  const norm=Math.hypot(q.x,q.y,q.z,q.w);if(norm<.99||norm>1.01)return null;
  const x=-q.x/norm,y=-q.y/norm,z=-q.z/norm,w=q.w/norm,dy=world.y-ship.y;
  const tx=2*(y*dz-z*dy),ty=2*(z*dx-x*dz),tz=2*(x*dy-y*dx);
  return {x:dx+w*tx+y*tz-z*ty,y:dy+w*ty+z*tx-x*tz,z:dz+w*tz+x*ty-y*tx};
 }
 return {x:c*dx-s*dz,y:world.y-ship.y,z:s*dx+c*dz};
}
export function cargoArea(local,layer){
 if(!finite(local))return false;
 if(layer==='lowerHold')return Math.abs(local.x)<1.44&&local.z>-4.85&&local.z<3.38&&Math.abs(local.y+.55)<.6;
 if(layer==='hold')return Math.abs(local.x)<1.63&&local.z>-10.7&&local.z< -6.45&&local.y<1.4;
 if(layer==='deck')return Math.abs(local.x)<1.30&&Math.abs(local.z+5.50)<1.0&&local.y>-.45&&local.y<3.2;
 return false;
}
export function canManipulateCargo({player,ship,local,layer,items=[],ignoreId=null,action='stow'}={}){
 if(player?.mode!=='deck'||!['deck','hold','lowerHold'].includes(layer)||player.deckLayer!==layer)return false;
 if(!cargoArea(local,layer))return false;
 const p=worldToShip(ship,player);if(!p)return false;
 // Walking and ship motion are still sampled over a low-rate network.
 if(Math.hypot(p.x-local.x,p.z-local.z)>2.45||Math.abs(p.y-local.y)>2.5)return false;
 if(action==='stow'&&layer==='lowerHold'&&Math.abs(local.x)<.63&&Math.abs(local.z+2.18)<.66)return false;
 if(action==='stow'&&layer!=='deck')for(const item of items){
   if(item.id!==ignoreId&&item.state==='hold'&&item.holdLocal&&Math.hypot(item.holdLocal.x-local.x,item.holdLocal.z-local.z)<.64)return false;
 }
 return true;
}
