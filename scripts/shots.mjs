// Headless screenshot pass over the built site. Run after `npm run build`.
// Usage: node scripts/shots.mjs [outDir]   (default: shots/)
// Set CHROMIUM_PATH to a Chromium binary when Playwright's own download is not present.
// The site is served by scripts/dev-server.mjs (static build plus the accounts API on PGlite), and every
// browser context signs in as the local admin through the API before it opens a page.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'shots';
fs.mkdirSync(out, { recursive: true });
const PORT = Number(process.env.PORT || 4173);
const server = spawn('node', ['scripts/dev-server.mjs', String(PORT), process.env.DIST || 'dist'], { stdio: 'ignore' });   // PORT and DIST let two passes run side by side
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3500);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const errors = [];
const base = `http://localhost:${PORT}`;
// Sign the context in as the local admin (first time: take the seeded one-time password and set the pass's own).
const ADMIN = { username: 'admin', seed: 'padworks-admin', password: 'shots-admin-password' };
async function signIn(ctx) {
  const post = (path, data) => ctx.request.post(base + '/api/' + path, { data, headers: { 'content-type': 'application/json' } });
  let r = await post('auth/login', { username: ADMIN.username, password: ADMIN.password });
  if (!r.ok()) {
    r = await post('auth/login', { username: ADMIN.username, password: ADMIN.seed });
    if (!r.ok()) { errors.push('sign-in failed: ' + (await r.text()).slice(0, 120)); return; }
    const c = await post('auth/password', { current: ADMIN.seed, next: ADMIN.password });
    if (!c.ok()) errors.push('password change failed: ' + (await c.text()).slice(0, 120));
  }
}
async function page(w, h, mobile = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await signIn(ctx);
  const p = await ctx.newPage();
  p.setDefaultTimeout(90000);   // software rendering in CI is slow; a click can wait several frames
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/status of (401|403|429)/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
  return p;
}
// LITE=1 runs the simulator in lite rendering (hard shadows, no environment map) so the long logic pass stays fast under software GL
const SIM = '/simulate' + (process.env.LITE ? '?lite=1' : '');
const shot = (p, name) => p.screenshot({ path: path.join(out, name + '.png') });
async function setRange(p, index, value) {
  await p.evaluate(([i, v]) => {
    const el = document.querySelectorAll('input[type=range]')[i];
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [index, value]);
}
async function setNamedRange(p, name, value) {
  await p.evaluate(([name, v]) => {
    const el = document.querySelector('input[data-range="' + name + '"]');
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [name, value]);
}
const startJob = async (p) => { await p.click('[data-action="start"]'); await wait(1200); };
async function clickWhenEnabled(p, name, timeout = 60000) {
  const b = p.getByRole('button', { name }).first();
  await b.waitFor({ state: 'visible', timeout });
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await b.isEnabled()) { await b.click(); return true; } await wait(300); }
  errors.push('button never enabled: ' + name); return false;
}
async function waitText(p, text, timeout = 90000) {
  try { await p.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout }); return true; } catch { errors.push('text not seen: ' + text); return false; }
}

