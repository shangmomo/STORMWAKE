"""Produce Tidewater's original skinned shoreline crab (fully offline, CC0-like own art).

34+ articulated joint skeleton, indexed skinning and six separately authored
keyframe clips. Mesh is multi-surface with tapering exoskeleton segments,
pincers, abdomen, compound eyes and geometric shell micro-detail.
No external files or network dependencies; Python 3 stdlib only.
"""
from __future__ import annotations
import math, random, json, struct, pathlib
from build_land_motion_v36 import GLB, qmul, axisq, pad4
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models/land/crab.glb'
RNG=random.Random(36003)
N=32
nodes=[]; joints=[]; world=[]

def bone(name,parent=None,point=(0,0,0)):
    idx=len(nodes);base=world[parent] if parent is not None else (0,0,0)
    pos=tuple(point[i]-base[i] for i in range(3))
    nodes.append({'name':name,'translation':[float(x) for x in pos]})
    if parent is not None:nodes[parent].setdefault('children',[]).append(idx)
    joints.append(idx);world.append(tuple(point));return idx

root=bone('CrabRoot',point=(0,0,0))
body=bone('Carapace',root,(0,.45,0))
legs={}
for sign,side in ((1,'L'),(-1,'R')):
    for i,z in enumerate((-.23,-.07,.12,.28)):
        z1=z+(i-1.5)*.028
        a=bone(f'{side}{i+1}_Coxa',body,(sign*.35,.40,z))
        b=bone(f'{side}{i+1}_Femur',a,(sign*.56,.37,z1))
        c=bone(f'{side}{i+1}_Tibia',b,(sign*.80,.23,z1+.07))
        legs[(side,i)]=(a,b,c,(sign*.96,.035,z1+.12))
claws={}
for sign,side in ((1,'L'),(-1,'R')):
    a=bone(f'{side}_ClawBase',body,(sign*.32,.52,.29))
    b=bone(f'{side}_ClawPalm',a,(sign*.57,.56,.48))
    c=bone(f'{side}_ClawFinger',b,(sign*.74,.51,.65))
    claws[side]=(a,b,c,(sign*.87,.49,.80))
eyes=[]
for sign,side in ((1,'L'),(-1,'R')):
    eyes.append((bone(f'{side}_EyeStalk',body,(sign*.19,.57,.245)),(sign*.19,.68,.35)))
assert len(joints)>=34

class Surface:
    def __init__(self):self.p=[];self.faces=[];self.b=[]
    def add(self,pos,boneid):self.p.append(tuple(float(a) for a in pos));self.b.append(boneid);return len(self.p)-1
    def tri(self,a,b,c):self.faces.append((a,b,c))
    def quad(self,a,b,c,d):self.tri(a,b,c);self.tri(a,c,d)
    def normals(self):
        norm=[[0.,0.,0.] for p in self.p]
        for a,b,c in self.faces:
            x,y,z=(self.p[b][i]-self.p[a][i] for i in range(3))
            X,Y,Z=(self.p[c][i]-self.p[a][i] for i in range(3))
            n=(y*Z-z*Y,z*X-x*Z,x*Y-y*X)
            for i in (a,b,c):
                for q in range(3):norm[i][q]+=n[q]
        return [tuple(k/(math.sqrt(sum(v*v for v in n)) or 1) for k in n) for n in norm]

shell,limbs,claw,detail,mottles,teeth=(Surface() for _ in range(6))

def ellipsoid(surface,centre,radius,boneid,res=20,rows=9,theta0=.0,theta1=math.pi):
    rx,ry,rz=radius;cx,cy,cz=centre
    rings=[]
    for j in range(rows+1):
        th=theta0+(theta1-theta0)*j/rows;rr=[]
        for i in range(res+1):
            a=2*math.pi*i/res
            # shell ridge geometry is a genuine varying profile rather than sphere primitives
            ripple=1+.015*math.cos(8*a)*math.sin(th)**2
            pos=(cx+rx*math.sin(th)*math.cos(a)*ripple,
                 cy+ry*math.cos(th)+.006*math.cos(14*a+th*5)*math.sin(th)**3,
                 cz+rz*math.sin(th)*math.sin(a)*ripple)
            rr.append(surface.add(pos,boneid))
        rings.append(rr)
    for j in range(rows):
        for i in range(res):
            a,b,c,d=rings[j][i],rings[j][i+1],rings[j+1][i+1],rings[j+1][i]
            surface.quad(a,b,c,d)

