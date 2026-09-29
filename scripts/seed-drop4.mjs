// Drop 4 seed: WH records moved to the standard tree configuration and size variants; PP and DT systems.
// Every new record is "draft". Run: node scripts/seed-drop4.mjs
import fs from 'node:fs';
import path from 'node:path';

const DATE = '2026-09-29';
const rev = (note) => ({ rev: 'A', author: 'AI draft', date: DATE, note });
const REC = (sys) => path.resolve('content/records', sys);
const load = (sys, id) => JSON.parse(fs.readFileSync(path.join(REC(sys), id + '.json'), 'utf8'));
const save = (r) => { fs.mkdirSync(REC(r.system), { recursive: true }); fs.writeFileSync(path.join(REC(r.system), r.id + '.json'), JSON.stringify(r, null, 2) + '\n'); };
const H = {
  pressure: { class: 'Stored pressure', control: 'Pressure test before pumping; bleed down and verify zero before breaking any connection.' },
  lof: { class: 'Line of fire', control: 'Stay out of the red zone while pumping; iron and hoses are restrained.' },
  pinch: { class: 'Pinch point', control: 'Hands clear of actuators, handwheels, and lifting gear.' },
  dropped: { class: 'Dropped object', control: 'Certified rigging; no one under a suspended load.' },
  noise: { class: 'Noise', control: 'Hearing protection near running pumps and blenders.' },
  dust: { class: 'Silica dust', control: 'Enclosed sand handling, dust collection, and respiratory protection where exposure is possible.' },
  explosives: { class: 'Explosives', control: 'Radio silence and RF-safe systems per the site plan; licensed personnel.' },
  hot: { class: 'Hot surfaces and exhaust', control: 'Guards on exhaust and hydraulic lines; keep clear of engine compartments while running.' },
};

// ---- sources
const srcPath = path.resolve('content/sources.json');
const sources = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const add = (s) => { if (!sources.find(x => x.id === s.id)) sources.push(s); };
add({ id: 'S16', title: 'API 6A Type 6BX flange dimensions, 10000 psi and 15000 psi (vendor tables, metric)', publisher: 'piping-world.com', edition: 'web, accessed 2026-09-29', access: 'Public', tier: 'E2', url: 'https://www.piping-world.com/api-6a-type-6bx-15000-psi' });
add({ id: 'S17', title: 'Simultaneous fracturing increases completion efficiency', publisher: 'Oil and Gas Journal (A. Procyk)', edition: '2022-01-03', access: 'Public', tier: 'E2', url: 'https://www.ogj.com/drilling-production/article/14223163/simultaneous-fracturing-increases-completion-efficiency' });
add({ id: 'S18', title: 'Triple-well completions are now the norm in US shale patch', publisher: 'JPT, SPE (T. Jacobs)', edition: '2025-05-08', access: 'Public', tier: 'E2', url: 'https://jpt.spe.org/triple-well-completions-are-now-the-norm-in-us-shale-patch' });
add({ id: 'S19', title: 'How simul frac and trimul frac projects work', publisher: 'Repeat Precision', edition: 'web, accessed 2026-09-29', access: 'Public', tier: 'E2', url: 'https://www.repeatprecision.com/news/simul-frac-and-trimul-frac' });
add({ id: 'S20', title: 'Plug and perf: how traditional frac plugs work', publisher: 'Matthew A. Crump, PE', edition: 'web, accessed 2026-09-29', access: 'Public', tier: 'E2', url: 'https://www.matthewacrump.com/content/howplugswork' });
add({ id: 'S21', title: 'API Spec 11D1, Packers and Bridge Plugs', publisher: 'American Petroleum Institute', edition: 'verify edition held', access: 'Paid standard', tier: 'E1', url: '' });
add({ id: 'S22', title: 'A beginner\'s guide to frac equipment: types and applications', publisher: 'Ironclad Environmental', edition: '2023-07-10', access: 'Public', tier: 'E2', url: 'https://ironcladenvironmental.com/2023/07/10/a-beginners-guide-to-frac-equipment-types-and-applications/' });
fs.writeFileSync(srcPath, JSON.stringify(sources, null, 2) + '\n');

// ---- glossary
const gPath = path.resolve('content/glossary.json');
const glossary = JSON.parse(fs.readFileSync(gPath, 'utf8'));
const gadd = (g) => { const i = glossary.findIndex(x => x.term === g.term); if (i >= 0) glossary[i] = g; else glossary.push(g); };
gadd({ term: 'Zipper frac', aliases: ['zipper', 'zipper fracturing'], system: 'PP', record: 'PP-MULTIWELL', definition: 'Two or more wells completed in alternation: one well is pumped while wireline sets the next plug and guns on its neighbor, so the spread never waits.' });
gadd({ term: 'Simul-frac', aliases: ['simulfrac', 'simultaneous frac', 'trimul-frac', 'quad-frac', 'quadfrac'], system: 'PP', record: 'PP-MULTIWELL', definition: 'Two (simul), three (trimul), or four (quad) wells pumped at the same time from one spread through a split manifold, with wireline working ahead on the remaining wells.' });
gadd({ term: 'Crown valve', aliases: ['crown', 'upper swab', 'top master'], system: 'WH', record: 'WH-FRACTREE-CROWN', definition: 'The hydraulic valve above the cross and below the inlet block on the standard stack; isolates the well from the inlet block and the swab valve above it.' });
gadd({ term: 'Inlet block', aliases: ['frac inlet', 'flanged inlet', 'spool inlet', 'treating inlet block'], system: 'WH', record: 'WH-FRACTREE-INLETBLOCK', definition: 'The flanged block above the crown valve where the spooled treating line from the zipper manifold enters the stack; replaces the goat head and its hammer-union iron.' });
gadd({ term: 'Frac plug', aliases: ['composite plug', 'plug', 'dissolvable plug', 'bridge plug (different)'], system: 'DT', record: 'DT-FRACPLUG', definition: 'The set-and-mill (or dissolve) isolation plug that seals the casing below a new stage so the fracture treatment goes only into the new perforations.' });
gadd({ term: 'Setting tool', aliases: ['pressure setting assembly', 'wireline setting tool', 'adapter kit', 'power charge'], system: 'DT', record: 'DT-SETTINGTOOL', definition: 'The wireline tool that converts a slow gas charge into the stroke that sets the frac plug, then shears free.' });
gadd({ term: 'Missile', aliases: ['manifold trailer', 'frac manifold', 'HP manifold'], system: 'PP', record: 'PP-MISSILE', definition: 'The trailer-mounted manifold that collects the discharge of every frac pump into the high-pressure treating line and distributes slurry to the pumps on the low-pressure side.' });
gadd({ term: 'Blender', aliases: ['frac blender', 'slurry blender'], system: 'PP', record: 'PP-BLENDER', definition: 'The unit that mixes water, proppant, and chemicals into slurry at the rate the pumps take it, using a tub with augers and suction and discharge pumps.' });
fs.writeFileSync(gPath, JSON.stringify(glossary, null, 2) + '\n');

// ---- variants
const SIZES = [['4-10K', '4-1/16 in. 10K'], ['4-15K', '4-1/16 in. 15K'], ['5-10K', '5-1/8 in. 10K'], ['5-15K', '5-1/8 in. 15K'], ['7-10K', '7-1/16 in. 10K'], ['7-15K', '7-1/16 in. 15K']];
const variantsOf = (base, keys = SIZES) => keys.map(([key, label]) => ({ key, label, glb: `/glb/WH/${base}.${key}.glb` }));
const FLANGE_SPECS = [
  { name: '6BX flange OD, 4-1/16 in. 10K / 15K', value: '12.40 / 14.17', unit: 'in.', source: 'S16', tier: 'E2' },
  { name: '6BX flange OD, 5-1/8 in. 10K / 15K', value: '14.17 / 16.54', unit: 'in.', source: 'S16', tier: 'E2' },
  { name: '6BX flange OD, 7-1/16 in. 10K / 15K', value: '18.90 / 19.88', unit: 'in.', source: 'S16', tier: 'E2' },
  { name: 'Studs, 7-1/16 in. 15K', value: '16 x 1-1/2', unit: 'in.', source: 'S16', tier: 'E2' },
  { name: 'Studs, 5-1/8 in. 15K', value: '12 x 1-1/2', unit: 'in.', source: 'S16', tier: 'E2' },
  { name: 'Studs, 4-1/16 in. 15K', value: '8 x 1-3/8', unit: 'in.', source: 'S16', tier: 'E2' },
  { name: 'Valve end to end, 7-1/16 in. 15K', value: '44.5', unit: 'in.', source: 'S10', tier: 'E4' },
];

