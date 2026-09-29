import { glossary, hazards } from '../lib/records.js';
import { Link } from 'react-router-dom';

export default function About() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 space-y-6 text-sm leading-relaxed">
        <div>
          <h1 className="text-2xl font-semibold">About Completions Explorer</h1>
          <p className="text-mute mt-2">An interactive reference and simulator for oil and gas well completions, built for training. Equipment is drawn from public dimensions as generic geometry, every record shows its review status and evidence tier, and the simulator uses an illustrative response model with simplified motion. Nothing here is a design value or an operating procedure.</p>
        </div>
        <div>
          <h2 className="font-semibold">How to read a record</h2>
          <p className="text-mute">Status: draft (AI-drafted, unreviewed), proposed (read once), reviewed (every tab and citation checked by the named reviewer), verified (two sources per numeric value). Evidence tier: E1 standard-based, E2 OEM-published example, E3 named field practice, E4 disclosed approximation. OEM names appear only as labeled examples and are never baseline values.</p>
        </div>
        <div>
          <h2 className="font-semibold">Glossary</h2>
          <ul className="mt-2 space-y-1">
            {glossary.map(g => (
              <li key={g.term}><span className="font-medium">{g.term}</span>{g.aliases && g.aliases.length ? <span className="text-mute"> ({g.aliases.join(', ')})</span> : null}: <span className="text-mute">{g.definition}</span> {g.record && <Link to={'/library/equipment/' + g.record} className="text-ok mono text-xs">{g.record}</Link>}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-semibold">Hazard classes used in the safety tabs</h2>
          <ul className="mt-2 space-y-1">{hazards.map(h => <li key={h.class}><span className="font-medium">{h.class}</span>: <span className="text-mute">{h.description} Control: {h.control}</span></li>)}</ul>
        </div>
        <div>
          <h2 className="font-semibold">Terms</h2>
          <p className="text-mute">Training and reference only. No warranty of accuracy. Not for operational decisions. No accounts, no cookies, no personal data collected. Code MIT licensed; content and geometry CC BY-NC-SA 4.0 unless stated otherwise. Corrections: use the "Report an error" link on any record.</p>
        </div>
      </div>
    </div>
  );
}
