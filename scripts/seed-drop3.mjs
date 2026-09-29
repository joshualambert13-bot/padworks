// Drop 3 seed: WL system (wireline unit, rig-up, pressure control stack) and glossary additions.
// Every new record is "draft". Run: node scripts/seed-drop3.mjs
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('content/records/WL');
fs.mkdirSync(DIR, { recursive: true });
const DATE = '2026-09-29';
const rev = (note) => ({ rev: 'A', author: 'AI draft', date: DATE, note });
const H = {
  pressure: { class: 'Stored pressure', control: 'Pressure test the stack before opening the swab valve; bleed to zero before breaking any union.' },
  lof: { class: 'Line of fire', control: 'Stay clear of the cable path, sheaves, and the top of the stack while the string is moving.' },
  pinch: { class: 'Pinch point', control: 'Hands clear of sheaves, the drum, and quick unions during make-up.' },
  explosives: { class: 'Explosives', control: 'Radio silence and RF-safe systems per the site plan; licensed personnel; no one in front of loaded guns.' },
  dropped: { class: 'Dropped object', control: 'Certified lifting gear; no one under the lubricator while it is suspended.' },
  h2s: { class: 'H2S', control: 'Monitors and wind indicators when the well can flow sour gas at the grease head.' },
};
const EVID = 'Public pressure control equipment catalogs and service descriptions (S6, S7, S13); API RP 67 (S14) and API RP 19B (S15) for the perforating side; field practice (S9).';

// ---- sources
const srcPath = path.resolve('content/sources.json');
const sources = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const add = (s) => { if (!sources.find(x => x.id === s.id)) sources.push(s); };
add({ id: 'S13', title: 'Wireline Hardware and Accessories (product pages)', publisher: 'Hunting', edition: 'web, accessed 2026-09-28', access: 'Public', tier: 'E2', url: 'https://huntingplc.com/products-services/perforating-logging-systems/wireline-hardware-and-accessories/' });
add({ id: 'S14', title: 'API RP 67, Oilfield Explosives Safety', publisher: 'American Petroleum Institute', edition: 'verify edition held', access: 'Paid standard', tier: 'E1', url: '' });
add({ id: 'S15', title: 'API RP 19B, Evaluation of Well Perforators', publisher: 'American Petroleum Institute', edition: 'verify edition held', access: 'Paid standard', tier: 'E1', url: '' });
fs.writeFileSync(srcPath, JSON.stringify(sources, null, 2) + '\n');

// ---- glossary
const gPath = path.resolve('content/glossary.json');
const glossary = JSON.parse(fs.readFileSync(gPath, 'utf8'));
const gadd = (g) => { const i = glossary.findIndex(x => x.term === g.term); if (i >= 0) glossary[i] = g; else glossary.push(g); };
gadd({ term: 'Lubricator', aliases: ['riser', 'wireline lubricator', 'PCE stack', 'lubricator stack'], system: 'WL', record: 'WL-PCE', definition: 'The pressure-rated tube assembly above the tree that holds the tool string while the well is under pressure.' });
gadd({ term: 'Wireline valve', aliases: ['wireline BOP', 'cable rams', 'dual wireline valve', 'quad valve'], system: 'WL', record: 'WL-PCE-WIRELINEVALVE', definition: 'Hydraulic rams that close around the cable to seal the well with the tool string in the hole.' });
gadd({ term: 'Grease head', aliases: ['grease injection head', 'flow tube head', 'grease injector', 'pressure control head'], system: 'WL', record: 'WL-PCE-GREASEHEAD', definition: 'The head at the top of the lubricator where grease injected between the cable and close-fitting flow tubes holds back well pressure while the cable moves.' });
gadd({ term: 'Tool trap', aliases: ['tool catcher (different item)', 'flapper trap'], system: 'WL', record: 'WL-PCE-TOOLTRAP', definition: 'A hydraulic flapper below the lubricator that stops the tool string from falling back into the well if it parts from the cable.' });
gadd({ term: 'Pump-down', aliases: ['pumpdown', 'PDP', 'pump down the guns'], system: 'WL', record: 'WL-PUMPDOWNPUMP', definition: 'Pumping fluid down the well to carry the plug-and-perf tool string along the horizontal lateral where gravity cannot.' });
gadd({ term: 'Quick union', aliases: ['QU', 'hydraulic quick union', 'lubricator union'], system: 'WL', record: 'WL-PCE-QUICKUNION', definition: 'The threaded collar joint between lubricator sections and stack components, sealed with an O-ring and made up by hand or hydraulically.' });
fs.writeFileSync(gPath, JSON.stringify(glossary, null, 2) + '\n');

