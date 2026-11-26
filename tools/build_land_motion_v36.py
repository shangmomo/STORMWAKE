"""V36: bake named skeletal animations into existing licensed GLBs.

The Rocketbox characters keep their original mesh, materials, facial joints and
seven original actions; newly designed body motions are frame-keyed glTF clips.
The motions are *authored in this project*, not falsely attributed to Rocketbox.
This script is idempotent: a second run detects its baked clips and avoids growing source files.
Python 3 standard library only.
"""
from __future__ import annotations
import json, math, struct, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parents[1]
MODEL = ROOT/'public/models'
LAND = MODEL/'land'
N = 25

def pad4(b, fill=b'\x00'):
    return b + fill*((-len(b))%4)

def qmul(a,b):
    x,y,z,w=a; X,Y,Z,W=b
    return (w*X+x*W+y*Z-z*Y, w*Y-x*Z+y*W+z*X, w*Z+x*Y-y*X+z*W, w*W-x*X-y*Y-z*Z)

def axisq(axis,ang):
    s=math.sin(ang*.5); return ({'x':(s,0,0),'y':(0,s,0),'z':(0,0,s)}[axis]+(math.cos(ang*.5),))

def restq(node):
    return tuple(node.get('rotation',[0.,0.,0.,1.]))

def bakeq(base, axis, angle):
    v=qmul(tuple(base),axisq(axis,angle));m=math.sqrt(sum(x*x for x in v));return tuple(x/m for x in v)

class GLB:
    def __init__(self,path):
        self.path=path;b=path.read_bytes()
        if b[:4]!=b'glTF' or struct.unpack_from('<I',b,4)[0]!=2:raise ValueError(f'invalid GLB {path}')
        self.j=None;self.bin=b'';p=12
        while p<len(b):
            length,typ=struct.unpack_from('<II',b,p);p+=8;v=b[p:p+length];p+=length
            if typ==0x4e4f534a:self.j=json.loads(v)
            elif typ==0x004e4942:self.bin=v
        assert self.j and len(self.j.get('buffers',[]))==1
        self.j.setdefault('bufferViews',[]);self.j.setdefault('accessors',[]);self.j.setdefault('animations',[])
    def array(self,accessor):
        a=self.j['accessors'][accessor];v=self.j['bufferViews'][a['bufferView']]
        k={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];typ={5126:'f',5123:'H',5125:'I'}[a['componentType']]
        es=struct.calcsize('<'+typ);stride=v.get('byteStride',k*es)
        start=v.get('byteOffset',0)+a.get('byteOffset',0)
        return [struct.unpack_from('<'+typ*k,self.bin,start+i*stride) for i in range(a['count'])]
    def addarray(self,arr,kind,typ=5126):
        n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[kind]
        assert all(len(row)==n for row in arr)
        t={5126:'f',5123:'H',5125:'I',5121:'B'}[typ]
        raw=b''.join(struct.pack('<'+t*n,*map(float if t=='f' else int,row)) for row in arr)
        ofs=len(self.bin);self.bin=pad4(self.bin+raw)
        bi=len(self.j['bufferViews']);self.j['bufferViews'].append({'buffer':0,'byteOffset':ofs,'byteLength':len(raw)})
        acc={'bufferView':bi,'componentType':typ,'count':len(arr),'type':kind}
        if kind=='SCALAR' and t=='f':acc.update(min=[float(min(x[0] for x in arr))],max=[float(max(x[0] for x in arr))])
        ai=len(self.j['accessors']);self.j['accessors'].append(acc)
        return ai
    def clip(self,name,duration,tracks):
        # tracks: { (node,path): [(time,vector), ...] }
        self.j['animations']=[c for c in self.j['animations'] if c['name']!=name]
        samplers=[];channels=[]; tcache={}
        for (node,path),keyframes in tracks.items():
            times=[(float(t),) for t,_ in keyframes];data=[tuple(float(v) for v in values) for _,values in keyframes]
            tkey=tuple(round(x[0],6) for x in times)
            if tkey not in tcache:tcache[tkey]=self.addarray(times,'SCALAR')
            a=self.addarray(data,'VEC4' if path=='rotation' else 'VEC3')
            samplers.append({'input':tcache[tkey],'output':a,'interpolation':'LINEAR'})
            channels.append({'sampler':len(samplers)-1,'target':{'node':node,'path':path}})
        self.j['animations'].append({'name':name,'samplers':samplers,'channels':channels,
                'extras':{'authoredBy':'Tidewater V36','source':'baked animation curves','duration':duration}})
    def save(self,path=None):
        self.j['buffers'][0]['byteLength']=len(self.bin)
        j=pad4(json.dumps(self.j,ensure_ascii=False,separators=(',',':')).encode(),b' ')
        b=pad4(self.bin)
        full=12+8+len(j)+8+len(b)
        out=struct.pack('<III',0x46546c67,2,full)+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(b),0x004e4942)+b
        (path or self.path).write_bytes(out)

