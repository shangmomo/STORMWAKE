from motioninspect import *
from scipy.spatial.transform import Slerp
import hashlib
folder=Path('public/models/expedition/v75')
mg,mb=read(z.read('KinemIQ_Mannequin.glb')); ms=bind(mg,mb)
tg,tb=read(Path('public/models/land/v73/captain.glb').read_bytes()); ts=bind(tg,tb); tw,tp=rest(tg)
# Absolute world rotation deltas in common Y-up, +Z-forward bind frames.
# Only torso/head/arms: no root, pelvis, legs or fingers are replaced.
mapping={23:'spine_01',24:'spine_02',25:'spine_03',26:'clavicle_l',27:'upperarm_l',28:'lowerarm_l',29:'hand_l',45:'clavicle_r',46:'upperarm_r',47:'lowerarm_r',48:'hand_r',65:'neck_01',66:'Head'}
def Rmat(m):return R.from_matrix(m[:3,:3]/np.linalg.norm(m[:3,:3],axis=0))
restrot={i:Rmat(m) for i,m in tw.items()};tlocal={i:(restrot[tp[i]].inv()*restrot[i] if i in tp else restrot[i]) for i in tw}
source_bind={mg['nodes'][i]['name']:Rmat(m) for i,m in ms.items()};target_bind={i:Rmat(m) for i,m in ts.items()}
clips=[]
for nm in ['Idle_talking','Action_interact']:
 sg,sb=read(z.read('GLB/'+nm+'.glb'));a=sg['animations'][0];sw,sp=rest(sg);sn={n['name']:i for i,n in enumerate(sg['nodes'])};srest={i:Rmat(m) for i,m in sw.items()};slocal={i:(srest[sp[i]].inv()*srest[i] if i in sp else srest[i]) for i in sw};channels={}
 duration=max(acc(sg,sb,s['input']).max() for s in a['samplers']);times=np.linspace(0,float(duration),round(float(duration)*30)+1)
 for ch in a['channels']:
  if ch['target']['path']!='rotation':continue
  s=a['samplers'][ch['sampler']];ti=acc(sg,sb,s['input']).ravel();v=R.from_quat(acc(sg,sb,s['output']));channels[ch['target']['node']]=Slerp(ti,v)(np.clip(times,ti[0],ti[-1])).as_quat() if len(ti)>1 else np.repeat(v.as_quat(),len(times),axis=0)
 values={i:[] for i in mapping}
 for f,t in enumerate(times):
  sr={};tr={}
  def source(i):
   if i not in sr:
    r=R.from_quat(channels[i][f]) if i in channels else slocal[i];sr[i]=source(sp[i])*r if i in sp else r
   return sr[i]
  def target(i):
   if i in tr:return tr[i]
   parent=target(tp[i]) if i in tp else R.identity()
   if i in mapping:
    name=mapping[i];goal=source(sn[name])*source_bind[name].inv()*target_bind[i];local=parent.inv()*goal;v=local.as_quat();last=values[i][-1] if values[i] else None
    if last is not None and np.dot(last,v)<0:v=-v
    values[i].append(v.tolist());tr[i]=goal
   else:tr[i]=parent*tlocal[i]
   return tr[i]
  for i in tw:target(i)
 clips.append({'name':'V75_'+nm,'duration':float(duration),'channels':[{'node':i,'path':'rotation','times':times.tolist(),'values':np.array(v).round(7).ravel().tolist()} for i,v in values.items()]})
(folder/'captain-motion.json').write_text(json.dumps({'targetSHA256':hashlib.sha256(Path('public/models/land/v73/captain.glb').read_bytes()).hexdigest(),'targetNodes':{str(i):tg['nodes'][i]['name'] for i in mapping},'clips':clips},separators=(',',':')))
print([(a['name'],a['duration'],len(a['channels'])) for a in clips])
