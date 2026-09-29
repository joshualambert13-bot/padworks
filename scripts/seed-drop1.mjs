// Drop 1 seed: WH system and the first equipment and component records.
// Status is "draft" for every AI-drafted record. Josh moves status on review.
// Run: node scripts/seed-drop1.mjs   (writes content/records/WH/*.json)
import fs from 'node:fs';
import path from 'node:path';

const DATE = '2026-09-28';
const rev = (note) => ({ rev: 'A', author: 'AI draft', date: DATE, note });
const H = {
  pressure: { class: 'Stored pressure', control: 'Pressure test before pumping; bleed down and verify zero before breaking any connection.' },
  lof: { class: 'Line of fire', control: 'Restraints and whip checks on iron; exclusion zone around pressurized lines.' },
  pinch: { class: 'Pinch point', control: 'Hands clear of wing nuts, handwheels, and actuator linkages during operation.' },
  erosion: { class: 'Erosion cut-out', control: 'Tree saver in the wellhead; valves fully open or fully closed only; iron inspection.' },
  dropped: { class: 'Dropped object', control: 'Certified lifting gear; no personnel under suspended tree or lubricator sections.' },
};

const records = [];

records.push({
  id: 'WH', system: 'WH', level: 'system', name: 'Wellhead, frac stack, and high-pressure iron',
  aliases: ['surface pressure boundary', 'wellhead and tree'],
  function: 'The surface pressure boundary for the well from casing hanger to goat head, plus the temporary manifolds and iron that connect the pump spread to the well during fracturing, wireline, drillout, and flowback.',
  status: 'draft', evidence_tier: 'E2', reviewers: [],
  tabs: {
    overview: 'The wellhead is permanent: casing head, casing spools, hangers, and the tubing head stay with the well for life. The frac stack is temporary: gate valves, a studded cross with wing valves, a swab valve, and a goat head that are rented for the completion and removed when the production tree goes on. The zipper manifold and flow iron connect the frac spread to one or more trees on the pad. Every item in this system is rated to the maximum treating pressure of the job, most commonly 10,000 or 15,000 psi working pressure for land plug-and-perf completions.',
    engineering: 'Pressure-containing and pressure-controlling parts are governed by API 6A: pressure rating, material class, temperature class, product specification level (PSL), and performance requirement (PR) level. Flanged ends above 5,000 psi use the 6BX flange with a BX ring gasket. The bore of the frac stack matches the casing or tubing head bore so that wireline tools, plugs, and coiled tubing can pass; 5-1/8 in. and 7-1/16 in. are the common frac stack bores.',
    connections: 'Downstream of the missile high-pressure header through flow iron to the zipper manifold, then to the goat head on each tree. The flowback wing valve feeds the flowback iron to the choke manifold. The swab valve provides vertical access for the wireline lubricator and the coiled tubing injector.',
    safety: 'The system holds the highest stored energy on the pad. Red zone around the tree, manifold, and iron while pumping. Valves are cycled only in their design sequence: masters are not cycled under pressure or flow; the swab valve is closed before pumping; wing valves are fully open or fully closed.',
    specs: 'Working pressure 10,000 or 15,000 psi typical for land completions; 20,000 psi on high-pressure plays. Bore 5-1/8 in. or 7-1/16 in. Temperature class and material class per the well fluids.',
    evidence: 'API 6A (S1) for pressure-containing parts; public OEM pages (S2, S3, S5, S11, S12) for configurations; field practice (S9) for operating sequence.',
    operations: 'Rig-up after the wellhead is frac-ready: install the tree saver if the wellhead needs protection, nipple up the frac stack, install the goat head, run iron to the zipper manifold and missile, pressure test to the job pressure, and function test every actuator from the control unit.',
    failure_modes: 'Erosion of gates and seats from proppant; wing nut and union leaks; actuator hydraulic leaks; ring gasket damage on repeated make-up; body erosion at the goat head inlets.',
  },
  specs: [
    { name: 'Working pressure, typical', value: '10,000 to 15,000', unit: 'psi', si_value: '69 to 103', si_unit: 'MPa', source: 'S2', tier: 'E2' },
    { name: 'Nominal bore, typical', value: '5-1/8 or 7-1/16', unit: 'in.', si_value: '130 or 179', si_unit: 'mm', source: 'S2', tier: 'E2' },
  ],
  standards: [{ standard: 'API 6A', edition: 'verify edition held', clause: '', paraphrase: 'Wellhead and tree equipment: design, materials, PSL, PR, testing, and marking of pressure-containing and pressure-controlling parts.', source: 'S1' }],
  connections: [{ target: 'PP', direction: 'upstream', type: 'hammer union', rating: '15K', note: 'Missile high-pressure header to zipper inlet' }, { target: 'WL', direction: 'undirected', type: 'flanged', rating: '15K', note: 'Lubricator on the swab valve' }],
  hazards: [H.pressure, H.lof, H.erosion],
  drawn_in_3d: true, scene: 'WH-FRACTREE', sources: ['S1', 'S2', 'S3', 'S5', 'S9'], revision: rev('Drop 1 seed'),
});

