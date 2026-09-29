"""
FB-CHOKEMANIFOLD: generic skid-mounted dual choke manifold for flowback, 3 in. 10K class with
hammer-union ends. Inlet header from the well with a plug valve, two parallel choke runs each
with an upstream plug valve, a choke body (one adjustable with a handwheel and position
indicator, one positive with a bean housing), and a downstream plug valve, a bypass run with a
plug valve, an outlet header to the separator with a pressure gauge, and the skid.
Flow along +X. Generic proportions; not a manufacturer's design.

Run: python FB-CHOKEMANIFOLD.py --out ../../out/FB
"""
import argparse
import math
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "WH"))
from _lib import export_parts, wing_nut, hex_nut, ROLE_COLORS  # noqa: E402

ROLE_COLORS.update({"SKID": (0.85, 0.65, 0.10), "INLET": (0.24, 0.26, 0.30), "OUTLET": (0.24, 0.26, 0.30),
                    "PLUGVALVE": (0.28, 0.30, 0.34), "ADJUSTABLECHOKE": (0.30, 0.32, 0.36), "POSITIVECHOKE": (0.30, 0.32, 0.36),
                    "BYPASS": (0.24, 0.26, 0.30), "GAUGE": (0.70, 0.72, 0.76)})

R_PIPE = 1.75      # 3 in. 1502 iron OD radius (3.5 in. OD class)
R_BORE = 1.38


def pipe_x(x0, x1, y, z):
    return cq.Workplane("YZ").circle(R_PIPE).extrude(x1 - x0).translate((x0, y, z))


def pipe_y(x, y0, y1, z):
    return cq.Workplane("XZ").circle(R_PIPE).extrude(-(y1 - y0)).translate((x, y0, z))


def union_at(x, y, z):
    return wing_nut(R_PIPE, x).translate((0, y, z))


def plug_valve(x, y, z, open_):
    """3 in. plug valve: square body, union ends, stem with a wrench-flat cap and position bar."""
    L = 12.0
    body = cq.Workplane("XY").box(7.5, 7.5, 8.5).edges("|X").fillet(0.8).translate((x, y, z))
    ends = pipe_x(x - L / 2, x - 3.75, y, z).union(pipe_x(x + 3.75, x + L / 2, y, z))
    body = body.union(ends)
    body = body.cut(cq.Workplane("YZ").circle(R_BORE).extrude(L + 2).translate((x - L / 2 - 1, y, z)))
    stem = cq.Workplane("XY").circle(1.1).extrude(3.0).translate((x, y, z + 4.25))
    cap = hex_nut(2.6, 1.2).translate((x, y, z + 7.25))
    bar = cq.Workplane("XY").box(6.0 if open_ else 1.2, 1.2 if open_ else 6.0, 0.6).translate((x, y, z + 8.75))
    grease = cq.Workplane("XY").circle(0.35).extrude(1.2).translate((x + 2.2, y + 2.2, z + 4.25))
    return body.union(stem).union(cap).union(bar).union(grease)


def choke_adjustable(x, y, z):
    """Adjustable choke: tee body, inlet along X, outlet up then along X; stem, handwheel, indicator."""
    L = 14.0
    body = cq.Workplane("XY").box(9.0, 8.0, 9.0).edges("|Y").fillet(0.8).translate((x, y, z))
    ends = pipe_x(x - L / 2, x - 4.5, y, z).union(pipe_x(x + 4.5, x + L / 2, y, z))
    body = body.union(ends)
    body = body.cut(cq.Workplane("YZ").circle(R_BORE).extrude(L + 2).translate((x - L / 2 - 1, y, z)))
    bonnet = cq.Workplane("XY").circle(3.2).extrude(4.0).translate((x - 1.5, y, z + 4.5))
    stem = cq.Workplane("XY").circle(0.9).extrude(9.0).translate((x - 1.5, y, z + 8.5))
    ind = cq.Workplane("XY").box(1.2, 3.0, 8.0).translate((x - 1.5 + 2.2, y, z + 12.5))
    ind = ind.cut(cq.Workplane("XY").box(0.6, 3.2, 7.0).translate((x - 1.5 + 2.2, y, z + 12.5)))
    wheel = cq.Workplane("XY").circle(6.0).circle(5.0).extrude(0.9).translate((x - 1.5, y, z + 17.5))
    for i in range(4):
        spoke = cq.Workplane("XY").box(5.4, 0.7, 0.7).translate((x - 1.5 + 2.7, y, z + 17.95)).rotate((x - 1.5, y, 0), (x - 1.5, y, 1), i * 90)
        wheel = wheel.union(spoke)
    hub = cq.Workplane("XY").circle(1.3).extrude(1.6).translate((x - 1.5, y, z + 17.3))
    return body.union(bonnet).union(stem).union(ind).union(wheel).union(hub)


