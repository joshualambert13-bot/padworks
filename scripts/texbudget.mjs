// Texture memory budget (Drop 86): what the shipped files will take on the GPU, per device tier, from the files
// alone (no browser): every KTX2 texture in the props and crew GLBs and in public/textures, the sky of one time of
// day, and the shadow map. Compressed levels are counted at 8 bits a pixel, the ASTC and BC7 rate (a laptop on BC1
// takes half for the opaque ETC1S files), so the numbers are a ceiling. The pass runs this and fails above the
// budget; `node scripts/texbudget.mjs` prints the table.
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

export const BUDGET_MB = { phone: 120, laptop: 320 };   // textures, sky and shadow map only; geometry and frame buffers come on top
const SHADOW = { phone: 1024, laptop: 2048 }, SKY = { phone: [1024, 512], laptop: [2048, 1024] };

// KTX2: width, height, levels from the 48-byte header
function ktx2Info(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const ok = buf[1] === 0x4b && buf[2] === 0x54 && buf[3] === 0x58 && buf[4] === 0x20 && buf[5] === 0x32 && buf[6] === 0x30;
  if (!ok) return null;
  return { vkFormat: dv.getUint32(12, true), width: dv.getUint32(20, true), height: dv.getUint32(24, true), levels: dv.getUint32(40, true), scheme: dv.getUint32(44, true) };
}
// GPU bytes of a block-compressed texture with mipmaps at `bpp` bits a pixel (blocks of 4x4: every level is at least one block)
function gpuBytes(info, bpp = 8) {
  let n = 0;
  for (let l = 0; l < info.levels; l++) { const w = Math.max(4, info.width >> l), h = Math.max(4, info.height >> l); n += w * h * bpp / 8; }
  return n;
}

export async function budget(root = '.') {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setLogger(new Logger(Logger.Verbosity.ERROR));
  const out = {};
  for (const tier of ['phone', 'laptop']) {
    const suffix = tier === 'phone' ? '.phone' : '';
    const rows = []; let models = 0, detail = 0, plain = 0;
    for (const kind of ['props', 'crew']) {
      const dir = path.join(root, 'public/models', kind); if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir).filter(f => f.endsWith(suffix + '.glb') && (suffix || !f.endsWith('.phone.glb')))) {
        const doc = await io.read(path.join(dir, f)); let b = 0, n = 0;
        for (const t of doc.getRoot().listTextures()) {
          const img = t.getImage(); if (!img) continue; n++;
          const info = ktx2Info(img);
          if (info) b += gpuBytes(info);
          else { plain += 1; b += (t.getSize() ? t.getSize()[0] * t.getSize()[1] : 1024 * 1024) * 4 * 4 / 3; }   // an uncompressed image: 4 bytes a pixel plus mipmaps
        }
        models += b; rows.push([kind + '/' + f, n, b]);
      }
    }
    const index = JSON.parse(fs.readFileSync(path.join(root, 'public/textures/index.json'), 'utf8'));
    for (const name in index) {
      const e = index[name]; const file = tier === 'phone' && e.phone ? e.phone : e.full;
      const info = ktx2Info(fs.readFileSync(path.join(root, 'public/textures', file)));
      const b = info ? gpuBytes(info) : 0; detail += b; rows.push(['textures/' + file, 1, b]);
    }
    const sky = SKY[tier][0] * SKY[tier][1] * 8 * 4 / 3 + 256 * 256 * 8 * 6 * 1.2;   // half-float equirect with mipmaps, and the prefiltered cube the renderer keeps
    const shadow = SHADOW[tier] * SHADOW[tier] * 8;
    const total = models + detail + sky + shadow;
    out[tier] = { modelsMB: Math.round(models / 1e6), detailMB: Math.round(detail / 1e6), skyMB: Math.round(sky / 1e6), shadowMB: Math.round(shadow / 1e6), totalMB: Math.round(total / 1e6), budgetMB: BUDGET_MB[tier], plain, rows: rows.sort((a, b) => b[2] - a[2]) };
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('texbudget.mjs')) {
  const b = await budget();
  let fail = false;
  for (const tier of ['phone', 'laptop']) {
    const t = b[tier];
    console.log(`${tier}: models ${t.modelsMB} MB, detail sets and decals ${t.detailMB} MB, sky ${t.skyMB} MB, shadow map ${t.shadowMB} MB, total ${t.totalMB} MB (budget ${t.budgetMB} MB)${t.plain ? ', ' + t.plain + ' uncompressed images' : ''}`);
    if (process.argv.includes('-v')) for (const [n, c, bytes] of t.rows.slice(0, 25)) console.log('   ', n.padEnd(40), String(c).padStart(2), (bytes / 1e6).toFixed(1).padStart(6), 'MB');
    if (t.totalMB > t.budgetMB) fail = true;
  }
  if (fail) { console.log('over budget'); process.exit(1); }
}
