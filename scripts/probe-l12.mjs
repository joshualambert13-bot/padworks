// Drop 89: lesson 12 from the data van: the seat, the calls, the staged screenout and the sand-off call, with a look at the chart screen.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = Number(process.env.PORT || 4269);
const out = process.argv[2] || 'shots89-l12'; fs.mkdirSync(out, { recursive: true });
const server = spawn('node', ['scripts/dev-server.mjs', String(PORT), process.env.DIST || 'dist'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3000);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const base = `http://localhost:${PORT}`;
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const post = (path, data) => ctx.request.post(base + '/api/' + path, { data, headers: { 'content-type': 'application/json' } });
let r0 = await post('auth/login', { username: 'admin', password: 'shots-admin-password' });
if (!r0.ok()) { await post('auth/login', { username: 'admin', password: 'padworks-admin' }); await post('auth/password', { current: 'padworks-admin', next: 'shots-admin-password' }); }
const p = await ctx.newPage(); p.setDefaultTimeout(400000);
p.on('pageerror', e => console.log('pageerror', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('console', m.text().slice(0, 200)); });
await p.goto(base + '/simulate?lesson=L12&lite=1'); await p.waitForSelector('[data-action="tour"]'); await wait(5000);
await p.waitForFunction(() => window.__padworksCam && window.__padworksCam().frame > 3, null, { timeout: 400000 });
const state = () => p.evaluate(() => { const g = window.__padworksSim.getState(); return { id: g.lesson.id, preset: g.ui.preset, stage: g.stage, phase: g.phase, mask: g.lesson.doneMask.map(x => x ? 1 : 0).join(''), ppa: g.ppa, rate: g.pumpRate, on: g.pumpsOnline, alarm: g.alarms.screenout, net: Math.round(g.netPsi), stp: Math.round(g.surfacePsi), t: Math.round(g.t), cam: window.__padworksCam().pos.map(v => +v.toFixed(1)), ded: g.score.deductions.map(d => d.code + ':' + d.pts) }; });
console.log('start', JSON.stringify(await state()));
await p.screenshot({ path: out + '/01-start.png' });
const setRange = async (i, v) => p.evaluate(([i, v]) => { const el = document.querySelectorAll('input[type=range]')[i]; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); }, [i, v]);
await p.getByRole('button', { name: 'Call: pumps online' }).click(); await wait(1500);
await setRange(0, 80); await wait(1500);
await setRange(1, 1.0); await wait(1500);
console.log('after calls', JSON.stringify(await state()));
const t0 = Date.now(); let st;
while (Date.now() - t0 < 120000) { st = await state(); if (st.alarm) break; await wait(1000); }
console.log('alarm', JSON.stringify(st));
await wait(4000); await p.screenshot({ path: out + '/02-screenout.png' });
await p.getByRole('button', { name: 'Call: sand off' }).click(); await wait(500);
const t1 = Date.now();
while (Date.now() - t1 < 60000) { st = await state(); if (st.mask[3] === '1') break; await wait(1000); }
console.log('sand off', JSON.stringify(st));
await p.screenshot({ path: out + '/03-sand-off.png' });
await browser.close(); server.kill();
