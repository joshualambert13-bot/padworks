// Pad life and close-range detail (Drop 13): signs and placards, hazard stripes, crew figures, a windsock and a
// safety flag, a pickup on the lease road, and exhaust plumes. Generic shapes and wording only: no company,
// crew, or product names; the placards say what any pad placard says.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Merged, GEO, MAT, Cyl, Hose, Mat } from './primitives.jsx';
import { flagTexture, flagRatio } from './lighting.jsx';

// ---------------------------------------------------------------- canvas signs
const signCache = new Map();
function signTexture(lines, { bg = '#f2f2f2', fg = '#111', accent = null, w = 256, h = 128, font = 'bold 30px system-ui, sans-serif' } = {}) {
  const key = JSON.stringify([lines, bg, fg, accent, w, h, font]);
  if (signCache.has(key)) return signCache.get(key);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = fg; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12);
  if (accent) { ctx.fillStyle = accent; ctx.fillRect(10, 10, w - 20, Math.round(h * 0.34)); }
  ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((t, i) => { if (accent && i === 0) { ctx.fillStyle = '#fff'; ctx.fillText(t, w / 2, 10 + Math.round(h * 0.17)); ctx.fillStyle = fg; } else ctx.fillText(t, w / 2, accent ? h * 0.42 + (i - 0.5) * (h * 0.5 / Math.max(1, n - 1)) + h * 0.12 : (i + 0.5) * h / n); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  signCache.set(key, tex);
  return tex;
}
// Yellow and black hazard stripes, tileable
function stripesTexture() {
  const key = 'stripes';
  if (signCache.has(key)) return signCache.get(key);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e6b800'; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#111'; ctx.lineWidth = 0;
  for (let i = -2; i < 4; i++) { ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32 + 16, 0); ctx.lineTo(i * 32 + 16 + 64, 64); ctx.lineTo(i * 32 + 64, 64); ctx.closePath(); ctx.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  signCache.set(key, tex);
  return tex;
}
// A sign plate in world space, optionally on a post. `lines` is the text; `danger` puts a red band with the
// first line on it (the generic "DANGER" placard layout). Faces +Z in its own frame.
export function Sign({ lines, position = [0, 0, 0], rotation = [0, 0, 0], width = 1.0, height = 0.5, post = 0, danger = false, bg, fg }) {
  const tex = useMemo(() => signTexture(lines, { bg: bg || (danger ? '#f4f4f4' : '#f2f2f2'), fg: fg || '#111', accent: danger ? '#c8102e' : null, w: 256, h: Math.round(256 * height / width) }), [lines, danger, width, height, bg, fg]);
  return (
    <group position={position} rotation={rotation}>
      {post > 0 && <mesh position={[0, -post / 2, -0.03]}><cylinderGeometry args={[0.025, 0.025, post, 6]} /><Mat mat={MAT.darkSteel} /></mesh>}
      <mesh castShadow><boxGeometry args={[width, height, 0.02]} /><meshStandardMaterial color="#3a3f45" metalness={0.5} roughness={0.6} /></mesh>
      {tex && <mesh position={[0, 0, 0.012]}><planeGeometry args={[width, height]} /><meshStandardMaterial map={tex} roughness={0.7} metalness={0} /></mesh>}
    </group>
  );
}
// Hazard stripe strip (a thin box faced with the stripe texture), along X
export function HazardStrip({ position = [0, 0, 0], rotation = [0, 0, 0], length = 2.0, height = 0.18 }) {
  const tex = useMemo(() => { const t = stripesTexture(); if (t) { const c = t.clone(); c.needsUpdate = true; c.repeat.set(length / 0.4, 1); return c; } return null; }, [length]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[length, height]} />
      <meshStandardMaterial map={tex || undefined} color={tex ? '#ffffff' : '#e6b800'} roughness={0.6} metalness={0.1} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ---------------------------------------------------------------- crew figures
// A worker in coveralls, high-visibility vest, and hard hat: five merged meshes, a slight idle sway. Poses:
// 'stand', 'point' (one arm raised toward -Z), 'kneel' (working low at a valve).
const SKIN = { color: '#b58a66', metalness: 0, roughness: 0.8 };
export function Crew({ position = [0, 0, 0], rotation = 0, pose = 'stand', vest = '#ff7a1a', hat = '#f2f2f2', seed = 0 }) {
  const ref = useRef();
  useFrame((state) => { if (ref.current) ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.9 + seed) * 0.015; });
  const kneel = pose === 'kneel';
  const legH = kneel ? 0.45 : 0.85, torsoY = legH + 0.36;
  const armRot = pose === 'point' ? -1.2 : 0.15;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group ref={ref}>
        {/* legs and boots, coveralls */}
        <Merged mat={{ color: '#2b3f66', metalness: 0.05, roughness: 0.85 }} deps={[pose]} parts={() => [
          { g: GEO.cyl(0.09, legH, 8), p: [-0.11, legH / 2, kneel ? 0.15 : 0] }, { g: GEO.cyl(0.09, legH, 8), p: [0.11, legH / 2, 0] },
          { g: GEO.cyl(0.17, 0.62, 10, 0.2), p: [0, torsoY, 0] },
          { g: GEO.cyl(0.055, 0.6, 6), p: [-0.25, torsoY + 0.05, 0], r: [armRot, 0, 0.25] }, { g: GEO.cyl(0.055, 0.6, 6), p: [0.25, torsoY + 0.05, 0], r: [0.15, 0, -0.25] },
        ]} />
        <Merged mat={MAT.black} deps={[pose]} parts={() => [{ g: GEO.box(0.13, 0.12, 0.26), p: [-0.11, 0.06, kneel ? 0.2 : 0.03] }, { g: GEO.box(0.13, 0.12, 0.26), p: [0.11, 0.06, 0.03] }]} />
        {/* vest with reflective bands */}
        <Merged mat={{ color: vest, metalness: 0, roughness: 0.7 }} deps={[vest, pose]} parts={() => [{ g: GEO.cyl(0.2, 0.42, 10, 0.22), p: [0, torsoY + 0.02, 0] }]} />
        <Merged mat={{ color: '#d9d9d9', metalness: 0.2, roughness: 0.4 }} deps={[pose]} parts={() => [{ g: GEO.cyl(0.215, 0.05, 10), p: [0, torsoY + 0.14, 0] }, { g: GEO.cyl(0.225, 0.05, 10), p: [0, torsoY - 0.1, 0] }]} />
        {/* head, hard hat with brim, gloves */}
        <Merged mat={SKIN} deps={[pose]} parts={() => [{ g: GEO.sphere(0.11, 10, 8), p: [0, torsoY + 0.47, 0] }, { g: GEO.sphere(0.05, 6, 5), p: [-0.25 + (pose === 'point' ? 0.05 : 0), torsoY + (pose === 'point' ? 0.55 : -0.25), pose === 'point' ? -0.5 : 0.05] }, { g: GEO.sphere(0.05, 6, 5), p: [0.27, torsoY - 0.25, 0.05] }]} />
        <Merged mat={{ color: hat, metalness: 0.1, roughness: 0.4 }} deps={[hat, pose]} parts={() => [{ g: GEO.sphere(0.125, 10, 6), p: [0, torsoY + 0.5, 0], s: [1, 0.85, 1] }, { g: GEO.cyl(0.17, 0.02, 12), p: [0, torsoY + 0.47, 0.02] }]} />
      </group>
    </group>
  );
}

