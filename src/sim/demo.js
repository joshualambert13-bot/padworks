// Narrated demos (Drop 77): the simulator performs a lesson itself, or tours the pad, while a caption bar shows
// what is being done and a voice reads it. No video files: the demo always matches the current build, and the
// person can stop it and take over at any point. `useDemo` holds the state; `startDemo` is the sequencer.
// The lines come from content/narration.json (Drop 84; the introduction's defaults are in demo-intro.js, the
// lesson lines are assembled from lessons.js when the file has none). The voice (Drop 84): a rendered clip in
// public/audio/narration when one exists for the line (scripts/narration-render.mjs, a neutral American male
// voice from an open text-to-speech model, so every browser hears the same voice), else the browser's own speech
// voice (Web Speech, free) with a neutral American male preferred; where neither exists, or a voice never reports
// finishing, a timer sized to the text stands in so the demo keeps moving. The headless pass sets
// `window.__padworksDemo.fast` to skip the waits.
import { create } from 'zustand';
import { useSim } from './store.js';
import { lessonById, stepValve } from './lessons.js';
import { INTRO } from './demo-intro.js';
import NARRATION from '../../content/narration.json';

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
if (typeof window !== 'undefined') Object.assign(window.__padworksDemo, { hasClip: (id, text) => hasClip(id, text), clipName: (id, text) => clipName(id, text), introLines: () => introLines(), lessonLines: (id) => { const L = lessonById(id); return L ? lessonLines(L) : null; } });   // test hooks (Drop 84)

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
let playing = null;   // the clip playing now, so a stop or a skip ends it
export function cancelSpeech() { try { window.speechSynthesis.cancel(); } catch { /* no speech */ } if (playing) { try { playing.pause(); } catch { /* done */ } playing = null; } }
// a short hash of a line, part of its clip's file name: an edited line falls back to the browser voice until it is rendered again
export function lineHash(text) { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
const CLIPS = new Set((NARRATION.clips || []));
export const clipName = (id, text) => id + '-' + lineHash(text);
export const hasClip = (id, text) => CLIPS.has(clipName(id, text));
// plays the rendered clip for a line; resolves true when it ended, false when there is no clip or it could not play
function playClip(id, text, token) {
  if (!id || !hasClip(id, text)) return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false; const finish = (ok) => { if (!done) { done = true; if (playing === a) playing = null; resolve(ok); } };
    const a = new Audio('/audio/narration/' + clipName(id, text) + '.mp3');
    a.preload = 'auto';
    a.onended = () => finish(true); a.onerror = () => finish(false);
    playing = a; token.clip = a;
    const p = a.play(); if (p && p.catch) p.catch(() => finish(false));
    setTimeout(() => finish(true), Math.max(4000, text.length * 120) * 2);   // a clip that never reports its end does not stall the demo
  });
}
// resolves when the sentence has been spoken (or would have been)
async function speak(text, token, id = null) {
  const ms = Math.max(2200, text.length * 62);
  if (FAST()) return new Promise(r => setTimeout(r, 500));
  const muted = useDemo.getState().muted;
  if (muted) return new Promise(r => setTimeout(r, ms));
  if (typeof window !== 'undefined' && await playClip(id, text, token)) return;
  if (token.cancelled) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return new Promise(r => setTimeout(r, ms));
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

// ---------------------------------------------------------------- the lines
// the introduction's stops from content/narration.json, with demo-intro.js filling any that are missing
export function introLines() {
  const file = Array.isArray(NARRATION.intro) ? NARRATION.intro : [];
  return INTRO.map((it, i) => { const id = 'intro-' + (i + 1); const f = file.find(x => x.id === id); return { id, preset: it.preset, text: f && f.text ? f.text : it.text }; });
}
// a lesson's lines: the file's where it has them, else the lesson's own text and hints
export function lessonLines(L) {
  const f = (NARRATION.lessons && NARRATION.lessons[L.id]) || {};
  return {
    intro: f.intro || ('Lesson ' + L.n + ', ' + L.title + '. ' + L.blurb + ' Watch first; then try it yourself.'),
    steps: L.steps.map((s, i) => (f.steps && f.steps[i]) || ('Step ' + (i + 1) + ' of ' + L.steps.length + '. ' + s.text + '.' + (s.hint ? ' ' + s.hint : ''))),
    end: f.end || 'Lesson complete. Now try it yourself: press Try it on the lessons page, or Reset and start the lesson from the setup panel.',
    replies: L.steps.map((s, i) => (f.replies && f.replies[i]) || s.reply || ''),   // the radio answers (Drop 89), in the second voice
  };
}

// Radio replies (Drop 89): a lesson step with a `reply` is answered over the radio when it is met, in free play
// through this watcher and in a demo by the sequencer itself (so the instructor's next line waits for the answer).
// Rendered clips only (a second voice from the same model); a line without a clip stays silent rather than
// borrowing the instructor's voice.
let replyToken = { cancelled: false };
export function playReply(L, i) {
  const text = lessonLines(L).replies[i]; if (!text) return Promise.resolve(false);
  if (useDemo.getState().muted) return Promise.resolve(false);
  replyToken = { cancelled: false };
  return playClip(L.id + '-reply-' + (i + 1), text, replyToken);
}
let lastMask = null, lastId = null;
if (typeof window !== 'undefined') useSim.subscribe((st) => {
  const ls = st.lesson; if (!ls || !ls.id) { lastMask = null; lastId = null; return; }
  if (ls.id !== lastId) { lastId = ls.id; lastMask = ls.doneMask.slice(); return; }
  if (ls.doneMask === lastMask) return;
  const prev = lastMask || []; lastMask = ls.doneMask.slice();
  if (st.ui.demo) return;   // the demo plays the reply itself
  const L = lessonById(ls.id); if (!L) return;
  for (let i = 0; i < ls.doneMask.length; i++) if (ls.doneMask[i] && !prev[i] && L.steps[i].reply) { playReply(L, i); break; }
});

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
export function skipNarration() { if (current && current.clip) { try { current.clip.pause(); current.clip.dispatchEvent(new Event('ended')); } catch { /* done */ } } if (current && current.utterance) { try { window.speechSynthesis.cancel(); } catch { /* no speech */ } } }

export async function startDemo(kind) {
  stopDemo();
  const token = { cancelled: false, utterance: null }; current = token;
  const S = useSim.getState();
  const D = useDemo.getState();
  S.setUi({ demo: true, walk: false, tour: false });
  if (kind === 'intro') {
    const lines = introLines();
    D.set({ active: 'intro', step: 0, steps: lines.length, caption: lines[0].text });
    if (S.phase !== 'setup') S.reset();
    for (let i = 0; i < lines.length; i++) {
      if (!alive(token)) return;
      const it = lines[i];
      useSim.getState().setUi({ preset: it.preset, walk: false, tour: false });
      D.set({ step: i, caption: it.text });
      await speak(it.text, token, it.id); if (!alive(token)) return;
      await wait(900);
    }
    if (alive(token)) stopDemo();
    return;
  }
  const L = lessonById(kind);
  if (!L) { stopDemo(); return; }
  const N = lessonLines(L);
  D.set({ active: L.id, step: 0, steps: L.steps.length, caption: 'Lesson ' + L.n + ': ' + L.title + '. ' + L.blurb });
  S.startLesson(L.id);
  useSim.getState().setSpeed(2);
  await speak(N.intro, token, L.id + '-intro'); if (!alive(token)) return;
  for (let i = 0; i < L.steps.length; i++) {
    if (!alive(token)) return;
    const step = L.steps[i];
    const say = N.steps[i];
    D.set({ step: i, caption: say });
    // the camera goes where the person's own click would send it
    const g = useSim.getState();
    if (step.action) g.focusOn({ action: step.action });
    else if (step.valve) { const v = stepValve(step, g); if (v) g.focusOn({ valve: v }); }
    await speak(say, token, L.id + '-step-' + (i + 1)); if (!alive(token)) return;
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
    if (step.reply && !FAST()) { await playReply(L, i); if (!alive(token)) return; }   // the radio answers before the next line (Drop 89)
    await wait(700);
  }
  if (!alive(token)) return;
  const r = useSim.getState().lesson.result;
  // the score is in the caption; the spoken end line is the same for every run, so it has a clip
  D.set({ step: L.steps.length, caption: (r ? r.score + ' points, grade ' + r.grade + '. ' : '') + N.end });
  await speak(N.end, token, L.id + '-end');
  if (alive(token)) { useSim.getState().setSpeed(1); stopDemo(); }
}
