// Copies index.html to 404.html so path routing works on GitHub Pages; Cloudflare Pages falls back on its own.
import fs from 'node:fs';
fs.copyFileSync('dist/index.html', 'dist/404.html');
console.log('postbuild: 404.html written for SPA fallback');
