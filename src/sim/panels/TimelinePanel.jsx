import { useMemo } from 'react';
import { CheckCircle2, Circle, Disc } from 'lucide-react';
import { useSim, PHASES, WELL } from '../store.js';

function PressureChart({ history }) {
  const W = 320, H = 150, padL = 38, padR = 30, padT = 8, padB = 18;
  const { pPath, qPath, tMin, tMax } = useMemo(() => {
    if (history.length < 2) return { pPath: '', qPath: '', tMin: 0, tMax: 1 };
    const tMin = history[0].t, tMax = history[history.length - 1].t;
    const sx = t => padL + (t - tMin) / Math.max(1, tMax - tMin) * (W - padL - padR);
    const syP = p => padT + (1 - Math.min(1, p / 15000)) * (H - padT - padB);
    const syQ = q => padT + (1 - Math.min(1, q / 100)) * (H - padT - padB);
    const pPath = history.map((h, i) => (i ? 'L' : 'M') + sx(h.t).toFixed(1) + ' ' + syP(h.p).toFixed(1)).join(' ');
    const qPath = history.map((h, i) => (i ? 'L' : 'M') + sx(h.t).toFixed(1) + ' ' + syQ(h.q).toFixed(1)).join(' ');
    return { pPath, qPath, tMin, tMax };
  }, [history]);
  const yKick = padT + (1 - WELL.maxTreatingPsi / 15000) * (H - padT - padB);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <rect x={0} y={0} width={W} height={H} fill="#0e131a" rx={6} />
      {[0, 5000, 10000, 15000].map(p => {
        const y = padT + (1 - p / 15000) * (H - padT - padB);
        return <g key={p}><line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#223042" strokeWidth={1} /><text x={padL - 4} y={y + 3} fontSize={8} fill="#8a98aa" textAnchor="end">{p / 1000}k</text></g>;
      })}
      {[0, 50, 100].map(q => {
        const y = padT + (1 - q / 100) * (H - padT - padB);
        return <text key={q} x={W - padR + 4} y={y + 3} fontSize={8} fill="#3aa7ff">{q}</text>;
      })}
      <line x1={padL} x2={W - padR} y1={yKick} y2={yKick} stroke="#ff4d4d" strokeDasharray="3 3" strokeWidth={1} />
      <path d={qPath} fill="none" stroke="#3aa7ff" strokeWidth={1.2} opacity={0.9} />
      <path d={pPath} fill="none" stroke="#35e08f" strokeWidth={1.6} />
      <text x={padL} y={H - 5} fontSize={8} fill="#8a98aa">t = {tMin.toFixed(0)} s</text>
      <text x={W - padR} y={H - 5} fontSize={8} fill="#8a98aa" textAnchor="end">{tMax.toFixed(0)} s</text>
      <text x={padL + 4} y={padT + 9} fontSize={8} fill="#35e08f">psi</text>
      <text x={W - padR - 4} y={padT + 9} fontSize={8} fill="#3aa7ff" textAnchor="end">bpm</text>
    </svg>
  );
}

export default function TimelinePanel() {
  const s = useSim();
  const phaseIdx = PHASES.findIndex(p => p.id === s.phase);
  return (
    <div className="h-full overflow-y-auto p-3 space-y-3 text-sm">
      <div className="card p-2">
        <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Completion timeline</div>
        <ol className="space-y-1">
          {PHASES.map((p, i) => (
            <li key={p.id} className={'flex items-center gap-2 text-xs ' + (i === phaseIdx ? 'text-white' : i < phaseIdx ? 'text-mute' : 'text-mute/70')}>
              {i < phaseIdx ? <CheckCircle2 size={14} className="text-ok" /> : i === phaseIdx ? <Disc size={14} className="text-warn" /> : <Circle size={14} />}
              <span>{p.label}</span>
              {(p.id === 'wireline' || p.id === 'frac') && <span className="ml-auto mono text-[10px]">x{s.stages.length}</span>}
            </li>
          ))}
        </ol>
      </div>

      <div className="card p-2">
        <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Stages (toe to heel)</div>
        <table className="w-full text-[11px] mono">
          <thead className="text-mute"><tr><th className="text-left font-normal">Stage</th><th className="font-normal">Plug</th><th className="font-normal">Perfs</th><th className="font-normal">Frac</th><th className="font-normal">Milled</th></tr></thead>
          <tbody>
            {s.stages.map(st => (
              <tr key={st.index} className={st.index === s.stage ? 'text-white' : 'text-mute'}>
                <td>{st.index + 1}{st.index === s.stage ? ' *' : ''}</td>
                <td className="text-center">{st.plugSet ? (st.plugMilled ? 'milled' : 'set') : '-'}</td>
                <td className="text-center">{st.clustersFired}/3</td>
                <td className="text-center">{st.fracComplete ? 'done' : st.fracExtent > 0 ? Math.round(st.fracExtent * 100) + '%' : '-'}</td>
                <td className="text-center">{st.plugMilled ? 'yes' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-2">
        <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Surface treating pressure and slurry rate vs time</div>
        <PressureChart history={s.history} />
        <div className="text-[10px] text-mute mt-1">Dashed red: pump kickout. Green: psi. Blue: bpm. Rolling 5 minutes of simulation time.</div>
      </div>

      <div className="card p-2">
        <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Event log</div>
        <ul className="space-y-0.5 max-h-56 overflow-y-auto">
          {s.log.map((l, i) => <li key={i} className="text-[11px]"><span className="mono text-mute">{l.t.toFixed(0)}s</span> {l.msg}</li>)}
          {s.log.length === 0 && <li className="text-[11px] text-mute">No events yet. Pick a phase to begin.</li>}
        </ul>
      </div>
    </div>
  );
}
