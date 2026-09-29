// Drop 2 seed: binds Drop 1 records to the new GLBs and adds the remaining WH records.
// Every new record is "draft" (AI-drafted). Run: node scripts/seed-drop2.mjs
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('content/records/WH');
const DATE = '2026-09-29';
const rev = (note) => ({ rev: 'A', author: 'AI draft', date: DATE, note });
const H = {
  pressure: { class: 'Stored pressure', control: 'Pressure test before pumping; bleed down and verify zero before breaking any connection.' },
  lof: { class: 'Line of fire', control: 'Restraints and whip checks on iron; exclusion zone around pressurized lines.' },
  pinch: { class: 'Pinch point', control: 'Hands clear of wing nuts, handwheels, and actuator linkages during operation.' },
  erosion: { class: 'Erosion cut-out', control: 'Tree saver in the wellhead; valves fully open or fully closed only; iron inspection.' },
  dropped: { class: 'Dropped object', control: 'Certified lifting gear; no personnel under suspended tree or lubricator sections.' },
  h2s: { class: 'H2S', control: 'Monitors and wind indicators per the site plan when the well can flow sour gas.' },
};
const EVID = 'API 6A (S1) for pressure-containing parts and connections; public OEM pages (S2, S3, S5, S11, S12) for configurations; field and manufacturing practice (S9).';

function load(id) { return JSON.parse(fs.readFileSync(path.join(DIR, id + '.json'), 'utf8')); }
function save(r) { const clean = JSON.parse(JSON.stringify(r)); fs.writeFileSync(path.join(DIR, r.id + '.json'), JSON.stringify(clean, null, 2) + '\n'); }
function patch(id, fn) { const r = load(id); fn(r); save(r); }

// ---------------------------------------------------------------- bind Drop 1 records to GLBs
patch('WH-FRACTREE', r => { r.glb = '/glb/WH/WH-FRACTREE.glb'; r.mesh_nodes = ['WH-FRACTREE-TREEADAPTER', 'WH-FRACTREE-LMV', 'WH-FRACTREE-UMV', 'WH-FRACTREE-CROSS', 'WH-FRACTREE-WINGA', 'WH-FRACTREE-WINGB', 'WH-FRACTREE-SWAB', 'WH-FRACTREE-GOATHEAD', 'WH-FRACTREE-TREECAP']; r.revision = rev('Drop 2: bound to WH-FRACTREE.glb'); });
patch('WH-GOATHEAD', r => { r.glb = '/glb/WH/WH-FRACTREE.glb'; r.mesh_nodes = ['WH-FRACTREE-GOATHEAD']; r.parent = 'WH-FRACTREE'; r.level = 'component'; r.revision = rev('Drop 2: bound to the frac tree GLB as a component of the tree'); });
patch('WH-ZIPPER', r => { r.glb = '/glb/WH/WH-ZIPPER.glb'; r.mesh_nodes = ['WH-ZIPPER-SKID', 'WH-ZIPPER-INLETHEADER', 'WH-ZIPPER-VALVE', 'WH-ZIPPER-OUTLET', 'WH-ZIPPER-TRANSDUCER', 'WH-ZIPPER-BLEEDVALVE', 'WH-ZIPPER-HPU', 'WH-ZIPPER-ACCUMULATOR']; r.revision = rev('Drop 2: bound to WH-ZIPPER.glb'); });
patch('WH-TREESAVER', r => { r.glb = '/glb/WH/WH-TREESAVER.glb'; r.mesh_nodes = ['WH-TREESAVER-MANDREL', 'WH-TREESAVER-SEAL', 'WH-TREESAVER-SHOULDER']; r.revision = rev('Drop 2: bound to WH-TREESAVER.glb'); });
patch('WH-FLOWIRON', r => { r.glb = '/glb/WH/WH-FLOWIRON.glb'; r.mesh_nodes = ['WH-FLOWIRON-PUPJOINT', 'WH-FLOWIRON-HAMMERUNION', 'WH-FLOWIRON-SWIVEL', 'WH-FLOWIRON-TEE', 'WH-FLOWIRON-CHECKVALVE', 'WH-FLOWIRON-PRV', 'WH-FLOWIRON-PLUGVALVE', 'WH-FLOWIRON-RESTRAINT']; r.revision = rev('Drop 2: bound to WH-FLOWIRON.glb'); });
patch('WH-CASINGHEAD', r => { r.glb = '/glb/WH/WH-WELLHEAD.glb'; r.mesh_nodes = ['WH-WELLHEAD-CASINGHEAD', 'WH-WELLHEAD-CASINGSPOOL']; r.revision = rev('Drop 2: bound to WH-WELLHEAD.glb'); });
patch('WH-TUBINGHEAD', r => { r.glb = '/glb/WH/WH-WELLHEAD.glb'; r.mesh_nodes = ['WH-WELLHEAD-TUBINGHEAD', 'WH-WELLHEAD-TREEADAPTER']; r.revision = rev('Drop 2: bound to WH-WELLHEAD.glb'); });
patch('WH-FRACVALVECONTROL', r => { r.glb = '/glb/WH/WH-ZIPPER.glb'; r.mesh_nodes = ['WH-ZIPPER-HPU', 'WH-ZIPPER-ACCUMULATOR']; r.revision = rev('Drop 2: bound to the control unit on the zipper skid'); });
patch('WH-GATEVALVE-ACTUATOR', r => { r.drawn_in_3d = true; r.glb = '/glb/WH/WH-GATEVALVE-HYD.glb'; r.mesh_nodes = ['WH-GATEVALVE-ACTUATOR']; delete r.scene; r.revision = rev('Drop 2: bound to WH-GATEVALVE-HYD.glb'); });
patch('WH-GATEVALVE-BODY', r => { r.tabs.evidence = EVID; });

// ---------------------------------------------------------------- new records
const out = [];
const rec = (o) => out.push({ status: 'draft', evidence_tier: 'E2', reviewers: [], system: 'WH', drawn_in_3d: false, sources: ['S1', 'S9'], revision: rev('Drop 2 seed'), ...o });
const comp = (id, parent, group, name, aliases, fn, over, eng, safety, extra = {}) => rec({
  id, parent, group, level: 'component', name, aliases, function: fn,
  tabs: { overview: over, engineering: eng, safety, evidence: EVID, ...(extra.tabs || {}) },
  hazards: extra.hazards || [H.pressure], ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'tabs' && k !== 'hazards')),
});
const TREE = '/glb/WH/WH-FRACTREE.glb', WELL = '/glb/WH/WH-WELLHEAD.glb', ZIP = '/glb/WH/WH-ZIPPER.glb', IRON = '/glb/WH/WH-FLOWIRON.glb', TS = '/glb/WH/WH-TREESAVER.glb', HYD = '/glb/WH/WH-GATEVALVE-HYD.glb';
const drawn = (glb, nodes) => ({ drawn_in_3d: true, glb, mesh_nodes: nodes });

