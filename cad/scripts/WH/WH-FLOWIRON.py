"""
WH-FLOWIRON: a kit of 3 in. high-pressure flow iron laid out side by side: pup joint with
a wing nut, swivel joint, tee block, dart check valve, pressure relief valve, plug valve,
and a restraint sling loop. Generic proportions.

Run: python WH-FLOWIRON.py --out ../../out/WH
"""
import argparse
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
from _lib import wing_nut, pipe_x, export_parts  # noqa: E402

R = 1.9   # outside radius of 3 in. nominal iron (representative)
RB = 1.5  # bore radius


def hollow_pipe(length, x0=0.0):
    return pipe_x(R, length, x0).cut(pipe_x(RB, length + 2, x0 - 1))


def build():
    parts = {}
    y = 0.0
    # pup joint 60 in. with a wing nut on the -X end and a male sub on the +X end
    pj = hollow_pipe(60.0, -30.0)
    pj = pj.union(pipe_x(R * 1.25, 3.0, 27.0).cut(pipe_x(RB, 5, 26)))
    parts["WH-FLOWIRON-PUPJOINT"] = pj.translate((0, y, 0))
    parts["WH-FLOWIRON-HAMMERUNION"] = wing_nut(R, -31.0).translate((0, y, 0))
    y -= 14.0
    # swivel joint: two short legs at 90 degrees with a swivel ring
    leg1 = hollow_pipe(14.0, -14.0)
    leg2 = cq.Workplane("XY").circle(R).extrude(14.0).cut(cq.Workplane("XY").circle(RB).extrude(16).translate((0, 0, -1)))
    elbow = cq.Workplane("XY").sphere(R * 1.15)
    ring = cq.Workplane("XY").circle(R * 1.6).circle(R * 1.05).extrude(3.0).translate((0, 0, 6.0))
    sw = leg1.union(leg2).union(elbow).union(ring)
    parts["WH-FLOWIRON-SWIVEL"] = sw.translate((-8.0, y, 0))
    y -= 14.0
    # tee block
    tee = cq.Workplane("XY").box(11.0, 9.0, 9.0)
    tee = tee.cut(pipe_x(RB, 14, -7)).cut(cq.Workplane("XY").circle(RB).extrude(10).translate((0, 0, -1)))
    tee = tee.union(pipe_x(R, 4, 5.5)).union(pipe_x(R, 4, -9.5)).union(cq.Workplane("XY").circle(R).extrude(4).translate((0, 0, 4.5)))
    parts["WH-FLOWIRON-TEE"] = tee.translate((0, y, 0))
    y -= 14.0
    # dart check valve: barrel body with union ends and a flow arrow ridge
    cv = pipe_x(R * 1.7, 14.0, -7.0).cut(pipe_x(RB, 16, -8))
    cv = cv.union(pipe_x(R, 5, 7)).union(pipe_x(R, 5, -12))
    cv = cv.union(cq.Workplane("XY").box(6, 0.6, 1.0).translate((0, 0, R * 1.7 + 0.3)))
    parts["WH-FLOWIRON-CHECKVALVE"] = cv.translate((0, y, 0))
    y -= 14.0
    # pressure relief valve: inline block with a vertical spring housing and a side relief outlet
    prv = cq.Workplane("XY").box(10.0, 9.0, 9.0).cut(pipe_x(RB, 14, -7))
    prv = prv.union(cq.Workplane("XY").circle(2.6).extrude(14.0).translate((0, 0, 4.5)))
    prv = prv.union(cq.Workplane("XY").circle(3.2).extrude(1.2).translate((0, 0, 18.5)))
    prv = prv.union(cq.Workplane("XZ").circle(1.4).extrude(6.0).translate((0, -4.5, 2.0)))
    parts["WH-FLOWIRON-PRV"] = prv.translate((0, y, 0))
    y -= 14.0
    # plug valve: block body, stem, lever handle
    pv = cq.Workplane("XY").box(10.0, 9.0, 9.5).cut(pipe_x(RB, 14, -7))
    pv = pv.union(pipe_x(R, 5, 5)).union(pipe_x(R, 5, -10))
    pv = pv.union(cq.Workplane("XY").circle(1.2).extrude(4.0).translate((0, 0, 4.75)))
    pv = pv.union(cq.Workplane("XY").box(12.0, 1.4, 1.0).translate((4.0, 0, 8.6)))
    parts["WH-FLOWIRON-PLUGVALVE"] = pv.translate((0, y, 0))
    y -= 14.0
    # restraint: a sling loop around a short pup joint segment (represented as a torus-like ring pair)
    seg = hollow_pipe(20.0, -10.0)
    ring1 = cq.Workplane("YZ").circle(R * 1.5).circle(R * 1.1).extrude(1.0).translate((-6.0, 0, 0))
    ring2 = cq.Workplane("YZ").circle(R * 1.5).circle(R * 1.1).extrude(1.0).translate((5.0, 0, 0))
    cable = cq.Workplane("XY").box(11.0, 0.5, 0.5).translate((-0.5, 0, R * 1.3))
    parts["WH-FLOWIRON-RESTRAINT"] = seg.union(ring1).union(ring2).union(cable).translate((0, y, 0))
    return parts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    export_parts(build(), a.out, "WH-FLOWIRON", extra_stl=False)
