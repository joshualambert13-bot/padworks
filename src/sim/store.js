// Simulation state and the illustrative response model.
// Everything here is simplified motion and illustrative curves. It is not a
// hydraulic fracturing simulator and must be labeled as such in the UI.
import { create } from 'zustand';
import { LESSONS, lessonById, nextLessonId } from './lessons.js';
import { fromServer, postLessonResult, postJobSummary } from './progress.js';
import { fracHeight, viscosityFactor, BARRIER_TOP, TARGET_HALF } from './geology.js';

// ---------------------------------------------------------------------------------------------
// Scoring. A job (or a lesson) starts at 100. Points come off for moves against the sequence and for
// recoveries that run past their time target. The numbers are training weights, not an industry scale.
export const DEDUCT = {
  interlock: { pts: 2, label: 'Interlock: valve command rejected' },
  wrongMove: { pts: 3, label: 'Valve moved against the sequence' },
  kickout: { pts: 10, label: 'Pumps kicked out at maximum treating pressure' },
  overpressure: { pts: 8, label: 'Pumped against a closed valve (overpressure or relief valve lift)' },
  screenout: { pts: 12, label: 'Screenout: too much sand for the rate and fluid' },
  outOfZone: { pts: 5, label: 'Fracture grew out of zone: net pressure above the upper barrier contrast' },
  lightningHold: { pts: 10, label: 'Pumps restarted during a lightning hold' },
};
// Time-to-recover targets for injected events, in seconds of simulation time
export const EVENT_TARGETS = { misfire: 60, stuck: 45, valveFault: 30, sandOut: 40, prvLift: 45, screenout: 60, lightning: 30 };
export function gradeOf(total) { return total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 70 ? 'C' : total >= 60 ? 'D' : 'F'; }
// Score of a job so far (or of a lesson window when since and exempt are given)
export function scoreOf(score, { since = 0, exempt = [] } = {}) {
  const ded = score.deductions.filter(d => d.t >= since && !exempt.includes(d.code));
  const pts = ded.reduce((a, d) => a + d.pts, 0);
  const total = Math.max(0, 100 - pts);
  return { total, pts, grade: gradeOf(total), deductions: ded };
}
const freshScore = () => ({ deductions: [], events: [], open: {}, kickouts: 0, overpressures: 0, screenouts: 0, interlocks: 0, wrongMoves: 0, moves: 0, phaseSec: {}, stages: {}, opEpisode: false });
const freshLesson = () => ({ id: null, doneMask: [], startedAt: 0, finished: false, result: null });

// ---------------------------------------------------------------------------------------------
// Pad setup vocabulary. Every value here is an illustrative starting point for a training pad,
// not a design value. The basin table sets typical starting values that the user can override.
export const BASINS = [
  { id: 'permian-delaware', snow: 0.35, sand: 'boxes', state: 'TX', water: 'pit', label: 'Permian: Delaware Basin', region: 'West Texas and southeast New Mexico', blurb: 'Flat desert floor of caliche and creosote scrub with mesas on the horizon. Deep, high-pressure oil and gas targets; 15K trees are common.',
    tvdFt: 10500, fracGradient: 0.85, bore: '7-15K', lateralFt: 10000, stageSpacingFt: 200, clusters: 6, proppantLbFt: 2000, fluidBblFt: 40, fluid: 'slickwater', proppant: 'mixed', fleet: 'efrac-turbine', completion: 'pnp', lift: 'esp',
    terrain: { ground: '#b8a27c', pad: '#d2c8ad', relief: 0.6, veg: 'scrub', density: 0.3, vegColor: '#5f6b3c', sky: '#bcd0e6', fog: '#d9d4c4' } },
  { id: 'permian-midland', snow: 0.35, sand: 'boxes', state: 'TX', water: 'pit', label: 'Permian: Midland Basin', region: 'West Texas', blurb: 'Flat to gently rolling mesquite country on red-tan soil. Stacked oil targets at moderate depth; 10K and 15K trees both in use.',
    tvdFt: 8500, fracGradient: 0.75, bore: '7-10K', lateralFt: 10000, stageSpacingFt: 200, clusters: 6, proppantLbFt: 2000, fluidBblFt: 40, fluid: 'slickwater', proppant: '100mesh', fleet: 'dualfuel', completion: 'pnp', lift: 'rodpump',
    terrain: { ground: '#b48d66', pad: '#cdbfa3', relief: 0.3, veg: 'mesquite', density: 0.25, vegColor: '#566b35', sky: '#b9cfe8', fog: '#dbd3c3' } },
  { id: 'eagle-ford', snow: 0.15, sand: 'boxes', state: 'TX', water: 'pit', label: 'Eagle Ford', region: 'South Texas', blurb: 'Rolling brush country of mesquite and huisache on olive-brown soil, humid haze. Oil, condensate, and gas windows along the trend.',
    tvdFt: 9500, fracGradient: 0.85, bore: '5-15K', lateralFt: 8500, stageSpacingFt: 220, clusters: 5, proppantLbFt: 1800, fluidBblFt: 35, fluid: 'slickwater', proppant: '40-70', fleet: 'dualfuel', completion: 'pnp', lift: 'gaslift',
    terrain: { ground: '#8b8a5a', pad: '#c7bc9c', relief: 0.9, veg: 'brush', density: 0.6, vegColor: '#4c6b34', sky: '#a9c4e0', fog: '#cfd8d6' } },
  { id: 'bakken', snow: 1.0, sand: 'silos', state: 'ND', water: 'heated', label: 'Bakken and Three Forks (Williston)', region: 'North Dakota and Montana', blurb: 'Rolling prairie of green-gold grass under a big sky, few trees. Openhole sliding sleeve completions were common here before plug and perf took over.',
    tvdFt: 10500, fracGradient: 0.75, bore: '5-15K', lateralFt: 10000, stageSpacingFt: 250, clusters: 4, proppantLbFt: 1200, fluidBblFt: 25, fluid: 'hybrid', proppant: '40-70', fleet: 'diesel', completion: 'sleeve', lift: 'esp',
    terrain: { ground: '#8f9a58', pad: '#bdb59a', relief: 1.4, veg: 'grass', density: 0.05, vegColor: '#4e6b3a', sky: '#9fc3ea', fog: '#cfe0f0' } },
  { id: 'haynesville', snow: 0.15, sand: 'silos', state: 'LA', water: 'pit', label: 'Haynesville', region: 'Northwest Louisiana and East Texas', blurb: 'Pine forest on red clay, humid. Deep, hot, high-pressure dry gas: 15K trees and iron are the rule and treating pressures run high.',
    tvdFt: 12000, fracGradient: 0.95, bore: '7-15K', lateralFt: 8000, stageSpacingFt: 180, clusters: 6, proppantLbFt: 2500, fluidBblFt: 45, fluid: 'hvfr', proppant: '100mesh', fleet: 'efrac-turbine', completion: 'pnp', lift: 'flow',
    terrain: { ground: '#5f6d3a', pad: '#b8a58a', relief: 0.8, veg: 'pine', density: 0.9, vegColor: '#2f5a2e', sky: '#a9bfd6', fog: '#c6d2d8' } },
  { id: 'marcellus', snow: 0.85, sand: 'silos', state: 'PA', water: 'ast', label: 'Marcellus (Appalachia)', region: 'Pennsylvania and West Virginia', blurb: 'Hardwood-forested hills; small pads cut into hillsides with crushed stone surfaces. Shallower dry gas with long laterals.',
    tvdFt: 7000, fracGradient: 0.85, bore: '5-10K', lateralFt: 10000, stageSpacingFt: 200, clusters: 6, proppantLbFt: 2200, fluidBblFt: 45, fluid: 'slickwater', proppant: '100mesh', fleet: 'efrac-genset', completion: 'pnp', lift: 'plunger',
    terrain: { ground: '#5c6e3f', pad: '#a7a08e', relief: 3.0, veg: 'hardwood', density: 0.85, vegColor: '#3e6b34', sky: '#a3bdd8', fog: '#c0ccd6' } },
  { id: 'dj', snow: 0.8, sand: 'boxes', state: 'CO', water: 'ast', label: 'DJ Basin (Niobrara)', region: 'Northeast Colorado', blurb: 'High plains of short buff grass, wide horizons, clear air. Moderate depth and pressure; pads sit close to towns, so electric fleets are favored for noise.',
    tvdFt: 7500, fracGradient: 0.75, bore: '5-10K', lateralFt: 10000, stageSpacingFt: 200, clusters: 5, proppantLbFt: 1500, fluidBblFt: 30, fluid: 'slickwater', proppant: '40-70', fleet: 'grid', completion: 'pnp', lift: 'plunger',
    terrain: { ground: '#a89f6f', pad: '#c4b99a', relief: 0.7, veg: 'grass', density: 0.02, vegColor: '#6b7a44', sky: '#9fc0ea', fog: '#d6dde8' } },
  { id: 'anadarko', snow: 0.5, sand: 'silos', state: 'OK', water: 'ast', label: 'Anadarko (SCOOP and STACK)', region: 'Central Oklahoma', blurb: 'Rolling plains on red soil with scattered oaks and cedars. Deep, high-pressure targets in the SCOOP; shallower stacked targets in the STACK.',
    tvdFt: 11000, fracGradient: 0.85, bore: '5-15K', lateralFt: 10000, stageSpacingFt: 200, clusters: 6, proppantLbFt: 1800, fluidBblFt: 38, fluid: 'slickwater', proppant: 'mixed', fleet: 'dualfuel', completion: 'pnp', lift: 'gaslift',
    terrain: { ground: '#9c7c56', pad: '#c3b394', relief: 1.0, veg: 'scrub', density: 0.2, vegColor: '#587a3a', sky: '#b4cbe6', fog: '#d8d0c4' } },
  { id: 'powder-river', snow: 1.0, sand: 'silos', state: 'WY', water: 'heated', label: 'Powder River Basin', region: 'Northeast Wyoming', blurb: 'Sage steppe on buff soil with broken hills. Moderate depth oil targets; long hauls for sand and water.',
    tvdFt: 9000, fracGradient: 0.7, bore: '5-10K', lateralFt: 9500, stageSpacingFt: 220, clusters: 5, proppantLbFt: 1400, fluidBblFt: 30, fluid: 'hybrid', proppant: '40-70', fleet: 'diesel', completion: 'pnp', lift: 'rodpump',
    terrain: { ground: '#a3a077', pad: '#c2b99b', relief: 1.8, veg: 'sage', density: 0.45, vegColor: '#7a8a6a', sky: '#a9c6ea', fog: '#d5dbe4' } },
  { id: 'utica', snow: 0.85, sand: 'silos', state: 'OH', water: 'ast', label: 'Utica (Appalachia)', region: 'Eastern Ohio', blurb: 'Rolling farmland and woodlots. Deep dry gas and condensate with high pressure in the deeper window.',
    tvdFt: 9000, fracGradient: 0.9, bore: '5-15K', lateralFt: 11000, stageSpacingFt: 200, clusters: 6, proppantLbFt: 2000, fluidBblFt: 40, fluid: 'slickwater', proppant: '100mesh', fleet: 'efrac-genset', completion: 'pnp', lift: 'flow',
    terrain: { ground: '#64733f', pad: '#a7a08e', relief: 2.2, veg: 'hardwood', density: 0.6, vegColor: '#3f6a36', sky: '#a8c0d8', fog: '#c3cdd5' } },
];

