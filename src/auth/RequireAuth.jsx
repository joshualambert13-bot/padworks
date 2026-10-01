// Gate for the whole site: checks the session once, shows the sign-in screen when there is none, forces a
// password change after a one-time password, and loads the trainee's saved progress once signed in.
import { useEffect } from 'react';
import { useAuth, api } from './auth.js';
import Login from './Login.jsx';
import ChangePassword from './ChangePassword.jsx';
import { useSim } from '../sim/store.js';

export default function RequireAuth({ children }) {
  const user = useAuth(s => s.user);
  const refresh = useAuth(s => s.refresh);
  useEffect(() => { refresh(); }, [refresh]);
  const userId = user ? user.id : null;
  useEffect(() => {
    if (!userId) { useSim.getState().hydrateProgress([]); return; }
    let live = true;
    api('me/progress').then(d => { if (live) useSim.getState().hydrateProgress(d.results); }).catch(() => { /* progress loads next time */ });
    return () => { live = false; };
  }, [userId]);
  if (user === undefined) return <div className="h-full flex items-center justify-center text-sm text-mute" data-panel="auth-loading">Checking your session</div>;
  if (!user) return <Login />;
  if (user.mustChange) return <ChangePassword forced />;
  return children;
}
