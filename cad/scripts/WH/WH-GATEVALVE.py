"""
WH-GATEVALVE and WH-GATEVALVE-HYD: generic API 6A style through-conduit slab gate valve,
manual (handwheel) and hydraulic-actuated variants, exported with every part as a named node.

Run:
  python WH-GATEVALVE.py --out ../../out/WH               (manual, closed)
  python WH-GATEVALVE.py --out ../../out/WH --actuated    (hydraulic, writes WH-GATEVALVE-HYD)
  python WH-GATEVALVE.py --open                           (gate open)
  python WH-GATEVALVE.py --bore 7.0625                    (7-1/16 in. variant)
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from _lib import valve_params, gate_valve_parts, export_parts  # noqa: E402

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--bore", type=float, default=5.125)
    ap.add_argument("--rating", type=float, default=15.0)
    ap.add_argument("--open", action="store_true")
    ap.add_argument("--actuated", action="store_true")
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    p = valve_params(a.bore, a.rating, a.actuated)
    name = "WH-GATEVALVE-HYD" if a.actuated else "WH-GATEVALVE"
    parts = gate_valve_parts(p, 1.0 if a.open else 0.0, prefix="WH-GATEVALVE")
    export_parts(parts, a.out, name, extra_stl=False)
    print({k: round(v, 3) for k, v in p.items() if isinstance(v, float)})