export const COMPLETIONS = [
  { id: 'pnp', label: 'Plug and perf', blurb: 'Cemented casing. Each stage: pump down a plug and perforating guns on wireline, set the plug, shoot the clusters, frac, repeat. Plugs are milled out with coiled tubing at the end (or dissolve).' },
  { id: 'sleeve', label: 'Sliding sleeve (ball drop)', blurb: 'Frac sleeves run in the casing, one per stage, with graduated ball seats. The toe sleeve opens on pressure; each later stage opens by dropping a ball from a launcher on the tree. No wireline between stages. Seats are milled out or the balls dissolve.' },
];
export const SLEEVE_SYSTEMS = [
  { id: 'cemented', label: 'Cemented sleeves', blurb: 'Sleeves are cemented in the casing string; the sleeve ports are the only path to the formation.' },
  { id: 'openhole', label: 'Openhole with packers', blurb: 'Uncemented liner with swellable or mechanical packers between sleeves; each packer pair isolates a stage of bare hole.' },
];
export const PLUG_TYPES = [
  { id: 'composite', label: 'Composite (mill out)', blurb: 'Composite plugs or ball seats are milled out with coiled tubing after the last stage.' },
  { id: 'dissolvable', label: 'Dissolvable', blurb: 'Plugs or balls and seats degrade in the wellbore fluid over days; no coiled tubing run unless something fails to dissolve.' },
];
export const FLEETS = [
  { id: 'diesel', label: 'Conventional diesel', hpPerPump: 2500, blurb: 'Diesel engine, transmission, and a 2,500 hp pump per trailer. Highest fuel cost and noise; simplest logistics.' },
  { id: 'dualfuel', label: 'Dual fuel (diesel and gas)', hpPerPump: 2500, blurb: 'Same trailers with gas substitution kits; runs on diesel when gas is short. Needs a gas conditioning skid on the pad.' },
  { id: 'efrac-turbine', label: 'Electric, gas turbine', hpPerPump: 3000, blurb: 'Electric pumps fed by aeroderivative turbine generators burning field gas; twin-pump trailers around 6,000 hp. Smallest footprint per horsepower.' },
  { id: 'efrac-genset', label: 'Electric, reciprocating gensets', hpPerPump: 3000, blurb: 'Electric pumps fed by several gas reciprocating generators; one can drop out while pumping continues. Gas needs more treatment than a turbine.' },
  { id: 'grid', label: 'Electric, grid power', hpPerPump: 3000, blurb: 'Electric pumps fed from a utility substation on the pad. Least common; needs a high-voltage line to the location.' },
];
export const FLUIDS = [
  { id: 'slickwater', label: 'Slickwater (friction reducer)', fric: 1.0, transport: 1.0, blurb: 'Water with friction reducer. Lowest friction, poorest proppant transport: high rate carries the sand.' },
  { id: 'hvfr', label: 'High-viscosity friction reducer', fric: 0.95, transport: 1.2, blurb: 'Higher-loaded friction reducer that adds some viscosity for transport without a gel system.' },
  { id: 'hybrid', label: 'Hybrid (slickwater pad, linear gel)', fric: 1.15, transport: 1.4, blurb: 'Slickwater pad followed by linear gel stages that carry higher concentrations.' },
  { id: 'crosslinked', label: 'Crosslinked gel', fric: 1.45, transport: 1.7, blurb: 'Borate or zirconate crosslinked gel: best transport, highest friction, needs breakers and cleanup.' },
];
export const LIFTS = [
  { id: 'flow', label: 'Natural flow', blurb: 'The well flows on reservoir pressure through the production tree and choke; lift is added later when it loads up.' },
  { id: 'rodpump', label: 'Rod pump (beam unit)', blurb: 'A beam pumping unit strokes a rod string to a positive-displacement pump at the bottom of the tubing. The workhorse of low-rate oil wells.' },
  { id: 'esp', label: 'Electric submersible pump', blurb: 'A multistage centrifugal pump and motor at the bottom of the tubing, powered by a cable from a drive at surface. High rates, sensitive to sand and gas.' },
  { id: 'gaslift', label: 'Gas lift', blurb: 'Compressed gas injected down the annulus through valves in mandrels lightens the tubing column so the well flows. Tolerant of sand and deviation.' },
  { id: 'plunger', label: 'Plunger lift', blurb: 'A free piston cycles between a bumper spring at the tubing tail and a lubricator on the tree, sweeping liquid out of a gas well.' },
];
// Training events that an instructor can inject (or that fire at random when enabled). Each has a recovery sequence in nextSteps.
export const EVENTS = [
  { id: 'misfire', label: 'Gun misfire', phases: ['wireline'], pnpOnly: true, blurb: 'One or more clusters do not fire. Pull out, inspect, re-arm, and run again for the missed clusters.' },
  { id: 'stuck', label: 'Tool string stuck', phases: ['wireline'], pnpOnly: true, blurb: 'The pump-down string stops in the lateral. Work the line and pump to free it before continuing.' },
  { id: 'valveFault', label: 'Working valve actuator fault', phases: ['frac', 'wireline'], blurb: 'The zipper working valve will not move on command. Check hydraulic supply and switch to the backup circuit.' },
  { id: 'sandOut', label: 'Sand delivery interrupted', phases: ['frac'], blurb: 'The conveyor stops: proppant concentration falls to zero mid-stage. Hold rate on clean fluid until sand resumes, then stage back in.' },
  { id: 'prvLift', label: 'Relief valve lift', phases: ['frac'], blurb: 'The missile relief valve lifts on a pressure spike. Pumps offline, find the cause, reset.' },
  { id: 'screenout', label: 'Screenout', phases: ['frac'], blurb: 'The near-wellbore packs off and pressure ramps. Cut sand, flush, and stage back in lower.' },
  { id: 'lightning', label: 'Lightning within 10 miles', phases: ['wireline', 'frac', 'drillout', 'flowback'], blurb: 'A strike inside the ten-mile ring: pumps down, rate to zero, crews off the pad, and hold until the all clear (60 s here; 30 minutes after the last strike on a real pad). Restarting before the all clear costs points.' },
];
export const PROPPANTS = [
  { id: '100mesh', label: '100 mesh sand', bridge: 0.9, blurb: 'Fine sand for near-wellbore and far-field placement; lowest bridging risk in the perforations.' },
  { id: '40-70', label: '40/70 mesh sand', bridge: 1.0, blurb: 'Coarser sand for conductivity near the wellbore.' },
  { id: 'mixed', label: '100 mesh lead, 40/70 tail', bridge: 0.95, blurb: 'Fine sand first, coarser sand to finish each stage.' },
];

export const PHASE_DEFS = {
  setup: { id: 'setup', label: 'Pad setup', short: 'Setup' },
  rigup: { id: 'rigup', label: 'Frac stack rig-up', short: 'Rig-up' },
  wireline: { id: 'wireline', label: 'Wireline: pump-down, set plug, perforate', short: 'Wireline' },
  balldrop: { id: 'wireline', label: 'Ball drop: land the ball, shift the sleeve', short: 'Ball drop' },
  frac: { id: 'frac', label: 'Hydraulic fracturing', short: 'Frac' },
  drillout: { id: 'drillout', label: 'Coiled tubing drillout', short: 'Drillout' },
  millout: { id: 'drillout', label: 'Coiled tubing seat mill-out', short: 'Mill-out' },
  dissolve: { id: 'drillout', label: 'Dissolve: plugs degrade, no coiled tubing', short: 'Dissolve' },
  flowback: { id: 'flowback', label: 'Flowback and well test', short: 'Flowback' },
  production: { id: 'production', label: 'Production hookup', short: 'Production' },
};
// Phase list for the completion chosen in setup. Phase ids are stable; labels change with the method.
export function phasesFor(setup) {
  const sleeve = setup && setup.completion === 'sleeve';
  const dissolvable = setup && setup.plugs === 'dissolvable';
  return [
    PHASE_DEFS.setup, PHASE_DEFS.rigup,
    sleeve ? PHASE_DEFS.balldrop : PHASE_DEFS.wireline,
    PHASE_DEFS.frac,
    dissolvable ? PHASE_DEFS.dissolve : sleeve ? PHASE_DEFS.millout : PHASE_DEFS.drillout,
    PHASE_DEFS.flowback, PHASE_DEFS.production,
  ];
}
export const PHASES = phasesFor(null);   // default labels (plug and perf)

// Pad configuration: how many wells share the pad and how the frac and wireline crews cycle across them.
// fracSlots: wells pumped at the same time. wlSlots: wells on wireline (or ball drop) at the same time.
export const FRAC_MODES = [
  { id: 'single', label: 'Single well', short: 'Single', fracSlots: 1, wlSlots: 0, blurb: 'One well: wireline and frac alternate on the same well. Pumps sit idle while wireline runs.' },
  { id: 'zipper', label: 'Zipper frac', short: 'Zipper', fracSlots: 1, wlSlots: 1, blurb: 'Two or more wells alternate: while one well is pumped, wireline sets the next plug and guns on the neighbor.' },
  { id: 'simul', label: 'Simul-frac', short: 'Simul', fracSlots: 2, wlSlots: 1, blurb: 'Two wells are pumped at the same time from one spread through a split manifold; wireline works ahead on a third.' },
  { id: 'trimul', label: 'Trimul-frac', short: 'Trimul', fracSlots: 3, wlSlots: 2, blurb: 'Three wells pumped at once. Needs a larger spread, more sand and water logistics, and two wireline units.' },
  { id: 'quad', label: 'Quad-frac', short: 'Quad', fracSlots: 4, wlSlots: 2, blurb: 'Four wells pumped at once, the largest simultaneous scheme in use; rate per well drops unless the spread grows.' },
];
export const BORES = [
  { id: '4-10K', label: '4-1/16 in. 10K', bore: 4.0625, rating: 10 },
  { id: '4-15K', label: '4-1/16 in. 15K', bore: 4.0625, rating: 15 },
  { id: '5-10K', label: '5-1/8 in. 10K', bore: 5.125, rating: 10 },
  { id: '5-15K', label: '5-1/8 in. 15K', bore: 5.125, rating: 15 },
  { id: '7-10K', label: '7-1/16 in. 10K', bore: 7.0625, rating: 10 },
  { id: '7-15K', label: '7-1/16 in. 15K', bore: 7.0625, rating: 15 },
];
export const MAX_WELLS = 16;
export const JOB_TIME_SCALE = 30;   // one second of simulation stands for 30 seconds of job time (volumes and totals)

// Fixed illustrative constants
export const CONST = { waterPpg: 8.34, sandSgPpg: 22.1, casingBoreIn: 4.778 };
const VALVE_TRAVEL_S = 3.0;    // hydraulic actuator or handwheel travel time (simplified)
const a_any = (a) => a.overpressure || a.prvLifted || a.kickout || a.screenout || !!a.interlock;

export function basinOf(s) { return BASINS.find(b => b.id === s.setup.basin) || BASINS[0]; }
export function fleetOf(s) { return FLEETS.find(f => f.id === s.setup.fleet) || FLEETS[0]; }
export function fluidOf(s) { return FLUIDS.find(f => f.id === s.setup.fluid) || FLUIDS[0]; }
export function proppantOf(s) { return PROPPANTS.find(p => p.id === s.setup.proppant) || PROPPANTS[0]; }
export function liftOf(s) { return LIFTS.find(l => l.id === s.setup.lift) || LIFTS[0]; }
export function boreOf(s) { return BORES.find(b => b.id === s.pad.bore) || BORES[5]; }

// Well and pressure parameters derived from the setup (illustrative)
export function wellParams(s) {
  const b = boreOf(s);
  const maxTreatingPsi = b.rating >= 15 ? 12500 : 9000;   // pump kickout setting below the working pressure
  const prvSetPsi = b.rating >= 15 ? 13000 : 9500;         // pressure relief valve on the missile
  return { tvdFt: s.setup.tvdFt, fracGradientPsiFt: s.setup.fracGradient, maxTreatingPsi, prvSetPsi, waterPpg: CONST.waterPpg, sandSgPpg: CONST.sandSgPpg,
    toeOpenPsi: Math.round(maxTreatingPsi * 0.7) };
}
// Expected surface treating pressure at 90 bpm with water in the pipe (setup estimate)
export function estimateStp(s, q = 90) {
  const w = wellParams(s);
  const f = fluidOf(s);
  const closure = w.fracGradientPsiFt * w.tvdFt;
  const hydro = 0.052 * CONST.waterPpg * w.tvdFt;
  const fric = (1150 * Math.pow(q / 90, 1.8) * f.fric) + 900 * Math.pow(q / 90, 2) * (3 / Math.max(3, s.setup.clusters));
  return Math.round(closure + 500 + fric - hydro);
}
// Spread sizing from the fleet and the rating: hydraulic horsepower = psi x bpm / 40.8
export function spreadSizing(s) {
  const mode = FRAC_MODES.find(m => m.id === s.pad.mode) || FRAC_MODES[0];
  const fleet = fleetOf(s);
  const w = wellParams(s);
  const wellsAtOnce = Math.min(mode.fracSlots, s.pad.wells);
  const designRate = 90 * wellsAtOnce;
  const hhp = designRate * w.maxTreatingPsi / 40.8;
  const pumps = Math.max(4, Math.min(24, Math.ceil(hhp / (fleet.hpPerPump * 0.85)) + 2));
  const availableHhp = pumps * fleet.hpPerPump * 0.85;
  const maxRatePerWell = Math.max(20, Math.min(120, Math.floor(availableHhp * 40.8 / w.maxTreatingPsi / wellsAtOnce)));
  return { wellsAtOnce, designRate, hhp: Math.round(hhp), pumps, availableHhp: Math.round(availableHhp), maxRatePerWell, electric: fleet.id.startsWith('efrac') || fleet.id === 'grid' };
}
export function designTotals(s) {
  const stages = Math.max(1, Math.round(s.setup.lateralFt / s.setup.stageSpacingFt));
  const proppantLb = s.setup.proppantLbFt * s.setup.lateralFt;
  const fluidBbl = s.setup.fluidBblFt * s.setup.lateralFt;
  return { stages, proppantLb, fluidBbl, clustersTotal: stages * s.setup.clusters, stageProppantLb: s.setup.proppantLbFt * s.setup.stageSpacingFt, stageFluidBbl: s.setup.fluidBblFt * s.setup.stageSpacingFt };
}

