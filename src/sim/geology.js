// Bed stack around the lateral and the stress contrasts that contain a fracture (Drop 33). Display meters with the
// lateral at y = 0: the target shale band is 0.8 m each way, a limestone barrier sits above and below it, a sand
// (low stress, fast height growth once reached) above that, then another shale. The contrasts are training
// numbers in psi of net pressure, not a stress log: a fracture stays in the target band until net pressure exceeds
// the barrier's contrast, works through the barrier over the next `span` psi, then runs through the sand quickly.
// The lower barrier is a little stronger than the upper one, so height growth is biased upward as it usually is.
// Viscous fluids grow height faster for the same net pressure (`viscosityFactor`).
export const BEDS = [
  { y: 4.8, h: 1.4, color: '#8c7a5e', kind: 'sand' },
  { y: 3.5, h: 1.2, color: '#5e5040', kind: 'shale' },
  { y: 2.3, h: 1.2, color: '#9a8a66', kind: 'sand' },
  { y: 1.25, h: 0.9, color: '#6f7a84', kind: 'lime' },
  { y: 0, h: 1.6, color: '#3f4a55', kind: 'shale', bore: true },
  { y: -1.25, h: 0.9, color: '#6f7a84', kind: 'lime' },
  { y: -2.3, h: 1.2, color: '#8a7a5a', kind: 'sand' },
  { y: -3.5, h: 1.2, color: '#55483a', kind: 'shale' },
  { y: -4.8, h: 1.4, color: '#5a4e40', kind: 'sand' },
];
export const TARGET_HALF = 0.8;          // half height of the target band
export const BARRIER_TOP = 1.7;          // top of the upper limestone: beyond this the fracture is out of zone
// Height steps above (and, with `lowerBias`, below) the lateral: each is [reach in m, contrast psi, span psi]
const STEPS = [[0.9, 700, 450], [1.2, 1150, 350], [1.2, 2200, 600]];
const LOWER_BIAS = 80;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const viscosityFactor = (fluid) => 1 + 0.25 * ((fluid && fluid.transport) || 1) - 0.25;
// Height reached at a net pressure: { top, bot } in display meters above and below the lateral.
export function fracHeight(netPsi, visc = 1) {
  const net = Math.max(0, netPsi) * visc;
  let top = TARGET_HALF, bot = TARGET_HALF;
  for (const [reach, psi, span] of STEPS) { top += reach * clamp01((net - psi) / span); bot += reach * clamp01((net - psi - LOWER_BIAS) / span); }
  return { top, bot };
}
// Plain-language zone for a reached height
export function heightZone(top) {
  if (top <= TARGET_HALF + 0.02) return { id: 'contained', label: 'Contained', warn: false };
  if (top < BARRIER_TOP) return { id: 'barrier', label: 'Into barrier', warn: false };
  return { id: 'out', label: 'Out of zone', warn: true };
}
