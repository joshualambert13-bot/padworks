// Drop 84: dump the world boxes of every unit on the pad (instanced placements one by one, drawn groups by name)
// and report the pairs that overlap. Used to place props with evidence; the pass runs the same check.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = Number(process.env.PORT || 4260);
const out = process.argv[2] || 'shots84-layout'; fs.mkdirSync(out, { recursive: true });
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
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto(base + '/simulate?lite=1' + (process.env.WELLS ? '' : '')); await p.waitForSelector('[data-action="tour"]'); await wait(4000);
if (process.env.WELLS) { await p.evaluate((n) => window.__padworksSim.getState().setPad({ wells: Number(n) }), process.env.WELLS); await wait(8000); }
await p.waitForFunction(() => window.__padworksCam && window.__padworksCam().frame > 2, null, { timeout: 300000 });
await wait(2000);
const units = await p.evaluate(() => {
  const THREE = window.__THREE; const scene = window.__padworksScene;
  const units = [];
  const box = new THREE.Box3(), w = new THREE.Matrix4();
  const taken = new Set();
  scene.updateMatrixWorld(true);
  const nameOf = (o) => { let x = o; while (x) { if (x.name) return x.name; x = x.parent; } return '?'; };
  scene.traverse(o => {
    for (let a = o.parent; a; a = a.parent) if (taken.has(a)) return;
    const wb = o.userData.walkBoxes;
    if (wb && wb.mats && wb.boxes && wb.boxes.length) {
      taken.add(o);
      wb.mats.forEach((mat, i) => { const u = new THREE.Box3(); for (const b of wb.boxes) { box.copy(b).applyMatrix4(w.multiplyMatrices(o.matrixWorld, mat)); u.union(box); } units.push({ name: nameOf(o) + '#' + i, min: u.min.toArray(), max: u.max.toArray(), kind: 'inst' }); });
      return;
    }
    if (o.isGroup && o.name && /^(LG-|PP-|WH-|SU-|MT-|FB-|WL-|CT-|RG-|UC-|DA-|CM-|LI-)/.test(o.name) && !/TEMPLATE/.test(o.name)) {
      if (o.visible === false) return;
      const u = new THREE.Box3().setFromObject(o);
      if (u.isEmpty()) return;
      const sx = u.max.x - u.min.x, sz = u.max.z - u.min.z;
      if (sx > 40 || sz > 40) return;   // a whole row or the pad itself is not a unit
      taken.add(o);
      units.push({ name: o.name, min: u.min.toArray(), max: u.max.toArray(), kind: 'group' });
    }
  });
  return units;
});
fs.writeFileSync(out + '/units.json', JSON.stringify(units, null, 1));
const f = (v) => v.map(x => +x.toFixed(1));
const pairs = [];
for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
  const a = units[i], b = units[j];
  const base = (n) => n.replace(/#\d+$/, '');
  if (base(a.name) === base(b.name)) continue;   // the same set's own instances (a row of pumps)
  const ix = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
  const iy = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]);
  const iz = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
  if (ix > 0.15 && iy > 0.15 && iz > 0.15 && ix * iy * iz > 0.03) pairs.push({ a: a.name, b: b.name, overlap: [ix, iy, iz].map(v => +v.toFixed(2)), A: [f(a.min), f(a.max)], B: [f(b.min), f(b.max)] });
}
console.log('units', units.length, 'overlapping pairs', pairs.length);
for (const q of pairs) console.log(q.a, 'x', q.b, 'overlap', q.overlap.join('x'), 'A', JSON.stringify(q.A), 'B', JSON.stringify(q.B));
fs.writeFileSync(out + '/pairs.json', JSON.stringify(pairs, null, 1));
await browser.close(); server.kill();
