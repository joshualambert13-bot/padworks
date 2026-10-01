// Sign-in state and the API client. Sessions are an httpOnly cookie set by the server; the browser never sees
// a token. Accounts are created by an admin (no self-signup, no email): a username, a display name, a role.
import { create } from 'zustand';

export async function api(path, { method = 'GET', body } = {}) {
  const init = { method, credentials: 'same-origin', headers: {} };
  if (method !== 'GET') { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body === undefined ? {} : body); }
  let res;
  try { res = await fetch('/api/' + path, init); } catch { const e = new Error('The accounts service is not reachable. Check your connection.'); e.status = 0; throw e; }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const e = new Error((data && data.error) || (res.status === 404 ? 'The accounts API is not deployed (404).' : 'Request failed (' + res.status + ').'));
    e.status = res.status;
    throw e;
  }
  return data;
}

export const ROLE_LABEL = { admin: 'Admin', instructor: 'Instructor', trainee: 'Trainee' };
// An admin can look at the site as a trainee or an instructor would see it (a view mask only: the server still
// knows who they are). Kept in sessionStorage so a reload keeps it and a new tab does not.
const VIEW_KEY = 'padworks.viewAs';
const storedView = () => { try { return window.sessionStorage.getItem(VIEW_KEY) || null; } catch { return null; } };
export const effectiveRole = (u, viewAs) => (u && u.role === 'admin' && viewAs ? viewAs : u ? u.role : null);
export const canSeeAdmin = (u, viewAs = null) => { const r = effectiveRole(u, viewAs); return r === 'admin' || r === 'instructor'; };

export const useAuth = create((set, get) => ({
  user: undefined,        // undefined: not checked yet; null: signed out
  viewAs: storedView(),   // 'trainee' | 'instructor' | null (admins only)
  setViewAs: (role) => { try { if (role) window.sessionStorage.setItem(VIEW_KEY, role); else window.sessionStorage.removeItem(VIEW_KEY); } catch { /* session only */ } set({ viewAs: role || null }); },
  setup: null,            // 'no-accounts' when the database has no users yet
  serviceError: null,     // the accounts service itself is unavailable (no database, no secret, not deployed)
  busy: false,
  refresh: async () => {
    try { const d = await api('auth/me'); set({ user: d.user, setup: d.setup || null, serviceError: null }); }
    catch (e) { set({ user: null, serviceError: e.message }); }
  },
  login: async (username, password) => {
    set({ busy: true });
    try { const d = await api('auth/login', { method: 'POST', body: { username, password } }); set({ user: d.user, serviceError: null }); return d.user; }
    finally { set({ busy: false }); }
  },
  logout: async () => {
    try { await api('auth/logout', { method: 'POST' }); } catch { /* the cookie is cleared server side; fall through */ }
    set({ user: null });
  },
  changePassword: async (current, next) => {
    set({ busy: true });
    try { const d = await api('auth/password', { method: 'POST', body: { current, next } }); set({ user: d.user }); return d.user; }
    finally { set({ busy: false }); }
  },
  signedOutByServer: () => { if (get().user) set({ user: null }); },
}));
