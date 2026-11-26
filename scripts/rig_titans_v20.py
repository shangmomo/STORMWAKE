"""Generate four genuine GLB armature skins from the bundled licensed PBR assets.

Run with: blender --background --python scripts/rig_titans_v20.py
The source meshes/materials are preserved. Hydra receives two extra textured
neck/head branches; the kraken receives eight long joint-weighted arms and
modeled suction cups. All geometry remains local in the finished project.
"""

import bpy
import bmesh
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'public' / 'models' / 'titans'
OUT = SRC / 'rigged'
OUT.mkdir(exist_ok=True)


def reset_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def import_source(filename):
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(SRC / filename))
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name != 'Cube']
    for ob in list(bpy.context.scene.objects):
        if ob.name == 'Cube':
            bpy.data.objects.remove(ob, do_unlink=True)
    for ob in objs:
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return objs


def new_material(name, rgb, roughness=0.8, subsurface=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = subsurface
    return mat


def build_armature(spec):
    arm = bpy.data.armatures.new('TitanV20Armature')
    rig = bpy.data.objects.new('TitanV20Rig', arm)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for name, head, tail, parent in spec:
        bone = arm.edit_bones.new(name)
        bone.head = Vector(head)
        bone.tail = Vector(tail)
        if parent:
            bone.parent = arm.edit_bones[parent]
            bone.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def assign(ob, by_vertex):
    groups = {}
    for v in ob.data.vertices:
        weights = by_vertex(v.co)
        total = sum(max(0, weight) for weight in weights.values())
        if total < 1e-5:
            weights = {'BodyRoot': 1}
            total = 1
        for name, weight in weights.items():
            if weight <= 0:
                continue
            group = groups.get(name)
            if group is None:
                group = ob.vertex_groups.new(name=name)
                groups[name] = group
            group.add([v.index], weight / total, 'REPLACE')


def feather_chain(value, names, anchors):
    if value <= anchors[0]:
        return {names[0]: 1}
    for i in range(len(anchors) - 1):
        if value <= anchors[i + 1]:
            q = (value - anchors[i]) / max(anchors[i + 1] - anchors[i], 1e-6)
            q = q * q * (3 - 2 * q)
            return {names[i]: 1 - q, names[i + 1]: q}
    return {names[-1]: 1}


def finish(objs, bones, destination):
    arm = build_armature(bones)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    main = objs[0]
    main.name = 'TitanV20SkinnedSurface'
    modifier = main.modifiers.new('TrueJointSkin', 'ARMATURE')
    modifier.object = arm
    main.parent = arm
    bpy.ops.object.select_all(action='DESELECT')
    main.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=str(OUT / destination), export_format='GLB',
                              use_selection=True, export_animations=False,
                              export_skins=True, export_yup=True)
    print('V20_SKINNED', destination, (OUT / destination).stat().st_size, 'bytes', len(arm.data.bones), 'real bones')


def make_shark():
    objs = import_source('great-white-shark.glb')
    bones = [
        ('BodyRoot', (0, -1, 0.7), (0, -0.3, 0.7), None),
        ('SharkSpine', (0, -0.3, 0.7), (0, 0.8, 0.65), 'BodyRoot'),
        ('TailDrive', (0, 0.8, 0.65), (0, 1.65, 0.55), 'SharkSpine'),
        ('TailFin', (0, 1.65, 0.55), (0, 2.55, 0.5), 'TailDrive'),
        ('SharkJaw', (0, -1.45, 0.35), (0, -2.35, 0.3), 'BodyRoot'),
        ('FinLeft', (-0.55, -0.2, 0.75), (-1.25, 0.25, 0.45), 'BodyRoot'),
        ('FinRight', (0.55, -0.2, 0.75), (1.25, 0.25, 0.45), 'BodyRoot'),
    ]

    def weights(v):
        x, y, z = v
        if abs(x) > 0.72 and -0.9 < y < 0.9 and z < 0.95:
            return {'FinLeft' if x < 0 else 'FinRight': 0.88, 'BodyRoot': 0.12}
        if y < -1.4 and z < 0.54:
            return {'SharkJaw': 0.85, 'BodyRoot': 0.15}
        return feather_chain(y, ['BodyRoot', 'SharkSpine', 'TailDrive', 'TailFin'], [-0.5, 0.7, 1.5, 2.4])

    for ob in objs:
        assign(ob, weights)
    finish(objs, bones, 'shark-skeleton.glb')


