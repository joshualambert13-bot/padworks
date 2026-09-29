import { Link } from 'react-router-dom';
import { Boxes } from 'lucide-react';
import { systems, systemRecords, records } from '../lib/records.js';
import SearchBox from './SearchBox.jsx';

export default function Library() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Library</h1>
          <p className="text-sm text-mute">{records.length} records across {systems.length} systems. Every record shows who has reviewed it and where its numbers come from.</p>
        </div>
        <SearchBox autoFocus />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {systems.map(s => {
            const n = systemRecords(s.code).length;
            const drawn = systemRecords(s.code).filter(r => r.drawn_in_3d).length;
            return (
              <Link key={s.code} to={'/library/' + s.code} className={'card p-3 hover:border-ok/60 transition ' + (n === 0 ? 'opacity-60' : '')}>
                <div className="flex items-center gap-2">
                  <span className="mono text-xs px-1.5 py-0.5 rounded bg-panel2 border border-line">{s.code}</span>
                  <span className="font-medium text-sm">{s.name}</span>
                </div>
                <p className="text-xs text-mute mt-2 line-clamp-3">{s.blurb}</p>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-mute">
                  <span className="flex items-center gap-1"><Boxes size={12} />{n} records</span>
                  <span>{drawn} with 3D</span>
                  <span className="ml-auto">Phase {s.phase}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
