import os,sys,io,json,hashlib
os.environ['OPENCV_IO_ENABLE_OPENEXR']='1'
import cv2
from PIL import Image
from rockinspect import *
from pathlib import Path
obj=pick(('root',[],nodes),'Objects');g=pick(obj,'Geometry');p=pick(g,'Vertices')[1][0].reshape(-1,3);idx=pick(g,'PolygonVertexIndex')[1][0];assert np.all(idx[2::3]<0) and np.all(idx.reshape(-1,3)[:,:2]>=0);idx=np.where(idx<0,-idx-1,idx);norm=pick(pick(g,'LayerElementNormal'),'Normals')[1][0].reshape(-1,3);uvg=pick(g,'LayerElementUV');uv=pick(uvg,'UV')[1][0].reshape(-1,2)[pick(uvg,'UVIndex')[1][0]];uv[:,1]=1-uv[:,1];
def rot(v):return v[:,[0,2,1]]*np.array([1,1,-1])
p=rot(p[idx]);norm=rot(norm);norm/=np.linalg.norm(norm,axis=1)[:,None];print('bounds',p.min(0),p.max(0),'tris',len(p)//3,'uv',uv.min(0),uv.max(0));# center x/z and base y
p-=np.array([(p[:,0].min()+p[:,0].max())/2,p[:,1].min(),(p[:,2].min()+p[:,2].max())/2]);
B=bytearray();views=[];access=[];images=[]
def view(data,target=None):
 while len(B)%4:B.append(0)
 d={'buffer':0,'byteOffset':len(B),'byteLength':len(data)}
 if target:d['target']=target
 views.append(d);B.extend(data);return len(views)-1
def acc(a,t,comp,target):
 a=np.ascontiguousarray(a);d={'bufferView':view(a.tobytes(),target),'componentType':comp,'count':len(a),'type':t};
 if t=='VEC3':d.update(min=a.min(0).tolist(),max=a.max(0).tolist())
 access.append(d);return len(access)-1
a={k:acc(v.astype('<f4'),t,5126,34962) for k,v,t in [('POSITION',p,'VEC3'),('NORMAL',norm,'VEC3'),('TEXCOORD_0',uv,'VEC2')]};ix=acc(np.arange(len(p),dtype='<u4'),'SCALAR',5125,34963)
def image(data,mime):images.append({'bufferView':view(data),'mimeType':mime});return len(images)-1
im=Image.open(io.BytesIO(z.read('textures/rock_face_01_diff_4k.jpg'))).convert('RGB');im.thumbnail((2048,2048),Image.Resampling.LANCZOS);o=io.BytesIO();im.save(o,format='JPEG',quality=95);image(o.getvalue(),'image/jpeg')
def exr(name):
 a=cv2.imdecode(np.frombuffer(z.read('textures/'+name),np.uint8),cv2.IMREAD_UNCHANGED);assert a is not None and np.isfinite(a).all();print(name,a.shape,a.min(),a.max());return cv2.resize(a,(2048,2048),interpolation=cv2.INTER_AREA)
n=exr('rock_face_01_nor_gl_4k.exr');n=n[:,:,:3][:,:,::-1];n=n*2-1;n/=np.maximum(1e-7,np.linalg.norm(n,axis=2,keepdims=True));n=np.uint8(np.rint(np.clip(n*.5+.5,0,1)*255));o=io.BytesIO();Image.fromarray(n).save(o,format='PNG');image(o.getvalue(),'image/png');r=exr('rock_face_01_rough_4k.exr');r=r[:,:,0] if r.ndim==3 else r;orm=np.zeros((2048,2048,3),dtype=np.uint8);orm[:,:,0]=255;orm[:,:,1]=np.uint8(np.rint(np.clip(r,0,1)*255));o=io.BytesIO();Image.fromarray(orm).save(o,format='PNG');image(o.getvalue(),'image/png');
G={'asset':{'version':'2.0','generator':'STORMWAKE V75 source-specific FBX converter','copyright':'Poly Haven, CC0'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'name':'rock_face_01'}],'meshes':[{'primitives':[{'attributes':a,'indices':ix,'material':0}]}],'materials':[{'name':'Rock Face 01','doubleSided':True,'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicRoughnessTexture':{'index':2},'metallicFactor':0,'roughnessFactor':1},'normalTexture':{'index':1}}],'textures':[{'source':i} for i in range(3)],'images':images,'accessors':access,'bufferViews':views,'buffers':[{'byteLength':len(B)}]};j=json.dumps(G,separators=(',',':')).encode();j+=b' '*(-len(j)%4);B.extend(b'\0'*(-len(B)%4));out=struct.pack('<4sII',b'glTF',2,12+8+len(j)+8+len(B))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(B),b'BIN\0')+B
folder=Path('public/models/expedition/v75');folder.mkdir(parents=True,exist_ok=True);(folder/'rock.glb').write_bytes(out);print('output',len(out), 'bounds',p.min(0),p.max(0))