// A crew member walking a closed path (Drop 28): legs and arms swing from hip and shoulder pivots, the body bobs,
// the figure faces the way it is going. Same coveralls, vest, and hat as the standing crew.
export function Walker({ path, speed = 1.1, vest = '#ff7a1a', hat = '#f2f2f2', seed = 0 }) {
  const ref = useRef(), body = useRef(), legL = useRef(), legR = useRef(), armL = useRef(), armR = useRef();
  const loop = useMemo(() => {
    const pts = path.map(p => new THREE.Vector3(p[0], 0, p[1])); pts.push(pts[0].clone());
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { pts, cum, total: cum[cum.length - 1] };
  }, [path]);
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + seed * 11;
    const d = ((t % loop.total) + loop.total) % loop.total;
    let i = 1; while (i < loop.cum.length - 1 && loop.cum[i] < d) i++;
    const a = loop.pts[i - 1], b = loop.pts[i], k = (d - loop.cum[i - 1]) / Math.max(1e-6, loop.cum[i] - loop.cum[i - 1]);
    if (ref.current) { ref.current.position.set(a.x + (b.x - a.x) * k, 0, a.z + (b.z - a.z) * k); ref.current.rotation.y = Math.atan2(-(b.x - a.x), -(b.z - a.z)); }
    const ph = state.clock.elapsedTime * 6.5 * speed + seed;
    if (legL.current) legL.current.rotation.x = 0.55 * Math.sin(ph);
    if (legR.current) legR.current.rotation.x = -0.55 * Math.sin(ph);
    if (armL.current) armL.current.rotation.x = -0.4 * Math.sin(ph);
    if (armR.current) armR.current.rotation.x = 0.4 * Math.sin(ph);
    if (body.current) body.current.position.y = 0.025 * Math.abs(Math.sin(ph));
  });
  const legH = 0.85, torsoY = legH + 0.36;
  const COVERALL = { color: '#2b3f66', metalness: 0.05, roughness: 0.85 };
  const leg = (r, x) => (
    <group ref={r} position={[x, legH, 0]}>
      <Merged mat={COVERALL} deps={[]} parts={() => [{ g: GEO.cyl(0.09, legH, 8), p: [0, -legH / 2, 0] }]} />
      <Merged mat={MAT.black} deps={[]} parts={() => [{ g: GEO.box(0.13, 0.12, 0.26), p: [0, -legH + 0.06, -0.03] }]} />
    </group>
  );
  const arm = (r, x, sign) => (
    <group ref={r} position={[x, torsoY + 0.3, 0]}>
      <Merged mat={COVERALL} deps={[]} parts={() => [{ g: GEO.cyl(0.055, 0.6, 6), p: [0, -0.3, 0], r: [0, 0, sign * 0.2] }]} />
      <Merged mat={SKIN} deps={[]} parts={() => [{ g: GEO.sphere(0.05, 6, 5), p: [sign * -0.06, -0.62, 0] }]} />
    </group>
  );
  return (
    <group ref={ref} name="LG-CREW-WALKER">
      <group ref={body}>
        {leg(legL, -0.11)}{leg(legR, 0.11)}
        <Merged mat={COVERALL} deps={[]} parts={() => [{ g: GEO.cyl(0.17, 0.62, 10, 0.2), p: [0, torsoY, 0] }]} />
        <Merged mat={{ color: vest, metalness: 0, roughness: 0.7 }} deps={[vest]} parts={() => [{ g: GEO.cyl(0.2, 0.42, 10, 0.22), p: [0, torsoY + 0.02, 0] }]} />
        <Merged mat={{ color: '#d9d9d9', metalness: 0.2, roughness: 0.4 }} deps={[]} parts={() => [{ g: GEO.cyl(0.215, 0.05, 10), p: [0, torsoY + 0.14, 0] }, { g: GEO.cyl(0.225, 0.05, 10), p: [0, torsoY - 0.1, 0] }]} />
        {arm(armL, -0.25, -1)}{arm(armR, 0.25, 1)}
        <Merged mat={SKIN} deps={[]} parts={() => [{ g: GEO.sphere(0.11, 10, 8), p: [0, torsoY + 0.47, 0] }]} />
        <Merged mat={{ color: hat, metalness: 0.1, roughness: 0.4 }} deps={[hat]} parts={() => [{ g: GEO.sphere(0.125, 10, 6), p: [0, torsoY + 0.5, 0], s: [1, 0.85, 1] }, { g: GEO.cyl(0.17, 0.02, 12), p: [0, torsoY + 0.47, 0] }]} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- windsock and flag
export function Windsock({ position = [0, 0, 0], height = 6 }) {
  const ref = useRef();
  useFrame((state) => { if (ref.current) { const t = state.clock.elapsedTime; ref.current.rotation.z = -0.9 + Math.sin(t * 0.7) * 0.15; ref.current.rotation.y = Math.sin(t * 0.23) * 0.4; } });
  return (
    <group position={position}>
      <Cyl r={0.04} h={height} position={[0, height / 2, 0]} mat={MAT.alu} />
      <group position={[0, height, 0]} ref={ref}>
        <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.13, 0.22, 1.3, 10, 1, true]} /><meshStandardMaterial color="#ff6a00" roughness={0.8} side={THREE.DoubleSide} /></mesh>
        <mesh position={[0, 1.55, 0]}><cylinderGeometry args={[0.1, 0.13, 0.6, 10, 1, true]} /><meshStandardMaterial color="#f5f5f5" roughness={0.8} side={THREE.DoubleSide} /></mesh>
        <mesh position={[0, 2.0, 0]}><cylinderGeometry args={[0.07, 0.1, 0.3, 10, 1, true]} /><meshStandardMaterial color="#ff6a00" roughness={0.8} side={THREE.DoubleSide} /></mesh>
      </group>
    </group>
  );
}
// Plain safety flag: a cloth plane whose vertices ripple in the wind
export function Flag({ position = [0, 0, 0], height = 7, color = '#ff6a00', w = 1.6, h = 1.0, map = null, alpha = false, seed = 0 }) {
  const ref = useRef();
  const geom = useMemo(() => new THREE.PlaneGeometry(w, h, 20, 8), [w, h]);
  const base = useMemo(() => geom.attributes.position.array.slice(), [geom]);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime + seed, pos = geom.attributes.position, k = 0.9 + 0.5 * (w / 1.6);
    for (let i = 0; i < pos.count; i++) { const x = base[i * 3] + w / 2, y = base[i * 3 + 1]; pos.setZ(i, (Math.sin(x * 3.2 / k - t * 5) * 0.08 * k + Math.sin(x * 7 / k - t * 7.5) * 0.02) * (x / w) + Math.sin(y * 4 + t * 3) * 0.02 * (x / w)); }
    pos.needsUpdate = true; geom.computeVertexNormals();
  });
  return (
    <group position={position}>
      <Cyl r={0.05} h={height} position={[0, height / 2, 0]} mat={MAT.alu} />
      <mesh position={[0, height + 0.06, 0]}><sphereGeometry args={[0.09, 10, 8]} /><Mat mat={MAT.brass} /></mesh>
      <mesh ref={ref} geometry={geom} position={[w / 2 + 0.05, height - h / 2 - 0.1, 0]} castShadow>
        <meshStandardMaterial color={map ? '#ffffff' : color} map={map || undefined} roughness={0.85} side={THREE.DoubleSide} transparent={alpha} alphaTest={alpha ? 0.5 : 0} />
      </mesh>
    </group>
  );
}
// Flagpoles at the data van (Drop 38): the US flag in the position of honor (its own right), the basin's state flag
// beside it, both drawn in code (`flagTexture`); poles sized to the cloth, halyard sphere finials.
export function Flagpoles({ position = [0, 0, 0], state = 'TX' }) {
  const us = useMemo(() => flagTexture('us'), []), st = useMemo(() => flagTexture(state), [state]);
  const wUs = 2.4, hUs = wUs / flagRatio('us'), wSt = 2.0, hSt = wSt / flagRatio(state);
  return (
    <group position={position} name="LG-FLAGPOLES">
      <Flag position={[0, 0, 0]} height={9.5} w={wUs} h={hUs} map={us} seed={0} />
      <Flag position={[3.2, 0, 0]} height={8.5} w={wSt} h={hSt} map={st} alpha={state === 'OH'} seed={1.7} />
    </group>
  );
}


