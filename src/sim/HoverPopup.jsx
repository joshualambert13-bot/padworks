// The HTML popup that follows the hovered (or tapped) asset and links to its library record.
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { byId, systems } from '../lib/records.js';
import { useHover } from './hover.js';

export default function HoverPopup({ canvasKey }) {
  const { id, x, y, pinned, canvas } = useHover();
  const navigate = useNavigate();
  if (!id || canvas !== canvasKey) return null;
  const r = byId.get(id);
  if (!r) return null;
  const sys = systems.find(s => s.code === r.system);
  const go = () => { useHover.getState().unpin(); document.body.style.cursor = 'auto'; navigate((r.level === 'system' ? '/library/' : '/library/equipment/') + r.id, { state: { from: 'sim' } }); };
  return (
    <div data-hover-popup className="absolute z-30 pointer-events-auto" style={{ left: Math.min(x + 14, 9999), top: y + 14 }}
      onMouseEnter={() => useHover.setState({ pinned: true })} onMouseLeave={() => useHover.getState().unpin()}>
      <button onClick={go} className="card px-2.5 py-1.5 text-left shadow-lg border-accent/60 hover:bg-panel2 max-w-[260px]">
        <div className="text-xs font-semibold leading-tight">{r.name}</div>
        <div className="mono text-[10px] text-mute">{r.id}{sys ? ' · ' + sys.name : ''}</div>
        <div className="text-[10px] text-accent flex items-center gap-1 mt-0.5">Open in the library <ExternalLink size={10} />{pinned ? '' : ' (click)'}</div>
      </button>
    </div>
  );
}
