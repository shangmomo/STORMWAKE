"""Optional Blender viewport QA for the V21 skinned hydra and kraken.

Run: blender --background --python scripts/render_titan_v21_preview.py -- hydra
This does not modify any game asset; it produces a visual inspection PNG.
"""
from pathlib import Path
import math
import sys
import bpy
from mathutils import Vector

kind = sys.argv[-1] if sys.argv[-1] in ('hydra', 'kraken') else 'hydra'
root = Path(__file__).resolve().parents[1]
path = root / 'public/models/titans/rigged' / f'{kind}-skeleton.glb'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(path))

if kind == 'hydra':
    eye, target, size = (68, -58, 30), (0, -15, 0), 72
else:
    eye, target, size = (9, -10, 9), (0, 0, 0), 11

def aim(obj, look):
    obj.rotation_euler = (Vector(look) - obj.location).to_track_quat('-Z', 'Y').to_euler()

camera_data = bpy.data.cameras.new('TitanV21InspectionCamera')
camera = bpy.data.objects.new('TitanV21InspectionCamera', camera_data)
bpy.context.collection.objects.link(camera)
camera.location = eye
aim(camera, target)
camera_data.type = 'ORTHO'
camera_data.ortho_scale = size
bpy.context.scene.camera = camera

for name, loc, intensity, radius in (
    ('CoolKey', (45, -45, 55), 6500, 40),
    ('SoftFill', (-35, -50, 25), 5000, 35),
    ('SilhouetteRim', (-25, 20, 35), 9500, 55),
):
    data = bpy.data.lights.new(name, 'AREA')
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = tuple(x / (6 if kind == 'kraken' else 1) for x in loc)
    data.energy = intensity / (6 if kind == 'kraken' else 1)
    data.shape = 'DISK'
    data.size = radius / (6 if kind == 'kraken' else 1)
    aim(obj, target)

world = bpy.data.worlds.new('AbyssPreview')
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.015, 0.035, 0.065, 1)
bg.inputs['Strength'].default_value = 0.8
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 10
scene.cycles.use_denoising = False
scene.render.resolution_x = 960
scene.render.resolution_y = 620
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(root.parent / f'tidewater-v21-{kind}-qa.png')
bpy.ops.render.render(write_still=True)
print('V21 rendered', scene.render.filepath)
