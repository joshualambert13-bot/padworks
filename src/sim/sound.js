// Pad sound (Drop 32): everything is synthesized in Web Audio from oscillators and filtered noise, so there are no
// audio files to license or load. The engine subscribes to the sim store and moves gains and pitches with
// setTargetAtTime when the relevant state changes; nothing runs per frame on the main thread, so the frame budget is
// untouched. Browsers only start audio after a user gesture, so `enable()` is called from the toolbar button (and,
// when the preference was saved as on, from the first pointer or key event on the page).
//
// Voices: a wind bed (always), the pump fleet (rumble and throb that follow rate; idle when online at zero rate),
// the wireline unit (whine while the cable is moving), coiled tubing (injector whine, mill noise), flowback (choke
// hiss by choke opening), alarms (two-tone pulse while any alarm is latched), and one-shots for valve actuation,
// an interlock rejection, guns firing, and a plug setting.
import { useSim } from './store.js';

const KEY = 'padworks.sound';
export const soundWanted = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const remember = (on) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* private mode */ } };

let engine = null;
// Positional layer (Drop 60): while walking the pad, each working voice is attenuated by the walker's distance to
// its source and panned by its bearing. The scene writes the source positions (pad meters) into SOURCES and the
// walker writes LISTENER; `updateListener()` moves the distance gains and pans. Off the walk, every distance gain
// is 1 and every pan 0, which is the pad mix as it always was.
export const LISTENER = { x: 0, z: 0, yaw: 0, walk: false };
export const SOURCES = { pump: null, choke: null, wl: null, ct: null, mill: null };   // [x, z]
const RANGE = { pump: 34, choke: 12, wl: 10, ct: 12, mill: 10 };                     // distance at which a voice is at a quarter
export function updateListener() {
  if (!engine) return;
  const { D, P, ctx } = engine;
  for (const k in D) {
    const src = SOURCES[k];
    let g = 1, pan = 0;
    if (LISTENER.walk && src) {
      const dx = src[0] - LISTENER.x, dz = src[1] - LISTENER.z, d = Math.hypot(dx, dz);
      g = 1 / (1 + (d / RANGE[k]) * (d / RANGE[k]) * 3);
      // bearing relative to the walker's facing (forward is -Z rotated by yaw): positive to the right
      const fx = -Math.sin(LISTENER.yaw), fz = -Math.cos(LISTENER.yaw);
      const right = fx * dz - fz * dx;
      pan = d > 1 ? Math.max(-0.8, Math.min(0.8, right / d)) : 0;
    }
    D[k].gain.setTargetAtTime(g, ctx.currentTime, 0.15);
    if (P[k]) P[k].pan.setTargetAtTime(pan, ctx.currentTime, 0.15);
  }
}
const listeners = new Set();
export const onSoundChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const soundOn = () => !!(engine && engine.on);
const notify = () => listeners.forEach(fn => fn(soundOn()));

