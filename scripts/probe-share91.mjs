import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = 4243;
const server = spawn('node', ['scripts/dev-server.mjs', String(PORT), process.env.DIST || 'dist'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3000);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const base = `http://localhost:${PORT}`;
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const post = (path, data) => ctx.request.post(base + '/api/' + path, { data, headers: { 'content-type': 'application/json' } });
let r = await post('auth/login', { username: 'admin', password: 'shots-admin-password' });
if (!r.ok()) { await post('auth/login', { username: 'admin', password: 'padworks-admin' }); await post('auth/password', { current: 'padworks-admin', next: 'shots-admin-password' }); }
const p = await ctx.newPage(); p.setDefaultTimeout(300000);
p.on('pageerror', e => console.log('P pageerror', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('P console', m.text().slice(0, 300)); });
await p.goto(base + '/simulate?lite=1'); await p.waitForSelector('[data-action="tour"]', { timeout: 300000 }); await wait(8000);
await p.evaluate(() => { const S = window.__padworksSim.getState(); S.startJob ? S.startJob() : null; });
await wait(2000);
const st0 = await p.evaluate(() => { const g = window.__padworksSim.getState(); return { phase: g.phase, stage: g.stage }; }); console.log('p state', JSON.stringify(st0));
await p.evaluate(() => { const S = window.__padworksSim.getState(); if (S.setPhase) S.setPhase('frac'); S.setPumpsOnline(true); S.setPumpRate(80); });
await p.selectOption('select[title="Camera preset"]', 'pumps');
for (let i = 0; i < 3; i++) { await wait(10000); const st = await p.evaluate(() => ({ f: window.__padworksStats && window.__padworksStats.frame, t: performance.now() })); console.log('p frame', JSON.stringify(st), new Date().toISOString()); }
const token = await p.evaluate(() => window.__padworksSim.getState().shareToken()); console.log('token', token.length);
const q = await ctx.newPage(); q.setDefaultTimeout(240000);
q.on('pageerror', e => console.log('Q pageerror', e.message)); q.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('Q console', m.type(), m.text().slice(0, 300)); });
await q.goto(base + '/simulate?s=' + token + '&lite=1', { timeout: 120000, waitUntil: 'domcontentloaded' }); console.log('q loaded');
const t0 = Date.now();
for (let i = 0; i < 30; i++) { await wait(2000); const st = await q.evaluate(() => window.__padworksSim ? (() => { const g = window.__padworksSim.getState(); return { phase: g.phase, stage: g.stage, tour: !!document.querySelector('[data-action="tour"]') }; })() : null).catch(e => 'err ' + e.message); console.log('q', i, JSON.stringify(st), 'after', ((Date.now() - t0) / 1000).toFixed(1), 's'); if (st && st.phase && st.phase !== 'setup') break; }
await q.screenshot({ path: 'shots-share91.png' });
await browser.close(); server.kill();
