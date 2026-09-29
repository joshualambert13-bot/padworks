"""
PP-MISSILE: generic frac manifold trailer ("missile"), six pump positions per side. Low-pressure side: two
suction headers along the outer edges of the deck, each with an outlet per pump (butterfly valve and hose
stub). High-pressure side: a discharge header down the middle built from junction fittings joined by flanged
spools; each fitting has a radial feed port each side with a check valve and a swivel-arm stub to the pump.
A pressure transducer and the pressure relief valve with its vent line sit on the header near the outlet
flange at the front. Deck, gooseneck, axles, and walkway are schematic. Generic geometry; proportions only.

Axes: X along the trailer (front at +X), Y across, Z up. Inches.
Run: python PP-MISSILE.py --out ../../out/PP
"""
import argparse
import math
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "WH"))
from _lib import export_parts, ROLE_COLORS, hex_nut  # noqa: E402

ROLE_COLORS.update({"DECK": (0.30, 0.32, 0.36), "LPHEADER": (0.55, 0.58, 0.62), "LPOUTLET": (0.55, 0.58, 0.62), "HPHEADER": (0.24, 0.26, 0.30),
                    "CHECKVALVE": (0.30, 0.32, 0.36), "SWIVELARM": (0.64, 0.15, 0.11), "TRANSDUCER": (0.20, 0.35, 0.60), "PRV": (0.55, 0.50, 0.30),
                    "OUTLET": (0.24, 0.26, 0.30), "AXLES": (0.10, 0.10, 0.11), "WALKWAY": (0.40, 0.42, 0.46)})

PER_SIDE = 6
PITCH = 140.0          # pump-to-pump along the trailer


def ring(od, id_, thk):
    return cq.Workplane("XY").circle(od / 2).circle(id_ / 2).extrude(thk)


