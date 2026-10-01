// Passwords, session tokens, cookies, one-time passwords. No email, no third-party identity: accounts are
// created by an admin, the trainee gets a one-time password and sets their own at first sign-in.
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { randomInt } from 'node:crypto';

export const COOKIE = 'padworks_session';
const SESSION_DAYS = 7;
export const ROLES = ['admin', 'instructor', 'trainee'];
export const MIN_PASSWORD = 10;

function secret() {
  const s = process.env.PADWORKS_SESSION_SECRET || (process.env.PADWORKS_PGLITE ? 'padworks-local-development-secret' : '');
  if (!s || s.length < 16) { const e = new Error('PADWORKS_SESSION_SECRET is not set (any phrase of 16 characters or more).'); e.status = 503; throw e; }
  return new TextEncoder().encode(s);
}

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);

// Readable one-time password: three groups of four from an alphabet without look-alike characters.
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
export function oneTimePassword() {
  const g = () => Array.from({ length: 4 }, () => ALPHA[randomInt(ALPHA.length)]).join('');
  return g() + '-' + g() + '-' + g();
}

export async function signSession(user) {
  return new SignJWT({ v: user.token_version, r: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(SESSION_DAYS + 'd')
    .sign(secret());
}
export async function readSession(token) {
  try { const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] }); return payload; } catch { return null; }
}

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
export function sessionCookie(req, token) {
  const secure = process.env.VERCEL || (req.headers['x-forwarded-proto'] || '').includes('https');
  const base = `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax` + (secure ? '; Secure' : '');
  return token ? base + `; Max-Age=${SESSION_DAYS * 86400}` : base + '; Max-Age=0';
}

export function validateUsername(u) {
  if (typeof u !== 'string') return 'Username is required.';
  const s = u.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(s)) return 'Username: 3 to 32 characters, letters, numbers, dots, dashes, or underscores.';
  return null;
}
export function validatePassword(p) {
  if (typeof p !== 'string' || p.length < MIN_PASSWORD) return `Password: at least ${MIN_PASSWORD} characters.`;
  if (p.length > 200) return 'Password: too long.';
  return null;
}
