"""
WH-FRACTREE: generic frac stack in the project's standard configuration, bottom to top:
tree adapter, lower master (manual), upper master (hydraulic), studded cross with a manual
then a hydraulic wing valve on each side, crown valve (hydraulic), flanged inlet block for a
spooled treating line, swab valve (hydraulic) for wireline, top adapter (hands-free style).
Stems of every valve point to -Y (operator side); balance stems and handwheel-free sides to +Y.
Each valve is one fused solid named for its position. Stud and nut sets between stacked
flanges are one node (WH-FRACTREE-STUDS).

Run: python WH-FRACTREE.py --out ../../out/WH --bore 7.0625 --rating 15
     python WH-FRACTREE.py --out ../../out/WH --all      (every bore and rating variant)
"""
import argparse
import math
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
from _lib import valve_params, gate_valve_solid, flanged_spool, block_cross, hex_nut, _bolt_pts, export_parts, size_key  # noqa: E402


def vertical_valve(p, open_fraction, z_center):
    """Bore along Z, stem along -Y."""
    s = gate_valve_solid(p, open_fraction)
    s = s.rotate((0, 0, 0), (0, 1, 0), -90)      # bore +X -> +Z, stem +Z -> -X
    s = s.rotate((0, 0, 0), (0, 0, 1), -90)      # stem -X -> -Y
    return s.translate((0, 0, z_center))


def wing_valve(p, open_fraction, x_center, z_center):
    """Bore along X, stem along -Y."""
    s = gate_valve_solid(p, open_fraction)
    s = s.rotate((0, 0, 0), (1, 0, 0), 90)       # stem +Z -> -Y
    return s.translate((x_center, 0, z_center))


def studs_z(p, z_face):
    """Studs and nuts through a mated flange pair at height z_face (vertical stack)."""
    t, d = p["flange_thk"], p["bolt_d"]
    L = 2 * t + 2 * 1.6 * d + 0.4
    ring = None
    for (x, y) in _bolt_pts(p["bolt_circle"] / 2, p["bolt_n"], math.pi / p["bolt_n"]):
        stud = cq.Workplane("XY").circle(d / 2).extrude(L).translate((x, y, z_face - L / 2))
        n1 = hex_nut(1.6 * d, 0.95 * d).translate((x, y, z_face + t + 0.05))
        n2 = hex_nut(1.6 * d, 0.95 * d).translate((x, y, z_face - t - 0.05 - 0.95 * d))
        s = stud.union(n1).union(n2)
        ring = s if ring is None else ring.union(s)
    return ring


def studs_x(p, x_face, z):
    t, d = p["flange_thk"], p["bolt_d"]
    L = 2 * t + 2 * 1.6 * d + 0.4
    ring = None
    for (y, zz) in _bolt_pts(p["bolt_circle"] / 2, p["bolt_n"], math.pi / p["bolt_n"]):
        stud = cq.Workplane("YZ").circle(d / 2).extrude(L).translate((x_face - L / 2, y, z + zz))
        n1 = hex_nut(1.6 * d, 0.95 * d).rotate((0, 0, 0), (0, 1, 0), 90).translate((x_face + t + 0.05, y, z + zz))
        n2 = hex_nut(1.6 * d, 0.95 * d).rotate((0, 0, 0), (0, 1, 0), 90).translate((x_face - t - 0.05 - 0.95 * d, y, z + zz))
        s = stud.union(n1).union(n2)
        ring = s if ring is None else ring.union(s)
    return ring


def top_adapter(p, z):
    """Hands-free style top connection: flange, tapered bowl, latch collar with lugs."""
    bore = p["bore"]
    fl = cq.Workplane("XY").circle(p["flange_od"] / 2).extrude(p["flange_thk"]).edges().chamfer(0.3).translate((0, 0, z))
    h_body = 0.9 * bore + 4.0
    body = cq.Workplane("XY").circle(0.62 * p["flange_od"] / 2).extrude(h_body).translate((0, 0, z + p["flange_thk"]))
    collar = cq.Workplane("XY").circle(0.80 * p["flange_od"] / 2).extrude(0.55 * bore).translate((0, 0, z + p["flange_thk"] + h_body))
    for i in range(3):
        lug = cq.Workplane("XY").box(0.9 * bore, 0.35 * bore, 0.55 * bore).translate((0.80 * p["flange_od"] / 2, 0, z + p["flange_thk"] + h_body + 0.275 * bore))
        collar = collar.union(lug.rotate((0, 0, 0), (0, 0, 1), i * 120))
    bowl = (cq.Workplane("XY").workplane(offset=z + p["flange_thk"] + h_body + 0.55 * bore)
            .circle(0.60 * p["flange_od"] / 2).workplane(offset=0.45 * bore).circle(0.95 * p["flange_od"] / 2).loft())
    s = fl.union(body).union(collar).union(bowl)
    s = s.cut(cq.Workplane("XY").circle(bore / 2).extrude(h_body + p["flange_thk"] + 2 * bore).translate((0, 0, z - 1)))
    return s, p["flange_thk"] + h_body + bore


