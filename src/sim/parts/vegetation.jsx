// Vegetation and terrain dressing by basin (Drop 14). Every plant type is a few instanced meshes (trunk, canopy
// tiers) with per-instance color variation, so a thousand plants cost a handful of draw calls. Rocks, a fence
// line, a cattle guard and gate sign at the pad entrance, and a distant horizon (mesas or a tree line) round
// out the location. Generic shapes; densities and colors come from the basin table.
import { useMemo, useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { terrainHeight } from './terrain.js';
import { LITE, strataTexture } from './lighting.jsx';
import { Sign } from './life.jsx';
import { MAT } from './primitives.jsx';

// deterministic generator
function rng(seed) { let k = seed * 9301 + 49297; return () => { k = (k * 9301 + 49297) % 233280; return k / 233280; }; }

// Plant recipes: parts are { geom, color, lift(s,h), scale(s) } evaluated per instance; `h` is the plant height.
const PLANTS = {
  pine: { h: [7, 12], w: [2.2, 3.4], parts: [
    { kind: 'trunk', r: 0.18, hFrac: 0.35, color: '#4a3324' },
    { kind: 'cone', y: 0.28, r: 1.0, h: 0.45, color: 0 },
    { kind: 'cone', y: 0.52, r: 0.78, h: 0.38, color: 0.12 },
    { kind: 'cone', y: 0.74, r: 0.52, h: 0.3, color: 0.22 },
  ] },
  hardwood: { h: [6, 10], w: [4.5, 7], parts: [
    { kind: 'trunk', r: 0.26, hFrac: 0.45, color: '#5a4332' },
    { kind: 'branch', color: '#5a4332' },
    { kind: 'blob', y: 0.62, r: 0.55, s: [1, 0.8, 1], color: 0 },
    { kind: 'blob', y: 0.72, r: 0.42, s: [0.9, 0.8, 0.9], dx: 0.28, color: 0.14 },
    { kind: 'blob', y: 0.7, r: 0.4, s: [0.9, 0.75, 0.9], dx: -0.3, color: -0.1 },
  ] },
  mesquite: { h: [2.4, 3.8], w: [3.5, 5.5], parts: [
    { kind: 'trunk', r: 0.14, hFrac: 0.4, color: '#4a3a2c', lean: 0.25 },
    { kind: 'blob', y: 0.55, r: 0.5, s: [1, 0.45, 1], color: 0 },
    { kind: 'blob', y: 0.6, r: 0.36, s: [0.9, 0.45, 0.9], dx: 0.35, color: 0.1 },
  ] },
  scrub: { h: [0.8, 1.6], w: [1.2, 2.2], parts: [
    { kind: 'blob', y: 0.4, r: 0.5, s: [1, 0.7, 1], color: 0 },
    { kind: 'blob', y: 0.45, r: 0.35, s: [0.8, 0.7, 0.8], dx: 0.3, color: 0.12 },
    { kind: 'blob', y: 0.35, r: 0.3, s: [0.8, 0.6, 0.8], dx: -0.3, color: -0.08 },
  ] },
  brush: { h: [1.3, 2.6], w: [1.8, 3.2], parts: [
    { kind: 'trunk', r: 0.08, hFrac: 0.3, color: '#4a3a2c' },
    { kind: 'blob', y: 0.5, r: 0.5, s: [1, 0.75, 1], color: 0 },
    { kind: 'blob', y: 0.55, r: 0.38, s: [0.85, 0.7, 0.85], dx: 0.32, color: 0.12 },
    { kind: 'blob', y: 0.45, r: 0.34, s: [0.85, 0.6, 0.85], dx: -0.34, color: -0.1 },
  ] },
  sage: { h: [0.5, 1.0], w: [0.9, 1.6], parts: [
    { kind: 'blob', y: 0.4, r: 0.5, s: [1, 0.6, 1], color: 0 },
    { kind: 'blob', y: 0.38, r: 0.36, s: [0.8, 0.55, 0.8], dx: 0.32, color: 0.1 },
  ] },
  grass: { h: [0.5, 0.9], w: [0.6, 1.0], parts: [{ kind: 'tuft', color: 0 }] },
};
const coneGeom = new THREE.ConeGeometry(1, 1, 7);
const blobGeom = new THREE.SphereGeometry(1, 7, 5);
const trunkGeom = new THREE.CylinderGeometry(0.7, 1, 1, 6);
const branchGeom = new THREE.CylinderGeometry(0.5, 1, 1, 5);
// grass tuft: two crossed quads with an alpha-tested blade silhouette
let tuftTex = null;
function tuftTexture() {
  if (tuftTex) return tuftTex;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) { const x0 = 14 + i * 4.5, lean = (i - 4) * 4; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x0, 64); ctx.quadraticCurveTo(x0 + lean * 0.3, 30, x0 + lean, 6 + Math.abs(i - 4) * 4); ctx.stroke(); }
  tuftTex = new THREE.CanvasTexture(c);
  return tuftTex;
}
const tuftGeom = (() => {
  const a = new THREE.PlaneGeometry(1, 1); a.translate(0, 0.5, 0);
  const b = a.clone(); b.rotateY(Math.PI / 2);
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [], nrm = [], idx = [];
  for (const q of [a, b]) { const base = pos.length / 3; pos.push(...q.attributes.position.array); uv.push(...q.attributes.uv.array); nrm.push(...q.attributes.normal.array); idx.push(...Array.from(q.index.array).map(i => i + base)); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
  return g;
})();

function Instanced({ geom, mat, items, shadow = true, name }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const im = ref.current; if (!im) return;
    const o = new THREE.Object3D(); const c = new THREE.Color();
    items.forEach((it, i) => { o.position.set(...it.p); o.rotation.set(...(it.r || [0, 0, 0])); o.scale.set(...it.s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); if (it.c) { c.set(it.c); im.setColorAt(i, c); } });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geom, undefined, items.length]} castShadow={shadow} receiveShadow name={name} key={items.length} frustumCulled={false}><meshStandardMaterial {...mat} /></instancedMesh>;
}

