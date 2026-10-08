// GPU-compressed textures (Drop 86). Every photographic texture the site ships (the downloaded props and crew models
// in assets/models, the CC0 detail sets and decals in assets/textures) is converted to KTX2 with Basis Universal
// supercompression, which the browser transcodes to whatever block format its GPU takes (ASTC on phones, BC on
// laptops) and uploads as is: 4 to 8 bits per pixel on the GPU instead of 32, mipmaps included, no JPEG decoding, no
// image bitmaps held in memory. Two tiers come out of each source: the laptop tier at the source size (1k props, 2k
// ground) and a phone tier capped at half that (512 props and crew, 1k detail). Normal maps use UASTC (ETC1S smears
// them); everything else ETC1S. Sources stay uncompressed in assets/ so a re-pack at another size is one command.
//
//   node scripts/ktx-pack.mjs                 everything (models and textures, both tiers)
//   node scripts/ktx-pack.mjs models pickup   one model
//   node scripts/ktx-pack.mjs textures        the detail sets, decals and water, plus public/textures/index.json
//
// Needs toktx from KTX-Software (Apache-2.0, github.com/KhronosGroup/KTX-Software) on the PATH or in TOKTX.
// Outputs: public/models/<kind>/<id>.glb (laptop) and <id>.phone.glb; public/textures/<name>.ktx2 and, where the
// source is larger than the phone cap, <name>.1k.ktx2; public/textures/index.json (which file per tier, the mean of
// each color map and the mean roughness, which textures.js used to read from the pixels).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRTextureBasisu } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';

const TOKTX = process.env.TOKTX || 'toktx';
const TIERS = { laptop: { models: 1024, detail: 2048, suffix: '' }, phone: { models: 512, detail: 1024, suffix: '.phone' } };
const what = process.argv[2] || 'all';
const only = new Set(process.argv.slice(3));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ktx-'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setLogger(new Logger(Logger.Verbosity.ERROR));

// one image buffer (any format sharp reads) to a KTX2 file: resized to `cap` on its long side, RGB or RGBA
async function toKtx2(input, { cap, srgb, normal, label }) {
  const meta = await sharp(input).metadata();
  const w = meta.width, h = meta.height;
  const scale = Math.min(1, cap / Math.max(w, h));
  let pipe = sharp(input);
  if (scale < 1) pipe = pipe.resize(Math.max(4, Math.round(w * scale)), Math.max(4, Math.round(h * scale)), { kernel: 'lanczos3' });
  pipe = meta.hasAlpha ? pipe.ensureAlpha().toColourspace('srgb') : pipe.removeAlpha().toColourspace('srgb');
  const png = path.join(tmp, label + '.png'), out = path.join(tmp, label + '.ktx2');
  await pipe.png({ compressionLevel: 1 }).toFile(png);
  const args = ['--t2', '--genmipmap', '--assign_oetf', srgb ? 'srgb' : 'linear', '--assign_primaries', 'bt709'];
  if (normal) args.push('--encode', 'uastc', '--uastc_quality', '1', '--uastc_rdo_l', '1.5', '--zcmp', '19');
  else args.push('--encode', 'etc1s', '--clevel', '2', '--qlevel', '160');
  execFileSync(TOKTX, [...args, out, png], { stdio: ['ignore', 'ignore', 'pipe'] });
  const buf = fs.readFileSync(out); fs.unlinkSync(png); fs.unlinkSync(out);
  const m2 = scale < 1 ? [Math.round(w * scale), Math.round(h * scale)] : [w, h];
  return { buf, size: m2, alpha: !!meta.hasAlpha };
}

// mean color and luminance of an image (0..1 per channel), what textures.js computed in the browser before Drop 86
async function meanOf(input) {
  const { data, info } = await sharp(input).resize(32, 32, { fit: 'fill' }).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const m = [0, 0, 0]; const n = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) { m[0] += data[i]; m[1] += data[i + 1]; m[2] += data[i + 2]; }
  return m.map(v => +(v / n / 255).toFixed(4));
}

