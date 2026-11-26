"""V22: regenerate the 120-bone hydra with continuous skull/neck weighting.

Blender: blender --background --python scripts/rig_titans_v21.py
Uses the existing locally licensed PBR source meshes. Preserves original
surface geometry while adding dense, smoothly weighted articulated bones.
"""
import math
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
from rig_titans_v20 import (import_source, finish, feather_chain,
                            add_tube_mesh, assign, new_material)


def line_bones(prefix, coords, root, out):
    """Named chain from N+1 centers with independent controllable segments."""
    names = []
    for k in range(len(coords) - 1):
        name = f'{prefix}{k}'
        out.append((name, coords[k], coords[k + 1], names[-1] if names else root))
        names.append(name)
    return names


def make_shark_v21():
    objs = import_source('great-white-shark.glb')
    bones = [('BodyRoot', (0, -1.1, 0.68), (0, 0, 0.68), None)]
    spine_coords = [(0, -0.05 + 2.5 * i / 12, 0.66 - 0.17 * i / 12) for i in range(13)]
    spine = line_bones('SharkSpine', spine_coords, 'BodyRoot', bones)
    tail = line_bones('TailFin', [(0, 2.42 + 0.48 * i / 6, 0.49 + 0.07 * i / 6) for i in range(7)], spine[-1], bones)
    jaw = line_bones('SharkJaw', [(0, -1.30 - 1.08 * i / 4, 0.40 - 0.04 * i / 4) for i in range(5)], 'BodyRoot', bones)
    fins = {}
    for side, s in [('Left', -1), ('Right', 1)]:
        fins[side] = line_bones(f'Fin{side}', [(s * (0.44 + 1.08 * i / 8), -0.23 + 0.34 * i / 8, 0.70 - 0.28 * i / 8) for i in range(9)], 'BodyRoot', bones)
        line_bones(f'Pelvic{side}', [(s * (0.31 + 0.53 * i / 6), 1.05 + 0.14 * i / 6, 0.56 - 0.21 * i / 6) for i in range(7)], spine[5], bones)
        for i in range(3):
            name = f'Gill{side}{i}'
            bones.append((name, (s * 0.35, -0.92 + i * 0.16, 0.65), (s * 0.46, -0.90 + i * 0.16, 0.67), 'BodyRoot'))
    dorsal = line_bones('Dorsal', [(0, 0.48 + 0.13 * i / 6, 0.83 + 0.7 * i / 6) for i in range(7)], spine[3], bones)
    for ob in objs:
        def weights(v):
            x, y, z = v
            if abs(x) > 0.49 and -0.75 < y < 0.66 and z < 0.94:
                side = 'Left' if x < 0 else 'Right'
                r = min(1, (abs(x) - 0.40) / 0.27)
                return {**{k: r * w for k, w in feather_chain(abs(x), fins[side], [0.44 + 1.08 * i / 7 for i in range(8)]).items()}, 'BodyRoot': 1 - r}
            if abs(x) > 0.28 and y > 0.79 and z < 0.65:
                side = 'Left' if x < 0 else 'Right'
                return feather_chain(abs(x), [f'Pelvic{side}{i}' for i in range(6)], [0.31 + .53 * i / 5 for i in range(6)])
            if y < -1.30 and z < 0.53:
                return feather_chain(-y, jaw, [1.30 + 1.08 * i / 3 for i in range(4)])
            if z > 0.98 and 0.24 < y < 0.9 and abs(x) < 0.4:
                return feather_chain(z, dorsal, [0.83 + 0.7 * i / 5 for i in range(6)])
            if -1.0 < y < -0.40 and abs(x) > 0.28 and z > 0.50:
                idx = min(2, int((y + 1) / .2))
                return {f'Gill{"Left" if x < 0 else "Right"}{idx}': .18, 'BodyRoot': .82}
            return feather_chain(y, ['BodyRoot', *spine, *tail], [-0.6, *[-.05 + 2.5 * i / 11 for i in range(12)], *[2.42 + .48 * i / 5 for i in range(6)]])
        assign(ob, weights)
    finish(objs, bones, 'shark-skeleton.glb')


