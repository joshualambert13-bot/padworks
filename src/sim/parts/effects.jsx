// Postprocessing for Full quality: screen-space ambient occlusion (N8AO) so parts sit on the deck and the ground
// instead of floating, and bloom on the few things that are brighter than white (sun disk, pressure glow in the
// fractures, the perforating flash, mill sparks). Lite mode never mounts it. A frame-time guard watches the first
// seconds with the effects on and turns them off for the session when the average frame is slow, so a laptop
// with a weak GPU still gets a usable frame rate; the Effects button turns them back on. Drop 86: the composer's
// frame buffer is no longer multisampled (four half-float samples a pixel were the single biggest block of GPU
// memory on a laptop); SMAA smooths the edges instead, at two bytes a pixel. A phone starts with the effects off.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, N8AO, Bloom, BrightnessContrast, HueSaturation, Vignette, SMAA } from '@react-three/postprocessing';
import { create } from 'zustand';
import { LITE, DETAIL } from './lighting.jsx';
import { TIER } from './tier.js';
import { GPU, textureBytes } from './gpu.js';

const KEY = 'padworks.fx';
const stored = () => { try { return window.localStorage.getItem(KEY); } catch { return null; } };
export const useFx = create((set) => ({
  wanted: !LITE && (stored() === 'on' || (stored() !== 'off' && TIER.fx)),   // the person's choice; on by default in Full quality on a laptop
  auto: false,                              // the guard turned it off this session
  frameMs: 0,
  setWanted: (on) => { try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* no storage: this session only */ } set({ wanted: on, auto: false }); },
  autoOff: (frameMs) => set({ auto: true, frameMs }),
}));
export const fxOn = (s) => !LITE && s.wanted && !s.auto;
export const FX_LIMIT_MS = 45;

function Guard() {
  const samples = useRef([]);
  const warm = useRef(0);
  useFrame((_, dt) => {
    if (dt > 0.5) return;                                    // a hidden tab or a drag of the window, not a measurement
    if (warm.current < 40) { warm.current++; return; }       // skip warm-up: shader compiles and texture uploads
    samples.current.push(dt);
    if (samples.current.length < 80) return;
    const avg = samples.current.reduce((a, b) => a + b, 0) / samples.current.length * 1000;
    samples.current = [];                                    // keep watching in 80-frame windows: a later slowdown counts too
    if (avg > FX_LIMIT_MS) useFx.getState().autoOff(Math.round(avg));
  });
  return null;
}

// The live composer per renderer (Drop 64): a photo of the view renders through it so the picture carries the
// effects; absent (Lite, or effects off) the plain renderer draws the frame.
export const COMPOSER_OF = new WeakMap();
function ComposerHook() {
  const gl = useThree(s => s.gl);
  useEffect(() => () => { COMPOSER_OF.delete(gl); }, [gl]);
  return null;
}
// `ao` and `bloom` override the defaults per scene (radius in world units).
export function Effects({ ao = {}, bloom = {}, guard = true }) {
  const on = useFx(fxOn);
  if (!on) return null;
  return (
    <>
      <ComposerHook />
      <EffectComposer multisampling={0} ref={(c) => { if (c && c.getRenderer) COMPOSER_OF.set(c.getRenderer(), c); }}>
        <N8AO halfRes quality="performance" aoRadius={1.7} distanceFalloff={0.9} intensity={3.0} {...ao} />
        <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.15} intensity={0.35} radius={0.6} {...bloom} />
        {/* grade (Drop 45): a touch of contrast and saturation back after the AgX tone curve, and a soft vignette;
            these merge into the bloom's pass, so they add no render target */}
        <BrightnessContrast brightness={0} contrast={0.07} />
        <HueSaturation hue={0} saturation={0.07} />
        <Vignette offset={0.32} darkness={0.42} eskil={false} />
        <SMAA />
      </EffectComposer>
      {guard && <Guard />}
    </>
  );
}

