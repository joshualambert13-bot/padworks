"""
WH-ZIPPER: generic vertical zipper manifold skid, three wells. The treating line from the missile enters
through an inlet isolation valve into a low header along the skid. Each well has a vertical leg off the
header: tee, riser spool, lower isolation valve, spool, upper working valve, and a top elbow block with a
flanged outlet toward the tree (+X). Pressure transducers on the elbows, a bleed valve on the far end of
the header, and the hydraulic control unit with accumulator bottles on the skid. Actuators point away
from the trees (-X). Generic geometry; proportions only.

Axes: X toward the trees, Y along the skid, Z up. Inches.
Run: python WH-ZIPPER.py --out ../../out/WH [--all]
"""
import argparse
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
from _lib import valve_params, gate_valve_solid, export_parts, size_key, ROLE_COLORS  # noqa: E402

ROLE_COLORS.update({"INLETVALVE": (0.28, 0.30, 0.34), "ISOVALVE": (0.28, 0.30, 0.34), "LEG": (0.30, 0.32, 0.36), "OUTLET": (0.34, 0.36, 0.40)})


def vertical_valve(pv, open_fraction):
    """Valve with the bore along Z and the actuator along -X."""
    return gate_valve_solid(pv, open_fraction).rotate((0, 0, 0), (0, 1, 0), -90)


def flange_disc(od, thk, bore):
    return cq.Workplane("XY").circle(od / 2).circle(bore / 2).extrude(thk)


