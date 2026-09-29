import MiniSearch from 'minisearch';
import { records, glossary } from './records.js';

const docs = records.map(r => ({
  id: r.id,
  name: r.name,
  aliases: (r.aliases || []).join(' '),
  glossary: glossary.filter(g => g.record === r.id).flatMap(g => [g.term, ...(g.aliases || [])]).join(' '),
  fn: r.function,
  system: r.system,
  level: r.level,
}));

export const index = new MiniSearch({
  fields: ['id', 'name', 'aliases', 'glossary', 'fn'],
  storeFields: ['id', 'name', 'system', 'level'],
  searchOptions: { boost: { name: 4, aliases: 4, glossary: 3, id: 2 }, prefix: true, fuzzy: 0.2 },
});
index.addAll(docs);

export function search(q) {
  if (!q || q.trim().length < 2) return [];
  return index.search(q).slice(0, 12);
}
