// Drop 7 seed: vertical zipper legs, missile low- and high-pressure sides, ball launcher, frac sleeve cut-away,
// fleet power, and the job design vocabulary behind the Pad Setup stage. Every new record is "draft".
// Run: node scripts/seed-drop7.mjs
import fs from 'node:fs';
import path from 'node:path';

const DATE = '2026-09-29';
const rev = (note) => ({ rev: 'A', author: 'AI draft', date: DATE, note });
const REC = (sys) => path.resolve('content/records', sys);
const load = (sys, id) => JSON.parse(fs.readFileSync(path.join(REC(sys), id + '.json'), 'utf8'));
const save = (r) => { fs.mkdirSync(REC(r.system), { recursive: true }); fs.writeFileSync(path.join(REC(r.system), r.id + '.json'), JSON.stringify(r, null, 2) + '\n'); };
const H = {
  pressure: { class: 'Stored pressure', control: 'Pressure test before pumping; bleed down and verify zero before breaking any connection.' },
  lof: { class: 'Line of fire', control: 'Restraints and whip checks on iron; exclusion zone around pressurized lines.' },
  erosion: { class: 'Erosion cut-out', control: 'Valves fully open or fully closed only; wall thickness checks on the most-used branch.' },
  pinch: { class: 'Pinch point', control: 'Hands clear of handwheels and actuators; lockout on hydraulic controls before work.' },
  noise: { class: 'Noise', control: 'Hearing protection in the pump area; electric fleets cut the level but do not remove it.' },
  electrical: { class: 'High voltage', control: 'Only qualified people inside the switchgear and cable exclusion zones; cables routed and marked.' },
  gas: { class: 'Fuel gas', control: 'Gas detection at the conditioning skid and generators; no ignition sources in the gas zone.' },
};

// ---- sources (public pages read for this drop; patents and articles are cited for the concepts they describe, not reproduced)
const srcPath = path.resolve('content/sources.json');
const sources = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const add = (s) => { if (!sources.find(x => x.id === s.id)) sources.push(s); };
add({ id: 'S31', title: 'US Patent 10,982,523, Frac manifold missile and fitting (junction fittings with radial feed bores; suction lines with multiple outlets; missile discharge to a single line to the zipper manifold)', publisher: 'Justia Patents (public record)', edition: '2021', access: 'Public', tier: 'E2', url: 'https://patents.justia.com/patent/10982523' });
add({ id: 'S32', title: 'US 2022/0307362 A1, Frac manifold isolation tool (per-well configuration units with a hydraulic and a manual valve, zipper spools between wells, supply header from the pump output)', publisher: 'Patsnap Eureka (public patent record)', edition: '2022', access: 'Public', tier: 'E2', url: 'https://eureka.patsnap.com/patent-US20220307362A1' });
add({ id: 'S33', title: 'Vertical zipper manifold frac rental page (vertical design that reduces footprint and limits sand accumulation)', publisher: 'SPM Oil and Gas (Caterpillar) product page', edition: 'read 2026', access: 'Public', tier: 'E2', url: 'https://www.spmoilandgas.com/en_US/products/new/spm-oil-and-gas/well-service-frac/frac-rental/114084.html' });
add({ id: 'S34', title: 'Completion Codes: plug and perf versus sliding sleeve systems, ball drop, coil-shifted and annular fracturing, dissolving balls', publisher: 'Hart Energy', edition: '2013 article', access: 'Public', tier: 'E3', url: 'https://hartenergy.com/exclusives/completion-codes-12498' });
add({ id: 'S35', title: 'US Patent 10,161,218, Ball injector for frac tree (ball cartridge, pressure isolation chamber between two valves, push rod launch)', publisher: 'Google Patents (public record)', edition: '2018', access: 'Public', tier: 'E2', url: 'https://patents.google.com/patent/US10161218' });
add({ id: 'S36', title: 'Data Illustrates Evolution of Fracturing Designs in Resource Plays (stage spacing, stage count, proppant and fluid intensity, rate per foot, slickwater and mesh trends)', publisher: 'The American Oil and Gas Reporter', edition: '2018', access: 'Public', tier: 'E3', url: 'https://www.aogr.com/magazine/cover-story/data-illustrates-evolution-of-fracturing-designs-in-resource-plays' });
add({ id: 'S37', title: 'Electric Frac Fleets Continue Evolving (dual fuel, turbine and reciprocating generation, hybrid and grid power, horsepower per unit)', publisher: 'The American Oil and Gas Reporter', edition: 'read 2026', access: 'Public', tier: 'E3', url: 'https://www.aogr.com/magazine/frac-facts/electric-frac-fleets-continue-evolving' });
add({ id: 'S38', title: 'Drilling Productivity Report regions (Anadarko, Appalachia, Bakken, Eagle Ford, Haynesville, Niobrara, Permian)', publisher: 'US Energy Information Administration', edition: 'read 2026', access: 'Public', tier: 'E2', url: 'https://www.eia.gov/petroleum/drilling/' });
fs.writeFileSync(srcPath, JSON.stringify(sources, null, 2) + '\n');

