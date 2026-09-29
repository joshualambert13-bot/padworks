"""
CT-STACK: generic coiled tubing pressure control stack and injector for a drillout on a
7-1/16 in. 15K frac stack. Bottom to top: hands-free bottom adapter, quad BOP (block body with
four ram levels: pipe, slip, shear, blind; tie-rod actuators each side; equalizing and kill
ports), riser spool, side-door stripper (packer housing with hydraulic pistons), injector head
(frame, two counter-rotating chain drives with gripper blocks, hydraulic motors, load cell
skate), gooseneck (arched roller guide) with a length of coiled tubing entering the stack.
Vertical along Z, coil arriving along -X. Generic proportions from public descriptions and
field photographs read for overall size; not a manufacturer's design.

Run: python CT-STACK.py --out ../../out/CT
"""
import argparse
import math
import os
import sys

import cadquery as cq

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "WH"))
from _lib import export_parts, hex_nut, _bolt_pts, flange_spec, ROLE_COLORS  # noqa: E402

ROLE_COLORS.update({"BOTTOMADAPTER": (0.40, 0.42, 0.46), "QUADBOP": (0.28, 0.30, 0.34), "RISER": (0.30, 0.32, 0.36),
                    "STRIPPER": (0.24, 0.26, 0.30), "INJECTOR": (0.85, 0.65, 0.10), "CHAIN": (0.20, 0.21, 0.23),
                    "GOOSENECK": (0.85, 0.65, 0.10), "COIL": (0.42, 0.30, 0.22), "MOTOR": (0.20, 0.35, 0.60)})

BORE = 7.0625
COIL_OD = 2.375


def tube(r_out, r_in, h, z):
    return cq.Workplane("XY").circle(r_out).circle(r_in).extrude(h).translate((0, 0, z))


def actuator(x_sign, z, r_cyl, length, plate):
    x0 = x_sign * plate
    cyl = cq.Workplane("YZ").circle(r_cyl).extrude(length).translate((x0 if x_sign > 0 else x0 - length, 0, z))
    p1 = cq.Workplane("YZ").rect(2 * r_cyl + 1.6, 2 * r_cyl + 1.6).extrude(1.0).edges("|X").fillet(0.5).translate((x0 if x_sign > 0 else x0 - 1.0, 0, z))
    p2 = p1.translate((x_sign * (length - 1.0), 0, 0))
    a = cyl.union(p1).union(p2)
    for (y, zz) in _bolt_pts(r_cyl + 0.6, 4, math.pi / 4):
        rod = cq.Workplane("YZ").circle(0.3).extrude(length + 1.0).translate(((x0 - 0.5) if x_sign > 0 else x0 - length - 0.5, y, z + zz))
        nut = hex_nut(1.0, 0.55).rotate((0, 0, 0), (0, 1, 0), 90).translate(((x0 + length) if x_sign > 0 else x0 - length - 0.55, y, z + zz))
        a = a.union(rod).union(nut)
    return a


