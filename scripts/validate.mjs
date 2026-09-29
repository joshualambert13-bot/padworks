// Validates every record against the schema, checks ID uniqueness, parent integrity,
// citation resolution against the source register, and glossary record links.
// Exit code 1 on any failure so CI stops the deploy.
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';

const root = path.resolve('content');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema/record.schema.json'), 'utf8'));
const sources = JSON.parse(fs.readFileSync(path.join(root, 'sources.json'), 'utf8'));
const glossary = JSON.parse(fs.readFileSync(path.join(root, 'glossary.json'), 'utf8'));
const sourceIds = new Set(sources.map(s => s.id));

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validate = ajv.compile(schema);

const files = [];
function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) files.push(p); } }
walk(path.join(root, 'records'));

const records = new Map();
const errors = [];
for (const f of files) {
  let r;
  try { r = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { errors.push(`${f}: invalid JSON (${e.message})`); continue; }
  if (!validate(r)) { for (const e of validate.errors) errors.push(`${f}: ${e.instancePath || '/'} ${e.message}`); }
  if (path.basename(f, '.json') !== r.id) errors.push(`${f}: file name does not equal id ${r.id}`);
  if (records.has(r.id)) errors.push(`${f}: duplicate id ${r.id}`);
  records.set(r.id, r);
}
for (const r of records.values()) {
  if (r.level !== 'system' && !r.parent) errors.push(`${r.id}: missing parent`);
  if (r.parent && !records.has(r.parent)) errors.push(`${r.id}: parent ${r.parent} not found`);
  for (const s of r.sources || []) if (!sourceIds.has(s)) errors.push(`${r.id}: source ${s} not in register`);
  for (const sp of r.specs || []) if (sp.source && !sourceIds.has(sp.source)) errors.push(`${r.id}: spec source ${sp.source} not in register`);
  for (const c of r.connections || []) if (!records.has(c.target) && !/^[A-Z]{2}$/.test(c.target) && !c.target.startsWith('PP-') && !c.target.startsWith('WL-')) errors.push(`${r.id}: connection target ${c.target} not found`);
  if (r.status !== 'draft' && (!r.reviewers || r.reviewers.length === 0) && r.status !== 'screened') errors.push(`${r.id}: status ${r.status} requires a reviewer entry`);
  if (r.drawn_in_3d && !(r.glb || r.scene)) errors.push(`${r.id}: drawn_in_3d without glb or scene`);
}
for (const g of glossary) if (g.record && !records.has(g.record)) errors.push(`glossary ${g.term}: record ${g.record} not found`);

// alias collisions across records
const aliasMap = new Map();
for (const r of records.values()) for (const a of r.aliases || []) {
  const k = a.toLowerCase();
  if (aliasMap.has(k) && aliasMap.get(k) !== r.id) errors.push(`alias collision "${a}": ${aliasMap.get(k)} and ${r.id}`);
  aliasMap.set(k, r.id);
}

if (errors.length) { console.error('VALIDATION FAILED'); for (const e of errors) console.error(' -', e); process.exit(1); }
console.log(`Validated ${records.size} records, ${sources.length} sources, ${glossary.length} glossary terms. OK`);
