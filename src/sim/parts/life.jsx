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
  w *= 2; h *= 2;   // Drop 43: double the canvas for crisp text, and fit each line to the plate width
  const key = JSON.stringify([lines, bg, fg, accent, w, h, font]);
  if (signCache.has(key)) return signCache.get(key);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = fg; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12);
  if (accent) { ctx.fillStyle = accent; ctx.fillRect(10, 10, w - 20, Math.round(h * 0.34)); }
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const n = lines.length;
  const base = 60, maxW = w - 40;
  const fit = (t) => { let px = base; ctx.font = 'bold ' + px + 'px system-ui, sans-serif'; while (px > 14 && ctx.measureText(t).width > maxW) { px -= 2; ctx.font = 'bold ' + px + 'px system-ui, sans-serif'; } };
  lines.forEach((t, i) => { fit(t); if (accent && i === 0) { ctx.fillStyle = '#fff'; ctx.fillText(t, w / 2, 10 + Math.round(h * 0.17)); ctx.fillStyle = fg; } else ctx.fillText(t, w / 2, accent ? h * 0.42 + (i - 0.5) * (h * 0.5 / Math.max(1, n - 1)) + h * 0.12 : (i + 0.5) * h / n); });
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
// Stencil (Drop 46): painted lettering straight on a surface, no plate. A transparent canvas with the text, drawn as
// a plane a few millimeters proud of the surface, alpha-tested so it costs no sorting. `width` sets the size; the
// height follows the text. Faded by `wear` (0 fresh, 1 half gone) with a speckle so it reads as paint, not a label.
const stencilCache = new Map();
function stencilTexture(text, { color = '#1b1b1b', wear = 0.35, w = 512 } = {}) {
  const key = JSON.stringify(['stencil', text, color, wear, w]);
  if (stencilCache.has(key)) return stencilCache.get(key);
  if (typeof document === 'undefined') return null;
  const h = Math.round(w * 0.3);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  let px = Math.round(h * 0.78); ctx.font = 'bold ' + px + 'px "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
  while (px > 12 && ctx.measureText(text).width > w - 24) { px -= 2; ctx.font = 'bold ' + px + 'px "Arial Narrow", "Helvetica Neue", Arial, sans-serif'; }
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + px * 0.04);
  if (wear > 0) {
    // knock holes in the paint: random speckle erased with destination-out
    ctx.globalCompositeOperation = 'destination-out';
    let k = (text.length * 7919) | 0; const rnd = () => { k = (k * 1103515245 + 12345) & 0x7fffffff; return k / 0x7fffffff; };
    const n = Math.round(wear * 1400);
    for (let i = 0; i < n; i++) { ctx.globalAlpha = 0.35 + rnd() * 0.65; ctx.beginPath(); ctx.ellipse(rnd() * w, rnd() * h, 1 + rnd() * 4, 1 + rnd() * 3, rnd() * 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  stencilCache.set(key, tex);
  return tex;
}
export function Stencil({ text, position = [0, 0, 0], rotation = [0, 0, 0], width = 1.0, color = '#1b1b1b', wear = 0.35 }) {
  const tex = useMemo(() => stencilTexture(text, { color, wear }), [text, color, wear]);
  if (!tex) return null;
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, width * 0.3]} />
      <meshStandardMaterial map={tex} transparent={false} alphaTest={0.5} roughness={0.9} metalness={0} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}
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
// A worker in FRC coveralls, high-visibility vest, and hard hat (Drop 47): capsule limbs with elbows and knees,
// a lathed torso, boots, gloves, safety glasses, reflective bands, a hard hat with a peak. The figure faces -Z.
// Poses: 'stand', 'point' (right arm raised toward -Z), 'kneel' (right knee down, working low). Built as merged
// meshes per material (eight draw calls), with a slight idle sway.
const SKIN = { color: '#b58a66', metalness: 0, roughness: 0.8 };
const COVERALLS = [{ color: '#2b3f66', metalness: 0.05, roughness: 0.85 }, { color: '#b3976a', metalness: 0.05, roughness: 0.85 }, { color: '#3b3d42', metalness: 0.05, roughness: 0.85 }];
const GLOVE = { color: '#c9561f', metalness: 0, roughness: 0.8 };
const REFLEX = { color: '#d9d9d9', metalness: 0.2, roughness: 0.4 };
const GLASSES = { color: '#111318', metalness: 0.4, roughness: 0.3 };
const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);
// a capsule from joint `a` to joint `b` (its rounded ends overlap the joints), or with `ring`, a band around the limb
function seg(a, b, r, ring = null) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const n = d.clone().normalize();
  if (ring) {
    const q = new THREE.Quaternion().setFromUnitVectors(FWD, n), e = new THREE.Euler().setFromQuaternion(q);
    const at = A.clone().add(n.clone().multiplyScalar(ring.at * len));
    return { g: GEO.torus(r + 0.004, 0.012, 5, 12), p: at.toArray(), r: [e.x, e.y, e.z] };
  }
  const q = new THREE.Quaternion().setFromUnitVectors(UP, n), e = new THREE.Euler().setFromQuaternion(q);
  return { g: GEO.capsule(r, Math.max(0.02, len - r * 1.2), 3, 8), p: A.clone().add(B).multiplyScalar(0.5).toArray(), r: [e.x, e.y, e.z] };
}
// joint positions per pose; `lean` is the torso's forward pitch
function joints(pose) {
  if (pose === 'kneel') {
    const hipY = 0.58, lean = 0.3;
    const sh = (x) => [x, hipY + 0.55 * Math.cos(lean), -0.55 * Math.sin(lean)];
    return {
      hipY, lean,
      legs: [{ hip: [-0.1, hipY, 0], knee: [-0.1, 0.55, -0.32], ankle: [-0.1, 0.13, -0.3], boot: [-0.1, 0.065, -0.34] },
             { hip: [0.1, hipY, 0], knee: [0.1, 0.1, 0.08], ankle: [0.1, 0.1, 0.5], boot: [0.1, 0.09, 0.56], flat: true }],
      arms: [{ sh: sh(-0.2), el: [-0.26, 0.86, -0.3], wr: [-0.22, 0.62, -0.46] }, { sh: sh(0.2), el: [0.26, 0.86, -0.3], wr: [0.22, 0.62, -0.46] }],
    };
  }
  const hipY = 0.9, lean = 0.04;
  const legs = [{ hip: [-0.1, hipY, 0], knee: [-0.1, 0.5, -0.02], ankle: [-0.1, 0.13, 0], boot: [-0.1, 0.065, -0.04] }, { hip: [0.1, hipY, 0], knee: [0.1, 0.5, -0.02], ankle: [0.1, 0.13, 0], boot: [0.1, 0.065, -0.04] }];
  const arms = [{ sh: [-0.2, 1.45, 0], el: [-0.26, 1.17, -0.03], wr: [-0.29, 0.93, -0.08] }, { sh: [0.2, 1.45, 0], el: [0.26, 1.17, -0.03], wr: [0.29, 0.93, -0.08] }];
  if (pose === 'point') arms[1] = { sh: [0.2, 1.45, 0], el: [0.24, 1.44, -0.28], wr: [0.27, 1.46, -0.56] };
  return { hipY, lean, legs, arms };
}
export function figureParts(pose, { vest, hat, coverall }, trunkOnly = false) {
  const J = joints(pose), { hipY, lean } = J;
  const torsoE = [-lean, 0, 0];   // the figure faces -Z, so a forward lean is a negative pitch
  const headC = [0, hipY + 0.56 * Math.cos(lean) + 0.2, -0.56 * Math.sin(lean) - 0.2 * Math.sin(lean)];
  const out = { coverall: [], black: [], skin: [], vest: [], reflex: [], glove: [], hat: [], glasses: [] };
  for (const L of trunkOnly ? [] : J.legs) {
    out.coverall.push(seg(L.hip, L.knee, 0.085), seg(L.knee, L.ankle, 0.07));
    out.reflex.push(seg(L.knee, L.ankle, 0.07, { at: 0.6 }));
    out.black.push({ g: GEO.rbox(0.13, 0.13, 0.3, 0.03, 1), p: L.boot, r: L.flat ? [Math.PI / 2 - 0.2, 0, 0] : [0, 0, 0] });
  }
  out.coverall.push({ g: GEO.sphere(0.14, 10, 7), p: [0, hipY + 0.02, 0], s: [1.3, 0.8, 0.9] });
  out.coverall.push({ g: GEO.lathe([[0.15, 0], [0.165, 0.1], [0.175, 0.24], [0.19, 0.42], [0.205, 0.5], [0.17, 0.56], [0.08, 0.58]], 14), p: [0, hipY + 0.02, 0], r: torsoE, s: [1, 1, 0.78] });
  out.coverall.push({ g: GEO.sphere(0.075, 8, 6), p: J.arms[0].sh }, { g: GEO.sphere(0.075, 8, 6), p: J.arms[1].sh });
  out.vest.push({ g: GEO.lathe([[0.19, 0.1], [0.2, 0.26], [0.215, 0.44], [0.222, 0.52], [0.13, 0.57]], 14), p: [0, hipY + 0.02, 0], r: torsoE, s: [1, 1, 0.8] });
  out.reflex.push(...[[0.207, 0.28], [0.22, 0.46]].map(([r, y]) => ({ g: GEO.torus(r, 0.012, 5, 16), p: [0, hipY + 0.02 + y * Math.cos(lean), -y * Math.sin(lean)], r: [Math.PI / 2 - lean, 0, 0], s: [1, 0.8, 1] })));
  for (const A of trunkOnly ? [] : J.arms) {
    out.coverall.push(seg(A.sh, A.el, 0.058), seg(A.el, A.wr, 0.05));
    out.reflex.push(seg(A.el, A.wr, 0.05, { at: 0.55 }));
    const d = new THREE.Vector3(...A.wr).sub(new THREE.Vector3(...A.el)).normalize().multiplyScalar(0.11);
    out.glove.push(seg(A.wr, new THREE.Vector3(...A.wr).add(d).toArray(), 0.047));
  }
  out.coverall.push({ g: GEO.cyl(0.055, 0.1, 8), p: [headC[0], headC[1] - 0.15, headC[2]] });
  out.skin.push({ g: GEO.sphere(0.105, 12, 9), p: headC, s: [0.92, 1.12, 0.95] });
  out.glasses.push({ g: GEO.box(0.17, 0.035, 0.05), p: [headC[0], headC[1] + 0.015, headC[2] - 0.08] });
  out.hat.push({ g: GEO.dome(0.13, 14, 7), p: [headC[0], headC[1] + 0.035, headC[2]], s: [1, 0.95, 1.05] },
               { g: GEO.cyl(0.155, 0.014, 16), p: [headC[0], headC[1] + 0.04, headC[2]] },
               { g: GEO.box(0.1, 0.012, 0.1), p: [headC[0], headC[1] + 0.04, headC[2] - 0.16] },
               { g: GEO.box(0.02, 0.02, 0.2), p: [headC[0], headC[1] + 0.14, headC[2]] });
  return out;
}
const FIG_MATS = (vest, hat, coverall) => ({ coverall, black: MAT.black, skin: SKIN, vest: { color: vest, metalness: 0, roughness: 0.7 }, reflex: REFLEX, glove: GLOVE, hat: { color: hat, metalness: 0.1, roughness: 0.4 }, glasses: GLASSES });
export function Crew({ position = [0, 0, 0], rotation = 0, pose = 'stand', vest = '#ff7a1a', hat = '#f2f2f2', seed = 0 }) {
  const ref = useRef();
  useFrame((state) => { if (ref.current) ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.9 + seed) * 0.015; });
  const coverall = COVERALLS[Math.abs(Math.round(seed * 7)) % COVERALLS.length];
  const parts = useMemo(() => figureParts(pose, { vest, hat, coverall }), [pose, vest, hat, coverall]);
  const mats = FIG_MATS(vest, hat, coverall);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group ref={ref}>
        {Object.keys(parts).map(k => parts[k].length ? <Merged key={k} mat={mats[k]} deps={[pose, vest, hat, coverall]} parts={() => parts[k]} shadow={k !== 'reflex' && k !== 'glasses'} /> : null)}
      </group>
    </group>
  );
}