def shaft(surface,a,b,r0,r1,boneid,n=9):
    dx,dy,dz=(b[i]-a[i] for i in range(3));m=math.sqrt(dx*dx+dy*dy+dz*dz);v=(dx/m,dy/m,dz/m)
    helper=(0,1,0) if abs(v[1])<.85 else (0,0,1)
    x=(v[1]*helper[2]-v[2]*helper[1],v[2]*helper[0]-v[0]*helper[2],v[0]*helper[1]-v[1]*helper[0])
    q=math.sqrt(sum(t*t for t in x));x=tuple(t/q for t in x)
    y=(v[1]*x[2]-v[2]*x[1],v[2]*x[0]-v[0]*x[2],v[0]*x[1]-v[1]*x[0])
    p=[]
    for c,r in ((a,r0),(b,r1)):
        p.append([surface.add(tuple(c[k]+r*(math.cos(2*math.pi*i/n)*x[k]+math.sin(2*math.pi*i/n)*y[k]) for k in range(3)),boneid) for i in range(n)])
    for i in range(n):surface.quad(p[0][i],p[0][(i+1)%n],p[1][(i+1)%n],p[1][i])
    centre0=surface.add(a,boneid);centre1=surface.add(b,boneid)
    for i in range(n):
        surface.tri(centre0,p[0][(i+1)%n],p[0][i]);surface.tri(centre1,p[1][i],p[1][(i+1)%n])

ellipsoid(shell,(0,.46,-.025),(.46,.18,.345),body,32,15)
ellipsoid(shell,(0,.36,.0),(.33,.075,.28),body,24,7)
# Separate shell rim, ridged lateral crenellations and surface roughness nodules.
for i in range(38):
    a=2*math.pi*i/38
    x=.444*math.cos(a);z=.33*math.sin(a)
    ellipsoid(shell,(x,.43,z),(.035,.025,.040),body,8,4)
for i in range(95):
    phi=RNG.uniform(0,2*math.pi);rad=math.sqrt(RNG.uniform(.005,.83))
    x=.43*rad*math.cos(phi);z=.31*rad*math.sin(phi)
    y=.46+.18*math.sqrt(max(0,1-rad*rad))
    ellipsoid(mottles,(x,y,z),(.009,.007,.011),body,6,3)
# Eight physically articulated three-segment legs.
for (side,i),(a,b,c,tip) in legs.items():
    shaft(limbs,world[a],world[b],.065,.048,a)
    shaft(limbs,world[b],world[c],.05,.029,b)
    shaft(limbs,world[c],tip,.035,.006,c)
    ellipsoid(limbs,world[b],(.057,.048,.055),b,8,5)
    ellipsoid(limbs,world[c],(.039,.04,.04),c,8,4)
# Two movable, asymmetric pincer assemblies, with curved tooth tips.
for side,(a,b,c,tip) in claws.items():
    shaft(claw,world[a],world[b],.11,.075,a,12)
    ellipsoid(claw,world[b],(.16,.09,.14),b,16,9)
    shaft(claw,world[b],world[c],.065,.045,b,12)
    sign=1 if side=='L' else -1
    shaft(claw,world[c],tip,.053,.010,c,10)
    shaft(claw,world[c],(tip[0]-sign*.10,tip[1]-.045,tip[2]+.07),.042,.005,c,9)
    for k in range(3):
        ellipsoid(teeth,(world[c][0]-sign*(k+1)*.028,world[c][1]-.029,world[c][2]+.045+.025*k),(.016,.013,.021),c,6,4)
# Eyestalks plus black corneal tips and small mandible plates.
for joint,end in eyes:
    shaft(limbs,world[joint],end,.027,.021,joint)
    ellipsoid(detail,end,(.055,.063,.048),joint,13,8)
for sign in (-1,1):
    ellipsoid(claw,(sign*.10,.335,.327),(.07,.028,.038),body,10,5)

