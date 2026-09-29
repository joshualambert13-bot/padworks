"""
UC-PRODTREE: generic 3-1/16 in. 10K production tree on a tubing head adapter, bottom to top:
tubing head adapter, lower master (manual), upper master (manual), studded flow cross, production
wing valve (manual) with an adjustable choke carrying an electric actuator box and a flowline
flange, kill wing valve (manual) with a companion flange and gauge, swab valve (manual), tree cap
with a pressure gauge on a needle valve. Stems point to -Y. Generic proportions read from a field
photograph at the level of overall size; not a manufacturer's design.

Run: python UC-PRODTREE.py --out ../../out/UC
"""
import argparse
import math
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "WH"))
from _lib import valve_params, gate_valve_solid, flanged_spool, block_cross, hex_nut, _bolt_pts, export_parts, ROLE_COLORS  # noqa: E402

ROLE_COLORS.update({"TUBINGHEADADAPTER": (0.40, 0.42, 0.46), "FLOWCROSS": (0.24, 0.26, 0.30), "WINGVALVE": (0.28, 0.30, 0.34),
                    "CHOKE": (0.30, 0.32, 0.36), "ACTUATOR": (0.64, 0.15, 0.11), "KILLWING": (0.28, 0.30, 0.34), "TREECAP": (0.40, 0.42, 0.46), "GAUGE": (0.70, 0.72, 0.76), "FLOWLINE": (0.24, 0.26, 0.30)})

BORE, RATING = 3.0625, 10.0


def vertical_valve(p, open_fraction, z_center):
    s = gate_valve_solid(p, open_fraction)
    s = s.rotate((0, 0, 0), (0, 1, 0), -90).rotate((0, 0, 0), (0, 0, 1), -90)
    return s.translate((0, 0, z_center))


def wing_valve(p, open_fraction, x_center, z_center):
    s = gate_valve_solid(p, open_fraction)
    s = s.rotate((0, 0, 0), (1, 0, 0), 90)
    return s.translate((x_center, 0, z_center))


def studs_z(p, z_face):
    t, d = p["flange_thk"], p["bolt_d"]
    L = 2 * t + 2 * 1.6 * d + 0.4
    ring = None
    for (x, y) in _bolt_pts(p["bolt_circle"] / 2, p["bolt_n"], math.pi / p["bolt_n"]):
        s = cq.Workplane("XY").circle(d / 2).extrude(L).translate((x, y, z_face - L / 2))
        s = s.union(hex_nut(1.6 * d, 0.95 * d).translate((x, y, z_face + t + 0.05))).union(hex_nut(1.6 * d, 0.95 * d).translate((x, y, z_face - t - 0.05 - 0.95 * d)))
        ring = s if ring is None else ring.union(s)
    return ring


def studs_x(p, x_face, z):
    t, d = p["flange_thk"], p["bolt_d"]
    L = 2 * t + 2 * 1.6 * d + 0.4
    ring = None
    for (y, zz) in _bolt_pts(p["bolt_circle"] / 2, p["bolt_n"], math.pi / p["bolt_n"]):
        s = cq.Workplane("YZ").circle(d / 2).extrude(L).translate((x_face - L / 2, y, z + zz))
        n1 = hex_nut(1.6 * d, 0.95 * d).rotate((0, 0, 0), (0, 1, 0), 90).translate((x_face + t + 0.05, y, z + zz))
        n2 = hex_nut(1.6 * d, 0.95 * d).rotate((0, 0, 0), (0, 1, 0), 90).translate((x_face - t - 0.05 - 0.95 * d, y, z + zz))
        s = s.union(n1).union(n2)
        ring = s if ring is None else ring.union(s)
    return ring