// ================================================================ WH updates
const gv = load('WH', 'WH-GATEVALVE');
gv.glb = '/glb/WH/WH-GATEVALVE.7-15K.glb';
gv.variants = variantsOf('WH-GATEVALVE');
gv.mesh_nodes = ['WH-GATEVALVE-BODY', 'WH-GATEVALVE-FLANGE-IN', 'WH-GATEVALVE-FLANGE-OUT', 'WH-GATEVALVE-SEAT-UP', 'WH-GATEVALVE-SEAT-DOWN', 'WH-GATEVALVE-GATE', 'WH-GATEVALVE-BONNET', 'WH-GATEVALVE-PACKING', 'WH-GATEVALVE-BEARING', 'WH-GATEVALVE-STEM', 'WH-GATEVALVE-HANDWHEEL', 'WH-GATEVALVE-GREASEFITTING'];
gv.tabs.specs = 'The model is offered in the three bores and two ratings used on frac stacks. Flange envelopes come from a public 6BX table (E2); end-to-end lengths are estimates until checked against the API 6A tables (E4). Choose the size above the viewer.';
gv.specs = [...(gv.specs || []).filter(x => !/flange|Studs|end to end/i.test(x.name)), ...FLANGE_SPECS];
gv.tabs.engineering = (gv.tabs.engineering || '') + ' Frac valves are block-body designs: a forged rectangular block with integral end hubs and round flanges, a round studded bonnet on the stem side, and a plain boss or balance stem housing on the far side. The stem protector tube above the bearing cap carries indicator slots so the gate position can be read from the ground.';
gv.revision = rev('Drop 4: block body, size variants, grease fittings');
save(gv);

const gvh = load('WH', 'WH-GATEVALVE-HYD');
gvh.glb = '/glb/WH/WH-GATEVALVE-HYD.7-15K.glb';
gvh.variants = variantsOf('WH-GATEVALVE-HYD');
gvh.mesh_nodes = ['WH-GATEVALVE-BODY', 'WH-GATEVALVE-FLANGE-IN', 'WH-GATEVALVE-FLANGE-OUT', 'WH-GATEVALVE-SEAT-UP', 'WH-GATEVALVE-SEAT-DOWN', 'WH-GATEVALVE-GATE', 'WH-GATEVALVE-BONNET', 'WH-GATEVALVE-PACKING', 'WH-GATEVALVE-BEARING', 'WH-GATEVALVE-STEM', 'WH-GATEVALVE-GREASEFITTING', 'WH-GATEVALVE-ACTUATOR', 'WH-GATEVALVE-BALANCESTEM'];
gvh.tabs.engineering = (gvh.tabs.engineering || '') + ' The actuator is a tie-rod hydraulic cylinder on a bonnet adapter, with an indicator tube on top. Because well pressure acting on the stem area would push the stem out, a balance stem of the same diameter on the opposite side of the gate cancels the force, so the actuator sizes for friction and drag rather than for pressure thrust.';
gvh.tabs.specs = 'Same bores and ratings as the manual valve; the actuator envelope grows with bore. Choose the size above the viewer.';
gvh.specs = [...(gvh.specs || []).filter(x => !/flange|Studs|end to end/i.test(x.name)), ...FLANGE_SPECS];
gvh.revision = rev('Drop 4: tie-rod actuator, balance stem, size variants');
save(gvh);

for (const id of ['WH-GATEVALVE-BODY', 'WH-GATEVALVE-BONNET', 'WH-GATEVALVE-GATE', 'WH-GATEVALVE-SEAT', 'WH-GATEVALVE-STEM']) {
  const r = load('WH', id); r.glb = '/glb/WH/WH-GATEVALVE.7-15K.glb'; save(r);
}
const act = load('WH', 'WH-GATEVALVE-ACTUATOR'); act.glb = '/glb/WH/WH-GATEVALVE-HYD.7-15K.glb'; act.mesh_nodes = ['WH-GATEVALVE-ACTUATOR', 'WH-GATEVALVE-BALANCESTEM']; act.parent = 'WH-GATEVALVE-HYD'; save(act);
const gf = load('WH', 'WH-GATEVALVE-GREASEFITTING'); gf.drawn_in_3d = true; gf.glb = '/glb/WH/WH-GATEVALVE.7-15K.glb'; gf.mesh_nodes = ['WH-GATEVALVE-GREASEFITTING']; gf.revision = rev('Drop 4: drawn'); save(gf);

// frac tree: standard configuration
const ft = load('WH', 'WH-FRACTREE');
ft.name = 'Frac stack, standard configuration';
ft.aliases = [...new Set([...(ft.aliases || []), 'frac stack', 'standard tree', 'flanged inlet stack'])];
ft.function = 'The temporary stack of gate valves, cross, crown valve, flanged inlet block, and swab valve installed on the wellhead for the completion: it contains treating pressure, admits the spooled treating line, and gives wireline and coiled tubing access through the top.';
ft.tabs.overview = 'Bottom to top in the standard configuration used on this site: tree adapter on the tubing head; lower master valve (manual, the last barrier, never cycled under flow); upper master valve (hydraulic, the working master); studded cross with a manual then a hydraulic wing valve on each side, wing A for pump-down and kill lines and wing B for flowback; crown valve (hydraulic) that isolates the well from everything above it; flanged inlet block where the spooled treating line from the zipper manifold enters; swab valve (hydraulic) that isolates the top; and a hands-free style top adapter for the wireline lubricator or the coiled tubing stack.\n\nDuring fracturing the swab is closed, the crown, masters, and the zipper valve are open, and treating fluid enters at the inlet block and flows down. During wireline the zipper valve is closed, the swab is open, and the tool string passes down through the inlet block, crown, cross, and masters. The flanged inlet block replaces the goat head and its hammer-union iron; a single large-bore spool or monoline connects it to the zipper module.\n\nEvery valve is the same block-body gate valve family; the model can be shown in 4-1/16, 5-1/8, or 7-1/16 in. bore at 10K or 15K. Choose the size above the viewer.';
ft.tabs.connections = 'Below: tubing head through the tree adapter. Side: wing A to the pump-down or kill line, wing B to the flowback line, both flanged. Inlet block: flanged hub to the treating spool from the zipper manifold. Top: hands-free adapter to the wireline pressure control stack or the coiled tubing injector stack.';
ft.tabs.operations = 'Installed after the casing is landed and before the first wireline run; stays on the well through every stage, the drillout, and flowback; removed when the production tree is set. Pressure tested to the job pressure before the first run and after any connection is broken.';
ft.glb = '/glb/WH/WH-FRACTREE.7-15K.glb';
ft.variants = variantsOf('WH-FRACTREE');
ft.mesh_nodes = ['WH-FRACTREE-TREEADAPTER', 'WH-FRACTREE-LMV', 'WH-FRACTREE-UMV', 'WH-FRACTREE-CROSS', 'WH-FRACTREE-WINGA-MAN', 'WH-FRACTREE-WINGA-HYD', 'WH-FRACTREE-WINGB-MAN', 'WH-FRACTREE-WINGB-HYD', 'WH-FRACTREE-CROWN', 'WH-FRACTREE-INLETBLOCK', 'WH-FRACTREE-SWAB', 'WH-FRACTREE-TOPADAPTER', 'WH-FRACTREE-STUDS'];
ft.connections = [{ target: 'WH-TUBINGHEAD', direction: 'upstream', type: 'flanged', rating: '15K' }, { target: 'WH-ZIPPER', direction: 'upstream', type: 'flanged', note: 'Treating spool into the inlet block' }, { target: 'WL-PCE', direction: 'downstream', type: 'flanged', note: 'Lubricator on the top adapter' }, { target: 'FB', direction: 'downstream', type: 'flanged', note: 'Flowback line on wing B' }];
ft.revision = rev('Drop 4: standard configuration, block valves, size variants');
save(ft);
for (const id of ['WH-FRACTREE-CROSS', 'WH-FRACTREE-LMV', 'WH-FRACTREE-SWAB', 'WH-FRACTREE-TREEADAPTER', 'WH-FRACTREE-UMV']) {
  const r = load('WH', id); r.glb = '/glb/WH/WH-FRACTREE.7-15K.glb'; save(r);
}
{
  const r = load('WH', 'WH-FRACTREE-SWAB');
  r.name = 'Swab valve (hydraulic, wireline access)';
  r.tabs.overview = 'The top valve of the stack, above the inlet block. Closed while pumping so the lubricator connection above it sees no treating pressure; opened only after the lubricator or coiled tubing stack is made up and tested. Hydraulic on this configuration so it can be cycled from the control unit between every run.';
  r.glb = '/glb/WH/WH-FRACTREE.7-15K.glb'; save(r);
}
const winga = load('WH', 'WH-FRACTREE-WINGA');
winga.name = 'Wing A: manual and hydraulic wing valves (pump-down side)';
winga.aliases = ['wing valve', 'wing A', 'kill wing', 'pump-down wing', 'inner and outer wing'];
winga.function = 'The pair of wing valves on the cross outlet facing the zipper side: a manual valve inboard as the isolation barrier and a hydraulic valve outboard as the working valve, serving the pump-down or kill line.';
winga.tabs.overview = 'Two valves in series on the same outlet. The inboard manual valve stays open during the job and is closed only for repairs on the outboard valve or the line. The outboard hydraulic valve is the one cycled from the control unit: opened for pump-down fluid during wireline runs or for a kill line, closed while pumping the treatment.';
winga.glb = '/glb/WH/WH-FRACTREE.7-15K.glb'; winga.mesh_nodes = ['WH-FRACTREE-WINGA-MAN', 'WH-FRACTREE-WINGA-HYD']; winga.revision = rev('Drop 4: manual plus hydraulic pair'); save(winga);
const wingb = load('WH', 'WH-FRACTREE-WINGB');
wingb.name = 'Wing B: manual and hydraulic wing valves (flowback side)';
wingb.aliases = ['wing B', 'flowback wing', 'production wing', 'inner and outer wing'];
wingb.function = 'The pair of wing valves on the cross outlet facing the flowback line: manual inboard as the barrier, hydraulic outboard as the working valve opened for flowback and drillout returns.';
wingb.tabs.overview = 'Mirror of wing A. The outboard hydraulic valve is opened when the well flows to the flowback spread during drillout and well test, and closed while pumping. The inboard manual valve is the barrier that lets the outer valve or the line be repaired with the well shut in.';
wingb.glb = '/glb/WH/WH-FRACTREE.7-15K.glb'; wingb.mesh_nodes = ['WH-FRACTREE-WINGB-MAN', 'WH-FRACTREE-WINGB-HYD']; wingb.revision = rev('Drop 4: manual plus hydraulic pair'); save(wingb);
if (fs.existsSync(path.join(REC('WH'), 'WH-FRACTREE-TREECAP.json'))) fs.unlinkSync(path.join(REC('WH'), 'WH-FRACTREE-TREECAP.json'));

