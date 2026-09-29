// Headless screenshot pass over the built site. Run after `npm run build`.
// Usage: node scripts/shots.mjs [outDir]   (default: shots/)
// Set CHROMIUM_PATH to a Chromium binary when Playwright's own download is not present.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'shots';
fs.mkdirSync(out, { recursive: true });
const PORT = 4173;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(2500);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
});
const errors = [];
async function page(w, h, mobile = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  return p;
}
const base = `http://localhost:${PORT}`;
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
let p = await page(1440, 900);
await p.goto(base + '/simulate'); await wait(4000);
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
await wait(1500);
// open the flow path: zipper valve and frac wing (swab closes on phase change)
for (const label of ['Zipper manifold valve', 'Frac wing valve']) {
  const row = p.locator('div', { hasText: label }).filter({ has: p.getByRole('button', { name: 'Open' }) }).last();
  await row.getByRole('button', { name: 'Open' }).click().catch(e => errors.push('open ' + label + ': ' + e.message));
  await wait(300);
}
await waitText(p, 'Zipper manifold valve'); await wait(2500);
await clickWhenEnabled(p, 'Pumps online');
await setRange(p, 0, 80); await setRange(p, 1, 1.5);
await wait(12000);
await shot(p, '05-sim-frac-downhole');
await p.getByRole('button', { name: 'Split' }).click(); await wait(3500);
await shot(p, '06-sim-frac-split');
await p.getByRole('button', { name: 'Surface' }).click(); await wait(1500);
await p.selectOption('select[title="Camera preset"]', 'pumps'); await wait(2000);
await shot(p, '07-sim-frac-pumps');
// screenout: high concentration at low rate
await setRange(p, 0, 30); await setRange(p, 1, 3.5);
await waitText(p, 'Screenout', 60000); await wait(1500);
await shot(p, '08-sim-screenout');
// overpressure: close the frac wing while pumping
await p.getByRole('button', { name: 'Acknowledge' }).first().click().catch(() => {});
await setRange(p, 1, 0); await setRange(p, 0, 60);
{
  const row = p.locator('div', { hasText: 'Frac wing valve' }).filter({ has: p.getByRole('button', { name: 'Close' }) }).last();
  await row.getByRole('button', { name: 'Close' }).click().catch(e => errors.push('close wing: ' + e.message));
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
await p.keyboard.press('x'); await wait(1500);
await shot(p, '17-record-gatevalve-cutaway');
await p.keyboard.press('x'); await p.keyboard.press('e'); await wait(1500);
await shot(p, '18-record-gatevalve-explode');
await p.goto(base + '/library/equipment/WH-GATEVALVE-GATE'); await wait(5000);
await p.keyboard.press('d'); await wait(1500);
await shot(p, '19-record-gate-fade');
for (const [id, n] of [['WH-FRACTREE', '24'], ['WH-CASINGHEAD', '25'], ['WH-ZIPPER', '26'], ['WH-FLOWIRON', '27'], ['WH-TREESAVER', '28'], ['WH-GATEVALVE-HYD', '29'], ['WH-FRACTREE-SWAB', '30']]) {
  await p.goto(base + '/library/equipment/' + id); await wait(6000);
  await shot(p, n + '-record-' + id);
  if (id === 'WH-FRACTREE') { await p.keyboard.press('x'); await wait(1500); await shot(p, '24b-record-fractree-cutaway'); }
}
await p.goto(base + '/integrity'); await wait(1500);
await shot(p, '20-integrity');
await p.close();

// ---------------- Phone
p = await page(390, 844, true);
await p.goto(base + '/simulate'); await wait(5000);
await shot(p, '21-phone-sim-3d');
await p.getByRole('button', { name: 'Controls' }).click(); await wait(800);
await shot(p, '22-phone-sim-controls');
await p.goto(base + '/library/equipment/WH-FRACTREE'); await wait(3000);
await shot(p, '23-phone-record');
await p.close();

await browser.close();
server.kill();
fs.writeFileSync(path.join(out, 'errors.txt'), errors.join('\n'));
console.log('screenshots written to', out, '| errors:', errors.length);
if (errors.length) console.log(errors.slice(0, 20).join('\n'));
