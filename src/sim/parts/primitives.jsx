// Procedural building blocks shared by the surface and downhole scenes.
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { wearTexture, grimeTexture, streakTexture, brushedTexture, treadTexture, cableTexture, BlobShadow, LITE } from './lighting.jsx';
import { useFrame } from '@react-three/fiber';

// ---------------------------------------------------------------- merged static geometry
// Repeated furniture (wheels, rails, ladders, stairs, fittings) is merged into one BufferGeometry per
// material so a trailer costs a handful of draw calls instead of dozens. Parts: { g: geometry factory result,
// p: position, r: rotation (Euler), s: scale }. Geometries are cloned, transformed, merged, and released.
const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  rbox: (w, h, d, r = 0.06, seg = 2) => mergeVertices(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2))),   // rounded edges (indexed so it merges with the rest)
  cyl: (r, h, seg, r2) => new THREE.CylinderGeometry(r2 ?? r, r, h, seg || (r < 0.1 ? 8 : r < 0.25 ? 12 : r < 0.7 ? 16 : 24)),
  cylOpen: (r, h, seg, thetaStart, thetaLength) => new THREE.CylinderGeometry(r, r, h, seg, 1, true, thetaStart, thetaLength),
  sphere: (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h),
  torus: (r, t, rs = 6, ts = 16) => new THREE.TorusGeometry(r, t, rs, ts),
};
export const GEO = G;
export function buildMerged(parts) {
  const colored = parts.some(x => x.c);   // a part color `c` becomes a vertex color (the material then needs vertexColors)
  const col = new THREE.Color();
  const geoms = parts.map(({ g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], c: tint }) => {
    const c = g;   // factories hand over fresh indexed geometries; merge keeps the indices
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
    c.applyMatrix4(m);
    if (c.attributes.uv2) c.deleteAttribute('uv2');
    if (colored) {
      col.set(tint || '#ffffff');
      const n = c.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
      c.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    return c;
  });
  const merged = mergeGeometries(geoms, false);
  geoms.forEach(g => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}
export function useMerged(factory, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => buildMerged(factory()), deps);
}
export function Merged({ parts, deps = [], mat = MAT.steel, name, position = [0, 0, 0], rotation = [0, 0, 0], doubleSide = false, shadow = true, vertexColors = false }) {
  const geom = useMerged(() => parts(), deps);
  const m = vertexColors ? { ...mat, vertexColors: true } : mat;
  return <mesh geometry={geom} position={position} rotation={rotation} name={name} castShadow={shadow} receiveShadow><Mat mat={m} side={doubleSide ? THREE.DoubleSide : THREE.FrontSide} /></mesh>;
}

