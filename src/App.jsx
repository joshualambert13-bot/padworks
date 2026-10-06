import { lazy, Suspense } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Library as LibraryIcon, Activity, ShieldCheck, Info, Users, GraduationCap } from 'lucide-react';
const Simulator = lazy(() => import('./sim/Simulator.jsx'));
import Library from './library/Library.jsx';
import Landing from './Landing.jsx';
import LessonsPage from './lessons/LessonsPage.jsx';
import SystemPage from './library/SystemPage.jsx';
const RecordPage = lazy(() => import('./library/RecordPage.jsx'));
const AdminPage = lazy(() => import('./admin/AdminPage.jsx'));
import BuildCheck from './library/BuildCheck.jsx';
import About from './library/About.jsx';
import Preview from './library/Preview.jsx';
import RequireAuth from './auth/RequireAuth.jsx';
import UserMenu from './auth/UserMenu.jsx';
import ChangePassword from './auth/ChangePassword.jsx';
import { useAuth, canSeeAdmin, effectiveRole, ROLE_LABEL } from './auth/auth.js';
import { useTheme } from './theme/theme.js';
import { useSim } from './sim/store.js';

const navClass = ({ isActive }) =>
  'flex items-center gap-1.5 px-3 py-2 text-sm rounded-md ' + (isActive ? 'bg-panel2 text-white' : 'text-mute hover:text-white');

export default function App() {
  const user = useAuth(s => s.user);
  const viewAs = useAuth(s => s.viewAs);
  const setViewAs = useAuth(s => s.setViewAs);
  const role = effectiveRole(user, viewAs);
  const masked = !!user && user.role === 'admin' && !!viewAs;
  const full = useSim(s => s.ui.full);   // simulator full screen (Drop 62): the header goes too
  const site = useTheme(s => s.theme.site);   // the customer's name, tagline and logo (Drop 81)
  return (
    <RequireAuth>
    <div className="h-full flex flex-col">
      {masked && <div className="shrink-0 flex items-center gap-2 px-3 py-1 text-xs bg-warn/15 border-b border-warn/50 text-warn" data-status="view-as">Viewing the site as a {ROLE_LABEL[viewAs].toLowerCase()} would see it. Your admin rights are unchanged.<button className="btn ml-auto text-[11px] px-2 py-0.5" onClick={() => setViewAs(null)} data-action="view-as-off">Back to admin view</button></div>}
      {!full && <header className="shrink-0 h-12 flex items-center gap-2 px-3 border-b border-line bg-panel">
        <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight text-white mr-2">
          <img src={site.logo || '/brand/mark.svg'} alt="" className="h-7 w-7 object-contain" />
          <span className="hidden min-[440px]:inline" data-site-name>{site.name === 'Padworks' ? <>Pad<span className="text-accent">works</span></> : site.name}</span>
          <span className="hidden lg:inline text-xs font-normal text-mute tracking-normal">{site.tagline}</span>
        </NavLink>
        <nav className="flex items-center gap-1">
          <NavLink to="/lessons" className={navClass}><GraduationCap size={16} /> <span className="hidden sm:inline">Lessons</span></NavLink>
          <NavLink to="/simulate" className={navClass}><Activity size={16} /> <span className="hidden sm:inline">Simulator</span></NavLink>
          <NavLink to="/library" className={navClass}><LibraryIcon size={16} /> <span className="hidden sm:inline">Library</span></NavLink>
          <NavLink to="/checks" className={navClass}><ShieldCheck size={16} /> <span className="hidden sm:inline">Build check</span></NavLink>
          <NavLink to="/about" className={navClass}><Info size={16} /> <span className="hidden sm:inline">About</span></NavLink>
          {canSeeAdmin(user, viewAs) && <NavLink to="/admin" className={navClass} data-nav="admin"><Users size={16} /> <span className="hidden sm:inline">{role === 'admin' ? 'Accounts' : 'Progress'}</span></NavLink>}
        </nav>
        <span className="ml-auto badge text-mute hidden xl:inline">Built for training. Not for operational decisions.</span>
        <UserMenu />
      </header>}
      <main className="flex-1 min-h-0">
        <Suspense fallback={<div className="p-4 text-sm text-mute">Loading</div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/lessons" element={<LessonsPage />} />
          <Route path="/simulate" element={<Simulator />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:system" element={<SystemPage />} />
          <Route path="/library/equipment/:id" element={<RecordPage />} />
          <Route path="/checks" element={<BuildCheck />} />
          <Route path="/integrity" element={<Navigate to="/checks" replace />} />
          <Route path="/about" element={<About />} />
          <Route path="/preview" element={<Preview />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/account" element={<ChangePassword />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </main>
    </div>
    </RequireAuth>
  );
}
