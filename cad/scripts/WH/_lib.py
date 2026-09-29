"""
Shared CadQuery builders for WH assemblies. Generic geometry: flange envelopes from a public
6BX dimension table (see cad/dims/WH/flanges.json, tier E2, verify against API 6A); body,
bonnet, and actuator proportions are the project's own, read from field photographs as size
ratios only. No manufacturer feature, part number, or branding is reproduced.
Units: inches in scripts, meters in the GLB.

Conventions: origin at the flow-path center; flow along +X; stem or vertical along +Z.
Every exported node is named with a record ID so the build check can bind it.
"""
import math
import os

import cadquery as cq

IN2M = 0.0254

# Colors by node role (last token of the node name).
ROLE_COLORS = {
    "BODY": (0.30, 0.32, 0.36), "FLANGE": (0.30, 0.32, 0.36), "SEAT": (0.75, 0.70, 0.45),
    "GATE": (0.62, 0.64, 0.68), "BONNET": (0.30, 0.32, 0.36), "PACKING": (0.15, 0.15, 0.15),
    "BEARING": (0.55, 0.50, 0.30), "STEM": (0.70, 0.72, 0.76), "HANDWHEEL": (0.10, 0.10, 0.11),
    "ACTUATOR": (0.24, 0.26, 0.30), "BALANCESTEM": (0.30, 0.32, 0.36), "GREASEFITTING": (0.70, 0.72, 0.76),
    "IN": (0.30, 0.32, 0.36), "OUT": (0.30, 0.32, 0.36),
    "UP": (0.75, 0.70, 0.45), "DOWN": (0.75, 0.70, 0.45),
    "LMV": (0.28, 0.30, 0.34), "UMV": (0.28, 0.30, 0.34), "SWAB": (0.28, 0.30, 0.34), "CROWN": (0.28, 0.30, 0.34),
    "WINGA": (0.28, 0.30, 0.34), "WINGB": (0.28, 0.30, 0.34), "MAN": (0.28, 0.30, 0.34), "HYD": (0.28, 0.30, 0.34),
    "CROSS": (0.24, 0.26, 0.30), "INLETBLOCK": (0.24, 0.26, 0.30), "STUDS": (0.62, 0.64, 0.68),
    "TREEADAPTER": (0.40, 0.42, 0.46), "GOATHEAD": (0.24, 0.26, 0.30), "TREECAP": (0.40, 0.42, 0.46), "TOPADAPTER": (0.40, 0.42, 0.46),
    "CASINGHEAD": (0.26, 0.28, 0.32), "CASINGSPOOL": (0.30, 0.32, 0.36), "TUBINGHEAD": (0.34, 0.36, 0.40),
    "CASINGHANGER": (0.55, 0.50, 0.30), "PACKOFF": (0.15, 0.15, 0.15), "TUBINGHANGER": (0.60, 0.55, 0.32),
    "LOCKDOWNSCREW": (0.70, 0.72, 0.76), "SIDEOUTLETVALVE": (0.28, 0.30, 0.34), "BPV": (0.75, 0.70, 0.45),
    "SKID": (0.85, 0.65, 0.10), "INLETHEADER": (0.24, 0.26, 0.30), "VALVE": (0.28, 0.30, 0.34),
    "OUTLET": (0.64, 0.15, 0.11), "TRANSDUCER": (0.20, 0.35, 0.60), "BLEEDVALVE": (0.28, 0.30, 0.34),
    "HPU": (0.20, 0.35, 0.60), "ACCUMULATOR": (0.70, 0.72, 0.76),
    "PUPJOINT": (0.64, 0.15, 0.11), "SWIVEL": (0.64, 0.15, 0.11), "TEE": (0.30, 0.32, 0.36),
    "CHECKVALVE": (0.30, 0.32, 0.36), "PRV": (0.30, 0.32, 0.36), "PLUGVALVE": (0.30, 0.32, 0.36),
    "HAMMERUNION": (0.24, 0.26, 0.30), "RESTRAINT": (0.85, 0.65, 0.10),
    "MANDREL": (0.70, 0.72, 0.76), "SEAL": (0.15, 0.15, 0.15), "SHOULDER": (0.55, 0.50, 0.30),
}

