import json, pathlib, struct, math
for name in ("murim", "cacador"):
    b = (pathlib.Path(__file__).parent / f"{name}.glb").read_bytes()
    magic, version, size = struct.unpack_from("<4sII", b)
    assert (magic, version, size) == (b"glTF", 2, len(b))
    n, typ = struct.unpack_from("<I4s", b, 12)
    assert typ == b"JSON"
    data = json.loads(b[20:20+n])
    bn, bt = struct.unpack_from("<I4s", b, 20+n)
    assert bt == b"BIN\0" and 28+n+bn == len(b)
    nodes = {node["name"] for node in data["nodes"]}
    assert {"slot_elmo","slot_armadura","slot_capa","slot_arma","slot_arma_esquerda"} <= nodes
    assert {"idle","attack","victory","rest","guard","dodge","channel"} == {anim["name"] for anim in data["animations"]}
    named={node["name"]:i for i,node in enumerate(data["nodes"])}
    for hand,slot in (("Hand.R","slot_arma"),("Hand.L","slot_arma_esquerda")):
        assert named[slot] in data["nodes"][named[hand]].get("children",[]),(name,slot)
    assert not data.get("skins")
    for view in data["bufferViews"]:
        assert view.get("byteOffset",0)+view["byteLength"] <= bn
    print(name, len(b), "bytes; slots/animações/estrutura OK (rig rígido)")
