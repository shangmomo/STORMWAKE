import {BufferGeometry,Float32BufferAttribute,Color,Vector3} from '../engine/index.js';
import {CollisionWorld} from '../systems/CollisionWorld.js';
export const REALM=Object.freeze({x:-800,z:-760,length:132,entrance:{x:350,z:-586},returnPoint:{x:348,z:-584},arrival:4,exit:3});
export const CHAMBERS=Object.freeze([{name:'织影巢穴',lo:8,hi:26},{name:'晶甲矿殿',lo:44,hi:68},{name:'失落王庭',lo:90,hi:129}]);
const profile=[[0,4,34],[7,5,34],[11,12,34],[24,12,34],[29,4,33.2],[42,4,29.5],[46,14,29],[66,14,29],[71,4.5,28.1],[88,4.5,23.4],[94,16,23],[124,16,23],[132,7,23]];
export function realmProfile(d){d=Math.max(0,Math.min(REALM.length,d));for(let i=1;i<profile.length;i++){const a=profile[i-1],b=profile[i];if(d<=b[0]){const u=(d-a[0])/(b[0]-a[0]);return {width:a[1]+(b[1]-a[1])*u,y:a[2]+(b[2]-a[2])*u};}}return {width:7,y:23};}
export function realmPoint(x,d){return new Vector3(REALM.x+x,realmProfile(d).y,REALM.z-d);}
export function realmContains(p,pad=0){return !!p&&p.z<=REALM.z+pad&&p.z>=REALM.z-REALM.length-pad&&Math.abs(p.x-REALM.x)<=realmProfile(REALM.z-p.z).width+pad&&p.y>=19-pad&&p.y<=60+pad;}
// Cross sections: continuous floor, irregular walls, high vault, closed ends.
// Every collision triangle is exactly the displayed geometry. No hidden shell.
export function buildRealmGeometry(){const pos=[],col=[],idx=[],floorN=8,archN=24,rows=[];const rock=new Color(0x4c514a),vein=new Color(0x7b7865),floor=new Color(0x686450);const add=(x,y,z,ground)=>{const id=pos.length/3;pos.push(x,y,z);const c=(ground?floor:rock).clone().lerp(vein,.20+.16*Math.sin(x*.54+y*.7+z*.31)+.10*Math.sin(x*1.21-z*.66));col.push(c.r,c.g,c.b);return id;};const q=(a,b,c,d)=>idx.push(a,b,c,a,c,d);
 for(let d=0;d<=REALM.length;d++){const {width:w,y}=realmProfile(d),z=REALM.z-d,row=[];for(let k=0;k<=floorN;k++)row.push(add(REALM.x-w+2*w*k/floorN,y,z,true));for(let k=1;k<archN;k++){const a=Math.PI*k/archN,s=Math.sin(a),c=Math.cos(a),noise=.5*Math.sin(d*.42+k*.82)*s+.24*Math.sin(d*1.2-k*1.1)*s;row.push(add(REALM.x+w*c+(1.4+noise)*c*s,y+(7+w*.45)*s+noise,z,false));}rows.push(row);}
 const stride=rows[0].length;for(let j=1;j<rows.length;j++)for(let i=0;i<stride;i++){const k=(i+1)%stride;q(rows[j-1][i],rows[j-1][k],rows[j][k],rows[j][i]);}
 for(const [j,reverse] of [[0,true],[rows.length-1,false]]){const d=j,z=REALM.z-d,{y}=realmProfile(d),center=add(REALM.x,y+3,z,false);for(let i=0;i<stride;i++){const a=rows[j][i],b=rows[j][(i+1)%stride];idx.push(center,reverse?b:a,reverse?a:b);}}
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('color',new Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();const triangles=[];for(let i=0;i<idx.length;i+=3)triangles.push({id:'v86:realm',vertices:idx.slice(i,i+3).map(k=>pos.slice(k*3,k*3+3))});return {geometry:g,world:new CollisionWorld(triangles)};
}
