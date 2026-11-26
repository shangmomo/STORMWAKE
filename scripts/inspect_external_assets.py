"""Blender command: blender -b --python this_file -- input.glb preview.png.

Inspection helper for independently licensed Sketchfab art (does not modify it).
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def main():
    src, dst = map(Path, sys.argv[sys.argv.index("--") + 1:][:2])
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(src.resolve()))
    if '--hero-only' in sys.argv and 'leviathan' in src.name.lower():
        for obj in bpy.context.scene.objects:
            if obj.type == 'MESH' and obj.name.startswith('Group4Form9_material37'):
                obj.hide_render = True
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and not o.hide_render and o.name != 'Icosphere']
    points = [o.matrix_world @ Vector(corner) for o in meshes for corner in o.bound_box]
    minimum = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    maximum = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center = (minimum + maximum) * 0.5
    length = max(maximum[i] - minimum[i] for i in range(3))
    print('SCENE', src.name, 'meshes', len(meshes), 'bbox', tuple(round(x, 3) for x in minimum), tuple(round(x, 3) for x in maximum))
    for ob in meshes:
        bb = [ob.matrix_world @ Vector(corner) for corner in ob.bound_box]
        lo = [round(min(x[i] for x in bb), 3) for i in range(3)]
        hi = [round(max(x[i] for x in bb), 3) for i in range(3)]
        print('OBJECT', ob.name, 'verts', len(ob.data.vertices), 'tris', len(ob.data.polygons), 'bbox', lo, hi)
    # The camera is an orthographic studio preview; it does not alter the model.
    cam_data = bpy.data.cameras.new('AssetQA_Camera')
    cam = bpy.data.objects.new('AssetQA_Camera', cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = center + Vector((1.0, -1.4, .64)).normalized() * length * 2
    direction = center - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = length * 1.48
    world = bpy.data.worlds.new('AssetQA_World')
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes.get('Background').inputs['Color'].default_value = (.075, .10, .15, 1)
    world.node_tree.nodes.get('Background').inputs['Strength'].default_value = .65
    for pos, power, size in [((1, -1, 1), 1800, 18), ((-1, 1, .35), 1300, 22)]:
        dat = bpy.data.lights.new('AssetQA_Light','AREA')
        ob = bpy.data.objects.new('AssetQA_Light', dat)
        bpy.context.collection.objects.link(ob)
        ob.location = center + Vector(pos).normalized() * length
        ob.rotation_euler = (center - ob.location).to_track_quat('-Z','Y').to_euler()
        dat.energy = max(.3, power * (length / 20)**2)
        dat.shape = 'DISK'
        dat.size = length * .8
    scene = bpy.context.scene
    if '--animated' in sys.argv:
        scene.frame_set(23)
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.eevee.taa_render_samples = 8
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 840
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(dst.resolve())
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    scene.render.image_settings.color_mode = 'RGBA'
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', dst)


if __name__ == '__main__':
    main()
