// STORMWAKE V47 - licensed artist mesh, not scaled procedural hull art.
// Coordinates: source Blender +Z up/+Y fore -> glTF +Y up/+Z fore (converter).
// Physical vessel remains one boat-local frame and all gameplay stations keep their
// authoritative positions. Unconverted/failed assets retain the old fallback.
import { Group, Mesh, BufferGeometry, BufferAttribute, Color, Vector3 } from '../engine/index.js';
import { loadGLB, decodeImage } from '../engine/loaders/GLTF.js';
import {safeDoorAngle,doorTriangles} from './DoorSweep.js';
import {CollisionWorld} from '../systems/CollisionWorld.js';
import {installAnchorRig} from './ShipAnchorRig.js';
import { Texture } from '../engine/gpu/Texture.js';
import { generateMipmaps } from '../engine/gpu/Mipmaps.js';
import { Material } from '../engine/render/Material.js';
import { artistHullHalfWidth } from './HeritageHullBounds.js';
import {rod,prepare,mergePrepared} from '../world/boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
import {SailReefing} from './SailReefing.js';

const ROOT = '/models/stormwake_v47/';
const CATALOG = Object.freeze({
  // V62 derives this CC0 mesh from /models/stormwake_v54/dutch_ship_lower_hold.glb.
  dutch: '/models/stormwake_v64/dutch_ship_lower_hold.glb',
  cannon: '/models/stormwake_v63/cannon_articulated.glb',
  cannonball: '/models/stormwake_v62/kenney_cannon-ball.glb',
  chest: ROOT + 'quaternius_prop_chest_closed.glb',
  barrel: '/models/stormwake_v62/kenney_barrel.glb',
  bucket: ROOT + 'quaternius_prop_bucket.glb',
  anchor: ROOT + 'quaternius_prop_anchor.glb',
});

function asFloat(a) {
  if(a.array instanceof Float32Array)return a.array;
  const denom={5120:127,5121:255,5122:32767,5123:65535}[a.componentType]||1;
  const out=new Float32Array(a.array.length);
  for(let i=0;i<out.length;i++)out[i]=a.normalized?Math.max(-1,a.array[i]/denom):a.array[i];
  return out;
}

function createPBR(name,gm,maps){
  const pbr=gm.pbrMetallicRoughness||{};
  const fac=pbr.baseColorFactor||[1,1,1,1];
  const alpha=gm.alphaMode==='BLEND', cutout=gm.alphaMode==='MASK';
  return new Material({
    name:'STORMWAKE_V47_PBR_'+name,
    color:new Color(fac[0],fac[1],fac[2]),opacity:fac[3]??1,
    roughness:pbr.roughnessFactor??.88,metalness:pbr.metallicFactor??.08,
    transparent:alpha,depthWrite:!alpha,alphaTest:cutout?(gm.alphaCutoff??.35):0,
    side:gm.doubleSided?'double':'front',
    textures:{...(maps.base?{albedoMap:maps.base}:{}),...(maps.normal?{normalMap:maps.normal}:{}),...(maps.orm?{roughMetalMap:maps.orm}:{})},
    defines:{HAS_ALBEDO:maps.base?1:0,HAS_NORMAL:maps.normal?1:0,HAS_ORM:maps.orm?1:0},
    surface:/* wgsl */`
#if HAS_ALBEDO
      let c=textureSample(albedoMap,smpAnisoRepeat,in.uv);
      s.albedo *= c.rgb;
      s.alpha *= c.a;
#endif
#if HAS_ORM
      let packed=textureSample(roughMetalMap,smpAnisoRepeat,in.uv);
      s.roughness=clamp(s.roughness*packed.g,.18,.99);
      s.metalness=clamp(s.metalness*packed.b,0.0,1.0);
#endif
#if HAS_NORMAL
      let n=textureSample(normalMap,smpAnisoRepeat,in.uv).xyz*2.0-1.0;
      s.normal=perturbNormalByMap(in.P,in.N,in.uv,vec3f(n.xy*.85,n.z));
#endif
`,
  });
}