// Roles of every well on the pad, derived from the focus well (index 0, the one under manual control),
// the frac mode, and the focus well's phase. Partner wells follow the crews automatically.
export function padRoles(s) {
  const n = s.pad.wells;
  const mode = FRAC_MODES.find(m => m.id === s.pad.mode) || FRAC_MODES[0];
  const count = s.stages.length;
  const roles = Array.from({ length: n }, (_, i) => ({ i, role: i === 0 ? 'focus' : 'idle', stage: Math.min(count, s.stage + (i % 2)) }));
  const others = roles.slice(1);
  let k = 0;
  const take = (role, cnt) => { for (let j = 0; j < cnt && k < others.length; j++, k++) others[k].role = role; };
  if (s.phase === 'frac') {
    take('frac', mode.fracSlots - 1);
    take('wireline', mode.wlSlots);
  } else if (s.phase === 'wireline') {
    if (mode.wlSlots > 0) { take('frac', mode.fracSlots); take('wireline', mode.wlSlots - 1); }
  } else if (s.phase === 'drillout' || s.phase === 'flowback' || s.phase === 'production') {
    take('done', others.length);
  }
  return roles;
}

// Illustrative per-well telemetry for the pad table. Well 0 reports the live model; partner wells that are
// pumping report the same rate with a small per-well offset in surface pressure so the table reads as a pad,
// not as a copy of well 1. Nothing here is a hydraulic model of a split manifold.
export function padTelemetry(s) {
  const roles = padRoles(s);
  const w = wellParams(s);
  const live = s.pumpsOnline && !s.alarms.kickout ? s.pumpRate : 0;
  const closurePsi = w.fracGradientPsiFt * w.tvdFt;
  const nominal = Math.max(0, closurePsi + 900 + 1150 * Math.pow(70 / 90, 1.8) - 0.052 * w.waterPpg * w.tvdFt);
  return roles.map(r => {
    if (r.i === 0) return { ...r, q: live, p: s.surfacePsi };
    if (r.role === 'frac') {
      const q = s.phase === 'frac' ? live : 70;
      const p = s.phase === 'frac' && live > 0 ? s.surfacePsi * (0.93 + 0.05 * ((r.i * 7) % 3)) : (q > 0 ? nominal * (0.93 + 0.05 * ((r.i * 7) % 3)) : 0);
      return { ...r, q, p };
    }
    if (r.role === 'wireline') return { ...r, q: 12 + 3 * (r.i % 2), p: 0.35 * closurePsi };
    return { ...r, q: 0, p: r.role === 'done' ? 0.2 * closurePsi : 0 };
  });
}

function initialValves(sleeve = false) {
  // pos: 0 closed, 1 open. target: commanded position. Gate valves are two-position.
  return {
    lmv:   { pos: 1, target: 1, label: 'Lower master valve (manual)', kind: 'manual' },
    umv:   { pos: 1, target: 1, label: 'Upper master valve (hyd.)', kind: 'hydraulic' },
    wingA: { pos: 0, target: 0, label: 'Wing A, pump-down side (hyd.)', kind: 'hydraulic' },
    wingB: { pos: 0, target: 0, label: 'Wing B, flowback side (hyd.)', kind: 'hydraulic' },
    crown: { pos: 1, target: 1, label: 'Crown valve below the inlet block (hyd.)', kind: 'hydraulic' },
    swab:  { pos: 0, target: 0, label: sleeve ? 'Swab valve, ball launcher isolation (hyd.)' : 'Swab valve, lubricator access (hyd.)', kind: 'hydraulic' },
    iso:   { pos: 1, target: 1, label: 'Missile isolation valve to the zipper header (hyd.)', kind: 'hydraulic' },
    zipIso:  { pos: 1, target: 1, label: 'Zipper leg: lower isolation valve, this well (hyd.)', kind: 'hydraulic' },
    zipWork: { pos: 0, target: 0, label: 'Zipper leg: upper working valve, this well (hyd.)', kind: 'hydraulic' },
  };
}

function initialStages(count) {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    perforated: false,    // perforations shot, or sleeve ports open
    plugSet: false,       // plug set toe-ward of this stage's perforations, or ball on this stage's seat
    fracExtent: 0,        // 0 to 1, fracture half-length as a fraction of the display maximum
    proppantFill: 0,      // 0 to 1 of the stage design proppant
    fracTop: TARGET_HALF, // height reached above the lateral, display meters (Drop 33); a maximum, it never shrinks
    fracBot: TARGET_HALF, // height reached below the lateral
    outOfZone: false,     // fracture reached the sand above the upper barrier
    fracComplete: false,
    plugMilled: false,    // plug or seat milled, or dissolved
    clustersFired: 0,     // clusters shot, or sleeve ports open
    stageSlurryBbl: 0,
    stageProppantLb: 0,
  }));
}

function defaultSetup() {
  const b = BASINS[0];
  return { basin: b.id, tvdFt: b.tvdFt, fracGradient: b.fracGradient, completion: b.completion, sleeveSystem: 'cemented', plugs: 'composite',
    lateralFt: b.lateralFt, stageSpacingFt: b.stageSpacingFt, clusters: b.clusters, stagesShown: 5,
    fleet: b.fleet, proppant: b.proppant, proppantLbFt: b.proppantLbFt, fluid: b.fluid, fluidBblFt: b.fluidBblFt, lift: b.lift || 'flow', sand: b.sand || 'silos' };
}

const freshJob = (setup, pad) => ({
  t: 0, phase: 'setup', stage: 0, wl: { step: 'idle', progress: 0 }, ct: { progress: 0, milling: 0, atPlug: -1 },
  fb: { choke: 0.35, cumBbl: 0 }, lubricatorRigged: false, ctRigged: false, valves: initialValves(setup.completion === 'sleeve'), stages: initialStages(setup.stagesShown),
  pumpRate: 0, ppa: 0, pumpsOnline: false, surfacePsi: 0, bhtpPsi: 0, hydroPsi: 0, frictionPsi: 0, netPsi: 0,
  slurryPpg: CONST.waterPpg, cumSlurryBbl: 0, cumProppantLb: 0, history: [], ballsDropped: 0,
  alarms: { overpressure: false, prvLifted: false, kickout: false, screenout: false, interlock: '' }, log: [],
  events: { active: null, random: false, sandTimer: 0, valveFault: false, misfireArmed: false, misfired: 0, fired: [], lightningTimer: 0, lightningDown: false },
  hookup: { step: 'rig', progress: 0, joints: 0 },
  score: freshScore(),
  lesson: freshLesson(),
});
// Snapshot of a finished job for the session summary after a reset
const snapshotJob = (s) => (s.phase === 'setup' ? s.lastJob : { setup: s.setup, pad: s.pad, t: s.t, phase: s.phase, stages: s.stages, score: s.score, log: s.log, events: s.events, lesson: s.lesson, when: Date.now() });
// A free-play job that went somewhere is saved to the account when it ends (lesson runs save themselves on completion).
function saveFreeJob(s) {
  if (s.phase === 'setup' || s.lesson.id || s.score.moves === 0) return;
  const job = snapshotJob(s);
  const sc = scoreOf(job.score);
  const b = BASINS.find(x => x.id === s.setup.basin) || BASINS[0];
  const ph = phasesFor(s.setup).find(p => p.id === s.phase);
  postJobSummary({ kind: 'free', title: 'Free play: ' + b.label + ', ' + s.pad.wells + ' well' + (s.pad.wells > 1 ? 's' : '') + ', reached ' + (ph ? ph.short.toLowerCase() : s.phase), total: sc.total, secs: Math.round(s.t), payload: job });
}

