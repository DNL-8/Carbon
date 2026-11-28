"""Avatar V3 — original procedural anatomical blockout, phase 2: facial detail prototypes.
Run: blender -b --factory-startup --python-exit-code 1 --python anatomy.py -- output
Blender coordinates: X across, -Y forward, Z up; units in metres.
"""
import bpy
import bmesh
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--")+1:]
OUT = Path(ARGS[0]).resolve()
STYLES = (ARGS[1],) if len(ARGS)>1 else ("murim","cacador")
assert all(s in ("murim","cacador") for s in STYLES)
MODE = ARGS[2] if len(ARGS)>2 else "generate"
assert MODE in ("generate","render")
OUT.mkdir(parents=True, exist_ok=True)

def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

def ellipsoid(name, center, radii, rotation=None, segments=40, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj=bpy.context.object
    obj.name=name
    obj.scale=radii
    if rotation is not None:
        obj.rotation_mode='QUATERNION'
        obj.rotation_quaternion=rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj

def muscle(name, a, b, rx, ry, extension=1.0):
    a,b=Vector(a),Vector(b)
    delta=b-a
    return ellipsoid(name,(a+b)/2,(rx,ry,delta.length*extension/2),delta.to_track_quat('Z','Y'))

def add_body(style):
    hunter=style=='cacador'
    width=1.10 if hunter else .97
    mass=1.12 if hunter else .95
    parts=[]
    def e(name, p, r):
        parts.append(ellipsoid(name,p,r))
    def m(name,a,b,rx,ry,extension=1.15):
        parts.append(muscle(name,a,b,rx,ry,extension))
    # Overlapping primary and secondary forms, subsequently fused and smoothed.
    e('Pelvis',(0,0,.94),(.175*width,.118*mass,.145))
    e('Abdomen',(0,0,1.115),(.153*width,.105*mass,.224))
    e('Ribcage',(0,.015,1.32),(.225*width,.124*mass,.235))
    e('UpperChest',(0,.005,1.43),(.205*width,.11*mass,.112))
    e('Neck',(0,.008,1.555),(.073*mass,.073*mass,.119))
    e('Cranium',(0,.007,1.733),(.100*width,.106,.125))
    e('Jaw',(0,-.025,1.663),(.081*width if hunter else .075*width,.079,.086))
    e('Chin',(0,-.060,1.625),(.049 if hunter else .043,.054,.042))
    e('MuzzlePlane',(0,-.071,1.653),(.047,.040,.035))
    e('NasalBridge',(0,-.090,1.716),(.022,.034,.047))
    e('NasalTip',(0,-.116,1.686),(.023,.024,.022))
    for s in (-1,1):
        def q(x,y,z): return (s*x,y,z)
        e('Ear',q(.100*width,.004,1.716),(.020,.027,.045))
        e('BrowPlane',q(.046,-.083,1.753),(.048,.031,.020))
        e('CheekPlane',q(.056,-.064,1.691),(.037,.047,.038))
        # Chest, obliques and back, defined through broad continuous forms.
        e('Pectoral',q(.101*width,-.064,1.383),(.122*width,.085*mass,.092))
        m('Trapezius',q(.045,.04,1.53),q(.219*width,.025,1.428),.069*mass,.081)
        m('Latissimus',q(.181*width,.066,1.36),q(.101*width,.048,1.16),.080*mass,.069)
        m('Oblique',q(.134*width,-.023,1.23),q(.109*width,-.026,1.035),.055*mass,.058)
        for z in (1.12,1.195,1.265):
            e('AbdominalPlane',q(.047*width,-.081,z),(.054*width,.035*mass,.048))
        shoulder=q(.222*width,0,1.414)
        elbow=q(.365*width,0,1.167)
        wrist=q(.465*width,-.012,.955)
        e('Deltoid',shoulder,(.087*mass,.086*mass,.100))
        m('UpperArm',shoulder,elbow,.061*mass,.065*mass)
        m('Biceps',q(.252*width,-.039,1.37),q(.345*width,-.034,1.20),.047*mass,.053*mass,1.30)
        m('Triceps',q(.250*width,.039,1.37),q(.350*width,.024,1.20),.049*mass,.055*mass,1.30)
        e('Elbow',elbow,(.046*mass,.047*mass,.051))
        m('Forearm',elbow,wrist,.046*mass,.044*mass)
        m('ForearmFlexors',q(.379*width,-.013,1.15),q(.442*width,-.016,1.01),.046*mass,.039*mass,1.35)
        e('Wrist',wrist,(.032,.031,.044))
        e('Palm',q(.482*width,-.014,.913),(.044,.027,.063))
        # Four individually shaped, separated fingertips; thumbs face inward.
        for i,length in enumerate((.061,.075,.070,.055)):
            x=(.450+.021*i)*width
            a=q(x,-.017,.890)
            b=q(x+.013*width,-.023,.890-length)
            m('Finger',a,b,.010,.012,1.27)
            e('Fingertip',b,(.0095,.011,.012))
        m('Thumb',q(.456*width,-.020,.938),q(.427*width,-.042,.880),.015,.014,1.22)
        hip=q(.098*width,0,.914)
        knee=q(.107*width,-.014,.505)
        ankle=q(.105*width,.010,.116)
        e('Gluteal',q(.101*width,.066,.919),(.103*width,.101*mass,.145))
        m('Thigh',hip,knee,.094*mass,.091*mass)
        m('Quadriceps',q(.099*width,-.035,.857),q(.103*width,-.050,.588),.079*mass,.079*mass,1.25)
        e('Knee',knee,(.062,.068,.070))
        m('Shin',knee,ankle,.055,.054)
        m('Calf',q(.107*width,.042,.461),q(.105*width,.042,.245),.066*mass,.066*mass,1.32)
        e('Ankle',ankle,(.044,.046,.060))
        e('Foot',q(.105*width,-.047,.060),(.057,.112,.053))
        e('ToePlane',q(.105*width,-.112,.041),(.056,.054,.034))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts: obj.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join()
    body=bpy.context.object
    body.name=style+'_anatomy_sculpt'
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    body.data.remesh_voxel_size=.00165
    bpy.ops.object.voxel_remesh()
    # Sculpt shallow orbital recesses on the fused surface, without opening holes.
    for v in body.data.vertices:
        x,y,z=v.co
        if y<-.055 and 1.70<z<1.77:
            dx=(abs(x)-.046*width)/.022
            dz=(z-1.733)/.016
            v.co.y+=.012*math.exp(-dx*dx-dz*dz)
    smooth=body.modifiers.new('Fuse anatomical forms','SMOOTH')
    smooth.factor=.7
    smooth.iterations=8
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    for face in body.data.polygons: face.use_smooth=True
    material=bpy.data.materials.new('Neutral sculpt clay')
    material.diffuse_color=(.37,.29,.24,1)
    material.use_nodes=True
    bsdf=material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(.37,.29,.24,1)
    bsdf.inputs['Roughness'].default_value=.78
    body.data.materials.clear()
    body.data.materials.append(material)
    return body

def face_details(style, skin):
    """Closed facial parts, simple blendshapes; no facial rig or baked detail yet."""
    hunter=style=='cacador'
    width=1.10 if hunter else .97
    parts=[]
    def material(name,color,roughness):
        mat=bpy.data.materials.new(name)
        mat.diffuse_color=(*color,1)
        mat.use_nodes=True
        shader=mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value=(*color,1)
        shader.inputs['Roughness'].default_value=roughness
        return mat
    white=material('Eye ivory',(.78,.75,.67),.34)
    iris=material('Iris blue' if hunter else 'Iris amber',(.055,.22,.37) if hunter else (.32,.12,.035),.32)
    dark=material('Pupil and brows',(.026,.017,.014),.47)
    lips=material('Lip clay',(.26,.125,.105),.65)
    def attach(obj,mat):
        obj.data.materials.append(mat)
        for f in obj.data.polygons: f.use_smooth=True
        parts.append(obj)
        return obj
    def shape(obj,name,transform):
        if obj.data.shape_keys is None: obj.shape_key_add(name='Basis')
        key=obj.shape_key_add(name=name)
        for vertex in key.data: vertex.co=transform(vertex.co.copy())
    def part(name,center,radii,mat):
        return attach(ellipsoid(name,center,radii,segments=32,rings=20),mat)
    def ring(name,center,rx,rz,r,mat,tilt):
        # Closed almond-shaped eyelid rim with a rounded cross-section.
        verts=[]; faces=[]; n=64; sides=10
        for i in range(n):
            t=2*math.pi*i/n
            cx=rx*math.cos(t)
            cz=rz*math.sin(t)+tilt*math.cos(t)
            for j in range(sides):
                u=2*math.pi*j/sides
                verts.append((cx+r*math.cos(t)*math.cos(u),
                              r*math.sin(u),
                              cz+r*math.sin(t)*math.cos(u)))
        for i in range(n):
            for j in range(sides):
                a=i*sides+j; b=((i+1)%n)*sides+j
                c=((i+1)%n)*sides+(j+1)%sides; d=i*sides+(j+1)%sides
                faces.append((a,b,c,d))
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata(verts,[],faces)
        mesh.update()
        bm=bmesh.new();bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(mesh);bm.free()
        obj=bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(obj)
        obj.location=center
        return attach(obj,mat)
    for sign,side in [(-1,'L'),(1,'R')]:
        x=sign*.046*width
        z=1.733
        y=-.096
        eye=part('Eye_'+side,(x,y,z),(.024,.018,.013),white)
        color=part('Iris_'+side,(x,-.113,z),(.0085,.0035,.009),iris)
        pupil=part('Pupil_'+side,(x,-.116,z),(.0038,.002,.0048),dark)
        lid=ring('Eyelid_'+side,(x,-.110,z),.024,.013,.0022,skin,sign*.002)
        for obj in (eye,color,pupil,lid):
            shape(obj,'Blink',lambda v:(v.x,v.y,v.z*.09))
            shape(obj,'Focus',lambda v:(v.x,v.y,v.z*.63))
        brow=attach(ellipsoid('Brow_'+side,(x,-.113,1.756),(.024,.004,.0038),
                    Vector((0,1,0)).rotation_difference(Vector((0,1,0))),segments=32,rings=20),dark)
        shape(brow,'Focus',lambda v:(v.x,v.y,v.z+sign*v.x*.22-.003))
    mouth=part('LowerLip',(0,-.111,1.646),(.026,.006,.0046),lips)
    upper=part('UpperLip',(0,-.112,1.654),(.025,.005,.0038),lips)
    for obj in (mouth,upper):
        shape(obj,'Smile',lambda v:(v.x*1.08,v.y,v.z+.006*(abs(v.x)/.026)**2))
    return parts

def stats(obj):
    obj.data.calc_loop_triangles()
    bm=bmesh.new()
    bm.from_mesh(obj.data)
    bad=sum(not edge.is_manifold for edge in bm.edges)
    bm.free()
    return {'vertices':len(obj.data.vertices),'triangles':len(obj.data.loop_triangles),
            'non_manifold_edges':bad,'dimensions_m':[round(v,4) for v in obj.dimensions]}

def render(body, style, folder):
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=16
    scene.cycles.use_denoising=True
    scene.render.resolution_x=720
    scene.render.resolution_y=900
    scene.render.resolution_percentage=100
    if scene.world is None:
        scene.world=bpy.data.worlds.new('Studio World')
    scene.world.color=(.12,.12,.12)
    for name,pos,power,size in [('Key',(3,-4,4),500,3),('Fill',(-3,-2,2.4),260,3),('Rim',(1,3,3),450,2)]:
        bpy.ops.object.light_add(type='AREA',location=pos)
        light=bpy.context.object
        light.name=name
        light.data.energy=power
        light.data.shape='DISK'
        light.data.size=size
        light.rotation_euler=(Vector((0,0,1.1))-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add()
    camera=bpy.context.object
    scene.camera=camera
    camera.data.type='ORTHO'
    camera.data.ortho_scale=2.12
    for label,pos in [('front',(0,-5,.95)),('three-quarter',(3,-4,.95)),('back',(0,5,.95))]:
        camera.location=pos
        camera.rotation_euler=(Vector((0,0,.94))-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(folder/(style+'-'+label+'.png'))
        bpy.ops.render.render(write_still=True)
    camera.data.ortho_scale=.34
    camera.location=(0,-1.5,1.72)
    camera.rotation_euler=(Vector((0,0,1.72))-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(folder/(style+'-face.png'))
    bpy.ops.render.render(write_still=True)

reports=[]
for style in STYLES:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    folder=OUT/style
    folder.mkdir(exist_ok=True)
    if MODE=='render':
        bpy.ops.import_scene.gltf(filepath=str(folder/(style+'-desktop.glb')))
        body=next(obj for obj in bpy.context.scene.objects if obj.type=='MESH')
        render(body,style,folder)
        continue
    body=add_body(style)
    source=stats(body)
    assert source['triangles']>=300000, source
    assert source['non_manifold_edges']==0, source
    assert 1.75<source['dimensions_m'][2]<2.0, source
    bpy.ops.wm.save_as_mainfile(filepath=str(folder/(style+'-sculpt.blend')),compress=True)
    # An isolated desktop geometry candidate, not production-ready: no skin, UV or equipment.
    desktop=body.copy()
    desktop.data=body.data.copy()
    bpy.context.collection.objects.link(desktop)
    desktop.name=style+'_desktop_blockout'
    body.hide_render=True
    body.hide_set(True)
    activate(desktop)
    dec=desktop.modifiers.new('Desktop geometry budget','DECIMATE')
    dec.ratio=min(1.0,150000/source['triangles'])
    bpy.ops.object.modifier_apply(modifier=dec.name)
    for face in desktop.data.polygons: face.use_smooth=True
    reduced=stats(desktop)
    assert 100000<=reduced['triangles']<=200000, reduced
    assert reduced['non_manifold_edges']==0, reduced
    details=face_details(style,desktop.data.materials[0])
    detail_stats=[stats(obj) for obj in details]
    assert all(d['non_manifold_edges']==0 for d in detail_stats),detail_stats
    total_triangles=reduced['triangles']+sum(d['triangles'] for d in detail_stats)
    assert total_triangles<=200000,total_triangles
    activate(desktop)
    for obj in details: obj.select_set(True)
    path=folder/(style+'-desktop.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_materials='EXPORT',export_morph=True)
    assert path.stat().st_size<=20000000, path.stat().st_size
    result={'style':style,'source':source,'desktop':reduced,'glb_bytes':path.stat().st_size,
            'total_triangles':total_triangles,'facial_parts':len(details),'expressions':['Blink','Focus','Smile'],
            'stage':'procedural anatomy and facial prototype; no final artistic approval, facial rig or textures'}
    reports.append(result)
    (folder/'metrics.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print('AVATAR_V3_ANATOMY',json.dumps(result),flush=True)
if MODE=='generate':
    (OUT/'metrics.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
