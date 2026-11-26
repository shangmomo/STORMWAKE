import bpy, math
from mathutils import Vector
def smoothstep(a,b,x):
    t=max(0.,min(1.,(x-a)/(b-a)))
    return t*t*(3.-2.*t)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath='/workspace/scratch/de3cf2317781/v27_work/public/models/titans/external/leviathan-monster.glb')
mesh_objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name!='Icosphere']
if '--mouth-open' in __import__('sys').argv:
    for obj in mesh_objects:
        if 'pasted__Mesh1' not in obj.name: continue
        affected=0
        for vertex in obj.data.vertices:
            # Blender imports glTF Y-up as Blender Z-up. Match the shader's
            # original GLB coordinates instead of deforming the whole whale.
            raw_z=-vertex.co.y
            raw_y=vertex.co.z
            opening=smoothstep(.064,.124,raw_z)*(1.-smoothstep(.156,.168,raw_y))
            if opening>.1: affected+=1
            vertex.co.z-=.0140*opening
            vertex.co.y+=.0016*opening
        print('JAW_AFFECTED', affected, 'TOTAL', len(obj.data.vertices))
for obj in mesh_objects:
    print('MESH',obj.name,tuple(round(v,4) for v in obj.dimensions),tuple(round(v,4) for v in obj.location))
points=[obj.matrix_world @ Vector(v) for obj in mesh_objects for v in obj.bound_box]
lo=Vector((min(p[i] for p in points) for i in range(3)))
hi=Vector((max(p[i] for p in points) for i in range(3)))
mid=(lo+hi)/2
width=max((hi-lo))
print('BBOX',list(lo),list(hi))
for o in bpy.context.scene.objects:
    if o.type=='ARMATURE':
        print('ARMATURE',o.name,'BONES',len(o.data.bones))
world=bpy.context.scene.world
world.color=(0.24,0.28,0.36)
bpy.ops.object.light_add(type='AREA', location=(mid.x-2*width,mid.y+1.4*width,mid.z+2*width))
bpy.context.object.data.energy=1300
bpy.context.object.data.shape='DISK'
bpy.context.object.data.size=width*1.5
bpy.ops.object.camera_add(location=(mid.x+width*2.5,mid.y+width*.3,mid.z+width*.65))
cam=bpy.context.object
direction=mid-cam.location
cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO'
cam.data.ortho_scale=width*1.6
bpy.context.scene.camera=cam
sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE_NEXT'
sc.render.resolution_x=800
sc.render.resolution_y=600
sc.render.resolution_percentage=100
sc.eevee.taa_render_samples=16
sc.render.image_settings.file_format='PNG'
sc.render.filepath='/workspace/scratch/de3cf2317781/leviathan_jaw_open.png' if '--mouth-open' in __import__('sys').argv else '/workspace/scratch/de3cf2317781/leviathan_preview.png'
bpy.ops.render.render(write_still=True)
