import {shipToWorld} from '../voyage/CargoReach.js';
// Socket measured on Quaternius Ship_Large's main mast, after the same
// +90 degree alignment, .67 art scale and per-vessel gameplay scale.
export function ghostLampSocket(ship,index){if(!ship)return null;const scale=index===0?1.5:1.14,x=(ship.pitch||0)/2,y=(ship.yaw||0)/2,z=(ship.roll||0)/2,c1=Math.cos(x),c2=Math.cos(y),c3=Math.cos(z),s1=Math.sin(x),s2=Math.sin(y),s3=Math.sin(z);return shipToWorld({x:ship.x,y:ship.heave??.14,z:ship.z,yaw:ship.yaw||0,rotation:{x:s1*c2*c3+c1*s2*s3,y:c1*s2*c3-s1*c2*s3,z:c1*c2*s3-s1*s2*c3,w:c1*c2*c3+s1*s2*s3}},{x:0,y:7.1*.67*scale,z:-1.82*.67*scale});}