// ---- records
const out = [];
const GLB = '/glb/WL/WL-PCE.glb';
const rec = (o) => out.push({ status: 'draft', evidence_tier: 'E2', reviewers: [], system: 'WL', drawn_in_3d: false, sources: ['S6', 'S7', 'S9'], revision: rev('Drop 3 seed'), ...o });
const comp = (id, parent, group, name, aliases, fn, over, eng, safety, extra = {}) => rec({
  id, parent, group, level: 'component', name, aliases, function: fn,
  tabs: { overview: over, engineering: eng, safety, evidence: EVID, ...(extra.tabs || {}) },
  hazards: extra.hazards || [H.pressure], ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'tabs' && k !== 'hazards')),
});
const drawn = (glb, nodes) => ({ drawn_in_3d: true, glb, mesh_nodes: nodes });

rec({ id: 'WL', level: 'system', name: 'Wireline, perforating, and plug setting', aliases: ['wireline', 'e-line', 'electric line', 'plug-and-perf crew'],
  function: 'The service that runs the plug and perforating guns to depth on an electric cable, sets the plug, fires the guns, and pulls out, once per stage, through a pressure control stack on top of the frac tree while the well stays under pressure.',
  tabs: {
    overview: 'On a plug-and-perf pad the wireline crew alternates with the frac crew. With the frac wing closed and the swab valve open, the lubricator stack sits on the tree. The tool string (cable head, weight bars, casing collar locator, setting tool, frac plug, perforating guns) is loaded in the lubricator, the stack is pressure tested, the swab valve is opened, and the string is lowered on the cable. In the vertical section it falls under its own weight; in the horizontal lateral it is pumped down with fluid from dedicated pump-down pumps or the frac spread. At depth the plug is set, the guns are fired cluster by cluster from the toe end of the interval toward the heel, and the string is pulled back into the lubricator. The swab valve is closed, the lubricator is bled and lifted off, and the tree is handed back to the frac crew.',
    engineering: 'The pressure boundary during the run is the stack: wellhead adapter, wireline valve, tool trap, pump-in sub, ball check, lubricator sections, tool catcher, grease head, and line wiper, rated to the tree working pressure. The cable is a monoconductor armored cable, commonly 5/16 in. or 7/32 in., or a polymer-encapsulated greaseless cable that reduces grease consumption. Depth is measured at the measurement head and corrected with the casing collar locator. Tension is measured with a load pin on the top sheave.',
    connections: 'Lands on the swab valve of the frac tree through the wellhead adapter. Pump-down fluid enters through the frac tree wing or the pump-in sub. Electrical power and signals travel through the cable to the addressable switches and setting tool.',
    safety: 'Explosives on location: radio silence, RF-safe detonators, licensed loaders, exclusion zones around loaded guns. The stack holds wellhead pressure while the string moves; the grease head and wireline valve are the two barriers around the cable. Cable tension limits prevent parting the cable in the lateral. The lubricator is a suspended load between runs.',
    specs: 'Stack bore 5-1/8 in. or 7-1/16 in.; working pressure 10,000 or 15,000 psi; lubricator length exceeds the tool string length; cable 5/16 in. or 7/32 in. monoconductor typical.',
    evidence: EVID,
    operations: 'Per stage: rig the lubricator on the tree, test, open the swab, run in, pump down through the lateral, set the plug, perforate bottom-up, pull out, close the swab, bleed and rig down, hand over to frac.',
    failure_modes: 'Misruns (no fire, plug pre-set), parted cable, tool string stuck in the lateral, grease head leaks, gun misfires, wrong depth from collar miscount.',
  },
  specs: [{ name: 'Cable, typical', value: '5/16 or 7/32', unit: 'in. monoconductor', source: 'S13', tier: 'E2' }, { name: 'Stack working pressure', value: '10,000 or 15,000', unit: 'psi', source: 'S6', tier: 'E2' }],
  standards: [{ standard: 'API RP 67', edition: 'verify', paraphrase: 'Recommended practice for oilfield explosives safety: handling, transport, storage, radio silence, and personnel.', source: 'S14' }, { standard: 'API RP 19B', edition: 'verify', paraphrase: 'Standard procedures for evaluating perforator performance so that gun and charge data are comparable between suppliers.', source: 'S15' }],
  connections: [{ target: 'WH-FRACTREE-SWAB', direction: 'upstream', type: 'flanged', rating: '15K', note: 'Stack lands on the swab valve' }, { target: 'PP', direction: 'upstream', type: 'hammer union', note: 'Pump-down fluid' }, { target: 'DT', direction: 'downstream', type: 'mechanical', note: 'Frac plug delivered and set by the tool string' }],
  hazards: [H.pressure, H.explosives, H.lof, H.dropped], drawn_in_3d: true, scene: 'WL-PCE-STACK', sources: ['S6', 'S7', 'S9', 'S13', 'S14', 'S15'] });