materials=[
  {'name':'rust-red layered carapace','pbrMetallicRoughness':{'baseColorFactor':[.29,.075,.041,1],'metallicFactor':0,'roughnessFactor':.68},'doubleSided':True},
  {'name':'dark mottled segmented legs','pbrMetallicRoughness':{'baseColorFactor':[.20,.115,.085,1],'metallicFactor':0,'roughnessFactor':.76},'doubleSided':True},
  {'name':'brass-brown wet pincers','pbrMetallicRoughness':{'baseColorFactor':[.37,.15,.085,1],'metallicFactor':0,'roughnessFactor':.58},'doubleSided':True},
  {'name':'black glossy sensory eyes','pbrMetallicRoughness':{'baseColorFactor':[.038,.034,.031,1],'metallicFactor':0,'roughnessFactor':.28},'doubleSided':True},
  {'name':'rust sienna shell mottles','pbrMetallicRoughness':{'baseColorFactor':[.19,.060,.033,1],'metallicFactor':0,'roughnessFactor':.78},'doubleSided':True},
  {'name':'ivory shell teeth','pbrMetallicRoughness':{'baseColorFactor':[.70,.55,.39,1],'metallicFactor':0,'roughnessFactor':.68},'doubleSided':True},
]

# glTF writer created without a source file, but shares GLB's accessors and clip writer.
g=GLB.__new__(GLB);g.path=OUT;g.bin=b''
g.j={'asset':{'version':'2.0','generator':'Tidewater V36 original rigged crab builder'},
 'scene':0,'scenes':[{'nodes':[root,len(nodes)]}], 'nodes':nodes,
 'materials':materials, 'meshes':[{'name':'FullSkinnedCrab','primitives':[]}],
 'bufferViews':[],'accessors':[],'animations':[],'skins':[],'buffers':[{'byteLength':0}]}
for material,surface in enumerate((shell,limbs,claw,detail,mottles,teeth)):
    nrm=surface.normals();p=g.addarray(surface.p,'VEC3');nn=g.addarray(nrm,'VEC3')
    uv=g.addarray([((v[0]+1.2)/2.4,(v[2]+1.2)/2.4) for v in surface.p],'VEC2')
    j=g.addarray([(i,0,0,0) for i in surface.b],'VEC4',5123)
    w=g.addarray([(1.,0.,0.,0.) for _ in surface.b],'VEC4')
    ix=g.addarray([(i,) for tri in surface.faces for i in tri],'SCALAR',5123)
    g.j['meshes'][0]['primitives'].append({'attributes':{'POSITION':p,'NORMAL':nn,'TEXCOORD_0':uv,'JOINTS_0':j,'WEIGHTS_0':w},'indices':ix,'material':material,'mode':4})
# mesh is skinned by joint array; mesh geometry coordinates are in bind-world frame.
meshnode=len(nodes);nodes.append({'name':'CrabSkinMesh','mesh':0,'skin':0})
ibm=[]
for x,y,z in world:ibm.append((1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1))
g.j['skins'].append({'name':'CrabArmature','skeleton':root,'joints':joints,'inverseBindMatrices':g.addarray(ibm,'MAT4')})

names=[n['name'] for n in nodes]

def animation(name,duration,f):
    times=[duration*i/(N-1) for i in range(N)];tracks={}
    for joint in joints[1:]:
        nm=names[joint];q=[]
        for t in times:
            turns=f(nm,t/duration)
            quat=(0,0,0,1)
            for axis,angle in turns:quat=qmul(quat,axisq(axis,angle))
            q.append(tuple(quat))
        # All leg and claw joints are keyed to guarantee independent animation.
        if any(sum(abs(z) for z in v[:3])>.00001 for v in q):tracks[(joint,'rotation')]=list(zip(times,q))
    assert len(tracks)>=12,(name,len(tracks))
    g.clip(name,duration,tracks)

def parts(n):
    if n[0:1] in ('L','R') and any(x in n for x in ('Coxa','Femur','Tibia')):
        side=1 if n.startswith('L') else -1
        idx=int(n[1])-1;phase=(idx%2)*math.pi+(0 if side==1 else math.pi)
        return side,idx,phase
    return None

