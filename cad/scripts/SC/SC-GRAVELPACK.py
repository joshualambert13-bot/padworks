"""
SC-GRAVELPACK: cut-away of a generic cased-hole gravel pack across a perforated interval in 7 in. casing:
gravel pack packer with the crossover ports below it, blank pipe, wire-wrapped screen on a perforated base
pipe, gravel filling the screen-to-casing annulus and the perforation tunnels, sump packer with the seal
assembly at the bottom, and the washpipe inside the screen as ghost context. Casing and formation are ghost
context. Half of everything on the -Y side (the side facing the viewer camera) is cut away. Generic proportions; not an OEM design.

Axes: Z up (well axis), inches. Origin at the top of the screen.
Run: python SC-GRAVELPACK.py --out ../../out/SC
"""
import argparse
import math
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "WH"))
from _lib import export_parts, ROLE_COLORS  # noqa: E402

ROLE_COLORS.update({"CASING": (0.42, 0.44, 0.48), "FORMATION": (0.45, 0.38, 0.28), "GPPACKER": (0.55, 0.50, 0.30), "CROSSOVER": (0.34, 0.36, 0.40),
                    "BLANKPIPE": (0.62, 0.64, 0.68), "SCREEN": (0.70, 0.72, 0.76), "BASEPIPE": (0.50, 0.52, 0.56), "GRAVEL": (0.80, 0.72, 0.50),
                    "SUMPPACKER": (0.55, 0.50, 0.30), "WASHPIPE": (0.62, 0.64, 0.68), "SEALASSEMBLY": (0.15, 0.15, 0.15)})

CSG_OD, CSG_ID = 7.0, 6.276


def tube_z(od, id_, h, z0):
    return cq.Workplane("XY").circle(od / 2).circle(id_ / 2).extrude(h).translate((0, 0, z0))


def half(s):
    return s.cut(cq.Workplane("XY").box(60, 60, 800).translate((0, -30, 0)))


def build():
    parts = {}
    scr_len = 120.0
    z_scr_top = 0.0
    z_scr_bot = -scr_len
    # perforated interval: holes through the casing and cement into the formation, 90 degree phasing, 4 spf schematic
    casing = tube_z(CSG_OD, CSG_ID, 320.0, -220.0)
    formation = tube_z(20.0, CSG_OD + 1.0, 320.0, -220.0)
    cement = tube_z(CSG_OD + 1.0, CSG_OD, 320.0, -220.0)
    tunnels = None
    for k in range(int(scr_len // 6)):
        z = z_scr_bot + 10.0 + k * 6.0
        t = cq.Workplane("YZ").circle(0.45).extrude(9.0).translate((CSG_ID / 2 - 0.5, 0, z)).rotate((0, 0, 0), (0, 0, 1), (k % 4) * 90 + 45)
        tunnels = t if tunnels is None else tunnels.union(t)
    casing = casing.cut(tunnels); cement = cement.cut(tunnels); formation = formation.cut(tunnels)
    parts["SC-GRAVELPACK-CASING"] = half(casing.union(cement))
    parts["SC-GRAVELPACK-FORMATION"] = half(formation)
    # gravel pack packer above the blank with the crossover ports below it
    z_pk = z_scr_top + 60.0
    pk = tube_z(CSG_ID - 0.05, 3.0, 14.0, z_pk).union(tube_z(5.6, 3.0, 8.0, z_pk + 14.0)).union(tube_z(5.6, 3.0, 8.0, z_pk - 8.0))
    parts["SC-GRAVELPACK-GPPACKER"] = half(pk)
    xo = tube_z(4.5, 2.8, 26.0, z_pk - 34.0)
    for k in range(4):
        xo = xo.cut(cq.Workplane("YZ").circle(0.7).extrude(6.0, both=True).translate((2.2, 0, z_pk - 22.0)).rotate((0, 0, 0), (0, 0, 1), k * 90))
    parts["SC-GRAVELPACK-CROSSOVER"] = half(xo)
    # blank pipe between the crossover and the screen
    parts["SC-GRAVELPACK-BLANKPIPE"] = half(tube_z(4.0, 3.4, 34.0, z_scr_top))
    # screen: perforated base pipe with a wire wrap represented by closely spaced rings on ribs
    base = tube_z(3.5, 3.0, scr_len, z_scr_bot)
    holes = None
    for k in range(int(scr_len // 4)):
        for j in range(4):
            h = cq.Workplane("YZ").circle(0.2).extrude(3.0, both=True).translate((1.75, 0, z_scr_bot + 2.0 + k * 4.0)).rotate((0, 0, 0), (0, 0, 1), j * 90 + (k % 2) * 45)
            holes = h if holes is None else holes.union(h)
    parts["SC-GRAVELPACK-BASEPIPE"] = half(base.cut(holes))
    wrap = None
    for k in range(int(scr_len // 1.2)):
        r = tube_z(4.2, 3.9, 0.7, z_scr_bot + 1.0 + k * 1.2)
        wrap = r if wrap is None else wrap.union(r)
    for j in range(12):
        rib = cq.Workplane("XY").box(0.35, 0.3, scr_len - 2.0).translate((1.85, 0, z_scr_bot + scr_len / 2)).rotate((0, 0, 0), (0, 0, 1), j * 30)
        wrap = wrap.union(rib)
    wrap = wrap.union(tube_z(4.3, 3.4, 3.0, z_scr_bot)).union(tube_z(4.3, 3.4, 3.0, z_scr_top - 3.0))   # end rings
    parts["SC-GRAVELPACK-SCREEN"] = half(wrap)
    # gravel: annulus between the screen and the casing over the interval, up past the blank a little, and in the tunnels
    gravel = tube_z(CSG_ID - 0.02, 4.25, scr_len + 30.0, z_scr_bot - 6.0)
    gravel = gravel.union(tunnels.intersect(tube_z(CSG_OD + 9.0, CSG_ID / 2 * 2 - 0.1, 320.0, -220.0)))
    parts["SC-GRAVELPACK-GRAVEL"] = half(gravel)
    # sump packer at the bottom with the seal assembly of the screen tail stabbed into it
    z_sp = z_scr_bot - 24.0
    sp = tube_z(CSG_ID - 0.05, 3.0, 12.0, z_sp).union(tube_z(5.6, 3.0, 6.0, z_sp - 6.0)).union(tube_z(5.6, 3.0, 6.0, z_sp + 12.0))
    parts["SC-GRAVELPACK-SUMPPACKER"] = half(sp)
    seal = tube_z(3.0, 2.4, 20.0, z_sp - 2.0)
    for k in range(5):
        seal = seal.union(tube_z(3.15, 2.9, 1.0, z_sp + 1.0 + k * 3.0))
    parts["SC-GRAVELPACK-SEALASSEMBLY"] = half(seal)
    # washpipe inside the screen (ghost): returns path during the pack
    parts["SC-GRAVELPACK-WASHPIPE"] = half(tube_z(2.375, 2.0, scr_len + 60.0, z_scr_bot - 10.0))
    return parts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    export_parts(build(), a.out, "SC-GRAVELPACK", extra_stl=False, tolerance=0.03)