// ---- wireline unit and rig-up
rec({ id: 'WL-UNIT', parent: 'WL', group: 'wireline-unit', level: 'equipment', name: 'Wireline unit (truck or skid)', aliases: ['wireline truck', 'e-line truck', 'logging unit', 'wireline skid'],
  function: 'The vehicle or skid that carries the cable drum, the winch drive, the measurement head, the control cab, and the power pack that run the tool string in and out of the well.',
  tabs: {
    overview: 'A truck-mounted unit is common on land; skid units are used where the pad layout or an offshore deck needs it. The operator sits in the control cab facing the well with the winch controls, the depth and tension displays, and the perforating power supply (shooting panel). The drum holds the cable; the levelwind lays it evenly; the measurement head counts depth and reads tension on the cable as it leaves the drum. A diesel power pack drives the hydraulics.',
    engineering: 'Drum capacity matches the cable length for the deepest well planned, commonly 20,000 ft and more for long laterals. Winch pull and brake ratings are matched to the cable breaking strength with margin. The unit is grounded and bonded to the wellhead before any shooting work.',
    connections: 'Cable from the drum to the lower sheave, up to the top sheave on the crane, and down into the grease head. Electrical bond to the wellhead. Data link to the frac data van on some pads.',
    safety: 'The cable between the drum and the top sheave is a line-of-fire hazard when tensioned; the area is kept clear. The unit is positioned so the operator can see the stack and the sheaves.',
    evidence: EVID,
    operations: 'Spotted and leveled before the first run; cable path rigged with the crane; bonded and tested; then cycles with the frac crew stage by stage.',
    failure_modes: 'Levelwind miswrap, hydraulic leaks, depth encoder slip, cable damage at the drum.',
  }, hazards: [H.lof, H.pinch], drawn_in_3d: true, scene: 'WL-UNIT', sources: ['S9', 'S13'] });

comp('WL-UNIT-DRUM', 'WL-UNIT', 'wireline-unit', 'Cable drum, winch, and levelwind', ['drum', 'winch', 'levelwind', 'spooler'],
  'The powered drum that stores and spools the cable, the hydraulic winch that drives it in both directions, and the levelwind that lays the cable evenly across the drum.',
  'The drum is hydraulically driven with a brake for holding and emergency stops. Spooling tension is kept even so the wraps do not cut into lower layers under load. The levelwind traverses with the drum so each wrap lands beside the last.',
  'Drum core diameter respects the minimum bend radius of the cable; the brake holds the full working tension.',
  'Rotating drum and traversing levelwind are pinch points; the cable coming off the drum is a line-of-fire item.',
  { drawn_in_3d: true, scene: 'WL-UNIT-DRUM', hazards: [H.pinch, H.lof] });

comp('WL-UNIT-CONTROLCAB', 'WL-UNIT', 'wireline-unit', 'Control cab and shooting panel', ['operator cab', 'logging cab', 'shooting panel', 'firing panel'],
  'The operator station with winch controls, depth and tension displays, the collar locator readout, and the shooting panel that supplies firing current to the guns and setting tool.',
  'The cab has a clear view of the stack. The shooting panel is a keyed power supply that fires only when armed by the operator and when the addressable switch selected downhole is the one intended. Depth is the measurement head count corrected to casing collars.',
  'Firing current, safety interlocks, and radio-silence procedures per API RP 67 and the service company practice.',
  'The shooting panel key and the arming sequence are the controls against unintended firing; the panel is disabled during rig-up and any surface work on the guns.',
  { drawn_in_3d: true, scene: 'WL-UNIT-CONTROLCAB', hazards: [H.explosives] });

