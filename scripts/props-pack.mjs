// Pack the downloaded CC0 and CC-BY models for the pad (Drop 79): one GLB per model in public/models/props, scaled
// to a known real size, standing on y 0 and centered on x and z, textures no larger than the model deserves and
// JPEG where there is no alpha, geometry welded and quantized, and a credits entry written to content/credits.json
// from the Sketchfab license.txt (title, author, source, license) or the Poly Haven CC0 note.
//
//   node scripts/props-pack.mjs "<folder with polyhaven/ and sketchfab/>"
//
// SPEC names each model folder, the dimension to size by ('y' height or 'max' largest extent) and the size in
// meters, the texture size, and the id the scene uses. A model not in SPEC is skipped.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, quantize, weld, getBounds, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const SPEC = {
  'polyhaven/barrel_03': { id: 'barrel', dim: 'y', size: 0.88, tex: 512 },
  'polyhaven/cardboard_box_01': { id: 'box', dim: 'max', size: 0.55, tex: 512 },
  'polyhaven/korean_fire_extinguisher_01': { id: 'extinguisher', dim: 'y', size: 0.56, tex: 256 },
  'polyhaven/metal_jerrycan': { id: 'jerrycan', dim: 'y', size: 0.47, tex: 512 },
  'polyhaven/metal_toolbox': { id: 'toolbox', dim: 'max', size: 0.55, tex: 512 },
  'polyhaven/metal_trash_can': { id: 'trashcan', dim: 'y', size: 0.9, tex: 512, drop: /_rust/ },   // the set holds a clean and a rusted can side by side; keep the clean one
  'polyhaven/old_tyre': { id: 'tire', dim: 'max', size: 1.05, tex: 512 },
  'sketchfab/pallet': { id: 'pallet', dim: 'max', size: 1.22, tex: 512 },
  'sketchfab/traffic_cone': { id: 'cone', dim: 'y', size: 0.72, tex: 512 },
  'sketchfab/dumpster': { id: 'dumpster', dim: 'y', size: 1.35, tex: 1024 },
  'sketchfab/porta_potty': { id: 'portapotty', dim: 'y', size: 2.3, tex: 1024 },
  'sketchfab/conex_container': { id: 'conex', dim: 'max', size: 6.06, tex: 1024 },
  'sketchfab/water_tank': { id: 'watertank', dim: 'y', size: 2.2, tex: 1024 },
  'sketchfab/scaffolding': { id: 'scaffold', dim: 'y', size: 4.0, tex: 1024 },
  'sketchfab/pressure_gauge': { id: 'gauge', dim: 'max', size: 0.16, tex: 512 },
  'sketchfab/forklift': { id: 'forklift', dim: 'max', size: 3.4, tex: 1024 },
  'sketchfab/ball_valve': { id: 'ballvalve', dim: 'max', size: 0.35, tex: 512 },
  'sketchfab/light_tower': { id: 'lighttower', dim: 'y', size: 9.0, tex: 1024 },
  'sketchfab/generator_trailer': { id: 'generator', dim: 'max', size: 5.5, tex: 1024 },
  'sketchfab/office_trailer': { id: 'officetrailer', dim: 'max', size: 12.0, tex: 1024 },
  'sketchfab/pickup_truck': { id: 'pickup', dim: 'max', size: 5.8, tex: 1024, blank: /badge|plate/i },
  'sketchfab/semi_truck': { id: 'semitruck', dim: 'max', size: 7.5, tex: 1024 },
  'sketchfab/flatbed_trailer': { id: 'flatbed', dim: 'max', size: 14.6, tex: 1024 },
  'sketchfab/fuel_tanker_trailer': { id: 'fueltanker', dim: 'max', size: 12.5, tex: 1024 },
  'sketchfab/telehandler': { id: 'telehandler', dim: 'max', size: 6.0, tex: 1024 },
  'sketchfab/frac_pump_electric': { id: 'efracpump', dim: 'max', size: 16.0, tex: 1024 },
};

const root = process.argv[2];
const outDir = 'public/models/props'; fs.mkdirSync(outDir, { recursive: true });
const creditsFile = 'content/credits.json';
const credits = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, 'utf8')) : [];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function licenseOf(folder, rel) {
  const lic = path.join(folder, 'license.txt');
  if (fs.existsSync(lic)) {
    const t = fs.readFileSync(lic, 'utf8');
    const pick = (k) => { const m = t.match(new RegExp('\\* ' + k + ':\\s*(.+)')); return m ? m[1].trim() : ''; };
    return { title: pick('title'), author: pick('author').replace(/\s*\(.*\)$/, ''), authorUrl: (pick('author').match(/\((.*)\)/) || [])[1] || '', source: pick('source'), license: pick('license type').split(' ')[0], via: 'Sketchfab' };
  }
  return { title: path.basename(rel).replace(/_/g, ' '), author: 'Poly Haven', authorUrl: 'https://polyhaven.com', source: 'https://polyhaven.com/a/' + path.basename(rel), license: 'CC0', via: 'Poly Haven' };
}

