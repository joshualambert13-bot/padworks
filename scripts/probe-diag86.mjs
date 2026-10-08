// Drop 86: how the diagnostics record moves between a page leaving the simulator, a planted record and a second tab
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = Number(process.env.PORT || 4267);
const server = spawn('node', ['scripts/dev-server.mjs', String(PORT), process.env.DIST || 'dist'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3000);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const base = `http://localhost:${PORT}`;
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const post = (path, data) => ctx.request.post(base + '/api/' + path, { data, headers: { 'content-type': 'application/json' } });
let r0 = await post('auth/login', { username: 'admin', password: 'shots-admin-password' });
if (!r0.ok()) { await post('auth/login', { username: 'admin', password: 'padworks-admin' }); await post('auth/password', { current: 'padworks-admin', next: 'shots-admin-password' }); }
const p = await ctx.newPage(); p.setDefaultTimeout(300000);
const dump = async (pg, label) => console.log(label, await pg.evaluate(() => { const g = (k) => { const v = window.localStorage.getItem(k); if (!v) return null; const j = JSON.parse(v); return { ended: j.ended, gpu: (j.gpu || '').slice(0, 12), at: j.at, unclean: j.unclean }; }; return JSON.stringify({ diag: g('padworks.diag'), last: g('padworks.diag.last') }); }));
await p.goto(base + '/simulate?lite=1'); await p.waitForSelector('[data-action="tour"]');
await p.waitForFunction(() => window.__padworksDiag, null, { timeout: 300000 }); await wait(4000);
await dump(p, 'on simulator:');
await p.goto(base + '/library'); await wait(1500);
await dump(p, 'after leaving:');
await p.evaluate(() => { window.localStorage.setItem('padworks.diag', JSON.stringify({ at: '2026-10-01T15:04:05.000Z', seconds: 184, path: '/simulate', tier: 'laptop', quality: 'full', effects: true, gpu: 'planted', dpr: 1.5, size: [1800, 1000], fps: 9, draws: 400, textures: 300, texMB: 612, geoMB: 98, rtMB: 240, heapMB: 1400, heapLimitMB: 2200, lost: 1, ended: 'running' })); });
await dump(p, 'planted:');
const p2 = await ctx.newPage(); p2.setDefaultTimeout(300000);
await p2.goto(base + '/simulate?lite=1'); await p2.waitForSelector('[data-action="tour"]'); await wait(1000);
await dump(p2, 'second tab early:');
await p2.waitForFunction(() => window.__padworksDiag, null, { timeout: 300000 }); await wait(1000);
await dump(p2, 'second tab later:');
console.log('last in store:', await p2.evaluate(() => JSON.stringify(window.__padworksDiag().last || null).slice(0, 120)));
await browser.close(); server.kill();