comp('WL-CABLE', 'WL-UNIT', 'wireline-unit', 'Wireline cable (monoconductor)', ['e-line cable', 'armored cable', 'monocable', '5/16 line', 'greaseless cable'],
  'The armored electrical cable that carries the tool string, supplies power and signals to the setting tool and gun switches, and returns the collar locator signal.',
  'A copper conductor inside insulation, wrapped in two layers of contra-wound steel armor. Sizes such as 5/16 in. and 7/32 in. are common; polymer-encapsulated (greaseless) cables have a smooth jacket over the armor so a packoff can seal on them without grease injection. Breaking strength, working tension, and the weak point at the cable head are matched so the cable head parts before the cable does.',
  'Rated tension with margin; inspected for broken armor wires and cut back at the head periodically; conductor insulation tested before shooting.',
  'A parted cable under tension recoils through the sheaves and the stack; tension limits and a clear cable path are the controls.',
  { hazards: [H.lof] });

rec({ id: 'WL-CRANE', parent: 'WL', group: 'rig-up', level: 'equipment', name: 'Crane, sheaves, and cable path', aliases: ['crane', 'top sheave', 'lower sheave', 'hay pulley', 'lubricator lift', 'mast unit'],
  function: 'The crane that lifts the lubricator on and off the tree and holds the top sheave above the grease head, and the sheaves that turn the cable from the drum up into the stack.',
  tabs: {
    overview: 'The lower sheave is anchored near the ground in line with the drum; the top sheave hangs from the crane above the stack so the cable enters the grease head vertically. A load pin in the top sheave measures cable tension. Between runs the crane lifts the whole lubricator off the tree so the frac crew can pump, then sets it back on for the next run. Some crews use a purpose-built mast unit instead of a crane.',
    engineering: 'Sheave diameter respects the cable bend radius; the top sheave is tied back so it cannot swing; the crane is rated for the assembled stack weight with the tool string inside.',
    connections: 'Cable path: drum, lower sheave, top sheave, grease head. Lifting: crane hook to the lubricator lift sub.',
    safety: 'Suspended lubricator between runs; cable line of fire from drum to top sheave; sheave pinch points.',
    evidence: EVID,
    operations: 'Rigged once per pad; the lift cycle repeats every stage.',
    failure_modes: 'Sheave bearing wear, tie-back failure, load pin drift.',
  }, hazards: [H.dropped, H.lof, H.pinch], drawn_in_3d: true, scene: 'WL-CRANE', sources: ['S9', 'S13'] });

comp('WL-WEIGHTINDICATOR', 'WL-CRANE', 'rig-up', 'Tension and depth measurement', ['weight indicator', 'load pin', 'depth wheel', 'measurement head', 'tension meter'],
  'The load pin in the top sheave that measures cable tension and the measurement head on the unit that counts depth, both displayed in the control cab.',
  'Tension at the sheave is the cable load at surface; the operator watches it during pump-down to keep the string moving without overspeeding, and during pull-out to stay under the weak point rating. Depth from the measurement head is corrected to the casing collar log so the guns fire at the planned depth.',
  'Load pin calibrated before the job; depth wheel checked against a known cable length; collar correlation before every set.',
  'Exceeding the weak point parts the cable head and leaves the string in the well; exceeding the cable rating parts the cable.',
  { hazards: [H.lof] });

rec({ id: 'WL-PUMPDOWNPUMP', parent: 'WL', group: 'rig-up', level: 'equipment', name: 'Pump-down pumps and fluid', aliases: ['pump-down pump', 'PDP', 'pumpdown unit', 'pump-down truck'],
  function: 'The pumps that push fluid down the well to carry the tool string through the horizontal lateral, either dedicated pump-down units or the frac spread through the zipper manifold.',
  tabs: {
    overview: 'In the lateral the tool string cannot fall, so fluid pumped behind it drags it along; the string is a loose fit in the casing and the fluid velocity moves it. The operator balances pump rate against cable speed and tension so the string does not outrun the cable. Dedicated pump-down units let the frac spread stay on the neighboring well; on smaller pads the frac pumps do the job through the manifold.',
    engineering: 'Rate and volume are tracked per run; a typical run uses a fluid volume equal to the casing volume from surface to the plug depth plus margin. Fluid is the same water used for the frac.',
    connections: 'Pump-down fluid enters through the frac wing or the pump-in sub; returns are none during the run.',
    safety: 'Pumping with the swab valve open and the cable in the hole is done only with the stack tested and the grease head sealing; an overspeed string can knock the cable off the sheaves.',
    evidence: 'Field practice (S9).',
    operations: 'Rate is brought up after the string clears the kickoff point and reduced before the string reaches the setting depth.',
    failure_modes: 'Fluid loss to the previous stage if the plug below leaks; overspeed; string hang-up at casing collars.',
  }, hazards: [H.pressure, H.lof], sources: ['S9'] });

