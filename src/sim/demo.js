// Narrated demos (Drop 77): the simulator performs a lesson itself, or tours the pad, while a caption bar shows
// what is being done and the browser's own speech voice reads it. No video files: the demo always matches the
// current build, and the person can stop it and take over at any point. `useDemo` holds the state; `runDemo` is
// the sequencer. Speech comes from the Web Speech API (free, built into the browser) with a neutral American male
// voice preferred; where no voice exists, or when a voice never reports finishing, a timer sized to the text
// stands in so the demo keeps moving. The headless pass sets `window.__padworksDemo.fast` to skip the waits.
import { create } from 'zustand';
import { useSim } from './store.js';
import { lessonById, stepValve } from './lessons.js';

export const useDemo = create((set) => ({
  active: null,        // 'intro' | lesson id | null
  caption: '',
  step: 0, steps: 0,
  muted: (() => { try { return window.localStorage.getItem('padworks.demo.muted') === '1'; } catch { return false; } })(),
  setMuted: (muted) => { try { window.localStorage.setItem('padworks.demo.muted', muted ? '1' : '0'); } catch { /* session only */ } set({ muted }); if (muted) cancelSpeech(); },
  set: (patch) => set(patch),
}));

const FAST = () => !!(typeof window !== 'undefined' && window.__padworksDemo && window.__padworksDemo.fast);
if (typeof window !== 'undefined') window.__padworksDemo = window.__padworksDemo || { fast: false };

// ---------------------------------------------------------------- speech
let voice = null, voicesTried = false;
const MALE = /david|mark|guy|ryan|christopher|eric|andrew|brian|alex|daniel|fred|tom|james|aaron|rishi|roger/i;
function pickVoice() {
  try {
    const list = window.speechSynthesis.getVoices();
    if (!list.length) return null;
    const us = list.filter(v => /^en[-_]US/i.test(v.lang));
    const pool = us.length ? us : list.filter(v => /^en/i.test(v.lang));
    // a neutral American male voice first (David and Mark on Windows, Alex on a Mac), then any natural one, then any
    return pool.find(v => MALE.test(v.name) && /natural|online/i.test(v.name)) || pool.find(v => MALE.test(v.name)) || pool.find(v => !/female|zira|samantha|susan|aria|jenny|michelle|linda|heather|catherine/i.test(v.name)) || pool[0] || null;
  } catch { return null; }
}
function ensureVoice() {
  if (voice || voicesTried) return;
  voicesTried = true;
  voice = pickVoice();
  try { window.speechSynthesis.addEventListener('voiceschanged', () => { voice = pickVoice(); }); } catch { /* no speech */ }
}
export function cancelSpeech() { try { window.speechSynthesis.cancel(); } catch { /* no speech */ } }
// resolves when the sentence has been spoken (or would have been)
function speak(text, token) {
  const ms = Math.max(2200, text.length * 62);
  if (FAST()) return new Promise(r => setTimeout(r, 500));
  const muted = useDemo.getState().muted;
  if (muted || typeof window === 'undefined' || !window.speechSynthesis) return new Promise(r => setTimeout(r, ms));
  ensureVoice();
  return new Promise((resolve) => {
    let done = false; const finish = () => { if (!done) { done = true; resolve(); } };
    try {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice; u.lang = 'en-US'; u.rate = 1.0; u.pitch = 1.0;
      u.onend = finish; u.onerror = finish;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
      token.utterance = u;
      setTimeout(finish, ms * 2.2);   // a voice that never reports its end does not stall the demo
    } catch { setTimeout(finish, ms); }
  });
}

// ---------------------------------------------------------------- the introduction script
export const INTRO = [
  { preset: 'pad', text: 'Welcome to Padworks. This is a multi-well frac pad, drawn from generic equipment at real proportions. The simulator runs the whole completion: wireline, fracturing, drillout, flowback and the production hookup. Let us walk the pad.' },
  { preset: 'tree', text: 'The frac tree. Lower and upper master valves, the cross with a wing valve each side, the crown valve, and the swab valve on top for lubricator access. Every valve here is live in the simulator, and the interlocks between them are the first thing the lessons teach.' },
  { preset: 'row', text: 'The wellhead row. Each well gets its own tree, and the colors on the valve bodies match the colors on the zipper leg that feeds it, so you can follow a flow path from the manifold to the well.' },
  { preset: 'zipper', text: 'The zipper manifold. The treating line from the missile comes into the inlet isolation valve; each well has a leg with an isolation valve and a working valve. Opening and closing legs is how one frac spread serves several wells without breaking a connection.' },
  { preset: 'pumps', text: 'The pump row and the missile. Pump trucks park nose-in on both sides of the manifold trailer. Low-pressure suction on the outside, high-pressure discharge down the centerline, the relief valve set below the iron rating.' },
  { preset: 'sand', text: 'The sand side. Silos or boxes feed the conveyor to the blender, where water, sand and chemicals become slurry. Proppant concentration is the number you will watch most when you pump a stage.' },
  { preset: 'tanks', text: 'Water. A lined pit, tanks, or storage tanks depending on the basin, with the transfer pump and the lay-flat line to the blender. In winter the Bakken adds a heater on the discharge.' },
  { preset: 'support', text: 'Support: the data van where the job is run, the fuel row, light plants, the chemical totes, and the crew. Everything on the pad opens a record in the library when you hover and click it.' },
  { preset: 'gate', text: 'The gate and the lease road. Trucks come and go through here; the lanes and ruts on the pad come from where they actually drive.' },
  { preset: 'flowback', text: 'Flowback. After drillout the well flows through the choke manifold to the separator and the tanks, and the flare stack takes the gas until the sales line is tied in.' },
  { preset: 'pad', text: 'That is the pad. Press Lessons to be walked through a job one checkpoint at a time, with a score; press Full simulator to run it your own way. Hover anything to name it; click to open its record.' },
];

