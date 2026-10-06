// Admin panel: accounts (create with a one-time password, reset, disable, role, delete) and the progress
// dashboard (per-trainee lesson bests, attempts, time on task, saved job summaries, CSV export). Instructors
// get the dashboard read-only.
import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { UserPlus, RefreshCw, Download, KeyRound, Ban, CheckCircle2, Trash2, Eye, Copy, X, Eraser, Bug, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, useAuth, canSeeAdmin, effectiveRole, ROLE_LABEL } from '../auth/auth.js';
import { LESSONS } from '../sim/lessons.js';
import { fromServer } from '../sim/progress.js';
import SessionSummary from '../sim/SessionSummary.jsx';
import ThemePanel from '../theme/ThemePanel.jsx';

const fmtDate = (d) => (d ? new Date(d).toLocaleString() : 'never');
const gradeColor = (g) => (g === 'A' ? 'text-ok' : g === 'B' ? 'text-accent' : g === 'C' ? 'text-warn' : 'text-bad');
const avgBest = (lessons) => { const v = Object.values(lessons || {}); return v.length ? Math.round(v.reduce((a, l) => a + l.best, 0) / v.length) : null; };

function OneTimeCard({ otp, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(otp.username + ' / ' + otp.password); setCopied(true); } catch { setCopied(false); } };
  return (
    <div className="card p-3 border-ok/60 bg-ok/5 space-y-2" data-panel="one-time-password">
      <div className="flex items-center gap-2 text-sm text-white"><KeyRound size={14} className="text-ok" />{otp.kind === 'reset' ? 'Password reset for ' : 'Account created: '}<span className="mono">{otp.username}</span><button className="btn ml-auto" onClick={onClose} title="Close"><X size={14} /></button></div>
      <div className="text-xs text-mute">Give the trainee this one-time password. It works once; they choose their own password at their next sign-in. It is not shown again, so copy it now.</div>
      <div className="flex items-center gap-2"><span className="mono text-xl text-white tracking-wider" data-value="otp">{otp.password}</span><button className="btn flex items-center gap-1" onClick={copy} data-action="copy-otp"><Copy size={14} />{copied ? 'Copied' : 'Copy'}</button></div>
    </div>
  );
}

function CreateAccount({ onCreated }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('trainee');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(null); setBusy(true);
    try { const d = await api('admin/users', { method: 'POST', body: { username, displayName, role } }); setUsername(''); setDisplayName(''); setRole('trainee'); onCreated(d); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="card p-3 space-y-2" data-panel="create-account">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-mute"><UserPlus size={12} />Create an account</div>
      <div className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
        <label className="block space-y-1 text-xs text-mute">Username<input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="first.last" autoCapitalize="none" data-input="new-username" /></label>
        <label className="block space-y-1 text-xs text-mute">Display name<input className="input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Shown in the header" data-input="new-display" /></label>
        <label className="block space-y-1 text-xs text-mute">Role<select className="btn" value={role} onChange={e => setRole(e.target.value)} data-select="new-role"><option value="trainee">Trainee</option><option value="instructor">Instructor</option><option value="admin">Admin</option></select></label>
        <button className="btn btn-primary" disabled={busy || !username} data-action="create-account">{busy ? 'Creating' : 'Create'}</button>
      </div>
      {error && <div className="text-xs text-bad" data-status="create-error">{error}</div>}
      <div className="text-[10px] text-mute">Usernames: 3 to 32 characters, letters, numbers, dots, dashes, underscores. The new account gets a one-time password shown once, then a forced password change. Trainees see their own progress; instructors see everyone's progress; admins also manage accounts.</div>
    </form>
  );
}