def make_turtle():
    objs = import_source('sea-turtle.glb')
    bones = [
        ('BodyRoot', (0, 0, 0.2), (0, 0.15, 0.2), None),
        ('ShellBreath', (0, 0.15, 0.22), (0, 0.35, 0.27), 'BodyRoot'),
        ('TurtleHead', (0, -0.28, 0.24), (0, -0.65, 0.27), 'BodyRoot'),
        ('FrontFinL', (-0.28, -0.25, 0.16), (-0.65, -0.45, 0.1), 'BodyRoot'),
        ('FrontFinR', (0.28, -0.25, 0.16), (0.65, -0.45, 0.1), 'BodyRoot'),
        ('BackFinL', (-0.26, 0.30, 0.16), (-0.6, 0.55, 0.1), 'BodyRoot'),
        ('BackFinR', (0.26, 0.30, 0.16), (0.6, 0.55, 0.1), 'BodyRoot'),
    ]

    def weights(v):
        x, y, z = v
        if abs(x) > 0.25 and z < 0.24:
            name = ('FrontFin' if y < 0 else 'BackFin') + ('L' if x < 0 else 'R')
            strength = min(1, max(0, (abs(x) - 0.25) / 0.20))
            return {name: strength, 'BodyRoot': 1 - strength}
        if y < -0.28 and z < 0.37:
            return {'TurtleHead': min(1, (-y - 0.28) * 5), 'BodyRoot': max(0, 1 - (-y - 0.28) * 5)}
        return {'ShellBreath': 0.15 if z > 0.32 else 0, 'BodyRoot': 0.85 if z > 0.32 else 1}

    for ob in objs:
        assign(ob, weights)
    finish(objs, bones, 'turtle-skeleton.glb')


def add_tube_mesh(name, centerline, radii, material):
    n = len(centerline)
    verts, faces, uvs = [], [], []
    ring = 16
    for i in range(n):
        p = Vector(centerline[i]); tangent = Vector(centerline[min(n - 1, i + 1)]) - Vector(centerline[max(0, i - 1)])
        tangent.normalize()
        cross = tangent.cross(Vector((0, 0, 1)))
        if cross.length < 0.01:
            cross = tangent.cross(Vector((1, 0, 0)))
        cross.normalize(); side = tangent.cross(cross).normalized()
        for j in range(ring):
            angle = j * math.tau / ring
            sculpt = 1 + 0.055 * math.sin(angle * 7 + i * 0.7) + 0.025 * math.sin(angle * 13 - i * 0.4)
            verts.append(p + (cross * math.cos(angle) + side * math.sin(angle)) * radii[i] * sculpt)
    for i in range(n - 1):
        for j in range(ring):
            a = i * ring + j; b = i * ring + (j + 1) % ring
            faces.append((a, b, b + ring, a + ring))
    mesh = bpy.data.meshes.new(name + '_mesh')
    mesh.from_pydata(verts, [], faces); mesh.update()
    ob = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    for polygon in mesh.polygons: polygon.use_smooth = True
    layer = mesh.uv_layers.new(name='UVMap')
    for polygon in mesh.polygons:
        i = polygon.index // ring; j = polygon.index % ring
        for k, loop in enumerate(polygon.loop_indices):
            layer.data[loop].uv = ((j + (1 if k in (1, 2) else 0)) / ring * 2, (i + (1 if k >= 2 else 0)) / (n - 1) * 8)
    return ob


def make_hydra():
    objs = import_source('leviathan.glb')
    originals = list(objs)
    body = next(o for o in objs if 'ScaleSkin' in o.name)
    skin = body.data.materials[0]
    bones = [('BodyRoot', (0, 24, 0), (0, 12, 0), None),
             ('C_0', (0, -17, 0), (0, -23, 0), 'BodyRoot'),
             ('C_1', (0, -23, 0), (0, -29, 0), 'C_0'),
             ('C_2', (0, -29, 0), (0, -34, 0), 'C_1'),
             ('C_Head', (0, -34, 0), (0, -38, 0), 'C_2'),
             ('C_Jaw', (0, -35, -0.9), (0, -39, -1.1), 'C_Head')]

    def original_weights(v):
        return feather_chain(-v.y, ['BodyRoot', 'C_0', 'C_1', 'C_2', 'C_Head'], [17, 23, 29, 34, 38])

    for ob in originals:
        if 'LowerJaw' in ob.name: assign(ob, lambda v: {'C_Jaw': 1})
        elif 'Iris' in ob.name or 'Eye' in ob.name or 'Ivory' in ob.name or 'InnerJaw' in ob.name:
            assign(ob, lambda v: {'C_Head': 1})
        else: assign(ob, original_weights)

    # Two lateral heads reuse the original artist-designed PBR facial features,
    # including gums, eyes and horn details; the heads are physically separate.
    for side, label in [(-1, 'L'), (1, 'R')]:
        dx = 10.5 * side
        dz = 4.2
        bones += [
            (f'{label}_0', (4.5 * side, -16, 0.5), (7 * side, -23, 2.1), 'BodyRoot'),
            (f'{label}_1', (7 * side, -23, 2.1), (9 * side, -29, 3.3), f'{label}_0'),
            (f'{label}_2', (9 * side, -29, 3.3), (dx, -34, dz), f'{label}_1'),
            (f'{label}_Head', (dx, -34, dz), (dx, -38, dz), f'{label}_2'),
            (f'{label}_Jaw', (dx, -35, dz - 0.9), (dx, -39, dz - 1.1), f'{label}_Head'),
        ]
        # Slice a real, detailed upper skull from the original body mesh.
        skull = body.copy(); skull.data = body.data.copy()
        bpy.context.collection.objects.link(skull)
        bm = bmesh.new(); bm.from_mesh(skull.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > -28], context='VERTS')
        bm.to_mesh(skull.data); bm.free()
        skull.name = f'{label}_DetailedPBRHead'
        for v in skull.data.vertices: v.co.x += dx; v.co.z += dz
        assign(skull, lambda v, key=f'{label}_Head': {key: 1})
        objs.append(skull)
        for ob in originals:
            if not any(word in ob.name for word in ('Jaw', 'Iris', 'Eye', 'Ivory')):
                continue
            duplicated = ob.copy(); duplicated.data = ob.data.copy()
            bpy.context.collection.objects.link(duplicated)
            duplicated.name = f'{label}_Facial_{ob.name}'
            for v in duplicated.data.vertices: v.co.x += dx; v.co.z += dz
            assign(duplicated, lambda v, key=f'{label}_Jaw' if 'LowerJaw' in ob.name else f'{label}_Head': {key: 1})
            objs.append(duplicated)
        line = []
        radius = []
        for i in range(30):
            t = i / 29
            x = side * (4.5 + 6.0 * (t * t * (3 - 2 * t)))
            y = -16 - 19 * t
            z = 0.5 + 3.7 * t + math.sin(t * math.pi) * 0.7
            line.append((x, y, z))
            radius.append(2.6 * (1 - t) + 1.3 * t)
        neck = add_tube_mesh(f'{label}_SkeletalNeck', line, radius, skin)
        assign(neck, lambda v, key=label: feather_chain(-v.y, [f'{key}_0', f'{key}_1', f'{key}_2', f'{key}_Head'], [16, 23, 29, 35]))
        objs.append(neck)
    finish(objs, bones, 'hydra-skeleton.glb')