def build():
    parts = {}
    n = PER_SIDE
    length = n * PITCH + 140.0
    width = 102.0
    deck_z = 48.0
    xs = [(i - (n - 1) / 2) * PITCH for i in range(n)]
    # deck: main beams, cross members, gooseneck at the front, landing legs
    deck = cq.Workplane("XY").box(length, width, 6).translate((0, 0, deck_z - 3))
    for y in (-30, 30):
        deck = deck.union(cq.Workplane("XY").box(length - 20, 8, 18).translate((0, y, deck_z - 15)))
    for x in xs:
        deck = deck.union(cq.Workplane("XY").box(6, width - 4, 12).translate((x, 0, deck_z - 12)))
    neck = cq.Workplane("XY").box(90, 40, 10).translate((length / 2 + 40, 0, deck_z + 8))
    deck = deck.union(neck).union(cq.Workplane("XY").box(20, 40, 16).translate((length / 2 + 2, 0, deck_z + 2)))
    for y in (-34, 34):
        deck = deck.union(cq.Workplane("XY").box(6, 6, deck_z - 8).translate((length / 2 - 60, y, (deck_z - 8) / 2)))
    parts["PP-MISSILE-DECK"] = deck
    # axles and wheels at the rear
    axles = None
    for x in (-length / 2 + 40, -length / 2 + 90, -length / 2 + 140):
        a = cq.Workplane("YZ").circle(3.0).extrude(width + 10, both=True).translate((x, 0, 20))
        for y in (-width / 2 - 2, width / 2 + 2):
            w = cq.Workplane("YZ").circle(20).extrude(16, both=True).translate((x, y, 20))
            a = a.union(w)
        axles = a if axles is None else axles.union(a)
    parts["PP-MISSILE-AXLES"] = axles
    # low-pressure suction headers (10 in. OD) along both edges with outlets
    lp = None; lpo = None
    lp_od, lp_z, lp_y = 10.0, deck_z + 18.0, width / 2 - 8.0
    for side in (-1, 1):
        h = cq.Workplane("YZ").circle(lp_od / 2).extrude(length - 60).translate((-(length - 60) / 2 - 10, side * lp_y, lp_z))
        h = h.union(ring(lp_od + 4, lp_od - 1, 2.0).rotate((0, 0, 0), (0, 1, 0), 90).translate((-(length - 60) / 2 - 10, side * lp_y, lp_z)))
        for x in xs:
            h = h.union(cq.Workplane("XY").box(6, 6, lp_z - lp_od / 2 - deck_z).translate((x + 50, side * lp_y, deck_z + (lp_z - lp_od / 2 - deck_z) / 2)))
        lp = h if lp is None else lp.union(h)
        for x in xs:
            o = cq.Workplane("XZ").circle(3.0).extrude(-14.0 if side > 0 else 14.0).translate((x, side * lp_y, lp_z))
            o = o.union(ring(9.0, 5.5, 2.0).rotate((0, 0, 0), (1, 0, 0), 90).translate((x, side * (lp_y + 14.0), lp_z)))
            o = o.union(cq.Workplane("XY").box(1.2, 1.2, 8.0).translate((x, side * (lp_y + 14.0), lp_z + 5.0)))   # butterfly handle
            o = o.union(cq.Workplane("XZ").circle(3.0).extrude(-10.0 if side > 0 else 10.0).translate((x, side * (lp_y + 16.0), lp_z)))
            lpo = o if lpo is None else lpo.union(o)
    parts["PP-MISSILE-LPHEADER"] = lp
    parts["PP-MISSILE-LPOUTLET"] = lpo
    # high-pressure header: junction fittings with flanged spools between them
    hp_z = deck_z + 34.0
    fit = 26.0
    hp = None
    for i, x in enumerate(xs):
        f = cq.Workplane("XY").box(fit, fit, fit).edges().fillet(2.0).translate((x, 0, hp_z))
        f = f.union(ring(24.0, 7.0, 3.0).rotate((0, 0, 0), (0, 1, 0), 90).translate((x + fit / 2, 0, hp_z)))
        f = f.union(ring(24.0, 7.0, 3.0).rotate((0, 0, 0), (0, 1, 0), 90).translate((x - fit / 2 - 3.0, 0, hp_z)))
        if i < n - 1:
            f = f.union(cq.Workplane("YZ").circle(8.0).extrude(PITCH - fit - 6.0).translate((x + fit / 2 + 3.0, 0, hp_z)))
            f = f.union(ring(24.0, 7.0, 3.0).rotate((0, 0, 0), (0, 1, 0), 90).translate((x + PITCH - fit / 2 - 6.0, 0, hp_z)))
        hp = f if hp is None else hp.union(f)
        # header supports
        hp = hp.union(cq.Workplane("XY").box(8, 8, hp_z - fit / 2 - deck_z).translate((x, 0, deck_z + (hp_z - fit / 2 - deck_z) / 2)))
    # outlet spool at the front with a flange
    x_last = xs[-1]
    out = cq.Workplane("YZ").circle(8.0).extrude(50.0).translate((x_last + fit / 2 + 3.0, 0, hp_z))
    out = out.union(ring(26.0, 7.0, 3.5).rotate((0, 0, 0), (0, 1, 0), 90).translate((x_last + fit / 2 + 50.0, 0, hp_z)))
    parts["PP-MISSILE-HPHEADER"] = hp
    parts["PP-MISSILE-OUTLET"] = out
    # feed ports: check valve body and swivel-arm stub each side of each fitting
    cv = None; arm = None
    for x in xs:
        for side in (-1, 1):
            body = cq.Workplane("XZ").circle(5.5).extrude(-16.0 if side > 0 else 16.0).translate((x, side * fit / 2, hp_z))
            body = body.union(cq.Workplane("XZ").circle(7.5).extrude(-6.0 if side > 0 else 6.0).translate((x, side * (fit / 2 + 16.0), hp_z)))
            body = body.union(cq.Workplane("XY").box(6, 6, 6).translate((x, side * (fit / 2 + 8.0), hp_z + 7.0)))   # clapper cap
            cv = body if cv is None else cv.union(body)
            y0 = side * (fit / 2 + 22.0)
            a = cq.Workplane("XZ").circle(3.0).extrude(-14.0 if side > 0 else 14.0).translate((x, y0, hp_z))
            a = a.union(cq.Workplane("XZ").circle(4.6).extrude(-5.0 if side > 0 else 5.0).translate((x, y0 + side * 14.0, hp_z)))
            a = a.union(cq.Workplane("XZ").circle(4.6).extrude(-5.0 if side > 0 else 5.0).translate((x, y0 + side * 2.0, hp_z)))
            arm = a if arm is None else arm.union(a)
    parts["PP-MISSILE-CHECKVALVE"] = cv
    parts["PP-MISSILE-SWIVELARM"] = arm
    # transducer on the header and the relief valve with its vent line down and out to the rear
    tr = cq.Workplane("XY").box(5, 5, 8).translate((x_last + fit / 2 + 12.0, 0, hp_z + 12.0))
    tr = tr.union(cq.Workplane("XY").circle(1.5).extrude(4.0).translate((x_last + fit / 2 + 12.0, 0, hp_z + 8.0)))
    parts["PP-MISSILE-TRANSDUCER"] = tr
    px = x_last + fit / 2 + 30.0
    prv = cq.Workplane("XY").circle(4.5).extrude(16.0).translate((px, 0, hp_z + 8.0))
    prv = prv.union(cq.Workplane("XY").circle(6.5).extrude(10.0).translate((px, 0, hp_z + 24.0)))
    prv = prv.union(hex_nut(8.0, 3.0).translate((px, 0, hp_z + 34.0)))
    vent = cq.Workplane("XZ").circle(2.0).extrude(-30.0).translate((px, 0, hp_z + 20.0))
    vent = vent.union(cq.Workplane("XY").circle(2.0).extrude(-(hp_z + 20.0 - 12.0)).translate((px, 30.0, hp_z + 20.0)))
    vent = vent.union(cq.Workplane("XZ").circle(2.0).extrude(-90.0).translate((px, 30.0, 12.0)))
    parts["PP-MISSILE-PRV"] = prv.union(vent)
    # walkway grating and handrail posts down one side of the header
    walk = cq.Workplane("XY").box(length - 80, 22, 1.5).translate((0, -22, deck_z + 1))
    for x in xs:
        walk = walk.union(cq.Workplane("XY").circle(1.0).extrude(42).translate((x + 70, -34, deck_z)))
    walk = walk.union(cq.Workplane("YZ").circle(1.0).extrude(length - 100).translate((-(length - 100) / 2, -34, deck_z + 42)))
    parts["PP-MISSILE-WALKWAY"] = walk
    return parts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    export_parts(build(), a.out, "PP-MISSILE", extra_stl=False, tolerance=0.08)
