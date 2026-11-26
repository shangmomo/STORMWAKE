"""Turn the licensed Sketchfab stage asset into an animated *creature* GLB.

Run with Blender 4.3+:
    blender -b -t 4 --python scripts/prepare_artist_leviathan.py -- SOURCE.glb OUTPUT.glb

The original file contains a landscape mesh and thousands of stage motes;
neither is part of the whale's physical body. The extracted detailed whale
keeps its author textures and receives a weighted 66-link tail skeleton with
three smooth motion clips. This is procedural rigging, not artist-authored
facial / jaw animation. Source attribution is retained in the game's docs.
"""

from math import pi, sin
from pathlib import Path
import sys

import bpy
from mathutils import Vector


SPINE_COUNT = 66
HEAD_ANCHOR = -0.018
TAIL_END = 0.137


def clean_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def import_whale(path):
    bpy.ops.import_scene.gltf(filepath=str(path))
    body = []
    for ob in list(bpy.context.scene.objects):
        if ob.type != 'MESH':
            continue
        if ob.name.startswith('pasted__Mesh1_') or ob.name.startswith('pCube1_blinn1'):
            body.append(ob)
        else:
            bpy.data.objects.remove(ob, do_unlink=True)
    assert len(body) == 2, f'Expected detailed whale body and eyes; got {[o.name for o in body]}'
    for ob in body:
        matrix = ob.matrix_world.copy()
        ob.parent = None
        ob.matrix_world = matrix
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return body


def make_skeleton():
    arm_data = bpy.data.armatures.new('Leviathan_66JointSpine')
    arm = bpy.data.objects.new('Leviathan_66JointSpine', arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    prev = None
    for i in range(SPINE_COUNT):
        q = i / SPINE_COUNT
        k = (i + 1) / SPINE_COUNT
        bone = arm_data.edit_bones.new(f'GodSpine{i}')
        bone.head = (0, HEAD_ANCHOR + (TAIL_END - HEAD_ANCHOR) * q, 0.151)
        bone.tail = (0, HEAD_ANCHOR + (TAIL_END - HEAD_ANCHOR) * k, 0.151)
        if prev:
            bone.parent = prev
            bone.use_connect = True
        prev = bone
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def skin_whale(body, arm):
    for ob in body:
        groups = [ob.vertex_groups.new(name=f'GodSpine{i}') for i in range(SPINE_COUNT)]
        for vert in ob.data.vertices:
            # Head/teeth are anchored: articulated tail is allowed to bend,
            # never smear jaw triangles across a fake deformation spline.
            frac = max(0.0, min(1.0, (vert.co.y - HEAD_ANCHOR) / (TAIL_END - HEAD_ANCHOR)))
            p = frac * (SPINE_COUNT - 1)
            lo = int(p)
            hi = min(SPINE_COUNT - 1, lo + 1)
            w = p - lo
            groups[lo].add([vert.index], max(0.00001, 1 - w), 'REPLACE')
            if hi != lo and w > .00001:
                groups[hi].add([vert.index], w, 'REPLACE')
        modifier = ob.modifiers.new('ActualJointSkinning', 'ARMATURE')
        modifier.object = arm
        modifier.use_deform_preserve_volume = True
        ob.parent = arm


def make_clips(arm):
    # Each animation returns exactly to its initial pose for seamless loops.
    scene = bpy.context.scene
    scene.render.fps = 24
    scene.frame_start, scene.frame_end = 1, 97
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    for label, speed, amp, tail_kick in [
        ('Swim', 1.0, .0085, .013),
        ('Charge', 2.0, .0135, .033),
        ('Attack', 2.0, .011, .047),
    ]:
        if not arm.animation_data:
            arm.animation_data_create()
        arm.animation_data.action = None
        for pose in arm.pose.bones:
            pose.rotation_mode = 'XYZ'
        for frame in range(1, 98, 4):
            t = (frame - 1) / 96
            for i in range(SPINE_COUNT):
                bone = arm.pose.bones[f'GodSpine{i}']
                depth = i / (SPINE_COUNT - 1)
                # The tail moves through a *hierarchical skin*, keeping the
                # skull fixed and recovering a consistent neutral shape.
                wave = sin(2 * pi * t * speed - i * .23)
                bone.rotation_euler.x = (.002 + .004 * depth) * wave * depth
                bone.rotation_euler.z = (amp + tail_kick * depth) * (depth ** 1.6) * wave
                bone.keyframe_insert(data_path='rotation_euler', frame=frame, group='GodSpine')
        action = arm.animation_data.action
        action.name = label
        # Separate NLA tracks yield distinct named animation clips in GLB.
        track = arm.animation_data.nla_tracks.new()
        track.name = label
        track.strips.new(label, 1, action)
        # Unlink the live action so the next clip can be authored independently.
        arm.animation_data.action = None
    scene.frame_set(1)


def export_whale(path):
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=False,
        export_animations=True, export_animation_mode='NLA_TRACKS',
        export_materials='EXPORT', export_texcoords=True,
        export_normals=True, export_skins=True, export_image_format='AUTO',
    )


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    if len(args) != 2:
        raise SystemExit('Need source GLB and destination GLB')
    source, destination = (Path(p).resolve() for p in args)
    clean_scene()
    body = import_whale(source)
    arm = make_skeleton()
    skin_whale(body, arm)
    make_clips(arm)
    destination.parent.mkdir(parents=True, exist_ok=True)
    export_whale(destination)
    print('ARTIST_LEVIATHAN_RIGGED', destination, 'body meshes', len(body), 'bones', SPINE_COUNT)


if __name__ == '__main__':
    main()
