"""Art-directed, original sea-serpent Leviathan for the Stormwake boss.

Its form is intentionally marine: a huge sinuous body, ridged scutes,
paired webbed flippers, an elongated predatory jaw, and a finned tail.
This is our own mesh, UVs, and procedural skin rather than a copyrighted
creature ripped from another game. Exported asset: leviathan.glb.
Run: blender --background --python scripts/build_leviathan.py
"""

from pathlib import Path
import math
import random

import bpy
import numpy as np
from mathutils import Matrix, Vector


OUT = Path(__file__).resolve().parents[1] / 'public' / 'models' / 'titans'
random.seed(26)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, rough=0.8, image=None, normal_image=None, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1.0)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1.0)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metallic
    if image is not None:
        t = m.node_tree.nodes.new('ShaderNodeTexImage')
        t.image = image
        m.node_tree.links.new(t.outputs['Color'], p.inputs['Base Color'])
    if normal_image is not None:
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = normal_image
        tex.image.colorspace_settings.name = 'Non-Color'
        normal = m.node_tree.nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value = 0.58
        m.node_tree.links.new(tex.outputs['Color'], normal.inputs['Color'])
        m.node_tree.links.new(normal.outputs['Normal'], p.inputs['Normal'])
    return m


def skin_texture():
    width, height = 2048, 1024
    # Periodic scale rows and layered low-frequency mottling. The dark
    # dorsal stripe, pale ventral scutes, and irregular scale boundaries
    # are painted into the UV atlas, rather than into vertex colour alone.
    u = np.arange(width, dtype=np.float32)[None, :] / width
    v = np.arange(height, dtype=np.float32)[:, None] / height
    rows = np.mod(v * 34.0, 1.0)
    shifted = u * 115.0 + np.floor(v * 34.0) * 0.5
    scales = np.abs(np.mod(shifted, 1.0) - 0.5)
    edge = np.exp(- (scales / 0.08) ** 2) + np.exp(- (rows / 0.07) ** 2)
    grain = (np.sin(u * 430.0 + np.sin(v * 31.0) * 2.8) *
             np.cos(v * 290.0 + np.cos(u * 17.0) * 2.1))
    mottles = (np.sin(u * 42.0 + v * 17.0) * 0.5 +
               np.sin(u * 101.0 - v * 69.0) * 0.24 + grain * 0.18)
    dorsal = np.maximum(0.0, np.cos((v - 0.5) * 2 * np.pi)) ** 1.7
    belly = np.maximum(0.0, - np.cos((v - 0.5) * 2 * np.pi)) ** 1.6
    tint = mottles * 0.045 - edge * 0.040
    r = 0.08 + 0.055 * dorsal + 0.23 * belly + tint
    g = 0.20 + 0.105 * dorsal + 0.24 * belly + tint
    b = 0.22 + 0.12 * dorsal + 0.19 * belly + tint
    alpha = np.ones((height, width), dtype=np.float32)
    pixels = np.stack(np.broadcast_arrays(r, g, b, alpha), axis=-1)
    pixels = np.clip(pixels, 0.0, 1.0)
    image = bpy.data.images.new('Leviathan_MarineScales_2K', width=width, height=height, alpha=True)
    image.pixels.foreach_set(pixels.ravel())
    image.filepath_raw = str(OUT / 'leviathan-marine-scales.png')
    image.file_format = 'PNG'
    image.save()
    # Height relief of tiny overlapping scutes and skin pores, expressed as a
    # tangent-space normal map. This survives GLB optimisation and gives the
    # living surface a real microfacet response at close range.
    elevation = edge * 0.33 + grain * 0.11 + mottles * 0.06
    dy, dx = np.gradient(elevation)
    nx, ny, nz = -dx * 2.9, -dy * 2.9, np.ones_like(dx)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal_pixels = np.stack((nx / norm * 0.5 + 0.5, ny / norm * 0.5 + 0.5,
                              nz / norm * 0.5 + 0.5, alpha), axis=-1)
    normal_image = bpy.data.images.new('Leviathan_ScaleReliefNormal_2K', width=width, height=height, alpha=True)
    normal_image.pixels.foreach_set(np.clip(normal_pixels, 0.0, 1.0).ravel())
    normal_image.filepath_raw = str(OUT / 'leviathan-marine-normal.png')
    normal_image.file_format = 'PNG'
    normal_image.save()
    return image, normal_image


