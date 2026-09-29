// Renders a GLB through the site's viewer for a quick look: node scripts/preview-glb.mjs /glb/test/X.glb out.png [angle]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const [,, url, out, keys = ''] = process.argv;
const server = spawn('npx', ['vite', 'preview', '--port', '4175', '--strictPort'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2500));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 1100, height: 800 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:4175/preview?glb=' + encodeURIComponent(url)); await new Promise(r => setTimeout(r, 7000));
for (const k of keys.split(',').filter(Boolean)) { await p.keyboard.press(k); await new Promise(r => setTimeout(r, 1200)); }
await p.screenshot({ path: out });
console.log('errors', errs);
await b.close(); server.kill();