// ---- glossary
const gPath = path.resolve('content/glossary.json');
const glossary = JSON.parse(fs.readFileSync(gPath, 'utf8'));
const gadd = (g) => { const i = glossary.findIndex(x => x.term === g.term); if (i >= 0) glossary[i] = g; else glossary.push(g); };
gadd({ term: 'Zipper leg', aliases: ['well leg', 'zipper branch', 'vertical leg'], system: 'WH', record: 'WH-ZIPPER-LEG', definition: 'The per-well riser off the zipper header: a lower isolation valve and an upper working valve in series, then an elbow and outlet toward that well\'s tree.' },);
gadd({ term: 'Missile', aliases: ['manifold trailer', 'frac manifold trailer', 'discharge manifold'], system: 'PP', record: 'PP-MISSILE', definition: 'The manifold trailer in the middle of the pump rows: low-pressure suction headers on the outside edges feed the pumps; the high-pressure discharge header down the middle collects their output into one treating line.' });
gadd({ term: 'Ball launcher', aliases: ['ball injector', 'ball dropper', 'frac ball launcher'], system: 'WH', record: 'WH-FRACTREE-BALLLAUNCHER', definition: 'The magazine on top of the frac tree that releases graduated frac balls into the flow one at a time for sliding sleeve completions.' });
gadd({ term: 'Sliding sleeve completion', aliases: ['ball-drop completion', 'frac sleeve completion', 'openhole multistage', 'ball and seat'], system: 'DT', record: 'DT-FRACSLEEVE', definition: 'A multistage completion where frac sleeves run in the casing are opened one at a time by dropping balls of increasing size, instead of setting plugs and perforating with wireline.' });
gadd({ term: 'Proppant intensity', aliases: ['lb/ft', 'pounds per foot', 'sand loading'], system: 'PP', record: 'PP-JOBDESIGN', definition: 'Pounds of proppant pumped per foot of lateral; with fluid intensity (bbl/ft) it sizes the sand and water logistics for the pad.' });
gadd({ term: 'Stage spacing', aliases: ['stage length', 'feet per stage'], system: 'PP', record: 'PP-JOBDESIGN', definition: 'Lateral length divided by stage count; tighter spacing means more stages, more wireline runs or balls, and more time on the pad.' });
fs.writeFileSync(gPath, JSON.stringify(glossary, null, 2) + '\n');

// ================================================================ WH: zipper and ball launcher
const EVZ = 'Frac manifold and isolation patents (S31, S32), vertical zipper product page (S33), API 6A for the valves (S1), field practice (S9). Photographs read for proportion only.';
const ZGLB = '/glb/WH/WH-ZIPPER.7-15K.glb';
const ZVAR = [{ key: '5-15K', label: '5-1/8 in. 15K', glb: '/glb/WH/WH-ZIPPER.5-15K.glb' }, { key: '7-10K', label: '7-1/16 in. 10K', glb: '/glb/WH/WH-ZIPPER.7-10K.glb' }, { key: '7-15K', label: '7-1/16 in. 15K', glb: '/glb/WH/WH-ZIPPER.7-15K.glb' }];
const wh = (o) => save({ status: 'draft', evidence_tier: 'E2', reviewers: [], system: 'WH', drawn_in_3d: false, sources: ['S1', 'S9', 'S32'], revision: rev('Drop 7 seed'), hazards: [H.pressure], ...o });
const whc = (id, parent, group, name, aliases, fn, over, eng, safety, nodes, extra = {}) => wh({ id, parent, group, level: 'component', name, aliases, function: fn, tabs: { overview: over, engineering: eng, safety, evidence: EVZ, ...(extra.tabs || {}) }, drawn_in_3d: !!nodes, ...(nodes ? { glb: ZGLB, mesh_nodes: nodes, variants: ZVAR } : {}), ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'tabs')) });

{
  const r = load('WH', 'WH-ZIPPER');
  r.name = 'Zipper manifold (vertical legs)';
  r.aliases = ['zipper', 'frac manifold', 'zip manifold', 'vertical zipper', 'zipper manifold skid'];
  r.function = 'A skid-mounted manifold that takes the single treating line from the missile through an inlet isolation valve into a header, and routes it to one well at a time through a vertical leg per well, each leg with two valves in series, so pumping on one well and wireline or ball drop on another can alternate without moving iron.';
  r.tabs.overview = 'The treating line from the missile enters at the front of the skid through the inlet isolation valve into a low header that runs the length of the skid. Each well has a vertical leg off the header: a tee, a riser spool, the lower isolation valve, a short spool, the upper working valve, and a top elbow block whose flanged outlet points at the tree. Flanged treating spools run from that outlet up to the inlet block on the frac tree. A pressure transducer sits on each elbow, a bleed valve on the far end of the header, and the hydraulic control unit with its accumulator bottles operates every valve remotely with position indication.\n\nVertical legs keep the footprint short and let sand settle back into the flow instead of collecting in dead horizontal branches. On a multi-well pad the skid grows with the well count; in the simulator it stretches to the wells chosen, from one to sixteen, and in simul-frac, trimul-frac, and quad-frac the header feeds two, three, or four open legs at once.';
  r.tabs.engineering = 'Valves are the same API 6A gate valve family as the tree; 7-1/16 in. monoline legs cut connections and erosion compared with several 3 in. lines. The two valves per leg give double isolation of a well with wireline in the hole. Transducers, check valves where specified, and a relief line are fitted per the operator specification.';
  r.tabs.connections = 'Upstream: the missile high-pressure outlet through the inlet isolation valve. Downstream: one leg per well, flanged spools to the inlet block on the tree. Hydraulic: control unit.';
  r.tabs.operations = 'Sequence per stage: close both valves on the leg to the well going to wireline, open the lower isolation then the upper working valve on the well ready to frac, confirm positions, then bring pumps online. The inlet isolation valve is closed only with the pumps off.';
  r.mesh_nodes = ['WH-ZIPPER-SKID', 'WH-ZIPPER-INLETVALVE', 'WH-ZIPPER-INLETHEADER', 'WH-ZIPPER-LEG', 'WH-ZIPPER-ISOVALVE', 'WH-ZIPPER-VALVE', 'WH-ZIPPER-OUTLET', 'WH-ZIPPER-TRANSDUCER', 'WH-ZIPPER-BLEEDVALVE', 'WH-ZIPPER-HPU', 'WH-ZIPPER-ACCUMULATOR'];
  r.variants = ZVAR; r.glb = ZGLB;
  r.sources = ['S1', 'S9', 'S11', 'S31', 'S32', 'S33'];
  r.revision = rev('Drop 7: vertical legs with two valves each, inlet isolation valve from the missile');
  r.connections = [{ target: 'PP-MISSILE', direction: 'upstream', type: 'flanged', rating: '15K', note: 'flanged or hammer union' }, { target: 'WH-FRACTREE-INLETBLOCK', direction: 'downstream', type: 'flanged', rating: '15K', note: 'flanged spools' }, { target: 'WH-FRACVALVECONTROL', direction: 'upstream', type: 'hydraulic' }];
  save(r);
}
{
  const r = load('WH', 'WH-ZIPPER-VALVE');
  r.name = 'Leg working valves (upper valve of each leg)';
  r.aliases = ['zipper valve', 'working valve', 'upper zipper valve', 'frac valve (zipper)'];
  r.function = 'The upper hydraulic valve on each vertical leg, cycled once per stage to put that well on the spread or take it off.';
  r.tabs.overview = 'The working valve does the cycling: open to frac that well, closed to take it off the spread. The lower isolation valve below it stays open on wells in the frac rotation and closes only when the well goes to wireline or coiled tubing, giving two closed valves between the spread and a wellbore with tools in it. Being cycled every stage on every well, the working valves are the highest-cycle valves on the pad.';
  r.mesh_nodes = ['WH-ZIPPER-VALVE']; r.variants = ZVAR; r.glb = ZGLB; r.revision = rev('Drop 7: upper working valve of the vertical leg');
  save(r);
}
{
  const r = load('WH', 'WH-ZIPPER-OUTLET');
  r.name = 'Leg top elbow and flanged outlet';
  r.aliases = ['zipper outlet', 'leg elbow', 'zipper elbow', 'outlet flange (zipper)'];
  r.function = 'The elbow block on top of each leg that turns the flow from vertical to horizontal and carries the flanged outlet toward that well\'s tree.';
  r.tabs.overview = 'A studded block elbow with a flanged outlet spool; the flanged treating spools to the inlet block bolt on here. A pressure transducer port sits on top of the block.';
  r.mesh_nodes = ['WH-ZIPPER-OUTLET']; r.variants = ZVAR; r.glb = ZGLB; r.revision = rev('Drop 7: top elbow of the vertical leg');
  save(r);
}
{
  const r = load('WH', 'WH-ZIPPER-INLETHEADER');
  r.tabs.overview = 'The low header along the skid, fed through the inlet isolation valve at the front; each vertical leg tees off it. Flanged ends, supports to the skid, and the bleed valve at the far end.';
  r.mesh_nodes = ['WH-ZIPPER-INLETHEADER']; r.variants = ZVAR; r.glb = ZGLB; r.revision = rev('Drop 7: header under vertical legs');
  save(r);
}
for (const id of ['WH-ZIPPER-TRANSDUCER', 'WH-ZIPPER-BLEEDVALVE', 'WH-ZIPPER-SKID']) { const r = load('WH', id); r.variants = ZVAR; r.glb = ZGLB; r.revision = rev('Drop 7: rebound to the vertical zipper model'); save(r); }
whc('WH-ZIPPER-INLETVALVE', 'WH-ZIPPER', 'zipper-manifold', 'Inlet isolation valve (missile to zipper)', ['zipper inlet valve', 'missile isolation valve', 'header isolation valve', 'spread isolation valve'],
  'The hydraulic gate valve at the front of the zipper header that isolates the whole manifold from the missile treating line.',
  'Between the missile high-pressure outlet and the zipper header. Open for the job; closed to isolate the manifold for a leak repair or a valve change while the spread stays rigged. It is never closed against flow: the spread would deadhead against it and the relief valve on the missile would lift.',
  'Same valve family as the legs; bore along the header; hydraulic actuator with position indication on the control unit.', 'Closed only with the pumps offline; the missile side bled through its own bleed before any work on the connection.', ['WH-ZIPPER-INLETVALVE'], { hazards: [H.pressure, H.lof], connections: [{ target: 'PP-MISSILE-OUTLET', direction: 'upstream', type: 'flanged', rating: '15K', note: 'flanged or hammer union' }] });
