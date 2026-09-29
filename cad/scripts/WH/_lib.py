"""
Shared CadQuery builders for WH assemblies. Generic geometry from representative
proportions; not OEM or API dimensions. Units: inches in scripts, meters in GLB.

Conventions: origin at the flow-path center; flow along +X; stem or vertical along +Z.
Every exported node is named with a record ID so the integrity check can bind it.
"""
import math
import os

import cadquery as cq

IN2M = 0.0254

# Colors by node role (last token of the node name), used for the first viewer test.
ROLE_COLORS = {
    "BODY": (0.30, 0.32, 0.36), "FLANGE": (0.30, 0.32, 0.36), "SEAT": (0.75, 0.70, 0.45),
    "GATE": (0.62, 0.64, 0.68), "BONNET": (0.30, 0.32, 0.36), "PACKING": (0.15, 0.15, 0.15),
    "BEARING": (0.55, 0.50, 0.30), "STEM": (0.70, 0.72, 0.76), "HANDWHEEL": (0.65, 0.12, 0.10),
    "ACTUATOR": (0.20, 0.35, 0.60), "IN": (0.30, 0.32, 0.36), "OUT": (0.30, 0.32, 0.36),
    "UP": (0.75, 0.70, 0.45), "DOWN": (0.75, 0.70, 0.45),
    "LMV": (0.28, 0.30, 0.34), "UMV": (0.28, 0.30, 0.34), "SWAB": (0.28, 0.30, 0.34),
    "WINGA": (0.28, 0.30, 0.34), "WINGB": (0.28, 0.30, 0.34), "CROSS": (0.24, 0.26, 0.30),
    "TREEADAPTER": (0.40, 0.42, 0.46), "GOATHEAD": (0.24, 0.26, 0.30), "TREECAP": (0.40, 0.42, 0.46),
    "CASINGHEAD": (0.26, 0.28, 0.32), "CASINGSPOOL": (0.30, 0.32, 0.36), "TUBINGHEAD": (0.34, 0.36, 0.40),
    "CASINGHANGER": (0.55, 0.50, 0.30), "PACKOFF": (0.15, 0.15, 0.15), "TUBINGHANGER": (0.60, 0.55, 0.32),
    "LOCKDOWNSCREW": (0.70, 0.72, 0.76), "SIDEOUTLETVALVE": (0.28, 0.30, 0.34), "BPV": (0.75, 0.70, 0.45),
    "SKID": (0.85, 0.65, 0.10), "INLETHEADER": (0.24, 0.26, 0.30), "VALVE": (0.28, 0.30, 0.34),
    "OUTLET": (0.64, 0.15, 0.11), "TRANSDUCER": (0.20, 0.35, 0.60), "BLEEDVALVE": (0.28, 0.30, 0.34),
    "HPU": (0.20, 0.35, 0.60), "ACCUMULATOR": (0.70, 0.72, 0.76),
    "PUPJOINT": (0.64, 0.15, 0.11), "SWIVEL": (0.64, 0.15, 0.11), "TEE": (0.30, 0.32, 0.36),
    "CHECKVALVE": (0.30, 0.32, 0.36), "PRV": (0.30, 0.32, 0.36), "PLUGVALVE": (0.30, 0.32, 0.36),
    "HAMMERUNION": (0.24, 0.26, 0.30), "RESTRAINT": (0.85, 0.65, 0.10),
    "MANDREL": (0.70, 0.72, 0.76), "SEAL": (0.15, 0.15, 0.15), "SHOULDER": (0.55, 0.50, 0.30),
}


