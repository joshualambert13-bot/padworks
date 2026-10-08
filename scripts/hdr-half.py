#!/usr/bin/env python3
"""Half-size copies of the sky HDRIs for phones (Drop 86).

Reads public/textures/sky_<tod>.hdr (Radiance RGBE, 2k, RLE scanlines as Poly Haven writes them), averages 2x2
blocks in linear light, and writes sky_<tod>.1k.hdr beside it (RLE as well). A phone loads the 1k copy: a quarter
of the GPU memory of the 2k map, which it cannot show the difference of anyway. No dependencies beyond numpy.

    python3 scripts/hdr-half.py [public/textures]
"""
import os, sys
import numpy as np

def read_hdr(path):
    data = open(path, 'rb').read()
    pos = 0
    header = {}
    while True:
        nl = data.index(b'\n', pos); line = data[pos:nl].decode('latin1'); pos = nl + 1
        if line == '': break
        if '=' in line: k, v = line.split('=', 1); header[k.strip()] = v.strip()
    nl = data.index(b'\n', pos); res = data[pos:nl].decode('latin1').split(); pos = nl + 1
    assert res[0] == '-Y' and res[2] == '+X', 'only -Y +X orientation is handled: ' + ' '.join(res)
    h, w = int(res[1]), int(res[3])
    buf = np.frombuffer(data, dtype=np.uint8)
    out = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        if w >= 8 and w < 32768 and buf[pos] == 2 and buf[pos + 1] == 2 and (int(buf[pos + 2]) << 8 | int(buf[pos + 3])) == w:
            pos += 4
            for c in range(4):
                x = 0
                while x < w:
                    n = int(buf[pos]); pos += 1
                    if n > 128:
                        n -= 128; out[y, x:x + n, c] = buf[pos]; pos += 1; x += n
                    else:
                        out[y, x:x + n, c] = buf[pos:pos + n]; pos += n; x += n
        else:
            out[y] = buf[pos:pos + w * 4].reshape(w, 4); pos += w * 4
    return header, out

def to_float(rgbe):
    e = rgbe[..., 3].astype(np.int32)
    scale = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)   # 2^(e-128) / 256
    return rgbe[..., :3].astype(np.float64) * scale[..., None]

def to_rgbe(rgb):
    m = rgb.max(axis=-1)
    out = np.zeros(rgb.shape[:2] + (4,), dtype=np.uint8)
    nz = m > 1e-32
    mant, exp = np.frexp(np.where(nz, m, 1.0))
    scale = np.where(nz, mant * 256.0 / m, 0.0)
    out[..., :3] = np.clip(rgb * scale[..., None], 0, 255).astype(np.uint8)
    out[..., 3] = np.where(nz, exp + 128, 0).astype(np.uint8)
    return out

def rle_line(ch):
    # ch: one channel of one scanline (uint8). Runs of 4 or more as 128+len, literals as len; max 127 at a time
    w = len(ch); x = 0; out = bytearray()
    while x < w:
        run = 1
        while x + run < w and run < 127 and ch[x + run] == ch[x]: run += 1
        if run >= 4:
            out += bytes([128 + run, int(ch[x])]); x += run; continue
        start = x
        while x < w and x - start < 128:
            r2 = 1
            while x + r2 < w and r2 < 4 and ch[x + r2] == ch[x]: r2 += 1
            if r2 >= 4: break
            x += 1
        out += bytes([x - start]) + bytes(ch[start:x])
    return bytes(out)

def write_hdr(path, header, rgbe):
    h, w = rgbe.shape[:2]
    with open(path, 'wb') as f:
        f.write(b'#?RADIANCE\n')
        for k, v in header.items(): f.write((k + '=' + v + '\n').encode('latin1'))
        f.write(b'\n')
        f.write(('-Y %d +X %d\n' % (h, w)).encode('ascii'))
        for y in range(h):
            f.write(bytes([2, 2, (w >> 8) & 255, w & 255]))
            for c in range(4): f.write(rle_line(rgbe[y, :, c]))

folder = sys.argv[1] if len(sys.argv) > 1 else 'public/textures'
for tod in ('day', 'dusk', 'night'):
    src = os.path.join(folder, 'sky_%s.hdr' % tod)
    if not os.path.exists(src): print('absent', src); continue
    header, rgbe = read_hdr(src)
    lin = to_float(rgbe)
    h, w = lin.shape[:2]
    small = lin[:h // 2 * 2, :w // 2 * 2].reshape(h // 2, 2, w // 2, 2, 3).mean(axis=(1, 3))
    out = os.path.join(folder, 'sky_%s.1k.hdr' % tod)
    write_hdr(out, {'FORMAT': '32-bit_rle_rgbe'}, to_rgbe(small))
    print('wrote', out, '%dx%d' % (w // 2, h // 2), '%d KB' % (os.path.getsize(out) // 1024), 'from %dx%d' % (w, h))
