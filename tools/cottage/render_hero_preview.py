"""CPU-only geometry inspection (not a WebGPU game screenshot).

blender -b --python tools/cottage/render_hero_preview.py -- <ply-dir> <out.png>
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
folder, output = Path(args[0]), Path(args[1])
pirate = len(args) > 2 and args[2] == 'pirate'
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
    col = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    col.layer_name = 'Col'
    mat.node_tree.links.new(col.outputs['Color'], principled.inputs['Base Color'])
    principled.inputs['Roughness'].default_value = .84
    if path.stem == 'roofMetal':
        principled.inputs['Metallic'].default_value = .35
    obj.data.materials.append(mat)


def cube(name, loc, dims, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    material = bpy.data.materials.new(name + '_mat')
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (*color, 1)
    obj.data.materials.append(material)


cube('sand_ground', (0, 0, 0.65), (27, 27, .3), (.72, .64, .47))
cube('door_path', (0, -6.4, .825), (1.6, 6, .11), (.49, .40, .28))
world = bpy.context.scene.world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.46, .63, .8, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .8

bpy.ops.object.light_add(type='AREA', location=(-5, -8, 10))
sun = bpy.context.object
sun.data.energy = 2600
sun.data.shape = 'DISK'
sun.data.size = 7

bpy.ops.object.camera_add(location=(12.8, -18.8, 9.6) if pirate else (9.2, -12.6, 6.4))
cam = bpy.context.object
target = Vector((0, -0.85, 4.3) if pirate else (0, -0.85, 2.7))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.lens = 34 if pirate else 41
bpy.context.scene.camera = cam

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16
scene.cycles.use_denoising = False
for layer in scene.view_layers:
    layer.cycles.use_denoising = False
scene.render.resolution_x = 1280
scene.render.resolution_y = 850
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(output)
bpy.ops.render.render(write_still=True)
print('RENDERED', output)
