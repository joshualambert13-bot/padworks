"""
WL-PCE: generic wireline pressure control stack for pump-down plug-and-perf, 15K class, in
5-1/8 in. and 7-1/16 in. bores. Bottom to top: hands-free bottom adapter (mates the tree top
adapter), quick union, wireline valve (block body, two ram levels, tie-rod actuators each side),
tool trap (side flapper actuator), pump-in sub (flanged side port), ball check valve, three
lubricator sections with lift collars and quick unions, tool catcher, grease injection head
(three flow tubes, grease ports, return), line wiper with the cable guide.
Vertical along Z. Generic proportions read from field photographs at the level of overall size;
not a manufacturer's design.

Run: python WL-PCE.py --out ../../out/WL --all
"""
import argparse
import math
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "WH"))
from _lib import export_parts, hex_nut, _bolt_pts, size_key, flange_spec  # noqa: E402


def tube(r_out, r_in, h, z):
    return cq.Workplane("XY").circle(r_out).circle(r_in).extrude(h).translate((0, 0, z))


def quick_union(z, r_bore, r_lub, h=None):
    """Quick union: shoulder on the pin, knurled collar with lugs on the box."""
    h = h or (0.36 * r_lub + 2.0)
    r_out = r_lub + 0.32 * r_lub + 0.4
    ring = cq.Workplane("XY").circle(r_out).circle(r_bore).extrude(h).translate((0, 0, z))
    ring = ring.edges(">Z or <Z").chamfer(0.25)
    for i in range(12):
        lug = cq.Workplane("XY").box(0.35 * r_lub, 0.22 * r_lub, h * 0.7).translate((r_out - 0.1, 0, z + h / 2))
        ring = ring.union(lug.rotate((0, 0, 0), (0, 0, 1), i * 30))
    shoulder = cq.Workplane("XY").circle(r_lub + 0.15 * r_lub).circle(r_bore).extrude(0.35 * h).translate((0, 0, z - 0.35 * h))
    return ring.union(shoulder)


def lift_collar(z, r_lub):
    c = cq.Workplane("XY").circle(r_lub + 0.5).circle(r_lub - 0.01).extrude(1.6).translate((0, 0, z))
    eye = cq.Workplane("XZ").circle(0.9).circle(0.45).extrude(0.5, both=True).translate((r_lub + 0.9, 0, z + 1.6))
    return c.union(eye)


def actuator(x_sign, z, r_cyl, length, plate):
    """Tie-rod hydraulic ram actuator along X, base plate at the body face."""
    x0 = x_sign * plate
    cyl = cq.Workplane("YZ").circle(r_cyl).extrude(length).translate((x0 if x_sign > 0 else x0 - length, 0, z))
    p1 = cq.Workplane("YZ").rect(2 * r_cyl + 1.4, 2 * r_cyl + 1.4).extrude(0.9).edges("|X").fillet(0.5).translate((x0 if x_sign > 0 else x0 - 0.9, 0, z))
    p2 = p1.translate((x_sign * (length - 0.9), 0, 0))
    a = cyl.union(p1).union(p2)
    for (y, zz) in _bolt_pts(r_cyl + 0.55, 4, math.pi / 4):
        rod = cq.Workplane("YZ").circle(0.28).extrude(length + 1.0).translate(((x0 - 0.5) if x_sign > 0 else x0 - length - 0.5, y, z + zz))
        nut = hex_nut(0.9, 0.5).rotate((0, 0, 0), (0, 1, 0), 90).translate(((x0 + length) if x_sign > 0 else x0 - length - 0.5, y, z + zz))
        a = a.union(rod).union(nut)
    port = cq.Workplane("XY").circle(0.32).extrude(1.2).translate((x_sign * (plate + length * 0.5), 0, z + r_cyl - 0.1))
    return a.union(port)


