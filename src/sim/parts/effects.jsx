// Postprocessing for Full quality: screen-space ambient occlusion (N8AO) so parts sit on the deck and the ground
// instead of floating, and bloom on the few things that are brighter than white (sun disk, pressure glow in the
// fractures, the perforating flash, mill sparks). Lite mode never mounts it. A frame-time guard watches the first
// seconds with the effects on and turns them off for the session when the average frame is slow, so a laptop
// with a weak GPU still gets a usable frame rate; the Effects button turns them back on.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, N8AO, Bloom, BrightnessContrast, HueSaturation, Vignette } from '@react-three/postprocessing';
import { create } from 'zustand';
import { LITE } from './lighting.jsx';

const KEY = 'padworks.fx';
const stored = () => { try { return window.localStorage.getItem(KEY); } catch { return null; } };
export const useFx = create((set) => ({
  wanted: !LITE && stored() !== 'off',      // the person's choice; on by default in Full quality
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

// `ao` and `bloom` override the defaults per scene (radius in world units).
export function Effects({ ao = {}, bloom = {}, guard = true }) {
  const on = useFx(fxOn);
  if (!on) return null;
  return (
    <>
      <EffectComposer multisampling={4}>
        <N8AO halfRes quality="performance" aoRadius={1.7} distanceFalloff={0.9} intensity={3.0} {...ao} />
        <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.15} intensity={0.35} radius={0.6} {...bloom} />
        {/* grade (Drop 45): a touch of contrast and saturation back after the AgX tone curve, and a soft vignette;
            these merge into the bloom's pass, so they add no render target */}
        <BrightnessContrast brightness={0} contrast={0.07} />
        <HueSaturation hue={0} saturation={0.07} />
        <Vignette offset={0.32} darkness={0.42} eskil={false} />
      </EffectComposer>
      {guard && <Guard />}
    </>
  );
}

// Diagnostics (Drop 43): what the renderer is doing, for the Stats readout on the toolbar. Filled by `Diagnostics`
// inside the surface canvas; `shaderError` keeps the first program error the renderer reports, which is the one
// thing a person cannot see without opening the developer tools.
export const useDiag = create((set) => ({ fps: 0, frameMs: 0, calls: 0, triangles: 0, gpu: '', shaderError: '', dpr: 0, set: (patch) => set(patch) }));
export function Diagnostics() {
  const samples = useRef([]); const last = useRef(0);
  useFrame((state, dt) => {
    const gl = state.gl;
    if (typeof window !== 'undefined' && window.__padworksGL !== gl) window.__padworksGL = gl;   // test hook
    if (!useDiag.getState().gpu) {
      let gpu = 'unknown';
      try { const ctx = gl.getContext(); const ext = ctx.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER); } catch { /* keep unknown */ }
      gl.debug.onShaderError = (ctx, program, vs, fs) => { const log = (ctx.getProgramInfoLog(program) || '') + ' ' + (ctx.getShaderInfoLog(fs) || '') + ' ' + (ctx.getShaderInfoLog(vs) || ''); useDiag.getState().set({ shaderError: log.trim().slice(0, 300) }); };
      useDiag.getState().set({ gpu });
    }
    if (dt < 0.5) samples.current.push(dt);
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
    }
    gl.info.reset();
  });
  return null;
}
