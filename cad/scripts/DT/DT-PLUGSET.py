"""
DT-PLUGSET: generic composite frac plug on a wireline setting tool inside a section of 5-1/2 in.
casing, shown at the moment the plug is set (slips out, element compressed, shear released).
Bottom to top: casing (half cut away by the viewer section), plug mandrel with lower slips, lower
cone, element, upper cone, upper slips, ball seat, ball; above it the setting sleeve and tension
mandrel of the adapter kit, then the pressure setting assembly body. Generic proportions from
public descriptions of plug-and-perf plugs; not a manufacturer's design. Vertical along Z.

Run: python DT-PLUGSET.py --out ../../out/DT
"""
import argparse
import math
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "WH"))
from _lib import export_parts, ROLE_COLORS  # noqa: E402

ROLE_COLORS.update({
    "CASING": (0.30, 0.32, 0.36), "MANDREL": (0.42, 0.30, 0.22), "CONEUP": (0.55, 0.40, 0.28), "CONEDOWN": (0.55, 0.40, 0.28),
    "SLIPSUP": (0.62, 0.64, 0.68), "SLIPSDOWN": (0.62, 0.64, 0.68), "ELEMENT": (0.12, 0.12, 0.13), "BALLSEAT": (0.55, 0.40, 0.28),
    "BALL": (0.80, 0.78, 0.70), "SLEEVE": (0.30, 0.32, 0.36), "ROD": (0.70, 0.72, 0.76), "BODY": (0.30, 0.32, 0.36), "SHEAR": (0.75, 0.70, 0.45),
})

CASING_OD, CASING_ID = 5.50, 4.778     # 5-1/2 in. 20 lb/ft class, public dimension
PLUG_OD = 4.375                        # run-in OD, public example value
MAND_OD, MAND_ID = 2.6, 1.9


def ring(od, id_, h, z):
    return cq.Workplane("XY").circle(od / 2).circle(id_ / 2).extrude(h).translate((0, 0, z))


def cone(d_small, d_big, h, z, id_, up=True):
    a = cq.Workplane("XY").workplane(offset=z).circle((d_small if up else d_big) / 2).workplane(offset=h).circle((d_big if up else d_small) / 2).loft()
    return a.cut(cq.Workplane("XY").circle(id_ / 2).extrude(h + 2).translate((0, 0, z - 1)))


def slips(z, h, d_out, id_, up=True, n=6):
    """Segmented slip ring riding a cone: wedge segments with carbide buttons, expanded to the casing wall."""
    body = cone(d_out - 1.2, d_out, h, z, id_, up=not up)
    # slots between segments
    for i in range(n):
        slot = cq.Workplane("XY").box(d_out, 0.18, h + 1).translate((d_out / 2, 0, z + h / 2)).rotate((0, 0, 0), (0, 0, 1), i * 360 / n + 30)
        body = body.cut(slot)
    # wickers: three shallow grooves around the outside
    for k in range(3):
        g = ring(d_out + 0.2, d_out - 0.16, 0.12, z + h * (0.25 + 0.22 * k))
        body = body.cut(g)
    # carbide buttons
    for i in range(n):
        for k in range(2):
            ang = math.radians(i * 360 / n)
            r = d_out / 2 - 0.05
            btn = cq.Workplane("XY").circle(0.16).extrude(0.14).rotate((0, 0, 0), (0, 1, 0), 90).translate((r, 0, z + h * (0.35 + 0.3 * k))).rotate((0, 0, 0), (0, 0, 1), i * 360 / n)
            body = body.union(btn)
    return body