def build():
    f = flange_spec(BORE, 15.0)
    r_bore = BORE / 2
    parts = {}
    z = 0.0
    # hands-free bottom adapter (funnel skirt, latch collar, spool)
    skirt = cq.Workplane("XY").workplane(offset=z).circle(0.95 * f["od"] / 2).workplane(offset=0.45 * BORE).circle(0.62 * f["od"] / 2).loft()
    collar = cq.Workplane("XY").circle(0.80 * f["od"] / 2).extrude(0.55 * BORE).translate((0, 0, z + 0.45 * BORE))
    for i in range(3):
        lug = cq.Workplane("XY").box(0.9 * BORE, 0.35 * BORE, 0.55 * BORE).translate((0.80 * f["od"] / 2, 0, z + 0.45 * BORE + 0.275 * BORE))
        collar = collar.union(lug.rotate((0, 0, 0), (0, 0, 1), i * 120 + 60))
    body_h = 0.8 * BORE + 3.0
    spool = cq.Workplane("XY").circle(0.62 * f["od"] / 2).extrude(body_h).translate((0, 0, z + BORE))
    fl = cq.Workplane("XY").circle(f["od"] / 2).extrude(f["thk"]).translate((0, 0, z + BORE + body_h))
    fl = fl.cut(cq.Workplane("XY").pushPoints(_bolt_pts(f["bc"] / 2, f["n"], math.pi / f["n"])).circle(f["bolt"] / 2 + 0.06).extrude(f["thk"] + 2).translate((0, 0, z + BORE + body_h - 1)))
    ad = skirt.union(collar).union(spool).union(fl)
    ad = ad.cut(cq.Workplane("XY").circle(r_bore).extrude(body_h + 3 * BORE).translate((0, 0, z - 1)))
    parts["CT-STACK-BOTTOMADAPTER"] = ad
    z += BORE + body_h + f["thk"]
    # quad BOP: block body with four ram levels
    bop_h = 4 * (1.1 * BORE + 4.0) + 6.0
    bw = 2.0 * BORE + 6.0
    bd = 1.4 * BORE + 4.0
    body = cq.Workplane("XY").box(bw, bd, bop_h).edges("|Z").fillet(0.08 * bd).translate((0, 0, z + bop_h / 2))
    body = body.cut(cq.Workplane("XY").circle(r_bore).extrude(bop_h + 2).translate((0, 0, z - 1)))
    lvl = (bop_h - 6.0) / 4
    r_cyl = 0.34 * BORE + 1.4
    for k in range(4):
        zz = z + 3.0 + lvl * (k + 0.5)
        for sgn in (-1, 1):
            body = body.union(actuator(sgn, zz, r_cyl, 1.5 * BORE + 3.0, bw / 2))
        # side port block (kill or equalize) on the front face at two levels
        if k in (0, 2):
            port = cq.Workplane("XZ").rect(3.2, 3.2).extrude(2.4).translate((0, -bd / 2, zz))
            port = port.union(cq.Workplane("XZ").circle(2.4).extrude(0.9).translate((0, -bd / 2 - 2.4, zz)))
            body = body.union(port)
    # flanges top and bottom
    for zf in (z, z + bop_h - f["thk"]):
        flg = cq.Workplane("XY").circle(f["od"] / 2).extrude(f["thk"]).translate((0, 0, zf))
        flg = flg.cut(cq.Workplane("XY").pushPoints(_bolt_pts(f["bc"] / 2, f["n"], math.pi / f["n"])).circle(f["bolt"] / 2 + 0.06).extrude(f["thk"] + 2).translate((0, 0, zf - 1)))
        flg = flg.cut(cq.Workplane("XY").circle(r_bore).extrude(f["thk"] + 2).translate((0, 0, zf - 1)))
        body = body.union(flg)
    parts["CT-STACK-QUADBOP"] = body
    z += bop_h
    # riser spool
    rs_h = 3.0 * BORE + 8.0
    riser = tube(0.62 * f["od"] / 2, r_bore, rs_h, z)
    for zf in (z, z + rs_h - f["thk"]):
        flg = cq.Workplane("XY").circle(f["od"] / 2).extrude(f["thk"]).translate((0, 0, zf))
        flg = flg.cut(cq.Workplane("XY").pushPoints(_bolt_pts(f["bc"] / 2, f["n"], math.pi / f["n"])).circle(f["bolt"] / 2 + 0.06).extrude(f["thk"] + 2).translate((0, 0, zf - 1)))
        flg = flg.cut(cq.Workplane("XY").circle(r_bore).extrude(f["thk"] + 2).translate((0, 0, zf - 1)))
        riser = riser.union(flg)
    parts["CT-STACK-RISER"] = riser
    z += rs_h
    # side-door stripper: packer housing with two side pistons, coil passes through
    st_h = 1.6 * BORE + 8.0
    sw = 1.5 * BORE + 6.0
    strip = cq.Workplane("XY").box(sw, sw, st_h).edges("|Z").fillet(1.0).translate((0, 0, z + st_h / 2))
    strip = strip.cut(cq.Workplane("XY").circle(COIL_OD / 2 + 0.05).extrude(st_h + 2).translate((0, 0, z - 1)))
    strip = strip.union(cq.Workplane("XY").circle(f["od"] / 2).extrude(f["thk"]).translate((0, 0, z)).cut(cq.Workplane("XY").circle(COIL_OD / 2 + 0.05).extrude(f["thk"] + 2).translate((0, 0, z - 1))))
    for sgn in (-1, 1):
        pist = cq.Workplane("YZ").circle(0.22 * BORE + 1.0).extrude(0.8 * BORE + 2.0).translate((sgn * sw / 2 if sgn > 0 else -sw / 2 - 0.8 * BORE - 2.0, 0, z + st_h * 0.55))
        strip = strip.union(pist)
    # side door hinge and latch bosses
    strip = strip.union(cq.Workplane("XY").box(1.2, sw * 0.6, st_h * 0.8).translate((0, sw / 2 + 0.6, z + st_h / 2)))
    parts["CT-STACK-STRIPPER"] = strip
    z += st_h
    # injector head: frame, chain drives, motors
    inj_h = 6.0 * BORE + 40.0
    fw = 3.6 * BORE + 14.0
    fd = 1.6 * BORE + 8.0
    frame = cq.Workplane("XY").box(fw, fd, inj_h).translate((0, 0, z + inj_h / 2))
    frame = frame.cut(cq.Workplane("XY").box(fw - 4.0, fd + 2, inj_h - 6.0).translate((0, 0, z + inj_h / 2)))
    # base plate with skate and load cell
    base = cq.Workplane("XY").box(fw + 4.0, fd + 4.0, 2.0).translate((0, 0, z + 1.0))
    frame = frame.union(base)
    # motors on the back face (+Y)
    motors = None
    for sgn in (-1, 1):
        m = cq.Workplane("XZ").circle(0.5 * BORE + 1.6).extrude(0.9 * BORE + 4.0).translate((sgn * (fw / 2 - 0.9 * BORE - 3.0), -(fd / 2 + 0.9 * BORE + 4.0) * -1, z + inj_h * 0.55))
        m = cq.Workplane("XZ").circle(0.5 * BORE + 1.6).extrude(-(0.9 * BORE + 4.0)).translate((sgn * (fw / 2 - 0.9 * BORE - 3.0), fd / 2, z + inj_h * 0.55))
        motors = m if motors is None else motors.union(m)
    parts["CT-STACK-INJECTOR"] = frame
    parts["CT-STACK-MOTOR"] = motors
    # two chain loops with gripper blocks, either side of the coil
    chains = None
    cw = 0.55 * BORE + 1.6      # chain half-width from coil axis
    ch_h = inj_h - 10.0
    for sgn in (-1, 1):
        loop = cq.Workplane("YZ").rect(ch_h, 2.2).extrude(fd * 0.55).translate((sgn * (cw + 1.1), -fd * 0.275, z + inj_h / 2))
        loop = cq.Workplane("XZ").slot2D(ch_h, 4.4).extrude(fd * 0.5).translate((sgn * (cw + 1.1), fd * 0.25, z + inj_h / 2)).rotate((sgn * (cw + 1.1), 0, z + inj_h / 2), (sgn * (cw + 1.1), 0, z + inj_h / 2 + 1), 90)
        inner = cq.Workplane("XZ").slot2D(ch_h - 3.4, 1.0).extrude(fd * 0.5).translate((sgn * (cw + 1.1), fd * 0.25, z + inj_h / 2)).rotate((sgn * (cw + 1.1), 0, z + inj_h / 2), (sgn * (cw + 1.1), 0, z + inj_h / 2 + 1), 90)
        loop = loop.cut(inner)
        # gripper blocks along the inside run
        n = 14
        for k in range(n):
            zz = z + 5.0 + (ch_h - 4.0) * (k + 0.5) / n
            blk = cq.Workplane("XY").box(1.4, fd * 0.45, (ch_h - 4.0) / n * 0.8).translate((sgn * (cw + 0.5), 0, zz))
            blk = blk.cut(cq.Workplane("XY").circle(COIL_OD / 2).extrude(ch_h).translate((0, 0, z)))
            loop = loop.union(blk)
        chains = loop if chains is None else chains.union(loop)
    parts["CT-STACK-CHAIN"] = chains
    z_top = z + inj_h
    # gooseneck: arched guide over the top of the injector, coil enters from -X
    R = 3.0 * BORE + 20.0
    # build the gooseneck as a swept tube along a quarter arc
    path = cq.Workplane("XZ").moveTo(0, z_top).radiusArc((-R, z_top + R), -R)
    gn = cq.Workplane("XY").workplane(offset=z_top).circle(1.3).sweep(path)
    rollers = None
    for k in range(7):
        ang = math.radians(90 * (k + 0.5) / 7)
        x = -R + R * math.cos(ang)
        zz = z_top + R * math.sin(ang)
        roll = cq.Workplane("XY").circle(1.6).extrude(3.4).translate((0, 0, -1.7)).rotate((0, 0, 0), (1, 0, 0), 90).translate((x, 0, zz))
        rollers = roll if rollers is None else rollers.union(roll)
    gn = gn.union(rollers)
    # support brace from the frame top to the arch
    brace = cq.Workplane("XY").box(3.0, 3.0, R * 0.6).translate((-R * 0.4, 0, z_top + R * 0.3))
    gn = gn.union(brace)
    parts["CT-STACK-GOOSENECK"] = gn
    # the coil itself: down through the injector and stack, and along the arch, then off toward the reel (-X)
    coil = cq.Workplane("XY").circle(COIL_OD / 2).extrude(z_top - 2.0).translate((0, 0, 2.0))
    cpath = cq.Workplane("XZ").moveTo(0, z_top).radiusArc((-R, z_top + R), -R)
    coil_arc = cq.Workplane("XY").workplane(offset=z_top).circle(COIL_OD / 2).sweep(cpath)
    coil_out = cq.Workplane("YZ").circle(COIL_OD / 2).extrude(-60.0).translate((-R, 0, z_top + R))
    parts["CT-STACK-COIL"] = coil.union(coil_arc).union(coil_out)
    return parts, z_top + R


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out")
    a = ap.parse_args()
    parts, h = build()
    print("stack height in.", round(h, 1))
    export_parts(parts, a.out, "CT-STACK", extra_stl=False, tolerance=0.05)
