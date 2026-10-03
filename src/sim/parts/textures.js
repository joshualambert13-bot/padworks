// Optional photographic texture sets (Drop 44). Everything the pad draws is generated in code; when CC0 photo sets
// are dropped into public/textures/ (see the README there) they are swapped INTO the generated textures' images,
// so every material that shares a generated texture picks the photo up at once, with no recompile and no new
// textures. Each photo is reduced to luminance and rescaled to the generated tile's mean, so it adds grain and
// detail while the material colors (basin ground, paint colors) stay what they are. Nothing happens for a set
// whose files are absent (an Image load that fails is the probe; a 404 page is not an image).
//
//   ground_diff.jpg   the pad and the surrounding ground (one tile is about 3 m)
//   paint_diff.jpg    painted sheet metal: the grime tile on every painted surface
//   paint_rough.jpg   painted sheet metal: the wear tile (roughness and bump) on every painted surface
//   steel_rough.jpg   bare steel: the brushed roughness tile
import { padTexture, noiseTexture, grimeTexture, wearTexture, brushedTexture } from './lighting.jsx';

let installed = false;

// Draw `img` into the texture's canvas as luminance with the canvas's current mean, then mark the texture for upload
function swapIn(tex, img, { metersPerTile = null, generatedMeters = null } = {}) {
  const c = tex.image; if (!c || !c.getContext) return;
  const ctx = c.getContext('2d');
  const before = ctx.getImageData(0, 0, c.width, c.height).data;
  let sum = 0; for (let i = 0; i < before.length; i += 4) sum += before[i];
  const target = sum / (before.length / 4) / 255;
  const size = Math.min(1024, img.naturalWidth || 1024);
  c.width = size; c.height = size;
  ctx.drawImage(img, 0, 0, size, size);
  const d = ctx.getImageData(0, 0, size, size), p = d.data;
  let lum = 0; for (let i = 0; i < p.length; i += 4) lum += 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
  const mean = lum / (p.length / 4) / 255 || 0.5, k = target / mean;
  for (let i = 0; i < p.length; i += 4) { const g = Math.max(0, Math.min(255, (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) * k)); p[i] = p[i + 1] = p[i + 2] = g; }
  ctx.putImageData(d, 0, 0);
  if (metersPerTile && generatedMeters) tex.repeat.multiplyScalar(generatedMeters / metersPerTile);
  tex.needsUpdate = true;
}

function probe(file, onload) {
  try {
    const img = new Image();
    img.onload = () => { if (img.naturalWidth > 0) onload(img); };
    img.onerror = () => {};
    img.src = '/textures/' + file;
  } catch { /* no DOM */ }
}

// Called once from the surface scene. Safe to call again; the probes run only the first time.
export function installTextureSets() {
  if (installed || typeof document === 'undefined') return; installed = true;
  probe('ground_diff.jpg', (img) => {
    const pad = padTexture(); if (pad) swapIn(pad, img, { metersPerTile: 3, generatedMeters: 16 });
    const ground = noiseTexture('ground', { size: 256, octaves: 5, base: 0.78, amp: 0.3, period: 8, repeat: 90 }); if (ground) swapIn(ground, img, { metersPerTile: 3, generatedMeters: 8 });
  });
  probe('paint_diff.jpg', (img) => { const t = grimeTexture(); if (t) swapIn(t, img); });
  probe('paint_rough.jpg', (img) => { const t = wearTexture(); if (t) swapIn(t, img); });
  probe('steel_rough.jpg', (img) => { const t = brushedTexture(); if (t) swapIn(t, img); });
}
