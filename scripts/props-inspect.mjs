// prints bounds, materials and node names of packed props: node scripts/props-inspect.mjs pickup semitruck ...
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const m of process.argv.slice(2)) {
  const d = await io.read('public/models/props/' + m + '.glb'); const r = d.getRoot();
  const b = getBounds(r.listScenes()[0]);
  console.log('==', m, 'bounds', b.min.map(v => +v.toFixed(2)), b.max.map(v => +v.toFixed(2)));
  console.log('  materials', r.listMaterials().map(x => x.getName() + (x.getBaseColorTexture() ? '*' : '') + ' ' + JSON.stringify(x.getBaseColorFactor().map(v => +v.toFixed(2)))).join(' | '));
  console.log('  nodes', r.listNodes().map(n => n.getName()).slice(0, 14).join(','));
}
