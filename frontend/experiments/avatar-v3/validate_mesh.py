"""Validate uncompressed GLB before costly rendering. Geometry-only, no rig/UV certification."""
import argparse
import json
from pathlib import Path
import numpy as np
import trimesh

p=argparse.ArgumentParser()
p.add_argument("input",type=Path)
p.add_argument("--min-triangles",type=int,default=100000)
p.add_argument("--max-triangles",type=int,default=200000)
p.add_argument("--report",type=Path,required=True)
args=p.parse_args()
errors=[]
scene=trimesh.load(args.input,force="scene",process=False)
# Evaluate geometry in world coordinates; join only for topology checks.
mesh=scene.to_geometry()
v=np.asarray(mesh.vertices)
f=np.asarray(mesh.faces)
n=len(f)
if not len(v) or not np.isfinite(v).all(): errors.append("empty or non-finite vertices")
if not n or f.min()<0 or f.max()>=len(v): errors.append("invalid face indices")
if not args.min_triangles<=n<=args.max_triangles: errors.append("triangle budget")
if args.input.stat().st_size>20_000_000: errors.append("file budget")
if not errors:
    if not np.isfinite(mesh.face_normals).all(): errors.append("non-finite normals")
    if (mesh.area_faces<=1e-12).any(): errors.append("degenerate faces")
    # GLB can duplicate vertices at normal boundaries. Weld coincident positions for topology.
    mesh.merge_vertices(merge_tex=True,merge_norm=True,digits_vertex=7)
    if not mesh.is_watertight: errors.append("non-watertight geometry")
    if not mesh.is_winding_consistent: errors.append("inconsistent winding")
    if mesh.volume<=0: errors.append("inverted or zero signed volume")
    if not 1.75<max(mesh.extents)<2.0: errors.append("height envelope")
report={"file":args.input.name,"vertices":len(v),"triangles":n,"bytes":args.input.stat().st_size,
        "size_mb":round(args.input.stat().st_size/1e6,4),"errors":errors,"passed":not errors}
args.report.write_text(json.dumps(report,indent=2),encoding="utf-8")
print(json.dumps(report),flush=True)
if errors: raise SystemExit(1)
