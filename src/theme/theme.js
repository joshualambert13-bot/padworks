// Themes (Drop 81): the pad in a customer's colors. A theme names the three companies on a pad and their colors:
// the pressure pumping company (pump bodies, blender, missile accents and power units take `fleet.primary`; cabs,
// trailers, the data van and the fuel row take `fleet.secondary`), the wellhead company (tree valve bodies and the
// zipper take `wellhead.primary`, actuators `wellhead.accent`), and the operator (pickups, the office, hard hats
// and vests take `operator.primary` and `operator.ppe`). The site name, tagline, accent color and logo come from
// `site`. Built-in themes are neutral samples for pitches; a customer's theme is theirs, loaded as JSON with their
// own logo, and visible only to their accounts once the server holds it (today: this browser, through the admin
// page). Colors land on the shared palette (`MAT`, `TREE_TINT`) before the scene mounts, and a change remounts the
// scene, so no material is left half painted.
import { create } from 'zustand';
import { MAT } from '../sim/parts/primitives.jsx';
import { TREE_TINT } from '../sim/parts/surface.jsx';

const BASE = {
  blue: MAT.blue.color, paintWhite: MAT.paintWhite.color, tankBlue: MAT.tankBlue.color, yellow: MAT.yellow.color, redIron: MAT.redIron.color, tree: TREE_TINT.color, orange: MAT.orange.color,
};

export const BUILTIN = [
  { id: 'padworks', name: 'Padworks (default)', site: { name: 'Padworks', tagline: 'O&G Completions Simulator', accent: '#e0b15a', logo: '' },
    fleet: { name: 'Pressure pumping', primary: BASE.blue, secondary: BASE.paintWhite },
    wellhead: { name: 'Wellhead', primary: BASE.tree, accent: BASE.yellow },
    operator: { name: 'Operator', primary: '#d7dde5', ppe: '#ff7a1a', hat: '#f2f2f2' } },
  { id: 'red-fleet', name: 'Sample: red fleet', site: { name: 'Padworks', tagline: 'Red fleet sample theme', accent: '#e23b2e', logo: '' },
    fleet: { name: 'Red fleet (sample)', primary: '#b0202a', secondary: '#e8e8e4' },
    wellhead: { name: 'Wellhead (sample)', primary: '#2d2f33', accent: '#d9a400' },
    operator: { name: 'Operator (sample)', primary: '#f2f2f2', ppe: '#ff7a1a', hat: '#f2f2f2' } },
  { id: 'blue-fleet', name: 'Sample: blue fleet', site: { name: 'Padworks', tagline: 'Blue fleet sample theme', accent: '#2f7fe0', logo: '' },
    fleet: { name: 'Blue fleet (sample)', primary: '#1d4f9c', secondary: '#f4f6f8' },
    wellhead: { name: 'Wellhead (sample)', primary: '#c8102e', accent: '#1b1b1b' },
    operator: { name: 'Operator (sample)', primary: '#1a1a1a', ppe: '#e8e83a', hat: '#2a5d9f' } },
  { id: 'white-fleet', name: 'Sample: white fleet', site: { name: 'Padworks', tagline: 'White fleet sample theme', accent: '#2fa35b', logo: '' },
    fleet: { name: 'White fleet (sample)', primary: '#e9ecef', secondary: '#1f7a3f' },
    wellhead: { name: 'Wellhead (sample)', primary: '#1f7a3f', accent: '#e9ecef' },
    operator: { name: 'Operator (sample)', primary: '#2f2f33', ppe: '#ff7a1a', hat: '#e8d23a' } },
];

const KEY = 'padworks.theme', CUSTOM_KEY = 'padworks.themes';
const load = (k, d) => { try { const v = window.localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch { /* session only */ } };

export function themeById(id, custom = []) { return custom.find(t => t.id === id) || BUILTIN.find(t => t.id === id) || BUILTIN[0]; }
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

const initialCustom = typeof window !== 'undefined' ? load(CUSTOM_KEY, []) : [];
const fromUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('theme') : null;
const initialId = fromUrl || (typeof window !== 'undefined' ? load(KEY, 'padworks') : 'padworks');
const initial = themeById(initialId, initialCustom);
if (typeof window !== 'undefined') paintPalette(initial);

export const useTheme = create((set, get) => ({
  theme: initial, custom: initialCustom, version: 0,
  setTheme: (id) => { const t = themeById(id, get().custom); paintPalette(t); save(KEY, t.id); set(s => ({ theme: t, version: s.version + 1 })); },
  addCustom: (raw) => { const t = normalizeTheme(raw); const custom = [...get().custom.filter(c => c.id !== t.id), t]; save(CUSTOM_KEY, custom); set({ custom }); get().setTheme(t.id); return t; },
  removeCustom: (id) => { const custom = get().custom.filter(c => c.id !== id); save(CUSTOM_KEY, custom); set({ custom }); if (get().theme.id === id) get().setTheme('padworks'); },
}));
if (typeof window !== 'undefined') window.__padworksTheme = useTheme;   // test hook