def build():
    parts = {}
    z0 = 0.0
    # casing section: 60 in. long, plug in the middle
    cas_h = 76.0
    parts["DT-PLUGSET-CASING"] = ring(CASING_OD, CASING_ID, cas_h, z0)
    # plug (set): from bottom
    z = 10.0
    mand_h = 22.0
    mandrel = ring(MAND_OD, MAND_ID, mand_h, z)
    # lower mule shoe / guide
    guide = cq.Workplane("XY").workplane(offset=z - 2.0).circle(MAND_OD / 2 - 0.3).workplane(offset=2.0).circle(3.2 / 2).loft()
    guide = guide.cut(cq.Workplane("XY").circle(MAND_ID / 2).extrude(4).translate((0, 0, z - 3)))
    mandrel = mandrel.union(guide)
    parts["DT-FRACPLUG-MANDREL"] = mandrel
    # lower slips on the lower cone
    ls_h = 3.2
    parts["DT-FRACPLUG-SLIPSDOWN"] = slips(z + 0.8, ls_h, CASING_ID - 0.02, MAND_OD + 0.05, up=False)
    zc = z + 0.8 + ls_h
    parts["DT-FRACPLUG-CONEDOWN"] = cone(MAND_OD + 0.4, PLUG_OD - 0.2, 2.6, zc, MAND_OD + 0.05, up=False)
    # element, compressed against the casing
    ze = zc + 2.6
    el_h = 4.0
    el = ring(CASING_ID - 0.02, MAND_OD + 0.05, el_h, ze)
    for k in range(2):
        el = el.cut(ring(CASING_ID + 0.2, CASING_ID - 0.5, 0.35, ze + 0.9 + 1.8 * k))
    parts["DT-FRACPLUG-ELEMENT"] = el
    zu = ze + el_h
    parts["DT-FRACPLUG-CONEUP"] = cone(MAND_OD + 0.4, PLUG_OD - 0.2, 2.6, zu, MAND_OD + 0.05, up=True)
    parts["DT-FRACPLUG-SLIPSUP"] = slips(zu + 2.6, ls_h, CASING_ID - 0.02, MAND_OD + 0.05, up=True)
    # ball seat at the top of the mandrel
    zs = z + mand_h - 2.4
    seat = cq.Workplane("XY").workplane(offset=zs).circle(MAND_OD / 2 + 0.15).workplane(offset=2.4).circle(MAND_OD / 2 + 0.15).loft()
    seat = seat.cut(cq.Workplane("XY").workplane(offset=zs - 0.1).circle(MAND_ID / 2).workplane(offset=2.6).circle(MAND_ID / 2 + 0.55).loft())
    parts["DT-FRACPLUG-BALLSEAT"] = seat
    # ball resting on the seat
    rb = (MAND_ID / 2 + 0.55) * 1.05
    parts["DT-FRACPLUG-BALL"] = cq.Workplane("XY").sphere(rb).translate((0, 0, zs + 2.4 + rb * 0.55))
    # setting tool adapter kit: setting sleeve around the top of the plug, tension rod inside (sheared)
    zt = z + mand_h + 1.0
    sleeve_h = 9.0
    sleeve = ring(PLUG_OD - 0.4, MAND_OD + 0.5, sleeve_h, zt)
    sleeve = sleeve.union(ring(PLUG_OD - 0.4, 2.2, 1.5, zt + sleeve_h))
    parts["DT-SETTINGTOOL-SLEEVE"] = sleeve
    rod = cq.Workplane("XY").circle(0.9).extrude(sleeve_h + 4.0).translate((0, 0, zt + 0.5))
    shear = ring(1.5, 0.9, 0.6, zt + 0.6)
    parts["DT-SETTINGTOOL-ROD"] = rod
    parts["DT-SETTINGTOOL-SHEAR"] = shear
    # pressure setting assembly body above the sleeve
    zb = zt + sleeve_h + 1.5
    body_h = 16.0
    body = cq.Workplane("XY").circle(3.6 / 2).extrude(body_h).translate((0, 0, zb))
    body = body.union(cq.Workplane("XY").circle(3.1 / 2).extrude(2.0).translate((0, 0, zb + body_h)))
    body = body.cut(cq.Workplane("XY").circle(0.6).extrude(body_h + 3).translate((0, 0, zb - 0.5)))
    for k in range(4):
        body = body.cut(cq.Workplane("YZ").circle(0.25).extrude(4, both=True).translate((0, 0, zb + 3 + 3 * k)).rotate((0, 0, 0), (0, 0, 1), 90 * k))
    parts["DT-SETTINGTOOL-BODY"] = body
    return parts, cas_h


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    parts, h = build()
    export_parts(parts, a.out, "DT-PLUGSET", extra_stl=False, tolerance=0.015)