# Public 6BX flange envelope, inches (converted from a vendor metric table; tier E2; verify against API 6A).
# key: (bore, rating_ksi) -> od, bolt circle, bolt count, stud diameter, flange thickness
FLANGES = {
    (4.0625, 10.0): dict(od=12.40, bc=10.19, n=8, bolt=1.125, thk=2.77, ring="BX-155"),
    (5.125, 10.0): dict(od=14.17, bc=11.81, n=12, bolt=1.125, thk=3.13, ring="BX-169"),
    (7.0625, 10.0): dict(od=18.90, bc=15.87, n=12, bolt=1.5, thk=4.06, ring="BX-156"),
    (4.0625, 15.0): dict(od=14.17, bc=11.44, n=8, bolt=1.375, thk=3.09, ring="BX-155"),
    (5.125, 15.0): dict(od=16.54, bc=13.50, n=12, bolt=1.5, thk=3.88, ring="BX-169"),
    (7.0625, 15.0): dict(od=19.88, bc=16.87, n=16, bolt=1.5, thk=4.69, ring="BX-156"),
}
# End-to-end (face to face) of flanged gate valves, inches. Estimates (tier E4) pending a check against API 6A.
FACE_TO_FACE = {
    (4.0625, 10.0): 29.5, (5.125, 10.0): 35.5, (7.0625, 10.0): 40.5,
    (4.0625, 15.0): 30.0, (5.125, 15.0): 36.0, (7.0625, 15.0): 44.5,
}
SIZE_KEY = {4.0625: "4", 5.125: "5", 7.0625: "7"}


def size_key(bore, rating_ksi):
    return f"{SIZE_KEY.get(bore, str(bore))}-{int(rating_ksi)}K"


def flange_spec(bore, rating_ksi):
    """Nearest tabulated flange; interpolates by bore for sizes outside the table."""
    if (bore, rating_ksi) in FLANGES:
        return dict(FLANGES[(bore, rating_ksi)])
    k = 1.0 + (rating_ksi - 10.0) * 0.06
    return dict(od=2.55 * bore * k, bc=2.15 * bore * k, n=8 if bore < 4 else 12, bolt=1.125 if bore < 4 else 1.375, thk=0.62 * bore ** 0.5 * k, ring="BX")