// Materials respond to the sky environment map (Drop 12): bare metal is metallic and fairly smooth, paint is
// dielectric with a shared wear map that varies its roughness, rubber and tires are rough and dark.
// Drop 23: paint carries a dirt map, a light bump from the wear map, and a clearcoat (Full only: the clearcoat
// turns the material into MeshPhysicalMaterial, see Mat); bare metal gets a brushed roughness map; tanks and
// silos use a streak map so dust and rust run down from the seams.
const wear = typeof document !== 'undefined' ? wearTexture() : null;
const grime = typeof document !== 'undefined' ? grimeTexture() : null;
const streak = typeof document !== 'undefined' ? streakTexture() : null;
const brushed = typeof document !== 'undefined' ? brushedTexture() : null;
const tread = typeof document !== 'undefined' ? treadTexture() : null;
// Bare metal in Lite: without an environment map a metalness of 0.9 has nothing to reflect and renders black, so
// Lite caps metalness at 0.35 (direct and hemisphere light then shade it like a dull gray) and lifts the roughness.
export const metal = (color, metalness, roughness, extra = {}) => ({ color, metalness: LITE ? Math.min(metalness, 0.35) : metalness, roughness: LITE ? Math.max(roughness, 0.4) : roughness, ...extra });
const paint = (color, roughness = 0.55, metalness = 0.12, map = grime) => ({ color, metalness, roughness, roughnessMap: wear || undefined, map: map || undefined, bumpMap: LITE ? undefined : wear || undefined, bumpScale: 0.006, clearcoat: 0.4, clearcoatRoughness: 0.35 });
const tankPaint = (color) => paint(color, 0.6, 0.1, streak);
export const MAT = {
  steel:   metal('#9aa2ab', 0.9, 0.32, { roughnessMap: brushed || undefined }),
  darkSteel: metal('#4d565f', 0.8, 0.45, { roughnessMap: brushed || undefined, map: grime || undefined }),
  tankWhite: tankPaint('#e4e8ec'),
  tankCream: tankPaint('#d9cfae'),
  tankBlue:  tankPaint('#2a5d9f'),
  tankGreen: tankPaint('#2e8b57'),
  redIron: paint('#9e2a22', 0.5, 0.2),
  yellow:  paint('#d9a400', 0.55),
  white:   paint('#d7dde5', 0.55),
  blue:    paint('#2a5d9f', 0.5),
  green:   paint('#2e8b57', 0.5),
  rubber:  { color: '#1d1f22', metalness: 0.0, roughness: 0.92 },
  brass:   metal('#b8944a', 0.95, 0.3),
  tire:    { color: '#1a1c1e', metalness: 0.0, roughness: 0.95, map: tread || undefined, bumpMap: LITE ? undefined : tread || undefined, bumpScale: 0.02 },
  tape:    { color: '#f2f2f2', metalness: 0.2, roughness: 0.25 },
  ground:  { color: '#4b4235', metalness: 0.0, roughness: 1.0 },
  sand:    { color: '#c9b47a', metalness: 0.0, roughness: 1.0 },
  dimSteel: metal('#2c3137', 0.7, 0.6),
  paintRed: paint('#8f1f1f', 0.5, 0.15),
  paintWhite: paint('#e4e8ec', 0.5),
  cream:   paint('#d9cfae', 0.55),
  alu:     metal('#c3c8cd', 0.95, 0.28, { roughnessMap: brushed || undefined }),
  chassis: paint('#2a2d31', 0.7, 0.3),
  grating: metal('#3a3f45', 0.7, 0.7),
  glass:   metal('#20304a', 0.9, 0.06),
  glassLit: { color: '#ffe6a8', emissive: '#ffd98a', emissiveIntensity: 0.9, metalness: 0.1, roughness: 0.3 },   // lit windows after dark (Drop 31)
  hose:    { color: '#24262a', metalness: 0.05, roughness: 0.85 },
  orange:  paint('#d9642a', 0.55),
  rust:    { color: '#6e4a2c', metalness: 0.35, roughness: 0.85 },
  black:   paint('#0e0f11', 0.75, 0.3),
};

// Material element for a MAT entry. A clearcoat asks for MeshPhysicalMaterial (the second specular lobe is what
// makes paint read as paint); in Lite the clearcoat keys are dropped and the cheaper standard material is used.
const CLEARCOAT_KEYS = ['clearcoat', 'clearcoatRoughness'];
export function stdProps(mat) { const o = { ...mat }; CLEARCOAT_KEYS.forEach(k => delete o[k]); return o; }
export function Mat({ mat = MAT.steel, side }) {
  if (!LITE && mat.clearcoat != null) return <meshPhysicalMaterial {...mat} side={side} />;
  return <meshStandardMaterial {...stdProps(mat)} side={side} />;
}

export function Box({ size = [1, 1, 1], position = [0, 0, 0], rotation = [0, 0, 0], mat = MAT.steel, name, castShadow = true, children, ...rest }) {
  return (
    <mesh position={position} rotation={rotation} name={name} castShadow={castShadow} receiveShadow {...rest}>
      <boxGeometry args={size} />
      <Mat mat={mat} />
      {children}
    </mesh>
  );
}
// Box with rounded edges: sheet-metal bodies, cabs, cabinets, castings. `r` is the edge radius (clamped to the
// smallest half-dimension); `seg` 2 gives a smooth fillet at 300 triangles, 1 a chamfer-like fillet at 108.
export function RBox({ size = [1, 1, 1], r = 0.08, seg = 2, position = [0, 0, 0], rotation = [0, 0, 0], mat = MAT.steel, name, castShadow = true, children, ...rest }) {
  const geom = useMemo(() => G.rbox(size[0], size[1], size[2], r, seg), [size[0], size[1], size[2], r, seg]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <mesh geometry={geom} position={position} rotation={rotation} name={name} castShadow={castShadow} receiveShadow {...rest}>
      <Mat mat={mat} />
      {children}
    </mesh>
  );
}