records.push({
  id: 'WH-GATEVALVE', system: 'WH', group: 'gate-valve', level: 'equipment', parent: 'WH',
  name: 'Gate valve, through-conduit slab gate (API 6A)',
  aliases: ['frac valve', 'hydraulic gate valve', 'manual gate valve', 'slab gate valve'],
  function: 'A two-position, full-bore valve that isolates or opens the flow path by sliding a slab gate with a through port across the bore between two floating seats. It is the repeating sub-assembly of the frac tree, zipper manifold, wellhead outlets, production tree, and choke manifold.',
  status: 'draft', evidence_tier: 'E2', reviewers: [],
  tabs: {
    overview: 'The gate is a rectangular slab with a circular port. In the closed position the solid part of the slab spans the bore; the stem moves the gate by one bore diameter to align the port with the bore. Floating seats on either side of the gate are pressure-energized against the gate face. The bonnet closes the top of the body cavity and carries the stem, packing, and bearing assembly. Manual valves are operated by a handwheel through a threaded stem and bearing; actuated valves replace the handwheel with a hydraulic cylinder, most often spring-return so the valve fails closed on loss of hydraulic pressure.',
    engineering: 'Body and bonnet are forged low-alloy steel (4130 or 4140 class) or higher alloy for sour or corrosive service per the API 6A material class. Gate and seats are hardened or hardfaced for proppant service. Stem sealing uses a packing set and, on many designs, a back seat that lets the packing be changed under pressure. Grease or sealant injection ports feed the seat pockets and the body cavity. The valve is rated by working pressure class, temperature class, material class, PSL, and PR level; the frac stack version is normally PSL 3, PR 2 (verify on the specific product).',
    connections: 'Flanged ends: 6B up to 5,000 psi; 6BX for 10,000 psi and above (and for larger bores at lower ratings), with R or RX ring gaskets for 6B and BX gaskets for 6BX. Studded and flanged variants exist for stacking on the cross. Hydraulic actuators connect to the frac valve control unit through hydraulic hoses.',
    safety: 'Never throttle: a partly open gate in proppant flow cuts the gate and seats and can lead to a loss of containment. Do not cycle the lower master under pressure or flow. Bleed the body cavity before removing the bonnet. Hydraulic actuators store energy in the spring and the cylinder; isolate hydraulics before maintenance.',
    specs: 'Bore 5-1/8 in. or 7-1/16 in.; working pressure 10,000 or 15,000 psi; face-to-face per the API 6A table for the flange type and rating; actuator sizing per OEM.',
    evidence: 'API 6A (S1) for design and rating; OEM product pages (S2, S5) for configurations; field and manufacturing practice (S9).',
    operations: 'Open and close fully; count turns on manual valves and confirm position indication on actuated valves. Function test each actuator from the control unit before pumping. Grease per the OEM schedule during long jobs.',
    failure_modes: 'Seat and gate erosion; stem packing leaks; grease fitting failures; actuator seal leaks; gate cracking after washing; ring gasket damage.',
  },
  specs: [
    { name: 'Nominal bore (starter model)', value: 5.125, unit: 'in.', si_value: 130.2, si_unit: 'mm', source: 'S2', tier: 'E2' },
    { name: 'Working pressure (starter model)', value: 15000, unit: 'psi', si_value: 103.4, si_unit: 'MPa', source: 'S2', tier: 'E2' },
    { name: 'Gate travel', value: 'one bore diameter', unit: '', source: 'S9', tier: 'E3' },
    { name: 'Actuator type, frac service', value: 'hydraulic, spring-return (fail closed)', unit: '', source: 'S2', tier: 'E2' },
  ],
  standards: [
    { standard: 'API 6A', edition: 'verify', clause: 'flanged end and outlet connections', paraphrase: '6B flanges for 2,000 to 5,000 psi; 6BX flanges for 10,000 psi and above and for larger sizes at 2,000 to 5,000 psi; ring gasket types R, RX, and BX.', source: 'S1' },
    { standard: 'API 6A', edition: 'verify', clause: 'PSL and PR', paraphrase: 'Product specification levels 1 to 4 set the quality and testing requirements; performance requirement levels PR1 and PR2 set the performance verification testing.', source: 'S1' },
  ],
  oem_examples: [{ oem: 'Cameron (SLB)', model: 'frac tree gate valves', figure: 'product family', source: 'S2' }],
  connections: [
    { target: 'WH-FRACTREE', direction: 'undirected', type: 'flanged', rating: '15K', note: 'Repeats as master, wing, and swab valves' },
    { target: 'WH-ZIPPER', direction: 'undirected', type: 'flanged', rating: '15K', note: 'Per-well isolation valves' },
    { target: 'WH-FRACVALVECONTROL', direction: 'upstream', type: 'hydraulic', rating: '', note: 'Actuator supply and return' },
  ],
  hazards: [H.pressure, H.erosion, H.pinch],
  drawn_in_3d: true, glb: '/glb/WH/WH-GATEVALVE.glb',
  mesh_nodes: ['WH-GATEVALVE-BODY', 'WH-GATEVALVE-FLANGE-IN', 'WH-GATEVALVE-FLANGE-OUT', 'WH-GATEVALVE-SEAT-UP', 'WH-GATEVALVE-SEAT-DOWN', 'WH-GATEVALVE-GATE', 'WH-GATEVALVE-BONNET', 'WH-GATEVALVE-PACKING', 'WH-GATEVALVE-BEARING', 'WH-GATEVALVE-STEM', 'WH-GATEVALVE-HANDWHEEL'],
  simulation: { clips: ['open_close'], disclosure: 'Simplified motion: rising stem shown; real frac valves are commonly non-rising stem designs.' },
  sources: ['S1', 'S2', 'S5', 'S9'], revision: rev('Drop 1 seed; geometry from cad/scripts/WH/gate_valve.py'),
});

