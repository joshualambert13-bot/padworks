// Postprocessing for Full quality: screen-space ambient occlusion (N8AO) so parts sit on the deck and the ground
// instead of floating, and bloom on the few things that are brighter than white (sun disk, pressure glow in the
// fractures, the perforating flash, mill sparks). Lite mode never mounts it. A frame-time guard watches the first
// seconds with the effects on and turns them off for the session when the average frame is slow, so a laptop
// with a weak GPU still gets a usable frame rate; the Effects button turns them back on.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, N8AO, Bloom } from '@react-three/postprocessing';
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
        <N8AO halfRes quality="performance" aoRadius={1.2} distanceFalloff={1.0} intensity={2.2} {...ao} />
        <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.15} intensity={0.35} radius={0.6} {...bloom} />
      </EffectComposer>
      {guard && <Guard />}
    </>
  );
}
