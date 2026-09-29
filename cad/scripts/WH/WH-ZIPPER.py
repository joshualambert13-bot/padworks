"""
WH-ZIPPER: generic three-well zipper manifold skid: inlet header from the missile side,
one hydraulic gate valve per well branch, outlet pup joints with wing nuts, pressure
transducer blocks, a bleed valve on the header, and the hydraulic control unit with
accumulator bottles on the skid.

Run: python WH-ZIPPER.py --out ../../out/WH
"""
import argparse
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
from _lib import valve_params, gate_valve_solid, wing_nut, export_parts  # noqa: E402


def build(wells=3):
    parts = {}
    skid_x, skid_y, skid_z = 130.0, 300.0, 10.0
    skid = cq.Workplane("XY").box(skid_x, skid_y, skid_z).translate((0, 0, skid_z / 2))
    skid = skid.cut(cq.Workplane("XY").box(skid_x - 16, skid_y - 16, skid_z - 3).translate((0, 0, skid_z / 2 + 1.5)))
    parts["WH-ZIPPER-SKID"] = skid
    zc = 40.0
    header_x = -45.0
    header = cq.Workplane("XZ").circle(3.75).extrude(skid_y - 20, both=False).translate((header_x, (skid_y - 20) / 2, zc))
    header = header.cut(cq.Workplane("XZ").circle(2.6).extrude(skid_y - 18).translate((header_x, (skid_y - 18) / 2, zc)))
    # supports
    for y in (-110, 0, 110):
        header = header.union(cq.Workplane("XY").box(8, 8, zc - 3.75).translate((header_x, y, (zc - 3.75) / 2 + skid_z)))
    parts["WH-ZIPPER-INLETHEADER"] = header
    pv = valve_params(5.125, 15.0, actuated=True)
    ftf = pv["face_to_face"]
    ys = [(-1 + i) * 95.0 for i in range(wells)] if wells == 3 else [(i - (wells - 1) / 2) * 95.0 for i in range(wells)]
    valves = None; outlets = None; trans = None
    for i, y in enumerate(ys):
        # branch pipe from header to valve
        branch = cq.Workplane("YZ").circle(2.0).extrude(16.0).translate((header_x + 3.0, y, zc))
        v = gate_valve_solid(pv, 1.0 if i == 1 else 0.0).translate((header_x + 3.0 + 16.0 + ftf / 2, y, zc))
        v = v.union(branch)
        valves = v if valves is None else valves.union(v)
        x_out = header_x + 3.0 + 16.0 + ftf
        outlet = cq.Workplane("YZ").circle(2.0).extrude(40.0).translate((x_out, y, zc))
        outlet = outlet.union(wing_nut(2.0, x_out + 34.0).translate((0, y, zc)))
        outlets = outlet if outlets is None else outlets.union(outlet)
        t = cq.Workplane("XY").box(4, 4, 6).translate((x_out + 12.0, y, zc + 5.0))
        t = t.union(cq.Workplane("XY").circle(1.0).extrude(3.0).translate((x_out + 12.0, y, zc + 2.0)))
        trans = t if trans is None else trans.union(t)
    parts["WH-ZIPPER-VALVE"] = valves
    parts["WH-ZIPPER-OUTLET"] = outlets
    parts["WH-ZIPPER-TRANSDUCER"] = trans
    # bleed valve on the header end (small manual valve)
    pb = valve_params(2.0625, 15.0, actuated=False)
    bleed = gate_valve_solid(pb, 0.0).rotate((0, 0, 0), (0, 0, 1), 90).translate((header_x, (skid_y - 20) / 2 + pb["face_to_face"] / 2 + 2, zc))
    parts["WH-ZIPPER-BLEEDVALVE"] = bleed
    # hydraulic control unit and accumulator bottles
    hpu = cq.Workplane("XY").box(48, 36, 44).translate((30, -(skid_y / 2) + 36, skid_z + 22))
    parts["WH-ZIPPER-HPU"] = hpu
    acc = None
    for dx in (-12, 0, 12):
        b = cq.Workplane("XY").circle(4.5).extrude(40).translate((30 + dx, -(skid_y / 2) + 70, skid_z))
        acc = b if acc is None else acc.union(b)
    parts["WH-ZIPPER-ACCUMULATOR"] = acc
    return parts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    export_parts(build(), a.out, "WH-ZIPPER", extra_stl=False)
