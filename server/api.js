// The accounts API: one handler behind /api/* (Vercel serverless function or the local dev server).
// Sessions are signed cookies; every request re-reads the user so a disable, reset, or role change takes
// effect at once. Trainees see their own progress; instructors see everyone's; admins manage accounts.
import { ensureSchema } from './db.js';
import { COOKIE, ROLES, hashPassword, checkPassword, oneTimePassword, signSession, readSession, parseCookies, sessionCookie, validateUsername, validatePassword } from './auth.js';

const MAX_FAILURES = 8;          // failed sign-ins per username before a cool-down
const FAILURE_WINDOW_MIN = 15;
export const gradeOf = (total) => (total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 70 ? 'C' : total >= 60 ? 'D' : 'F');

let _dummy = null;
const dummyHash = async () => (_dummy ||= await hashPassword('not-a-real-password'));

class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = (m) => new ApiError(400, m);

async function readJson(req) {
  if (req.body !== undefined && req.body !== null) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}
function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}
const publicUser = (u) => ({ id: u.id, username: u.username, displayName: u.display_name, role: u.role, mustChange: u.must_change, disabled: u.disabled, createdAt: u.created_at, lastLogin: u.last_login });

async function currentUser(db, req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const s = await readSession(token);
  if (!s) return null;
  const rows = await db.query('SELECT * FROM users WHERE id = $1', [Number(s.sub)]);
  const u = rows[0];
  if (!u || u.disabled || u.token_version !== s.v) return null;
  return u;
}
const requireUser = (u) => { if (!u) throw new ApiError(401, 'Sign in to continue.'); return u; };
const requireRole = (u, roles) => { requireUser(u); if (!roles.includes(u.role)) throw new ApiError(403, 'Not allowed for your role.'); return u; };

// Per-user, per-lesson bests used by the dashboard and the CSV export.
async function lessonStats(db, userId = null) {
  const rows = await db.query(
    `SELECT user_id, lesson_id, MAX(total) AS best, COUNT(*)::int AS attempts, MIN(secs) AS best_secs, MAX(at) AS last_at
     FROM lesson_results ${userId ? 'WHERE user_id = $1' : ''} GROUP BY user_id, lesson_id`, userId ? [userId] : []);
  const by = {};
  for (const r of rows) {
    (by[r.user_id] ||= {})[r.lesson_id] = { best: Number(r.best), grade: gradeOf(Number(r.best)), attempts: Number(r.attempts), bestSecs: Number(r.best_secs), lastAt: r.last_at };
  }
  return by;
}
const summaryRow = (s) => ({ id: s.id, kind: s.kind, title: s.title, grade: s.grade, total: s.total, secs: s.secs, at: s.at });