// ---- frac tree components
comp('WH-FRACTREE-TREEADAPTER', 'WH-FRACTREE', 'frac-tree', 'Tree adapter (tubing head adapter)', ['tubing head adapter', 'crossover spool', 'adapter spool'],
  'The flanged spool that connects the tubing head to the bottom of the frac stack and steps the connection size and rating when the two differ.',
  'The adapter lands on the tubing head flange and carries the lower master valve. Its bore matches the stack bore. When the tubing head is a lower rating or a different flange size than the stack, the adapter is the crossover; when a tree saver is used, its landing shoulder sits in or on the adapter.',
  'API 6A flanged both ends: 6BX with BX gaskets at 10,000 psi and above. The adapter is rated to the stack working pressure. Some designs include a test port between the two ring gaskets.',
  'The adapter connection is broken twice per well (frac stack on, frac stack off, production tree on); each make-up gets a new ring gasket and a pressure test.',
  { ...drawn(TREE, ['WH-FRACTREE-TREEADAPTER']), connections: [{ target: 'WH-TUBINGHEAD', direction: 'upstream', type: 'flanged', rating: '15K' }, { target: 'WH-FRACTREE-LMV', direction: 'downstream', type: 'flanged', rating: '15K' }] });

comp('WH-FRACTREE-LMV', 'WH-FRACTREE', 'frac-tree', 'Lower master valve', ['LMV', 'lower master', 'bottom master'],
  'The lowest valve on the tree and the last barrier above the wellhead; kept fully open during operations and not cycled under pressure or flow.',
  'Usually a manual gate valve so it cannot be closed by a control system fault. It is opened at rig-up after the stack is tested and stays open until the stack is removed; the upper master does the working isolation. It is closed only to isolate the well when everything above it must be removed or repaired, and only with the well shut in and the stack bled.',
  'Same API 6A gate valve as the rest of the stack; manual handwheel with a turn count that confirms position.',
  'Never cycle under differential pressure or flow; a washed lower master leaves the well with no barrier above the wellhead. Count turns and verify open before pumping.',
  { ...drawn(TREE, ['WH-FRACTREE-LMV']), connections: [{ target: 'WH-GATEVALVE', direction: 'undirected', type: 'mechanical', note: 'Instance of the gate valve sub-assembly, manual' }] });

comp('WH-FRACTREE-UMV', 'WH-FRACTREE', 'frac-tree', 'Upper master valve', ['UMV', 'upper master', 'working master', 'hydraulic master'],
  'The working master valve: hydraulically actuated so it can be closed from the control unit or by emergency shut-in without anyone entering the red zone.',
  'Sits directly above the lower master. Spring-return actuators fail closed on loss of hydraulic pressure. During wireline it stays open with the lubricator on the tree; during frac it stays open; it is closed for emergency shut-in and when swapping equipment above the cross.',
  'Hydraulic gate valve with position indication back to the control panel; closing time is set by the actuator and control unit.',
  'Closing on flow is an emergency action, not routine; a valve closed on proppant-laden flow is inspected before reuse. Hydraulic lines inside the red zone are repaired only after shut-in.',
  { ...drawn(TREE, ['WH-FRACTREE-UMV']), connections: [{ target: 'WH-FRACVALVECONTROL', direction: 'upstream', type: 'hydraulic' }, { target: 'WH-GATEVALVE-HYD', direction: 'undirected', type: 'mechanical', note: 'Instance of the hydraulic gate valve variant' }] });

comp('WH-FRACTREE-CROSS', 'WH-FRACTREE', 'frac-tree', 'Studded cross', ['cross', 'flow cross', 'frac cross', 'tee (two-outlet configurations)'],
  'The block above the masters with two horizontal outlets for the wing valves; it splits the vertical bore to the frac side and the flowback side.',
  'A forged block with the vertical bore and two side bores at 90 degrees, studded outlets on each side for the wing valves, and flanged top and bottom. A tee is used when only one wing is needed. Some stacks add a third outlet for instrumentation.',
  'API 6A pressure-containing block rated with the stack; studded outlets take the wing valve flanges with BX gaskets.',
  'The cross sees the highest erosion on the stack at the frac wing side; inspect the bore and outlet after each well.',
  { ...drawn(TREE, ['WH-FRACTREE-CROSS']), hazards: [H.pressure, H.erosion] });

comp('WH-FRACTREE-WINGA', 'WH-FRACTREE', 'frac-tree', 'Frac wing valve', ['frac wing', 'treating wing', 'wing valve A'],
  'The hydraulic wing valve that connects the well to the frac line from the zipper manifold; open only while this well is being treated or pumped down.',
  'Opened from the control unit after the zipper valve for this well is opened and the swab valve is confirmed closed. Closed at the end of the stage before the tree is opened for wireline. It sees the full proppant stream every stage.',
  'Hydraulic gate valve; commonly the most cycled valve on the stack and the first to show seat wear.',
  'Fully open or fully closed only. Pumping against a closed frac wing raises pressure to the relief valve set point and trips the pumps.',
  { ...drawn(TREE, ['WH-FRACTREE-WINGA']), hazards: [H.pressure, H.erosion], connections: [{ target: 'WH-ZIPPER', direction: 'upstream', type: 'hammer union', rating: '15K' }] });

comp('WH-FRACTREE-WINGB', 'WH-FRACTREE', 'frac-tree', 'Flowback wing valve', ['flowback wing', 'production wing', 'wing valve B'],
  'The wing valve on the opposite side of the cross that connects the well to the flowback iron and choke manifold.',
  'Closed during frac and wireline; opened for drillout returns and flowback. On some rig-ups it also carries a pressure transducer and a bleed line.',
  'Hydraulic or manual gate valve rated with the stack.',
  'Opening the flowback wing exposes the flowback iron to wellhead pressure; the choke manifold must be lined up and the iron tested first.',
  { ...drawn(TREE, ['WH-FRACTREE-WINGB']), connections: [{ target: 'FB', direction: 'downstream', type: 'hammer union', rating: '15K', note: 'Flowback iron to the choke manifold' }] });

comp('WH-FRACTREE-SWAB', 'WH-FRACTREE', 'frac-tree', 'Swab valve', ['crown valve', 'top valve', 'swab'],
  'The top valve on the tree that gives vertical access to the well for the wireline lubricator and the coiled tubing stack.',
  'Closed during pumping. Opened only after the lubricator or coiled tubing stack is made up above it and pressure tested, so that the tool string can pass into the well. Closed again with the tool string back inside the lubricator before the lubricator is bled and removed.',
  'Manual gate valve on most stacks so that it cannot be opened by a control system fault while the top of the tree is open to atmosphere.',
  'Never open the swab valve with the goat head removed and nothing tested above it. The interlock in the simulator reflects the field rule: swab closed before the frac wing opens, frac wing closed before the swab opens.',
  { ...drawn(TREE, ['WH-FRACTREE-SWAB']), connections: [{ target: 'WL', direction: 'downstream', type: 'flanged', rating: '15K', note: 'Wellhead adapter and lubricator land here' }, { target: 'CT', direction: 'downstream', type: 'flanged', rating: '15K', note: 'Coiled tubing BOP stack lands here' }] });

