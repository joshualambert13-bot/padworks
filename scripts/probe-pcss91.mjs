import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = 4241;
const server = spawn('node', ['scripts/dev-server.mjs', String(PORT), process.env.DIST || 'dist'], { stdio: 'ignore' });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
await wait(3000);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const base = `http://localhost:${PORT}`;
const ctx = await browser.newContext({ viewport: { width: 900, height: 600 } });
const post = (path, data) => ctx.request.post(base + '/api/' + path, { data, headers: { 'content-type': 'application/json' } });
let r = await post('auth/login', { username: 'admin', password: 'shots-admin-password' });
if (!r.ok()) { await post('auth/login', { username: 'admin', password: 'padworks-admin' }); await post('auth/password', { current: 'padworks-admin', next: 'shots-admin-password' }); }
const p = await ctx.newPage(); p.setDefaultTimeout(300000);
p.on('console', m => { if (/SoftShadows|shadow/i.test(m.text())) console.log('console', m.type(), m.text().slice(0, 200)); });
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto(base + '/simulate'); await p.waitForSelector('[data-action="tour"]', { timeout: 300000 }); await wait(12000);
const d = await p.evaluate(() => { const T = window.__THREE, gl = window.__padworksGL; const c = T.ShaderChunk.shadowmap_pars_fragment; const ctx = gl.getContext(); let n = 0, pcss = 0, basic = 0, pcf = 0, shadowed = 0; for (const pr of gl.info.programs) { n++; const src = pr.fragmentShader ? ctx.getShaderSource(pr.fragmentShader) : ''; if (/USE_SHADOWMAP/.test(src)) shadowed++; if (/PCSS/.test(src)) pcss++; if (/SHADOWMAP_TYPE_BASIC/.test(src)) basic++; if (/SHADOWMAP_TYPE_PCF\b/.test(src)) pcf++; } return { chunk: c.includes('PCSS'), type: gl.shadowMap.type, programs: n, shadowed, pcssPrograms: pcss, basicPrograms: basic, pcfPrograms: pcf }; });
console.log(JSON.stringify(d));
await browser.close(); server.kill();
