// Ad hoc camera views of the surface scene against the dev server (signed in): VIEWS="name:x,y,z>tx,ty,tz;..." DIST=dist21 PORT=4181 node scripts/shot-view.mjs out
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const out = process.argv[2] || 'shots-view';
fs.mkdirSync(out, { recursive: true });
const PORT = Number(process.env.PORT || 4181);
const server = spawn('node', ['scripts/dev-server.mjs', String(PORT), process.env.DIST || 'dist'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3500);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const errors = [];
const base = `http://localhost:${PORT}`;
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const post = (p, data) => ctx.request.post(base + '/api/' + p, { data, headers: { 'content-type': 'application/json' } });
await post('auth/login', { username: 'admin', password: 'padworks-admin' }); await post('auth/password', { current: 'padworks-admin', next: 'view-admin-password' });
const p = await ctx.newPage();
p.on('pageerror', e => errors.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/status of (401|403)/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
await p.goto(base + '/simulate' + (process.env.QUERY || '')); await p.waitForSelector('[data-action="start"]', { timeout: Number(process.env.SHOT_TIMEOUT || 30000) }); await wait(5000);
if (process.env.PREP) { await p.evaluate(process.env.PREP); await wait(2500); }
for (const v of (process.env.VIEWS || 'cellar:4,3,5>0,0.5,0').split(';')) {
  const [name, rest] = v.split(':'); const [pos, target] = rest.split('>').map(t => t.split(',').map(Number));
  await p.evaluate(([pos, target]) => window.__padworksView(pos, target), [pos, target]); await wait(1500);
  await p.evaluate(([pos, target]) => window.__padworksView(pos, target), [pos, target]); await wait(Number(process.env.WAIT || 3000));
  const t0 = Date.now(); await p.screenshot({ path: path.join(out, name + '.png'), timeout: Number(process.env.SHOT_TIMEOUT || 30000) }); console.log(name, 'shot ms', Date.now() - t0);
}
await browser.close(); server.kill();
console.log('done', errors.length, errors.slice(0, 5).join('\n'));