whc('WH-ZIPPER-ISOVALVE', 'WH-ZIPPER', 'zipper-manifold', 'Leg isolation valves (lower valve of each leg)', ['zipper isolation valve', 'lower zipper valve', 'leg isolation', 'double isolation'],
  'The lower hydraulic valve on each vertical leg that, with the working valve above it, gives two closed valves between the spread and a well that has wireline or coiled tubing in the hole.',
  'Stays open on wells in the frac rotation so the working valve alone cycles the well on and off the spread. Closed and verified before the neighbor is pumped when this well has tools in the hole, and closed for any work on the working valve or the spools above it.',
  'Same valve family and bore as the working valve; hydraulic with position indication.', 'Both leg valves confirmed closed on the control unit before wireline enters the well; positions are part of the pre-pump check.', ['WH-ZIPPER-ISOVALVE']);
whc('WH-ZIPPER-LEG', 'WH-ZIPPER', 'zipper-manifold', 'Vertical legs: tees, risers, and spools', ['zipper leg', 'well leg', 'leg riser', 'zipper tee'],
  'The tee on the header, the riser spool, and the spool between the two valves that make up the vertical leg for each well.',
  'One leg per well at the tree spacing. The tee is a studded block on the header; flanged spools carry the flow up through the lower isolation valve and the upper working valve to the elbow on top. Flanged connections throughout so the leg can be rebuilt with a valve change and no hammer unions.',
  'Spool bore and rating match the valves; wall thickness checked on the most-used legs.', 'Legs inside the red zone; restraints on the treating spools to the tree.', ['WH-ZIPPER-LEG'], { hazards: [H.pressure, H.lof, H.erosion] });
