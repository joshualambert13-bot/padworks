"""
WL-PCE: generic wireline pressure control stack for pump-down plug-and-perf, 5-1/8 in. 15K class.
Bottom to top: wellhead adapter (flange to quick union), wireline valve (dual ram body with
hydraulic actuators), tool trap, pump-in sub with side port, ball check valve, lubricator
sections with quick unions, tool catcher, grease injection head with flow tubes, line wiper.
Vertical along Z. Generic proportions; not a manufacturer's design.

Run: python WL-PCE.py --out ../../out/WL
"""
import argparse
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "WH"))
from _lib import export_parts, _bolt_pts  # noqa: E402

R_LUB = 3.9      # lubricator OD radius (7-3/4 in. OD class)
R_BORE = 2.56    # 5-1/8 in. bore radius


def tube(r_out, r_in, h, z):
    return cq.Workplane("XY").circle(r_out).circle(r_in).extrude(h).translate((0, 0, z))


def quick_union(z, r_out=R_LUB + 1.2, h=3.2):
    """Quick union collar: knurled ring with a shoulder."""
    ring = cq.Workplane("XY").circle(r_out).circle(R_BORE).extrude(h).translate((0, 0, z))
    for i in range(12):
        lug = cq.Workplane("XY").box(1.2, 0.6, h).translate((r_out - 0.2, 0, z + h / 2))
        ring = ring.union(lug.rotate((0, 0, 0), (0, 0, 1), i * 30))
    return ring


def build():
    parts = {}
    z = 0.0
    # wellhead adapter: 6BX flange at the bottom to a quick union pin at the top
    fl_od, fl_t = 17.0, 1.8
    adapter = cq.Workplane("XY").circle(fl_od / 2).extrude(fl_t)
    adapter = adapter.cut(cq.Workplane("XY").pushPoints(_bolt_pts(14.3 / 2 * 2 / 2 + 5.0, 12)).circle(0.69).extrude(3).translate((0, 0, -0.5)))
    adapter = adapter.union(cq.Workplane("XY").circle(5.2).extrude(9.0).translate((0, 0, fl_t)))
    adapter = adapter.cut(cq.Workplane("XY").circle(R_BORE).extrude(12).translate((0, 0, -1)))
    parts["WL-PCE-WELLHEADADAPTER"] = adapter
    z += fl_t + 9.0
    parts["WL-PCE-QUICKUNION"] = quick_union(z)
    z += 3.2
    # wireline valve: rectangular body with two ram bores and hydraulic actuators each side
    wv_h = 30.0
    body = cq.Workplane("XY").box(20.0, 14.0, wv_h).edges("|Z").fillet(1.5).translate((0, 0, z + wv_h / 2))
    body = body.cut(cq.Workplane("XY").circle(R_BORE).extrude(wv_h + 2).translate((0, 0, z - 1)))
    for zz in (z + 9.0, z + 21.0):          # two ram levels
        for sgn in (-1, 1):
            act = cq.Workplane("YZ").circle(3.4).extrude(9.0).translate((sgn * 10.0 if sgn > 0 else -19.0, 0, zz))
            cap = cq.Workplane("YZ").circle(3.9).extrude(1.2).translate((19.0 if sgn > 0 else -20.2, 0, zz))
            body = body.union(act).union(cap)
            port = cq.Workplane("XY").circle(0.5).extrude(2.5).translate((sgn * 15.5, 0, zz + 3.2))
            body = body.union(port)
    parts["WL-PCE-WIRELINEVALVE"] = body
    z += wv_h
    parts["WL-PCE-QUICKUNION"] = parts["WL-PCE-QUICKUNION"].union(quick_union(z))
    z += 3.2
    # tool trap: short body with a side-mounted hydraulic flapper actuator
    tt_h = 12.0
    trap = tube(R_LUB + 0.6, R_BORE, tt_h, z)
    trap = trap.union(cq.Workplane("YZ").circle(2.2).extrude(6.0).translate((R_LUB, 0, z + tt_h / 2)))
    parts["WL-PCE-TOOLTRAP"] = trap
    z += tt_h
    # pump-in sub: tube with a 2 in. side port and union
    pi_h = 10.0
    sub = tube(R_LUB, R_BORE, pi_h, z)
    sub = sub.union(cq.Workplane("XZ").circle(1.5).extrude(9.0).translate((0, -0.0, z + pi_h / 2)).rotate((0, 0, z + pi_h / 2), (0, 0, z + pi_h / 2 + 1), 180))
    sub = sub.union(cq.Workplane("XZ").circle(2.2).extrude(1.5).translate((0, -9.0 + 1.5, z + pi_h / 2)))
    parts["WL-PCE-PUMPINSUB"] = sub
    z += pi_h
    # ball check valve: bulged tube
    bc_h = 9.0
    parts["WL-PCE-BALLCHECK"] = tube(R_LUB + 0.9, R_BORE, bc_h, z)
    z += bc_h
    parts["WL-PCE-QUICKUNION"] = parts["WL-PCE-QUICKUNION"].union(quick_union(z))
    z += 3.2
    # lubricator sections
    lub = None
    sec_h = 96.0
    for i in range(3):
        t = tube(R_LUB, R_BORE, sec_h, z)
        lub = t if lub is None else lub.union(t)
        z += sec_h
        parts["WL-PCE-QUICKUNION"] = parts["WL-PCE-QUICKUNION"].union(quick_union(z))
        z += 3.2
    parts["WL-PCE-LUBRICATOR"] = lub
    # tool catcher: short body with a side latch actuator
    tc_h = 10.0
    catcher = tube(R_LUB + 0.4, R_BORE, tc_h, z)
    catcher = catcher.union(cq.Workplane("YZ").circle(1.6).extrude(4.5).translate((R_LUB, 0, z + tc_h / 2)))
    parts["WL-PCE-TOOLCATCHER"] = catcher
    z += tc_h
    # grease injection head: body with three flow tubes stacked and grease inlet ports
    gh_h = 30.0
    head = tube(R_LUB - 0.6, 0.9, gh_h, z)
    for k in range(3):
        head = head.union(tube(R_LUB - 0.2, 0.9, 1.6, z + 5 + k * 8))
        head = head.union(cq.Workplane("YZ").circle(0.55).extrude(3.5).translate((R_LUB - 0.6, 0, z + 6 + k * 8)))
    parts["WL-PCE-GREASEHEAD"] = head
    z += gh_h
    # line wiper and top sheave bracket stub
    lw_h = 6.0
    wiper = tube(2.6, 0.5, lw_h, z)
    wiper = wiper.union(cq.Workplane("XY").box(3.0, 1.2, 8.0).translate((3.2, 0, z + lw_h + 3.0)))
    parts["WL-PCE-LINEWIPER"] = wiper
    z += lw_h
    return parts, z


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    parts, h = build()
    print("stack height in.", round(h, 1))
    export_parts(parts, a.out, "WL-PCE", extra_stl=False)