// ---------------------------------------------------------------- the sequencer
let current = null;   // the running demo's token: { cancelled, utterance }
const wait = (ms) => new Promise(r => setTimeout(r, FAST() ? Math.min(ms, 300) : ms));
const until = (test, maxMs = 240000) => new Promise((resolve) => {
  const t0 = Date.now();
  const tick = () => { if (!current || current.cancelled) return resolve(false); if (test(useSim.getState())) return resolve(true); if (Date.now() - t0 > maxMs) return resolve(false); setTimeout(tick, 200); };
  tick();
});
const alive = (token) => current === token && !token.cancelled;

export function stopDemo() {
  if (current) current.cancelled = true; current = null;
  cancelSpeech();
  const S = useSim.getState(), D = useDemo.getState();
  if (D.active && D.active !== 'intro') S.setSpeed(1);
  if (S.ui.demo) S.setUi({ demo: false });
  D.set({ active: null, caption: '', step: 0, steps: 0 });
}
// skip the rest of the current step's narration (the sequencer moves on when the sentence ends)
export function skipNarration() { if (current && current.utterance) { try { window.speechSynthesis.cancel(); } catch { /* no speech */ } } }

export async function startDemo(kind) {
  stopDemo();
  const token = { cancelled: false, utterance: null }; current = token;
  const S = useSim.getState();
  const D = useDemo.getState();
  S.setUi({ demo: true, walk: false, tour: false });
  if (kind === 'intro') {
    D.set({ active: 'intro', step: 0, steps: INTRO.length, caption: INTRO[0].text });
    if (S.phase !== 'setup') S.reset();
    for (let i = 0; i < INTRO.length; i++) {
      if (!alive(token)) return;
      const it = INTRO[i];
      useSim.getState().setUi({ preset: it.preset, walk: false, tour: false });
      D.set({ step: i, caption: it.text });
      await speak(it.text, token); if (!alive(token)) return;
      await wait(900);
    }
    if (alive(token)) stopDemo();
    return;
  }
  const L = lessonById(kind);
  if (!L) { stopDemo(); return; }
  D.set({ active: L.id, step: 0, steps: L.steps.length, caption: 'Lesson ' + L.n + ': ' + L.title + '. ' + L.blurb });
  S.startLesson(L.id);
  useSim.getState().setSpeed(2);
  await speak('Lesson ' + L.n + ', ' + L.title + '. ' + L.blurb + ' Watch first; then try it yourself.', token); if (!alive(token)) return;
  for (let i = 0; i < L.steps.length; i++) {
    if (!alive(token)) return;
    const step = L.steps[i];
    const say = 'Step ' + (i + 1) + ' of ' + L.steps.length + '. ' + step.text + '.' + (step.hint ? ' ' + step.hint : '');
    D.set({ step: i, caption: say });
    // the camera goes where the person's own click would send it
    const g = useSim.getState();
    if (step.action) g.focusOn({ action: step.action });
    else if (step.valve) { const v = stepValve(step, g); if (v) g.focusOn({ valve: v }); }
    await speak(say, token); if (!alive(token)) return;
    if (step.gate) { await until(s => step.gate(s)); if (!alive(token)) return; }
    // do the step the way the trainee would
    const g2 = useSim.getState();
    if (step.demo) {
      const list = typeof step.demo === 'function' ? [[0, step.demo]] : step.demo;
      let last = 0;
      for (const [at, fn] of list) { await wait((at - last) * 1000); last = at; if (!alive(token)) return; fn(useSim.getState()); }
    } else if (step.action) g2.guide(step.action);
    else if (step.valve) { const v = stepValve(step, g2); if (v && g2.valves[v]) g2.commandValve(v, g2.valves[v].target === 1 ? 0 : 1); }
    await until(s => !!s.lesson.doneMask[i] || s.lesson.finished || s.lesson.id !== L.id);
    if (!alive(token)) return;
    if (useSim.getState().lesson.id !== L.id) { stopDemo(); return; }
    await wait(700);
  }
  if (!alive(token)) return;
  const r = useSim.getState().lesson.result;
  const end = 'Lesson complete' + (r ? ', ' + r.score + ' points, grade ' + r.grade : '') + '. Now try it yourself: press Try it on the lessons page, or Reset and start the lesson from the setup panel.';
  D.set({ step: L.steps.length, caption: end });
  await speak(end, token);
  if (alive(token)) { useSim.getState().setSpeed(1); stopDemo(); }
}