wh({ id: 'WH-FRACTREE-BALLLAUNCHER', parent: 'WH-FRACTREE', group: 'frac-tree', level: 'component', name: 'Ball launcher (sliding sleeve jobs)', aliases: ['ball launcher', 'ball injector', 'ball dropper', 'frac ball launcher', 'ball drop head'],
  function: 'The magazine on top of the frac tree for sliding sleeve completions that releases one graduated frac ball at a time into the flow stream, replacing the wireline lubricator between stages.',
  tabs: {
    overview: 'A pressure housing sits on the swab valve in place of the top adapter. A horizontal magazine holds the balls in size order behind two small isolation valves that form a pressure chamber: the outer valve opens to admit the next ball, closes, then the inner valve opens and a hydraulic push rod drives the ball into the bore while the spread is pumping. The ball travels with the fluid to its seat, shears the sleeve open, and isolates the stages below. The count of balls left is the count of stages left.',
    engineering: 'Rated with the tree; balls sized to the seat schedule of the sleeves in the well, largest last; hydraulic controls from the frac valve control unit or a dedicated panel outside the red zone.',
    connections: 'Below: swab valve (the launcher isolation). Hydraulic: control panel. Flow: the treating line through the inlet block carries the ball down.',
    safety: 'The launcher is part of the pressure boundary while pumping; the swab valve isolates it for reloading, which is done with the tree bled to the launcher and never with tools in the hole.',
    evidence: 'Ball injector patent (S35), sliding sleeve completion practice (S34), API 6A (S1). Scene geometry only; no OEM design reproduced.',
    operations: 'Per stage: confirm the flow path is open and the spread is at 10 to 20 bpm, open the swab valve to the launcher, release the ball, watch for the pressure spike as it seats and the drop as the sleeve shifts, then bring the rate up for the stage.',
    failure_modes: 'Ball not released (push rod or valve fault), wrong ball size loaded, ball not seating (sleeve or seat damage), launcher seal leaks.',
  }, drawn_in_3d: true, scene: 'WH-FRACTREE-BALLLAUNCHER', sources: ['S1', 'S34', 'S35'], hazards: [H.pressure, H.pinch] });
{
  const r = load('WH', 'WH-FRACTREE');
  r.tabs.overview = (r.tabs.overview || '') + '\n\nFor sliding sleeve completions the top adapter and lubricator are replaced by a ball launcher on the swab valve; the rest of the stack is unchanged (see WH-FRACTREE-BALLLAUNCHER).';
  r.revision = rev('Drop 7: ball launcher option noted'); save(r);
}

