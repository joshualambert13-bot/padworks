// Guided lessons: scripted sequences over the simulator with sequential checkpoints.
// Each lesson sets up the pad, prepares the job state, and lists checkpoints in order. Only the first
// unfinished checkpoint is evaluated each tick, so the operator has to do things in sequence; once a
// checkpoint is met it stays met. Points come off for wrong valve moves, interlock rejections, kickouts,
// screenouts, and for running past the lesson's time target (see scoreOf in store.js).
// Nothing here is a procedure for a real job: it is a training sequence over a schematic model.

const open = (v) => v.pos > 0.99;
const closed = (v) => v.pos < 0.01;
const pathOpen = (s) => open(s.valves.iso) && open(s.valves.zipIso) && open(s.valves.zipWork) && open(s.valves.crown) && open(s.valves.umv) && open(s.valves.lmv);
const firstClosed = (ids) => (s) => ids.find(id => !open(s.valves[id])) || ids[0];
const cur = (s) => s.stages[s.stage] || {};

// Snap every valve to its commanded position (used by lesson prep so the job starts in a settled state)
const snapValves = (set) => set(s => { const valves = {}; for (const id in s.valves) valves[id] = { ...s.valves[id], pos: s.valves[id].target }; return { valves }; });
// Mark stages 0..n-1 as perforated, plugged, and (optionally) fracked and milled
const finishStages = (set, n, opts = {}) => set(s => ({
  stages: s.stages.map((x, i) => i < n ? { ...x, perforated: true, plugSet: true, clustersFired: s.setup.clusters, fracExtent: opts.frac ? 1 : x.fracExtent, proppantFill: opts.frac ? 1 : x.proppantFill, fracComplete: !!opts.frac, plugMilled: !!opts.milled } : x),
}));
const stageOneOpenAndFrac = (get, set) => {
  get().setPhase('wireline');
  finishStages(set, 1);
  set({ wl: { step: 'done', progress: 1 } });
  get().setPhase('frac');
  snapValves(set);
};
const pumpingOnStageOne = (get, set) => {
  stageOneOpenAndFrac(get, set);
  set(s => ({ valves: { ...s.valves, zipWork: { ...s.valves.zipWork, pos: 1, target: 1 } }, pumpsOnline: true, pumpRate: 80, ppa: 1.0 }));
};

