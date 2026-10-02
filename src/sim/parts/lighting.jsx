// Rendering pass (Drop 12): procedural sky dome, image-based lighting from that dome, canvas textures for the
// ground and for paint wear, and blob contact shadows. Everything is generated in the browser; no image files,
// no network fetch, nothing from a manufacturer.
import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';

// Render quality. Full: sky environment map, soft shadows, bump maps. Lite (?lite=1, or localStorage
// padworks.lite=1): hard shadows, no environment map, no bump maps; for slow machines and the headless checks.
export const LITE = (() => {
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.has('lite')) return q.get('lite') !== '0';
    const saved = window.localStorage.getItem('padworks.lite');
    if (saved === '1') return true;
    if (saved === '0') return false;
    return window.matchMedia('(max-width: 899px)').matches;   // phones default to lite until the user chooses
  } catch { return false; }
})();
export function setLite(on) { try { window.localStorage.setItem('padworks.lite', on ? '1' : '0'); } catch { /* ignore */ } window.location.reload(); }

// ---------------------------------------------------------------- canvas textures (cached)
const texCache = new Map();
const hash2 = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
function vnoiseWrapped(x, z, period) {
  const i = Math.floor(x), j = Math.floor(z), fx = smooth(x - i), fz = smooth(z - j);
  const h = (a, b) => hash2(((a % period) + period) % period, ((b % period) + period) % period);
  return lerp(lerp(h(i, j), h(i + 1, j), fx), lerp(h(i, j + 1), h(i + 1, j + 1), fx), fz);
}
// Tileable fractal value noise as a grayscale texture. `octaves` layers, `base` brightness, `amp` contrast.
export function noiseTexture(key, { size = 256, octaves = 4, base = 0.5, amp = 0.5, period = 8, repeat = 1 } = {}) {
  const k = key + size + octaves + base + amp + period;
  if (texCache.has(k)) return texCache.get(k);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, a = 1, f = period, norm = 0;
    for (let o = 0; o < octaves; o++) { v += a * vnoiseWrapped(x / size * f, y / size * f, f); norm += a; a *= 0.5; f *= 2; }
    v = base + (v / norm - 0.5) * 2 * amp;
    const g = Math.max(0, Math.min(255, Math.round(v * 255)));
    const p = (y * size + x) * 4; img.data[p] = g; img.data[p + 1] = g; img.data[p + 2] = g; img.data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  texCache.set(k, tex);
  return tex;
}
// Pad surface: gravel noise with tire-track streaks and darker patches, tinted by the material color.
export function padTexture() {
  const k = 'pad';
  if (texCache.has(k)) return texCache.get(k);
  if (typeof document === 'undefined') return null;
  const size = 512;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, a = 1, f = 6, norm = 0;
    for (let o = 0; o < 5; o++) { v += a * vnoiseWrapped(x / size * f, y / size * f, f); norm += a; a *= 0.55; f *= 2; }
    v = 0.66 + (v / norm - 0.5) * 0.42;
    const g = Math.max(0, Math.min(255, Math.round(v * 255)));
    const p = (y * size + x) * 4; img.data[p] = g; img.data[p + 1] = g; img.data[p + 2] = g; img.data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // wheel ruts and stains
  ctx.globalAlpha = 0.13; ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) { const y0 = 20 + i * 36 + (hash2(i, 3) - 0.5) * 20; ctx.beginPath(); ctx.moveTo(-20, y0); ctx.bezierCurveTo(size * 0.3, y0 + (hash2(i, 5) - 0.5) * 40, size * 0.7, y0 + (hash2(i, 7) - 0.5) * 40, size + 20, y0 + (hash2(i, 9) - 0.5) * 30); ctx.stroke(); }
  ctx.globalAlpha = 0.09; ctx.fillStyle = '#000';
  for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.ellipse(hash2(i, 11) * size, hash2(i, 13) * size, 12 + hash2(i, 17) * 30, 8 + hash2(i, 19) * 20, hash2(i, 23) * Math.PI, 0, Math.PI * 2); ctx.fill(); }
  // pebbles: small light and dark grains, and a few larger stones with a shadow side
  for (let i = 0; i < 2600; i++) { const x = hash2(i, 31) * size, y = hash2(i, 37) * size, r = 0.6 + hash2(i, 41) * 1.6; ctx.globalAlpha = 0.1 + hash2(i, 43) * 0.16; ctx.fillStyle = hash2(i, 47) > 0.45 ? '#fff' : '#000'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  for (let i = 0; i < 60; i++) { const x = hash2(i, 53) * size, y = hash2(i, 59) * size, r = 1.5 + hash2(i, 61) * 2.5; ctx.globalAlpha = 0.28; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x + 1.2, y + 1.2, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  texCache.set(k, tex);
  return tex;
}

// Rock textures for the downhole section (Drop 29): shale with fine wavy laminae, fissility breaks, and silt
// bands; sandstone with grain and cross-bedded sets between flat set boundaries; limestone with nodular mottling,
// stylolites (jagged pressure-solution seams), and sparse vertical joints. 512 px, grayscale; the bed color tints.
export function rockTexture(kind) {
  const k = 'rock-' + kind;
  if (texCache.has(k)) return texCache.get(k);
  if (typeof document === 'undefined') return null;
  const size = 512;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const sets = Array.from({ length: 12 }, (_, i) => ({ y0: i * size / 12, dip: ((i * 7) % 5 - 2) * 0.12, phase: hash2(i, 41) * 50 }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    let v1 = 0, a = 1, f = kind === 'sand' ? 14 : 6, norm = 0;
    for (let o = 0; o < 5; o++) { v1 += a * vnoiseWrapped(u * f, v * f, f); norm += a; a *= 0.55; f *= 2; }
    const n = v1 / norm - 0.5;
    let g;
    if (kind === 'shale') {
      g = 0.5 + n * 0.22;
      const wave = vnoiseWrapped(u * 5, v * 3, 5) * 3.5;                 // laminae wander a little
      const lam = Math.sin((y + wave) * 1.05);
      if (lam > 0.72) g -= 0.16 * (lam - 0.72) / 0.28;
      const silt = vnoiseWrapped(u * 2, v * 9, 9); if (silt > 0.74) g += 0.12;   // lighter silt bands
      const brk = vnoiseWrapped(u * 40, v * 40, 40); if (brk > 0.9 && lam > 0.5) g -= 0.2;   // fissility breaks along laminae
    } else if (kind === 'sand') {
      g = 0.64 + n * 0.5;
      const set = sets[Math.floor(v * 12) % 12];
      const inSet = (y - set.y0) / (size / 12);
      const line = Math.sin((y - set.y0) * 0.9 + (x + set.phase) * set.dip);   // inclined laminae inside the set
      if (line > 0.86) g -= 0.06;
      if (inSet < 0.05) g -= 0.14;                                              // flat set boundary
      const grain = vnoiseWrapped(u * 96, v * 96, 96); g += (grain - 0.5) * 0.18;
    } else {
      g = 0.72 + n * 0.3;
      const nod = vnoiseWrapped(u * 9, v * 9, 9); if (nod > 0.6) g += 0.08; if (nod < 0.38) g -= 0.08;   // nodular mottling
      const sty = Math.abs(((y + vnoiseWrapped(u * 30, 0, 30) * 14 + (x % 32 < 16 ? 3 : -3)) % 128) - 64);   // stylolite seams, jagged
      if (sty < 1.2) g -= 0.3;
      if ((x + Math.floor(vnoiseWrapped(0, v * 6, 6) * 9)) % 160 < 2 && vnoiseWrapped(u * 3, v * 3, 3) > 0.45) g -= 0.26;   // vertical joints
    }
    const gg = Math.max(0, Math.min(255, Math.round(g * 255)));
    const pidx = (y * size + x) * 4; img.data[pidx] = gg; img.data[pidx + 1] = gg; img.data[pidx + 2] = gg; img.data[pidx + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  texCache.set(k, tex);
  return tex;
}
// Turbulence for fluid in the bore: elongated noise that scrolls along the pipe.
export function turbulenceTexture() {
  const key = 'turb';
  if (texCache.has(key)) return texCache.get(key);
  const tex = rgbTexture(key, 256, (u, v) => {
    const n = 0.5 * vnoise2(u * 6, v * 24, 6, 24) + 0.3 * vnoise2(u * 12, v * 48, 12, 48) + 0.2 * vnoise2(u * 30, v * 30, 30, 30);
    const g = 0.55 + (n - 0.5) * 1.3;
    return [g, g, g];
  });
  if (tex) tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
// Round soft dot for point sprites (proppant grains)
export function dotTexture() {
  const k = 'dot';
  if (texCache.has(k)) return texCache.get(k);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 2, 16, 16, 15);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  texCache.set(k, tex);
  return tex;
}
// Irregular fracture face: noise alpha so the wing edge breaks up
export function fractureAlpha() {
  const k = 'fracalpha';
  if (texCache.has(k)) return texCache.get(k);
  if (typeof document === 'undefined') return null;
  const size = 128;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x - size / 2) / (size / 2), dy = (y - size / 2) / (size / 2);
    const r = Math.hypot(dx, dy);
    const n = vnoiseWrapped(x / size * 6, y / size * 6, 6) * 0.5 + vnoiseWrapped(x / size * 12, y / size * 12, 12) * 0.25;
    const edge = 1 - r + (n - 0.4) * 0.5;
    const a = Math.max(0, Math.min(1, edge * 2.2));
    const gg = Math.round(a * 255);
    const pidx = (y * size + x) * 4; img.data[pidx] = gg; img.data[pidx + 1] = gg; img.data[pidx + 2] = gg; img.data[pidx + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  texCache.set(k, tex);
  return tex;
}
// Radial blob for contact shadows (white alpha falloff; tinted black by the material)
export function blobTexture() {
  const k = 'blob';
  if (texCache.has(k)) return texCache.get(k);
  if (typeof document === 'undefined') return null;
  const size = 128;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.55, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  texCache.set(k, tex);
  return tex;
}
// Shared wear map for painted surfaces (roughness variation only, so no UV scale problems)
export function wearTexture() { return noiseTexture('wear', { size: 128, octaves: 3, base: 0.55, amp: 0.35, period: 4, repeat: 2 }); }

// ---------------------------------------------------------------- surface maps (Drop 23)
// Color maps that multiply the material color: dirt on paint, dust and rust streaks running down tanks, and a
// brushed-metal roughness map. Low contrast and tileable, so the per-face UVs of boxes and cylinders (0..1 on
// every face) read as surface variation rather than a repeated picture. Generated once, cached, shared.
function vnoise2(x, z, px, pz) {
  const i = Math.floor(x), j = Math.floor(z), fx = smooth(x - i), fz = smooth(z - j);
  const h = (a, b) => hash2(((a % px) + px) % px, ((b % pz) + pz) % pz);
  return lerp(lerp(h(i, j), h(i + 1, j), fx), lerp(h(i, j + 1), h(i + 1, j + 1), fx), fz);
}
function rgbTexture(key, size, fn) {
  if (texCache.has(key)) return texCache.get(key);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, g, b] = fn(x / size, 1 - y / size);   // v = 1 at the top row, 0 at the bottom (three flips canvas textures)
    const p = (y * size + x) * 4;
    img.data[p] = Math.max(0, Math.min(255, Math.round(r * 255))); img.data[p + 1] = Math.max(0, Math.min(255, Math.round(g * 255))); img.data[p + 2] = Math.max(0, Math.min(255, Math.round(b * 255))); img.data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4; tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}
// Dirt on paint: soft blotches with a faint downward drag, darkening up to 12 percent, slightly warm.
export function grimeTexture() {
  return rgbTexture('grime', 256, (u, v) => {
    const n = 0.6 * vnoise2(u * 5, v * 5, 5, 5) + 0.3 * vnoise2(u * 11, v * 11, 11, 11) + 0.1 * vnoise2(u * 23, v * 23, 23, 23);
    const drag = vnoise2(u * 40, v * 3, 40, 3);
    const d = Math.max(0, Math.min(1, (0.5 - n) * 2.0 + (drag - 0.5) * 0.3));
    return [1 - 0.07 * d, 1 - 0.085 * d, 1 - 0.11 * d];
  });
}
// Dust and rust streaks running down a tank wall (v = 0 at the bottom), a dirt band along the bottom edge.
export function streakTexture() {
  return rgbTexture('streak', 256, (u, v) => {
    const column = vnoise2(u * 48, v * 2, 48, 2) * 0.7 + vnoise2(u * 96, 0, 96, 1) * 0.3;
    const streak = Math.max(0, column - 0.55) * 2.2 * Math.pow(1 - v, 1.4) * (0.6 + 0.4 * vnoise2(u * 6, v * 6, 6, 6));
    const band = Math.max(0, 0.2 - v) / 0.2 * 0.22 * (0.7 + 0.3 * vnoise2(u * 30, v * 30, 30, 30));
    const spots = vnoise2(u * 64, v * 64, 64, 64) > 0.86 && v < 0.5 ? 0.25 : 0;
    const d = Math.min(1, streak + band + spots);
    const blot = Math.max(0, 0.5 - vnoise2(u * 4, v * 4, 4, 4)) * 0.16;
    return [1 - 0.28 * d - blot, 1 - 0.36 * d - blot * 1.1, 1 - 0.45 * d - blot * 1.3];
  });
}
// Tire tread: grooves across the tread every 1/28 of the circumference, a circumferential groove at mid width,
// as a bump and a slight darkening. Cylinder UVs put u around the tire and v across its width.
export function treadTexture() {
  const key = 'tread';
  if (texCache.has(key)) return texCache.get(key);
  const tex = rgbTexture(key, 128, (u, v) => {
    const block = ((u * 28) % 1);
    const groove = block < 0.22 ? 1 : 0;
    const center = Math.abs(v - 0.5) < 0.05 ? 1 : Math.abs(v - 0.5) > 0.42 ? 0.5 : 0;   // mid groove, softened shoulders
    const g = 0.78 - 0.45 * Math.max(groove, center) + 0.06 * vnoise2(u * 40, v * 10, 40, 10);
    return [g, g, g];
  });
  if (tex) tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
// Wraps of cable or tubing on a drum: ridges across the drum width (v on a cylinder is along its axis).
export function wrapTexture(wraps = 36) {
  const key = 'wrap' + wraps;
  if (texCache.has(key)) return texCache.get(key);
  const tex = rgbTexture(key, 128, (u, v) => {
    const k = (v * wraps) % 1;
    const ridge = 0.62 + 0.38 * Math.sin(k * Math.PI);            // one rounded strand per wrap
    const g = ridge * (0.94 + 0.06 * vnoise2(u * 24, v * 24, 24, 24));
    return [g, g, g];
  });
  if (tex) tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
// Stripes along a cable (u runs along a tube): scrolled to show the line moving.
export function cableTexture() {
  const key = 'cable';
  if (texCache.has(key)) return texCache.get(key);
  const tex = rgbTexture(key, 64, (u, v) => { const k = (u * 4) % 1; const g = k < 0.5 ? 0.55 : 1.0; return [g, g, g]; });
  if (tex) { tex.colorSpace = THREE.NoColorSpace; tex.minFilter = THREE.LinearFilter; }
  return tex;
}
// Brushed metal: roughness streaked along u, so reflections smear the way they do on scuffed steel.
export function brushedTexture() {
  const key = 'brushed';
  if (texCache.has(key)) return texCache.get(key);
  const tex = rgbTexture(key, 128, (u, v) => {
    const n = 0.55 + (vnoise2(u * 3, v * 64, 3, 64) - 0.5) * 0.5 + (vnoise2(u * 9, v * 9, 9, 9) - 0.5) * 0.2;
    return [n, n, n];
  });
  if (tex) { tex.colorSpace = THREE.NoColorSpace; tex.repeat.set(2, 2); }
  return tex;
}

// Mesa and ridge rock: horizontal strata of varying tone with a little grain; v runs up the slope.
export function strataTexture() {
  return rgbTexture('strata', 256, (u, v) => {
    const band = vnoise2(u * 0.7, v * 14, 1, 14);                 // layers
    const warp = vnoise2(u * 6, v * 6, 6, 6);
    const grain = vnoise2(u * 40, v * 40, 40, 40);
    const t = 0.78 + (band - 0.5) * 0.3 + (warp - 0.5) * 0.12 + (grain - 0.5) * 0.1;
    const ledge = Math.sin(v * 14 * Math.PI * 2 + warp * 2) > 0.92 ? -0.12 : 0;
    const g = Math.max(0.3, Math.min(1, t + ledge));
    return [g, g * 0.96, g * 0.9];
  });
}
// Cumulus patch: white with a soft alpha from fractal noise, fading at the edges of the tile.
export function cloudTexture() {
  const key = 'cloud';
  if (texCache.has(key)) return texCache.get(key);
  if (typeof document === 'undefined') return null;
  const size = 256;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const n = 0.55 * vnoise2(u * 3, v * 3, 3, 3) + 0.3 * vnoise2(u * 7, v * 7, 7, 7) + 0.15 * vnoise2(u * 17, v * 17, 17, 17);
    const edge = Math.min(1, 2.2 * Math.min(u, 1 - u, v, 1 - v) * 2);
    const a = Math.max(0, Math.min(1, (n - 0.44) * 4.5)) * edge;
    const lit = 0.86 + 0.14 * Math.min(1, (n - 0.44) * 6);        // thicker parts a touch darker underneath
    const p = (y * size + x) * 4; img.data[p] = Math.round(255 * lit); img.data[p + 1] = Math.round(255 * lit); img.data[p + 2] = Math.round(255 * Math.min(1, lit + 0.02)); img.data[p + 3] = Math.round(255 * a);
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}
// Radial glow for the sun: white with alpha falling as (1 - r)^2.4, drawn additively so it can only brighten the sky.
export function glowTexture() {
  const key = 'glow';
  if (texCache.has(key)) return texCache.get(key);
  if (typeof document === 'undefined') return null;
  const size = 128;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.min(1, Math.hypot(x / size - 0.5, y / size - 0.5) * 2);
    const a = (1 - r) ** 2.4;
    const p = (y * size + x) * 4; img.data[p] = 255; img.data[p + 1] = 255; img.data[p + 2] = 255; img.data[p + 3] = Math.round(255 * a);
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}
// A few cloud patches on a flat layer out toward the horizon, drifting slowly. Billboards would turn with the
// camera; flat patches 200 to 300 m up and 700 to 1100 m out sit 12 to 20 degrees above the horizon, inside the
// frame whenever the camera is near level, and cost one draw call each.
export function Clouds({ count = 9, seed = 1, tint = '#ffffff' }) {
  const tex = useMemo(() => cloudTexture(), []);
  const group = useRef();
  const items = useMemo(() => {
    const out = []; let k = seed * 7 + 3;
    const rnd = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    for (let i = 0; i < count; i++) { const a = i / count * Math.PI * 2 + rnd() * 0.6; const d = 720 + rnd() * 380; out.push({ p: [Math.cos(a) * d, 210 + rnd() * 110, Math.sin(a) * d], s: 320 + rnd() * 360, r: rnd() * Math.PI, o: 0.55 + rnd() * 0.35 }); }
    return out;
  }, [count, seed]);
  useFrame((_, dt) => { if (group.current) group.current.position.x = (group.current.position.x + dt * 1.2) % 400; });
  if (!tex) return null;
  return (
    <group ref={group}>
      {items.map((c, i) => (
        <mesh key={i} position={c.p} rotation={[-Math.PI / 2, 0, c.r]} scale={[c.s, c.s * 0.7, 1]} renderOrder={-1}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex} color={tint} transparent opacity={c.o} depthWrite={false} fog={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// Lite environment (Drop 27): the same sky as the dome, written straight into a small float equirect texture
// (256 by 128, with an HDR sun) and run through PMREM once. No scene render, no dome mesh, one texture: cheap
// enough for phones and laptops without a GPU, and it gives bare metal something to reflect so dark steel reads
// as steel instead of black. `SceneEnvironment` picks this in Lite and the rendered dome in Full.
function skyColorAt(y, c) {
  const out = new THREE.Color();
  if (y >= 0) { const t = Math.pow(y, 0.55); if (t < 0.35) out.copy(c.haze).lerp(c.sky, t / 0.35); else out.copy(c.sky).lerp(c.zenith, (t - 0.35) / 0.65); }
  else out.copy(c.haze).lerp(c.ground, Math.min(1, -y * 4));
  return out;
}
export function LiteEnvironment({ terrain, intensity = 0.8, tod = 'day' }) {
  const gl = useThree(s => s.gl), scene = useThree(s => s.scene);
  useEffect(() => {
    const W = 256, H = 128;
    const data = new Float32Array(W * H * 4);
    const c = { sky: new THREE.Color(terrain.sky), haze: new THREE.Color(terrain.fog), ground: new THREE.Color(terrain.ground), zenith: new THREE.Color(terrain.sky).lerp(new THREE.Color('#2f5fa8'), 0.55) };
    const S = sunFor(tod); const sun = S.dir.clone(), dir = new THREE.Vector3();
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W, v = (j + 0.5) / H;                       // three's equirect: u from atan2(z, x), v from asin(y); row 0 is the bottom
      const phi = (u - 0.5) * Math.PI * 2, theta = (v - 0.5) * Math.PI;
      dir.set(Math.cos(theta) * Math.cos(phi), Math.sin(theta), Math.cos(theta) * Math.sin(phi));
      const col = skyColorAt(dir.y, c);
      const a = Math.acos(Math.max(-1, Math.min(1, dir.dot(sun))));
      const k = Math.exp(-((a / 0.04) ** 2)) * 14 + Math.exp(-((a / 0.3) ** 2)) * 0.35;
      const p = (j * W + i) * 4;
      data[p] = col.r + S.disk[0] * k; data[p + 1] = col.g + S.disk[1] * k; data[p + 2] = col.b + S.disk[2] * k; data[p + 3] = 1;
    }
    const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.LinearSRGBColorSpace; tex.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromEquirectangular(tex);
    scene.environment = rt.texture; scene.environmentIntensity = intensity;
    tex.dispose(); pmrem.dispose();
    return () => { if (scene.environment === rt.texture) scene.environment = null; rt.dispose(); };
  }, [terrain.sky, terrain.fog, terrain.ground, intensity, gl, scene, tod]);
  return null;
}
// Lite gets the environment only where `lite` is set (the library viewer: one model, few pixels). The pad and the
// downhole section in Lite go without, because sampling the environment on every pixel is the one cost a software
// or low-end renderer feels most; their metals are capped by `metal()` in primitives instead.
export function SceneEnvironment({ terrain, intensity = 0.9, lite = false, tod = 'day' }) {
  if (LITE) return lite ? <LiteEnvironment terrain={terrain} intensity={intensity * 0.85} tod={tod} /> : null;
  return <PadEnvironment terrain={terrain} intensity={intensity} tod={tod} />;
}

// Tone-mapping exposure set from a prop so the time of day can change it without remounting the canvas.
export function Exposure({ value = 1.05 }) {
  const gl = useThree(s => s.gl);
  useEffect(() => { gl.toneMappingExposure = value; }, [gl, value]);
  return null;
}

// ---------------------------------------------------------------- sun with a view-following shadow camera
// One directional light whose shadow frustum follows the orbit target and shrinks as the camera comes in: at a
// pad overview it covers about 220 m, at a valve close-up about 50 m, so the same 2048 map gives centimeter
// shadow texels up close instead of the 10 cm it gave everywhere (Drop 25). The frustum center snaps to the
// texel grid so panning does not make the shadow edges swim.
export function SunLight({ tod = 'day', mapSize = 2048 }) {
  const S = sunFor(tod); const intensity = S.intensity, color = S.color, dir = S.dir;
  const light = useRef();
  const target = useMemo(() => new THREE.Object3D(), []);
  const last = useRef({ extent: 0, x: 0, z: 0 });
  useFrame((state) => {
    const L = light.current; if (!L) return;
    const focus = state.controls ? state.controls.target : state.camera.position;
    const dist = state.camera.position.distanceTo(focus);
    const extent = Math.min(110, Math.max(24, dist * 1.1 + 8));
    const texel = (2 * extent) / mapSize * 4;
    const x = Math.round(focus.x / texel) * texel, z = Math.round(focus.z / texel) * texel;
    const prev = last.current;
    if (Math.abs(extent - prev.extent) / extent < 0.02 && x === prev.x && z === prev.z && prev.tod === tod) return;
    last.current = { extent, x, z, tod };
    target.position.set(x, 0, z); target.updateMatrixWorld();
    L.position.set(x + dir.x * 160, dir.y * 160, z + dir.z * 160);
    const c = L.shadow.camera; c.left = -extent; c.right = extent; c.top = extent; c.bottom = -extent; c.near = 1; c.far = 420; c.updateProjectionMatrix();
  });
  return (
    <>
      <directionalLight ref={light} position={[dir.x * 160, dir.y * 160, dir.z * 160]} target={target} intensity={intensity} color={color} castShadow shadow-mapSize={[mapSize, mapSize]} shadow-camera-left={-100} shadow-camera-right={100} shadow-camera-top={100} shadow-camera-bottom={-100} shadow-camera-near={1} shadow-camera-far={420} shadow-bias={-0.0004} shadow-normalBias={0.03} />
      <primitive object={target} />
    </>
  );
}

// ---------------------------------------------------------------- blob contact shadow
// A soft dark ellipse on the ground under a vehicle or a tank: the cheap contact darkening that reads as
// ambient occlusion at pad scale.
export function BlobShadow({ size = [4, 4], position = [0, 0.015, 0], rotation = [0, 0, 0], opacity = 1 }) {
  const tex = useMemo(() => blobTexture(), []);
  if (!tex) return null;
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, rotation[1] || 0]} renderOrder={1}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} color="#000" polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  );
}

// ---------------------------------------------------------------- sky dome and environment
// Gradient dome: zenith color at the top, the basin sky color at 30 degrees, haze at the horizon, ground color
// below. A sun disk with a glow sits at the light direction. The same dome is rendered into the environment map
// so every metal and paint surface reflects and is lit by this sky.
function domeGeometry(sky, haze, ground, zenith) {
  const g = new THREE.SphereGeometry(1, 32, 24);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const cZen = new THREE.Color(zenith), cSky = new THREE.Color(sky), cHaze = new THREE.Color(haze), cGnd = new THREE.Color(ground);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);   // -1..1
    if (y >= 0) {
      const t = Math.pow(y, 0.55);
      if (t < 0.35) c.copy(cHaze).lerp(cSky, t / 0.35); else c.copy(cSky).lerp(cZen, (t - 0.35) / 0.65);
    } else {
      c.copy(cHaze).lerp(cGnd, Math.min(1, -y * 4));
    }
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// Time of day (Drop 30): day is the sun 56 degrees up from the east-southeast; dusk puts it 10 degrees above the
// western horizon, warm and weaker, with the sky and haze shifted toward it. `skyFor` derives the dusk palette
// from a basin's daytime colors so every basin gets its own evening.
export const SUN_DIR = new THREE.Vector3(60, 90, 30).normalize();
export const SUN = {
  day:  { dir: SUN_DIR, color: '#fff3e0', intensity: 2.4, disk: [1.8, 1.7, 1.45], glow: '#ffe9b8', exposure: 1.05, ambient: 0.12, hemi: 0.25, liteHemi: 0.55 },
  dusk: { dir: new THREE.Vector3(-90, 17, -35).normalize(), color: '#ffb469', intensity: 1.7, disk: [2.4, 1.25, 0.6], glow: '#ff9a4a', exposure: 0.95, ambient: 0.16, hemi: 0.34, liteHemi: 0.8 },
};
export const sunFor = (tod) => SUN[tod] || SUN.day;
const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const scale = (a, k) => '#' + new THREE.Color(a).multiplyScalar(k).getHexString();
export function skyFor(terrain, tod) {
  if (tod !== 'dusk') return terrain;
  return { ...terrain, sky: mix(terrain.sky, '#4d4a78', 0.55), fog: mix(terrain.fog, '#e89a5a', 0.6), ground: scale(terrain.ground, 0.62), pad: scale(terrain.pad, 0.7) };
}
function DomeMesh({ terrain, radius, sun = true, intensity = 1, tod = 'day' }) {
  const S = sunFor(tod);
  const zenith = useMemo(() => '#' + new THREE.Color(terrain.sky).lerp(new THREE.Color(tod === 'dusk' ? '#1e2250' : '#2f5fa8'), 0.55).getHexString(), [terrain.sky, tod]);
  const geom = useMemo(() => domeGeometry(terrain.sky, terrain.fog, terrain.ground, zenith), [terrain.sky, terrain.fog, terrain.ground, zenith]);
  const sunPos = S.dir.clone().multiplyScalar(radius * 0.98);
  return (
    <group>
      <mesh geometry={geom} scale={[radius, radius, radius]}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} toneMapped={false} color={new THREE.Color(intensity, intensity, intensity)} />
      </mesh>
      {sun && (
        <>
          <mesh position={sunPos}><sphereGeometry args={[radius * (tod === 'dusk' ? 0.045 : 0.035), 12, 8]} /><meshBasicMaterial color={new THREE.Color(...S.disk)} fog={false} toneMapped={false} /></mesh>
          {/* glow quad sits short of the dome so its corners stay inside the sphere (a corner outside fails the depth test and clips the glow to a polygon) */}
          <sprite position={S.dir.clone().multiplyScalar(radius * (tod === 'dusk' ? 0.9 : 0.95))} scale={[radius * (tod === 'dusk' ? 0.66 : 0.4), radius * (tod === 'dusk' ? 0.66 : 0.4), 1]}><spriteMaterial map={glowTexture()} color={S.glow} transparent opacity={tod === 'dusk' ? 0.55 : 0.4} blending={THREE.AdditiveBlending} fog={false} toneMapped={false} depthWrite={false} /></sprite>
        </>
      )}
    </group>
  );
}
export function SkyDome({ terrain, radius = 1200, tod = 'day' }) {
  return <DomeMesh terrain={terrain} radius={radius} sun tod={tod} />;
}
// Image-based lighting from the dome: rendered once into a small cube map (frames={1}); re-rendered when the
// basin changes because the key changes.
export function PadEnvironment({ terrain, intensity = 0.9, tod = 'day' }) {
  return (
    <Environment key={terrain.sky + terrain.fog + terrain.ground + tod} resolution={128} frames={1} near={1} far={2000} environmentIntensity={intensity}>
      <DomeMesh terrain={terrain} radius={900} sun intensity={1.15} tod={tod} />
    </Environment>
  );
}
