// Customer logo plates (Drop 82). The theme's `site.logo` (an SVG or PNG data URL, loaded through the admin page or
// sent by the accounts server for the account's organization) is drawn once onto a canvas texture and placed as a
// thin plane a few millimeters proud of a painted surface: both sides of each pump's engine enclosure (or VFD
// cabinet) and both sides of the data van. With no logo nothing is drawn and nothing is loaded. The texture is
// shared, so the pump plates bake into one instanced draw with the rest of the pump; `useLogo()` reports when the
// image has decoded so the pump bake can rebuild once with the plate in it.
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useTheme } from '../../theme/theme.js';

const MAX_W = 512;
const pending = new Map();   // url -> promise
const ready = new Map();     // url -> { tex, aspect }

export function loadLogo(url) {
  if (ready.has(url)) return Promise.resolve(ready.get(url));
  if (pending.has(url)) return pending.get(url);
  const p = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('no document'));
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth || 512, ih = img.naturalHeight || 256;    // an SVG without a size reports 0 in some browsers
      const aspect = Math.max(0.25, Math.min(8, iw / ih));
      const w = Math.min(MAX_W, Math.max(64, iw)), h = Math.max(16, Math.round(w / aspect));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d'); ctx.clearRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
      const out = { tex, aspect, url };
      ready.set(url, out); pending.delete(url); resolve(out);
    };
    img.onerror = () => { pending.delete(url); reject(new Error('logo did not decode')); };
    img.src = url;
  });
  pending.set(url, p);
  return p;
}

// the current theme's logo once decoded, or null (no logo, still loading, or a bad image)
export function useLogo() {
  const url = useTheme(s => s.theme.site.logo);
  const [logo, setLogo] = useState(() => (url && ready.get(url)) || null);
  useEffect(() => {
    let on = true;
    if (!url) { setLogo(null); return undefined; }
    const have = ready.get(url);
    if (have) { setLogo(have); return undefined; }
    loadLogo(url).then(l => { if (on) setLogo(l); }, () => { if (on) setLogo(null); });
    return () => { on = false; };
  }, [url]);
  return logo;
}

// A plate on a surface: `width` is the plate's longest allowed width and `maxHeight` its tallest height; the logo keeps
// its own aspect inside that box. Faces +Z in its own frame (rotate to face the surface's normal).
export function LogoPlate({ position = [0, 0, 0], rotation = [0, 0, 0], width = 1.2, maxHeight = 0.6, logo = null }) {
  const own = useLogo();
  const l = logo || own;
  const size = useMemo(() => { if (!l) return null; let w = width, h = width / l.aspect; if (h > maxHeight) { h = maxHeight; w = h * l.aspect; } return [w, h]; }, [l, width, maxHeight]);
  if (!l || !size) return null;
  return (
    <mesh position={position} rotation={rotation} castShadow={false} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial map={l.tex} transparent alphaTest={0.4} roughness={0.55} metalness={0} />
    </mesh>
  );
}
