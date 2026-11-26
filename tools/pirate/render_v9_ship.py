"""Blender CPU geometry inspection of the custom V9 pirate sloop.

Usage: blender -b --python tools/pirate/render_v9_ship.py -- <ply-dir> <output.png>
This is not an in-game WebGPU screenshot, nor a 3rd-party model.
"""
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
source, destination = Path(args[0]), Path(args[1])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

for file in sorted(source.glob('*.ply')):
    bpy.ops.wm.ply_import(filepath=str(file))
    obj = bpy.context.object
    obj.rotation_euler.x = 1.5707963267948966
    obj.name = file.stem
    material = bpy.data.materials.new('ship_' + file.stem)
    material.use_nodes = True
    principled = material.node_tree.nodes.get('Principled BSDF')
    colors = material.node_tree.nodes.new('ShaderNodeVertexColor')
    colors.layer_name = 'Col'
    material.node_tree.links.new(colors.outputs['Color'], principled.inputs['Base Color'])
    principled.inputs['Roughness'].default_value = 0.86
    obj.data.materials.append(material)

bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.08))
water = bpy.context.object
water.dimensions = (42, 42, 0.12)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
mat = bpy.data.materials.new('turquoise sea')
mat.diffuse_color = (0.02, 0.21, 0.29, 1)
water.data.materials.append(mat)

world = bpy.context.scene.world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.36, 0.57, 0.75, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.75

bpy.ops.object.light_add(type='AREA', location=(-5, -8, 13))
light = bpy.context.object
light.data.energy = 3500
light.data.size = 9

bpy.ops.object.camera_add(location=(11, -14, 8))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, 3.0)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.lens = 35
bpy.context.scene.camera = camera

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 14
for layer in scene.view_layers:
    layer.cycles.use_denoising = False
scene.render.resolution_x = 1200
scene.render.resolution_y = 880
scene.render.resolution_percentage = 100
scene.render.filepath = str(destination)
bpy.ops.render.render(write_still=True)
print('RENDERED', destination)
