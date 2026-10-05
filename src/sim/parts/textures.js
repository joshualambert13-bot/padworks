// Photographic texture sets (Drop 44, rebuilt in Drop 76). Everything the pad draws is generated in code; when CC0
// photo sets are dropped into public/textures/ (see the README there) they become the detail layer of every
// material in their family (see DETAIL in lighting.jsx): sampled triplanar in world space by the material patch,
// so nothing needs UVs, nothing recompiles, and nothing happens for a file that is absent (an Image load that
// fails is the probe; a 404 page is not an image). Per family the files are
//
//   <family>_diff.jpg    color (sRGB); normalized to its mean so the palette color stays and the photo adds structure
//   <family>_nor.jpg     tangent-space normal map, OpenGL convention (Poly Haven's _nor_gl_)
//   <family>_rough.jpg   roughness (white is rough)
//   <family>_ao.jpg      ambient occlusion (optional; the ground and terrain use it)
//
// Families: ground (the pad), terrain (the land around it), sand, paint, steel, rust, rubber, concrete, plastic,
// liner, fabric, hivis. Lite never loads any of this.
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { DETAIL, LITE } from './lighting.jsx';

let installed = false;

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

// the photo becomes the texture's image; the 1x1 placeholder is replaced in place so every program keeps its binding
function adopt(uniform, img, srgb) {
  const t = new THREE.Texture(img);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  const old = uniform.value; uniform.value = t; if (old && old.dispose) old.dispose();
}

// Called once from the surface scene. Safe to call again; the probes run only the first time.
export function installTextureSets() {
  if (installed || typeof document === 'undefined' || LITE) return; installed = true;
  for (const fam in DETAIL) {
    const D = DETAIL[fam];
    probe(fam + '_diff.jpg', (img) => {
      const m = meanOf(img); const lum = 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2] || 0.5;
      // gain: the mean of the photo's luminance goes to 1, so the material color is kept on average; the color
      // channels keep their ratio to each other so the photo's hue reads where colorK lets it through
      const g = Math.min(6, 1 / lum); D.gain.value.set(g, g, g);
      adopt(D.map, img, true); D.has.map = true; D.k.value = 1;
    });
    probe(fam + '_nor.jpg', (img) => { adopt(D.normal, img, false); D.has.normal = true; D.nK.value = D.nKDefault; });
    probe(fam + '_rough.jpg', (img) => { const m = meanOf(img); D.rGain.value = 1 / Math.max(0.05, 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]); adopt(D.rough, img, false); D.has.rough = true; });
    probe(fam + '_ao.jpg', (img) => { adopt(D.ao, img, false); D.has.ao = true; });
  }
  if (typeof window !== 'undefined') window.__padworksDetail = DETAIL;   // test hook
}

// Water ripples (Drop 76): `water_nor.jpg` as the normal map of the pit's water, scrolled slowly by the pit itself.
let waterTex = null, waterProbed = false; const waterWaiters = new Set();
export function useWaterNormal() {
  const [tex, setTex] = useState(waterTex);
  useEffect(() => {
    if (LITE) return;
    const fn = (t) => setTex(t); waterWaiters.add(fn);
    if (!waterProbed) { waterProbed = true; probe('water_nor.jpg', (img) => { const t = new THREE.Texture(img); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 4); t.needsUpdate = true; waterTex = t; waterWaiters.forEach(f => f(t)); }); }
    return () => waterWaiters.delete(fn);
  }, []);
  return tex;
}
