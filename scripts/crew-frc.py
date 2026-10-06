# FRC coveralls for the Mixamo crew (Drop 78). The characters come in street clothes on one texture atlas each.
# This repaints the atlas by what the skeleton says each triangle is: torso, arms and legs become coveralls in the
# crew color with the original texture's folds kept as shading, the torso gets a hi-vis vest zone with reflective
# bands at chest and waist, arms and shins get a reflective band, feet become boots, hands become gloves, and the
# head and neck stay skin. Writes <name>_frc.png next to the atlas for crew-pack.mjs to put back into the GLB.
#
#   python3 scripts/crew-frc.py public/models/crew/lewis.glb navy orange
#
# Colors: coveralls navy | tan | charcoal | gray; vest orange | yellow.
import sys, struct, json, io
import numpy as np
from PIL import Image, ImageFilter

COVERALL = {'navy': (0.17, 0.25, 0.40), 'tan': (0.70, 0.59, 0.42), 'charcoal': (0.23, 0.24, 0.26), 'gray': (0.45, 0.47, 0.50)}
VEST = {'orange': (0.95, 0.36, 0.04), 'yellow': (0.85, 0.88, 0.13)}
SILVER = (0.85, 0.86, 0.88)
BOOT = (0.22, 0.15, 0.10)
GLOVE = (0.55, 0.38, 0.22)

path = sys.argv[1]; cov = COVERALL[sys.argv[2] if len(sys.argv) > 2 else 'navy']; vest = VEST[sys.argv[3] if len(sys.argv) > 3 else 'orange']
d = open(path, 'rb').read()
ln = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + ln]); bl = struct.unpack('<I', d[20 + ln:24 + ln])[0]; b = d[28 + ln:28 + ln + bl]

def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    ct = {5126: np.float32, 5123: np.uint16, 5121: np.uint8, 5125: np.uint32}[a['componentType']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    return np.frombuffer(b, dtype=ct, count=a['count'] * n, offset=off).reshape(a['count'], n).astype(np.float64 if ct == np.float32 else np.int64)

def image_bytes(idx):
    bv = j['bufferViews'][j['images'][idx]['bufferView']]
    return b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]