# --------------------------------------------------------------------------- gate valve
def valve_params(bore=5.125, rating_ksi=15.0, actuated=False):
    """Proportions of a through-conduit slab gate frac valve with a block body.
    Ratios come from photographs read at the level of overall size only."""
    f = flange_spec(bore, rating_ksi)
    p = {"bore": bore, "rating_ksi": rating_ksi, "actuated": actuated}
    p["flange_od"] = f["od"]
    p["flange_thk"] = f["thk"]
    p["bolt_circle"] = f["bc"]
    p["bolt_n"] = f["n"]
    p["bolt_d"] = f["bolt"]
    p["raised_face_od"] = 0.62 * f["od"]
    p["raised_face_h"] = 0.25
    p["ring_groove_d"] = 0.5 * f["od"]
    p["ring_groove_w"] = 0.09 * bore + 0.2
    p["face_to_face"] = FACE_TO_FACE.get((bore, rating_ksi), 31.5 * (bore / 5.125) ** 0.5)
    travel = bore + 0.75
    p["gate_travel"] = travel
    p["gate_thk"] = 0.28 * bore + 0.6
    p["gate_w"] = 1.45 * bore + 1.0
    p["gate_top"] = bore / 2 + 1.2
    p["gate_bottom"] = -(travel + bore / 2 + 0.5)
    p["gate_h"] = p["gate_top"] - p["gate_bottom"]
    # block body: across the bore (Y) about 0.85 of the flange OD, tall enough for the gate cavity
    p["body_w"] = 0.85 * f["od"]
    cav_top = p["gate_top"] + travel + 0.6
    cav_bot = p["gate_bottom"] - 0.6
    p["body_h"] = 2 * (max(cav_top, -cav_bot) + 0.12 * bore + 1.0)
    p["body_len"] = 0.62 * (p["face_to_face"] - 2 * f["thk"])
    p["hub_od"] = 0.78 * f["od"]
    p["hub_len"] = (p["face_to_face"] - 2 * f["thk"] - p["body_len"]) / 2
    p["seat_od"] = 1.42 * bore
    p["seat_len"] = 0.45 * bore + 0.8
    # bonnet: round flange with studs and nuts on the stem side
    p["bonnet_od"] = 0.90 * f["od"]
    p["bonnet_thk"] = 0.62 * f["thk"]
    p["bonnet_n"] = 8 if bore < 5 else 12
    p["bonnet_stud_d"] = 0.8 * f["bolt"]
    p["bonnet_neck_od"] = 0.55 * f["od"]
    p["bonnet_neck_h"] = 0.18 * bore + 0.6
    p["stem_d"] = 0.26 * bore + 0.4
    p["packing_od"] = 0.42 * f["od"]
    p["packing_h"] = 0.5 * bore + 1.0
    p["bearing_od"] = 0.36 * f["od"]
    p["bearing_h"] = 0.35 * bore + 1.2
    p["housing_od"] = 0.30 * f["od"]
    p["housing_h"] = travel + 0.4 * bore      # stem protector tube with indicator holes
    p["handwheel_d"] = 2.2 * bore + 6.0
    p["handwheel_rim"] = 0.22 * bore + 0.5
    # hydraulic actuator: tie-rod cylinder above a bonnet adapter, indicator tube on top
    p["act_cyl_d"] = 1.35 * bore + 3.0
    p["act_cyl_h"] = 2.0 * travel + 0.9 * bore
    p["act_plate_t"] = 0.16 * bore + 0.6
    p["act_rod_d"] = 0.14 * bore + 0.5
    p["bal_od"] = 0.38 * f["od"]
    p["bal_h"] = travel + 0.6 * bore
    z_bon = p["body_h"] / 2 + p["bonnet_neck_h"] + p["bonnet_thk"]
    p["z_bonnet_top"] = z_bon
    p["stem_len"] = (z_bon + p["packing_h"] + p["bearing_h"] + p["housing_h"] + 1.0) - p["gate_top"]
    return p


def _bolt_pts(r, n, phase=0.0):
    return [(r * math.cos(2 * math.pi * i / n + phase), r * math.sin(2 * math.pi * i / n + phase)) for i in range(n)]


def hex_nut(across_flats, h):
    return cq.Workplane("XY").polygon(6, across_flats / math.cos(math.pi / 6)).extrude(h)


def v_body(p):
    L, W, H = p["body_len"], p["body_w"], p["body_h"]
    b = cq.Workplane("XY").box(L, W, H).edges("|Z").fillet(0.08 * W)
    try:
        b = b.edges("|X").fillet(0.035 * W)
    except Exception:
        pass
    for sgn in (-1, 1):   # hubs toward the end flanges
        hub = cq.Workplane("YZ").circle(p["hub_od"] / 2).extrude(p["hub_len"] + 0.5)
        hub = hub.translate((L / 2 - 0.5 if sgn > 0 else -L / 2 - p["hub_len"], 0, 0))
        b = b.union(hub)
    b = b.cut(cq.Workplane("YZ").circle(p["bore"] / 2).extrude(L + 2 * p["hub_len"] + 4, both=True))
    cav_bot = p["gate_bottom"] - 0.6
    cav_top = p["gate_top"] + p["gate_travel"] + 0.6
    cav = cq.Workplane("XY").box(p["gate_thk"] * 1.3, p["gate_w"] * 1.08, cav_top - cav_bot).edges("|X").fillet(0.4)
    b = b.cut(cav.translate((0, 0, (cav_top + cav_bot) / 2)))
    for sgn in (-1, 1):
        pocket = (cq.Workplane("YZ").circle(p["seat_od"] / 2).extrude(p["seat_len"])
                  .translate((sgn * p["gate_thk"] * 0.65 + (0 if sgn > 0 else -p["seat_len"]), 0, 0)))
        b = b.cut(pocket)
    # bonnet neck on the stem side; a plain boss on the far side (balance stem seat when actuated)
    neck = cq.Workplane("XY").circle(p["bonnet_neck_od"] / 2).extrude(p["bonnet_neck_h"] + 0.5).translate((0, 0, H / 2 - 0.5))
    b = b.union(neck)
    boss = cq.Workplane("XY").circle(p["bonnet_neck_od"] / 2).extrude(0.3 * p["bonnet_neck_h"] + 0.5).translate((0, 0, -H / 2 - 0.3 * p["bonnet_neck_h"]))
    b = b.union(boss)
    b = b.cut(cq.Workplane("XY").circle(p["stem_d"] / 2 + 0.04).extrude(H + 4).translate((0, 0, -H / 2 - 2)))
    return b