// Shade a base color: k in -0.25..0.25 darkens or lightens; v adds hue variety per plant
function shade(base, k, v) { const c = new THREE.Color(base); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h + v * 0.03, Math.max(0, Math.min(1, hsl.s + v * 0.08)), Math.max(0.05, Math.min(0.9, hsl.l * (1 + k) + v * 0.03))); return '#' + c.getHexString(); }

export function Vegetation({ terrain, pad, seed }) {
  const type = terrain.veg;
  const recipe = PLANTS[type] || PLANTS.scrub;
  const cap = LITE ? 550 : (type === 'pine' || type === 'hardwood' ? 1700 : 1200);
  const count = Math.round(Math.min(cap, cap * terrain.density + (type === 'grass' ? 500 : 0)));
  const parts = useMemo(() => {
    const rnd = rng(seed * 17 + 3);
    const out = recipe.parts.map(() => []);
    const rocks = [];
    let tries = 0, n = 0;
    while (n < count && tries < count * 6) {
      tries++;
      const x = (rnd() - 0.5) * 660, z = (rnd() - 0.5) * 660;
      if (x > pad.x0 - 5 && x < pad.x1 + 5 && z > pad.z0 - 5 && z < pad.z1 + 5) continue;
      if (Math.abs(z - (pad.z0 + 12)) < 7 && x > pad.x1) continue;   // keep the lease road clear
      const y = terrainHeight(x, z, terrain.relief, pad);
      const h = recipe.h[0] + rnd() * (recipe.h[1] - recipe.h[0]);
      const w = recipe.w[0] + rnd() * (recipe.w[1] - recipe.w[0]);
      const rot = rnd() * Math.PI * 2, v = rnd() - 0.5;
      recipe.parts.forEach((pt, k) => {
        if (pt.kind === 'trunk') out[k].push({ p: [x, y + h * pt.hFrac / 2, z], r: [pt.lean ? (rnd() - 0.5) * pt.lean : 0, rot, 0], s: [pt.r * (h / 6), h * pt.hFrac + 0.3, pt.r * (h / 6)], c: shade(pt.color, 0, v) });
        else if (pt.kind === 'branch') { for (let b = 0; b < 2; b++) { const a = rot + b * 2.2 + rnd(); out[k].push({ p: [x + Math.cos(a) * w * 0.12, y + h * 0.5, z + Math.sin(a) * w * 0.12], r: [0.6 * (b ? 1 : -1), a, 0.5], s: [0.1 * (h / 6), h * 0.3, 0.1 * (h / 6)], c: shade(pt.color, 0, v) }); } }
        else if (pt.kind === 'cone') out[k].push({ p: [x, y + h * pt.y, z], r: [0, rot, 0], s: [w * pt.r / 2, h * pt.h, w * pt.r / 2], c: shade(terrain.vegColor, pt.color, v) });
        else if (pt.kind === 'blob') { const dx = pt.dx || 0; out[k].push({ p: [x + Math.cos(rot) * dx * w, y + h * pt.y, z + Math.sin(rot) * dx * w], r: [0, rot, 0], s: [w * pt.r * pt.s[0], w * pt.r * pt.s[1], w * pt.r * pt.s[2]], c: shade(terrain.vegColor, pt.color, v) }); }
        else if (pt.kind === 'tuft') out[k].push({ p: [x, y, z], r: [0, rot, 0], s: [w, h, w], c: shade(terrain.vegColor, 0.05 + v * 0.2, v) });
      });
      n++;
    }
    // rocks: fewer, darker, flattened icosahedra
    const nr = LITE ? 80 : 180;
    for (let i = 0; i < nr; i++) {
      const x = (rnd() - 0.5) * 640, z = (rnd() - 0.5) * 640;
      if (x > pad.x0 - 3 && x < pad.x1 + 3 && z > pad.z0 - 3 && z < pad.z1 + 3) continue;
      const y = terrainHeight(x, z, terrain.relief, pad);
      const s = 0.3 + rnd() * 1.1;
      rocks.push({ p: [x, y + s * 0.2, z], r: [rnd(), rnd() * 3, rnd()], s: [s, s * 0.55, s * 0.8], c: shade(terrain.ground, -0.25 + rnd() * 0.15, 0) });
    }
    return { out, rocks };
  }, [count, pad.x0, pad.x1, pad.z0, pad.z1, terrain.relief, terrain.vegColor, terrain.ground, seed, recipe]);
  const tex = useMemo(() => tuftTexture(), []);
  return (
    <group>
      {recipe.parts.map((pt, k) => {
        const items = parts.out[k];
        if (pt.kind === 'trunk') return <Instanced key={k} geom={trunkGeom} mat={{ color: '#ffffff', roughness: 0.95, metalness: 0 }} items={items} />;
        if (pt.kind === 'branch') return <Instanced key={k} geom={branchGeom} mat={{ color: '#ffffff', roughness: 0.95, metalness: 0 }} items={items} shadow={false} />;
        if (pt.kind === 'cone') return <Instanced key={k} geom={coneGeom} mat={{ color: '#ffffff', roughness: 0.9, metalness: 0 }} items={items} />;
        if (pt.kind === 'blob') return <Instanced key={k} geom={blobGeom} mat={{ color: '#ffffff', roughness: 0.9, metalness: 0 }} items={items} />;
        if (pt.kind === 'tuft') return <Instanced key={k} geom={tuftGeom} mat={{ color: '#ffffff', roughness: 0.9, metalness: 0, alphaMap: tex || undefined, transparent: false, alphaTest: 0.45, side: THREE.DoubleSide }} items={items} shadow={false} />;
        return null;
      })}
      <Instanced geom={blobGeom} mat={{ color: '#ffffff', roughness: 0.95, metalness: 0, flatShading: true }} items={parts.rocks} />
    </group>
  );
}