# the body material is the one whose name ends in _body; its base color image is the atlas
body = next(i for i, m in enumerate(j['materials']) if m['name'].endswith('_body'))
img_idx = j['textures'][j['materials'][body]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
atlas = Image.open(io.BytesIO(image_bytes(img_idx))).convert('RGB')
W, H = atlas.size
src = np.asarray(atlas).astype(np.float64) / 255.0

skin = j['skins'][0]
joint_names = [j['nodes'][n]['name'].split(':')[-1] for n in skin['joints']]
ibm = acc(skin['inverseBindMatrices']).reshape(-1, 4, 4)   # column-major
joint_pos = np.array([np.linalg.inv(m.T)[:3, 3] for m in ibm])   # bind-pose joint positions
def jp(name):
    return joint_pos[joint_names.index(name)]

def klass(name):
    if name in ('Head', 'Neck', 'HeadTop_End'): return 'skin'
    if 'Hand' in name: return 'glove'
    if name in ('Foot', 'ToeBase', 'Toe_End') or name.endswith('Foot') or name.endswith('ToeBase') or name.endswith('Toe_End'): return 'boot'
    if name.endswith('Shoulder') or name in ('Hips', 'Spine', 'Spine1', 'Spine2'): return 'torso'
    if name.endswith('ForeArm'): return 'forearm'
    if name.endswith('Arm'): return 'arm'
    if name.endswith('UpLeg'): return 'upleg'
    if name.endswith('Leg'): return 'leg'
    return 'torso'
joint_class = [klass(n) for n in joint_names]
CLASS_ID = {'skin': 0, 'glove': 1, 'boot': 2, 'torso': 3, 'arm': 4, 'forearm': 5, 'upleg': 6, 'leg': 7}

# bone-relative parameter along a limb bone for the reflective bands
def along(p, a, bname):
    """0 at joint a, 1 at the next joint down the limb"""
    try: pa, pb = jp(a), jp(bname)
    except ValueError: return 0.0
    v = pb - pa; l = float(v @ v)
    return float(((p - pa) @ v) / l) if l > 0 else 0.0

cls_img = np.full((H, W), -1, dtype=np.int16)
band_img = np.zeros((H, W), dtype=np.float32)
vest_img = np.zeros((H, W), dtype=np.float32)
spine_y, spine2_y, neck_y = jp('Spine')[1], jp('Spine2')[1], jp('Neck')[1]

def vertex_attrs(P, J, Wt):
    n = len(P); cls = np.zeros(n, dtype=np.int16); band = np.zeros(n); vestk = np.zeros(n)
    heavy = J[np.arange(n), np.argmax(Wt, axis=1)]
    for i in range(n):
        jn = joint_names[heavy[i]]; c = joint_class[heavy[i]]; cls[i] = CLASS_ID[c]; p = P[i]
        side = 'Left' if jn.startswith('Left') else 'Right'
        if c == 'torso':
            y = p[1]
            vestk[i] = 1.0 if (spine_y - 0.04) < y < (spine2_y + 0.14) else 0.0
            band[i] = 1.0 if abs(y - (spine2_y + 0.05)) < 0.025 or abs(y - (spine_y + 0.02)) < 0.025 else 0.0
        elif c == 'arm':
            t = along(p, side + 'Arm', side + 'ForeArm'); band[i] = 1.0 if 0.55 < t < 0.78 else 0.0
        elif c == 'forearm':
            t = along(p, side + 'ForeArm', side + 'Hand'); band[i] = 1.0 if 0.6 < t < 0.82 else 0.0
        elif c == 'leg':
            t = along(p, side + 'Leg', side + 'Foot'); band[i] = 1.0 if 0.5 < t < 0.72 else 0.0
    return cls, band, vestk

def raster(uv, cls, band, vestk, tris):
    px = np.stack([uv[:, 0] * W, uv[:, 1] * H], axis=1)
    for t in tris:
        a, bb, c = px[t[0]], px[t[1]], px[t[2]]
        x0, x1 = int(max(0, np.floor(min(a[0], bb[0], c[0])) - 1)), int(min(W - 1, np.ceil(max(a[0], bb[0], c[0])) + 1))
        y0, y1 = int(max(0, np.floor(min(a[1], bb[1], c[1])) - 1)), int(min(H - 1, np.ceil(max(a[1], bb[1], c[1])) + 1))
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        det = (bb[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (bb[1] - a[1])
        if abs(det) < 1e-9: continue
        l1 = ((bb[0] - xs) * (c[1] - ys) - (c[0] - xs) * (bb[1] - ys)) / det
        l2 = ((c[0] - xs) * (a[1] - ys) - (a[0] - xs) * (c[1] - ys)) / det
        l3 = 1 - l1 - l2
        inside = (l1 >= -0.02) & (l2 >= -0.02) & (l3 >= -0.02)
        if not inside.any(): continue
        cl = [cls[t[0]], cls[t[1]], cls[t[2]]]; cmaj = max(set(cl), key=cl.count)
        region = cls_img[y0:y1 + 1, x0:x1 + 1]; region[inside] = cmaj
        bval = l1 * band[t[0]] + l2 * band[t[1]] + l3 * band[t[2]]; vval = l1 * vestk[t[0]] + l2 * vestk[t[1]] + l3 * vestk[t[2]]
        br = band_img[y0:y1 + 1, x0:x1 + 1]; br[inside] = np.maximum(br[inside], bval[inside])
        vr = vest_img[y0:y1 + 1, x0:x1 + 1]; vr[inside] = np.maximum(vr[inside], vval[inside])

for mesh in j['meshes']:
    for prim in mesh['primitives']:
        if prim.get('material') != body: continue
        P = acc(prim['attributes']['POSITION']); UV = acc(prim['attributes']['TEXCOORD_0']); J = acc(prim['attributes']['JOINTS_0']); Wt = acc(prim['attributes']['WEIGHTS_0'])
        idx = acc(prim['indices']).reshape(-1, 3) if 'indices' in prim else np.arange(len(P)).reshape(-1, 3)
        cls, band, vestk = vertex_attrs(P, J, Wt)
        raster(UV, cls, band, vestk, idx)

# dilate the painted classes by a couple of pixels so bilinear filtering at the UV seams does not show street clothes
painted = cls_img >= 1
cls_pil = Image.fromarray((cls_img + 1).astype(np.uint8))
dil = np.asarray(cls_pil.filter(ImageFilter.MaxFilter(5))).astype(np.int16) - 1
cls_use = np.where(painted, cls_img, np.where(cls_img < 0, dil, cls_img))
band_use = np.asarray(Image.fromarray(band_img).filter(ImageFilter.MaxFilter(3)))
vest_use = np.asarray(Image.fromarray(vest_img).filter(ImageFilter.MaxFilter(3)))

lum = 0.299 * src[..., 0] + 0.587 * src[..., 1] + 0.114 * src[..., 2]
out = src.copy()
def paint(mask, color, shade_floor=0.45, shade_ceil=1.5):
    if not mask.any(): return
    m = lum[mask].mean() or 0.5
    k = np.clip(lum[mask] / m, shade_floor, shade_ceil)
    out[mask] = np.array(color)[None, :] * k[:, None]
cov_mask = np.isin(cls_use, [CLASS_ID['torso'], CLASS_ID['arm'], CLASS_ID['forearm'], CLASS_ID['upleg'], CLASS_ID['leg']])
paint(cov_mask, cov)
paint((cls_use == CLASS_ID['torso']) & (vest_use > 0.5), vest, 0.6, 1.3)
paint(cov_mask & (band_use > 0.5), SILVER, 0.7, 1.25)
paint(cls_use == CLASS_ID['boot'], BOOT, 0.5, 1.6)
paint(cls_use == CLASS_ID['glove'], GLOVE, 0.5, 1.5)
# a fine weave over the coveralls so the cloth does not read as plastic
yy, xx = np.mgrid[0:H, 0:W]
weave = 1.0 + 0.035 * np.sin(xx * 1.9) * np.sin(yy * 1.9)
out[cov_mask] *= weave[cov_mask][:, None]
out = np.clip(out, 0, 1)
dst = path[:-4] + '_frc.png'
Image.fromarray((out * 255).astype(np.uint8)).save(dst)
# where the hard hat sits: the top of the head bone's own vertices above the bone, for crewmodel.jsx (via crew-pack.mjs)
head_i = joint_names.index('Head'); top = -1e9
for mesh in j['meshes']:
    for prim in mesh['primitives']:
        P = acc(prim['attributes']['POSITION']); J = acc(prim['attributes']['JOINTS_0']); Wt = acc(prim['attributes']['WEIGHTS_0'])
        heavy = J[np.arange(len(P)), np.argmax(Wt, axis=1)]
        sel = P[heavy == head_i]
        if len(sel): top = max(top, float(sel[:, 1].max()))
meta = {'hatY': round(top - float(jp('Head')[1]) - 0.035, 3), 'height': round(float(max(acc(p['attributes']['POSITION'])[:, 1].max() for m in j['meshes'] for p in m['primitives'])), 3)}
json.dump(meta, open(path[:-4] + '_meta.json', 'w'))
print('meta', meta)
print('wrote', dst, '| classes painted:', {k: int((cls_use == v).sum()) for k, v in CLASS_ID.items()})
