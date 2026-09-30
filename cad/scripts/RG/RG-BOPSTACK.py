"""
RG-BOPSTACK: cut-away of a generic 7-1/16 in. 5K workover BOP stack on a tubing head: tubing head adapter,
drilling spool with kill and choke side outlets, double ram preventer (pipe rams below, blind rams above) with
bonnets and hydraulic operators, annular preventer with its spherical packing element and piston, and a bell
nipple. Half of everything on the -Y side (the side facing the viewer camera) is cut away so the rams, element, and bores read in the viewer.
Generic proportions of the API 16A family; not an OEM design.

Axes: Z up (well axis), inches. Origin at the tubing head top flange.
Run: python RG-BOPSTACK.py --out ../../out/RG
"""
import argparse
import math
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "WH"))
from _lib import export_parts, ROLE_COLORS, hex_nut  # noqa: E402

ROLE_COLORS.update({"ADAPTER": (0.40, 0.42, 0.46), "SPOOL": (0.30, 0.32, 0.36), "SIDEOUTLET": (0.28, 0.30, 0.34), "RAMBODY": (0.24, 0.26, 0.30),
                    "PIPERAM": (0.62, 0.64, 0.68), "BLINDRAM": (0.55, 0.50, 0.30), "BONNET": (0.30, 0.32, 0.36), "OPERATOR": (0.24, 0.26, 0.30),
                    "ANNULARBODY": (0.24, 0.26, 0.30), "ELEMENT": (0.15, 0.15, 0.15), "PISTON": (0.62, 0.64, 0.68), "BELLNIPPLE": (0.40, 0.42, 0.46),
                    "STUDS": (0.62, 0.64, 0.68), "TUBINGHEAD": (0.34, 0.36, 0.40)})

BORE = 7.0625


def tube_z(od, id_, h, z0):
    return cq.Workplane("XY").circle(od / 2).circle(id_ / 2).extrude(h).translate((0, 0, z0))


def half(s):
    return s.cut(cq.Workplane("XY").box(200, 100, 400).translate((0, -50, 0)))


def flange(od, thk, z0, bore=BORE, n=12, bc=None, bolt=1.125):
    f = cq.Workplane("XY").circle(od / 2).circle(bore / 2).extrude(thk).translate((0, 0, z0))
    bc = bc or od - 2.6 * bolt
    pts = [(bc / 2 * math.cos(2 * math.pi * i / n + math.pi / n), bc / 2 * math.sin(2 * math.pi * i / n + math.pi / n)) for i in range(n)]
    return f.cut(cq.Workplane("XY").pushPoints(pts).circle(bolt / 2 + 0.06).extrude(thk + 2).translate((0, 0, z0 - 1)))