// ---- pressure control stack
rec({ id: 'WL-PCE', parent: 'WL', group: 'pressure-control', level: 'equipment', name: 'Pressure control stack (lubricator assembly)', aliases: ['PCE', 'PCE stack', 'lubricator assembly', 'wireline stack', 'riser stack'],
  function: 'The assembly on top of the frac tree that contains wellhead pressure while the tool string is run and pulled on the cable: wellhead adapter, wireline valve, tool trap, pump-in sub, ball check valve, lubricator sections, tool catcher, grease injection head, and line wiper.',
  tabs: {
    overview: 'Bottom to top: the wellhead adapter converts the tree flange to the stack union; the wireline valve is the ram barrier around the cable; the tool trap catches the string if it parts from the cable; the pump-in sub is the fluid port; the ball check seals the bore if the cable blows out of the head; the lubricator sections hold the full tool string above the swab valve; the tool catcher latches the string at the top; the grease injection head seals around the moving cable with grease between the cable and close-fitting flow tubes; the line wiper cleans the cable as it leaves. The stack is assembled on the ground or in the crane, lifted onto the tree, and pressure tested before the swab valve is opened.',
    engineering: 'Bore matches the tree (5-1/8 in. or 7-1/16 in.). Working pressure matches the tree. Total lubricator length exceeds the longest tool string plus a margin so the string is fully above the swab valve when caught. Quick unions between components are made up by hand or hydraulically. Hydraulic supply to the wireline valve, tool trap, tool catcher, and packoff comes from the grease injection unit.',
    connections: 'Below: frac tree swab valve through the wellhead adapter. Side: pump-in sub to the pump-down line. Hydraulic and grease lines to the grease injection unit. Cable in through the line wiper and grease head.',
    safety: 'Two barriers around the cable while the well is open: the grease head in motion and the wireline valve when stopped. Test the stack to the job pressure before opening the swab valve. Bleed to zero before breaking any union. The whole stack is a suspended load between runs.',
    specs: 'Bore 5-1/8 in. or 7-1/16 in.; working pressure 10,000 or 15,000 psi; lubricator section lengths on the order of 8 to 10 ft, three or more sections for plug-and-perf strings.',
    evidence: EVID,
    operations: 'Assembled once per pad; lifted on and off the tree every stage; tested every time a union is broken and remade, which the quick test sub makes possible without pressuring the well.',
    failure_modes: 'Grease head leaks, union O-ring cuts, ram element wear, tool trap flapper damage, a string left in the lubricator over a closed trap.',
  },
  specs: [{ name: 'Bore', value: '5-1/8 or 7-1/16', unit: 'in.', source: 'S6', tier: 'E2' }, { name: 'Working pressure', value: '10,000 or 15,000', unit: 'psi', source: 'S6', tier: 'E2' }],
  connections: [{ target: 'WH-FRACTREE-SWAB', direction: 'upstream', type: 'flanged', rating: '15K' }, { target: 'WL-GREASEUNIT', direction: 'upstream', type: 'hydraulic', note: 'Grease and hydraulic supply' }, { target: 'WL-CRANE', direction: 'undirected', type: 'mechanical', note: 'Lifted and suspended by the crane' }],
  hazards: [H.pressure, H.dropped, H.lof, H.h2s], ...drawn(GLB, ['WL-PCE-WELLHEADADAPTER', 'WL-PCE-QUICKUNION', 'WL-PCE-WIRELINEVALVE', 'WL-PCE-TOOLTRAP', 'WL-PCE-PUMPINSUB', 'WL-PCE-BALLCHECK', 'WL-PCE-LUBRICATOR', 'WL-PCE-TOOLCATCHER', 'WL-PCE-GREASEHEAD', 'WL-PCE-LINEWIPER']),
  sources: ['S6', 'S7', 'S9'] });

