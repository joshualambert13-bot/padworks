import { useState, useMemo } from 'react';
import { Link, useParams, Navigate, useLocation } from 'react-router-dom';
import { Bug, ExternalLink, ArrowLeft } from 'lucide-react';
import { byId, childrenOf, sourceById, STATUS_LABEL, TIER_LABEL, systems } from '../lib/records.js';
import Viewer from './Viewer.jsx';
import { GITHUB_REPO } from '../config.js';

const TABS = [
  ['overview', 'Purpose'], ['engineering', 'Design'], ['connections', 'Interfaces'], ['safety', 'Hazards'],
  ['specs', 'Numbers'], ['evidence', 'Sources'], ['operations', 'Job sequence'], ['failure_modes', 'Failure modes'],
];

function Para({ text }) {
  if (!text) return <p className="text-sm text-mute">Not yet drafted.</p>;
  return text.split(/\n\n+/).map((p, i) => <p key={i} className="text-sm leading-relaxed mb-3">{p}</p>);
}

export default function RecordPage() {
  const { id } = useParams();
  const location = useLocation();
  const fromSim = location.state && location.state.from === 'sim';
  const r = byId.get(id);
  const [tab, setTab] = useState('overview');
  const kids = useMemo(() => (r ? childrenOf(r.id) : []), [r]);
  if (!r) return <Navigate to="/library" replace />;
  const sys = systems.find(s => s.code === r.system);
  const parent = r.parent ? byId.get(r.parent) : null;
  const glbOwner = r.glb ? r : (parent && parent.glb ? parent : null);
  const variants = glbOwner && glbOwner.variants && glbOwner.variants.length ? glbOwner.variants : null;
  const [variantKey, setVariantKey] = useState(() => { try { return localStorage.getItem('padworks.variant') || ''; } catch { return ''; } });
  const variant = variants ? (variants.find(v => v.key === variantKey) || variants.find(v => v.glb === glbOwner.glb) || variants[0]) : null;
  const glb = variant ? variant.glb : (glbOwner ? glbOwner.glb : null);
  const ghost = (glbOwner && glbOwner.ghost_nodes) || [];
  const pickVariant = (k) => { setVariantKey(k); try { localStorage.setItem('padworks.variant', k); } catch { /* per-viewer convenience only */ } };
  // highlight the record's own parts when it is a component, a part, or an equipment record drawn inside its parent's file
  const sameFileAsParent = !!(r.glb && parent && parent.glb === r.glb);
  const highlight = ((r.level === 'component' || r.level === 'part') || sameFileAsParent) && r.mesh_nodes && r.mesh_nodes.length ? r.mesh_nodes : [];
  const status = STATUS_LABEL[r.status];
  const issueUrl = 'https://github.com/' + GITHUB_REPO + '/issues/new?title=' + encodeURIComponent('[' + r.id + '] correction') + '&body=' + encodeURIComponent('Record: ' + r.id + '\nTab: \nWhat is wrong: \nSource: ');

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {fromSim && (
          <Link to="/simulate" className="btn inline-flex items-center gap-1 text-xs"><ArrowLeft size={14} />Back to the pad simulation (it is where you left it)</Link>
        )}
        <div className="text-xs text-mute flex flex-wrap gap-1">
          <Link to="/library" className="hover:text-white">Library</Link><span>/</span>
          <Link to={'/library/' + r.system} className="hover:text-white">{sys ? sys.code : r.system}</Link>
          {parent && parent.level !== 'system' && <><span>/</span><Link to={'/library/equipment/' + parent.id} className="hover:text-white">{parent.name}</Link></>}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold leading-tight">{r.name}</h1>
            <div className="mono text-xs text-mute mt-1">{r.id} · {r.level}{r.group ? ' · ' + r.group.replace(/-/g, ' ') : ''}</div>
            {r.aliases && r.aliases.length > 0 && <div className="text-xs text-mute mt-1">Also called: {r.aliases.join(', ')}</div>}
          </div>
          <div className="flex flex-row flex-wrap sm:flex-col sm:items-end gap-1">
            <span className={'badge ' + status.cls}>{status.text}</span>
            <span className="badge text-mute">{r.evidence_tier}: {TIER_LABEL[r.evidence_tier]}</span>
            {r.drawn_in_3d ? <span className="badge text-cool border-cool/60">{r.glb ? '3D model' : '3D in the simulator'}</span> : <span className="badge text-mute">No 3D model yet</span>}
          </div>
        </div>
        <p className="text-sm text-mute max-w-3xl">{r.function}</p>

        {glb && (
          <div className="card overflow-hidden relative" style={{ height: 460 }}>
            <Viewer url={glb} highlight={highlight} ghost={ghost} />
            {variants && (
              <div className="absolute bottom-2 right-2 md:right-[228px] flex items-center gap-1 text-xs">
                <span className="text-mute">Size</span>
                <select className="btn" value={variant.key} onChange={e => pickVariant(e.target.value)} title="Bore and pressure rating">
                  {variants.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
        {!glb && r.scene && (
          <div className="card p-3 text-xs text-mute">This item appears in the <Link to="/simulate" className="text-accent">simulator</Link> scene as <span className="mono">{r.scene}</span>. A stand-alone model follows in a later drop.</div>
        )}

        <div className="card">
          <div className="flex overflow-x-auto border-b border-line">
            {TABS.map(([k, label]) => (
              <button key={k} className={'px-3 py-2 text-xs whitespace-nowrap ' + (tab === k ? 'tab-active' : 'text-mute hover:text-white')} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
          <div className="p-4">
            {tab === 'specs' ? (
              <div>
                <Para text={r.tabs.specs} />
                {r.specs && r.specs.length > 0 && (
                  <table className="w-full text-xs mt-2">
                    <thead className="text-mute text-left"><tr><th className="font-normal py-1">Spec</th><th className="font-normal">Value</th><th className="font-normal">SI</th><th className="font-normal">Tier</th><th className="font-normal">Source</th></tr></thead>
                    <tbody>
                      {r.specs.map((s, i) => (
                        <tr key={i} className="border-t border-line/60">
                          <td className="py-1 pr-2">{s.name}</td>
                          <td className="mono">{s.value} {s.unit}</td>
                          <td className="mono text-mute">{s.si_value != null ? s.si_value + ' ' + (s.si_unit || '') : ''}</td>
                          <td><span className="badge text-mute">{s.tier}</span></td>
                          <td className="mono text-mute">{s.source || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : tab === 'evidence' ? (
              <div className="space-y-3">
                <Para text={r.tabs.evidence} />
                {r.standards && r.standards.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Standards referenced (paraphrased; check the edition you hold)</div>
                    <ul className="space-y-1 text-xs">{r.standards.map((s, i) => <li key={i}><span className="font-medium">{s.standard}</span>{s.clause ? ', ' + s.clause : ''}{s.edition ? ' (' + s.edition + ')' : ''}: {s.paraphrase} <span className="mono text-mute">{s.source}</span></li>)}</ul>
                  </div>
                )}
                {r.oem_examples && r.oem_examples.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Manufacturer examples (illustrative, not baseline values)</div>
                    <ul className="space-y-1 text-xs">{r.oem_examples.map((o, i) => <li key={i}>{o.oem} {o.model}{o.figure ? ', ' + o.figure : ''} <span className="mono text-mute">{o.source}</span></li>)}</ul>
                  </div>
                )}
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Sources</div>
                  <ul className="space-y-1 text-xs">
                    {(r.sources || []).map(sid => { const s = sourceById.get(sid); return s ? (
                      <li key={sid}><span className="mono text-mute">{sid}</span> {s.title}, {s.publisher}, {s.edition}. <span className="badge text-mute">{s.tier}</span> {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-cool inline-flex items-center gap-0.5">link<ExternalLink size={10} /></a>}</li>
                    ) : <li key={sid} className="text-bad">{sid} missing from register</li>; })}
                  </ul>
                </div>
                {r.reviewers && r.reviewers.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Reviewers</div>
                    <ul className="text-xs">{r.reviewers.map((v, i) => <li key={i}>{v.name}{v.affiliation ? ', ' + v.affiliation : ''}, {v.date}{v.scope ? ': ' + v.scope : ''}</li>)}</ul>
                  </div>
                )}
                <div className="text-[11px] text-mute">Revision {r.revision.rev}, {r.revision.author}, {r.revision.date}{r.revision.note ? ': ' + r.revision.note : ''}</div>
              </div>
            ) : tab === 'connections' ? (
              <div>
                <Para text={r.tabs.connections} />
                {r.connections && r.connections.length > 0 && (
                  <ul className="text-xs space-y-1 mt-2">
                    {r.connections.map((c, i) => (
                      <li key={i} className="flex flex-wrap gap-2 items-center">
                        <span className="badge text-mute">{c.direction}</span>
                        {byId.has(c.target) ? <Link to={(byId.get(c.target).level === 'system' ? '/library/' : '/library/equipment/') + c.target} className="text-accent mono">{c.target}</Link> : <span className="mono">{c.target}</span>}
                        <span className="text-mute">{c.type}{c.rating ? ', ' + c.rating : ''}{c.note ? ': ' + c.note : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : tab === 'safety' ? (
              <div>
                <Para text={r.tabs.safety} />
                {r.hazards && r.hazards.length > 0 && (
                  <table className="w-full text-xs mt-2">
                    <thead className="text-mute text-left"><tr><th className="font-normal py-1">Hazard</th><th className="font-normal">Control</th></tr></thead>
                    <tbody>{r.hazards.map((h, i) => <tr key={i} className="border-t border-line/60"><td className="py-1 pr-3 whitespace-nowrap">{h.class}</td><td>{h.control}</td></tr>)}</tbody>
                  </table>
                )}
              </div>
            ) : (
              <Para text={r.tabs[tab]} />
            )}
          </div>
        </div>

        {kids.length > 0 && (
          <div>
            <h2 className="text-sm uppercase tracking-wide text-mute mb-2">Components</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {kids.map(k => (
                <Link key={k.id} to={'/library/equipment/' + k.id} className="card p-3 hover:border-ok/60 transition">
                  <div className="text-sm font-medium">{k.name}</div>
                  <div className="mono text-[11px] text-mute">{k.id}</div>
                  <div className="mt-2 flex gap-1"><span className={'badge ' + STATUS_LABEL[k.status].cls}>{k.status}</span><span className="badge text-mute">{k.evidence_tier}</span></div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-mute">
          <a href={issueUrl} target="_blank" rel="noreferrer" className="btn inline-flex items-center gap-1"><Bug size={14} />Report an error in this record</a>
          <span>Built for training. Not for operational decisions.</span>
        </div>
      </div>
    </div>
  );
}