export const useSim = create((set, get) => ({
  // ----- mode and time -----
  running: true,
  speed: 1,
  setup: defaultSetup(),
  pad: { wells: 4, mode: 'zipper', bore: BASINS[0].bore },
  ui: { view: 'surface', showLabels: false, preset: 'pad', mobileTab: '3d', summary: false, focus: null, tod: 'day', season: 'summer', weather: 'clear', walk: false, full: false, tour: false },
  ...freshJob(defaultSetup(), { wells: 4, mode: 'zipper', bore: BASINS[0].bore }),
  lessonResults: [],
  lastJob: null,

  // ----- actions -----
  toggleRunning: () => set(s => ({ running: !s.running })),
  setSpeed: (speed) => set({ speed }),
  setPumpRate: (pumpRate) => set({ pumpRate }),
  setPpa: (ppa) => set({ ppa }),
  setPumpsOnline: (pumpsOnline) => set({ pumpsOnline, alarms: { ...get().alarms, kickout: pumpsOnline ? false : get().alarms.kickout } }),
  setChoke: (choke) => set(s => ({ fb: { ...s.fb, choke } })),
  setUi: (patch) => set(s => ({ ui: { ...s.ui, ...patch } })),
  // the next-steps and lesson cards call this before acting so the surface camera moves to the equipment involved
  focusOn: (target) => set(s => ({ ui: { ...s.ui, focus: { ...target, n: (s.ui.focus ? s.ui.focus.n : 0) + 1 } } })),
  setPad: (patch) => {
    const s = get();
    const pad = { ...s.pad, ...patch };
    pad.wells = Math.max(1, Math.min(MAX_WELLS, Math.round(pad.wells)));
    const mode = FRAC_MODES.find(m => m.id === pad.mode) || FRAC_MODES[0];
    if (pad.wells < mode.fracSlots + mode.wlSlots) {
      // not enough wells for that scheme: drop to the largest scheme that fits
      const fit = [...FRAC_MODES].reverse().find(m => m.fracSlots + m.wlSlots <= pad.wells) || FRAC_MODES[0];
      pad.mode = fit.id;
    }
    set({ pad });
    if (s.phase !== 'setup') get().addLog('Pad: ' + pad.wells + ' well' + (pad.wells > 1 ? 's' : '') + ', ' + (FRAC_MODES.find(m => m.id === pad.mode).label) + ', ' + (BORES.find(b => b.id === pad.bore) || BORES[5]).label);
  },
  // Setup edits only apply in the setup phase; the stage list and valve labels follow the choice.
  setSetup: (patch) => {
    const s = get();
    const setup = { ...s.setup, ...patch };
    setup.lateralFt = Math.max(3000, Math.min(20000, setup.lateralFt));
    setup.stageSpacingFt = Math.max(100, Math.min(400, setup.stageSpacingFt));
    setup.clusters = Math.max(1, Math.min(8, Math.round(setup.clusters)));
    setup.stagesShown = Math.max(3, Math.min(8, Math.round(setup.stagesShown)));
    setup.proppantLbFt = Math.max(300, Math.min(4000, setup.proppantLbFt));
    setup.fluidBblFt = Math.max(10, Math.min(80, setup.fluidBblFt));
    const out = { setup };
    if (s.phase === 'setup') { out.stages = initialStages(setup.stagesShown); out.valves = initialValves(setup.completion === 'sleeve'); }
    set(out);
  },
  // Pick a basin: loads its typical starting values into the setup (all editable afterwards)
  setBasin: (id) => {
    const b = BASINS.find(x => x.id === id) || BASINS[0];
    get().setSetup({ basin: b.id, tvdFt: b.tvdFt, fracGradient: b.fracGradient, completion: b.completion, lateralFt: b.lateralFt, stageSpacingFt: b.stageSpacingFt,
      clusters: b.clusters, fleet: b.fleet, proppant: b.proppant, proppantLbFt: b.proppantLbFt, fluid: b.fluid, fluidBblFt: b.fluidBblFt, sleeveSystem: b.id === 'bakken' ? 'openhole' : 'cemented', lift: b.lift || 'flow', sand: b.sand || 'silos' });
    get().setPad({ bore: b.bore });
  },
  startJob: () => {
    const s = get();
    if (s.phase !== 'setup') return;
    set({ ...freshJob(s.setup, s.pad), phase: 'rigup' });
    const b = basinOf(get());
    get().addLog('Job started: ' + b.label + ', ' + s.pad.wells + ' well' + (s.pad.wells > 1 ? 's' : '') + ', ' + (COMPLETIONS.find(c => c.id === s.setup.completion) || COMPLETIONS[0]).label + ', ' + boreOf(get()).label);
  },
  backToSetup: () => set(s => { saveFreeJob(s); return { ...freshJob(s.setup, s.pad), phase: 'setup', lastJob: snapshotJob(s) }; }),
  commandValve: (id, target) => {
    const s = get();
    const v = s.valves[id];
    if (!v) return;
    if (v.target === target) return;
    const sleeve = s.setup.completion === 'sleeve';
    const zipOpen = s.valves.zipWork.pos > 0.01 && s.valves.zipIso.pos > 0.01;
    const deduct = (code, detail) => ({ ...s.score, deductions: [...s.score.deductions, { t: s.t, code, label: DEDUCT[code].label + (detail ? ': ' + detail : ''), pts: DEDUCT[code].pts }], interlocks: s.score.interlocks + (code === 'interlock' ? 1 : 0), wrongMoves: s.score.wrongMoves + (code === 'wrongMove' ? 1 : 0), moves: s.score.moves + 1 });
    // Interlocks that reflect field practice (simplified). A rejected command costs points.
    const block = (msg) => set({ alarms: { ...s.alarms, interlock: msg }, score: deduct('interlock', v.label) });
    if (id === 'lmv' && (s.surfacePsi > 500 || s.pumpRate > 0)) {
      return block('Lower master valve is not cycled under pressure or flow. Bleed down first.');
    }
    if (!sleeve && id === 'swab' && target === 1 && zipOpen) {
      return block('Close the zipper working valve before opening the swab valve: the inlet block sits below the swab.');
    }
    if (!sleeve && (id === 'zipWork' || id === 'zipIso') && target === 1 && s.valves.swab.pos > 0.01 && (id === 'zipWork' ? s.valves.zipIso.pos > 0.01 : s.valves.zipWork.pos > 0.01)) {
      return block('Close the swab valve (lubricator access) before opening the zipper leg to the inlet block.');
    }
    if (id === 'crown' && (s.surfacePsi > 500 || s.pumpRate > 0) && target === 0) {
      return block('Crown valve is not closed against flow. Stop pumping and bleed the inlet block first.');
    }
    if (id === 'zipWork' && s.events.valveFault) {
      return block('Working valve actuator fault: the valve does not respond to the control unit. Check the hydraulic supply and switch to the backup circuit.');
    }
    if (id === 'iso' && target === 0 && s.pumpsOnline && s.pumpRate > 0) {
      return block('Missile isolation valve is not closed against flow: the spread would deadhead. Pumps offline first.');
    }
    // Scoring: moving a valve out of a state the current sequence already has checked off is a wrong move
    // (for example closing a master during a frac stage). Neutral moves are not scored.
    const step = nextSteps(s).steps.find(x => x.valve === id && x.done);
    const against = step && ((v.pos > 0.99 && target === 0) || (v.pos < 0.01 && target === 1));
    const score = against ? deduct('wrongMove', v.label) : { ...s.score, moves: s.score.moves + 1 };
    if (against) get().addLog('Against the sequence: ' + v.label + ' ' + (target === 1 ? 'opened' : 'closed') + ' (' + DEDUCT.wrongMove.pts + ' points).');
    set({ valves: { ...s.valves, [id]: { ...v, target } }, alarms: { ...s.alarms, interlock: '' }, score });
  },
  // ----- guided lessons -----
  startLesson: (id) => {
    const L = lessonById(id);
    if (!L) return;
    if (get().phase !== 'setup') get().backToSetup();
    set({ setup: defaultSetup(), pad: { wells: 4, mode: 'zipper', bore: BASINS[0].bore } });   // a lesson starts from the defaults, not from the last free-play setup
    get().setBasin((L.setup && L.setup.basin) || BASINS[0].id);
    if (L.setup) get().setSetup(L.setup);
    if (L.pad) get().setPad(L.pad);
    get().startJob();
    if (L.prep) L.prep(get, set);
    set(s => ({ lesson: { id: L.id, doneMask: L.steps.map(() => false), startedAt: s.t, finished: false, result: null }, ui: { ...s.ui, summary: false } }));
    get().addLog('Lesson ' + L.n + ' started: ' + L.title + '. Target ' + L.targetSec + ' s.');
  },
  quitLesson: () => { const L = lessonById(get().lesson.id); set({ lesson: freshLesson() }); if (L) get().addLog('Lesson ' + L.n + ' left; the job continues in free play.'); },
  nextLesson: () => { const id = nextLessonId(get().lesson.id); if (id) get().startLesson(id); else get().reset(); },
  hydrateProgress: (rows) => set({ lessonResults: fromServer(rows) }),
  // Shareable job links (Drop 42): the setup, pad, phase, stage, and view settings as one URL-safe token.
  shareToken: () => {
    const s = get();
    const obj = { v: 1, setup: s.setup, pad: s.pad, phase: s.phase, stage: s.stage, ui: { tod: s.ui.tod, season: s.ui.season, weather: s.ui.weather, preset: s.ui.preset, view: s.ui.view } };
    const json = JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  applyShareToken: (token) => {
    try {
      const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
      const obj = JSON.parse(decodeURIComponent(escape(atob(b64 + '='.repeat((4 - b64.length % 4) % 4)))));
      if (!obj || obj.v !== 1) return false;
      get().reset();
      if (obj.setup) get().setSetup({ ...get().setup, ...obj.setup });
      if (obj.pad) get().setPad({ ...get().pad, ...obj.pad });
      if (obj.ui) set(st => ({ ui: { ...st.ui, ...obj.ui, focus: null, summary: false } }));
      if (obj.phase && obj.phase !== 'setup') {
        get().setPhase(obj.phase);
        const target = Math.max(0, Math.min((get().stages.length || 1) - 1, obj.stage || 0));
        for (let i = 0; i < target; i++) get().nextStage();
        get().addLog('Opened from a shared link: ' + obj.phase + ', stage ' + (target + 1));
      }
      return true;
    } catch (e) { console.error('share link:', e); return false; }
  },
  openSummary: () => set(s => ({ ui: { ...s.ui, summary: true } })),
  closeSummary: () => set(s => ({ ui: { ...s.ui, summary: false } })),
  clearInterlock: () => set(s => ({ alarms: { ...s.alarms, interlock: '' } })),
  // actions referenced by the next-steps guidance
  guide: (action) => {
    const g = get();
    if (action === 'rateZero') { g.setPumpRate(0); }
    else if (action === 'stop') { g.setPumpRate(0); g.setPumpsOnline(false); }
    else if (action === 'ppaZero') { g.setPpa(0); }
    else if (action === 'rateFlush') { g.setPumpRate(60); if (!g.pumpsOnline && !g.alarms.kickout) g.setPumpsOnline(true); }
    else if (action === 'rateLow') { g.setPumpRate(15); if (!g.pumpsOnline && !g.alarms.kickout) g.setPumpsOnline(true); }
    else if (action === 'pumpsOff') { g.setPumpsOnline(false); }
    else if (action === 'pumpsOn') { if (!g.alarms.kickout) g.setPumpsOnline(true); }
    else if (action === 'ack') { g.acknowledgeAlarms(); }
    else if (action === 'run') { g.startWirelineRun(); }
    else if (action === 'fire') { g.fireGuns(); }
    else if (action === 'nextStage') { g.nextStage(); g.setPhase('wireline'); }
    else if (action === 'phaseWireline') { g.setPhase('wireline'); }
    else if (action === 'phaseFrac') { g.setPhase('frac'); }
    else if (action === 'phaseDrillout') { g.setPhase('drillout'); }
    else if (action === 'phaseFlowback') { g.setPhase('flowback'); }
    else if (action === 'phaseProduction') { g.setPhase('production'); }
    else if (action === 'start') { g.startJob(); }
    else if (action === 'workLine') { g.workLine(); }
    else if (action === 'resetActuator') { g.resetActuator(); }
    else if (action === 'rerunGuns') { g.rerunGuns(); }
    else if (action === 'hookupNext') { g.hookupNext(); }
    else if (action === 'clearEvent') { g.clearEvent(); }
    else if (action === 'reset') { g.reset(); }
  },
  acknowledgeAlarms: () => set(s => ({ alarms: { ...s.alarms, overpressure: false, prvLifted: false, screenout: false, kickout: false } })),
  // ----- training events -----
  setRandomEvents: (random) => set(s => ({ events: { ...s.events, random } })),
  injectEvent: (id) => {
    const s = get();
    const ev = EVENTS.find(e => e.id === id);
    if (!ev || s.phase === 'setup') return;
    const sleeve = s.setup.completion === 'sleeve';
    if (ev.pnpOnly && sleeve) return;
    const events = { ...s.events, fired: [...s.events.fired, id] };
    // time-to-recover clock starts now (a misfire starts when it shows up at surface: see the tick)
    if (id !== 'misfire' && !(id === 'stuck' && s.wl.step !== 'pumpdown')) set({ score: { ...s.score, open: { ...s.score.open, [id]: { at: s.t } } } });
    if (id === 'misfire') {
      // takes effect when the guns fire: the last cluster (or two) fails
      set({ events: { ...events, misfireArmed: true } });
      get().addLog('EVENT: a gun misfire is armed for the next perforating run.');
    } else if (id === 'stuck') {
      if (s.wl.step !== 'pumpdown') { get().addLog('Event ignored: no string moving in the lateral right now.'); return; }
      set({ events: { ...events, active: 'stuck' }, wl: { step: 'stuck', progress: s.wl.progress } });
      get().addLog('EVENT: tool string stuck in the lateral.');
    } else if (id === 'valveFault') {
      set({ events: { ...events, active: 'valveFault', valveFault: true } });
      get().addLog('EVENT: zipper working valve actuator does not respond.');
    } else if (id === 'sandOut') {
      set({ events: { ...events, active: 'sandOut', sandTimer: 25 }, ppa: 0 });
      get().addLog('EVENT: sand delivery interrupted. Proppant concentration fell to zero.');
    } else if (id === 'prvLift') {
      set({ events: { ...events, active: 'prvLift' }, alarms: { ...s.alarms, prvLifted: true }, surfacePsi: Math.max(s.surfacePsi, wellParams(s).prvSetPsi + 200), pumpsOnline: false });
      get().addLog('EVENT: pressure spike, relief valve lifted on the missile.');
    } else if (id === 'screenout') {
      set({ events: { ...events, active: 'screenout' }, alarms: { ...s.alarms, screenout: true }, netPsi: Math.max(s.netPsi, 2600) });
      get().addLog('EVENT: SCREENOUT: treating pressure ramping at constant rate.');
    } else if (id === 'lightning') {
      // Drop 70: weather hold. The storm arrives with the strike; the all clear comes 60 s of sim time later (a real hold is 30 minutes after the last strike)
      set({ events: { ...events, active: 'lightning', lightningTimer: 60, lightningDown: false }, ui: { ...s.ui, weather: 'rain' } });
      get().addLog('EVENT: lightning within 10 miles. Weather hold: pumps down, rate to zero, crews off the pad until the all clear.');
    }
  },
  clearEvent: () => set(s => ({ events: { ...s.events, active: null } })),
  workLine: () => {
    const s = get();
    if (s.wl.step !== 'stuck') return;
    set({ wl: { step: 'freeing', progress: 0 } });
    get().addLog('Working the line: tension cycles and pump-down rate to free the string.');
  },
  resetActuator: () => {
    const s = get();
    if (!s.events.valveFault) return;
    set({ events: { ...s.events, valveFault: false, active: s.events.active === 'valveFault' ? null : s.events.active } });
    get().addLog('Working valve on the backup hydraulic circuit: actuator responds.');
  },
  rerunGuns: () => {
    const s = get();
    const st = s.stages[s.stage];
    if (s.phase !== 'wireline' || !st || st.clustersFired >= s.setup.clusters) return;
    if (s.valves.swab.pos < 0.99 || s.valves.crown.pos < 0.99 || s.valves.umv.pos < 0.99 || s.valves.lmv.pos < 0.99) {
      return set({ alarms: { ...s.alarms, interlock: 'Swab, crown, and master valves must be open with the lubricator rigged before running in.' } });
    }
    set({ wl: { step: 'pumpdown', progress: 0 }, events: { ...s.events, misfireArmed: false, misfired: 0 } });
    get().addLog('Re-running guns for the ' + (s.setup.clusters - st.clustersFired) + ' missed cluster' + (s.setup.clusters - st.clustersFired > 1 ? 's' : '') + '.');
  },
  // ----- production hookup sub-steps -----
  hookupNext: () => {
    const s = get();
    if (s.phase !== 'production') return;
    const h = s.hookup;
    if (h.step === 'rig') { set({ hookup: { step: 'tubing', progress: 0, joints: 0 } }); get().addLog('Workover rig and BOP stack rigged up; running production tubing.'); }
    else if (h.step === 'tubing' && h.progress >= 1) { set({ hookup: { ...h, step: 'tree' } }); get().addLog('Tubing landed. Nippling down the BOP stack, installing the production tree.'); }
    else if (h.step === 'tree') { set({ hookup: { ...h, step: 'done' } }); get().addLog('Production tree tested; flowline and lift hooked up. Well on production.'); }
  },
  addLog: (msg) => set(s => ({ log: [{ t: s.t, msg }, ...s.log].slice(0, 60) })),

  setPhase: (phase) => {
    const s = get();
    if (s.phase === 'setup' && phase !== 'setup') { get().startJob(); if (phase === 'rigup') return; }
    if (phase === 'setup') return get().backToSetup();
    const cur = get();
    const sleeve = cur.setup.completion === 'sleeve';
    const patch = { phase, wl: { step: 'idle', progress: 0 }, pumpRate: 0, ppa: 0, pumpsOnline: false };
    const v = cur.valves;
    const tv = (id, target) => ({ ...v[id], target });
    if (phase === 'wireline') {
      patch.ctRigged = false;
      if (sleeve) {
        // ball drop: the launcher sits on the tree; the flow path stays open and the swab isolates the launcher
        patch.lubricatorRigged = false;
        patch.valves = { ...v, wingA: tv('wingA', 0), zipIso: tv('zipIso', 1), zipWork: tv('zipWork', 1), crown: tv('crown', 1), swab: tv('swab', 0) };
      } else {
        patch.lubricatorRigged = true;
        patch.valves = { ...v, wingA: tv('wingA', 1), zipWork: tv('zipWork', 0), zipIso: tv('zipIso', 0), crown: tv('crown', 1), swab: tv('swab', 1) };
      }
    } else if (phase === 'frac') {
      patch.lubricatorRigged = false; patch.ctRigged = false;
      patch.valves = { ...v, swab: tv('swab', 0), wingA: tv('wingA', 0), crown: tv('crown', 1), zipIso: tv('zipIso', 1) };
    } else if (phase === 'drillout') {
      patch.lubricatorRigged = false;
      patch.ctRigged = cur.setup.plugs !== 'dissolvable';
      patch.valves = { ...v, wingA: tv('wingA', 0), zipWork: tv('zipWork', 0), zipIso: tv('zipIso', 0), swab: tv('swab', patch.ctRigged ? 1 : 0), wingB: tv('wingB', 1) };
      patch.ct = { progress: 0, milling: 0, atPlug: -1 };
    } else if (phase === 'flowback') {
      patch.lubricatorRigged = false; patch.ctRigged = false;
      patch.valves = { ...v, swab: tv('swab', 0), wingA: tv('wingA', 0), zipWork: tv('zipWork', 0), zipIso: tv('zipIso', 0), wingB: tv('wingB', 1) };
    } else if (phase === 'rigup' || phase === 'production') {
      patch.lubricatorRigged = false; patch.ctRigged = false;
      if (phase === 'production') patch.hookup = { step: 'rig', progress: 0, joints: 0 };
    }
    // per-stage clock for the session summary
    if (phase === 'wireline' || phase === 'frac') {
      const rec = cur.score.stages[cur.stage] || { stage: cur.stage };
      const next = phase === 'wireline' ? { ...rec, wlStart: rec.wlStart ?? cur.t } : { ...rec, wlEnd: rec.wlEnd ?? cur.t, fracStart: rec.fracStart ?? cur.t };
      patch.score = { ...cur.score, stages: { ...cur.score.stages, [cur.stage]: next } };
    }
    set(patch);
    get().addLog('Phase: ' + phasesFor(cur.setup).find(p => p.id === phase).label);
  },

  // Wireline sequence (plug and perf): pump-down, set plug, perforate cluster by cluster, pull out of hole.
  // Ball drop sequence (sleeves): toe sleeve opens on pressure for stage 1; later stages launch a ball, pump it down, land it, shift the sleeve.
  startWirelineRun: () => {
    const s = get();
    if (s.phase !== 'wireline') return;
    if (s.stage >= s.stages.length) return;
    if (s.setup.completion === 'sleeve') {
      if (s.valves.umv.pos < 0.99 || s.valves.lmv.pos < 0.99 || s.valves.crown.pos < 0.99 || s.valves.zipWork.pos < 0.99 || s.valves.zipIso.pos < 0.99 || s.valves.iso.pos < 0.99) {
        return set({ alarms: { ...s.alarms, interlock: 'Masters, crown, and the zipper leg must be open: the ball is pumped down with the treating line.' } });
      }
      if (s.stage === 0) {
        set({ wl: { step: 'toe', progress: 0 } });
        get().addLog('Toe sleeve: pressuring the casing to the opening pressure.');
        return;
      }
      if (s.valves.swab.pos < 0.99) return set({ alarms: { ...s.alarms, interlock: 'Open the swab valve to the ball launcher before releasing the ball.' } });
      if (!s.pumpsOnline || s.pumpRate < 5) return set({ alarms: { ...s.alarms, interlock: 'Ball drop needs flow: pumps online at 10 to 20 bpm before the ball is released.' } });
      set({ wl: { step: 'launch', progress: 0 }, ballsDropped: s.ballsDropped + 1 });
      get().addLog('Ball ' + s.stage + ' released from the launcher for sleeve ' + (s.stage + 1) + '.');
      return;
    }
    if (s.valves.swab.pos < 0.99 || s.valves.crown.pos < 0.99 || s.valves.umv.pos < 0.99 || s.valves.lmv.pos < 0.99) {
      return set({ alarms: { ...s.alarms, interlock: 'Swab, crown, and master valves must be open with the lubricator rigged before running in.' } });
    }
    set({ wl: { step: 'pumpdown', progress: 0 } });
    get().addLog('Wireline: pumping down plug and guns for stage ' + (s.stage + 1));
  },
  fireGuns: () => {
    const s = get();
    if (s.wl.step !== 'armed') return;
    set({ wl: { step: 'perforate', progress: 0 } });
    get().addLog('Wireline: firing clusters bottom-up, stage ' + (s.stage + 1));
  },
  nextStage: () => {
    const s = get();
    if (s.stage < s.stages.length - 1) {
      set({ stage: s.stage + 1, pumpRate: 0, ppa: 0, pumpsOnline: false });
      get().addLog('Advance to stage ' + (s.stage + 2));
    }
  },
  reset: () => set(s => { saveFreeJob(s); return { ...freshJob(s.setup, s.pad), phase: 'setup', lastJob: snapshotJob(s) }; }),

  // ----- the tick: called from the render loop with dt in seconds of sim time -----
  tick: (dtRaw) => {
    const s = get();
    if (!s.running || s.phase === 'setup') return;
    const dt = Math.min(dtRaw, 0.1) * s.speed;
    const t = s.t + dt;
    const patch = { t };
    // scoring accumulators for this tick
    let score = { ...s.score, phaseSec: { ...s.score.phaseSec, [s.phase]: (s.score.phaseSec[s.phase] || 0) + dt } };
    // a lesson that stages a fault on purpose (kickout, screenout) exempts that code: logged at zero points
    const lessonExempt = s.lesson.id && !s.lesson.finished ? ((lessonById(s.lesson.id) || {}).exempt || []) : [];
    const deduct = (code, detail, pts) => {
      const staged = lessonExempt.includes(code);
      score = { ...score, deductions: [...score.deductions, { t, code, label: (DEDUCT[code] ? DEDUCT[code].label : detail) + (DEDUCT[code] && detail ? ': ' + detail : '') + (staged ? ' (staged by the lesson, no points)' : ''), pts: staged ? 0 : (pts ?? DEDUCT[code].pts) }] };
    };
    const WELL = wellParams(s);
    const fluid = fluidOf(s), prop = proppantOf(s);
    const totals = designTotals(s);
    const sleeve = s.setup.completion === 'sleeve';

    // Valve travel (two-position, finite travel time)
    let valves = s.valves; let moved = false;
    const nv = {};
    for (const id in valves) {
      const v = valves[id];
      if (v.pos !== v.target) {
        moved = true;
        const dir = Math.sign(v.target - v.pos);
        const pos = Math.max(0, Math.min(1, v.pos + dir * dt / VALVE_TRAVEL_S));
        nv[id] = { ...v, pos };
      } else nv[id] = v;
    }
    if (moved) { valves = nv; patch.valves = nv; }

    // Flow path open from pumps to the perforations?
    const pathOpen = valves.iso.pos > 0.99 && valves.zipIso.pos > 0.99 && valves.zipWork.pos > 0.99 && valves.crown.pos > 0.99 && valves.umv.pos > 0.99 && valves.lmv.pos > 0.99;
    const st = s.stages[s.stage];
    const q = s.pumpsOnline && !s.alarms.kickout ? s.pumpRate : 0;   // bpm
    const ppa = s.ppa;

    // Slurry density and hydrostatic (standard slurry density formula, illustrative inputs)
    const slurryPpg = (WELL.waterPpg + ppa) / (1 + ppa / WELL.sandSgPpg);
    const hydroPsi = 0.052 * slurryPpg * WELL.tvdFt;

    // Friction: pipe friction grows with rate to the 1.8 power and with the fluid system; perforation friction
    // with the square, reduced as more clusters (or sleeve ports) are open.
    const openClusters = Math.max(1, st ? st.clustersFired : 1);
    const pipeFric = 1150 * Math.pow(q / 90, 1.8) * fluid.fric;
    const perfFric = 900 * Math.pow(q / 90, 2) * (3 / openClusters);
    const frictionPsi = pipeFric + perfFric;

    // Net pressure: rises with fracture extent and with proppant fill; screenout drives it up fast.
    const alarms = { ...s.alarms };
    let stages = s.stages;
    let netPsi = s.netPsi;
    let surfacePsi = s.surfacePsi;
    const closurePsi = WELL.fracGradientPsiFt * WELL.tvdFt;
    let wl = s.wl;

    if (s.phase === 'frac' && st && st.perforated) {
      if (q > 0 && pathOpen) {
        // Fracture extension follows fluid pumped against the stage fluid design; the pack follows proppant pumped
        // against the stage proppant design (job time runs JOB_TIME_SCALE times faster than the clock).
        const dBbl = q * dt / 60 * JOB_TIME_SCALE;
        const dLb = q * 42 * ppa * dt / 60 * JOB_TIME_SCALE;
        const stageBbl = st.stageSlurryBbl + dBbl;
        const stageLb = st.stageProppantLb + dLb;
        const ext = Math.min(1, stageBbl / Math.max(1, totals.stageFluidBbl));
        const fill = Math.min(1, stageLb / Math.max(1, totals.stageProppantLb));
        // Screenout condition: concentration too high for the rate and the fluid's transport, or the pack is full and sand keeps coming
        const limitPpa = 2.5 * fluid.transport / prop.bridge;
        const over = stageLb / Math.max(1, totals.stageProppantLb);   // proppant pumped past the stage design packs the near-wellbore
        // an injected screenout holds until sand is off and the rate is up to flush
        const forced = s.events.active === 'screenout' && !(ppa === 0 && q >= 30);
        const screening = forced || (ppa > limitPpa && q < 45) || (ppa > limitPpa * 1.6) || (over >= 1.25 && ppa > 0.5);
        const targetNet = 250 + 550 * ext + 300 * fill + (screening ? 2500 : 0);
        netPsi += (targetNet - netPsi) * Math.min(1, dt * (screening ? 0.6 : 0.25));
        const wasComplete = st.fracComplete;
        // Height growth (Drop 33): the fracture reaches as high as net pressure has ever pushed it this stage
        const hgt = fracHeight(netPsi, viscosityFactor(fluid));
        const fracTop = Math.max(st.fracTop || TARGET_HALF, hgt.top), fracBot = Math.max(st.fracBot || TARGET_HALF, hgt.bot);
        const outOfZone = st.outOfZone || fracTop >= BARRIER_TOP;
        if (outOfZone && !st.outOfZone) { deduct('outOfZone', 'stage ' + (s.stage + 1) + ' at ' + Math.round(netPsi) + ' psi net'); get().addLog('Fracture height grew out of zone on stage ' + (s.stage + 1) + ': net pressure ' + Math.round(netPsi) + ' psi is above the upper barrier contrast. Fluid and sand are going into the sand above the target.'); }
        stages = stages.map((x, i) => i === s.stage ? { ...x, fracExtent: ext, proppantFill: fill, stageSlurryBbl: stageBbl, stageProppantLb: stageLb, fracComplete: ext >= 1 && fill >= 0.6, fracTop, fracBot, outOfZone } : x);
        if (!wasComplete && stages[s.stage].fracComplete) { const rec = score.stages[s.stage] || { stage: s.stage }; score = { ...score, stages: { ...score.stages, [s.stage]: { ...rec, fracEnd: t, placed: fill } } }; }
        if (screening && !alarms.screenout) { alarms.screenout = true; get().addLog('SCREENOUT: treating pressure ramping at constant rate. Cut sand and flush.'); }
        if (!screening && netPsi < 1500) alarms.screenout = false;
        patch.cumSlurryBbl = s.cumSlurryBbl + dBbl;
        patch.cumProppantLb = s.cumProppantLb + dLb;
      } else {
        netPsi += (0 - netPsi) * Math.min(1, dt * 0.15);
        alarms.screenout = false;
      }
    } else {
      netPsi += (0 - netPsi) * Math.min(1, dt * 0.3);
      alarms.screenout = false;
    }

    // Surface treating pressure
    let bhtpPsi = 0;
    const toePressuring = sleeve && s.phase === 'wireline' && wl.step === 'toe';
    // with a ball in flight the stage below is still open, so the well takes the pump-down fluid through it
    const injectingBelow = sleeve && s.phase === 'wireline' && (wl.step === 'launch' || wl.step === 'pumpdown') && s.stages.some(x => x.perforated);
    if (q > 0 && !pathOpen) {
      // Pumping into a closed valve: pressure climbs fast (fluid compressibility), pop-off lifts, pumps kick out.
      surfacePsi = Math.min(WELL.prvSetPsi + 400, surfacePsi + 900 * dt * Math.max(0.2, q / 30));
      if (surfacePsi >= WELL.maxTreatingPsi && !alarms.overpressure) { alarms.overpressure = true; get().addLog('OVERPRESSURE: pumping against a closed valve. Max treating pressure reached.'); }
      if (surfacePsi >= WELL.prvSetPsi && !alarms.prvLifted) { alarms.prvLifted = true; get().addLog('Pressure relief valve lifted on the missile.'); }
      if (surfacePsi >= WELL.maxTreatingPsi) { alarms.kickout = true; patch.pumpsOnline = false; get().addLog('Pumps kicked out at max pressure. Acknowledge and open the flow path before restarting.'); }
      bhtpPsi = closurePsi;
    } else if (q > 0 && pathOpen && st && st.perforated && s.phase === 'frac') {
      bhtpPsi = closurePsi + netPsi;
      const target = bhtpPsi + frictionPsi - hydroPsi;
      surfacePsi += (target - surfacePsi) * Math.min(1, dt * 1.5);
      if (surfacePsi >= WELL.maxTreatingPsi) { alarms.kickout = true; patch.pumpsOnline = false; get().addLog('Pumps kicked out at max treating pressure.'); }
    } else if (q > 0 && pathOpen && injectingBelow) {
      bhtpPsi = closurePsi + 150;
      const target = bhtpPsi + frictionPsi - hydroPsi;
      surfacePsi += (target - surfacePsi) * Math.min(1, dt * 1.5);
    } else if (q > 0 && pathOpen && !(st && st.perforated)) {
      // Pumping on an unperforated (or already isolated) wellbore: no exit, pressure climbs like a closed system.
      // With sleeves this is how the toe sleeve opens: the casing is pressured to the toe opening pressure.
      surfacePsi = Math.min(WELL.prvSetPsi + 400, surfacePsi + 600 * dt);
      if (toePressuring && surfacePsi >= WELL.toeOpenPsi) {
        stages = stages.map((x, i) => i === 0 ? { ...x, perforated: true, clustersFired: s.setup.clusters } : x);
        wl = { step: 'done', progress: 1 };
        surfacePsi *= 0.6;
        get().addLog('Toe sleeve opened at ' + WELL.toeOpenPsi.toLocaleString() + ' psi: pressure dropped as the ports opened.');
      } else if (surfacePsi >= WELL.maxTreatingPsi) {
        alarms.kickout = true; patch.pumpsOnline = false; alarms.overpressure = true;
        get().addLog(sleeve ? 'Sleeve not open: wellbore pressured up. Pumps kicked out.' : 'No open perforations: wellbore pressured up. Pumps kicked out.');
      }
      bhtpPsi = surfacePsi + hydroPsi;
    } else {
      // Shut in or bleeding: wellhead pressure relaxes toward static (closure minus hydrostatic of water), or to 0 on flowback
      const wellOpenToFlowback = valves.wingB.pos > 0.99 && (s.phase === 'flowback' || s.phase === 'drillout');
      const staticWhp = Math.max(0, closurePsi - 0.052 * WELL.waterPpg * WELL.tvdFt - 900);
      const target = wellOpenToFlowback ? staticWhp * (1 - s.fb.choke) * 0.35 : (s.stages.some(x => x.perforated) ? staticWhp : 0);
      surfacePsi += (target - surfacePsi) * Math.min(1, dt * 0.4);
      bhtpPsi = surfacePsi + hydroPsi;
    }

    // Scoring: alarm transitions this tick. Injected events do not count against the operator; the
    // recovery time does (below).
    if (alarms.kickout && !s.alarms.kickout) {
      const rec = score.stages[s.stage] || { stage: s.stage };
      score = { ...score, kickouts: score.kickouts + 1, stages: { ...score.stages, [s.stage]: { ...rec, kickouts: (rec.kickouts || 0) + 1 } } };
      if (s.events.active !== 'prvLift') deduct('kickout', 'stage ' + (s.stage + 1));
    }
    if ((alarms.overpressure && !s.alarms.overpressure) || (alarms.prvLifted && !s.alarms.prvLifted)) {
      if (!score.opEpisode) { score = { ...score, opEpisode: true, overpressures: score.overpressures + 1 }; if (s.events.active !== 'prvLift') deduct('overpressure', 'stage ' + (s.stage + 1)); }
    }
    if (!alarms.overpressure && !alarms.prvLifted && score.opEpisode) score = { ...score, opEpisode: false };
    if (alarms.screenout && !s.alarms.screenout) {
      score = { ...score, screenouts: score.screenouts + 1 };
      if (s.events.active !== 'screenout') deduct('screenout', 'stage ' + (s.stage + 1));
    }

    // Training events: sand delivery timer, random firing
    let events = s.events;
    if (events.active === 'screenout' && !alarms.screenout) events = { ...events, active: null };
    if (events.sandTimer > 0) {
      const left = events.sandTimer - dt;
      events = { ...events, sandTimer: Math.max(0, left), active: left <= 0 && events.active === 'sandOut' ? null : events.active };
      if (left <= 0) get().addLog('Sand delivery restored: conveyor running again.');
      else if (s.ppa > 0) patch.ppa = 0;
    }
    if (events.lightningTimer > 0) {
      const left = events.lightningTimer - dt;
      const offline = !s.pumpsOnline && (patch.pumpRate ?? s.pumpRate) === 0;
      if (offline && !events.lightningDown) events = { ...events, lightningDown: true };
      else if (!offline && events.lightningDown) { events = { ...events, lightningDown: false }; deduct('lightningHold', '', DEDUCT.lightningHold.pts); get().addLog('Pumps restarted during the lightning hold: the all clear has not been given.'); }
      events = { ...events, lightningTimer: Math.max(0, left), active: left <= 0 && events.active === 'lightning' ? null : events.active };
      if (left <= 0) { get().addLog('All clear: no strikes within 10 miles for the hold period. Crews back on the pad; resume.'); patch.ui = { ...s.ui, weather: 'overcast' }; }
    }
    if (events.random && !events.active && !events.misfireArmed && !a_any(s.alarms) && Math.random() < dt * 0.004) {
      const sleeve0 = s.setup.completion === 'sleeve';
      const pool = EVENTS.filter(e => e.phases.includes(s.phase) && !(e.pnpOnly && sleeve0) && !(e.id === 'stuck' && s.wl.step !== 'pumpdown') && !(e.id === 'sandOut' && s.ppa <= 0) && !(e.id === 'screenout' && !(q > 0)) && !(e.id === 'prvLift' && !(q > 0)));
      if (pool.length) { const pick = pool[Math.floor(Math.random() * pool.length)]; setTimeout(() => get().injectEvent(pick.id), 0); }
    }
    if (events !== s.events) patch.events = events;

    // Wireline or ball-drop sequence progression
    let lubricatorRigged = s.lubricatorRigged;
    if (s.phase === 'wireline' && wl.step === 'stuck') {
      // stuck: nothing moves until the line is worked
    } else if (s.phase === 'wireline' && wl.step === 'freeing') {
      const p = wl.progress + 0.35 * dt * (0.5 + 0.5 * Math.min(1, s.pumpRate / 20));
      if (p >= 1) { wl = { step: 'pumpdown', progress: Math.min(0.98, s.wl.progress) }; get().addLog('String free and moving again.'); patch.events = { ...events, active: null }; }
      else wl = { step: 'freeing', progress: p };
    } else if (s.phase === 'wireline' && wl.step !== 'idle' && wl.step !== 'done') {
      if (sleeve) {
        if (wl.step === 'launch') {
          const p = wl.progress + 1.2 * dt;
          wl = p >= 1 ? { step: 'pumpdown', progress: 0 } : { step: 'launch', progress: p };
        } else if (wl.step === 'pumpdown') {
          // the ball travels with the fluid: needs rate
          const p = wl.progress + 0.10 * dt * (0.2 + 0.8 * Math.min(1, q / 15));
          wl = p >= 1 ? { step: 'seat', progress: 0 } : { step: 'pumpdown', progress: p };
          if (p >= 1) get().addLog('Ball landed on seat ' + (s.stage + 1) + ': pressure spike as the sleeve shears open.');
        } else if (wl.step === 'seat') {
          const p = wl.progress + 0.5 * dt;
          surfacePsi += 900 * dt;   // the ball seats and the sleeve shears: short pressure spike
          if (p >= 1) {
            stages = stages.map((x, i) => i === s.stage ? { ...x, plugSet: true, perforated: true, clustersFired: s.setup.clusters } : x);
            wl = { step: 'done', progress: 1 };
            get().addLog('Sleeve ' + (s.stage + 1) + ' open; ball isolates the stages below. Keep pumping and swap to frac.');
          } else wl = { step: 'seat', progress: p };
        }
      } else {
        const pdRate = 0.12 * dt * (0.4 + 0.6 * Math.min(1, s.pumpRate / 20)); // pump-down needs rate from the pump-down pumps
        if (wl.step === 'pumpdown') {
          const p = wl.progress + Math.max(0.02 * dt, pdRate);
          wl = p >= 1 ? { step: 'setplug', progress: 0 } : { step: 'pumpdown', progress: p };
          if (p >= 1) get().addLog('Tool string at depth. Setting plug.');
        } else if (wl.step === 'setplug') {
          const p = wl.progress + 0.5 * dt;
          if (p >= 1) {
            stages = stages.map((x, i) => i === s.stage ? { ...x, plugSet: true } : x);
            wl = { step: 'armed', progress: 0 };
            get().addLog(st && st.plugSet ? 'Plug already set on this stage; guns armed for the missed clusters.' : 'Plug set toe-ward of the new perforations. Guns armed.');
          } else wl = { step: 'setplug', progress: p };
        } else if (wl.step === 'perforate') {
          const n = s.setup.clusters;
          const already = st ? st.clustersFired : 0;
          const p = wl.progress + 0.5 * dt;                              // the gun run takes about 2 s of job time: one cluster after another, toe first
          let fired = Math.max(already, Math.min(n, Math.floor(p * n) + 1));
          // an armed misfire leaves the last cluster (two on big stages) unfired
          const missing = events.misfireArmed ? (n >= 6 ? 2 : 1) : 0;
          if (missing && fired > n - missing) fired = n - missing;
          stages = stages.map((x, i) => i === s.stage ? { ...x, clustersFired: fired, perforated: fired >= 1 } : x);
          wl = p >= 1 ? { step: 'pooh', progress: 0 } : { step: 'perforate', progress: p };
          if (p >= 1) {
            if (missing) { get().addLog('MISFIRE: ' + missing + ' cluster' + (missing > 1 ? 's' : '') + ' did not fire. Pulling out of hole.'); events = { ...events, misfired: missing, misfireArmed: false }; patch.events = events; score = { ...score, open: { ...score.open, misfire: { at: t } } }; }
            else get().addLog('All clusters fired. Pulling out of hole.');
          }
        } else if (wl.step === 'pooh') {
          const p = wl.progress + 0.15 * dt;
          wl = p >= 1 ? { step: 'done', progress: 1 } : { step: 'pooh', progress: p };
          if (p >= 1) get().addLog(events.misfired > 0 ? 'Tool string in the lubricator. Inspect the guns, re-arm, and run again for the missed clusters.' : 'Tool string in the lubricator. Close swab valve, swap to frac.');
        }
      }
    }
    if (wl !== s.wl) patch.wl = wl;

    // Production hookup: the workover rig runs tubing joint by joint
    if (s.phase === 'production' && s.hookup.step === 'tubing' && s.hookup.progress < 1) {
      const p = Math.min(1, s.hookup.progress + 0.06 * dt);
      patch.hookup = { ...s.hookup, progress: p, joints: Math.round(p * 300) };
      if (p >= 1) get().addLog('Production tubing landed in the tubing hanger: 300 joints.');
    }

    // Drillout progression: coiled tubing runs to each plug (or ball seat) from the heel and mills it.
    // Dissolvable plugs or balls degrade on their own, toe first, with no coiled tubing in the hole.
    if (s.phase === 'drillout') {
      const count = stages.length;
      if (s.setup.plugs === 'dissolvable') {
        const next = stages.find(x => x.plugSet && !x.plugMilled);
        if (next) {
          const ct = { ...s.ct, milling: Math.min(1, s.ct.milling + 0.12 * dt), atPlug: next.index, progress: 0 };
          if (ct.milling >= 1) {
            stages = stages.map((x, i) => i === next.index ? { ...x, plugMilled: true } : x);
            ct.milling = 0;
            get().addLog((sleeve ? 'Ball and seat ' : 'Plug ') + (next.index + 1) + ' dissolved.');
          }
          patch.ct = ct;
        }
      } else {
        const plugs = stages.map((x, i) => ({ i, set: x.plugSet && !x.plugMilled })).filter(p => p.set);
        if (plugs.length) {
          // heel-most plug first: highest index that is set
          const target = plugs[plugs.length - 1].i;
          const targetProgress = (count - target) / count;  // fraction of lateral from heel
          let ct = { ...s.ct, atPlug: target };
          if (ct.progress < targetProgress - 0.001) {
            ct.progress = Math.min(targetProgress, ct.progress + 0.06 * dt);
          } else {
            ct.milling = Math.min(1, ct.milling + 0.25 * dt);
            if (ct.milling >= 1) {
              stages = stages.map((x, i) => i === target ? { ...x, plugMilled: true } : x);
              ct.milling = 0;
              get().addLog((sleeve ? 'Ball seat ' : 'Plug ') + (target + 1) + ' milled. Debris returning up the annulus.');
            }
          }
          patch.ct = ct;
        } else if (s.ct.progress > 0) {
          patch.ct = { ...s.ct, progress: Math.max(0, s.ct.progress - 0.08 * dt), atPlug: -1 };
        }
      }
    }

    if (s.phase === 'flowback' && valves.wingB.pos > 0.99) {
      patch.fb = { ...s.fb, cumBbl: s.fb.cumBbl + (8 * s.fb.choke) * dt / 60 * 10 };
    }

    // History for the chart (one sample per 0.5 s of sim time)
    let history = s.history;
    if (history.length === 0 || t - history[history.length - 1].t >= 0.5) {
      history = [...history, { t, p: surfacePsi, q, ppa }];
      if (history.length > 600) history = history.slice(history.length - 600);
      patch.history = history;
    }

    Object.assign(patch, { surfacePsi, bhtpPsi, hydroPsi, frictionPsi, netPsi, slurryPpg, alarms, stages, lubricatorRigged });

    // Time to recover: close the clock on any injected event whose recovery condition is now met
    const ev = patch.events || events;
    const stNow = stages[s.stage];
    for (const id in score.open) {
      const o = score.open[id];
      let resolved = false;
      if (id === 'stuck') resolved = wl.step !== 'stuck' && wl.step !== 'freeing';
      else if (id === 'valveFault') resolved = !ev.valveFault;
      else if (id === 'sandOut') resolved = ev.sandTimer <= 0 && (patch.ppa ?? s.ppa) > 0;
      else if (id === 'prvLift') resolved = !alarms.prvLifted && !alarms.overpressure && !alarms.kickout;
      else if (id === 'screenout') resolved = !alarms.screenout;
      else if (id === 'misfire') resolved = !!stNow && stNow.clustersFired >= s.setup.clusters;
      else if (id === 'lightning') resolved = !s.pumpsOnline && (patch.pumpRate ?? s.pumpRate) === 0;
      if (resolved) {
        const secs = t - o.at;
        const target = EVENT_TARGETS[id] || 60;
        const pts = Math.min(8, Math.ceil(Math.max(0, secs - target) / 15));
        const label = (EVENTS.find(e => e.id === id) || { label: id }).label;
        const open = { ...score.open }; delete open[id];
        score = { ...score, open, events: [...score.events, { id, label, at: o.at, secs, target, pts }] };
        if (pts > 0) deduct('slow', 'Slow recovery: ' + label.toLowerCase() + ' in ' + Math.round(secs) + ' s (target ' + target + ' s)', pts);
        get().addLog('Recovered from ' + label.toLowerCase() + ' in ' + Math.round(secs) + ' s (target ' + target + ' s' + (pts ? ', ' + pts + ' points off' : '') + ').');
      }
    }
    patch.score = score;

    // Guided lesson: advance through the checkpoints in order (a checkpoint stays met once met)
    if (s.lesson.id && !s.lesson.finished) {
      const L = lessonById(s.lesson.id);
      if (L) {
        const ns = { ...s, ...patch };
        const mask = L.steps.map((_, i) => !!s.lesson.doneMask[i]);
        let i = mask.indexOf(false); if (i < 0) i = mask.length;
        let changed = false;
        while (i < L.steps.length && L.steps[i].done(ns)) { mask[i] = true; changed = true; i++; }
        if (i >= L.steps.length) {
          const secs = t - s.lesson.startedAt;
          const base = scoreOf(score, { since: s.lesson.startedAt, exempt: L.exempt || [] });
          const over = Math.max(0, secs - L.targetSec);
          const timePts = Math.min(20, Math.ceil(over / (L.targetSec * 0.1)));
          const total = Math.max(0, base.total - timePts);
          const result = { score: total, grade: gradeOf(total), secs: Math.round(secs), targetSec: L.targetSec, timePts, deductions: base.deductions };
          patch.lesson = { ...s.lesson, doneMask: mask, finished: true, result };
          const entry = { id: L.id, n: L.n, title: L.title, score: total, grade: result.grade, secs: result.secs, targetSec: L.targetSec, when: Date.now() };
          patch.lessonResults = [...s.lessonResults, entry];
          postLessonResult(entry, { setup: ns.setup, pad: ns.pad, t: ns.t, phase: ns.phase, stages: ns.stages, score: ns.score, log: ns.log, events: ns.events, lesson: patch.lesson, when: Date.now() });
          get().addLog('Lesson ' + L.n + ' complete: ' + total + ' points, grade ' + result.grade + ', ' + result.secs + ' s (target ' + L.targetSec + ' s).');
        } else if (changed) patch.lesson = { ...s.lesson, doneMask: mask };
      }
    }
    set(patch);
  },
}));

// test hook: the headless checks fast-forward the simulation through this handle
if (typeof window !== 'undefined') window.__padworksSim = useSim;

// ---------------------------------------------------------------------------------------------
// Next steps: the ordered list of what still has to happen, in sequence, for the job to continue.
// Derived from state every render, so it always reflects the valves, alarms, and phase as they are.
// Each step: { text, done, valve? (store valve id to highlight), action? (store action name), label? }.
const open = (v) => v.pos > 0.99;
const closed = (v) => v.pos < 0.01;
export function nextSteps(s) {
  const v = s.valves;
  const st = s.stages[s.stage];
  const a = s.alarms;
  const WELL = wellParams(s);
  const sleeve = s.setup.completion === 'sleeve';
  const dissolvable = s.setup.plugs === 'dissolvable';
  const count = s.stages.length;
  const steps = [];
  const push = (text, done, extra = {}) => steps.push({ text, done: !!done, ...extra });
  const flowPath = () => {
    if (!sleeve) push('Swab valve closed (the inlet block sits below it)', closed(v.swab), { valve: 'swab' });
    push('Lower master open', open(v.lmv), { valve: 'lmv' });
    push('Upper master open', open(v.umv), { valve: 'umv' });
    push('Crown valve open', open(v.crown), { valve: 'crown' });
    push('Missile isolation valve open to the zipper header', open(v.iso), { valve: 'iso' });
    push('Zipper leg: lower isolation valve open', open(v.zipIso), { valve: 'zipIso' });
    push('Zipper leg: upper working valve open to the inlet block', open(v.zipWork), { valve: 'zipWork' });
  };
  const pathIsOpen = (sleeve || closed(v.swab)) && open(v.lmv) && open(v.umv) && open(v.crown) && open(v.iso) && open(v.zipIso) && open(v.zipWork);
  const openWord = sleeve ? 'open sleeve ports' : 'open perforations';

  if (s.phase === 'setup') {
    push('Pick the basin, pad size, tree, completion method, lateral design, fleet, proppant, and fluid in the setup panel', false);
    push('Start the job: rig up the frac stack', false, { action: 'start', label: 'Start the job' });
    return { blocked: false, title: 'Pad setup', steps };
  }

  // ---- blocked states first
  if (a.kickout) {
    push('Pumps are off. Bring the rate setpoint to zero so the restart is controlled', s.pumpRate === 0, { action: 'rateZero', label: 'Rate to 0' });
    push('Let the treating line bleed toward static (below ' + Math.round(WELL.maxTreatingPsi * 0.8).toLocaleString() + ' psi)', s.surfacePsi < WELL.maxTreatingPsi * 0.8);
    if (s.phase === 'frac' && st && !st.perforated) {
      push(sleeve ? 'This sleeve is not open: the well cannot take fluid. Drop the ball (or open the toe sleeve) first' : 'This stage has no open perforations: the well cannot take fluid. Swap to wireline and perforate first', false, { action: 'phaseWireline', label: sleeve ? 'Go to ball drop' : 'Go to wireline' });
    } else {
      flowPath();
    }
    push('Acknowledge the kickout', false, { action: 'ack', label: 'Acknowledge', gate: pathIsOpen || (st && !st.perforated) });
    push('Pumps online, then raise the rate in steps of 10 to 20 bpm', false);
    return { blocked: true, title: 'Pumps kicked out at maximum treating pressure', why: a.overpressure ? 'The flow path was closed while pumping.' : 'Treating pressure reached the kickout setting.', steps };
  }
  if (a.overpressure || a.prvLifted) {
    push('Rate to zero', s.pumpRate === 0, { action: 'rateZero', label: 'Rate to 0' });
    push('Pumps offline', !s.pumpsOnline, { action: 'pumpsOff', label: 'Pumps offline' });
    flowPath();
    push('Acknowledge the alarm' + (a.prvLifted ? ' (reset the relief valve)' : ''), false, { action: 'ack', label: 'Acknowledge' });
    return { blocked: true, title: a.prvLifted ? 'Pressure relief valve lifted' : 'Surface overpressure', why: 'Fluid was pumped against a closed valve.', steps };
  }
  if (a.screenout) {
    push('Cut proppant to 0 PPA', s.ppa === 0, { action: 'ppaZero', label: 'Sand off' });
    push('Hold or raise the rate to flush the near-wellbore (30 bpm or more)', s.pumpsOnline && s.pumpRate >= 30, { action: 'rateFlush', label: 'Rate 60 bpm' });
    push('Watch net pressure fall below 1,500 psi', s.netPsi < 1500);
    push('Acknowledge the screenout, then stage sand back in at a lower concentration', false, { action: 'ack', label: 'Acknowledge' });
    return { blocked: true, title: 'Screenout: pressure ramping at constant rate', why: (st && st.fracComplete ? 'The stage design was already placed and sand kept coming: the near-wellbore packed off. ' : '') + 'Too much proppant for the rate and fluid; the perforations or near-wellbore are packing off.', steps };
  }
  // ---- training events in progress
  if (s.phase === 'wireline' && (s.wl.step === 'stuck' || s.wl.step === 'freeing')) {
    push('String stopped in the lateral: do not pull to the weak point. Note line tension and depth', true);
    push('Pump-down rate up to 20 to 25 bpm to push the string', s.pumpRate >= 20, { action: 'rateLow', label: 'Rate 15 bpm' });
    push('Work the line: tension cycles within the safe pull while pumping', s.wl.step === 'freeing', { action: 'workLine', label: 'Work the line' });
    push('String free: continue the pump-down', false);
    return { blocked: true, title: 'Tool string stuck', why: 'The plug and guns stopped moving in the lateral (debris, a dogleg, or low pump-down rate).', steps };
  }
  if (!sleeve && s.phase === 'wireline' && s.wl.step === 'done' && st && st.perforated && st.clustersFired < s.setup.clusters) {
    const missed = s.setup.clusters - st.clustersFired;
    push('Tool string back in the lubricator: close the swab, bleed, and inspect the guns', true);
    push('Confirm the misfire: ' + missed + ' of ' + s.setup.clusters + ' clusters did not fire (surface pressure and gun inspection)', true);
    push('Re-dress and re-arm the guns for the missed cluster' + (missed > 1 ? 's' : '') + '; the plug is already set', true);
    push('Swab valve open, lubricator tested', open(v.swab), { valve: 'swab' });
    push('Run in hole again and fire the missed cluster' + (missed > 1 ? 's' : ''), false, { action: 'rerunGuns', label: 'Run guns again' });
    return { blocked: true, title: 'Gun misfire: ' + missed + ' cluster' + (missed > 1 ? 's' : '') + ' unfired', why: 'Pumping on a stage with missed clusters treats fewer entry points and risks a screenout.', steps };
  }
  if (s.events.valveFault && (s.phase === 'frac' || s.phase === 'wireline')) {
    push('Working valve does not respond: confirm at the control unit (no position change, no pressure on the actuator line)', true);
    push('Pumps offline, rate to zero until the leg can be operated', !s.pumpsOnline && s.pumpRate === 0, { action: 'stop', label: 'Stop pumping' });
    push('Check hydraulic supply and hoses; switch the leg to the backup circuit', false, { action: 'resetActuator', label: 'Backup circuit' });
    push('Cycle the valve and confirm position, then continue', false, { valve: 'zipWork' });
    return { blocked: true, title: 'Working valve actuator fault', why: 'Hydraulic supply lost or an actuator seal failed on the zipper working valve.', steps };
  }
  if (s.events.active === 'lightning') {
    push('Lightning within 10 miles: weather hold on the pad', true);
    push('Pumps offline and rate to zero', !s.pumpsOnline && s.pumpRate === 0, { action: 'stop', label: 'Stop pumping' });
    push('Crews off the pad; hold until the all clear (about ' + Math.ceil(s.events.lightningTimer) + ' s)', s.events.lightningTimer <= 0);
    return { blocked: true, title: 'Lightning hold', why: 'A strike inside the ten-mile ring. Nothing pumps and nobody works iron until the ring has been clear for the hold period.', steps };
  }
  if (s.events.active === 'sandOut' && s.phase === 'frac') {
    push('Sand delivery stopped: concentration is at zero. Do not shut down; keep the fracture open', true);
    push('Hold rate on clean fluid so the near-wellbore stays open', s.pumpsOnline && s.pumpRate >= 60, { action: 'rateFlush', label: 'Rate 60 bpm' });
    push('Restart the conveyor or switch to the second sand system (about ' + Math.ceil(s.events.sandTimer) + ' s)', s.events.sandTimer <= 0);
    push('Sand back in from 0.5 PPA and rebuild the schedule', false);
    return { blocked: true, title: 'Sand delivery interrupted', why: 'The conveyor or silo feed stopped mid-stage.', steps };
  }
  if (a.interlock) {
    const m = a.interlock;
    if (m.startsWith('Close the zipper')) { push('Close the zipper working valve', closed(v.zipWork), { valve: 'zipWork' }); push('Then open the swab valve', open(v.swab), { valve: 'swab' }); }
    else if (m.startsWith('Close the swab valve')) { push('Close the swab valve', closed(v.swab), { valve: 'swab' }); push('Then open the zipper leg', open(v.zipIso) && open(v.zipWork), { valve: !open(v.zipIso) ? 'zipIso' : 'zipWork' }); }
    else if (m.startsWith('Lower master')) { push('Pumps offline and rate to zero', !s.pumpsOnline && s.pumpRate === 0, { action: 'stop', label: 'Stop pumping' }); push('Bleed the tree below 500 psi', s.surfacePsi <= 500); push('Then cycle the lower master', false, { valve: 'lmv' }); }
    else if (m.startsWith('Crown valve')) { push('Pumps offline and rate to zero', !s.pumpsOnline && s.pumpRate === 0, { action: 'stop', label: 'Stop pumping' }); push('Bleed the inlet block below 500 psi', s.surfacePsi <= 500); push('Then close the crown valve', false, { valve: 'crown' }); }
    else if (m.startsWith('Missile isolation')) { push('Pumps offline and rate to zero', !s.pumpsOnline && s.pumpRate === 0, { action: 'stop', label: 'Stop pumping' }); push('Then close the missile isolation valve', false, { valve: 'iso' }); }
    else if (m.startsWith('Swab, crown')) { push('Lower master open', open(v.lmv), { valve: 'lmv' }); push('Upper master open', open(v.umv), { valve: 'umv' }); push('Crown valve open', open(v.crown), { valve: 'crown' }); push('Zipper working valve closed', closed(v.zipWork), { valve: 'zipWork' }); push('Swab valve open', open(v.swab), { valve: 'swab' }); push('Then run in hole', false, { action: 'run', label: 'Run in hole' }); }
    else if (m.startsWith('Masters, crown')) { flowPath(); push('Then release the ball', false, { action: 'run', label: 'Release ball' }); }
    else if (m.startsWith('Open the swab valve to the ball')) { push('Swab valve open to the ball launcher', open(v.swab), { valve: 'swab' }); push('Then release the ball', false, { action: 'run', label: 'Release ball' }); }
    else if (m.startsWith('Ball drop needs flow')) { push('Pumps online at 10 to 20 bpm', s.pumpsOnline && s.pumpRate >= 5, { action: 'rateLow', label: 'Pumps on, 15 bpm' }); push('Then release the ball', false, { action: 'run', label: 'Release ball' }); }
    else push(m, false);
    return { blocked: true, title: 'Interlock', why: m, steps };
  }

  // ---- phase gates
  if (s.phase === 'rigup') {
    push(sleeve ? 'Frac stack rigged and tested with the ball launcher on top. Open the toe sleeve first' : 'Frac stack rigged and tested. Start the first wireline run', false, { action: 'phaseWireline', label: sleeve ? 'Next: Toe sleeve' : 'Next: Wireline' });
    return { blocked: false, title: 'Ready to start', steps };
  }
  if (s.phase === 'wireline') {
    if (st && st.perforated && s.wl.step === 'idle') {
      push('Stage ' + (s.stage + 1) + (sleeve ? ' sleeve is already open. Swap to frac' : ' is already perforated. Swap to frac'), false, { action: 'phaseFrac', label: 'Swap to frac' });
      return { blocked: false, title: sleeve ? 'Ball drop' : 'Wireline', steps };
    }
    if (sleeve) {
      if (s.wl.step === 'idle') {
        flowPath();
        if (s.stage === 0) {
          push('Pumps online at a low rate to pressure the casing (toe sleeve opens at ' + WELL.toeOpenPsi.toLocaleString() + ' psi)', s.pumpsOnline && s.pumpRate >= 5, { action: 'rateLow', label: 'Pumps on, 15 bpm' });
          push('Pressure up on the toe sleeve', false, { action: 'run', label: 'Pressure up' });
        } else {
          push('Swab valve open to the ball launcher', open(v.swab), { valve: 'swab' });
          push('Pumps online at 10 to 20 bpm so the ball travels', s.pumpsOnline && s.pumpRate >= 5, { action: 'rateLow', label: 'Pumps on, 15 bpm' });
          push('Release ball ' + s.stage + ' (next larger size) from the launcher', false, { action: 'run', label: 'Release ball' });
        }
      } else if (s.wl.step === 'toe') { push('Pressuring the casing: watch for the drop when the toe ports open', false); }
      else if (s.wl.step === 'launch') { push('Ball entering the flow stream', false); }
      else if (s.wl.step === 'pumpdown') { push('Ball traveling down the casing: hold 10 to 20 bpm', s.pumpRate >= 10); push('Ball lands on its seat and shifts the sleeve', false); }
      else if (s.wl.step === 'seat') { push('Ball on seat: pressure spike, sleeve shears open', false); }
      else if (s.wl.step === 'done') { push((s.stage === 0 ? 'Toe sleeve open. ' : 'Sleeve ' + (s.stage + 1) + ' open. ') + 'Keep the rate up and swap to frac', false, { action: 'phaseFrac', label: 'Swap to frac' }); }
      return { blocked: false, title: (s.stage === 0 ? 'Toe sleeve: stage 1' : 'Ball drop: stage ' + (s.stage + 1)), steps };
    }
    if (s.wl.step === 'idle') {
      push('Zipper working valve closed', closed(v.zipWork), { valve: 'zipWork' });
      push('Lower master, upper master, and crown open', open(v.lmv) && open(v.umv) && open(v.crown), { valve: !open(v.lmv) ? 'lmv' : !open(v.umv) ? 'umv' : 'crown' });
      push('Swab valve open (lubricator tested)', open(v.swab), { valve: 'swab' });
      push('Run in hole', false, { action: 'run', label: 'Run in hole' });
      push('Set pump-down rate 15 to 25 bpm once the string is in the lateral', s.pumpRate >= 10);
    } else if (s.wl.step === 'pumpdown') {
      push('Pumping down: hold 15 to 25 bpm and watch tension', s.pumpRate >= 10);
      push('Plug sets at depth automatically', false);
    } else if (s.wl.step === 'setplug') { push('Setting the plug', false); }
    else if (s.wl.step === 'armed') { push('Plug set. Fire the guns bottom-up', false, { action: 'fire', label: 'Fire guns' }); }
    else if (s.wl.step === 'perforate') { push('Firing clusters', false); }
    else if (s.wl.step === 'pooh') { push('Pulling out of hole to the lubricator', false); }
    else if (s.wl.step === 'done') { push('Tool string in the lubricator. Close the swab, rig down, swap to frac', false, { action: 'phaseFrac', label: 'Swap to frac' }); }
    return { blocked: false, title: 'Wireline: stage ' + (s.stage + 1), steps };
  }
  if (s.phase === 'frac') {
    if (st && !st.perforated) {
      push('Stage ' + (s.stage + 1) + ' has no ' + openWord + '. ' + (sleeve ? 'Drop the ball first' : 'Run wireline first'), false, { action: 'phaseWireline', label: sleeve ? 'Go to ball drop' : 'Go to wireline' });
      return { blocked: true, title: 'Nothing to pump into', why: sleeve ? 'This sleeve is still closed.' : 'No perforations on this stage.', steps };
    }
    if (st && st.fracComplete) {
      push('Design proppant placed: sand off and flush the wellbore clean', s.ppa === 0, { action: 'ppaZero', label: 'Sand off' });
      if (s.stages.every(x => x.fracComplete)) push('All stages complete. ' + (dissolvable ? 'Shut in and let the ' + (sleeve ? 'balls and seats' : 'plugs') + ' dissolve' : 'Rig up coiled tubing for the ' + (sleeve ? 'seat mill-out' : 'drillout')), false, { action: 'phaseDrillout', label: dissolvable ? 'Shut in: dissolve' : 'Rig up coiled tubing' });
      else push('Stage ' + (s.stage + 1) + ' complete. Advance and ' + (sleeve ? 'drop the next ball' : 'run the next wireline'), false, { action: 'nextStage', label: sleeve ? 'Next stage: ball drop' : 'Next stage: wireline' });
      return { blocked: false, title: 'Stage complete', steps };
    }
    flowPath();
    push('Pumps online', s.pumpsOnline, { action: 'pumpsOn', label: 'Pumps online' });
    push('Bring the rate up in steps to 80 to 100 bpm', s.pumpsOnline && s.pumpRate >= 60);
    push('Add proppant 0.5 to 2 PPA and hold rate; watch for a pressure ramp', s.ppa > 0 && st && st.proppantFill > 0.05);
    push('Fracture extends and the pack fills; the stage completes on its own', false);
    return { blocked: false, title: 'Frac: stage ' + (s.stage + 1), steps };
  }
  if (s.phase === 'drillout') {
    const left = s.stages.filter(x => x.plugSet && !x.plugMilled).length;
    if (dissolvable) {
      push('Zipper leg closed, well shut in on the tree', closed(v.zipWork) && closed(v.zipIso), { valve: !closed(v.zipWork) ? 'zipWork' : 'zipIso' });
      push(left ? (sleeve ? 'Balls and seats' : 'Plugs') + ' dissolving in the wellbore fluid: ' + left + ' left' : 'All dissolved', left === 0);
      if (left === 0) push('Open wing B and go to flowback', false, { action: 'phaseFlowback', label: 'Flowback' });
      return { blocked: false, title: 'Dissolve', steps };
    }
    push('Zipper leg closed', closed(v.zipWork) && closed(v.zipIso), { valve: !closed(v.zipWork) ? 'zipWork' : 'zipIso' });
    push('Swab valve open for the coiled tubing stack', open(v.swab), { valve: 'swab' });
    push('Wing B open to the flowback spread for returns', open(v.wingB), { valve: 'wingB' });
    push(left ? 'Milling ' + (sleeve ? 'ball seats' : 'plugs') + ' heel to toe: ' + left + ' left' : 'All ' + (sleeve ? 'seats' : 'plugs') + ' milled', left === 0);
    if (left === 0) push('Pull out and swap to flowback', false, { action: 'phaseFlowback', label: 'Flowback' });
    return { blocked: false, title: sleeve ? 'Coiled tubing seat mill-out' : 'Coiled tubing drillout', steps };
  }
  if (s.phase === 'flowback') {
    push('Swab closed, zipper leg closed', closed(v.swab) && closed(v.zipWork), { valve: !closed(v.swab) ? 'swab' : 'zipWork' });
    push('Wing B open to the flowback spread', open(v.wingB), { valve: 'wingB' });
    push('Open the choke in steps and watch the rate and sand returns', s.fb.choke > 0.35);
    push('Well cleaned up: hand over to production', s.fb.cumBbl > 200, { action: 'phaseProduction', label: 'Production hookup' });
    return { blocked: false, title: 'Flowback and well test', steps };
  }
  const lift = liftOf(s);
  const h = s.hookup;
  if (h.step !== 'done') {
    push('Frac stack off, workover rig over the well, BOP stack nippled up and tested on the tubing head', h.step !== 'rig', { action: 'hookupNext', label: 'Rig up' });
    push('Run the production tubing with the packer, nipples, and lift hardware; land it in the tubing hanger' + (h.step === 'tubing' ? ' (' + h.joints + ' of 300 joints)' : ''), h.step === 'tree' || h.step === 'done', h.step === 'tubing' ? { action: 'hookupNext', label: h.progress >= 1 ? 'Nipple down' : 'Running tubing', gate: h.progress >= 1 } : {});
    push('Nipple down the BOP stack; install and test the production tree', h.step === 'done', h.step === 'tree' ? { action: 'hookupNext', label: 'Install the tree' } : {});
    push('Hook up the flowline and ' + (lift.id === 'flow' ? 'open the well on the choke' : 'commission the ' + lift.label.toLowerCase()), false);
    return { blocked: false, title: 'Production hookup', steps };
  }
  push(lift.id === 'flow' ? 'Production tree and flowline hooked up; the well flows on reservoir pressure through the choke' : 'Production tree hooked up; ' + lift.label.toLowerCase() + ' installed and running', true);
  push('Job complete. Back to setup to run another pad', false, { action: 'reset', label: 'Back to setup' });
  return { blocked: false, title: 'On production: ' + lift.label.toLowerCase(), steps };
}
