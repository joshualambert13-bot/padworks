"""
AL-BEAMUNIT: generic conventional beam pumping unit (crank-balanced, class I lever) on a skid base over a
wellhead: base, Samson post, walking beam with the horsehead and the equalizer, two pitman arms, two cranks with
counterweights, gear reducer, prime mover with belt guard, bridle and polished rod, and the stuffing box on the
pumping tee. Shown near the middle of the upstroke. Generic proportions of a mid-size unit; not an OEM design.

Axes: X along the unit (wellhead at +X), Z up, inches. Origin at grade under the center of the base.
Run: python AL-BEAMUNIT.py --out ../../out/AL
"""
import argparse
import math
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "WH"))
from _lib import export_parts, ROLE_COLORS  # noqa: E402

ROLE_COLORS.update({"BASE": (0.30, 0.32, 0.36), "SAMSONPOST": (0.55, 0.20, 0.15), "WALKINGBEAM": (0.55, 0.20, 0.15), "HORSEHEAD": (0.55, 0.20, 0.15),
                    "EQUALIZER": (0.34, 0.36, 0.40), "PITMAN": (0.34, 0.36, 0.40), "CRANK": (0.24, 0.26, 0.30), "COUNTERWEIGHT": (0.18, 0.18, 0.20),
                    "GEARREDUCER": (0.30, 0.32, 0.36), "PRIMEMOVER": (0.24, 0.26, 0.30), "BELTGUARD": (0.55, 0.20, 0.15),
                    "BRIDLE": (0.62, 0.64, 0.68), "POLISHEDROD": (0.85, 0.85, 0.85), "STUFFINGBOX": (0.30, 0.32, 0.36), "WELLHEAD": (0.26, 0.28, 0.32)})


def box(x, y, z, cx=0, cy=0, cz=0):
    return cq.Workplane("XY").box(x, y, z).translate((cx, cy, cz))


