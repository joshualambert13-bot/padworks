// Drop 89: who allocates geometries every frame while pumping (stack samples of BufferGeometry.setAttribute)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = Number(process.env.PORT || 4273);
const server = spawn('node', ['scripts/dev-server.mjs', String(PORT), process.env.DIST || 'dist'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3000);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const base = `http://localhost:${PORT}`;
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const post = (path, data) => ctx.request.post(base + '/api/' + path, { data, headers: { 'content-type': 'application/json' } });
let r0 = await post('auth/login', { username: 'admin', password: 'shots-admin-password' });
if (!r0.ok()) { await post('auth/login', { username: 'admin', password: 'padworks-admin' }); await post('auth/password', { current: 'padworks-admin', next: 'shots-admin-password' }); }
const p = await ctx.newPage(); p.setDefaultTimeout(300000);
await p.goto(base + '/simulate?lite=1'); await p.waitForSelector('[data-action="tour"]'); await wait(4000);
await p.waitForFunction(() => window.__padworksCam && window.__padworksCam().frame > 2, null, { timeout: 300000 });
await p.click('[data-action="start"]'); await wait(1500);
for (const ph of ['wireline', 'frac']) { await p.evaluate((ph) => window.__padworksSim.getState().setPhase(ph), ph); await wait(1000); }
await p.evaluate(() => { const g = window.__padworksSim.getState(); g.commandValve('zipWork', 1); g.setPumpsOnline(true); g.setPumpRate(80); g.setPpa(1.0); });
await wait(20000);
await p.evaluate(() => {
  const T = window.__THREE; const seen = new WeakSet(); window.__geoStacks = {};
  const orig = T.BufferGeometry.prototype.setAttribute;
  T.BufferGeometry.prototype.setAttribute = function (name, attr) {
    if (!seen.has(this)) { seen.add(this); const st = (new Error().stack || '').split('\n').slice(2, 7).map(l => l.trim().replace(/\(.*\//, '(').slice(0, 90)).join(' < '); window.__geoStacks[st] = (window.__geoStacks[st] || 0) + 1; }
    return orig.call(this, name, attr);
  };
});
await wait(30000);
const r = await p.evaluate(() => { const e = Object.entries(window.__geoStacks).sort((a, b) => b[1] - a[1]).slice(0, 8); return { total: Object.values(window.__geoStacks).reduce((a, b) => a + b, 0), top: e }; });
console.log('new geometries in 30 s:', r.total);
for (const [st, n] of r.top) console.log(n, st);
await browser.close(); server.kill();