def build(bore=7.0625, rating=15.0):
    f = flange_spec(bore, rating)
    r_bore = bore / 2
    r_lub = 0.55 * bore + 0.5           # lubricator OD radius
    parts = {}
    z = 0.0
    # hands-free bottom adapter: funnel skirt that lands over the tree top adapter, latch collar, union pin
    skirt = (cq.Workplane("XY").workplane(offset=z).circle(0.95 * f["od"] / 2).workplane(offset=0.45 * bore).circle(0.62 * f["od"] / 2).loft())
    collar = cq.Workplane("XY").circle(0.80 * f["od"] / 2).extrude(0.55 * bore).translate((0, 0, z + 0.45 * bore))
    for i in range(3):
        lug = cq.Workplane("XY").box(0.9 * bore, 0.35 * bore, 0.55 * bore).translate((0.80 * f["od"] / 2, 0, z + 0.45 * bore + 0.275 * bore))
        collar = collar.union(lug.rotate((0, 0, 0), (0, 0, 1), i * 120 + 60))
    body_h = 0.9 * bore + 3.0
    body = cq.Workplane("XY").circle(0.62 * f["od"] / 2).extrude(body_h).translate((0, 0, z + bore))
    ad = skirt.union(collar).union(body)
    ad = ad.cut(cq.Workplane("XY").circle(r_bore).extrude(body_h + 2 * bore).translate((0, 0, z - 1)))
    parts["WL-PCE-WELLHEADADAPTER"] = ad
    z += bore + body_h
    qu = quick_union(z, r_bore, r_lub)
    z += 0.36 * r_lub + 2.0
    # wireline valve: block body, two ram levels, tie-rod actuators both sides
    wv_h = 2.6 * bore + 10.0
    bw = 1.9 * bore + 5.0
    bd = 1.3 * bore + 4.0
    body = cq.Workplane("XY").box(bw, bd, wv_h).edges("|Z").fillet(0.08 * bd).translate((0, 0, z + wv_h / 2))
    body = body.cut(cq.Workplane("XY").circle(r_bore).extrude(wv_h + 2).translate((0, 0, z - 1)))
    r_cyl = 0.32 * bore + 1.2
    for zz in (z + 0.3 * wv_h, z + 0.7 * wv_h):
        for sgn in (-1, 1):
            body = body.union(actuator(sgn, zz, r_cyl, 1.4 * bore + 3.0, bw / 2))
        # equalizing port block on the front face
        eq = cq.Workplane("XZ").circle(0.45).extrude(1.2).translate((0, -bd / 2, zz + 0.12 * wv_h))
        body = body.union(eq)
    parts["WL-PCE-WIRELINEVALVE"] = body
    z += wv_h
    qu = qu.union(quick_union(z, r_bore, r_lub))
    z += 0.36 * r_lub + 2.0
    # tool trap: short body with a side-mounted flapper actuator
    tt_h = 1.2 * bore + 4.0
    trap = tube(r_lub + 0.5, r_bore, tt_h, z)
    trap = trap.union(cq.Workplane("XY").box(2.2 * r_lub, 1.5 * r_lub, tt_h * 0.8).translate((0, 0, z + tt_h / 2)).cut(cq.Workplane("XY").circle(r_bore).extrude(tt_h + 2).translate((0, 0, z - 1))))
    trap = trap.union(cq.Workplane("YZ").circle(0.28 * bore + 0.8).extrude(0.8 * bore + 2.5).translate((1.1 * r_lub, 0, z + tt_h / 2)))
    trap = trap.union(cq.Workplane("YZ").circle(0.32 * bore + 1.0).extrude(0.8).translate((1.1 * r_lub + 0.8 * bore + 2.5, 0, z + tt_h / 2)))
    parts["WL-PCE-TOOLTRAP"] = trap
    z += tt_h
    # pump-in sub: tube with a flanged side port (2-1/16 class) toward -X
    pi_h = 1.0 * bore + 4.0
    sub = tube(r_lub, r_bore, pi_h, z)
    nozzle = cq.Workplane("YZ").circle(1.3).extrude(1.6 * r_lub).translate((-1.6 * r_lub - r_lub + 0.5, 0, z + pi_h / 2))
    fl = cq.Workplane("YZ").circle(2.9).extrude(1.0).translate((-1.6 * r_lub - r_lub + 0.5 - 1.0, 0, z + pi_h / 2))
    fl = fl.cut(cq.Workplane("YZ").pushPoints(_bolt_pts(2.2, 8, math.pi / 8)).circle(0.3).extrude(3, both=True).translate((-1.6 * r_lub - r_lub, 0, z + pi_h / 2)))
    sub = sub.union(nozzle).union(fl)
    sub = sub.cut(cq.Workplane("YZ").circle(0.8).extrude(3 * r_lub, both=True).translate((-r_lub, 0, z + pi_h / 2)))
    parts["WL-PCE-PUMPINSUB"] = sub
    z += pi_h
    # ball check valve: bulged body
    bc_h = 0.9 * bore + 3.0
    bc = tube(r_lub + 0.9, r_bore, bc_h, z).edges(">Z or <Z").chamfer(0.6)
    parts["WL-PCE-BALLCHECK"] = bc
    z += bc_h
    qu = qu.union(quick_union(z, r_bore, r_lub))
    z += 0.36 * r_lub + 2.0
    # lubricator sections with lift collars
    lub = None
    sec_h = 96.0
    for i in range(3):
        t = tube(r_lub, r_bore, sec_h, z).union(lift_collar(z + sec_h - 8.0, r_lub))
        lub = t if lub is None else lub.union(t)
        z += sec_h
        qu = qu.union(quick_union(z, r_bore, r_lub))
        z += 0.36 * r_lub + 2.0
    parts["WL-PCE-LUBRICATOR"] = lub
    parts["WL-PCE-QUICKUNION"] = qu
    # tool catcher: short body with a side latch actuator
    tc_h = 1.0 * bore + 3.0
    catcher = tube(r_lub + 0.4, r_bore, tc_h, z)
    catcher = catcher.union(cq.Workplane("YZ").circle(0.2 * bore + 0.6).extrude(0.6 * bore + 1.5).translate((r_lub, 0, z + tc_h / 2)))
    parts["WL-PCE-TOOLCATCHER"] = catcher
    z += tc_h
    # grease injection head: body with three flow tube housings, grease inlet and return ports
    gh_h = 2.4 * bore + 12.0
    head = tube(r_lub - 0.5, 0.9, gh_h, z)
    for k in range(3):
        head = head.union(tube(r_lub + 0.1, 0.9, 2.2, z + 4 + k * (gh_h - 8) / 2))
        port = cq.Workplane("YZ").circle(0.5).extrude(3.0).translate((r_lub - 0.5, 0, z + 5.2 + k * (gh_h - 8) / 2))
        port = port.union(hex_nut(1.3, 0.8).rotate((0, 0, 0), (0, 1, 0), 90).translate((r_lub + 2.5, 0, z + 5.2 + k * (gh_h - 8) / 2)))
        head = head.union(port)
    ret = cq.Workplane("YZ").circle(0.5).extrude(3.0).translate((-r_lub - 2.5, 0, z + gh_h - 4))
    head = head.union(ret)
    parts["WL-PCE-GREASEHEAD"] = head
    z += gh_h
    # line wiper with hydraulic clamp and cable guide bracket
    lw_h = 0.5 * bore + 3.0
    wiper = tube(0.4 * bore + 1.2, 0.5, lw_h, z)
    wiper = wiper.union(cq.Workplane("XY").box(2.0, 1.0, 4.0).translate((0.4 * bore + 1.6, 0, z + lw_h / 2 + 0.5)))
    guide = cq.Workplane("XY").circle(0.55).circle(0.35).extrude(1.0).translate((0, 0, z + lw_h))
    wiper = wiper.union(guide)
    parts["WL-PCE-LINEWIPER"] = wiper
    z += lw_h + 1.0
    return parts, z


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    ap.add_argument("--bore", type=float, default=7.0625)
    ap.add_argument("--rating", type=float, default=15.0)
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    combos = [(5.125, 15.0), (7.0625, 15.0)] if a.all else [(a.bore, a.rating)]
    for bore, rating in combos:
        parts, h = build(bore, rating)
        print(size_key(bore, rating), "stack height in.", round(h, 1))
        export_parts(parts, a.out, "WL-PCE." + size_key(bore, rating), extra_stl=False, tolerance=0.04)
