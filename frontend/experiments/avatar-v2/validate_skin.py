"""Check glTF roundtrip contract, including real skin data, socket nodes and clips."""
import json
import pathlib
import struct
from collections import Counter
import numpy as np
HERE=pathlib.Path(__file__).parent

def load(path):
    raw=path.read_bytes()
    magic,version,size=struct.unpack_from("<4sII",raw)
    assert (magic,version,size)==(b"glTF",2,len(raw))
    n,k=struct.unpack_from("<I4s",raw,12);assert k==b"JSON"
    doc=json.loads(raw[20:20+n]);return doc,raw[28+n:]

def check(path):
    doc,buf=load(path)
    nodes=doc["nodes"]
    names=Counter(n.get("name") for n in nodes)
    for slot in ("elmo","armadura","capa","arma","arma_esquerda"):
        assert names["slot_"+slot]==1,(path,slot,names)
    for clip in ("idle","attack","victory","rest","guard","dodge","channel"):
        assert clip in {a["name"] for a in doc["animations"]},(path,clip,[a["name"] for a in doc["animations"]])
    assert len(doc.get("skins",[]))>=1
    skinned=[n for n in nodes if "skin" in n and "mesh" in n]
    assert len(skinned)>=5,(path,len(skinned))
    blended=0
    for node in skinned:
        for p in doc["meshes"][node["mesh"]]["primitives"]:
            attrs=p["attributes"]
            assert "JOINTS_0" in attrs and "WEIGHTS_0" in attrs
            a=doc["accessors"][attrs["WEIGHTS_0"]]
            assert a["componentType"]==5126 and a["type"]=="VEC4"
            v=doc["bufferViews"][a["bufferView"]]
            off=v.get("byteOffset",0)+a.get("byteOffset",0)
            w=np.ndarray((a["count"],4),dtype="<f4",buffer=buf,offset=off,strides=(v.get("byteStride",16),4))
            assert np.isfinite(w).all() and np.allclose(w.sum(axis=1),1,atol=1e-4)
            blended+=int(((w>.001).sum(axis=1)>1).sum())
    assert blended>0
    print(path, "skin meshes",len(skinned),"blended vertices",blended,"clips and sockets OK")
def world_transforms(doc):
    nodes=doc["nodes"]
    parents={child:i for i,node in enumerate(nodes) for child in node.get("children",[])}
    cache={}
    def world(i):
        if i in cache: return cache[i]
        node=nodes[i]
        if "matrix" in node:
            matrix=np.array(node["matrix"],dtype=float).reshape(4,4).T
        else:
            x,y,z,w=node.get("rotation",[0,0,0,1])
            rotation=np.array([
                [1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]
            ])
            matrix=np.eye(4)
            matrix[:3,:3]=rotation@np.diag(node.get("scale",[1,1,1]))
            matrix[:3,3]=node.get("translation",[0,0,0])
        cache[i]=world(parents[i])@matrix if i in parents else matrix
        return cache[i]
    return {node.get("name",""):world(i) for i,node in enumerate(nodes)}

def check_roundtrip(name):
    before,_=load(HERE/"skinned"/(name+".glb"))
    after,_=load(HERE/"blender-output"/(name+".glb"))
    a,b=world_transforms(before),world_transforms(after)
    for key in ("slot_elmo","slot_armadura","slot_capa","slot_arma","slot_arma_esquerda","Head","Hand.L","Hand.R"):
        assert key in a and key in b,(name,key)
        assert np.allclose(a[key],b[key],atol=1e-4,rtol=0),(name,key,"socket rest transform changed",a[key],b[key])
    for transforms in (a,b):
        left,right=(transforms[key][:3,3] for key in ("slot_arma_esquerda","slot_arma"))
        assert np.allclose(left,right*[-1,1,1],atol=1e-4,rtol=0),(name,"grip asymmetry",left,right)
    assert {m["name"] for m in before["materials"]}=={m["name"] for m in after["materials"]}
    print(name,"roundtrip: sockets, head, hands and named materials preserved")

if __name__=="__main__":
    import sys
    sub=sys.argv[1] if len(sys.argv)>1 else "skinned"
    for name in ("murim","cacador"):
        check(HERE/sub/(name+".glb"))
        if sub=="blender-output": check_roundtrip(name)
