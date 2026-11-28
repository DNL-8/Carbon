"""Run inside Blender: import weighted GLB, check actual deformation and save .blend + GLB.
The originals remain untouched. This is a technical rig, not an artistic approval.
"""
import bpy
import math
import pathlib
import sys
from mathutils import Quaternion

folder=pathlib.Path(sys.argv[sys.argv.index("--")+1]).resolve()
out=folder/"blender-output"
out.mkdir(exist_ok=True)

for name in ("murim","cacador"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(folder/"skinned"/(name+".glb")))
    scene=bpy.context.scene
    armatures=[obj for obj in scene.objects if obj.type=="ARMATURE"]
    assert len(armatures)==1, (name, "armature count",len(armatures))
    arm=armatures[0]
    for bone in ["Hips","Spine","Head","UpperArm.L","Forearm.L","Hand.L","UpperArm.R","Forearm.R","Hand.R","Thigh.L","Shin.L","Foot.L","Thigh.R","Shin.R","Foot.R"]:
        assert bone in arm.pose.bones, (name,bone)
    meshes=[obj for obj in scene.objects if obj.type=="MESH" and any(m.type=="ARMATURE" for m in obj.modifiers)]
    assert len(meshes)>=5, (name,"skinned meshes",len(meshes))
    sleeve=next(obj for obj in meshes if obj.name.startswith("DeformSleeve.R"))
    # Save animation state while testing a controlled elbow pose.
    ad=arm.animation_data
    old_action=ad.action if ad else None
    old_tracks=[(track,track.mute) for track in ad.nla_tracks] if ad else []
    if ad:
        ad.action=None
        for track,_ in old_tracks: track.mute=True
    bone=arm.pose.bones["Forearm.R"]
    old_basis=bone.matrix_basis.copy()
    bone.rotation_mode="QUATERNION"
    bone.rotation_quaternion=Quaternion((1,0,0),0)
    bpy.context.view_layer.update()
    def vertices():
        evaluated=sleeve.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh=evaluated.to_mesh()
        points=[v.co.copy() for v in mesh.vertices]
        evaluated.to_mesh_clear()
        return points
    before=vertices()
    bone.rotation_quaternion=Quaternion((1,0,0),math.radians(50))
    bpy.context.view_layer.update()
    after=vertices()
    moved=sum((x-y).length>0.001 for x,y in zip(before,after))
    blended_ids=[vertex.index for vertex in sleeve.data.vertices if sum(group.weight>0.001 for group in vertex.groups)>=2]
    blended=len(blended_ids)
    moved_blended=sum((before[i]-after[i]).length>0.001 for i in blended_ids)
    assert moved>0 and moved<len(before) and moved_blended>0, (name,"deformation",moved,blended,moved_blended)
    bone.matrix_basis=old_basis
    if ad:
        ad.action=old_action
        for track,mute in old_tracks: track.mute=mute
    bpy.context.view_layer.update()
    scene.render.fps=30
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(name+".blend")))
    opts={"filepath":str(out/(name+".glb")),"export_format":"GLB","export_animations":True,"export_skins":True}
    properties=bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    if "export_animation_mode" in properties: opts["export_animation_mode"]="NLA_TRACKS"
    if "export_force_sampling" in properties: opts["export_force_sampling"]=True
    if "export_nla_strips" in properties: opts["export_nla_strips"]=True
    bpy.ops.export_scene.gltf(**opts)
    print("BLENDER_RIG_OK",name,"bones",len(arm.data.bones),"skinned meshes",len(meshes),"blended vertices",blended,"moved vertices",moved,"moved blended vertices",moved_blended)