# --------------------------------------------------------------------------- gate valve
def valve_params(bore=5.125, rating_ksi=15.0, actuated=False):
    p = {}
    p["bore"] = bore
    p["rating_ksi"] = rating_ksi
    k = 1.0 + (rating_ksi - 10.0) * 0.06
    p["face_to_face"] = 31.5 * (bore / 5.125) ** 0.5 * k
    p["flange_od"] = 2.55 * bore * k
    p["flange_thk"] = 0.62 * bore ** 0.5 * k
    p["raised_face_od"] = 1.85 * bore
    p["raised_face_h"] = 0.25
    p["bolt_circle"] = 2.15 * bore * k
    p["bolt_n"] = 12 if bore < 6 else 16
    p["bolt_d"] = 1.375 if bore < 6 else 1.625
    p["body_w"] = 2.3 * bore * k
    p["body_h"] = 2 * ((bore + 0.5) + bore / 2 + 1.0 + 1.0)
    p["body_len"] = p["face_to_face"] - 2 * p["flange_thk"]
    p["seat_od"] = 1.45 * bore
    p["seat_len"] = 0.9 * bore ** 0.5
    p["gate_thk"] = 0.55 * bore ** 0.5
    p["gate_w"] = 1.55 * bore
    p["gate_travel"] = bore + 0.5
    p["gate_bottom"] = -(p["gate_travel"] + bore / 2 + 0.5)
    p["gate_top"] = bore / 2 + 1.0
    p["gate_h"] = p["gate_top"] - p["gate_bottom"]
    p["bonnet_od"] = 1.9 * bore * k
    p["bonnet_thk"] = 0.55 * bore ** 0.5 * k
    p["bonnet_neck_od"] = 1.05 * bore
    p["bonnet_neck_h"] = 0.35 * bore
    p["stem_d"] = 0.28 * bore
    p["packing_od"] = 0.75 * bore
    p["packing_h"] = 0.55 * bore
    p["bearing_od"] = 0.95 * bore
    p["bearing_h"] = 0.45 * bore
    p["stem_len"] = (p["body_h"] / 2 + p["bonnet_neck_h"] + p["bonnet_thk"] + p["packing_h"]
                     + p["bearing_h"] + 0.6 * bore + 1.2) - p["gate_top"]
    p["handwheel_d"] = 2.4 * bore
    p["handwheel_rim"] = 0.28 * bore
    p["actuated"] = actuated
    p["act_cyl_d"] = 1.4 * bore
    p["act_cyl_h"] = 1.6 * bore + p["gate_travel"]
    return p