// ---------------------------------------------------------------- diagnostics
// Diagnostics (Drop 43, extended in Drop 86): what the renderer is doing, for the Stats card on the toolbar, and a
// record of it in the browser's own storage (padworks.diag) every three seconds: device tier, quality, GPU name,
// frame rate, draw calls, texture count and GPU bytes, geometry bytes, frame buffer bytes, JavaScript heap, and any
// loss of the graphics context. Nothing leaves the browser. A session that ends without the page closing (the tab
// killed for memory, a browser crash) leaves its last record behind without the clean-close mark; the next visit
// keeps that record as `padworks.diag.last` and the card shows it, with a Copy button, so the numbers from the
// machine that failed can be sent along. `shaderError` keeps the first program error the renderer reports, which
// is the one thing a person cannot see without opening the developer tools.
const DIAG_KEY = 'padworks.diag', LAST_KEY = 'padworks.diag.last';
const readJson = (k) => { try { const v = window.localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const writeJson = (k, v) => { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or off */ } };
const startedAt = Date.now();
let lost = 0;
export function noteContextLoss() { lost++; const d = useDiag.getState(); d.set({ lost }); if (d.record) writeJson(DIAG_KEY, { ...d.record, lost, lostAt: new Date().toISOString() }); }

// at load: whatever the previous visit left behind without a clean close becomes the "last session" record
function adoptLastSession() {
  if (typeof window === 'undefined') return null;
  const prev = readJson(DIAG_KEY);
  if (prev && prev.ended !== 'clean') writeJson(LAST_KEY, { ...prev, unclean: true });
  try { window.localStorage.removeItem(DIAG_KEY); } catch { /* ignore */ }
  const last = readJson(LAST_KEY);
  const clean = () => { const d = useDiag.getState(); if (d.record) writeJson(DIAG_KEY, { ...d.record, ended: 'clean', at: new Date().toISOString() }); };
  window.addEventListener('pagehide', clean);
  window.addEventListener('beforeunload', clean);
  return last;
}
export const useDiag = create((set) => ({
  fps: 0, frameMs: 0, calls: 0, triangles: 0, gpu: GPU.name || '', shaderError: '', dpr: 0,
  textures: 0, texMB: 0, geoMB: 0, rtMB: 0, heapMB: 0, programs: 0, lost: 0, record: null,
  last: adoptLastSession(),
  set: (patch) => set(patch),
  clearLast: () => { try { window.localStorage.removeItem(LAST_KEY); } catch { /* ignore */ } set({ last: null }); },
}));

// GPU memory as the scene holds it: every texture any material, uniform, detail set, sky or shadow map refers
// to, every geometry's buffers, and the frame buffers the canvas and the composer own at the current size
function estimate(gl, scene) {
  const texs = new Set(), geos = new Set(); let rt = 0;
  const addTex = (t) => { if (t && t.isTexture) texs.add(t); };
  const addMat = (m) => {
    if (!m) return;
    for (const k in m) { const v = m[k]; if (v && v.isTexture) texs.add(v); }
    if (m.uniforms) for (const k in m.uniforms) { const u = m.uniforms[k]; if (u && u.value && u.value.isTexture) texs.add(u.value); }
  };
  scene.traverse(o => {
    if (o.geometry) geos.add(o.geometry);
    const m = o.material; if (Array.isArray(m)) m.forEach(addMat); else addMat(m);
    if (o.isLight && o.shadow && o.shadow.map) rt += o.shadow.map.width * o.shadow.map.height * 8;
  });
  addTex(scene.background); addTex(scene.environment);
  for (const fam in DETAIL) { const D = DETAIL[fam]; for (const k of ['map', 'normal', 'rough', 'ao']) if (D[k]) addTex(D[k].value); }
  let tex = 0; for (const t of texs) tex += textureBytes(t);
  if (scene.environment && !scene.environment.isCubeTexture) tex += 256 * 256 * 8 * 6 * 1.2;   // the prefiltered environment the renderer keeps per equirect map
  let geo = 0; for (const g of geos) { for (const k in g.attributes) { const a = g.attributes[k]; if (a && a.array) geo += a.array.byteLength; } if (g.index && g.index.array) geo += g.index.array.byteLength; }
  const size = gl.getDrawingBufferSize(new THREE.Vector2());
  const px = size.x * size.y;
  const aa = (() => { try { return !!gl.getContext().getContextAttributes().antialias; } catch { return true; } })();
  rt += px * (aa ? 36 : 8);                                   // the canvas: color and depth, four samples each with antialiasing plus the resolve
  if (COMPOSER_OF.get(gl)) rt += px * 35;                     // two half-float buffers, the occlusion's half-size targets, the bloom chain, SMAA's edges and weights
  return { textures: gl.info.memory.textures, texMB: Math.round(tex / 1e6), geoMB: Math.round(geo / 1e6), rtMB: Math.round(rt / 1e6), programs: gl.info.programs ? gl.info.programs.length : 0, size: [size.x, size.y] };
}

export function Diagnostics() {
  const samples = useRef([]); const last = useRef(0); const lastRecord = useRef(0);
  useFrame((state, dt) => {
    const gl = state.gl;
    if (typeof window !== 'undefined' && window.__padworksGL !== gl) window.__padworksGL = gl;   // test hook
    if (!useDiag.getState().gpu || useDiag.getState().gpu === 'unknown') {
      let gpu = 'unknown';
      try { const ctx = gl.getContext(); const ext = ctx.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER); } catch { /* keep unknown */ }
      useDiag.getState().set({ gpu });
    }
    if (!gl.debug.onShaderError || !gl.debug.onShaderError.padworks) {
      gl.debug.onShaderError = (ctx, program, vs, fs) => { const log = (ctx.getProgramInfoLog(program) || '') + ' ' + (ctx.getShaderInfoLog(fs) || '') + ' ' + (ctx.getShaderInfoLog(vs) || ''); useDiag.getState().set({ shaderError: log.trim().slice(0, 300) }); };
      gl.debug.onShaderError.padworks = true;
    }
    if (dt < 2) samples.current.push(dt);   // a frame up to two seconds is a measurement (the slow machines are the ones to report on); longer is a hidden tab
    const now = state.clock.elapsedTime;
    // the counters accumulate over the whole previous frame (with the effects on, a frame is several passes and the
    // renderer's own per-render reset would leave only the last quad), and are reset here, before this frame draws
    gl.info.autoReset = false;
    const r = gl.info.render;
    if (typeof window !== 'undefined') window.__padworksStats = { calls: r.calls, triangles: r.triangles, geometries: gl.info.memory.geometries, frame: r.frame };   // test hook
    if (now - last.current > 0.5 && samples.current.length) {
      const avg = samples.current.reduce((a, b) => a + b, 0) / samples.current.length;
      samples.current = []; last.current = now;
      useDiag.getState().set({ fps: Math.round(1 / Math.max(1e-3, avg)), frameMs: Math.round(avg * 1000), calls: r.calls, triangles: r.triangles, dpr: Math.round(gl.getPixelRatio() * 100) / 100 });
    } else if (now - last.current > 2.5 && r.calls && !useDiag.getState().calls) useDiag.getState().set({ calls: r.calls, triangles: r.triangles });   // no sample yet (every frame slower than two seconds): the counts at least
    if (now - lastRecord.current > 3) {
      lastRecord.current = now;
      let est = null; try { est = estimate(gl, state.scene); } catch { /* a scene mid-rebuild */ }
      const mem = typeof performance !== 'undefined' && performance.memory ? performance.memory : null;
      const d = useDiag.getState();
      const record = {
        at: new Date().toISOString(), seconds: Math.round((Date.now() - startedAt) / 1000), path: window.location.pathname,
        tier: TIER.id, quality: LITE ? 'lite' : 'full', effects: !!COMPOSER_OF.get(gl), gpu: d.gpu, dpr: Math.round(gl.getPixelRatio() * 100) / 100,
        size: est ? est.size : [0, 0], fps: d.fps, frameMs: d.frameMs, draws: r.calls, triangles: r.triangles,   // the previous frame's counters (the half-second averages skip frames over 500 ms)
        textures: est ? est.textures : 0, texMB: est ? est.texMB : 0, geoMB: est ? est.geoMB : 0, rtMB: est ? est.rtMB : 0, programs: est ? est.programs : 0,
        heapMB: mem ? Math.round(mem.usedJSHeapSize / 1e6) : null, heapLimitMB: mem ? Math.round(mem.jsHeapSizeLimit / 1e6) : null,
        lost, shaderError: d.shaderError || '', ended: 'running',
      };
      d.set({ ...(est || {}), heapMB: record.heapMB || 0, record });
      writeJson(DIAG_KEY, record);
      if (typeof window !== 'undefined') window.__padworksDiag = () => ({ record: useDiag.getState().record, last: useDiag.getState().last });   // test hook
    }
    gl.info.reset();
  });
  return null;
}
// a short line for the card and the clipboard
export function diagLine(r) {
  if (!r) return '';
  const t = new Date(r.at); const when = isNaN(t) ? '' : t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${when} after ${Math.round((r.seconds || 0) / 60)} min on ${r.path || '/'}: ${r.quality === 'lite' ? 'Lite' : 'Full'}, ${r.tier} tier, effects ${r.effects ? 'on' : 'off'}, ${r.size ? r.size.join('x') : '?'} @ ${r.dpr}x, ${r.fps} fps, ${r.draws} draws, ${r.textures} textures ~${r.texMB} MB, geometry ~${r.geoMB} MB, buffers ~${r.rtMB} MB${r.heapMB != null ? ', heap ' + r.heapMB + ' of ' + r.heapLimitMB + ' MB' : ''}${r.lost ? ', context lost ' + r.lost + 'x' : ''}${r.shaderError ? ', shader error' : ''} · GPU: ${r.gpu}`;
}
