// Header menu for the signed-in user: name and role, links to the admin panel and the password page, sign out.
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CircleUser, ChevronDown, Users, KeyRound, LogOut, Eye } from 'lucide-react';
import { useAuth, canSeeAdmin, effectiveRole, ROLE_LABEL } from './auth.js';

export default function UserMenu() {
  const user = useAuth(s => s.user);
  const logout = useAuth(s => s.logout);
  const viewAs = useAuth(s => s.viewAs);
  const setViewAs = useAuth(s => s.setViewAs);
  const [open, setOpen] = useState(false);
  const role = effectiveRole(user, viewAs);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  if (!user) return null;
  return (
    <div className="relative" ref={ref}>
      <button className="btn flex items-center gap-1" onClick={() => setOpen(o => !o)} data-action="user-menu" title={user.username}>
        <CircleUser size={16} /><span className="hidden sm:inline max-w-[10rem] truncate">{user.displayName || user.username}</span><span className="badge text-mute hidden md:inline">{ROLE_LABEL[role]}{viewAs ? ' view' : ''}</span><ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 card p-1 z-50 text-sm" data-panel="user-menu">
          <div className="px-2 py-1 text-[11px] text-mute">Signed in as <span className="mono">{user.username}</span></div>
          {canSeeAdmin(user, viewAs) && <Link to="/admin" className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-panel2" onClick={() => setOpen(false)} data-action="menu-admin"><Users size={14} />{role === 'admin' ? 'Accounts and progress' : 'Trainee progress'}</Link>}
          {user.role === 'admin' && (
            <div className="border-t border-line mt-1 pt-1">
              <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-mute">View the site as</div>
              {[['trainee', 'A trainee'], ['instructor', 'An instructor'], [null, 'Myself (admin)']].map(([r, label]) => (
                <button key={String(r)} className={'w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-panel2 text-left ' + ((viewAs || null) === r ? 'text-accent' : '')} onClick={() => { setViewAs(r); setOpen(false); }} data-action={'view-as-' + (r || 'admin')}><Eye size={14} />{label}</button>
              ))}
            </div>
          )}
          <Link to="/account" className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-panel2" onClick={() => setOpen(false)} data-action="menu-password"><KeyRound size={14} />Change password</Link>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-panel2 text-left" onClick={() => { setOpen(false); logout(); }} data-action="menu-logout"><LogOut size={14} />Sign out</button>
        </div>
      )}
    </div>
  );
}