def choke_positive(x, y, z):
    """Positive choke: tee body with a bean housing and a hammer-union cap."""
    L = 14.0
    body = cq.Workplane("XY").box(9.0, 8.0, 9.0).edges("|Y").fillet(0.8).translate((x, y, z))
    ends = pipe_x(x - L / 2, x - 4.5, y, z).union(pipe_x(x + 4.5, x + L / 2, y, z))
    body = body.union(ends)
    body = body.cut(cq.Workplane("YZ").circle(R_BORE).extrude(L + 2).translate((x - L / 2 - 1, y, z)))
    housing = cq.Workplane("XY").circle(3.0).extrude(5.0).translate((x - 1.5, y, z + 4.5))
    cap = cq.Workplane("XY").circle(3.6).extrude(2.0).translate((x - 1.5, y, z + 9.5))
    for i in range(3):
        lug = cq.Workplane("XY").box(2.0, 1.2, 2.0).translate((x - 1.5 + 3.6, y, z + 10.5)).rotate((x - 1.5, y, 0), (x - 1.5, y, 1), i * 120)
        cap = cap.union(lug)
    return body.union(housing).union(cap)


def build():
    parts = {}
    z = 20.0
    ya, yb, ybp = 14.0, -14.0, 32.0      # run A (adjustable), run B (positive), bypass
    # skid
    skid = cq.Workplane("XY").box(120.0, 84.0, 4.0).translate((0, 8.0, 2.0))
    skid = skid.cut(cq.Workplane("XY").box(112.0, 76.0, 3.0).translate((0, 8.0, 2.5)))
    for x in (-40, 0, 40):
        for y in (ya, yb, ybp):
            skid = skid.union(cq.Workplane("XY").box(6.0, 6.0, z - R_PIPE - 4.0).translate((x, y, 4.0 + (z - R_PIPE - 4.0) / 2)))
    parts["FB-CHOKEMANIFOLD-SKID"] = skid
    # inlet header: from -X, plug valve, tee to the three runs along Y
    x_in = -58.0
    inlet = pipe_x(x_in, -48.0, 0, z).union(union_at(x_in + 2.0, 0, z))
    inlet = inlet.union(pipe_x(-48.0 + 12.0, -34.0, 0, z))
    inlet = inlet.union(pipe_y(-34.0, yb, ybp, z))
    parts["FB-CHOKEMANIFOLD-INLET"] = inlet
    valves = plug_valve(-42.0, 0, z, True)
    # runs
    x_up, x_ch, x_dn = -22.0, 0.0, 22.0
    for y, kind in ((ya, "adj"), (yb, "pos"), (ybp, "bypass")):
        run = pipe_x(-34.0, x_up - 6.0, y, z)
        if kind == "bypass":
            valves = valves.union(plug_valve(x_up, y, z, False))
            run = run.union(pipe_x(x_up + 6.0, x_dn - 6.0, y, z))
            valves = valves.union(plug_valve(x_dn, y, z, False))
            parts["FB-CHOKEMANIFOLD-BYPASS"] = run.union(pipe_x(x_dn + 6.0, 34.0, y, z))
        else:
            valves = valves.union(plug_valve(x_up, y, z, kind == "adj"))
            run = run.union(pipe_x(x_up + 6.0, x_ch - 7.0, y, z)).union(pipe_x(x_ch + 7.0, x_dn - 6.0, y, z))
            valves = valves.union(plug_valve(x_dn, y, z, kind == "adj"))
            run = run.union(pipe_x(x_dn + 6.0, 34.0, y, z))
            parts["FB-CHOKEMANIFOLD-INLET"] = parts["FB-CHOKEMANIFOLD-INLET"].union(run)
            if kind == "adj":
                parts["FB-CHOKEMANIFOLD-ADJUSTABLECHOKE"] = choke_adjustable(x_ch, y, z)
            else:
                parts["FB-CHOKEMANIFOLD-POSITIVECHOKE"] = choke_positive(x_ch, y, z)
    parts["FB-CHOKEMANIFOLD-PLUGVALVE"] = valves
    # outlet header: collects the runs, out along +X with a gauge
    outlet = pipe_y(34.0, yb, ybp, z).union(pipe_x(34.0, 58.0, 0, z)).union(union_at(56.0, 0, z))
    parts["FB-CHOKEMANIFOLD-OUTLET"] = outlet
    gauge = cq.Workplane("XY").circle(0.6).extrude(4.0).translate((44.0, 0, z + R_PIPE))
    gauge = gauge.union(cq.Workplane("XZ").circle(2.6).extrude(-1.2).translate((44.0, -0.6, z + R_PIPE + 5.5)))
    parts["FB-CHOKEMANIFOLD-GAUGE"] = gauge
    return parts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    export_parts(build(), a.out, "FB-CHOKEMANIFOLD", extra_stl=False, tolerance=0.04)
