// Content loader: every record JSON is bundled at build time. Records are the source of truth.
import systems from '../../content/systems.json';
import sources from '../../content/sources.json';
import glossary from '../../content/glossary.json';
import hazards from '../../content/hazards.json';

const modules = import.meta.glob('../../content/records/**/*.json', { eager: true, import: 'default' });
export const records = Object.values(modules).sort((a, b) => a.id.localeCompare(b.id));
export const byId = new Map(records.map(r => [r.id, r]));
export { systems, sources, glossary, hazards };
export const sourceById = new Map(sources.map(s => [s.id, s]));

export function childrenOf(id) { return records.filter(r => r.parent === id); }
export function systemRecords(code) { return records.filter(r => r.system === code && r.level !== 'system'); }
export function systemRecord(code) { return byId.get(code); }
export function groupsOf(code) {
  const map = new Map();
  for (const r of systemRecords(code)) { const g = r.group || 'general'; if (!map.has(g)) map.set(g, []); map.get(g).push(r); }
  return map;
}

export const STATUS_LABEL = {
  draft: { text: 'Unreviewed draft', cls: 'text-bad border-bad/60' },
  screened: { text: 'Screened: read once by the reviewer', cls: 'text-warn border-warn/60' },
  reviewed: { text: 'Reviewed: every tab and source checked', cls: 'text-cool border-cool/60' },
  verified: { text: 'Verified: two sources behind every number', cls: 'text-ok border-ok/60' },
  published: { text: 'Published', cls: 'text-ok border-ok/60' },
  deprecated: { text: 'Retired', cls: 'text-mute border-line' },
};
export const TIER_LABEL = {
  E1: 'From a standard',
  E2: 'From a manufacturer\'s public document (example, not a baseline)',
  E3: 'From the reviewer\'s field experience',
  E4: 'Estimate, not yet confirmed',
};