// ================================================================ PP: missile, fleet power, job design
const EVM = 'Frac manifold missile patent (S31), electric fleet article (S37), fracturing design evolution article (S36), EIA regions (S38), field practice (S9). Photographs read for proportion only.';
const MGLB = '/glb/PP/PP-MISSILE.glb';
const pp = (o) => save({ status: 'draft', evidence_tier: 'E2', reviewers: [], system: 'PP', drawn_in_3d: false, sources: ['S9', 'S31'], revision: rev('Drop 7 seed'), hazards: [H.pressure, H.lof], ...o });
const ppc = (id, parent, group, name, aliases, fn, over, eng, safety, nodes, extra = {}) => pp({ id, parent, group, level: 'component', name, aliases, function: fn, tabs: { overview: over, engineering: eng, safety, evidence: EVM, ...(extra.tabs || {}) }, drawn_in_3d: !!nodes, ...(nodes ? { glb: MGLB, mesh_nodes: nodes } : {}), ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'tabs')) });
{
  const r = load('PP', 'PP-MISSILE');
  r.name = 'Missile (manifold trailer): low- and high-pressure sides';
  r.function = 'The manifold trailer between the pump rows: two low-pressure suction headers along its outer edges feed the pumps from the blender, and the high-pressure discharge header down the middle collects every pump\'s output into one treating line to the zipper.';
  r.tabs.overview = 'Pumps park nose-in on both sides. The low-pressure side is two large suction headers, one along each edge of the deck, fed by the blender discharge at the rear; each has an outlet per pump with a butterfly valve and a suction hose to the pump\'s fluid end. The high-pressure side is the discharge header down the centerline, built from junction fittings joined by flanged spools; each fitting has a radial feed port to each side carrying a check valve and a swivel arm to that pump\'s discharge. Pressure transducers and the pressure relief valve with its vent line sit on the header near the front, where the outlet flange feeds the single treating line that runs through the inlet isolation valve on the zipper skid.\n\nSimultaneous schemes use a second missile or a split at the outlet; the simulator lengthens the missile with the pump count it computes from the fleet and the rating.';
  r.tabs.engineering = 'Suction headers 8 to 12 in. for low friction at spread rate; discharge header and fittings at the tree rating (10K or 15K) with a bore near the treating line size. Check valves keep a stopped pump from being back-driven; the relief valve is set above the kickout pressure of the pumps and below the rating of the iron.';
  r.tabs.connections = 'Upstream: blender discharge to the suction headers; every pump suction and discharge. Downstream: outlet flange to the treating line and the zipper inlet isolation valve.';
  r.tabs.operations = 'Pressure tested with the treating line and the zipper before the first stage; the outlet stays open to the zipper header, and the zipper inlet isolation valve is closed only with the pumps off.';
  r.drawn_in_3d = true; r.glb = MGLB; r.scene = 'PP-MISSILE';
  r.mesh_nodes = ['PP-MISSILE-DECK', 'PP-MISSILE-AXLES', 'PP-MISSILE-LPHEADER', 'PP-MISSILE-LPOUTLET', 'PP-MISSILE-HPHEADER', 'PP-MISSILE-OUTLET', 'PP-MISSILE-CHECKVALVE', 'PP-MISSILE-SWIVELARM', 'PP-MISSILE-TRANSDUCER', 'PP-MISSILE-PRV', 'PP-MISSILE-WALKWAY'];
  r.sources = ['S9', 'S31', 'S11']; r.revision = rev('Drop 7: model bound; low- and high-pressure sides described');
  r.connections = [{ target: 'PP-BLENDER', direction: 'upstream', type: 'hammer union', rating: 'LP', note: 'suction hose' }, { target: 'PP-FRACPUMP', direction: 'undirected', type: 'hammer union', note: 'suction hose and discharge iron' }, { target: 'WH-ZIPPER-INLETVALVE', direction: 'downstream', type: 'flanged', rating: '15K', note: 'flanged or hammer union' }];
  save(r);
}
{
  const r = load('PP', 'PP-MISSILE-HPHEADER'); r.glb = MGLB; r.mesh_nodes = ['PP-MISSILE-HPHEADER']; r.drawn_in_3d = true;
  r.tabs.overview = 'The discharge header down the centerline of the deck: junction fittings, one per pump position, joined by flanged spools, each fitting with a radial feed port to each side. Everything on this side of the missile is at treating pressure.';
  r.revision = rev('Drop 7: model bound'); save(r);
}
{
  const r = load('PP', 'PP-MISSILE-LPHEADER'); r.glb = MGLB; r.mesh_nodes = ['PP-MISSILE-LPHEADER']; r.drawn_in_3d = true;
  r.tabs.overview = 'Two suction headers, one along each edge of the deck, fed from the blender at the rear. Low pressure, large bore, an outlet per pump. Nothing on this side sees treating pressure.';
  r.revision = rev('Drop 7: model bound'); save(r);
}
ppc('PP-MISSILE-LPOUTLET', 'PP-MISSILE-LPHEADER', 'missile', 'Suction outlets (butterfly valve and hose stub)', ['suction outlet', 'butterfly valve (missile)', 'suction hose connection'], 'The per-pump outlet on each suction header: a butterfly valve and a hose stub for the suction hose to the pump.', 'Closed on empty pump positions; open on pumps in service. A closed outlet on a running pump starves it and cavitates the fluid end.', 'Large-bore butterfly valves, hand operated; hose stubs with cam-lock or hammer union ends.', 'Hoses restrained; suction pressure watched to catch a starving pump.', ['PP-MISSILE-LPOUTLET'], { hazards: [H.lof] });
ppc('PP-MISSILE-CHECKVALVE', 'PP-MISSILE-HPHEADER', 'missile', 'Feed port check valves', ['check valve (missile)', 'discharge check', 'feed port check'], 'The check valve on each radial feed port of the discharge header that stops header pressure from back-driving a stopped pump.', 'Flapper or dart type in the feed port; lets a pump be taken offline for a repair while the rest of the spread keeps pumping against the same header.', 'Rated with the header; erosion checked at the seat.', 'A leaking check on an offline pump puts treating pressure on its fluid end; the pump\'s own discharge valve is closed before work.', ['PP-MISSILE-CHECKVALVE'], { hazards: [H.pressure, H.erosion] });
ppc('PP-MISSILE-SWIVELARM', 'PP-MISSILE-HPHEADER', 'missile', 'Swivel arms to the pumps', ['swivel arm', 'discharge arm', 'connection arm', 'pump discharge line'], 'The short articulated discharge line with swivel joints from each feed port to the pump\'s fluid end, letting the pump be spotted without cutting iron to length.', 'Two or three swivels per arm take up the position of the trailer; hammer unions or flanges at each end. The arm is the most-handled iron on the pad and is inspected with the flow iron.', 'Treating-pressure iron with restraints; swivel packing renewed on schedule.', 'Line of fire while pumping; restraints on every arm.', ['PP-MISSILE-SWIVELARM'], { hazards: [H.pressure, H.lof] });
ppc('PP-MISSILE-TRANSDUCER', 'PP-MISSILE-HPHEADER', 'missile', 'Pressure transducers (missile)', ['transducer (missile)', 'header pressure', 'pump pressure sensor'], 'The pressure transducers on the discharge header that feed the data van and the pump kickout logic.', 'Two or more for redundancy; the reading is the pump-side treating pressure that the kickout compares against its setting.', 'Rated fittings; calibration checked before the job.', 'A failed transducer is replaced with the pumps off and the header bled.', ['PP-MISSILE-TRANSDUCER']);
ppc('PP-MISSILE-PRV', 'PP-MISSILE-HPHEADER', 'missile', 'Pressure relief valve and vent line', ['PRV (missile)', 'pop-off (missile)', 'relief valve (missile)', 'vent line'], 'The relief valve on the discharge header, set above the pump kickout and below the iron rating, that vents to a restrained line pointed away from people if the pumps overpressure the header.', 'Lifts on a closed flow path or a screenout that the kickout did not catch; the vent line dumps to a tank or the ground away from the crews. Reset and inspected after every lift.', 'Set pressure per the job program; capacity for full spread rate.', 'The vent line is restrained and its outlet is inside the red zone; a lift is treated as an event, not routine.', ['PP-MISSILE-PRV'], { hazards: [H.pressure, H.lof] });
ppc('PP-MISSILE-OUTLET', 'PP-MISSILE-HPHEADER', 'missile', 'Header outlet (to the treating line)', ['missile outlet', 'discharge outlet', 'treating line connection'], 'The flanged outlet at the front of the discharge header where the single treating line to the zipper connects.', 'One large-bore line to the zipper inlet isolation valve replaces the several small lines of older layouts; a second outlet or a split feeds a second manifold in simultaneous schemes.', 'Flanged or hammer union at the tree rating.', 'Restrained line; the zipper inlet isolation valve is the isolation point on the other end.', ['PP-MISSILE-OUTLET'], { connections: [{ target: 'WH-ZIPPER-INLETVALVE', direction: 'downstream', type: 'flanged', rating: '15K', note: 'flanged or hammer union' }] });
ppc('PP-MISSILE-DECK', 'PP-MISSILE', 'missile', 'Trailer deck, gooseneck, and axles', ['missile trailer', 'manifold trailer deck', 'trailer gooseneck'], 'The trailer that carries both headers: deck beams, cross members, gooseneck to the tractor, landing legs, and the axles at the rear.', 'Schematic in the model; the deck sets the header heights that the pump discharge and suction lines meet.', 'Highway trailer; leveled and chocked on location.', 'Trip hazards on the deck; walkway used for the header side.', ['PP-MISSILE-DECK', 'PP-MISSILE-AXLES', 'PP-MISSILE-WALKWAY'], { hazards: [H.pinch] });
{
  const r = load('PP', 'PP-FRACPUMP');
  r.tabs.overview = (r.tabs.overview || '') + '\n\nElectric fleets replace the engine and transmission with an electric motor and a variable-frequency drive cabinet on the same trailer; the power end and fluid end are the same family (see PP-FRACPUMP-MOTOR).';
  r.revision = rev('Drop 7: electric variant noted'); save(r);
}
pp({ id: 'PP-FRACPUMP-MOTOR', parent: 'PP-FRACPUMP', group: 'frac-pump', level: 'component', name: 'Electric motor and drive (electric pumps)', aliases: ['electric motor (pump)', 'VFD', 'variable frequency drive', 'e-frac pump'],
  function: 'On electric fleets, the motor and variable-frequency drive that turn the pump\'s power end in place of the diesel engine and transmission.',
  tabs: { overview: 'A large induction or permanent-magnet motor on the trailer, fed by a VFD cabinet that sets the pump speed; power comes over cables from the turbine or genset switchgear. Twin-pump trailers around 6,000 hp are common. No exhaust, less noise, and no transmission shifts.', engineering: 'Around 3,000 hp per pump; medium-voltage cables; cooling for the motor and the drive.', safety: 'High voltage on the trailer and cables; exclusion zones and lockout for electrical work.', evidence: EVM }, drawn_in_3d: true, scene: 'PP-FRACPUMP-MOTOR', sources: ['S37', 'S9'], hazards: [H.electrical, H.noise] });
{
  const r = load('PP', 'PP-POWERGEN');
  r.tabs.overview = (r.tabs.overview || '') + '\n\nThe simulator draws the power unit for the fleet chosen in Pad Setup: turbine generators with switchgear, reciprocating gensets, a grid substation, a gas conditioning skid for dual fuel, or a fuel trailer for diesel (see PP-POWERGEN-TURBINE, PP-POWERGEN-GENSET, PP-POWERGEN-GASSKID).';
  r.revision = rev('Drop 7: fleet options noted'); save(r);
}
pp({ id: 'PP-POWERGEN-TURBINE', parent: 'PP-POWERGEN', group: 'power', level: 'equipment', name: 'Turbine generator and switchgear', aliases: ['turbine generator', 'gas turbine (frac)', 'switchgear trailer', 'aeroderivative turbine'],
  function: 'A gas turbine generator set on a trailer, with a switchgear trailer, that powers an electric fleet from field gas.',
  tabs: { overview: 'One or two aeroderivative turbines in the tens of megawatts feed switchgear that distributes medium voltage to the pump trailers over cables. A turbine tolerates field gas with light treatment and packs the most power into the smallest footprint, but a single turbine is a single point of failure for the spread.', engineering: 'Tens of megawatts per unit; fuel gas conditioning; cable trays or laid cables to the pumps.', safety: 'High voltage; hot exhaust; fuel gas.', evidence: EVM }, drawn_in_3d: true, scene: 'PP-POWERGEN-TURBINE', sources: ['S37'], hazards: [H.electrical, H.gas, H.noise] });