async function packModels() {
  for (const kind of ['props', 'crew']) {
    const src = path.join('assets/models', kind); if (!fs.existsSync(src)) continue;
    for (const f of fs.readdirSync(src).filter(f => f.endsWith('.glb'))) {
      const id = f.slice(0, -4); if (only.size && !only.has(id)) continue;
      for (const [tier, T] of Object.entries(TIERS)) {
        const doc = await io.read(path.join(src, f));
        // the specular extension's maps (Sketchfab exports carry one per material) add a texture each for a sheen nobody
        // sees on a pad prop; the plain PBR materials keep their look without them
        for (const m of doc.getRoot().listMaterials()) { const e = m.getExtension('KHR_materials_specular'); if (e) e.dispose(); }
        for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'KHR_materials_specular') e.dispose();
        await doc.transform(prune());   // textures nothing references (a specular map, a blanked badge nobody uses) never ship
        const slots = new Map();   // texture -> { normal, srgb }
        for (const m of doc.getRoot().listMaterials()) {
          for (const t of [m.getBaseColorTexture(), m.getEmissiveTexture()]) if (t) slots.set(t, { ...(slots.get(t) || {}), srgb: true });
          const n = m.getNormalTexture(); if (n) slots.set(n, { ...(slots.get(n) || {}), normal: true });
          for (const t of [m.getMetallicRoughnessTexture(), m.getOcclusionTexture()]) if (t && !slots.has(t)) slots.set(t, {});
        }
        let n = 0, bytes = 0;
        for (const t of doc.getRoot().listTextures()) {
          const img = t.getImage(); if (!img) continue;
          const s = slots.get(t) || {};
          const r = await toKtx2(img, { cap: T.models, srgb: !!s.srgb, normal: !!s.normal, label: id + '-' + n++ });
          t.setImage(r.buf).setMimeType('image/ktx2'); bytes += r.buf.length;
        }
        doc.createExtension(KHRTextureBasisu).setRequired(true);
        const outDir = path.join('public/models', kind); fs.mkdirSync(outDir, { recursive: true });
        const out = path.join(outDir, id + T.suffix + '.glb');
        await io.write(out, doc);
        console.log('packed', kind + '/' + id + T.suffix, String(n).padStart(2), 'textures', (fs.statSync(out).size / 1024).toFixed(0).padStart(6), 'KB');
      }
    }
  }
}

async function packTextures() {
  const src = 'assets/textures'; const outDir = 'public/textures'; fs.mkdirSync(outDir, { recursive: true });
  const index = {};
  for (const f of fs.readdirSync(src).filter(f => /\.(jpe?g|png)$/i.test(f)).sort()) {
    const name = f.replace(/\.(jpe?g|png)$/i, ''); if (only.size && !only.has(name)) continue;
    const input = fs.readFileSync(path.join(src, f));
    const normal = /_nor$/.test(name), color = /_diff$|^decal_/.test(name);
    const entry = { size: null, full: name + '.ktx2' };
    const full = await toKtx2(input, { cap: TIERS.laptop.detail, srgb: color, normal, label: name });
    fs.writeFileSync(path.join(outDir, entry.full), full.buf); entry.size = full.size;
    if (Math.max(...full.size) > TIERS.phone.detail) {
      const small = await toKtx2(input, { cap: TIERS.phone.detail, srgb: color, normal, label: name + '-1k' });
      entry.phone = name + '.1k.ktx2'; fs.writeFileSync(path.join(outDir, entry.phone), small.buf);
    }
    if (/_diff$|_rough$/.test(name)) entry.mean = await meanOf(input);
    index[name] = entry;
    console.log('packed', name.padEnd(18), entry.size.join('x').padStart(9), (full.buf.length / 1024).toFixed(0).padStart(6), 'KB', entry.phone ? '+ 1k' : '');
  }
  if (!only.size) fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  else { const file = path.join(outDir, 'index.json'); const cur = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}; fs.writeFileSync(file, JSON.stringify({ ...cur, ...index }, null, 1) + '\n'); }
}

try { execFileSync(TOKTX, ['--version'], { stdio: 'ignore' }); } catch { console.error('toktx not found: install KTX-Software or set TOKTX'); process.exit(1); }
if (what === 'all' || what === 'models') await packModels();
if (what === 'all' || what === 'textures') await packTextures();
fs.rmSync(tmp, { recursive: true, force: true });
