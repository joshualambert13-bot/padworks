"""
WH-TREESAVER: generic wellhead isolation tool: mandrel tube that stabs through the tree
and wellhead, landing shoulder at the top, seal cups near the bottom, top adapter.
Vertical along Z; the well bore is +Z.

Run: python WH-TREESAVER.py --out ../../out/WH
"""
import argparse
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
from _lib import export_parts  # noqa: E402


def build():
    parts = {}
    L = 72.0
    mandrel = cq.Workplane("XY").circle(3.0).extrude(L).cut(cq.Workplane("XY").circle(2.25).extrude(L + 2).translate((0, 0, -1)))
    nose = cq.Workplane("XY").circle(3.0).workplane(offset=-4.0).circle(2.4).loft().cut(cq.Workplane("XY").circle(2.25).extrude(6).translate((0, 0, -5)))
    parts["WH-TREESAVER-MANDREL"] = mandrel.union(nose.translate((0, 0, 0)))
    seals = None
    for z in (6.0, 10.0, 14.0):
        cup = cq.Workplane("XY").circle(3.7).circle(3.0).extrude(2.4).translate((0, 0, z))
        seals = cup if seals is None else seals.union(cup)
    parts["WH-TREESAVER-SEAL"] = seals
    shoulder = cq.Workplane("XY").circle(5.5).circle(3.0).extrude(3.0).translate((0, 0, L - 3.0))
    adapter = cq.Workplane("XY").circle(4.5).extrude(6.0).translate((0, 0, L)).cut(cq.Workplane("XY").circle(2.25).extrude(8).translate((0, 0, L - 1)))
    parts["WH-TREESAVER-SHOULDER"] = shoulder.union(adapter)
    return parts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    export_parts(build(), a.out, "WH-TREESAVER", extra_stl=False)