function ProgressDrawer({ user, onClose, isAdmin, onCleared }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);     // a loaded summary payload
  const [confirmClear, setConfirmClear] = useState(false);
  const load = useCallback(() => { api('admin/users/' + user.id + '/progress').then(setData).catch(e => setError(e.message)); }, [user.id]);
  useEffect(() => { load(); }, [load]);
  const openSummary = async (id) => { try { setOpen(await api('admin/summaries/' + id)); } catch (e) { setError(e.message); } };
  const clear = async () => { try { await api('admin/users/' + user.id + '/results', { method: 'DELETE' }); setConfirmClear(false); load(); onCleared(); } catch (e) { setError(e.message); } };
  const lessonResults = data ? fromServer(data.results.map(r => ({ id: r.lessonId, total: r.total, grade: r.grade, secs: r.secs, at: r.at }))) : [];
  return (
    <div className="card p-3 space-y-3" data-panel="progress">
      <div className="flex items-center gap-2">
        <div className="text-sm text-white">{user.displayName || user.username} <span className="mono text-mute text-xs">{user.username}</span> <span className="badge text-mute ml-1">{ROLE_LABEL[user.role]}</span></div>
        <div className="text-[11px] text-mute">Last sign-in {fmtDate(user.lastLogin)}</div>
        {isAdmin && !confirmClear && <button className="btn ml-auto flex items-center gap-1 text-xs" onClick={() => setConfirmClear(true)} data-action="clear-results"><Eraser size={12} />Clear results</button>}
        {isAdmin && confirmClear && <span className="ml-auto flex items-center gap-1 text-xs"><span className="text-warn">Delete every result and summary for this account?</span><button className="btn btn-danger" onClick={clear} data-action="confirm-clear">Yes, clear</button><button className="btn" onClick={() => setConfirmClear(false)}>No</button></span>}
        <button className={'btn ' + (isAdmin && !confirmClear ? '' : 'ml-auto')} onClick={onClose} title="Close" data-action="close-progress"><X size={14} /></button>
      </div>
      {error && <div className="text-xs text-bad">{error}</div>}
      {!data && !error && <div className="text-xs text-mute">Loading</div>}
      {data && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {LESSONS.map(l => {
              const b = data.lessons[l.id];
              return (
                <div key={l.id} className={'card p-2 ' + (b ? '' : 'opacity-60')} data-lesson={l.id}>
                  <div className="text-[11px] text-white truncate" title={l.title}>{l.n}. {l.title}</div>
                  {b ? <div className="text-xs"><span className={'mono text-lg ' + gradeColor(b.grade)}>{b.best} {b.grade}</span><span className="text-mute"> best · {b.attempts} attempt{b.attempts === 1 ? '' : 's'} · best time {b.bestSecs} s of {l.targetSec} s</span></div> : <div className="text-xs text-mute">not run · target {l.targetSec} s</div>}
                </div>
              );
            })}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Lesson attempts ({data.results.length})</div>
              {data.results.length === 0 && <div className="text-xs text-mute">None yet.</div>}
              {data.results.length > 0 && (
                <table className="w-full text-[11px]">
                  <thead className="text-mute"><tr><th className="text-left font-normal">When</th><th className="text-left font-normal">Lesson</th><th className="text-right font-normal">Score</th><th className="text-right font-normal">Time</th></tr></thead>
                  <tbody>{[...data.results].reverse().map(r => <tr key={r.id}><td className="text-mute">{fmtDate(r.at)}</td><td>{r.lessonId}</td><td className={'mono text-right ' + gradeColor(r.grade)}>{r.total} {r.grade}</td><td className="mono text-right">{r.secs} s</td></tr>)}</tbody>
                </table>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Saved job summaries ({data.summaries.length})</div>
              {data.summaries.length === 0 && <div className="text-xs text-mute">None yet. A summary is saved when a lesson completes or a free-play job ends.</div>}
              {data.summaries.length > 0 && (
                <table className="w-full text-[11px]">
                  <thead className="text-mute"><tr><th className="text-left font-normal">When</th><th className="text-left font-normal">Job</th><th className="text-right font-normal">Score</th><th className="text-right font-normal"></th></tr></thead>
                  <tbody>{data.summaries.map(s => <tr key={s.id}><td className="text-mute">{fmtDate(s.at)}</td><td className="truncate max-w-[14rem]" title={s.title}>{s.title}</td><td className={'mono text-right ' + (s.grade ? gradeColor(s.grade) : 'text-mute')}>{s.total != null ? s.total + ' ' + s.grade : '-'}</td><td className="text-right"><button className="btn text-[11px] px-2 py-0.5 flex items-center gap-1 ml-auto" onClick={() => openSummary(s.id)} data-action={'open-summary-' + s.id}><Eye size={12} />Open</button></td></tr>)}</tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
      {open && <SessionSummary job={open.payload} lessonResults={lessonResults} onClose={() => setOpen(null)} heading={(user.displayName || user.username) + ' · ' + open.title} />}
    </div>
  );
}

// Error reports filed from record pages and the simulator: open ones first; admins resolve or delete them.
function Reports({ isAdmin }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const load = useCallback(() => { api('admin/reports').then(d => setRows(d.reports)).catch(e => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const act = (fn) => fn().then(load).catch(e => setError(e.message));
  const open = rows ? rows.filter(r => r.status === 'open') : [];
  const shown = rows ? (showResolved ? rows : open) : [];
  return (
    <div className="card p-2 space-y-2" data-panel="reports">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-mute"><Bug size={12} />Error reports<span className="mono ml-1">{open.length} open</span>
        <label className="ml-auto flex items-center gap-1 normal-case tracking-normal text-[11px]"><input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />show resolved</label>
        <button className="btn text-[11px] px-2 py-0.5" onClick={load}><RefreshCw size={12} /></button>
      </div>
      {error && <div className="text-xs text-bad">{error}</div>}
      {rows && shown.length === 0 && <div className="text-xs text-mute">No {showResolved ? '' : 'open '}reports. "Report an error" on any record page files one here.</div>}
      {shown.length > 0 && (
        <table className="w-full text-xs" data-table="reports">
          <thead className="text-mute text-[10px] uppercase tracking-wide"><tr><th className="text-left font-normal p-1">When</th><th className="text-left font-normal p-1">Who</th><th className="text-left font-normal p-1">Record or page</th><th className="text-left font-normal p-1">What is wrong</th><th className="text-right font-normal p-1"></th></tr></thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id} className={'border-t border-line align-top ' + (r.status === 'resolved' ? 'opacity-60' : '')} data-report={r.id}>
                <td className="p-1 text-mute whitespace-nowrap">{fmtDate(r.at)}</td>
                <td className="p-1 whitespace-nowrap">{r.displayName || r.username || 'deleted account'}</td>
                <td className="p-1">{r.recordId ? <Link className="text-accent underline mono" to={'/library/equipment/' + r.recordId}>{r.recordId}</Link> : <span className="text-mute">{r.page}</span>}</td>
                <td className="p-1 whitespace-pre-wrap max-w-[32rem]">{r.message}</td>
                <td className="p-1 text-right whitespace-nowrap">
                  {isAdmin && r.status === 'open' && <button className="btn text-[11px] px-2 py-0.5" onClick={() => act(() => api('admin/reports/' + r.id, { method: 'PATCH', body: { status: 'resolved' } }))} title="Mark resolved" data-action={'resolve-' + r.id}><Check size={12} /></button>}
                  {isAdmin && r.status === 'resolved' && <button className="btn text-[11px] px-2 py-0.5" onClick={() => act(() => api('admin/reports/' + r.id, { method: 'PATCH', body: { status: 'open' } }))} title="Reopen">Reopen</button>}
                  {isAdmin && <button className="btn text-[11px] px-2 py-0.5 ml-1" onClick={() => act(() => api('admin/reports/' + r.id, { method: 'DELETE' }))} title="Delete" data-action={'delete-report-' + r.id}><Trash2 size={12} /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AdminPage() {
  const me = useAuth(s => s.user);
  const viewAs = useAuth(s => s.viewAs);
  const isAdmin = effectiveRole(me, viewAs) === 'admin';
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [otp, setOtp] = useState(null);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const load = useCallback(() => { api('admin/users').then(d => { setUsers(d.users); setError(null); }).catch(e => setError(e.message)); }, []);
  useEffect(() => { if (canSeeAdmin(me, viewAs)) load(); }, [me, viewAs, load]);
  if (!canSeeAdmin(me, viewAs)) return <Navigate to="/simulate" replace />;
  const act = async (fn) => { try { await fn(); load(); } catch (e) { setError(e.message); } };
  const reset = (u) => act(async () => { const d = await api('admin/users/' + u.id + '/reset', { method: 'POST' }); setOtp({ kind: 'reset', username: u.username, password: d.oneTimePassword }); });
  const toggle = (u) => act(() => api('admin/users/' + u.id, { method: 'PATCH', body: { disabled: !u.disabled } }));
  const setRole = (u, role) => act(() => api('admin/users/' + u.id, { method: 'PATCH', body: { role } }));
  const remove = (u) => act(async () => { await api('admin/users/' + u.id, { method: 'DELETE' }); setConfirmDelete(null); if (selected && selected.id === u.id) setSelected(null); });
  return (
    <div className="relative h-full overflow-y-auto p-3 md:p-4 space-y-3" data-panel="admin">
      <div className="flex flex-wrap items-center gap-2">
        <div><div className="text-white font-semibold">Accounts and progress</div><div className="text-[11px] text-mute">{isAdmin ? 'You are an admin: create accounts, reset passwords, change roles, disable or delete accounts, and see every trainee\'s progress.' : 'You are an instructor: every trainee\'s progress is shown here; account changes need an admin.'}</div></div>
        <a className="btn ml-auto flex items-center gap-1 text-xs" href="/api/admin/export.csv" data-action="export-csv"><Download size={12} />Export CSV</a>
        <button className="btn flex items-center gap-1 text-xs" onClick={load} data-action="reload-users"><RefreshCw size={12} />Refresh</button>
      </div>
      {error && <div className="text-xs text-bad" data-status="admin-error">{error}</div>}
      {isAdmin && <ThemePanel />}
      {isAdmin && <CreateAccount onCreated={(d) => { setOtp({ kind: 'create', username: d.user.username, password: d.oneTimePassword }); load(); }} />}
      {otp && <OneTimeCard otp={otp} onClose={() => setOtp(null)} />}
      <div className="card p-2 overflow-x-auto">
        {!users && !error && <div className="text-xs text-mute p-2">Loading accounts</div>}
        {users && (
          <table className="w-full text-xs" data-table="users">
            <thead className="text-mute text-[10px] uppercase tracking-wide"><tr><th className="text-left font-normal p-1">Username</th><th className="text-left font-normal p-1">Name</th><th className="text-left font-normal p-1">Role</th><th className="text-left font-normal p-1">Status</th><th className="text-left font-normal p-1">Last sign-in</th><th className="text-right font-normal p-1">Lessons run</th><th className="text-right font-normal p-1">Avg best</th><th className="text-right font-normal p-1">Summaries</th><th className="text-right font-normal p-1">Actions</th></tr></thead>
            <tbody>
              {users.map(u => {
                const run = Object.keys(u.lessons).length; const avg = avgBest(u.lessons);
                return (
                  <tr key={u.id} className={'border-t border-line ' + (u.disabled ? 'opacity-60' : '')} data-user={u.username}>
                    <td className="p-1 mono">{u.username}{me.id === u.id && <span className="text-mute"> (you)</span>}</td>
                    <td className="p-1">{u.displayName}</td>
                    <td className="p-1">{isAdmin && me.id !== u.id ? <select className="btn text-[11px] py-0.5" value={u.role} onChange={e => setRole(u, e.target.value)} data-select={'role-' + u.username}><option value="trainee">Trainee</option><option value="instructor">Instructor</option><option value="admin">Admin</option></select> : ROLE_LABEL[u.role]}</td>
                    <td className="p-1">{u.disabled ? <span className="text-bad">Disabled</span> : u.mustChange ? <span className="text-warn" title="Has a one-time password; must choose a password at the next sign-in">Password pending</span> : <span className="text-ok">Active</span>}</td>
                    <td className="p-1 text-mute">{fmtDate(u.lastLogin)}</td>
                    <td className="p-1 text-right mono">{run}/{LESSONS.length}</td>
                    <td className={'p-1 text-right mono ' + (avg == null ? 'text-mute' : gradeColor(avg >= 90 ? 'A' : avg >= 80 ? 'B' : avg >= 70 ? 'C' : 'F'))}>{avg == null ? '-' : avg}</td>
                    <td className="p-1 text-right mono">{u.summaries}</td>
                    <td className="p-1">
                      <div className="flex items-center justify-end gap-1">
                        <button className="btn text-[11px] px-2 py-0.5 flex items-center gap-1" onClick={() => setSelected(u)} title="Progress" data-action={'view-' + u.username}><Eye size={12} />View</button>
                        {isAdmin && me.id !== u.id && (
                          <>
                            <button className="btn text-[11px] px-2 py-0.5" onClick={() => reset(u)} title="Issue a new one-time password" data-action={'reset-' + u.username}><KeyRound size={12} /></button>
                            <button className="btn text-[11px] px-2 py-0.5" onClick={() => toggle(u)} title={u.disabled ? 'Enable' : 'Disable'} data-action={'toggle-' + u.username}>{u.disabled ? <CheckCircle2 size={12} /> : <Ban size={12} />}</button>
                            {confirmDelete === u.id
                              ? <><button className="btn btn-danger text-[11px] px-2 py-0.5" onClick={() => remove(u)} data-action={'confirm-delete-' + u.username}>Delete {u.username}?</button><button className="btn text-[11px] px-2 py-0.5" onClick={() => setConfirmDelete(null)}>Keep</button></>
                              : <button className="btn text-[11px] px-2 py-0.5" onClick={() => setConfirmDelete(u.id)} title="Delete the account and its results" data-action={'delete-' + u.username}><Trash2 size={12} /></button>}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {selected && <ProgressDrawer user={users.find(u => u.id === selected.id) || selected} onClose={() => setSelected(null)} isAdmin={isAdmin} onCleared={load} />}
      <Reports isAdmin={isAdmin} />
      <div className="text-[10px] text-mute">Accounts store a username, a display name, a password hash, lesson results, and job summaries. No email, no tracking. Deleting an account deletes its results.</div>
    </div>
  );
}