pp({ id: 'PP-POWERGEN-GENSET', parent: 'PP-POWERGEN', group: 'power', level: 'equipment', name: 'Reciprocating gas gensets', aliases: ['genset', 'gas generator', 'reciprocating generator', 'natural gas genset'],
  function: 'Several trailer-mounted gas reciprocating generators of a few megawatts each that together power an electric fleet.',
  tabs: { overview: 'Four or more gensets share the load, so one can drop out and pumping continues at reduced rate. Reciprocating engines want cleaner gas than a turbine, so the conditioning skid does more work.', engineering: 'Around 2.5 MW each; paralleling switchgear; fuel gas treatment.', safety: 'High voltage; fuel gas; noise.', evidence: EVM }, drawn_in_3d: true, scene: 'PP-POWERGEN-GENSET', sources: ['S37'], hazards: [H.electrical, H.gas, H.noise] });
pp({ id: 'PP-POWERGEN-GASSKID', parent: 'PP-POWERGEN', group: 'power', level: 'equipment', name: 'Gas conditioning skid (dual fuel)', aliases: ['gas conditioning', 'fuel gas skid', 'dual fuel skid', 'gas scrubber (frac)'],
  function: 'The skid that scrubs, heats, and regulates field gas before it feeds dual-fuel engines or the generators of an electric fleet.',
  tabs: { overview: 'Separator, heater, filters, and regulators bring the gas to the pressure and quality the engines accept; a gas line runs from the skid to each dual-fuel pump or to the generators.', engineering: 'Sized to the fleet\'s gas demand; gas detection around the skid.', safety: 'Fuel gas; no ignition sources in the zone; lines restrained.', evidence: EVM }, drawn_in_3d: true, scene: 'PP-POWERGEN-GASSKID', sources: ['S37'], hazards: [H.gas] });

pp({ id: 'PP-JOBDESIGN', parent: 'PP', group: 'job-design', level: 'group', name: 'Job design variables (Pad Setup)', aliases: ['job design', 'completion design', 'frac design variables', 'pad setup', 'design intensity'],
  function: 'The variables chosen before the first valve moves that size everything else on the pad: basin and target depth, well count and frac scheme, tree bore and rating, completion method, lateral length, stage spacing and clusters, fleet type, proppant and fluid systems and their intensities.',
  tabs: {
    overview: 'Pad Setup in the simulator walks these in order. The basin sets the target depth and fracture gradient, which set the expected treating pressure and therefore the tree rating. The well count and frac scheme set how many wells are pumped at once, which with the rating sets the hydraulic horsepower and the pump count for the fleet chosen. The completion method (plug and perf, or sliding sleeves) sets the phase sequence and the equipment on the tree. Lateral length divided by stage spacing gives the stage count; clusters per stage give the perforation count. Proppant intensity (lb/ft) and fluid intensity (bbl/ft) times the lateral give the sand and water for each well and size the silos, tanks, and trucking. Public data across the resource plays shows stage spacing tightening from about 350 to about 200 ft per stage, stage counts near 40 per well, proppant rising from about 500 to more than 1,600 lb/ft, fluid from 13 to 33 bbl/ft, and rate per foot of lateral more than doubling between 2010 and 2017, with a shift to slickwater and finer sand.',
    engineering: 'Hydraulic horsepower is treating pressure times rate divided by 40.8. Kickout is set below the working pressure of the tree and iron; the relief valve above the kickout and below the rating. Expected treating pressure is closure (gradient times depth) plus net pressure plus friction minus hydrostatic; fluids with higher viscosity carry sand better but add friction.',
    connections: 'Feeds every other record: tree and zipper bore and rating (WH), pump count and power (PP), plug or sleeve count (DT), wireline runs (WL), drillout or mill-out time (CT).',
    safety: 'A rating with no margin over the expected treating pressure means the job runs at the kickout; a pressure ramp from a screenout has nowhere to go but the relief valve.',
    evidence: 'Fracturing design evolution article (S36), electric fleet article (S37), EIA regions (S38), completion codes article (S34). Basin values in the simulator are typical public ranges rounded for training, not operator data.',
    operations: 'Chosen in the job program and confirmed at the pre-job meeting; changed on the pad only by a documented management of change.',
    failure_modes: 'Under-rated iron for the depth; too few pumps for the scheme; sand or water logistics sized for the wrong intensity; the wrong completion method for the hole condition.',
  }, drawn_in_3d: false, sources: ['S34', 'S36', 'S37', 'S38'], hazards: [H.pressure] });