const comp = (id, name, aliases, fn, over, eng, safety, nodes, extra = {}) => records.push({
  id, system: 'WH', group: 'gate-valve', level: 'component', parent: 'WH-GATEVALVE', name, aliases,
  function: fn, status: 'draft', evidence_tier: 'E2', reviewers: [],
  tabs: { overview: over, engineering: eng, safety, evidence: 'API 6A (S1) for materials and testing; OEM pages (S2, S5); field practice (S9).' },
  hazards: [H.pressure], drawn_in_3d: true, mesh_nodes: nodes, glb: '/glb/WH/WH-GATEVALVE.glb', sources: ['S1', 'S2', 'S9'], revision: rev('Drop 1 seed'), ...extra,
});

comp('WH-GATEVALVE-BODY', 'Valve body', ['body block'],
  'The forged pressure-containing block with the through bore, the gate cavity, the seat pockets, and the bonnet connection.',
  'The body is a rectangular forging bored along the flow axis with a vertical cavity for the gate. Seat pockets are machined on each side of the cavity. The top of the body carries the bonnet flange or a threaded bonnet connection. Grease and body-bleed ports are drilled into the cavity.',
  'Material per API 6A material class: low-alloy steel for standard service, higher alloys or overlays for sour and corrosive service. Wall thickness and bolting follow the pressure rating. The body is hydrostatically tested as part of the assembled valve.',
  'Bleed the body cavity before removing the bonnet. Cavity pressure can remain trapped after the line is bled.',
  ['WH-GATEVALVE-BODY', 'WH-GATEVALVE-FLANGE-IN', 'WH-GATEVALVE-FLANGE-OUT']);

comp('WH-GATEVALVE-GATE', 'Slab gate', ['gate', 'slab'],
  'The sliding rectangular plate with a through port that opens or closes the bore.',
  'The gate travels one bore diameter between the open and closed positions. Its faces are lapped and hardened or hardfaced because they seal against the seats under full differential pressure while proppant-laden fluid passes the open port.',
  'Hardfaced or through-hardened alloy steel; some designs use tungsten carbide coatings on the faces. Gate-to-stem connection is a T-slot or threaded connection depending on rising or non-rising stem design.',
  'A partly open gate is cut out quickly in proppant service; operate to full open or full closed only.',
  ['WH-GATEVALVE-GATE'], { simulation: { clips: ['open_close'] } });