comp('WH-FRACTREE-TREECAP', 'WH-FRACTREE', 'frac-tree', 'Tree cap and top connection', ['tree cap', 'top cap', 'crown cap'],
  'The blind cap or instrumented cap on the top of the goat head that closes the vertical bore when no equipment is above the tree.',
  'Carries a pressure gauge or transducer port and a needle valve on many rig-ups so treating pressure can be read at the tree. Removed to install the wellhead adapter for wireline.',
  'API 6A flanged or threaded cap rated with the stack.',
  'The cap is removed only with the swab valve closed and verified, and the bore above the swab bled to zero.',
  { ...drawn(TREE, ['WH-FRACTREE-TREECAP']) });

// ---- wellhead components
comp('WH-CASINGHANGER-SLIP', 'WH-CASINGHEAD', 'wellhead', 'Casing hanger, slip type', ['slip hanger', 'slip and seal hanger', 'casing slips'],
  'A hanger that grips the casing with slips set in the head bowl, transferring the casing weight to the wellhead, with a seal assembly above the slips to close the annulus.',
  'The slip segments sit on a tapered bowl; casing weight drives the slips inward against the pipe. The seal above the slips is energized by casing weight or by screws. Slip hangers are set after cementing without rotating the casing, which suits most land wells.',
  'Slips, cone, and seal are sized for the casing OD and weight range; the seal material follows the temperature class. API 6A covers the hanger as pressure-controlling equipment.',
  'A slip hanger set with insufficient weight can slip; verify the set per the OEM procedure before the pack-off is installed and before any pressure is applied to the annulus.',
  { ...drawn(WELL, ['WH-WELLHEAD-CASINGHANGER']) });

comp('WH-CASINGHANGER-MANDREL', 'WH-CASINGHEAD', 'wellhead', 'Casing hanger, mandrel type', ['mandrel hanger', 'threaded hanger', 'boll weevil hanger (slang, verify usage)'],
  'A hanger threaded onto the top joint of casing that lands on a shoulder in the head and carries its own seals, used where a metal-to-metal seal or a frac-ready configuration is wanted.',
  'The mandrel is made up to the casing before landing, so the casing string is spaced out to land the hanger on the wellhead shoulder. Seals on the mandrel OD seal against the head bore; lockdown screws or a lock ring hold it against pressure from below. Mandrel hangers are common in unitized and frac-ready wellheads.',
  'Metal-to-metal or elastomer seals per the OEM; rated with the head. Requires accurate space-out during the casing run.',
  'A hanger landed short or long cannot be sealed; the space-out is verified before cementing.',
  { hazards: [H.pressure] });

comp('WH-PACKOFF', 'WH-CASINGHEAD', 'wellhead', 'Pack-off and secondary seal', ['packoff', 'pack-off assembly', 'secondary seal', 'emergency seal'],
  'The seal assembly above a slip hanger, and the secondary seal in the bottom of the spool above it, that close the annulus between the casing and the head so the annulus can hold pressure.',
  'The pack-off has elastomer or plastic packing energized by screws or by the hanger load. The secondary seal in the next spool seals on the casing OD as a second barrier in case the primary hanger seal leaks; some are energized by injecting plastic packing through a port. A test port between the seals lets each seal be pressure tested during installation.',
  'Seal materials follow the temperature and material class; elastomers are checked for compatibility with the fluids that reach the annulus.',
  'Annulus pressure during fracturing is monitored continuously; a rise indicates a leak at the hanger, the pack-off, or the casing, and stops the job.',
  { ...drawn(WELL, ['WH-WELLHEAD-PACKOFF']) });

comp('WH-SIDEOUTLETVALVE', 'WH-CASINGHEAD', 'wellhead', 'Side outlet valves and annulus access', ['annulus valve', 'casing valve', 'outlet valve', 'side outlet'],
  'The small gate valves on the side outlets of the casing spools and tubing head that give access to each annulus for monitoring, testing, and pumping.',
  'Each casing spool has two outlets, one usually fitted with a valve and gauge and the other with a valve and a blind flange or a VR plug. During fracturing the intermediate and surface annuli are monitored for pressure change; the outlets are also where the annulus is bled, tested, or filled.',
  'API 6A gate valves, commonly 2-1/16 in. bore, rated to the spool pressure, flanged or studded; a needle valve and gauge on the outlet.',
  'Outlet valves are opened slowly; annulus fluid may be gas-cut or contain H2S on some wells. Never leave an outlet open to atmosphere unattended.',
  { ...drawn(WELL, ['WH-WELLHEAD-SIDEOUTLETVALVE']), hazards: [H.pressure, H.h2s] });

comp('WH-VRPLUG', 'WH-CASINGHEAD', 'wellhead', 'Valve removal plug and test port', ['VR plug', 'valve removal plug', 'VR thread', 'test port'],
  'A threaded plug set in the side outlet bore that lets an outlet valve be removed or replaced with the annulus under pressure, plus the test port that lets seals be pressure tested at installation.',
  'The outlet bore carries a VR thread. A lubricator tool is made up to the valve, the plug is run through the open valve and threaded into the VR profile, the valve is closed and removed, and the sequence is reversed with the new valve. Test ports are small threaded ports between seals or between flanges that accept a test pump connection.',
  'VR thread and plug sizes follow the outlet; plug and lubricator tool rated to the head pressure.',
  'Setting a VR plug is live-pressure work done only by qualified personnel with the correct tool; a plug that is not fully threaded will blow out when the valve is removed.',
  { hazards: [H.pressure, H.lof] });

rec({ id: 'WH-MULTIBOWL', parent: 'WH', group: 'wellhead', level: 'equipment', name: 'Unitized (multibowl) and frac-ready wellheads', aliases: ['multibowl', 'unitized wellhead', 'speed head', 'frac-ready wellhead', 'time-saver head'],
  function: 'A wellhead housing that accepts more than one casing hanger in a single body so that spools are not nippled up and down between casing strings, cutting rig time and the number of flange connections; frac-ready versions land the frac stack directly on a mandrel hanger with no exposed pack-off.',
  tabs: {
    overview: 'A conventional wellhead grows one spool at a time as each casing string is run and cemented, and each spool adds a flanged connection to make up, test, and later maintain. A unitized head has two or three hanger bowls machined into one housing, run with the surface casing, so the intermediate and production hangers land in the same body. Mandrel hangers with metal-to-metal seals are typical. A frac-ready or speed head adds a top profile that takes the frac stack adapter directly and isolates the hanger seals from treating pressure so that a tree saver is not needed on every well.',
    engineering: 'API 6A housing with multiple bowls and lockdown profiles; hanger seals rated to the frac stack working pressure when the head is used without a tree saver (verify per product). The housing bore must pass the bits and casing of each later section.',
    connections: 'Below: surface casing (welded or threaded). Above: tubing head adapter or frac stack directly. Side outlets per bowl for annulus access.',
    safety: 'The same annulus monitoring rules apply; fewer flanges means fewer leak paths but each hanger seal must be tested on installation.',
    evidence: 'OEM product pages (S5); API 6A (S1); field practice (S9).',
    operations: 'Installed with the surface casing on the drilling rig; hangers landed as each string is run; the frac stack lands on the top profile after the production casing is cemented and tested.',
    failure_modes: 'Hanger seal leaks found on test; bowl damage from drilling tools; lockdown screw damage.',
  }, hazards: [H.pressure], sources: ['S1', 'S5', 'S9'] });