def base_pose(g,clipname):
    clip=next(a for a in g.j['animations'] if a['name']==clipname)
    out={}
    for channel in clip['channels']:
        target=channel['target'];path=target['path'];node=target.get('node')
        if node is None or path not in ('translation','rotation','scale'):continue
        sam=clip['samplers'][channel['sampler']]
        out[(node,path)]=g.array(sam['output'])[0]
    return out

def generate_humanoid(path):
    g=GLB(path);names={n.get('name',''):i for i,n in enumerate(g.j['nodes'])}
    if all(any(a.get('name')==n and a.get('extras',{}).get('authoredBy')=='Tidewater V36' for a in g.j['animations']) for n in ('Walk','Run','Attack','Heavy','Dodge','HitReact','Death')):
        return len(g.j['animations'])
    idle=base_pose(g,'idle_neutral_01')
    anatomy={'pelvis':'Bip01 Pelvis','spine':'Bip01 Spine','chest':'Bip01 Spine2',
        'head':'Bip01 Head','neck':'Bip01 Neck',
        'lt':'Bip01 L Thigh','rt':'Bip01 R Thigh','lk':'Bip01 L Calf','rk':'Bip01 R Calf',
        'lf':'Bip01 L Foot','rf':'Bip01 R Foot',
        'la':'Bip01 L UpperArm','ra':'Bip01 R UpperArm',
        'le':'Bip01 L Forearm','re':'Bip01 R Forearm'}
    assert all(v in names for v in anatomy.values()),f'{path} lacks Rocketbox skeleton nodes'
    ids={k:names[v] for k,v in anatomy.items()}
    def motion(name,duration,curve):
        tracks={}
        for (node,axis),fn in curve.items():
            target=ids[node]; key=(target,'rotation');
            base=idle.get(key,restq(g.j['nodes'][target]))
            tracks[key]=[(duration*i/(N-1),bakeq(base,axis,fn(i/(N-1)))) for i in range(N)]
        # Retain neutral eyes, face, hands and posture instead of reverting untracked
        # joints to a T-pose during each full-body animation.
        for (node,path),base in idle.items():
            if (node,path) in tracks:continue
            tracks[(node,path)]=[(0.,base),(duration,base)]
        g.clip(name,duration,tracks)
    for label,duration,factor in [('Walk',1.05,1.0),('Run',.66,1.55)]:
        w=lambda u:2*math.pi*u
        stride=.38*factor
        motion(label,duration,{
            ('lt','z'):lambda u:stride*math.sin(w(u)),('rt','z'):lambda u:-stride*math.sin(w(u)),
            ('lk','z'):lambda u:-.16*factor-max(0,math.sin(w(u)+.25))*.3*factor,
            ('rk','z'):lambda u:-.16*factor-max(0,-math.sin(w(u)+.25))*.3*factor,
            ('lf','z'):lambda u:.12*math.sin(w(u)-.55),('rf','z'):lambda u:-.12*math.sin(w(u)-.55),
            ('la','z'):lambda u:-.28*factor*math.sin(w(u)),('ra','z'):lambda u:.28*factor*math.sin(w(u)),
            ('le','z'):lambda u:.12+(.10 if factor>1 else 0)*math.sin(w(u)),
            ('re','z'):lambda u:-.12-(.10 if factor>1 else 0)*math.sin(w(u)),
            ('pelvis','y'):lambda u:.042*math.sin(2*w(u)),('chest','y'):lambda u:-.047*math.sin(w(u)),
            ('head','y'):lambda u:-.025*math.sin(w(u)),
        })
    wave=lambda u:math.sin(math.pi*min(1,max(0,u)))**2
    motion('Attack',.54,{
        ('ra','z'):lambda u:-.95*wave(u),('re','z'):lambda u:-.62*wave(u),
        ('la','z'):lambda u:.26*wave(u),('chest','y'):lambda u:.20*wave(u),
        ('pelvis','y'):lambda u:.1*wave(u)})
    motion('Heavy',.78,{
        ('ra','z'):lambda u:-1.30*wave(u),('la','z'):lambda u:1.05*wave(u),
        ('re','z'):lambda u:-.40*wave(u),('chest','y'):lambda u:-.28*wave(u),
        ('lt','z'):lambda u:.23*wave(u),('rt','z'):lambda u:-.23*wave(u)})
    motion('Dodge',.64,{
        ('pelvis','z'):lambda u:-.42*wave(u),('chest','z'):lambda u:.64*wave(u),
        ('head','z'):lambda u:-.15*wave(u),('lt','z'):lambda u:.47*wave(u),
        ('rt','z'):lambda u:.50*wave(u),('lk','z'):lambda u:-.78*wave(u),
        ('rk','z'):lambda u:-.78*wave(u),('la','z'):lambda u:.34*wave(u),
        ('ra','z'):lambda u:-.34*wave(u)})
    motion('HitReact',.40,{
        ('chest','z'):lambda u:.35*wave(u),('head','z'):lambda u:-.25*wave(u),
        ('la','z'):lambda u:.32*wave(u),('ra','z'):lambda u:-.32*wave(u)})
    motion('Death',1.27,{
        ('pelvis','z'):lambda u:1.05*(u*u*(3-2*u)),('chest','z'):lambda u:.60*(u*u*(3-2*u)),
        ('head','z'):lambda u:-.28*(u*u*(3-2*u)),
        ('lt','z'):lambda u:-.78*(u*u*(3-2*u)),('rt','z'):lambda u:-.52*(u*u*(3-2*u)),
        ('lk','z'):lambda u:-.38*(u*u*(3-2*u)),('rk','z'):lambda u:-.38*(u*u*(3-2*u)),
        ('la','z'):lambda u:.56*(u*u*(3-2*u)),('ra','z'):lambda u:-.63*(u*u*(3-2*u))})
    g.save();return len(g.j['animations'])

