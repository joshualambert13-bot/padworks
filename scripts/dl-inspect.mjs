// Looks inside a downloaded glTF before it is packed (Drop 90): what it measures, what it is made of, where its parts
// sit, and where a pipe or a hitch ends, so a SPEC line in props-pack.mjs and the hookup points in the scene can be
// written from numbers instead of guesses.
//
//   node scripts/dl-inspect.mjs <file.gltf|glb>                       bounds, triangles, materials, textures, node tree
//   node scripts/dl-inspect.mjs <file> groups [depth]                 bounds and triangles of each group at that depth (3)
//   node scripts/dl-inspect.mjs <file> ends <xmax> <name regex>       bounds of the vertices of matching groups past an x
//
// Model space is the file's own frame (before props-pack.mjs scales, centers and stands it on y 0).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import * as THREE from 'three';
import sharp from 'sharp';

const [,, file, mode = 'tree', a1, a2] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const d = await io.read(file); const r = d.getRoot(); const scene = r.getDefaultScene() || r.listScenes()[0];
const prims = (m) => m.listPrimitives().reduce((k, p) => k + (p.getIndices() ? p.getIndices().getCount() / 3 : p.getAttribute('POSITION').getCount() / 3), 0);
const trisUnder = (n) => { let t = 0; n.traverse(x => { const m = x.getMesh(); if (m) t += prims(m); }); return t; };
const fmt = (b) => 'x ' + b.min[0].toFixed(2) + '..' + b.max[0].toFixed(2) + '  y ' + b.min[1].toFixed(2) + '..' + b.max[1].toFixed(2) + '  z ' + b.min[2].toFixed(2) + '..' + b.max[2].toFixed(2);

if (mode === 'tree') {
  const b = getBounds(scene);
  console.log('bounds', fmt(b), ' extent', [0, 1, 2].map(i => +(b.max[i] - b.min[i]).toFixed(2)).join(' x '));
  console.log('tris', Math.round(r.listMeshes().reduce((n, m) => n + prims(m), 0)), 'meshes', r.listMeshes().length, 'nodes', r.listNodes().length, 'materials', r.listMaterials().length, 'textures', r.listTextures().length, 'extensions', r.listExtensionsUsed().map(e => e.extensionName).join(',') || 'none');
  for (const m of r.listMaterials()) console.log('  material', JSON.stringify(m.getName()), 'base', m.getBaseColorFactor().map(v => +v.toFixed(2)).join(','), m.getBaseColorTexture() ? 'textured' : 'flat', 'alpha', m.getAlphaMode(), 'metal', m.getMetallicFactor(), 'rough', m.getRoughnessFactor(), m.getExtension('KHR_materials_pbrSpecularGlossiness') ? 'spec-gloss' : '');
  for (const t of r.listTextures()) { const img = t.getImage(); let meta = {}; try { meta = img ? await sharp(img).metadata() : {}; } catch { /* unreadable */ } console.log('  texture', JSON.stringify(t.getName() || t.getURI()), meta.width + 'x' + meta.height, meta.format, img ? Math.round(img.byteLength / 1024) + ' KB' : 'none'); }
  const walk = (n, depth) => {
    if (depth > 6) return;
    const mesh = n.getMesh(); const tr = n.getTranslation().map(v => +v.toFixed(2)), sc = n.getScale().map(v => +v.toFixed(3));
    console.log('  ' + '  '.repeat(depth) + JSON.stringify(n.getName()), mesh ? Math.round(prims(mesh)) + ' tris' : '', 't=' + tr, sc.some(v => v !== 1) ? 's=' + sc : '', n.listChildren().length ? '(' + n.listChildren().length + ')' : '');
    for (const c of n.listChildren()) walk(c, depth + 1);
  };
  for (const n of scene.listChildren()) walk(n, 0);
} else if (mode === 'groups') {
  const depth = +(a1 || 3);
  const walk = (n, dd) => {
    if (dd === depth) { console.log(JSON.stringify(n.getName()).padEnd(58), fmt(getBounds(n)), ' tris', Math.round(trisUnder(n))); return; }
    for (const c of n.listChildren()) walk(c, dd + 1);
  };
  for (const n of scene.listChildren()) walk(n, 0);
} else if (mode === 'ends') {
  const xmax = +a1; const rx = new RegExp(a2 || '.');
  const walk = (n, parentM, groupName) => {
    const m = new THREE.Matrix4().multiplyMatrices(parentM, new THREE.Matrix4().fromArray(n.getMatrix()));
    const g = groupName || (rx.test(n.getName() || '') ? n.getName() : null);
    const mesh = n.getMesh();
    if (mesh && g) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; let k = 0;
      for (const p of mesh.listPrimitives()) {
        const pos = p.getAttribute('POSITION'); const v = [0, 0, 0], w = new THREE.Vector3();
        for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); w.set(v[0], v[1], v[2]).applyMatrix4(m); if (w.x > xmax) continue; k++; const a = [w.x, w.y, w.z]; for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], a[j]); hi[j] = Math.max(hi[j], a[j]); } }
      }
      if (k) console.log(g.padEnd(50), 'verts', String(k).padStart(5), fmt({ min: lo, max: hi }));
    }
    for (const c of n.listChildren()) walk(c, m, g);
  };
  for (const n of scene.listChildren()) walk(n, new THREE.Matrix4(), null);
}