comp('WL-PCE-WELLHEADADAPTER', 'WL-PCE', 'pressure-control', 'Wellhead adapter', ['tree adapter', 'flange to union crossover', 'swab valve adapter', 'quick connect adapter'],
  'The crossover between the frac tree swab valve flange and the quick union at the bottom of the stack.',
  'A 6BX flange on the bottom with a BX ring gasket, a quick union pin or box on top. Hands-free remote connectors replace the studded flange on some rig-ups so the stack lands and locks without anyone on the tree.',
  'API 6A flanged connection at the tree rating; union rated with the stack.',
  'The adapter is broken and remade every stage on rig-ups that remove it; the ring gasket and studs are inspected each time.',
  { ...drawn(GLB, ['WL-PCE-WELLHEADADAPTER']), connections: [{ target: 'WH-FRACTREE-SWAB', direction: 'upstream', type: 'flanged', rating: '15K' }] });

comp('WL-PCE-QUICKUNION', 'WL-PCE', 'pressure-control', 'Quick unions', ['QU', 'quick union', 'hydraulic quick union', 'union collar'],
  'The threaded collar joints between stack components and lubricator sections, sealed with an O-ring, made up by hand with a bar or by a hydraulic collar.',
  'A pin with the seal and a box with a coarse thread; the collar turns a few turns to make up. Hydraulic quick unions make up and release under remote control so no one stands at the stack. Every union is a test point: the stack is retested after any union is remade.',
  'Rated with the stack; O-rings replaced on a schedule and whenever cut.',
  'Never break a union with pressure on the stack; the quick test sub lets the stack be tested without well pressure after a remake.',
  { ...drawn(GLB, ['WL-PCE-QUICKUNION']), hazards: [H.pressure, H.pinch] });

comp('WL-PCE-WIRELINEVALVE', 'WL-PCE', 'pressure-control', 'Wireline valve (dual or quad ram)', ['wireline BOP', 'cable rams', 'dual valve', 'quad valve', 'line BOP'],
  'Hydraulically closed rams with elastomer inserts that seal around the stationary cable so the well is isolated below the lubricator with the tool string still in the hole; blind or shear rams on some stacks seal or cut with no cable.',
  'Two ram sets in a dual valve give a barrier and a backup; a quad adds blind and shear rams. An equalizing port lets pressure be balanced across the rams before they are opened. The valve is closed when the string is stopped for a stack repair above it or when the grease head loses seal; it is not a substitute for the swab valve as the well barrier when the stack is removed.',
  'Bore and pressure rating match the stack; ram inserts are sized to the cable diameter; hydraulic closing pressure and accumulator volume per the grease unit.',
  'Closing rams on a moving cable damages the armor; the string is stopped first. Equalize before opening rams.',
  { ...drawn(GLB, ['WL-PCE-WIRELINEVALVE']), connections: [{ target: 'WL-GREASEUNIT', direction: 'upstream', type: 'hydraulic' }] });

comp('WL-PCE-TOOLTRAP', 'WL-PCE', 'pressure-control', 'Tool trap', ['flapper trap', 'tool stop', 'trap'],
  'A hydraulically operated flapper in the stack below the lubricator that swings shut under the tool string once it has been pulled above the trap, so the string cannot fall back into the well if it parts from the cable.',
  'The flapper is held open while the string passes and closed once the string is above it; a groove lets the cable pass with the flapper closed. It is opened again before the string is run in.',
  'Rated with the stack; flapper and pivot sized for the tool string weight falling from the top of the lubricator.',
  'Running in with the trap closed damages the flapper and the guns; the trap position is confirmed before every run.',
  { ...drawn(GLB, ['WL-PCE-TOOLTRAP']), connections: [{ target: 'WL-GREASEUNIT', direction: 'upstream', type: 'hydraulic' }] });

comp('WL-PCE-PUMPINSUB', 'WL-PCE', 'pressure-control', 'Pump-in sub', ['pump-in tee', 'side port sub', 'bleed sub', 'injection sub'],
  'A stack section with a side port for pumping fluid into the stack or bleeding pressure off it, used for pump-down, equalizing, and bleeding down before rig-down.',
  'A short tube with a hammer union or flanged side outlet; a valve on the port is closed during the run unless pump-down fluid is delivered through it.',
  'Rated with the stack; port size 2 in. typical.',
  'The port line is a live high-pressure line while pumping; it is restrained and bled before disconnection.',
  { ...drawn(GLB, ['WL-PCE-PUMPINSUB']), hazards: [H.pressure, H.lof] });

