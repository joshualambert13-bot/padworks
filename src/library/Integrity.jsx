import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

export default function Integrity() {
  const [rep, setRep] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { fetch('/integrity.json').then(r => r.json()).then(setRep).catch(e => setErr(String(e))); }, []);
  if (err) return <div className="p-4 text-sm text-bad">Integrity report not found. Run: npm run integrity</div>;
  if (!rep) return <div className="p-4 text-sm text-mute">Loading integrity report</div>;
  const active = rep.systems.filter(s => s.records > 0);
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          {rep.pass ? <ShieldCheck className="text-ok" /> : <ShieldAlert className="text-bad" />}
          <h1 className="text-2xl font-semibold">Integrity report</h1>
        </div>
        <p className="text-sm text-mute">Generated {new Date(rep.generated).toLocaleString()}. Every record that claims geometry is checked against the node names inside its GLB or the simulator scene at build time. {rep.pass ? 'No integrity issues.' : rep.issues.length + ' issues.'}</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="card p-3"><div className="text-[10px] uppercase text-mute">Records</div><div className="mono text-2xl">{rep.totals.records}</div></div>
          <div className="card p-3"><div className="text-[10px] uppercase text-mute">Bound to geometry</div><div className="mono text-2xl text-ok">{rep.totals.bound}</div></div>
          <div className="card p-3"><div className="text-[10px] uppercase text-mute">Unbound</div><div className="mono text-2xl text-warn">{rep.totals.unbound}</div></div>
        </div>
        <div className="card p-3">
          <table className="w-full text-xs">
            <thead className="text-mute text-left"><tr><th className="font-normal py-1">System</th><th className="font-normal">Records</th><th className="font-normal">Bound</th><th className="font-normal">Unbound</th><th className="font-normal">By status</th><th className="font-normal">By tier</th></tr></thead>
            <tbody>
              {active.map(s => (
                <tr key={s.code} className="border-t border-line/60">
                  <td className="py-1"><span className="mono">{s.code}</span> {s.name}</td>
                  <td className="mono">{s.records}</td><td className="mono text-ok">{s.bound}</td><td className="mono text-warn">{s.unbound}</td>
                  <td className="mono text-mute">{Object.entries(s.byStatus).map(([k, v]) => k + ' ' + v).join(' · ')}</td>
                  <td className="mono text-mute">{Object.entries(s.byTier).map(([k, v]) => k + ' ' + v).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-3">
          <div className="text-[10px] uppercase text-mute mb-1">Assets</div>
          <table className="w-full text-xs">
            <thead className="text-mute text-left"><tr><th className="font-normal py-1">GLB</th><th className="font-normal">Meshes</th><th className="font-normal">Triangles</th><th className="font-normal">Materials</th><th className="font-normal">Size</th><th className="font-normal">Budget</th></tr></thead>
            <tbody>{rep.assets.map(a => <tr key={a.glb} className="border-t border-line/60"><td className="mono py-1">{a.glb}</td><td className="mono">{a.meshes}</td><td className="mono">{a.triangles.toLocaleString()}</td><td className="mono">{a.materials}</td><td className="mono">{(a.bytes / 1024).toFixed(0)} KB</td><td className={a.budgetOk ? 'text-ok' : 'text-bad'}>{a.budgetOk ? 'ok' : 'over'}</td></tr>)}</tbody>
          </table>
        </div>
        {rep.warnings && rep.warnings.length > 0 && <div className="card p-3 border-warn/60"><div className="text-xs text-warn font-medium mb-1">Warnings (unclaimed geometry nodes)</div><ul className="text-xs mono space-y-0.5">{rep.warnings.map((i, k) => <li key={k}>{i}</li>)}</ul></div>}
        {rep.issues.length > 0 && <div className="card p-3 border-bad/60"><div className="text-xs text-bad font-medium mb-1">Issues</div><ul className="text-xs mono space-y-0.5">{rep.issues.map((i, k) => <li key={k}>{i}</li>)}</ul></div>}
        <p className="text-xs text-mute">Status meanings: draft is AI-drafted and unreviewed; proposed has been read once; reviewed has every tab and citation checked by a named reviewer; verified has two independent sources per numeric value.</p>
      </div>
    </div>
  );
}