pp({ id: 'PP-BASINS', parent: 'PP-JOBDESIGN', group: 'job-design', level: 'equipment', name: 'Basins and typical conditions', aliases: ['basins', 'Permian', 'Delaware Basin', 'Midland Basin', 'Eagle Ford', 'Bakken', 'Haynesville', 'Marcellus', 'Utica', 'DJ Basin', 'Niobrara', 'SCOOP', 'STACK play', 'Powder River'],
  function: 'The producing regions the simulator offers and the typical conditions each loads into Pad Setup: terrain, target depth, fracture gradient, tree rating, lateral, stage design, fleet, and fluids.',
  tabs: {
    overview: 'The list follows the public regions that the US Energy Information Administration reports on (Anadarko, Appalachia, Bakken, Eagle Ford, Haynesville, Niobrara, Permian), with the Permian split into its Delaware and Midland basins and Appalachia into Marcellus and Utica, plus the Powder River. Picking a basin repaints the terrain to match its country (desert caliche and creosote, brush country, prairie, pine forest on red clay, hardwood hills, high plains, sage steppe) and loads typical starting values, all editable. Haynesville loads the deepest, hottest, highest-pressure case where 15K iron is the rule; Marcellus and the DJ the shallowest; the Bakken loads a sliding sleeve completion because openhole sleeve systems were common there.',
    engineering: 'Values are rounded public ranges for training. Nothing in the table comes from a specific operator, well, or service company.',
    safety: 'The point of the table is the pressure check: the deeper and higher-gradient basins push expected treating pressure past a 10K rating.',
    evidence: 'EIA regions (S38); design trends (S36); fleet trends (S37).',
  }, drawn_in_3d: false, sources: ['S36', 'S37', 'S38'], hazards: [] });