def make_turtle_v21():
    objs = import_source('sea-turtle.glb')
    bones = [('BodyRoot', (0, -.10, .25), (0, .12, .25), None)]
    shell = line_bones('Shell', [(0, -.31 + .76 * i / 10, .33 + .08 * math.sin(math.pi * i / 10)) for i in range(11)], 'BodyRoot', bones)
    neck = line_bones('Neck', [(0, -.29 - .40 * i / 9, .24 + .02 * i / 9) for i in range(10)], 'BodyRoot', bones)
    bones.append(('TurtleHead', (0, -.7, .27), (0, -.79, .28), neck[-1]))
    line_bones('TurtleJaw', [(0, -.53 - .2 * i / 4, .19) for i in range(5)], 'TurtleHead', bones)
    fins = {}
    for part in ['Front', 'Back']:
        for side, s in [('L', -1), ('R', 1)]:
            key = f'{part}Fin{side}'
            y0 = -.24 if part == 'Front' else .31
            y1 = -.49 if part == 'Front' else .58
            coords = [(s * (.24 + .68 * i / 10), y0 + (y1-y0) * i / 10, .17 - .06 * i / 10) for i in range(11)]
            fins[key] = line_bones(key, coords, 'BodyRoot', bones)
    tail = line_bones('TurtleTail', [(0, .30 + .42 * i / 8, .15 - .06 * i / 8) for i in range(9)], 'BodyRoot', bones)
    for ob in objs:
        def weights(v):
            x,y,z=v
            if abs(x) > .25 and z < .26:
                part = 'Front' if y < .08 else 'Back'
                key = f'{part}Fin{"L" if x < 0 else "R"}'
                r = min(1, max(0, (abs(x)-.24)/.22))
                return {**{k: r*w for k,w in feather_chain(abs(x), fins[key], [.24 + .68 * i/9 for i in range(10)]).items()}, 'BodyRoot': 1-r}
            if y < -.29 and z < .4:
                if y < -.68: return {'TurtleHead': 1}
                return feather_chain(-y, neck, [.29 + .4*i/8 for i in range(9)])
            if y > .42 and abs(x) < .19 and z < .24:
                return feather_chain(y, tail, [.30 + .42*i/7 for i in range(8)])
            if z > .32:
                weights = feather_chain(y, shell, [-.31 + .76*i/9 for i in range(10)])
                return {**{k:w*.12 for k,w in weights.items()}, 'BodyRoot': .88}
            return {'BodyRoot': 1}
        assign(ob, weights)
    finish(objs, bones, 'turtle-skeleton.glb')


def make_kraken_v21():
    objs = import_source('kraken.glb')
    skin = objs[0].data.materials[0]
    underside = new_material('KrakenSuckerInteriorWet', (.23,.035,.067), .43, .12)
    bones = [('BodyRoot', (0, 0, .50), (0,0,1.2), None)]
    mantle = line_bones('KrakenMantle', [(0,0,1.00 + 1.70 * i/12) for i in range(13)], 'BodyRoot', bones)
    line_bones('Siphon', [(0, .18 + .42*i/6, .57-.06*i/6) for i in range(7)], 'BodyRoot', bones)
    arm_names = {}
    for i in range(8):
        a = i * math.tau / 8
        radial = Vector((math.cos(a), math.sin(a), 0))
        pts = [tuple(radial*(.33+4.30*k/24) + Vector((0,0,.58-1.11*k/24))) for k in range(25)]
        arm_names[i] = line_bones(f'Arm{i}_', pts, 'BodyRoot', bones)
    def original_weights(v):
        x,y,z = v
        r = math.hypot(x,y)
        if z > 1: return feather_chain(z, mantle, [1+1.70*i/11 for i in range(12)])
        if r < .32: return {'BodyRoot': 1}
        theta = (math.atan2(y,x)+math.tau)%math.tau
        i = round(theta*8/math.tau)%8
        return feather_chain(r, arm_names[i], [.33+4.30*k/23 for k in range(24)])
    for ob in objs: assign(ob, original_weights)
    for i in range(8):
        a = i*math.tau/8
        radial = Vector((math.cos(a),math.sin(a),0))
        pts=[]; radii=[]
        for j in range(121):
            t=j/120
            pts.append(tuple(radial*(.33 + 4.34*t) + Vector((0,0,.60-1.16*t+.16*math.sin(t*math.pi*3+a)))))
            radii.append((.24*(1-t)+.022)*(1+.09*math.sin(t*26+a)))
        ob=add_tube_mesh(f'Kraken_24BoneArm{i}_PBR',pts,radii,skin)
        assign(ob, lambda v, key=i: feather_chain(math.hypot(v.x,v.y),arm_names[key],[.33 + 4.30*j/23 for j in range(24)]))
        objs.append(ob)
        for j in range(20):
            t = .075 + j*.043
            idx = int(t*120)
            p = Vector(pts[idx])
            bpy.ops.mesh.primitive_torus_add(major_segments=10,minor_segments=6,
                                              location=(p.x,p.y,p.z-radii[idx]))
            sucker=bpy.context.object
            sucker.name=f'Sucker_Arm{i}_{j}'
            sucker.scale=((.059*(1-t)+.012),)*3
            bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
            sucker.data.materials.append(underside)
            k = min(23,int(t*24))
            assign(sucker,lambda v,n=arm_names[i][k]:{n:1})
            objs.append(sucker)
    finish(objs,bones,'kraken-skeleton.glb')


