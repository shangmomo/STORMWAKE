import { Vector3 } from '../engine/math/Vector3.js';
// V37: a model's skeleton origin is NOT its feet. Estimate the actual skinned
// sole in model space and reconcile it with the same ground surface used by
// collision/navigation. All math here is deterministic and render-independent.
export function skinnedVertexY( jointData, joints, weights, index, x, y, z ) {
  let result = 0, sum = 0;
  for ( let k = 0; k < 4; k ++ ) {
    const w = weights[index * 4 + k];
    if ( !( w > 0 ) ) continue;
    const j = joints[index * 4 + k], o = j * 16;
    if ( o + 13 >= jointData.length / 2 ) continue;
    result += w * ( jointData[o + 1] * x + jointData[o + 5] * y + jointData[o + 9] * z + jointData[o + 13] );
    sum += w;
  }
  return sum > .5 ? result / sum : y;
}

function allSkinnedVertices( rig, step = 2 ) {
  const out = [], gltf = rig.gltf;
  for ( const node of gltf.nodes ) {
    if ( node.skin !== 0 || node.mesh == null ) continue;
    for ( const p of gltf.meshes[node.mesh] ) {
      const pos = p.attributes.POSITION?.array, joint = p.attributes.JOINTS_0?.array;
      const weights = p.attributes.WEIGHTS_0?.array;
      if ( !pos || !joint || !weights ) continue;
      for ( let i = 0; i < pos.length / 3; i += step ) {
        const y = skinnedVertexY( rig.jointData, joint, weights, i, pos[i*3], pos[i*3+1], pos[i*3+2] );
        if ( Number.isFinite(y) ) out.push({ p:pos, j:joint, w:weights, i, y });
      }
    }
  }
  return out;
}

export function makeFootAnchor( rig ) {
  const points = allSkinnedVertices( rig, 2 );
  if ( points.length < 15 ) return { restY: 0, soleY: () => 0, sampled: 0 };
  points.sort((a,b)=>a.y-b.y);
  // The lowest 0.6% of skinned vertices anchor a planted sole; ignore a
  // single stray vertex that can create metre-scale floating.
  const k = Math.max( 5, Math.min( 42, Math.ceil( points.length * .006 ) ) );
  const samples = points.slice( 0, k );
  const level = () => {
    const values = samples.map(({p,j,w,i})=>skinnedVertexY(rig.jointData,j,w,i,p[i*3],p[i*3+1],p[i*3+2]))
      .filter(Number.isFinite).sort((a,b)=>a-b);
    return values.length ? values[Math.min(values.length-1, Math.floor(values.length*.20))] : 0;
  };
  const restY = level();
  return { restY, sampled:k, soleY:level };
}

export function groundSurface(terrain,colliders,x,z,currentY=NaN) {
  const base = terrain.heightAt(x,z);
  const searchTop = Number.isFinite(currentY) ? Math.max(base+.62,currentY+.64) : base+.62;
  const platform = colliders?.groundHeightAt?.(x,z,searchTop);
  // Avoid snapping to an unrelated platform far above the body's position.
  return Number.isFinite(platform) && platform > base && platform <= searchTop ? platform : base;
}

export function followGround(previous,target,dt,{snapDistance=.80,speed=16}={}) {
  if (!Number.isFinite(target)) return Number.isFinite(previous)?previous:0;
  if (!Number.isFinite(previous) || Math.abs(target-previous)>snapDistance) return target;
  return previous+(target-previous)*(1-Math.exp(-Math.max(0,dt)*speed));
}

// The skinned geometry is calibrated, not the GLB origin. An animator can
// move hips without turning a one-metre ground offset into hover.
export class LandFootPlant {
  constructor(rig,{clearance=.025}={}) {
    this.rig=rig; this.anchor=makeFootAnchor(rig); this.clearance=clearance;
    this.offset= -this.anchor.restY * rig.group.scale.y + clearance;
    this.timer=0;
    this.footNames = rig.gltf.nodes.map(n => n.name || '').filter(n => /^(?:Foot[._]?[LR]|(?:Left|Right)Foot)$/i.test(n));
    this.lastGroundProbe = 0;
    this._footVec = new Vector3();
  }
  update(dt,{moving=false,locomotion=true,root=null,groundProbe=null,yaw=0}={}) {
    this.timer+=Math.max(0,dt);
    if (this.timer>.06 && locomotion) {
      const elapsed=this.timer;
      this.timer=0;
      const sole=this.anchor.soleY();
      if(Number.isFinite(sole)) {
        // Running requires tolerance for both feet in the air between contacts.
        const scale=this.rig.group.scale.y;
        let desired=-sole*scale+this.clearance;
        // Probe the actual left/right foot, not only the terrain beneath the
        // pelvis. The soft upward correction prevents uphill steps clipping
        // through soil, while avoiding metre-scale jumps on steep ledges.
        if (root && typeof groundProbe==='function') {
          const cosine=Math.cos(yaw), sine=Math.sin(yaw);
          let rise=0;
          for (const name of this.footNames) {
            const pos=this._footVec;
            if (!this.rig.nodeWorld(name,pos)) continue;
            const world=this.rig.group.localToWorld?.(pos.clone());
            const x=world?.x??root.x+(pos.x*cosine+pos.z*sine)*scale;
            const z=world?.z??root.z+(-pos.x*sine+pos.z*cosine)*scale;
            const elevation=groundProbe(x,z,root.y);
            if (Number.isFinite(elevation)) rise=Math.max(rise,elevation-root.y);
          }
          desired+=Math.min(.14,Math.max(0,rise));
          this.lastGroundProbe=rise;
        }
        if(Math.abs(desired-this.offset)<.32)
          this.offset=followGround(this.offset,desired,elapsed,{snapDistance:.35,speed:moving?13:20});
      }
    }
    this.rig.group.position.y=this.offset;
  }
}
