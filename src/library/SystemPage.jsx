import { Link, useParams, Navigate } from 'react-router-dom';
import { systems, systemRecord, groupsOf, STATUS_LABEL } from '../lib/records.js';
import SearchBox from './SearchBox.jsx';

export default function SystemPage() {
  const { system } = useParams();
  const meta = systems.find(s => s.code === system);
  if (!meta) return <Navigate to="/library" replace />;
  const rec = systemRecord(system);
  const groups = groupsOf(system);
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <div className="text-xs text-mute"><Link to="/library" className="hover:text-white">Library</Link> / {meta.code}</div>
        <h1 className="text-2xl font-semibold">{meta.name}</h1>
        {rec ? <p className="text-sm text-mute max-w-3xl">{rec.function}</p> : <p className="text-sm text-mute">No records yet. Planned for Phase {meta.phase}.</p>}
        {rec && <Link to={'/library/equipment/' + rec.id} className="btn inline-block">System record</Link>}
        <SearchBox />
        {[...groups.entries()].map(([g, list]) => (
          <div key={g}>
            <h2 className="text-sm uppercase tracking-wide text-mute mt-4 mb-2">{g.replace(/-/g, ' ')}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map(r => (
                <Link key={r.id} to={'/library/equipment/' + r.id} className="card p-3 hover:border-ok/60 transition">
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="mono text-[11px] text-mute">{r.id} · {r.level}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className={'badge ' + STATUS_LABEL[r.status].cls}>{r.status}</span>
                    <span className="badge text-mute">{r.evidence_tier}</span>
                    {r.drawn_in_3d && <span className="badge text-cool border-cool/60">3D</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