def v_flange(p, side):
    t, od = p["flange_thk"], p["flange_od"]
    x0 = side * (p["body_len"] / 2 + p["hub_len"])
    f = cq.Workplane("YZ").circle(od / 2).extrude(t).edges().chamfer(0.12 * t)
    rf = cq.Workplane("YZ").circle(p["raised_face_od"] / 2).extrude(p["raised_face_h"])
    if side > 0:
        f = f.translate((x0, 0, 0)).union(rf.translate((x0 + t, 0, 0)))
        xg = x0 + t + p["raised_face_h"]
    else:
        f = f.translate((x0 - t, 0, 0)).union(rf.translate((x0 - t - p["raised_face_h"], 0, 0)))
        xg = x0 - t - p["raised_face_h"]
    f = f.cut(cq.Workplane("YZ").circle(p["bore"] / 2).extrude(4 * t, both=True).translate((x0, 0, 0)))
    holes = cq.Workplane("YZ").pushPoints(_bolt_pts(p["bolt_circle"] / 2, p["bolt_n"], math.pi / p["bolt_n"])).circle(p["bolt_d"] / 2 + 0.06).extrude(4 * t, both=True).translate((x0, 0, 0))
    f = f.cut(holes)
    groove = cq.Workplane("YZ").circle(p["ring_groove_d"] / 2 + p["ring_groove_w"] / 2).circle(p["ring_groove_d"] / 2 - p["ring_groove_w"] / 2).extrude(0.7 * p["ring_groove_w"], both=True).translate((xg, 0, 0))
    return f.cut(groove)


def v_seat(p, side):
    s = cq.Workplane("YZ").circle(p["seat_od"] / 2 - 0.02).circle(p["bore"] / 2).extrude(p["seat_len"] - 0.05)
    x = side * p["gate_thk"] * 0.65 + (0.025 if side > 0 else -(p["seat_len"] - 0.025))
    return s.translate((x, 0, 0))


def v_gate(p, open_fraction):
    zc = (p["gate_top"] + p["gate_bottom"]) / 2
    g = cq.Workplane("XY").box(p["gate_thk"], p["gate_w"], p["gate_h"]).edges("|X").fillet(0.3 * p["gate_thk"]).translate((0, 0, zc))
    port = cq.Workplane("YZ").circle(p["bore"] / 2).extrude(p["gate_thk"] + 1, both=True).translate((0, 0, -p["gate_travel"]))
    g = g.cut(port)
    return g.translate((0, 0, p["gate_travel"] * open_fraction))