const treeComp = (id, name, aliases, fn, over, eng, safety, nodes, extra = {}) => save({
  id, system: 'WH', group: 'frac-tree', level: 'component', parent: 'WH-FRACTREE', name, aliases, function: fn, status: 'draft', evidence_tier: 'E2', reviewers: [],
  tabs: { overview: over, engineering: eng, safety, evidence: 'Field photographs read for proportion only; public flange tables (S16); field practice (S9).' },
  hazards: [H.pressure], drawn_in_3d: true, glb: '/glb/WH/WH-FRACTREE.7-15K.glb', mesh_nodes: nodes, sources: ['S1', 'S9', 'S16'], revision: rev('Drop 4 seed'), ...extra,
});
treeComp('WH-FRACTREE-CROWN', 'Crown valve (hydraulic)', ['crown', 'upper swab', 'top master valve'],
  'The hydraulic valve above the cross and below the inlet block that isolates the well from the inlet block, the swab valve, and anything connected above.',
  'With the crown closed the inlet block and swab can be worked on, tested, or reconfigured while the wellbore below stays shut in behind the masters. During pumping and wireline runs it is open. It is the valve that separates the treating side of the stack from the well control side.',
  'Same block-body hydraulic gate valve as the upper master; sized and rated with the stack.',
  'Not closed against flow; stop pumping and bleed the inlet block first. Position confirmed from the indicator before the lubricator is opened to the well.', ['WH-FRACTREE-CROWN']);
treeComp('WH-FRACTREE-INLETBLOCK', 'Inlet block (flanged, spooled treating line)', ['inlet block', 'frac inlet', 'flanged inlet', 'treating inlet'],
  'The flanged block above the crown valve with a side hub where the spooled treating line from the zipper manifold enters the stack.',
  'A studded block with the vertical bore and one flanged outlet. A single large-bore flanged spool or monoline swivel assembly connects it to the zipper module, replacing the goat head and the bundle of 3 in. hammer-union iron. Fewer connections means fewer leak paths and a faster rig-up, at the cost of heavier pieces that need a crane.',
  'Block and hub sized to the stack bore and rating; the outlet flange matches the treating spool.',
  'The inlet block sees full treating pressure and proppant erosion at the turn; wall thickness is checked between jobs.', ['WH-FRACTREE-INLETBLOCK'], { connections: [{ target: 'WH-ZIPPER', direction: 'upstream', type: 'flanged', note: 'Treating spool' }, { target: 'WH-MONOLINE', direction: 'upstream', type: 'flanged' }] });
treeComp('WH-FRACTREE-TOPADAPTER', 'Top adapter (hands-free connector)', ['top adapter', 'quick connector', 'hands-free connector', 'lubricator adapter', 'tree cap'],
  'The connection at the top of the swab valve that receives the wireline lubricator or the coiled tubing stack, shown as a generic hands-free style latch so no one has to work on top of the stack.',
  'A flange on the swab valve, a body with the latch profile, and a funnel that guides the lubricator stinger in. Remote-latching connectors let the crane set the lubricator and the latch engage without a person on the tree; a bolted flange or a threaded union is the simpler alternative.',
  'Rated with the stack; latch and seal profile per the connector family in use.',
  'A suspended lubricator over the adapter is a dropped-object zone; latch confirmed and tested before the swab is opened.', ['WH-FRACTREE-TOPADAPTER'], { connections: [{ target: 'WL-PCE', direction: 'downstream', type: 'flanged' }, { target: 'CT', direction: 'downstream', type: 'flanged' }] });

const goat = load('WH', 'WH-GOATHEAD');
delete goat.glb; delete goat.mesh_nodes; delete goat.scene; goat.drawn_in_3d = false;
goat.tabs.overview = (goat.tabs.overview || '') + '\n\nThe standard stack on this site uses a flanged inlet block and a spooled treating line instead of a goat head, so the goat head is documented as the hammer-union alternative and is not drawn in the standard tree model.';
goat.revision = rev('Drop 4: alternative to the inlet block; not in the standard model'); save(goat);
const studs = load('WH', 'WH-STUDBOLTS');
studs.drawn_in_3d = true; studs.glb = '/glb/WH/WH-FRACTREE.7-15K.glb'; studs.mesh_nodes = ['WH-FRACTREE-STUDS'];
studs.tabs.overview = (studs.tabs.overview || '') + ' In the tree model every stacked flange pair carries its stud and nut set as one node.';
studs.revision = rev('Drop 4: drawn in the tree'); save(studs);

const zip = load('WH', 'WH-ZIPPER');
zip.glb = '/glb/WH/WH-ZIPPER.7-15K.glb';
zip.variants = variantsOf('WH-ZIPPER', [['5-15K', '5-1/8 in. 15K'], ['7-10K', '7-1/16 in. 10K'], ['7-15K', '7-1/16 in. 15K']]);
zip.tabs.overview = (zip.tabs.overview || '') + '\n\nOn a multi-well pad the manifold grows with the well count, one hydraulic valve per well; in the simulator the skid stretches to the number of wells chosen, from one to sixteen. In simul-frac, trimul-frac, and quad-frac the header feeds two, three, or four open valves at once.';
zip.revision = rev('Drop 4: block valves, size variants, multi-well note'); save(zip);
for (const id of ['WH-ZIPPER-BLEEDVALVE', 'WH-ZIPPER-INLETHEADER', 'WH-ZIPPER-OUTLET', 'WH-ZIPPER-SKID', 'WH-ZIPPER-TRANSDUCER', 'WH-ZIPPER-VALVE']) {
  const r = load('WH', id); r.glb = '/glb/WH/WH-ZIPPER.7-15K.glb'; save(r);
}
{
  const r = load('WH', 'WH-FRACVALVECONTROL');
  r.tabs.overview = (r.tabs.overview || '') + '\n\nA common form is a multi-station panel: one regulator, gauge, and selector per valve on a stand, fed from the hydraulic power unit and an accumulator bank, so the operator opens and closes every hydraulic valve on the stack and the zipper from outside the red zone.';
  save(r);
}

// ================================================================ PP system
const EVP = 'Public equipment overviews (S22), public simultaneous-frac articles (S17, S18, S19), field practice (S9). Rates and horsepower are typical values, not a design basis.';
const pp = (o) => save({ status: 'draft', evidence_tier: 'E3', reviewers: [], system: 'PP', drawn_in_3d: false, sources: ['S9', 'S22'], revision: rev('Drop 4 seed'), hazards: [H.lof, H.noise], ...o });
const ppc = (id, parent, group, name, aliases, fn, over, eng, safety, extra = {}) => pp({ id, parent, group, level: 'component', name, aliases, function: fn, tabs: { overview: over, engineering: eng, safety, evidence: EVP, ...(extra.tabs || {}) }, ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'tabs')) });

pp({ id: 'PP', level: 'system', name: 'Pressure pumping spread', aliases: ['frac spread', 'frac fleet', 'pressure pumping', 'the spread'], scene: 'PP-MISSILE',
  function: 'The fleet of pumps, blender, hydration and chemical units, sand handling, manifold trailer, and data van that makes slurry and pumps it into the well at treating pressure.',
  tabs: {
    overview: 'Water from the frac tanks or pit is drawn through the hydration unit (when a gel is used) into the blender, where proppant from the sand system and chemicals from the additive unit are mixed at the design concentration. The blender discharge feeds the low-pressure side of the missile; each frac pump takes suction from the missile, raises the slurry to treating pressure, and discharges into the high-pressure header on the same trailer. The header feeds the treating line to the zipper manifold and the well. The data van records every rate, pressure, and concentration and is where the treatment is directed.\n\nSpread size follows the job: a conventional 90 bpm slickwater stage needs about 20 pumps online with spares; simul-frac, trimul-frac, and quad-frac schemes pump two, three, or four wells at once and need proportionally more pumping, sand, and water capacity, or accept a lower rate per well.',
    engineering: 'Pumps are rated in hydraulic horsepower (rate times pressure); a fleet is described by its total HHP and by the number of pumps online at the treating pressure. Diesel, dual-fuel, and electric (turbine or grid) power ends coexist; electric fleets cut fuel and noise. Fluid ends are the consumable: valves, seats, plungers, and packing wear with proppant.',
    connections: 'Suction: frac tanks or pit to hydration to blender to missile low-pressure header. Discharge: pumps to missile high-pressure header to treating line to zipper manifold. Data: every unit reports to the data van.',
    safety: 'Red zone around the high-pressure iron while pumping; hearing protection; silica dust controls at the sand system; hot surfaces at engines; pinch points at hose and iron handling.',
    specs: 'Typical per-pump rating 2,500 to 3,000 HHP; fleet 40,000 to 60,000 HHP; slickwater stage rate 80 to 100 bpm per well; treating pressure 8,000 to 12,000 psi.',
    evidence: EVP,
    operations: 'Rigged up once per pad; pumps rotated in and out of service for fluid end changes; the spread moves between wells by valve position at the zipper, not by moving iron.',
    failure_modes: 'Fluid end washouts and valve failures, blender tub level upsets, sand delivery interruptions, screenouts from concentration errors, iron leaks.',
  }, specs: [{ name: 'Pump rating, typical', value: '2500 to 3000', unit: 'HHP', tier: 'E3', source: 'S9' }, { name: 'Stage rate, slickwater', value: '80 to 100', unit: 'bpm per well', tier: 'E3', source: 'S9' }, { name: 'Simul-frac rate seen in the field', value: '60 to 70', unit: 'bpm per well', tier: 'E2', source: 'S17' }],
  hazards: [H.lof, H.noise, H.dust, H.hot], sources: ['S9', 'S17', 'S18', 'S19', 'S22'] });