def build(bore=7.0625, rating=15.0):
    pm = valve_params(bore, rating, actuated=False)
    ph = valve_params(bore, rating, actuated=True)
    ftf = pm["face_to_face"]
    t = pm["flange_thk"]
    parts = {}
    studs = None
    z = 0.0

    def add_studs(s):
        nonlocal studs
        studs = s if studs is None else studs.union(s)

    # tree adapter: tubing head adapter, a flanged spool
    ad_h = 2 * t + 0.8 * bore + 4.0
    parts["WH-FRACTREE-TREEADAPTER"] = flanged_spool(bore, 0.72 * pm["flange_od"], ad_h, pm["flange_od"], t, pm["bolt_n"], pm["bolt_d"], pm["bolt_circle"])
    z += ad_h
    add_studs(studs_z(pm, z))
    # lower master, manual, open
    parts["WH-FRACTREE-LMV"] = vertical_valve(pm, 1.0, z + ftf / 2)
    z += ftf
    add_studs(studs_z(pm, z))
    # upper master, hydraulic, open
    parts["WH-FRACTREE-UMV"] = vertical_valve(ph, 1.0, z + ftf / 2)
    z += ftf
    add_studs(studs_z(pm, z))
    # studded cross with a flanged hub each side
    cross_h = 2 * t + 1.1 * bore + 6.0
    hub_len = 0.9 * t + 2.0
    parts["WH-FRACTREE-CROSS"] = block_cross(bore, pm, cross_h, outlets=(-1, 1), hub_len=hub_len).translate((0, 0, z))
    zc = z + cross_h / 2
    cw = pm["body_w"]
    # wing valves: manual inboard, hydraulic outboard, on both sides
    x_face = cw / 2 + hub_len
    for sgn, tag in ((-1, "WINGA"), (1, "WINGB")):
        xm = sgn * (x_face + ftf / 2)
        parts[f"WH-FRACTREE-{tag}-MAN"] = wing_valve(pm, 1.0, xm, zc)
        add_studs(studs_x(pm, sgn * x_face, zc))
        xh = sgn * (x_face + ftf + ftf / 2)
        parts[f"WH-FRACTREE-{tag}-HYD"] = wing_valve(ph, 0.0, xh, zc)
        add_studs(studs_x(pm, sgn * (x_face + ftf), zc))
    z += cross_h
    add_studs(studs_z(pm, z))
    # crown valve, hydraulic, open
    parts["WH-FRACTREE-CROWN"] = vertical_valve(ph, 1.0, z + ftf / 2)
    z += ftf
    add_studs(studs_z(pm, z))
    # inlet block: flanged side hub toward +X for the spooled treating line, blind side -X
    ib_h = 2 * t + 1.0 * bore + 5.0
    parts["WH-FRACTREE-INLETBLOCK"] = block_cross(bore, pm, ib_h, outlets=(1,), hub_len=hub_len).translate((0, 0, z))
    z += ib_h
    add_studs(studs_z(pm, z))
    # swab valve, hydraulic, closed
    parts["WH-FRACTREE-SWAB"] = vertical_valve(ph, 0.0, z + ftf / 2)
    z += ftf
    add_studs(studs_z(pm, z))
    # top adapter
    ta, ta_h = top_adapter(pm, z)
    parts["WH-FRACTREE-TOPADAPTER"] = ta
    z += ta_h
    parts["WH-FRACTREE-STUDS"] = studs
    return parts, z


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--bore", type=float, default=7.0625)
    ap.add_argument("--rating", type=float, default=15.0)
    ap.add_argument("--out", default="out")
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    combos = [(b, r) for r in (10.0, 15.0) for b in (4.0625, 5.125, 7.0625)] if a.all else [(a.bore, a.rating)]
    for bore, rating in combos:
        parts, height = build(bore, rating)
        print(size_key(bore, rating), "tree height in.", round(height, 1))
        export_parts(parts, a.out, "WH-FRACTREE." + size_key(bore, rating), extra_stl=False, tolerance=0.05)