def v_bonnet(p):
    z0 = p["body_h"] / 2 + p["bonnet_neck_h"]
    b = cq.Workplane("XY").circle(p["bonnet_od"] / 2).extrude(p["bonnet_thk"]).edges(">Z").chamfer(0.15 * p["bonnet_thk"]).translate((0, 0, z0))
    b = b.cut(cq.Workplane("XY").circle(p["stem_d"] / 2 + 0.03).extrude(p["bonnet_thk"] + 1).translate((0, 0, z0 - 0.5)))
    r = p["bonnet_od"] / 2 - 0.9 * p["bonnet_stud_d"]
    for (x, y) in _bolt_pts(r, p["bonnet_n"]):
        stud = cq.Workplane("XY").circle(p["bonnet_stud_d"] / 2).extrude(p["bonnet_thk"] + 1.6 * p["bonnet_stud_d"]).translate((x, y, z0 - 0.3))
        nut = hex_nut(1.55 * p["bonnet_stud_d"], 0.9 * p["bonnet_stud_d"]).translate((x, y, z0 + p["bonnet_thk"]))
        b = b.union(stud).union(nut)
    return b


def v_packing(p):
    z0 = p["z_bonnet_top"]
    s = cq.Workplane("XY").circle(p["packing_od"] / 2).circle(p["stem_d"] / 2 + 0.02).extrude(p["packing_h"]).translate((0, 0, z0))
    return s


def v_bearing(p):
    z0 = p["z_bonnet_top"] + p["packing_h"]
    s = cq.Workplane("XY").circle(p["bearing_od"] / 2).circle(p["stem_d"] / 2 + 0.02).extrude(p["bearing_h"])
    ch = min(0.3, 0.25 * (p["bearing_od"] / 2 - p["stem_d"] / 2 - 0.02))
    try:
        s = s.edges(">Z").chamfer(ch)
    except Exception:
        pass
    return s.translate((0, 0, z0))


def v_housing(p):
    """Stem protector tube above the bearing cap with position indicator slots."""
    z0 = p["z_bonnet_top"] + p["packing_h"] + p["bearing_h"]
    h = p["housing_h"]
    t = cq.Workplane("XY").circle(p["housing_od"] / 2).circle(p["housing_od"] / 2 - 0.35).extrude(h).translate((0, 0, z0))
    for k in range(3):
        hole = cq.Workplane("YZ").circle(0.12 * p["housing_od"]).extrude(p["housing_od"] + 1, both=True).translate((0, 0, z0 + h * (0.25 + 0.25 * k)))
        t = t.cut(hole)
    return t


def v_stem(p, open_fraction):
    s = cq.Workplane("XY").circle(p["stem_d"] / 2).extrude(p["stem_len"]).translate((0, 0, p["gate_top"]))
    return s.translate((0, 0, p["gate_travel"] * open_fraction))


def v_handwheel(p):
    z0 = p["z_bonnet_top"] + p["packing_h"] + p["bearing_h"] + p["housing_h"] + 0.4
    d, rim = p["handwheel_d"], p["handwheel_rim"]
    wheel = cq.Workplane("XY").circle(d / 2).circle(d / 2 - rim).extrude(0.9 * rim)
    hub = cq.Workplane("XY").circle(0.75 * p["stem_d"] + 0.6).extrude(1.6 * rim)
    w = wheel.union(hub)
    n = 3 if p["bore"] < 4 else 4
    for i in range(n):
        spoke = cq.Workplane("XY").box(d / 2 - rim / 2, 0.55 * rim, 0.6 * rim).translate((d / 4, 0, 0.45 * rim))
        w = w.union(spoke.rotate((0, 0, 0), (0, 0, 1), i * 360 / n))
    return w.translate((0, 0, z0))