def choke(p, x0, z):
    """Adjustable choke with an electric actuator: body with union ends along X, bonnet up, actuator box, flowline flange."""
    L = p["face_to_face"] * 0.75
    body = cq.Workplane("XY").box(0.55 * L, 0.9 * p["body_w"], 0.9 * p["body_w"]).edges("|Y").fillet(0.6).translate((x0 + L / 2, 0, z))
    inlet = cq.Workplane("YZ").circle(0.5 * p["flange_od"] / 2).extrude(0.2 * L).translate((x0, 0, z))
    fl_in = cq.Workplane("YZ").circle(p["flange_od"] / 2).extrude(p["flange_thk"]).translate((x0, 0, z))
    fl_in = fl_in.cut(cq.Workplane("YZ").pushPoints(_bolt_pts(p["bolt_circle"] / 2, p["bolt_n"], math.pi / p["bolt_n"])).circle(p["bolt_d"] / 2 + 0.06).extrude(p["flange_thk"] + 2).translate((x0 - 1, 0, z)))
    outlet = cq.Workplane("YZ").circle(0.5 * p["flange_od"] / 2).extrude(0.25 * L).translate((x0 + 0.75 * L, 0, z))
    fl_out = fl_in.translate((L - p["flange_thk"], 0, 0))
    c = body.union(inlet).union(fl_in).union(outlet).union(fl_out)
    c = c.cut(cq.Workplane("YZ").circle(BORE / 2).extrude(L + 2).translate((x0 - 1, 0, z)))
    bonnet = cq.Workplane("XY").circle(0.45 * p["body_w"]).extrude(0.4 * p["body_w"]).translate((x0 + 0.5 * L, 0, z + 0.45 * p["body_w"]))
    stem = cq.Workplane("XY").circle(0.6).extrude(3.0).translate((x0 + 0.5 * L, 0, z + 0.85 * p["body_w"]))
    act = cq.Workplane("XY").box(1.1 * p["body_w"], 0.9 * p["body_w"], 0.8 * p["body_w"]).edges("|Z").fillet(0.5).translate((x0 + 0.5 * L, 0, z + 0.85 * p["body_w"] + 3.0 + 0.4 * p["body_w"]))
    act = act.union(cq.Workplane("XY").box(0.5 * p["body_w"], 0.35 * p["body_w"], 0.3 * p["body_w"]).translate((x0 + 0.5 * L - 0.55 * p["body_w"], 0, z + 0.85 * p["body_w"] + 3.0 + 0.4 * p["body_w"])))
    return c.union(bonnet).union(stem), act, L


