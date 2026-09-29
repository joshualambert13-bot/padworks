// Compresses every GLB under cad/out/{SYSTEM}/ into public/glb/{SYSTEM}/ with Draco,
// keeping node names intact (no join or flatten). Run after the CadQuery scripts.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve('cad/out');
const dst = path.resolve('public/glb');
const cli = path.resolve('node_modules/.bin/gltf-transform' + (process.platform === 'win32' ? '.cmd' : ''));
if (!fs.existsSync(src)) { console.log('no cad/out directory; nothing to compress'); process.exit(0); }
let n = 0;
for (const sys of fs.readdirSync(src)) {
  const dir = path.join(src, sys);
  if (!fs.statSync(dir).isDirectory()) continue;
  fs.mkdirSync(path.join(dst, sys), { recursive: true });
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.glb')) continue;
    const inp = path.join(dir, f), out = path.join(dst, sys, f);
    execFileSync(cli, ['draco', inp, out, '--method', 'edgebreaker', '--quantize-position', '14'], { stdio: 'pipe' });
    console.log(`${sys}/${f}: ${(fs.statSync(inp).size / 1024).toFixed(0)} KB -> ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
    n++;
  }
}
console.log('compressed', n, 'assets');
