"""Build V23's original, redistributable deep-sea GLB assets with Blender.

Run on any machine with Blender:
    blender --background --python scripts/build_v23_abyss_assets.py

These original geometries are deliberately independent of unavailable third-party
downloads. They can later be replaced with licensed artist-made 3D assets.
"""
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rig_titans_v20 import reset_scene, new_material, assign, feather_chain, finish

ROOT = Path(__file__).resolve().parents[1]
SUB_OUT = ROOT / 'public' / 'models' / 'abyss'
SUB_OUT.mkdir(parents=True, exist_ok=True)
TAU = math.tau


def surf(name, rings, radial, section, mat, closed=False):
    verts, faces, uv = [], [], []
    for i in range(rings):
        t = i / (rings - 1)
        for j in range(radial):
            a = TAU * j / radial
            verts.append(section(t, a))
    for i in range(rings - 1):
        for j in range(radial):
            a = i * radial + j
            b = i * radial + (j + 1) % radial
            faces.append((a, b, b + radial, a + radial))
    if closed:
        faces.extend((tuple(reversed(tuple(range(radial)))), tuple((rings - 1) * radial + j for j in range(radial))))
    mesh = bpy.data.meshes.new(name + '_mesh')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    layer = mesh.uv_layers.new(name='UVMap')
    for p in mesh.polygons:
        for k in p.loop_indices:
            vertex = mesh.loops[k].vertex_index
            layer.data[k].uv = (vertex % radial / radial, vertex // radial / max(1, rings - 1))
    return obj


def uvball(name, loc, scale, mat, seg=28, rings=18):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def rod(name, a, b, r0, r1, mat, sides=12):
    direction = Vector(b) - Vector(a)
    center = (Vector(a) + Vector(b)) * 0.5
    bpy.ops.mesh.primitive_cone_add(vertices=sides, radius1=r0, radius2=r1,
                                    depth=direction.length, location=center)
    ob = bpy.context.object
    ob.name = name
    ob.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    ob.data.materials.append(mat)
    return ob


def chain(bones, prefix, coords, parent):
    names = []
    for i in range(len(coords) - 1):
        n = f'{prefix}{i}'
        bones.append((n, coords[i], coords[i + 1], names[-1] if names else parent))
        names.append(n)
    return names


def build_leviathan():
    reset_scene()
    skin = new_material('OceanGod_SlateTeal_PBR', (.025, .092, .125), .45, .08)
    plate = new_material('OceanGod_CalcifiedArmor', (.042, .14, .17), .58, 0)
    biolume = new_material('OceanGod_CyanPhotophore', (.035, .62, .76), .24, 0)
    gum = new_material('OceanGod_Gum', (.23, .065, .084), .55, .11)
    ivory = new_material('OceanGod_Ivory', (.83, .78, .63), .27, 0)
    pupil = new_material('OceanGod_EyeBlack', (.006, .022, .034), .11, 0)
    objs = []
    bones = [('BodyRoot', (0, -94, 0), (0, -90, 0), None)]
    spine = chain(bones, 'GodSpine', [(0, -91 + 204 * i / 66, 0) for i in range(67)], 'BodyRoot')
    head = chain(bones, 'GodHead', [(0, -95 - 22 * i / 3, 0) for i in range(4)], 'BodyRoot')
    jaw = chain(bones, 'GodJaw', [(0, -107 - 26 * i / 10, -3.0 - 2.1 * i / 10) for i in range(11)], head[1])
    fins = {}
    for label, side in [('L', -1), ('R', 1)]:
        fins[label] = chain(bones, f'GodFin{label}', [
            (side * (12 + 35 * i / 14), -49 + 17 * i / 14, -1 + 3 * math.sin(i / 14 * math.pi))
            for i in range(15)], spine[15])
    whiskers = {}
    for label, side in [('L', -1), ('R', 1)]:
        whiskers[label] = chain(bones, f'GodWhisker{label}', [
            (side * (5 + 15 * i / 23), -119 - 22 * i / 23, -2 - 7 * math.sin(i / 23 * math.pi))
            for i in range(24)], head[-1])
    for label, side in [('L', -1), ('R', 1)]:
        chain(bones, f'GodFluke{label}', [(side * 2.2 * i, 113 + 11 * i / 9, -0.5) for i in range(10)], spine[-1])
    # 66 spine + 3 head + 10 jaw + 28 paired fins + 46 whiskers + 18
    # flukes + one root = 172 fully real glTF armature joints.
    def main_section(t, a):
        y = -94 + t * 207
        cross = max(.01, math.sin(math.pi * (t * .89 + .065)))
        w = (2.4 + 18.3 * cross ** 1.7) * (1 + .032 * math.sin(a * 14 + t * 67))
        h = (1.7 + 12.2 * cross ** 1.6) * (1 + .028 * math.sin(a * 11 - t * 54))
        return (math.cos(a) * w, y, math.sin(a) * h)
    body = surf('OceanGod_ContinuousSculptedTorso', 206, 68, main_section, skin, True)
    assign(body, lambda v: feather_chain(v.y, spine, [-91 + 204 * i / 65 for i in range(66)]))
    objs.append(body)
    for obj in [
        uvball('OceanGod_BrowCranium', (0, -111, 0), (17.8, 22.0, 13.5), skin, 64, 34),
        uvball('OceanGod_UpperMuzzle', (0, -125, 0.4), (14.2, 14.8, 6.6), plate, 48, 26),
        uvball('OceanGod_InnerPalate', (0, -119, -5), (13.0, 14, 1.8), gum, 42, 18),
    ]:
        assign(obj, lambda v: {'GodHead2': 1})
        objs.append(obj)
    lower = uvball('OceanGod_IndependentlyHingedMandible', (0, -120, -9.2), (12.2, 17, 3.2), gum, 52, 24)
    assign(lower, lambda v: feather_chain(-v.y, jaw, [107 + 26 * i / 9 for i in range(10)]))
    objs.append(lower)
    for side, label in [(-1, 'L'), (1, 'R')]:
        for o in [
            uvball(f'OceanGod_{label}_EyeSac', (side * 15.5, -114, 4.8), (3.4, 4.4, 3.0), plate),
            uvball(f'OceanGod_{label}_Pupil', (side * 17.9, -115.2, 5.2), (1.9, 2.5, 1.7), pupil),
            uvball(f'OceanGod_{label}_LuminousIris', (side * 18.7, -115.4, 5.3), (.9, 1.4, 1.2), biolume),
        ]:
            assign(o, lambda v: {'GodHead2': 1}); objs.append(o)
        for i in range(13):
            y = -91 + i * 13.1
            t = min(.98, max(.02, (y + 94) / 207))
            rr = 2.4 + 18.3 * math.sin(math.pi * (t * .89 + .065)) ** 1.7
            o = uvball(f'OceanGod_{label}_LateralScute{i}', (side * rr * .93, y, 2.0),
                       (1.05, 4.8, 1.55), plate, 18, 10)
            assign(o, lambda v, y=y: feather_chain(y, spine, [-91 + 204 * k / 65 for k in range(66)]))
            objs.append(o)
        # Horns and ribbed gill vents make this a terrifying skull rather than
        # the rounded front of a scaled sea snake; the entire skull remains
        # weighted to real head joints for non-rigid combat motion.
        for h in range(3):
            start = (side * (10 + h * 2), -107 + h * 6, 10 - h * .8)
            end = (side * (14 + h * 3), -119 + h * 5, 25 + h * 3)
            horn = rod(f'OceanGod_{label}_CrownHorn{h}', start, end, 2.9 - h * .35,
                       .08, plate, 14)
            assign(horn, lambda v: {'GodHead2': 1}); objs.append(horn)
        for gill in range(6):
            slash = rod(f'OceanGod_{label}_GilledArmorSlit{gill}',
                        (side * 17.5, -94 + gill * 2.5, 2.8),
                        (side * 17.8, -93 + gill * 2.5, -5.4), .38, .35, biolume, 10)
            assign(slash, lambda v: {'GodHead0': 1}); objs.append(slash)
    for i in range(39):
        t = .08 + .81 * i / 38
        y = -94 + t * 207
        h = (1.7 + 12.2 * math.sin(math.pi * (t * .89 + .065)) ** 1.6)
        o = rod(f'OceanGod_DorsalBoneCrown{i}', (0, y, h * .87),
                (1.7 * math.sin(i * 2.2), y + 1.6, h + 6.5 + 5.2 * math.sin(t * math.pi) + 1.9 * math.sin(i * 2.2)), 1.8, .07, plate, 9)
        assign(o, lambda v, y=y: feather_chain(y, spine, [-91 + 204 * k / 65 for k in range(66)]))
        objs.append(o)
    for side, label in [(-1, 'L'), (1, 'R')]:
        def fin_sec(t, a, side=side):
            x = side * (12 + 35 * t)
            return (x, -49 + 17 * t + 2 * math.sin(a),
                    -1 + 3 * math.sin(t * math.pi) + math.sin(a) * 2.5 * (1 - t) ** .7)
        ob = surf(f'OceanGod_{label}_IndependentPectoralFin', 38, 16, fin_sec, plate, False)
        assign(ob, lambda v, label=label: feather_chain(abs(v.x), fins[label],
                                                          [12 + 35 * i / 13 for i in range(14)]))
        objs.append(ob)
        for i in range(12):
            t = i / 11
            ob = uvball(f'OceanGod_{label}_FinPhotophore{i}',
                        (side * (14 + 30 * t), -49 + 17 * t, 1.35), (.67 * (1-t) + .1, 1.0, .35), biolume, 12, 8)
            assign(ob, lambda v, label=label, i=i: {f'GodFin{label}{min(13, int(i*14/12))}': 1})
            objs.append(ob)
        def feeler(t, a, side=side):
            return (side * (5 + 15*t) + .18 * math.cos(a), -119 -22*t,
                    -2-7*math.sin(t*math.pi)+.18*math.sin(a))
        o = surf(f'OceanGod_{label}_ArticulatedSensoryWhisker', 80, 10, feeler, biolume)
        assign(o, lambda v, label=label: feather_chain(abs(v.x), whiskers[label],
                                                        [5 + 15 * i/22 for i in range(23)]))
        objs.append(o)
    for i in range(32):
        angle = -1.38 + i * 2.76 / 31
        x = math.sin(angle) * 7.6
        y = -125 + 2.2 * math.cos(angle)
        top = rod(f'OceanGod_UpperFang{i}', (x,y,-2.5), (x, y-1.5, -6.9),
                  .42, .02, ivory, 7)
        assign(top, lambda v: {'GodHead2': 1})
        bottom = rod(f'OceanGod_LowerFang{i}', (x,y,-7.0), (x,y-1.0,-3.7),
                     .32, .02, ivory, 7)
        assign(bottom, lambda v: {'GodJaw9': 1})
        objs.extend((top, bottom))
    finish(objs, bones, 'sea-god-skeleton.glb')
    print('V23_OCEAN_GOD_REAL_BONES', len(bones))


def build_submarine():
    reset_scene()
    hull = new_material('DemonWhale_AbyssalSteel', (.065, .115, .142), .28)
    hull.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = .83
    brass = new_material('DemonWhale_RitualBrass', (.35, .27, .15), .32)
    brass.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = .9
    bone = new_material('DemonWhale_HydraBoneArmor', (.23, .3, .30), .43)
    glass = new_material('DemonWhale_OceanGlass', (.03, .33, .47), .12)
    glow = new_material('DemonWhale_CyanNavigationLight', (.08, .73, .9), .2)
    def hull_section(t, a):
        y = -18 + 36*t
        f = max(.01, math.sin(math.pi*t)**.66)
        x = math.cos(a) * 5.4 * f * (1 + .035 * math.sin(9*a))
        z = math.sin(a) * 3.7 * f + .18 * math.sin(t*math.pi)
        return (x,y,z)
    surf('DemonWhale_Hull_MainContinuousMetalBody', 136, 64, hull_section, hull, True)
    surf('DemonWhale_Belly_ReinforcedPressureHull', 82, 34,
         lambda t,a: (math.cos(a)*3.4*max(.01,math.sin(math.pi*t)**.8),
                      -14+28*t, math.sin(a)*3.1*max(.01,math.sin(math.pi*t)**.8)-.3), bone)
    # All major ship silhouettes are real modeled geometry, not a flat sprite.
    uvball('DemonWhale_Brow_RamPlate', (0,-17.2,1.6), (4.7, 5.3, 3), bone, 48, 24)
    uvball('DemonWhale_Front_ObservatoryGlass', (0,-18.6,1.85), (3.4,1.7,2.1), glass, 40, 20)
    uvball('DemonWhale_ConningTower', (0,-1.4,4), (2.1,5.5,2.5), hull)
    for side,label in [(-1,'L'),(1,'R')]:
        for i in range(7):
            y = -10.8 + i*3.7
            f = max(.01, math.sin(math.pi*(y+18)/36)**.66)
            uvball(f'DemonWhale_{label}_PressurePort{i}', (side*5.2*f,y,.45),
                   (.29, .78, .78), glow, 20, 12)
            uvball(f'DemonWhale_{label}_BrassPortBezel{i}', (side*5.0*f,y,.45),
                   (.31, 1.06, 1.06), brass, 20, 12)
        for i in range(10):
            y = -14 + i*3.05
            f = max(.01, math.sin(math.pi*(y+18)/36)**.66)
            rod(f'DemonWhale_{label}_ExternalArmorRib{i}', (side*5.0*f,y,-1.75),
                (side*5.05*f,y,2.15), .21,.21, bone, 10)
        uvball(f'DemonWhale_{label}_MechanicalWhaleFin', (side*7,-3,-.4),
               (5.8,5.8,.63), bone, 36, 20)
        for i in range(4):
            rod(f'DemonWhale_{label}_FinRib{i}', (side*(5+i*2),-6+i, -.35),
                (side*(8+i*1.6),-1.5+i,-.35), .18,.11, brass, 10)
        for j in range(3):
            rod(f'DemonWhale_{label}_TorpedoTube{j}', (side*(2+j*1.3), -17.8, -1.9),
                (side*(2+j*1.3), -11.8,-1.9), .39,.44,hull,14)
        # Six independent vector thrusters, physically placed on aft hull.
        for j in range(3):
            uvball(f'DemonWhale_{label}_VectorThruster{j}', (side*(3.0+j*.92), 15.2, -1.45+j*.85),
                   (.77, 1.7, .77), brass, 18, 12)
    for i in range(12):
        y=-14+i*2.35
        uvball(f'DemonWhale_DorsalRidge{i}', (0,y,3.65*math.sin(math.pi*(y+18)/36)+.4),
               (.55,1.1,1.6), bone, 16, 10)
    for side,label in [(-1,'L'),(1,'R')]:
        rod(f'DemonWhale_{label}_TailFluke', (side*1.6,18,-.2),
            (side*6.4,22,.8),1.5,.17,bone,16)
    # One-shot GLB import retains named mechanical parts and PBR materials.
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(SUB_OUT/'deepsea-demon-whale.glb'),
                              export_format='GLB', use_selection=True,
                              export_yup=True, export_animations=False)
    print('V23_DEMON_WHALE_BYTES', (SUB_OUT/'deepsea-demon-whale.glb').stat().st_size)


if __name__ == '__main__':
    build_leviathan()
    build_submarine()
