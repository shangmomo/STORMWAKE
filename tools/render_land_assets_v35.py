"""Create an offline Blender contact sheet to inspect actual downloaded GLB geometry.

This is an art diagnostic, not an in-engine screenshot.  No game geometry is modified.
Usage: blender -b --factory-startup --python tools/render_land_assets_v35.py
"""
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
STAGE = HERE / 'assets_stage'
OUT = HERE.parent / 'LAND_V35_ASSET_CONTACT_SHEET.png'
ASSETS = [('Fox', 'fox_quat', .3), ('Deer', 'deer', .45),
          ('Wolf / Hound', 'wolf', .42), ('Boar', 'boar', 1.3),
          ('Wraith', 'ghost', .7), ('Warden', 'demon', .85),
          ('Captain candidate', 'character_animated', .7),
          ('Village candidate', 'man', .36)]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

for index, (label, filename, factor) in enumerate(ASSETS):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(STAGE / f'{filename}.glb'))
    added = set(bpy.data.objects) - before
    all_meshes = [obj for obj in added if obj.type == 'MESH' and
                  (obj.parent and obj.parent.type == 'ARMATURE')]
    if not all_meshes:
        all_meshes = [obj for obj in added if obj.type == 'MESH']
    roots = [obj for obj in added if obj.parent not in added]
    coords = [obj.matrix_world @ Vector(v) for obj in all_meshes for v in obj.bound_box]
    lower = min(p.z for p in coords) if coords else 0
    x = (index % 4 - 1.5) * 3.5
    y = -(index // 4) * 5.5
    for root in roots:
        root.scale *= factor
        root.location += Vector((x, y, -lower * factor))
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=1.35, depth=.08,
                                        location=(x, y, -.09))
    stand = bpy.context.object
    stand.name = f'{label} preview plinth'
    mat = bpy.data.materials.new(f'{label} charcoal')
    mat.diffuse_color = (.085, .13, .16, 1)
    stand.data.materials.append(mat)
    bpy.ops.object.text_add(location=(x - 1.25, y - 1.8, .02),
                            rotation=(0, 0, 0))
    txt = bpy.context.object
    txt.data.body = label
    txt.data.size = .32
    txt.data.extrude = .005

bpy.ops.mesh.primitive_plane_add(size=200, location=(0, -2.8, -.14))
floor = bpy.context.object
floor_mat = bpy.data.materials.new('Review floor')
floor_mat.diffuse_color = (.035, .052, .06, 1)
floor.data.materials.append(floor_mat)

def point_light(name, pos, energy, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    return obj

point_light('Key', (2, -5, 12), 2000, 12)
point_light('Fill', (-5, 1, 8), 900, 10)
point_light('Rim', (4, 5, 7), 1600, 8)

camera_data = bpy.data.cameras.new('Review camera')
camera = bpy.data.objects.new('Review camera', camera_data)
bpy.context.collection.objects.link(camera)
camera.location = (1.0, -22, 12.5)
target = Vector((0, -2.6, 1.2))
camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 16.5
bpy.context.scene.camera = camera

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = False
scene.render.resolution_x = 1600
scene.render.resolution_y = 980
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(OUT)
scene.world.color = (.13, .13, .13)
bpy.ops.render.render(write_still=True)
print(f'[V35-REVIEW] {OUT}')