export async function handle(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    // Vercel rewrites /api/* to /api/index?__path=...; locally the dev server passes the original URL. Either form works.
    const forced = url.searchParams.get('__path');
    const path = (forced != null ? forced : url.pathname.replace(/^\/api\/?/, '')).replace(/^\/+|\/+$/g, '');
    const parts = path.split('/').filter(Boolean);
    const method = req.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && !(req.headers['content-type'] || '').includes('application/json')) throw bad('Send JSON.');

    if (parts[0] === 'health') {
      let dbOk = false; try { await ensureSchema(); dbOk = true; } catch { dbOk = false; }
      return send(res, 200, { ok: true, db: dbOk, secret: Boolean(process.env.PADWORKS_SESSION_SECRET || process.env.PADWORKS_PGLITE) });
    }
    const db = await ensureSchema();
    await seedAdmin(db);
    const me = await currentUser(db, req);

    // ---------------------------------------------------------------- auth
    if (parts[0] === 'auth') {
      if (parts[1] === 'me' && method === 'GET') {
        if (me) return send(res, 200, { user: publicUser(me) });
        const n = await db.query('SELECT COUNT(*)::int AS n FROM users');
        return send(res, 200, { user: null, setup: Number(n[0].n) === 0 ? 'no-accounts' : null });
      }
      if (parts[1] === 'login' && method === 'POST') {
        const body = await readJson(req);
        const username = String(body.username || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!username || !password) throw bad('Enter your username and password.');
        const fails = await db.query(`SELECT COUNT(*)::int AS n FROM login_attempts WHERE username = $1 AND at > now() - interval '${FAILURE_WINDOW_MIN} minutes'`, [username]);
        if (Number(fails[0].n) >= MAX_FAILURES) throw new ApiError(429, `Too many sign-in attempts. Wait ${FAILURE_WINDOW_MIN} minutes and try again.`);
        const rows = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        const u = rows[0];
        const ok = u ? await checkPassword(password, u.pw_hash) : await checkPassword(password, await dummyHash());   // same work for unknown names
        if (!u || !ok) {
          await db.query(`DELETE FROM login_attempts WHERE at < now() - interval '1 day'`);
          await db.query('INSERT INTO login_attempts (username) VALUES ($1)', [username]);
          throw new ApiError(401, 'Wrong username or password.');
        }
        if (u.disabled) throw new ApiError(403, 'This account is disabled. Ask your administrator.');
        await db.query('DELETE FROM login_attempts WHERE username = $1', [username]);
        await db.query('UPDATE users SET last_login = now() WHERE id = $1', [u.id]);
        const token = await signSession(u);
        return send(res, 200, { user: publicUser({ ...u, last_login: new Date().toISOString() }) }, { 'Set-Cookie': sessionCookie(req, token) });
      }
      if (parts[1] === 'logout' && method === 'POST') return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '') });
      if (parts[1] === 'password' && method === 'POST') {
        requireUser(me);
        const body = await readJson(req);
        const current = String(body.current || ''), next = String(body.next || '');
        if (!(await checkPassword(current, me.pw_hash))) throw bad('Current password is wrong.');
        const err = validatePassword(next); if (err) throw bad(err);
        if (next === current) throw bad('Pick a password different from the current one.');
        const hash = await hashPassword(next);
        const rows = await db.query('UPDATE users SET pw_hash = $1, must_change = FALSE, token_version = token_version + 1 WHERE id = $2 RETURNING *', [hash, me.id]);
        const token = await signSession(rows[0]);
        return send(res, 200, { user: publicUser(rows[0]) }, { 'Set-Cookie': sessionCookie(req, token) });
      }
      throw new ApiError(404, 'Not found.');
    }

    // ---------------------------------------------------------------- the signed-in user's own progress
    if (parts[0] === 'me') {
      requireUser(me);
      if (parts[1] === 'progress' && method === 'GET') {
        const results = await db.query('SELECT id, lesson_id, grade, total, secs, at FROM lesson_results WHERE user_id = $1 ORDER BY at', [me.id]);
        const summaries = await db.query('SELECT id, kind, title, grade, total, secs, at FROM job_summaries WHERE user_id = $1 ORDER BY at DESC LIMIT 50', [me.id]);
        return send(res, 200, { results: results.map(r => ({ id: r.lesson_id, grade: r.grade, total: r.total, secs: r.secs, at: new Date(r.at).getTime() })), summaries: summaries.map(summaryRow) });
      }
      if (parts[1] === 'results' && method === 'POST') {
        const b = await readJson(req);
        const lessonId = String(b.lessonId || ''); const total = Math.max(0, Math.min(100, Math.round(Number(b.total) || 0))); const secs = Math.max(0, Math.round(Number(b.secs) || 0));
        if (!/^L\d{1,2}$/.test(lessonId)) throw bad('Bad lesson id.');
        const rows = await db.query('INSERT INTO lesson_results (user_id, lesson_id, grade, total, secs) VALUES ($1, $2, $3, $4, $5) RETURNING id, at', [me.id, lessonId, gradeOf(total), total, secs]);
        let summaryId = null;
        if (b.summary && typeof b.summary === 'object') {
          const s = await db.query('INSERT INTO job_summaries (user_id, kind, title, grade, total, secs, payload) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id', [me.id, 'lesson', String(b.title || lessonId).slice(0, 120), gradeOf(total), total, secs, JSON.stringify(b.summary).slice(0, 400000)]);
          summaryId = s[0].id;
        }
        return send(res, 200, { ok: true, id: rows[0].id, at: new Date(rows[0].at).getTime(), summaryId });
      }
      if (parts[1] === 'summaries' && method === 'POST') {
        const b = await readJson(req);
        if (!b.payload || typeof b.payload !== 'object') throw bad('Missing summary.');
        const total = b.total == null ? null : Math.max(0, Math.min(100, Math.round(Number(b.total) || 0)));
        const rows = await db.query('INSERT INTO job_summaries (user_id, kind, title, grade, total, secs, payload) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, at', [me.id, String(b.kind || 'free').slice(0, 20), String(b.title || 'Job').slice(0, 120), total == null ? null : gradeOf(total), total, Math.max(0, Math.round(Number(b.secs) || 0)), JSON.stringify(b.payload).slice(0, 400000)]);
        return send(res, 200, { ok: true, id: rows[0].id, at: rows[0].at });
      }
      if (parts[1] === 'summaries' && parts[2] && method === 'GET') {
        const rows = await db.query('SELECT * FROM job_summaries WHERE id = $1 AND user_id = $2', [Number(parts[2]), me.id]);
        if (!rows[0]) throw new ApiError(404, 'No such summary.');
        return send(res, 200, { ...summaryRow(rows[0]), payload: rows[0].payload });
      }
      // error report on a record or a page: anyone signed in can file one; admins and instructors read them
      if (parts[1] === 'reports' && method === 'POST') {
        const b = await readJson(req);
        const message = String(b.message || '').trim().slice(0, 4000);
        if (message.length < 5) throw bad('Say what is wrong (a few words at least).');
        const rows = await db.query('INSERT INTO reports (user_id, record_id, page, message) VALUES ($1, $2, $3, $4) RETURNING id, created_at', [me.id, String(b.recordId || '').slice(0, 80), String(b.page || '').slice(0, 200), message]);
        return send(res, 200, { ok: true, id: rows[0].id, at: rows[0].created_at });
      }
      throw new ApiError(404, 'Not found.');
    }

    // ---------------------------------------------------------------- administration
    if (parts[0] === 'admin') {
      requireRole(me, ['admin', 'instructor']);
      const adminOnly = () => requireRole(me, ['admin']);
      const userId = parts[1] === 'users' && parts[2] ? Number(parts[2]) : null;
      if (userId !== null && !Number.isInteger(userId)) throw bad('Bad user id.');

      if (parts[1] === 'users' && !userId && method === 'GET') {
        const users = await db.query('SELECT * FROM users ORDER BY role, username');
        const stats = await lessonStats(db);
        const sums = await db.query('SELECT user_id, COUNT(*)::int AS n FROM job_summaries GROUP BY user_id');
        const sumBy = Object.fromEntries(sums.map(r => [r.user_id, Number(r.n)]));
        return send(res, 200, { users: users.map(u => ({ ...publicUser(u), lessons: stats[u.id] || {}, summaries: sumBy[u.id] || 0 })) });
      }
      if (parts[1] === 'users' && !userId && method === 'POST') {
        adminOnly();
        const b = await readJson(req);
        const username = String(b.username || '').trim().toLowerCase();
        const err = validateUsername(username); if (err) throw bad(err);
        const role = ROLES.includes(b.role) ? b.role : 'trainee';
        const displayName = String(b.displayName || '').trim().slice(0, 80);
        const dup = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (dup[0]) throw bad('That username is taken.');
        const otp = oneTimePassword();
        const rows = await db.query('INSERT INTO users (username, display_name, role, pw_hash, must_change) VALUES ($1, $2, $3, $4, TRUE) RETURNING *', [username, displayName, role, await hashPassword(otp)]);
        return send(res, 200, { user: { ...publicUser(rows[0]), lessons: {}, summaries: 0 }, oneTimePassword: otp });
      }
      if (parts[1] === 'users' && userId && parts[3] === 'progress' && method === 'GET') {
        const u = (await db.query('SELECT * FROM users WHERE id = $1', [userId]))[0];
        if (!u) throw new ApiError(404, 'No such user.');
        const results = await db.query('SELECT id, lesson_id, grade, total, secs, at FROM lesson_results WHERE user_id = $1 ORDER BY at', [userId]);
        const summaries = await db.query('SELECT id, kind, title, grade, total, secs, at FROM job_summaries WHERE user_id = $1 ORDER BY at DESC LIMIT 200', [userId]);
        return send(res, 200, { user: publicUser(u), lessons: (await lessonStats(db, userId))[userId] || {}, results: results.map(r => ({ id: r.id, lessonId: r.lesson_id, grade: r.grade, total: r.total, secs: r.secs, at: r.at })), summaries: summaries.map(summaryRow) });
      }
      if (parts[1] === 'users' && userId && parts[3] === 'results' && method === 'DELETE') {
        adminOnly();
        await db.query('DELETE FROM lesson_results WHERE user_id = $1', [userId]);
        await db.query('DELETE FROM job_summaries WHERE user_id = $1', [userId]);
        return send(res, 200, { ok: true });
      }
      if (parts[1] === 'users' && userId && parts[3] === 'reset' && method === 'POST') {
        adminOnly();
        const otp = oneTimePassword();
        const rows = await db.query('UPDATE users SET pw_hash = $1, must_change = TRUE, token_version = token_version + 1 WHERE id = $2 RETURNING *', [await hashPassword(otp), userId]);
        if (!rows[0]) throw new ApiError(404, 'No such user.');
        await db.query('DELETE FROM login_attempts WHERE username = $1', [rows[0].username]);
        return send(res, 200, { user: publicUser(rows[0]), oneTimePassword: otp });
      }
      if (parts[1] === 'users' && userId && !parts[3] && method === 'PATCH') {
        adminOnly();
        const b = await readJson(req);
        const u = (await db.query('SELECT * FROM users WHERE id = $1', [userId]))[0];
        if (!u) throw new ApiError(404, 'No such user.');
        const role = b.role !== undefined ? (ROLES.includes(b.role) ? b.role : null) : u.role;
        if (!role) throw bad('Bad role.');
        const disabled = b.disabled !== undefined ? Boolean(b.disabled) : u.disabled;
        const displayName = b.displayName !== undefined ? String(b.displayName).trim().slice(0, 80) : u.display_name;
        if (u.id === me.id && (disabled || role !== 'admin')) throw bad('You cannot disable or demote your own account.');
        if (u.role === 'admin' && (role !== 'admin' || disabled)) {
          const admins = await db.query('SELECT COUNT(*)::int AS n FROM users WHERE role = $1 AND disabled = FALSE AND id <> $2', ['admin', u.id]);
          if (Number(admins[0].n) === 0) throw bad('At least one active admin must remain.');
        }
        const bump = (disabled && !u.disabled) || role !== u.role ? 1 : 0;
        const rows = await db.query('UPDATE users SET role = $1, disabled = $2, display_name = $3, token_version = token_version + $4 WHERE id = $5 RETURNING *', [role, disabled, displayName, bump, userId]);
        return send(res, 200, { user: publicUser(rows[0]) });
      }
      if (parts[1] === 'users' && userId && !parts[3] && method === 'DELETE') {
        adminOnly();
        if (userId === me.id) throw bad('You cannot delete your own account.');
        const u = (await db.query('SELECT * FROM users WHERE id = $1', [userId]))[0];
        if (!u) throw new ApiError(404, 'No such user.');
        await db.query('DELETE FROM users WHERE id = $1', [userId]);
        return send(res, 200, { ok: true });
      }
      if (parts[1] === 'summaries' && parts[2] && method === 'GET') {
        const rows = await db.query('SELECT s.*, u.username, u.display_name FROM job_summaries s JOIN users u ON u.id = s.user_id WHERE s.id = $1', [Number(parts[2])]);
        if (!rows[0]) throw new ApiError(404, 'No such summary.');
        return send(res, 200, { ...summaryRow(rows[0]), username: rows[0].username, displayName: rows[0].display_name, payload: rows[0].payload });
      }
      if (parts[1] === 'reports' && !parts[2] && method === 'GET') {
        const rows = await db.query('SELECT r.*, u.username, u.display_name FROM reports r LEFT JOIN users u ON u.id = r.user_id ORDER BY (r.status = \'open\') DESC, r.created_at DESC LIMIT 500');
        return send(res, 200, { reports: rows.map(r => ({ id: r.id, recordId: r.record_id, page: r.page, message: r.message, status: r.status, at: r.created_at, username: r.username, displayName: r.display_name })) });
      }
      if (parts[1] === 'reports' && parts[2] && method === 'PATCH') {
        adminOnly();
        const b = await readJson(req);
        const status = b.status === 'resolved' ? 'resolved' : 'open';
        const rows = await db.query('UPDATE reports SET status = $1 WHERE id = $2 RETURNING id', [status, Number(parts[2])]);
        if (!rows[0]) throw new ApiError(404, 'No such report.');
        return send(res, 200, { ok: true });
      }
      if (parts[1] === 'reports' && parts[2] && method === 'DELETE') {
        adminOnly();
        await db.query('DELETE FROM reports WHERE id = $1', [Number(parts[2])]);
        return send(res, 200, { ok: true });
      }
      if (parts[1] === 'export.csv' && method === 'GET') {
        const users = await db.query('SELECT * FROM users ORDER BY username');
        const stats = await lessonStats(db);
        const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
        const lines = [['username', 'display_name', 'role', 'disabled', 'last_sign_in', 'lesson', 'best_score', 'best_grade', 'attempts', 'best_time_s', 'last_attempt'].join(',')];
        for (const u of users) {
          const ls = stats[u.id] || {};
          const ids = Object.keys(ls).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
          if (ids.length === 0) lines.push([u.username, u.display_name, u.role, u.disabled, u.last_login ? new Date(u.last_login).toISOString() : '', '', '', '', 0, '', ''].map(q).join(','));
          for (const id of ids) { const l = ls[id]; lines.push([u.username, u.display_name, u.role, u.disabled, u.last_login ? new Date(u.last_login).toISOString() : '', id, l.best, l.grade, l.attempts, l.bestSecs, new Date(l.lastAt).toISOString()].map(q).join(',')); }
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="padworks-progress.csv"');
        res.setHeader('Cache-Control', 'no-store');
        return res.end(lines.join('\r\n') + '\r\n');
      }
      throw new ApiError(404, 'Not found.');
    }
    throw new ApiError(404, 'Not found.');
  } catch (e) {
    const status = e.status || (e instanceof SyntaxError ? 400 : 500);
    if (status >= 500) console.error('[padworks api]', e);
    return send(res, status, { error: status >= 500 && !e.status ? 'Server error.' : e.message });
  }
}

// First run: no accounts yet, so the admin named in the environment is created with a forced password change.
let seeded = false;
async function seedAdmin(db) {
  if (seeded) return;
  const n = await db.query('SELECT COUNT(*)::int AS n FROM users');
  if (Number(n[0].n) === 0) {
    const username = String(process.env.PADWORKS_ADMIN_USER || '').trim().toLowerCase();
    const password = String(process.env.PADWORKS_ADMIN_PASSWORD || '');
    if (username && password && !validateUsername(username)) {
      await db.query('INSERT INTO users (username, display_name, role, pw_hash, must_change) VALUES ($1, $2, $3, $4, TRUE) ON CONFLICT (username) DO NOTHING', [username, 'Administrator', 'admin', await hashPassword(password)]);
    }
  }
  seeded = true;
}
