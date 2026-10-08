// Drop 84: in Full mode (the modeled crew), every figure wears exactly one hard hat: the character with its own has no
// drawn one, the others have the drawn one. Also the Lite-mode checks of the pass, for a quick look.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = 4263;
const server = spawn('node', ['scripts/dev-server.mjs', String(PORT), process.env.DIST || 'dist'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3000);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const base = `http://localhost:${PORT}`;
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const post = (path, data) => ctx.request.post(base + '/api/' + path, { data, headers: { 'content-type': 'application/json' } });
let r = await post('auth/login', { username: 'admin', password: 'shots-admin-password' });
if (!r.ok()) { await post('auth/login', { username: 'admin', password: 'padworks-admin' }); await post('auth/password', { current: 'padworks-admin', next: 'shots-admin-password' }); }
const p = await ctx.newPage(); p.setDefaultTimeout(400000);
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto(base + '/simulate'); await p.waitForSelector('[data-action="tour"]');
await p.waitForFunction(() => { let n = 0; if (!window.__padworksScene) return false; window.__padworksScene.traverse(o => { if (o.isSkinnedMesh) n++; }); return n >= 4; }, null, { timeout: 400000 });
await wait(2000);
console.log(JSON.stringify(await p.evaluate(() => {
  const sc = window.__padworksScene; const figures = [];
  sc.traverse(o => {
    if (!o.isGroup || !/^LG-CREW/.test(o.name)) return;
    let model = null, hats = 0; o.traverse(c => { if (c.isSkinnedMesh && c.material) model = model || c.material.name; if (c.name === 'HAT') hats++; });
    if (model) figures.push({ group: o.name, model, hats });
  });
  return figures;
}), null, 0));
// Drop 86: a close look at one figure (the compressed FRC atlas and normal map), when SHOT names a file
if (process.env.SHOT) {
  const pos = await p.evaluate(() => { const T = window.__THREE; let g = null; window.__padworksScene.traverse(o => { if (!g && o.isGroup && o.name === 'LG-CREW') g = o; }); if (!g) return null; const v = g.getWorldPosition(new T.Vector3()); return [v.x, v.y, v.z]; });
  if (pos) { await p.evaluate(([x, y, z]) => window.__padworksView([x + 2.2, y + 1.6, z + 2.2], [x, y + 1.0, z]), pos); await wait(8000); await p.screenshot({ path: process.env.SHOT }); console.log('shot', process.env.SHOT); }
}
await browser.close(); server.kill();