// Segment count follows the radius: small fittings do not need a 24-sided profile.
export const segFor = (r) => (r < 0.1 ? 8 : r < 0.25 ? 12 : r < 0.7 ? 16 : 24);
export function Cyl({ r = 0.5, r2, h = 1, position = [0, 0, 0], rotation = [0, 0, 0], mat = MAT.steel, name, segments, open = false, thetaStart, thetaLength, ...rest }) {
  segments = segments || segFor(Math.max(r, r2 || 0));
  const args = thetaLength !== undefined
    ? [r2 ?? r, r, h, segments, 1, open, thetaStart || 0, thetaLength]
    : [r2 ?? r, r, h, segments, 1, open];
  return (
    <mesh position={position} rotation={rotation} name={name} castShadow receiveShadow {...rest}>
      <cylinderGeometry args={args} />
      <Mat mat={mat} side={open ? THREE.DoubleSide : THREE.FrontSide} />
    </mesh>
  );
}

// Hammer-union: the wing nut (a short thick ring with three lugs) over the male sub collar, with the female sub's
// shoulder beside it, so every joint on the iron reads as a union rather than a ring on a pipe. One draw call.
const nutParts = (r) => [
  { g: G.cyl(r * 1.7, r * 2.0, 14) },
  ...[0, 120, 240].map(a => ({ g: G.box(r * 1.2, r * 1.3, r * 0.7), p: [Math.cos(THREE.MathUtils.degToRad(a)) * r * 1.9, 0, -Math.sin(THREE.MathUtils.degToRad(a)) * r * 1.9], r: [0, THREE.MathUtils.degToRad(a), 0] })),
  { g: G.cyl(r * 1.45, r * 0.6, 14), p: [0, -r * 1.3, 0] },        // female sub shoulder
  { g: G.cyl(r * 1.3, r * 0.8, 14), p: [0, r * 1.4, 0] },          // male sub collar
];
export function UnionNut({ position = [0, 0, 0], rotation = [0, 0, 0], r = 0.05 }) {
  return <Merged parts={() => nutParts(r)} deps={[r]} mat={MAT.darkSteel} position={position} rotation={rotation} shadow={false} />;
}

// Pipe between two points, with hammer unions (lugged nuts) at the ends.
export function Pipe({ from, to, r = 0.05, mat = MAT.redIron, unions = true, name }) {
  const { position, rotation, length } = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(b, a);
    const length = dir.length();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const euler = new THREE.Euler().setFromQuaternion(quat);
    return { position: [mid.x, mid.y, mid.z], rotation: [euler.x, euler.y, euler.z], length };
  }, [from, to]);
  return (
    <group position={position} rotation={rotation} name={name}>
      <mesh castShadow>
        <cylinderGeometry args={[r, r, length, 12]} />
        <Mat mat={mat} />
      </mesh>
      {unions && length > 0.6 && (
        <>
          <UnionNut position={[0, length / 2 - r * 1.6, 0]} r={r} />
          <UnionNut position={[0, -length / 2 + r * 1.6, 0]} r={r} />
        </>
      )}
    </group>
  );
}

// Polyline of pipes through a list of points
export function PipeRun({ points, r = 0.05, mat = MAT.redIron, name }) {
  return (
    <group name={name}>
      {points.slice(1).map((p, i) => <Pipe key={i} from={points[i]} to={p} r={r} mat={mat} />)}
      {points.slice(1, -1).map((p, i) => (
        <mesh key={'j' + i} position={p}><sphereGeometry args={[r * 1.5, 12, 12]} /><meshStandardMaterial {...MAT.darkSteel} /></mesh>
      ))}
    </group>
  );
}