def v_actuator(p):
    """Tie-rod hydraulic actuator: bonnet adapter, lower plate, cylinder, upper plate, four tie rods, indicator tube."""
    z0 = p["z_bonnet_top"]
    ad_h = 0.6 * p["bore"] + 1.0
    adapter = cq.Workplane("XY").circle(p["packing_od"] / 2).extrude(ad_h).translate((0, 0, z0))
    z1 = z0 + ad_h
    D, T, H = p["act_cyl_d"], p["act_plate_t"], p["act_cyl_h"]
    lower = cq.Workplane("XY").rect(D + 1.6 * p["act_rod_d"] + 1.0, D + 1.6 * p["act_rod_d"] + 1.0).extrude(T).edges("|Z").fillet(0.8).translate((0, 0, z1))
    cyl = cq.Workplane("XY").circle(D / 2).extrude(H).translate((0, 0, z1 + T))
    upper = lower.translate((0, 0, T + H))
    a = adapter.union(lower).union(cyl).union(upper)
    r = D / 2 + 0.8 * p["act_rod_d"] + 0.1
    for (x, y) in _bolt_pts(r, 4, math.pi / 4):
        rod = cq.Workplane("XY").circle(p["act_rod_d"] / 2).extrude(H + 2 * T + 1.2).translate((x, y, z1 - 0.6))
        nut = hex_nut(1.6 * p["act_rod_d"], 0.9 * p["act_rod_d"]).translate((x, y, z1 + 2 * T + H))
        a = a.union(rod).union(nut)
    # hydraulic ports on the cylinder, indicator tube on top
    for zz in (z1 + T + 0.12 * H, z1 + T + 0.88 * H):
        port = cq.Workplane("YZ").circle(0.28).extrude(0.9).translate((D / 2 - 0.1, 0, zz))
        a = a.union(port)
    ind_h = p["gate_travel"] + 1.5
    ind = cq.Workplane("XY").circle(0.14 * D).circle(0.14 * D - 0.25).extrude(ind_h).translate((0, 0, z1 + 2 * T + H))
    for k in range(3):
        ind = ind.cut(cq.Workplane("YZ").circle(0.05 * D).extrude(D, both=True).translate((0, 0, z1 + 2 * T + H + ind_h * (0.25 + 0.25 * k))))
    a = a.union(ind)
    return a


def v_balance_stem(p):
    """Balance stem housing on the side opposite the actuator (hydraulic valves)."""
    z0 = -p["body_h"] / 2 - 0.3 * p["bonnet_neck_h"]
    h = p["bal_h"]
    fl = cq.Workplane("XY").circle(0.75 * p["bonnet_od"] / 2).extrude(0.7 * p["bonnet_thk"]).translate((0, 0, z0 - 0.7 * p["bonnet_thk"]))
    r = 0.75 * p["bonnet_od"] / 2 - 0.9 * p["bonnet_stud_d"]
    for (x, y) in _bolt_pts(r, p["bonnet_n"]):
        stud = cq.Workplane("XY").circle(p["bonnet_stud_d"] / 2).extrude(0.7 * p["bonnet_thk"] + 1.4 * p["bonnet_stud_d"]).translate((x, y, z0 - 0.7 * p["bonnet_thk"] - 1.1 * p["bonnet_stud_d"]))
        nut = hex_nut(1.55 * p["bonnet_stud_d"], 0.9 * p["bonnet_stud_d"]).translate((x, y, z0 - 0.7 * p["bonnet_thk"] - 0.9 * p["bonnet_stud_d"]))
        fl = fl.union(stud).union(nut)
    tube = cq.Workplane("XY").circle(p["bal_od"] / 2).extrude(h).translate((0, 0, z0 - 0.7 * p["bonnet_thk"] - h))
    cap = cq.Workplane("XY").circle(p["bal_od"] / 2 + 0.3).extrude(0.5).translate((0, 0, z0 - 0.7 * p["bonnet_thk"] - h - 0.5))
    return fl.union(tube).union(cap)


def v_grease_fittings(p):
    """Two grease fittings on the body: one on the bonnet neck, one on the far boss."""
    g = None
    for (x, y, z, ax) in ((0.55 * p["bonnet_neck_od"] / 2 + 0.2, 0, p["body_h"] / 2 + 0.5 * p["bonnet_neck_h"], 1),
                         (0.55 * p["bonnet_neck_od"] / 2 + 0.2, 0, -p["body_h"] / 2 - 0.15 * p["bonnet_neck_h"], 1)):
        boss = hex_nut(0.9, 0.7).rotate((0, 0, 0), (0, 1, 0), 90).translate((x, y, z))
        nip = cq.Workplane("YZ").circle(0.22).extrude(0.9).translate((x + 0.6, y, z))
        ball = cq.Workplane("YZ").circle(0.3).extrude(0.4).translate((x + 1.4, y, z))
        f = boss.union(nip).union(ball)
        g = f if g is None else g.union(f)
    return g


