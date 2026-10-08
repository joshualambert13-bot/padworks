// Photographic decals (Drop 76): PNGs with transparency dropped into public/textures/ are laid on the pad where the
// stain map (Drop 44) already puts its marks, so the two agree: `decal_oil.png` under every power end and at the
// drips, `decal_stain.png` on the wet and muddy spots, `decal_tiretrack.png` along the truck lanes, `decal_crack.png`
// scattered over the pad. Each kind is one InstancedMesh (one draw call), so a pad with twenty pumps costs four
// draws. Nothing is drawn for a file that is absent, and Lite draws none of them. Since Drop 86 the decals are KTX2
// files listed in public/textures/index.json (scripts/ktx-pack.mjs); the PNGs are probed only when there is no index.
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { LITE } from './lighting.jsx';
import { loadKtx2 } from './gpu.js';
import { TIER } from './tier.js';
import { textureIndex, textureFile } from './textures.js';

const FILES = ['oil', 'stain', 'tiretrack', 'crack'];
let loaded = null, probed = false;   // { oil: Texture, ... } for the files that exist, once every probe has answered
const waiters = new Set();
function probeAll() {
  if (loaded || typeof document === 'undefined') return;
  loaded = {}; let left = FILES.length;
  const done = () => { if (--left === 0) { probed = true; waiters.forEach(fn => fn({ ...loaded })); } };
  textureIndex().then((index) => {
    for (const k of FILES) {
      const file = textureFile(index, 'decal_' + k);
      if (file) { loadKtx2(file, { anisotropy: TIER.anisotropy }).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; loaded[k] = t; done(); }, () => done()); continue; }
      if (index) { done(); continue; }
      const img = new Image();
      img.onload = () => { if (img.naturalWidth > 0) { const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = TIER.anisotropy; t.needsUpdate = true; loaded[k] = t; } done(); };
      img.onerror = () => { done(); };
      img.src = '/textures/decal_' + k + '.png';
    }
  });
}
function useDecalTextures() {
  const [tex, setTex] = useState(() => (probed ? { ...loaded } : null));
  useEffect(() => { if (LITE) return; const fn = (t) => setTex(t); waiters.add(fn); probeAll(); return () => waiters.delete(fn); }, []);
  return tex;
}

// one kind of decal: flat quads at y 0.02 with polygon offset so they sit on the pad without z-fighting
function DecalSet({ texture, items, color = '#ffffff', opacity = 1 }) {
  const mesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ map: texture, color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 0.9, metalness: 0, userData: { grime: 0 } });
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    items.forEach((it, i) => { e.set(0, it.rot || 0, 0); q.setFromEuler(e); sc.set(it.sx, 1, it.sz); pos.set(it.x, 0.02, it.z); m.compose(pos, q, sc); im.setMatrixAt(i, m); });
    im.instanceMatrix.needsUpdate = true; im.renderOrder = 1; im.receiveShadow = true; im.frustumCulled = false;
    im.raycast = () => null;
    return im;
  }, [texture, items, color, opacity]);
  useEffect(() => () => { mesh.geometry.dispose(); mesh.material.dispose(); }, [mesh]);
  return <primitive object={mesh} />;
}

const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
export function Decals({ layout }) {
  const tex = useDecalTextures();
  const sets = useMemo(() => {
    if (!layout) return null;
    const oil = [], stain = [], track = [], crack = [];
    for (const sp of layout.spots || []) {
      if (sp.light) continue;
      const r = hash(sp.x, sp.z);
      if (sp.drips) oil.push({ x: sp.x, z: sp.z, sx: sp.rx * 2.2, sz: sp.rz * 2.4, rot: (sp.rot || 0) + (r - 0.5) * 0.4 });
      else if (sp.rx <= 10) stain.push({ x: sp.x, z: sp.z, sx: sp.rx * 2.4, sz: sp.rz * 2.6, rot: (sp.rot || 0) + r * Math.PI });
    }
    for (const lane of layout.lanes || []) {
      for (let i = 1; i < lane.length; i++) {
        const [ax, az] = lane[i - 1], [bx, bz] = lane[i];
        const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 2) continue;
        const rot = Math.atan2(-dz, dx);   // the track image runs left to right, which is the quad's +x; turn +x along the lane
        for (let d = 3; d < L - 3; d += 7) { const t = d / L; track.push({ x: ax + dx * t, z: az + dz * t, sx: 7, sz: 3.2, rot }); }
      }
    }
    const pad = layout.pad;
    if (pad) for (let i = 0; i < 24; i++) { const u = hash(i * 3.1, 7), v = hash(11, i * 5.7); crack.push({ x: pad.x0 + 4 + u * (pad.x1 - pad.x0 - 8), z: pad.z0 + 4 + v * (pad.z1 - pad.z0 - 8), sx: 2.5 + u * 2, sz: 2.5 + v * 2, rot: u * Math.PI }); }
    return { oil, stain, track, crack };
  }, [layout]);
  if (LITE || !tex || !sets) return null;
  return (
    <group name="DECALS">
      {tex.crack && <DecalSet texture={tex.crack} items={sets.crack} opacity={0.6} />}
      {tex.tiretrack && <DecalSet texture={tex.tiretrack} items={sets.track} opacity={0.75} />}
      {tex.stain && <DecalSet texture={tex.stain} items={sets.stain} opacity={0.85} />}
      {tex.oil && <DecalSet texture={tex.oil} items={sets.oil} opacity={1} />}
    </group>
  );
}
