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
    for slot in ("elmo","armadura","capa","arma"):
        assert names["slot_"+slot]==1,(path,slot,names)
    for clip in ("idle","attack","victory","rest"):
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
if __name__=="__main__":
    import sys
    sub=sys.argv[1] if len(sys.argv)>1 else "skinned"
    for name in ("murim","cacador"): check(HERE/sub/(name+".glb"))