pp({ id: 'PP-MULTIWELL', parent: 'PP', group: 'pad-schemes', level: 'equipment', name: 'Multi-well pumping schemes: zipper, simul-frac, trimul-frac, quad-frac', aliases: ['zipper frac', 'simulfrac', 'simul-frac', 'trimul-frac', 'quadfrac', 'quad-frac', 'simultaneous fracturing'],
  function: 'The ways a pad of two to sixteen wells is worked by one spread so that pumping and wireline overlap: alternating wells (zipper) or pumping two, three, or four wells at the same time (simul, trimul, quad).',
  tabs: {
    overview: 'Zipper frac: the spread pumps well A while wireline sets the plug and guns on well B, then the zipper valves swap and the roles reverse; the pumps rarely wait. Simul-frac: the treating line is split so two wells take slurry at the same time, each at a lower rate than a single-well stage, while wireline works a third well. Trimul-frac and quad-frac extend the same idea to three and four wells, with a larger spread, more sand and water logistics, and usually two wireline units to keep plugs and guns ahead of the pumps.\n\nThe gain is stages per day and less idle horsepower; the cost is more equipment on location, a treating manifold that must balance flow between wells at different pressures, and a scheduling problem that the data van and the wireline supervisor solve stage by stage. The simulator lets you set the well count and the scheme and watch which wells pump and which are on wireline.',
    engineering: 'Flow to each well is metered so the wells can be treated at different pressures from one high-pressure system; pump banks are assigned per well. Rate per well drops as wells are added unless pumps are added. Sand and water supply must keep up with the combined rate.',
    connections: 'Zipper manifold with one valve per well; split treating manifold or dual missiles for simultaneous schemes; two or more wireline units and cranes.',
    safety: 'More equipment in a fixed pad footprint: red zones overlap, crane lifts happen next to pumping wells, and lubricator work on one well is adjacent to a live treating line on the next.',
    specs: 'Published examples: two-well simulfracs pumped at 60 to 70 bpm per well against 90 bpm for zipper stages (S17); a trimul-frac program reported a 25 percent cut in completion time against zipper and simul (S18).',
    evidence: EVP,
    operations: 'The scheme is fixed when the pad is planned: number of wells, spread size, sand storage, water supply, and the count of wireline units follow from it.',
    failure_modes: 'Rate imbalance between wells, a screenout on one well forcing a shutdown on both, wireline falling behind the pumps, and equipment congestion on the pad.',
  }, hazards: [H.lof, H.dropped, H.noise], sources: ['S17', 'S18', 'S19', 'S9'], evidence_tier: 'E2' });

pp({ id: 'PP-FRACPUMP', parent: 'PP', group: 'pumping', level: 'equipment', name: 'Frac pump (pumper trailer)', aliases: ['frac pumper', 'pump truck', 'pumping unit', 'triplex', 'quintuplex', 'HHP unit'], scene: 'PP-FRACPUMP-1',
  function: 'A trailer or truck carrying an engine, transmission, and a positive-displacement plunger pump that takes slurry from the missile at low pressure and discharges it at treating pressure.',
  tabs: {
    overview: 'The pump is a reciprocating plunger pump: a power end converts engine torque into the stroke of three or five plungers, and the fluid end holds the suction and discharge valves that the plungers work against. Rate is set by engine speed and gear; pressure is whatever the well demands, up to the fluid end rating and the kickout setting. A fleet runs many pumps in parallel into one header so that one pump can be dropped for a fluid end change without stopping the stage.',
    engineering: 'Diesel engines with automatic transmissions are the common power end drive; electric motors on turbine or grid power replace them on electric fleets. Fluid ends are forged steel blocks with replaceable valves, seats, and packing; plunger size sets the trade between rate and pressure for a given horsepower.',
    connections: 'Suction hose from the missile low-pressure header; discharge iron to the missile high-pressure header; fuel, hydraulic, and data connections.',
    safety: 'Discharge iron is inside the red zone; fluid end failures release fluid at treating pressure; exhaust and hydraulic lines are hot; noise.',
    specs: 'Typical 2,500 to 3,000 HHP per unit; 10 to 12 bpm per pump at 10,000 psi with a small plunger; fluid ends rated 15,000 psi.',
    evidence: EVP,
    operations: 'Pumps are brought online in sequence as the rate is raised and taken offline as it is cut; fluid ends are swapped between stages on a wear schedule.',
    failure_modes: 'Fluid end washout, valve and seat wear, packing leaks, power end bearing failure, transmission overheating.',
  }, specs: [{ name: 'Rating, typical', value: '2500 to 3000', unit: 'HHP', tier: 'E3', source: 'S9' }], hazards: [H.lof, H.noise, H.hot] });
ppc('PP-FRACPUMP-ENGINE', 'PP-FRACPUMP', 'pumping', 'Engine and radiator', ['deck engine', 'prime mover', 'diesel'], 'The prime mover on the trailer deck that turns the transmission and the power end.',
  'A large diesel engine with its radiator and exhaust, controlled from the data van through the pump controller; dual-fuel engines burn natural gas with diesel pilot, and electric fleets replace the engine with a motor and a variable-frequency drive.', 'Rated to drive the pump at its horsepower; cooling sized for continuous duty in summer.', 'Hot exhaust and surfaces; fuel handling.', { scene: 'PP-FRACPUMP-1-ENGINE', drawn_in_3d: true, hazards: [H.hot, H.noise] });
ppc('PP-FRACPUMP-TRANSMISSION', 'PP-FRACPUMP', 'pumping', 'Transmission', ['gearbox', 'trans'], 'The automatic transmission between the engine and the power end that sets the pump speed range.',
  'Gear selection sets the plunger speed for a given engine speed, which is how the operator matches each pump to the rate the stage needs. Lockup and shift points are managed by the pump controller.', 'Torque rating matched to the engine and power end.', 'Rotating driveline guarded; hot oil.', { scene: 'PP-FRACPUMP-1-TRANSMISSION', drawn_in_3d: true, hazards: [H.hot] });
ppc('PP-FRACPUMP-POWEREND', 'PP-FRACPUMP', 'pumping', 'Power end', ['crankcase', 'power frame'], 'The crankshaft, connecting rods, and crossheads that convert rotation into the reciprocating plunger stroke.',
  'A heavy steel frame holding the crankshaft in bearings; each connecting rod drives a crosshead, and the crosshead drives a plunger through a pony rod. Lubrication is pressurized and monitored.', 'Rated in continuous horsepower and rod load; the rod load limit sets the maximum pressure for a given plunger size.', 'Rotating parts enclosed; lube oil hot.', { scene: 'PP-FRACPUMP-1-POWEREND', drawn_in_3d: true, hazards: [H.hot] });
ppc('PP-FRACPUMP-FLUIDEND', 'PP-FRACPUMP', 'pumping', 'Fluid end', ['fluid cylinder', 'fluid block'], 'The forged block on the front of the pump holding the plungers, suction and discharge valves, and packing, where slurry is raised to treating pressure.',
  'Each plunger works in its own bore with a suction valve below and a discharge valve above; the valves are spring-loaded poppets with elastomer inserts that seal against proppant-laden fluid. Packing seals the plunger. The whole block is the wear item of the spread.', 'Rated to 15,000 psi in frac service; alloy steel or stainless; valve and seat sizes standard across a fleet.', 'A washed-out fluid end releases fluid at full pressure; pumps are inspected between stages.', { scene: 'PP-FRACPUMP-1-FLUIDEND', drawn_in_3d: true, hazards: [H.pressure, H.lof] });
ppc('PP-FRACPUMP-VALVE', 'PP-FRACPUMP-FLUIDEND', 'pumping', 'Fluid end valve and seat', ['pump valve', 'valve and seat', 'poppet valve'], 'The spring-loaded poppet valves and seats in the fluid end that let slurry into the bore on the suction stroke and out on the discharge stroke.',
  'A valve body with an elastomer insert seals on a hardened seat; the spring closes it between strokes. Proppant cuts the insert and washes the seat, so the sets are changed on a schedule measured in pumping hours.', 'Standard sizes across the fleet; hardened seats; inserts chosen for the fluid.', 'Changed with the pump isolated and the fluid end bled.', { level: 'part', hazards: [H.pressure] });
