// Integrity report: binds record mesh_nodes to node names inside each GLB, counts bound and
// unbound records per system, records scene statistics, and writes public/integrity.json.
// Fails (exit 1) when a record claims a node that does not exist in its GLB.
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const root = path.resolve('content');
const systems = JSON.parse(fs.readFileSync(path.join(root, 'systems.json'), 'utf8'));
const files = [];
function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) files.push(p); } }
walk(path.join(root, 'records'));
const records = files.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const glbCache = new Map();
async function nodesOf(glb) {
  if (glbCache.has(glb)) return glbCache.get(glb);
  const file = path.join('public', glb);
  if (!fs.existsSync(file)) { glbCache.set(glb, null); return null; }
  const doc = await io.read(file);
  const names = new Set();
  let tris = 0, meshes = 0;
  for (const node of doc.getRoot().listNodes()) { if (node.getName()) names.add(node.getName()); }
  for (const mesh of doc.getRoot().listMeshes()) { meshes++; for (const prim of mesh.listPrimitives()) { const idx = prim.getIndices(); tris += idx ? idx.getCount() / 3 : prim.getAttribute('POSITION').getCount() / 3; } }
  const info = { names, tris: Math.round(tris), meshes, bytes: fs.statSync(file).size, materials: doc.getRoot().listMaterials().length };
  glbCache.set(glb, info);
  return info;
}

const errors = [];
const warnings = [];
const perSystem = {};
for (const sys of systems) perSystem[sys.code] = { code: sys.code, name: sys.name, records: 0, withModel: 0, withoutModel: 0, byStatus: {}, byTier: {} };
const claimed = new Map(); // glb -> Set(node)
for (const r of records) {
  const ps = perSystem[r.system]; if (!ps) continue;
  ps.records++;
  ps.byStatus[r.status] = (ps.byStatus[r.status] || 0) + 1;
  ps.byTier[r.evidence_tier] = (ps.byTier[r.evidence_tier] || 0) + 1;
  let bound = false;
  if (r.glb && r.mesh_nodes && r.mesh_nodes.length) {
    const info = await nodesOf(r.glb);
    if (!info) errors.push(`${r.id}: glb ${r.glb} not found`);
    else {
      for (const n of r.mesh_nodes) { if (!info.names.has(n)) errors.push(`${r.id}: node ${n} not in ${r.glb}`); }
      if (!claimed.has(r.glb)) claimed.set(r.glb, new Set());
      for (const n of r.mesh_nodes) claimed.get(r.glb).add(n);
      bound = true;
    }
  } else if (r.scene) bound = true; // procedural scene node
  if (bound) ps.withModel++; else ps.withoutModel++;
}
const assets = [];
for (const [glb, info] of glbCache) {
  if (!info) continue;
  const unclaimed = [...info.names].filter(n => !claimed.get(glb)?.has(n) && n !== path.basename(glb, '.glb'));
  if (unclaimed.length) warnings.push(`${glb}: unclaimed nodes ${unclaimed.join(', ')}`);
  assets.push({ glb, meshes: info.meshes, triangles: info.tris, materials: info.materials, bytes: info.bytes, budgetOk: info.bytes < 2 * 1024 * 1024 });
  if (info.bytes >= 2 * 1024 * 1024) errors.push(`${glb}: exceeds the 2 MB per-asset budget (${(info.bytes / 1048576).toFixed(2)} MB)`);
}

const report = {
  generated: new Date().toISOString(),
  totals: { records: records.length, withModel: Object.values(perSystem).reduce((a, s) => a + s.withModel, 0), withoutModel: Object.values(perSystem).reduce((a, s) => a + s.withoutModel, 0) },
  systems: Object.values(perSystem),
  assets,
  issues: errors,
  warnings,
  pass: errors.length === 0,
};
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/build-check.json', JSON.stringify(report, null, 2));
console.log(`Build check: ${report.totals.records} records, ${report.totals.withModel} with 3D model, ${report.totals.withoutModel} without, ${assets.length} model files. ${report.pass ? 'All checks passed.' : errors.length + ' failed.'} ${warnings.length ? warnings.length + ' warnings.' : ''}`);
for (const w of warnings) console.warn(' ~', w);
if (!report.pass) { for (const e of errors) console.error(' -', e); process.exit(1); }
