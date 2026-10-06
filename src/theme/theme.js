// Themes (Drop 81): the pad in a customer's colors. A theme names the three companies on a pad and their colors:
// the pressure pumping company (pump bodies, blender, missile accents and power units take `fleet.primary`; cabs,
// trailers, the data van and the fuel row take `fleet.secondary`), the wellhead company (tree valve bodies and the
// zipper take `wellhead.primary`, actuators `wellhead.accent`), and the operator (pickups, the office, hard hats
// and vests take `operator.primary` and `operator.ppe`). The site name, tagline, accent color and logo come from
// `site`. Built-in themes are neutral samples for pitches; a customer's theme is theirs, loaded as JSON with their
// own logo. Since Drop 82 the accounts server holds one theme per organization and sends it with the sign-in, so a
// customer's accounts see their colors and logo on any machine; the admin page also keeps themes loaded in this
// browser for pitches. Colors land on the shared palette (`MAT`, `TREE_TINT`) before the scene mounts, and a change
// remounts the scene, so no material is left half painted. The logo (`site.logo`, a data URL) is drawn on the pump
// enclosures and the data van by src/sim/parts/logo.jsx.
import { create } from 'zustand';
import { MAT } from '../sim/parts/primitives.jsx';
import { TREE_TINT } from '../sim/parts/surface.jsx';

const BASE = {
  blue: MAT.blue.color, paintWhite: MAT.paintWhite.color, tankBlue: MAT.tankBlue.color, yellow: MAT.yellow.color, redIron: MAT.redIron.color, tree: TREE_TINT.color, orange: MAT.orange.color,
};

export const BUILTIN = [
  // site.focus (Drop 83): 'pad' | 'pumping' | 'wellhead' | 'operator', see focus.js; site.welcome: a paragraph of the customer's own on the landing page
  { id: 'padworks', name: 'Padworks (default)', site: { name: 'Padworks', tagline: 'O&G Completions Simulator', accent: '#e0b15a', logo: '', focus: 'pad', welcome: '' },
    fleet: { name: 'Pressure pumping', primary: BASE.blue, secondary: BASE.paintWhite },
    wellhead: { name: 'Wellhead', primary: BASE.tree, accent: BASE.yellow },
    operator: { name: 'Operator', primary: '#d7dde5', ppe: '#ff7a1a', hat: '#f2f2f2' } },
  { id: 'red-fleet', name: 'Sample: red fleet', site: { name: 'Padworks', tagline: 'Red fleet sample theme', accent: '#e23b2e', logo: '', focus: 'pumping' },
    fleet: { name: 'Red fleet (sample)', primary: '#b0202a', secondary: '#e8e8e4' },
    wellhead: { name: 'Wellhead (sample)', primary: '#2d2f33', accent: '#d9a400' },
    operator: { name: 'Operator (sample)', primary: '#f2f2f2', ppe: '#ff7a1a', hat: '#f2f2f2' } },
  { id: 'blue-fleet', name: 'Sample: blue fleet', site: { name: 'Padworks', tagline: 'Blue fleet sample theme', accent: '#2f7fe0', logo: '', focus: 'wellhead' },
    fleet: { name: 'Blue fleet (sample)', primary: '#1d4f9c', secondary: '#f4f6f8' },
    wellhead: { name: 'Wellhead (sample)', primary: '#c8102e', accent: '#1b1b1b' },
    operator: { name: 'Operator (sample)', primary: '#1a1a1a', ppe: '#e8e83a', hat: '#2a5d9f' } },
  { id: 'white-fleet', name: 'Sample: white fleet', site: { name: 'Padworks', tagline: 'White fleet sample theme', accent: '#2fa35b', logo: '', focus: 'operator' },
    fleet: { name: 'White fleet (sample)', primary: '#e9ecef', secondary: '#1f7a3f' },
    wellhead: { name: 'Wellhead (sample)', primary: '#1f7a3f', accent: '#e9ecef' },
    operator: { name: 'Operator (sample)', primary: '#2f2f33', ppe: '#ff7a1a', hat: '#e8d23a' } },
];