for (const rel of Object.keys(SPEC)) {
  const spec = SPEC[rel]; const folder = path.join(root, rel);
  if (!fs.existsSync(folder)) { console.log('absent ', rel); continue; }
  const gltf = fs.readdirSync(folder).find(f => f.endsWith('.gltf') || f.endsWith('.glb'));
  if (!gltf) { console.log('no gltf', rel); continue; }
  let doc;
  try { doc = await io.read(path.join(folder, gltf)); } catch (e) { console.log('failed ', rel, e.message.slice(0, 80)); continue; }
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  if (spec.drop) for (const n of doc.getRoot().listNodes()) if (spec.drop.test(n.getName() || '')) n.dispose();
  // heavy meshes come down to a pad-sized budget (a porta potty does not need 61,000 triangles)
  const tris0 = doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices() ? p.getIndices().getCount() / 3 : 0), 0), 0);
  if (tris0 > 20000) { await MeshoptSimplifier.ready; await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.max(0.15, 12000 / tris0), error: 0.001 })); }
  // size and place: wrap every scene root in one node that scales and moves the model
  const b = getBounds(scene);
  const ext = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
  const cur = spec.dim === 'y' ? ext[1] : Math.max(...ext);
  const s = spec.size / (cur || 1);
  const wrap = doc.createNode('prop-root').setScale([s, s, s]).setTranslation([-(b.min[0] + b.max[0]) / 2 * s, -b.min[1] * s, -(b.min[2] + b.max[2]) / 2 * s]);
  for (const n of scene.listChildren()) { scene.removeChild(n); wrap.addChild(n); }
  scene.addChild(wrap);
  // textures: cap the size, JPEG where the material is opaque
  const opaqueTex = new Set();
  for (const m of doc.getRoot().listMaterials()) {
    if (m.getAlphaMode() === 'OPAQUE') { for (const t of [m.getBaseColorTexture(), m.getNormalTexture(), m.getMetallicRoughnessTexture(), m.getEmissiveTexture(), m.getOcclusionTexture()]) if (t) opaqueTex.add(t); }
    // Sketchfab's specular-glossiness exports render black without the extension: convert to plain PBR
    if (m.getExtension('KHR_materials_pbrSpecularGlossiness')) { const sg = m.getExtension('KHR_materials_pbrSpecularGlossiness'); const d = sg.getDiffuseTexture(); if (d) m.setBaseColorTexture(d); m.setBaseColorFactor(sg.getDiffuseFactor()); m.setMetallicFactor(0).setRoughnessFactor(1 - (sg.getGlossinessFactor() || 0.5)); m.setExtension('KHR_materials_pbrSpecularGlossiness', null); }
  }
  for (const t of doc.getRoot().listTextures()) {
    const img = t.getImage(); if (!img) continue;
    if (spec.blank && spec.blank.test(t.getName() || t.getURI() || '')) { t.setImage(await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 40, g: 40, b: 42, alpha: 0 } } }).png().toBuffer()).setMimeType('image/png'); continue; }
    const meta = await sharp(img).metadata();
    const want = Math.min(spec.tex, meta.width || spec.tex);
    const jpeg = opaqueTex.has(t) && !(meta.hasAlpha && /baseColor|diff/i.test(t.getName() || t.getURI() || ''));
    let pipe = sharp(img); if ((meta.width || 0) > want) pipe = pipe.resize(want, null, { withoutEnlargement: true });
    t.setImage(jpeg ? await pipe.jpeg({ quality: 82 }).toBuffer() : await pipe.png({ compressionLevel: 9 }).toBuffer()).setMimeType(jpeg ? 'image/jpeg' : 'image/png');
  }
  await doc.transform(dedup(), weld(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }), prune());
  const out = path.join(outDir, spec.id + '.glb');
  await io.write(out, doc);
  const tris = doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices() ? p.getIndices().getCount() / 3 : p.getAttribute('POSITION').getCount() / 3), 0), 0);
  const c = { id: spec.id, ...licenseOf(folder, rel) };
  const i = credits.findIndex(x => x.id === spec.id); if (i >= 0) credits[i] = c; else credits.push(c);
  console.log('packed ', spec.id.padEnd(14), Math.round(fs.statSync(out).size / 1024).toString().padStart(6), 'KB', Math.round(tris).toString().padStart(7), 'tris', 'was', ext.map(v => v.toFixed(2)).join('x'), '->', spec.size, 'm', c.license);
}
credits.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(creditsFile, JSON.stringify(credits, null, 2) + '\n');
console.log('credits:', credits.length, 'entries');