// ---------------------------------------------------------------- horizon
// Distant relief that the flat terrain cannot carry: mesas and buttes for the desert basins, a tree line for the
// forested ones, rolling ridges for the plains. One merged ring at 450 to 620 m, caught by the fog.
export function Horizon({ terrain, pad, seed = 1 }) {
  const kind = terrain.veg === 'pine' || terrain.veg === 'hardwood' ? 'treeline' : terrain.relief < 0.7 ? 'mesa' : 'ridge';
  const items = useMemo(() => {
    const rnd = rng(seed * 31 + 7);
    const out = [];
    const pine = terrain.veg === 'pine';
    if (kind === 'treeline') {
      // two staggered rings of canopy at the clearing edge, pointed for pine
      for (let i = 0; i < 260; i++) { const a = i / 260 * Math.PI * 2 + rnd() * 0.03; const d = 330 + (i % 2) * 22 + rnd() * 18; const x = Math.cos(a) * d, z = Math.sin(a) * d; const y = terrainHeight(x, z, terrain.relief, pad); const h = pine ? 12 + rnd() * 6 : 9 + rnd() * 6; out.push({ p: [x, y + (pine ? h * 0.5 : h / 2), z], r: [0, rnd(), 0], s: [pine ? 7 + rnd() * 3 : 11 + rnd() * 7, h, pine ? 7 + rnd() * 3 : 7 + rnd() * 4], c: shade(terrain.vegColor, -0.12 + rnd() * 0.12, 0) }); }
    } else if (kind === 'mesa') {
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + rnd() * 0.5; const d = 400 + rnd() * 160; const x = Math.cos(a) * d, z = Math.sin(a) * d; const w = 120 + rnd() * 220, h = 28 + rnd() * 40; out.push({ p: [x, h / 2 - 3, z], r: [0, rnd() * Math.PI, 0], s: [w, h, 60 + rnd() * 90], c: shade(terrain.ground, -0.1 + rnd() * 0.1, 0) }); }
    } else {
      for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + rnd() * 0.3; const d = 400 + rnd() * 180; const x = Math.cos(a) * d, z = Math.sin(a) * d; const w = 160 + rnd() * 220, h = 24 + rnd() * 40; out.push({ p: [x, -h * 0.15, z], r: [0, rnd() * Math.PI, 0], s: [w, h, 90 + rnd() * 120], c: shade(terrain.ground, -0.06 + rnd() * 0.1, 0) }); }
    }
    return out;
  }, [kind, terrain.relief, terrain.ground, terrain.vegColor, pad, seed]);
  // mesa: talus slope, stepped cliff, flat cap, with noise around the rim; ridge: a lumpy dome. Both carry the
  // strata texture and smooth normals, so the horizon reads as rock rather than as a prism (Drop 23).
  const mesaGeom = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.42, 0.56, 1, 36, 10);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r0 = Math.hypot(x, z); if (r0 < 1e-4) continue;
      const h = y + 0.5, a = Math.atan2(z, x);
      const profile = h < 0.4 ? 0.56 - 0.1 * (h / 0.4) ** 1.6 : h < 0.9 ? 0.46 - 0.02 * (h - 0.4) / 0.5 - (Math.sin(h * 22) > 0.6 ? 0.012 : 0) : 0.44 - 0.02 * (h - 0.9) / 0.1;
      const n = 1 + 0.09 * (Math.sin(a * 3 + h * 2) * 0.5 + Math.sin(a * 7 + 1.3) * 0.3 + Math.sin(a * 13 + h * 9) * 0.2);
      const r = profile * n;
      pos.setX(i, x / r0 * r); pos.setZ(i, z / r0 * r);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const ridgeGeom = useMemo(() => {
    const g = new THREE.SphereGeometry(0.5, 28, 14);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const a = Math.atan2(z, x), k = 1 + 0.12 * (Math.sin(a * 4 + y * 6) * 0.5 + Math.sin(a * 9 + 2) * 0.3 + Math.sin(y * 20 + a * 2) * 0.2);
      pos.setX(i, x * k); pos.setZ(i, z * k); pos.setY(i, y * (1 + 0.06 * Math.sin(a * 5)));
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const strata = useMemo(() => strataTexture(), []);
  const treeGeom = useMemo(() => terrain.veg === 'pine' ? new THREE.ConeGeometry(0.5, 1, 6) : new THREE.SphereGeometry(0.5, 7, 5), [terrain.veg]);
  return <Instanced geom={kind === 'treeline' ? treeGeom : kind === 'mesa' ? mesaGeom : ridgeGeom} mat={{ color: '#ffffff', roughness: 1, metalness: 0, map: kind === 'treeline' ? undefined : strata || undefined, userData: kind === 'treeline' ? { grime: 0 } : { grime: 0, mesa: 1 } }} items={items} shadow={false} />;
}

// ---------------------------------------------------------------- fence, cattle guard, gate sign
// Barbed-wire fence along both sides of the lease road from the pad gate out to the edge of the terrain,
// a cattle guard at the gate, and the entrance sign. Posts are instanced; wire runs are long thin boxes.
export function RoadFurniture({ pad }) {
  const z = pad.z0 + 12;
  const x0 = pad.x1 + 2, x1 = pad.x1 + 320;
  const posts = useMemo(() => {
    const out = [];
    for (let x = x0 + 6; x < x1; x += 4) for (const side of [-1, 1]) out.push({ p: [x, 0.6, z + side * 6.5], s: [0.07, 1.3, 0.07], c: '#6b5a48' });
    return out;
  }, [x0, x1, z]);
  const postGeom = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 5), []);
  return (
    <group>
      <Instanced geom={postGeom} mat={{ color: '#ffffff', roughness: 0.95, metalness: 0 }} items={posts} shadow={false} />
      {[-1, 1].map(side => [0.45, 0.8, 1.15].map((y, k) => (
        <mesh key={side + '-' + k} position={[(x0 + 6 + x1) / 2, y, z + side * 6.5]}><boxGeometry args={[x1 - x0 - 6, 0.012, 0.012]} /><meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.5} /></mesh>
      )))}
      {/* cattle guard: a grid of bars across the road at the gate, with end posts */}
      <group position={[x0 + 3, 0, z]}>
        <mesh position={[0, 0.03, 0]}><boxGeometry args={[2.6, 0.06, 7.2]} /><meshStandardMaterial color="#2a2d31" roughness={0.8} /></mesh>
        {Array.from({ length: 11 }).map((_, i) => <mesh key={i} position={[-1.1 + i * 0.22, 0.1, 0]}><boxGeometry args={[0.08, 0.1, 7.0]} /><meshStandardMaterial {...MAT.steel} /></mesh>)}
        {[-1, 1].map(side => <mesh key={side} position={[0, 0.9, side * 3.7]}><cylinderGeometry args={[0.08, 0.08, 1.8, 6]} /><meshStandardMaterial color="#6b5a48" roughness={0.9} /></mesh>)}
      </group>
      <Sign lines={['WELL SITE', 'ALL VISITORS CHECK IN', 'AT THE DATA VAN']} position={[x0 + 5, 1.7, z - 5.2]} rotation={[0, Math.PI / 2, 0]} width={1.6} height={0.8} post={1.3} />
      <Sign lines={['H2S MAY BE PRESENT', 'NO SMOKING'] } position={[x0 + 5, 1.6, z + 5.2]} rotation={[0, Math.PI / 2, 0]} width={1.4} height={0.6} post={1.3} danger />
    </group>
  );
}
