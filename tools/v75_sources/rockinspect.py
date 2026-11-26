import struct,zlib,zipfile,numpy as np
import sys
z=zipfile.ZipFile(sys.argv[1]); b=z.read(z.namelist()[0]); version=struct.unpack_from('<I',b,23)[0]; wide=version>=7500; fmt='<QQQB' if wide else '<IIIB'; sz=struct.calcsize(fmt)
def parse(off):
 end,num,plen,nlen=struct.unpack_from(fmt,b,off)
 if end==0:return None,off+sz
 p=off+sz;name=b[p:p+nlen].decode();p+=nlen;props=[]
 for _ in range(num):
  t=chr(b[p]);p+=1
  if t in 'YCFDIL':
   f={'Y':'h','C':'?','F':'f','D':'d','I':'i','L':'q'}[t];v=struct.unpack_from('<'+f,b,p)[0];p+=struct.calcsize(f)
  elif t in 'SR':
   n=struct.unpack_from('<I',b,p)[0];p+=4;v=b[p:p+n];p+=n
   if t=='S':v=v.decode(errors='replace')
  elif t in 'fdilbc':
   n,enc,l=struct.unpack_from('<III',b,p);p+=12;v=b[p:p+l];p+=l;v=zlib.decompress(v) if enc else v;v=np.frombuffer(v,{'f':'<f4','d':'<f8','i':'<i4','l':'<i8','b':'u1','c':'u1'}[t]);assert len(v)==n
  else:raise ValueError(t)
  props.append(v)
 ch=[]
 while p<end-sz:
  item,p=parse(p)
  if item is None:break
  ch.append(item)
 return (name,props,ch),end
nodes=[];off=27
while off<len(b):
 n,off=parse(off)
 if n is None:break
 nodes.append(n)
def pick(n,k):return next(x for x in n[2] if x[0]==k)
def show(n,depth=0):
 name,p,ch=n;print(' '*depth,name,[('array',v.shape,v[:6]) if isinstance(v,np.ndarray) else v if not isinstance(v,bytes) else 'raw' for v in p]);
 if depth<5:
  for c in ch:show(c,depth+1)
if __name__=='__main__':
 for n in nodes:
  if n[0] in ['GlobalSettings','Objects','Connections']:show(n)
