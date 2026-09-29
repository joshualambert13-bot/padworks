import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { search } from '../lib/search.js';

export default function SearchBox({ autoFocus = false }) {
  const [q, setQ] = useState('');
  const hits = search(q);
  return (
    <div className="relative">
      <div className="flex items-center gap-2 card px-2">
        <Search size={16} className="text-mute" />
        <input autoFocus={autoFocus} value={q} onChange={e => setQ(e.target.value)} placeholder='Search by name, slang, or ID: "goat head", "zipper", "tree saver", WH-GATEVALVE' className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-mute/70" />
      </div>
      {hits.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 card divide-y divide-line max-h-80 overflow-y-auto">
          {hits.map(h => (
            <li key={h.id}>
              <Link to={h.level === 'system' ? '/library/' + h.id : '/library/equipment/' + h.id} className="block px-3 py-2 hover:bg-panel2" onClick={() => setQ('')}>
                <div className="text-sm">{h.name}</div>
                <div className="text-[11px] mono text-mute">{h.id} · {h.level}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