comp('WH-GATEVALVE-SEAT', 'Floating seats', ['seat rings', 'seats'],
  'Two ring seats, one each side of the gate, that seal against the gate faces and are energized by line pressure and springs.',
  'The seats float in their pockets so that line pressure pushes the downstream seat against the gate. Sealant injected into the seat pocket supports the metal-to-metal seal after wear.',
  'Hardened alloy steel with hardfaced sealing faces; back seals of elastomer or thermoplastic between seat and pocket.',
  'Seat pocket sealant injection is done under pressure with the proper grease gun and fitting; follow the OEM procedure.',
  ['WH-GATEVALVE-SEAT-UP', 'WH-GATEVALVE-SEAT-DOWN']);

comp('WH-GATEVALVE-STEM', 'Stem, packing, and bearing assembly', ['stem', 'stem packing', 'bearing cap'],
  'The stem transmits handwheel or actuator force to the gate; the packing seals the stem where it passes through the bonnet; the bearing assembly carries the thrust load of operation.',
  'Manual valves use a threaded stem and a bearing housing under the handwheel. A back seat on the stem can isolate the packing so it can be replaced with the valve open and under pressure on designs that provide it. The packing set is a stack of elastomer and thermoplastic rings energized by a gland.',
  'Stem material is selected for the material class; packing material for the temperature class and fluids.',
  'Do not attempt packing replacement under pressure unless the valve design has a back seat and the OEM procedure is followed.',
  ['WH-GATEVALVE-STEM', 'WH-GATEVALVE-PACKING', 'WH-GATEVALVE-BEARING', 'WH-GATEVALVE-HANDWHEEL']);

comp('WH-GATEVALVE-BONNET', 'Bonnet', ['bonnet flange', 'bonnet assembly'],
  'The pressure-containing cover on the body cavity that carries the stem and packing.',
  'Bolted or threaded to the body with a ring gasket or seal. The bonnet bore holds the packing and the back seat; grease fittings and the body bleed may be located on the bonnet.',
  'Forged alloy steel matching the body material class; bolting per API 6A.',
  'Bonnet bolting is only loosened after the body cavity has been bled to zero.',
  ['WH-GATEVALVE-BONNET']);

comp('WH-GATEVALVE-ACTUATOR', 'Hydraulic actuator', ['hydraulic cylinder', 'actuator', 'hyd. actuator'],
  'A hydraulic cylinder that opens the valve on supply pressure and, on spring-return designs, closes it when pressure is released.',
  'The actuator replaces the handwheel and bearing assembly. Frac service actuators are single-acting spring-return (fail closed) or double-acting, with a position indicator and a manual override on some models. Supply comes from the frac valve control unit through hydraulic hoses.',
  'Sized for the stem load at the valve working pressure with margin; bore, stroke, and spring force per OEM.',
  'The spring and the charged cylinder store energy; isolate and bleed the hydraulic supply before maintenance. Keep hands clear of the indicator and linkage during operation.',
  ['WH-GATEVALVE-ACTUATOR'], { drawn_in_3d: false, mesh_nodes: [], glb: undefined, scene: 'WH-FRACTREE-UMV-ACTUATOR' });

// Equipment records rendered procedurally in the simulator scene
const equip = (id, group, name, aliases, fn, tabs, specs, hazards, scene, sources, extra = {}) => records.push({
  id, system: 'WH', group, level: 'equipment', parent: 'WH', name, aliases, function: fn, status: 'draft', evidence_tier: 'E2', reviewers: [],
  tabs, specs, hazards, drawn_in_3d: true, scene, sources, revision: rev('Drop 1 seed'), ...extra,
});