def gate_valve_parts(p, open_fraction=0.0, prefix="WH-GATEVALVE"):
    """Named parts of one gate valve in the local frame (bore +X, stem +Z)."""
    parts = {
        prefix + "-BODY": v_body(p),
        prefix + "-FLANGE-IN": v_flange(p, -1),
        prefix + "-FLANGE-OUT": v_flange(p, +1),
        prefix + "-SEAT-UP": v_seat(p, -1),
        prefix + "-SEAT-DOWN": v_seat(p, +1),
        prefix + "-GATE": v_gate(p, open_fraction),
        prefix + "-BONNET": v_bonnet(p),
        prefix + "-PACKING": v_packing(p),
        prefix + "-BEARING": v_bearing(p),
        prefix + "-STEM": v_stem(p, open_fraction),
        prefix + "-GREASEFITTING": v_grease_fittings(p),
    }
    if p["actuated"]:
        parts[prefix + "-ACTUATOR"] = v_actuator(p)
        parts[prefix + "-BALANCESTEM"] = v_balance_stem(p)
    else:
        parts[prefix + "-BEARING"] = parts[prefix + "-BEARING"].union(v_housing(p))
        parts[prefix + "-HANDWHEEL"] = v_handwheel(p)
    return parts


def gate_valve_solid(p, open_fraction=0.0, interior=False):
    """One fused solid of a whole valve for use inside a bigger assembly.
    interior=False drops the seats and gate (hidden inside the body) to save triangles."""
    parts = gate_valve_parts(p, open_fraction)
    solid = None
    for k, s in parts.items():
        if not interior and (k.endswith("-SEAT-UP") or k.endswith("-SEAT-DOWN") or k.endswith("-GATE")):
            continue
        solid = s if solid is None else solid.union(s)
    return solid


def stud_ring(p, x_face, n=None, side=+1):
    """Studs and nuts through a pair of mated end flanges at plane x_face (flow along X)."""
    n = n or p["bolt_n"]
    t = p["flange_thk"]
    L = 2 * t + 2 * 1.6 * p["bolt_d"] + 0.4
    ring = None
    for (y, z) in _bolt_pts(p["bolt_circle"] / 2, n, math.pi / n):
        stud = cq.Workplane("YZ").circle(p["bolt_d"] / 2).extrude(L).translate((x_face - L / 2, y, z))
        n1 = hex_nut(1.6 * p["bolt_d"], 0.95 * p["bolt_d"]).rotate((0, 0, 0), (0, 1, 0), 90).translate((x_face + t + 0.05, y, z))
        n2 = hex_nut(1.6 * p["bolt_d"], 0.95 * p["bolt_d"]).rotate((0, 0, 0), (0, 1, 0), 90).translate((x_face - t - 0.05 - 0.95 * p["bolt_d"], y, z))
        s = stud.union(n1).union(n2)
        ring = s if ring is None else ring.union(s)
    return ring


# --------------------------------------------------------------------------- generic pieces
def flanged_spool(bore, od, height, flange_od, flange_thk, bolt_n=12, bolt_d=1.375, bolt_circle=None):
    """Vertical spool along Z with flanges top and bottom, bore through."""
    bc = bolt_circle or (flange_od - 2.2 * bolt_d)
    body = cq.Workplane("XY").circle(od / 2).extrude(height - 2 * flange_thk).translate((0, 0, flange_thk))
    fl = cq.Workplane("XY").circle(flange_od / 2).extrude(flange_thk).edges().chamfer(0.12 * flange_thk)
    ft = fl.translate((0, 0, height - flange_thk))
    s = body.union(fl).union(ft)
    s = s.cut(cq.Workplane("XY").circle(bore / 2).extrude(height + 2).translate((0, 0, -1)))
    holes = cq.Workplane("XY").pushPoints(_bolt_pts(bc / 2, bolt_n, math.pi / bolt_n)).circle(bolt_d / 2 + 0.06).extrude(height + 2).translate((0, 0, -1))
    return s.cut(holes)