def build():
    parts = {}
    fod, fthk = 21.0, 2.6
    # tubing head top (context) and the adapter
    parts["RG-BOPSTACK-TUBINGHEAD"] = half(tube_z(18.0, BORE, 10.0, -10.0).union(flange(fod, fthk, -2.6)))
    z = 0.0
    ad = flange(fod, fthk, z).union(tube_z(12.0, BORE, 6.0, z + fthk)).union(flange(fod, fthk, z + fthk + 6.0))
    parts["RG-BOPSTACK-ADAPTER"] = half(ad)
    z += 2 * fthk + 6.0
    # drilling spool with two side outlets (kill and choke), flanged
    sp = flange(fod, fthk, z).union(tube_z(12.5, BORE, 16.0, z + fthk)).union(flange(fod, fthk, z + fthk + 16.0))
    parts["RG-BOPSTACK-SPOOL"] = half(sp)
    so = None
    for sgn in (1, -1):
        o = cq.Workplane("YZ").circle(3.4).circle(2.06).extrude(sgn * 12.0).translate((sgn * 6.0, 0, z + fthk + 8.0))
        o = o.union(cq.Workplane("YZ").circle(6.0).circle(2.06).extrude(sgn * 1.8).translate((sgn * 16.2, 0, z + fthk + 8.0)))
        so = o if so is None else so.union(o)
    parts["RG-BOPSTACK-SIDEOUTLET"] = half(so)
    z += 2 * fthk + 16.0
    # double ram preventer: body with two ram cavities, bonnets and operators each side
    body_h = 40.0
    rb = cq.Workplane("XY").box(26.0, 22.0, body_h).edges("|Z").fillet(2.0).translate((0, 0, z + body_h / 2))
    rb = rb.cut(cq.Workplane("XY").circle(BORE / 2).extrude(body_h + 2).translate((0, 0, z - 1)))
    for zc in (z + 12.0, z + 28.0):
        rb = rb.cut(cq.Workplane("YZ").rect(9.0, 8.0).extrude(40, both=True).translate((0, 0, zc)))   # ram cavities through
    rb = rb.union(flange(fod, fthk, z - 0.01)).union(flange(fod, fthk, z + body_h - fthk + 0.01))
    parts["RG-BOPSTACK-RAMBODY"] = half(rb)
    # pipe rams (lower) closed on a 2-7/8 tubing profile, blind rams (upper) open
    pr = None; br = None; bon = None; op = None
    for sgn in (1, -1):
        p = cq.Workplane("XY").box(7.0, 8.6, 7.6).translate((sgn * (3.5 + 1.0), 0, z + 12.0))
        p = p.cut(cq.Workplane("XY").circle(1.45).extrude(10).translate((0, 0, z + 7.0)))
        p = p.union(cq.Workplane("XY").box(0.6, 8.6, 7.6).translate((sgn * 1.2, 0, z + 12.0)).cut(cq.Workplane("XY").circle(1.45).extrude(10).translate((0, 0, z + 7.0))))
        pr = p if pr is None else pr.union(p)
        b = cq.Workplane("XY").box(7.0, 8.6, 7.6).translate((sgn * (3.5 + 6.5), 0, z + 28.0))
        br = b if br is None else br.union(b)
        bn = cq.Workplane("YZ").rect(20.0, 16.0).extrude(sgn * 4.0).translate((sgn * 13.0, 0, z + 12.0))
        bn = bn.union(cq.Workplane("YZ").rect(20.0, 16.0).extrude(sgn * 4.0).translate((sgn * 13.0, 0, z + 28.0)))
        for zc in (z + 12.0, z + 28.0):
            for (yy, zz) in ((-7.5, -5.5), (7.5, -5.5), (-7.5, 5.5), (7.5, 5.5)):
                bn = bn.union(hex_nut(1.6, 1.2).rotate((0, 0, 0), (0, 1, 0), 90 * sgn).translate((sgn * 17.2, yy, zc + zz)))
        bon = bn if bon is None else bon.union(bn)
        for zc in (z + 12.0, z + 28.0):
            cyl = cq.Workplane("YZ").circle(6.5).extrude(sgn * 18.0).translate((sgn * 17.0, 0, zc))
            cyl = cyl.union(cq.Workplane("YZ").circle(2.0).extrude(sgn * 14.0).translate((sgn * 3.0, 0, zc)))      # operating rod
            cyl = cyl.union(cq.Workplane("YZ").circle(2.6).extrude(sgn * 6.0).translate((sgn * 35.0, 0, zc)))     # tail rod housing
            op = cyl if op is None else op.union(cyl)
    parts["RG-BOPSTACK-PIPERAM"] = half(pr)
    parts["RG-BOPSTACK-BLINDRAM"] = half(br)
    parts["RG-BOPSTACK-BONNET"] = half(bon)
    parts["RG-BOPSTACK-OPERATOR"] = half(op)
    z += body_h
    # annular preventer: body, piston, and the spherical packing element
    ah = 34.0
    ab = cq.Workplane("XY").circle(14.0).extrude(ah - 6.0).translate((0, 0, z))
    ab = ab.union(cq.Workplane("XY").workplane(offset=z + ah - 6.0).circle(14.0).workplane(offset=6.0).circle(9.0).loft())
    ab = ab.cut(cq.Workplane("XY").circle(11.5).extrude(ah - 8.0).translate((0, 0, z + 2.0)))   # piston chamber
    ab = ab.cut(cq.Workplane("XY").circle(BORE / 2).extrude(ah + 2).translate((0, 0, z - 1)))
    ab = ab.union(flange(fod, fthk, z - 0.01))
    parts["RG-BOPSTACK-ANNULARBODY"] = half(ab)
    piston = tube_z(23.0, BORE + 2.0, 12.0, z + 3.0).union(cq.Workplane("XY").workplane(offset=z + 15.0).circle(11.5).circle(BORE / 2 + 1.0).extrude(6.0))
    parts["RG-BOPSTACK-PISTON"] = half(piston)
    elem = cq.Workplane("XY").workplane(offset=z + 15.0).circle(10.5).circle(BORE / 2).workplane(offset=10.0).circle(8.0).circle(BORE / 2 + 0.5).loft(ruled=True)
    parts["RG-BOPSTACK-ELEMENT"] = half(elem)
    z += ah
    bell = tube_z(12.0, BORE + 2.0, 20.0, z).union(cq.Workplane("XY").workplane(offset=z + 20.0).circle(6.0).workplane(offset=6.0).circle(8.5).loft().cut(tube_z(20, BORE, 8, z + 19)))
    bell = bell.union(cq.Workplane("YZ").circle(2.5).circle(2.0).extrude(-14.0).translate((-5.5, 0, z + 12.0)))   # flowline nipple
    parts["RG-BOPSTACK-BELLNIPPLE"] = half(bell)
    # stud sets on the flanges (one node)
    studs = None
    for zf in (0.0, 2 * fthk + 6.0, 2 * (2 * fthk + 6.0) + 0.0):
        pass
    for zf in (-2.6, 2.6 + 6.0, 2 * 2.6 + 6.0 + 2.6 + 16.0, 2 * 2.6 + 6.0 + 2 * 2.6 + 16.0 + 40.0 - 2.6):
        bc = fod - 2.6 * 1.125
        for i in range(12):
            a = 2 * math.pi * i / 12 + math.pi / 12
            st = cq.Workplane("XY").circle(0.56).extrude(2 * fthk + 2.4).translate((bc / 2 * math.cos(a), bc / 2 * math.sin(a), zf - 1.2))
            studs = st if studs is None else studs.union(st)
    parts["RG-BOPSTACK-STUDS"] = half(studs)
    return parts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    export_parts(build(), a.out, "RG-BOPSTACK", extra_stl=False, tolerance=0.05)