// Pipe stands under the near-level, off-the-ground legs of a pipe run: a base plate, a post, and a saddle under
// the pipe, every `every` meters, merged into one draw call (Drop 24). Legs below 0.35 m stay on the ground.
export function PipeStands({ points, r = 0.1, every = 3.0, mat = MAT.chassis, name }) {
  const specs = useMemo(() => {
    const out = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const len = Math.hypot(...d) || 1;
      if (Math.abs(d[1]) / len > 0.3 || len < every * 0.8) continue;
      const n = Math.max(1, Math.floor(len / every));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const p = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
        const h = p[1] - r - 0.04; if (h < 0.35) continue;
        out.push({ x: p[0], z: p[2], h, yaw: Math.atan2(d[0], d[2]) });
      }
    }
    return out;
  }, [points, r, every]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!specs.length) return null;
  return <Merged mat={mat} deps={[specs]} name={name} parts={() => specs.flatMap(({ x, z, h, yaw }) => [
    { g: G.box(0.5, 0.04, 0.5), p: [x, 0.02, z], r: [0, yaw, 0] },
    { g: G.box(0.1, h - 0.04, 0.1), p: [x, 0.04 + (h - 0.04) / 2, z] },
    { g: G.box(0.46, 0.08, 0.28), p: [x, h, z], r: [0, yaw, 0] },
  ])} />;
}

// A line that moves: a tube along a polyline with a stripe map scrolled by `travel` (a ref holding meters of line
// paid out) so the cable or tubing visibly runs over its sheaves (Drop 26). One draw call.
export function Cable({ points, r = 0.012, mat = MAT.rubber, travel = null, stripe = 0.4, contrast = 1, segmentsPerLeg = 12 }) {
  const key = JSON.stringify(points) + r;
  const { geom, length } = useMemo(() => {
    const path = new THREE.CurvePath();
    for (let i = 1; i < points.length; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i - 1]), new THREE.Vector3(...points[i])));
    const g = new THREE.TubeGeometry(path, segmentsPerLeg * (points.length - 1), r, 8, false);
    return { geom: g, length: path.getLength() };
  }, [key, segmentsPerLeg]);   // eslint-disable-line react-hooks/exhaustive-deps
  const tex = useMemo(() => { const base = cableTexture(); if (!base) return null; const t = base.clone(); t.needsUpdate = true; t.repeat.set(length / (stripe * 4), 1); return t; }, [length, stripe]);
  useFrame(() => { if (tex && travel) tex.offset.x = -travel.current / (stripe * 4); });
  const color = new THREE.Color(mat.color).lerp(new THREE.Color('#ffffff'), 0.25 * contrast);   // the stripe map darkens half the length, so lift the base a little
  return <mesh geometry={geom} castShadow={false}><meshStandardMaterial {...stdProps(mat)} color={color} map={tex || undefined} /></mesh>;
}

// Hydraulic cylinder between two points: barrel from `from`, chrome rod to `to`, clevis eyes at both ends. One draw call
// each for the barrel and the rod; `stroke` 0..1 is how much rod shows (the barrel is 55 percent of the span).
export function HydraulicCylinder({ from, to, r = 0.12, barrel = 0.55, mat = MAT.chassis }) {
  const key = JSON.stringify([from, to, r, barrel]);
  const { position, rotation, length } = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(b, a); const length = dir.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const e = new THREE.Euler().setFromQuaternion(quat);
    return { position: [a.x, a.y, a.z], rotation: [e.x, e.y, e.z], length };
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  const bl = length * barrel;
  return (
    <group position={position} rotation={rotation}>
      <Merged mat={mat} deps={[key]} parts={() => [{ g: G.cyl(r, bl, 14), p: [0, bl / 2, 0] }, { g: G.cyl(r * 1.15, r * 0.6, 14), p: [0, bl - r * 0.3, 0] }, { g: G.cyl(r * 0.9, r * 1.2, 10), p: [0, -r * 0.3, 0] }, { g: G.box(r * 1.6, r * 1.2, r * 2.2), p: [0, -r * 0.9, 0] }]} />
      <Merged mat={MAT.alu} deps={[key]} shadow={false} parts={() => [{ g: G.cyl(r * 0.55, length - bl + r, 10), p: [0, bl + (length - bl - r) / 2, 0] }, { g: G.box(r * 1.4, r * 1.2, r * 2.0), p: [0, length - r * 0.3, 0] }]} />
    </group>
  );
}

