"""
WH-WELLHEAD: generic land wellhead as left ready for the frac stack: casing head on a
landing base, casing spool with two side outlets and outlet valves, slip-type casing
hanger and pack-off, tubing head with two side outlets, tubing hanger (parked, no tubing
during the frac), lockdown screws, back pressure valve profile, and the tree adapter.
Proportions are representative, not API 6A table values.

Run: python WH-WELLHEAD.py --out ../../out/WH
"""
import argparse
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
from _lib import valve_params, gate_valve_solid, flanged_spool, side_outlet, export_parts, _bolt_pts  # noqa: E402


def outlet_valve(bore=2.0625, rating=5.0, x=0.0, z=0.0, side=1):
    p = valve_params(bore, rating, actuated=False)
    s = gate_valve_solid(p, 0.0)
    # stem up; bore along X; move so the inlet flange face sits at x
    return s.translate((side * (x + p["face_to_face"] / 2), 0, z))


def build():
    parts = {}
    z = 0.0
    # landing base plate and casing head (slip-on weld to surface casing)
    base = cq.Workplane("XY").circle(16.0).extrude(2.0).cut(cq.Workplane("XY").circle(7.0).extrude(3).translate((0, 0, -0.5)))
    ch_h = 22.0
    ch = cq.Workplane("XY").circle(10.5).extrude(ch_h - 2.5).translate((0, 0, 2.0))
    ch = ch.union(cq.Workplane("XY").circle(13.0).extrude(2.5).translate((0, 0, ch_h - 0.5)))
    ch = ch.cut(cq.Workplane("XY").circle(6.5).extrude(ch_h + 2).translate((0, 0, -1)))
    ch = ch.cut(cq.Workplane("XY").pushPoints(_bolt_pts(11.4, 16)).circle(0.8).extrude(4).translate((0, 0, ch_h - 2.5)))
    parts["WH-WELLHEAD-CASINGHEAD"] = base.union(ch)
    z += ch_h + 2.0
    # casing spool with side outlets and valves
    cs_h = 24.0
    cs = flanged_spool(9.0, 20.0, cs_h, 26.0, 2.5, 16, 1.6, 22.8).translate((0, 0, z))
    for side in (-1, 1):
        cs = cs.union(side_outlet(4.5, 5.5, 8.5, 1.4, side, z + cs_h / 2, 10.0))
    parts["WH-WELLHEAD-CASINGSPOOL"] = cs
    parts["WH-WELLHEAD-SIDEOUTLETVALVE"] = outlet_valve(x=10.0 + 5.5 + 1.4, z=z + cs_h / 2, side=1).union(outlet_valve(x=10.0 + 5.5 + 1.4, z=z + cs_h / 2, side=-1))
    # slip-type casing hanger (cone segments) and pack-off ring in the spool bowl
    hanger = cq.Workplane("XY").circle(8.6).circle(5.0).extrude(6.0).translate((0, 0, z + 3.0))
    hanger = hanger.cut(cq.Workplane("XY").circle(9.0).circle(7.8).extrude(3.0).translate((0, 0, z + 3.0)))
    parts["WH-WELLHEAD-CASINGHANGER"] = hanger
    parts["WH-WELLHEAD-PACKOFF"] = cq.Workplane("XY").circle(8.8).circle(5.0).extrude(2.2).translate((0, 0, z + 9.2))
    z += cs_h
    # tubing head with side outlets and valves
    th_h = 20.0
    th = flanged_spool(7.0, 18.0, th_h, 22.0, 2.2, 12, 1.6, 19.0).translate((0, 0, z))
    for side in (-1, 1):
        th = th.union(side_outlet(4.5, 5.0, 8.5, 1.4, side, z + th_h / 2, 9.0))
    parts["WH-WELLHEAD-TUBINGHEAD"] = th
    parts["WH-WELLHEAD-SIDEOUTLETVALVE"] = parts["WH-WELLHEAD-SIDEOUTLETVALVE"].union(
        outlet_valve(x=9.0 + 5.0 + 1.4, z=z + th_h / 2, side=1)).union(outlet_valve(x=9.0 + 5.0 + 1.4, z=z + th_h / 2, side=-1))
    # tubing hanger parked in the bowl (mandrel with neck and BPV profile), lockdown screws
    hanger2 = cq.Workplane("XY").circle(6.6).extrude(7.0).translate((0, 0, z + 8.0))
    hanger2 = hanger2.union(cq.Workplane("XY").circle(4.2).extrude(5.0).translate((0, 0, z + 15.0)))
    hanger2 = hanger2.cut(cq.Workplane("XY").circle(2.5).extrude(14).translate((0, 0, z + 7.0)))
    parts["WH-WELLHEAD-TUBINGHANGER"] = hanger2
    parts["WH-WELLHEAD-BPV"] = cq.Workplane("XY").circle(2.3).extrude(4.0).translate((0, 0, z + 14.0))
    screws = None
    for (x, y) in _bolt_pts(10.4, 8):
        s = cq.Workplane("XY").circle(0.7).extrude(4.5)
        s = s.rotate((0, 0, 0), (0, 1, 0), 90)  # along +X
        import math
        ang = math.degrees(math.atan2(y, x))
        s = s.rotate((0, 0, 0), (0, 0, 1), ang).translate((x, y, z + 15.5))
        screws = s if screws is None else screws.union(s)
    parts["WH-WELLHEAD-LOCKDOWNSCREW"] = screws
    z += th_h
    # tree adapter
    pm = valve_params(5.125, 15.0)
    parts["WH-WELLHEAD-TREEADAPTER"] = flanged_spool(5.125, 12.0, 14.0, pm["flange_od"], pm["flange_thk"], pm["bolt_n"], pm["bolt_d"], pm["bolt_circle"]).translate((0, 0, z))
    z += 14.0
    return parts, z


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    parts, h = build()
    print("wellhead height in.", round(h, 1))
    export_parts(parts, a.out, "WH-WELLHEAD", extra_stl=False)