ppc('PP-FRACPUMP-PLUNGER', 'PP-FRACPUMP-FLUIDEND', 'pumping', 'Plunger and packing', ['plunger', 'packing', 'stuffing box'], 'The hardened cylindrical plunger that displaces slurry in each bore and the packing that seals it.',
  'Plunger diameter sets the displacement per stroke and, for a fixed rod load, the maximum discharge pressure: a smaller plunger pumps less but at higher pressure. Packing is a stack of rings in a stuffing box with a lubrication feed.', 'Plunger sizes 3-3/4 to 5-1/2 in. typical; ceramic or coated plungers common.', 'Packing leaks spray at pressure; guards in place.', { level: 'part', hazards: [H.pressure] });

pp({ id: 'PP-MISSILE', parent: 'PP', group: 'manifold', level: 'equipment', name: 'Missile (manifold trailer)', aliases: ['missile', 'manifold trailer', 'frac manifold', 'HP manifold'], scene: 'PP-MISSILE',
  function: 'The trailer-mounted manifold with a low-pressure header that distributes slurry from the blender to every pump suction and a high-pressure header that collects every pump discharge into the treating line.',
  tabs: {
    overview: 'Pumps park nose-in on both sides of the missile. Each has a suction hose from the low-pressure header and a discharge line into the high-pressure header. The high-pressure header carries check valves per pump connection, pressure transducers, and the pressure relief valve for the spread, and its outlet feeds the treating line to the zipper manifold. Simultaneous schemes use a second missile or a split header so each well has its own metered leg.',
    engineering: 'High-pressure header rated to 15,000 psi with flanged or clamp connections in newer designs and hammer unions in older ones; low-pressure header is a large-bore steel manifold with butterfly valves per pump.',
    connections: 'Blender discharge to the low-pressure header; pump suctions and discharges; treating line from the high-pressure outlet; PRV vent line to a tank.',
    safety: 'The high-pressure header is the center of the red zone; the PRV lifts here on overpressure; check valves keep a failed pump from being backflowed.',
    specs: 'Twelve to twenty pump connections per side is common; PRV set below the iron rating.',
    evidence: EVP,
    operations: 'Set first when the spread rigs up; pumps and the blender are positioned around it.',
    failure_modes: 'Check valve failures, header erosion at the outlet, PRV weeping, hose failures on the suction side.',
  }, hazards: [H.pressure, H.lof] });
ppc('PP-MISSILE-HPHEADER', 'PP-MISSILE', 'manifold', 'High-pressure header', ['HP header', 'discharge header', 'treating header'], 'The header that collects every pump discharge into the treating line, with check valves, transducers, and the pressure relief valve.',
  'Pump discharge lines enter through check valves so a stopped pump cannot be backflowed; the outlet goes to the treating line. Pressure is read here for the data van and the kickout setting.', 'Rated to the treating pressure; erosion-checked at the outlet turn.', 'Center of the red zone; PRV discharge routed to a safe point.', { scene: 'PP-MISSILE-HPHEADER', drawn_in_3d: true, hazards: [H.pressure, H.lof] });
ppc('PP-MISSILE-LPHEADER', 'PP-MISSILE', 'manifold', 'Low-pressure header', ['LP header', 'suction header', 'suction manifold'], 'The large-bore header fed by the blender discharge that supplies slurry to every pump suction through hoses and butterfly valves.',
  'Kept full and slightly pressurized by the blender discharge pump so the frac pumps do not cavitate; each pump connection has an isolation valve and a suction hose.', 'Large bore, low pressure; hose sizes 4 to 6 in.', 'Hose failures spray slurry at low pressure; butterfly valve handles are pinch points.', { scene: 'PP-MISSILE-LPHEADER', drawn_in_3d: true, hazards: [H.pinch] });

pp({ id: 'PP-BLENDER', parent: 'PP', group: 'fluid', level: 'equipment', name: 'Blender', aliases: ['frac blender', 'slurry blender', 'blender truck'], scene: 'PP-BLENDER',
  function: 'The unit that draws water, adds proppant and chemicals at the design concentration, and discharges slurry to the missile at the rate the pumps take it.',
  tabs: {
    overview: 'Water enters through the suction pump into the tub; augers (screws) meter sand from the sand system into the tub; liquid additive pumps and dry feeders add chemicals; the tub agitates the mix; the discharge pump pushes the slurry to the missile at a pressure high enough to feed the frac pump suctions. Concentration in pounds of proppant added per gallon (PPA) is controlled by the auger speed against the water rate.',
    engineering: 'Suction and discharge pumps are large centrifugal pumps; tub volume is small so concentration changes take effect in seconds; densitometers on the discharge check the mix. Proppant delivery of several thousand pounds per minute at full rate.',
    connections: 'Suction from frac tanks or the hydration unit; sand from the conveyor; chemicals from the additive unit; discharge to the missile low-pressure header.',
    safety: 'Rotating augers and belts; sand dust at the hopper; slurry spray at hose failures.',
    specs: 'Typical 100 to 130 bpm slurry capacity; two or three augers; discharge pressure to about 100 psi.',
    evidence: EVP,
    operations: 'The blender operator follows the pump schedule from the data van: rate up, sand in stages, flush at the end.',
    failure_modes: 'Tub level upsets, auger plugging, densitometer drift, discharge pump seal failure.',
  }, specs: [{ name: 'Slurry capacity, typical', value: '100 to 130', unit: 'bpm', tier: 'E3', source: 'S9' }], hazards: [H.pinch, H.dust, H.noise] });
ppc('PP-BLENDER-TUB', 'PP-BLENDER', 'fluid', 'Mixing tub', ['tub', 'blender tub'], 'The open agitated tank where water, proppant, and chemicals meet before the discharge pump.',
  'A small tub with paddle agitators and level control; small volume gives fast response to concentration changes and means the level must be held closely against the pumps.', 'Volume a few barrels; level sensors and an overflow.', 'Rotating agitator; open tub.', { scene: 'PP-BLENDER-TUB', drawn_in_3d: true, hazards: [H.pinch] });
ppc('PP-BLENDER-AUGER', 'PP-BLENDER', 'fluid', 'Sand augers', ['augers', 'sand screws', 'proppant screws'], 'The inclined screws that meter proppant from the hopper into the tub at a rate set by their speed.',
  'Two or three screws of different sizes cover the concentration range; calibrated pounds per revolution let the controller set PPA from screw speed and water rate.', 'Delivery to several thousand pounds per minute combined.', 'Rotating screws; dust at the hopper.', { scene: 'PP-BLENDER-AUGER', drawn_in_3d: true, hazards: [H.pinch, H.dust] });
ppc('PP-BLENDER-SUCTIONPUMP', 'PP-BLENDER', 'fluid', 'Suction (clean side) pump', ['suction pump', 'clean side pump', 'charge pump'], 'The centrifugal pump that draws water from the tanks or hydration unit into the tub.',
  'Sized above the maximum slurry rate so the tub never starves; suction hoses from the tanks are large bore.', 'Large centrifugal pump, low head.', 'Suction hose collapse and seal leaks.', { scene: 'PP-BLENDER-SUCTIONPUMP', drawn_in_3d: true, hazards: [H.pinch] });
ppc('PP-BLENDER-DISCHARGEPUMP', 'PP-BLENDER', 'fluid', 'Discharge (dirty side) pump', ['discharge pump', 'dirty side pump', 'slurry pump'], 'The centrifugal pump that pushes slurry from the tub to the missile at enough pressure to charge the frac pump suctions.',
  'Abrasion-resistant impeller and liners because it moves proppant-laden fluid; discharge pressure is what keeps the frac pumps from cavitating.', 'Slurry-rated centrifugal pump, discharge to about 100 psi.', 'Seal failures spray slurry; hoses restrained.', { scene: 'PP-BLENDER-DISCHARGEPUMP', drawn_in_3d: true, hazards: [H.pinch] });
ppc('PP-BLENDER-LIQUIDADD', 'PP-BLENDER', 'fluid', 'Liquid additive pumps', ['LA pumps', 'chemical pumps', 'additive pumps'], 'The metering pumps on the blender that inject friction reducer, biocide, scale inhibitor, and other liquid chemicals into the tub in proportion to the water rate.',
  'Positive-displacement metering pumps with flow meters; setpoints in gallons per thousand gallons of water come from the treatment design and are logged in the data van.', 'Small metering pumps; rates in gallons per minute.', 'Chemical handling per the safety data sheets; splash protection.', { hazards: [H.pinch] });

pp({ id: 'PP-HYDRATION', parent: 'PP', group: 'fluid', level: 'equipment', name: 'Hydration unit', aliases: ['hydration', 'gel unit', 'hydration trailer'], scene: 'PP-HYDRATION',
  function: 'The trailer with a series of tanks that gives gelling polymer time to hydrate in water before the blender, used when the treatment calls for a gel or hybrid fluid rather than plain slickwater.',
  tabs: { overview: 'Water and polymer are mixed at the inlet and flow through several agitated compartments in series so the polymer has residence time to build viscosity before the blender adds proppant. On slickwater jobs the unit is bypassed or used as a surge tank.', engineering: 'Compartment volume sets residence time at rate; agitators and a discharge pump; polymer feed by dry feeder or liquid concentrate.', connections: 'Suction from frac tanks; discharge to the blender suction.', safety: 'Open agitated tanks; slippery polymer spills.', evidence: EVP, operations: 'Filled and hydrated ahead of the stage when gel is used.', failure_modes: 'Fish eyes from poor mixing, viscosity below target, agitator failures.' }, hazards: [H.pinch] });
