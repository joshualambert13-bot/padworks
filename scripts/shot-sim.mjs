// Quick simulator screenshots: node scripts/shot-sim.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2500));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errs = [];
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', e => errs.push(e.message));
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const setRange = (i, v) => p.evaluate(([i, v]) => { const el = document.querySelectorAll('input[type=range]')[i]; const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); }, [i, v]);
try {
  await p.goto('http://localhost:4174/simulate'); await wait(4000);
  await setRange(0, 8); await wait(400);
  await p.getByRole('button', { name: 'Quad' }).click(); await wait(300);
  await p.getByRole('button', { name: 'Frac' }).first().click(); await wait(300);
  await p.selectOption('select[title="Camera preset"]', 'row'); await wait(3000);
  await p.screenshot({ path: 'shots3/sim-row-quad.png' });
  await p.selectOption('select[title="Camera preset"]', 'tree'); await wait(2500);
  await p.screenshot({ path: 'shots3/sim-tree-v3.png' });
} catch (e) { console.log('ERR', e.message.slice(0, 300)); }
console.log('errors', errs);
await b.close(); server.kill();
