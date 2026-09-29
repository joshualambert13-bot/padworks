// Renders public/brand/mark.svg to PNG at several sizes and on light and dark backgrounds.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const svg = fs.readFileSync('public/brand/mark.svg', 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const outDir = 'public/brand';
for (const [size, bg, name] of [[1024, 'transparent', 'mark-1024.png'], [512, 'transparent', 'mark-512.png'], [192, 'transparent', 'mark-192.png'], [64, 'transparent', 'mark-64.png'], [1024, '#0b0f14', 'mark-1024-dark.png'], [1024, '#ffffff', 'mark-1024-light.png']]) {
  const ctx = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(`<html><body style="margin:0;background:${bg}">${svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await p.screenshot({ path: path.join(outDir, name), omitBackground: bg === 'transparent' });
  await ctx.close();
}
await browser.close();
console.log('rendered');