pp({ id: 'PP-CHEMADD', parent: 'PP', group: 'fluid', level: 'equipment', name: 'Chemical additive unit', aliases: ['chem add', 'additive trailer', 'chemical unit'], scene: 'PP-CHEMADD',
  function: 'The trailer carrying the chemical totes or tanks and the metering pumps that supply friction reducer, biocide, scale inhibitor, surfactant, and breaker to the blender.',
  tabs: { overview: 'Chemicals arrive in totes or bulk tanks on the unit; metering pumps deliver each one at a rate proportional to the water rate, and the data van logs the totals per stage. Heated tanks keep viscous products flowing in winter.', engineering: 'Metering pumps with flow meters per chemical; containment under the tanks; remote control from the data van.', connections: 'Chemical lines to the blender tub and to the hydration unit.', safety: 'Chemical handling and containment; splash protection; SDS on location.', evidence: EVP, operations: 'Chemical volumes are reconciled per stage against the design.', failure_modes: 'Pump loss of prime, frozen lines, wrong concentration.' }, hazards: [H.pinch] });
pp({ id: 'PP-DATAVAN', parent: 'PP', group: 'control', level: 'equipment', name: 'Data van', aliases: ['data van', 'frac van', 'control van', 'treatment van'], scene: 'PP-DATAVAN',
  function: 'The control cabin where the treating supervisor directs the stage: every pump, the blender, and the chemical unit are controlled and every pressure, rate, and concentration is recorded here.',
  tabs: { overview: 'Screens show surface treating pressure, slurry and clean rates, proppant concentration, chemical rates, and per-pump status. The supervisor sets rate, calls sand, watches for screenout trends, and stops the job on an overpressure. The van holds the pressure kickout settings for the pumps and communicates with the wireline unit and the zipper valve operator.', engineering: 'Data acquisition from transducers on the missile and tree, densitometers, and flow meters; pump control networks; recording at one-second or faster intervals.', connections: 'Data links to every unit, the zipper control panel, and the wireline unit; treating pressure transducers on the missile and the tree.', safety: 'Located outside the red zone; the kickout setting is the pressure safeguard.', evidence: EVP, operations: 'Staffed continuously while pumping; post-job data goes to the operator.', failure_modes: 'Transducer faults, lost pump communication, recording gaps.' }, hazards: [H.noise] });
pp({ id: 'PP-FRACTANKS', parent: 'PP', group: 'water', level: 'equipment', name: 'Frac tanks and working tanks', aliases: ['frac tanks', '500 bbl tanks', 'working tanks', 'water storage'], scene: 'PP-FRACTANKS',
  function: 'The 500 bbl tanks (or a lined pit and transfer system) that hold water at the pad and feed the blender suction at the rate the stage needs.',
  tabs: { overview: 'Tanks are manifolded together so the blender draws from many at once; transfer pumps refill them from the pit or the water line while pumping. Working tank count is set by the stage volume and the refill rate.', engineering: 'Steel tanks with suction manifolds; large-bore lay-flat hose from the source.', connections: 'Suction manifold to the blender and hydration unit; fill line from the water transfer pumps.', safety: 'Confined spaces inside tanks; slips on wet ground; hose handling.', evidence: EVP, operations: 'Water is staged ahead of the pumps; levels tracked per stage.', failure_modes: 'Running the working tanks dry, frozen suctions, valve leaks.' }, hazards: [H.pinch] });
pp({ id: 'PP-SANDHANDLING', parent: 'PP', group: 'proppant', level: 'equipment', name: 'Sand handling: silos, boxes, and conveyor', aliases: ['sand silos', 'sand boxes', 'proppant system', 'sand king', 'sand conveyor'], scene: 'LG-SANDSILOS',
  function: 'The storage and delivery system that receives proppant from trucks, holds it in silos or boxes, and meters it onto the belt that feeds the blender hopper.',
  tabs: { overview: 'Vertical silos with pneumatic or belt fill, or stackable boxes set by a forklift, hold enough sand for several stages. Gates at the bottom drop sand onto a conveyor that feeds the blender hopper; dust collection and enclosed transfer points control silica exposure. Delivery trucks are the pacing item on high-rate jobs.', engineering: 'Capacity in pounds per silo or box; conveyor rate above the blender demand; dust controls per the silica rules.', connections: 'Truck unloading; conveyor to the blender augers.', safety: 'Respirable silica; conveyor pinch points; vehicle traffic.', evidence: EVP, operations: 'Filled continuously during the job; inventory reconciled per stage.', failure_modes: 'Bridging in silos, belt failures, wet sand, running out between trucks.' }, hazards: [H.dust, H.pinch] });
pp({ id: 'PP-POWERGEN', parent: 'PP', group: 'power', level: 'equipment', name: 'Power generation for electric fleets', aliases: ['turbine', 'gensets', 'e-frac power', 'grid connection'],
  function: 'The gas turbines, reciprocating gensets, or grid tie that supply an electric frac fleet, replacing the diesel engines on the pump trailers.',
  tabs: { overview: 'An electric fleet runs its pumps, blender, and support units on electric motors fed from a power plant on location: turbine generators burning field gas, gas reciprocating gensets, or a utility line where available. Fuel cost, noise, and emissions drop; the power plant and switchgear become critical equipment.', engineering: 'Tens of megawatts per fleet; medium-voltage switchgear and cables; variable-frequency drives at the pumps.', connections: 'Gas supply or grid; power cables to every unit.', safety: 'High-voltage cables and switchgear; gas handling at the turbines.', evidence: 'Public industry reporting on electric fleets (S18); field practice (S9).', operations: 'Set up once per pad; load follows the pumping schedule.', failure_modes: 'Turbine trips, cable damage, gas supply interruptions.' }, hazards: [H.hot, H.noise], sources: ['S9', 'S18'] });
pp({ id: 'PP-SUCTIONHOSE', parent: 'PP', group: 'manifold', level: 'equipment', name: 'Suction hoses and low-pressure iron', aliases: ['suction hose', 'LP hose', 'lay-flat', 'suction line'],
  function: 'The large-bore hoses and low-pressure piping that move water from the tanks to the blender and slurry from the blender to the missile and pump suctions.',
  tabs: { overview: 'Low pressure but high volume: hoses of 4 to 10 in. carry the full slurry rate. Kinks and collapsed suctions starve the frac pumps and cause cavitation, which damages fluid ends, so hose runs are laid straight and short.', engineering: 'Rated for suction and slurry; cam-lock or hammer-union ends.', connections: 'Tanks to blender; blender to missile; missile to each pump suction.', safety: 'Hose whip on failure; trip hazards; pinch points at connections.', evidence: EVP, operations: 'Laid out at rig-up; inspected each stage.', failure_modes: 'Collapse, leaks at ends, wear from proppant.' }, hazards: [H.pinch] });

// ================================================================ DT system
const EVD = 'Public plug-and-perf explainer (S20), API Spec 11D1 scope (S21), field practice (S9). Dimensions are public example values, not a manufacturer\'s design.';
const dt = (o) => save({ status: 'draft', evidence_tier: 'E2', reviewers: [], system: 'DT', drawn_in_3d: false, sources: ['S9', 'S20', 'S21'], revision: rev('Drop 4 seed'), hazards: [H.pressure], ...o });
const PLUG_GLB = '/glb/DT/DT-PLUGSET.glb';
const dtc = (id, parent, group, name, aliases, fn, over, eng, safety, nodes, extra = {}) => dt({ id, parent, group, level: 'component', name, aliases, function: fn, tabs: { overview: over, engineering: eng, safety, evidence: EVD, ...(extra.tabs || {}) }, drawn_in_3d: !!nodes, ...(nodes ? { glb: PLUG_GLB, mesh_nodes: nodes } : {}), ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'tabs')) });

dt({ id: 'DT', level: 'system', name: 'Downhole completion tools and multistage systems', aliases: ['downhole tools', 'plugs and sleeves', 'multistage'],
  function: 'The tools that live in the casing during the completion: frac plugs and the setting tools that place them, sleeves and toe initiators, liner hangers, and the bridge plugs and retainers used for isolation.',
  tabs: {
    overview: 'Plug-and-perf completions use one frac plug per stage: set on wireline below the new perforations, it isolates every stage already treated, takes the frac pressure on its top, and is milled out or dissolves after the last stage. Sleeve systems replace plugs and perforating with ports opened by dropped balls or shifting tools. Liner hangers suspend the production liner in the intermediate casing when the lateral is cased as a liner. Bridge plugs and cement retainers isolate zones permanently or for remedial work.',
    engineering: 'Plugs are composite (millable) or dissolvable; ratings of 10,000 psi differential and temperatures to 300 F are common. Setting is by wireline setting tool or coiled tubing. API Spec 11D1 governs the qualification of packers and bridge plugs by grade.',
    connections: 'Run on the wireline tool string (WL) or coiled tubing (CT); set in the production casing (CM); milled by the coiled tubing drillout BHA.',
    safety: 'Setting tools carry a power charge; plugs under differential pressure store energy; milling debris returns to surface with the flowback.',
    specs: 'Frac plug run-in OD about 4.3 to 4.4 in. for 5-1/2 in. casing; set in seconds; mill-out times of minutes per plug with a good mill and adequate returns.',
    evidence: EVD, operations: 'One plug per stage, toe to heel; drillout heel to toe after the last stage; dissolvable plugs skip the drillout.',
    failure_modes: 'Pre-set in the vertical, slips not holding, element leaking, plug spinning during mill-out, ball not seating, debris packing off the coiled tubing.',
  }, hazards: [H.pressure, H.explosives], sources: ['S9', 'S20', 'S21'] });