def block_cross(bore, p, height, outlets=(-1, 1), hub_len=None):
    """Studded block cross: vertical bore, flanged outlet hubs along X on the sides listed."""
    cw = p["body_w"]
    hub_len = hub_len or (0.9 * p["flange_thk"] + 2.0)
    cross = cq.Workplane("XY").box(cw, cw, height).edges("|Z").fillet(0.08 * cw).edges("|X").fillet(0.04 * cw)
    cross = cross.cut(cq.Workplane("XY").circle(bore / 2).extrude(height + 2).translate((0, 0, -1)))
    for sgn in outlets:
        hub = cq.Workplane("YZ").circle(p["flange_od"] / 2).extrude(hub_len).edges().chamfer(0.3)
        hub = hub.cut(cq.Workplane("YZ").pushPoints(_bolt_pts(p["bolt_circle"] / 2, p["bolt_n"], math.pi / p["bolt_n"])).circle(p["bolt_d"] / 2 + 0.06).extrude(hub_len + 2).translate((-1, 0, 0)))
        hub = hub.translate((cw / 2 if sgn > 0 else -cw / 2 - hub_len, 0, 0))
        cross = cross.union(hub)
        cross = cross.cut(cq.Workplane("YZ").circle(bore / 2).extrude(cw + 2 * hub_len + 2, both=True))
    return cross.translate((0, 0, height / 2))


def side_outlet(od_nozzle, length, flange_od, flange_thk, direction=1, z=0.0, from_r=0.0):
    """Horizontal nozzle with a flange along +X (direction=1) or -X (direction=-1)."""
    n = cq.Workplane("YZ").circle(od_nozzle / 2).extrude(length)
    f = cq.Workplane("YZ").circle(flange_od / 2).extrude(flange_thk).translate((length, 0, 0))
    s = n.union(f)
    if direction < 0:
        s = s.mirror("YZ")
    return s.translate((direction * from_r, 0, z))


def pipe_x(r, length, x0=0.0):
    return cq.Workplane("YZ").circle(r).extrude(length).translate((x0, 0, 0))


def wing_nut(r_pipe, x0):
    """Hammer union wing nut: ring with three lugs."""
    ring = cq.Workplane("YZ").circle(r_pipe * 1.75).circle(r_pipe * 1.05).extrude(1.6).translate((x0, 0, 0))
    for i in range(3):
        lug = cq.Workplane("YZ").rect(0.9, r_pipe * 1.1).extrude(1.6).translate((x0, 0, r_pipe * 2.0))
        ring = ring.union(lug.rotate((0, 0, 0), (1, 0, 0), i * 120))
    return ring


# --------------------------------------------------------------------------- export
def export_parts(parts, outdir, name, extra_stl=True, tolerance=0.03):
    os.makedirs(outdir, exist_ok=True)
    asm = cq.Assembly(name=name)
    for pid, solid in parts.items():
        asm.add(solid, name=pid)
    asm.save(os.path.join(outdir, f"{name}.step"))
    import trimesh
    scene = trimesh.Scene()
    for pid, solid in parts.items():
        stl = os.path.join(outdir, f"{pid}.stl")
        cq.exporters.export(solid, stl, tolerance=tolerance, angularTolerance=0.2)
        m = trimesh.load(stl, force="mesh")
        m.apply_scale(IN2M)
        role = pid.split("-")[-1]
        if role.isdigit():
            role = pid.split("-")[-2]
        rgb = ROLE_COLORS.get(role, (0.5, 0.5, 0.5))
        m.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
            baseColorFactor=[rgb[0], rgb[1], rgb[2], 1.0], metallicFactor=0.6, roughnessFactor=0.5, name=role))
        scene.add_geometry(m, node_name=pid, geom_name=pid)
        if not extra_stl:
            os.remove(stl)
    out = os.path.join(outdir, f"{name}.glb")
    scene.export(out)
    print("wrote", out, os.path.getsize(out), "bytes,", len(parts), "nodes")
    return out