function noiseBuffer(ctx, seconds = 2) {
  const n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  const noise = noiseBuffer(ctx);
  const src = (opts) => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; Object.assign(s, opts); s.start(); return s; };
  const filt = (type, f, q = 1) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
  const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };
  const V = {};
  // positional voices run through a distance gain and a stereo pan before the master (Drop 60)
  const D = {}, P = {};
  const spatial = (k) => { D[k] = gain(1); P[k] = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (P[k]) chain(D[k], P[k], master); else D[k].connect(master); return D[k]; };

  // wind: low filtered noise, slow gusts
  V.wind = gain(0.03); chain(src(), filt('lowpass', 420, 0.7), V.wind, master);
  const gust = osc('sine', 0.09); const gustG = gain(0.012); gust.connect(gustG); gustG.connect(V.wind.gain);

  // pumps: rumble (noise band) + two detuned saws under a lowpass + a throb LFO on the saw level
  V.pump = gain(0); V.pump.connect(spatial('pump'));
  chain(src(), filt('bandpass', 85, 0.9), gain(0.9), V.pump);
  const sawG = gain(0.35); sawG.connect(V.pump);
  V.saw1 = osc('sawtooth', 48); V.saw2 = osc('sawtooth', 50.6);
  const sawLP = filt('lowpass', 230, 0.8); V.saw1.connect(sawLP); V.saw2.connect(sawLP); sawLP.connect(sawG);
  V.throb = osc('sine', 7); const throbG = gain(0.12); V.throb.connect(throbG); throbG.connect(sawG.gain);
  chain(src(), filt('bandpass', 1400, 1.2), gain(0.08), V.pump);   // turbo / exhaust hiss

  // wireline: a whine with a slight warble
  V.wl = gain(0); chain(osc('sawtooth', 170), filt('bandpass', 900, 2.2), V.wl, spatial('wl'));
  const warble = osc('sine', 1.7); const warbleG = gain(4); warble.connect(warbleG);

  // coiled tubing: injector drive whine + mill noise
  V.ct = gain(0); chain(osc('square', 95), filt('lowpass', 600, 0.9), gain(0.5), V.ct, spatial('ct'));
  V.mill = gain(0); chain(src(), filt('bandpass', 2100, 1.5), V.mill, spatial('mill'));

  // flowback: choke hiss
  V.choke = gain(0); chain(src(), filt('highpass', 1600, 0.7), V.choke, spatial('choke'));

  // alarm: two tones gated by a 2 Hz square
  V.alarm = gain(0); V.alarm.connect(master);
  const tone = gain(0); tone.connect(V.alarm);
  const a1 = osc('square', 760), a2 = osc('square', 950); const a1g = gain(0.5), a2g = gain(0.35);
  a1.connect(a1g); a2.connect(a2g); a1g.connect(tone); a2g.connect(tone);
  const gate = osc('square', 2); const gateG = gain(0.5); gate.connect(gateG); gateG.connect(tone.gain); tone.gain.value = 0.5;
  const alt = osc('square', 0.5); const altG = gain(0.25); alt.connect(altG); altG.connect(a2g.gain); a2g.gain.value = 0.25;   // second tone comes and goes every second

  // one-shots: `make` returns [source, output]; the source is stopped and the chain dropped once the burst has died
  const burst = (make, gainPeak, attack, decay, dur) => {
    const g = gain(0); const [source, out] = make(); out.connect(g); g.connect(master);
    const t = ctx.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gainPeak, t + attack); g.gain.setTargetAtTime(0, t + attack, decay);
    source.stop(t + dur + 0.3);
    source.onended = () => { try { out.disconnect(); g.disconnect(); } catch { /* already gone */ } };
  };
  const noiseSrc = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.start(); return s; };
  const oscSrc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
  V.hiss = () => burst(() => { const s = noiseSrc(); const f = filt('bandpass', 1900, 1.1); s.connect(f); return [s, f]; }, 0.12, 0.02, 0.18, 0.9);
  V.thump = () => {
    burst(() => { const o = oscSrc('sine', 90); o.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.3); return [o, o]; }, 0.7, 0.005, 0.12, 0.6);
    burst(() => { const s = noiseSrc(); const f = filt('lowpass', 900, 0.8); s.connect(f); return [s, f]; }, 0.25, 0.005, 0.05, 0.4);
  };
  V.clank = () => burst(() => { const o = oscSrc('square', 310); const f = filt('bandpass', 1200, 6); o.connect(f); return [o, f]; }, 0.18, 0.003, 0.04, 0.3);
  V.bonk = () => burst(() => { const o = oscSrc('triangle', 330); o.frequency.setValueAtTime(220, ctx.currentTime + 0.12); return [o, o]; }, 0.2, 0.01, 0.1, 0.5);

  return { ctx, master, V, D, P };
}

const set = (param, v, tc = 0.12, ctx) => { if (Math.abs(param.value - v) > 0.002 || v === 0) param.setTargetAtTime(v, ctx.currentTime, tc); };