// Flexible hose or cable: a tube along a curve that sags between its ends.
export function Hose({ from, to, r = 0.06, sag = 0.4, mat = MAT.hose, segments = 16, name }) {
  const geom = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5); mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    return new THREE.TubeGeometry(curve, segments, r, 8, false);
  }, [from, to, r, sag, segments]);
  return <mesh geometry={geom} name={name}><meshStandardMaterial {...mat} /></mesh>;
}

// Wheel with a rim and hub; `dual` draws a second tire alongside. Two draw calls (tires, rims).
const tireParts = (r, w, dual) => [{ g: G.cyl(r, dual ? w * 2.1 : w, 20) }];
const rimParts = (r, w, dual) => [{ g: G.cyl(r * 0.6, (dual ? w * 2.1 : w) + 0.02, 10) }, { g: G.cyl(r * 0.22, (dual ? w * 2.1 : w) + 0.1, 8) }];
export function Wheel({ position, r = 0.5, w = 0.3, dual = false, mat = MAT.tire }) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <Merged parts={() => tireParts(r, w, dual)} deps={[r, w, dual]} mat={mat} />
      <Merged parts={() => rimParts(r, w, dual)} deps={[r, w, dual]} mat={MAT.alu} />
    </group>
  );
}

// Handrail along X: posts and two rails, one draw call.
export function Handrail({ length = 4, position = [0, 0, 0], rotation = [0, 0, 0], height = 1.05, posts, mat = MAT.alu }) {
  const n = posts || Math.max(2, Math.round(length / 1.5) + 1);
  return <Merged position={position} rotation={rotation} mat={mat} deps={[length, height, n]} shadow={false} parts={() => [
    ...Array.from({ length: n }).map((_, i) => ({ g: G.cyl(0.02, height, 6), p: [-length / 2 + i * length / (n - 1), height / 2, 0] })),
    ...[height, height * 0.55].map(y => ({ g: G.cyl(0.022, length, 6), p: [0, y, 0], r: [0, 0, Math.PI / 2] })),
  ]} />;
}

// Ladder up the local Y axis, rungs along X, one draw call.
export function Ladder({ height = 2.5, width = 0.5, position = [0, 0, 0], rotation = [0, 0, 0], mat = MAT.alu }) {
  const rungs = Math.max(2, Math.round(height / 0.3));
  return <Merged position={position} rotation={rotation} mat={mat} deps={[height, width]} shadow={false} parts={() => [
    ...[-width / 2, width / 2].map(x => ({ g: G.cyl(0.02, height, 6), p: [x, height / 2, 0] })),
    ...Array.from({ length: rungs }).map((_, i) => ({ g: G.cyl(0.015, width, 6), p: [0, (i + 0.5) * height / rungs, 0], r: [0, 0, Math.PI / 2] })),
  ]} />;
}

// Stair: a run of steps rising along +X, with stringers and one handrail. Two draw calls.
export function Stair({ steps = 5, rise = 0.25, run = 0.3, width = 0.9, position = [0, 0, 0], rotation = [0, 0, 0], mat = MAT.grating }) {
  const len = Math.hypot(steps * run, steps * rise), ang = Math.atan2(rise, run);
  return (
    <group position={position} rotation={rotation}>
      <Merged mat={mat} deps={[steps, rise, run, width]} parts={() => [
        ...Array.from({ length: steps }).map((_, i) => ({ g: G.box(run, 0.05, width), p: [(i + 0.5) * run, (i + 0.5) * rise, 0] })),
        ...[-width / 2, width / 2].map(z => ({ g: G.box(len, 0.06, 0.04), p: [steps * run / 2, steps * rise / 2, z], r: [0, 0, ang] })),
      ]} />
      <Handrail length={len} position={[steps * run / 2, steps * rise / 2, width / 2]} rotation={[0, 0, ang]} height={0.9} posts={2} />
    </group>
  );
}

