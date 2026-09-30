"""
AL-RODPUMP: cut-away of a generic rod-drawn insert (subsurface) pump seated in 2-7/8 in. tubing, shown
mid-stroke: seating nipple and mechanical hold-down, barrel, plunger with the traveling valve (ball and seat in a
cage) at its bottom, standing valve (ball and seat in a cage) at the barrel bottom, valve rod and rod coupling
at the top, and a gas anchor (dip tube and mud anchor) hanging below the seating nipple. The tubing is ghost
context. Half of everything on the -Y side (the side facing the viewer camera) is cut away so the interior reads in the viewer.
Generic proportions in the API 11AX pump family; not an OEM design.

Axes: Z up (well axis), inches. Origin at the seating nipple.
Run: python AL-RODPUMP.py --out ../../out/AL
"""
import argparse
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "WH"))
from _lib import export_parts, ROLE_COLORS  # noqa: E402

ROLE_COLORS.update({"TUBING": (0.42, 0.44, 0.48), "SEATINGNIPPLE": (0.34, 0.36, 0.40), "HOLDDOWN": (0.55, 0.50, 0.30), "BARREL": (0.62, 0.64, 0.68),
                    "PLUNGER": (0.75, 0.70, 0.45), "TRAVELINGVALVE": (0.30, 0.32, 0.36), "STANDINGVALVE": (0.30, 0.32, 0.36), "BALL": (0.85, 0.85, 0.85),
                    "VALVEROD": (0.70, 0.72, 0.76), "RODCOUPLING": (0.55, 0.50, 0.30), "GASANCHOR": (0.34, 0.36, 0.40), "CAGE": (0.30, 0.32, 0.36)})

TBG_OD, TBG_ID = 2.875, 2.441


def tube_z(od, id_, h, z0):
    return cq.Workplane("XY").circle(od / 2).circle(id_ / 2).extrude(h).translate((0, 0, z0))


def half(s):
    return s.cut(cq.Workplane("XY").box(40, 40, 600).translate((0, -20, 0)))


def cage(od, id_, h, z0, slots=4):
    c = tube_z(od, id_, h, z0)
    for k in range(slots):
        w = cq.Workplane("XY").box(od, 0.35 * od, h * 0.55).translate((0, 0, z0 + h / 2)).rotate((0, 0, 0), (0, 0, 1), k * 180 / slots + 45)
        c = c.cut(w)
    return c


def build():
    parts = {}
    stroke_pos = 0.45                     # plunger position in the barrel (0 bottom, 1 top)
    barrel_len = 72.0
    z_nipple = 0.0
    # ghost tubing around everything
    parts["AL-RODPUMP-TUBING"] = half(tube_z(TBG_OD, TBG_ID, 200.0, -70.0))
    # seating nipple in the tubing string and the mechanical hold-down that locks the pump into it
    nip = tube_z(TBG_OD + 0.35, 1.95, 12.0, z_nipple - 6.0)
    parts["AL-RODPUMP-SEATINGNIPPLE"] = half(nip)
    hd = tube_z(1.94, 1.25, 6.0, z_nipple - 3.0)
    for k in range(3):
        hd = hd.union(cq.Workplane("XY").circle(0.98).circle(0.94).extrude(0.5).translate((0, 0, z_nipple - 2.5 + k * 1.8)))
    parts["AL-RODPUMP-HOLDDOWN"] = half(hd)
    # barrel: thick tube above the hold-down; bore 1.5 in.
    barrel = tube_z(2.0, 1.5, barrel_len, z_nipple + 3.0)
    barrel = barrel.union(tube_z(2.25, 1.5, 3.0, z_nipple + 3.0 + barrel_len))   # top guide/extension
    parts["AL-RODPUMP-BARREL"] = half(barrel)
    # standing valve at the barrel bottom: seat ring, ball, cage
    z_sv = z_nipple + 3.0
    sv = cq.Workplane("XY").circle(0.75).circle(0.42).extrude(0.6).translate((0, 0, z_sv + 0.5))
    sv = sv.union(cage(1.48, 1.1, 3.2, z_sv + 1.1))
    parts["AL-RODPUMP-STANDINGVALVE"] = half(sv)
    parts["AL-RODPUMP-STANDINGBALL"] = half(cq.Workplane("XY").sphere(0.5).translate((0, 0, z_sv + 1.6)))
    # plunger mid-stroke with the traveling valve at its bottom
    plunger_len = 48.0
    z_pl = z_nipple + 3.0 + 5.0 + stroke_pos * (barrel_len - plunger_len - 8.0)
    pl = tube_z(1.497, 0.9, plunger_len, z_pl)
    for k in range(6):
        pl = pl.cut(cq.Workplane("XY").circle(1.6).circle(1.45).extrude(0.3).translate((0, 0, z_pl + 6.0 + k * 6.5)))   # grooves
    parts["AL-RODPUMP-PLUNGER"] = half(pl)
    tv = cq.Workplane("XY").circle(0.72).circle(0.4).extrude(0.6).translate((0, 0, z_pl - 3.0))
    tv = tv.union(cage(1.45, 1.05, 3.0, z_pl - 2.4)).union(tube_z(1.45, 0.9, 0.6, z_pl - 3.6))
    parts["AL-RODPUMP-TRAVELINGVALVE"] = half(tv)
    parts["AL-RODPUMP-TRAVELINGBALL"] = half(cq.Workplane("XY").sphere(0.48).translate((0, 0, z_pl - 1.9)))
    # valve rod from the plunger top to the rod coupling above the barrel
    z_top = z_pl + plunger_len
    rod = cq.Workplane("XY").circle(0.375).extrude(z_nipple + 3.0 + barrel_len + 20.0 - z_top).translate((0, 0, z_top))
    parts["AL-RODPUMP-VALVEROD"] = half(rod)
    cpl = cq.Workplane("XY").circle(0.95).extrude(4.0).translate((0, 0, z_nipple + 3.0 + barrel_len + 18.0))
    cpl = cpl.union(cq.Workplane("XY").circle(0.375).extrude(30.0).translate((0, 0, z_nipple + 3.0 + barrel_len + 22.0)))   # sucker rod stub
    parts["AL-RODPUMP-RODCOUPLING"] = half(cpl)
    # gas anchor: dip tube inside a mud anchor hanging below the nipple, with intake ports
    ga = tube_z(2.2, 1.9, 60.0, z_nipple - 66.0)
    for k in range(8):
        ga = ga.cut(cq.Workplane("XZ").circle(0.3).extrude(4, both=True).translate((0, 0, z_nipple - 12.0 - (k % 4) * 3.0)).rotate((0, 0, 0), (0, 0, 1), (k // 4) * 90 + 45))
    ga = ga.union(tube_z(1.0, 0.8, 58.0, z_nipple - 62.0))            # dip tube
    ga = ga.union(cq.Workplane("XY").circle(1.1).extrude(1.5).translate((0, 0, z_nipple - 66.0)))   # bull plug
    parts["AL-RODPUMP-GASANCHOR"] = half(ga)
    return parts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    export_parts(build(), a.out, "AL-RODPUMP", extra_stl=False, tolerance=0.02)
