"""Render an inspection image of the original handcrafted Leviathan GLB."""
from pathlib import Path
import bpy
from mathutils import Vector

base = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(base / 'public/models/titans/leviathan.glb'))

def aim(obj, at):
    obj.rotation_euler = (Vector(at) - obj.location).to_track_quat('-Z', 'Y').to_euler()

cam_data = bpy.data.cameras.new('CreatureInspectionCamera')
camera = bpy.data.objects.new('CreatureInspectionCamera', cam_data)
bpy.context.collection.objects.link(camera)
camera.location = (105, 34, 5)
aim(camera, (0, 0, 0))
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 94
bpy.context.scene.camera = camera

for name, xyz, energy, size in (
    ('SoftSun', (25, 74, 0), 21000, 60),
    ('Rim', (-35, 42, -5), 19000, 65),
):
    data = bpy.data.lights.new(name, 'AREA')
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = xyz
    aim(obj, (0, 0, 0))
    data.energy = energy
    data.shape = 'DISK'
    data.size = size

world = bpy.data.worlds.new('DeepOceanAtmosphere')
bpy.context.scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.025, 0.05, 0.075, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.7
sun = bpy.data.lights.new('OceanSun', 'SUN')
sun.energy = 2.2
sun_obj = bpy.data.objects.new('OceanSun', sun)
bpy.context.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (0.35, -0.4, -0.7)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = False
scene.render.resolution_x = 1440
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(base.parent / 'tidewater-leviathan-preview.png')
bpy.ops.render.render(write_still=True)
