"""Render an approximate harbor gateway form-check using Blender's CPU renderer.

This is NOT the game's WebGPU shading or a frame-rate benchmark.
blender -b --python tools/harbor/render_gate_preview.py -- <ply_dir> <out.png>
"""
import sys
import math
from pathlib import Path
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
folder, output = Path(argv[0]), Path(argv[1])
reverse = len(argv) > 2 and argv[2] == 'reverse'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

for path in sorted(folder.glob('*.ply')):
    bpy.ops.wm.ply_import(filepath=str(path))
    obj = bpy.context.object
    obj.name = path.stem
    # Tidewater uses Y-up; Blender uses Z-up. Game +Z maps to Blender -Y.
    obj.rotation_euler.x = math.pi / 2
    mat = bpy.data.materials.new(obj.name + '_mat')
    mat.diffuse_color = (0.58, 0.47, 0.36, 1)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    attr = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    mat.node_tree.links.new(attr.outputs['Color'], node.inputs['Base Color'])
    node.inputs['Roughness'].default_value = .68
    obj.data.materials.append(mat)


def cube(name, location, scale, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mat = bpy.data.materials.new(name + '_mat')
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (*color, 1)
    obj.data.materials.append(mat)
    return obj


cube('pier_deck', (0, -4, -.18), (2.6, 16, .15), (.30, .21, .15))
for side in [-1, 1]:
    for i in range(12):
        cube(f'board_{side}_{i}', (side * .7, 2 - i * .77, -.08), (1.25, .72, .075), (.37, .28, .20))
cube('sand', (0, 2, -1.0), (18, 12, .20), (.62, .52, .35))

world = bpy.context.scene.world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.42, .58, .75, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .8

bpy.ops.object.light_add(type='AREA', location=(-3, -5, 8))
light = bpy.context.object
light.data.energy = 1900
light.data.shape = 'DISK'
light.data.size = 6

bpy.ops.object.camera_add(location=(0, 9.5 if reverse else -9.5, 2.0))
camera = bpy.context.object
target = Vector((0, 0, 1.9))
camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.lens = 38
bpy.context.scene.camera = camera

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.cycles.use_denoising = False
for layer in scene.view_layers:
    layer.cycles.use_denoising = False
scene.render.resolution_x = 1200
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(output)
bpy.ops.render.render(write_still=True)
print('RENDERED', output)
