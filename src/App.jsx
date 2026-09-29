import { lazy, Suspense } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Library as LibraryIcon, Activity, ShieldCheck, Info } from 'lucide-react';
const Simulator = lazy(() => import('./sim/Simulator.jsx'));
import Library from './library/Library.jsx';
import SystemPage from './library/SystemPage.jsx';
const RecordPage = lazy(() => import('./library/RecordPage.jsx'));
import BuildCheck from './library/BuildCheck.jsx';
import About from './library/About.jsx';
import { SITE_TAGLINE } from './config.js';

const navClass = ({ isActive }) =>
  'flex items-center gap-1.5 px-3 py-2 text-sm rounded-md ' + (isActive ? 'bg-panel2 text-white' : 'text-mute hover:text-white');

export default function App() {
  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 h-12 flex items-center gap-2 px-3 border-b border-line bg-panel">
        <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight text-white mr-2">
          <img src="/brand/mark.svg" alt="" className="h-7 w-7" />
          <span>Pad<span className="text-accent">works</span></span>
          <span className="hidden lg:inline text-xs font-normal text-mute tracking-normal">{SITE_TAGLINE}</span>
        </NavLink>
        <nav className="flex items-center gap-1">
          <NavLink to="/library" className={navClass}><LibraryIcon size={16} /> <span className="hidden sm:inline">Library</span></NavLink>
          <NavLink to="/simulate" className={navClass}><Activity size={16} /> <span className="hidden sm:inline">Simulator</span></NavLink>
          <NavLink to="/checks" className={navClass}><ShieldCheck size={16} /> <span className="hidden sm:inline">Build check</span></NavLink>
          <NavLink to="/about" className={navClass}><Info size={16} /> <span className="hidden sm:inline">About</span></NavLink>
        </nav>
        <span className="ml-auto badge text-mute hidden md:inline">Built for training. Not for operational decisions.</span>
      </header>
      <main className="flex-1 min-h-0">
        <Suspense fallback={<div className="p-4 text-sm text-mute">Loading</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/simulate" replace />} />
          <Route path="/simulate" element={<Simulator />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:system" element={<SystemPage />} />
          <Route path="/library/equipment/:id" element={<RecordPage />} />
          <Route path="/checks" element={<BuildCheck />} />
          <Route path="/integrity" element={<Navigate to="/checks" replace />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Navigate to="/simulate" replace />} />
        </Routes>
        </Suspense>
      </main>
    </div>
  );
}