dt({ id: 'DT-PLUGSET', parent: 'DT', group: 'plug-and-perf', level: 'equipment', name: 'Frac plug on setting tool in casing (cut-away)', aliases: ['plug set', 'plug on setting tool', 'setting the plug'],
  function: 'The teaching assembly: a composite frac plug at the moment of setting inside 5-1/2 in. casing, with the setting sleeve and sheared tension rod of the adapter kit and the pressure setting assembly above it.',
  tabs: {
    overview: 'Use the section and translucent tools to look through the casing. From the bottom: the plug mandrel with its guide, the lower slips already expanded on their cone into the casing wall, the compressed element, the upper cone and slips, and the ball seat at the top of the mandrel with the ball landed. Above the plug sit the setting sleeve that pushed the slips and element down, the tension rod that held the mandrel up until the shear ring parted, and the body of the pressure setting assembly that produced the stroke.\n\nIn the well this happens at the bottom of the tool string, below the perforating guns, at the depth chosen so the new perforations are above the plug.',
    engineering: 'The casing is a public 5-1/2 in. 20 lb/ft dimension (ID 4.778 in.); the plug is a public example 4.375 in. OD. Every other proportion is generic.',
    connections: 'The setting tool threads to the wireline tool string; the plug is left in the casing.',
    safety: 'The setting tool carries a power charge handled under the explosives rules; a plug set under pressure stores energy.',
    evidence: EVD, operations: 'Once per stage.', failure_modes: 'See the plug and setting tool components.',
  }, drawn_in_3d: true, glb: PLUG_GLB, ghost_nodes: ['DT-PLUGSET-CASING'],
  mesh_nodes: ['DT-PLUGSET-CASING', 'DT-FRACPLUG-MANDREL', 'DT-FRACPLUG-SLIPSDOWN', 'DT-FRACPLUG-CONEDOWN', 'DT-FRACPLUG-ELEMENT', 'DT-FRACPLUG-CONEUP', 'DT-FRACPLUG-SLIPSUP', 'DT-FRACPLUG-BALLSEAT', 'DT-FRACPLUG-BALL', 'DT-SETTINGTOOL-SLEEVE', 'DT-SETTINGTOOL-ROD', 'DT-SETTINGTOOL-SHEAR', 'DT-SETTINGTOOL-BODY'],
  hazards: [H.pressure, H.explosives] });
dtc('DT-PLUGSET-CASING', 'DT-PLUGSET', 'plug-and-perf', 'Production casing section (5-1/2 in.)', ['casing', 'production casing', '5-1/2 casing'],
  'The section of production casing the plug sets in, drawn translucent so the tools inside can be seen.',
  'Casing ID sets the plug OD and the clearance that lets the string be pumped down; 5-1/2 in. 20 lb/ft has a 4.778 in. ID. Slips bite into this wall; the element seals against it.', 'API 5CT casing; grade and weight per the well design.', 'Casing wear from pump-down and milling is a long-term concern.', ['DT-PLUGSET-CASING'], { specs: [{ name: 'Casing ID, 5-1/2 in. 20 lb/ft', value: 4.778, unit: 'in.', tier: 'E2', source: 'S10' }] });

dt({ id: 'DT-FRACPLUG', parent: 'DT-PLUGSET', group: 'plug-and-perf', level: 'equipment', name: 'Composite frac plug', aliases: ['frac plug', 'composite plug', 'ball-drop plug', 'plug'],
  function: 'The set-and-mill isolation plug: a composite mandrel with cones, slips, and an element that anchors and seals in the casing, and a ball seat that a dropped ball lands on to isolate the stages below.',
  tabs: {
    overview: 'Run on the bottom of the wireline tool string, the plug is set by the setting tool: the element is compressed first, then the slips ride up their cones and bite the casing, then the tension rod shears and the string pulls free. A ball pumped down after the guns are pulled lands on the seat and the plug holds the frac pressure from above. After the last stage a coiled tubing mill grinds the composite away; the small hardened parts wash to the next plug and out with flowback.',
    engineering: 'Composite (filament-wound or molded) mandrel and cones for fast milling; cast iron or ceramic slip segments with carbide buttons; an elastomer element; ratings to 10,000 psi differential and 300 F are common. Length and OD are chosen for the casing and the pump-down clearance.',
    connections: 'Below the setting tool adapter kit on the tool string; sets in the production casing.',
    safety: 'A plug holding pressure is stored energy; pressure is equalized before milling through.',
    specs: 'Public example: 4.375 in. OD in 5-1/2 in. casing, about 0.2 in. of radial clearance (S20).',
    evidence: EVD, operations: 'One per stage; all milled after the last stage.', failure_modes: 'Pre-set in the vertical from pump-down drag, slips slipping under pressure, element extrusion, plug spinning during milling, ball not seating.',
  }, drawn_in_3d: true, glb: PLUG_GLB, mesh_nodes: ['DT-FRACPLUG-MANDREL', 'DT-FRACPLUG-SLIPSDOWN', 'DT-FRACPLUG-CONEDOWN', 'DT-FRACPLUG-ELEMENT', 'DT-FRACPLUG-CONEUP', 'DT-FRACPLUG-SLIPSUP', 'DT-FRACPLUG-BALLSEAT', 'DT-FRACPLUG-BALL'],
  specs: [{ name: 'Run-in OD, example', value: 4.375, unit: 'in.', tier: 'E2', source: 'S20' }], standards: [{ standard: 'API Spec 11D1', edition: 'verify', paraphrase: 'Qualification grades and testing for packers and bridge plugs; frac plugs are commonly qualified to its validation grades.', source: 'S21' }] });
dtc('DT-FRACPLUG-MANDREL', 'DT-FRACPLUG', 'plug-and-perf', 'Mandrel and guide', ['mandrel', 'plug body', 'mule shoe'], 'The composite tube that every other plug part is stacked on, with the guide at the bottom that leads the plug through the casing.',
  'Holds the ball seat at the top and the shear connection to the setting tool; the tension rod pulls the mandrel up while the sleeve pushes the slips and element down, so the parts compress against each other. Composite so the mill cuts it fast.', 'Composite, sized for the casing; bore for flow-through when the ball is not on seat.', 'The stub left after milling must be small enough to wash down.', ['DT-FRACPLUG-MANDREL']);
dtc('DT-FRACPLUG-SLIPSDOWN', 'DT-FRACPLUG', 'plug-and-perf', 'Lower slips', ['lower slips', 'bottom slips', 'slip segments'], 'The segmented ring below the element that rides up the lower cone and bites the casing to hold the plug against pressure from above.',
  'Segments break apart on setting and are driven outward by the cone; carbide buttons or wickers bite the casing wall. The lower set takes the frac load, the upper set holds against pressure from below.', 'Cast iron or ceramic segments with carbide inserts; sized to the casing ID.', 'Segments and buttons are the hardened debris left after milling.', ['DT-FRACPLUG-SLIPSDOWN']);
dtc('DT-FRACPLUG-CONEDOWN', 'DT-FRACPLUG', 'plug-and-perf', 'Lower cone', ['cone', 'lower cone', 'wedge'], 'The tapered composite ring that wedges the lower slips outward as the plug is compressed.',
  'Cone angle sets the setting force needed and the holding force gained; composite so it mills quickly.', 'Composite; angle per the design.', 'None beyond the plug as a whole.', ['DT-FRACPLUG-CONEDOWN']);
dtc('DT-FRACPLUG-ELEMENT', 'DT-FRACPLUG', 'plug-and-perf', 'Sealing element', ['element', 'packing element', 'rubber'], 'The elastomer ring between the cones that is compressed until it seals against the casing wall.',
  'Compressed first in the setting sequence; backup rings limit extrusion under pressure. Material chosen for the temperature and the fluids.', 'Elastomer with backups; rated differential and temperature.', 'Extrusion under high differential is the seal failure mode.', ['DT-FRACPLUG-ELEMENT']);
dtc('DT-FRACPLUG-CONEUP', 'DT-FRACPLUG', 'plug-and-perf', 'Upper cone', ['upper cone'], 'The tapered ring above the element that wedges the upper slips outward.', 'Mirror of the lower cone.', 'Composite.', 'None beyond the plug.', ['DT-FRACPLUG-CONEUP']);
dtc('DT-FRACPLUG-SLIPSUP', 'DT-FRACPLUG', 'plug-and-perf', 'Upper slips', ['upper slips', 'top slips'], 'The segmented ring above the element that holds the plug against pressure from below and keeps the element compressed.',
  'Set after the lower slips as the sleeve continues to stroke; holds the stack together once the setting tool releases.', 'As the lower slips.', 'As the lower slips.', ['DT-FRACPLUG-SLIPSUP']);
dtc('DT-FRACPLUG-BALLSEAT', 'DT-FRACPLUG', 'plug-and-perf', 'Ball seat', ['seat', 'ball seat'], 'The tapered seat at the top of the mandrel that the dropped ball lands on to close the plug.',
  'Seat diameter sets the ball size; flow-through when the ball is absent lets the well flow back through the plug before drillout in some designs.', 'Composite or metal insert.', 'None beyond the plug.', ['DT-FRACPLUG-BALLSEAT']);
