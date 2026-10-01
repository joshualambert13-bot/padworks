// Local server for the built site plus the accounts API, with Postgres in process (PGlite) so no account or
// database setup is needed: node scripts/dev-server.mjs [port]. The headless checks run against this.
// Default local admin: admin / padworks-admin (forced password change on first sign-in, like production).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
process.env.PADWORKS_PGLITE ||= 'memory';
process.env.PADWORKS_ADMIN_USER ||= 'admin';
process.env.PADWORKS_ADMIN_PASSWORD ||= 'padworks-admin';
const { handle } = await import('../server/api.js');
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const ROOT = path.resolve(process.argv[3] || 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.md': 'text/markdown' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) return handle(req, res);
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');
  const ext = path.extname(file).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  if (ext !== '.html') res.setHeader('Cache-Control', 'public, max-age=3600');
  fs.createReadStream(file).pipe(res);
});
server.listen(PORT, () => console.log(`padworks dev server: http://localhost:${PORT} (site from ${ROOT}, API with ${process.env.DATABASE_URL ? 'Neon' : 'PGlite ' + process.env.PADWORKS_PGLITE})`));
