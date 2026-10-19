// Drop 91: boxes of every unit against the twin trailers (the pass's layout check skips PP-FRACPUMP, so a light tower or
// a prop standing in a trailer's new footprint would not be reported there). Prints every overlap with a pump unit.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = Number(process.env.PORT || 4235);
const server = spawn('node', ['scripts/dev-server.mjs', String(PORT), process.env.DIST || 'dist'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3000);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const base = `http://localhost:${PORT}`;
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
const post = (path, data) => ctx.request.post(base + '/api/' + path, { data, headers: { 'content-type': 'application/json' } });
let r = await post('auth/login', { username: 'admin', password: 'shots-admin-password' });
if (!r.ok()) { await post('auth/login', { username: 'admin', password: 'padworks-admin' }); await post('auth/password', { current: 'padworks-admin', next: 'shots-admin-password' }); }
const p = await ctx.newPage(); p.setDefaultTimeout(300000);
for (const query of ['', 'wells=6']) {
  await p.goto(base + '/simulate?lite=1' + (query ? '&' + query : '')); await p.waitForSelector('[data-action="tour"]', { timeout: 300000 }); await wait(9000);
  if (query) { await p.evaluate(() => window.__padworksSim.getState().setPad({ wells: 6 })); await wait(6000); }
  const units = await p.evaluate(() => {
    const THREE = window.__THREE; const scene = window.__padworksScene; const units = [];
    const box = new THREE.Box3(), w = new THREE.Matrix4(); const taken = new Set();
    scene.updateMatrixWorld(true);
    const nameOf = (o) => { let x = o; while (x) { if (x.name) return x.name; x = x.parent; } return '?'; };
    scene.traverse(o => {
      for (let a = o.parent; a; a = a.parent) { if (taken.has(a)) return; if (/TEMPLATE/.test(a.name)) return; }
      const wb = o.userData.walkBoxes;
      if (wb && wb.mats && wb.boxes && wb.boxes.length) { taken.add(o); wb.mats.forEach((mat, i) => { const u = new THREE.Box3(); for (const b of wb.boxes) { box.copy(b).applyMatrix4(w.multiplyMatrices(o.matrixWorld, mat)); u.union(box); } if (u.min.y > -100) units.push({ name: nameOf(o) + '#' + i, min: u.min.toArray(), max: u.max.toArray() }); }); return; }
      if (o.isGroup && o.name && /^(LG-|PP-|WH-|SU-|MT-|FB-|WL-|CT-|RG-|UC-|DA-|CM-|LI-)/.test(o.name) && !/TEMPLATE/.test(o.name)) {
        if (o.visible === false) return;
        const u = new THREE.Box3().setFromObject(o); if (u.isEmpty() || u.min.y < -100) return;
        if (u.max.x - u.min.x > 40 || u.max.z - u.min.z > 40) return;
        taken.add(o); units.push({ name: o.name, min: u.min.toArray(), max: u.max.toArray() });
      }
    });
    return units;
  });
  const pumps = units.filter(u => /^PP-FRACPUMP#/.test(u.name)); let n = 0;
  console.log(query || 'default', units.length, 'units,', pumps.length, 'pump units');
  for (const a of pumps) for (const b of units) {
    if (/^PP-FRACPUMP/.test(b.name) || /^PP-MISSILE/.test(b.name)) continue;
    const ix = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]), iy = Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]), iz = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
    if (ix > 0.15 && iy > 0.15 && iz > 0.15) { n++; console.log('  overlap', a.name, 'x', a.min[0].toFixed(1), '..', a.max[0].toFixed(1), 'z', a.min[2].toFixed(1), '..', a.max[2].toFixed(1), 'with', b.name, 'x', b.min[0].toFixed(1), '..', b.max[0].toFixed(1), 'z', b.min[2].toFixed(1), '..', b.max[2].toFixed(1), [ix, iy, iz].map(v => v.toFixed(2)).join(' x ')); }
  }
  console.log('  ', n, 'overlaps with pump units');
}
await browser.close(); server.kill();
