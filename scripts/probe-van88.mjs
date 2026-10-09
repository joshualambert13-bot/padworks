// Drop 88: looks inside the data van (the seat preset, the door from outside, the boards) and walks in through the door.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = Number(process.env.PORT || 4268);
const out = process.argv[2] || 'shots88-van'; fs.mkdirSync(out, { recursive: true });
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
await p.goto(base + '/simulate' + (process.env.Q || '?lite=1')); await p.waitForSelector('[data-action="tour"]'); await wait(4000);
await p.waitForFunction(() => window.__padworksCam && window.__padworksCam().frame > 2, null, { timeout: 400000 });
const frames = async (n) => { const f0 = await p.evaluate(() => window.__padworksCam().frame); while ((await p.evaluate(() => window.__padworksCam().frame)) - f0 < n) await wait(300); };
const cam = () => p.evaluate(() => window.__padworksCam());
if (process.env.PUMP) { await p.click('[data-action="start"]'); await wait(1500); }
await p.selectOption('select[title="Camera preset"]', 'van'); await frames(3);
console.log('van preset', JSON.stringify(await cam()));
await p.screenshot({ path: out + '/01-seat.png' });
await p.evaluate(() => window.__padworksView([-3.5, 3.2, -22.5], [-9.0, 1.8, -28.8])); await frames(2);
await p.screenshot({ path: out + '/02-door.png' });
await p.evaluate(() => window.__padworksView([-11.5, 2.6, -30.6], [-16.5, 3.3, -28.7])); await frames(2);
await p.screenshot({ path: out + '/03-boards.png' });
await p.evaluate(() => window.__padworksView([-6, 6, -36], [-14, 2, -30])); await frames(2);
await p.screenshot({ path: out + '/04-outside.png' });
// walk: from the seat, back into the back wall (blocked), then along the room to the door, out onto the landing and down the stair
await p.selectOption('select[title="Camera preset"]', 'pad'); await frames(2);
await p.selectOption('select[title="Camera preset"]', 'van'); await frames(3);
await p.click('[data-action="walk"]'); await frames(2);
const floorHere = () => p.evaluate(() => window.__padworksFloorAt(window.__padworksCam().pos[0], window.__padworksCam().pos[2]));
const c0 = await cam(); console.log('walk start', JSON.stringify(c0.pos.map(v => +v.toFixed(2))), 'floor', await floorHere());
await p.screenshot({ path: out + '/05-walk-seat.png' });
const walk = async (key, n) => { await p.keyboard.down(key); await frames(n); await p.keyboard.up(key); await frames(1); const c = await cam(); console.log(key, 'x', n, '->', JSON.stringify(c.pos.map(v => +v.toFixed(2))), 'floor', await floorHere()); return c; };
await walk('KeyS', 8);     // back: stops at the back wall
await p.screenshot({ path: out + '/06-walk-back.png' });
await walk('KeyA', 24);    // along the room toward the door end (left-hand, facing +z)
await walk('KeyW', 10);    // through the door onto the landing
await p.screenshot({ path: out + '/07-walk-landing.png' });
await walk('KeyA', 8);     // down the stair (it runs toward +x)
await p.screenshot({ path: out + '/08-walk-stair.png' });
await browser.close(); server.kill();