comp('WH-TUBINGHANGER', 'WH-TUBINGHEAD', 'wellhead', 'Tubing hanger', ['hanger', 'tubing hanger mandrel', 'extended-neck hanger'],
  'The mandrel that suspends the production tubing string in the tubing head after the completion and seals the tubing-casing annulus; it also carries the back pressure valve profile and any control line penetrations.',
  'During the frac there is no tubing in the well and the hanger is not installed; the frac stack lands on the tubing head adapter. After drillout and flowback the tubing is run, the hanger is made up to the top joint, landed in the tubing head bowl, and held by lockdown screws. The hanger bore has a threaded profile for the back pressure valve and the two-way check valve. Extended-neck hangers seal in the adapter above the head so the flange connection is isolated from well pressure.',
  'API 6A; seals per temperature and material class; control line ports for a subsurface safety valve or chemical injection are drilled through the hanger body.',
  'The hanger is landed with the well dead or under control; the BPV is set before the tree is nippled up and pulled only after the tree is tested.',
  { ...drawn(WELL, ['WH-WELLHEAD-TUBINGHANGER']), connections: [{ target: 'UC', direction: 'downstream', type: 'threaded', note: 'Production tubing string' }, { target: 'WH-BPV', direction: 'undirected', type: 'threaded' }] });

comp('WH-LOCKDOWNSCREW', 'WH-TUBINGHEAD', 'wellhead', 'Lockdown screws', ['lock screws', 'hold-down screws', 'tie-down screws'],
  'Radial screws in the tubing head (and in some casing spools) that engage the hanger neck to hold it down against pressure from below and to energize the hanger seal on some designs.',
  'Each screw runs through a packing gland in the head wall so it can be run in under pressure. They are run in to a specified torque and the count is checked; all screws in and torqued is a hold point before pressure is applied.',
  'Screw size, number, and torque per the OEM; gland packing rated to the head pressure.',
  'Screws are run in only against a landed hanger; running screws against an empty bowl damages the bowl. Gland packing leaks are a common source of small wellhead leaks.',
  { ...drawn(WELL, ['WH-WELLHEAD-LOCKDOWNSCREW']) });

comp('WH-BPV', 'WH-TUBINGHEAD', 'wellhead', 'Back pressure valve', ['BPV', 'back-pressure valve', 'one-way check'],
  'A check valve threaded into the tubing hanger that holds pressure from below so the tree can be removed or installed, while still allowing fluid to be pumped down the tubing from above.',
  'Set and retrieved through the tree with a lubricator and a running tool. It is the barrier that lets the frac stack come off and the production tree go on without killing the well when tubing is in place. The two-way check valve is used instead when the tree above must be pressure tested.',
  'API 6A; profile type must match the hanger; rated to the tubing head working pressure.',
  'Verify the BPV is set and holding before breaking the tree connection; a BPV that is not fully threaded can be blown out when the tree is removed.',
  { ...drawn(WELL, ['WH-WELLHEAD-BPV']), hazards: [H.pressure, H.lof] });

comp('WH-TWCV', 'WH-TUBINGHEAD', 'wellhead', 'Two-way check valve', ['TWC', 'TWCV', 'two-way check', 'test plug'],
  'A plug set in the tubing hanger profile that holds pressure from both directions so that the tree and connection above it can be pressure tested against a closed well.',
  'Same profile and running tool as the back pressure valve. Installed for the tree test, then replaced by a BPV or removed once the tree is tested and the well is ready to be opened.',
  'API 6A; rated to the tree test pressure.',
  'The TWC must be pulled before the well is opened to flow; a forgotten TWC is a known cause of a dead well after tree installation.',
  { hazards: [H.pressure] });

comp('WH-BPVLUBRICATOR', 'WH-TUBINGHEAD', 'wellhead', 'BPV lubricator and running tool', ['BPV lubricator', 'running tool', 'BPV rod'],
  'The short lubricator and rod tool made up to the top of the tree to run or pull a back pressure valve or two-way check valve with the tree under pressure.',
  'The lubricator is flanged or threaded to the tree cap connection with the swab valve closed, pressure tested, then the swab is opened and the rod runs the plug down to the hanger and threads it in or out.',
  'Rated to the tree working pressure; rod length matched to the tree height.',
  'A lubricator is live-pressure equipment; the rod is a line-of-fire item if the plug is released under pressure.',
  { hazards: [H.pressure, H.lof] });

// ---- connections and flanges
rec({ id: 'WH-FLANGE', parent: 'WH', group: 'connections', level: 'part', name: 'API 6A flanges, types 6B and 6BX', aliases: ['6B flange', '6BX flange', 'API flange', 'ring joint flange'],
  function: 'The bolted, ring-gasket end connections that join wellhead and tree components; type 6B for 2,000 to 5,000 psi and type 6BX for 10,000 psi and above and for larger sizes at the lower ratings.',
  tabs: {
    overview: 'A 6B flange seals with an R or RX ring gasket in a groove and has a small gap between the flange faces when made up. A 6BX flange seals with a BX ring gasket and is made up until the flange faces touch, so the bolt load is carried by the faces rather than the gasket. Frac stacks at 10,000 and 15,000 psi are 6BX throughout. Studded connections use the same gaskets with studs threaded into one component instead of through-bolts.',
    engineering: 'Flange dimensions, bolt patterns, and gasket grooves are tabulated in API 6A by nominal size and pressure rating. The nominal size names the bore (5-1/8 in., 7-1/16 in.); the same nominal size has different flange dimensions at each rating, so a 5-1/8 in. 10K flange does not mate with a 5-1/8 in. 15K flange.',
    connections: 'Every flanged joint in this system.',
    safety: 'Bolts are made up in a cross pattern to the specified torque; a 6BX joint that does not reach face-to-face contact is not made up. Mixed ratings or damaged ring grooves leak under test.',
    evidence: 'API 6A (S1); field and manufacturing practice (S9).',
  },
  standards: [{ standard: 'API 6A', edition: 'verify', clause: 'flanged end and outlet connections', paraphrase: '6B flanges for 2,000, 3,000, and 5,000 psi; 6BX flanges for 10,000, 15,000, and 20,000 psi and for the larger nominal sizes at 2,000 to 5,000 psi; gasket types R and RX for 6B and BX for 6BX.', source: 'S1' }],
  hazards: [H.pressure, H.pinch], sources: ['S1', 'S9'] });