// Map the sim state onto the voices. `prev` is the last state seen, for one-shots on transitions.
function apply(E, s, prev) {
  const { V, ctx } = E; const run = s.running ? 1 : 0;
  const rate = s.pumpRate || 0;
  const pumping = s.pumpsOnline && (s.phase === 'frac' || s.phase === 'wireline' || s.phase === 'drillout');
  const level = pumping ? (rate > 0.5 ? 0.12 + 0.42 * Math.sqrt(rate / 100) : 0.08) : 0;
  set(V.pump.gain, level * run, 0.25, ctx);
  const f = 46 + 10 * Math.min(1, rate / 100);
  set(V.saw1.frequency, f, 0.4, ctx); set(V.saw2.frequency, f * 1.052, 0.4, ctx);
  set(V.throb.frequency, 5 + 6 * Math.min(1, rate / 100), 0.4, ctx);

  const wlMoving = ['pumpdown', 'pooh', 'freeing', 'stuck'].includes(s.wl.step) && s.phase === 'wireline';
  set(V.wl.gain, wlMoving ? (s.wl.step === 'stuck' ? 0.02 : 0.07) * run : 0, 0.3, ctx);

  const ctMoving = s.phase === 'drillout' && prev && s.ct.progress !== prev.ct.progress;
  set(V.ct.gain, (ctMoving || (s.ct.milling > 0 && s.ct.milling < 1)) ? 0.06 * run : 0, 0.35, ctx);
  set(V.mill.gain, s.ct.milling > 0 && s.ct.milling < 1 ? 0.05 * run : 0, 0.3, ctx);

  set(V.choke.gain, s.phase === 'flowback' ? 0.14 * Math.sqrt(s.fb.choke || 0) * run : 0, 0.4, ctx);

  const A = s.alarms; const latched = A.overpressure || A.prvLifted || A.kickout || A.screenout;
  set(V.alarm.gain, latched ? 0.15 : 0, 0.05, ctx);

  if (!prev) return;
  if (A.interlock && A.interlock !== prev.alarms.interlock) V.bonk();
  if (s.valves !== prev.valves) {
    for (const id in s.valves) { const a = s.valves[id], b = prev.valves[id]; if (b && a.target !== b.target) { V.hiss(); break; } }
  }
  if (s.stages !== prev.stages) {
    for (let i = 0; i < s.stages.length; i++) {
      const a = s.stages[i], b = prev.stages[i]; if (!b) continue;
      if ((a.clustersFired || 0) > (b.clustersFired || 0)) V.thump();
      if (a.plugSet && !b.plugSet) V.clank();
    }
  }
  if ((s.events.misfired || 0) > (prev.events.misfired || 0)) V.clank();
}

export function enableSound() {
  if (!engine) {
    const E = build(); if (!E) return false;
    engine = E; engine.on = false; engine.prev = null;
    if (typeof window !== 'undefined') { window.__padworksSound = engine; engine.LISTENER = LISTENER; engine.SOURCES = SOURCES; }   // test hooks (shots.mjs reads the voice levels)
    engine.unsub = useSim.subscribe((s) => { if (!engine.on) return; try { apply(engine, s, engine.prev); } catch (e) { console.error('sound:', e); } engine.prev = s; });   // never let the audio graph take the sim down
  }
  engine.on = true; remember(true);
  engine.ctx.resume().then(() => { engine.master.gain.setTargetAtTime(0.8, engine.ctx.currentTime, 0.2); apply(engine, useSim.getState(), null); engine.prev = useSim.getState(); notify(); });
  notify();
  return true;
}
export function disableSound(forget = true) {
  if (!engine) { if (forget) remember(false); notify(); return; }
  engine.on = false; if (forget) remember(false);
  engine.master.gain.setTargetAtTime(0, engine.ctx.currentTime, 0.1);
  setTimeout(() => { if (engine && !engine.on) engine.ctx.suspend(); }, 400);
  notify();
}
export const toggleSound = () => (soundOn() ? disableSound() : enableSound());

// Resume a remembered preference: directly when the context already exists (it was unlocked by an earlier gesture),
// otherwise on the first gesture; returns a cleanup for the listeners.
export function armSoundOnGesture() {
  if (!soundWanted() || soundOn()) return () => {};
  if (engine) { enableSound(); return () => {}; }
  const once = () => { enableSound(); off(); };
  const off = () => { window.removeEventListener('pointerdown', once); window.removeEventListener('keydown', once); };
  window.addEventListener('pointerdown', once); window.addEventListener('keydown', once);
  return off;
}
