"""Blender CPU silhouette check (not WebGPU screenshot).

Usage: blender -b --python tools/pirate/render_pier_preview.py -- <ply-dir> <out.png> [mid]
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
folder, output = Path(args[0]), Path(args[1])
middle = len(args) > 2 and args[2] == 'mid'
terminal = len(args) > 2 and args[2] == 'terminal'

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for path in sorted(folder.glob('*.ply')):
    bpy.ops.wm.ply_import(filepath=str(path))
    obj = bpy.context.object
    obj.name = path.stem
    obj.rotation_euler.x = math.pi / 2
    mat = bpy.data.materials.new(path.stem + '_mat')
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get('Principled BSDF')
    node = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    node.layer_name = 'Col'
    mat.node_tree.links.new(node.outputs['Color'], principled.inputs['Base Color'])
    principled.inputs['Roughness'].default_value = .88
    obj.data.materials.append(mat)


def ground(name, location, size, tint):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mat = bpy.data.materials.new(name + ' material')
    mat.use_nodes = True
    mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (*tint, 1)
    obj.data.materials.append(mat)


ground('sea', (55, 3, -3.4), (150, 180, .08), (.04, .32, .40))
ground('sandbank', (55, 75, -3.3), (150, 18, .13), (.67, .51, .31))

world = bpy.context.scene.world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.28, .53, .74, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .85

bpy.ops.object.light_add(type='AREA', location=(36, 58, 24))
light = bpy.context.object
light.data.energy = 4500
light.data.shape = 'DISK'
light.data.size = 18

if terminal:
    # Boat-side view emphasizes the actual shifted/broad terminal wharf and
    # its open captain spur, not the old entrance-gate/bridge silhouette.
    camera_pos, target, lens = (81, -75, 13.0), (57, -29, 2.3), 36
elif middle:
    camera_pos, target, lens = (70, 31, 8.6), (55, 10, 2.0), 34
else:
    camera_pos, target, lens = (67, 80, 11.2), (55, 42, 1.9), 32
bpy.ops.object.camera_add(location=camera_pos)
cam = bpy.context.object
cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.lens = lens
bpy.context.scene.camera = cam

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 12
scene.cycles.use_denoising = False
for layer in scene.view_layers:
    layer.cycles.use_denoising = False
scene.render.resolution_x = 1400
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(output)
bpy.ops.render.render(write_still=True)
print('RENDERED', output)
