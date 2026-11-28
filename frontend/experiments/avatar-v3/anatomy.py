"""Avatar V3 — original procedural anatomical blockout, phase 1 only.
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

OUT = Path(sys.argv[sys.argv.index("--")+1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)

def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

def ellipsoid(name, center, radii, rotation=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24, location=center)
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
    e('Jaw',(0,-.025,1.663),(.078*width,.079,.086))
    e('Chin',(0,-.060,1.625),(.045,.054,.042))
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

reports=[]
for style in ('murim','cacador'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    folder=OUT/style
    folder.mkdir(exist_ok=True)
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
    path=folder/(style+'-desktop.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_materials='EXPORT')
    assert path.stat().st_size<=20000000, path.stat().st_size
    render(desktop,style,folder)
    result={'style':style,'source':source,'desktop':reduced,'glb_bytes':path.stat().st_size,
            'stage':'procedural anatomical blockout; not artistic sculpt approval, no rig or textures'}
    reports.append(result)
    (folder/'metrics.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print('AVATAR_V3_ANATOMY',json.dumps(result),flush=True)
(OUT/'metrics.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
