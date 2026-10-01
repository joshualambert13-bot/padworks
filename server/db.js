// Database access for the accounts API. Production uses Neon Postgres over HTTP (DATABASE_URL, injected by the
// Vercel Neon integration); local runs and the headless checks use PGlite (Postgres in process) when
// PADWORKS_PGLITE is set to "memory" or a folder path. Both expose query(text, params) returning rows.
let _db = null;
let _ready = null;

export async function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    _db = { kind: 'neon', query: (text, params = []) => sql.query(text, params) };
  } else if (process.env.PADWORKS_PGLITE) {
    const mod = '@electric-sql/pglite';                      // a variable specifier keeps the dev-only package out of the serverless bundle
    const { PGlite } = await import(/* @vite-ignore */ mod);
    const pg = new PGlite(process.env.PADWORKS_PGLITE === 'memory' ? undefined : process.env.PADWORKS_PGLITE);
    _db = { kind: 'pglite', query: async (text, params = []) => (await pg.query(text, params)).rows };
  } else {
    const e = new Error('No database configured. Add the Neon integration in Vercel (DATABASE_URL) or set PADWORKS_PGLITE=memory for a local run.');
    e.status = 503;
    throw e;
  }
  return _db;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'trainee',
    pw_hash TEXT NOT NULL,
    must_change BOOLEAN NOT NULL DEFAULT TRUE,
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS lesson_results (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL,
    grade TEXT NOT NULL,
    total INTEGER NOT NULL,
    secs INTEGER NOT NULL DEFAULT 0,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS lesson_results_user ON lesson_results(user_id, lesson_id)`,
  `CREATE TABLE IF NOT EXISTS job_summaries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'free',
    title TEXT NOT NULL DEFAULT '',
    grade TEXT,
    total INTEGER,
    secs INTEGER NOT NULL DEFAULT 0,
    payload JSONB NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS job_summaries_user ON job_summaries(user_id, at)`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS login_attempts_user ON login_attempts(username, at)`,
];

// Creates the tables once per process; cheap no-ops afterwards (IF NOT EXISTS).
export function ensureSchema() {
  if (!_ready) {
    _ready = (async () => {
      const db = await getDb();
      for (const stmt of SCHEMA) await db.query(stmt);
      return db;
    })().catch(e => { _ready = null; throw e; });
  }
  return _ready;
}