comp('WL-PCE-BALLCHECK', 'WL-PCE', 'pressure-control', 'Ball check valve', ['ball check', 'check sub', 'blowout check'],
  'A section below the grease head in which a ball is lifted onto a seat by well flow if the cable parts and is blown out of the head, sealing the bore and stopping flow to atmosphere.',
  'The ball sits below the seat while the cable is in the bore; a sudden upward flow after a cable blowout carries it onto the seat. It is reset after the event with the well shut in.',
  'Rated with the stack; ball and seat sized to the bore.',
  'A blown cable is the event the ball check is for; personnel are already clear of the stack top when the string is moving.',
  { ...drawn(GLB, ['WL-PCE-BALLCHECK']) });

comp('WL-PCE-LUBRICATOR', 'WL-PCE', 'pressure-control', 'Lubricator sections (riser)', ['lubricator', 'riser', 'riser sections', 'lubricator joints'],
  'The straight pressure-rated tubes that give the tool string a place to sit above the swab valve while the well is under pressure, assembled in sections to exceed the tool string length.',
  'Sections are joined with quick unions. Total length is set by the longest string on the job: the plug, setting tool, gun assembly, collar locator, weight bars, and cable head, plus a margin. Sections carry lift subs for the crane and are stored on a rack or a trailer between pads.',
  'Bore and working pressure match the tree; wall thickness set by the pressure rating; inspected for wall loss and thread damage.',
  'The assembled stack is heavy and long; it is lifted with the crane through a lift sub, never by a union collar.',
  { ...drawn(GLB, ['WL-PCE-LUBRICATOR']), hazards: [H.pressure, H.dropped] });

comp('WL-PCE-TOOLCATCHER', 'WL-PCE', 'pressure-control', 'Tool catcher', ['catcher', 'rope socket catcher', 'latch'],
  'A latch at the top of the lubricator that grips the cable head when the tool string is pulled fully up, so the string cannot drop if the cable is slacked or parts while the stack is being handled.',
  'Hydraulically released; the string is pulled into the catcher, the catcher engages, and the cable can be slacked for rig-down. Released before the next run.',
  'Rated with the stack; latch sized to the cable head profile.',
  'A string caught in the catcher is above a closed tool trap; both are confirmed before the lubricator is lifted.',
  { ...drawn(GLB, ['WL-PCE-TOOLCATCHER']), connections: [{ target: 'WL-GREASEUNIT', direction: 'upstream', type: 'hydraulic' }] });

comp('WL-PCE-GREASEHEAD', 'WL-PCE', 'pressure-control', 'Grease injection head and flow tubes', ['grease head', 'flow tubes', 'grease injector', 'packoff head', 'greaseless head'],
  'The head at the top of the stack that seals around the moving cable: grease injected at a pressure above well pressure fills the small annulus between the cable and a series of close-fitting flow tubes so the well cannot flow past the cable while it runs.',
  'Two or three flow tubes are stacked in series; grease is injected between them and returns to the unit through a return line. Flow tube bore is matched to the cable diameter with a small clearance. A hydraulic packoff above the tubes seals statically when the cable is stopped. Greaseless heads use a polymer packoff on an encapsulated cable and need little or no grease.',
  'Rated with the stack; flow tube size per cable; grease pressure held above wellhead pressure by the grease unit.',
  'Grease pressure lost means the well can flow up the cable; the wireline valve is closed and the string stopped until the head seals again. H2S can reach the surface here first.',
  { ...drawn(GLB, ['WL-PCE-GREASEHEAD']), hazards: [H.pressure, H.h2s], connections: [{ target: 'WL-GREASEUNIT', direction: 'upstream', type: 'hydraulic', note: 'Grease supply and return' }] });

comp('WL-PCE-LINEWIPER', 'WL-PCE', 'pressure-control', 'Line wiper', ['wiper', 'cable wiper', 'stuffing box (slickline)'],
  'The rubber element at the very top of the head, hydraulically squeezed onto the cable, that wipes grease and well fluid off the cable as it leaves the stack.',
  'Energized by hydraulic pressure from the grease unit; the element is replaced when it no longer wipes clean. On slickline jobs a stuffing box does the sealing and wiping in one element.',
  'Rated with the head; element sized to the cable.',
  'Wiped grease is contained on the platform under the head, not dropped on the tree.',
  { ...drawn(GLB, ['WL-PCE-LINEWIPER']), hazards: [H.pressure] });