def make_kraken():
    objs = import_source('kraken.glb')
    fleshy = objs[0].data.materials[0]
    belly = new_material('WetBurgundySuckers', (0.33, 0.095, 0.115), 0.53, 0.12)
    bones = [('BodyRoot', (0, 0, 0.5), (0, 0, 1.3), None),
             ('KrakenMantle', (0, 0, 1.3), (0, 0, 2.5), 'BodyRoot')]
    for arm in range(8):
        a = arm * math.tau / 8
        radial = Vector((math.cos(a), math.sin(a), 0))
        for k in range(6):
            p = radial * (0.35 + 0.69 * k) + Vector((0, 0, 0.55 - 0.17 * k))
            q = radial * (0.35 + 0.69 * (k + 1)) + Vector((0, 0, 0.55 - 0.17 * (k + 1)))
            bones.append((f'Arm{arm}_{k}', tuple(p), tuple(q), 'BodyRoot' if k == 0 else f'Arm{arm}_{k - 1}'))

    def originals(v):
        x, y, z = v
        radius = math.hypot(x, y)
        if z > 1.0: return {'KrakenMantle': 1}
        if radius < 0.32: return {'BodyRoot': 1}
        angle = (math.atan2(y, x) + math.tau) % math.tau
        arm = round(angle * 8 / math.tau) % 8
        step = min(5, int(max(0, radius - 0.3) / 0.7))
        return {f'Arm{arm}_{step}': min(0.9, radius), 'BodyRoot': max(0.1, 1 - radius)}

    assign(objs[0], originals)
    for arm in range(8):
        a = arm * math.tau / 8
        vector = Vector((math.cos(a), math.sin(a), 0))
        points, radii = [], []
        for j in range(73):
            t = j / 72
            p = vector * (0.34 + 4.25 * t) + Vector((0, 0, 0.6 - 1.15 * t + 0.12 * math.sin(t * math.tau)))
            # Anatomical taper and subtle muscular bulges, not a rigid pipe.
            points.append(tuple(p))
            radii.append((0.22 * (1 - t) + 0.025) * (1 + 0.10 * math.sin(t * 17 + a)))
        tube = add_tube_mesh(f'Kraken_Arm{arm}_PBR', points, radii, fleshy)
        assign(tube, lambda v, key=arm: feather_chain(math.hypot(v.x, v.y), [f'Arm{key}_{k}' for k in range(6)], [0.35, 1.04, 1.73, 2.42, 3.11, 3.80]))
        objs.append(tube)
        # Raised suckers are individual small fleshy meshes following each bone.
        for j in range(13):
            t = 0.12 + j * 0.063
            center = Vector(points[int(t * 72)])
            bpy.ops.mesh.primitive_torus_add(major_segments=10, minor_segments=5, location=(center.x, center.y, center.z - radii[int(t * 72)]))
            sucker = bpy.context.object
            sucker.name = f'Sucker_{arm}_{j}'
            sucker.scale = (0.062 * (1 - t) + 0.017,) * 3
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            sucker.data.materials.append(belly)
            idx = min(5, int(t * 6))
            assign(sucker, lambda v, key=f'Arm{arm}_{idx}': {key: 1})
            objs.append(sucker)
    finish(objs, bones, 'kraken-skeleton.glb')


if __name__ == '__main__':
    make_shark()
    make_turtle()
    make_kraken()
    make_hydra()