dtc('DT-FRACPLUG-BALL', 'DT-FRACPLUG', 'plug-and-perf', 'Frac ball', ['ball', 'drop ball', 'dissolvable ball'], 'The ball dropped from surface and pumped down to land on the seat so the stage above can be treated.',
  'Composite or dissolvable metal; sized to the seat with margin; dropped through the tree with the ball launcher and carried down by the pump rate.', 'Ball size per the seat; dissolvable alloys chosen for the well fluid and temperature.', 'A ball that does not seat leaves the stage below open to the treatment.', ['DT-FRACPLUG-BALL']);

dt({ id: 'DT-SETTINGTOOL', parent: 'DT-PLUGSET', group: 'plug-and-perf', level: 'equipment', name: 'Wireline setting tool and adapter kit', aliases: ['setting tool', 'pressure setting assembly', 'adapter kit', 'power charge setting tool'],
  function: 'The tool at the bottom of the wireline string that burns a slow power charge to build gas pressure, converts it into a controlled stroke through a piston, and pushes the plug into its set through the adapter kit, then shears free.',
  tabs: {
    overview: 'The pressure setting assembly is a sealed cylinder with a piston; the power charge ignited by the firing head burns slowly and drives the piston. The adapter kit converts the stroke to the plug: a setting sleeve that pushes down on the top slips and a tension rod inside that holds the mandrel up. When the plug is fully set the load reaches the shear value, the shear ring parts, and the tool pulls free of the plug.',
    engineering: 'Stroke and force are set by the charge and the piston area; the shear ring value is matched to the plug. Larger tools set larger plugs.',
    connections: 'Threads to the tool string below the guns; adapter kit to the plug.',
    safety: 'A power charge is an explosive item handled under the site explosives rules; a misfire leaves an armed tool that is handled by the licensed crew.',
    specs: 'Set in seconds once ignited; shear values in thousands of pounds.',
    evidence: EVD, operations: 'Redressed and reloaded between runs.', failure_modes: 'Misfire, incomplete stroke leaving the plug partly set, premature shear.',
  }, drawn_in_3d: true, glb: PLUG_GLB, mesh_nodes: ['DT-SETTINGTOOL-SLEEVE', 'DT-SETTINGTOOL-ROD', 'DT-SETTINGTOOL-SHEAR', 'DT-SETTINGTOOL-BODY'], hazards: [H.explosives, H.pressure] });
dtc('DT-SETTINGTOOL-SLEEVE', 'DT-SETTINGTOOL', 'plug-and-perf', 'Setting sleeve', ['sleeve', 'setting sleeve', 'adapter sleeve'], 'The outer sleeve of the adapter kit that bears on the top of the plug and pushes the slips and element down during the stroke.', 'Sized to the plug OD; reused after redress.', 'Steel sleeve.', 'None beyond the tool.', ['DT-SETTINGTOOL-SLEEVE']);
dtc('DT-SETTINGTOOL-ROD', 'DT-SETTINGTOOL', 'plug-and-perf', 'Tension rod', ['tension rod', 'tension mandrel', 'inner rod'], 'The inner rod of the adapter kit that holds the plug mandrel up while the sleeve pushes down, so the plug compresses.', 'Loads through the shear ring; retrieved with the tool.', 'Steel rod; thread to the plug shear connection.', 'None beyond the tool.', ['DT-SETTINGTOOL-ROD']);
dtc('DT-SETTINGTOOL-SHEAR', 'DT-SETTINGTOOL', 'plug-and-perf', 'Shear ring', ['shear ring', 'shear stud', 'release'], 'The calibrated ring or stud that parts at the design load once the plug is fully set, releasing the tool from the plug.', 'Shear value is set above the setting load and below the tool capacity.', 'Replaced each run.', 'A wrong value leaves the tool attached or shears early.', ['DT-SETTINGTOOL-SHEAR']);
dtc('DT-SETTINGTOOL-BODY', 'DT-SETTINGTOOL', 'plug-and-perf', 'Pressure setting assembly body', ['setting tool body', 'PSA', 'power charge chamber'], 'The cylinder above the adapter kit where the power charge burns and the piston converts gas pressure into the setting stroke.', 'Charge size and piston area set the force; bleed ports vent after the set.', 'Steel body rated for the charge pressure.', 'Explosive item; misfire procedures per the explosives rules.', ['DT-SETTINGTOOL-BODY'], { hazards: [H.explosives] });

dt({ id: 'DT-DISSOLVABLEPLUG', parent: 'DT', group: 'plug-and-perf', level: 'equipment', name: 'Dissolvable frac plug', aliases: ['dissolvable plug', 'degradable plug', 'disappearing plug'],
  function: 'A frac plug whose mandrel, cones, slips, and ball are made of alloys and polymers that dissolve in the well fluid after the treatment, removing the need for a drillout.',
  tabs: { overview: 'Set and used like a composite plug; after the last stage the well is left shut in or flowed while the parts degrade over days. Dissolution rate depends on temperature and brine salinity, so the well design sets the choice.', engineering: 'Magnesium or aluminum alloys and degradable elastomers; ratings similar to composites; some designs mix a dissolvable body with millable slips.', connections: 'As the composite plug.', safety: 'As the composite plug; no milling debris.', evidence: EVD, operations: 'Skips or shortens the coiled tubing drillout.', failure_modes: 'Slow dissolution in cool or fresh water, premature loss of pressure rating.' } });
dt({ id: 'DT-FRACSLEEVE', parent: 'DT', group: 'sleeves', level: 'equipment', name: 'Ball-drop frac sleeve', aliases: ['frac sleeve', 'ball-activated sleeve', 'sliding sleeve', 'port collar'],
  function: 'A casing or liner component with ports covered by an inner sleeve that a dropped ball shifts open, letting a stage be treated without perforating.',
  tabs: { overview: 'Sleeves are run as part of the casing string, one per stage, with graduated ball seats: each ball is slightly larger than the last and passes every seat until its own. Landing on the seat, pressure shifts the sleeve open and the ball also isolates the stages below. After the job the seats are milled or the balls dissolve.', engineering: 'Seat sizes step by small increments, which limits the number of stages per string; seats are milled out to restore full bore.', connections: 'Threaded into the casing or liner string.', safety: 'No explosives; sleeve pressure rating is part of the string design.', evidence: EVD, operations: 'Continuous pumping between stages; no wireline runs.', failure_modes: 'Ball passing its seat, sleeve failing to shift, seat erosion.' } });
dt({ id: 'DT-TOESLEEVE', parent: 'DT', group: 'sleeves', level: 'equipment', name: 'Toe sleeve (toe initiator)', aliases: ['toe sleeve', 'toe initiator', 'pressure-actuated sleeve', 'toe valve'],
  function: 'The pressure-actuated sleeve at the toe of the lateral that opens the first path to the formation without a wireline run, so the first stage can be pumped and the tool string pumped down for stage two.',
  tabs: { overview: 'Cemented in with the casing at the toe; a pressure cycle above the casing test pressure opens its ports. Without it the first stage would need tractor-conveyed or coiled tubing perforating because there is no flow path to pump the string down.', engineering: 'Opening pressure set above the casing test pressure with a margin; often a time delay or a rupture disc.', connections: 'Threaded into the casing string near the toe.', safety: 'The casing test and the sleeve opening pressure must be sequenced correctly.', evidence: EVD, operations: 'Opened before the first stage; used once.', failure_modes: 'Opening during the casing test, failing to open, cement in the ports.' } });
dt({ id: 'DT-LINERHANGER', parent: 'DT', group: 'liner', level: 'equipment', name: 'Liner hanger and top packer', aliases: ['liner hanger', 'liner top packer', 'hanger packer', 'liner system'],
  function: 'The tool that suspends the production liner inside the intermediate casing and seals the liner top, when the lateral is completed as a liner rather than a full casing string.',
  tabs: { overview: 'Run on the liner with a running tool; slips set hydraulically or mechanically to hang the liner weight, cement is pumped, and the top packer is set to seal the liner top. A tieback receptacle above allows a tieback string later. Frac loads through a liner top are a design check.', engineering: 'Hanger capacity in liner weight; packer differential rating; expandable and conventional slip designs.', connections: 'Liner below; intermediate casing around; tieback above.', safety: 'Pressure testing the liner top before the frac.', evidence: EVD, operations: 'Set once during the well construction.', failure_modes: 'Liner top leaks, slips not holding, cement channel at the top.' }, sources: ['S9', 'S21'] });
dt({ id: 'DT-BRIDGEPLUG', parent: 'DT', group: 'isolation', level: 'equipment', name: 'Bridge plug and cement retainer', aliases: ['bridge plug', 'permanent bridge plug', 'retrievable bridge plug', 'cement retainer', 'CIBP'],
  function: 'Isolation plugs for the wellbore itself: a bridge plug seals the casing permanently or retrievably, and a cement retainer holds cement squeezed through it.',
  tabs: { overview: 'Used to abandon a zone, isolate a lower interval for a test, or hold cement during a squeeze. Set on wireline or tubing. API Spec 11D1 defines validation grades for packers and bridge plugs; frac plugs borrow the same grades.', engineering: 'Cast iron or composite; retrievable designs release by pulling or rotating.', connections: 'Set in casing; retainer has a valve for the cement stinger.', safety: 'Pressure above and below equalized before retrieval.', evidence: EVD, operations: 'Remedial and abandonment work rather than the stage cycle.', failure_modes: 'Seal leaks, slips damaging casing, retainer valve failing.' }, standards: [{ standard: 'API Spec 11D1', edition: 'verify', paraphrase: 'Design validation grades and functional testing for packers and bridge plugs.', source: 'S21' }] });

console.log('Drop 4 seed done');