def build():
    pm = valve_params(BORE, RATING, actuated=False)
    ftf = pm["face_to_face"]
    t = pm["flange_thk"]
    parts = {}
    studs = None

    def add_studs(s):
        nonlocal studs
        studs = s if studs is None else studs.union(s)
    z = 0.0
    ad_h = 2 * t + 1.6 * BORE + 4.0
    parts["UC-PRODTREE-TUBINGHEADADAPTER"] = flanged_spool(BORE, 0.7 * pm["flange_od"], ad_h, pm["flange_od"], t, pm["bolt_n"], pm["bolt_d"], pm["bolt_circle"])
    z += ad_h
    add_studs(studs_z(pm, z))
    parts["UC-PRODTREE-LMV"] = vertical_valve(pm, 1.0, z + ftf / 2)
    z += ftf
    add_studs(studs_z(pm, z))
    parts["UC-PRODTREE-UMV"] = vertical_valve(pm, 1.0, z + ftf / 2)
    z += ftf
    add_studs(studs_z(pm, z))
    cross_h = 2 * t + 1.4 * BORE + 4.0
    hub_len = 0.9 * t + 1.5
    parts["UC-PRODTREE-FLOWCROSS"] = block_cross(BORE, pm, cross_h, outlets=(-1, 1), hub_len=hub_len).translate((0, 0, z))
    zc = z + cross_h / 2
    x_face = pm["body_w"] / 2 + hub_len
    # production wing (+X): wing valve then choke then flowline flange
    parts["UC-PRODTREE-WINGVALVE"] = wing_valve(pm, 1.0, x_face + ftf / 2, zc)
    add_studs(studs_x(pm, x_face, zc))
    ch, act, L = choke(pm, x_face + ftf, zc)
    parts["UC-PRODTREE-CHOKE"] = ch
    parts["UC-PRODTREE-ACTUATOR"] = act
    add_studs(studs_x(pm, x_face + ftf, zc))
    add_studs(studs_x(pm, x_face + ftf + L, zc))
    # flowline: flanged elbow down toward the flowline riser
    fl_x = x_face + ftf + L
    fl = cq.Workplane("YZ").circle(0.5 * pm["flange_od"] / 2).extrude(6.0).translate((fl_x, 0, zc))
    fl = fl.union(cq.Workplane("YZ").circle(pm["flange_od"] / 2).extrude(t).translate((fl_x, 0, zc)))
    elbow = cq.Workplane("XY").circle(0.5 * pm["flange_od"] / 2).extrude(-(zc - 6.0)).translate((fl_x + 6.0, 0, zc))
    fl = fl.union(elbow).union(cq.Workplane("XY").sphere(0.5 * pm["flange_od"] / 2).translate((fl_x + 6.0, 0, zc)))
    fl = fl.cut(cq.Workplane("YZ").circle(BORE / 2).extrude(8).translate((fl_x - 1, 0, zc)))
    parts["UC-PRODTREE-FLOWLINE"] = fl
    # kill wing (-X): wing valve then companion flange with a gauge
    parts["UC-PRODTREE-KILLWING"] = wing_valve(pm, 0.0, -(x_face + ftf / 2), zc)
    add_studs(studs_x(pm, -x_face, zc))
    comp = cq.Workplane("YZ").circle(pm["flange_od"] / 2).extrude(t).translate((-(x_face + ftf) - t, 0, zc))
    comp = comp.cut(cq.Workplane("YZ").pushPoints(_bolt_pts(pm["bolt_circle"] / 2, pm["bolt_n"], math.pi / pm["bolt_n"])).circle(pm["bolt_d"] / 2 + 0.06).extrude(t + 2).translate((-(x_face + ftf) - t - 1, 0, zc)))
    add_studs(studs_x(pm, -(x_face + ftf), zc))
    g = cq.Workplane("YZ").circle(0.5).extrude(-3.0).translate((-(x_face + ftf) - t, 0, zc))
    g = g.union(cq.Workplane("YZ").circle(2.2).extrude(-1.2).translate((-(x_face + ftf) - t - 3.0, 0, zc)))
    parts["UC-PRODTREE-GAUGE"] = g
    parts["UC-PRODTREE-KILLWING"] = parts["UC-PRODTREE-KILLWING"].union(comp)
    z += cross_h
    add_studs(studs_z(pm, z))
    parts["UC-PRODTREE-SWAB"] = vertical_valve(pm, 0.0, z + ftf / 2)
    z += ftf
    add_studs(studs_z(pm, z))
    # tree cap: flange, dome, needle valve and gauge on top
    cap = cq.Workplane("XY").circle(pm["flange_od"] / 2).extrude(t).translate((0, 0, z))
    cap = cap.cut(cq.Workplane("XY").pushPoints(_bolt_pts(pm["bolt_circle"] / 2, pm["bolt_n"], math.pi / pm["bolt_n"])).circle(pm["bolt_d"] / 2 + 0.06).extrude(t + 2).translate((0, 0, z - 1)))
    dome = cq.Workplane("XY").workplane(offset=z + t).circle(0.55 * pm["flange_od"] / 2).workplane(offset=0.8 * BORE + 2.0).circle(0.25 * pm["flange_od"] / 2).loft()
    nv = cq.Workplane("XY").circle(0.55).extrude(3.0).translate((0, 0, z + t + 0.8 * BORE + 2.0))
    nv = nv.union(cq.Workplane("XY").box(1.6, 1.6, 1.4).translate((0, 0, z + t + 0.8 * BORE + 2.0 + 3.7)))
    nv = nv.union(cq.Workplane("XY").circle(0.4).extrude(2.0).translate((0, 0, z + t + 0.8 * BORE + 2.0 + 4.4)))
    gauge = cq.Workplane("XZ").circle(2.0).extrude(1.0).translate((0, 0.5, z + t + 0.8 * BORE + 2.0 + 7.4))
    parts["UC-PRODTREE-TREECAP"] = cap.union(dome).union(nv)
    parts["UC-PRODTREE-GAUGE"] = parts["UC-PRODTREE-GAUGE"].union(gauge)
    parts["UC-PRODTREE-STUDS"] = studs
    return parts, z + t + 0.8 * BORE + 2.0 + 9.0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    parts, h = build()
    print("tree height in.", round(h, 1))
    export_parts(parts, a.out, "UC-PRODTREE", extra_stl=False, tolerance=0.04)