rec({ id: 'WH-RINGGASKET', parent: 'WH', group: 'connections', level: 'part', name: 'Ring gaskets, types R, RX, and BX', aliases: ['ring gasket', 'BX gasket', 'RX gasket', 'R gasket', 'ring joint gasket', 'metal gasket'],
  function: 'The metal sealing rings that seat in the grooves of API 6A flanges and studded connections; type R and RX for 6B flanges, type BX for 6BX flanges.',
  tabs: {
    overview: 'Type R gaskets are oval or octagonal section rings that seal by being compressed in the groove. Type RX and BX are pressure-energized: the ring is slightly larger than the groove pitch so that internal pressure pushes it harder against the groove wall. BX gaskets have a small pressure-passage hole so pressure reaches the inside of the ring. Gaskets are used once; a ring that has been made up is replaced.',
    engineering: 'Material is soft iron or low-carbon steel for standard service and stainless or nickel alloy for corrosive service, always softer than the flange. Gasket numbers (for example BX-169 for 7-1/16 in. 10K and above; verify) map to flange size and rating in the API 6A tables.',
    connections: 'Every ring-joint connection in this system.',
    safety: 'A reused, nicked, or wrong-number gasket is the most common cause of a failed stack test. Grooves are cleaned and inspected before every make-up.',
    evidence: 'API 6A (S1); field and manufacturing practice (S9).',
  },
  hazards: [H.pressure], sources: ['S1', 'S9'] });

rec({ id: 'WH-STUDBOLTS', parent: 'WH', group: 'connections', level: 'part', name: 'Studs, nuts, and bolting', aliases: ['stud bolts', 'B7 studs', 'flange bolting', 'nuts'],
  function: 'The threaded studs and nuts that carry the load of a flanged or studded connection.',
  tabs: {
    overview: 'Studs are threaded full length with a nut on each end for through-bolted flanges, or threaded into tapped holes on studded connections. They are made up in a star pattern in steps to the final torque or stretch so the gasket seats evenly.',
    engineering: 'Alloy steel studs and heavy hex nuts to the grades API 6A allows for the service, with a hardness limit for sour service per NACE MR0175 (S8). Thread lubricant and torque values per the OEM or operator practice.',
    connections: 'Every flanged and studded connection.',
    safety: 'Under-torqued studs leak; over-torqued or corroded studs fail on make-up. Hands and tools stay clear of the stud ends when hammering wrenches are used.',
    evidence: 'API 6A (S1); NACE MR0175 (S8); field practice (S9).',
  },
  hazards: [H.pressure, H.pinch], sources: ['S1', 'S8', 'S9'] });

comp('WH-ADAPTERFLANGE', 'WH', 'connections', 'Adapter flange and crossover', ['crossover flange', 'adapter', 'double-studded adapter', 'DSA'],
  'A short component with a different flange size or rating on each face, used to connect two components that do not match, such as a 10K tubing head to a 15K frac stack.',
  'Double-studded adapters have studs on both faces and no bolt holes; flanged adapters have one flange and one studded face. The bore matches the smaller of the two connections or steps between them.',
  'API 6A; the adapter is rated to the lower of its two ratings for the connection it makes, and the assembly above it is rated to its own working pressure.',
  'A crossover between ratings is where an under-rated wellhead is exposed to treating pressure if a tree saver is not used; the isolation strategy is decided at rig-up.',
  { level: 'part', hazards: [H.pressure] });

comp('WH-SPACERSPOOL', 'WH', 'connections', 'Spacer spool and riser spool', ['spacer spool', 'riser spool', 'extension spool', 'spool piece'],
  'A flanged spool inserted in the stack to add height or to move a connection clear of another component, for example to lift the goat head above the wing valve actuators.',
  'Same bore as the stack; flanged both ends. Length is chosen at rig-up to suit the iron run and the equipment that will land on the tree.',
  'API 6A pressure-containing spool rated with the stack.',
  'Every added spool adds two ring-gasket connections and two test points.',
  { level: 'part', hazards: [H.pressure] });

// ---- flow iron components
comp('WH-FLOWIRON-PUPJOINT', 'WH-FLOWIRON', 'flow-iron', 'Pup joint (integral union pipe)', ['pup joint', 'iron joint', 'straight joint', 'hammer union pipe'],
  'A straight length of high-pressure pipe with a male union sub on one end and a female sub with a wing nut on the other, the basic building block of a temporary treating line.',
  'Sizes 2 in., 3 in., and 4 in. nominal in lengths from a few inches to 10 ft or more. The union halves are integral to the pipe, not welded on in the field. Each joint carries a serial number and a wall-thickness inspection history.',
  'Working pressure 10,000 or 15,000 psi cold; union halves and pipe are matched by pressure class; wall loss limits from the iron inspection program retire a joint.',
  'A joint with an unreadable serial or no current inspection does not go on a high-pressure line. Restraints on every joint.',
  { ...drawn(IRON, ['WH-FLOWIRON-PUPJOINT']), hazards: [H.pressure, H.lof, H.erosion] });

comp('WH-FLOWIRON-HAMMERUNION', 'WH-FLOWIRON', 'flow-iron', 'Hammer union', ['wing union', 'wing nut', 'union', '1502 union (vendor figure number)'],
  'The three-piece quick connection on flow iron: a male sub, a female sub with a seal ring, and a threaded wing nut that is tightened with a hammer.',
  'The wing nut has three lugs that are struck with a sledge to make up and break out. Pressure classes are identified by figure numbers that are vendor nomenclature; halves of different figure numbers can thread together in some sizes and will fail under pressure. Color coding and thread checks are used to prevent mismatches.',
  'Rated by figure number to the pressure class of the line; seal rings are elastomer with a metal backup on high-pressure unions.',
  'Never mix union halves across pressure classes even if they thread together. Never strike a union under pressure. Hands clear of the lugs when hammering.',
  { ...drawn(IRON, ['WH-FLOWIRON-HAMMERUNION']), hazards: [H.pressure, H.lof, H.pinch] });

comp('WH-FLOWIRON-SWIVEL', 'WH-FLOWIRON', 'flow-iron', 'Swivel joint', ['swivel', 'chiksan (vendor name)', 'long-sweep swivel', 'style 10 or style 50 swivel (vendor designations)'],
  'A joint with two or three rotating elbows on ball-race bearings that lets a treating line absorb misalignment and movement between the missile, manifold, and tree.',
  'Two-piece swivels give one axis of rotation; three-piece give three. Long-sweep elbows reduce erosion compared with short-radius ones. Bearings are grease-packed and the seal is a replaceable packing.',
  'Rated with the iron; swivels are the most erosion-prone item in a treating line because the flow turns inside them.',
  'Swivels are inspected for wall loss at the elbows and for play in the bearings; a swivel that leaks at the packing is removed from service, not tightened under pressure.',
  { ...drawn(IRON, ['WH-FLOWIRON-SWIVEL']), hazards: [H.pressure, H.lof, H.erosion] });