equip('WH-FRACTREE', 'frac-tree', 'Frac tree (frac stack)', ['frac stack', 'stack', 'tree'],
  'The temporary stack of gate valves, cross, and goat head installed on the wellhead that contains treating pressure and gives access for wireline and coiled tubing during the completion.',
  {
    overview: 'From the wellhead up: tree adapter or crossover, lower master valve (manual), upper master valve (hydraulic), studded cross with two wing valves, swab valve, and goat head. The frac wing goes to the zipper manifold; the flowback wing goes to the flowback iron. The swab valve is the vertical access for the lubricator and the coiled tubing injector.',
    engineering: 'All components are API 6A pressure-containing parts rated for the job working pressure. Bore is uniform through the stack so tools can pass. The lower master is the last barrier before the wellhead and is not cycled under pressure; the upper master is the working master and is actuated for emergency shut-in.',
    connections: 'Bottom: tubing head adapter (flanged). Frac wing: iron to the zipper manifold. Flowback wing: iron to the choke manifold. Top: goat head during frac; wellhead adapter and lubricator during wireline; coiled tubing BOP stack during drillout.',
    safety: 'Operate valves in sequence: close the swab before pumping; open the wing to the frac line fully; never cycle the lower master under differential. Red zone around the tree during pumping. The stack is heavy; lifts use certified gear and no one stands under it.',
    specs: 'Working pressure 10K or 15K; bore 5-1/8 in. or 7-1/16 in.; height on the order of 12 to 20 ft depending on configuration (E4).',
    evidence: 'OEM configurations (S2, S3, S5, S11, S12); API 6A (S1); field practice (S9).',
    operations: 'Rig-up, test, and function test before the first stage. Between stages: close the frac wing and zipper valve, open the swab, rig the lubricator, run wireline, rig down, close the swab, open the wing, pump. After the last stage: coiled tubing BOP stack on the swab valve for drillout, then flowback through the flowback wing.',
    failure_modes: 'Erosion at the goat head inlets and the frac wing; valve seat wash; actuator failures; ring gasket leaks after repeated make-up.',
  },
  [{ name: 'Working pressure', value: '10,000 or 15,000', unit: 'psi', source: 'S2', tier: 'E2' }, { name: 'Bore', value: '5-1/8 or 7-1/16', unit: 'in.', source: 'S2', tier: 'E2' }],
  [H.pressure, H.lof, H.erosion, H.dropped], 'WH-FRACTREE', ['S1', 'S2', 'S3', 'S5', 'S9'],
  { connections: [{ target: 'WH-GATEVALVE', direction: 'undirected', type: 'flanged', rating: '15K' }, { target: 'WH-GOATHEAD', direction: 'undirected', type: 'flanged', rating: '15K' }, { target: 'WH-ZIPPER', direction: 'upstream', type: 'hammer union', rating: '15K' }, { target: 'WH-TUBINGHEAD', direction: 'upstream', type: 'flanged', rating: '15K' }] });

equip('WH-GOATHEAD', 'frac-tree', 'Goat head (frac head)', ['frac head', 'goathead', 'frac manifold head'],
  'The flow head on top of the frac tree with two to four inlets where high-pressure lines converge into the well.',
  {
    overview: 'Named for the horn-like inlets. Each inlet takes a hammer union or a flanged connection from the zipper manifold or missile lines. A top connection may carry a pressure transducer, a bleed, or a cap.',
    engineering: 'A forged or fabricated pressure-containing block rated with the tree; inlet sizes commonly 3 in. or 4 in.; some designs are flanged big-bore heads that replace multiple inlets with one large line.',
    connections: 'Inlets from the zipper manifold or missile; bottom flange to the swab valve or a spacer spool.',
    safety: 'High-velocity proppant flow at the inlets erodes the head; inspect between wells. Pressurized unions must be restrained.',
    evidence: 'Public descriptions (S3, S12); field practice (S9).',
    operations: 'Removed for wireline runs on most rig-ups (the lubricator lands on the swab valve or a wellhead adapter) unless a dedicated frac and wireline configuration is used.',
    failure_modes: 'Inlet erosion, union leaks.',
  },
  [{ name: 'Inlets', value: '2 to 4', unit: '', source: 'S3', tier: 'E2' }, { name: 'Inlet size', value: '3 or 4', unit: 'in.', source: 'S12', tier: 'E2' }],
  [H.pressure, H.lof, H.erosion], 'WH-GOATHEAD', ['S3', 'S9', 'S12']);