// ---------------- Desktop simulator walkthrough
let p;
if (process.env.ONLY !== 'drop7' && process.env.ONLY !== 'drop10' && process.env.ONLY !== 'drop16') {
p = await page(1440, 900);
await p.goto(base + SIM); await wait(4000);
await shot(p, '00-sim-setup');
// Drop 32: sound on for the whole walkthrough (synthesized Web Audio; errors in the voice mapping surface as console errors)
await p.getByRole('button', { name: 'Muted' }).click(); await wait(800);
await startJob(p);
await p.selectOption('select', '4'); // speed 4x (first select is the speed control)
await shot(p, '01-sim-rigup');
await p.getByRole('button', { name: 'Wireline' }).first().click(); await wait(1000);
await p.selectOption('select[title="Camera preset"]', 'tree'); await wait(1500);
await shot(p, '02-sim-wireline-tree');
await clickWhenEnabled(p, 'Run in hole');
await setRange(p, 0, 20);
await p.getByRole('button', { name: 'Downhole' }).click(); await wait(2500);
await shot(p, '03-sim-downhole-pumpdown');
await clickWhenEnabled(p, 'Fire guns', 90000);
await wait(1200);
await shot(p, '04-sim-downhole-perforate');
await clickWhenEnabled(p, /Swap to frac/, 90000);
await wait(6000);   // let the swab valve finish closing before the zipper leg is opened (interlock)
// open the flow path: the zipper leg working valve into the inlet block (crown, masters, and the leg isolation are open; swab closes on phase change)
for (const label of ['Zipper leg: upper working valve']) {
  const row = p.locator('div', { hasText: label }).filter({ has: p.getByRole('button', { name: 'Open' }) }).last();
  await row.getByRole('button', { name: 'Open' }).click().catch(e => errors.push('open ' + label + ': ' + e.message));
  await wait(300);
}
await waitText(p, 'Zipper leg: upper working valve'); await wait(4500);
await clickWhenEnabled(p, 'Pumps online');
await setRange(p, 0, 80); await setRange(p, 1, 1.5);
await wait(12000);
await shot(p, '05-sim-frac-downhole');
await p.getByRole('button', { name: 'Split' }).click(); await wait(3500);
await shot(p, '06-sim-frac-split');
await p.getByRole('button', { name: 'Surface' }).click(); await wait(1500);
await p.selectOption('select[title="Camera preset"]', 'pumps'); await wait(2000);
await shot(p, '07-sim-frac-pumps');
// Drop 42: a share link of this job opens in a second tab at the same phase and stage
try {
  const token = await p.evaluate(() => window.__padworksSim.getState().shareToken());
  const want = await p.evaluate(() => { const g = window.__padworksSim.getState(); return { phase: g.phase, stage: g.stage, basin: g.setup.basin }; });
  console.log('share link: token', token.length, 'chars', new Date().toISOString());
  // same context as p: a fresh context has a cold shader cache, and under software GL its first frames take minutes
  const q = await p.context().newPage(); q.setDefaultTimeout(90000);
  q.on('pageerror', e => errors.push('pageerror: ' + e.message));
  q.on('console', m => { if (m.type() === 'error' && !/status of (401|403|429)/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
  console.log('share link: page ready', new Date().toISOString());
  await q.goto(base + '/simulate?s=' + token + (process.env.LITE ? '&lite=1' : ''), { timeout: 120000, waitUntil: 'domcontentloaded' }); console.log('share link: loaded', new Date().toISOString());
  await q.waitForFunction(() => window.__padworksSim && window.__padworksSim.getState().phase !== 'setup', null, { timeout: 120000, polling: 1000 }); console.log('share link: phase set', new Date().toISOString());
  await wait(4000);
  const st = await q.evaluate(() => { const g = window.__padworksSim.getState(); return { phase: g.phase, stage: g.stage, basin: g.setup.basin }; });
  if (st.phase !== want.phase || st.stage !== want.stage || st.basin !== want.basin) errors.push('share link mismatch: ' + JSON.stringify(st) + ' vs ' + JSON.stringify(want));
  console.log('share link', JSON.stringify(st), new Date().toISOString());
  await shot(q, '07b-share-link');
  await q.close();
} catch (e) { errors.push('share link: ' + e.message.slice(0, 160)); }
// screenout: high concentration at low rate
await setRange(p, 0, 30); await setRange(p, 1, 3.5);
await waitText(p, 'Screenout', 60000); await wait(1500);
await shot(p, '08-sim-screenout');
// overpressure: close the zipper valve while pumping
await p.getByRole('button', { name: 'Acknowledge' }).first().click().catch(() => {});
await setRange(p, 1, 0); await setRange(p, 0, 60);
{
  const row = p.locator('div', { hasText: 'Zipper leg: upper working valve' }).filter({ has: p.getByRole('button', { name: 'Close' }) }).last();
  await row.getByRole('button', { name: 'Close' }).click().catch(e => errors.push('close zipper: ' + e.message));
}
await waitText(p, 'overpressure', 60000); await wait(1000);
await shot(p, '09-sim-overpressure');
await p.getByRole('button', { name: 'Acknowledge' }).first().click().catch(() => {});
// drillout and flowback
await p.getByRole('button', { name: 'Drillout' }).first().click(); await wait(1500);
await p.selectOption('select[title="Camera preset"]', 'tree'); await wait(1500);
await shot(p, '10-sim-drillout-surface');
await p.getByRole('button', { name: 'Downhole' }).click(); await wait(9000);
await shot(p, '11-sim-drillout-downhole');
await p.getByRole('button', { name: 'Flowback' }).first().click(); await wait(1000);
await p.getByRole('button', { name: 'Surface' }).click(); await wait(1000);
await p.selectOption('select[title="Camera preset"]', 'pad'); await wait(3000);
await shot(p, '12-sim-flowback-pad');
// Drop 30/31: time of day cycles day -> dusk -> night -> day (dusk: low western sun; night: moon, tower spot lights)
await p.getByRole('button', { name: 'Day' }).click(); await wait(3500);
await shot(p, '12b-sim-flowback-dusk');
await p.getByRole('button', { name: 'Dusk' }).click(); await wait(4500);
await shot(p, '12c-sim-flowback-night');
await p.getByRole('button', { name: 'Night' }).click(); await wait(1500);
// Drop 39: winter (snow shader patch, overcast, flurries), then back to summer
await p.getByRole('button', { name: 'Summer' }).click(); await wait(4500);
await shot(p, '12d-sim-flowback-winter');
await p.getByRole('button', { name: 'Winter' }).click(); await wait(1500);
{
  const snd = await p.evaluate(() => { const E = window.__padworksSound; if (!E) return null; const V = E.V; return { state: E.ctx.state, on: E.on, choke: +V.choke.gain.value.toFixed(3), pump: +V.pump.gain.value.toFixed(3) }; });
  if (!snd || snd.state !== 'running' || !snd.on) errors.push('sound not running at flowback: ' + JSON.stringify(snd));
  else if (snd.choke < 0.02) errors.push('flowback choke hiss silent: ' + JSON.stringify(snd));
  console.log('sound at flowback', JSON.stringify(snd));
  await p.getByRole('button', { name: 'Sound' }).click(); await wait(600);
}
await p.close();

// ---------------- Library pages
p = await page(1440, 900);
await p.goto(base + '/library'); await wait(1500);
await shot(p, '13-library');
await p.fill('input[placeholder]', 'goat head'); await wait(800);
await shot(p, '14-library-search');
await p.goto(base + '/library/WH'); await wait(1500);
await shot(p, '15-system-WH');
await p.goto(base + '/library/equipment/WH-GATEVALVE'); await wait(6000);
await shot(p, '16-record-gatevalve');
await p.keyboard.press('s'); await wait(1500);
await shot(p, '17-record-gatevalve-cutaway');
await p.keyboard.press('s'); await p.keyboard.press('e'); await wait(1500);
await shot(p, '18-record-gatevalve-explode');
await p.goto(base + '/library/equipment/WH-GATEVALVE-GATE'); await wait(5000);
await shot(p, '19-record-gate-fade');
await p.keyboard.press('t'); await wait(1500);
await shot(p, '19b-record-gate-solid');
for (const [id, n] of [['WH-FRACTREE', '24'], ['WH-CASINGHEAD', '25'], ['WH-ZIPPER', '26'], ['WH-FLOWIRON', '27'], ['WH-TREESAVER', '28'], ['WH-GATEVALVE-HYD', '29'], ['WH-FRACTREE-SWAB', '30'], ['WL-PCE', '31'], ['WL-PCE-GREASEHEAD', '32'], ['WL-PCE-WIRELINEVALVE', '33'], ['WL-UNIT', '34']]) {
  await p.goto(base + '/library/equipment/' + id); await wait(6000);
  await shot(p, n + '-record-' + id);
  if (id === 'WH-FRACTREE') { await p.keyboard.press('s'); await wait(1500); await shot(p, '24b-record-fractree-cutaway'); }
  if (id === 'WL-PCE') { await p.keyboard.press('s'); await wait(1500); await shot(p, '31b-record-WL-PCE-cutaway'); await p.keyboard.press('s'); await p.keyboard.press('e'); await wait(1500); await shot(p, '31c-record-WL-PCE-explode'); await p.keyboard.press('e'); }
}
await p.goto(base + '/library/WL'); await wait(1500);
await shot(p, '35-system-WL');
// Drop 4: size variants, standard tree components, DT cut-away, PP records
await p.goto(base + '/library/equipment/WH-GATEVALVE'); await wait(6000);
await p.selectOption('select[title="Bore and pressure rating"]', '4-10K'); await wait(5000);
await shot(p, '40-record-gatevalve-4-10K');
await p.selectOption('select[title="Bore and pressure rating"]', '7-15K'); await wait(3000);
for (const [id, n] of [['WH-FRACTREE-CROWN', '41'], ['WH-FRACTREE-INLETBLOCK', '42'], ['WH-FRACTREE-WINGA', '43'], ['WH-GATEVALVE-ACTUATOR', '44'], ['DT-PLUGSET', '45'], ['DT-FRACPLUG-SLIPSDOWN', '46'], ['DT-SETTINGTOOL', '47'], ['PP-FRACPUMP', '48'], ['PP-MULTIWELL', '49']]) {
  await p.goto(base + '/library/equipment/' + id); await wait(6000);
  await shot(p, n + '-record-' + id);
  if (id === 'DT-PLUGSET') { await p.keyboard.press('s'); await wait(1500); await shot(p, '45b-record-DT-PLUGSET-cutaway'); }
}
await p.goto(base + '/library/PP'); await wait(1500);
await shot(p, '50-system-PP');
// Drop 5: CT and FB models, WL variants
for (const [id, n] of [['CT-STACK', '54'], ['CT-STACK-QUADBOP', '55'], ['CT-STACK-INJECTOR', '56'], ['FB-CHOKEMANIFOLD', '57'], ['FB-CHOKEMANIFOLD-ADJUSTABLECHOKE', '58'], ['WL-PCE-WIRELINEVALVE', '59'], ['WH-CASINGHEAD', '60']]) {
  await p.goto(base + '/library/equipment/' + id); await wait(6000);
  await shot(p, n + '-record-' + id);
  if (id === 'CT-STACK') { await p.keyboard.press('s'); await wait(1500); await shot(p, '54b-record-CT-STACK-cutaway'); }
}
await p.goto(base + '/library/CT'); await wait(1500);
await shot(p, '61-system-CT');
// Drop 6: production tree and wellbore
for (const [id, n] of [['UC-PRODTREE', '63'], ['UC-PRODTREE-CHOKE', '64'], ['CM-WELLBORE', '65'], ['CM-WELLBORE-PRODUCTIONCASING', '66']]) {
  await p.goto(base + '/library/equipment/' + id); await wait(6000);
  await shot(p, n + '-record-' + id);
  if (id === 'CM-WELLBORE') { await p.keyboard.press('s'); await wait(1500); await shot(p, '65b-record-CM-WELLBORE-cutaway'); }
}
await p.goto(base + SIM); await wait(4000);
await startJob(p);
await p.getByRole('button', { name: 'Production' }).first().click(); await wait(500);
await p.selectOption('select[title="Camera preset"]', 'tree'); await wait(3000);
await shot(p, '67-sim-production-tree');
await p.goto(base + '/library/FB'); await wait(1500);
await shot(p, '62-system-FB');
await p.goto(base + '/library/DT'); await wait(1500);
await shot(p, '51-system-DT');
await p.goto(base + '/checks'); await wait(1500);
await shot(p, '20-integrity');
// Drop 4: pad configuration in the simulator
await p.goto(base + SIM); await wait(4000);
await setNamedRange(p, 'wells', 6); await wait(400);
await p.getByRole('button', { name: 'Trimul' }).click(); await wait(300);
await startJob(p);
await p.getByRole('button', { name: 'Frac' }).first().click(); await wait(300);
await p.selectOption('select[title="Camera preset"]', 'row'); await wait(3000);
await shot(p, '52-sim-row-trimul-6wells');
await p.selectOption('select[title="Camera preset"]', 'tree'); await wait(2500);
await shot(p, '53-sim-tree-standard');
await p.goto(base + '/about'); await wait(1000);
await shot(p, '36-about');
await p.close();

}

if (process.env.ONLY !== 'main' && process.env.ONLY !== 'drop16') {
p = await page(1440, 900);
if (process.env.ONLY !== 'drop10') {
// ---------------- Drop 7: pad setup, basins, missile and zipper, sliding sleeve job, records, hover round trip
await p.goto(base + SIM); await wait(4500);
await p.selectOption('select[title="Camera preset"]', 'basin'); await wait(2500);
await shot(p, '70-setup-basin-delaware');
await p.selectOption('select[data-select="basin"]', 'haynesville'); await wait(3000);
await shot(p, '71-setup-basin-haynesville');
await p.selectOption('select[data-select="basin"]', 'marcellus'); await wait(3000);
await shot(p, '72-setup-basin-marcellus');
await p.selectOption('select[data-select="basin"]', 'bakken'); await wait(3000);
await p.selectOption('select[title="Camera preset"]', 'pumps'); await wait(2500);
await shot(p, '73-setup-pumps-diesel');
await p.selectOption('select[data-select="fleet"]', 'efrac-turbine'); await wait(2500);
await shot(p, '74-setup-pumps-efrac-turbine');
await p.selectOption('select[title="Camera preset"]', 'zipper'); await wait(2500);
await shot(p, '75-setup-zipper-legs');
await p.selectOption('select[title="Camera preset"]', 'tree'); await wait(2500);
await shot(p, '76-setup-tree-ball-launcher');
// sliding sleeve job: toe sleeve on pressure, then a ball drop
await startJob(p);
await p.selectOption('select', '4');
await p.getByRole('button', { name: 'Next: Toe sleeve' }).click(); await wait(800);
await p.getByRole('button', { name: 'Pumps on, 15 bpm' }).click(); await wait(500);
await p.getByRole('button', { name: 'Pressure up' }).first().click();
await waitText(p, 'Toe sleeve opened', 150000); await wait(500);
await p.getByRole('button', { name: 'Downhole' }).click(); await wait(2500);
await shot(p, '77-sleeve-toe-open-downhole');
await clickWhenEnabled(p, /Swap to frac/); await wait(500);
await clickWhenEnabled(p, 'Pumps online'); await setRange(p, 0, 80); await setRange(p, 1, 1.2);
await waitText(p, 'Next steps: Stage complete', 300000); await setRange(p, 1, 0); await wait(2500);
await shot(p, '78-sleeve-stage1-frac-complete');
await clickWhenEnabled(p, /next stage: ball drop/i, 300000); await wait(4000);
// the swab valve to the launcher, then pumps at a low rate, then the ball
{
  const row = p.locator('div', { hasText: 'Swab valve, ball launcher isolation' }).filter({ has: p.getByRole('button', { name: 'Open' }) }).last();
  await row.getByRole('button', { name: 'Open' }).click().catch(e => errors.push('open swab (launcher): ' + e.message));
}
await wait(4000);
await clickWhenEnabled(p, 'Pumps on, 15 bpm', 60000); await wait(800);
await clickWhenEnabled(p, /Release ball/, 60000); await wait(2500);
await shot(p, '79-sleeve-ball-in-flight-downhole');
await waitText(p, 'Ball landed on seat', 240000); await wait(2500);
await shot(p, '80-sleeve-ball-seated-downhole');
await p.getByRole('button', { name: 'Surface' }).click(); await p.selectOption('select[title="Camera preset"]', 'tree'); await wait(2500);
await shot(p, '81-sleeve-tree-ball-drop');
// kickout guidance: pump against a closed path in a plug and perf job on the Permian
await p.goto(base + SIM); await wait(4000);
await p.selectOption('select[data-select="basin"]', 'permian-delaware'); await wait(800);
await startJob(p); await p.selectOption('select', '4');
await p.getByRole('button', { name: 'Frac' }).first().click(); await wait(800);
await shot(p, '82-guidance-nothing-to-pump-into');
await p.getByRole('button', { name: 'Wireline' }).first().click(); await wait(500);
await clickWhenEnabled(p, 'Run in hole'); await setRange(p, 0, 20);
await clickWhenEnabled(p, 'Fire guns', 90000); await clickWhenEnabled(p, /Swap to frac/, 90000); await wait(800);
await clickWhenEnabled(p, 'Pumps online'); await setRange(p, 0, 70);
await waitText(p, 'kicked out', 180000); await wait(800);
await shot(p, '83-guidance-kickout-steps');
// hover popup, pinned, and the round trip to the library and back
await p.selectOption('select[title="Camera preset"]', 'tree'); await wait(2500);
{
  const c = await p.locator('canvas').first().boundingBox();
  let hit = false;
  for (const [fx, fy] of [[0.44, 0.5], [0.47, 0.55], [0.5, 0.6], [0.45, 0.45], [0.42, 0.62]]) {
    await p.mouse.move(c.x + c.width * fx, c.y + c.height * fy); await wait(600);
    if (await p.locator('[data-hover-popup]').count()) { hit = true; await p.mouse.click(c.x + c.width * fx, c.y + c.height * fy); await wait(600); break; }
  }
  if (!hit) errors.push('hover popup: no hit on the tree');
}
await shot(p, '84-hover-popup-pinned');
{
  const link = p.locator('[data-hover-popup] a, [data-hover-popup] button').first();
  if (await link.count()) { await link.click(); await wait(5000); await shot(p, '85-hover-record-from-sim'); await p.getByRole('link', { name: /Back to the pad simulation/ }).first().click().catch(e => errors.push('back link: ' + e.message)); await wait(9000); await shot(p, '86-back-in-sim-same-stage'); }
  else errors.push('hover popup: no link');
}
// Drop 7 records
for (const [id, n] of [['WH-ZIPPER', '87'], ['WH-ZIPPER-LEG', '88'], ['WH-ZIPPER-INLETVALVE', '89'], ['PP-MISSILE', '90'], ['PP-MISSILE-PRV', '91'], ['DT-FRACSLEEVE', '92'], ['DT-FRACSLEEVE-BALLSEAT', '93'], ['WH-FRACTREE-BALLLAUNCHER', '94'], ['PP-JOBDESIGN', '95']]) {
  await p.goto(base + '/library/equipment/' + id); await wait(6000);
  await shot(p, n + '-record-' + id);
  if (id === 'DT-FRACSLEEVE') { await p.keyboard.press('s'); await wait(1500); await shot(p, '92b-record-DT-FRACSLEEVE-cutaway'); }
  if (id === 'PP-MISSILE') { await p.keyboard.press('e'); await wait(1500); await shot(p, '90b-record-PP-MISSILE-explode'); }
}
// Drop 8: artificial lift in the production phase, color-coded wells, AL and SC records
for (const [lift, n] of [['rodpump', '96'], ['esp', '97'], ['gaslift', '98'], ['plunger', '99']]) {
  await p.goto(base + SIM); await wait(3500);
  await p.selectOption('select[data-select="lift"]', lift); await wait(300);
  await startJob(p);
  await p.getByRole('button', { name: 'Production' }).first().click(); await wait(500);
  await p.selectOption('select[title="Camera preset"]', 'tree'); await wait(3500);
  await shot(p, n + '-production-' + lift);
  if (lift === 'rodpump' || lift === 'esp') { await p.getByRole('button', { name: 'Downhole' }).click(); await wait(3000); await shot(p, n + 'b-production-' + lift + '-downhole'); }
}
await p.goto(base + SIM); await wait(3500);
await p.selectOption('select[title="Camera preset"]', 'row'); await wait(3000);
await shot(p, '100-row-color-coded-wells');
for (const [id, n] of [['AL', '101'], ['AL-BEAMUNIT', '102'], ['AL-RODPUMP', '103'], ['AL-RODPUMP-TRAVELINGVALVE', '104'], ['AL-ESP', '105'], ['SC-GRAVELPACK', '106'], ['SC-GRAVELPACK-SCREEN', '107']]) {
  await p.goto(base + '/library/' + (id === 'AL' ? 'AL' : 'equipment/' + id)); await wait(6000);
  await shot(p, n + '-record-' + id);
  if (id === 'AL-RODPUMP') { await p.keyboard.press('s'); await wait(1500); await shot(p, '103b-record-AL-RODPUMP-cutaway'); }
  if (id === 'SC-GRAVELPACK') { await p.keyboard.press('e'); await wait(1500); await shot(p, '106b-record-SC-GRAVELPACK-explode'); }
}
// Drop 9: training events and the production hookup, RG, DA, MT records
{
  await p.goto(base + SIM); await wait(3500);
  await startJob(p); await p.selectOption('select', '4');
  await p.getByRole('button', { name: 'Wireline' }).first().click(); await wait(800);
  await p.getByRole('button', { name: 'Gun misfire' }).click(); await wait(300);
  await clickWhenEnabled(p, 'Run in hole'); await setRange(p, 0, 20); await wait(2500);
  await p.getByRole('button', { name: 'Tool string stuck' }).click(); await wait(1500);
  await shot(p, '108-event-stuck-tool');
  await clickWhenEnabled(p, 'Work the line', 20000); await wait(4000);
  await clickWhenEnabled(p, 'Fire guns', 120000); await wait(6000);
  await p.getByRole('button', { name: 'Downhole' }).click(); await wait(2000);
  await shot(p, '109-event-misfire');
  await clickWhenEnabled(p, 'Run guns again', 60000); await wait(1000);
  await clickWhenEnabled(p, 'Fire guns', 120000); await wait(8000);
  await clickWhenEnabled(p, /Swap to frac/, 60000); await wait(6000);
  await p.getByRole('button', { name: 'Working valve actuator fault' }).click(); await wait(500);
  {
    const row = p.locator('div', { hasText: 'Zipper leg: upper working valve' }).filter({ has: p.getByRole('button', { name: 'Open' }) }).last();
    await row.getByRole('button', { name: 'Open' }).click().catch(() => {});
  }
  await wait(800); await p.getByRole('button', { name: 'Surface' }).click(); await wait(500);
  await shot(p, '110-event-valve-fault');
  await clickWhenEnabled(p, 'Backup circuit', 20000); await wait(500);
  {
    const row = p.locator('div', { hasText: 'Zipper leg: upper working valve' }).filter({ has: p.getByRole('button', { name: 'Open' }) }).last();
    await row.getByRole('button', { name: 'Open' }).click().catch(() => {});
  }
  await wait(4500);
  await clickWhenEnabled(p, 'Pumps online'); await setRange(p, 0, 80); await setRange(p, 1, 1.5); await wait(6000);
  await p.getByRole('button', { name: 'Sand delivery interrupted' }).click(); await wait(1500);
  await shot(p, '111-event-sand-delivery');
  await p.getByRole('button', { name: 'Production' }).first().click(); await wait(800);
  await p.selectOption('select[title="Camera preset"]', 'tree'); await wait(2500);
  await shot(p, '112-hookup-rig-and-bop');
  await clickWhenEnabled(p, 'Rig up', 20000); await wait(9000);
  await shot(p, '113-hookup-running-tubing');
  await clickWhenEnabled(p, 'Nipple down', 120000); await wait(1500);
  await shot(p, '114-hookup-tree-on');
  await clickWhenEnabled(p, 'Install the tree', 20000); await wait(2500);
  await shot(p, '115-hookup-done');
}
for (const [id, n] of [['RG', '116'], ['RG-BOPSTACK', '117'], ['RG-BOPSTACK-RAMS', '118'], ['RG-BOPSTACK-ANNULAR', '119'], ['DA-FRACVAN', '120'], ['MT-PROPPANT', '121'], ['MT-FLUIDSYSTEMS', '122']]) {
  await p.goto(base + '/library/' + (id === 'RG' ? 'RG' : 'equipment/' + id)); await wait(6000);
  await shot(p, n + '-record-' + id);
  if (id === 'RG-BOPSTACK') { await p.keyboard.press('e'); await wait(1500); await shot(p, '117b-record-RG-BOPSTACK-explode'); }
}
}
// Drop 10: guided lessons, scoring, session summary
{
  await p.goto(base + SIM); await wait(3500);
  await shot(p, '123-lessons-picker');
  // lesson 1: first wireline run
  await p.click('[data-action="lesson-L1"]'); await wait(1200); await p.selectOption('select', '4');
  await shot(p, '124-lesson1-start');
  await clickWhenEnabled(p, 'Next: Wireline'); await wait(4000);
  await clickWhenEnabled(p, 'Run in hole'); await setRange(p, 0, 20); await wait(1500);
  await shot(p, '125-lesson1-pumpdown');
  await clickWhenEnabled(p, 'Fire guns', 120000); await wait(1000);
  await clickWhenEnabled(p, /Swap to frac/, 120000); await wait(1500);
  await waitText(p, 'Lesson complete', 20000); await wait(300);
  await shot(p, '126-lesson1-complete');
  // lesson 3: kickout recovery
  await p.getByRole('button', { name: 'Reset' }).click(); await wait(800);
  await p.click('[data-action="lesson-L3"]'); await wait(800); await p.selectOption('select', '4');
  await waitText(p, 'Job stopped: Pumps kicked out', 120000); await wait(400);   // 12 s idle under SwiftShader, up to 40 s with the pumps view and a loaded machine
  await shot(p, '127-lesson3-kickout');
  await clickWhenEnabled(p, 'Rate to 0'); await wait(2500);
  {
    const row = p.locator('div', { hasText: 'Zipper leg: upper working valve' }).filter({ has: p.getByRole('button', { name: 'Open' }) }).last();
    await row.getByRole('button', { name: 'Open' }).click();
  }
  await wait(4000);
  await clickWhenEnabled(p, 'Acknowledge'); await wait(500);
  await clickWhenEnabled(p, 'Pumps online'); await setRange(p, 0, 80); await wait(300); await setRange(p, 1, 0.5); await wait(1500);
  await waitText(p, 'Lesson complete', 20000); await wait(300);
  await shot(p, '128-lesson3-complete');
  // free play: a valve moved against the sequence costs points; the score chip updates
  await clickWhenEnabled(p, 'Free play'); await wait(300); await p.selectOption('select', '1');
  {
    const row = p.locator('div', { hasText: 'Upper master valve' }).filter({ has: p.getByRole('button', { name: 'Close' }) }).last();
    await row.getByRole('button', { name: 'Close' }).click();
  }
  await wait(400); await shot(p, '129-score-wrong-move');
  {
    const row = p.locator('div', { hasText: 'Upper master valve' }).filter({ has: p.getByRole('button', { name: 'Open' }) }).last();
    await row.getByRole('button', { name: 'Open' }).click().catch(() => {});
  }
  await wait(3500); await p.selectOption('select', '4');
  // event recovery is timed against a target
  await p.getByRole('button', { name: 'Working valve actuator fault' }).click(); await wait(2500);
  await clickWhenEnabled(p, 'Stop pumping'); await wait(600);
  await clickWhenEnabled(p, 'Backup circuit'); await wait(800);
  await waitText(p, 'Recovered from working valve actuator fault', 20000);
  await shot(p, '130-event-recovery-timed');
  // session summary, screen and print
  await p.click('[data-action="summary"]'); await wait(800);
  await shot(p, '131-session-summary');
  await p.emulateMedia({ media: 'print' }); await wait(500);
  await p.screenshot({ path: path.join(out, '132-session-summary-print.png'), fullPage: true });
  await p.emulateMedia({ media: 'screen' }); await wait(300);
  await p.locator('[data-panel="summary"]').getByTitle('Close').click(); await wait(400);
  // lesson 8: production hookup
  await p.getByRole('button', { name: 'Reset' }).click(); await wait(800);
  await p.click('[data-action="lesson-L8"]'); await wait(800); await p.selectOption('select', '4');
  await p.selectOption('select[title="Camera preset"]', 'tree'); await wait(1500);
  await clickWhenEnabled(p, 'Rig up'); await wait(3000);
  await shot(p, '133-lesson8-running-tubing');
  await clickWhenEnabled(p, 'Nipple down', 120000); await wait(1000);
  await clickWhenEnabled(p, 'Install the tree'); await wait(1500);
  await waitText(p, 'Lesson complete', 20000); await wait(300);
  await shot(p, '134-lesson8-complete');
  // lesson 5: toe sleeve, first checkpoints
  await p.getByRole('button', { name: 'Reset' }).click(); await wait(800);
  await p.click('[data-action="lesson-L5"]'); await wait(800); await p.selectOption('select', '4');
  await clickWhenEnabled(p, 'Next: Toe sleeve'); await wait(4000);
  await clickWhenEnabled(p, 'Pumps on, 15 bpm'); await wait(500);
  await clickWhenEnabled(p, 'Pressure up'); await waitText(p, 'Toe sleeve opened', 150000); await wait(500);
  await p.getByRole('button', { name: 'Downhole' }).click(); await wait(2000);
  await shot(p, '135-lesson5-toe-open');
  // the setup panel now shows the best results
  await p.getByRole('button', { name: 'Reset' }).click(); await wait(800);
  await shot(p, '136-lessons-with-results');
}
await p.close();
}

// ---------------- Drop 16: accounts. Sign-in screen, forced password change, admin panel, trainee view, saved progress.
if (!process.env.ONLY || process.env.ONLY === 'drop16') {
{
  { const warm = await browser.newContext(); await signIn(warm); await warm.close(); }   // makes sure the admin has the pass's password
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });   // a fresh context: no cookie
  p = await ctx.newPage(); p.setDefaultTimeout(90000);
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/status of (401|403|429)/.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
  await p.goto(base + SIM); await p.waitForSelector('[data-panel="login"]'); await wait(500);
  await shot(p, '140-login');
  await p.fill('[data-input="username"]', 'admin'); await p.fill('[data-input="password"]', 'not-the-password'); await p.click('[data-action="login"]');
  await p.waitForSelector('[data-status="login-error"]'); await shot(p, '141-login-wrong');
  await p.fill('[data-input="password"]', ADMIN.password); await p.click('[data-action="login"]');
  await p.waitForSelector('[data-action="user-menu"]'); await wait(3000); await shot(p, '142-signed-in');
  // admin: create a trainee, read the one-time password, change a role, disable and re-enable
  await p.click('[data-nav="admin"]'); await p.waitForSelector('[data-table="users"]'); await wait(500); await shot(p, '143-admin-accounts');
  await p.fill('[data-input="new-username"]', 'jane.doe'); await p.fill('[data-input="new-display"]', 'Jane Doe'); await p.click('[data-action="create-account"]');
  await p.waitForSelector('[data-panel="one-time-password"]'); await wait(300); await shot(p, '144-admin-one-time-password');
  const otp = (await p.textContent('[data-value="otp"]')).trim();
  if (!/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(otp)) errors.push('one-time password format: ' + otp);
  await p.waitForSelector('[data-user="jane.doe"]');
  await p.fill('[data-input="new-username"]', 'sam.instructor'); await p.fill('[data-input="new-display"]', 'Sam Instructor'); await p.selectOption('[data-select="new-role"]', 'instructor'); await p.click('[data-action="create-account"]');
  await p.waitForSelector('[data-user="sam.instructor"]');
  await p.click('[data-action="toggle-sam.instructor"]'); await p.waitForFunction(() => document.querySelector('[data-user="sam.instructor"]').textContent.includes('Disabled'));
  await p.click('[data-action="toggle-sam.instructor"]'); await p.waitForFunction(() => !document.querySelector('[data-user="sam.instructor"]').textContent.includes('Disabled'));
  await p.click('[data-action="user-menu"]'); await wait(300); await shot(p, '145-user-menu');
  await p.click('[data-action="menu-logout"]'); await p.waitForSelector('[data-panel="login"]');
  // trainee: one-time password, forced change, lesson 8 to completion, results survive a reload
  await p.fill('[data-input="username"]', 'jane.doe'); await p.fill('[data-input="password"]', otp); await p.click('[data-action="login"]');
  await p.waitForSelector('[data-panel="change-password"]'); await wait(300); await shot(p, '146-trainee-first-sign-in');
  await p.fill('[data-input="current"]', otp); await p.fill('[data-input="next"]', 'trainee-password-1'); await p.fill('[data-input="again"]', 'trainee-password-1'); await p.click('[data-action="change-password"]');
  await p.waitForSelector('[data-action="lesson-L8"]'); await wait(2500);
  if (await p.isVisible('[data-nav="admin"]')) errors.push('trainee sees the admin link');
  await p.click('[data-action="lesson-L8"]'); await wait(800); await p.selectOption('select', '4');
  await clickWhenEnabled(p, 'Rig up'); await wait(1500);
  await clickWhenEnabled(p, 'Nipple down', 120000); await wait(1000);
  await clickWhenEnabled(p, 'Install the tree'); await wait(1500);
  await waitText(p, 'Lesson complete', 20000); await wait(1500);
  await shot(p, '147-trainee-lesson-complete');
  await p.reload(); await p.waitForSelector('[data-action="lesson-L8"]'); await wait(3000);
  const saved = await p.evaluate(() => window.__padworksSim.getState().lessonResults.length);
  if (saved < 1) errors.push('lesson result did not come back from the server after reload');
  await shot(p, '148-trainee-results-after-reload');
  await p.click('[data-action="user-menu"]'); await p.click('[data-action="menu-logout"]'); await p.waitForSelector('[data-panel="login"]');
  // admin: progress dashboard for the trainee, saved summary, CSV, password reset
  await p.fill('[data-input="username"]', 'admin'); await p.fill('[data-input="password"]', ADMIN.password); await p.click('[data-action="login"]');
  await p.waitForSelector('[data-action="user-menu"]'); await p.goto(base + '/admin'); await p.waitForSelector('[data-table="users"]');
  await p.click('[data-action="view-jane.doe"]'); await p.waitForSelector('[data-panel="progress"] [data-lesson="L8"]'); await wait(800); await shot(p, '149-admin-trainee-progress');
  const openBtn = await p.$('[data-action^="open-summary-"]');
  if (openBtn) { await openBtn.click(); await p.waitForSelector('[data-panel="summary"]'); await wait(800); await shot(p, '150-admin-saved-summary'); await p.click('[data-action="close-summary"]'); } else errors.push('no saved summary for the trainee');
  const csv = await p.evaluate(async () => { const r = await fetch('/api/admin/export.csv'); return r.ok ? (await r.text()).split('\n').filter(Boolean).length : 0; });
  if (csv < 3) errors.push('csv export rows: ' + csv);
  await p.click('[data-action="reset-jane.doe"]'); await p.waitForSelector('[data-panel="one-time-password"]'); await wait(300); await shot(p, '151-admin-reset-password');
  await p.close();
}
}

// ---------------- Phone
if (!process.env.ONLY) {
p = await page(390, 844, true);
await p.goto(base + SIM); await wait(5000);
await shot(p, '21-phone-sim-3d');
await p.getByRole('button', { name: 'Controls' }).click(); await wait(800);
await shot(p, '22-phone-sim-controls');
await p.goto(base + '/library/equipment/WH-FRACTREE'); await wait(3000);
await shot(p, '23-phone-record');
await p.goto(base + '/library/equipment/WL-PCE'); await wait(5000);
await shot(p, '37-phone-record-WL-PCE');
await p.goto(base + '/library'); await wait(1500);
await shot(p, '38-phone-library');
await p.goto(base + '/checks'); await wait(1500);
await shot(p, '39-phone-checks');
await p.close();
}

await browser.close();
server.kill();
fs.writeFileSync(path.join(out, 'errors.txt'), errors.join('\n'));
console.log('screenshots written to', out, '| errors:', errors.length);
if (errors.length) console.log(errors.slice(0, 20).join('\n'));