comp('WH-FLOWIRON-TEE', 'WH-FLOWIRON', 'flow-iron', 'Tee and cross blocks', ['tee', 'cross', 'lateral', 'block tee'],
  'Forged blocks with three or four union connections that split or combine treating lines, used at the goat head, the manifold, and where relief or bleed lines branch off.',
  'Blocks are machined from a single forging with integral union ends. Flow that turns inside a tee erodes the wall opposite the inlet; target tees with a blanked run are used where the turn is sharp.',
  'Rated with the iron; wall-thickness inspection points are marked on the erosion side.',
  'A tee is a line-of-fire item on two or three axes; restrain every branch.',
  { ...drawn(IRON, ['WH-FLOWIRON-TEE']), hazards: [H.pressure, H.lof, H.erosion] });

comp('WH-FLOWIRON-CHECKVALVE', 'WH-FLOWIRON', 'flow-iron', 'Check valve (dart type)', ['check valve', 'dart valve', 'flapper check', 'in-line check'],
  'A one-way valve in the treating line that stops fluid flowing back from the well toward the pumps when a pump is shut down or a line fails.',
  'The dart is a spring-loaded plug that lifts on flow toward the well and seats on reverse flow. Flapper checks are the alternative. One is fitted on each pump discharge and often on the main line near the manifold.',
  'Rated with the iron; the dart and seat are hardened for proppant service and are inspected for cut-out.',
  'A stuck-open check leaves the pumps exposed to wellhead pressure on shutdown; checks are function tested before the job.',
  { ...drawn(IRON, ['WH-FLOWIRON-CHECKVALVE']), hazards: [H.pressure, H.erosion] });

comp('WH-FLOWIRON-PRV', 'WH-FLOWIRON', 'flow-iron', 'Pressure relief valve (pop-off)', ['pop-off', 'PRV', 'relief valve', 'pressure relief'],
  'A spring or pilot-operated relief valve on the high-pressure side of the missile or the manifold, set above the maximum treating pressure, that opens to a relief line and tank to protect the iron and tree from overpressure.',
  'The set pressure is verified before the job and recorded. The relief line is a rated, restrained iron run to a tank or pit sized for the pump rate. Some spreads use a rupture disc or a hydraulically actuated relief valve instead of or in addition to the spring valve.',
  'Set point below the iron and tree working pressure and above the planned maximum treating pressure, with the pump kickout set below the relief set point so the pumps trip first.',
  'A relief valve that lifts discharges proppant slurry at full rate into the relief line; the relief line is inside the red zone and is treated as a live line.',
  { ...drawn(IRON, ['WH-FLOWIRON-PRV']), hazards: [H.pressure, H.lof], specs: [{ name: 'Relationship of set points', value: 'kickout below relief set point below iron working pressure', unit: '', source: 'S9', tier: 'E3' }] });

comp('WH-FLOWIRON-PLUGVALVE', 'WH-FLOWIRON', 'flow-iron', 'Plug valve', ['plug valve', 'lo-torque plug valve', 'quarter-turn valve', 'iron valve'],
  'A quarter-turn valve with a tapered or cylindrical plug used in treating lines to isolate a pump discharge, a manifold branch, or a bleed line.',
  'Lubricated plug valves seal with a sealant film between the plug and body; the lever or gear handle shows position. They are used where a quick, hand-operated isolation is needed and where a gate valve would be too heavy for the iron run.',
  'Rated with the iron in 2 in. and 3 in. sizes at 10,000 or 15,000 psi; sealant injection per the OEM.',
  'A plug valve is fully open or fully closed; a partly open plug in proppant flow cuts out quickly. Never operate a plug valve on a line at pressure unless it is designed for it.',
  { ...drawn(IRON, ['WH-FLOWIRON-PLUGVALVE']), hazards: [H.pressure, H.erosion, H.pinch] });

comp('WH-FLOWIRON-RESTRAINT', 'WH-FLOWIRON', 'flow-iron', 'Iron restraints and whip checks', ['whip check', 'safety cable', 'restraint sling', 'iron restraint', 'hose whip'],
  'The slings, cables, and anchors that hold a treating line down and limit how far a joint can travel if a union or pipe fails under pressure.',
  'Restraints are fitted across every union and at intervals along the run, anchored to a fixed point or to the line itself so a failed joint cannot whip. Whip checks are the short cable loops across a single union; restraint systems are the rated slings and nets that many operators now require on all temporary high-pressure lines.',
  'Rated for the pipe size and pressure class per the restraint vendor; inspected before the job.',
  'Restraints do not make a line safe to approach; the red zone stays in force during pumping.',
  { ...drawn(IRON, ['WH-FLOWIRON-RESTRAINT']), hazards: [H.lof] });

rec({ id: 'WH-MONOLINE', parent: 'WH', group: 'flow-iron', level: 'equipment', name: 'Big-bore and monoline treating systems', aliases: ['monoline', 'big-bore iron', 'single-line frac', 'flanged treating line', 'clamp-connected line'],
  function: 'A single large-bore treating line, flanged or clamp-connected, that replaces several hammer-union lines between the missile, manifold, and tree, reducing the number of connections and the erosion at unions.',
  tabs: {
    overview: 'A conventional treating line to a 5-1/8 in. tree is three or four 3 in. lines with dozens of hammer unions. A monoline uses one 5-1/8 in. or 7-1/16 in. line with flanged or clamp connections, articulated with flanged swivels, and lands on a flanged goat head or directly on the manifold. Fewer connections means fewer leak paths and less time to rig up, at the cost of heavier components that need lifting equipment.',
    engineering: 'Flanged components are API 6A; clamp connectors are proprietary and rated by the vendor. The line is designed for the treating rate so that velocity and erosion stay within limits.',
    connections: 'Missile high-pressure header to the zipper manifold inlet; manifold outlets to the goat head.',
    safety: 'Heavier lifts at rig-up; the same red zone and restraint rules apply.',
    evidence: 'OEM and service company pages (S2, S11, S12); field practice (S9).',
    operations: 'Rigged with a crane or a purpose-built iron trailer; connections tested with the rest of the line before the first stage.',
    failure_modes: 'Flange gasket leaks after repeated make-up; clamp seal wear; erosion at swivels.',
  }, hazards: [H.pressure, H.lof, H.dropped], sources: ['S2', 'S9', 'S11', 'S12'] });

// ---- zipper components
comp('WH-ZIPPER-SKID', 'WH-ZIPPER', 'zipper-manifold', 'Manifold skid', ['skid', 'zipper skid', 'manifold frame'],
  'The steel frame that carries the manifold, valves, and control unit as one lift and sets the layout of the branches to each well.',
  'Skid dimensions are set by the number of wells served and the spacing of the trees on the pad; the skid is set on mats and leveled so the outlet lines reach each tree without forcing the iron.',
  'Structural steel; lifting points certified; grounded.',
  'The skid is set with a crane; the manifold is a heavy lift over the pad.',
  { ...drawn(ZIP, ['WH-ZIPPER-SKID']), hazards: [H.dropped] });

