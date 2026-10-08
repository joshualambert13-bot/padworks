// Device tiers (Drop 86). The pad used to be built the same for every screen and left the browser to cope: a phone was
// handed 2k detail sets, 1k props, a 2k shadow map and a 1.5x render buffer, and killed the tab when the GPU ran out.
// Now the device is classed once, before anything loads, and every size follows the class:
//
//   phone    a phone or small tablet: pixel ratio 1, 1k shadow map, 512 px props and crew, 1k detail sets, 1k sky,
//            effects off unless turned on
//   laptop   everything else: pixel ratio up to 1.5, 2k shadow map, 1k props and crew, 2k ground and terrain, 2k sky
//
// `?tier=phone` or `?tier=laptop` on the address forces a class (for a look at the other one, and for the checks);
// localStorage padworks.tier keeps a choice. The GPU name and the compressed-texture formats come from one probe
// context (gpu.js), so nothing here needs the canvas to exist yet.
import { GPU } from './gpu.js';

const SETTINGS = {
  phone: { id: 'phone', dpr: 1, shadow: 1024, models: 512, detail: 1024, sky: '1k', fx: false, anisotropy: 4, suffix: '.phone' },
  laptop: { id: 'laptop', dpr: 1.5, shadow: 2048, models: 1024, detail: 2048, sky: '2k', fx: true, anisotropy: 8, suffix: '' },
};

function detect() {
  try {
    const q = new URLSearchParams(window.location.search);
    const forced = q.get('tier') || window.localStorage.getItem('padworks.tier');
    if (forced && SETTINGS[forced]) return { id: forced, forced: true };
    const ua = navigator.userAgent || '';
    const uaData = navigator.userAgentData;
    if (uaData && uaData.mobile) return { id: 'phone' };
    if (/Android|iPhone|iPod|Mobile/i.test(ua)) return { id: 'phone' };
    const touch = (navigator.maxTouchPoints || 0) > 0;
    const small = Math.min(window.screen.width, window.screen.height) < 900;
    if (touch && small) return { id: 'phone' };                       // iPad mini and small Android tablets; an iPad Pro reads as a laptop
    if (/Mali|Adreno|PowerVR/i.test(GPU.name) && touch) return { id: 'phone' };   // a phone GPU behind a desktop user agent
    return { id: 'laptop' };
  } catch { return { id: 'laptop' }; }
}

const picked = typeof window === 'undefined' ? { id: 'laptop' } : detect();
export const TIER = { ...SETTINGS[picked.id], forced: !!picked.forced };
export function setTier(id) { try { if (SETTINGS[id]) window.localStorage.setItem('padworks.tier', id); else window.localStorage.removeItem('padworks.tier'); } catch { /* ignore */ } window.location.reload(); }
export const TIERS = Object.keys(SETTINGS);
