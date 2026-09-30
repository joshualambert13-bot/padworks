// Procedural building blocks shared by the surface and downhole scenes.
import { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------- merged static geometry
// Repeated furniture (wheels, rails, ladders, stairs, fittings) is merged into one BufferGeometry per
// material so a trailer costs a handful of draw calls instead of dozens. Parts: { g: geometry factory result,
// p: position, r: rotation (Euler), s: scale }. Geometries are cloned, transformed, merged, and released.
const G = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
  cyl: (r, h, seg, r2) => new THREE.CylinderGeometry(r2 ?? r, r, h, seg || (r < 0.1 ? 8 : r < 0.25 ? 12 : r < 0.7 ? 16 : 24)),
  cylOpen: (r, h, seg, thetaStart, thetaLength) => new THREE.CylinderGeometry(r, r, h, seg, 1, true, thetaStart, thetaLength),
  sphere: (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h),
  torus: (r, t, rs = 6, ts = 16) => new THREE.TorusGeometry(r, t, rs, ts),
};
export const GEO = G;
export function buildMerged(parts) {
  const geoms = parts.map(({ g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] }) => {
    const c = g;   // factories hand over fresh indexed geometries; merge keeps the indices
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s));
    c.applyMatrix4(m);
    if (c.attributes.uv2) c.deleteAttribute('uv2');
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
export function Merged({ parts, deps = [], mat = MAT.steel, name, position = [0, 0, 0], rotation = [0, 0, 0], doubleSide = false, shadow = true }) {
  const geom = useMerged(() => parts(), deps);
  return <mesh geometry={geom} position={position} rotation={rotation} name={name} castShadow={shadow} receiveShadow><meshStandardMaterial {...mat} side={doubleSide ? THREE.DoubleSide : THREE.FrontSide} /></mesh>;
}

export const MAT = {
  steel:   { color: '#7d8590', metalness: 0.85, roughness: 0.35 },
  darkSteel: { color: '#4a535d', metalness: 0.6, roughness: 0.5 },
  redIron: { color: '#a3261d', metalness: 0.6, roughness: 0.5 },
  yellow:  { color: '#d9a400', metalness: 0.3, roughness: 0.6 },
  white:   { color: '#d7dde5', metalness: 0.2, roughness: 0.6 },
  blue:    { color: '#2a5d9f', metalness: 0.4, roughness: 0.55 },
  green:   { color: '#2e8b57', metalness: 0.4, roughness: 0.55 },
  rubber:  { color: '#1d1f22', metalness: 0.0, roughness: 0.95 },
  brass:   { color: '#b08d3c', metalness: 0.9, roughness: 0.3 },
  tire:    { color: '#141618', metalness: 0.0, roughness: 1.0 },
  ground:  { color: '#4b4235', metalness: 0.0, roughness: 1.0 },
  sand:    { color: '#c9b47a', metalness: 0.0, roughness: 1.0 },
  dimSteel: { color: '#2c3137', metalness: 0.7, roughness: 0.6 },
  // added for the detail pass
  paintRed: { color: '#8f1f1f', metalness: 0.35, roughness: 0.5 },
  paintWhite: { color: '#e4e8ec', metalness: 0.15, roughness: 0.55 },
  cream:   { color: '#d9cfae', metalness: 0.15, roughness: 0.6 },
  alu:     { color: '#b8bec4', metalness: 0.9, roughness: 0.3 },
  chassis: { color: '#2a2d31', metalness: 0.5, roughness: 0.7 },
  grating: { color: '#3a3f45', metalness: 0.6, roughness: 0.75 },
  glass:   { color: '#7fb3ff', metalness: 0.1, roughness: 0.1 },
  hose:    { color: '#24262a', metalness: 0.05, roughness: 0.9 },
  orange:  { color: '#d9642a', metalness: 0.3, roughness: 0.6 },
  rust:    { color: '#6e4a2c', metalness: 0.4, roughness: 0.8 },
  black:   { color: '#0e0f11', metalness: 0.3, roughness: 0.8 },
};

export function Box({ size = [1, 1, 1], position = [0, 0, 0], rotation = [0, 0, 0], mat = MAT.steel, name, castShadow = true, children, ...rest }) {
  return (
    <mesh position={position} rotation={rotation} name={name} castShadow={castShadow} receiveShadow {...rest}>
      <boxGeometry args={size} />
      <meshStandardMaterial {...mat} />
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
      <meshStandardMaterial {...mat} side={open ? THREE.DoubleSide : THREE.FrontSide} />
    </mesh>
  );
}

// Hammer-union nut: a short thick ring with three lugs around it (the wing nut of a figure-type union). One draw call.
const nutParts = (r) => [{ g: G.cyl(r * 1.7, r * 2.2, 14) }, ...[0, 120, 240].map(a => ({ g: G.box(r * 1.2, r * 1.4, r * 0.7), p: [Math.cos(THREE.MathUtils.degToRad(a)) * r * 1.9, 0, -Math.sin(THREE.MathUtils.degToRad(a)) * r * 1.9], r: [0, THREE.MathUtils.degToRad(a), 0] }))];
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
        <meshStandardMaterial {...mat} />
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
const tireParts = (r, w, dual) => [{ g: G.cyl(r, dual ? w * 2.1 : w, 14) }];
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
      ]} />
      <Merged mat={MAT.tire} deps={[length, axles, f, width]} parts={() => axleX.flatMap(x => wheelZ.map(z => ({ g: G.cyl(R, W * 2.1, 14), p: [x, 0.52, z], r: [Math.PI / 2, 0, 0] })))} />
      <Merged mat={MAT.alu} deps={[length, axles, f, width]} shadow={false} parts={() => axleX.flatMap(x => wheelZ.flatMap(z => [{ g: G.cyl(R * 0.6, W * 2.1 + 0.02, 10), p: [x, 0.52, z], r: [Math.PI / 2, 0, 0] }, { g: G.cyl(R * 0.22, W * 2.1 + 0.1, 8), p: [x, 0.52, z], r: [Math.PI / 2, 0, 0] }]))} />
      <Box size={[length, 0.08, width]} position={[0, deckY - 0.04, 0]} mat={MAT.grating} />
      {[-1, 1].map(side => <mesh key={'l' + side} position={[-f * (length / 2 + 0.02), deckY - 0.2, side * (width / 2 - 0.1)]}><boxGeometry args={[0.03, 0.08, 0.14]} /><meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={0.6} /></mesh>)}
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