def make_hydra_v22():
    objs = import_source('leviathan.glb')
    original = list(objs)
    body = next(o for o in objs if 'ScaleSkin' in o.name)
    skin = body.data.materials[0]
    bones = [('BodyRoot', (0,24,0), (0,20,0), None)]
    body_names = line_bones('HydraSpine', [(0,21-38*i/20,0) for i in range(21)], 'BodyRoot', bones)
    neck_names={}
    for side,label in [(0,'C'),(-1,'L'),(1,'R')]:
        pts=[]
        for i in range(29):
            t=i/28
            x = side*(4.5 + 6 * t*t*(3-2*t))
            y = -16 - 18*t
            z = (0 if side==0 else .5+3.7*t)
            pts.append((x,y,z))
        neck_names[label] = line_bones(f'{label}_', pts,body_names[-1],bones)
        dx=side*10.5; dz = 0 if side == 0 else 4.2
        bones.append((f'{label}_Head',(dx,-34,dz),(dx,-38,dz),neck_names[label][-1]))
        line_bones(f'{label}_Jaw', [(dx,-35-.9*j/4,dz-.9-.18*j/4) for j in range(5)],f'{label}_Head',bones)
    def original_weights(v):
        y=v.y
        if y < -16:
            t = max(0, min(1, (-y-32.8)/2.5))
            t = t*t*(3-2*t)
            neck = feather_chain(-y, neck_names['C'], [16+18*i/27 for i in range(28)])
            return {**{n: w*(1-t) for n,w in neck.items()}, 'C_Head': t} if t > 0 else neck
        return feather_chain(-y, body_names, [-21+38*i/19 for i in range(20)])
    for ob in original:
        if 'LowerJaw' in ob.name:
            assign(ob,lambda v: feather_chain(-v.y,[f'C_Jaw{i}' for i in range(4)],[35+.9*i/3 for i in range(4)]))
        elif any(q in ob.name for q in ('Iris','Eye','Ivory','InnerJaw')):
            assign(ob,lambda v:{'C_Head':1})
        else: assign(ob,original_weights)
    for side,label in [(-1,'L'),(1,'R')]:
        dx=side*10.5;dz=4.2
        skull=body.copy();skull.data=body.data.copy()
        bpy.context.collection.objects.link(skull)
        bm=bmesh.new();bm.from_mesh(skull.data)
        bmesh.ops.delete(bm,geom=[v for v in bm.verts if v.co.y>-28],context='VERTS')
        bm.to_mesh(skull.data);bm.free()
        skull.name=f'{label}_V22_HighDetailHead'
        for v in skull.data.vertices:v.co.x+=dx;v.co.z+=dz
        assign(skull,lambda v, n=label:{f'{n}_Head':1})
        objs.append(skull)
        for ob in original:
            if not any(q in ob.name for q in ('Jaw','Iris','Eye','Ivory')):continue
            dupe=ob.copy();dupe.data=ob.data.copy()
            bpy.context.collection.objects.link(dupe)
            dupe.name=f'{label}_V22_{ob.name}'
            for v in dupe.data.vertices:v.co.x+=dx;v.co.z+=dz
            if 'LowerJaw' in ob.name:
                assign(dupe,lambda v,n=label: feather_chain(-v.y,[f'{n}_Jaw{i}' for i in range(4)],[35+.9*i/3 for i in range(4)]))
            else:assign(dupe,lambda v,n=label:{f'{n}_Head':1})
            objs.append(dupe)
        pts=[]; radii=[]
        for i in range(128):
            t=i/127
            pts.append((side*(4.5+6*t*t*(3-2*t)),-16-19*t,.5+3.7*t+.8*math.sin(math.pi*t)))
            radii.append(2.65*(1-t)+1.25*t)
        ob=add_tube_mesh(f'{label}_V22_28BoneNeck',pts,radii,skin)
        def neck_weights(v, n=label):
            y = -v.y
            t = max(0, min(1, (y-32.8)/2.5))
            t = t*t*(3-2*t)
            chain = feather_chain(y,neck_names[n],[16+18*i/27 for i in range(28)])
            return {**{bone: w*(1-t) for bone,w in chain.items()}, f'{n}_Head': t} if t > 0 else chain
        assign(ob,neck_weights)
        objs.append(ob)
    finish(objs,bones,'hydra-skeleton.glb')


if __name__=='__main__':
    # V21's other three PBR rigs already have dense bones and stay untouched.
    make_hydra_v22()
