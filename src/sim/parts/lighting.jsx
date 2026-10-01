// Rendering pass (Drop 12): procedural sky dome, image-based lighting from that dome, canvas textures for the
// ground and for paint wear, and blob contact shadows. Everything is generated in the browser; no image files,
// no network fetch, nothing from a manufacturer.
import { useMemo } from 'react';
import * as THREE from 'three';
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
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  texCache.set(k, tex);
  return tex;
}

// Rock textures for the downhole section: shale (fine dark laminations), sandstone (grainy, faint bedding),
// limestone (lighter, blocky with joints). Grayscale; the layer color tints them.
export function rockTexture(kind) {
  const k = 'rock-' + kind;
  if (texCache.has(k)) return texCache.get(k);
  if (typeof document === 'undefined') return null;
  const size = 256;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, a = 1, f = kind === 'sand' ? 12 : 6, norm = 0;
    for (let o = 0; o < 4; o++) { v += a * vnoiseWrapped(x / size * f, y / size * f, f); norm += a; a *= 0.55; f *= 2; }
    v = v / norm - 0.5;
    let g = kind === 'shale' ? 0.5 + v * 0.3 : kind === 'sand' ? 0.66 + v * 0.42 : 0.72 + v * 0.3;
    if (kind === 'shale') { const lam = Math.sin(y * 0.9 + vnoiseWrapped(x / size * 4, y / size * 4, 4) * 3) ; if (lam > 0.75) g -= 0.18; if (lam < -0.9) g += 0.06; }
    if (kind === 'sand') { const bed = Math.sin(y * 0.25 + vnoiseWrapped(x / size * 3, 0, 3) * 2); if (bed > 0.92) g -= 0.1; }
    if (kind === 'lime') { if (y % 64 < 2 || (x + (y > 128 ? 32 : 0)) % 96 < 2) g -= 0.22; }
    const gg = Math.max(0, Math.min(255, Math.round(g * 255)));
    const pidx = (y * size + x) * 4; img.data[pidx] = gg; img.data[pidx + 1] = gg; img.data[pidx + 2] = gg; img.data[pidx + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  texCache.set(k, tex);
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
export const SUN_DIR = new THREE.Vector3(60, 90, 30).normalize();
function DomeMesh({ terrain, radius, sun = true, intensity = 1 }) {
  const zenith = useMemo(() => '#' + new THREE.Color(terrain.sky).lerp(new THREE.Color('#2f5fa8'), 0.55).getHexString(), [terrain.sky]);
  const geom = useMemo(() => domeGeometry(terrain.sky, terrain.fog, terrain.ground, zenith), [terrain.sky, terrain.fog, terrain.ground, zenith]);
  const sunPos = SUN_DIR.clone().multiplyScalar(radius * 0.98);
  return (
    <group>
      <mesh geometry={geom} scale={[radius, radius, radius]}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} toneMapped={false} color={new THREE.Color(intensity, intensity, intensity)} />
      </mesh>
      {sun && (
        <>
          <mesh position={sunPos}><sphereGeometry args={[radius * 0.035, 12, 8]} /><meshBasicMaterial color={new THREE.Color(1.8, 1.7, 1.45)} fog={false} toneMapped={false} /></mesh>
          <mesh position={sunPos}><sphereGeometry args={[radius * 0.11, 12, 8]} /><meshBasicMaterial color="#ffe9b8" transparent opacity={0.28} fog={false} toneMapped={false} depthWrite={false} /></mesh>
        </>
      )}
    </group>
  );
}
export function SkyDome({ terrain, radius = 1200 }) {
  return <DomeMesh terrain={terrain} radius={radius} sun />;
}
// Image-based lighting from the dome: rendered once into a small cube map (frames={1}); re-rendered when the
// basin changes because the key changes.
export function PadEnvironment({ terrain, intensity = 0.9 }) {
  return (
    <Environment key={terrain.sky + terrain.fog + terrain.ground} resolution={128} frames={1} near={1} far={2000} environmentIntensity={intensity}>
      <DomeMesh terrain={terrain} radius={900} sun intensity={1.15} />
    </Environment>
  );
}
