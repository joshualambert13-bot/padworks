// Theme panel (Drop 81), on the admin page: pick a theme, load a customer's theme from JSON, export the current one,
// and copy a pitch link that opens the site in that theme. The colors are documented in theme.js; a customer file
// is the same shape with their values (and their logo as an SVG or PNG data URL in site.logo).
import { useState } from 'react';
import { Palette, Upload, Download, Link2, Trash2, Check } from 'lucide-react';
import { useTheme, BUILTIN } from './theme.js';

const Swatch = ({ c, label }) => <span className="inline-flex items-center gap-1 text-[11px] text-mute" title={label}><span className="inline-block w-3.5 h-3.5 rounded border border-line" style={{ background: c }} />{label}</span>;

export default function ThemePanel() {
  const theme = useTheme(s => s.theme), custom = useTheme(s => s.custom), setTheme = useTheme(s => s.setTheme), addCustom = useTheme(s => s.addCustom), removeCustom = useTheme(s => s.removeCustom);
  const [json, setJson] = useState(''); const [msg, setMsg] = useState(''); const [copied, setCopied] = useState(false);
  const all = [...BUILTIN, ...custom];
  const load = () => {
    try { const t = addCustom(JSON.parse(json)); setMsg('Loaded and applied: ' + t.name); setJson(''); }
    catch (e) { setMsg('Not a theme file: ' + e.message); }
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'padworks-theme-' + theme.id + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const link = () => {
    const url = window.location.origin + '/simulate?theme=' + theme.id;
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link', url)); else window.prompt('Copy this link', url);
  };
  const onFile = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setJson(String(r.result)); r.readAsText(f); };
  return (
    <div className="card p-3 space-y-2" data-panel="theme">
      <div className="flex items-center gap-2"><Palette size={14} className="text-accent" /><span className="text-white font-semibold text-sm">Theme</span><span className="text-[11px] text-mute">the pad, the crew and the site in a customer's colors; a change repaints the pad in a few seconds</span></div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="text-xs bg-panel2 border border-line rounded px-2 py-1" value={theme.id} onChange={e => setTheme(e.target.value)} data-select="theme">
          {all.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button className="btn text-xs flex items-center gap-1" onClick={exportJson} data-action="theme-export"><Download size={12} />Export JSON</button>
        <button className="btn text-xs flex items-center gap-1" onClick={link} data-action="theme-link">{copied ? <Check size={12} /> : <Link2 size={12} />}{copied ? 'Copied' : 'Pitch link'}</button>
        {custom.some(c => c.id === theme.id) && <button className="btn btn-danger text-xs flex items-center gap-1" onClick={() => removeCustom(theme.id)} data-action="theme-remove"><Trash2 size={12} />Remove</button>}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="text-mute">Fleet <span className="text-white">{theme.fleet.name}</span></span><Swatch c={theme.fleet.primary} label="primary" /><Swatch c={theme.fleet.secondary} label="secondary" />
        <span className="text-mute">Wellhead <span className="text-white">{theme.wellhead.name}</span></span><Swatch c={theme.wellhead.primary} label="trees and zipper" /><Swatch c={theme.wellhead.accent} label="accent" />
        <span className="text-mute">Operator <span className="text-white">{theme.operator.name}</span></span><Swatch c={theme.operator.primary} label="pickups" /><Swatch c={theme.operator.ppe} label="vests" /><Swatch c={theme.operator.hat} label="hard hats" />
        <span className="text-mute">Site <span className="text-white">{theme.site.name}</span></span><Swatch c={theme.site.accent} label="accent" />
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-mute">Load a customer theme (JSON)</summary>
        <div className="mt-2 space-y-2">
          <div className="text-[11px] text-mute">Export the current theme to see the shape, edit the names, colors and logo (an SVG or PNG as a data URL in site.logo), then paste it here or pick the file. It applies at once and is kept in this browser; the pitch link opens the site in it.</div>
          <input type="file" accept="application/json,.json" onChange={onFile} className="text-xs" />
          <textarea className="w-full h-28 text-[11px] mono bg-panel2 border border-line rounded p-2" value={json} onChange={e => setJson(e.target.value)} placeholder='{ "id": "acme", "name": "Acme Energy", "site": { "name": "Acme Padworks", "accent": "#0a84ff" }, "fleet": { "name": "Acme Pumping", "primary": "#0a3d91", "secondary": "#f0f0f0" }, "wellhead": { "primary": "#202020", "accent": "#d9a400" }, "operator": { "primary": "#ffffff", "ppe": "#ff7a1a", "hat": "#ffffff" } }' data-input="theme-json" />
          <button className="btn btn-primary text-xs flex items-center gap-1" onClick={load} disabled={!json.trim()} data-action="theme-load"><Upload size={12} />Load and apply</button>
          {msg && <div className="text-[11px] text-mute" data-status="theme-msg">{msg}</div>}
        </div>
      </details>
    </div>
  );
}
