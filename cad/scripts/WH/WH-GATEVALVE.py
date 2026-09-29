"""
WH-GATEVALVE and WH-GATEVALVE-HYD: generic API 6A style through-conduit slab gate frac valve
with a block body, manual (handwheel) and hydraulic (tie-rod actuator with balance stem) variants,
exported with every part as a named node. Sizes: 4-1/16, 5-1/8, 7-1/16 in.; 10K and 15K.

Run:
  python WH-GATEVALVE.py --out ../../out/WH --all                 (all sizes, manual and hydraulic)
  python WH-GATEVALVE.py --out ../../out/WH --bore 5.125 --rating 15 --actuated
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from _lib import valve_params, gate_valve_parts, export_parts, size_key  # noqa: E402

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--bore", type=float, default=7.0625)
    ap.add_argument("--rating", type=float, default=15.0)
    ap.add_argument("--open", action="store_true")
    ap.add_argument("--actuated", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    if a.all:
        combos = [(b, r, act) for act in (False, True) for r in (10.0, 15.0) for b in (4.0625, 5.125, 7.0625)]
    else:
        combos = [(a.bore, a.rating, a.actuated)]
    for bore, rating, act in combos:
        p = valve_params(bore, rating, act)
        name = ("WH-GATEVALVE-HYD" if act else "WH-GATEVALVE") + "." + size_key(bore, rating)
        parts = gate_valve_parts(p, 1.0 if a.open else 0.0, prefix="WH-GATEVALVE")
        export_parts(parts, a.out, name, extra_stl=False)
        print(name, "face to face", p["face_to_face"], "flange od", p["flange_od"])