def generate_man_talk(path):
    g=GLB(path);nodes=g.j['nodes'];names={n.get('name',''):i for i,n in enumerate(nodes)}
    get=lambda needle:next(i for n,i in names.items() if n.lower().endswith(needle.lower()))
    head,shoulderL,shoulderR,elbowL,elbowR=(get(x) for x in ('Head','UpperArm.L','UpperArm.R','LowerArm.L','LowerArm.R'))
    if any(a.get('name')=='Talk' and a.get('extras',{}).get('authoredBy')=='Tidewater V36' for a in g.j['animations']):
        return len(g.j['animations'])
    idle=base_pose(g,'HumanArmature|Man_Idle')
    tracks={}
    for node,axis,fn in [(head,'y',lambda t:.045*math.sin(2*math.pi*t*1.2)),
            (shoulderL,'z',lambda t:.11+.14*math.sin(2*math.pi*t*.63)),
            (shoulderR,'z',lambda t:-.13-.15*math.sin(2*math.pi*t*.71+.5)),
            (elbowL,'x',lambda t:.15+.1*math.sin(2*math.pi*t*.71)),
            (elbowR,'x',lambda t:-.13-.1*math.sin(2*math.pi*t*.67+.4))]:
        base=idle.get((node,'rotation'),restq(nodes[node]));tracks[(node,'rotation')]=[
            (2.4*i/(N-1),bakeq(base,axis,fn(2.4*i/(N-1)))) for i in range(N)]
    for key,base in idle.items():
        if key not in tracks:tracks[key]=[(0,base),(2.4,base)]
    g.clip('Talk',2.4,tracks);g.save();return len(g.j['animations'])

