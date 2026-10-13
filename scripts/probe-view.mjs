// Ad-hoc camera views of the simulator: node scripts/probe-view.mjs <outdir> '<json views>' [query]
//   views: [["name", [x,y,z], [tx,ty,tz]], ...]; query: extra address query (tier=phone, theme=red-fleet, ...)
//   STATE='{"tod":"night"}' sets ui fields first; SETUP='{"fleet":"diesel"}' patches the setup
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = Number(process.env.PORT || 4233);
const [,, out = 'shotsview', viewsJson = '[]', query = ''] = process.argv; fs.mkdirSync(out, { recursive: true });
const views = JSON.parse(viewsJson);
const server = spawn('node', ['scripts/dev-server.mjs', String(PORT), process.env.DIST || 'dist'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3000);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const base = `http://localhost:${PORT}`;
const ctx = await browser.newContext({ viewport: { width: Number(process.env.W || 1100), height: Number(process.env.H || 700) } });
const post = (path, data) => ctx.request.post(base + '/api/' + path, { data, headers: { 'content-type': 'application/json' } });
let r = await post('auth/login', { username: 'admin', password: 'shots-admin-password' });
if (!r.ok()) { await post('auth/login', { username: 'admin', password: 'padworks-admin' }); await post('auth/password', { current: 'padworks-admin', next: 'shots-admin-password' }); }
const p = await ctx.newPage(); p.setDefaultTimeout(300000);
p.on('pageerror', e => console.log('pageerror', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('console error', m.text().slice(0, 300)); });
const q = [process.env.LITE ? 'lite=1' : '', query].filter(Boolean).join('&');
await p.goto(base + '/simulate' + (q ? '?' + q : '')); await p.waitForSelector('[data-action="tour"]', { timeout: 300000 }); await wait(9000);
const frames = async (n) => { const f0 = await p.evaluate(() => window.__padworksCam().frame); while ((await p.evaluate(() => window.__padworksCam().frame)) - f0 < n) await wait(300); };
if (process.env.SETUP) { await p.evaluate((s) => window.__padworksSim.getState().setSetup(JSON.parse(s)), process.env.SETUP); await frames(3); }
if (process.env.STATE) { await p.evaluate((s) => window.__padworksSim.getState().setUi(JSON.parse(s)), process.env.STATE); await frames(3); }
if (process.env.FULL) { await p.evaluate(() => window.__padworksSim.getState().setUi({ full: true })); await frames(2); }
await frames(2);
for (const [name, pos, tgt] of views) {
  await p.evaluate(([a, b]) => window.__padworksView(a, b), [pos, tgt]); await frames(3);
  await p.screenshot({ path: out + '/' + name + '.png' });
  console.log(name, JSON.stringify(await p.evaluate(() => window.__padworksStats)));
}
await browser.close(); server.kill();
