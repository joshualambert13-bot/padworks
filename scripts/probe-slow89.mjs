// Drop 89: does the frame rate decay over a long frac stage? Samples rendered frames per 30 s window for N minutes.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = Number(process.env.PORT || 4271);
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
p.on('pageerror', e => console.log('pageerror', e.message.slice(0, 300)));
await p.goto(base + '/simulate?lite=1' + (process.env.Q || '')); await p.waitForSelector('[data-action="tour"]'); await wait(4000);
await p.waitForFunction(() => window.__padworksCam && window.__padworksCam().frame > 2, null, { timeout: 300000 });
if (process.env.NOSCREENS) await p.evaluate(() => { window.__padworksVanScreens = false; });
await p.click('[data-action="start"]'); await wait(1500);
for (const ph of ['wireline', 'frac']) { await p.evaluate((ph) => window.__padworksSim.getState().setPhase(ph), ph); await wait(1000); }
await p.evaluate(() => { const g = window.__padworksSim.getState(); g.commandValve('zipWork', 1); g.setPumpsOnline(true); g.setPumpRate(80); g.setPpa(1.0); });
const mins = Number(process.env.MINS || 6);
let last = await p.evaluate(() => window.__padworksCam().frame);
for (let i = 0; i < mins * 2; i++) {
  await wait(30000);
  const r = await p.evaluate(() => ({ frame: window.__padworksCam().frame, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null, tex: window.__padworksGL.info.memory.textures, geo: window.__padworksGL.info.memory.geometries, prog: window.__padworksGL.info.programs.length, hist: window.__padworksSim.getState().history.length, t: Math.round(window.__padworksSim.getState().t) }));
  console.log(((i + 1) * 0.5).toFixed(1) + ' min', 'frames/30s', r.frame - last, 'heap', r.heap, 'MB', 'textures', r.tex, 'geometries', r.geo, 'programs', r.prog, 'history', r.hist, 't', r.t);
  last = r.frame;
}
await browser.close(); server.kill();
