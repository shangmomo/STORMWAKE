"""Optional visual QC: blender --background --python scripts/render_v23_showcase.py.

Renders the actual exported GLB assets in a small studio scene, rather than
AI imagery that might not match the in-game mesh.
"""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'v23-art-preview'
OUT.mkdir(parents=True, exist_ok=True)


def look_at(obj, position):
    direction = Vector(position) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def preview(model, name, camera_at, point, ortho):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(model))
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 12
    scene.cycles.use_denoising = False
    bpy.context.view_layer.cycles.use_denoising = False
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 580
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.world.color = (.018, .055, .087)
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get('Background')
    background.inputs['Color'].default_value = (.12, .22, .3, 1)
    background.inputs['Strength'].default_value = .6

    bpy.ops.object.camera_add(location=camera_at)
    camera = bpy.context.object
    camera.name = 'Preview_Camera'
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = ortho
    camera.data.lens = 45
    scene.camera = camera
    look_at(camera, point)

    for position, energy, color, size in [
        ((80, -100, 120), 170000, (.45, .88, 1.0), 125),
        ((-80, 30, 25), 145000, (.06, .4, .78), 90),
        ((30, 160, 170), 160000, (.65, .94, 1.0), 100),
    ]:
        bpy.ops.object.light_add(type='AREA', location=position)
        lamp = bpy.context.object
        lamp.data.energy = energy if name == 'sea-god' else energy / 160
        lamp.data.shape = 'DISK'
        lamp.data.size = size if name == 'sea-god' else size / 7
        lamp.data.color = color
        look_at(lamp, point)

    scene.render.filepath = str(OUT / f'{name}.png')
    bpy.ops.render.render(write_still=True)
    print('V23_RENDERED_MODEL_PREVIEW', scene.render.filepath)


preview(ROOT / 'public/models/titans/rigged/sea-god-skeleton.glb',
        'sea-god', (390, -20, 130), (0, -15, 0), 310)
preview(ROOT / 'public/models/abyss/deepsea-demon-whale.glb',
        'demon-whale', (130, -15, 55), (0, 0, 0), 62)
