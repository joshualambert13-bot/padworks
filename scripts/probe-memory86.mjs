// Drop 86: GPU memory as the site holds it, per device tier and quality, measured in the browser: the diagnostics
// record (window.__padworksDiag) once every model, detail set and sky has loaded, and a count of the compressed
// textures in the scene. Q sets the address query (default ?lite=0), e.g. Q='?lite=0&tier=phone'.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = Number(process.env.PORT || 4266);
const server = spawn('node', ['scripts/dev-server.mjs', String(PORT), process.env.DIST || 'dist'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3000);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const base = `http://localhost:${PORT}`;
const vp = process.env.VIEWPORT ? process.env.VIEWPORT.split('x').map(Number) : [1280, 800];
const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: Number(process.env.DPR || 1) });
const post = (path, data) => ctx.request.post(base + '/api/' + path, { data, headers: { 'content-type': 'application/json' } });
let r0 = await post('auth/login', { username: 'admin', password: 'shots-admin-password' });
if (!r0.ok()) { await post('auth/login', { username: 'admin', password: 'padworks-admin' }); await post('auth/password', { current: 'padworks-admin', next: 'shots-admin-password' }); }
const p = await ctx.newPage(); p.setDefaultTimeout(400000);
p.on('pageerror', e => console.log('pageerror', e.message));
p.on('console', m => { if (m.type() === 'error' || /KTX2|basis|texture/i.test(m.text())) console.log('console', m.type(), m.text().slice(0, 200)); });
const t0 = Date.now();
await p.goto(base + '/simulate' + (process.env.Q || '?lite=0')); await p.waitForSelector('[data-action="tour"]');
await p.waitForFunction(() => window.__padworksCam && window.__padworksCam().frame > 2, null, { timeout: 400000 });
// wait for the loads to settle: the texture count stops growing
let last = -1, same = 0;
for (let i = 0; i < 60 && same < 4; i++) {
  await wait(5000);
  const n = await p.evaluate(() => window.__padworksGL ? window.__padworksGL.info.memory.textures : -1);
  if (n === last) same++; else { same = 0; last = n; }
}
console.log('settled after', Math.round((Date.now() - t0) / 1000), 's, textures', last);
await p.waitForFunction(() => !!window.__padworksDiag, null, { timeout: 60000 });
await wait(3500);
const r = await p.evaluate(() => {
  const d = window.__padworksDiag(); const sc = window.__padworksScene; let compressed = 0, plain = 0; const seen = new Set();
  sc.traverse(o => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) for (const k in m) { const v = m[k]; if (v && v.isTexture && !seen.has(v)) { seen.add(v); if (v.isCompressedTexture) compressed++; else plain++; } } });
  return { record: d.record, compressed, plain, detail: window.__padworksDetail ? Object.keys(window.__padworksDetail).filter(f => window.__padworksDetail[f].has.map).length : 0 };
});
console.log(JSON.stringify(r, null, 1));
if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
await browser.close(); server.kill();
