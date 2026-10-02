// Triangle and draw-call budget of the surface scene: pad overview at setup, then rig-up, then the pump preset.
// DIST=dist22 LITE=1 node scripts/probe-perf.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = Number(process.env.PORT || 4179);
const server = spawn('node', ['scripts/dev-server.mjs', String(PORT), process.env.DIST || 'dist'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3000);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const base = `http://localhost:${PORT}`;
const post = (path, data) => ctx.request.post(base + '/api/' + path, { data, headers: { 'content-type': 'application/json' } });
let r = await post('auth/login', { username: 'admin', password: 'shots-admin-password' });
if (!r.ok()) { await post('auth/login', { username: 'admin', password: 'padworks-admin' }); await post('auth/password', { current: 'padworks-admin', next: 'shots-admin-password' }); }
const p = await ctx.newPage();
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto(base + '/simulate' + (process.env.LITE ? '?lite=1' : '')); await p.waitForSelector('[data-action="start"]', { timeout: 120000 }); await wait(5000);
const frame = async () => p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); function f() { n++; if (n < 15) requestAnimationFrame(f); else r((performance.now() - t0) / n); } requestAnimationFrame(f); }));
const stats = async (label) => { await frame(); console.log(label, 'frame ms', (await frame()).toFixed(0), JSON.stringify(await p.evaluate(() => window.__padworksStats || null))); };
if (process.env.PREP) { await p.evaluate(process.env.PREP); await wait(2500); }
await stats('setup');
const tally = await p.evaluate(() => {
  const sc = window.__padworksScene; const out = {};
  const tri = (m) => { const g = m.geometry; if (!g) return 0; const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3; return n * (m.isInstancedMesh ? m.count : 1); };
  const top = (o) => { let x = o; let name = ''; while (x) { if (x.name) name = x.name; x = x.parent; } return name.replace(/-\d+(?=-|$)/g, '') || '(unnamed)'; };
  sc.traverse(o => { if (o.isMesh) { const k = top(o); out[k] = out[k] || { tri: 0, meshes: 0 }; out[k].tri += tri(o); out[k].meshes++; } });
  const total = Object.values(out).reduce((a, v) => ({ tri: a.tri + v.tri, meshes: a.meshes + v.meshes }), { tri: 0, meshes: 0 });
  return 'TOTAL ' + Math.round(total.tri) + ' tris / ' + total.meshes + ' meshes\n' + Object.entries(out).sort((a, b) => b[1].tri - a[1].tri).slice(0, 22).map(([k, v]) => k + ' ' + Math.round(v.tri) + ' tris / ' + v.meshes + ' meshes').join('\n');
});
console.log(tally);
await p.click('[data-action="start"]', { timeout: 120000 }); await wait(4000);
await stats('rigup');
await p.evaluate(() => window.__padworksView([-20, 6, -4], [-22, 2, 6])); await wait(1500);
await stats('pumps');
await browser.close(); server.kill();