// ================================================================ DT: frac sleeve cut-away and openhole packer
const EVD = 'Completion codes article (S34), ball injector patent (S35), API 11D1 for packers (S21), field practice (S9). Generic geometry; not an OEM design.';
const SGLB = '/glb/DT/DT-FRACSLEEVE.glb';
const dt = (o) => save({ status: 'draft', evidence_tier: 'E2', reviewers: [], system: 'DT', drawn_in_3d: false, sources: ['S34', 'S9'], revision: rev('Drop 7 seed'), hazards: [H.pressure], ...o });
const dtc = (id, parent, group, name, aliases, fn, over, eng, safety, nodes, extra = {}) => dt({ id, parent, group, level: 'component', name, aliases, function: fn, tabs: { overview: over, engineering: eng, safety, evidence: EVD, ...(extra.tabs || {}) }, drawn_in_3d: !!nodes, ...(nodes ? { glb: SGLB, mesh_nodes: nodes } : {}), ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'tabs')) });
{
  const r = load('DT', 'DT-FRACSLEEVE');
  r.name = 'Ball-drop frac sleeve (cut-away)';
  r.tabs.overview = 'Sleeves are run as part of the casing string, one per stage, with graduated ball seats: each ball is slightly larger than the last and passes every seat until its own. Landing on the seat, pressure shears the screws and shifts the inner sleeve toe-ward, uncovering the port windows; the ball also isolates the stages below. The toe sleeve at the end of the string opens on casing pressure with no ball. After the job the seats are milled out with coiled tubing, or the balls and seats dissolve.\n\nThe cut-away shows the housing with its port windows, the inner sleeve shifted open, the graduated seat with its ball landed, the sheared screws, the body seals, and a swellable packer on the casing below for an openhole system. In the simulator the sleeves replace perforation clusters along the lateral, the ball launcher replaces the wireline lubricator on the tree, and the phases change to toe sleeve, ball drop, frac, and seat mill-out (or dissolve).';
  r.tabs.engineering = 'Seat sizes step by a fraction of an inch, which caps the stage count per string (public systems run to a few dozen stages); the smallest seat sets the drift for later coiled tubing work. Cemented sleeves rely on the cement for stage isolation; openhole systems rely on packers between sleeves.';
  r.tabs.operations = 'Per stage: with the spread at a low rate, release the next ball from the launcher, pump it down at 10 to 20 bpm, watch for the pressure spike as it lands and the drop as the ports open, then bring the rate up and pump the stage without stopping. No wireline between stages.';
  r.tabs.failure_modes = 'Ball not seating or passing its seat, sleeve not shifting (screw or debris), premature shift on a pressure cycle, seats left in the drift for the mill-out.';
  r.drawn_in_3d = true; r.glb = SGLB; r.scene = 'DT-FRACSLEEVE';
  r.mesh_nodes = ['DT-FRACSLEEVE-HOUSING', 'DT-FRACSLEEVE-PORTS', 'DT-FRACSLEEVE-INNERSLEEVE', 'DT-FRACSLEEVE-BALLSEAT', 'DT-FRACSLEEVE-BALL', 'DT-FRACSLEEVE-SHEARSCREW', 'DT-FRACSLEEVE-SEALS', 'DT-FRACSLEEVE-PACKER'];
  r.ghost_nodes = ['DT-FRACSLEEVE-CASING'];
  r.sources = ['S34', 'S35', 'S9']; r.revision = rev('Drop 7: cut-away model bound; ball-drop sequence');
  save(r);
}
{
  const r = load('DT', 'DT-TOESLEEVE'); r.drawn_in_3d = true; r.scene = 'DT-TOESLEEVE';
  r.tabs.overview = (r.tabs.overview || '') + ' In the simulator the toe sleeve is stage 1 of a sliding sleeve job: the casing is pressured with the pumps at a low rate until the ports open and the pressure drops.';
  r.revision = rev('Drop 7: drawn in the downhole scene'); save(r);
}
dtc('DT-FRACSLEEVE-HOUSING', 'DT-FRACSLEEVE', 'frac-sleeve', 'Sleeve housing and port windows', ['sleeve housing', 'frac port', 'sleeve sub', 'port windows'], 'The thick-walled sub in the casing string that carries the port windows and the inner sleeve.', 'Threaded pin and box ends like a casing joint; four windows around the middle sized for the stage rate; the inner sleeve covers them until it shifts.', 'Casing grade material; ports sized for erosion at rate.', 'Ports open only when the sleeve shifts; a premature shift is a pressure-cycle event.', ['DT-FRACSLEEVE-HOUSING', 'DT-FRACSLEEVE-PORTS'], { hazards: [H.pressure, H.erosion] });
dtc('DT-FRACSLEEVE-INNERSLEEVE', 'DT-FRACSLEEVE', 'frac-sleeve', 'Inner sleeve', ['inner sleeve', 'shifting sleeve', 'sleeve insert'], 'The inner tube, held closed by shear screws, that the seated ball pushes toe-ward to uncover the ports.', 'Shifts a few inches on the ball\'s pressure differential; seals above and below the ports hold pressure until it moves; a lock keeps it open afterwards.', 'Shear value set above the casing test pressure and below the frac pressure.', 'Left open after the job; milled with the seat where the drift is needed.', ['DT-FRACSLEEVE-INNERSLEEVE']);
dtc('DT-FRACSLEEVE-BALLSEAT', 'DT-FRACSLEEVE', 'frac-sleeve', 'Graduated ball seat', ['sleeve seat', 'graduated seat', 'seat schedule', 'ball seat (sleeve)'], 'The tapered seat at the heel end of the inner sleeve, sized so only its own ball lands while every smaller ball passes.', 'Seat diameters step through the string, largest at the heel; the schedule caps the stage count; milled out or dissolved after the job.', 'Hardened or dissolvable alloy; drift checked when the string is run.', 'The smallest seat is the drift restriction for later tools.', ['DT-FRACSLEEVE-BALLSEAT']);
dtc('DT-FRACSLEEVE-BALL', 'DT-FRACSLEEVE', 'frac-sleeve', 'Frac ball (on seat)', ['frac ball', 'ball (sleeve)', 'sleeve ball', 'ball on seat'], 'The ball dropped from the launcher that lands on its seat, shifts the sleeve, and isolates the stages below while this stage is pumped.', 'Composite, phenolic, or dissolvable alloy; sized to the seat schedule; flows back or dissolves afterwards.', 'Sized to the seat with a small margin; dissolution rate for the wellbore fluid and temperature.', 'A ball that passes its seat pumps the stage below again; a ball that will not seat holds up the job.', ['DT-FRACSLEEVE-BALL'], { connections: [{ target: 'WH-FRACTREE-BALLLAUNCHER', direction: 'upstream', type: 'mechanical', note: 'released into the flow' }] });
dtc('DT-FRACSLEEVE-SHEARSCREW', 'DT-FRACSLEEVE', 'frac-sleeve', 'Shear screws', ['shear screw', 'shear pin (sleeve)'], 'The screws through the housing into the inner sleeve that hold it closed until the seated ball\'s differential shears them.', 'Number and size set the shift pressure; sheared stubs stay in the housing.', 'Shear value above the casing test pressure.', 'A low shear value risks a premature shift during the casing test.', ['DT-FRACSLEEVE-SHEARSCREW']);
dtc('DT-FRACSLEEVE-SEALS', 'DT-FRACSLEEVE', 'frac-sleeve', 'Body seals', ['sleeve seals', 'o-rings (sleeve)'], 'The seals between the inner sleeve and the housing above and below the ports that hold pressure until the sleeve shifts.', 'Elastomer o-rings with backups in grooves on the sleeve; rated for the fluids and temperature.', 'Elastomer for the fluid and temperature.', 'A seal leak shows as a stage that will not build pressure.', ['DT-FRACSLEEVE-SEALS']);
dtc('DT-FRACSLEEVE-PACKER', 'DT-FRACSLEEVE', 'frac-sleeve', 'Swellable packer (openhole systems)', ['swell packer', 'swellable packer', 'openhole packer element'], 'The elastomer element on the casing between sleeves in an openhole system that swells against the bare hole to isolate one stage from the next.', 'Swells in oil or water over days after the string is run; mechanical set packers are the alternative. Cemented sleeve systems use cement instead.', 'Per API 11D1 where validated; swell time and differential rating per the design.', 'Isolation depends on the swell being complete before the first stage.', ['DT-FRACSLEEVE-PACKER'], { sources: ['S34', 'S21', 'S9'] });
dtc('DT-FRACSLEEVE-CASING', 'DT-FRACSLEEVE', 'frac-sleeve', 'Casing joints (context)', ['casing (sleeve context)', 'sleeve casing joints'], 'The casing joints either side of the sleeve sub, shown translucent for context.', 'Ghost context in the cut-away: the sleeve is made up between ordinary casing joints and runs with the string.', 'Same grade and connection as the string.', 'None beyond the casing string itself.', ['DT-FRACSLEEVE-CASING']);
dt({ id: 'DT-OPENHOLEPACKER', parent: 'DT', group: 'frac-sleeve', level: 'equipment', name: 'Openhole packer (sleeve systems)', aliases: ['openhole packer', 'swell packer (lateral)', 'mechanical packer (openhole)', 'stage isolation packer'],
  function: 'The packers between frac sleeves in an uncemented lateral that isolate each stage of bare hole so the sleeve in between treats only its interval.',
  tabs: { overview: 'One packer between each pair of sleeves and one at the toe. Swellable elements expand in the well fluid; mechanical packers set hydraulically. The simulator draws them along the lateral when the openhole option is chosen in Pad Setup.', engineering: 'Differential rating for the frac pressure; element length for the hole rugosity; swell time before the first stage.', safety: 'A packer that has not set lets a stage frac the neighbor.', evidence: EVD }, drawn_in_3d: true, scene: 'DT-OPENHOLEPACKER', sources: ['S34', 'S21', 'S9'], hazards: [H.pressure] });
{
  const r = load('DT', 'DT');
  r.tabs.overview = (r.tabs.overview || '') + '\n\nDrop 7 adds the sliding sleeve path: frac sleeves opened by balls from a launcher on the tree, with cemented or openhole (packer) systems and millable or dissolvable seats, chosen in Pad Setup.';
  r.revision = rev('Drop 7: sliding sleeve path noted'); save(r);
}
console.log('seeded drop 7');