def build(wells=3, bore=7.0625, rating=15.0):
    parts = {}
    pv = valve_params(bore, rating, actuated=True)
    ftf = pv["face_to_face"]
    fod, fthk = pv["flange_od"], pv["flange_thk"]
    pitch = 95.0
    skid_x, skid_y, skid_z = 150.0, wells * pitch + 90.0, 8.0
    header_x = -40.0
    zh = 22.0                       # header centerline height: the header lies low on pipe supports
    # bases: one small skid under each leg, one under the inlet valve, one under the control unit
    ys_base = [(i - (wells - 1) / 2) * pitch for i in range(wells)]
    skid = None
    for y in ys_base:
        b = cq.Workplane("XY").box(90.0, 84.0, skid_z).translate((header_x + 8.0, y, skid_z / 2))
        b = b.cut(cq.Workplane("XY").box(90.0 - 14, 84.0 - 14, skid_z - 3).translate((header_x + 8.0, y, skid_z / 2 + 1.5)))
        skid = b if skid is None else skid.union(b)
    skid = skid.union(cq.Workplane("XY").box(100.0, 90.0, skid_z).translate((header_x + 12.0, -skid_y / 2 + 36.0, skid_z / 2)))
    parts["WH-ZIPPER-SKID"] = skid

    pipe_od = 1.35 * bore
    y_front = -skid_y / 2 + 12.0
    # inlet isolation valve at the front end of the header, bore along Y, actuator up
    inlet = gate_valve_solid(pv, 1.0).rotate((0, 0, 0), (0, 0, 1), 90).translate((header_x, y_front + ftf / 2 + 6.0, zh))
    parts["WH-ZIPPER-INLETVALVE"] = inlet
    y_h0 = y_front + ftf + 6.0
    y_h1 = skid_y / 2 - 30.0
    header = cq.Workplane("XZ").circle(pipe_od / 2).extrude(-(y_h1 - y_h0)).translate((header_x, y_h0, zh))
    header = header.union(flange_disc(fod, fthk, bore).rotate((0, 0, 0), (1, 0, 0), -90).translate((header_x, y_h0, zh)))
    header = header.union(flange_disc(fod, fthk, bore).rotate((0, 0, 0), (1, 0, 0), -90).translate((header_x, y_h1 - fthk, zh)))
    for y in (y_h0 + 30, (y_h0 + y_h1) / 2, y_h1 - 30):
        header = header.union(cq.Workplane("XY").box(14, 8, zh - pipe_od / 2).translate((header_x, y, (zh - pipe_od / 2) / 2)))
    parts["WH-ZIPPER-INLETHEADER"] = header

    ys = [(i - (wells - 1) / 2) * pitch for i in range(wells)]
    legs = None; isov = None; workv = None; outlets = None; trans = None
    tee = 1.5 * bore
    z_riser_top = zh + tee / 2 + 12.0
    z_iso = z_riser_top + ftf / 2
    z_work = z_iso + ftf + 8.0
    z_elbow = 240.0                  # top elbow at the tree inlet height so the flanged line runs level to the inlet block
    for i, y in enumerate(ys):
        t = cq.Workplane("XY").box(tee, tee, tee).edges().fillet(0.08 * tee).translate((header_x, y, zh))
        t = t.union(cq.Workplane("XY").circle(pipe_od / 2).extrude(z_riser_top - zh).translate((header_x, y, zh)))
        t = t.union(flange_disc(fod, fthk, bore).translate((header_x, y, z_riser_top - fthk)))
        # spool between the valves
        t = t.union(cq.Workplane("XY").circle(pipe_od / 2).extrude(8.0).translate((header_x, y, z_iso + ftf / 2)))
        t = t.union(flange_disc(fod, fthk, bore).translate((header_x, y, z_iso + ftf / 2)))
        t = t.union(flange_disc(fod, fthk, bore).translate((header_x, y, z_work - ftf / 2 - fthk)))
        v1 = vertical_valve(pv, 1.0).translate((header_x, y, z_iso))
        isov = v1 if isov is None else isov.union(v1)
        v2 = vertical_valve(pv, 1.0 if i == 1 else 0.0).translate((header_x, y, z_work))
        workv = v2 if workv is None else workv.union(v2)
        # riser spool from the working valve up to the top elbow, flanged both ends
        z_wt = z_work + ftf / 2
        t = t.union(flange_disc(fod, fthk, bore).translate((header_x, y, z_wt)))
        t = t.union(cq.Workplane("XY").circle(pipe_od / 2).extrude(z_elbow - tee / 2 - z_wt).translate((header_x, y, z_wt)))
        t = t.union(flange_disc(fod, fthk, bore).translate((header_x, y, z_elbow - tee / 2 - fthk)))
        legs = t if legs is None else legs.union(t)
        # top elbow block with a flanged outlet toward the tree
        e = cq.Workplane("XY").box(tee, tee, tee).edges().fillet(0.08 * tee).translate((header_x, y, z_elbow))
        out_len = 40.0
        e = e.union(cq.Workplane("YZ").circle(pipe_od / 2).extrude(out_len).translate((header_x + tee / 2, y, z_elbow)))
        e = e.union(flange_disc(fod, fthk, bore).rotate((0, 0, 0), (0, 1, 0), 90).translate((header_x + tee / 2 + out_len - fthk, y, z_elbow)))
        e = e.union(flange_disc(fod, fthk, bore).rotate((0, 0, 0), (0, 1, 0), 90).translate((header_x + tee / 2 + out_len, y, z_elbow)))
        outlets = e if outlets is None else outlets.union(e)
        tr = cq.Workplane("XY").box(4, 4, 6).translate((header_x, y, z_elbow + tee / 2 + 3.0))
        tr = tr.union(cq.Workplane("XY").circle(1.0).extrude(2.0).translate((header_x, y, z_elbow + tee / 2)))
        trans = tr if trans is None else trans.union(tr)
    parts["WH-ZIPPER-LEG"] = legs
    parts["WH-ZIPPER-ISOVALVE"] = isov
    parts["WH-ZIPPER-VALVE"] = workv
    parts["WH-ZIPPER-OUTLET"] = outlets
    parts["WH-ZIPPER-TRANSDUCER"] = trans
    # bleed valve on the far end of the header (small manual valve, bore along Y)
    pb = valve_params(2.0625, 15.0, actuated=False)
    bleed = gate_valve_solid(pb, 0.0).rotate((0, 0, 0), (0, 0, 1), 90).translate((header_x, y_h1 + pb["face_to_face"] / 2 + 2, zh))
    parts["WH-ZIPPER-BLEEDVALVE"] = bleed
    # hydraulic control unit and accumulator bottles on the tree side of the skid, front end
    hpu = cq.Workplane("XY").box(48, 36, 44).translate((35, -(skid_y / 2) + 40, skid_z + 22))
    parts["WH-ZIPPER-HPU"] = hpu
    acc = None
    for dx in (-12, 0, 12):
        b = cq.Workplane("XY").circle(4.5).extrude(40).translate((35 + dx, -(skid_y / 2) + 72, skid_z))
        acc = b if acc is None else acc.union(b)
    parts["WH-ZIPPER-ACCUMULATOR"] = acc
    return parts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    ap.add_argument("--bore", type=float, default=7.0625)
    ap.add_argument("--rating", type=float, default=15.0)
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    combos = [(5.125, 15.0), (7.0625, 15.0), (7.0625, 10.0)] if a.all else [(a.bore, a.rating)]
    for bore, rating in combos:
        export_parts(build(3, bore, rating), a.out, "WH-ZIPPER." + size_key(bore, rating), extra_stl=False, tolerance=0.05)
