// Terrain height and noise shared by the ground, vegetation, and horizon.
// Value noise, deterministic, for relief and color variation.
const hash2 = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = smooth(x - i), fz = smooth(z - j);
  return lerp(lerp(hash2(i, j), hash2(i + 1, j), fx), lerp(hash2(i, j + 1), hash2(i + 1, j + 1), fx), fz);
}
export function terrainNoise(x, z) { return vnoise(x, z) * 0.6 + vnoise(x * 2.3 + 7.1, z * 2.3 + 3.7) * 0.28 + vnoise(x * 5.1 + 2.3, z * 5.1 + 9.1) * 0.12; }
// Height of the natural ground at (x, z): rolling relief scaled by the basin, flattened across the pad.
// The lease road leaves the pad's +X edge at z = pad.z0 + 12 and runs 320 m; its corridor is graded flat (cut and
// fill) so the road surface and anything driving on it sit on the ground.
export function terrainHeight(x, z, relief, pad) {
  const base = (terrainNoise(x / 55, z / 55) - 0.5) * 2 * relief * 2.2 + (relief > 1.2 ? (terrainNoise(x / 170 + 5, z / 170 + 2) - 0.5) * 2 * relief * 5 : 0);
  const dx = Math.max(pad.x0 - x, 0, x - pad.x1), dz = Math.max(pad.z0 - z, 0, z - pad.z1);
  const dist = Math.sqrt(dx * dx + dz * dz);
  const kPad = smooth(Math.max(0, Math.min(1, (dist - 4) / 30)));
  const roadZ = pad.z0 + 12;
  const onRoadX = x > pad.x1 - 2 && x < pad.x1 + 330;
  const dRoad = onRoadX ? Math.abs(z - roadZ) : 1e9;
  const kRoad = smooth(Math.max(0, Math.min(1, (dRoad - 5) / 14)));
  return base * Math.min(kPad, kRoad) - 0.02;
}

