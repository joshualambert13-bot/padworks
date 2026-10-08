// Drop 84: camera shots of the areas the layout check flagged, from [name, camera, target] triples.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = Number(process.env.PORT || 4261);
const out = process.argv[2] || 'shots84-areas'; fs.mkdirSync(out, { recursive: true });
const server = spawn('node', ['scripts/dev-server.mjs', String(PORT), process.env.DIST || 'dist'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3000);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const base = `http://localhost:${PORT}`;
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const post = (path, data) => ctx.request.post(base + '/api/' + path, { data, headers: { 'content-type': 'application/json' } });
let r = await post('auth/login', { username: 'admin', password: 'shots-admin-password' });
if (!r.ok()) { await post('auth/login', { username: 'admin', password: 'padworks-admin' }); await post('auth/password', { current: 'padworks-admin', next: 'shots-admin-password' }); }
const p = await ctx.newPage(); p.setDefaultTimeout(300000);
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto(base + '/simulate' + (process.env.Q || '?lite=1')); await p.waitForSelector('[data-action="tour"]'); await wait(4000);
await p.waitForFunction(() => window.__padworksCam && window.__padworksCam().frame > 2, null, { timeout: 300000 });
const frames = async (n) => { const f0 = await p.evaluate(() => window.__padworksCam().frame); while ((await p.evaluate(() => window.__padworksCam().frame)) - f0 < n) await wait(300); };
const SHOTS = JSON.parse(process.env.SHOTS || '[]');
for (const [name, cam, tgt] of SHOTS) {
  await p.evaluate(([c, t]) => window.__padworksView(c, t), [cam, tgt]); await frames(2);
  await p.screenshot({ path: out + '/' + name + '.png' }); console.log('shot', name);
}
await browser.close(); server.kill();
