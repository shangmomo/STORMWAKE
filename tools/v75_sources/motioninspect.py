import struct,zipfile,json,numpy as np
from scipy.spatial.transform import Rotation as R
from pathlib import Path
z=zipfile.ZipFile(Path(__file__).with_name('KinemIQ_Free_Animations_CC0_GLB.zip'))
def read(b):
 n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);return g,b[28+n:]
def acc(g,b,i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];return np.frombuffer(b,dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']],count=a['count']*{'MAT4':16,'VEC4':4,'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']],offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],-1)
def rest(g):
 nodes=g['nodes'];P={c:i for i,n in enumerate(nodes) for c in n.get('children',[])};W={}
 def world(i):
  if i in W:return W[i]
  n=nodes[i];m=np.eye(4)
  if 'matrix' in n:m=np.array(n['matrix']).reshape(4,4).T
  else:m[:3,:3]=R.from_quat(n.get('rotation',[0,0,0,1])).as_matrix()*np.array(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);
  W[i]=world(P[i])@m if i in P else m;return W[i]
 for i in range(len(nodes)):world(i)
 return W,P
def bind(g,b):
 sk=g['skins'][0];A=acc(g,b,sk['inverseBindMatrices']);return {i:np.linalg.inv(a.reshape(4,4).T) for i,a in zip(sk['joints'],A)}
if __name__=='__main__':
 for name,bytes_ in [('mannequin',z.read('KinemIQ_Mannequin.glb')),('captain',Path('public/models/land/v73/captain.glb').read_bytes())]:
  g,b=read(bytes_);w,parents=rest(g);bi=bind(g,b);print(name,len(bi),'roots',g['scenes'][0]['nodes']);
  for i,n in enumerate(g['nodes']):
   if any(t in n.get('name','').lower() for t in ['hub','spine','arm1','arm2','palm','collarbone','leg1','leg2','ankle','tail1','upperarm','lowerarm','clavicle','hand_','thigh','calf','foot_','pelvis','neck_','head','root']):
    print(i,n.get('name'),np.round(w[i][:3,3],3),np.round(bi[i][:3,3],3) if i in bi else None, 'scale',np.round(np.linalg.norm(w[i][:3,:3],axis=0),4))
 for p in ['Idle_talking','Action_interact','Walk_forwards','Sword_slash']:
  g,b=read(z.read('GLB/'+p+'.glb'));a=g['animations'][0];print(p,len(g.get('skins',[])),len(a['channels']),[(g['nodes'][c['target']['node']].get('name'),c['target']['path']) for c in a['channels'] if c['target']['path']!='rotation'][:20], 'duration',max(acc(g,b,s['input']).max() for s in a['samplers']))