def idle(n,u):
    z=parts(n)
    if z:
        side,i,phase=z
        if 'Coxa' in n:return [('y',.025*math.sin(2*math.pi*u+phase))]
        if 'Femur' in n:return [('z',side*.014*math.sin(2*math.pi*u+phase))]
    if 'ClawBase' in n:return [('y',.038*math.sin(2*math.pi*u))]
    if 'ClawPalm' in n:return [('z',.035*math.sin(2*math.pi*u))]
    if 'ClawFinger' in n:return [('y',.05*math.sin(4*math.pi*u))]
    if 'EyeStalk' in n:return [('z',.07*math.sin(2*math.pi*u+(0 if n[0]=='L' else 1)))]
    if n=='Carapace':return [('z',.013*math.sin(2*math.pi*u))]
    return []

def walk(n,u,power=1):
    z=parts(n)
    if z:
        side,i,phase=z;c=math.sin(2*math.pi*u+phase)
        if 'Coxa' in n:return [('y',.30*power*c)]
        if 'Femur' in n:return [('z',side*.27*power*max(0,c))]
        if 'Tibia' in n:return [('z',side*.17*power*max(0,c+.2))]
    if 'ClawBase' in n:return [('y',.09*math.sin(2*math.pi*u+(1 if n[0]=='L' else 0)))]
    if 'ClawPalm' in n:return [('x',.04*math.sin(2*math.pi*u))]
    if 'ClawFinger' in n:return [('y',.08*math.sin(2*math.pi*u))]
    if 'EyeStalk' in n:return [('z',.04*math.sin(2*math.pi*u))]
    if n=='Carapace':return [('z',.035*math.sin(4*math.pi*u))]
    return []

def attack(n,u):
    w=math.sin(math.pi*min(1,u))**2
    if 'ClawBase' in n:return [('y',(.30 if n[0]=='L' else -.26)*w),('x',-.42*w)]
    if 'ClawPalm' in n:return [('x',.63*w)]
    if 'ClawFinger' in n:return [('y',(.74 if n[0]=='L' else -.65)*w)]
    if 'EyeStalk' in n:return [('z',.17*w)]
    if n=='Carapace':return [('x',-.10*w)]
    z=parts(n)
    if z:
        side,i,phase=z
        if 'Coxa' in n:return [('y',.12*math.sin(2*math.pi*u+phase))]
        if 'Femur' in n:return [('z',side*.10*w)]
    return []

def hit(n,u):
    w=math.sin(math.pi*u)
    if n=='Carapace':return [('x',.24*w),('z',.12*w)]
    if 'Claw' in n:return [('z',(.22 if n.startswith('L') else -.22)*w)]
    if 'EyeStalk' in n:return [('z',-.24*w)]
    z=parts(n)
    if z and 'Coxa' in n:return [('y',.1*math.sin(2*math.pi*u+z[2]))]
    if z and 'Femur' in n:return [('z',z[0]*.06*w)]
    return []

def death(n,u):
    w=u*u*(3-2*u)
    if n=='Carapace':return [('z',.95*w),('x',.20*w)]
    if 'ClawBase' in n:return [('z',(.85 if n[0]=='L' else -.85)*w)]
    if 'ClawPalm' in n:return [('x',-.35*w)]
    if 'ClawFinger' in n:return [('y',.5*w)]
    if 'EyeStalk' in n:return [('x',-.6*w)]
    z=parts(n)
    if z:
        side,i,phase=z
        if 'Coxa' in n:return [('z',side*.32*w)]
        if 'Femur' in n:return [('z',side*.4*w)]
    return []

animation('Idle',2.4,idle)
animation('Walk',1.1,walk)
animation('Run',.64,lambda n,u:walk(n,u,1.25))
animation('Attack',.76,attack)
animation('HitReact',.46,hit)
animation('Death',1.20,death)
g.save()
print(f'Wrote {OUT}: bones={len(joints)} tris={sum(len(s.faces) for s in (shell,limbs,claw,detail,mottles,teeth))} clips={len(g.j["animations"])} bytes={OUT.stat().st_size}')
