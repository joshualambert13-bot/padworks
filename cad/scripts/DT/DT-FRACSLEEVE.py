"""
DT-FRACSLEEVE: cut-away of a ball-drop frac sleeve in 5-1/2 in. casing, shown shifted open with the ball on
its seat: outer housing with threaded pin and box ends and four port windows, the inner sleeve (shifted
toe-ward), the graduated ball seat, the frac ball, the shear screws that held the sleeve closed, the body
seals, and a swellable packer element on the casing below the sleeve for an openhole system. The casing
joints either side are ghost context. Half of the housing and sleeve are cut away on the -Y side (the side facing the viewer camera) so the
interior reads in the viewer. Generic geometry; proportions only, not an OEM design.

Axes: X along the wellbore (toe at +X), Z up. Inches.
Run: python DT-FRACSLEEVE.py --out ../../out/DT
"""
import argparse
import math
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "WH"))
from _lib import export_parts, ROLE_COLORS  # noqa: E402

ROLE_COLORS.update({"HOUSING": (0.34, 0.36, 0.40), "INNERSLEEVE": (0.62, 0.64, 0.68), "PORTS": (0.10, 0.10, 0.11), "BALLSEAT": (0.75, 0.70, 0.45),
                    "BALL": (0.85, 0.85, 0.85), "SHEARSCREW": (0.70, 0.72, 0.76), "SEALS": (0.15, 0.15, 0.15), "PACKER": (0.18, 0.16, 0.14),
                    "CASING": (0.42, 0.44, 0.48)})

CASING_OD, CASING_ID = 5.5, 4.778
HOUSING_OD = 6.9
LEN = 60.0


def tube_x(od, id_, length, x0):
    return cq.Workplane("YZ").circle(od / 2).circle(id_ / 2).extrude(length).translate((x0, 0, 0))


def half_cut(solid):
    """Remove the +Y half so the interior shows."""
    return solid.cut(cq.Workplane("XY").box(400, 40, 40).translate((0, -20, 0)))


def build():
    parts = {}
    shift = 9.0                                  # inner sleeve travel toe-ward when open
    # housing: thick sub with pin and box ends, four rectangular port windows in the middle
    housing = tube_x(HOUSING_OD, 4.95, LEN, -LEN / 2)
    housing = housing.union(tube_x(HOUSING_OD + 0.6, 4.95, 6.0, -LEN / 2 - 6.0)).union(tube_x(HOUSING_OD + 0.6, 4.95, 6.0, LEN / 2))
    win = None
    for k in range(4):
        w = cq.Workplane("XY").box(8.0, 8.0, 2.4).translate((-4.0, 4.0, 0)).rotate((0, 0, 0), (1, 0, 0), 45 + k * 90)
        win = w if win is None else win.union(w)
    housing = housing.cut(win)
    parts["DT-FRACSLEEVE-HOUSING"] = half_cut(housing)
    # port windows shown as thin dark faces on the housing OD (what the operator sees as "ports open")
    ports = None
    for k in range(4):
        pface = cq.Workplane("XY").box(8.0, 0.3, 2.4).translate((-4.0, HOUSING_OD / 2 - 0.1, 0)).rotate((0, 0, 0), (1, 0, 0), 45 + k * 90)
        ports = pface if ports is None else ports.union(pface)
    parts["DT-FRACSLEEVE-PORTS"] = half_cut(ports)
    # inner sleeve, shifted open (toe-ward, +X) so the windows are uncovered
    inner = tube_x(4.9, 4.2, 26.0, -13.0 + shift)
    inner = inner.cut(cq.Workplane("XY").box(2.0, 12, 12).translate((-13.0 + shift + 2.0, 0, 0)).cut(tube_x(4.9, 4.55, 2.0, -13.0 + shift + 1.0)))
    parts["DT-FRACSLEEVE-INNERSLEEVE"] = half_cut(inner)
    # ball seat: tapered ring at the heel end of the sleeve, and the ball landed on it
    seat = cq.Workplane("YZ").circle(4.2 / 2).circle(3.55 / 2).extrude(3.0).translate((-13.0 + shift - 3.0, 0, 0))
    seat = seat.union(cq.Workplane("YZ").workplane(offset=-13.0 + shift - 3.0).circle(3.55 / 2).workplane(offset=3.0).circle(3.95 / 2).loft().cut(
        cq.Workplane("YZ").circle(3.5 / 2).extrude(10, both=True).translate((-13.0 + shift - 1.5, 0, 0))))
    parts["DT-FRACSLEEVE-BALLSEAT"] = half_cut(seat)
    ball = cq.Workplane("XY").sphere(3.75 / 2).translate((-13.0 + shift - 3.0 - 1.35, 0, 0))
    parts["DT-FRACSLEEVE-BALL"] = half_cut(ball)
    # shear screws through the housing into the sleeve (sheared: shown as stubs in the housing)
    screws = None
    for k in range(6):
        s = cq.Workplane("XY").circle(0.35).extrude(1.6).translate((-15.0, 0, HOUSING_OD / 2 - 1.4)).rotate((0, 0, 0), (1, 0, 0), 15 + k * 60)
        screws = s if screws is None else screws.union(s)
    parts["DT-FRACSLEEVE-SHEARSCREW"] = half_cut(screws)
    # body seals: o-ring grooves as dark rings on the sleeve OD at both ends
    seals = None
    for x in (-12.0 + shift, 11.0 + shift):
        r = cq.Workplane("YZ").circle(4.95 / 2).circle(4.85 / 2).extrude(0.6).translate((x, 0, 0))
        seals = r if seals is None else seals.union(r)
    parts["DT-FRACSLEEVE-SEALS"] = half_cut(seals)
    # swellable packer element on the casing toe-ward of the sleeve
    packer = tube_x(8.3, CASING_OD, 30.0, LEN / 2 + 30.0)
    packer = packer.union(tube_x(6.4, CASING_OD, 3.0, LEN / 2 + 27.0)).union(tube_x(6.4, CASING_OD, 3.0, LEN / 2 + 60.0))
    parts["DT-FRACSLEEVE-PACKER"] = half_cut(packer)
    # ghost casing joints either side
    casing = tube_x(CASING_OD, CASING_ID, 80.0, -LEN / 2 - 6.0 - 80.0).union(tube_x(CASING_OD, CASING_ID, 100.0, LEN / 2 + 6.0))
    parts["DT-FRACSLEEVE-CASING"] = half_cut(casing)
    return parts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    export_parts(build(), a.out, "DT-FRACSLEEVE", extra_stl=False, tolerance=0.03)