def _bolt_pts(r, n):
    return [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def v_body(p):
    L, W, H = p["body_len"], p["body_w"], p["body_h"]
    b = cq.Workplane("XY").box(L, W, H).edges("|X").fillet(0.18 * W)
    b = b.cut(cq.Workplane("YZ").circle(p["bore"] / 2).extrude(L + 2, both=True))
    cav_bot = p["gate_bottom"] - 0.5
    cav_top = p["gate_top"] + p["gate_travel"] + 0.5
    cav = cq.Workplane("XY").box(p["gate_thk"] * 1.25, p["gate_w"] * 1.1, cav_top - cav_bot)
    b = b.cut(cav.translate((0, 0, (cav_top + cav_bot) / 2)))
    for sgn in (-1, 1):
        pocket = (cq.Workplane("YZ").circle(p["seat_od"] / 2).extrude(p["seat_len"])
                  .translate((sgn * p["gate_thk"] * 0.625 + (0 if sgn > 0 else -p["seat_len"]), 0, 0)))
        b = b.cut(pocket)
    neck = cq.Workplane("XY").circle(p["bonnet_neck_od"] / 2).extrude(p["bonnet_neck_h"]).translate((0, 0, H / 2))
    return b.union(neck)


def v_flange(p, side):
    t, od = p["flange_thk"], p["flange_od"]
    x0 = side * p["body_len"] / 2
    f = cq.Workplane("YZ").circle(od / 2).extrude(t)
    rf = cq.Workplane("YZ").circle(p["raised_face_od"] / 2).extrude(p["raised_face_h"])
    if side > 0:
        f = f.translate((x0, 0, 0)).union(rf.translate((x0 + t, 0, 0)))
    else:
        f = f.translate((x0 - t, 0, 0)).union(rf.translate((x0 - t - p["raised_face_h"], 0, 0)))
    f = f.cut(cq.Workplane("YZ").circle(p["bore"] / 2).extrude(4 * t, both=True).translate((x0, 0, 0)))
    holes = cq.Workplane("YZ").pushPoints(_bolt_pts(p["bolt_circle"] / 2, p["bolt_n"])).circle(p["bolt_d"] / 2).extrude(4 * t, both=True).translate((x0, 0, 0))
    return f.cut(holes)


def v_seat(p, side):
    s = cq.Workplane("YZ").circle(p["seat_od"] / 2 - 0.02).circle(p["bore"] / 2).extrude(p["seat_len"] - 0.05)
    x = side * p["gate_thk"] * 0.625 + (0.025 if side > 0 else -(p["seat_len"] - 0.025))
    return s.translate((x, 0, 0))


def v_gate(p, open_fraction):
    zc = (p["gate_top"] + p["gate_bottom"]) / 2
    g = cq.Workplane("XY").box(p["gate_thk"], p["gate_w"], p["gate_h"]).edges("|X").fillet(0.15 * p["gate_thk"]).translate((0, 0, zc))
    port = cq.Workplane("YZ").circle(p["bore"] / 2).extrude(p["gate_thk"] + 1, both=True).translate((0, 0, -p["gate_travel"]))
    return g.cut(port).translate((0, 0, p["gate_travel"] * open_fraction))


def v_bonnet(p):
    z0 = p["body_h"] / 2 + p["bonnet_neck_h"]
    b = cq.Workplane("XY").circle(p["bonnet_od"] / 2).extrude(p["bonnet_thk"]).translate((0, 0, z0))
    b = b.cut(cq.Workplane("XY").circle(p["stem_d"] / 2 + 0.03).extrude(p["bonnet_thk"] + 1).translate((0, 0, z0 - 0.5)))
    studs = cq.Workplane("XY").pushPoints(_bolt_pts(p["bonnet_od"] / 2 - 0.9, 8)).circle(0.5).extrude(p["bonnet_thk"] + 1.2).translate((0, 0, z0 - 0.6))
    return b.union(studs)


def v_packing(p):
    z0 = p["body_h"] / 2 + p["bonnet_neck_h"] + p["bonnet_thk"]
    return cq.Workplane("XY").circle(p["packing_od"] / 2).circle(p["stem_d"] / 2 + 0.02).extrude(p["packing_h"]).translate((0, 0, z0))


def v_bearing(p):
    z0 = p["body_h"] / 2 + p["bonnet_neck_h"] + p["bonnet_thk"] + p["packing_h"]
    return cq.Workplane("XY").circle(p["bearing_od"] / 2).circle(p["stem_d"] / 2 + 0.02).extrude(p["bearing_h"]).translate((0, 0, z0))


def v_stem(p, open_fraction):
    s = cq.Workplane("XY").circle(p["stem_d"] / 2).extrude(p["stem_len"]).translate((0, 0, p["gate_top"]))
    return s.translate((0, 0, p["gate_travel"] * open_fraction))


def v_handwheel(p):
    z0 = p["body_h"] / 2 + p["bonnet_neck_h"] + p["bonnet_thk"] + p["packing_h"] + p["bearing_h"] + 0.6 * p["bore"]
    rim = cq.Workplane("XY").circle(p["handwheel_d"] / 2).circle(p["handwheel_d"] / 2 - p["handwheel_rim"]).extrude(0.5)
    hub = cq.Workplane("XY").circle(0.55 * p["stem_d"] + 0.4).extrude(1.0)
    w = rim.union(hub)
    for i in range(6):
        spoke = cq.Workplane("XY").box(p["handwheel_d"] / 2 - p["handwheel_rim"] / 2, 0.35, 0.4).translate((p["handwheel_d"] / 4, 0, 0.25))
        w = w.union(spoke.rotate((0, 0, 0), (0, 0, 1), i * 60))
    return w.translate((0, 0, z0))


def v_actuator(p):
    z0 = p["body_h"] / 2 + p["bonnet_neck_h"] + p["bonnet_thk"] + p["packing_h"] + p["bearing_h"]
    cyl = cq.Workplane("XY").circle(p["act_cyl_d"] / 2).extrude(p["act_cyl_h"]).translate((0, 0, z0))
    cap = cq.Workplane("XY").circle(p["act_cyl_d"] / 2 + 0.4).extrude(0.6).translate((0, 0, z0 + p["act_cyl_h"]))
    port = cq.Workplane("XZ").circle(0.3).extrude(p["act_cyl_d"] / 2 + 1).translate((0, 0, z0 + p["act_cyl_h"] - 1.0))
    return cyl.union(cap).union(port)


def gate_valve_parts(p, open_fraction=0.0, prefix="WH-GATEVALVE"):
    """Named parts of one gate valve in the local frame (bore +X, stem +Z)."""
    parts = {
        prefix + "-BODY": v_body(p),
        prefix + "-FLANGE-IN": v_flange(p, -1),
        prefix + "-FLANGE-OUT": v_flange(p, +1),
        prefix + "-SEAT-UP": v_seat(p, -1),
        prefix + "-SEAT-DOWN": v_seat(p, +1),
        prefix + "-GATE": v_gate(p, open_fraction),
        prefix + "-BONNET": v_bonnet(p),
        prefix + "-PACKING": v_packing(p),
        prefix + "-BEARING": v_bearing(p),
        prefix + "-STEM": v_stem(p, open_fraction),
    }
    if p["actuated"]:
        parts[prefix + "-ACTUATOR"] = v_actuator(p)
    else:
        parts[prefix + "-HANDWHEEL"] = v_handwheel(p)
    return parts


def gate_valve_solid(p, open_fraction=0.0):
    """One fused solid of a whole valve, for use as a sub-assembly inside a bigger assembly."""
    parts = gate_valve_parts(p, open_fraction)
    solid = None
    for s in parts.values():
        solid = s if solid is None else solid.union(s)
    return solid


# --------------------------------------------------------------------------- generic pieces
def flanged_spool(bore, od, height, flange_od, flange_thk, bolt_n=12, bolt_d=1.375, bolt_circle=None):
    """Vertical spool along Z with flanges top and bottom, bore through."""
    bc = bolt_circle or (flange_od - 2.2 * bolt_d)
    body = cq.Workplane("XY").circle(od / 2).extrude(height - 2 * flange_thk).translate((0, 0, flange_thk))
    fl = cq.Workplane("XY").circle(flange_od / 2).extrude(flange_thk)
    ft = fl.translate((0, 0, height - flange_thk))
    s = body.union(fl).union(ft)
    s = s.cut(cq.Workplane("XY").circle(bore / 2).extrude(height + 2).translate((0, 0, -1)))
    holes = cq.Workplane("XY").pushPoints(_bolt_pts(bc / 2, bolt_n)).circle(bolt_d / 2).extrude(height + 2).translate((0, 0, -1))
    return s.cut(holes)


def side_outlet(od_nozzle, length, flange_od, flange_thk, direction=1, z=0.0, from_r=0.0):
    """Horizontal nozzle with a flange along +X (direction=1) or -X (direction=-1)."""
    n = cq.Workplane("YZ").circle(od_nozzle / 2).extrude(length)
    f = cq.Workplane("YZ").circle(flange_od / 2).extrude(flange_thk).translate((length, 0, 0))
    s = n.union(f)
    if direction < 0:
        s = s.mirror("YZ")
    return s.translate((direction * from_r, 0, z))


def pipe_x(r, length, x0=0.0):
    return cq.Workplane("YZ").circle(r).extrude(length).translate((x0, 0, 0))


def wing_nut(r_pipe, x0):
    """Hammer union wing nut: ring with three lugs."""
    ring = cq.Workplane("YZ").circle(r_pipe * 1.75).circle(r_pipe * 1.05).extrude(1.6).translate((x0, 0, 0))
    for i in range(3):
        lug = cq.Workplane("YZ").rect(0.9, r_pipe * 1.1).extrude(1.6).translate((x0, 0, r_pipe * 2.0))
        ring = ring.union(lug.rotate((0, 0, 0), (1, 0, 0), i * 120))
    return ring


# --------------------------------------------------------------------------- export
def export_parts(parts, outdir, name, extra_stl=True):
    os.makedirs(outdir, exist_ok=True)
    asm = cq.Assembly(name=name)
    for pid, solid in parts.items():
        asm.add(solid, name=pid)
    asm.save(os.path.join(outdir, f"{name}.step"))
    import numpy as np  # noqa: F401
    import trimesh
    scene = trimesh.Scene()
    for pid, solid in parts.items():
        stl = os.path.join(outdir, f"{pid}.stl")
        cq.exporters.export(solid, stl, tolerance=0.02, angularTolerance=0.15)
        m = trimesh.load(stl, force="mesh")
        m.apply_scale(IN2M)
        role = pid.split("-")[-1]
        if role.isdigit():
            role = pid.split("-")[-2]
        rgb = ROLE_COLORS.get(role, (0.5, 0.5, 0.5))
        m.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
            baseColorFactor=[rgb[0], rgb[1], rgb[2], 1.0], metallicFactor=0.6, roughnessFactor=0.5, name=role))
        scene.add_geometry(m, node_name=pid, geom_name=pid)
        if not extra_stl:
            os.remove(stl)
    out = os.path.join(outdir, f"{name}.glb")
    scene.export(out)
    print("wrote", out, os.path.getsize(out), "bytes,", len(parts), "nodes")
    return out