// ---------------------------------------------------------------- exhaust plumes
const puffCache = { tex: null };
function puffTexture() {
  if (puffCache.tex) return puffCache.tex;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(70,70,72,0.95)'); g.addColorStop(0.45, 'rgba(90,90,92,0.5)'); g.addColorStop(1, 'rgba(110,110,112,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  puffCache.tex = new THREE.CanvasTexture(c);
  return puffCache.tex;
}
// Diesel exhaust from a stack while the engine runs: four sprites rising, spreading, and fading, drifting with the wind.
// Winter (Drop 39) makes exhaust condense: the scene sets PLUME.boost and every plume grows and whitens by it.
export const PLUME = { boost: 1 };
export function ExhaustPlume({ position = [0, 0, 0], active = true, strength = 1, seed = 0 }) {
  const refs = useRef([]);
  const tex = useMemo(() => puffTexture(), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.9 + seed;
    refs.current.forEach((sp, i) => {
      if (!sp) return;
      const ph = (t + i * 0.55) % 2.2, k = ph / 2.2;
      sp.position.set(0.6 * k + 0.2 * Math.sin(t * 2 + i), 0.2 + ph * 2.0, 0.9 * k);
      const sc = (0.9 + k * 3.0 * strength) * PLUME.boost;
      sp.scale.set(sc, sc, 1);
      sp.material.opacity = active ? Math.pow(1 - k, 0.8) * 0.9 * Math.min(1, strength * PLUME.boost) : 0;
    });
  });
  if (!tex) return null;
  return (
    <group position={position}>
      {[0, 1, 2, 3].map(i => <sprite key={i} ref={el => (refs.current[i] = el)}><spriteMaterial map={tex} transparent depthWrite={false} opacity={0} /></sprite>)}
    </group>
  );
}