// Assets built for this engine, no external extensions, no dynamic imports.
export async function loadStaticArtistModel(url,decoded=null){
  const gltf=decoded??await loadGLB(url);
  if(!gltf.meshes.length)throw Error('Artist GLB contains no meshes: '+url);
  const textures=new Map(),materials=new Map();
  const texture=async(info,srgb)=>{
    if(!info)return null;
    const source=gltf.textures[info.index]?.source;
    if(source===undefined)return null;
    const key=source+':' +(srgb?'srgb':'linear');
    if(!textures.has(key)){
      const im=gltf.images[source];
      if(!im?.bytes)throw Error('Artist texture lacks embedded image: '+url+' #'+source);
      const px=await decodeImage(im.bytes,im.mimeType);
      const tex=new Texture({label:'swv47-'+key,width:px.width,height:px.height,
        format:srgb?'rgba8unorm-srgb':'rgba8unorm',data:px.data,mips:true,
        usage:['sample','copyDst'],sampler:'anisoRepeat'});
      tex.getGPU();generateMipmaps(tex);textures.set(key,tex);
    }
    return textures.get(key);
  };
  const getMaterial=async(index)=>{
    if(!materials.has(index)){
      const gm=gltf.materials[index]||{},p=gm.pbrMetallicRoughness||{};
      materials.set(index,createPBR(gm.name||'artist',gm,{
        base:await texture(p.baseColorTexture,true),normal:await texture(gm.normalTexture,false),
        orm:await texture(p.metallicRoughnessTexture,false),
      }));
    }
    return materials.get(index);
  };
  const root=new Group();root.name='Licensed artist art '+url;
  const groups=new Map();
  async function node(index,parent){
    const n=gltf.nodes[index],group=new Group();group.name=n.name||('artist-node-'+index);
    group.position.set(...n.t);group.quaternion.set(...n.r);group.scale.set(...n.s);
    parent.add(group);groups.set(group.name,group);
    if(n.mesh!==undefined){
      for(const p of gltf.meshes[n.mesh]){
        if(p.mode!==4||!p.attributes.POSITION)continue;
        const A=p.attributes,geo=new BufferGeometry(),pos=asFloat(A.POSITION);
        geo.setAttribute('position',new BufferAttribute(pos,3));
        if(A.NORMAL)geo.setAttribute('normal',new BufferAttribute(asFloat(A.NORMAL),3));
        geo.setAttribute('uv',new BufferAttribute(A.TEXCOORD_0?asFloat(A.TEXCOORD_0):new Float32Array(pos.length/3*2),2));
        if(p.indices)geo.setIndex(new BufferAttribute(p.indices instanceof Uint8Array?Uint16Array.from(p.indices):p.indices,1));
        geo.computeBoundingSphere();
        const mesh=new Mesh(geo,await getMaterial(p.material));
        mesh.name='Artist mesh '+group.name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
      }
    }
    for(const child of n.children)await node(child,group);
  }
  for(const index of gltf.roots)await node(index,root);
  return {root,groups,meshes:gltf.meshes.length,materials:[...materials.values()],textures:[...textures.values()]};
}

export const HERITAGE_ART_ALIGNMENT=Object.freeze({x:1.064,y:.75,z:1.064,offsetY:-.40,offsetZ:-.70});

