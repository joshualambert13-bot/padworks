// Simulation state and the illustrative response model.
// Everything here is simplified motion and illustrative curves. It is not a
// hydraulic fracturing simulator and must be labeled as such in the UI.
import { create } from 'zustand';

export const PHASES = [
  { id: 'rigup', label: 'Frac stack rig-up', short: 'Rig-up' },
  { id: 'wireline', label: 'Wireline: pump-down, set plug, perforate', short: 'Wireline' },
  { id: 'frac', label: 'Hydraulic fracturing', short: 'Frac' },
  { id: 'drillout', label: 'Coiled tubing drillout', short: 'Drillout' },
  { id: 'flowback', label: 'Flowback and well test', short: 'Flowback' },
  { id: 'production', label: 'Production hookup', short: 'Production' },
];

export const STAGE_COUNT = 5;          // demo lateral: five stages, three clusters each

// Pad configuration: how many wells share the pad and how the frac and wireline crews cycle across them.
// fracSlots: wells pumped at the same time. wlSlots: wells on wireline at the same time.
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

// Roles of every well on the pad, derived from the focus well (index 0, the one under manual control),
// the frac mode, and the focus well's phase. Partner wells follow the crews automatically.
export function padRoles(s) {
  const n = s.pad.wells;
  const mode = FRAC_MODES.find(m => m.id === s.pad.mode) || FRAC_MODES[0];
  const roles = Array.from({ length: n }, (_, i) => ({ i, role: i === 0 ? 'focus' : 'idle', stage: Math.min(STAGE_COUNT, s.stage + (i % 2)) }));
  const others = roles.slice(1);
  let k = 0;
  const take = (role, count) => { for (let j = 0; j < count && k < others.length; j++, k++) others[k].role = role; };
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
export const CLUSTERS_PER_STAGE = 3;

// Well and pressure parameters (illustrative, fixed for the demo well)
export const WELL = {
  tvdFt: 9000,                 // true vertical depth of the lateral
  fracGradientPsiFt: 0.80,     // closure gradient
  casingBoreIn: 4.778,         // 5-1/2 in. 20 lb/ft
  maxTreatingPsi: 12500,       // pump kickout setting
  prvSetPsi: 13000,            // pressure relief valve set point on the missile
  waterPpg: 8.34,
  sandSgPpg: 22.1,             // 2.65 SG sand expressed as ppg equivalent
};

const VALVE_TRAVEL_S = 3.0;    // hydraulic actuator or handwheel travel time (simplified)

function initialValves() {
  // pos: 0 closed, 1 open. target: commanded position. Gate valves are two-position.
  return {
    lmv:   { pos: 1, target: 1, label: 'Lower master valve (manual)', kind: 'manual' },
    umv:   { pos: 1, target: 1, label: 'Upper master valve (hyd.)', kind: 'hydraulic' },
    wingA: { pos: 0, target: 0, label: 'Wing A, pump-down side (hyd.)', kind: 'hydraulic' },
    wingB: { pos: 0, target: 0, label: 'Wing B, flowback side (hyd.)', kind: 'hydraulic' },
    crown: { pos: 1, target: 1, label: 'Crown valve below the inlet block (hyd.)', kind: 'hydraulic' },
    swab:  { pos: 0, target: 0, label: 'Swab valve, lubricator access (hyd.)', kind: 'hydraulic' },
    zip:   { pos: 0, target: 0, label: 'Zipper valve to the inlet block (this well)', kind: 'hydraulic' },
  };
}

function initialStages() {
  return Array.from({ length: STAGE_COUNT }, (_, i) => ({
    index: i,
    perforated: false,
    plugSet: false,       // plug set toe-ward of this stage's perforations
    fracExtent: 0,        // 0 to 1, fracture half-length as a fraction of the display maximum
    proppantFill: 0,      // 0 to 1
    fracComplete: false,
    plugMilled: false,
    clustersFired: 0,
  }));
}

export const useSim = create((set, get) => ({
  // ----- mode and time -----
  running: true,
  speed: 1,
  t: 0,
  phase: 'rigup',
  stage: 0,                        // current stage index (toe first)
  wl: { step: 'idle', progress: 0 }, // idle | pumpdown | setplug | perforate | pooh
  ct: { progress: 0, milling: 0, atPlug: -1 },
  fb: { choke: 0.35, cumBbl: 0 },
  lubricatorRigged: false,
  ctRigged: false,
  valves: initialValves(),
  stages: initialStages(),
  pad: { wells: 4, mode: 'zipper', bore: '7-15K' },

  // ----- operator inputs -----
  pumpRate: 0,     // bpm
  ppa: 0,          // lb proppant added per gal
  pumpsOnline: false,

  // ----- computed telemetry -----
  surfacePsi: 0,
  bhtpPsi: 0,
  hydroPsi: 0,
  frictionPsi: 0,
  netPsi: 0,
  slurryPpg: WELL.waterPpg,
  cumSlurryBbl: 0,
  cumProppantLb: 0,
  history: [],      // {t, p, q, ppa}
  alarms: { overpressure: false, prvLifted: false, kickout: false, screenout: false, interlock: '' },
  log: [],

  // ----- actions -----
  toggleRunning: () => set(s => ({ running: !s.running })),
  setSpeed: (speed) => set({ speed }),
  setPumpRate: (pumpRate) => set({ pumpRate }),
  setPpa: (ppa) => set({ ppa }),
  setPumpsOnline: (pumpsOnline) => set({ pumpsOnline, alarms: { ...get().alarms, kickout: pumpsOnline ? false : get().alarms.kickout } }),
  setChoke: (choke) => set(s => ({ fb: { ...s.fb, choke } })),
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
    get().addLog('Pad: ' + pad.wells + ' well' + (pad.wells > 1 ? 's' : '') + ', ' + (FRAC_MODES.find(m => m.id === pad.mode).label) + ', ' + (BORES.find(b => b.id === pad.bore) || BORES[5]).label);
  },
  commandValve: (id, target) => {
    const s = get();
    const v = s.valves[id];
    if (!v) return;
    // Interlocks that reflect field practice (simplified):
    if (id === 'lmv' && (s.surfacePsi > 500 || s.pumpRate > 0)) {
      return set({ alarms: { ...s.alarms, interlock: 'Lower master valve is not cycled under pressure or flow. Bleed down first.' } });
    }
    if (id === 'swab' && target === 1 && s.valves.zip.pos > 0.01) {
      return set({ alarms: { ...s.alarms, interlock: 'Close the zipper valve before opening the swab valve: the inlet block sits below the swab.' } });
    }
    if (id === 'zip' && target === 1 && s.valves.swab.pos > 0.01) {
      return set({ alarms: { ...s.alarms, interlock: 'Close the swab valve (lubricator access) before opening the zipper valve to the inlet block.' } });
    }
    if (id === 'crown' && (s.surfacePsi > 500 || s.pumpRate > 0) && target === 0) {
      return set({ alarms: { ...s.alarms, interlock: 'Crown valve is not closed against flow. Stop pumping and bleed the inlet block first.' } });
    }
    set({ valves: { ...s.valves, [id]: { ...v, target } }, alarms: { ...s.alarms, interlock: '' } });
  },
  clearInterlock: () => set(s => ({ alarms: { ...s.alarms, interlock: '' } })),
  acknowledgeAlarms: () => set(s => ({ alarms: { ...s.alarms, overpressure: false, prvLifted: false, screenout: false, kickout: false } })),
  addLog: (msg) => set(s => ({ log: [{ t: s.t, msg }, ...s.log].slice(0, 60) })),

  setPhase: (phase) => {
    const s = get();
    const patch = { phase, wl: { step: 'idle', progress: 0 }, pumpRate: 0, ppa: 0, pumpsOnline: false };
    if (phase === 'wireline') {
      patch.lubricatorRigged = true; patch.ctRigged = false;
      patch.valves = { ...s.valves, wingA: { ...s.valves.wingA, target: 1 }, zip: { ...s.valves.zip, target: 0 }, crown: { ...s.valves.crown, target: 1 }, swab: { ...s.valves.swab, target: 1 } };
    } else if (phase === 'frac') {
      patch.lubricatorRigged = false; patch.ctRigged = false;
      patch.valves = { ...s.valves, swab: { ...s.valves.swab, target: 0 }, wingA: { ...s.valves.wingA, target: 0 }, crown: { ...s.valves.crown, target: 1 } };
    } else if (phase === 'drillout') {
      patch.lubricatorRigged = false; patch.ctRigged = true;
      patch.valves = { ...s.valves, wingA: { ...s.valves.wingA, target: 0 }, zip: { ...s.valves.zip, target: 0 }, swab: { ...s.valves.swab, target: 1 }, wingB: { ...s.valves.wingB, target: 1 } };
      patch.ct = { progress: 0, milling: 0, atPlug: -1 };
    } else if (phase === 'flowback') {
      patch.lubricatorRigged = false; patch.ctRigged = false;
      patch.valves = { ...s.valves, swab: { ...s.valves.swab, target: 0 }, wingA: { ...s.valves.wingA, target: 0 }, zip: { ...s.valves.zip, target: 0 }, wingB: { ...s.valves.wingB, target: 1 } };
    } else if (phase === 'rigup' || phase === 'production') {
      patch.lubricatorRigged = false; patch.ctRigged = false;
    }
    set(patch);
    get().addLog('Phase: ' + PHASES.find(p => p.id === phase).label);
  },

  // Wireline sequence: pump-down, set plug, perforate cluster by cluster, pull out of hole.
  startWirelineRun: () => {
    const s = get();
    if (s.phase !== 'wireline') return;
    if (s.valves.swab.pos < 0.99 || s.valves.crown.pos < 0.99 || s.valves.umv.pos < 0.99 || s.valves.lmv.pos < 0.99) {
      return set({ alarms: { ...s.alarms, interlock: 'Swab, crown, and master valves must be open with the lubricator rigged before running in.' } });
    }
    if (s.stage >= STAGE_COUNT) return;
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
    if (s.stage < STAGE_COUNT - 1) {
      set({ stage: s.stage + 1, pumpRate: 0, ppa: 0, pumpsOnline: false });
      get().addLog('Advance to stage ' + (s.stage + 2));
    }
  },
  reset: () => set({
    pad: get().pad,
    t: 0, phase: 'rigup', stage: 0, wl: { step: 'idle', progress: 0 }, ct: { progress: 0, milling: 0, atPlug: -1 },
    fb: { choke: 0.35, cumBbl: 0 }, lubricatorRigged: false, ctRigged: false, valves: initialValves(), stages: initialStages(),
    pumpRate: 0, ppa: 0, pumpsOnline: false, surfacePsi: 0, bhtpPsi: 0, hydroPsi: 0, frictionPsi: 0, netPsi: 0,
    slurryPpg: WELL.waterPpg, cumSlurryBbl: 0, cumProppantLb: 0, history: [],
    alarms: { overpressure: false, prvLifted: false, kickout: false, screenout: false, interlock: '' }, log: [],
  }),

  // ----- the tick: called from the render loop with dt in seconds of sim time -----
  tick: (dtRaw) => {
    const s = get();
    if (!s.running) return;
    const dt = Math.min(dtRaw, 0.1) * s.speed;
    const t = s.t + dt;
    const patch = { t };

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
    const pathOpen = valves.zip.pos > 0.99 && valves.crown.pos > 0.99 && valves.umv.pos > 0.99 && valves.lmv.pos > 0.99;
    const st = s.stages[s.stage];
    const q = s.pumpsOnline && !s.alarms.kickout ? s.pumpRate : 0;   // bpm
    const ppa = s.ppa;

    // Slurry density and hydrostatic (standard slurry density formula, illustrative inputs)
    const slurryPpg = (WELL.waterPpg + ppa) / (1 + ppa / WELL.sandSgPpg);
    const hydroPsi = 0.052 * slurryPpg * WELL.tvdFt;

    // Friction: pipe friction grows with rate to the 1.8 power; perforation friction with the square,
    // reduced as more clusters are open. Slickwater with friction reducer assumed.
    const openClusters = Math.max(1, st ? st.clustersFired : 1);
    const pipeFric = 1150 * Math.pow(q / 90, 1.8);
    const perfFric = 900 * Math.pow(q / 90, 2) * (3 / openClusters);
    const frictionPsi = pipeFric + perfFric;

    // Net pressure: rises with fracture extent and with proppant fill; screenout drives it up fast.
    const alarms = { ...s.alarms };
    let stages = s.stages;
    let netPsi = s.netPsi;
    let surfacePsi = s.surfacePsi;
    const closurePsi = WELL.fracGradientPsiFt * WELL.tvdFt;

    if (s.phase === 'frac' && st && st.perforated) {
      if (q > 0 && pathOpen) {
        // Fracture extension and proppant placement (illustrative rates chosen so a stage takes a couple of minutes)
        const ext = Math.min(1, st.fracExtent + (q / 90) * dt / 90);
        const fill = Math.min(1, st.proppantFill + (ppa / 4) * (q / 90) * dt / 60);
        // Screenout condition: high concentration at low rate, or the pack is full and sand keeps coming
        const screening = (ppa > 2.5 && q < 45) || (fill >= 1 && ppa > 0.5);
        const targetNet = 250 + 550 * ext + 300 * fill + (screening ? 2500 : 0);
        netPsi += (targetNet - netPsi) * Math.min(1, dt * (screening ? 0.6 : 0.25));
        stages = stages.map((x, i) => i === s.stage ? { ...x, fracExtent: ext, proppantFill: fill, fracComplete: ext >= 1 && fill >= 0.6 } : x);
        if (screening && !alarms.screenout) { alarms.screenout = true; get().addLog('SCREENOUT: treating pressure ramping at constant rate. Cut sand and flush.'); }
        if (!screening) alarms.screenout = false;
        patch.cumSlurryBbl = s.cumSlurryBbl + q * dt / 60;
        patch.cumProppantLb = s.cumProppantLb + q * 42 * ppa * dt / 60;
      } else {
        netPsi += (0 - netPsi) * Math.min(1, dt * 0.15);
        alarms.screenout = false;
      }
    } else {
      netPsi += (0 - netPsi) * Math.min(1, dt * 0.3);
    }

    // Surface treating pressure
    let bhtpPsi = 0;
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
    } else if (q > 0 && pathOpen && !(st && st.perforated)) {
      // Pumping on an unperforated (or already isolated) wellbore: no exit, pressure climbs like a closed system
      surfacePsi = Math.min(WELL.prvSetPsi + 400, surfacePsi + 600 * dt);
      if (surfacePsi >= WELL.maxTreatingPsi) { alarms.kickout = true; patch.pumpsOnline = false; alarms.overpressure = true; get().addLog('No open perforations: wellbore pressured up. Pumps kicked out.'); }
      bhtpPsi = surfacePsi + hydroPsi;
    } else {
      // Shut in or bleeding: wellhead pressure relaxes toward static (closure minus hydrostatic of water), or to 0 on flowback
      const wellOpenToFlowback = valves.wingB.pos > 0.99 && (s.phase === 'flowback' || s.phase === 'drillout');
      const staticWhp = Math.max(0, closurePsi - 0.052 * WELL.waterPpg * WELL.tvdFt - 900);
      const target = wellOpenToFlowback ? staticWhp * (1 - s.fb.choke) * 0.35 : (s.stages.some(x => x.perforated) ? staticWhp : 0);
      surfacePsi += (target - surfacePsi) * Math.min(1, dt * 0.4);
      bhtpPsi = surfacePsi + hydroPsi;
    }

    // Wireline sequence progression
    let wl = s.wl; let lubricatorRigged = s.lubricatorRigged;
    if (s.phase === 'wireline' && wl.step !== 'idle') {
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
          get().addLog('Plug set toe-ward of the new perforations. Guns armed.');
        } else wl = { step: 'setplug', progress: p };
      } else if (wl.step === 'perforate') {
        const p = wl.progress + 0.35 * dt;
        const fired = Math.min(CLUSTERS_PER_STAGE, Math.floor(p * CLUSTERS_PER_STAGE) + 1);
        stages = stages.map((x, i) => i === s.stage ? { ...x, clustersFired: fired, perforated: fired >= 1 } : x);
        wl = p >= 1 ? { step: 'pooh', progress: 0 } : { step: 'perforate', progress: p };
        if (p >= 1) get().addLog('All clusters fired. Pulling out of hole.');
      } else if (wl.step === 'pooh') {
        const p = wl.progress + 0.15 * dt;
        wl = p >= 1 ? { step: 'done', progress: 1 } : { step: 'pooh', progress: p };
        if (p >= 1) get().addLog('Tool string in the lubricator. Close swab valve, swap to frac.');
      }
      patch.wl = wl;
    }

    // Drillout progression: coiled tubing runs to each plug from the heel and mills it
    if (s.phase === 'drillout') {
      const plugs = stages.map((x, i) => ({ i, set: x.plugSet && !x.plugMilled })).filter(p => p.set);
      if (plugs.length) {
        // heel-most plug first: highest index that is set
        const target = plugs[plugs.length - 1].i;
        const targetProgress = (STAGE_COUNT - target) / STAGE_COUNT;  // fraction of lateral from heel
        let ct = { ...s.ct, atPlug: target };
        if (ct.progress < targetProgress - 0.001) {
          ct.progress = Math.min(targetProgress, ct.progress + 0.06 * dt);
        } else {
          ct.milling = Math.min(1, ct.milling + 0.25 * dt);
          if (ct.milling >= 1) {
            stages = stages.map((x, i) => i === target ? { ...x, plugMilled: true } : x);
            ct.milling = 0;
            get().addLog('Plug ' + (target + 1) + ' milled. Debris returning up the annulus.');
          }
        }
        patch.ct = ct;
      } else if (s.ct.progress > 0) {
        patch.ct = { ...s.ct, progress: Math.max(0, s.ct.progress - 0.08 * dt), atPlug: -1 };
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
    set(patch);
  },
}));
