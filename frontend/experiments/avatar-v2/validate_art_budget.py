"""Budget and material checks for revised procedural models; not an artistic certification."""
import json
import pathlib
import struct
import sys
import numpy as np

root=pathlib.Path(__file__).parent
folder=root/(sys.argv[1] if len(sys.argv)>1 else 'blender-output')
for name in ('murim','cacador'):
    raw=(folder/(name+'.glb')).read_bytes()
    assert len(raw)<=1_500_000,(name,'asset exceeds 1.5 MB',len(raw))
    magic,version,length=struct.unpack_from('<4sII',raw)
    assert (magic,version,length)==(b'glTF',2,len(raw))
    n,kind=struct.unpack_from('<I4s',raw,12)
    assert kind==b'JSON'
    doc=json.loads(raw[20:20+n])
    vertices=triangles=0
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            count=doc['accessors'][p['attributes']['POSITION']]['count']
            vertices+=count
            triangles+=doc['accessors'][p['indices']]['count']//3 if 'indices' in p else count//3
    assert triangles<=18000,(name,'triangle budget',triangles)
    materials={m['name'] for m in doc['materials']}
    assert {'Skin','Hair','BaseCloth','DarkCloth','Trim','Metal','Lining','Energy','Eyes','Iris'}<=materials
    nodes={node.get('name','') for node in doc['nodes']}
    for prefix in ('Mesh_HeadMesh','Mesh_HairCap','Mesh_HairLock','Mesh_BaseWaist','Mesh_LowerLid','Mesh_MouthLower','Mesh_Hand_Finger','Mesh_Foot_Toe','Mesh_GreaveRidge','Mesh_Boot_AnkleRim'):
        assert any(node.startswith(prefix) for node in nodes),(name,prefix)
    textured={'Skin','BaseCloth','DarkCloth','Lining','Metal','Trim'}
    for material in doc['materials']:
        if material['name'] not in textured: continue
        index=material['pbrMetallicRoughness']['metallicRoughnessTexture']['index']
        img=doc['images'][doc['textures'][index]['source']]
        assert 'bufferView' in img and img['mimeType']=='image/png',(name,material['name'],'expected embedded PNG')
        if material['name']!='Skin':
            for texture in (material['normalTexture'],material['pbrMetallicRoughness']['baseColorTexture']):
                embedded=doc['images'][doc['textures'][texture['index']]['source']]
                assert 'bufferView' in embedded and embedded['mimeType']=='image/png',(name,material['name'],'missing detail map')
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            if doc['materials'][p['material']]['name'] in textured:
                uv=doc['accessors'][p['attributes']['TEXCOORD_0']]
                assert uv['type']=='VEC2' and uv['count']==doc['accessors'][p['attributes']['POSITION']]['count'],(name,mesh['name'],'UV count')
    print(name,'bytes',len(raw),'vertices',vertices,'triangles',triangles,'materials, UVs and embedded maps OK')
