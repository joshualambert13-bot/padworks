// Drop 89: the surface view after the flowback phase (the pass lost the toolbar there)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = Number(process.env.PORT || 4270);
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
p.on('pageerror', e => console.log('pageerror', e.message.slice(0, 400)));
p.on('console', m => { if (m.type() === 'error') console.log('console', m.text().slice(0, 300)); });
await p.goto(base + '/simulate?lite=1'); await p.waitForSelector('[data-action="tour"]'); await wait(4000);
await p.waitForFunction(() => window.__padworksCam && window.__padworksCam().frame > 2, null, { timeout: 300000 });
await p.click('[data-action="start"]'); await wait(1500);
for (const ph of ['wireline', 'frac', 'drillout']) { await p.evaluate((ph) => window.__padworksSim.getState().setPhase(ph), ph); await wait(1500); }
console.log('drillout, select present:', !!(await p.$('select[title="Camera preset"]')));
await p.getByRole('button', { name: 'Downhole' }).click(); await wait(6000);
await p.getByRole('button', { name: 'Flowback' }).first().click(); await wait(1500);
console.log('flowback (downhole view), select present:', !!(await p.$('select[title="Camera preset"]')), 'phase', await p.evaluate(() => window.__padworksSim.getState().phase));
await p.getByRole('button', { name: 'Surface' }).click(); await wait(8000);
console.log('view', await p.evaluate(() => JSON.stringify({ view: window.__padworksSim.getState().ui.view, focus: window.__padworksSim.getState().ui.focus, frame: window.__padworksCam ? window.__padworksCam().frame : null })));
console.log('surface after flowback, select present:', !!(await p.$('select[title="Camera preset"]')), 'toolbar:', !!(await p.$('[data-action="tour"]')), 'body text head:', (await p.evaluate(() => document.body.innerText.slice(0, 120))).replace(/\n/g, ' | '));
await p.screenshot({ path: process.env.SHOT || '../flowback89.png' });
await browser.close(); server.kill();
