"""
WH-FRACTREE: generic 5-1/8 in. 15K frac tree. Stack from the tubing head adapter up:
tree adapter, lower master (manual), upper master (hydraulic), studded cross with two
hydraulic wing valves, swab valve (manual), goat head with three 3 in. inlets.
Each valve is exported as one fused solid named for its position in the tree.

Run: python WH-FRACTREE.py --out ../../out/WH
"""
import argparse
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
from _lib import valve_params, gate_valve_solid, flanged_spool, export_parts  # noqa: E402


def vertical_valve(p, open_fraction, z_center):
    """Valve with bore along Z (rotate local +X bore to +Z); handwheel or actuator points -X."""
    s = gate_valve_solid(p, open_fraction)
    return s.rotate((0, 0, 0), (0, 1, 0), -90).translate((0, 0, z_center))


def build(bore=5.125, rating=15.0):
    pm = valve_params(bore, rating, actuated=False)
    ph = valve_params(bore, rating, actuated=True)
    ftf = pm["face_to_face"]
    parts = {}
    z = 0.0
    # tree adapter (tubing head adapter): flanged spool
    ad_h = 14.0
    parts["WH-FRACTREE-TREEADAPTER"] = flanged_spool(bore, 12.0, ad_h, pm["flange_od"], pm["flange_thk"], pm["bolt_n"], pm["bolt_d"], pm["bolt_circle"])
    z += ad_h
    # lower master, manual
    parts["WH-FRACTREE-LMV"] = vertical_valve(pm, 1.0, z + ftf / 2)
    z += ftf
    # upper master, hydraulic
    parts["WH-FRACTREE-UMV"] = vertical_valve(ph, 1.0, z + ftf / 2)
    z += ftf
    # studded cross
    cross_h = 20.0
    cw = pm["body_w"]
    cross = cq.Workplane("XY").box(cw, cw, cross_h).edges("|Z").fillet(0.15 * cw).translate((0, 0, z + cross_h / 2))
    cross = cross.cut(cq.Workplane("XY").circle(bore / 2).extrude(cross_h + 2).translate((0, 0, z - 1)))
    cross = cross.cut(cq.Workplane("YZ").circle(bore / 2).extrude(cw + 2, both=True).translate((0, 0, z + cross_h / 2)))
    # side outlet hubs
    for sgn in (-1, 1):
        hub = cq.Workplane("YZ").circle(pm["flange_od"] / 2).extrude(4.0)
        hub = hub.cut(cq.Workplane("YZ").circle(bore / 2).extrude(6, both=True))
        hub = hub.translate((cw / 2 if sgn > 0 else -cw / 2 - 4.0, 0, z + cross_h / 2))
        cross = cross.union(hub)
    parts["WH-FRACTREE-CROSS"] = cross
    # wing valves: bore along X, stems up
    xw = cw / 2 + 4.0 + ftf / 2
    zc = z + cross_h / 2
    parts["WH-FRACTREE-WINGA"] = gate_valve_solid(ph, 0.0).translate((-xw, 0, zc))
    parts["WH-FRACTREE-WINGB"] = gate_valve_solid(ph, 0.0).translate((xw, 0, zc))
    z += cross_h
    # swab valve, manual, closed
    parts["WH-FRACTREE-SWAB"] = vertical_valve(pm, 0.0, z + ftf / 2)
    z += ftf
    # goat head: body with three inlets on the -X side and a top cap
    gh_h = 24.0
    gh = cq.Workplane("XY").circle(8.0).extrude(gh_h).translate((0, 0, z))
    gh = gh.union(cq.Workplane("XY").circle(pm["flange_od"] / 2).extrude(pm["flange_thk"]).translate((0, 0, z)))
    gh = gh.cut(cq.Workplane("XY").circle(bore / 2).extrude(gh_h - 3).translate((0, 0, z - 1)))
    for i, yoff in enumerate((-6.0, 0.0, 6.0)):
        inlet = cq.Workplane("XY").circle(2.4).extrude(22.0)
        inlet = inlet.cut(cq.Workplane("XY").circle(1.5).extrude(23.0).translate((0, 0, -0.5)))
        inlet = inlet.rotate((0, 0, 0), (0, 1, 0), -35).translate((-4.0, yoff, z + 12.0))
        gh = gh.union(inlet)
    cap = cq.Workplane("XY").circle(7.0).extrude(3.0).translate((0, 0, z + gh_h))
    parts["WH-FRACTREE-GOATHEAD"] = gh
    parts["WH-FRACTREE-TREECAP"] = cap
    return parts, z + gh_h + 3.0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--bore", type=float, default=5.125)
    ap.add_argument("--rating", type=float, default=15.0)
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    parts, height = build(a.bore, a.rating)
    print("tree height in.", round(height, 1))
    export_parts(parts, a.out, "WH-FRACTREE", extra_stl=False)