export async function installHeritageArtistShip(boat){
  if(!boat?.shipScale)return null;
  const loaded=await loadStaticArtistModel(CATALOG.dutch);
  // The hull geometry in the supplied Blender file is ~22m; the V44 heritage
  // hydro profile is ~23m. The artistic model's native waterline and main
  // deck are aligned with the gameplay floor, not stretched independently.
  const s=boat.shipScale,outer=new Group();outer.name='STORMWAKE_Dutch_CC0_visual_inverse_of_physics_scale';
  outer.scale.set(1/s.x,1/s.y,1/s.z);
  const artwork=new Group();artwork.name='Dutch ship surface, 22m user supplied CC0';
  artwork.position.set(0,HERITAGE_ART_ALIGNMENT.offsetY,HERITAGE_ART_ALIGNMENT.offsetZ);
  artwork.scale.set(HERITAGE_ART_ALIGNMENT.x,HERITAGE_ART_ALIGNMENT.y,HERITAGE_ART_ALIGNMENT.z);
  outer.add(artwork);artwork.add(loaded.root);
  // Reef from the sail's upper edge. Mesh is one authored object; physical
  // control remains in ShipStations. True rope-by-rope sail animation is a
  // separate rigging milestone, not faked by moving the ship root.
  const sail=loaded.groups.get('dutch_ship_medium_sails');
  let pivot=null;
  if(sail){
    pivot=new Group();pivot.name='V47 sail reef pivot - authored sails';
    pivot.position.y=16.879;
    loaded.root.remove(sail);sail.position.y=-16.879;pivot.add(sail);loaded.root.add(pivot);
  }
  const reefedCanvas=[];sail?.traverse(mesh=>{if(mesh.isMesh&&mesh.geometry?.attributes.position){mesh.material.side='double';reefedCanvas.push(new SailReefing(mesh.geometry));}});
  boat.group.add(outer);
  // Remove only outdated aesthetic geometry AFTER new mesh decoding succeeds.
  // Keep live wheel, cannon stations, damage, physical colliders, hydro and
  // navigation. No duplicate visible hull panels.
  for(const [key,old] of Object.entries(boat.meshes)){
    if(['hull','gelcoat','wood','fittings','trap','glass','sail','glow'].includes(key))old.visible=false;
  }
  // The source hull was an exterior-only static model. Back faces must be
  // visible from below decks and the bow; otherwise the camera sees through it.
  loaded.groups.get('dutch_ship_medium_hull')?.traverse(o=>{if(o.material)o.material.side='double';});
  // The old procedural ship still had a separate visible wheel, throttle,
  // rudder and propeller despite its hull being hidden; these produced z-fights,
  // unattached silhouettes and an apparent second ship around the source hull.
  // The original glTF hull stays the only visible boat surface.
  for(const key of ['wheel','throttle','rudder','propeller'])if(boat.meshes[key])boat.meshes[key].visible=false;
  // The forward sterncastle closed panel is sliced from the ORIGINAL hull mesh
  // (exact two source triangles + original UV/PBR). No substitute geometry.
  const capstan=loaded.groups.get('original_dutch_capstan_turntable');
  if(!capstan)throw Error('Original Dutch rotating capstan triangles missing');
  const hinge=loaded.groups.get('original_dutch_door_hinge');
  if(!hinge)throw Error('Source Dutch bulkhead door hinge missing');
  let doorTarget=0,doorAngle=0;
  // Source Dutch bulkhead mesh has been topologically cut from the V50
  // hull, not given a second overlay door. The *original* door UV/PBR is
  // retained in an enlarged leaf; player and aperture now share metric bounds.
  const sourceDoor={x:-.96,y:1.08,z:-6.635};
  boat.originalDoor={local:sourceDoor,get open(){return doorTarget>0.5;},
    get passable(){return doorAngle>1.15;},
    get angle(){return doorAngle;},
    toggle(){doorTarget=1-doorTarget;return doorTarget>0.5;},
    set(open){doorTarget=open?1:0;},
    blocked:false,collider:new CollisionWorld(doorTriangles(0)),
    update(dt,blockers=[]){const proposed=doorAngle+(doorTarget*1.70-doorAngle)*(1-Math.exp(-Math.max(0,Math.min(.10,dt))*9));
      const result=safeDoorAngle(doorAngle,proposed,blockers);doorAngle=result.angle;this.blocked=result.blocked;hinge.rotation.y=doorAngle;this.collider.setTriangles(doorTriangles(doorAngle));}
  };
  boat.heritageHullHalfWidth=artistHullHalfWidth;
  boat.heritageArt={root:outer,pivot,capstan,source:CATALOG.dutch,ready:true,
    // Each original canvas gathers beneath its own yard. The mesh transform,
    // mast and standing rigging retain the supplied model's scale and position.
    reefedCanvas,setSailAmount(main,jib=main,trim=0){if(pivot)pivot.scale.y=1;for(const cloth of reefedCanvas)cloth.set(main,jib,trim);},
    objects:loaded.groups};
  return boat.heritageArt;
}

