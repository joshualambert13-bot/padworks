// Photographic skies (Drop 47). When public/textures/sky_<tod>.hdr exists (CC0 HDRIs from Poly Haven, see the
// README there), the Full renderer uses it as the visible sky and as the environment for reflections, in summer.
// The file is probed by loading it; a missing file (or the site's 404 page) fails to parse and leaves the
// atmosphere model in place. The HDRI's own sun is found as its brightest pixel, and the sky is turned about the
// vertical so that sun sits at the azimuth of the pad's sun light (`SUN[tod].dir`), which keeps shadows and the
// visible sun on the same side; elevation is whatever the photograph has. `intensity` scales the sky for the pad's
// exposure (AgX at 1.05 times TONE_GAIN); adjust `HDRI_LEVEL` if a set reads too bright or too dark.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { create } from 'zustand';

export const HDRI_LEVEL = { day: 1.0, dusk: 1.0, night: 1.0 };
const FILES = { day: '/textures/sky_day.hdr', dusk: '/textures/sky_dusk.hdr', night: '/textures/sky_night.hdr' };
const cache = new Map();   // tod -> { texture, sunDir } | null (absent)

// store: which skies are available (true), absent (false), or not yet probed (undefined)
export const useHdri = create((set) => ({ day: undefined, dusk: undefined, night: undefined, set: (tod, v) => set({ [tod]: v }) }));

// Direction of the brightest pixel of an equirectangular map, in three's equirect convention
// (u = atan2(z, x) / 2pi + 0.5, v = asin(y) / pi + 0.5, with v = 0 at the data's last row because flipY is set).
function brightestDirection(tex) {
  const { data, width, height } = tex.image;
  const half = tex.type === THREE.HalfFloatType;
  const read = half ? (i) => THREE.DataUtils.fromHalfFloat(data[i]) : (i) => data[i];
  let best = -1, bi = 0;
  const step = Math.max(1, Math.floor(width / 512));
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
    const i = (y * width + x) * 4; const l = read(i) * 0.3 + read(i + 1) * 0.59 + read(i + 2) * 0.11;
    if (l > best) { best = l; bi = y * width + x; }
  }
  const px = bi % width, py = Math.floor(bi / width);
  const u = (px + 0.5) / width, v = 1 - (py + 0.5) / height;
  const az = (u - 0.5) * Math.PI * 2, el = (v - 0.5) * Math.PI;
  return { dir: new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)), peak: best };
}

export function loadHdri(tod) {
  if (cache.has(tod)) return Promise.resolve(cache.get(tod));
  const p = new Promise((resolve) => {
    if (typeof window === 'undefined' || !FILES[tod]) { resolve(null); return; }
    new RGBELoader().load(FILES[tod], (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.LinearSRGBColorSpace;
      const sun = brightestDirection(tex);
      const entry = { texture: tex, sunDir: sun.dir, peak: sun.peak };
      cache.set(tod, entry); useHdri.getState().set(tod, true); resolve(entry);
    }, undefined, () => { cache.set(tod, null); useHdri.getState().set(tod, false); resolve(null); });
  });
  cache.set(tod, p);
  return p;
}

// Yaw (about Y) that puts the HDRI's sun at the azimuth of `sunDir`. three samples the background and the
// environment at R^-1 * direction (the uniform is the transposed rotation), so the map's sun H appears where
// R * H points; a rotation about Y by theta moves an azimuth to azimuth - theta, hence theta = azH - azS.
export function hdriYaw(entry, sunDir) {
  const azS = Math.atan2(sunDir.z, sunDir.x), azH = Math.atan2(entry.sunDir.z, entry.sunDir.x);
  return azH - azS;
}