// ---------------------------------------------------------------- gauges and hydraulic hoses
// Pressure gauge: case, white face with a needle, on a short nipple. Faces -Z (operator side).
export function Gauge({ position = [0, 0, 0], rotation = [0, 0, 0], r = 0.09 }) {
  return (
    <group position={position} rotation={rotation}>
      <Cyl r={r * 0.35} h={r * 1.4} position={[0, -r * 1.2, 0]} mat={MAT.steel} />
      <Cyl r={r} h={r * 0.5} rotation={[Math.PI / 2, 0, 0]} mat={MAT.black} />
      <mesh position={[0, 0, -r * 0.26]}><circleGeometry args={[r * 0.82, 16]} /><meshStandardMaterial color="#f4f4f4" roughness={0.5} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, r * 0.2, -r * 0.28]} rotation={[0, 0, 0.6]}><boxGeometry args={[r * 0.06, r * 0.7, 0.004]} /><meshStandardMaterial color="#c8102e" /></mesh>
    </group>
  );
}
// Hydraulic hose pair from an actuator to a junction box: two hoses that sag between the points, one draw call each.
// Without `sag` the hoses hang by their span: 16 percent of the straight-line distance, 0.1 m at least (Drop 24).
export function HosePair({ from, to, r = 0.02, sag, spread = 0.06 }) {
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  sag = sag ?? Math.max(0.1, 0.16 * dist);
  return (
    <group>
      <Hose from={[from[0] - spread, from[1], from[2]]} to={[to[0] - spread, to[1], to[2]]} r={r} sag={sag} segments={10} mat={MAT.hose} />
      <Hose from={[from[0] + spread, from[1], from[2]]} to={[to[0] + spread, to[1], to[2]]} r={r} sag={sag} segments={10} mat={MAT.hose} />
    </group>
  );
}
