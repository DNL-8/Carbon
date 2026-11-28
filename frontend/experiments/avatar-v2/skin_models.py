"""Create a first continuous, weighted under-suit from the validated rigid GLB.
Original equipment nodes, socket transforms, IDs and clip channels are preserved.
This is a rigging prototype, not a finished artistic model.
"""
import json
import math
import pathlib
import struct
import numpy as np

HERE = pathlib.Path(__file__).parent
OUT = HERE / "skinned"
OUT.mkdir(exist_ok=True)

def read_glb(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", raw)
    assert (magic, version, length) == (b"glTF", 2, len(raw))
    n, kind = struct.unpack_from("<I4s", raw, 12)
    assert kind == b"JSON"
    doc = json.loads(raw[20:20+n])
    bn, kind = struct.unpack_from("<I4s", raw, 20+n)
    assert kind == b"BIN\0"
    return doc, bytearray(raw[28+n:28+n+bn])

def write_glb(path, doc, buf):
    buf.extend(b"\0" * (-len(buf) % 4))
    doc["buffers"][0]["byteLength"] = len(buf)
    js = json.dumps(doc, separators=(",", ":"), allow_nan=False).encode()
    js += b" " * (-len(js) % 4)
    path.write_bytes(struct.pack("<4sII", b"glTF", 2, 28+len(js)+len(buf))
                     + struct.pack("<I4s", len(js), b"JSON") + js
                     + struct.pack("<I4s", len(buf), b"BIN\0") + buf)

def unit(v):
    return v / np.linalg.norm(v)

def upgrade(name):
    doc, buf = read_glb(HERE / (name+".glb"))
    nodes = doc["nodes"]
    names = {node["name"]: i for i, node in enumerate(nodes)}
    parents = {c:i for i,n in enumerate(nodes) for c in n.get("children",[])}
    def origin(i):
        n = nodes[i]
        assert "matrix" not in n and "rotation" not in n and "scale" not in n
        p = np.array(n.get("translation",[0,0,0]),dtype=float)
        return p + origin(parents[i]) if i in parents else p
    joints = [names[n] for n in ["Hips","Spine","Head",
              "UpperArm.L","Forearm.L","Hand.L","UpperArm.R","Forearm.R","Hand.R",
              "Thigh.L","Shin.L","Foot.L","Thigh.R","Shin.R","Foot.R"]]
    ji = {node: idx for idx,node in enumerate(joints)}
    def acc(array, kind, component, target=None, bounds=False):
        a = np.ascontiguousarray(array)
        buf.extend(b"\0" * (-len(buf)%4))
        offset = len(buf)
        buf.extend(a.tobytes())
        view = {"buffer":0,"byteOffset":offset,"byteLength":a.nbytes}
        if target: view["target"]=target
        doc["bufferViews"].append(view)
        desc = {"bufferView":len(doc["bufferViews"])-1,"componentType":component,
                "count":len(a),"type":kind}
        if bounds:
            desc["min"]=np.atleast_1d(a.min(axis=0)).tolist()
            desc["max"]=np.atleast_1d(a.max(axis=0)).tolist()
        doc["accessors"].append(desc)
        return len(doc["accessors"])-1
    inverse=[]
    for j in joints:
        mat=np.eye(4,dtype="<f4")
        mat[:3,3]=-origin(j)
        inverse.append(mat.T.flatten())
    doc["skins"]=[{"name":"CarbonDeformRig","joints":joints,"skeleton":names["Hips"],
                   "inverseBindMatrices":acc(np.array(inverse,dtype="<f4"),"MAT4",5126)}]
    root=names["CharacterRoot"]
    materials={m["name"]:i for i,m in enumerate(doc["materials"])}
    def surface(label, rings, j1, j2, material, segments=24):
        # Each ring: center, tangent, radius along first/second local axes, second-joint weight.
        pos=[];norm=[];weights=[];ids=[];faces=[]
        for center,tangent,r1,r2,w in rings:
            t=unit(tangent)
            u=unit(np.cross(t,[0,0,1]))
            v=unit(np.cross(t,u))
            for k in range(segments):
                angle=2*math.pi*k/segments
                co,si=math.cos(angle),math.sin(angle)
                pos.append(center+u*r1*co+v*r2*si)
                norm.append(unit(u*co/r1+v*si/r2))
                weights.append([1-w,w,0,0]);ids.append([ji[j1],ji[j2],0,0])
        for ring in range(len(rings)-1):
            for k in range(segments):
                a=ring*segments+k;b=ring*segments+(k+1)%segments
                c=b+segments;d=a+segments
                faces.extend([a,b,d,b,c,d])
        positions=np.array(pos,dtype="<f4")
        weights=np.array(weights,dtype="<f4")
        assert np.isfinite(positions).all() and np.isfinite(weights).all()
        assert np.all((weights>=0)&(weights<=1))
        assert np.allclose(weights.sum(axis=1),1) and np.any((weights[:,1]>0)&(weights[:,1]<1))
        primitive={"attributes":{
            "POSITION":acc(positions,"VEC3",5126,34962,True),
            "NORMAL":acc(np.array(norm,dtype="<f4"),"VEC3",5126,34962),
            "JOINTS_0":acc(np.array(ids,dtype="<u2"),"VEC4",5123,34962),
            "WEIGHTS_0":acc(weights,"VEC4",5126,34962)},
            "indices":acc(np.array(faces,dtype="<u2"),"SCALAR",5123,34963),
            "material":materials[material]}
        doc["meshes"].append({"name":label,"primitives":[primitive]})
        nodes.append({"name":label,"mesh":len(doc["meshes"])-1,"skin":0})
        nodes[root].setdefault("children",[]).append(len(nodes)-1)
    def limb(label, a, b, c, radius, material, upper_fullness, lower_fullness, depth_ratio):
        A,B,C=(origin(j) for j in [a,b,c]);t1=unit(B-A);t2=unit(C-B);rings=[]
        for t,r,w in [(-.10,radius[0]*.93,0),(0,radius[0],0),(.45,radius[0]*.89,0),(.76,radius[1]*1.10,.035),(.84,radius[1]*1.06,.14),(.92,radius[1]*1.03,.30),(1,radius[1],.5),(1.08,radius[1]*.99,.70),(1.16,radius[1]*.98,.86),(1.24,radius[1]*.96,.965),(1.32,radius[1]*.94,1),(1.65,radius[2]*1.16,1),(2,radius[2],1)]:
            center=A+(B-A)*t if t<=1 else B+(C-B)*(t-1)
            tangent=t1 if t<.9 else t2 if t>1.1 else unit(t1+t2)
            # Add muscle volume between joints, not at the attachment points.
            # Keep the original shoulder/elbow/knee/wrist/ankle envelopes and weights.
            upper=math.sin(math.pi*t)**2 if 0<t<1 else 0
            lower=math.sin(math.pi*(t-1))**2 if 1<t<2 else 0
            fullness=1+upper_fullness*upper+lower_fullness*lower
            depth=.88+(depth_ratio-.88)*max(upper,lower)
            rings.append((center,tangent,r*fullness,r*depth*fullness,w))
        surface(label,rings,a,b,material)
    martial=name=="murim"
    for side in ["L","R"]:
        limb("DeformSleeve."+side,names["UpperArm."+side],names["Forearm."+side],names["Hand."+side],(.073,.056,.041),"BaseCloth",.09 if martial else .14,.06 if martial else .09,.92)
        limb("DeformLeg."+side,names["Thigh."+side],names["Shin."+side],names["Foot."+side],(.103,.067,.049),"DarkCloth",.07 if martial else .10,.12,.94)
        for piece in ["Sleeve","Forearm","Pants"]:
            nodes[names["Mesh_"+piece+"."+side]].pop("mesh",None)
    hips,spine=names["Hips"],names["Spine"]
    S=origin(spine);wide=.93 if name=="murim" else 1.08
    rings=[(S+np.array([0,y,0]),np.array([0,1,0]),rx*wide,rz,w)
           for y,rx,rz,w in [(-.17,.159,.109,0),(-.12,.16,.112,0),(-.06,.15,.105,.18),(0,.15,.105,.5),(.08,.17,.11,.9),(.17,.19,.115,1),(.32,.235,.12,1),(.39,.19,.105,1),(.43,.075,.075,1)]]
    surface("DeformTorso",rings,hips,spine,"BaseCloth")
    nodes[names["Mesh_BaseTorso"]].pop("mesh",None)
    # Add bending channels so the new weights are exercised by actual clips.
    for anim in doc["animations"]:
        if anim["name"] not in ("attack","rest","victory","guard","dodge","channel"): continue
        attack=anim["name"]=="attack"
        times={"attack":[0,.25,.60,1],"guard":[0,.35,1.25,1.8],"dodge":[0,.20,.52,.95],"channel":[0,.5,1.25,2,2.5]}.get(anim["name"],[0,.5,1.3,2])
        angles=[0,-.50,-.85,0] if attack else [0,-.48,-.55,-.48,0] if anim["name"]=="channel" else [0,-.36,-.36,0]
        def curve(a,b): return [0,a,b,a,0] if len(times)==5 else [0,a,b,0]
        for joint,axis,values in [
            ("Forearm.R",[1,0,0],angles),
            ("Forearm.L",[1,0,0],curve(-.18,-.30) if attack else curve(-.20,-.24)),
            ("Shin.L",[1,0,0],curve(.10,.16) if attack else curve(.06,.09)),
            ("Shin.R",[1,0,0],curve(.12,.18) if attack else curve(.06,.09)),
        ]:
            target=names[joint]
            assert not any(c["target"]["node"]==target and c["target"]["path"]=="rotation" for c in anim["channels"])
            quats=np.array([[*(np.array(axis)*math.sin(a/2)),math.cos(a/2)] for a in values],dtype="<f4")
            ti=acc(np.array(times,dtype="<f4"),"SCALAR",5126,bounds=True)
            qi=acc(quats,"VEC4",5126)
            anim["samplers"].append({"input":ti,"output":qi,"interpolation":"LINEAR"})
            anim["channels"].append({"sampler":len(anim["samplers"])-1,"target":{"node":target,"path":"rotation"}})
    doc["asset"]["generator"]="Carbon Avatar V2 weighted rig prototype"
    write_glb(OUT/(name+".glb"),doc,buf)
    print(name, "15 joints; 5 continuous skinned meshes; original sockets preserved")

if __name__=="__main__":
    for character in ("murim","cacador"): upgrade(character)
