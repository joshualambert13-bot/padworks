import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

export default function BuildCheck() {
  const [rep, setRep] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { fetch('/build-check.json').then(r => r.json()).then(setRep).catch(e => setErr(String(e))); }, []);
  if (err) return <div className="p-4 text-sm text-bad">Build check not found. Run: npm run integrity</div>;
  if (!rep) return <div className="p-4 text-sm text-mute">Loading build check</div>;
  const active = rep.systems.filter(s => s.records > 0);
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          {rep.pass ? <ShieldCheck className="text-ok" /> : <ShieldAlert className="text-bad" />}
          <h1 className="text-2xl font-semibold">Build check</h1>
        </div>
        <p className="text-sm text-mute">Generated {new Date(rep.generated).toLocaleString()}. Every record that claims a 3D part is checked against the part names inside its model file or the simulator scene each time the site is built. {rep.pass ? 'All checks passed.' : rep.issues.length + ' checks failed.'}</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="card p-3"><div className="text-[10px] uppercase text-mute">Records</div><div className="mono text-2xl">{rep.totals.records}</div></div>
          <div className="card p-3"><div className="text-[10px] uppercase text-mute">With 3D model</div><div className="mono text-2xl text-ok">{rep.totals.withModel}</div></div>
          <div className="card p-3"><div className="text-[10px] uppercase text-mute">Without 3D model</div><div className="mono text-2xl text-warn">{rep.totals.withoutModel}</div></div>
        </div>
        <div className="card p-3">
          <table className="w-full text-xs">
            <thead className="text-mute text-left"><tr><th className="font-normal py-1">System</th><th className="font-normal">Records</th><th className="font-normal">With 3D</th><th className="font-normal">Without 3D</th><th className="font-normal">By status</th><th className="font-normal">By tier</th></tr></thead>
            <tbody>
              {active.map(s => (
                <tr key={s.code} className="border-t border-line/60">
                  <td className="py-1"><span className="mono">{s.code}</span> {s.name}</td>
                  <td className="mono">{s.records}</td><td className="mono text-ok">{s.withModel}</td><td className="mono text-warn">{s.withoutModel}</td>
                  <td className="mono text-mute">{Object.entries(s.byStatus).map(([k, v]) => k + ' ' + v).join(' · ')}</td>
                  <td className="mono text-mute">{Object.entries(s.byTier).map(([k, v]) => k + ' ' + v).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-3">
          <div className="text-[10px] uppercase text-mute mb-1">Model files</div>
          <table className="w-full text-xs">
            <thead className="text-mute text-left"><tr><th className="font-normal py-1">File</th><th className="font-normal">Meshes</th><th className="font-normal">Triangles</th><th className="font-normal">Materials</th><th className="font-normal">Size</th><th className="font-normal">Budget</th></tr></thead>
            <tbody>{rep.assets.map(a => <tr key={a.glb} className="border-t border-line/60"><td className="mono py-1">{a.glb}</td><td className="mono">{a.meshes}</td><td className="mono">{a.triangles.toLocaleString()}</td><td className="mono">{a.materials}</td><td className="mono">{(a.bytes / 1024).toFixed(0)} KB</td><td className={a.budgetOk ? 'text-ok' : 'text-bad'}>{a.budgetOk ? 'ok' : 'over'}</td></tr>)}</tbody>
          </table>
        </div>
        {rep.warnings && rep.warnings.length > 0 && <div className="card p-3 border-warn/60"><div className="text-xs text-warn font-medium mb-1">Warnings (model parts no record describes yet)</div><ul className="text-xs mono space-y-0.5">{rep.warnings.map((i, k) => <li key={k}>{i}</li>)}</ul></div>}
        {rep.issues.length > 0 && <div className="card p-3 border-bad/60"><div className="text-xs text-bad font-medium mb-1">Failed checks</div><ul className="text-xs mono space-y-0.5">{rep.issues.map((i, k) => <li key={k}>{i}</li>)}</ul></div>}
        <p className="text-xs text-mute">Status meanings: unreviewed draft; screened (read once by the reviewer); reviewed (every tab and source checked by the named reviewer); verified (two independent sources behind every number).</p>
      </div>
    </div>
  );
}
