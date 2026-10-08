// Drop 86: where the geometry memory goes. Lists the biggest geometries (bytes of attributes and index) by owner name.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = Number(process.env.PORT || 4265);
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
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto(base + '/simulate' + (process.env.Q || '?lite=1')); await p.waitForSelector('[data-action="tour"]'); await wait(4000);
await p.waitForFunction(() => window.__padworksCam && window.__padworksCam().frame > 2, null, { timeout: 300000 });
await wait(Number(process.env.SETTLE || 15000));
const r = await p.evaluate(() => {
  const sc = window.__padworksScene; const seen = new Map();
  const nameOf = (o) => { let x = o; while (x) { if (x.name) return x.name; x = x.parent; } return '?'; };
  sc.traverse(o => {
    const g = o.geometry; if (!g || seen.has(g.uuid)) return;
    let b = 0; for (const k in g.attributes) { const a = g.attributes[k]; b += a.array.byteLength; } if (g.index) b += g.index.array.byteLength;
    seen.set(g.uuid, { name: nameOf(o) + (o.isInstancedMesh ? ' [inst x' + o.count + ']' : ''), bytes: b, tris: g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0) });
  });
  const list = [...seen.values()].sort((a, b) => b.bytes - a.bytes);
  const total = list.reduce((n, x) => n + x.bytes, 0);
  const byName = {}; for (const x of list) { const k = x.name.replace(/#\d+$/, ''); byName[k] = (byName[k] || 0) + x.bytes; }
  const top = Object.entries(byName).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => k + ' ' + (v / 1e6).toFixed(1) + ' MB');
  return { count: list.length, totalMB: +(total / 1e6).toFixed(1), top, biggest: list.slice(0, 15).map(x => x.name + ' ' + (x.bytes / 1e6).toFixed(1) + ' MB ' + Math.round(x.tris) + ' tris') };
});
console.log(JSON.stringify(r, null, 1));
await browser.close(); server.kill();