skin_albedo, skin_normal = skin_texture()
skin = material('MarineScaleSkin_PBR', (0.17, 0.31, 0.34), 0.87, skin_albedo, skin_normal)
underside = material('ScutedUnderJaw', (0.53, 0.65, 0.58), 0.91)
dark = material('InnerJaw', (0.045, 0.07, 0.085), 0.96)
fin = material('DeepTeal_FinMembrane', (0.085, 0.27, 0.32), 0.78)
fin_rib = material('FinSupports', (0.29, 0.51, 0.51), 0.83)
ivory = material('WeatheredIvory', (0.83, 0.78, 0.62), 0.69)
eye = material('GlassyBlackEye', (0.012, 0.020, 0.032), 0.16)
iris = material('WarmAmberIris', (0.57, 0.36, 0.11), 0.38)


def ellipsoid(name, at, radius, mat, rings=18, segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=at)
    obj = bpy.context.object
    obj.name = name
    obj.scale = radius
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def line(name, a, b, radius, mat, vertices=9):
    p, q = Vector(a), Vector(b)
    direction = q - p
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius * 0.32,
                                    depth=direction.length, location=(p+q)*0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def fin_prism(name, points, mat, thickness=0.12):
    a, b, c = [Vector(p) for p in points]
    offset = Vector((thickness, 0, 0))
    verts = [tuple(p + d) for d in (offset, -offset) for p in (a, b, c)]
    faces = [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def spine(t):
    z = -35.0 + t * 65.0
    x = math.sin(t * math.pi * 4.5) * 1.5
    y = 0.65 + math.sin(t * math.pi * 6.0 + 0.2) * 1.45
    r = 0.48 + 3.75 * (t ** 0.65) * (1.0 - 0.42 * t)
    return x, y, z, r


def body():
    rings, sides = 180, 36
    verts, faces, uv = [], [], []
    for i in range(rings):
        t = i / (rings - 1)
        x, y, z, r = spine(t)
        for j in range(sides):
            a = j * math.pi * 2 / sides
            # Nonuniform low-amplitude ridges suggest overlapping marine scales.
            relief = 1.0 + 0.026 * math.sin(44.0 * math.pi * t + math.cos(a * 13.0) * 0.85) * math.cos(15.0 * a)
            verts.append((x + r * math.cos(a) * relief,
                          y + r * 0.87 * math.sin(a) * relief, z))
    for i in range(rings - 1):
        for j in range(sides):
            q = i * sides + j
            n = i * sides + (j + 1) % sides
            a = q + sides
            b = n + sides
            faces.append((q, n, b, a))
    mesh = bpy.data.meshes.new('Leviathan_ContinuousScalyBody')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.materials.append(skin)
    obj = bpy.data.objects.new('Leviathan_ContinuousScalyBody', mesh)
    bpy.context.collection.objects.link(obj)
    layer = mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        for loop in poly.loop_indices:
            idx = mesh.loops[loop].vertex_index
            i, j = divmod(idx, sides)
            layer.data[loop].uv = (i / (rings - 1), j / (sides - 1))
        poly.use_smooth = True
    # Oceanic scutes along lower flank and tall dorsal fin row.
    for i in range(8, 155, 6):
        t = i / (rings - 1)
        x, y, z, r = spine(t)
        h = r * (0.75 + (i % 17) * 0.017)
        fin_prism(f'Leviathan_BackFin_{i}',
            [(x, y+r*0.86, z+1.15), (x, y+r*0.86+h, z-0.35), (x, y+r*0.86, z-1.3)], fin)
        line(f'Leviathan_FinRib_{i}', (x, y+r*0.8, z+0.95),
             (x, y+r*0.88+h*0.9, z-0.38), 0.09, fin_rib)
    return obj


body()

# The creature's armored head is a custom assemblage, not a generic fantasy dragon.
hx, hy, hz, _ = spine(0.985)
ellipsoid('Leviathan_Cranium', (hx, hy + 0.6, hz+2.5), (2.75, 2.35, 5.7), skin, 22, 40)
ellipsoid('Leviathan_ElongatedSnout', (hx, hy - 0.12, hz+6.75), (2.18, 1.18, 3.85), skin, 20, 36)
ellipsoid('Leviathan_UpperPalate', (hx, hy - 1.13, hz+6.5), (2.0, 0.35, 3.55), dark, 14, 28)
ellipsoid('Leviathan_LowerJaw', (hx, hy - 1.65, hz+6.5), (2.25, 0.52, 3.95), underside, 18, 36)

for side in (-1, 1):
    # Bone-plate brow, heavy lidded eye with an amber ring, and nostrils.
    ellipsoid(f'Leviathan_Brow_{side}', (hx+side*2.2, hy+1.36, hz+4.0), (0.82, 0.38, 1.64), skin)
    ellipsoid(f'Leviathan_EyeOuter_{side}', (hx+side*2.45, hy+0.92, hz+4.25), (0.43, 0.39, 0.48), iris)
    ellipsoid(f'Leviathan_EyePupil_{side}', (hx+side*2.78, hy+0.97, hz+4.35), (0.15, 0.26, 0.32), eye)
    ellipsoid(f'Leviathan_Nostril_{side}', (hx+side*1.27, hy+0.64, hz+8.65), (0.25, 0.08, 0.39), dark)
    for i in range(23):
        z = hz + 3.2 + i*0.28
        x = hx + side*(1.78 - i*0.022)
        ht = 0.5 + 0.28*abs(math.sin(i*0.73))
        line(f'Leviathan_UpperTooth_{side}_{i}', (x, hy-1.16, z),
             (x-side*0.04, hy-1.16-ht, z+0.12), 0.14, ivory, 7)
        if i % 2 == 0:
            line(f'Leviathan_LowerTooth_{side}_{i}', (x*0.97, hy-1.7, z),
                 (x*0.97, hy-1.7+ht*0.48, z+0.06), 0.095, ivory, 7)
    # Skin folds / gill channels, modeled as paired dark strips.
    for i in range(5):
        z = hz + 1.3 - i*0.54
        line(f'Leviathan_GillSlit_{side}_{i}',
             (hx+side*2.65, hy-0.12, z), (hx+side*2.4, hy-1.65, z-0.23), 0.12, dark, 8)
    # Skeletal, webbed cheek frills distinguish it from a crocodile.
    for i in range(3):
        y = hy + 0.45 + i*0.44
        fin_prism(f'Leviathan_CheekFrill_{side}_{i}',
            [(hx+side*2.4,y,hz+2.0-i*0.38),
             (hx+side*(4.1+i*0.23),y+1.9,hz+0.55-i*0.5),
             (hx+side*2.6,y+0.3,hz-0.9-i*0.4)], fin, 0.08)
    # Two broad paired flippers form a believable marine silhouette.
    for t in (0.42, 0.73):
        x,y,z,r = spine(t)
        fin_prism(f'Leviathan_SideFlipper_{side}_{int(t*100)}',
            [(x+side*r*0.95,y,z+2.0),
             (x+side*(r+8.2),y-2.2,z-5.3),
             (x+side*r*0.78,y-0.65,z-5.1)], fin, 0.24)
        line(f'Leviathan_FlipperSpine_{side}_{int(t*100)}',
             (x+side*r*0.96,y,z+1.5), (x+side*(r+7.4),y-2.05,z-4.8), 0.24, fin_rib, 9)

# Five-ribbed fin, not a mammalian fluke: ends at the original tail tip.
tx,ty,tz,_ = spine(0)
for side in (-1, 1):
    fin_prism(f'Leviathan_TailFan_{side}',
        [(tx,ty,tz+2.2), (tx+side*10.2,ty+2.5,tz-4.3),
         (tx+side*2.1,ty-0.7,tz-5.2)], fin, 0.16)
    for i in range(1, 4):
        line(f'Leviathan_TailRib_{side}_{i}', (tx,ty,tz+1.8),
             (tx+side*(i*2.4),ty+0.55*i,tz-2.4-i*0.5), 0.1, fin_rib)

# Merge the many cosmetic parts into a handful of material-based draw calls.
# The hand-made UVs share the same standard UVMap layer as Blender primitives.
for mat in (skin, underside, dark, fin, fin_rib, ivory, eye, iris):
    group = [o for o in bpy.context.scene.objects
             if o.type == 'MESH' and any(slot.material == mat for slot in o.material_slots)]
    if len(group) < 2:
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = group[0]
    bpy.ops.object.join()
    group[0].name = f'Leviathan_{mat.name}'

# This procedural authoring script uses game-space Y-up / Z-forward axes.
# Blender is Z-up: rotate all geometry into native Blender space before the
# exporter performs its standard Y-up glTF conversion. The resulting GLB is
# a 70-metre *horizontal* sea serpent, not a creature standing on its tail.
axis_fix = Matrix.Rotation(math.pi / 2, 4, 'X')
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        obj.matrix_world = axis_fix @ obj.matrix_world
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=str(OUT/'leviathan.glb'), export_format='GLB',
    export_image_format='AUTO', export_apply=True, export_materials='EXPORT',
    export_texcoords=True, export_normals=True, export_animations=False,
    export_yup=True,
)
print('LEVIATHAN_CREATED', (OUT/'leviathan.glb').stat().st_size, 'bytes',
      len([o for o in bpy.context.scene.objects if o.type == 'MESH']), 'mesh parts')