comp('WH-ZIPPER-INLETHEADER', 'WH-ZIPPER', 'zipper-manifold', 'Inlet header', ['header', 'inlet manifold', 'common header'],
  'The large-bore pipe on the skid that receives the treating line from the missile and distributes it to each well branch.',
  'The header is a forged or fabricated pressure vessel rated with the stack, with a branch outlet per well and an inlet at one or both ends; a bleed valve and a pressure transducer are fitted on the header.',
  'API 6A pressure-containing component rated to the stack working pressure.',
  'The header holds treating pressure whenever any branch is open to a well; it is bled through the bleed valve, never by breaking a connection.',
  { ...drawn(ZIP, ['WH-ZIPPER-INLETHEADER']), hazards: [H.pressure] });

comp('WH-ZIPPER-VALVE', 'WH-ZIPPER', 'zipper-manifold', 'Zipper valves (one per well branch)', ['zipper valve', 'branch valve', 'well isolation valve', 'manifold valve'],
  'The hydraulic gate valve in each well branch that selects which well the spread treats; open on the well being fractured, closed on the wells being prepared for wireline.',
  'Each branch has at least one hydraulic valve; many manifolds fit two in series for double isolation of a well with wireline in the hole. Valves are cycled once per stage per well, which makes them the highest-cycle valves on the pad.',
  'Same API 6A hydraulic gate valve as the tree; position indicated at the control panel.',
  'A branch to a well with a lubricator on the tree must be closed and verified before the neighbor is pumped; the position lamp is not the only check, the pressure on the closed branch is watched too.',
  { ...drawn(ZIP, ['WH-ZIPPER-VALVE']), hazards: [H.pressure, H.erosion], connections: [{ target: 'WH-GATEVALVE-HYD', direction: 'undirected', type: 'mechanical', note: 'Instance of the hydraulic gate valve variant' }] });

comp('WH-ZIPPER-OUTLET', 'WH-ZIPPER', 'zipper-manifold', 'Branch outlets to the trees', ['outlet', 'branch outlet', 'well line'],
  'The outlet connection of each branch where the treating line to that well\'s goat head is made up.',
  'Hammer union or flanged outlets sized to the line; the outlet lines run to each tree with swivels to take up alignment.',
  'Rated with the manifold.',
  'Outlet lines are restrained and inside the red zone.',
  { ...drawn(ZIP, ['WH-ZIPPER-OUTLET']), hazards: [H.pressure, H.lof] });

comp('WH-ZIPPER-TRANSDUCER', 'WH-ZIPPER', 'zipper-manifold', 'Pressure transducers', ['transducer', 'pressure sensor', 'wellhead pressure transducer'],
  'Electronic pressure sensors on the header and on each branch that report treating pressure to the data van and confirm that a closed branch is isolated.',
  'Transducers are mounted on a needle-valved port so they can be isolated and changed; readings are compared with the treating pressure at the pumps to check for line friction and leaks.',
  'Rated to the line pressure; calibration checked before the job.',
  'A transducer port is a small-bore high-pressure connection; it is bled before the sensor is changed.',
  { ...drawn(ZIP, ['WH-ZIPPER-TRANSDUCER']), hazards: [H.pressure] });

comp('WH-ZIPPER-BLEEDVALVE', 'WH-ZIPPER', 'zipper-manifold', 'Bleed valve and bleed line', ['bleed valve', 'bleed-off', 'blowdown valve', 'bleed line'],
  'A small manual valve on the header that bleeds trapped pressure from the manifold to a tank or pit after pumping stops and before any connection is broken.',
  'Bleed lines run to a tank away from the work area. Bleeding is done slowly; a manifold full of slurry can hold pressure behind settled sand.',
  'Small-bore gate or needle valve rated with the manifold.',
  'Verify zero at the transducer after bleeding; trapped pressure behind packed sand is a known cause of injuries when unions are broken.',
  { ...drawn(ZIP, ['WH-ZIPPER-BLEEDVALVE']), hazards: [H.pressure, H.lof] });

// ---- frac valve control components
comp('WH-FRACVALVECONTROL-HPU', 'WH-FRACVALVECONTROL', 'valve-control', 'Hydraulic power unit', ['HPU', 'hydraulic pump unit', 'power pack'],
  'The pump, reservoir, and filtration that supply hydraulic pressure to the valve actuators on the tree and manifold.',
  'Diesel or electric driven; supply pressure per the actuator design; filtered, with a reservoir sized for all actuators. Mounted on the manifold skid or on its own skid outside the red zone.',
  'Hydraulic components rated above the actuator supply pressure; fluid per the actuator OEM.',
  'Hydraulic leaks near the tree are not repaired under pressure; the unit is shut down and the circuit bled.',
  { ...drawn(ZIP, ['WH-ZIPPER-HPU']), hazards: [H.pressure] });

comp('WH-FRACVALVECONTROL-ACCUMULATOR', 'WH-FRACVALVECONTROL', 'valve-control', 'Accumulator bank', ['accumulator', 'accumulator bottles', 'nitrogen bottles'],
  'Nitrogen-precharged bottles that store hydraulic volume so every actuated valve can be closed at least once if the pump stops.',
  'Sized for the total closing volume of all actuators plus margin; precharge checked before the job.',
  'Pressure vessels with a precharge below the operating pressure; rated per the vendor.',
  'Accumulators hold stored energy after the pump is off; they are bled before maintenance.',
  { ...drawn(ZIP, ['WH-ZIPPER-ACCUMULATOR']), hazards: [H.pressure] });

comp('WH-FRACVALVECONTROL-PANEL', 'WH-FRACVALVECONTROL', 'valve-control', 'Remote control panel and emergency shut-in', ['control panel', 'remote panel', 'ESD', 'emergency shutdown', 'shut-in button'],
  'The panel outside the red zone with one control and position indicator per actuated valve, and the emergency shut-in control that closes the designated valves together.',
  'Each valve has an open and close control and a lamp or indicator fed from the actuator position switch. The emergency shut-in closes the upper master and wing valves on all trees, or a chosen set, in one action; which valves are on the shut-in list is agreed before the job.',
  'Electrical or hydraulic pilot controls; panel rated for outdoor use.',
  'The shut-in drill is run before the first stage so everyone knows what closes and what stays open. Position lamps are a control indication, not proof of isolation.',
  { hazards: [H.pressure] });

// ---- tree saver components
comp('WH-TREESAVER-MANDREL', 'WH-TREESAVER', 'wellhead-isolation', 'Isolation tool mandrel', ['mandrel', 'isolation sleeve', 'wear sleeve'],
  'The tube that carries the treating fluid through the tree and wellhead so that proppant does not contact the hanger seals or spool bores.',
  'Bore sized to pass the treating rate without excessive velocity; length reaches from the landing point to below the seals it protects. The top connects to the running tool and, on some designs, becomes the flow path for the goat head.',
  'High-strength alloy steel; hardfaced or coated bore on some designs.',
  'Running and pulling is a lift over an open tree; the well is shut in below.',
  { ...drawn(TS, ['WH-TREESAVER-MANDREL']), hazards: [H.pressure, H.dropped, H.erosion] });

