// Drop 90: the downloaded twin-pump electric trailers on the default (electric) pad, both tiers. Screenshots of the
// pump row, triangle and draw counts against the diesel pad, record names on the baked meshes, the fleet primary on a
// pump material, the hookup iron reaching the trailer, and a hover on a trailer part.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = Number(process.env.PORT || 4231);
const out = process.argv[2] || 'shots90'; fs.mkdirSync(out, { recursive: true });
const server = spawn('node', ['scripts/dev-server.mjs', String(PORT), process.env.DIST || 'dist'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3000);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const base = `http://localhost:${PORT}`;
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
const post = (path, data) => ctx.request.post(base + '/api/' + path, { data, headers: { 'content-type': 'application/json' } });
let r = await post('auth/login', { username: 'admin', password: 'shots-admin-password' });
if (!r.ok()) { await post('auth/login', { username: 'admin', password: 'padworks-admin' }); await post('auth/password', { current: 'padworks-admin', next: 'shots-admin-password' }); }
const lite = process.env.LITE ? '?lite=1' : '';
const errors = [];
async function open(query) {
  const p = await ctx.newPage(); p.setDefaultTimeout(300000);
  p.on('pageerror', e => { console.log('pageerror', e.message); errors.push('pageerror ' + e.message); });
  p.on('console', m => { if (m.type() === 'error') console.log('console error', m.text().slice(0, 300)); });
  await p.goto(base + '/simulate' + (lite ? lite + '&' : '?') + query); await p.waitForSelector('[data-action="tour"]', { timeout: 300000 }); await wait(9000);
  const frames = async (n) => { const f0 = await p.evaluate(() => window.__padworksCam().frame); while ((await p.evaluate(() => window.__padworksCam().frame)) - f0 < n) await wait(300); };
  await frames(2);
  return { p, frames };
}
const stats = (p) => p.evaluate(() => window.__padworksStats);
const bodies = (p) => p.evaluate(() => { const out = {}; window.__padworksScene.traverse(o => { if (o.isInstancedMesh && /^PP-FRACPUMP/.test(o.name) || (o.isInstancedMesh && o.parent && o.parent.name === 'PP-FRACPUMP')) { const k = o.name || '(unnamed in PP-FRACPUMP)'; out[k] = out[k] || { meshes: 0, count: o.count, tris: 0 }; out[k].meshes++; out[k].tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } }); return out; });

for (const tier of ['laptop', 'phone']) {
  const { p, frames } = await open('tier=' + tier);
  await p.selectOption('select[title="Camera preset"]', 'pumps'); await frames(3);
  await p.screenshot({ path: out + '/' + tier + '-pumps.png' });
  const b = await bodies(p); console.log(tier, 'bodies', JSON.stringify(b));
  if (!Object.keys(b).some(k => /^PP-FRACPUMP/.test(k))) errors.push(tier + ': no instanced pump bodies');
  for (const part of ['MOTOR', 'VFD', 'POWEREND', 'FLUIDEND']) if (!b['PP-FRACPUMP-' + part]) errors.push(tier + ': no baked mesh named PP-FRACPUMP-' + part);
  const st = await stats(p); console.log(tier, 'pumps preset', JSON.stringify(st));
  // the fleet primary on a pump material (what the red-fleet check in the pass asks of the drawn pump)
  const primary = await p.evaluate(() => { const want = window.__padworksTheme.getState().theme.fleet.primary.slice(1); const w = [0, 2, 4].map(i => parseInt(want.slice(i, i + 2), 16)); let hit = null; window.__padworksScene.traverse(o => { if (hit || !o.isMesh || !/^PP-FRACPUMP/.test(o.name) || !o.material || !o.material.color) return; const h = o.material.color.getHexString(); const v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); if (v.every((x, i) => Math.abs(x - w[i]) <= 3)) hit = h; }); return hit; });
  if (!primary) errors.push(tier + ': no pump material carries the fleet primary');
  // trailers: count and placement against the missile; every trailer's rear face 2.9 m from the missile centerline
  const place = await p.evaluate(() => { const T = window.__THREE; const out = []; window.__padworksScene.traverse(o => { if (o.isInstancedMesh && o.name === 'PP-FRACPUMP-VFD' && !out.length) { const m = new T.Matrix4(), p = new T.Vector3(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); p.setFromMatrixPosition(m); out.push([+p.x.toFixed(2), +p.z.toFixed(2)]); } } }); return out; });
  console.log(tier, 'trailers', JSON.stringify(place));
  const n = await p.evaluate(() => window.__padworksSim ? window.__padworksSim.getState().setup.fleet : null);
  console.log(tier, 'fleet', n, 'trailer count', place.length);
  // close views: the last trailer of each row (lowest z, by the missile's outlet end) seen from the lane, the hookup
  // iron between the missile and the rear face, then the cabinets at the front end
  const MX = -30;
  const east = place.filter(q => q[0] > MX).sort((a, b) => a[1] - b[1])[0], west = place.filter(q => q[0] < MX).sort((a, b) => a[1] - b[1])[0];
  if (east) { await p.evaluate(([a, b]) => window.__padworksView(a, b), [[MX + 7, 5, east[1] - 10], [MX + 2.8, 1.8, east[1]]]); await frames(3); await p.screenshot({ path: out + '/' + tier + '-hookup-east.png' }); }
  if (west) { await p.evaluate(([a, b]) => window.__padworksView(a, b), [[MX - 7, 5, west[1] - 10], [MX - 2.8, 1.8, west[1]]]); await frames(3); await p.screenshot({ path: out + '/' + tier + '-hookup-west.png' }); }
  if (east) { await p.evaluate(([a, b]) => window.__padworksView(a, b), [[east[0] + 10, 3.2, east[1] + 8], [east[0] + 6.5, 2.6, east[1]]]); await frames(3); await p.screenshot({ path: out + '/' + tier + '-cabinets.png' }); }
  if (east) { await p.evaluate(([a, b]) => window.__padworksView(a, b), [[east[0] - 2, 4.5, east[1] - 7], [east[0] - 3, 2.2, east[1]]]); await frames(3); await p.screenshot({ path: out + '/' + tier + '-deck.png' }); }
  // overview stats
  await p.selectOption('select[title="Camera preset"]', 'pad'); await frames(3);
  console.log(tier, 'overview', JSON.stringify(await stats(p)));
  await p.screenshot({ path: out + '/' + tier + '-overview.png' });
  // night: work lights on the trailers
  if (tier === 'laptop') {
    await p.selectOption('select[title="Camera preset"]', 'pumps'); await frames(2);
    await p.evaluate(() => window.__padworksSim.getState().setUi({ tod: 'night' })); await frames(4); await p.screenshot({ path: out + '/' + tier + '-pumps-night.png' });
  }
  await p.close();
}
// the diesel pad for the triangle comparison (the Bakken basin runs diesel)
{
  const { p, frames } = await open('tier=laptop');
  await p.evaluate(() => { const S = window.__padworksSim; if (S) S.getState().setSetup({ fleet: 'diesel' }); }); await frames(3);
  await p.selectOption('select[title="Camera preset"]', 'pumps'); await frames(3);
  console.log('diesel pumps preset', JSON.stringify(await stats(p)), 'fleet', await p.evaluate(() => window.__padworksSim ? window.__padworksSim.getState().setup.fleet : null));
  await p.screenshot({ path: out + '/diesel-pumps.png' });
  await p.close();
}
console.log(errors.length ? 'ERRORS\n' + errors.join('\n') : 'OK');
await browser.close(); server.kill();
