import { lazy, Suspense } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Library as LibraryIcon, Activity, ShieldCheck, Info } from 'lucide-react';
const Simulator = lazy(() => import('./sim/Simulator.jsx'));
import Library from './library/Library.jsx';
import SystemPage from './library/SystemPage.jsx';
const RecordPage = lazy(() => import('./library/RecordPage.jsx'));
import Integrity from './library/Integrity.jsx';
import About from './library/About.jsx';

const navClass = ({ isActive }) =>
  'flex items-center gap-1.5 px-3 py-2 text-sm rounded-md ' + (isActive ? 'bg-panel2 text-white' : 'text-mute hover:text-white');

export default function App() {
  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 h-12 flex items-center gap-2 px-3 border-b border-line bg-panel">
        <NavLink to="/" className="font-semibold tracking-tight text-white mr-2">
          Completions<span className="text-ok">Explorer</span>
        </NavLink>
        <nav className="flex items-center gap-1">
          <NavLink to="/library" className={navClass}><LibraryIcon size={16} /> <span className="hidden sm:inline">Library</span></NavLink>
          <NavLink to="/simulate" className={navClass}><Activity size={16} /> <span className="hidden sm:inline">Simulator</span></NavLink>
          <NavLink to="/integrity" className={navClass}><ShieldCheck size={16} /> <span className="hidden sm:inline">Integrity</span></NavLink>
          <NavLink to="/about" className={navClass}><Info size={16} /> <span className="hidden sm:inline">About</span></NavLink>
        </nav>
        <span className="ml-auto badge text-mute hidden md:inline">Training and reference only</span>
      </header>
      <main className="flex-1 min-h-0">
        <Suspense fallback={<div className="p-4 text-sm text-mute">Loading</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/simulate" replace />} />
          <Route path="/simulate" element={<Simulator />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:system" element={<SystemPage />} />
          <Route path="/library/equipment/:id" element={<RecordPage />} />
          <Route path="/integrity" element={<Integrity />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Navigate to="/simulate" replace />} />
        </Routes>
        </Suspense>
      </main>
    </div>
  );
}