def build():
    parts = {}
    base_len, base_w = 240.0, 72.0
    base = box(base_len, 14.0, 12.0, 0, -24.0, 6.0).union(box(base_len, 14.0, 12.0, 0, 24.0, 6.0))
    for x in (-100.0, -40.0, 20.0, 80.0):
        base = base.union(box(10.0, base_w, 10.0, x, 0, 6.0))
    parts["AL-BEAMUNIT-BASE"] = base
    # Samson post: A-frame of three legs meeting at the center bearing
    post_x, post_top = 20.0, 168.0
    post = None
    for (x0, y0) in ((-40.0, -26.0), (-40.0, 26.0), (60.0, 0.0)):
        dx, dy, dz = post_x - x0, -y0, post_top - 12.0
        L = math.sqrt(dx * dx + dy * dy + dz * dz)
        leg = cq.Workplane("XY").box(8.0, 8.0, L).translate((0, 0, L / 2))
        ang_y = math.degrees(math.atan2(dx, dz))
        leg = leg.rotate((0, 0, 0), (0, 1, 0), ang_y)
        if dy != 0:
            ang_x = -math.degrees(math.atan2(dy, math.sqrt(dx * dx + dz * dz)))
            leg = leg.rotate((0, 0, 0), (math.cos(math.radians(ang_y)), 0, -math.sin(math.radians(ang_y))), ang_x)
        leg = leg.translate((x0, y0, 12.0))
        post = leg if post is None else post.union(leg)
    post = post.union(box(24.0, 40.0, 10.0, post_x, 0, post_top)).union(cq.Workplane("XZ").circle(4.0).extrude(44.0, both=True).translate((post_x, 0, post_top + 6.0)))
    parts["AL-BEAMUNIT-SAMSONPOST"] = post
    # walking beam pivoting on the center bearing, tilted for mid-upstroke (horsehead end up)
    beam_len, tilt = 300.0, 6.0
    beam = box(beam_len, 14.0, 22.0, 0, 0, 0)
    beam = beam.rotate((0, 0, 0), (0, 1, 0), -tilt).translate((post_x + 20.0, 0, post_top + 6.0))
    parts["AL-BEAMUNIT-WALKINGBEAM"] = beam
    # horsehead at the +X end of the beam: an arc segment facing the well
    hh_x = post_x + 20.0 + beam_len / 2 * math.cos(math.radians(tilt))
    hh_z = post_top + 6.0 + beam_len / 2 * math.sin(math.radians(tilt))
    r_hh = 84.0
    head = cq.Workplane("XZ").moveTo(0, 0).lineTo(r_hh * math.cos(math.radians(-25)), r_hh * math.sin(math.radians(-25))).threePointArc(
        (r_hh, 0), (r_hh * math.cos(math.radians(40)), r_hh * math.sin(math.radians(40)))).close().extrude(16.0, both=True)
    head = head.rotate((0, 0, 0), (0, 1, 0), -tilt).translate((hh_x - r_hh * 0.55, 0, hh_z - 30.0))
    parts["AL-BEAMUNIT-HORSEHEAD"] = head
    # equalizer and pitman arms at the tail end down to the crank pins
    eq_x = post_x + 20.0 - beam_len / 2 * math.cos(math.radians(tilt)) + 30.0
    eq_z = post_top + 6.0 - (beam_len / 2 - 30.0) * math.sin(math.radians(tilt)) - 14.0
    eq = box(20.0, 70.0, 12.0, eq_x, 0, eq_z)
    parts["AL-BEAMUNIT-EQUALIZER"] = eq
    reducer_x, reducer_z = -90.0, 60.0
    crank_len, crank_ang = 42.0, 55.0
    pin_x = reducer_x + crank_len * math.cos(math.radians(crank_ang))
    pin_z = reducer_z + crank_len * math.sin(math.radians(crank_ang))
    pit = None
    for y in (-30.0, 30.0):
        dx, dz = eq_x - pin_x, eq_z - pin_z
        L = math.sqrt(dx * dx + dz * dz)
        arm = cq.Workplane("XY").box(6.0, 6.0, L).translate((0, 0, L / 2)).rotate((0, 0, 0), (0, 1, 0), math.degrees(math.atan2(dx, dz))).translate((pin_x, y, pin_z))
        pit = arm if pit is None else pit.union(arm)
    parts["AL-BEAMUNIT-PITMAN"] = pit
    # cranks and counterweights on the reducer slow shaft
    cr = None; cw = None
    for y in (-38.0, 38.0):
        c = cq.Workplane("XZ").rect(crank_len + 24.0, 14.0).extrude(4.0, both=True).translate((crank_len / 2, 0, 0)).rotate((0, 0, 0), (0, 1, 0), -crank_ang).translate((reducer_x, y, reducer_z))
        c = c.union(cq.Workplane("XZ").circle(4.0).extrude(6.0, both=True).translate((pin_x, y, pin_z)))
        cr = c if cr is None else cr.union(c)
        w = cq.Workplane("XZ").rect(30.0, 22.0).extrude(9.0, both=True).translate((-(crank_len - 4.0), 0, 0)).rotate((0, 0, 0), (0, 1, 0), -crank_ang).translate((reducer_x, y + (12.0 if y > 0 else -12.0), reducer_z))
        cw = w if cw is None else cw.union(w)
    cr = cr.union(cq.Workplane("XZ").circle(5.0).extrude(46.0, both=True).translate((reducer_x, 0, reducer_z)))
    parts["AL-BEAMUNIT-CRANK"] = cr
    parts["AL-BEAMUNIT-COUNTERWEIGHT"] = cw
    # gear reducer on a pedestal
    red = box(50.0, 60.0, 44.0, reducer_x, 0, reducer_z - 6.0).union(box(60.0, 66.0, 20.0, reducer_x, 0, 22.0))
    red = red.union(cq.Workplane("XZ").circle(9.0).extrude(40.0, both=True).translate((reducer_x, 0, reducer_z + 24.0)))   # high-speed shaft sheave
    parts["AL-BEAMUNIT-GEARREDUCER"] = red
    # prime mover (electric motor) on a slide with the belt guard to the reducer sheave
    pm = cq.Workplane("YZ").circle(12.0).extrude(30.0).translate((-160.0, 0, 30.0)).union(box(34.0, 30.0, 6.0, -145.0, 0, 15.0))
    parts["AL-BEAMUNIT-PRIMEMOVER"] = pm
    guard = cq.Workplane("XZ").moveTo(-150.0, 30.0).lineTo(reducer_x, reducer_z + 24.0).lineTo(reducer_x, reducer_z + 46.0).lineTo(-150.0, 52.0).close().extrude(6.0, both=True).translate((0, -46.0, 0))
    parts["AL-BEAMUNIT-BELTGUARD"] = guard
    # bridle from the horsehead down to the polished rod clamp; polished rod into the stuffing box on the tee
    well_x = hh_x + 4.0
    bridle = None
    for y in (-6.0, 6.0):
        b = cq.Workplane("XY").circle(0.6).extrude(hh_z - 30.0 + 40.0 - 90.0).translate((well_x, y, 90.0))
        bridle = b if bridle is None else bridle.union(b)
    bridle = bridle.union(box(14.0, 20.0, 6.0, well_x, 0, 90.0))    # carrier bar
    parts["AL-BEAMUNIT-BRIDLE"] = bridle
    parts["AL-BEAMUNIT-POLISHEDROD"] = cq.Workplane("XY").circle(0.75).extrude(80.0).translate((well_x, 0, 22.0)).union(box(8.0, 8.0, 4.0, well_x, 0, 88.0))
    sb = cq.Workplane("XY").circle(3.5).extrude(10.0).translate((well_x, 0, 40.0)).union(cq.Workplane("XY").circle(4.5).extrude(3.0).translate((well_x, 0, 50.0)))
    parts["AL-BEAMUNIT-STUFFINGBOX"] = sb
    wh = cq.Workplane("XY").circle(4.5).extrude(36.0).translate((well_x, 0, 4.0)).union(box(12.0, 12.0, 10.0, well_x, 0, 34.0))
    wh = wh.union(cq.Workplane("XZ").circle(2.5).extrude(-16.0).translate((well_x, -6.0, 34.0)))    # flowline outlet on the tee
    wh = wh.union(cq.Workplane("XY").circle(7.0).extrude(4.0).translate((well_x, 0, 4.0)))
    parts["AL-BEAMUNIT-WELLHEAD"] = wh
    return parts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    export_parts(build(), a.out, "AL-BEAMUNIT", extra_stl=False, tolerance=0.1)