equip('WH-ZIPPER', 'zipper-manifold', 'Zipper manifold', ['zipper', 'frac manifold', 'zip manifold'],
  'A skid-mounted manifold with a valve set per well that routes the frac spread output to one well at a time so that pumping on one well and wireline on another can alternate without moving iron.',
  {
    overview: 'The missile feeds an inlet header on the skid. Each well branch has hydraulic gate valves and connects to that well\'s goat head. Opening one branch and closing the others switches the spread between wells in minutes. A remote hydraulic control unit operates every valve and shows position.',
    engineering: 'Valves are the same API 6A gate valve family as the tree. Big-bore or monoline manifolds use a single 7-1/16 in. line per well instead of several 3 in. lines to cut connections and erosion. Pressure transducers, check valves, and a pressure relief line are fitted per the operator specification.',
    connections: 'Upstream: missile high-pressure header. Downstream: one branch per well to the goat head. Hydraulic: control unit.',
    safety: 'The manifold is inside the red zone. Valve sequencing is done from the control unit with position confirmation; a branch to a well with wireline in the hole must be closed and verified before pumping on the neighbor.',
    evidence: 'OEM and service pages (S2, S11); field practice (S9).',
    operations: 'Sequence per stage: close the branch to the well going to wireline, open the branch to the well ready to frac, confirm positions, then bring pumps online.',
    failure_modes: 'Valve seat erosion on the most-used branch; hydraulic leaks; transducer failures.',
  },
  [{ name: 'Wells served', value: '2 to 6', unit: '', source: 'S11', tier: 'E2' }],
  [H.pressure, H.lof, H.erosion], 'WH-ZIPPER', ['S2', 'S9', 'S11'],
  { connections: [{ target: 'PP-MISSILE', direction: 'upstream', type: 'hammer union', rating: '15K' }, { target: 'WH-GOATHEAD', direction: 'downstream', type: 'hammer union', rating: '15K' }, { target: 'WH-FRACVALVECONTROL', direction: 'upstream', type: 'hydraulic' }] });

equip('WH-TREESAVER', 'wellhead-isolation', 'Wellhead isolation tool (tree saver)', ['tree saver', 'frac sleeve', 'wear sleeve', 'casing protector', 'isolation tool'],
  'A tool run through the tree and wellhead that carries proppant-laden fluid past the hanger seals and spool bores so that the permanent wellhead is not eroded or exposed to treating pressure.',
  {
    overview: 'Set from the top of the stack, the mandrel seals below the wellhead and above the frac tree so that treating fluid passes through its bore. Some designs also isolate the wellhead from treating pressure so that a lower-rated wellhead can be used with a higher-rated stack (verify with the specific product).',
    engineering: 'Mandrel with seal elements or cups, a landing shoulder, and a retrieval profile; installed with a running tool through the tree or as a sleeve set in the tubing head.',
    connections: 'Landed in the wellhead below the tree; retrieved before the production tree is installed.',
    safety: 'Running and pulling is a lift over the well; verify the well is shut in and pressure is bled from the stack before pulling.',
    evidence: 'Public description (S3); field practice (S9).',
    operations: 'Installed at rig-up, inspected between wells, pulled after flowback.',
    failure_modes: 'Seal damage on installation; erosion of the mandrel bore at the top.',
  },
  [], [H.pressure, H.dropped], 'WH-TREEADAPTER', ['S3', 'S9']);

equip('WH-FLOWIRON', 'flow-iron', 'High-pressure flow iron', ['frac iron', 'treating iron', 'hammer union pipe', '1502 iron', 'high-pressure iron'],
  'Temporary high-pressure pipe, swivel joints, tees, crosses, check valves, plug valves, and relief valves with hammer unions that connect the missile, zipper manifold, and tree.',
  {
    overview: 'Pup joints in 2 in., 3 in., and 4 in. nominal sizes with wing-nut hammer unions; swivel joints give the run flexibility; tees and crosses split flow; a pressure relief valve on the missile side protects the pumps and iron; check valves stop backflow to the pumps. Iron is tracked by serial number and inspected for wall loss.',
    engineering: 'Rated 10,000 or 15,000 psi cold working pressure; union figure numbers are vendor nomenclature and must not be mixed across pressure classes. Wall-thickness inspection and pressure testing are part of every job.',
    connections: 'Hammer unions throughout; flanged big-bore alternatives replace multiple lines.',
    safety: 'Line of fire during pumping; whip checks and restraints on every joint; never strike a pressurized union; erosion at elbows and swivels is the common failure.',
    evidence: 'Public descriptions (S4, S12); field practice (S9).',
    operations: 'Laid out, made up with hammers, restrained, pressure tested to the job pressure before the first stage.',
    failure_modes: 'Wall loss from erosion, union seal leaks, mismatched union halves.',
  },
  [{ name: 'Nominal sizes', value: '2, 3, and 4', unit: 'in.', source: 'S4', tier: 'E2' }, { name: 'Working pressure', value: '10,000 or 15,000', unit: 'psi', source: 'S4', tier: 'E2' }],
  [H.pressure, H.lof, H.erosion, H.pinch], 'WH-FRACLINE', ['S4', 'S9', 'S12']);