// Studs and nuts around a flange: one instanced mesh, `n` studs on a bolt circle of radius `bc`, along local Y.
export function Studs({ n = 8, bc = 0.3, h = 0.2, r = 0.02, position = [0, 0, 0], rotation = [0, 0, 0], mat = MAT.steel }) {
  const matrices = useMemo(() => {
    const m = [];
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2; o.position.set(Math.cos(a) * bc, 0, Math.sin(a) * bc); o.rotation.set(0, 0, 0); o.updateMatrix(); m.push(o.matrix.clone()); }
    return m;
  }, [n, bc]);
  return (
    <group position={position} rotation={rotation}>
      <instancedMesh args={[undefined, undefined, n]} castShadow={false} ref={(im) => { if (im) { matrices.forEach((mx, i) => im.setMatrixAt(i, mx)); im.instanceMatrix.needsUpdate = true; } }}>
        <cylinderGeometry args={[r, r, h, 6]} />
        <meshStandardMaterial {...mat} />
      </instancedMesh>
    </group>
  );
}

// Semi-trailer chassis oriented along X: gooseneck at the `front` end, tri-axle duals at the rear, deck,
// fenders, landing gear, rear bumper, marker lights. Deck top at y = 1.18. Chassis, tires, rims, and deck
// are four draw calls; children are drawn in the trailer frame.
export function Trailer({ length = 12, width = 2.6, position = [0, 0, 0], rotation = [0, 0, 0], children, name, axles = 3, gooseneck = true, front = 1 }) {
  const deckY = 1.18;
  const f = front;
  const axleX = [-length * 0.36, -length * 0.36 + 1.35, -length * 0.36 + 2.7].slice(0, axles).map(x => x * f);
  const R = 0.52, W = 0.3, aw = width - 0.1;
  const wheelZ = [aw / 2 - W * 0.55 - 0.05, -aw / 2 + W * 0.55 + 0.05];
  return (
    <group position={position} rotation={rotation} name={name}>
      <Merged mat={MAT.chassis} deps={[length, width, axles, gooseneck, f]} parts={() => [
        ...[-width * 0.28, width * 0.28].map(z => ({ g: G.box(length * 0.98, 0.42, 0.12), p: [0, deckY - 0.33, z] })),
        ...Array.from({ length: Math.round(length / 1.5) }).map((_, i) => ({ g: G.box(0.08, 0.3, width * 0.9), p: [-length / 2 + 0.6 + i * 1.5, deckY - 0.3, 0] })),
        ...[-width / 2 + 0.03, width / 2 - 0.03].map(z => ({ g: G.box(length, 0.1, 0.06), p: [0, deckY - 0.05, z] })),
        ...(gooseneck ? [{ g: G.box(1.6, 0.3, width * 0.6), p: [f * (length / 2 - 0.9), deckY - 0.6, 0] }, { g: G.cyl(0.06, 0.25, 8), p: [f * (length / 2 - 0.9), deckY - 0.85, 0] }] : []),
        ...[-width * 0.3, width * 0.3].flatMap(z => [{ g: G.cyl(0.06, deckY - 0.5, 8), p: [f * length * 0.22, (deckY - 0.5) / 2 + 0.1, z] }, { g: G.box(0.35, 0.1, 0.35), p: [f * length * 0.22, 0.06, z] }]),
        ...axleX.map(x => ({ g: G.cyl(0.07, aw - 0.6, 8), p: [x, 0.52, 0], r: [Math.PI / 2, 0, 0] })),
        ...[-1, 1].map(side => ({ g: G.box(axles * 1.35 + 0.6, 0.06, 0.55), p: [(axleX[0] + axleX[axleX.length - 1]) / 2, 1.12, side * (width / 2 - 0.25)] })),
        { g: G.box(0.1, 0.12, width * 0.8), p: [-f * (length / 2 - 0.05), 0.55, 0] },
        // under-deck furniture (Drop 25): mud flaps behind the rear axle, air tank and tool box ahead of the axles
        ...[-1, 1].map(side => ({ g: G.box(0.03, 0.5, 0.5), p: [axleX[0] - f * 0.78, 0.3, side * (width / 2 - 0.4)] })),
        { g: G.cyl(0.15, 1.0, 12), p: [f * length * 0.04, deckY - 0.52, 0.2], r: [0, 0, Math.PI / 2] },
        { g: G.rbox(0.9, 0.5, 0.42, 0.04, 1), p: [f * length * 0.12, deckY - 0.55, width / 2 - 0.26] },
        { g: G.box(0.02, 0.1, 0.3), p: [f * length * 0.12 - 0.46, deckY - 0.5, width / 2 - 0.26] },
      ]} />
      <Merged mat={MAT.tire} deps={[length, axles, f, width]} parts={() => axleX.flatMap(x => wheelZ.map(z => ({ g: G.cyl(R, W * 2.1, 20), p: [x, 0.52, z], r: [Math.PI / 2, 0, 0] })))} />
      <Merged mat={MAT.alu} deps={[length, axles, f, width]} shadow={false} parts={() => axleX.flatMap(x => wheelZ.flatMap(z => [{ g: G.cyl(R * 0.6, W * 2.1 + 0.02, 10), p: [x, 0.52, z], r: [Math.PI / 2, 0, 0] }, { g: G.cyl(R * 0.22, W * 2.1 + 0.1, 8), p: [x, 0.52, z], r: [Math.PI / 2, 0, 0] }]))} />
      <Box size={[length, 0.08, width]} position={[0, deckY - 0.04, 0]} mat={MAT.grating} />
      <BlobShadow size={[length + 1.5, width + 2.0]} />
      {/* markings (Drop 25), one vertex-colored mesh: red and white conspicuity tape along both sides, amber markers along the deck edge, red markers at the rear */}
      <Merged mat={MAT.tape} vertexColors deps={[length, width, f]} shadow={false} parts={() => [
        ...[-1, 1].flatMap(side => Array.from({ length: Math.floor((length - 2) / 0.6) }).map((_, i) => ({ g: G.box(0.3, 0.05, 0.01), p: [-length / 2 + 1.15 + i * 0.6, deckY - 0.12, side * (width / 2 + 0.035)], c: i % 2 ? '#f2f2f2' : '#c81e1e' }))),
        ...[-1, 1].flatMap(side => Array.from({ length: Math.max(2, Math.round(length / 3)) }).map((_, i, arr) => ({ g: G.box(0.1, 0.05, 0.03), p: [-length / 2 + 0.6 + i * (length - 1.2) / (arr.length - 1), deckY - 0.02, side * (width / 2 + 0.03)], c: '#ffb020' }))),
        ...[-1, 1].map(side => ({ g: G.box(0.03, 0.08, 0.14), p: [-f * (length / 2 + 0.02), deckY - 0.2, side * (width / 2 - 0.1)], c: '#ff2a2a' })),
      ]} />
      {children}
    </group>
  );
}
export const DECK_Y = 1.18;

// Text label as a sprite (canvas texture), constant screen size, no DOM nodes.
const labelCache = new Map();
function labelTexture(text) {
  if (labelCache.has(text)) return labelCache.get(text);
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = '600 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 28, h = 44;
  c.width = w; c.height = h;
  ctx.font = font;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 8); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 14, h / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  const out = { tex, aspect: w / h };
  labelCache.set(text, out);
  return out;
}
export function Label({ text, position = [0, 0, 0], size = 0.022 }) {
  const { tex, aspect } = useMemo(() => labelTexture(text), [text]);
  return (
    <sprite position={position} scale={[size * aspect, size, 1]} renderOrder={10}>
      <spriteMaterial map={tex} sizeAttenuation={false} depthTest={false} depthWrite={false} transparent />
    </sprite>
  );
}