export const LESSONS = [
  {
    id: 'L1', n: 1, title: 'First wireline run', targetSec: 150,
    blurb: 'Open the tree in the right order, pump the plug and guns down, perforate stage 1, and hand the well to the frac crew.',
    setup: { basin: 'permian-delaware' }, pad: { wells: 2, mode: 'zipper' },
    steps: [
      { text: 'Go to the wireline phase', hint: 'The frac stack is rigged and tested. Wireline runs first on a plug-and-perf well.', done: s => s.phase === 'wireline', action: 'phaseWireline', label: 'Next: Wireline' },
      { text: 'Zipper working valve closed', hint: 'The lubricator sits above the swab valve; the treating line must be isolated from the tree before the swab opens.', done: s => closed(s.valves.zipWork), valve: 'zipWork' },
      { text: 'Lower master, upper master, and crown open', hint: 'The tool string passes through all three on its way into the well.', done: s => open(s.valves.lmv) && open(s.valves.umv) && open(s.valves.crown), valve: firstClosed(['lmv', 'umv', 'crown']) },
      { text: 'Swab valve open (lubricator tested)', hint: 'The swab is the last valve between the lubricator and the well bore.', done: s => open(s.valves.swab), valve: 'swab' },
      { text: 'Run in hole', hint: 'The string falls under its own weight in the vertical, then needs pump-down rate to move along the lateral.', done: s => s.wl.step !== 'idle', action: 'run', label: 'Run in hole' },
      { text: 'Pump-down rate 15 to 25 bpm', hint: 'Too slow and the string stalls in the lateral; too fast and you risk the weak point.', done: s => s.pumpRate >= 15 && s.pumpRate <= 25 },
      { text: 'Plug set at depth', hint: 'The setting tool fires when the string reaches depth. Nothing to do but hold rate.', done: s => cur(s).plugSet },
      { text: 'Fire the guns bottom-up', hint: 'Clusters fire from the toe-most up so the string is never below fresh perforations.', done: s => cur(s).clustersFired > 0, action: 'fire', label: 'Fire guns' },
      { text: 'Pull out of hole to the lubricator', hint: 'Line speed is limited by the pressure control equipment; wait for the string to be back in the lubricator.', done: s => s.wl.step === 'done' },
      { text: 'Swap to frac: swab closed, lubricator rigged down', hint: 'Once the swab is closed the frac crew can open the zipper leg to the inlet block.', done: s => s.phase === 'frac', action: 'phaseFrac', label: 'Swap to frac' },
    ],
  },
  {
    id: 'L2', n: 2, title: 'Pump stage 1', targetSec: 300,
    blurb: 'Open the flow path from the missile to the perforations, bring the rate up in steps, place the stage design, sand off, and advance.',
    setup: { basin: 'permian-delaware' }, pad: { wells: 2, mode: 'zipper' },
    prep: stageOneOpenAndFrac,
    steps: [
      { text: 'Zipper working valve open to the inlet block', hint: 'The swab is closed and the lubricator is down, so the leg can open. The lower isolation valve is already open.', done: s => open(s.valves.zipWork), valve: 'zipWork' },
      { text: 'Pumps online', hint: 'Pumps come online at zero rate; the missile pressures up against the open path.', done: s => s.pumpsOnline, action: 'pumpsOn', label: 'Pumps online' },
      { text: 'Bring the rate up in steps to 80 bpm or more', hint: 'Raise the slurry rate 10 to 20 bpm at a time and watch surface treating pressure against the kickout line.', done: s => s.pumpsOnline && s.pumpRate >= 80 },
      { text: 'Add proppant at 0.5 to 1.5 PPA', hint: 'Slickwater carries sand by velocity: keep the rate up while the concentration climbs. This design averages about 1.2 PPA (2,000 lb/ft in 40 bbl/ft); much above that and the sand lands ahead of the fluid.', done: s => s.ppa >= 0.5 && s.ppa <= 1.5 },
      { text: 'Hold until the stage design is placed', hint: 'Watch the fracture extend and the pack fill in the downhole view; the stage completes on its own. Sand pumped past the design at any concentration packs the near-wellbore.', done: s => cur(s).fracComplete },
      { text: 'Sand off: proppant to 0 PPA', hint: 'Pumping sand past the design packs off the near-wellbore. Cut sand and flush the wellbore clean.', done: s => s.ppa === 0, action: 'ppaZero', label: 'Sand off' },
      { text: 'Advance to the next stage', hint: 'Wireline takes the well back for the next plug and guns.', done: s => s.stage >= 1, action: 'nextStage', label: 'Next stage: wireline' },
    ],
  },
  {
    id: 'L3', n: 3, title: 'Kickout recovery', targetSec: 120, exempt: ['kickout', 'overpressure'],
    blurb: 'A valve closes on the flow path while you are pumping. Recover in the right order: rate down, bleed, open the path, acknowledge, restart.',
    setup: { basin: 'permian-delaware' }, pad: { wells: 2, mode: 'zipper' },
    prep: (get, set) => {
      pumpingOnStageOne(get, set);
      set(s => ({ valves: { ...s.valves, zipWork: { ...s.valves.zipWork, target: 0 } } }));
      get().addLog('LESSON: the zipper working valve on this leg was closed by mistake while pumping.');
    },
    steps: [
      { text: 'Pumps kicked out: read the alarm and the stopped-job card', hint: 'Pressure spiked against a closed valve and the pumps tripped at the kickout setting.', done: s => s.alarms.kickout || s.score.kickouts > 0 },
      { text: 'Rate setpoint to zero', hint: 'A controlled restart starts from zero, not from the rate the pumps tripped at.', done: s => s.pumpRate === 0, action: 'rateZero', label: 'Rate to 0' },
      { text: 'Let the treating line bleed toward static', hint: 'Watch surface pressure fall below 80 percent of the kickout setting.', done: s => s.surfacePsi < 0.8 * (s.pad.bore.endsWith('15K') ? 12500 : 9000) },
      { text: 'Find the closed valve and reopen the flow path', hint: 'The valve rows show which valve moved. The path is missile, isolation valve, zipper leg, crown, masters.', done: s => pathOpen(s), valve: firstClosed(['iso', 'zipIso', 'zipWork', 'crown', 'umv', 'lmv']) },
      { text: 'Acknowledge the kickout', hint: 'The acknowledge clears the trip once the path is open.', done: s => !s.alarms.kickout, action: 'ack', label: 'Acknowledge' },
      { text: 'Pumps online', done: s => s.pumpsOnline, action: 'pumpsOn', label: 'Pumps online' },
      { text: 'Bring the rate back in steps to 80 bpm', hint: 'Same discipline as the first ramp: steps of 10 to 20 bpm.', done: s => s.pumpsOnline && s.pumpRate >= 80 },
      { text: 'Sand back in at 0.5 PPA', hint: 'Rebuild the schedule from a low concentration; the near-wellbore may have partly packed during the trip.', done: s => s.ppa >= 0.5 },
    ],
  },
  {
    id: 'L4', n: 4, title: 'Screenout', targetSec: 360, exempt: ['screenout', 'outOfZone'],
    blurb: 'Cause a screenout on purpose, then recover: sand off, flush, watch net pressure fall, and stage sand back in lower.',
    setup: { basin: 'permian-delaware' }, pad: { wells: 2, mode: 'zipper' },
    prep: pumpingOnStageOne,
    steps: [
      { text: 'Drop the rate to 40 bpm and raise proppant to 3.5 PPA', hint: 'Slickwater carries sand by velocity. Too much sand at low rate bridges in the perforations and the near-wellbore packs off.', done: s => s.alarms.screenout },
      { text: 'Screenout: pressure ramping at constant rate. Cut sand to 0 PPA', hint: 'Every second of sand now adds to the pack.', done: s => s.ppa === 0, action: 'ppaZero', label: 'Sand off' },
      { text: 'Raise the rate to 60 bpm or more to flush', hint: 'Clean fluid at rate erodes the pack and carries the sand into the fracture.', done: s => s.pumpsOnline && s.pumpRate >= 60, action: 'rateFlush', label: 'Rate 60 bpm' },
      { text: 'Net pressure falls below 1,500 psi', hint: 'Watch the net pressure readout; the screenout alarm clears when the near-wellbore opens back up.', done: s => s.netPsi < 1500 && !s.alarms.screenout },
      { text: 'Sand back in at no more than 1 PPA with the rate held', hint: 'Rebuild the schedule from a low concentration.', done: s => s.ppa > 0 && s.ppa <= 1 && s.pumpRate >= 60 },
      { text: 'Place the stage design', hint: 'Hold rate and concentration until the stage completes.', done: s => cur(s).fracComplete },
    ],
  },
  {
    id: 'L5', n: 5, title: 'Toe sleeve and ball drop', targetSec: 480,
    blurb: 'An openhole sliding sleeve well: open the toe sleeve on pressure, pump stage 1, then drop the first ball and shift sleeve 2.',
    setup: { basin: 'bakken', completion: 'sleeve', sleeveSystem: 'openhole', plugs: 'dissolvable' }, pad: { wells: 2, mode: 'zipper', bore: '5-15K' },
    steps: [
      { text: 'Go to the toe sleeve step', hint: 'No wireline on this well: the ball launcher sits on the tree and the toe sleeve opens on casing pressure.', done: s => s.phase === 'wireline', action: 'phaseWireline', label: 'Next: Toe sleeve' },
      { text: 'Flow path open from the missile to the tree', hint: 'The casing is pressured through the treating line, so the zipper leg, crown, and masters must all be open.', done: s => pathOpen(s), valve: firstClosed(['iso', 'zipIso', 'zipWork', 'crown', 'umv', 'lmv']) },
      { text: 'Pumps online at 10 to 20 bpm', hint: 'A low rate: the casing is a closed system until the toe ports open.', done: s => s.pumpsOnline && s.pumpRate >= 10 && s.pumpRate <= 20, action: 'rateLow', label: 'Pumps on, 15 bpm' },
      { text: 'Pressure up on the toe sleeve', hint: 'Watch for the pressure drop when the ports open.', done: s => s.wl.step === 'toe' || s.stages[0].perforated, action: 'run', label: 'Pressure up' },
      { text: 'Toe sleeve open', done: s => s.stages[0].perforated },
      { text: 'Swap to frac', hint: 'Keep pumping: there is no wireline to rig down.', done: s => s.phase === 'frac', action: 'phaseFrac', label: 'Swap to frac' },
      { text: 'Pump stage 1: 60 bpm or more at about 1 PPA until the design is placed', hint: 'This design is lean on sand (1,200 lb/ft in 25 bbl/ft, about 1.1 PPA on average): above 1.2 PPA the sand lands ahead of the fluid and the near-wellbore packs off. Fewer entry points than a perforated stage, so watch the pressure.', done: s => s.stages[0].fracComplete },
      { text: 'Sand off and advance to stage 2', hint: 'The next sleeve opens with a ball.', done: s => s.stage >= 1, action: 'nextStage', label: 'Next stage: ball drop' },
      { text: 'Swab valve open to the ball launcher', hint: 'The launcher is above the swab; the ball enters the flow stream through it.', done: s => open(s.valves.swab), valve: 'swab' },
      { text: 'Pumps online at 10 to 20 bpm so the ball travels', done: s => s.pumpsOnline && s.pumpRate >= 5 && s.pumpRate <= 20, action: 'rateLow', label: 'Pumps on, 15 bpm' },
      { text: 'Release ball 1 from the launcher', hint: 'Balls go smallest first; each seat is a little larger than the one below.', done: s => s.ballsDropped >= 1, action: 'run', label: 'Release ball' },
      { text: 'Ball on seat: sleeve 2 shifts open', hint: 'Pressure spikes as the ball lands and the shear screws let go.', done: s => s.stages[1].perforated },
      { text: 'Swap to frac for stage 2', done: s => s.phase === 'frac' && s.stage === 1, action: 'phaseFrac', label: 'Swap to frac' },
    ],
  },
  {
    id: 'L6', n: 6, title: 'Stuck tool string', targetSec: 120,
    blurb: 'The pump-down string stops in the lateral. Free it without pulling to the weak point, then finish the run.',
    setup: { basin: 'permian-delaware' }, pad: { wells: 2, mode: 'zipper' },
    prep: (get, set) => {
      get().setPhase('wireline');
      snapValves(set);
      set({ wl: { step: 'pumpdown', progress: 0.4 }, pumpRate: 20 });
      get().injectEvent('stuck');
    },
    steps: [
      { text: 'String stopped: hold the pump-down rate at 20 to 25 bpm', hint: 'Rate pushes on the string; do not pull toward the weak point.', done: s => s.pumpRate >= 20 && s.pumpRate <= 25 },
      { text: 'Work the line: tension cycles within the safe pull', done: s => s.wl.step === 'freeing' || s.wl.step === 'setplug' || s.wl.step === 'armed', action: 'workLine', label: 'Work the line' },
      { text: 'String free and moving again', hint: 'Keep the rate on until the plug reaches depth.', done: s => s.wl.step === 'pumpdown' || s.wl.step === 'setplug' || s.wl.step === 'armed' },
      { text: 'Plug set at depth', done: s => cur(s).plugSet },
      { text: 'Fire the guns', done: s => cur(s).clustersFired > 0, action: 'fire', label: 'Fire guns' },
      { text: 'Pull out of hole to the lubricator', done: s => s.wl.step === 'done' },
    ],
  },
  {
    id: 'L7', n: 7, title: 'Drillout and flowback', targetSec: 420,
    blurb: 'All stages are pumped. Mill the plugs out with coiled tubing, then flow the well back through the choke.',
    setup: { basin: 'permian-delaware' }, pad: { wells: 2, mode: 'zipper' },
    prep: (get, set) => {
      finishStages(set, 99, { frac: true });
      get().setPhase('drillout');
      snapValves(set);
    },
    steps: [
      { text: 'Zipper leg closed: the frac crew is off this well', done: s => closed(s.valves.zipWork) && closed(s.valves.zipIso), valve: s => !closed(s.valves.zipWork) ? 'zipWork' : 'zipIso' },
      { text: 'Swab valve open for the coiled tubing stack', done: s => open(s.valves.swab), valve: 'swab' },
      { text: 'Wing B open to the flowback spread for returns', hint: 'Cuttings and debris return up the annulus to the flowback equipment.', done: s => open(s.valves.wingB), valve: 'wingB' },
      { text: 'Mill the plugs heel to toe', hint: 'The coil runs to the heel-most plug first; each plug takes a few minutes of job time.', done: s => s.stages.every(x => x.plugMilled) },
      { text: 'Pull out and swap to flowback', done: s => s.phase === 'flowback', action: 'phaseFlowback', label: 'Flowback' },
      { text: 'Open the choke in steps past 32/64 in.', hint: 'Step the choke open and watch the rate and the sand returns.', done: s => s.fb.choke > 0.5 },
      { text: 'Flow back 200 bbl', hint: 'The well cleans up as load water and sand return.', done: s => s.fb.cumBbl >= 200 },
      { text: 'Hand over to production', done: s => s.phase === 'production', action: 'phaseProduction', label: 'Production hookup' },
    ],
  },
  {
    id: 'L8', n: 8, title: 'Production hookup', targetSec: 90,
    blurb: 'Frac stack off: rig up the workover rig and BOP stack, run the tubing with the lift hardware, land it, and install the production tree.',
    setup: { basin: 'permian-midland', lift: 'rodpump' }, pad: { wells: 2, mode: 'zipper' },
    prep: (get, set) => {
      finishStages(set, 99, { frac: true, milled: true });
      get().setPhase('production');
      snapValves(set);
    },
    steps: [
      { text: 'Workover rig over the well; BOP stack nippled up and tested on the tubing head', hint: 'The frac stack is gone: the BOP stack is the pressure control while tubing runs.', done: s => s.hookup.step !== 'rig', action: 'hookupNext', label: 'Rig up' },
      { text: 'Run the production tubing and land it in the tubing hanger', hint: 'Joint by joint through the annular. The rod pump and seating nipple go in with the string.', done: s => s.hookup.progress >= 1 },
      { text: 'Nipple down the BOP stack', done: s => s.hookup.step === 'tree' || s.hookup.step === 'done', action: 'hookupNext', label: 'Nipple down' },
      { text: 'Install and test the production tree; commission the lift', done: s => s.hookup.step === 'done', action: 'hookupNext', label: 'Install the tree' },
    ],
  },
];

export function lessonById(id) { return LESSONS.find(l => l.id === id) || null; }
export function nextLessonId(id) { const i = LESSONS.findIndex(l => l.id === id); return i >= 0 && i < LESSONS.length - 1 ? LESSONS[i + 1].id : null; }
export function stepValve(step, s) { return typeof step.valve === 'function' ? step.valve(s) : step.valve || null; }
