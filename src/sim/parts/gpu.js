// The graphics chip, asked once (Drop 86): its name and which compressed-texture formats it takes, read from a
// throwaway WebGL context before any scene exists, so the device tier (tier.js) and the KTX2 transcoder can be set
// up before the first model loads. The KTX2 loader is one shared instance: the GLTF loaders (props, crew, pickups)
// get it through `withKtx`, the detail sets and decals load through `loadKtx2`. The transcoder (Basis Universal,
// Apache-2.0, shipped with three.js) sits in public/basis and runs in web workers.
import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

function probe() {
  const out = { name: 'unknown', webgl2: false, extensions: new Set(), maxTexture: 4096 };
  if (typeof document === 'undefined') return out;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) || c.getContext('webgl');
    if (!gl) return out;
    out.webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    out.name = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    for (const e of gl.getSupportedExtensions() || []) out.extensions.add(e);
    out.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
  } catch { /* keep the defaults */ }
  return out;
}
export const GPU = probe();

let loader = null;
export function ktx2Loader() {
  if (loader) return loader;
  loader = new KTX2Loader().setTranscoderPath('/basis/');
  // detectSupport reads the renderer's extension list; the probe's answers stand in for it (same chip, same formats)
  const fake = { isWebGPURenderer: false, extensions: { has: (n) => GPU.extensions.has(n), get: (n) => (n === 'WEBGL_compressed_texture_astc' ? { getSupportedProfiles: () => ['ldr'] } : null) } };
  loader.detectSupport(fake);
  loader.setWorkerLimit(typeof navigator !== 'undefined' && navigator.hardwareConcurrency >= 6 ? 4 : 2);
  return loader;
}
// for drei's useGLTF: `useGLTF(url, undefined, undefined, withKtx)`
export function withKtx(gltfLoader) { gltfLoader.setKTX2Loader(ktx2Loader()); }

// a KTX2 file as a texture (compressed, mipmaps included; `repeat` sets wrapping, `anisotropy` the sampling)
export function loadKtx2(url, { repeat = false, anisotropy = 4 } = {}) {
  return new Promise((resolve, reject) => {
    ktx2Loader().load(url, (tex) => {
      if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
      tex.anisotropy = anisotropy; tex.minFilter = tex.mipmaps && tex.mipmaps.length > 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true; resolve(tex);
    }, undefined, reject);
  });
}

// GPU bytes of a texture as the renderer holds it (Drop 86 diagnostics): compressed levels as uploaded, images at
// 4 bytes a pixel plus a third for mipmaps, data textures by their type
export function textureBytes(t) {
  if (!t) return 0;
  if (t.isCompressedTexture) return (t.mipmaps || []).reduce((n, m) => n + (m.data ? m.data.byteLength : 0), 0) * (t.isCubeTexture ? 6 : 1);
  const img = t.image; if (!img) return 0;
  const faces = t.isCubeTexture ? 6 : 1;
  const one = Array.isArray(img) ? img[0] : img; if (!one) return 0;
  const w = one.width || one.naturalWidth || one.videoWidth || 0, h = one.height || one.naturalHeight || one.videoHeight || 0;
  let bpp = 4;
  if (t.isDataTexture || t.isDataArrayTexture) {
    const ch = t.format === THREE.RedFormat ? 1 : t.format === THREE.RGFormat ? 2 : t.format === THREE.RGBFormat ? 3 : 4;
    const bytes = t.type === THREE.FloatType ? 4 : t.type === THREE.HalfFloatType ? 2 : 1;
    bpp = ch * bytes;
  } else if (t.type === THREE.HalfFloatType) bpp = 8; else if (t.type === THREE.FloatType) bpp = 16;
  const depth = one.depth || 1;
  return w * h * depth * bpp * faces * (t.generateMipmaps ? 4 / 3 : 1);
}
