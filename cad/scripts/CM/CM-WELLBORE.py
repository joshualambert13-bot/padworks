"""
CM-WELLBORE: schematic cut-away of the cased vertical wellbore, not to scale in depth: conductor,
surface casing, intermediate casing, and production casing nested with their cement sheaths,
each string ending in a float collar and guide shoe with centralizers above the shoe, inside a
translucent formation cylinder. Depth is compressed so every string is visible in one view;
diameters are public nominal casing sizes (20, 13-3/8, 9-5/8, 5-1/2 in.).
Vertical along Z with the wellhead at the top (z = 0) and depth downward.

Run: python CM-WELLBORE.py --out ../../out/CM
"""
import argparse
import math
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "WH"))
from _lib import export_parts, ROLE_COLORS  # noqa: E402

ROLE_COLORS.update({"FORMATION": (0.45, 0.38, 0.28), "CONDUCTOR": (0.30, 0.32, 0.36), "SURFACECASING": (0.34, 0.36, 0.40),
                    "INTERMEDIATECASING": (0.38, 0.40, 0.44), "PRODUCTIONCASING": (0.42, 0.44, 0.48), "CEMENT": (0.80, 0.78, 0.70),
                    "SHOE": (0.55, 0.50, 0.30), "FLOATCOLLAR": (0.55, 0.50, 0.30), "CENTRALIZER": (0.70, 0.72, 0.76), "WELLHEAD": (0.26, 0.28, 0.32)})

# (name, OD in., wall in., schematic depth in., hole OD in.)
STRINGS = [
    ("CONDUCTOR", 20.0, 0.5, 40.0, 26.0),
    ("SURFACECASING", 13.375, 0.48, 110.0, 17.5),
    ("INTERMEDIATECASING", 9.625, 0.47, 200.0, 12.25),
    ("PRODUCTIONCASING", 5.5, 0.36, 300.0, 8.5),
]


def tube(r_out, r_in, h, z_top):
    return cq.Workplane("XY").circle(r_out).circle(r_in).extrude(-h).translate((0, 0, z_top))


def build():
    parts = {}
    total = STRINGS[-1][3] + 20.0
    formation = cq.Workplane("XY").circle(24.0).extrude(-total).translate((0, 0, 0))
    formation = formation.cut(cq.Workplane("XY").circle(STRINGS[0][4] / 2).extrude(-(STRINGS[0][3] + 1)).translate((0, 0, 1)))
    for (n, od, wall, depth, hole) in STRINGS[1:]:
        formation = formation.cut(cq.Workplane("XY").circle(hole / 2).extrude(-(depth + 1)).translate((0, 0, 1)))
    parts["CM-WELLBORE-FORMATION"] = formation
    cement = None
    shoes = None
    collars = None
    cents = None
    for i, (n, od, wall, depth, hole) in enumerate(STRINGS):
        r_o, r_i = od / 2, od / 2 - wall
        casing = tube(r_o, r_i, depth - 3.0, 0.0)
        # collars (couplings) every 30 in. schematic
        for k in range(1, int(depth // 30)):
            casing = casing.union(tube(r_o + 0.35, r_o - 0.01, 2.0, -k * 30.0))
        parts["CM-WELLBORE-" + n] = casing
        # guide shoe: rounded nose with a bore
        shoe = cq.Workplane("XY").workplane(offset=-(depth - 3.0)).circle(r_o).workplane(offset=-3.0).circle(0.45 * r_o).loft()
        shoe = shoe.cut(cq.Workplane("XY").circle(0.35 * r_i).extrude(-5).translate((0, 0, -(depth - 4)))) if i > 0 else shoe
        shoes = shoe if shoes is None else shoes.union(shoe)
        # float collar one joint above the shoe (all but the conductor)
        if i > 0:
            fc = tube(r_i + 0.01, 0.3 * r_i, 4.0, -(depth - 12.0))
            fc = fc.union(cq.Workplane("XY").sphere(0.3 * r_i).translate((0, 0, -(depth - 14.5))))
            collars = fc if collars is None else collars.union(fc)
            # bow-spring centralizers above the shoe and at the previous shoe
            for zc in (-(depth - 8.0), -(depth - 40.0)):
                cen = tube(r_o + 0.25, r_o + 0.01, 6.0, zc + 3.0)
                for b in range(6):
                    bow = cq.Workplane("XY").box(0.45, 0.25, 7.0).translate(((r_o + hole / 2) / 2 + 0.2, 0, zc)).rotate((0, 0, 0), (0, 0, 1), b * 60)
                    cen = cen.union(bow)
                cents = cen if cents is None else cents.union(cen)
        # cement sheath: annulus between casing OD and hole from the shoe up to the schematic top of cement
        toc = 0.0 if i < 2 else depth * 0.45
        sheath = tube(hole / 2 - 0.02, r_o + 0.02, depth - toc - 3.0, -toc)
        cement = sheath if cement is None else cement.union(sheath)
    parts["CM-WELLBORE-CEMENT"] = cement
    parts["CM-WELLBORE-SHOE"] = shoes
    parts["CM-WELLBORE-FLOATCOLLAR"] = collars
    parts["CM-WELLBORE-CENTRALIZER"] = cents
    # wellhead stub at surface: casing head and spools schematic
    wh = cq.Workplane("XY").circle(11.0).extrude(10.0).union(cq.Workplane("XY").circle(9.0).extrude(10.0).translate((0, 0, 10.0)))
    wh = wh.union(cq.Workplane("XY").circle(13.0).extrude(1.5).translate((0, 0, 9.0))).union(cq.Workplane("XY").circle(11.0).extrude(1.5).translate((0, 0, 19.0)))
    wh = wh.cut(cq.Workplane("XY").circle(STRINGS[-1][1] / 2 - STRINGS[-1][2]).extrude(30).translate((0, 0, -5)))
    parts["CM-WELLBORE-WELLHEAD"] = wh
    return parts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    export_parts(build(), a.out, "CM-WELLBORE", extra_stl=False, tolerance=0.05)
