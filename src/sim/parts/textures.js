// Photographic texture sets (Drop 44, rebuilt in Drop 76, GPU-compressed in Drop 86). Everything the pad draws is
// generated in code; the CC0 photo sets in assets/textures (see public/textures/README.md) become the detail layer
// of every material in their family (see DETAIL in lighting.jsx): sampled triplanar in world space by the material
// patch, so nothing needs UVs, nothing recompiles, and nothing happens for a set that is absent. Per family:
//
//   <family>_diff     color (sRGB); normalized to its mean so the palette color stays and the photo adds structure
//   <family>_nor      tangent-space normal map, OpenGL convention (Poly Haven's _nor_gl_)
//   <family>_rough    roughness (white is rough)
//   <family>_ao       ambient occlusion (optional; the ground and terrain use it)
//
// Families: ground (the pad), terrain (the land around it), sand, paint, steel, rust, rubber, concrete, plastic,
// liner, fabric, hivis. Lite never loads any of this.
//
// Since Drop 86 the files the site serves are KTX2 (scripts/ktx-pack.mjs): public/textures/index.json lists, per
// texture, the file for each device tier and the mean color the normalization needs (read from the source at pack
// time; a compressed texture cannot be read back). A phone gets the 1k file where the source is 2k. Without an
// index (a checkout before the pack ran) the JPGs are probed one by one as before.
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { DETAIL, LITE } from './lighting.jsx';
import { loadKtx2 } from './gpu.js';
import { TIER } from './tier.js';

let installed = false;
let indexPromise = null;
function textureIndex() {
  if (!indexPromise) indexPromise = fetch('/textures/index.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
  return indexPromise;
}
export function textureFile(index, name) {
  const e = index && index[name]; if (!e) return null;
  return '/textures/' + (TIER.id === 'phone' && e.phone ? e.phone : e.full);
}

function probe(file, onload) {
  try {
    const img = new Image();
    img.onload = () => { if (img.naturalWidth > 0) onload(img); };
    img.onerror = () => {};
    img.src = '/textures/' + file;
  } catch { /* no DOM */ }
}

// mean of the image (per channel, 0..1), from a 32 px reduction
function meanOf(img) {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, 32, 32);
  const d = ctx.getImageData(0, 0, 32, 32).data; const m = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) { m[0] += d[i]; m[1] += d[i + 1]; m[2] += d[i + 2]; }
  const n = d.length / 4; return m.map(v => v / n / 255);
}
const lumOf = (m) => 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2];

// the photo becomes the texture's image; the 1x1 placeholder is replaced in place so every program keeps its binding
function adopt(uniform, img, srgb) {
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = TIER.anisotropy; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  const old = uniform.value; uniform.value = t; if (old && old.dispose) old.dispose();
}
function adoptTex(uniform, tex, srgb) {
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; tex.needsUpdate = true;
  const old = uniform.value; uniform.value = tex; if (old && old.dispose) old.dispose();
}
function applyDiff(D, mean) {
  const lum = lumOf(mean) || 0.5;
  // gain: the mean of the photo's luminance goes to 1, so the material color is kept on average; the color
  // channels keep their ratio to each other so the photo's hue reads where colorK lets it through
  const g = Math.min(6, 1 / lum); D.gain.value.set(g, g, g);
  D.has.map = true; D.k.value = 1;
}
function applyRough(D, mean) { D.rGain.value = 1 / Math.max(0.05, lumOf(mean)); D.has.rough = true; }

// Called once from the surface scene. Safe to call again; the loads run only the first time.
export function installTextureSets() {
  if (installed || typeof document === 'undefined' || LITE) return; installed = true;
  if (typeof window !== 'undefined') window.__padworksDetail = DETAIL;   // test hook
  textureIndex().then((index) => {
    for (const fam in DETAIL) {
      const D = DETAIL[fam];
      if (index) {
        const want = (kind, srgb, after) => {
          const file = textureFile(index, fam + '_' + kind); if (!file) return;
          loadKtx2(file, { repeat: true, anisotropy: TIER.anisotropy }).then((tex) => { after(tex, index[fam + '_' + kind]); }).catch(() => {});
        };
        want('diff', true, (tex, e) => { adoptTex(D.map, tex, true); applyDiff(D, e.mean || [0.5, 0.5, 0.5]); });
        want('nor', false, (tex) => { adoptTex(D.normal, tex, false); D.has.normal = true; D.nK.value = D.nKDefault; });
        want('rough', false, (tex, e) => { adoptTex(D.rough, tex, false); applyRough(D, e.mean || [0.5, 0.5, 0.5]); });
        want('ao', false, (tex) => { adoptTex(D.ao, tex, false); D.has.ao = true; });
        continue;
      }
      probe(fam + '_diff.jpg', (img) => { adopt(D.map, img, true); applyDiff(D, meanOf(img)); });
      probe(fam + '_nor.jpg', (img) => { adopt(D.normal, img, false); D.has.normal = true; D.nK.value = D.nKDefault; });
      probe(fam + '_rough.jpg', (img) => { adopt(D.rough, img, false); applyRough(D, meanOf(img)); });
      probe(fam + '_ao.jpg', (img) => { adopt(D.ao, img, false); D.has.ao = true; });
    }
  });
}

// Water ripples (Drop 76): `water_nor` as the normal map of the pit's water, scrolled slowly by the pit itself.
let waterTex = null, waterProbed = false; const waterWaiters = new Set();
export function useWaterNormal() {
  const [tex, setTex] = useState(waterTex);
  useEffect(() => {
    if (LITE) return;
    const fn = (t) => setTex(t); waterWaiters.add(fn);
    if (!waterProbed) {
      waterProbed = true;
      const got = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 4); t.needsUpdate = true; waterTex = t; waterWaiters.forEach(f => f(t)); };
      textureIndex().then((index) => {
        const file = textureFile(index, 'water_nor');
        if (file) loadKtx2(file, { repeat: true }).then(got).catch(() => {});
        else probe('water_nor.jpg', (img) => got(new THREE.Texture(img)));
      });
    }
    return () => waterWaiters.delete(fn);
  }, []);
  return tex;
}
export { textureIndex };