// KEY: the theme picked in this browser; CUSTOM_KEY: themes loaded from JSON here; ORG_KEY (Drop 82): the signed-in
// account's organization theme as the server last sent it, cached so a reload paints it before the scene mounts
const KEY = 'padworks.theme', CUSTOM_KEY = 'padworks.themes', ORG_KEY = 'padworks.orgTheme';
const load = (k, d) => { try { const v = window.localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { if (v === null || v === undefined) window.localStorage.removeItem(k); else window.localStorage.setItem(k, JSON.stringify(v)); } catch { /* session only */ } };

export function themeById(id, custom = [], org = null) { return (org && org.id === id ? org : null) || custom.find(t => t.id === id) || BUILTIN.find(t => t.id === id) || BUILTIN[0]; }
// a theme as loaded from JSON: anything missing falls back to the default, so a customer file can be short
export function normalizeTheme(t) {
  const d = BUILTIN[0];
  return { id: String(t.id || 'custom').replace(/[^a-z0-9-]/gi, '-').toLowerCase(), name: t.name || t.id || 'Custom theme',
    site: { ...d.site, ...(t.site || {}) }, fleet: { ...d.fleet, ...(t.fleet || {}) }, wellhead: { ...d.wellhead, ...(t.wellhead || {}) }, operator: { ...d.operator, ...(t.operator || {}) } };
}

// write the theme's colors onto the shared palette; the scene reads them when it mounts
export function paintPalette(t) {
  MAT.blue.color = t.fleet.primary; MAT.tankBlue.color = t.fleet.primary;
  MAT.paintWhite.color = t.fleet.secondary;
  TREE_TINT.color = t.wellhead.primary;
  MAT.yellow.color = t.wellhead.accent;
  MAT.orange.color = t.operator.ppe;
  document.documentElement.style.setProperty('--color-accent', t.site.accent || '#e0b15a');
}

const hasWindow = typeof window !== 'undefined';
const initialCustom = hasWindow ? load(CUSTOM_KEY, []) : [];
const initialOrg = hasWindow ? load(ORG_KEY, null) : null;
const fromUrl = hasWindow ? new URLSearchParams(window.location.search).get('theme') : null;
// precedence: a ?theme= link, then the account's organization theme, then the theme picked in this browser
const initialId = fromUrl || (initialOrg ? initialOrg.id : null) || (hasWindow ? load(KEY, 'padworks') : 'padworks');
const initial = themeById(initialId, initialCustom, initialOrg);
if (hasWindow) paintPalette(initial);

export const useTheme = create((set, get) => ({
  theme: initial, custom: initialCustom, org: initialOrg, version: 0,
  setTheme: (id) => { const t = themeById(id, get().custom, get().org); paintPalette(t); save(KEY, t.id); set(s => ({ theme: t, version: s.version + 1 })); },
  addCustom: (raw) => { const t = normalizeTheme(raw); const custom = [...get().custom.filter(c => c.id !== t.id), t]; save(CUSTOM_KEY, custom); set({ custom }); get().setTheme(t.id); return t; },
  removeCustom: (id) => { const custom = get().custom.filter(c => c.id !== id); save(CUSTOM_KEY, custom); set({ custom }); if (get().theme.id === id) get().setTheme('padworks'); },
  // Drop 82: the server sends the signed-in account's organization theme (or null) with every sign-in and page load.
  // It is applied unless a ?theme= link asked for something else; signing out drops it and the browser's own pick returns.
  setOrgTheme: (raw) => {
    const prev = get().org;
    const t = raw ? normalizeTheme(raw) : null;
    if (JSON.stringify(t) === JSON.stringify(prev)) return;
    save(ORG_KEY, t); set({ org: t });
    const cur = get().theme;
    if (t) { if (!fromUrl && cur.id !== t.id) { paintPalette(t); set(s => ({ theme: t, version: s.version + 1 })); } else if (cur.id === t.id) { paintPalette(t); set(s => ({ theme: t, version: s.version + 1 })); } }
    else if (prev && cur.id === prev.id) { const back = themeById(load(KEY, 'padworks'), get().custom, null); paintPalette(back); set(s => ({ theme: back, version: s.version + 1 })); }
  },
}));
if (hasWindow) window.__padworksTheme = useTheme;   // test hook
