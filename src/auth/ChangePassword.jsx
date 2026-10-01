// Password change: forced after a one-time password (first sign-in or an admin reset), and available any time
// from the account menu.
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from './auth.js';

export default function ChangePassword({ forced = false, onDone }) {
  const changePassword = useAuth(s => s.changePassword);
  const logout = useAuth(s => s.logout);
  const user = useAuth(s => s.user);
  const busy = useAuth(s => s.busy);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (next !== again) { setError('The new password was typed differently the second time.'); return; }
    try { await changePassword(current, next); setDone(true); setCurrent(''); setNext(''); setAgain(''); if (onDone) onDone(); } catch (err) { setError(err.message); }
  };
  return (
    <div className={forced ? 'h-full flex items-center justify-center p-4' : 'p-4 max-w-md'} data-panel="change-password">
      <form onSubmit={submit} className="card w-full max-w-sm p-5 space-y-3">
        <div className="flex items-center gap-2 text-white font-semibold"><KeyRound size={16} />{forced ? 'Choose your password' : 'Change password'}</div>
        {forced && <div className="text-sm text-mute">Welcome, {user?.displayName || user?.username}. The password you signed in with was a one-time password. Pick your own to continue: at least 10 characters.</div>}
        <label className="block space-y-1 text-xs text-mute">{forced ? 'One-time password' : 'Current password'}
          <input className="input" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} data-input="current" autoFocus />
        </label>
        <label className="block space-y-1 text-xs text-mute">New password
          <input className="input" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} data-input="next" />
        </label>
        <label className="block space-y-1 text-xs text-mute">New password again
          <input className="input" type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} data-input="again" />
        </label>
        {error && <div className="text-xs text-bad" data-status="password-error">{error}</div>}
        {done && !forced && <div className="text-xs text-ok" data-status="password-done">Password changed.</div>}
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" disabled={busy || !current || !next || !again} data-action="change-password">{busy ? 'Saving' : 'Save password'}</button>
          {forced && <button type="button" className="btn" onClick={logout}>Sign out</button>}
        </div>
      </form>
    </div>
  );
}
