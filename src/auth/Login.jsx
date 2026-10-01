// Sign-in screen: the only page a visitor sees without an account. Username and password, nothing else.
import { useState } from 'react';
import { LogIn, ShieldAlert } from 'lucide-react';
import { useAuth } from './auth.js';
import { SITE_TAGLINE } from '../config.js';

export default function Login() {
  const login = useAuth(s => s.login);
  const busy = useAuth(s => s.busy);
  const setup = useAuth(s => s.setup);
  const serviceError = useAuth(s => s.serviceError);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try { await login(username.trim(), password); } catch (err) { setError(err.message); }
  };
  return (
    <div className="h-full flex items-center justify-center p-4" data-panel="login">
      <form onSubmit={submit} className="card w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <img src="/brand/mark.svg" alt="" className="h-9 w-9" />
          <div><div className="font-semibold tracking-tight text-white text-lg leading-tight">Pad<span className="text-accent">works</span></div><div className="text-xs text-mute">{SITE_TAGLINE}</div></div>
        </div>
        <div className="text-sm text-mute">Sign in with the username and password your administrator gave you. On your first sign-in you will pick your own password.</div>
        {serviceError && <div className="text-xs rounded border border-bad/60 bg-bad/10 p-2 flex gap-2 text-bad" data-status="service-error"><ShieldAlert size={14} className="shrink-0 mt-0.5" /><span>{serviceError}</span></div>}
        {setup === 'no-accounts' && <div className="text-xs rounded border border-warn/60 bg-warn/10 p-2 text-warn" data-status="no-accounts">No accounts exist yet. The first admin comes from the PADWORKS_ADMIN_USER and PADWORKS_ADMIN_PASSWORD settings on the server.</div>}
        <label className="block space-y-1 text-xs text-mute">Username
          <input className="input" autoComplete="username" autoCapitalize="none" value={username} onChange={e => setUsername(e.target.value)} data-input="username" autoFocus />
        </label>
        <label className="block space-y-1 text-xs text-mute">Password
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} data-input="password" />
        </label>
        {error && <div className="text-xs text-bad" data-status="login-error">{error}</div>}
        <button className="btn btn-primary w-full flex items-center justify-center gap-1" disabled={busy || !username || !password} data-action="login"><LogIn size={14} />{busy ? 'Signing in' : 'Sign in'}</button>
        <div className="text-[10px] text-mute">Built for training. Not for operational decisions. Accounts store a username, a display name, and lesson results; nothing else is collected.</div>
      </form>
    </div>
  );
}