def generate_boar_run(path):
    g=GLB(path)
    if any(a.get('name')=='Run' and a.get('extras',{}).get('authoredBy')=='Tidewater V36' for a in g.j['animations']):
        return len(g.j['animations'])
    w=next(a for a in g.j['animations'] if a['name']=='walk')
    old=next(g.array(s['input']) for s in w['samplers'] if s)
    d=max(row[0] for row in old);duration=d*.64
    tracks={}
    for channel in w['channels']:
        target=channel['target'];node=target.get('node');pathkey=target['path']
        if node is None or pathkey not in ('translation','rotation','scale'):continue
        s=w['samplers'][channel['sampler']];times=[a[0]*.64 for a in g.array(s['input'])]
        values=g.array(s['output'])
        # Gait amplitude is increased on four legs. All channels retain original
        # authored joint movement, merely re-timed with additional run pose.
        node_name=g.j['nodes'][node].get('name','')
        if pathkey=='rotation' and ('body_L' in node_name or 'body_R' in node_name or 'body.001_L' in node_name or 'body.001_R' in node_name):
            rest=restq(g.j['nodes'][node]);
            # Minor stride enhancement in local joint space; original rotations remain.
            values=[bakeq(v,'z',.1*math.sin(2*math.pi*t/max(duration,.01))) for t,v in zip(times,values)]
        tracks[(node,pathkey)]=list(zip(times,values))
    # Add a dedicated shoulder and head rebound synchronized to gallop strides.
    head=next(i for i,n in enumerate(g.j['nodes']) if n.get('name')=='head')
    base=restq(g.j['nodes'][head]);tracks[(head,'rotation')]=[
        (duration*i/(N-1),bakeq(base,'x',.14*math.sin(4*math.pi*i/(N-1)))) for i in range(N)]
    g.clip('Run',duration,tracks);g.save();return len(g.j['animations'])


def generate_boar_reactions(path):
    """Replace a 1-frame idle with genuine body/head/tail motion and add hit/death."""
    g=GLB(path)
    if all(any(a.get('name')==n and a.get('extras',{}).get('authoredBy')=='Tidewater V36'
               for a in g.j['animations']) for n in ('idle','HitReact','Death')):
        return len(g.j['animations'])
    nodes={n.get('name',''):i for i,n in enumerate(g.j['nodes'])}
    keys=[(nodes[n],n) for n in ('body','body.001','head','nose','tail','tail.001',
          'body_L','body_R','body.001_L','body.001_R') if n in nodes]
    def clip(name,duration, fn):
        tracks={}
        for i,n in keys:
            base=restq(g.j['nodes'][i])
            tracks[(i,'rotation')]=[(duration*k/(N-1),bakeq(base,'x',fn(n,k/(N-1)))) for k in range(N)]
        assert len(tracks)>=7
        g.clip(name,duration,tracks)
    if not any(a.get('name')=='idle' and a.get('extras',{}).get('authoredBy')=='Tidewater V36' for a in g.j['animations']):
        clip('idle',2.8,lambda n,u: (.025 if 'body' in n else .04 if n=='head' else .06 if 'tail' in n else .02)
             * math.sin(2*math.pi*u + (0.8 if 'tail' in n else 0)))
    if not any(a.get('name')=='HitReact' for a in g.j['animations']):
        clip('HitReact',.48,lambda n,u: ( .31 if n=='head' else .22 if 'body' in n else -.15 if 'tail' in n else .06)
             * math.sin(math.pi*u)**2)
    if not any(a.get('name')=='Death' for a in g.j['animations']):
        clip('Death',1.25,lambda n,u: ( .73 if n in ('body','body.001') else -.25 if n=='head' else .35 if 'tail' in n else -.48)
             * (u*u*(3-2*u)))
    g.save()
    return len(g.j['animations'])

if __name__=='__main__':
    for name in ('joe.glb','marta.glb'):
        p=MODEL/'characters'/name
        print(name,'clips:',generate_humanoid(p),'bytes:',p.stat().st_size)
    for name in ('resident_scout','resident_watchman','resident_courier','resident_apprentice'):
        p=LAND/(name+'.glb');print(name,'clips:',generate_man_talk(p))
    print('boar clips:',generate_boar_run(LAND/'boar.glb'), generate_boar_reactions(LAND/'boar.glb'))