// A worker walking a loop: the body from `figureParts` (stand) without the limbs, and animated legs and arms
// pivoting at hip and shoulder. Path points are [x, z]; the figure faces its direction of travel.
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
  const coverall = COVERALLS[Math.abs(Math.round(seed * 7)) % COVERALLS.length];
  const mats = FIG_MATS(vest, hat, coverall);
  // the trunk: everything from figureParts except the limbs (legs, arms, gloves, boots, limb bands)
  const trunk = useMemo(() => figureParts('stand', { vest, hat, coverall }, true), [vest, hat, coverall]);
  const leg = (r, x) => (
    <group ref={r} position={[x, 0.9, 0]}>
      <Merged mat={coverall} deps={[coverall]} parts={() => [seg([0, 0, 0], [0, -0.4, -0.02], 0.085), seg([0, -0.4, -0.02], [0, -0.77, 0], 0.07)]} />
      <Merged mat={REFLEX} deps={[]} shadow={false} parts={() => [seg([0, -0.4, -0.02], [0, -0.77, 0], 0.07, { at: 0.6 })]} />
      <Merged mat={MAT.black} deps={[]} parts={() => [{ g: GEO.rbox(0.13, 0.13, 0.3, 0.03, 1), p: [0, -0.835, -0.04] }]} />
    </group>
  );
  const arm = (r, x, sign) => (
    <group ref={r} position={[x, 1.45, 0]}>
      <Merged mat={coverall} deps={[coverall]} parts={() => [{ g: GEO.sphere(0.075, 8, 6), p: [0, 0, 0] }, seg([0, 0, 0], [sign * 0.06, -0.28, -0.03], 0.058), seg([sign * 0.06, -0.28, -0.03], [sign * 0.09, -0.52, -0.08], 0.05)]} />
      <Merged mat={GLOVE} deps={[]} parts={() => [seg([sign * 0.09, -0.52, -0.08], [sign * 0.1, -0.63, -0.1], 0.047)]} />
    </group>
  );
  return (
    <group ref={ref} name="LG-CREW-WALKER">
      <group ref={body}>
        {leg(legL, -0.1)}{leg(legR, 0.1)}
        {Object.keys(trunk).map(k => trunk[k].length ? <Merged key={k} mat={mats[k] || coverall} deps={[vest, hat, coverall]} parts={() => trunk[k]} shadow={k !== 'reflex' && k !== 'glasses'} /> : null)}
        {arm(armL, -0.2, -1)}{arm(armR, 0.2, 1)}
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
  // Drop 43: a printed flag reads correctly from both sides (two cloths sewn back to back), so the reverse is a
  // second mesh sharing the front's positions, normals and index with the texture mirrored across the hoist.
  const back = useMemo(() => {
    if (!map) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', geom.attributes.position); g.setAttribute('normal', geom.attributes.normal); g.setIndex(geom.index);
    const uv = geom.attributes.uv.array.slice(); for (let i = 0; i < uv.length; i += 2) uv[i] = 1 - uv[i];
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  }, [geom, map]);
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
        <meshStandardMaterial color={map ? '#ffffff' : color} map={map || undefined} roughness={0.85} side={map ? THREE.FrontSide : THREE.DoubleSide} shadowSide={THREE.DoubleSide} transparent={alpha} alphaTest={alpha ? 0.5 : 0} />
      </mesh>
      {back && (
        <mesh geometry={back} position={[w / 2 + 0.05, height - h / 2 - 0.1, 0]}>
          <meshStandardMaterial color="#ffffff" map={map} roughness={0.85} side={THREE.BackSide} transparent={alpha} alphaTest={alpha ? 0.5 : 0} />
        </mesh>
      )}
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
