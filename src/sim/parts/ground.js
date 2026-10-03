// Pad stain map (Drop 44): one canvas over the pad's rectangle, drawn from the real layout, that the pad material
// multiplies into its diffuse (0.5 is neutral, darker is dirt and fluid, lighter is spilled sand). Truck lanes with
// a pair of ruts, compaction under parked units, oil under each pump's power end, the wet slurry zone around the
// blender and hydration unit, drips along the fuel row, the cellar ring at each wellhead, the wet ground at the
// flowback tanks and the water manifold, spilled sand at the boxes. Everything is drawn blurred so nothing reads
// as a hard edge at 6 px per meter. Built once per layout (the key is the layout itself) and cached.
import * as THREE from 'three';

const PX = 6;                               // pixels per meter
const cache = new Map();

// layout: { pad: {x0,x1,z0,z1}, lanes: [[[x,z],...], ...], spots: [{ x, z, rx, rz, a, light? }], rects: [{x0,z0,x1,z1,a}] }
export function padStainTexture(layout) {
  const key = JSON.stringify(layout);
  if (cache.has(key)) return cache.get(key);
  if (typeof document === 'undefined') return null;
  const { pad } = layout;
  const W = Math.round((pad.x1 - pad.x0) * PX), H = Math.round((pad.z1 - pad.z0) * PX);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const X = (x) => (x - pad.x0) * PX, Z = (z) => (z - pad.z0) * PX;
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
  const blur = (px) => { try { ctx.filter = px ? `blur(${px}px)` : 'none'; } catch { /* no filter support: hard edges */ } };

  // compaction rectangles (parking rows): a shade darker, soft edge
  blur(6);
  for (const r of layout.rects || []) {
    ctx.fillStyle = `rgba(0,0,0,${r.a})`; ctx.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * PX, (r.z1 - r.z0) * PX);
  }
  // lanes: a wide soft darkening with two ruts offset 1 m each side of the centerline
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const lane of layout.lanes || []) {
    blur(5);
    ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 3.6 * PX;
    ctx.beginPath(); lane.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)))); ctx.stroke();
    blur(1.5);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.55 * PX;
    for (let i = 1; i < lane.length; i++) {
      const [ax, az] = lane[i - 1], [bx, bz] = lane[i];
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
      for (const o of [-1.0, 1.0]) { ctx.beginPath(); ctx.moveTo(X(ax + nx * o), Z(az + nz * o)); ctx.lineTo(X(bx + nx * o), Z(bz + nz * o)); ctx.stroke(); }
    }
  }
  // spots: ellipses, dark (fluid, mud) or light (sand)
  for (const sp of layout.spots || []) {
    blur(Math.max(2, Math.min(sp.rx, sp.rz) * PX * 0.45));
    ctx.fillStyle = sp.light ? `rgba(255,255,255,${sp.a})` : `rgba(0,0,0,${sp.a})`;
    ctx.beginPath(); ctx.ellipse(X(sp.x), Z(sp.z), sp.rx * PX, sp.rz * PX, sp.rot || 0, 0, Math.PI * 2); ctx.fill();
  }
  // fine drips: small hard dots inside the dark spots marked `drips`
  blur(0.8);
  for (const sp of layout.spots || []) {
    if (!sp.drips) continue;
    let h = (sp.x * 13 + sp.z * 7) | 0;
    const rnd = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
    for (let i = 0; i < sp.drips; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
      ctx.fillStyle = `rgba(0,0,0,${0.18 + rnd() * 0.25})`;
      ctx.beginPath(); ctx.ellipse(X(sp.x + Math.cos(a) * r * sp.rx), Z(sp.z + Math.sin(a) * r * sp.rz), (0.12 + rnd() * 0.3) * PX, (0.1 + rnd() * 0.2) * PX, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  blur(0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}
