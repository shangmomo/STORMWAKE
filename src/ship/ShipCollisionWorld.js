import {Matrix4,Vector3} from '../engine/index.js';
import {CollisionWorld} from '../systems/CollisionWorld.js';

// Capture static solids once, in the same metric boat frame used by Player.
// Doors, moving capstan arms, cloth, water and climb-only rungs are excluded.
export function bakeShipCollision(boat){
  const triangles=[],roots=[boat.heritageArt?.objects?.get('dutch_ship_medium_hull'),
    boat.captainCabin?.room,boat.captainCabin?.hatchCover,boat.captainCabin?.doorSteps,boat.deckStairs,
    boat.lowerHold?.root?.children?.find(o=>o.name.includes('planked floor'))].filter(Boolean);
  boat.group.updateWorldMatrix(true,true);
  const s=boat.shipScale||{x:1,y:1,z:1};
  const inverse=new Matrix4().makeScale(s.x,s.y,s.z).multiply(new Matrix4().copy(boat.group.matrixWorld).invert());
  const v=new Vector3();
  for(const root of roots)root.traverse(mesh=>{
    const geometry=mesh.geometry,pos=geometry?.attributes?.position;if(!pos)return;
    for(let node=mesh;node;node=node.parent)if(!node.visible)return;
    const m=new Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),indices=geometry.index?.array;
    const count=indices?.length??pos.count;
    for(let i=0;i<count;i+=3){const vertices=[];
      for(let j=0;j<3;j++){const index=indices?indices[i+j]:i+j;
        v.fromBufferAttribute(pos,index).applyMatrix4(m);vertices.push([v.x,v.y,v.z]);}
      // Ignore rigging high above the walkable decks; preserve mast platforms
      // under their existing dedicated colliders.
      if(Math.min(...vertices.map(p=>p[1]))>3.5)continue;
      triangles.push({vertices,id:mesh.name});
    }
  });
  boat.collisionWorld=new CollisionWorld(triangles);return boat.collisionWorld;
}