comp('WL-PCE-TESTSUB', 'WL-PCE', 'pressure-control', 'Quick test sub', ['test sub', 'QTS', 'stack test sub'],
  'A short section above the wireline valve with a test port that lets the stack above it be pressure tested from a test pump after a union is remade, without pressuring the well or the tree.',
  'The sub holds a test plug or seal so that test pressure is applied to the lubricator and head only; the rams below stay closed on the well. It removes the need to open the swab valve to test.',
  'Rated with the stack.',
  'Test pressure is bled through the test port, never by breaking a union.',
  { hazards: [H.pressure] });

rec({ id: 'WL-GREASEUNIT', parent: 'WL', group: 'pressure-control', level: 'equipment', name: 'Grease injection and hydraulic unit', aliases: ['grease unit', 'grease skid', 'grease pump', 'PCE control unit', 'hydraulic control skid'],
  function: 'The skid with the high-pressure grease pump, grease reservoir, hydraulic pump, accumulator, and control panel that supplies the grease head and operates the wireline valve, tool trap, tool catcher, packoff, and line wiper.',
  tabs: {
    overview: 'The PCE operator stands at this unit with a view of the stack. Grease pressure is set above wellhead pressure and adjusted as the well pressure changes during the run; the hydraulic circuits close the rams and operate the trap and catcher. Return grease from the head comes back to the reservoir.',
    engineering: 'Grease pump pressure rating above the stack working pressure; hydraulic supply per the ram and packoff design; accumulator sized to close the rams with the pump stopped.',
    connections: 'Grease supply and return to the head; hydraulic lines to the wireline valve, tool trap, tool catcher, packoff, and line wiper.',
    safety: 'High-pressure grease lines and hydraulic lines run to the stack inside the exclusion area; leaks are repaired with the well shut in.',
    evidence: EVID,
    operations: 'Set up once per pad; grease consumption and pressure logged per run.',
    failure_modes: 'Grease pump failure, contaminated grease, hydraulic leaks, accumulator precharge loss.',
  }, hazards: [H.pressure], sources: ['S6', 'S7', 'S9'] });

rec({ id: 'WL-TOOLSTRING', parent: 'WL', group: 'tool-string', level: 'equipment', name: 'Plug-and-perf tool string (overview)', aliases: ['tool string', 'BHA (wireline)', 'gun string', 'plug and guns'],
  function: 'The assembly run on the cable each stage: cable head with weak point, weight bars, casing collar locator, addressable switch subs, perforating guns, setting tool, and the frac plug on the bottom.',
  tabs: {
    overview: 'From the cable down: cable head (rope socket) with a weak point that parts before the cable does; weight bars for mass in the vertical section; casing collar locator to correlate depth; the gun assembly with addressable switches between guns; the setting tool; and the frac plug on the setting tool at the bottom. Total length commonly 30 to 40 ft and more. The plug is set first at the toe end of the new interval, the guns fire bottom-up, and the string is pulled with the spent guns.',
    engineering: 'Every connection is rated for the pull and the pressure; switches are RF-safe; the setting tool is matched to the plug. Length sets the lubricator length. Roller or centralizer subs help the string move in the lateral.',
    connections: 'Cable head to the cable; the plug to the casing when set; guns to the formation when fired.',
    safety: 'Loaded guns on surface are the explosives hazard; radio silence, RF-safe detonators, no personnel in front of the guns, and the shooting panel disarmed until the string is below a set depth.',
    evidence: 'Public wireline hardware pages (S13); API RP 67 (S14) and API RP 19B (S15); field practice (S9).',
    operations: 'Assembled and loaded on the ground or in a loading trailer, lifted into the lubricator, run per stage.',
    failure_modes: 'Misfires, plug pre-set in the vertical, weak point parting on a stuck string, switch failures.',
  }, hazards: [H.explosives, H.lof, H.dropped], drawn_in_3d: true, scene: 'WL-TOOLSTRING', sources: ['S9', 'S13', 'S14', 'S15'],
  connections: [{ target: 'DT', direction: 'downstream', type: 'mechanical', note: 'Frac plug records live in DT' }] });

for (const r of out) { const clean = JSON.parse(JSON.stringify(r)); fs.writeFileSync(path.join(DIR, r.id + '.json'), JSON.stringify(clean, null, 2) + '\n'); }
console.log('wrote', out.length, 'WL records');
