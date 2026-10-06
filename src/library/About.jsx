import { glossary, hazards } from '../lib/records.js';
import { Link } from 'react-router-dom';
import credits from '../../content/credits.json';

export default function About() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 space-y-6 text-sm leading-relaxed">
        <div>
          <h1 className="text-2xl font-semibold">About Padworks</h1>
          <p className="text-mute text-xs mt-1">Padworks: an O&amp;G completions simulator and equipment library.</p>
          <p className="text-mute mt-2">An interactive equipment library and stage-cycle simulator for oil and gas well completions, built for training friends and family who are new to the industry. Every model is generic geometry built from public dimensions, every record shows who reviewed it and where its numbers come from, and the simulator uses schematic motion with an illustrative pressure model. Nothing here is a design value or an operating procedure.</p>
          <p className="text-mute mt-2">This site was written, modeled, and coded independently from public sources and the author's own field experience. It is not affiliated with, endorsed by, or derived from any equipment manufacturer, service company, standards body, or other training site.</p>
        </div>
        <div>
          <h2 className="font-semibold">How to read a record</h2>
          <p className="text-mute">Status: unreviewed draft, screened (read once by the reviewer), reviewed (every tab and source checked), verified (two independent sources behind every number). Source tiers: E1 from a standard, E2 from a manufacturer's public document, E3 from the reviewer's field experience, E4 an estimate not yet confirmed. Manufacturer names appear only as labeled examples and are never baseline values.</p>
        </div>
        <div>
          <h2 className="font-semibold">Glossary</h2>
          <ul className="mt-2 space-y-1">
            {glossary.map(g => (
              <li key={g.term}><span className="font-medium">{g.term}</span>{g.aliases && g.aliases.length ? <span className="text-mute"> ({g.aliases.join(', ')})</span> : null}: <span className="text-mute">{g.definition}</span> {g.record && <Link to={'/library/equipment/' + g.record} className="text-accent mono text-xs">{g.record}</Link>}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-semibold">Hazard classes used in the Hazards tabs</h2>
          <ul className="mt-2 space-y-1">{hazards.map(h => <li key={h.class}><span className="font-medium">{h.class}</span>: <span className="text-mute">{h.description} Control: {h.control}</span></li>)}</ul>
        </div>
        <div data-section="credits">
          <h2 className="font-semibold">Credits</h2>
          <p className="text-mute mt-1">Everything on the pad is drawn in code except the items below, which come from free libraries under the license shown. Photographic textures and skies are CC0 from Poly Haven and ambientCG (no attribution required). The crew are Mixamo characters and animations (Adobe), used under the Mixamo terms. The narration voice is rendered with Piper text-to-speech (MIT) from the LibriTTS English model, trained on the LibriTTS corpus (CC BY 4.0, Zen et al., Google), speaker 1027. Models attributed under CC-BY-4.0 are used unmodified apart from scaling and texture size.</p>
          <ul className="mt-2 space-y-0.5 text-xs">{credits.map(c => <li key={c.id}><span className="font-medium">{c.title}</span> by <a className="text-accent" href={c.authorUrl || c.source} target="_blank" rel="noreferrer">{c.author}</a> via <a className="text-accent" href={c.source} target="_blank" rel="noreferrer">{c.via}</a>, {c.license === 'CC0' ? 'CC0' : <a className="text-accent" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">{c.license}</a>}</li>)}</ul>
        </div>
        <div>
          <h2 className="font-semibold">Terms</h2>
          <p className="text-mute">Built for training. No warranty of accuracy. Not for operational decisions. Accounts are created by an administrator and hold a username, a display name, a password hash, and training results; the only cookie is the session; no analytics. Code MIT licensed; content and models CC BY-NC-SA 4.0 unless stated otherwise. Corrections: use the "Report an error" link on any record.</p>
        </div>
      </div>
    </div>
  );
}