export {CATALOG as SHIP_ART_CATALOG};

// Replaces the decorative barrel/cannon primitives at actual work stations.
// WorldItem and inventory authority remain in VoyageM1 and ShipInventory;
// these are spatially attached visible models rather than UI facades.
export async function installHeritageStationAssets(boat, markers){
  if(!boat?.shipScale || !markers)return {installed:[]};
  const s=boat.shipScale,installed=[], prototypes=new Map();
  async function prototype(url){
    if(!prototypes.has(url))prototypes.set(url,loadStaticArtistModel(url));
    return prototypes.get(url);
  }
  // Lower and raise the already bundled, license-tracked Quaternius anchor
  // with the actual authoritative anchor state. The Dutch source mesh has no
  // separable anchor component, so label this as a sourced equipment retrofit,
  // never as a piece extracted from the original Dutch geometry.
  const anchor=await prototype(CATALOG.anchor);
  installAnchorRig(boat,anchor);
  installed.push({station:'anchor',kind:'anchor',source:CATALOG.anchor,animated:true});

  const jobs=[
    ['cannon_port','cannon',.45,Math.PI/2,'tube'],
    ['cannon_starboard','cannon',.45,-Math.PI/2,'tube'],
    ['repair','barrel',.56,0,'station'],
    ['bucket','bucket',.75,0,'station'],
    ['carry','chest',.55,0,'station'],
  ];
  for(const [station,kind,scale,yaw,mountName] of jobs){
    const marker=markers[station],src=CATALOG[kind];if(!marker||!src)continue;
    const item=await prototype(src);
    const target=mountName==='tube'?marker.userData?.tube:marker;
    if(!target)continue;
    const inverse=new Group();inverse.name='V47 inverse to maintain actual prop metres';
    inverse.scale.set(marker.userData?.metric?1:1/s.x,marker.userData?.metric?1:1/s.y,marker.userData?.metric?1:1/s.z);
    const placement=new Group();placement.name='CC0 '+kind+' operational '+station;
    placement.rotation.y=yaw;placement.scale.setScalar(scale);
    placement.add(item.root.clone(true));inverse.add(placement);target.add(inverse);
    if(kind==='cannon'){const barrel=placement.getObjectByName('CannonBarrelPitch'),muzzle=placement.getObjectByName('CannonMuzzle');if(barrel&&muzzle){marker.userData.cannonRig={barrel,muzzle,scale};marker.userData.cannonSide=station==='cannon_port'?1:-1;}}
    // Preserve the marker ring/needle but replace only the fake gun barrel, if present.
    if(mountName==='tube')for(const child of target.children)if(child!==inverse)child.visible=false;
    installed.push({station,kind,source:src});
  }
  // Ammunition crates are the actual CC0 stock models, not V48's floating
  // colored rectangles. Their feet sit on the measured original planks.
  if(boat.heritageDeck){
    const barrel=await prototype(CATALOG.barrel);
    for(const [name,site] of Object.entries({ammo:boat.heritageDeck.objects.ammo,chain:boat.heritageDeck.objects.chain})){
      const base=new Group();base.name='V49 original ship deck CC0 ammo stock '+name;
      base.position.set(site.x/s.x,(site.y-.08)/s.y,site.z/s.z);
      base.scale.set(1/s.x,1/s.y,1/s.z);
      const item=barrel.root.clone(true);item.scale.setScalar(.37);base.add(item);
      boat.group.add(base);installed.push({station:name,kind:'barrel',source:CATALOG.barrel});
    }
  }
  return {installed};
}