equip('WH-CASINGHEAD', 'wellhead', 'Casing head and casing spool', ['starting head', 'casing spool', 'wellhead base'],
  'The permanent base of the wellhead that supports the casing strings on hangers and seals the annuli between them.',
  {
    overview: 'The casing head is welded or threaded onto the surface casing. Each subsequent casing string hangs in a spool on a slip or mandrel hanger with a pack-off or seal assembly above it. Side outlets with valves give access to each annulus for monitoring and pressure testing.',
    engineering: 'API 6A flanged or studded connections; bowl profiles match the hanger type; secondary seals isolate the annulus from the flange connection.',
    connections: 'Below: surface casing. Above: next spool or tubing head. Side outlets: annulus valves.',
    safety: 'Annulus pressure is monitored during fracturing; a sudden change indicates a casing or hanger seal problem and stops pumping.',
    evidence: 'API 6A (S1); field and manufacturing practice (S9).',
    operations: 'Installed during drilling; tested before the frac stack is nippled up.',
    failure_modes: 'Pack-off leaks, hanger seal damage from proppant when no tree saver is used.',
  },
  [], [H.pressure], 'WH-CASINGHEAD', ['S1', 'S9']);

equip('WH-TUBINGHEAD', 'wellhead', 'Tubing head and frac-ready adapter', ['tubing spool', 'speed head', 'frac-ready wellhead'],
  'The top wellhead component that hangs the production tubing after the completion and, during the frac, carries the adapter to the frac tree.',
  {
    overview: 'During the completion the tubing head has no tubing in it; the frac stack lands on a tubing head adapter or crossover, and a tree saver may be set in the bowl. Frac-ready or multibowl wellheads combine spools so the stack can be installed faster.',
    engineering: 'API 6A; bowl profile and lockdown screws for the tubing hanger; flanged top connection to the adapter.',
    connections: 'Below: casing spool. Above: tree adapter and frac tree, later the production tree.',
    safety: 'The bowl is exposed to treating fluid unless isolated; inspect after the frac.',
    evidence: 'API 6A (S1); OEM pages (S5); field practice (S9).',
    operations: 'Receives the frac stack at rig-up; receives the tubing hanger and production tree after drillout and flowback.',
    failure_modes: 'Bowl erosion, lockdown screw damage.',
  },
  [], [H.pressure, H.erosion], 'WH-TUBINGHEAD', ['S1', 'S5', 'S9']);

equip('WH-FRACVALVECONTROL', 'valve-control', 'Frac valve control unit', ['hydraulic control unit', 'HPU', 'remote valve control', 'accumulator unit'],
  'The hydraulic power unit, accumulator, and remote panel that operate the actuated valves on the tree and zipper manifold from outside the red zone.',
  {
    overview: 'A diesel or electric hydraulic pump charges an accumulator; a panel with one control per valve opens and closes the actuators and shows position. Emergency shut-in closes the upper master and wing valves together.',
    engineering: 'Hydraulic supply pressure per the actuator design; accumulator volume sized for a full close of all valves on loss of the pump.',
    connections: 'Hydraulic hoses to each actuator; electrical control to the panel.',
    safety: 'Hydraulic lines are under pressure; leaks at the actuator are within the red zone and are repaired only after shut-in.',
    evidence: 'OEM descriptions (S2, S11); field practice (S9).',
    operations: 'Function test every valve before pumping; sequence the zipper and wing valves per stage; emergency shut-in drill before the first stage.',
    failure_modes: 'Hose leaks, accumulator precharge loss, position indicator faults.',
  },
  [], [H.pressure, H.pinch], 'WH-FRACVALVECONTROL', ['S2', 'S9', 'S11']);

// write files
const outDir = path.resolve('content/records/WH');
fs.mkdirSync(outDir, { recursive: true });
for (const r of records) {
  const clean = JSON.parse(JSON.stringify(r)); // drop undefined
  fs.writeFileSync(path.join(outDir, r.id + '.json'), JSON.stringify(clean, null, 2) + '\n');
}
console.log('wrote', records.length, 'records to', outDir);