comp('WH-TREESAVER-SEAL', 'WH-TREESAVER', 'wellhead-isolation', 'Isolation seals (cups or packoff)', ['seal cups', 'cups', 'packoff element', 'isolation seal'],
  'The elastomer cups or packoff elements near the bottom of the mandrel that seal in the wellhead bore so that treating pressure is carried by the mandrel and not by the wellhead below the seal.',
  'Cups seal by pressure from above; packoff elements are set mechanically or hydraulically. Seal OD matches the bore it seals in; the seal is inspected between wells for cuts and swelling.',
  'Elastomer per the temperature class and fluids; backup rings on high-pressure designs.',
  'A leaking seal exposes the wellhead to treating pressure; the annulus above the seal is monitored for pressure during the job.',
  { ...drawn(TS, ['WH-TREESAVER-SEAL']), hazards: [H.pressure] });

comp('WH-TREESAVER-SHOULDER', 'WH-TREESAVER', 'wellhead-isolation', 'Landing shoulder and running adapter', ['landing shoulder', 'hanger shoulder', 'running tool', 'top adapter'],
  'The shoulder that lands the tool at its set depth in the tree or adapter, and the top adapter that connects the running tool and the flow path above.',
  'The shoulder carries the tool weight and, on retained designs, is locked down against upward load from pressure below. The top adapter has a lifting profile and the connection to the goat head or running tool.',
  'Load-bearing alloy steel; lockdown per the design.',
  'A tool that is not landed and locked can be pumped up the tree; confirm the set before pumping.',
  { ...drawn(TS, ['WH-TREESAVER-SHOULDER']), hazards: [H.pressure, H.dropped] });

// ---- gate valve variant and extras
rec({ id: 'WH-GATEVALVE-HYD', parent: 'WH', group: 'gate-valve', level: 'equipment', name: 'Gate valve, hydraulic-actuated variant', aliases: ['hydraulic gate valve', 'actuated gate valve', 'hyd. valve', 'HGV'],
  function: 'The gate valve sub-assembly with a hydraulic actuator in place of the handwheel and bearing cap; the working valve of the frac stack and zipper manifold because it can be operated from outside the red zone and closed by emergency shut-in.',
  tabs: {
    overview: 'Identical body, gate, seats, stem, packing, and bonnet to the manual valve. The actuator is a hydraulic cylinder that pushes the stem to open the gate; spring-return designs close the valve when hydraulic pressure is released, so a loss of supply fails the valve closed. Position is shown by an indicator rod and by a switch that feeds the control panel lamp.',
    engineering: 'Actuator sized for the stem load at the valve working pressure with margin; supply pressure and closing time per the OEM; some models include a manual override for use with the hydraulics isolated.',
    connections: 'Hydraulic supply and return to the frac valve control unit; flanged ends as the manual valve.',
    safety: 'Stored energy in the spring and cylinder; isolate and bleed hydraulics before maintenance. Fully open or fully closed only; the actuator does not throttle.',
    specs: 'Bore 5-1/8 in. or 7-1/16 in.; working pressure 10,000 or 15,000 psi; spring-return fail-closed typical for frac service.',
    evidence: EVID,
    operations: 'Function tested from the panel at rig-up; cycled per stage as the frac wing and zipper valves; greased per schedule.',
    failure_modes: 'Actuator seal leaks; broken position switches; slow closing from low accumulator precharge; seat wash after closing on flow.',
  },
  specs: [{ name: 'Actuator type', value: 'hydraulic, spring-return (fail closed) typical', unit: '', source: 'S2', tier: 'E2' }],
  connections: [{ target: 'WH-GATEVALVE', direction: 'undirected', type: 'mechanical', note: 'Shares body, gate, seats, stem, packing, and bonnet' }, { target: 'WH-FRACVALVECONTROL', direction: 'upstream', type: 'hydraulic' }],
  hazards: [H.pressure, H.erosion, H.pinch], ...drawn(HYD, ['WH-GATEVALVE-BODY', 'WH-GATEVALVE-FLANGE-IN', 'WH-GATEVALVE-FLANGE-OUT', 'WH-GATEVALVE-SEAT-UP', 'WH-GATEVALVE-SEAT-DOWN', 'WH-GATEVALVE-GATE', 'WH-GATEVALVE-BONNET', 'WH-GATEVALVE-PACKING', 'WH-GATEVALVE-BEARING', 'WH-GATEVALVE-STEM', 'WH-GATEVALVE-ACTUATOR']),
  simulation: { clips: ['open_close'], disclosure: 'Simplified motion.' }, sources: ['S1', 'S2', 'S5', 'S9'] });

comp('WH-GATEVALVE-GREASEFITTING', 'WH-GATEVALVE', 'gate-valve', 'Grease and sealant fittings', ['grease fitting', 'sealant port', 'grease port', 'body bleed'],
  'The check-valved fittings on the body and bonnet through which sealant is injected into the seat pockets and body cavity, and the bleed port through which trapped cavity pressure is released.',
  'Sealant injected behind the seats supports the metal seal after wear and displaces proppant from the cavity. Fittings carry a check valve; the body bleed is a small valve or plug used to verify zero cavity pressure before the bonnet is opened.',
  'Fittings rated to the valve working pressure; sealant per the OEM.',
  'Grease fittings are high-pressure connections; a fitting with a failed check will discharge when the cap is removed. Bleed the cavity through the bleed port, never by loosening a fitting.',
  { hazards: [H.pressure] });

rec({ id: 'WH-PRODUCTIONTREE', parent: 'WH', group: 'production-tree', level: 'equipment', name: 'Production tree', aliases: ['Christmas tree', 'xmas tree', 'production xmas tree', 'tree'],
  function: 'The permanent valve assembly installed on the tubing head after the completion, replacing the frac stack, to control production and give access to the tubing for wireline and coiled tubing over the life of the well.',
  tabs: {
    overview: 'A land production tree is a smaller version of the frac stack: master valve or valves, a cross or tee, a wing valve with a choke, and a swab valve with a tree cap. It is rated for the shut-in tubing pressure rather than the treating pressure, so it is usually a lower rating and smaller bore than the frac stack. Solid-block trees machine the valves into one forging to reduce flanged connections.',
    engineering: 'API 6A; bore matched to the tubing hanger profile; pressure rating for the shut-in pressure with margin; actuator on the wing or master where the well is on a safety system; choke sized for the production rate.',
    connections: 'Below: tubing head adapter and tubing hanger with the BPV profile. Wing: flowline to the production facility through the choke. Top: tree cap with gauge and access for lubricators.',
    safety: 'Installed with the BPV or TWC set; tested against the TWC before the well is opened. Sour wells need material class and monitoring per NACE MR0175 (S8).',
    evidence: 'API 6A (S1); NACE MR0175 (S8); field and manufacturing practice (S9).',
    operations: 'Nippled up after the frac stack comes off and the tubing is landed; tested; choke set for the initial flow; later intervention through the swab valve.',
    failure_modes: 'Choke trim erosion; wing valve seat wear; actuator failures; gasket leaks on the adapter.',
  }, hazards: [H.pressure, H.h2s], sources: ['S1', 'S8', 'S9'] });

// write
for (const r of out) save(r);
console.log('wrote', out.length, 'new records; patched 10 existing records');
