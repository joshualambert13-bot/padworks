// Procedural surface equipment. Every group is named with a record ID so the
// inspector and the build check can bind scene nodes to library records.
// Geometry is generic and representative; proportions are not OEM dimensions.
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Box, Cyl, Pipe, PipeRun, PipeStands, Trailer, Wheel, MAT, Label, Hose, Handrail, Ladder, Stair, UnionNut, Studs, Merged, GEO, buildMerged, RBox, Mat, Cable, HydraulicCylinder, metal, Instanced } from './primitives.jsx';
import { noiseTexture, padTexture, BlobShadow, LITE, wearTexture, wrapTexture } from './lighting.jsx';
import { Sign, HazardStrip, Gauge, HosePair, ExhaustPlume, Stencil } from './life.jsx';

// Pulsing ring drawn around the valve the next-steps guidance is pointing at.
function PulseRing({ r }) {
  const ref = useRef();
  useFrame((state) => { if (ref.current) { const k = 0.55 + 0.45 * Math.sin(state.clock.elapsedTime * 4); ref.current.material.opacity = k; ref.current.scale.setScalar(1 + 0.08 * k); } });
  return (
    <mesh ref={ref} rotation={[0, 0, 0]}>
      <torusGeometry args={[r, r * 0.08, 8, 40]} />
      <meshBasicMaterial color="#ffd166" transparent opacity={0.8} depthTest={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------- valves
// A block-body gate valve. `open` is 0..1 position. kind: 'manual' | 'hydraulic'.
// axis: 'vertical' (bore along Y) or 'horizontal' (bore along X). The stem always points to -Z
// (the operator side) so actuators and handwheels line up along the pad, as on a real stack.
export const WELL_COLORS = ['#2f8f4e', '#2b62b8', '#d0d4d8', '#c23a2c', '#d9a400', '#e0762a', '#7a3fa8', '#1f9c8f', '#8a6d3b', '#4a7fb5', '#b03a6e', '#5b8a2b', '#c9c9c9', '#3d4f9a', '#a3521c', '#6d6d6d'];
const WEAR = typeof document !== 'undefined' ? wearTexture() : null;
export function tintMat(color, dim = false) {
  if (!color) return dim ? MAT.dimSteel : MAT.darkSteel;
  if (!dim) return { color, metalness: 0.35, roughness: 0.5, roughnessMap: WEAR || undefined };
  const c = new THREE.Color(color).multiplyScalar(0.45);
  return { color: '#' + c.getHexString(), metalness: 0.4, roughness: 0.6, roughnessMap: WEAR || undefined };
}
// One instanced mesh of studs for a whole set of valves (a tree, a zipper leg): items are { position, axis, bore }
// in the parent's frame, laid out exactly as GateValveBlock places its flanges and bonnet.
const UNIT_STUD = new THREE.CylinderGeometry(1, 1, 1, 6);
function valveStudMatrices(items) {
  const out = [];
  for (const it of items) {
    const bore = it.bore, body = bore * 2.4, ftf = bore * 6.3, flangeR = bore * 1.4;
    const n = bore > 0.1 ? 12 : 8, bc = flangeR * 0.8;
    const root = new THREE.Object3D(); root.position.set(...it.position);
    let frame = root;
    if (it.axis === 'z') { root.rotation.set(0, Math.PI / 2, 0); const inner = new THREE.Object3D(); inner.rotation.set(0, 0, -Math.PI / 2); root.add(inner); frame = inner; }
    else if (it.axis === 'horizontal') root.rotation.set(0, 0, -Math.PI / 2);
    const ring = (pos, rot, cnt, radius, sr, sh) => {
      const holder = new THREE.Object3D(); holder.position.set(...pos); holder.rotation.set(...rot); frame.add(holder);
      for (let i = 0; i < cnt; i++) { const a = (i + 0.5) / cnt * Math.PI * 2; const st = new THREE.Object3D(); st.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius); st.scale.set(sr, sh, sr); holder.add(st); out.push(st); }
    };
    const rings = it.rings || ['top', 'bottom', 'bonnet'];
    if (rings.includes('top')) ring([0, ftf / 2 - bore * 0.325, 0], [0, 0, 0], n, bc, bore * 0.075, bore * 1.1);
    if (rings.includes('bottom')) ring([0, -(ftf / 2 - bore * 0.325), 0], [0, 0, 0], n, bc, bore * 0.075, bore * 1.1);
    if (rings.includes('bonnet')) ring([0, 0, -(body * 0.775 + bore * 0.2)], [Math.PI / 2, 0, 0], 8, body * 0.42, bore * 0.07, bore * 0.75);
    root.updateMatrixWorld(true);
  }
  return out.map(o => o.matrixWorld.clone());
}
// Studs and their nuts from a list of stud matrices (unit cylinder scaled to the stud: x and z the radius, y the
// length). Each stud gets a hex nut at both ends, 1.9 stud radii across and 1.5 radii thick, in dark steel.
// Two instanced meshes however many studs there are (Drop 24).
const UNIT_HEX = new THREE.CylinderGeometry(1, 1, 1, 6);
const NUT_MAT = metal('#2f3338', 0.75, 0.5);
function nutMatrices(studs) {
  const out = [];
  const sc = new THREE.Vector3(), q = new THREE.Quaternion(), pos = new THREE.Vector3();
  for (const m of studs) {
    m.decompose(pos, q, sc);
    const k = Math.min(0.45, (sc.x * 1.5) / sc.y);                      // nut thickness as a fraction of the stud length
    for (const side of [1, -1]) {
      const t = new THREE.Matrix4().makeTranslation(0, side * (0.5 - k / 2), 0);
      const sN = new THREE.Matrix4().makeScale(1.9, k, 1.9);
      out.push(m.clone().multiply(t).multiply(sN));
    }
  }
  return out;
}
function BoltMesh({ matrices, mat = MAT.steel, nuts = true }) {
  const nutM = useMemo(() => (nuts ? nutMatrices(matrices) : []), [matrices, nuts]);
  return (
    <group>
      <instancedMesh args={[UNIT_STUD, undefined, matrices.length]} castShadow={false} ref={(im) => { if (im) { matrices.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true; } }}>
        <meshStandardMaterial {...mat} />
      </instancedMesh>
      {nuts && nutM.length > 0 && (
        <instancedMesh args={[UNIT_HEX, undefined, nutM.length]} castShadow={false} ref={(im) => { if (im) { nutM.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true; } }}>
          <meshStandardMaterial {...NUT_MAT} />
        </instancedMesh>
      )}
    </group>
  );
}
export function StudField({ items, mat = MAT.steel }) {
  const key = JSON.stringify(items);
  const matrices = useMemo(() => valveStudMatrices(items), [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  return <BoltMesh key={key} matrices={matrices} mat={mat} />;
}
// Bolt rings on arbitrary flange pairs: { p: center, dir: flange axis, n: studs, bc: bolt circle radius, sr: stud
// radius, sh: stud length }. Used on the treating spools and the zipper risers.
function ringMatrices(rings) {
  const out = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (const r of rings) {
    const dir = new THREE.Vector3(...r.dir).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    const n = r.n || 8;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * Math.PI * 2;
      const local = new THREE.Vector3(Math.cos(a) * r.bc, 0, Math.sin(a) * r.bc).applyQuaternion(q);
      out.push(new THREE.Matrix4().compose(new THREE.Vector3(...r.p).add(local), q, new THREE.Vector3(r.sr, r.sh, r.sr)));
    }
  }
  return out;
}
export function BoltRings({ rings, mat = MAT.steel }) {
  const key = JSON.stringify(rings);
  const matrices = useMemo(() => ringMatrices(rings), [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  return <BoltMesh key={key} matrices={matrices} mat={mat} />;
}
// Where the control hoses leave a hydraulic actuator: the fitting block on the far end plate (local -z).
export const actuatorHoseZ = (bore) => -(bore * 2.4 * 0.775 + bore * 3.55 + bore * 0.55);
export function GateValveBlock({ open = 1, kind = 'manual', axis = 'vertical', bore = 0.18, name, position = [0, 0, 0], label, dim = false, pulse = false, tint = null, studs = true }) {
  const body = bore * 2.4;     // block across the bore
  const len = bore * 3.1;      // block along the bore (between hubs)
  const ftf = bore * 6.3;      // flange face to face
  const flangeR = bore * 1.4;
  const indicator = open > 0.99 ? '#35e08f' : open < 0.01 ? '#ff4d4d' : '#ffb020';
  const stemTravel = bore * 1.1 * open;
  const matBody = tint ? tintMat(tint, dim) : dim ? MAT.dimSteel : MAT.darkSteel;
  const zb = body * 0.775;   // bonnet face on the stem side
  const inner = (
    <group>
      {/* body block with its hubs and the actuator or balance bosses: one mesh in the body material */}
      <Merged mat={matBody} deps={[bore, kind, matBody.color, dim]} name={name ? name + '-BODY' : undefined} parts={() => [
        { g: GEO.box(body, len, body * 1.55) },
        { g: GEO.cyl(body * 0.46, (ftf - len) / 2), p: [0, len / 2 + (ftf - len) / 4, 0] },
        { g: GEO.cyl(body * 0.46, (ftf - len) / 2), p: [0, -len / 2 - (ftf - len) / 4, 0] },
        { g: GEO.cyl(body * 0.33, bore * 0.5), p: [0, 0, -(zb + bore * 0.65)], r: [Math.PI / 2, 0, 0] },
        { g: GEO.box(body * 0.42, body * 0.26, 0.012), p: [body * 0.5 - body * 0.21, len * 0.12, body * 0.775 + 0.006] },   // nameplate pad on the back face
        ...(kind === 'manual' ? [] : [
          { g: GEO.cyl(body * 0.36, bore * 2.6), p: [0, 0, -(zb + bore * 0.95 + bore * 1.3)], r: [Math.PI / 2, 0, 0] },
          { g: GEO.cyl(body * 0.2, bore * 1.1), p: [0, 0, zb + bore * 0.55], r: [Math.PI / 2, 0, 0] },
        ]),
      ]} />
      {/* end flanges, bonnet flange, and the actuator plates, tie rods, and indicator tube: one mesh in steel */}
      <Merged mat={MAT.steel} deps={[bore, kind]} name={name ? name + '-BONNET' : undefined} parts={() => [
        { g: GEO.cyl(flangeR, bore * 0.65), p: [0, ftf / 2 - bore * 0.325, 0] },
        { g: GEO.cyl(flangeR, bore * 0.65), p: [0, -ftf / 2 + bore * 0.325, 0] },
        { g: GEO.cyl(body * 0.52, bore * 0.4), p: [0, 0, -(zb + bore * 0.2)], r: [Math.PI / 2, 0, 0] },
        { g: GEO.box(body * 0.4, body * 0.24, 0.006), p: [body * 0.5 - body * 0.21, len * 0.12, body * 0.775 + 0.015] },     // the plate itself
        ...(kind === 'manual' ? [{ g: GEO.cyl(body * 0.24, bore * 0.22, 6), p: [0, 0, -(zb + bore * 0.95)], r: [Math.PI / 2, 0, 0] }] : [   // packing gland nut
          { g: GEO.box(bore * 0.8, bore * 0.4, bore * 0.3), p: [0, 0, -(zb + bore * 3.55 + bore * 0.15)] },                     // hose fitting block on the far plate
          { g: GEO.box(body * 0.95, body * 0.95, bore * 0.18), p: [0, 0, -(zb + bore * 0.95)] },
          { g: GEO.box(body * 0.95, body * 0.95, bore * 0.18), p: [0, 0, -(zb + bore * 0.95 + bore * 2.6)] },
          ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => ({ g: GEO.cyl(bore * 0.07, bore * 2.9, 6), p: [a * body * 0.42, b * body * 0.42, -(zb + bore * 0.95 + bore * 1.3)], r: [Math.PI / 2, 0, 0] })),
          { g: GEO.cyl(bore * 0.12, bore * 0.9, 8), p: [0, 0, -(zb + bore * 0.95 + bore * 2.6 + bore * 0.45)], r: [Math.PI / 2, 0, 0] },
        ]),
      ]} />
      {studs && <StudField items={[{ position: [0, 0, 0], axis: 'vertical', bore }]} />}
      {/* grease and sealant injection fittings on the bonnet flange; hose elbows on the actuator fitting block */}
      <Merged mat={MAT.brass} deps={[bore, kind]} shadow={false} parts={() => [
        { g: GEO.cyl(bore * 0.055, bore * 0.3, 6), p: [body * 0.36, -body * 0.3, -(zb + bore * 0.45)], r: [Math.PI / 2, 0, 0] },
        { g: GEO.cyl(bore * 0.055, bore * 0.3, 6), p: [-body * 0.36, -body * 0.3, -(zb + bore * 0.45)], r: [Math.PI / 2, 0, 0] },
        ...(kind === 'manual' ? [] : [-0.06, 0.06].map(x => ({ g: GEO.cyl(bore * 0.07, bore * 0.4, 8), p: [x, 0, -(zb + bore * 3.55 + bore * 0.35)], r: [Math.PI / 2, 0, 0] }))),
      ]} />
      {/* stem travels with the gate; handwheel rides on it */}
      <Cyl r={bore * 0.17} h={bore * 0.9} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -(zb + bore * 0.9 + stemTravel)]} mat={MAT.brass} name={name ? name + '-STEM' : undefined} />
      {kind === 'manual' ? (
        <group position={[0, 0, -(zb + bore * 1.5 + stemTravel)]} name={name ? name + '-HANDWHEEL' : undefined}>
          <Merged mat={MAT.rubber} deps={[bore]} shadow={false} parts={() => [{ g: GEO.torus(bore * 1.35, bore * 0.11, 8, 28) }, { g: GEO.box(bore * 2.7, bore * 0.14, bore * 0.14) }, { g: GEO.box(bore * 2.7, bore * 0.14, bore * 0.14), r: [0, 0, Math.PI / 2] }, { g: GEO.cyl(bore * 0.32, bore * 0.3, 10), r: [Math.PI / 2, 0, 0] }]} />
        </group>
      ) : (
        <group name={name ? name + '-ACTUATOR' : undefined} position={[0, 0, -(zb + bore * 0.95 + bore * 1.3)]}>
          <Merged mat={MAT.darkSteel} deps={[bore]} shadow={false} parts={() => [{ g: GEO.cyl(body * 0.37, bore * 0.3, 20), p: [0, 0, bore * 1.15], r: [Math.PI / 2, 0, 0] }, { g: GEO.cyl(body * 0.37, bore * 0.3, 20), p: [0, 0, -bore * 1.15], r: [Math.PI / 2, 0, 0] }]} />
        </group>
      )}
      {/* position indicator lamp */}
      <mesh position={[body * 0.3, body * 0.5, -(zb + (kind === 'manual' ? bore * 1.5 + stemTravel : bore * 3.8))]}>
        <sphereGeometry args={[bore * 0.2, 8, 8]} />
        <meshStandardMaterial color={indicator} emissive={indicator} emissiveIntensity={1.2} />
      </mesh>
      {label && <Label position={[0, 0, -body * 1.6]} text={label} />}
      {pulse && <group rotation={[Math.PI / 2, 0, 0]}><PulseRing r={body * 1.15} /></group>}
    </group>
  );
  if (axis === 'z') return <group position={position} rotation={[0, Math.PI / 2, 0]} name={name}><group rotation={[0, 0, -Math.PI / 2]}>{inner}</group></group>;
  const rot = axis === 'vertical' ? [0, 0, 0] : [0, 0, -Math.PI / 2];
  return <group position={position} rotation={rot} name={name}>{inner}</group>;
}

// Tree stack heights (meters) for a nominal bore in meters, shared with the scene for crane and cable geometry.
export const BORE_M = { '4-10K': 0.103, '4-15K': 0.103, '5-10K': 0.13, '5-15K': 0.13, '7-10K': 0.18, '7-15K': 0.18 };

// ---------------------------------------------------------------- wellhead in its cellar
// The casing head, casing spool with its side outlet valves, and tubing head sit below grade in a square
// cellar; only the top of the tubing head shows above the pad. The cellar is a real pit: its floor and walls
// are drawn first, then a depth-only mask over the opening (depth test always, so the write happens) keeps the
// ground and containment planes from painting over it, and everything above grade draws normally on top.
export const CELLAR_DEPTH = 1.5;
export const CELLAR_HALF = 1.3;
export const WELLHEAD_TOP = 0.5;          // tubing head top above grade
const CELLAR_MAT = { color: '#6b6a66', roughness: 0.95, metalness: 0.0 };
export function Cellar() {
  const H = CELLAR_HALF, D = CELLAR_DEPTH, t = 0.12;
  return (
    <group>
      <group renderOrder={-2}>
        <mesh position={[0, -D + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[2 * H, 2 * H]} /><meshStandardMaterial color="#26282b" roughness={0.98} /></mesh>
        {[[H - t / 2, 0, t, 2 * H], [-H + t / 2, 0, t, 2 * H], [0, H - t / 2, 2 * H, t], [0, -H + t / 2, 2 * H, t]].map(([x, z, w, l], i) => (
          <mesh key={i} position={[x, -D / 2, z]} receiveShadow><boxGeometry args={[w, D, l]} /><meshStandardMaterial {...CELLAR_MAT} /></mesh>
        ))}
      </group>
      <mesh renderOrder={-1} position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2 * H - t, 2 * H - t]} /><meshBasicMaterial colorWrite={false} depthWrite depthFunc={THREE.AlwaysDepth} /></mesh>
      {/* concrete curb above grade and a grating walkway strip on the operator side */}
      <Merged mat={CELLAR_MAT} shadow={false} parts={() => [
        { g: GEO.box(2 * H + 0.3, 0.22, 0.28), p: [0, 0.11, H + 0.01] }, { g: GEO.box(2 * H + 0.3, 0.22, 0.28), p: [0, 0.11, -H - 0.01] },
        { g: GEO.box(0.28, 0.22, 2 * H - 0.26), p: [H + 0.01, 0.11, 0] }, { g: GEO.box(0.28, 0.22, 2 * H - 0.26), p: [-H - 0.01, 0.11, 0] },
      ]} />
      <Box size={[2 * H - 0.3, 0.03, 0.7]} position={[0, 0.2, -H + 0.5]} mat={MAT.grating} castShadow={false} />
    </group>
  );
}
// Casing head, flange, casing spool with two side outlet valves, flange, tubing head: the stack from the cellar
// floor up to WELLHEAD_TOP. The below-grade parts draw before the cellar mask so they show in the pit.
export function Wellhead({ mat = MAT.darkSteel, nm = (k) => k, dim = false, tint = null, studs = true }) {
  const y0 = -CELLAR_DEPTH;
  return (
    <group>
      <Cellar />
      <group renderOrder={-2}>
        <Cyl r={1.1} r2={1.1} h={0.05} position={[0, y0 + 0.025, 0]} mat={MAT.darkSteel} />
        <Cyl r={0.42} h={0.7} position={[0, y0 + 0.35, 0]} mat={mat} name={nm('WH-CASINGHEAD')} />
        <Cyl r={0.48} h={0.08} position={[0, y0 + 0.7, 0]} mat={MAT.steel} />
        <Cyl r={0.4} h={0.7} position={[0, y0 + 1.05, 0]} mat={mat} name={nm('WH-CASINGSPOOL')} />
        <Cyl r={0.47} h={0.08} position={[0, y0 + 1.4, 0]} mat={MAT.steel} />
        <GateValveBlock open={0} kind="manual" axis="horizontal" bore={0.05} position={[0.62, y0 + 1.05, 0]} dim={dim} tint={tint} studs={false} />
        <GateValveBlock open={0} kind="manual" axis="horizontal" bore={0.05} position={[-0.62, y0 + 1.05, 0]} dim={dim} tint={tint} studs={false} />
        {studs && <StudField items={[{ position: [0.62, y0 + 1.05, 0], axis: 'horizontal', bore: 0.05 }, { position: [-0.62, y0 + 1.05, 0], axis: 'horizontal', bore: 0.05 }]} />}
        <Merged mat={MAT.steel} shadow={false} parts={() => Array.from({ length: 8 }).map((_, k) => ({ g: GEO.cyl(0.025, 0.12, 6), p: [Math.cos(k * Math.PI / 4 + 0.2) * 0.43, y0 + 0.7, Math.sin(k * Math.PI / 4 + 0.2) * 0.43] }))} />
      </group>
      <Cyl r={0.38} h={0.6} position={[0, y0 + 1.7, 0]} mat={mat} name={nm('WH-TUBINGHEAD')} />
      <Merged mat={MAT.steel} shadow={false} parts={() => Array.from({ length: 8 }).map((_, k) => ({ g: GEO.cyl(0.03, 0.16, 6), p: [Math.cos(k * Math.PI / 4) * 0.42, y0 + 1.78, Math.sin(k * Math.PI / 4) * 0.42], r: [0, 0, Math.PI / 2 * Math.cos(k * Math.PI / 4)] }))} />
    </group>
  );
}

export function treeDims(bore) {
  const ftf = bore * 6.0;                  // valve face to face along the bore
  const crossH = bore * 3.2;
  const inletH = bore * 3.0;
  const wellheadTop = WELLHEAD_TOP;        // the wellhead stack is in the cellar; the tubing head tops out just above grade
  const adapterH = bore * 1.6;
  const lmvY = wellheadTop + adapterH + ftf / 2;
  const umvY = lmvY + ftf;
  const crossY = umvY + ftf / 2 + crossH / 2;
  const crownY = crossY + crossH / 2 + ftf / 2;
  const inletY = crownY + ftf / 2 + inletH / 2;
  const swabY = inletY + inletH / 2 + ftf / 2;
  const topY = swabY + ftf / 2 + bore * 1.5;
  const wingInnerX = bore * 1.2 + bore * 0.9 + ftf / 2;
  const wingOuterX = wingInnerX + ftf;
  return { ftf, crossH, inletH, wellheadTop, adapterH, lmvY, umvY, crossY, crownY, inletY, swabY, topY, wingInnerX, wingOuterX };
}

// ---------------------------------------------------------------- frac tree (standard configuration)
// Wellhead, tree adapter, lower master (manual), upper master (hyd.), cross with a manual then a hydraulic
// wing valve each side, crown valve (hyd.), flanged inlet block for the spooled treating line, swab (hyd.),
// top adapter. Wing A (-X) is the pump-down side, wing B (+X) the flowback side; the inlet faces -X to the zipper.
export function FracTree({ valves, showLabels, lubricator = false, wlStep = 'idle', bore = 0.18, dim = false, name = 'WH-FRACTREE', partner = false, focusValve = null, launcher = false, ballsLeft = 0, tint = null, wellNo = 0, pumping = false }) {
  const d = treeDims(bore);
  const v = valves;
  const mat = tint ? tintMat(tint, dim) : dim ? MAT.dimSteel : MAT.darkSteel;
  const nm = (k) => (partner ? undefined : k);
  return (
    <group name={partner ? undefined : name}>
      <Wellhead mat={mat} nm={nm} dim={dim} tint={tint} />
      <StudField items={[
        { position: [0, d.lmvY, 0], axis: 'vertical', bore }, { position: [0, d.umvY, 0], axis: 'vertical', bore },
        { position: [-d.wingInnerX, d.crossY, 0], axis: 'horizontal', bore }, { position: [-d.wingOuterX, d.crossY, 0], axis: 'horizontal', bore },
        { position: [d.wingInnerX, d.crossY, 0], axis: 'horizontal', bore }, { position: [d.wingOuterX, d.crossY, 0], axis: 'horizontal', bore },
        { position: [0, d.crownY, 0], axis: 'vertical', bore }, { position: [0, d.swabY, 0], axis: 'vertical', bore },
      ]} />
      {/* lifting eyes on the cross */}
      <Merged mat={MAT.steel} deps={[bore]} shadow={false} parts={() => [
        { g: GEO.torus(0.09, 0.02, 6, 12), p: [bore * 1.3, d.crossY + d.crossH / 2 + 0.08, 0] }, { g: GEO.torus(0.09, 0.02, 6, 12), p: [-bore * 1.3, d.crossY + d.crossH / 2 + 0.08, 0] },
      ]} />
      <StudField items={[{ position: [-bore * 1.2 - bore * 0.45 - bore * 3.15 + bore * 0.325, d.inletY, 0], axis: 'horizontal', bore, rings: ['top'] }]} />
      {/* hydraulic control: a hose pair from every actuator to the junction box on its stand, then the trunk over the berm to the ground bundle that runs to the accumulator unit */}
      {[[0, d.umvY], [-d.wingOuterX, d.crossY], [d.wingOuterX, d.crossY], [0, d.crownY], [0, d.swabY]].map(([x, y], k) => (
        <HosePair key={k} from={[x, y, actuatorHoseZ(bore)]} to={[-1.7 + k * 0.08, 1.05, -2.3]} />
      ))}
      <Box size={[0.5, 0.35, 0.25]} position={[-1.55, 1.0, -2.3]} mat={MAT.chassis} />
      <Cyl r={0.03} h={0.85} position={[-1.55, 0.42, -2.3]} mat={MAT.darkSteel} />
      <Hose from={[-1.55, 0.85, -2.3]} to={[-3.2, 0.46, -2.3]} r={0.045} sag={0.12} segments={8} />
      <Hose from={[-3.2, 0.46, -2.3]} to={[HOSE_BUNDLE_X, 0.07, -2.3]} r={0.045} sag={-0.05} segments={6} />
      {/* gauge on the inlet block and a bleed needle valve beside it; well number sign at the containment edge */}
      <Gauge position={[bore * 0.9, d.inletY + d.inletH / 2 + 0.22, -bore * 1.2]} r={0.08} />
      <Cyl r={0.025} h={0.26} position={[bore * 0.9, d.inletY + d.inletH / 2 + 0.08, -bore * 1.2]} mat={MAT.steel} />
      {wellNo > 0 && <Sign lines={['WELL ' + wellNo]} position={[2.9, 1.5, -2.6]} rotation={[0, Math.PI / 4, 0]} width={0.9} height={0.45} post={1.5} />}
      {wellNo > 0 && pumping && <Sign lines={['DANGER', 'HIGH PRESSURE', 'KEEP OUT']} position={[2.9, 0.95, -2.6]} rotation={[0, Math.PI / 4, 0]} width={0.9} height={0.55} danger />}
      <Cyl r={bore * 1.4} h={d.adapterH} position={[0, d.wellheadTop + d.adapterH / 2, 0]} mat={MAT.steel} name={nm('WH-TREEADAPTER')} />
      <GateValveBlock open={v.lmv.pos} kind="manual" bore={bore} position={[0, d.lmvY, 0]} name={nm('WH-FRACTREE-LMV')} pulse={focusValve === 'lmv'} label={showLabels ? 'Lower master (manual)' : null} dim={dim} tint={tint} studs={false} />
      <GateValveBlock open={v.umv.pos} kind="hydraulic" bore={bore} position={[0, d.umvY, 0]} name={nm('WH-FRACTREE-UMV')} pulse={focusValve === 'umv'} label={showLabels ? 'Upper master (hyd.)' : null} dim={dim} tint={tint} studs={false} />
      <group name={nm('WH-FRACTREE-CROSS')} position={[0, d.crossY, 0]}>
        <Box size={[bore * 2.4, d.crossH, bore * 2.4 * 1.55]} mat={mat} />
        <Cyl r={bore * 1.4} h={bore * 0.9} rotation={[0, 0, Math.PI / 2]} position={[bore * 1.2 + bore * 0.45, 0, 0]} mat={MAT.steel} />
        <Cyl r={bore * 1.4} h={bore * 0.9} rotation={[0, 0, Math.PI / 2]} position={[-bore * 1.2 - bore * 0.45, 0, 0]} mat={MAT.steel} />
      </group>
      {/* wing A (-X, pump-down side): manual inboard, hydraulic outboard */}
      <GateValveBlock open={1} kind="manual" axis="horizontal" bore={bore} position={[-d.wingInnerX, d.crossY, 0]} name={nm('WH-FRACTREE-WINGA-MAN')} dim={dim} tint={tint} studs={false} />
      <GateValveBlock open={v.wingA.pos} kind="hydraulic" axis="horizontal" bore={bore} position={[-d.wingOuterX, d.crossY, 0]} name={nm('WH-FRACTREE-WINGA-HYD')} pulse={focusValve === 'wingA'} label={showLabels ? 'Wing A: manual + hyd. (pump-down)' : null} dim={dim} tint={tint} studs={false} />
      {/* wing B (+X, flowback side) */}
      <GateValveBlock open={1} kind="manual" axis="horizontal" bore={bore} position={[d.wingInnerX, d.crossY, 0]} name={nm('WH-FRACTREE-WINGB-MAN')} dim={dim} tint={tint} studs={false} />
      <GateValveBlock open={v.wingB.pos} kind="hydraulic" axis="horizontal" bore={bore} position={[d.wingOuterX, d.crossY, 0]} name={nm('WH-FRACTREE-WINGB-HYD')} pulse={focusValve === 'wingB'} label={showLabels ? 'Wing B: manual + hyd. (flowback)' : null} dim={dim} tint={tint} studs={false} />
      <GateValveBlock open={v.crown.pos} kind="hydraulic" bore={bore} position={[0, d.crownY, 0]} name={nm('WH-FRACTREE-CROWN')} pulse={focusValve === 'crown'} label={showLabels ? 'Crown valve (hyd.)' : null} dim={dim} tint={tint} studs={false} />
      {/* inlet block with a flanged hub toward the zipper (-X) */}
      <group name={nm('WH-FRACTREE-INLETBLOCK')} position={[0, d.inletY, 0]}>
        <Box size={[bore * 2.4, d.inletH, bore * 2.4 * 1.55]} mat={mat} />
        <Cyl r={bore * 1.4} h={bore * 0.9} rotation={[0, 0, Math.PI / 2]} position={[-bore * 1.2 - bore * 0.45, 0, 0]} mat={MAT.steel} />
        {showLabels && <Label position={[-bore * 3, bore * 1.2, 0]} text={'Inlet block (flanged spool from zipper)'} />}
      </group>
      <GateValveBlock open={v.swab.pos} kind="hydraulic" bore={bore} position={[0, d.swabY, 0]} name={nm('WH-FRACTREE-SWAB')} pulse={focusValve === 'swab'} label={showLabels ? 'Swab valve (hyd., wireline access)' : null} dim={dim} tint={tint} studs={false} />
      {launcher && <BallLauncher baseY={d.swabY + d.ftf / 2} bore={bore} ballsLeft={ballsLeft} showLabels={showLabels} dim={dim} name={nm('WH-FRACTREE-BALLLAUNCHER')} />}
      {!lubricator && !launcher && (
        <group name={nm('WH-FRACTREE-TOPADAPTER')} position={[0, d.swabY + d.ftf / 2, 0]}>
          <Cyl r={bore * 1.4} h={bore * 0.5} position={[0, bore * 0.25, 0]} mat={MAT.steel} />
          <Cyl r={bore * 0.9} h={bore * 0.8} position={[0, bore * 0.9, 0]} mat={mat} />
          <Cyl r={bore * 1.3} r2={bore * 0.9} h={bore * 0.4} position={[0, bore * 1.5, 0]} mat={MAT.steel} />
          {showLabels && <Label position={[bore * 2, bore * 2.2, 0]} text={'Top adapter (hands-free connector)'} />}
        </group>
      )}
      {lubricator && <Lubricator baseY={d.swabY + d.ftf / 2} wlStep={wlStep} showLabels={showLabels} />}
    </group>
  );
}

// Ball launcher on top of the tree for sliding sleeve jobs: a pressure housing on the swab valve, a horizontal
// magazine holding the graduated balls behind two small isolation valves, and a hydraulic push rod that feeds
// one ball at a time into the flow stream. Generic geometry.
export function BallLauncher({ baseY, bore, ballsLeft = 0, showLabels, dim, name }) {
  const mat = dim ? MAT.dimSteel : MAT.darkSteel;
  const hH = bore * 3.2;
  const cy = baseY + bore * 0.4 + hH / 2;
  const magX = bore * 1.3 + bore * 2.6;
  return (
    <group name={name} position={[0, 0, 0]}>
      <Cyl r={bore * 1.4} h={bore * 0.4} position={[0, baseY + bore * 0.2, 0]} mat={MAT.steel} />
      <Cyl r={bore * 1.15} h={hH} position={[0, cy, 0]} mat={mat} />
      <Cyl r={bore * 1.4} h={bore * 0.45} position={[0, baseY + bore * 0.4 + hH + bore * 0.22, 0]} mat={MAT.steel} />
      <Cyl r={bore * 0.5} h={bore * 0.9} position={[0, baseY + bore * 0.4 + hH + bore * 0.9, 0]} mat={mat} />
      {/* side port, two small isolation valves, magazine tube, push cylinder */}
      <Cyl r={bore * 0.55} h={bore * 1.4} rotation={[0, 0, Math.PI / 2]} position={[bore * 1.6, cy, 0]} mat={mat} />
      <GateValveBlock open={1} kind="hydraulic" axis="horizontal" bore={bore * 0.4} position={[bore * 2.9, cy, 0]} dim={dim} />
      <GateValveBlock open={0} kind="hydraulic" axis="horizontal" bore={bore * 0.4} position={[bore * 5.4, cy, 0]} dim={dim} />
      <Cyl r={bore * 0.6} h={bore * 5.2} rotation={[0, 0, Math.PI / 2]} position={[magX + bore * 5.2, cy, 0]} mat={MAT.steel} />
      {Array.from({ length: Math.min(8, ballsLeft) }).map((_, i) => (
        <mesh key={i} position={[magX + bore * 3.0 + i * bore * 0.62, cy + bore * 0.9, 0]}><sphereGeometry args={[bore * 0.22 + i * bore * 0.012, 10, 10]} /><meshStandardMaterial color="#d8d8d8" metalness={0.3} roughness={0.4} /></mesh>
      ))}
      <Cyl r={bore * 0.38} h={bore * 1.6} rotation={[0, 0, Math.PI / 2]} position={[magX + bore * 8.6, cy, 0]} mat={MAT.blue} />
      <Cyl r={0.02} h={bore * 8} rotation={[0, 0, Math.PI / 2]} position={[magX + bore * 4, cy - bore * 0.9, bore * 0.5]} mat={MAT.rubber} />
      {showLabels && <Label position={[magX + bore * 3, cy + bore * 2.2, 0]} text={'Ball launcher (' + ballsLeft + ' balls loaded)'} />}
    </group>
  );
}

// ---------------------------------------------------------------- production tree (production phase)
// Small manual tree on the tubing head after the frac stack comes off: adapter, two masters, flow cross,
// production wing with an actuated choke to the flowline, kill wing with a gauge, swab valve, cap with gauge.
export function ProductionTree({ showLabels, name = 'UC-PRODTREE', partner = false, tint = null, lift = 'flow' }) {
  const bore = 0.078;                      // 3-1/16 in.
  const body = tint ? tintMat(tint, partner) : MAT.darkSteel;
  const ftf = bore * 6.6;
  const nm = (k) => (partner ? undefined : k);
  let y = WELLHEAD_TOP;
  const adH = bore * 2.2 + 0.2;
  const adY = y + adH / 2; y += adH;
  const lmvY = y + ftf / 2; y += ftf;
  const umvY = y + ftf / 2; y += ftf;
  const crossH = bore * 3.4;
  const crossY = y + crossH / 2; y += crossH;
  const swabY = y + ftf / 2; y += ftf;
  const capY = y;
  const wingX = bore * 1.2 + bore * 0.7 + ftf / 2;
  const chokeX = wingX + ftf / 2 + bore * 3.0;
  return (
    <group name={partner ? undefined : name}>
      <Wellhead nm={nm} />
      <Cyl r={bore * 1.5} h={adH} position={[0, adY, 0]} mat={MAT.steel} name={nm('UC-PRODTREE-TUBINGHEADADAPTER')} />
      <GateValveBlock open={1} kind="manual" bore={bore} position={[0, lmvY, 0]} tint={tint} name={nm('UC-PRODTREE-LMV')} label={showLabels ? 'Lower master' : null} />
      <GateValveBlock open={1} kind="manual" bore={bore} position={[0, umvY, 0]} tint={tint} name={nm('UC-PRODTREE-UMV')} label={showLabels ? 'Upper master' : null} />
      <group name={nm('UC-PRODTREE-FLOWCROSS')} position={[0, crossY, 0]}>
        <Box size={[bore * 2.4, crossH, bore * 3.7]} mat={body} />
        <Cyl r={bore * 1.5} h={bore * 0.7} rotation={[0, 0, Math.PI / 2]} position={[bore * 1.2 + bore * 0.35, 0, 0]} mat={MAT.steel} />
        <Cyl r={bore * 1.5} h={bore * 0.7} rotation={[0, 0, Math.PI / 2]} position={[-bore * 1.2 - bore * 0.35, 0, 0]} mat={MAT.steel} />
      </group>
      {/* production wing (+X): wing valve, choke with actuator, flowline drop */}
      <GateValveBlock open={1} kind="manual" axis="horizontal" bore={bore} position={[wingX, crossY, 0]} tint={tint} name={nm('UC-PRODTREE-WINGVALVE')} label={showLabels ? 'Production wing' : null} />
      <group name={nm('UC-PRODTREE-CHOKE')} position={[chokeX, crossY, 0]}>
        <Box size={[bore * 3.6, bore * 2.2, bore * 2.2]} mat={MAT.darkSteel} />
        <Cyl r={bore * 0.9} h={bore * 1.2} position={[-bore * 0.4, bore * 1.6, 0]} mat={MAT.steel} />
        <Box size={[bore * 2.6, bore * 2.0, bore * 2.0]} position={[-bore * 0.4, bore * 3.6, 0]} mat={MAT.redIron} name={nm('UC-PRODTREE-ACTUATOR')} />
        {showLabels && <Label position={[0, bore * 6, 0]} text={'Choke with actuator'} />}
      </group>
      <PipeRun points={[[chokeX + bore * 1.8, crossY, 0], [chokeX + bore * 4.5, crossY, 0], [chokeX + bore * 4.5, 0.3, 0], [chokeX + bore * 4.5, 0.3, 6.0]]} r={bore * 0.6} mat={MAT.darkSteel} />
      {/* kill wing (-X): valve and companion flange with gauge */}
      <GateValveBlock open={0} kind="manual" axis="horizontal" bore={bore} position={[-wingX, crossY, 0]} tint={tint} name={nm('UC-PRODTREE-KILLWING')} label={showLabels ? 'Kill wing' : null} />
      <Cyl r={bore * 1.5} h={bore * 0.6} rotation={[0, 0, Math.PI / 2]} position={[-wingX - ftf / 2 - bore * 0.3, crossY, 0]} mat={MAT.steel} />
      <Cyl r={bore * 0.9} h={0.04} rotation={[0, 0, Math.PI / 2]} position={[-wingX - ftf / 2 - bore * 1.4, crossY, 0]} mat={MAT.white} name={nm('UC-PRODTREE-GAUGE')} />
      <GateValveBlock open={lift === 'plunger' || lift === 'rodpump' ? 1 : 0} kind="manual" bore={bore} position={[0, swabY, 0]} tint={tint} name={nm('UC-PRODTREE-SWAB')} label={showLabels ? 'Swab valve' : null} />
      {lift === 'rodpump' ? (
        <group name={nm('AL-BEAMUNIT-STUFFINGBOX')} position={[0, capY, 0]}>
          <Box size={[bore * 3.0, bore * 2.4, bore * 2.4]} position={[0, bore * 1.2, 0]} mat={body} />
          <Cyl r={bore * 0.6} h={bore * 2.0} rotation={[0, 0, Math.PI / 2]} position={[bore * 2.4, bore * 1.2, 0]} mat={MAT.steel} />
          <Cyl r={bore * 1.1} h={bore * 2.2} position={[0, bore * 3.5, 0]} mat={MAT.steel} />
          <Cyl r={bore * 1.4} h={bore * 0.4} position={[0, bore * 4.8, 0]} mat={MAT.darkSteel} />
          {showLabels && <Label position={[bore * 3, bore * 6, 0]} text={'Pumping tee and stuffing box'} />}
        </group>
      ) : lift === 'plunger' ? (
        <group name={nm('AL-PLUNGERLIFT-LUBRICATOR')} position={[0, capY, 0]}>
          <Cyl r={bore * 1.5} h={bore * 0.6} position={[0, bore * 0.3, 0]} mat={MAT.steel} />
          <Cyl r={bore * 1.0} h={1.4} position={[0, 0.75, 0]} mat={MAT.steel} />
          <Cyl r={bore * 1.3} h={0.12} position={[0, 1.5, 0]} mat={MAT.darkSteel} />
          <Box size={[0.12, 0.1, 0.08]} position={[bore * 1.1, 1.1, 0]} mat={MAT.blue} />
          <Cyl r={0.05} h={0.5} rotation={[0, 0, Math.PI / 2]} position={[-bore * 1.3, 0.5, 0]} mat={MAT.steel} />
          {showLabels && <Label position={[bore * 3, 1.9, 0]} text={'Plunger lubricator and arrival sensor'} />}
        </group>
      ) : (
        <group name={nm('UC-PRODTREE-TREECAP')} position={[0, capY, 0]}>
          <Cyl r={bore * 1.5} h={bore * 0.6} position={[0, bore * 0.3, 0]} mat={MAT.steel} />
          <Cyl r={bore * 0.9} r2={bore * 0.4} h={bore * 1.4} position={[0, bore * 1.3, 0]} mat={MAT.darkSteel} />
          <Cyl r={0.02} h={bore * 2.0} position={[0, bore * 3.0, 0]} mat={MAT.steel} />
          <Cyl r={bore * 0.8} h={0.04} rotation={[Math.PI / 2, 0, 0]} position={[0, bore * 4.4, 0]} mat={MAT.white} />
          {showLabels && <Label position={[bore * 3, bore * 5, 0]} text={'Tree cap and gauge'} />}
        </group>
      )}
      {lift === 'rodpump' && <PumpingUnit topY={capY + bore * 6.0} partner={partner} showLabels={showLabels} />}
      {lift === 'esp' && <EspSurface partner={partner} showLabels={showLabels} />}
      {lift === 'gaslift' && <GasLiftSurface partner={partner} showLabels={showLabels} />}
      {lift === 'plunger' && <PlungerController partner={partner} />}
    </group>
  );
}



// ---------------------------------------------------------------- workover rig and BOP stack (production hookup)
// BOP stack on the tubing head during the hookup: adapter, drilling spool with kill and choke outlets, double ram
// preventer with bonnets, annular preventer, and a bell nipple. Generic proportions.
export function BopStack({ showLabels, name = 'RG-BOPSTACK' }) {
  const r = 0.34;
  return (
    <group name={name}>
      <Wellhead />
      <Cyl r={0.5} h={0.3} position={[0, WELLHEAD_TOP + 0.15, 0]} mat={MAT.steel} name="RG-BOPSTACK-ADAPTER" />
      <group position={[0, WELLHEAD_TOP - 2.0, 0]}>
      <group name="RG-BOPSTACK-SPOOL" position={[0, 2.75, 0]}>
        <Cyl r={r} h={0.9} mat={MAT.darkSteel} />
        <Cyl r={0.5} h={0.12} position={[0, -0.45, 0]} mat={MAT.steel} />
        <Cyl r={0.5} h={0.12} position={[0, 0.45, 0]} mat={MAT.steel} />
        <Cyl r={0.12} h={0.7} rotation={[0, 0, Math.PI / 2]} position={[0.55, 0, 0]} mat={MAT.darkSteel} />
        <GateValveBlock open={0} kind="manual" axis="horizontal" bore={0.07} position={[1.2, 0, 0]} />
        <Cyl r={0.12} h={0.7} rotation={[0, 0, Math.PI / 2]} position={[-0.55, 0, 0]} mat={MAT.darkSteel} />
        <GateValveBlock open={0} kind="manual" axis="horizontal" bore={0.07} position={[-1.2, 0, 0]} />
      </group>
      <group name="RG-BOPSTACK-RAMS" position={[0, 4.0, 0]}>
        <Box size={[1.1, 1.5, 0.9]} mat={MAT.darkSteel} />
        {[-0.35, 0.35].map((dy, i) => [1, -1].map(sx => (
          <group key={i + '-' + sx} position={[sx * 0.95, dy, 0]}>
            <Box size={[0.8, 0.5, 0.7]} mat={MAT.steel} />
            <Cyl r={0.12} h={0.6} rotation={[0, 0, Math.PI / 2]} position={[sx * 0.65, 0, 0]} mat={MAT.darkSteel} />
            <Cyl r={0.2} h={0.1} rotation={[0, 0, Math.PI / 2]} position={[sx * 0.95, 0, 0]} mat={MAT.rubber} />
          </group>
        )))}
        <Cyl r={0.55} h={0.12} position={[0, -0.8, 0]} mat={MAT.steel} />
        <Cyl r={0.55} h={0.12} position={[0, 0.8, 0]} mat={MAT.steel} />
      </group>
      <group name="RG-BOPSTACK-ANNULAR" position={[0, 5.5, 0]}>
        <Cyl r={0.62} r2={0.5} h={0.9} mat={MAT.darkSteel} />
        <Cyl r={0.5} r2={0.62} h={0.3} position={[0, 0.6, 0]} mat={MAT.darkSteel} />
        <Cyl r={0.66} h={0.12} position={[0, -0.5, 0]} mat={MAT.steel} />
      </group>
      <Cyl r={0.3} h={0.8} position={[0, 6.5, 0]} mat={MAT.steel} name="RG-BOPSTACK-BELLNIPPLE" />
      {showLabels && <Label position={[1.4, 5.5, 0]} text={'BOP stack: annular, double rams, spool'} />}
      </group>
    </group>
  );
}
// Workover (completion) rig over the well: substructure, mast, crown, traveling block on a line, drawworks,
// doghouse, pipe racks with tubing. The block travels while tubing is being run.
export function WorkoverRig({ active = false, showLabels, position = [0, 0, 0] }) {
  const block = useRef();
  useFrame((state) => { if (block.current) block.current.position.y = 9.5 + (active ? 5.0 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 0.7)) : 3.0); });
  return (
    <group position={position} name="RG-WORKOVERRIG">
      <Box size={[6.0, 2.2, 5.0]} position={[3.0, 1.1, 0]} mat={MAT.dimSteel} name="RG-WORKOVERRIG-SUBSTRUCTURE" />
      <Box size={[6.0, 0.3, 5.0]} position={[3.0, 2.35, 0]} mat={MAT.darkSteel} />
      {[[-1.4, 1.2], [-1.4, -1.2], [1.4, 1.2], [1.4, -1.2]].map(([dx, dz], i) => (
        <Cyl key={i} r={0.12} h={18} position={[0.1 + dx * 0.5, 2.5 + 9, dz]} rotation={[0, 0, 0]} mat={MAT.redIron} />
      ))}
      {[4, 8, 12, 16].map((h, i) => <Box key={i} size={[1.6, 0.1, 2.6]} position={[0.1, 2.5 + h, 0]} mat={MAT.redIron} />)}
      <Box size={[2.0, 0.6, 3.0]} position={[0.1, 20.6, 0]} mat={MAT.darkSteel} name="RG-WORKOVERRIG-CROWN" />
      <group ref={block} position={[0, 12, 0]} name="RG-WORKOVERRIG-BLOCK">
        <Box size={[0.5, 1.4, 0.7]} mat={MAT.darkSteel} />
        <Box size={[0.4, 0.8, 0.5]} position={[0, -1.1, 0]} mat={MAT.steel} />
        <Cyl r={0.05} h={2.4} position={[0, -2.4, 0]} mat={MAT.steel} />
      </group>
      <Cyl r={0.02} h={12} position={[0, 15, 0.35]} mat={MAT.rubber} />
      <Box size={[2.0, 1.4, 1.6]} position={[4.6, 3.2, 1.4]} mat={MAT.darkSteel} name="RG-WORKOVERRIG-DRAWWORKS" />
      <RBox r={0.12} size={[2.4, 2.2, 2.4]} position={[4.5, 3.6, -1.6]} mat={MAT.white} name="RG-WORKOVERRIG-DOGHOUSE" />
      <Trailer length={12} width={2.8} position={[9.5, 0, 0]}><RBox r={0.12} size={[2.8, 2.2, 2.4]} position={[-4.2, 2.2, 0]} mat={MAT.white} /></Trailer>
      {/* pipe rack with tubing joints */}
      <group position={[8.0, 0, 5.5]} name="RG-WORKOVERRIG-PIPERACK">
        <Box size={[0.3, 1.2, 4.0]} position={[-4, 0.6, 0]} mat={MAT.yellow} />
        <Box size={[0.3, 1.2, 4.0]} position={[4, 0.6, 0]} mat={MAT.yellow} />
        {Array.from({ length: 12 }).map((_, i) => <Cyl key={i} r={0.04} h={9.5} rotation={[0, 0, Math.PI / 2]} position={[0, 1.3 + Math.floor(i / 6) * 0.1, -1.5 + (i % 6) * 0.6]} mat={MAT.steel} />)}
      </group>
      {showLabels && <Label position={[2, 22, 0]} text={'Workover rig (tubing run)'} />}
    </group>
  );
}

// ---------------------------------------------------------------- artificial lift (production phase)
// Conventional beam pumping unit on a skid west of the tree, horsehead over the well. The crank turns, the beam
// rocks, the bridle and polished rod follow. Generic proportions of a mid-size unit.
export function PumpingUnit({ topY = 3.0, partner = false, showLabels }) {
  const beam = useRef(); const crankL = useRef(); const crankR = useRef(); const pitman = useRef(); const rod = useRef();
  const pivot = [-4.6, 3.9, 0];        // center bearing (world, relative to the well)
  const beamLen = 7.0, headR = 1.7;
  const reducer = [-6.7, 1.5, 0], crankLen = 0.95;
  useFrame((state) => {
    const th = state.clock.elapsedTime * 1.2 * (partner ? 0.9 : 1);
    const tilt = 0.16 * Math.sin(th);
    if (beam.current) beam.current.rotation.z = tilt;
    if (crankL.current) crankL.current.rotation.z = th;
    if (crankR.current) crankR.current.rotation.z = th;
    if (pitman.current) {
      const px = reducer[0] + crankLen * Math.cos(th), py = reducer[1] + crankLen * Math.sin(th);
      const tx = pivot[0] - (beamLen / 2 - 0.4) * Math.cos(tilt), ty = pivot[1] - (beamLen / 2 - 0.4) * Math.sin(tilt) - 0.3;
      const dx = tx - px, dy = ty - py; const L = Math.hypot(dx, dy);
      pitman.current.position.set((px + tx) / 2, (py + ty) / 2, 0);
      pitman.current.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
      pitman.current.scale.y = L;
    }
    if (rod.current) rod.current.position.y = 0.15 + headR * Math.sin(tilt) * 0.5;
  });
  const nm = (k) => (partner ? undefined : k);
  return (
    <group name={nm('AL-BEAMUNIT')}>
      <Box size={[5.8, 0.3, 1.9]} position={[-5.1, 0.15, 0]} mat={MAT.darkSteel} name={nm('AL-BEAMUNIT-BASE')} />
      {/* Samson post: three legs to the center bearing */}
      {[[-6.0, 0.7], [-6.0, -0.7], [-3.7, 0]].map(([x, z], i) => {
        const dx = pivot[0] - x, dy = pivot[1] - 0.3, dz = -z; const L = Math.hypot(dx, dy, dz);
        return <Box key={i} size={[0.2, L, 0.2]} position={[(x + pivot[0]) / 2, (0.3 + pivot[1]) / 2, z / 2]} rotation={[Math.atan2(dz, dy) * 0, 0, -Math.atan2(dx, dy)]} mat={MAT.redIron} name={i === 0 ? nm('AL-BEAMUNIT-SAMSONPOST') : undefined} />;
      })}
      <Box size={[0.6, 0.25, 1.0]} position={pivot} mat={MAT.darkSteel} />
      {/* walking beam with horsehead at the +X end and the equalizer at the tail */}
      <group ref={beam} position={pivot} name={nm('AL-BEAMUNIT-WALKINGBEAM')}>
        <Box size={[beamLen, 0.5, 0.35]} position={[0, 0.25, 0]} mat={MAT.redIron} />
        <mesh position={[beamLen / 2 - 0.3, -0.7, 0]} rotation={[Math.PI / 2, 0, 0]} name={nm('AL-BEAMUNIT-HORSEHEAD')}>
          <cylinderGeometry args={[headR, headR, 0.4, 24, 1, false, -0.5, 1.7]} />
          <Mat mat={MAT.redIron} side={THREE.DoubleSide} />
        </mesh>
        <Box size={[0.5, 0.25, 1.6]} position={[-beamLen / 2 + 0.4, -0.05, 0]} mat={MAT.darkSteel} name={nm('AL-BEAMUNIT-EQUALIZER')} />
      </group>
      {/* pitman arm (scaled to length each frame), cranks, counterweights, reducer, motor and belt guard */}
      <group ref={pitman} name={nm('AL-BEAMUNIT-PITMAN')}><Box size={[0.16, 1, 0.16]} position={[0, 0, 0.75]} mat={MAT.darkSteel} /><Box size={[0.16, 1, 0.16]} position={[0, 0, -0.75]} mat={MAT.darkSteel} /></group>
      {[[crankL, 0.95], [crankR, -0.95]].map(([ref, z], i) => (
        <group key={i} ref={ref} position={[reducer[0], reducer[1], z]} name={i === 0 ? nm('AL-BEAMUNIT-CRANK') : undefined}>
          <Box size={[crankLen * 2 + 0.6, 0.35, 0.12]} mat={MAT.darkSteel} />
          <Box size={[0.75, 0.55, 0.28]} position={[-crankLen + 0.1, 0, z > 0 ? 0.2 : -0.2]} mat={MAT.rubber} name={i === 0 ? nm('AL-BEAMUNIT-COUNTERWEIGHT') : undefined} />
        </group>
      ))}
      <Box size={[1.3, 1.1, 1.5]} position={[reducer[0], reducer[1] - 0.1, 0]} mat={MAT.darkSteel} name={nm('AL-BEAMUNIT-GEARREDUCER')} />
      <Box size={[1.5, 0.5, 1.7]} position={[reducer[0], 0.55, 0]} mat={MAT.darkSteel} />
      <Cyl r={0.3} h={0.8} rotation={[0, 0, Math.PI / 2]} position={[-8.4, 0.75, 0]} mat={MAT.darkSteel} name={nm('AL-BEAMUNIT-PRIMEMOVER')} />
      <Box size={[2.2, 0.9, 0.12]} position={[-7.6, 1.3, -0.95]} rotation={[0, 0, 0.35]} mat={MAT.redIron} name={nm('AL-BEAMUNIT-BELTGUARD')} />
      {/* bridle and polished rod over the well */}
      <group ref={rod} name={nm('AL-BEAMUNIT-POLISHEDROD')}>
        <Cyl r={0.012} h={pivot[1] + 0.3 - topY} position={[0, topY + (pivot[1] + 0.3 - topY) / 2, 0.08]} mat={MAT.rubber} />
        <Cyl r={0.012} h={pivot[1] + 0.3 - topY} position={[0, topY + (pivot[1] + 0.3 - topY) / 2, -0.08]} mat={MAT.rubber} />
        <Box size={[0.35, 0.12, 0.4]} position={[0, topY + 0.6, 0]} mat={MAT.steel} />
        <Cyl r={0.02} h={1.3} position={[0, topY + 0.1, 0]} mat={MAT.white} />
      </group>
      {showLabels && <Label position={[-5, 6.2, 0]} text={'Beam pumping unit (rod pump)'} />}
    </group>
  );
}
// ESP surface: variable speed drive and transformer on a skid, junction box, cable to the wellhead penetrator.
export function EspSurface({ partner = false, showLabels }) {
  const nm = (k) => (partner ? undefined : k);
  return (
    <group name={nm('AL-ESP-SURFACE')}>
      <Box size={[3.0, 0.2, 2.0]} position={[-4.5, 0.1, 3.0]} mat={MAT.dimSteel} />
      <RBox r={0.08} size={[1.2, 2.0, 0.8]} position={[-5.2, 1.2, 3.0]} mat={MAT.blue} name={nm('AL-ESP-VSD')} />
      <Box size={[1.2, 1.4, 1.2]} position={[-3.7, 0.9, 3.0]} mat={MAT.steel} name={nm('AL-ESP-TRANSFORMER')} />
      {[-0.35, 0, 0.35].map((dz, i) => <Box key={i} size={[1.3, 1.2, 0.05]} position={[-3.7, 0.9, 3.0 + dz]} mat={MAT.darkSteel} />)}
      <Box size={[0.4, 0.5, 0.3]} position={[-1.6, 1.6, 1.4]} mat={MAT.steel} name={nm('AL-ESP-JUNCTIONBOX')} />
      <Cyl r={0.04} h={1.6} position={[-1.6, 0.8, 1.4]} mat={MAT.darkSteel} />
      <PipeRun points={[[-4.6, 1.9, 3.0], [-1.6, 1.9, 1.4], [-0.5, 1.9, 0.3], [-0.42, 1.55, 0.2]]} r={0.03} mat={MAT.rubber} />
      <Box size={[0.22, 0.22, 0.22]} position={[-0.42, 1.5, 0.2]} mat={MAT.brass} name={nm('AL-ESP-PENETRATOR')} />
      {showLabels && <Label position={[-4.5, 3.0, 3.0]} text={'ESP drive, transformer, and cable'} />}
    </group>
  );
}
// Gas lift surface: compressor skid with cooler, injection line to the casing side outlet, meter run.
export function GasLiftSurface({ partner = false, showLabels }) {
  const nm = (k) => (partner ? undefined : k);
  return (
    <group name={nm('AL-GASLIFT-SURFACE')}>
      <Box size={[5.0, 0.25, 2.2]} position={[-8.0, 0.12, 5.0]} mat={MAT.yellow} name={nm('AL-GASLIFT-COMPRESSOR')} />
      <Cyl r={0.5} h={2.0} rotation={[0, 0, Math.PI / 2]} position={[-9.2, 1.0, 5.0]} mat={MAT.darkSteel} />
      <Box size={[1.4, 1.2, 1.2]} position={[-7.0, 0.85, 5.0]} mat={MAT.steel} />
      <Box size={[1.6, 1.8, 0.5]} position={[-6.0, 1.3, 5.0]} mat={MAT.darkSteel} />
      <Cyl r={0.45} h={2.4} rotation={[0, 0, Math.PI / 2]} position={[-8.0, 2.0, 4.2]} mat={MAT.steel} />
      <PipeRun points={[[-5.6, 0.6, 5.0], [-2.5, 0.6, 5.0], [-2.5, 0.6, 0.0], [-1.2, 1.05, 0.0], [-0.9, 1.05, 0.0]]} r={0.05} mat={MAT.yellow} name={nm('AL-GASLIFT-INJECTIONLINE')} />
      <Box size={[0.3, 0.3, 0.3]} position={[-2.5, 0.75, 2.5]} mat={MAT.blue} name={nm('AL-GASLIFT-METER')} />
      {showLabels && <Label position={[-8, 3.4, 5]} text={'Gas lift compressor and injection line'} />}
    </group>
  );
}
// Plunger lift controller on a post with a solar panel, and the motor valve on the flowline.
export function PlungerController({ partner = false }) {
  const nm = (k) => (partner ? undefined : k);
  return (
    <group name={nm('AL-PLUNGERLIFT-CONTROLLER')}>
      <Cyl r={0.04} h={2.2} position={[2.2, 1.1, 1.6]} mat={MAT.darkSteel} />
      <Box size={[0.4, 0.5, 0.25]} position={[2.2, 1.7, 1.6]} mat={MAT.steel} />
      <Box size={[0.7, 0.5, 0.04]} position={[2.2, 2.4, 1.5]} rotation={[-0.6, 0, 0]} mat={{ color: '#1c2f5a', metalness: 0.4, roughness: 0.3 }} />
      <Box size={[0.3, 0.45, 0.3]} position={[1.9, 2.75, 0]} mat={MAT.blue} name={nm('AL-PLUNGERLIFT-MOTORVALVE')} />
    </group>
  );
}

// Wireline pressure control stack on the tree: adapter, wireline valve, tool trap, lubricator sections, grease head.
export const LUB_HEIGHT = 2.0 + 4 * 2.4 + 0.7;            // grease head top above the stack base
export const lubricatorTopY = (d, bore) => d.topY - bore * 1.5 + LUB_HEIGHT;   // world height of the grease head top on a tree
export function Lubricator({ baseY, wlStep, showLabels }) {
  const r = 0.16;
  const sections = 4, secH = 2.4;
  const toolVisible = wlStep === 'idle' || wlStep === 'done' || wlStep === 'pooh';
  return (
    <group name="WL-PCE-STACK" position={[0, baseY, 0]}>
      <Cyl r={0.34} h={0.25} position={[0, 0.125, 0]} mat={MAT.steel} name="WL-PCE-WELLHEADADAPTER" />
      <Box size={[0.75, 0.9, 0.55]} position={[0, 0.7, 0]} mat={MAT.darkSteel} name="WL-PCE-WIRELINEVALVE" />
      <Cyl r={0.06} h={0.5} rotation={[0, 0, Math.PI / 2]} position={[0.55, 0.7, 0]} mat={MAT.blue} />
      <Cyl r={0.06} h={0.5} rotation={[0, 0, Math.PI / 2]} position={[-0.55, 0.7, 0]} mat={MAT.blue} />
      <Cyl r={0.24} h={0.5} position={[0, 1.4, 0]} mat={MAT.steel} name="WL-PCE-TOOLTRAP" />
      <Cyl r={0.2} h={0.35} position={[0, 1.83, 0]} mat={MAT.steel} name="WL-PCE-PUMPINSUB" />
      <Cyl r={0.08} h={0.5} rotation={[0, 0, Math.PI / 2]} position={[0.3, 1.83, 0]} mat={MAT.redIron} />
      {Array.from({ length: sections }).map((_, i) => (
        <group key={i} name={i === 0 ? 'WL-PCE-LUBRICATOR' : undefined}>
          <Cyl r={r} h={secH} position={[0, 2.0 + secH / 2 + i * secH, 0]} mat={MAT.steel} />
          <Cyl r={r * 1.35} h={0.14} position={[0, 2.0 + (i + 1) * secH, 0]} mat={MAT.darkSteel} name={i === 0 ? 'WL-PCE-QUICKUNION' : undefined} />
        </group>
      ))}
      <Cyl r={0.19} h={0.7} position={[0, 2.0 + sections * secH + 0.35, 0]} mat={MAT.darkSteel} name="WL-PCE-GREASEHEAD" />
      <Cyl r={0.05} h={0.35} rotation={[0, 0, Math.PI / 2]} position={[0.25, 2.0 + sections * secH + 0.5, 0]} mat={MAT.blue} />
      {/* lifting bail on top of the grease head: the crane hook holds the stack by it */}
      <Cyl r={0.05} h={0.2} position={[0, LUB_HEIGHT + 0.1, 0]} mat={MAT.darkSteel} />
      <mesh position={[0, LUB_HEIGHT + 0.32, 0]} rotation={[0, Math.PI / 2, 0]} castShadow><torusGeometry args={[0.14, 0.03, 8, 18]} /><Mat mat={MAT.darkSteel} /></mesh>
      {/* tool string parked in the lubricator when not in the well */}
      {toolVisible && (
        <group position={[0, 2.0 + sections * secH - 4.0, 0]} name="WL-TOOLSTRING">
          <Cyl r={0.05} h={3.2} mat={MAT.brass} />
          <Cyl r={0.06} h={0.9} position={[0, -2.0, 0]} mat={MAT.rubber} />
        </group>
      )}
      {showLabels && <Label position={[0.5, 6, 0]} text={'Lubricator (wireline PCE)'} />}
    </group>
  );
}

// ---------------------------------------------------------------- zipper manifold
// Vertical zipper: the missile treating line enters through an inlet isolation valve into a low header along the
// skid. Each well has a vertical leg off the header: a lower isolation valve, an upper working valve, and a top
// elbow that turns toward the tree at the leg's outlet flange. Well 0 binds to the store's zipIso and zipWork
// valves; partner wells open both while they are being pumped, the lower one only while they wait.
export const ZIPPER_X = -8;
export const HOSE_BUNDLE_X = -4.6;        // ground bundle of the tree hydraulic trunks, between the containment berm and the zipper
export const ZIPPER_BUNDLE_X = -11.4;     // ground bundle of the zipper leg trunks, on the pump side of the manifold
export function zipperDims(bore) {
  const bz = Math.min(bore, 0.18);
  const ftf = bz * 6.3;
  const headerY = 0.55;
  const isoY = headerY + 0.5 + ftf / 2;
  const workY = isoY + ftf + 0.18;
  const topY = treeDims(bore).inletY;      // the top elbow sits at the tree inlet height: a level spool runs to the inlet block
  return { bz, ftf, headerY, isoY, workY, topY, outletX: 1.9 };
}
// Layout from pad photographs (proportions only): the header lies low along the ground on pipe supports, each leg
// stands on its own small base, and the flanged line from the top elbow runs level to the top of the tree.
export function ZipperManifold({ valves, showLabels, position = [ZIPPER_X, 0, 0], wellZ = [0], roles = [], bore = 0.18, focusValve = null }) {
  const n = wellZ.length;
  const z0 = wellZ[0], z1 = wellZ[n - 1];
  const len = Math.abs(z1 - z0) + 6.0;
  const zc = (z0 + z1) / 2;
  const zFront = zc - len / 2;
  const d = zipperDims(bore);
  const hx = -1.0;
  return (
    <group position={position} name="WH-ZIPPER">
      {/* inlet isolation valve from the missile, bore along the header, at the front end */}
      <Box size={[2.6, 0.2, 2.4]} position={[hx + 0.3, 0.1, zFront + 0.9]} mat={MAT.yellow} name="WH-ZIPPER-SKID" />
      <GateValveBlock open={valves.iso.pos} kind="hydraulic" axis="z" bore={d.bz} position={[hx, d.headerY, zFront + 0.9]} name="WH-ZIPPER-INLETVALVE" pulse={focusValve === 'iso'} label={showLabels ? 'Inlet isolation valve (from the missile)' : null} />
      <Pipe from={[hx, d.headerY, zFront + 0.9 + d.ftf / 2]} to={[hx, d.headerY, zc + len / 2 - 0.6]} r={d.bz * 0.62} mat={MAT.redIron} unions={false} name="WH-ZIPPER-INLETHEADER" />
      {Array.from({ length: Math.max(2, Math.round(len / 4)) }).map((_, i) => <Box key={i} size={[0.6, d.headerY - d.bz * 0.55, 0.3]} position={[hx, (d.headerY - d.bz * 0.55) / 2, zFront + 2.2 + i * 4]} mat={MAT.darkSteel} />)}
      {/* bleed valve on the far end of the header */}
      <GateValveBlock open={0} kind="manual" axis="z" bore={0.05} position={[hx, d.headerY, zc + len / 2 - 0.25]} name="WH-ZIPPER-BLEEDVALVE" />
      {wellZ.map((z, i) => {
        const role = roles[i] ? roles[i].role : 'idle';
        const isoOpen = i === 0 ? valves.zipIso.pos : role === 'wireline' || role === 'done' ? 0 : 1;
        const workOpen = i === 0 ? valves.zipWork.pos : role === 'frac' ? 1 : 0;
        return (
          <group key={i} position={[hx, 0, z]} name={i === 0 ? undefined : 'WH-ZIPPER-LEG-' + (i + 1)}>
            {/* base, tee on the header, riser to the lower valve */}
            <Box size={[2.4, 0.2, 2.2]} position={[0.2, 0.1, 0]} mat={MAT.yellow} />
            <Box size={[d.bz * 2.2, d.bz * 2.2, d.bz * 2.2]} position={[0, d.headerY, 0]} mat={MAT.darkSteel} name={i === 0 ? 'WH-ZIPPER-LEG' : undefined} />
            <Cyl r={d.bz * 0.62} h={0.5} position={[0, d.headerY + 0.25 + d.bz * 0.5, 0]} mat={MAT.steel} />
            <group rotation={[0, Math.PI / 2, 0]}>
              <GateValveBlock open={isoOpen} kind="hydraulic" bore={d.bz} position={[0, d.isoY, 0]} name={i === 0 ? 'WH-ZIPPER-ISOVALVE' : undefined} pulse={i === 0 && focusValve === 'zipIso'} label={showLabels && i === 0 ? 'Leg: lower isolation valve' : null} studs={false} />
              <Cyl r={d.bz * 0.62} h={0.18} position={[0, d.isoY + d.ftf / 2 + 0.09, 0]} mat={MAT.steel} />
              <GateValveBlock open={workOpen} kind="hydraulic" bore={d.bz} position={[0, d.workY, 0]} name={i === 0 ? 'WH-ZIPPER-VALVE' : undefined} pulse={i === 0 && focusValve === 'zipWork'} label={showLabels && i === 0 ? 'Leg: upper working valve (this well)' : null} studs={false} />
              <StudField items={[{ position: [0, d.isoY, 0], axis: 'vertical', bore: d.bz }, { position: [0, d.workY, 0], axis: 'vertical', bore: d.bz }]} />
            </group>
            {/* gauge on the tee, hydraulic hose pairs from both actuators (they point -X) to a junction at the base, trunk to the control unit */}
            <Gauge position={[-d.bz * 1.3, d.headerY + d.bz * 1.1 + 0.2, d.bz * 1.0]} rotation={[0, Math.PI / 2, 0]} r={0.07} />
            <HosePair from={[actuatorHoseZ(d.bz), d.isoY, 0]} to={[-1.4, 0.3, 0.25]} />
            <HosePair from={[actuatorHoseZ(d.bz), d.workY, 0]} to={[-1.4, 0.3, -0.25]} />
            <BoltRings rings={[
              { p: [0, d.workY + d.ftf / 2 + d.bz * 0.25, 0], dir: [0, 1, 0], n: 8, bc: d.bz * 1.1, sr: d.bz * 0.075, sh: d.bz * 1.0 },
              { p: [0, d.topY - d.bz * 1.2 - d.bz * 0.25, 0], dir: [0, 1, 0], n: 8, bc: d.bz * 1.1, sr: d.bz * 0.075, sh: d.bz * 1.0 },
              { p: [d.outletX - d.bz * 0.25, d.topY, 0], dir: [1, 0, 0], n: 8, bc: d.bz * 1.1, sr: d.bz * 0.075, sh: d.bz * 1.0 },
            ]} />
            <Box size={[0.3, 0.3, 0.7]} position={[-1.45, 0.25, 0]} mat={MAT.chassis} />
            {/* riser spool from the working valve up to the top elbow at tree inlet height, with a flange at each end */}
            <Cyl r={d.bz * 0.62} h={Math.max(0.2, d.topY - d.bz * 1.2 - (d.workY + d.ftf / 2))} position={[0, (d.topY - d.bz * 1.2 + d.workY + d.ftf / 2) / 2, 0]} mat={MAT.steel} />
            <Cyl r={d.bz * 1.4} h={d.bz * 0.5} position={[0, d.workY + d.ftf / 2 + d.bz * 0.25, 0]} mat={MAT.steel} />
            <Cyl r={d.bz * 1.4} h={d.bz * 0.5} position={[0, d.topY - d.bz * 1.2 - d.bz * 0.25, 0]} mat={MAT.steel} />
            {/* top elbow block with a flanged outlet toward the tree (+X) */}
            <group name={i === 0 ? 'WH-ZIPPER-OUTLET' : undefined}>
              <Box size={[d.bz * 2.4, d.bz * 2.4, d.bz * 2.4 * 1.2]} position={[0, d.topY, 0]} mat={MAT.redIron} />
              <Cyl r={d.bz * 0.62} h={d.outletX - d.bz * 1.2} rotation={[0, 0, Math.PI / 2]} position={[d.bz * 1.2 + (d.outletX - d.bz * 1.2) / 2, d.topY, 0]} mat={MAT.redIron} />
              <Cyl r={d.bz * 1.4} h={d.bz * 0.5} rotation={[0, 0, Math.PI / 2]} position={[d.outletX - d.bz * 0.25, d.topY, 0]} mat={MAT.steel} />
              <Box size={[0.14, 0.14, 0.2]} position={[0, d.topY + d.bz * 1.2 + 0.12, 0]} mat={MAT.blue} name={i === 0 ? 'WH-ZIPPER-TRANSDUCER' : undefined} />
            </group>
          </group>
        );
      })}
      {/* hose trunks from each leg junction down to the ground bundle on the pump side (it runs to the accumulator unit outside the red zone); placard at the inlet, gauge on the inlet valve */}
      {wellZ.map((z, i) => <Hose key={'t' + i} from={[hx - 1.45, 0.2, z]} to={[ZIPPER_BUNDLE_X - position[0], 0.07, z]} r={0.04} sag={0.0} segments={4} />)}
      <Sign lines={['DANGER', 'HIGH PRESSURE', 'KEEP CLEAR']} position={[1.2, 1.35, zFront - 0.6]} rotation={[0, Math.PI, 0]} width={0.8} height={0.5} post={1.1} danger />
      <Gauge position={[hx - d.bz * 1.3, d.headerY + d.bz * 1.3 + 0.2, zFront + 0.9 - d.bz * 1.6]} rotation={[0, Math.PI / 2, 0]} r={0.07} />
      {showLabels && <Label position={[0, d.topY + 1.2, zc]} text={'Zipper manifold: ' + n + ' vertical leg' + (n > 1 ? 's' : '') + ', two valves each'} />}
    </group>
  );
}

// ---------------------------------------------------------------- accumulator unit (frac valve control)
// Skid outside the red zone: hydraulic power unit (motor and reservoir), the accumulator bottle bank in its rack,
// and the control panel facing the wells with a regulator, gauge, and selector per valve. The ground hose bundles
// from the trees and the zipper legs come in at the back of the skid. Generic proportions.
export function Accumulator({ position = [0, 0, 0], rotation = [0, 0, 0], showLabels }) {
  return (
    <group position={position} rotation={rotation} name="WH-FRACVALVECONTROL">
      <BlobShadow size={[4.6, 3.6]} />
      <Box size={[3.4, 0.2, 2.4]} position={[0, 0.1, 0]} mat={MAT.yellow} />
      <Box size={[3.4, 0.03, 2.4]} position={[0, 0.215, 0]} mat={MAT.grating} castShadow={false} />
      {/* hydraulic power unit: electric motor on the pump, reservoir tank with a sight glass, filter */}
      <group name="WH-FRACVALVECONTROL-HPU" position={[-1.05, 0.22, 0.05]}>
        <Box size={[1.1, 0.9, 0.9]} position={[0, 0.45, 0]} mat={MAT.chassis} />
        <Cyl r={0.22} h={0.6} rotation={[0, 0, Math.PI / 2]} position={[0, 1.15, 0]} mat={MAT.blue} />
        <Cyl r={0.12} h={0.4} rotation={[0, 0, Math.PI / 2]} position={[0.5, 1.15, 0]} mat={MAT.darkSteel} />
        <Box size={[0.08, 0.5, 0.06]} position={[-0.58, 0.5, 0.2]} mat={MAT.glass} />
        <Cyl r={0.08} h={0.3} position={[0.4, 1.05, 0.5]} mat={MAT.steel} />
      </group>
      {/* accumulator bank: eight bottles in two rows, clamped in a rack */}
      <group name="WH-FRACVALVECONTROL-ACCUMULATOR" position={[0.55, 0.22, -0.45]}>
        <Merged mat={MAT.steel} parts={() => [0, 1, 2, 3].flatMap(i => [0, 1].map(j => ({ g: GEO.cyl(0.13, 1.35, 12), p: [-0.6 + i * 0.4, 0.7, j * 0.45] })))} />
        <Merged mat={MAT.darkSteel} shadow={false} parts={() => [
          ...[0, 1, 2, 3].flatMap(i => [0, 1].map(j => ({ g: GEO.cyl(0.08, 0.14, 8), p: [-0.6 + i * 0.4, 1.44, j * 0.45] }))),
          { g: GEO.box(1.8, 0.06, 1.1), p: [0, 0.35, 0.22] }, { g: GEO.box(1.8, 0.06, 1.1), p: [0, 1.15, 0.22] },
          { g: GEO.box(0.06, 1.4, 0.06), p: [-0.9, 0.7, -0.3] }, { g: GEO.box(0.06, 1.4, 0.06), p: [0.9, 0.7, -0.3] }, { g: GEO.box(0.06, 1.4, 0.06), p: [-0.9, 0.7, 0.75] }, { g: GEO.box(0.06, 1.4, 0.06), p: [0.9, 0.7, 0.75] },
          { g: GEO.cyl(0.03, 1.9, 6), p: [0, 1.5, 0.22], r: [0, 0, Math.PI / 2] },
        ]} />
      </group>
      {/* control panel facing the wells: a gauge and selector per valve under a sun shade, gauges on the hydraulic supply */}
      <group name="WH-FRACVALVECONTROL-PANEL" position={[0.1, 0.22, 0.85]}>
        <Box size={[2.2, 1.25, 0.26]} position={[0, 0.95, 0]} mat={MAT.paintWhite} />
        <Box size={[2.3, 0.06, 0.9]} position={[0, 1.65, 0.2]} mat={MAT.chassis} castShadow={false} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map(k => <Gauge key={k} position={[-0.88 + k * 0.25, 1.3, 0.14]} rotation={[0, 0, 0]} r={0.075} />)}
        <Merged mat={MAT.paintRed} shadow={false} parts={() => [0, 1, 2, 3, 4, 5, 6, 7].map(k => ({ g: GEO.box(0.05, 0.16, 0.05), p: [-0.88 + k * 0.25, 0.8, 0.15], r: [0.5, 0, 0] }))} />
        <Merged mat={MAT.darkSteel} shadow={false} parts={() => [0, 1, 2, 3, 4, 5, 6, 7].map(k => ({ g: GEO.cyl(0.045, 0.05, 8), p: [-0.88 + k * 0.25, 0.62, 0.14], r: [Math.PI / 2, 0, 0] }))} />
        <Gauge position={[0.95, 0.75, 0.14]} r={0.09} />
        <Box size={[0.35, 0.12, 0.04]} position={[-0.9, 0.52, 0.14]} mat={MAT.paintRed} castShadow={false} />
        {[-0.6, 0.6].map((x, k) => <Cyl key={k} r={0.03} h={0.2} position={[x, 0.1, 0]} mat={MAT.darkSteel} />)}
      </group>
      {/* the two ground hose bundles (trees, zipper legs) come in at the back corner into the manifold block */}
      <Box size={[0.5, 0.3, 0.5]} position={[-1.35, 0.37, -0.75]} mat={MAT.chassis} />
      {[-0.75, -0.45].map((z, k) => <Hose key={k} from={[-2.2, 0.07, z]} to={[-1.6, 0.3, z]} r={0.07} sag={-0.04} segments={6} />)}
      <Sign lines={['ACCUMULATOR', 'VALVE CONTROL']} position={[2.3, 1.5, 0.9]} rotation={[0, 0, 0]} width={1.4} height={0.55} post={1.5} />
      {showLabels && <Label position={[0, 2.6, 0]} text={'Accumulator unit (frac valve control), outside the red zone'} />}
    </group>
  );
}

// Remote hydraulic stand: one per tree-and-leg pair, each operating up to eight valves (five on the tree, two on
// the zipper leg). A panel on a stand with a selector and gauge per valve, supply in from the previous stand (daisy
// chain from the accumulator), control hoses out to its tree and leg junction boxes.
export function HydraulicStand({ position = [0, 0, 0], rotation = [0, 0, 0], number = 1, showLabels }) {
  return (
    <group position={position} rotation={rotation} name={'WH-FRACVALVECONTROL-STAND-' + number}>
      <BlobShadow size={[1.8, 1.4]} />
      <Box size={[0.9, 0.06, 0.6]} position={[0, 0.03, 0]} mat={MAT.yellow} castShadow={false} />
      <Cyl r={0.04} h={1.1} position={[0, 0.6, -0.1]} mat={MAT.darkSteel} />
      <Box size={[0.8, 0.55, 0.14]} position={[0, 1.35, 0]} rotation={[-0.25, 0, 0]} mat={MAT.paintWhite} />
      <Merged mat={MAT.paintRed} shadow={false} parts={() => Array.from({ length: 8 }).map((_, k) => ({ g: GEO.box(0.04, 0.12, 0.04), p: [-0.3 + (k % 4) * 0.2, 1.5 - Math.floor(k / 4) * 0.22, 0.09], r: [-0.25 + 0.4, 0, 0] }))} />
      <Merged mat={MAT.darkSteel} shadow={false} parts={() => Array.from({ length: 8 }).map((_, k) => ({ g: GEO.cyl(0.035, 0.03, 8), p: [-0.2 + (k % 4) * 0.2, 1.5 - Math.floor(k / 4) * 0.22, 0.08], r: [Math.PI / 2 - 0.25, 0, 0] }))} />
      <Box size={[0.26, 0.07, 0.03]} position={[0.28, 1.14, 0.08]} rotation={[-0.25, 0, 0]} mat={MAT.chassis} castShadow={false} />
      <Box size={[0.3, 0.2, 0.3]} position={[0, 0.35, -0.1]} mat={MAT.chassis} />
      {showLabels && <Label position={[0, 1.9, 0]} text={'Hydraulic stand ' + number + ': tree ' + number + ' and leg ' + number} />}
    </group>
  );
}
// Positions for n stands on an arc in front of the accumulator: the arc opens toward the wells (+Z).
export function standLayout(n, center = [-2, -22], radius = 5) {
  const r = Math.max(radius, n * 1.15);
  const span = Math.min(Math.PI * 0.85, Math.max(Math.PI * 0.35, (n - 1) * 0.42));
  return Array.from({ length: n }, (_, i) => {
    const a = n === 1 ? 0 : -span / 2 + (span * i) / (n - 1);
    return { x: center[0] + Math.sin(a) * r, z: center[1] + Math.cos(a) * r, rot: Math.PI + a * 0.4 };   // panels face the wells, fanned a little
  });
}

// ---------------------------------------------------------------- missile and pumps
// Manifold trailer ("missile"): two low-pressure suction headers along the outer edges with an outlet per pump
// (butterfly valve and hose stub), and the high-pressure discharge header down the middle built from junction
// fittings, each with a radial feed port, check valve, and swivel arm to a pump. A pressure transducer and the
// relief valve sit on the header; the outlet at the front end feeds the treating line to the zipper.
export const MISSILE_PITCH = 3.6;
export function missileDims(perSide) { const len = perSide * MISSILE_PITCH + 3.0; return { len, hpY: 2.15, lpY: 1.45, hpZ: 0, lpZ: 1.15 }; }
export function Missile({ position = [-30, 0, 2], showLabels, perSide = 4, prvLifted = false, pumping = false }) {
  const d = missileDims(perSide);
  const xs = Array.from({ length: perSide }, (_, i) => (i - (perSide - 1) / 2) * MISSILE_PITCH);
  return (
    <Trailer length={d.len} width={3.0} position={position} rotation={[0, Math.PI / 2, 0]} name="PP-MISSILE">
      {/* low-pressure side: two suction headers, one per side, fed from the blender at the rear; outlets merged per side */}
      {[-1, 1].map(side => (
        <group key={side} name={side === 1 ? 'PP-MISSILE-LPHEADER' : undefined}>
          <Pipe from={[-d.len / 2 + 0.4, d.lpY, side * d.lpZ]} to={[d.len / 2 - 1.0, d.lpY, side * d.lpZ]} r={0.28} mat={MAT.steel} unions={false} />
          <Cyl r={0.3} h={0.1} rotation={[0, 0, Math.PI / 2]} position={[d.len / 2 - 1.0, d.lpY, side * d.lpZ]} mat={MAT.darkSteel} />
          <group name={side === 1 ? 'PP-MISSILE-LPOUTLET' : undefined}>
            <Merged mat={MAT.steel} deps={[perSide, side]} parts={() => xs.map(x => ({ g: GEO.cyl(0.12, 0.5), p: [x, d.lpY, side * (d.lpZ + 0.45)], r: [Math.PI / 2, 0, 0] }))} />
            <Merged mat={MAT.darkSteel} deps={[perSide, side]} parts={() => xs.map(x => ({ g: GEO.cyl(0.2, 0.08), p: [x, d.lpY, side * (d.lpZ + 0.62)], r: [Math.PI / 2, 0, 0] }))} />
            <Merged mat={MAT.redIron} deps={[perSide, side]} parts={() => xs.map(x => ({ g: GEO.box(0.06, 0.22, 0.06), p: [x, d.lpY + 0.22, side * (d.lpZ + 0.62)] }))} />
          </group>
        </group>
      ))}
      {/* high-pressure side: junction fittings joined by flanged spools, feed ports alternate sides; merged by material */}
      <group name="PP-MISSILE-HPHEADER">
        <Merged mat={MAT.darkSteel} deps={[perSide]} parts={() => xs.flatMap((x, i) => [
          { g: GEO.box(0.62, 0.62, 0.62), p: [x, d.hpY, d.hpZ] },
          ...(i < perSide - 1 ? [{ g: GEO.cyl(0.2, MISSILE_PITCH - 1.06), p: [x + MISSILE_PITCH / 2, d.hpY, d.hpZ], r: [0, 0, Math.PI / 2] }] : []),
        ])} />
        <Merged mat={MAT.steel} deps={[perSide]} parts={() => xs.flatMap(x => [{ g: GEO.cyl(0.34, 0.22), p: [x + 0.42, d.hpY, d.hpZ], r: [0, 0, Math.PI / 2] }, { g: GEO.cyl(0.34, 0.22), p: [x - 0.42, d.hpY, d.hpZ], r: [0, 0, Math.PI / 2] }])} />
        {/* two radial feed ports per fitting, one to each side: check valve then a stub for the swivel arm */}
        <group name="PP-MISSILE-CHECKVALVE">
          <Merged mat={MAT.darkSteel} deps={[perSide]} parts={() => xs.flatMap(x => [-1, 1].map(side => ({ g: GEO.cyl(0.13, 0.5), p: [x, d.hpY, d.hpZ + side * (0.31 + 0.25)], r: [Math.PI / 2, 0, 0] })))} />
          <Merged mat={MAT.steel} deps={[perSide]} parts={() => xs.flatMap(x => [-1, 1].map(side => ({ g: GEO.cyl(0.19, 0.16), p: [x, d.hpY, d.hpZ + side * (0.31 + 0.48)], r: [Math.PI / 2, 0, 0] })))} />
        </group>
        <Merged mat={MAT.redIron} deps={[perSide]} name="PP-MISSILE-SWIVELARM" parts={() => xs.flatMap(x => [-1, 1].map(side => ({ g: GEO.cyl(0.11, 0.5), p: [x, d.hpY, d.hpZ + side * (0.31 + 0.81)], r: [Math.PI / 2, 0, 0] })))} />
        {/* outlet spool at the front (+X local) with a flange, transducer, and the relief valve with its vent line */}
        <Cyl r={0.2} h={1.3} rotation={[0, 0, Math.PI / 2]} position={[xs[perSide - 1] + 0.53 + 0.65, d.hpY, 0]} mat={MAT.darkSteel} name="PP-MISSILE-OUTLET" />
        <Cyl r={0.36} h={0.16} rotation={[0, 0, Math.PI / 2]} position={[xs[perSide - 1] + 0.53 + 1.3, d.hpY, 0]} mat={MAT.steel} />
        <Box size={[0.16, 0.22, 0.16]} position={[xs[perSide - 1] + 0.53 + 0.4, d.hpY + 0.36, 0]} mat={MAT.blue} name="PP-MISSILE-TRANSDUCER" />
        <group position={[xs[perSide - 1] + 0.53 + 0.9, d.hpY, 0]} name="PP-MISSILE-PRV">
          <Cyl r={0.12} h={0.45} position={[0, 0.45, 0]} mat={MAT.steel} />
          <Cyl r={0.17} h={0.3} position={[0, 0.8, 0]} mat={MAT.brass} />
          <PipeRun points={[[0, 0.75, 0], [0, 0.75, -0.6], [0, 0.2, -1.4], [0, 0.2, -2.6]]} r={0.06} mat={MAT.darkSteel} />
          {prvLifted && <mesh position={[0, 0.2, -3.0]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.35, 1.2, 10]} /><meshStandardMaterial color="#cfe8ff" emissive="#9fd0ff" emissiveIntensity={1.5} transparent opacity={0.7} /></mesh>}
        </group>
      </group>
      {/* walkway grating along the header, handrails, stair at the outlet end, pipe supports under the header */}
      <Box size={[d.len - 1.0, 0.04, 0.8]} position={[0, 1.2, 0]} mat={MAT.grating} />
      <Merged mat={MAT.chassis} deps={[perSide]} parts={() => xs.map(x => ({ g: GEO.box(0.3, d.hpY - 1.2 - 0.3, 0.3), p: [x, 1.2 + (d.hpY - 1.2 - 0.3) / 2, 0] }))} />
      <Handrail length={d.len - 1.0} position={[0, d.hpY + 0.35, 0.45]} height={0.95} />
      <Handrail length={d.len - 1.0} position={[0, d.hpY + 0.35, -0.45]} height={0.95} />
      <Stair steps={4} rise={0.3} run={0.3} width={0.8} position={[-d.len / 2 + 0.2, 0, 0]} />
      <HazardStrip position={[d.len / 2 + 0.01, 1.0, 0]} rotation={[0, Math.PI / 2, 0]} length={2.8} height={0.16} />
      <HazardStrip position={[-d.len / 2 - 0.01, 1.0, 0]} rotation={[0, -Math.PI / 2, 0]} length={2.8} height={0.16} />
      <Sign lines={['DANGER', 'HIGH PRESSURE', 'NO ENTRY WHILE PUMPING']} position={[d.len / 2 - 0.6, d.hpY + 1.5, 0]} rotation={[0, Math.PI / 2, 0]} width={1.0} height={0.6} danger />
      {/* LP suction hose stubs: short hose tails on each outlet toward the pump side */}
      {[-1, 1].map(side => xs.map((x, i) => <Hose key={side + '-' + i} from={[x, d.lpY, side * (d.lpZ + 0.62)]} to={[x, 0.3, side * (d.lpZ + 1.4)]} r={0.14} sag={0.15} segments={8} />))}
      {showLabels && <Label position={[0, 3.4, 0]} text={'Missile: low-pressure suction sides, high-pressure discharge header'} />}
      {pumping && <Label position={[xs[perSide - 1] + 1.6, d.hpY + 0.9, 0]} text={'to zipper'} size={0.016} />}
    </Trailer>
  );
}

// `template`: render only the static body (no fan, lamp, plume, or number) for `Instanced`; `FracPumpLive` draws
// those per unit on top of the instanced bodies (Drop 41).
export function FracPump({ position, rotation = [0, 0, 0], online = false, rate = 0, name, electric = false, number = 0, template = false }) {
  const ref = useRef();
  const fan = useRef();
  useFrame((state, dt) => {
    if (template) return;
    if (ref.current) { const amp = online ? 0.004 + rate / 100 * 0.01 : 0; ref.current.position.y = Math.sin(state.clock.elapsedTime * 40) * amp; }
    if (fan.current && online) fan.current.rotation.x += dt * 12;
  });
  // Layout along X: gooseneck and engine (or motor) at -X, transmission, power end, fluid end at +X over the
  // axles, discharge and suction toward the missile at +X. Proportions from pad photographs; generic shapes.
  // The named parts (engine or motor and VFD, transmission, power end, fluid end) are their own meshes for hover
  // picking; the rest of the detail is merged by material.
  const D = 1.18;
  return (
    <Trailer length={13.4} width={2.6} position={position} rotation={rotation} name={name} front={-1}>
      <group ref={ref}>
        {electric ? (
          <>
            <Cyl r={0.82} h={2.9} rotation={[0, 0, Math.PI / 2]} position={[-2.8, D + 0.95, 0]} mat={MAT.darkSteel} name={name + '-MOTOR'} />
            <RBox r={0.12} size={[2.2, 2.3, 2.2]} position={[-5.3, D + 1.15, 0]} mat={MAT.blue} name={name + '-VFD'} />
            {/* motor cooling rings and blower, VFD roof and louvers */}
            <Merged mat={MAT.steel} deps={[electric]} parts={() => [
              ...[-1.0, 0, 1.0].map(x => ({ g: GEO.cyl(0.86, 0.12, 20), p: [-2.8 + x, D + 0.95, 0], r: [0, 0, Math.PI / 2] })),
              // cabinet door handles and hinges on both sides
              ...[-1, 1].flatMap(sz => [
                { g: GEO.box(0.03, 0.22, 0.03), p: [-5.42, D + 1.2, sz * 1.13] }, { g: GEO.box(0.03, 0.22, 0.03), p: [-5.18, D + 1.2, sz * 1.13] },
                ...[0.5, 1.2, 1.9].flatMap(y => [{ g: GEO.cyl(0.015, 0.12, 6), p: [-6.32, D + y, sz * 1.12] }, { g: GEO.cyl(0.015, 0.12, 6), p: [-4.28, D + y, sz * 1.12] }]),
              ]),
            ]} />
            <Merged mat={MAT.darkSteel} deps={[electric]} parts={() => [{ g: GEO.box(0.9, 0.5, 0.7), p: [-3.9, D + 1.95, 0] }]} />
            <Merged mat={MAT.paintWhite} deps={[electric]} parts={() => [{ g: GEO.box(2.1, 0.06, 2.1), p: [-5.3, D + 2.33, 0] }]} />
            {/* VFD louvers on the motor side, cabinet door seams on both sides, louver slats on the back: one dark mesh */}
            <Merged mat={MAT.dimSteel} deps={[electric]} parts={() => [
              ...[-0.6, 0.6].map(z => ({ g: GEO.box(0.02, 1.6, 0.9), p: [-4.18, D + 1.1, z] })),
              ...[-1, 1].flatMap(sz => [
                { g: GEO.box(2.0, 0.015, 0.012), p: [-5.3, D + 2.15, sz * 1.106] }, { g: GEO.box(2.0, 0.015, 0.012), p: [-5.3, D + 0.25, sz * 1.106] },
                { g: GEO.box(0.015, 1.9, 0.012), p: [-6.3, D + 1.2, sz * 1.106] }, { g: GEO.box(0.015, 1.9, 0.012), p: [-4.3, D + 1.2, sz * 1.106] }, { g: GEO.box(0.015, 1.9, 0.012), p: [-5.3, D + 1.2, sz * 1.106] },
              ]),
              ...[0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8].map(y => ({ g: GEO.box(0.03, 0.03, 1.6), p: [-6.42, D + y, 0], r: [0, 0, 0.5] })),
            ]} />
            <Hose from={[-6.4, D + 0.3, 0.6]} to={[-6.9, 0.2, 0.6]} r={0.06} sag={0.1} segments={6} />
            <Hose from={[-6.4, D + 0.3, -0.4]} to={[-6.9, 0.2, -0.4]} r={0.06} sag={0.1} segments={6} />
          </>
        ) : (
          <>
            <RBox r={0.12} size={[3.6, 1.7, 2.1]} position={[-3.5, D + 0.95, 0]} mat={MAT.paintWhite} name={name + '-ENGINE'} />
            {/* hood top, radiator frame, battery box, exhaust and air cleaner, radiator face and slats, fan */}
            <Merged mat={MAT.chassis} deps={[electric]} parts={() => [
              { g: GEO.box(3.4, 0.08, 2.3), p: [-3.5, D + 1.84, 0] }, { g: GEO.box(0.25, 1.9, 2.25), p: [-5.45, D + 1.0, 0] }, { g: GEO.box(1.2, 0.9, 0.5), p: [-1.6, D + 1.0, 1.05] },
              // panel seams and a door outline on each side of the enclosure
              ...[-1, 1].flatMap(sz => [
                { g: GEO.box(3.5, 0.012, 0.012), p: [-3.5, D + 1.78, sz * 1.056] },
                { g: GEO.box(0.012, 1.55, 0.012), p: [-3.5, D + 0.95, sz * 1.056] }, { g: GEO.box(0.012, 1.55, 0.012), p: [-2.3, D + 0.95, sz * 1.056] },
                { g: GEO.box(1.2, 0.012, 0.012), p: [-2.9, D + 0.2, sz * 1.056] },
              ]),
            ]} />
            <Merged mat={MAT.darkSteel} deps={[electric]} parts={() => [{ g: GEO.cyl(0.16, 1.6), p: [-4.3, D + 2.6, 0.7] }, { g: GEO.cyl(0.16, 0.08, 12, 0.26), p: [-4.3, D + 3.42, 0.7] }, { g: GEO.cyl(0.24, 0.9), p: [-2.4, D + 2.15, -0.6], r: [0, 0, Math.PI / 2] }]} />
            <Merged mat={MAT.steel} deps={[electric]} parts={() => [{ g: GEO.cyl(0.28, 0.9), p: [-4.3, D + 2.2, 0.7] }, ...[-1, 1].map(sz => ({ g: GEO.box(0.03, 0.18, 0.03), p: [-2.42, D + 1.0, sz * 1.08] }))]} />
            {/* radiator face and louvered side panels */}
            <Merged mat={MAT.dimSteel} deps={[electric]} parts={() => [{ g: GEO.box(0.04, 1.6, 1.9), p: [-5.6, D + 1.0, 0] }, ...[-1, 1].flatMap(sz => [0.55, 0.75, 0.95, 1.15, 1.35, 1.55].map(y => ({ g: GEO.box(1.3, 0.03, 0.03), p: [-4.3, D + y, sz * 1.06], r: [sz * 0.55, 0, 0] })))]} />
            <Merged mat={MAT.alu} deps={[electric]} parts={() => [-0.6, -0.2, 0.2, 0.6].map(z => ({ g: GEO.box(0.03, 1.5, 0.05), p: [-5.62, D + 1.0, z] }))} />
            {!template && <group ref={fan} position={[-5.3, D + 1.0, 0]}>
              <Merged mat={MAT.alu} shadow={false} parts={() => [0, 60, 120].map(a => ({ g: GEO.box(0.04, 1.3, 0.16), r: [THREE.MathUtils.degToRad(a), 0, 0] }))} />
            </group>}
          </>
        )}
        <RBox r={0.08} size={[1.5, 1.1, 1.5]} position={[-1.2, D + 0.85, 0]} mat={MAT.darkSteel} name={name + '-TRANSMISSION'} />
        <RBox r={0.12} size={[2.4, 1.6, 2.1]} position={[1.6, D + 1.05, 0]} mat={MAT.darkSteel} name={name + '-POWEREND'} />
        <RBox r={0.08} size={[1.1, 1.3, 2.3]} position={[3.4, D + 1.05, 0]} mat={MAT.darkSteel} name={name + '-FLUIDEND'} />
        {/* driveline, lube reservoir, power end covers, plunger housings and valve caps, suction and discharge manifolds */}
        <Merged mat={MAT.steel} parts={() => [
          { g: GEO.cyl(0.12, 1.0), p: [0.0, D + 0.85, 0], r: [0, 0, Math.PI / 2] },
          ...[-1, 1].flatMap(side => [0.9, 1.6, 2.3].map(x => ({ g: GEO.cyl(0.22, 0.05), p: [x, D + 1.05, side * 1.06], r: [Math.PI / 2, 0, 0] }))),
          ...[-0.8, -0.4, 0, 0.4, 0.8].flatMap(z => [{ g: GEO.cyl(0.2, 0.12), p: [4.45, D + 1.05, z], r: [0, 0, Math.PI / 2] }, { g: GEO.cyl(0.15, 0.35), p: [3.4, D + 1.85, z] }, { g: GEO.cyl(0.15, 0.35), p: [3.4, D + 0.25, z] }]),
          { g: GEO.cyl(0.2, 2.4), p: [3.4, D + 0.3, 0], r: [Math.PI / 2, 0, 0] },
          // hose reel flanges, axle, and crank; extinguisher valve and bracket
          { g: GEO.cyl(0.36, 0.03, 20), p: [-6.2, D + 0.55, 0.85], r: [Math.PI / 2, 0, 0] }, { g: GEO.cyl(0.36, 0.03, 20), p: [-6.2, D + 0.55, 0.25], r: [Math.PI / 2, 0, 0] }, { g: GEO.cyl(0.03, 0.9, 8), p: [-6.2, D + 0.55, 0.55], r: [Math.PI / 2, 0, 0] }, { g: GEO.box(0.04, 0.04, 0.2), p: [-5.9, D + 0.55, 0.97] },
          { g: GEO.cyl(0.03, 0.08, 6), p: [-1.1, D + 0.59, 1.18] }, { g: GEO.box(0.02, 0.5, 0.2), p: [-1.19, D + 0.3, 1.18] },
        ]} />
        <Merged mat={MAT.brass} parts={() => [-0.8, -0.4, 0, 0.4, 0.8].map(z => ({ g: GEO.cyl(0.16, 0.55), p: [4.15, D + 1.05, z], r: [0, 0, Math.PI / 2] }))} />
        {/* bolt circles on the valve covers and the discharge flanges (Drop 46): six studs with nuts per cover */}
        <Merged mat={MAT.dimSteel} shadow={false} parts={() => [-0.8, -0.4, 0, 0.4, 0.8].flatMap(z => [
          ...Array.from({ length: 6 }, (_, k) => { const a = k / 6 * Math.PI * 2; return { g: GEO.cyl(0.022, 0.05, 6), p: [3.4 + Math.cos(a) * 0.11, D + 2.03, z + Math.sin(a) * 0.11] }; }),
          ...Array.from({ length: 6 }, (_, k) => { const a = k / 6 * Math.PI * 2; return { g: GEO.cyl(0.022, 0.05, 6), p: [3.4 + Math.cos(a) * 0.11, D + 0.07, z + Math.sin(a) * 0.11] }; }),
          ...Array.from({ length: 8 }, (_, k) => { const a = k / 8 * Math.PI * 2; return { g: GEO.cyl(0.02, 0.05, 6), p: [4.53, D + 1.05 + Math.cos(a) * 0.15, z + Math.sin(a) * 0.15], r: [0, 0, Math.PI / 2] }; }),
        ])} />
        <Merged mat={MAT.darkSteel} parts={() => [{ g: GEO.box(1.4, 0.35, 1.2), p: [1.6, D + 2.0, 0] }, { g: GEO.cyl(0.12, 2.4), p: [3.4, D + 1.95, 0], r: [Math.PI / 2, 0, 0] }]} />
        {/* discharge iron to the missile (top) and the suction hose (bottom) */}
        <Pipe from={[3.4, D + 1.95, 1.2]} to={[5.0, D + 1.95, 1.2]} r={0.07} mat={MAT.redIron} />
        <Pipe from={[5.0, D + 1.95, 1.2]} to={[6.6, D + 1.0, 1.2]} r={0.07} mat={MAT.redIron} />
        {/* the suction hose from the missile lands on this manifold end directly (SurfaceScene draws it, Drop 43) */}
        {/* pump number on the cab side, hazard strip across the rear, exhaust plume while the engine runs */}
        {number > 0 && !template && <Sign lines={['PUMP ' + number]} position={[electric ? -5.3 : -3.5, D + 1.3, 1.16]} width={0.9} height={0.4} bg="#1a1a1a" fg="#ffffff" />}
        <HazardStrip position={[6.72, D - 0.2, 0]} rotation={[0, Math.PI / 2, 0]} length={2.4} height={0.14} />
        {!electric && !template && <ExhaustPlume position={[-4.3, D + 3.5, 0.7]} active={online} strength={0.6 + rate / 150} seed={(number || 1) * 1.7} />}
        {/* hose reel on the gooseneck deck: wrapped hose on the drum (the frame and flanges ride in the merged meshes below); fire extinguisher by the panel */}
        <Merged mat={MAT.hose} shadow={false} parts={() => [{ g: GEO.cyl(0.26, 0.56, 20), p: [-6.2, D + 0.55, 0.55], r: [Math.PI / 2, 0, 0] }, { g: GEO.torus(0.3, 0.03, 6, 20), p: [-6.2, D + 0.55, 0.67] }, { g: GEO.torus(0.3, 0.03, 6, 20), p: [-6.2, D + 0.55, 0.43] }]} />
        <Merged mat={MAT.paintRed} shadow={false} parts={() => [{ g: GEO.cyl(0.075, 0.5, 10), p: [-1.1, D + 0.3, 1.18] }]} />
        {/* deck furniture: walkway grating, handrail on the operator side, control panel, status lamp */}
        <Merged mat={MAT.grating} shadow={false} parts={() => [{ g: GEO.box(9.5, 0.03, 0.6), p: [-0.5, D + 0.02, 1.0] }]} />
        <Handrail length={9.0} position={[-0.5, D, 1.28]} height={1.0} />
        <Merged mat={MAT.chassis} shadow={false} parts={() => [{ g: GEO.box(0.5, 0.7, 0.12), p: [-0.4, D + 1.0, 1.32] }, { g: GEO.box(0.06, 0.55, 0.06), p: [-6.2, D + 0.28, 0.95] }, { g: GEO.box(0.06, 0.55, 0.06), p: [-6.2, D + 0.28, 0.15] }, { g: GEO.box(0.5, 0.05, 1.0), p: [-6.2, D + 0.025, 0.55] }]} />
        {!template && <mesh position={[-0.4, D + 1.35, 1.36]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color={online ? '#35e08f' : '#555'} emissive={online ? '#35e08f' : '#000'} emissiveIntensity={1.5} />
        </mesh>}
      </group>
    </Trailer>
  );
}


// Per-unit live parts over an instanced pump body: the radiator fan, the status lamp, the exhaust plume, the number.
export function FracPumpLive({ position, rotation = [0, 0, 0], online = false, rate = 0, name, electric = false, number = 0 }) {
  const fan = useRef();
  useFrame((state, dt) => { if (fan.current && online) fan.current.rotation.x += dt * 12; });
  const D = 1.18;
  return (
    <group position={position} rotation={rotation} name={name}>
      {!electric && (
        <group ref={fan} position={[-5.3, D + 1.0, 0]}>
          <Merged mat={MAT.alu} shadow={false} parts={() => [0, 60, 120].map(a => ({ g: GEO.box(0.04, 1.3, 0.16), r: [THREE.MathUtils.degToRad(a), 0, 0] }))} />
        </group>
      )}
      {number > 0 && <Sign lines={['PUMP ' + number]} position={[electric ? -5.3 : -3.5, D + 1.3, 1.16]} width={0.9} height={0.4} bg="#1a1a1a" fg="#ffffff" />}
      {!electric && <ExhaustPlume position={[-4.3, D + 3.5, 0.7]} active={online} strength={0.6 + rate / 150} seed={(number || 1) * 1.7} />}
      <mesh position={[-0.4, D + 1.35, 1.36]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color={online ? '#35e08f' : '#555'} emissive={online ? '#35e08f' : '#000'} emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}
export function Blender({ position, showLabels }) {
  const ref = useRef();
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.x += dt * 2.5; });
  const D = 1.18;
  return (
    <Trailer length={13.4} width={2.8} position={position} rotation={[0, Math.PI / 2, 0]} name="PP-BLENDER" front={-1}>
      {/* engine and hydraulic power at the gooseneck, control cabin above it */}
      <RBox r={0.12} size={[3.0, 1.6, 2.2]} position={[-4.6, D + 0.9, 0]} mat={MAT.paintWhite} />
      <RBox r={0.08} size={[2.2, 1.4, 2.4]} position={[-4.4, D + 2.4, 0]} mat={MAT.paintWhite} />
      <Box size={[2.0, 0.6, 2.42]} position={[-4.4, D + 2.6, 0]} mat={MAT.glass} />
      <Cyl r={0.14} h={1.4} position={[-5.7, D + 2.4, 0.8]} mat={MAT.darkSteel} />
      {/* mixing tub with the sand hopper on top and the hydraulic mixer drive */}
      <Cyl r={1.15} h={1.9} position={[-0.6, D + 1.0, 0]} mat={MAT.blue} name="PP-BLENDER-TUB" />
      <Cyl r={1.35} r2={0.6} h={1.1} position={[-0.6, D + 2.5, 0]} mat={MAT.darkSteel} open />
      <Box size={[0.6, 0.5, 0.6]} position={[-0.6, D + 3.3, 0]} mat={MAT.darkSteel} />
      {/* two sand augers rising from ground hoppers at the rear into the tub, in covered tubes */}
      {[0.9, -0.9].map((z, i) => (
        <group key={i} name={i === 0 ? 'PP-BLENDER-AUGER' : undefined}>
          <Cyl r={0.32} h={4.8} rotation={[0, 0, THREE.MathUtils.degToRad(-42)]} position={[2.2, D + 1.4, z]} mat={MAT.steel} />
          <Cyl r={0.34} h={0.5} rotation={[0, 0, THREE.MathUtils.degToRad(-42)]} position={[0.5, D + 2.95, z]} mat={MAT.darkSteel} />
          <Box size={[1.6, 0.9, 1.2]} position={[3.9, D + 0.5, z]} mat={MAT.darkSteel} />
          <Cyl r={0.55} r2={1.0} h={0.9} position={[3.9, D + 1.5, z]} mat={MAT.steel} open />
        </group>
      ))}
      {/* suction and discharge centrifugal pumps with hydraulic motors, manifolds along the deck edges */}
      <group position={[5.2, D + 0.75, 0.8]} name="PP-BLENDER-DISCHARGEPUMP"><Cyl r={0.55} h={0.6} rotation={[0, 0, Math.PI / 2]} mat={MAT.darkSteel} /><Cyl r={0.3} h={0.8} rotation={[0, 0, Math.PI / 2]} position={[0.7, 0, 0]} mat={MAT.steel} /><Cyl r={0.2} h={0.9} position={[0, 0.6, 0]} mat={MAT.steel} /></group>
      <group position={[5.2, D + 0.75, -0.8]} name="PP-BLENDER-SUCTIONPUMP"><Cyl r={0.55} h={0.6} rotation={[0, 0, Math.PI / 2]} mat={MAT.darkSteel} /><Cyl r={0.3} h={0.8} rotation={[0, 0, Math.PI / 2]} position={[0.7, 0, 0]} mat={MAT.steel} /><Cyl r={0.2} h={0.9} position={[0, 0.6, 0]} mat={MAT.steel} /></group>
      <Cyl r={0.3} h={9.0} rotation={[0, 0, Math.PI / 2]} position={[0.8, D + 0.35, 1.25]} mat={MAT.steel} />
      <Cyl r={0.3} h={9.0} rotation={[0, 0, Math.PI / 2]} position={[0.8, D + 0.35, -1.25]} mat={MAT.steel} />
      {[-2.5, -0.5, 1.5, 3.5].map((x, i) => <Cyl key={i} r={0.13} h={0.5} rotation={[Math.PI / 2, 0, 0]} position={[x, D + 0.35, 1.5]} mat={MAT.darkSteel} />)}
      {[-2.5, -0.5, 1.5, 3.5].map((x, i) => <Cyl key={'s' + i} r={0.13} h={0.5} rotation={[Math.PI / 2, 0, 0]} position={[x, D + 0.35, -1.5]} mat={MAT.darkSteel} />)}
      {/* liquid additive tanks and chemical pumps along the deck, walkway and handrail */}
      {[-2.6, -1.8].map((x, i) => <Cyl key={i} r={0.35} h={1.6} position={[x, D + 0.85, 0.9]} mat={MAT.paintWhite} />)}
      <Box size={[1.4, 0.5, 0.8]} position={[-2.2, D + 0.3, -0.9]} mat={MAT.darkSteel} />
      <Handrail length={6.0} position={[1.2, D, 1.42]} height={1.0} />
      <Ladder height={2.2} position={[-6.7, D, 0.6]} rotation={[0, Math.PI / 2, 0]} />
      <group ref={ref} position={[-0.6, D + 3.6, 0]}><Box size={[0.9, 0.06, 0.06]} mat={MAT.alu} /></group>
      {showLabels && <Label position={[0, D + 4.4, 0]} text={'Blender'} />}
    </Trailer>
  );
}

export function Hydration({ position, showLabels }) {
  const D = 1.18;
  return (
    <Trailer length={13.4} width={2.8} position={position} rotation={[0, Math.PI / 2, 0]} name="PP-HYDRATION" front={-1}>
      {/* engine and hydraulics at the gooseneck; the hydration tank runs most of the deck with baffled compartments */}
      <RBox r={0.12} size={[2.4, 1.6, 2.2]} position={[-5.0, D + 0.9, 0]} mat={MAT.paintWhite} />
      <Cyl r={0.14} h={1.2} position={[-5.6, D + 2.3, 0.7]} mat={MAT.darkSteel} />
      <RBox r={0.12} size={[9.4, 2.3, 2.5]} position={[1.0, D + 1.15, 0]} mat={MAT.tankGreen} />
      {[-2.2, 0.2, 2.6].map((x, i) => <Box key={i} size={[0.06, 2.4, 2.56]} position={[x, D + 1.15, 0]} mat={MAT.darkSteel} />)}
      {/* paddle mixer drives on top of each compartment, access hatches, level gauges */}
      {[-3.3, -1.0, 1.4, 3.8].map((x, i) => (
        <group key={i} position={[x, D + 2.3, 0]}>
          <Cyl r={0.2} h={0.7} position={[0, 0.35, 0]} mat={MAT.darkSteel} />
          <Box size={[0.5, 0.35, 0.5]} position={[0, 0.85, 0]} mat={MAT.darkSteel} />
          <Cyl r={0.32} h={0.08} position={[0, 0.04, 0.85]} mat={MAT.steel} />
          <Box size={[0.08, 1.6, 0.08]} position={[0.5, -1.0, 1.27]} mat={MAT.glass} />
        </group>
      ))}
      {/* gel concentrate tank and pump at the rear, suction and discharge manifolds, walkway */}
      <Cyl r={0.55} h={1.6} position={[6.1, D + 0.85, 0.6]} mat={MAT.paintWhite} />
      <Cyl r={0.3} h={0.5} rotation={[0, 0, Math.PI / 2]} position={[6.1, D + 0.3, -0.7]} mat={MAT.darkSteel} />
      <Cyl r={0.25} h={9.0} rotation={[0, 0, Math.PI / 2]} position={[1.0, D + 0.3, 1.3]} mat={MAT.steel} />
      {[-2.0, 0.5, 3.0].map((x, i) => <Cyl key={i} r={0.12} h={0.5} rotation={[Math.PI / 2, 0, 0]} position={[x, D + 0.3, 1.55]} mat={MAT.darkSteel} />)}
      <Box size={[9.2, 0.03, 0.5]} position={[1.0, D + 2.32, 1.0]} mat={MAT.grating} />
      <Handrail length={9.2} position={[1.0, D + 2.3, 1.25]} height={1.0} />
      <Ladder height={2.3} position={[-3.75, D, 1.0]} rotation={[0, 0, 0]} />
      {showLabels && <Label position={[0, D + 4.4, 0]} text={'Hydration unit'} />}
    </Trailer>
  );
}

export function ChemAdd({ position, showLabels }) {
  const D = 1.18;
  return (
    <Trailer length={11.5} width={2.6} position={position} rotation={[0, Math.PI / 2, 0]} name="PP-CHEMADD" front={-1}>
      {/* enclosed cabin with the chemical pumps and totalizers, tote tanks in a containment tray behind it */}
      <RBox r={0.12} size={[3.6, 2.3, 2.5]} position={[-3.6, D + 1.15, 0]} mat={MAT.paintWhite} />
      <Box size={[1.2, 0.9, 0.04]} position={[-3.6, D + 1.4, 1.27]} mat={MAT.glass} />
      <Box size={[0.8, 1.8, 0.04]} position={[-2.2, D + 0.9, 1.27]} mat={MAT.chassis} />
      <Box size={[6.4, 0.25, 2.5]} position={[2.0, D + 0.12, 0]} mat={MAT.chassis} />
      {[[-0.6, 0.65], [-0.6, -0.65], [0.8, 0.65], [0.8, -0.65], [2.2, 0.65], [2.2, -0.65], [3.6, 0.65], [3.6, -0.65]].map(([x, z], i) => (
        <group key={i} position={[x, D + 0.25, z]}>
          <RBox r={0.08} size={[1.15, 1.15, 1.15]} position={[0, 0.6, 0]} mat={i % 3 === 0 ? MAT.paintWhite : i % 3 === 1 ? MAT.yellow : MAT.cream} />
          <Box size={[1.2, 0.08, 1.2]} position={[0, 1.2, 0]} mat={MAT.chassis} />
          <Cyl r={0.12} h={0.1} position={[0, 1.28, 0]} mat={MAT.darkSteel} />
        </group>
      ))}
      <Cyl r={0.05} h={6.0} rotation={[0, 0, Math.PI / 2]} position={[2.0, D + 0.3, 1.2]} mat={MAT.hose} />
      <Handrail length={6.4} position={[2.0, D + 0.25, -1.2]} height={0.9} />
      {showLabels && <Label position={[0, D + 3.4, 0]} text={'Chemical additive unit'} />}
    </Trailer>
  );
}

// Collecting belt at z 2.1 from x -3 to 11, drive box, incline auger, and the discharge chute into the blender hopper.
// Shared by the silo system and the box station (Drop 35); whichever sits at the sand position feeds the same hopper.
export function SandConveyor({ from = -3 }) {
  const len = 11 - from, mid = (11 + from) / 2, stands = Math.max(2, Math.round(len / 2));
  return (
    <group name="LG-CONVEYOR">
      <Box size={[len, 0.25, 0.9]} position={[mid, 0.95, 2.1]} mat={MAT.darkSteel} />
      <Box size={[len, 0.04, 0.7]} position={[mid, 1.1, 2.1]} mat={MAT.rubber} />
      {Array.from({ length: stands }).map((_, i) => <Cyl key={i} r={0.06} h={1.0} position={[from + 0.5 + i * (len - 1) / (stands - 1), 0.5, 2.1]} mat={MAT.darkSteel} />)}
      <Cyl r={0.45} h={11} rotation={[0, 0, THREE.MathUtils.degToRad(-70)]} position={[13.5, 2.15, 2.1]} mat={MAT.darkSteel} />
      <Box size={[1.4, 0.8, 1.2]} position={[8.6, 0.45, 2.1]} mat={MAT.darkSteel} />
      {/* discharge chute from the auger head down into the blender hopper (the group sits so the head is over the hopper) */}
      <Cyl r={0.55} h={0.6} position={[18.7, 4.15, 2.1]} mat={MAT.darkSteel} />
      <Cyl r={0.5} r2={0.3} h={1.0} position={[18.9, 3.4, 2.1]} mat={MAT.steel} open />
    </group>
  );
}
// Sand box unloading station (Drop 35): two cradles over the collecting belt, each a steel frame with a box on it
// and a discharge hopper under the box's gate onto the belt. The handler sets full boxes down here from the stack.
// Cradle boxes lie along x (the belt), 6 m long and 2.5 m wide, so a box carried in on the forks lands square.
export const CRADLE_X = [-9.0, -2.5], CRADLE_Z = 2.1;   // west end of a belt extended to x -12, clear of the pump row to the east
export function SandBoxStation({ position, showLabels }) {
  return (
    <group position={position} name="LG-SANDBOXSTATION">
      {CRADLE_X.map((x, i) => (
        <group key={i} position={[x, 0, CRADLE_Z]}>
          <Merged mat={MAT.darkSteel} deps={[]} parts={() => [
            ...[[-2.85, -1.1], [2.85, -1.1], [-2.85, 1.1], [2.85, 1.1]].map(([px, pz]) => ({ g: GEO.box(0.16, 2.2, 0.16), p: [px, 1.1, pz] })),
            ...[-1.1, 1.1].map(pz => ({ g: GEO.box(5.9, 0.12, 0.2), p: [0, 2.2, pz] })),
            ...[-2.85, 2.85].map(px => ({ g: GEO.box(0.2, 0.12, 2.4), p: [px, 2.2, 0] })),
            { g: GEO.box(5.9, 0.12, 0.2), p: [0, 0.9, -1.1] }, { g: GEO.box(5.9, 0.12, 0.2), p: [0, 0.9, 1.1] },
          ]} />
          <Cyl r={0.9} r2={0.28} h={1.0} position={[0, 1.7, 0]} mat={MAT.steel} open />
          <Cyl r={0.35} h={0.5} position={[0.5, 1.95, 0]} rotation={[0, 0, Math.PI / 2]} mat={MAT.paintRed} />
          <group position={[0, 3.46, 0]} rotation={[0, Math.PI / 2, 0]} name={i === 0 ? 'LG-SANDBOX-ONCRADLE' : undefined}>
            <Box size={[2.5, 2.4, 6.0]} mat={MAT.paintRed} />
            <Merged mat={MAT.chassis} deps={[]} parts={() => [...[-2.6, 0, 2.6].map(z => ({ g: GEO.box(2.56, 2.46, 0.1), p: [0, 0, z] })), ...[-1.28, 1.28].map(xx => ({ g: GEO.box(0.08, 2.46, 6.06), p: [xx, 0, 0] }))]} />
          </group>
        </group>
      ))}
      <Handrail length={13} position={[-5.75, 0, CRADLE_Z + 1.9]} height={1.0} />
      <SandConveyor from={-12} />
      {showLabels && <Label position={[-4, 6.5, 2]} text={'Sand box station and conveyor'} />}
    </group>
  );
}

export function SandSilos({ position, showLabels }) {
  return (
    <group position={position} name="LG-SANDSILOS">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <group key={i} position={[(i % 3) * 4.0, 0, Math.floor(i / 3) * 4.2]}>
          {/* cone bottom on four legs with bracing, cylindrical body with stiffener rings, dust collector and fill line on top */}
          <Cyl r={1.6} h={8.4} position={[0, 2.4 + 4.2, 0]} mat={MAT.tankWhite} name={i === 0 ? 'LG-SANDSILO' : undefined} />
          <BlobShadow size={[5.2, 5.2]} />
          <Merged mat={MAT.steel} parts={() => [3.5, 5.5, 7.5, 9.5].map(y => ({ g: GEO.cyl(1.66, 0.12, 24), p: [0, y, 0] }))} />
          <Merged mat={MAT.darkSteel} parts={() => [
            { g: GEO.cyl(1.6, 1.7, 24, 0.35), p: [0, 1.55, 0] }, { g: GEO.cyl(0.35, 0.6, 12), p: [0, 0.45, 0] }, { g: GEO.box(0.5, 0.3, 0.5), p: [0, 0.3, 0] },
            ...[0, 1, 2, 3].map(k => ({ g: GEO.box(0.14, 2.6, 0.14), p: [Math.cos(k * Math.PI / 2 + Math.PI / 4) * 1.45, 1.3, Math.sin(k * Math.PI / 2 + Math.PI / 4) * 1.45] })),
            ...[0, 1, 2, 3].map(k => ({ g: GEO.box(2.0, 0.06, 0.06), p: [0, 0.8, 0], r: [0, k * Math.PI / 2 + Math.PI / 4, THREE.MathUtils.degToRad(35)] })),
          ]} />
          <Cyl r={1.6} r2={0.9} h={0.5} position={[0, 11.05, 0]} mat={MAT.paintWhite} />
          <Cyl r={0.45} h={0.9} position={[0, 11.7, 0.6]} mat={MAT.darkSteel} />
          <Cyl r={0.12} h={11.5} position={[0, 5.75, -1.72]} mat={MAT.darkSteel} />
          <Ladder height={9.5} position={[1.75, 1.2, 0]} rotation={[0, Math.PI / 2, 0]} />
        </group>
      ))}
      {/* transfer conveyors from the silo bottoms to a collecting belt between the rows and up the incline to the blender hopper */}
      <SandConveyor />
      {showLabels && <Label position={[4, 12.5, 2]} text={'Sand silos and conveyor'} />}
    </group>
  );
}

// 500 bbl frac tanks: rectangular body with a rounded top, stairs and a walkway at the front, a manifold of
// valves and unions along the front bulkhead, wheels at the rear so a winch truck can move them.
// One 500 bbl frac tank (Drop 50: factored out so the water side and the flowback side share it): rectangular body
// with a crowned roof, stiffener bands, skid, rear wheels, the valve manifold on the front bulkhead, stairs to the
// roof walkway with rails, plate seams, roof manways, sight glass, capacity stencil, and a no-smoking placard.
export function FracTankBody({ mat = MAT.tankWhite, label = 'FRESH WATER', ink = '#2a2a2a' }) {
  return (
    <group name="PP-FRACTANK">
            <BlobShadow size={[4.6, 14.5]} />
            <RBox r={0.1} size={[3.0, 2.6, 12.5]} position={[0, 1.55, 0]} mat={mat} />
            {/* low crowned roof: the upper half of a cylinder flattened to a 0.45 m crown */}
            <group position={[0, 2.85, 0]} scale={[1, 0.3, 1]}><Cyl r={1.5} h={12.5} rotation={[Math.PI / 2, 0, 0]} mat={mat} thetaLength={Math.PI} thetaStart={Math.PI / 2} open /></group>
            <Merged mat={MAT.darkSteel} parts={() => [...[-4, 0, 4].map(z => ({ g: GEO.box(3.06, 2.5, 0.08), p: [0, 1.5, z] })), { g: GEO.box(2.9, 0.3, 12.3), p: [0, 0.15, 0] }, { g: GEO.box(2.6, 0.2, 0.2), p: [0, 0.9, 6.35] }, ...[-0.9, -0.3, 0.3, 0.9].map(x => ({ g: GEO.cyl(0.12, 0.5, 10), p: [x, 0.9, 6.5], r: [Math.PI / 2, 0, 0] })), { g: GEO.cyl(0.3, 0.15, 12), p: [0.6, 4.4, 4.0] }, { g: GEO.cyl(0.3, 0.15, 12), p: [0.6, 4.4, -4.0] }]} />
            <Wheel position={[-1.2, 0.45, -5.9]} r={0.45} w={0.3} dual />
            <Wheel position={[1.2, 0.45, -5.9]} r={0.45} w={0.3} dual />
            {/* front bulkhead: manifold, valves, stair to the roof walkway */}
            <Merged mat={MAT.darkSteel} parts={() => [-0.9, -0.3, 0.3, 0.9].flatMap(x => [{ g: GEO.cyl(0.09 * 1.7, 0.09 * 2.2, 14), p: [x, 0.9, 6.8], r: [Math.PI / 2, 0, 0] }])} />
            <Merged mat={MAT.paintRed} parts={() => [-0.9, -0.3, 0.3, 0.9].map(x => ({ g: GEO.torus(0.16, 0.025, 6, 16), p: [x, 1.2, 6.5], r: [Math.PI / 2, 0, 0] }))} />
            {/* stairs up the front end from the ground to the roof walkway, which runs the length of the tank at the crown edge */}
            <Stair steps={10} rise={0.31} run={0.19} width={0.7} position={[1.5, 0.05, 6.25 + 1.9]} rotation={[0, Math.PI, 0]} />
            <Box size={[0.8, 0.03, 12.6]} position={[-1.05, 3.08, 0]} mat={MAT.grating} castShadow={false} />
            <Box size={[0.8, 0.03, 1.5]} position={[-1.05, 3.08, 6.95]} mat={MAT.grating} castShadow={false} />
            <Handrail length={12.6} position={[-1.45, 3.08, 0]} rotation={[0, Math.PI / 2, 0]} height={1.0} />
            <Handrail length={12.6} position={[-0.65, 3.08, 0]} rotation={[0, Math.PI / 2, 0]} height={1.0} />
            {/* Drop 46: shell plate seams, two roof manways with hatch handles, the sight glass and its scale on the
                front bulkhead, the capacity stencil on both sides, and the no-smoking placard by the valves */}
            <Merged mat={MAT.dimSteel} shadow={false} parts={() => [
              ...[-1, 1].flatMap(sx => [1.15, 2.05].map(y => ({ g: GEO.box(0.012, 0.012, 12.3), p: [sx * 1.506, y, 0] }))),
              ...[-1, 1].flatMap(sx => [-2, 2, 6].map(z => ({ g: GEO.box(0.012, 2.4, 0.012), p: [sx * 1.506, 1.55, z] }))),
            ]} />
            <Merged mat={MAT.steel} parts={() => [
              ...[-3.5, 3.5].flatMap(z => [{ g: GEO.cyl(0.34, 0.07, 20), p: [0.4, 3.31, z] }, { g: GEO.torus(0.3, 0.02, 6, 20), p: [0.4, 3.35, z], r: [Math.PI / 2, 0, 0] }, { g: GEO.box(0.3, 0.04, 0.05), p: [0.4, 3.37, z] }]),
              ...[0.5, 1.55, 2.6].map(y => ({ g: GEO.box(0.12, 0.04, 0.1), p: [1.25, y, 6.32] })),
            ]} />
            <Cyl r={0.025} h={2.3} position={[1.25, 1.55, 6.36]} mat={MAT.glass} segments={8} />
            <Box size={[0.14, 2.2, 0.015]} position={[1.08, 1.55, 6.29]} mat={MAT.paintWhite} castShadow={false} />
            <Stencil text="500 BBL" position={[1.52, 2.3, -3.6]} rotation={[0, Math.PI / 2, 0]} width={2.2} color={ink} wear={0.4} />
            <Stencil text="500 BBL" position={[-1.52, 2.3, 3.6]} rotation={[0, -Math.PI / 2, 0]} width={2.2} color={ink} wear={0.4} />
            <Stencil text={label} position={[1.52, 1.85, -3.6]} rotation={[0, Math.PI / 2, 0]} width={1.8} color={ink} wear={0.3} />
            <Sign lines={['NO SMOKING']} position={[-0.95, 2.25, 6.31]} width={0.6} height={0.26} danger />
    </group>
  );
}

export function WaterTanks({ position, count = 8, showLabels }) {
  // a cream and a white tank form the template pair; the pair is instanced along the row (Drop 41)
  const pairs = Math.ceil(count / 2);
  const transforms = useMemo(() => Array.from({ length: pairs }, (_, i) => ({ position: [i * 7.0, 0, 0] })), [pairs]);
  return (
    <group position={position} name="PP-FRACTANKS">
      <Instanced transforms={transforms} name="PP-FRACTANKS">
        {[0, 1].map((i) => <group key={i} position={[i * 3.5, 0, 0]}><FracTankBody mat={i % 2 ? MAT.tankWhite : MAT.tankCream} /></group>)}
      </Instanced>
      {/* tank numbers (per tank, so outside the instanced template): stenciled on both sides at the front end */}
      {Array.from({ length: count }, (_, i) => {
        const x = Math.floor(i / 2) * 7.0 + (i % 2) * 3.5;
        return [1, -1].map(sx => <Stencil key={i + ':' + sx} text={'T-' + (i + 1)} position={[x + sx * 1.52, 1.6, sx * 4.6]} rotation={[0, sx * Math.PI / 2, 0]} width={1.7} color="#8a1c1c" wear={0.3} />);
      })}
      {showLabels && <Label position={[count * 1.7, 5, 0]} text={'Frac tanks (500 bbl)'} />}
    </group>
  );
}

export function DataVan({ position, showLabels, lit = false }) {
  const D = 1.18;
  return (
    <Trailer length={13.4} width={2.8} position={position} rotation={[0, 0, 0]} name="PP-DATAVAN">
      {/* office body with a window band on the pad side, two roof air conditioners, entry stair, generator, antenna mast */}
      <RBox r={0.12} size={[12.4, 2.7, 2.7]} position={[-0.2, D + 1.35, 0]} mat={MAT.paintWhite} />
      <Box size={[12.5, 0.12, 2.8]} position={[-0.2, D + 2.72, 0]} mat={MAT.chassis} />
      <Box size={[10.5, 0.8, 0.05]} position={[-0.6, D + 1.7, 1.36]} mat={lit ? MAT.glassLit : MAT.glass} />
      {[-4.0, -1.5, 1.0, 3.5].map((x, i) => <Box key={i} size={[0.06, 0.9, 0.06]} position={[x, D + 1.7, 1.37]} mat={MAT.chassis} />)}
      <Box size={[0.9, 2.1, 0.06]} position={[5.2, D + 1.1, 1.37]} mat={MAT.chassis} />
      <Stair steps={4} rise={0.3} run={0.32} width={0.9} position={[6.4, 0, 1.0]} rotation={[0, Math.PI, 0]} />
      {[-3.0, 2.5].map((x, i) => <RBox r={0.05} key={i} size={[1.3, 0.5, 1.0]} position={[x, D + 3.0, 0]} mat={MAT.paintWhite} />)}
      <Box size={[1.6, 1.4, 1.2]} position={[-6.6, D + 0.7, 0]} mat={MAT.chassis} />
      <Cyl r={0.05} h={4.0} position={[-4.5, D + 4.7, 0]} mat={MAT.darkSteel} />
      <Box size={[0.5, 0.05, 0.5]} position={[-4.5, D + 6.7, 0]} mat={MAT.darkSteel} />
      {showLabels && <Label position={[0, D + 4.8, 0]} text={'Data van'} />}
    </Trailer>
  );
}

// ---------------------------------------------------------------- wireline unit and crane (Drop 26)
// The drum spins about its own axis (a group rotated about z, the cylinders inside it turned to lie along z), the
// wound cable thins as the string runs in and thickens as it comes out, the level wind traverses with the line,
// and the line itself runs from the drum over the measuring head at the trailer rear, up to the top sheave under
// the crane's hook block, and down into the grease head. `wl` is the store's wireline state; with only `active`
// the drum pays out and takes up slowly (partner wells). 40 m of visible line stands for a full run.
const WL_CORE = 0.5, WL_FULL = 0.95;
function cableOutOf(wl) {
  if (!wl) return null;
  const st = wl.step, p = wl.progress;
  if (st === 'pumpdown' || st === 'stuck') return p;
  if (st === 'freeing') return 0.9 + 0.02 * Math.sin(p * Math.PI * 6);
  if (st === 'setplug' || st === 'armed' || st === 'perforate') return 1;
  if (st === 'pooh') return 1 - p;
  return 0;
}
export function WirelineUnit({ position, treeTop, lubTop = null, showLabels, active, wl = null }) {
  const drum = useRef(), wound = useRef(), carriage = useRef();
  const travel = useRef(0), prevOut = useRef(0);
  useFrame((state, dt) => {
    let out = cableOutOf(wl);
    if (out === null) out = active ? 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 0.25) : 0;
    const d = out - prevOut.current; prevOut.current = out;
    travel.current += d * 40;
    const r = WL_CORE + (WL_FULL - WL_CORE) * (1 - Math.min(1, Math.max(0, out)));
    if (drum.current) drum.current.rotation.z -= d * 40 / r;
    if (wound.current) wound.current.scale.set(r, 1, r);
    if (carriage.current) { const ph = (travel.current / 3) % 2; carriage.current.position.z = 0.65 * (ph < 1 ? ph * 2 - 1 : 3 - ph * 2); }
  });
  // grease head top on the tree (the lubricator stack's top); the crane holds the stack by a bail just above it
  const top = [treeTop[0], lubTop != null ? lubTop : treeTop[1] + 12.0, treeTop[2]];
  const D = 1.18;
  const wrap = useMemo(() => wrapTexture(36), []);
  // crane geometry: outriggers set on the pad in line with the well, the turret slewed toward it, the boom tip plumb
  // over the lubricator, the hook block on the hoist line two meters below the tip, hooked into the lifting bail
  const CR = [-6.5, 0, -2.5];
  const treeXZ = [top[0] - position[0], top[2] - position[2]];
  const hookY = top[1] + 0.8;                               // hook block center: its hook arc sits in the bail ring
  const boomFrom = [CR[0] + 0, 2.6, CR[2] + 0];
  const boomTo = [treeXZ[0], hookY + 0.25 + 2.0, treeXZ[1]];
  const bv = new THREE.Vector3(boomTo[0] - boomFrom[0], boomTo[1] - boomFrom[1], boomTo[2] - boomFrom[2]);
  const boomLen = bv.length();
  const horiz = Math.hypot(bv.x, bv.z);
  const yaw = Math.atan2(-bv.z, bv.x);                     // turret slew: local +x points along the boom's plan direction
  const boomQ = useMemo(() => { const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(horiz, bv.y, 0).normalize())); return [e.x, e.y, e.z]; }, [horiz, bv.y]); // eslint-disable-line react-hooks/exhaustive-deps
  const along = (t, drop = 0) => [horiz * t, 2.6 + bv.y * t - drop, 0];   // in the turret's frame
  // the line: drum top, over the measuring head sheave at the trailer rear (the rear faces the well), up to the top
  // sheave hanging off the hook block, and straight down into the grease head. The top sheave sits a quarter
  // meter toward the truck so its far tangent is plumb over the tree.
  const drumTop = [-3.8, D + 1.1 + WL_FULL, 0];
  const headSheave = [-5.9, D + 2.25, 0];
  const hx = headSheave[0] - treeXZ[0], hz = headSheave[2] - treeXZ[1]; const hl = Math.hypot(hx, hz) || 1; const h = [hx / hl, hz / hl];
  const topSheave = [treeXZ[0] + h[0] * 0.25, top[1] + 0.55, treeXZ[1] + h[1] * 0.25];
  const greaseHead = [treeXZ[0], top[1] - 0.3, treeXZ[1]];
  const cablePts = useMemo(() => [drumTop, [headSheave[0] + 0.1, headSheave[1] + 0.2, 0], [headSheave[0] - 0.2, headSheave[1] + 0.1, 0], [topSheave[0] + h[0] * 0.18, topSheave[1] + 0.18, topSheave[2] + h[1] * 0.18], [topSheave[0], topSheave[1] + 0.25, topSheave[2]], [treeXZ[0], topSheave[1], treeXZ[1]], greaseHead], [topSheave[0], topSheave[1], topSheave[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const sheaveYaw = Math.atan2(-h[1], h[0]);
  return (
    <group position={position} name="WL-UNIT">
      <Trailer length={11} width={2.6} position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
        {/* cab, operator control cabin with windows, roof air conditioner (the trailer is turned so its rear faces the well) */}
        <RBox r={0.12} size={[2.6, 2.2, 2.4]} position={[-3.6, D + 1.1, 0]} mat={MAT.paintWhite} name="WL-UNIT-CAB" />
        <RBox r={0.12} size={[4.2, 2.4, 2.4]} position={[0.4, D + 1.2, 0]} mat={MAT.paintWhite} name="WL-UNIT-CONTROLCAB" />
        <Box size={[3.6, 0.7, 0.04]} position={[0.4, D + 1.7, 1.21]} mat={MAT.glass} />
        <Box size={[0.04, 0.9, 1.8]} position={[2.51, D + 1.6, 0]} mat={MAT.glass} />
        <RBox r={0.05} size={[1.3, 0.5, 1.0]} position={[0.4, D + 2.6, 0]} mat={MAT.paintWhite} />
        {/* drum: core, flanges with lightening holes, wound cable (scaled with the line out), on an A-frame stand with
            bearing caps and a hydraulic drive motor on the far flange; level wind on a diamond shaft in front */}
        <group position={[3.8, D + 1.1, 0]} name="WL-UNIT-DRUM">
          <group ref={drum}>
            <Merged mat={MAT.steel} deps={[]} parts={() => [
              { g: GEO.cyl(WL_CORE, 1.6, 20), r: [Math.PI / 2, 0, 0] },
              ...[-0.83, 0.83].map(z => ({ g: GEO.cyl(1.0, 0.06, 28), p: [0, 0, z], r: [Math.PI / 2, 0, 0] })),
              { g: GEO.cyl(0.12, 2.0, 10), r: [Math.PI / 2, 0, 0] },
            ]} />
            <Merged mat={MAT.chassis} deps={[]} shadow={false} parts={() => [-0.87, 0.87].flatMap(z => Array.from({ length: 6 }).map((_, k) => ({ g: GEO.cyl(0.13, 0.03, 12), p: [Math.cos(k * Math.PI / 3) * 0.72, Math.sin(k * Math.PI / 3) * 0.72, z], r: [Math.PI / 2, 0, 0] })))} />
            <mesh ref={wound} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow><cylinderGeometry args={[1, 1, 1.56, 24]} /><meshStandardMaterial color="#3a3d42" metalness={LITE ? 0.3 : 0.6} roughness={0.55} map={wrap || undefined} bumpMap={LITE ? undefined : wrap || undefined} bumpScale={0.03} /></mesh>
          </group>
          <Merged mat={MAT.chassis} deps={[]} parts={() => [
            ...[-0.98, 0.98].flatMap(z => [{ g: GEO.box(0.5, 2.1, 0.12), p: [0, -0.1, z] }, { g: GEO.box(1.4, 0.12, 0.14), p: [0, -1.1, z] }]),
            ...[-1.0, 1.0].map(z => ({ g: GEO.cyl(0.2, 0.16, 12), p: [0, 0, z * 1.06], r: [Math.PI / 2, 0, 0] })),
            { g: GEO.box(0.6, 0.45, 0.35), p: [0, -0.55, 1.2] },                                   // drive gearbox under the motor
          ]} />
          <Merged mat={MAT.darkSteel} deps={[]} parts={() => [{ g: GEO.cyl(0.19, 0.5, 14), p: [0, 0, 1.4], r: [Math.PI / 2, 0, 0] }, { g: GEO.cyl(0.09, 0.3, 10), p: [0.5, -0.4, 1.2], r: [0, 0, Math.PI / 2] }]} />
          <Cyl r={0.04} h={2.0} rotation={[Math.PI / 2, 0, 0]} position={[0.9, 0.9, 0]} mat={MAT.steel} />
          <group ref={carriage} position={[0.9, 0.9, 0]}>
            <Merged mat={MAT.darkSteel} deps={[]} shadow={false} parts={() => [{ g: GEO.box(0.22, 0.2, 0.26) }, { g: GEO.cyl(0.05, 0.3, 8), p: [0.17, 0.18, 0.1] }, { g: GEO.cyl(0.05, 0.3, 8), p: [0.17, 0.18, -0.1] }]} />
          </group>
          <HosePair from={[0.3, -0.2, 1.65]} to={[-1.4, -1.0, 1.25]} />
        </group>
        {/* measuring head at the trailer rear: sheave on a post, counter box, cable guide rollers */}
        <group position={[-headSheave[0], headSheave[1] - D, 0]} name="WL-UNIT-MEASURINGHEAD">
          <Merged mat={MAT.chassis} deps={[]} parts={() => [{ g: GEO.box(0.16, 1.2, 0.16), p: [0, -0.6, 0.2] }, { g: GEO.box(0.3, 0.26, 0.2), p: [-0.35, 0.05, 0.2] }, { g: GEO.cyl(0.04, 0.5, 8), p: [0, 0, 0], r: [Math.PI / 2, 0, 0] }]} />
          <Merged mat={MAT.steel} deps={[]} shadow={false} parts={() => [{ g: GEO.torus(0.2, 0.035, 8, 24) }, { g: GEO.cyl(0.08, 0.1, 12), r: [Math.PI / 2, 0, 0] }]} />
        </group>
        <Handrail length={4.0} position={[3.0, D, 1.25]} height={1.0} />
      </Trailer>
      {/* crane: outrigger box with jack cylinders and pads, turret with counterweight and operator cab, three
          rectangular telescoping boom sections, lift cylinder with chrome rod, boom-tip sheave block, hook block */}
      <group name="WL-CRANE" position={CR}>
        <RBox r={0.08} size={[3.6, 1.0, 3.0]} position={[0, 0.9, 0]} mat={MAT.yellow} />
        {[[-2.4, 1.5], [2.4, 1.5], [-2.4, -1.5], [2.4, -1.5]].map(([x, z], i) => (
          <group key={i}>
            <Box size={[0.25, 0.25, 1.6]} position={[x, 0.9, z * 0.6]} mat={MAT.yellow} />
            <HydraulicCylinder from={[x, 1.05, z]} to={[x, 0.1, z]} r={0.08} barrel={0.5} />
            <Cyl r={0.3} h={0.08} position={[x, 0.04, z]} mat={MAT.darkSteel} />
          </group>
        ))}
        <Cyl r={0.7} h={1.0} position={[0, 1.9, 0]} mat={MAT.yellow} />
        {/* turret: slewed so the counterweight is behind the boom and the cab beside it */}
        <group rotation={[0, yaw, 0]}>
        <RBox r={0.06} size={[1.1, 0.8, 1.5]} position={[-1.5, 2.3, 0]} mat={MAT.darkSteel} />
        <RBox r={0.08} size={[1.6, 1.2, 1.2]} position={[-1.0, 2.6, 0.9]} mat={MAT.yellow} />
        <Box size={[0.9, 0.5, 0.04]} position={[-1.0, 2.8, 1.51]} mat={MAT.glass} />
        <group position={[0, 2.6, 0]} rotation={boomQ}>
          <Merged mat={MAT.yellow} deps={[boomLen]} parts={() => [
            { g: GEO.rbox(0.56, boomLen * 0.42, 0.62, 0.06, 1), p: [0, boomLen * 0.21, 0] },
            { g: GEO.rbox(0.46, boomLen * 0.36, 0.5, 0.05, 1), p: [0, boomLen * 0.38 + boomLen * 0.18, 0] },
            { g: GEO.rbox(0.36, boomLen * 0.32, 0.4, 0.04, 1), p: [0, boomLen * 0.68 + boomLen * 0.16, 0] },
            { g: GEO.box(0.7, 0.5, 0.8), p: [0, 0.1, 0] },                                             // boom foot
          ]} />
          <Merged mat={MAT.chassis} deps={[boomLen]} shadow={false} parts={() => [{ g: GEO.box(0.5, 0.06, 0.56), p: [0, boomLen * 0.42, 0] }, { g: GEO.box(0.4, 0.06, 0.44), p: [0, boomLen * 0.72, 0] }]} />
          <Merged mat={MAT.steel} deps={[boomLen]} shadow={false} parts={() => [{ g: GEO.torus(0.22, 0.04, 8, 20), p: [0, boomLen + 0.1, 0], r: [0, Math.PI / 2, 0] }, { g: GEO.box(0.2, 0.5, 0.1), p: [0, boomLen, 0] }]} />
        </group>
        <HydraulicCylinder from={[0.7, 2.0, 0]} to={along(0.36, 0.42)} r={0.13} barrel={0.5} />
        <HosePair from={[-0.6, 2.45, 0.1]} to={[0.1, 2.75, -0.2]} sag={0.15} />
        </group>
        <HosePair from={[-1.5, 1.4, 0.4]} to={[-0.5, 1.95, 0.5]} sag={0.12} />
      </group>
      {/* hoist line from the boom tip sheave to the hook block; the hook sits in the lubricator's lifting bail and a
          short strap off the block carries the wireline's top sheave (all in the unit's frame, like boomTo) */}
      <Pipe from={boomTo} to={[boomTo[0], hookY + 0.25, boomTo[2]]} r={0.015} mat={MAT.rubber} unions={false} />
      <group position={[boomTo[0], hookY, boomTo[2]]} name="WL-CRANE-HOOK">
        <Merged mat={MAT.darkSteel} deps={[]} parts={() => [{ g: GEO.rbox(0.32, 0.5, 0.2, 0.03, 1) }, { g: GEO.torus(0.14, 0.035, 8, 16, Math.PI), p: [0, -0.4, 0], r: [0, 0, Math.PI] }]} />
      </group>
      <Pipe from={[boomTo[0] + h[0] * 0.12, hookY - 0.2, boomTo[2] + h[1] * 0.12]} to={[topSheave[0], topSheave[1] + 0.5, topSheave[2]]} r={0.012} mat={MAT.rubber} unions={false} />
      {/* hydraulic supply from the control cab to the crane turret */}
      <HosePair from={[-2.5, D + 0.3, -1.2]} to={[CR[0] + 1.6, 0.95, CR[2] - 0.8]} />
      {/* top sheave hanging from the hook block, and the line itself */}
      <group position={topSheave} rotation={[0, sheaveYaw, 0]} name="WL-UNIT-TOPSHEAVE">
        <Merged mat={MAT.steel} deps={[]} shadow={false} parts={() => [{ g: GEO.torus(0.25, 0.04, 8, 24) }, { g: GEO.cyl(0.08, 0.14, 12), r: [Math.PI / 2, 0, 0] }, { g: GEO.box(0.08, 0.5, 0.06), p: [0, 0.3, 0.1] }, { g: GEO.box(0.08, 0.5, 0.06), p: [0, 0.3, -0.1] }]} />
      </group>
      <Cable points={cablePts} r={0.012} mat={MAT.rubber} travel={travel} stripe={0.5} />
      {showLabels && <Label position={[0, 5.2, 0]} text={'Wireline unit and crane'} />}
    </group>
  );
}

// ---------------------------------------------------------------- coiled tubing unit (Drop 26)
// Reel spinning about its axis with spoked flanges, a wound-tubing layer that thins as pipe goes in the hole, a
// level wind traversing the reel face, the drive motor and its hoses, the tubing running over the gooseneck into
// the injector as a moving line, and the hose bundle from the cabin to the injector. 60 m of visible tubing
// stands for the lateral.
const CT_CORE = 1.3, CT_FULL = 2.2;
export function CTUnit({ position, treeTop, showLabels, active, ct = null }) {
  const reel = useRef(), wound = useRef(), carriage = useRef();
  const travel = useRef(0), prevOut = useRef(0);
  useFrame((state, dt) => {
    let out = ct ? ct.progress : null;
    if (out === null) out = active ? (state.clock.elapsedTime * 0.02) % 1 : 0;
    const d = out - prevOut.current; prevOut.current = out;
    travel.current += d * 60;
    const r = CT_CORE + (CT_FULL - CT_CORE) * (1 - Math.min(1, Math.max(0, out)));
    if (reel.current) reel.current.rotation.z += d * 60 / r;
    if (wound.current) wound.current.scale.set(r, 1, r);
    if (carriage.current) { const ph = (travel.current / 8) % 2; carriage.current.position.z = 0.9 * (ph < 1 ? ph * 2 - 1 : 3 - ph * 2); }
  });
  const inj = [treeTop[0], treeTop[1] + 4.5, treeTop[2]];
  const D = 1.18;
  const wrap = useMemo(() => wrapTexture(22), []);
  const ix = inj[0] - position[0], iz = inj[2] - position[2];
  const tubingPts = useMemo(() => {
    const A = [1.5, D + 1.9 + CT_FULL + 0.05, 0], C = [ix + 1.1, inj[1] + 2.95, iz], E = [ix, inj[1] + 1.4, iz];
    const B = [(A[0] + C[0]) / 2, Math.max(A[1], C[1]) + 1.3, (A[2] + C[2]) / 2];
    const Dp = [ix + 0.35, inj[1] + 2.75, iz];
    return [A, B, C, Dp, E];
  }, [ix, iz, inj[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group position={position} name="CT-UNIT">
      <Trailer length={13} width={2.8}>
        <group position={[1.5, D + 1.9, 0]} name="CT-REEL">
          <group ref={reel}>
            <Merged mat={MAT.paintRed} deps={[]} parts={() => [-1.15, 1.15].map(z => ({ g: GEO.cyl(2.45, 0.1, 32), p: [0, 0, z], r: [Math.PI / 2, 0, 0] }))} />
            <Merged mat={MAT.chassis} deps={[]} shadow={false} parts={() => [-1.22, 1.22].flatMap(z => Array.from({ length: 8 }).map((_, k) => ({ g: GEO.box(0.14, 2.0, 0.04), p: [Math.cos(k * Math.PI / 4) * 1.3, Math.sin(k * Math.PI / 4) * 1.3, z], r: [0, 0, k * Math.PI / 4 + Math.PI / 2] })))} />
            <Merged mat={MAT.steel} deps={[]} parts={() => [{ g: GEO.cyl(CT_CORE, 2.2, 28), r: [Math.PI / 2, 0, 0] }, { g: GEO.cyl(0.36, 2.8, 16), r: [Math.PI / 2, 0, 0] }]} />
            <mesh ref={wound} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow><cylinderGeometry args={[1, 1, 2.16, 28]} /><meshStandardMaterial color="#6a7078" metalness={LITE ? 0.35 : 0.85} roughness={LITE ? 0.45 : 0.35} map={wrap || undefined} bumpMap={LITE ? undefined : wrap || undefined} bumpScale={0.04} /></mesh>
          </group>
          {/* cradle, bearing caps, drive motor with chain guard, hoses to the power pack */}
          <Merged mat={MAT.chassis} deps={[]} parts={() => [
            ...[-1.4, 1.4].map(z => ({ g: GEO.box(3.4, 0.3, 0.2), p: [0, -1.9, z] })),
            ...[-1.4, 1.4].flatMap(z => [[-1.2, -0.35], [1.2, 0.35]].map(([dx, a]) => ({ g: GEO.box(0.25, 2.6, 0.2), p: [dx, -0.9, z], r: [0, 0, a] }))),
            ...[-1.45, 1.45].map(z => ({ g: GEO.cyl(0.3, 0.2, 14), p: [0, 0, z], r: [Math.PI / 2, 0, 0] })),
            { g: GEO.box(0.9, 1.1, 0.25), p: [0.35, -0.5, 1.62] },
          ]} />
          <Merged mat={MAT.darkSteel} deps={[]} parts={() => [{ g: GEO.cyl(0.28, 0.6, 16), p: [0.7, -1.0, 1.75], r: [Math.PI / 2, 0, 0] }]} />
          <HosePair from={[0.7, -1.0, 2.05]} to={[-5.0, -0.6, 1.3]} />
          {/* level wind: diamond shaft on posts, carriage with guide rollers traversing the reel face */}
          <Cyl r={0.05} h={2.4} rotation={[Math.PI / 2, 0, 0]} position={[2.9, 0.4, 0]} mat={MAT.steel} />
          <Merged mat={MAT.chassis} deps={[]} shadow={false} parts={() => [-1.25, 1.25].map(z => ({ g: GEO.box(0.12, 2.5, 0.12), p: [2.9, -0.85, z] }))} />
          <group ref={carriage} position={[2.9, 0.4, 0]}>
            <Merged mat={MAT.darkSteel} deps={[]} shadow={false} parts={() => [{ g: GEO.box(0.3, 0.34, 0.34) }, { g: GEO.cyl(0.07, 0.4, 8), p: [0.22, 0.25, 0.14] }, { g: GEO.cyl(0.07, 0.4, 8), p: [0.22, 0.25, -0.14] }]} />
          </group>
        </group>
        {/* power pack with louvers and exhaust; hoses from it to the reel drive */}
        <RBox r={0.12} size={[3.2, 2.3, 2.5]} position={[-4.4, D + 1.15, 0]} mat={MAT.paintWhite} name="CT-POWERPACK" />
        <Merged mat={MAT.dimSteel} deps={[]} shadow={false} parts={() => [-1, 1].flatMap(sz => [0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 1.7].map(y => ({ g: GEO.box(1.6, 0.03, 0.03), p: [-4.4, D + y, sz * 1.26], r: [sz * 0.55, 0, 0] })))} />
        <Cyl r={0.14} h={1.2} position={[-5.4, D + 2.9, 0.8]} mat={MAT.darkSteel} />
        <Handrail length={4.5} position={[3.5, D, 1.3]} height={1.0} />
      </Trailer>
      <group position={[-2, 0, 6]} name="CT-CONTROLCABIN">
        <RBox r={0.12} size={[3.4, 2.6, 2.6]} position={[0, 1.5, 0]} mat={MAT.paintWhite} />
        <Box size={[2.6, 0.9, 0.04]} position={[0, 1.9, -1.31]} mat={MAT.glass} />
        <Box size={[3.5, 0.1, 2.7]} position={[0, 2.85, 0]} mat={MAT.chassis} />
        <Stair steps={3} rise={0.3} run={0.3} width={0.8} position={[1.9, 0, 0]} />
      </group>
      {/* injector head with the chain drive housings and gooseneck, stripper, quad BOP, on a mast from the ground */}
      <group position={[ix, inj[1], iz]} name="CT-INJECTOR">
        <Box size={[1.2, 2.4, 1.0]} mat={MAT.darkSteel} name="CT-INJECTORHEAD" />
        {[-0.35, 0.35].map((x, i) => <Box key={i} size={[0.3, 2.0, 1.06]} position={[x, 0, 0]} mat={MAT.chassis} />)}
        {[-0.5, 0.5].map((z, i) => <Cyl key={'m' + i} r={0.18} h={0.5} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.8, z * 1.3]} mat={MAT.blue} />)}
        <mesh position={[0, 1.9, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.1, 0.12, 8, 24, Math.PI]} /><Mat mat={MAT.steel} /></mesh>
        {Array.from({ length: 7 }).map((_, i) => { const a = Math.PI * i / 6; return <Cyl key={'r' + i} r={0.06} h={0.3} rotation={[0, 0, a]} position={[Math.cos(a) * 1.1, 1.9 + Math.sin(a) * 1.1, 0]} mat={MAT.darkSteel} />; })}
        <Cyl r={0.22} h={0.9} position={[0, -1.6, 0]} mat={MAT.steel} name="CT-STRIPPER" />
        <Box size={[0.9, 1.4, 0.7]} position={[0, -2.8, 0]} mat={MAT.darkSteel} name="CT-QUADBOP" />
        {[-0.55, 0.55].map((x, i) => <Cyl key={'b' + i} r={0.12} h={0.5} rotation={[0, 0, Math.PI / 2]} position={[x * 1.35, -2.8, 0]} mat={MAT.darkSteel} />)}
        {/* hydraulic fittings on the drive motors and the stripper */}
        <Merged mat={MAT.brass} deps={[]} shadow={false} parts={() => [[-0.5, 0.8], [0.5, 0.8], [0, -1.6]].flatMap(([z, y]) => [-0.08, 0.08].map(dx => ({ g: GEO.cyl(0.03, 0.2, 6), p: [dx + 0.55, y, z * 1.3 + (y < 0 ? 0.25 : 0)], r: [0, 0, Math.PI / 2] })))} />
      </group>
      {[-1, 1].map(side => <Pipe key={side} from={[ix + side * 1.6, 0.2, iz + 1.6]} to={[ix + side * 0.4, inj[1] + 1.2, iz + 0.5]} r={0.12} mat={MAT.yellow} unions={false} />)}
      {/* hose bundle from the cabin roof to the injector drive motors and stripper, hanging by its span */}
      {[-0.18, -0.06, 0.06, 0.18].map((o, k) => <Hose key={k} from={[-2 + o, 2.9, 6 - 1.2]} to={[ix + 0.7, inj[1] + 0.9 + k * 0.1, iz + 0.3 + o]} r={0.022} sag={Math.max(0.6, 0.18 * Math.hypot(ix + 2.7, iz - 4.8))} segments={14} />)}
      {/* tubing from the reel over the gooseneck into the injector, running with the job */}
      <Cable points={tubingPts} r={0.035} mat={metal('#7a8088', 0.85, 0.35)} travel={travel} stripe={1.2} contrast={0.4} segmentsPerLeg={10} />
      {showLabels && <Label position={[0, 6.5, 0]} text={'Coiled tubing unit'} />}
    </group>
  );
}

const FB_TANK_SPOTS = [0, 1, 2].map(i => ({ position: [i * 3.5, 0, 0] }));
const ONE_SPOT = [{ position: [0, 0, 0] }];
export function FlowbackSpread({ position, showLabels, flaring }) {
  const flame = useRef();
  useFrame((state) => { if (flame.current) { const s = flaring ? 1 + Math.sin(state.clock.elapsedTime * 12) * 0.2 : 0.001; flame.current.scale.set(s, s * 1.3, s); } });
  return (
    <group position={position} name="FB-SPREAD">
      {/* Drop 50: the spread's static units are baked into one instanced set (one draw per material, names kept for
          picking); the flame and the tanks (instanced on their own) stay outside */}
      <Instanced transforms={ONE_SPOT} name="FB-SPREAD">
      <group>
      {/* choke manifold on a skid: two runs with a manual and an adjustable choke each, bypass across, gauges */}
      <group position={[0, 0, 0]} name="FB-CHOKEMANIFOLD">
        <Box size={[3.0, 0.25, 2.6]} position={[0, 0.12, 0]} mat={MAT.yellow} />
        {[-0.7, 0.7].map((z, i) => (
          <group key={i}>
            <PipeRun points={[[-1.5, 0.95, z], [1.5, 0.95, z]]} r={0.08} />
            <GateValveBlock open={1} kind="manual" axis="horizontal" bore={0.08} position={[-0.7, 0.95, z]} />
            <group position={[0.7, 0.95, z]}>
              <Box size={[0.55, 0.5, 0.5]} mat={MAT.darkSteel} />
              <Cyl r={0.08} h={0.5} position={[0, 0.45, 0]} mat={MAT.steel} />
              <mesh position={[0, 0.75, 0]}><torusGeometry args={[0.2, 0.025, 6, 20]} /><Mat mat={MAT.rubber} /></mesh>
              <Cyl r={0.12} h={0.05} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.2, 0.3]} mat={MAT.paintWhite} />
            </group>
          </group>
        ))}
        <PipeRun points={[[-1.2, 0.95, -0.7], [-1.2, 0.95, 0.7]]} r={0.06} />
        <PipeRun points={[[1.2, 0.95, -0.7], [1.2, 0.95, 0.7]]} r={0.06} />
        <Handrail length={3.0} position={[0, 0.25, 1.35]} height={1.0} />
      </group>
      {/* plug catcher: two horizontal barrels with quick-opening closures and a bypass */}
      <group position={[4.5, 0, 0]} name="FB-PLUGCATCHER">
        {[-0.7, 0.7].map((z, i) => (
          <group key={i} position={[0, 1.2, z]}>
            <Cyl r={0.35} h={2.8} rotation={[0, 0, Math.PI / 2]} mat={MAT.darkSteel} />
            <Cyl r={0.42} h={0.25} rotation={[0, 0, Math.PI / 2]} position={[1.5, 0, 0]} mat={MAT.steel} />
            <Cyl r={0.14} h={0.4} rotation={[0, 0, Math.PI / 2]} position={[1.8, 0, 0]} mat={MAT.brass} />
            {[-0.9, 0.9].map((x, k) => <Box key={k} size={[0.2, 1.1, 0.2]} position={[x, -0.6, 0]} mat={MAT.chassis} />)}
          </group>
        ))}
        <Box size={[3.4, 0.2, 2.4]} position={[0, 0.1, 0]} mat={MAT.yellow} />
      </group>
      {/* sand separator: vertical vessel with a cone bottom, skid, level gauge, dump line */}
      <group position={[9, 0, 0]} name="FB-SANDSEPARATOR">
        <Box size={[2.4, 0.25, 2.4]} position={[0, 0.12, 0]} mat={MAT.yellow} />
        <Cyl r={0.75} h={3.4} position={[0, 2.5, 0]} mat={MAT.steel} />
        <Cyl r={0.75} r2={0.2} h={0.9} position={[0, 0.7, 0]} mat={MAT.darkSteel} />
        <Cyl r={0.75} r2={0.3} h={0.4} position={[0, 4.4, 0]} mat={MAT.steel} />
        {[0, 1, 2, 3].map(k => <Box key={k} size={[0.15, 1.0, 0.15]} position={[Math.cos(k * Math.PI / 2 + Math.PI / 4) * 0.7, 0.7, Math.sin(k * Math.PI / 2 + Math.PI / 4) * 0.7]} mat={MAT.darkSteel} />)}
        <Box size={[0.06, 2.4, 0.06]} position={[0.85, 2.5, 0]} mat={MAT.glass} />
        <Pipe from={[-0.75, 3.4, 0]} to={[-2.2, 3.4, 0]} r={0.08} />
        <Pipe from={[0.75, 3.4, 0]} to={[2.2, 3.4, 0]} r={0.08} />
        <Ladder height={3.6} position={[0, 0.25, 0.8]} />
      </group>
      {/* horizontal three-phase test separator on saddles, with the gas meter run on top and level controls */}
      <group position={[14, 0, 0]} name="FB-SEPARATOR">
        <Box size={[6.6, 0.25, 2.6]} position={[0, 0.12, 0]} mat={MAT.yellow} />
        <Cyl r={1.1} h={6} rotation={[0, 0, Math.PI / 2]} position={[0, 1.9, 0]} mat={MAT.paintWhite} />
        <mesh position={[3.0, 1.9, 0]} rotation={[0, 0, -Math.PI / 2]}><sphereGeometry args={[1.1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /><Mat mat={MAT.paintWhite} /></mesh>
        <mesh position={[-3.0, 1.9, 0]} rotation={[0, 0, Math.PI / 2]}><sphereGeometry args={[1.1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /><Mat mat={MAT.paintWhite} /></mesh>
        {[-2.0, 2.0].map((x, i) => <Box key={i} size={[0.5, 0.9, 2.4]} position={[x, 0.65, 0]} mat={MAT.chassis} />)}
        <Pipe from={[-1.5, 3.05, 0]} to={[1.5, 3.05, 0]} r={0.08} mat={MAT.steel} />
        <Box size={[0.5, 0.35, 0.35]} position={[0, 3.05, 0]} mat={MAT.darkSteel} />
        <Box size={[0.3, 0.4, 0.2]} position={[0, 3.45, 0]} mat={MAT.blue} />
        <Cyl r={0.15} h={0.9} position={[2.3, 1.3, 1.3]} mat={MAT.steel} />
        <Cyl r={0.2} h={0.3} position={[2.3, 2.0, 1.3]} mat={MAT.darkSteel} />
        <Box size={[0.06, 1.2, 0.06]} position={[-1.5, 1.9, 1.15]} mat={MAT.glass} />
        <Pipe from={[-3.0, 1.0, 0]} to={[-5.2, 1.0, 0]} r={0.08} />
        <Pipe from={[2.3, 1.2, 1.3]} to={[2.3, 1.2, 3.5]} r={0.08} />
        <Handrail length={6.0} position={[0, 3.0, 0]} height={0.9} />
        <Ladder height={2.9} position={[3.6, 0.25, 0]} rotation={[0, Math.PI / 2, 0]} />
      </group>
      {/* flare stack: guyed, with a pilot at the tip and the knockout drum at the base */}
      <group position={[22, 0, -6]} name="FB-FLARESTACK">
        <Cyl r={0.2} h={12} position={[0, 6, 0]} mat={MAT.darkSteel} />
        <Cyl r={0.26} h={0.5} position={[0, 12.1, 0]} mat={MAT.steel} />
        <Box size={[1.8, 0.2, 1.8]} position={[0, 0.1, 0]} mat={MAT.darkSteel} />
        {[0, 1, 2].map(k => { const a = k * Math.PI * 2 / 3; return <Pipe key={k} from={[0, 10.5, 0]} to={[Math.cos(a) * 6, 0.2, Math.sin(a) * 6]} r={0.012} mat={MAT.rubber} unions={false} />; })}
        {[0, 1, 2].map(k => { const a = k * Math.PI * 2 / 3; return <Cyl key={'s' + k} r={0.1} h={0.6} position={[Math.cos(a) * 6, 0.3, Math.sin(a) * 6]} mat={MAT.darkSteel} />; })}
        <Cyl r={0.6} h={1.6} rotation={[0, 0, Math.PI / 2]} position={[-2.2, 0.8, 0]} mat={MAT.steel} />
        <Pipe from={[-2.2, 1.4, 0]} to={[0, 2.0, 0]} r={0.1} mat={MAT.darkSteel} />
      </group>
      </group>
      </Instanced>
      <mesh ref={flame} position={[22, 12.9, -6]}>
        <coneGeometry args={[0.7, 2.2, 10]} />
        <meshStandardMaterial color="#ff8a00" emissive="#ff5a00" emissiveIntensity={2.5} transparent opacity={0.85} />
      </mesh>
      {/* flowback tanks (Drop 50): the same 500 bbl tank as the water side, in dark paint, three in a row, instanced */}
      <group position={[18, 0, 6]} name="FB-TANKS">
        <Instanced transforms={FB_TANK_SPOTS} name="FB-TANKS"><FracTankBody mat={MAT.tankDark} label="FLOWBACK" ink="#d8d2c4" /></Instanced>
        {FB_TANK_SPOTS.map((t, i) => [1, -1].map(sx => <Stencil key={i + ':' + sx} text={'FB-' + (i + 1)} position={[t.position[0] + sx * 1.52, 1.6, sx * 4.6]} rotation={[0, sx * Math.PI / 2, 0]} width={1.7} color="#d8d2c4" wear={0.3} />))}
      </group>
      {showLabels && <Label position={[8, 5, 0]} text={'Flowback: chokes, plug catcher, sand separator, test separator, flare, tanks'} />}
    </group>
  );
}

// Red zone boundary while pumping: a painted line around what holds treating pressure and nothing else: the
// missile and pump discharge side (x0 to xm, z0 to zm) and the treating line, zipper, trees, and flanged spools
// (xm to x1, z0 to z1). Low-pressure units behind the missile stay outside.
export function RedZone({ visible, x0 = -34, xm = -14, x1 = 10, z0 = -14, zm = 10, z1 = 10 }) {
  const geom = useMemo(() => {
    const w = 0.35;
    const pts = [[x0, z0], [x1, z0], [x1, z1], [xm, z1], [xm, zm], [x0, zm]];
    return buildMerged(pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      return { g: GEO.box(L + w, 0.02, w), p: [(p[0] + q[0]) / 2, 0, (p[1] + q[1]) / 2], r: [0, -Math.atan2(q[1] - p[1], q[0] - p[0]), 0] };
    }));
  }, [x0, xm, x1, z0, zm, z1]);
  if (!visible) return null;
  return (
    <mesh geometry={geom} position={[0, 0.03, 0]}>
      <meshBasicMaterial color="#ff2a2a" transparent opacity={0.7} />
    </mesh>
  );
}


// ---------------------------------------------------------------- pad furniture (proportions from pad photographs; generic shapes)
// Lined containment around the well row: dark liner with a raised berm edge.
export function Containment({ x0, x1, z0, z1 }) {
  const w = x1 - x0, l = z1 - z0;
  return (
    <group name="LG-CONTAINMENT">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0.02, (z0 + z1) / 2]} receiveShadow>
        <planeGeometry args={[w, l]} />
        <meshStandardMaterial color="#1d2126" roughness={0.7} metalness={0.05} />
      </mesh>
      {[[x0, (z0 + z1) / 2, 0.5, l], [x1, (z0 + z1) / 2, 0.5, l], [(x0 + x1) / 2, z0, w, 0.5], [(x0 + x1) / 2, z1, w, 0.5]].map(([x, z, bw, bl], i) => (
        <mesh key={i} position={[x, 0.2, z]}><boxGeometry args={[bw, 0.4, bl]} /><meshStandardMaterial color="#23272d" roughness={0.8} /></mesh>
      ))}
    </group>
  );
}
// Sand boxes: containers stacked two high in rows on a conveyor cradle, the alternative to silos on many
// pads; a forklift parks at the row end. Proportions from pad photographs; generic shapes.
export function SandBoxes({ position, rows = 2, perRow = 6, showLabels }) {
  return (
    <group position={position} name="LG-SANDBOXES">
      {Array.from({ length: rows }).map((_, r) => (
        <group key={r} position={[0, 0, r * 7.0]}>
          <BlobShadow size={[perRow * 2.9 + 3, 8.5]} position={[(perRow - 1) * 1.45, 0.015, 0]} />
          <Box size={[perRow * 2.9 + 0.4, 0.5, 6.4]} position={[(perRow - 1) * 1.45, 0.25, 0]} mat={MAT.chassis} />
          <Box size={[perRow * 2.9 + 0.4, 0.06, 0.6]} position={[(perRow - 1) * 1.45, 0.55, 0]} mat={MAT.rubber} />
        </group>
      ))}
      <Instanced transforms={useMemo(() => Array.from({ length: rows * perRow }, (_, i) => ({ position: [(i % perRow) * 2.9, 0, Math.floor(i / perRow) * 7.0] })), [rows, perRow])} name="LG-SANDBOXES">
      {[0, 1].map((lvl) => {
        const mat = lvl ? MAT.paintRed : { color: '#7a1f18', metalness: 0.5, roughness: 0.6 };
        return (
          <group key={lvl} position={[0, 0.5 + 1.2 + lvl * 2.5, 0]} name="LG-SANDBOX">
            <Box size={[2.5, 2.4, 6.0]} mat={mat} />
            <Merged mat={MAT.chassis} parts={() => [...[-2.6, 0, 2.6].map(z => ({ g: GEO.box(2.56, 2.46, 0.1), p: [0, 0, z] })), ...[-1.28, 1.28].map(x => ({ g: GEO.box(0.08, 2.46, 6.06), p: [x, 0, 0] })), { g: GEO.box(2.2, 0.15, 1.2), p: [0, 1.25, -1.6] }, { g: GEO.cyl(0.4, 0.5, 12, 0.9), p: [0, -1.35, 0] }]} />
          </group>
        );
      })}
      </Instanced>
      {showLabels && <Label position={[perRow * 1.4, 7.0, 3]} text={'Sand boxes (stacked containers)'} />}
    </group>
  );
}
// Container handler (Drop 35): follows `path` (a polyline of [x, z] in world meters) from the box stack to the
// cradle with a full box on the forks, sets it down, turns around and drives back empty, picks up and turns again.
// Forks lead the travel direction on both legs; the heading blends through corners; wheels turn, the mast rocks.
export function ShuttleForklift({ path, speed = 2.2, dwell = 3.0 }) {
  const ref = useRef(), load = useRef(), wheels = useRef([]), mast = useRef();
  const route = useMemo(() => {
    const segs = []; let L = 0;
    for (let i = 0; i < path.length - 1; i++) { const dx = path[i + 1][0] - path[i][0], dz = path[i + 1][1] - path[i][1]; const len = Math.hypot(dx, dz); segs.push({ x: path[i][0], z: path[i][1], dx: dx / len, dz: dz / len, s0: L, len }); L += len; }
    return { segs, L };
  }, [path]);
  const at = (d) => {   // position and heading at distance d along the route, heading blended 1 m either side of a corner
    const S = route.segs; let i = S.findIndex(g => d <= g.s0 + g.len); if (i < 0) i = S.length - 1;
    const g = S[i], u = d - g.s0;
    let dx = g.dx, dz = g.dz;
    if (u < 1 && i > 0) { const k = 0.5 + u * 0.5; dx = S[i - 1].dx * (1 - k) + g.dx * k; dz = S[i - 1].dz * (1 - k) + g.dz * k; }
    else if (u > g.len - 1 && i < S.length - 1) { const k = (g.len - u) * 0.5; dx = S[i + 1].dx * (1 - k) + g.dx * k; dz = S[i + 1].dz * (1 - k) + g.dz * k; }
    return { x: g.x + g.dx * u, z: g.z + g.dz * u, yaw: Math.atan2(-dz, dx) };
  };
  useFrame((state, dt) => {
    if (!ref.current || !route.L) return;
    const tOut = route.L / speed, period = 2 * tOut + 2 * dwell;
    const t = state.clock.elapsedTime % period;
    let P, driving = true, carry;
    if (t < tOut) { P = at(t * speed); carry = true; }
    else if (t < tOut + dwell) { const k = (t - tOut) / dwell; const e = at(route.L); P = { ...e, yaw: e.yaw + Math.PI * Math.min(1, Math.max(0, (k - 0.35) / 0.65)) }; driving = false; carry = k < 0.3; }
    else if (t < 2 * tOut + dwell) { const d = route.L - (t - tOut - dwell) * speed; const q = at(d); P = { ...q, yaw: q.yaw + Math.PI }; carry = false; }
    else { const k = (t - 2 * tOut - dwell) / dwell; const e = at(0); P = { ...e, yaw: e.yaw + Math.PI - Math.PI * Math.min(1, Math.max(0, (k - 0.35) / 0.65)) }; driving = false; carry = k > 0.7; }
    ref.current.position.set(P.x, 0, P.z);
    ref.current.rotation.y = P.yaw;
    if (load.current) load.current.visible = carry;
    if (driving) wheels.current.forEach(w => { if (w) w.rotation.z -= dt * speed / 0.5; });
    if (mast.current) mast.current.rotation.z = -0.04 + 0.03 * Math.sin(state.clock.elapsedTime * 1.5);
  });
  return (
    <group ref={ref} name="LG-SANDBOX-HANDLER">
      <BlobShadow size={[5.5, 3.2]} />
      <RBox r={0.08} size={[3.0, 1.2, 1.9]} position={[0, 1.1, 0]} mat={MAT.paintRed} />
      <RBox r={0.06} size={[1.4, 1.3, 1.6]} position={[-0.3, 2.3, 0]} mat={MAT.chassis} />
      <Box size={[1.1, 0.5, 0.04]} position={[-0.3, 2.5, 0.81]} mat={MAT.glass} />
      <Merged mat={MAT.chassis} deps={[]} shadow={false} parts={() => [{ g: GEO.cyl(0.06, 0.9, 8), p: [-1.2, 2.2, 0.6] }, { g: GEO.box(0.5, 0.06, 0.3), p: [-1.45, 1.75, 0] }]} />
      <group ref={mast} position={[1.8, 0.4, 0]}>
        <Merged mat={MAT.darkSteel} deps={[]} parts={() => [{ g: GEO.box(0.2, 3.6, 0.12), p: [0, 1.6, 0.6] }, { g: GEO.box(0.2, 3.6, 0.12), p: [0, 1.6, -0.6] }, { g: GEO.box(0.22, 0.12, 1.4), p: [0, 3.3, 0] }, { g: GEO.box(0.22, 0.12, 1.4), p: [0, 1.2, 0] }, { g: GEO.box(0.12, 0.8, 1.5), p: [0.15, 0.8, 0] }]} />
        <Merged mat={MAT.darkSteel} deps={[]} shadow={false} parts={() => [-0.5, 0.5].map(zz => ({ g: GEO.box(1.7, 0.08, 0.15), p: [1.0, 0.4, zz] }))} />
        <HydraulicCylinder from={[-0.35, 0.3, 0.3]} to={[-0.1, 2.4, 0.3]} r={0.06} barrel={0.55} />
        <group ref={load} position={[1.45, 1.62, 0]}>
          <RBox r={0.04} size={[2.5, 2.4, 6.0]} mat={MAT.paintRed} />
          <Merged mat={MAT.chassis} deps={[]} parts={() => [...[-2.6, 0, 2.6].map(zz => ({ g: GEO.box(2.56, 2.46, 0.1), p: [0, 0, zz] })), ...[-1.28, 1.28].map(xx => ({ g: GEO.box(0.08, 2.46, 6.06), p: [xx, 0, 0] }))]} />
        </group>
      </group>
      {[[-1.0, 0.95], [1.0, 0.95], [-1.0, -0.95], [1.0, -0.95]].map(([x, zz], k) => (
        <group key={k} ref={el => { wheels.current[k] = el; }} position={[x, 0.5, zz]}>
          <Merged mat={MAT.tire} deps={[]} parts={() => [{ g: GEO.cyl(0.5, 0.35, 20), r: [Math.PI / 2, 0, 0] }]} />
          <Merged mat={MAT.alu} deps={[]} shadow={false} parts={() => [{ g: GEO.cyl(0.3, 0.37, 12), r: [Math.PI / 2, 0, 0] }]} />
        </group>
      ))}
    </group>
  );
}

// Water transfer (Drop 28): a header along the tank fronts fed by a short hose from each tank's manifold, a
// diesel transfer pump trailer at the row end, and a lay-flat discharge hose on the ground to the hydration
// unit's suction, rising to the stub at the end. `tanks` is the WaterTanks position, `count` its tank count,
// `to` the hydration suction stub in world space.
// Water source by basin (Drop 40): `source` is `tanks` (500 bbl frac tanks with a suction header), `heated` (the
// same tanks plus a frac heater on the discharge run; its stack steams in winter), `ast` (two above-ground storage
// tanks with a base manifold), or `pit` (a lined, bermed pit off the pad's west edge with a floating pump skid and a
// bank pump). Every source ends in the same transfer pump and a lay-flat line on the ground to the hydration unit.
export function TransferPump({ position, showLabels }) {
  return (
    <group position={position} name="LG-WATERTRANSFER-PUMP">
      <BlobShadow size={[6.5, 3.5]} />
      <Merged mat={MAT.chassis} deps={[]} parts={() => [{ g: GEO.box(4.6, 0.25, 2.0), p: [0, 0.55, 0] }, { g: GEO.box(1.0, 0.2, 0.6), p: [-2.6, 0.45, 0] }, { g: GEO.cyl(0.05, 0.4, 6), p: [-3.05, 0.25, 0] }]} />
      <Merged mat={MAT.tire} deps={[]} parts={() => [-0.8, 0.8].map(zz => ({ g: GEO.cyl(0.42, 0.3, 20), p: [0.6, 0.42, zz], r: [Math.PI / 2, 0, 0] }))} />
      <RBox r={0.08} size={[2.2, 1.5, 1.7]} position={[-0.9, 1.45, 0]} mat={MAT.paintWhite} />
      <Merged mat={MAT.dimSteel} deps={[]} shadow={false} parts={() => [-1, 1].flatMap(sz => [0.95, 1.15, 1.35, 1.55, 1.75].map(y => ({ g: GEO.box(1.4, 0.03, 0.03), p: [-0.9, y, sz * 0.86], r: [sz * 0.55, 0, 0] })))} />
      <Cyl r={0.08} h={1.0} position={[-1.5, 2.6, 0.5]} mat={MAT.darkSteel} />
      <Merged mat={MAT.darkSteel} deps={[]} parts={() => [{ g: GEO.cyl(0.42, 0.5, 20), p: [1.2, 1.1, 0], r: [0, 0, Math.PI / 2] }, { g: GEO.cyl(0.26, 0.9, 14), p: [1.2, 1.1, 0.6], r: [Math.PI / 2, 0, 0] }, { g: GEO.cyl(0.2, 0.7, 14), p: [1.2, 1.5, 0] }]} />
      <Merged mat={MAT.steel} deps={[]} shadow={false} parts={() => [{ g: GEO.cyl(0.24, 0.1, 14), p: [1.2, 1.1, -0.3], r: [Math.PI / 2, 0, 0] }, { g: GEO.cyl(0.24, 0.1, 14), p: [1.2, 1.9, 0] }]} />
      <HazardStrip position={[2.31, 0.5, 0]} rotation={[0, Math.PI / 2, 0]} length={1.9} height={0.12} />
      {showLabels && <Label position={[0, 3.3, 0]} text={'Water transfer pump'} />}
    </group>
  );
}
// Frac heater: trailer with a burner box, a tall stack, a coil housing, inlet and outlet stubs. Steams when `steam`.
export function FracHeater({ position, rotation = [0, 0, 0], steam = false, showLabels }) {
  const D = 1.18;
  return (
    <group position={position} rotation={rotation} name="LG-FRACHEATER">
      <Trailer length={11} width={2.6} axles={2}>
        <RBox r={0.1} size={[6.0, 2.4, 2.4]} position={[0.5, D + 1.2, 0]} mat={MAT.tankCream} />
        <RBox r={0.08} size={[2.4, 1.8, 2.2]} position={[-3.4, D + 0.9, 0]} mat={MAT.darkSteel} />
        <Merged mat={MAT.dimSteel} deps={[]} shadow={false} parts={() => [0.6, 0.9, 1.2, 1.5].map(y => ({ g: GEO.box(2.0, 0.03, 0.03), p: [-3.4, D + y, 1.11], r: [0.5, 0, 0] }))} />
        <Cyl r={0.38} h={4.6} position={[3.0, D + 2.4 + 2.3, 0]} mat={MAT.darkSteel} />
        <Cyl r={0.46} h={0.3} position={[3.0, D + 2.4 + 4.6, 0]} mat={MAT.darkSteel} />
        <Cyl r={0.12} h={0.7} rotation={[Math.PI / 2, 0, 0]} position={[-1.2, D + 0.6, 1.4]} mat={MAT.steel} />
        <Cyl r={0.12} h={0.7} rotation={[Math.PI / 2, 0, 0]} position={[2.0, D + 0.6, 1.4]} mat={MAT.steel} />
        <Handrail length={5.6} position={[0.5, D + 2.4, 1.15]} height={0.9} />
        <Ladder height={2.3} position={[-0.6, D, 1.32]} />
        <HazardStrip position={[5.5, D - 0.3, 0]} rotation={[0, Math.PI / 2, 0]} length={2.4} height={0.14} />
      </Trailer>
      <ExhaustPlume position={[3.0, D + 2.4 + 4.75, 0]} active={steam} strength={1.4} seed={3} />
      {showLabels && <Label position={[0.5, D + 7.5, 0]} text={'Frac heater'} />}
    </group>
  );
}
// Above-ground storage tank: a wide steel ring tank with a stair to the rim and a base manifold with two valves.
export function StorageTank({ position, r = 8, h = 3.6, showLabels, name }) {
  return (
    <group position={position} name={name}>
      <Cyl r={r} h={h} position={[0, h / 2, 0]} mat={MAT.tankWhite} />
      <Merged mat={MAT.dimSteel} deps={[r, h]} shadow={false} parts={() => [...Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2; return { g: GEO.box(0.06, h, 0.1), p: [Math.cos(a) * (r + 0.02), h / 2, Math.sin(a) * (r + 0.02)], r: [0, -a, 0] }; }), { g: GEO.torus(r + 0.02, 0.06, 6, 48), p: [0, h, 0], r: [Math.PI / 2, 0, 0] }, { g: GEO.torus(r + 0.02, 0.06, 6, 48), p: [0, h / 2, 0], r: [Math.PI / 2, 0, 0] }]} />
      <Handrail length={r * 1.2} position={[0, h, r - 0.3]} height={1.0} />
      <Stair steps={12} rise={h / 12} run={0.3} position={[r + 0.3, 0, -1.5]} rotation={[0, Math.PI / 2, 0]} />
      <Merged mat={MAT.steel} deps={[r]} parts={() => [{ g: GEO.cyl(0.16, 1.6, 12), p: [0, 0.5, r + 0.8], r: [Math.PI / 2, 0, 0] }, { g: GEO.cyl(0.24, 0.12, 12), p: [0, 0.5, r + 0.3], r: [Math.PI / 2, 0, 0] }]} />
      <Merged mat={MAT.paintRed} deps={[r]} parts={() => [{ g: GEO.box(0.4, 0.55, 0.45), p: [0, 0.5, r + 1.1] }, { g: GEO.cyl(0.22, 0.05, 12), p: [0, 0.95, r + 1.1] }]} />
      {showLabels && <Label position={[0, h + 1.5, 0]} text={'Above-ground storage tank'} />}
    </group>
  );
}
// Lined, bermed water pit with a floating pump skid: four berm prisms with the liner on their inner slopes and a
// floor, a water plane (frozen when `frozen`), a pontoon skid with an engine and pump and a suction into the water.
export function WaterPit({ position, size = [44, 30], frozen = false, showLabels }) {
  const [L, Wd] = size, bh = 1.8;
  // berm as mitred quads: outer slope from the outer base rectangle up to the crest, a flat crest ring, the liner
  // down the inner slope to the floor; all from four rectangles (outer base, crest outer, crest inner, floor)
  const geo = useMemo(() => {
    const rect = (hx, hz, y) => [[-hx, y, -hz], [hx, y, -hz], [hx, y, hz], [-hx, y, hz]];
    const quads = (lo, hi) => {   // 4 side quads between two rectangles (same winding), outward normals
      const pos = [], nrm = [], uv = [];
      for (let i = 0; i < 4; i++) {
        const a = lo[i], b = lo[(i + 1) % 4], c = hi[(i + 1) % 4], d = hi[i];
        const tri = [a, b, c, a, c, d];
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
        const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const nl = Math.hypot(...n) || 1;
        for (const v of tri) { pos.push(...v); nrm.push(n[0] / nl, n[1] / nl, n[2] / nl); uv.push(v[0] / 6, v[2] / 6); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      return g;
    };
    const outerBase = rect(L / 2 + 3.0, Wd / 2 + 3.0, 0), crestOut = rect(L / 2 + 1.2, Wd / 2 + 1.2, bh), crestIn = rect(L / 2 - 1.2, Wd / 2 - 1.2, bh), floor = rect(L / 2 - 3.6, Wd / 2 - 3.6, 0.04);
    const outer = quads(outerBase, crestOut);
    const liner = quads(floor, crestIn); liner.scale(1, 1, 1);
    const ring = new THREE.Shape(); ring.moveTo(-(L / 2 + 1.2), -(Wd / 2 + 1.2)); ring.lineTo(L / 2 + 1.2, -(Wd / 2 + 1.2)); ring.lineTo(L / 2 + 1.2, Wd / 2 + 1.2); ring.lineTo(-(L / 2 + 1.2), Wd / 2 + 1.2); ring.closePath();
    const hole = new THREE.Path(); hole.moveTo(-(L / 2 - 1.2), -(Wd / 2 - 1.2)); hole.lineTo(-(L / 2 - 1.2), Wd / 2 - 1.2); hole.lineTo(L / 2 - 1.2, Wd / 2 - 1.2); hole.lineTo(L / 2 - 1.2, -(Wd / 2 - 1.2)); hole.closePath();
    ring.holes.push(hole);
    const crest = new THREE.ShapeGeometry(ring); crest.rotateX(-Math.PI / 2); crest.translate(0, bh, 0);
    return { outer, liner, crest };
  }, [L, Wd]);
  const wy = frozen ? 1.25 : 1.2;
  const k = wy / bh, wx = (L / 2 - 3.6) + 2.4 * k, wz = (Wd / 2 - 3.6) + 2.4 * k;   // water meets the liner slope at its own level
  return (
    <group position={position} name="LG-WATERPIT">
      <mesh geometry={geo.outer} receiveShadow castShadow><meshStandardMaterial color="#8a7b63" roughness={1} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geo.crest} receiveShadow><meshStandardMaterial color="#8a7b63" roughness={1} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={geo.liner} receiveShadow><meshStandardMaterial color="#161616" roughness={0.55} metalness={0.05} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[L - 7.2, Wd - 7.2]} /><meshStandardMaterial color="#141414" roughness={0.6} metalness={0.05} /></mesh>
      {/* water, or ice */}
      <mesh position={[0, wy, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow name="LG-WATERPIT-WATER">
        <planeGeometry args={[wx * 2, wz * 2]} />
        {frozen ? <meshStandardMaterial color="#cfd9e3" roughness={0.55} metalness={0.05} /> : <meshStandardMaterial color="#2a6b78" roughness={0.12} metalness={0.05} transparent opacity={0.88} />}
      </mesh>
      {/* floating pump skid: pontoons, deck, engine and pump, suction into the water */}
      <group position={[-L * 0.2, wy, Wd * 0.1]} name="LG-WATERPIT-SKID">
        <Merged mat={MAT.paintWhite} deps={[]} parts={() => [-1.1, 1.1].map(z => ({ g: GEO.cyl(0.35, 4.0, 12), p: [0, -0.1, z], r: [0, 0, Math.PI / 2] }))} />
        <Box size={[3.6, 0.12, 2.8]} position={[0, 0.3, 0]} mat={MAT.grating} />
        <Handrail length={3.4} position={[0, 0.36, 1.3]} height={0.9} />
        <Handrail length={3.4} position={[0, 0.36, -1.3]} height={0.9} />
        <RBox r={0.06} size={[1.4, 1.0, 1.0]} position={[-0.8, 0.86, 0]} mat={MAT.paintRed} />
        <Merged mat={MAT.darkSteel} deps={[]} parts={() => [{ g: GEO.cyl(0.32, 0.4, 16), p: [0.8, 0.7, 0], r: [0, 0, Math.PI / 2] }, { g: GEO.cyl(0.14, 1.6, 10), p: [0.8, -0.5, 0] }, { g: GEO.cyl(0.08, 0.8, 8), p: [-0.8, 1.76, 0] }]} />
        <ExhaustPlume position={[-0.8, 2.2, 0]} active strength={0.5} seed={7} />
      </group>
      {showLabels && <Label position={[0, 4.5, 0]} text={'Lined water pit with floating pump'} />}
    </group>
  );
}
export function WaterTransfer({ tanks, count = 8, to, showLabels, source = 'tanks', winter = false }) {
  // source geometry: where the pump sits and the lane the lay-flat follows (hz)
  const pit = source === 'pit', ast = source === 'ast', heated = source === 'heated';
  const hz = pit ? tanks[2] + 2 : ast ? tanks[2] + 10.5 : tanks[2] + 7.4;
  const x0 = tanks[0] - 1.0, x1 = ast ? tanks[0] + 18 : tanks[0] + (count - 1) * 3.5 + 1.6;
  const pumpPos = pit ? [tanks[0] + 26, 0, hz + 1.0] : [x1 + 4.5, 0, hz + 1.0];
  const heaterPos = [pumpPos[0] + 9.5, 0, hz + 2.6];
  const headerPts = useMemo(() => [[x0, 0.5, hz], [x1 + 0.5, 0.5, hz]], [x0, x1, hz]);
  const ground = useMemo(() => {
    const start = heated ? [heaterPos[0] + 2.0, 0.3, heaterPos[2] - 1.9] : [pumpPos[0] + 3.2, 0.3, pumpPos[2] + 0.6];
    const out = [start, [start[0] + 5, 0.3, pumpPos[2] + 0.4]];
    const bend = [to[0] + 2.2, 0.3, hz - 2.5];
    out.push([bend[0] - 6, 0.3, hz - 1.0], bend, [to[0] + 2.2, 0.3, to[2] + 0.3]);
    return out;
  }, [to, hz, heated]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = ground[ground.length - 1];
  return (
    <group name="LG-WATERTRANSFER">
      {(source === 'tanks' || heated) && (
        <>
          {/* suction header and its stands, one hose from each tank's first manifold valve */}
          <PipeRun points={headerPts} r={0.15} mat={MAT.steel} />
          <PipeStands points={headerPts} r={0.15} every={4} />
          {Array.from({ length: count }).map((_, i) => <Hose key={i} from={[tanks[0] + i * 3.5 - 0.9, 0.9, tanks[2] + 6.9]} to={[tanks[0] + i * 3.5 - 0.9, 0.55, hz]} r={0.09} sag={0.12} segments={6} />)}
          <Hose from={[x1 + 0.5, 0.5, hz]} to={[pumpPos[0] + 1.2, 1.1, pumpPos[2] - 0.35]} r={0.15} sag={0.1} segments={8} />
        </>
      )}
      {ast && (
        <>
          {/* manifold header along the tank fronts from both base valves */}
          <PipeRun points={headerPts} r={0.15} mat={MAT.steel} />
          <PipeStands points={headerPts} r={0.15} every={4} />
          {[0, 1].map(i => <Hose key={i} from={[tanks[0] + i * 18, 0.5, tanks[2] + 9.1]} to={[tanks[0] + i * 18, 0.55, hz]} r={0.12} sag={0.08} segments={5} />)}
          <Hose from={[x1 + 0.5, 0.5, hz]} to={[pumpPos[0] + 1.2, 1.1, pumpPos[2] - 0.35]} r={0.15} sag={0.1} segments={8} />
        </>
      )}
      {pit && (
        /* suction hose from the floating skid, over the east berm crest, down to the bank pump */
        <>
          <Hose from={[tanks[0] - 7.0, 1.9, tanks[2] + 3.0]} to={[tanks[0] + 23.6, 2.0, tanks[2] + 2.4]} r={0.15} sag={0.35} segments={12} />
          <Hose from={[tanks[0] + 23.6, 2.0, tanks[2] + 2.4]} to={[pumpPos[0] + 1.2, 1.1, pumpPos[2] - 0.35]} r={0.15} sag={0.15} segments={6} />
        </>
      )}
      <TransferPump position={pumpPos} showLabels={showLabels} />
      {heated && (
        <>
          <FracHeater position={heaterPos} steam={winter} showLabels={showLabels} />
          <Hose from={[pumpPos[0] + 1.2, 1.9, pumpPos[2]]} to={[heaterPos[0] - 1.2, 1.78, heaterPos[2] - 1.75]} r={0.15} sag={0.2} segments={8} />
        </>
      )}
      {/* lay-flat discharge hose: a flattened tube on the ground, then a round riser to the suction stub */}
      <group scale={[1, 0.45, 1]}>
        <Cable points={ground.map(p => [p[0], p[1] / 0.45, p[2]])} r={0.17} mat={{ color: '#1f3a8a', metalness: 0.05, roughness: 0.75 }} stripe={3} contrast={0.15} segmentsPerLeg={6} />
      </group>
      {!heated && <Hose from={[pumpPos[0] + 1.2, 1.9, pumpPos[2]]} to={ground[0]} r={0.15} sag={0.05} segments={6} />}
      <Hose from={last} to={to} r={0.15} sag={0.15} segments={8} />
      <Merged mat={MAT.steel} deps={[]} shadow={false} parts={() => [{ g: GEO.cyl(0.19, 0.3, 14), p: [to[0] + 0.15, to[1], to[2]], r: [0, 0, Math.PI / 2] }]} />
      {showLabels && <Label position={[(x0 + x1) / 2, 2.2, hz]} text={pit ? 'Water transfer: pit to the hydration unit' : ast ? 'Water transfer: storage tanks to the hydration unit' : 'Water transfer: tank header to the hydration unit'} />}
    </group>
  );
}

// Fuel gas trailers (CNG or LNG) parked in a row along the pad edge for gas-burning fleets.
export function FuelTrailers({ position, count = 6, showLabels }) {
  const D = 1.18;
  return (
    <group position={position} name="PP-FUELGAS">
      <Instanced transforms={useMemo(() => Array.from({ length: count }, (_, i) => ({ position: [0, 0, i * 3.6] })), [count])} name="PP-FUELGAS">
      {[0].map((i) => (
        <Trailer key={i} length={13} width={2.6} position={[0, 0, 0]} rotation={[0, 0, 0]}>
          <Cyl r={1.2} h={10.5} rotation={[0, 0, Math.PI / 2]} position={[0.5, D + 1.25, 0]} mat={MAT.paintWhite} name="PP-FUELGAS-TRAILER" />
          {[-4.5, 5.5].map((x, k) => <mesh key={k} position={[x, D + 1.25, 0]} rotation={[0, 0, k ? Math.PI / 2 : -Math.PI / 2]}><sphereGeometry args={[1.2, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /><Mat mat={MAT.paintWhite} /></mesh>)}
          {[-2.5, 3.5].map((x, k) => <Box key={'s' + k} size={[0.4, 1.3, 2.4]} position={[x, D + 0.6, 0]} mat={MAT.chassis} />)}
          <Box size={[1.4, 1.5, 1.8]} position={[-6.0, D + 0.75, 0]} mat={MAT.chassis} />
          <Cyl r={0.06} h={2.0} rotation={[Math.PI / 2, 0, 0]} position={[-5.4, D + 0.4, 0]} mat={MAT.steel} />
          <Cyl r={0.1} h={0.6} rotation={[0, 0, Math.PI / 2]} position={[-6.9, D + 0.4, 0.5]} mat={MAT.brass} />
        </Trailer>
      ))}
      </Instanced>
      {showLabels && <Label position={[0, 4.8, count * 1.8]} text={'Fuel gas trailers (CNG or LNG)'} />}
    </group>
  );
}
// Light tower: trailer with an engine box, telescoping mast, four lamp heads.
export function LightTower({ position, rotation = [0, 0, 0], lit = false }) {
  return (
    <group position={position} rotation={rotation} name="LG-LIGHTTOWER">
      <Box size={[2.6, 0.2, 1.4]} position={[0, 0.5, 0]} mat={MAT.chassis} />
      <RBox r={0.08} size={[2.2, 1.0, 1.2]} position={[0.1, 1.1, 0]} mat={MAT.paintWhite} />
      <Box size={[1.0, 0.25, 0.6]} position={[-1.6, 0.45, 0]} mat={MAT.chassis} />
      <Cyl r={0.04} h={0.4} position={[-2.1, 0.25, 0]} mat={MAT.darkSteel} />
      {[-0.55, 0.55].map((z, i) => <Wheel key={i} position={[0.6, 0.4, z]} r={0.35} w={0.2} />)}
      <Cyl r={0.09} h={3.0} position={[-0.6, 3.1, 0]} mat={MAT.darkSteel} />
      <Cyl r={0.07} h={3.0} position={[-0.6, 6.0, 0]} mat={MAT.darkSteel} />
      <Cyl r={0.05} h={3.0} position={[-0.6, 8.9, 0]} mat={MAT.steel} />
      <Box size={[1.3, 0.08, 0.08]} position={[-0.6, 10.3, 0]} mat={MAT.darkSteel} />
      {[[-0.6, -0.5], [-0.2, -0.5], [-1.0, 0.5], [-0.2, 0.5]].map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 10.2, dz]} rotation={[dz > 0 ? 0.5 : -0.5, 0, 0]}><boxGeometry args={[0.45, 0.35, 0.14]} /><meshStandardMaterial color="#fff6d5" emissive="#ffe9a8" emissiveIntensity={lit ? 4.5 : 0.8} toneMapped={!lit} /></mesh>
      ))}
    </group>
  );
}
// Flanged treating spools: red iron with block elbows and flange rings at every joint (large-bore monoline).
export function FlangedRun({ points, r = 0.1, name, color = null }) {
  const mat = color ? { color, metalness: 0.5, roughness: 0.55 } : MAT.redIron;
  return (
    <group name={name}>
      {points.slice(1).map((p, i) => <Pipe key={i} from={points[i]} to={p} r={r} mat={mat} unions={false} />)}
      {points.slice(1, -1).map((p, i) => {
        const a = points[i], b = points[i + 2];
        const d1 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], d2 = [b[0] - p[0], b[1] - p[1], b[2] - p[2]];
        const l1 = Math.hypot(...d1) || 1, l2 = Math.hypot(...d2) || 1;
        const straight = (d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2]) / (l1 * l2) > 0.98;
        return straight
          ? <Cyl key={'e' + i} r={r * 2.1} h={r * 1.2} position={p} rotation={Math.abs(d1[1]) / l1 > 0.7 ? [0, 0, 0] : Math.abs(d1[0]) / l1 > 0.7 ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]} mat={MAT.darkSteel} />
          : <Box key={'e' + i} size={[r * 3.2, r * 3.2, r * 3.2]} position={p} mat={mat} />;
      })}
      {points.slice(1).map((p, i) => {
        const a = points[i]; const d = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]; const len = Math.hypot(...d) || 1;
        const q = [a[0] + d[0] * 0.5, a[1] + d[1] * 0.5, a[2] + d[2] * 0.5];
        const rot = Math.abs(d[1]) / len > 0.7 ? [0, 0, 0] : Math.abs(d[0]) / len > 0.7 ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
        return len > 1.2 ? <group key={'f' + i}><Cyl r={r * 2.1} h={r * 0.7} position={q} rotation={rot} mat={MAT.darkSteel} /></group> : null;
      })}
      {/* studs and nuts on every flange pair: the mid-segment flanges and the straight joints */}
      <BoltRings rings={[
        ...points.slice(1).flatMap((p, i) => { const a = points[i]; const d = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]; const len = Math.hypot(...d) || 1; return len > 1.2 ? [{ p: [a[0] + d[0] * 0.5, a[1] + d[1] * 0.5, a[2] + d[2] * 0.5], dir: d, n: 8, bc: r * 1.65, sr: r * 0.12, sh: r * 1.3 }] : []; }),
        ...points.slice(1, -1).flatMap((p, i) => { const a = points[i], b = points[i + 2]; const d1 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], d2 = [b[0] - p[0], b[1] - p[1], b[2] - p[2]]; const l1 = Math.hypot(...d1) || 1, l2 = Math.hypot(...d2) || 1; return (d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2]) / (l1 * l2) > 0.98 ? [{ p, dir: d1, n: 8, bc: r * 1.65, sr: r * 0.12, sh: r * 1.8 }] : []; }),
      ]} />
    </group>
  );
}

// ---------------------------------------------------------------- fleet power
// Power for the pumps by fleet type: turbine generators, reciprocating gensets, a grid substation, a gas
// conditioning skid for dual fuel, or a fuel trailer for diesel. Generic shapes.
export function PowerGen({ fleet = 'diesel', position = [-40, 0, -34], showLabels }) {
  const D = 1.18;
  return (
    <group position={position} name="PP-POWERGEN">
      {fleet === 'efrac-turbine' && [0, 1].map(i => (
        <Trailer key={i} length={15} width={3.0} position={[0, 0, i * 5.2]} rotation={[0, 0, 0]}>
          {/* turbine enclosure with louvered panels, inlet filter house, exhaust stack with silencer, generator end */}
          <RBox r={0.12} size={[8.6, 2.9, 2.6]} position={[1.5, D + 1.45, 0]} mat={MAT.paintWhite} name={i === 0 ? 'PP-POWERGEN-TURBINE' : undefined} />
          {[-1.5, 0.5, 2.5, 4.5].map((x, k) => <Box key={k} size={[1.4, 1.6, 0.04]} position={[x, D + 1.3, 1.32]} mat={MAT.dimSteel} />)}
          <Box size={[3.2, 3.6, 2.8]} position={[-4.8, D + 1.8, 0]} mat={MAT.steel} />
          {[-0.9, 0, 0.9].map((z, k) => <Box key={'f' + k} size={[3.0, 3.2, 0.04]} position={[-4.8, D + 1.8, z > 0 ? 1.42 : -1.42]} mat={MAT.dimSteel} />)}
          <Cyl r={0.75} h={1.4} position={[-1.2, D + 3.6, 0]} mat={MAT.darkSteel} />
          <Cyl r={0.55} h={3.4} position={[-1.2, D + 5.8, 0]} mat={MAT.darkSteel} />
          <RBox r={0.12} size={[2.6, 1.8, 2.2]} position={[6.4, D + 0.9, 0]} mat={MAT.blue} />
          <Handrail length={8.0} position={[1.5, D + 2.9, 0]} height={0.9} />
          <Ladder height={2.9} position={[6.0, D, 1.2]} rotation={[0, 0, 0]} />
        </Trailer>
      ))}
      {fleet === 'efrac-turbine' && (
        <Trailer length={12} width={2.8} position={[0, 0, 10.6]}>
          <RBox r={0.12} size={[10, 2.6, 2.5]} position={[0, D + 1.3, 0]} mat={MAT.blue} name="PP-POWERGEN-SWITCHGEAR" />
          {[-3.5, -1.2, 1.1, 3.4].map((x, k) => <Box key={k} size={[1.8, 2.2, 0.05]} position={[x, D + 1.2, 1.27]} mat={MAT.chassis} />)}
          {[-2.0, 2.0].map((x, k) => <Cyl key={'b' + k} r={0.12} h={1.0} position={[x, D + 3.0, 0]} mat={MAT.cream} />)}
          <Box size={[10.2, 0.1, 2.6]} position={[0, D + 2.62, 0]} mat={MAT.chassis} />
        </Trailer>
      )}
      {fleet === 'efrac-genset' && [0, 1, 2, 3].map(i => (
        <Trailer key={i} length={13} width={2.8} position={[0, 0, i * 4.4]} rotation={[0, 0, 0]}>
          {/* reciprocating genset: engine enclosure with louvers, radiator at the end, exhaust with silencer, generator and breaker cabinet */}
          <RBox r={0.12} size={[7, 2.6, 2.4]} position={[0.5, D + 1.3, 0]} mat={MAT.paintWhite} name={i === 0 ? 'PP-POWERGEN-GENSET' : undefined} />
          {[-1.5, 0.5, 2.5].map((x, k) => <Box key={k} size={[1.5, 1.4, 0.04]} position={[x, D + 1.2, 1.22]} mat={MAT.dimSteel} />)}
          <Box size={[2.4, 2.8, 2.4]} position={[-4.6, D + 1.4, 0]} mat={MAT.darkSteel} />
          <Box size={[0.05, 2.4, 2.0]} position={[-5.83, D + 1.4, 0]} mat={MAT.dimSteel} />
          <Cyl r={0.25} h={2.0} position={[3.0, D + 3.4, 0.7]} mat={MAT.darkSteel} />
          <Cyl r={0.4} h={1.2} position={[3.0, D + 2.9, 0.7]} mat={MAT.steel} />
          <RBox r={0.12} size={[2.0, 1.8, 2.0]} position={[5.2, D + 0.9, 0]} mat={MAT.blue} />
        </Trailer>
      ))}
      {fleet === 'grid' && (
        <group>
          {/* substation on a gravel pad: transformer with radiator fins and bushings, breakers, line poles with crossarms */}
          <Box size={[9, 0.3, 9]} position={[0, 0.15, 0]} mat={MAT.dimSteel} />
          <Box size={[3.4, 2.8, 2.4]} position={[0, 1.7, 0]} mat={MAT.steel} name="PP-POWERGEN-TRANSFORMER" />
          {[-1.4, -0.7, 0, 0.7, 1.4].map((x, i) => <Box key={i} size={[0.2, 2.2, 3.0]} position={[x, 1.7, 0]} mat={MAT.darkSteel} />)}
          {[0, 1, 2].map(i => <group key={i}><Cyl r={0.12} h={1.6} position={[-1 + i, 3.9, 0]} mat={MAT.cream} />{[0.3, 0.6, 0.9, 1.2].map((y, k) => <Cyl key={k} r={0.18} h={0.06} position={[-1 + i, 3.1 + y, 0]} mat={MAT.cream} />)}</group>)}
          <Cyl r={0.3} h={0.5} position={[1.2, 3.35, 0.8]} mat={MAT.steel} />
          <RBox r={0.12} size={[2.6, 2.4, 2.0]} position={[5, 1.5, 0]} mat={MAT.blue} />
          {[-1.5, 1.5].map((z, i) => <group key={i} position={[5, 0, z]}><Cyl r={0.08} h={3.6} position={[0, 1.8, 0]} mat={MAT.steel} /><Cyl r={0.2} h={0.5} position={[0, 3.8, 0]} mat={MAT.cream} /></group>)}
          {[0, 1, 2].map(i => <Cyl key={i} r={0.14} h={11} position={[-8 - i * 22, 5.5, -2]} mat={MAT.rust} />)}
          {[0, 1, 2].map(i => <Box key={i} size={[0.2, 0.2, 3.0]} position={[-8 - i * 22, 10.4, -2]} mat={MAT.rust} />)}
          {[0, 1, 2].map(i => [-1.3, 0, 1.3].map((dz, k) => <Cyl key={i + '-' + k} r={0.08} h={0.35} position={[-8 - i * 22, 10.65, -2 + dz]} mat={MAT.cream} />))}
          {[-1.3, 0, 1.3].map((dz, i) => <Hose key={i} from={[-8, 10.8, -2 + dz]} to={[-30, 10.8, -2 + dz]} r={0.02} sag={0.8} mat={MAT.rubber} />)}
          {[-1.3, 0, 1.3].map((dz, i) => <Hose key={'b' + i} from={[-30, 10.8, -2 + dz]} to={[-52, 10.8, -2 + dz]} r={0.02} sag={0.8} mat={MAT.rubber} />)}
          {[-1.3, 0, 1.3].map((dz, i) => <Hose key={'c' + i} from={[-8, 10.8, -2 + dz]} to={[-1 + i, 4.7, 0]} r={0.02} sag={0.3} mat={MAT.rubber} />)}
        </group>
      )}
      {fleet === 'dualfuel' && (
        <group name="PP-POWERGEN-GASSKID">
          {/* gas conditioning skid: inlet scrubber, filter coalescer, heater, pressure regulation, distribution header to the pumps */}
          <Box size={[8, 0.3, 3]} position={[0, 0.15, 0]} mat={MAT.yellow} />
          <Cyl r={0.7} h={4.5} rotation={[0, 0, Math.PI / 2]} position={[-1, 1.4, 0.6]} mat={MAT.steel} />
          {[-2.6, 0.6].map((x, i) => <Box key={i} size={[0.4, 0.9, 1.6]} position={[x, 0.7, 0.6]} mat={MAT.chassis} />)}
          <Cyl r={0.4} h={1.8} position={[-3.0, 1.4, -0.7]} mat={MAT.steel} />
          <Box size={[2.2, 2.0, 1.4]} position={[2.6, 1.3, -0.5]} mat={MAT.darkSteel} />
          <Cyl r={0.15} h={2.5} position={[2.6, 3.5, -0.5]} mat={MAT.darkSteel} />
          {[0.0, 0.8, 1.6].map((x, i) => <Cyl key={i} r={0.14} h={0.3} position={[x, 0.7, -0.9]} rotation={[0, 0, Math.PI / 2]} mat={MAT.brass} />)}
          <Pipe from={[1.5, 0.6, 0.6]} to={[4, 0.6, 0]} r={0.08} mat={MAT.yellow} />
          <Pipe from={[4, 0.6, 0]} to={[40, 0.6, 0]} r={0.08} mat={MAT.yellow} unions={false} />
          <Handrail length={8} position={[0, 0.3, 1.45]} height={0.9} />
        </group>
      )}
      {fleet === 'diesel' && (
        <Trailer length={12} width={2.6}>
          {/* diesel fuel tanker: barrel with domed ends, hose reel and pump cabinet at the rear */}
          <Cyl r={1.15} h={9.6} rotation={[0, 0, Math.PI / 2]} position={[0.3, D + 1.2, 0]} mat={MAT.paintWhite} name="PP-POWERGEN-FUELTRAILER" />
          {[-4.5, 5.1].map((x, k) => <mesh key={k} position={[x, D + 1.2, 0]} rotation={[0, 0, k ? Math.PI / 2 : -Math.PI / 2]}><sphereGeometry args={[1.15, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /><Mat mat={MAT.paintWhite} /></mesh>)}
          {[-2.5, 3.0].map((x, k) => <Box key={'s' + k} size={[0.4, 1.2, 2.3]} position={[x, D + 0.6, 0]} mat={MAT.chassis} />)}
          <Box size={[1.2, 1.2, 2.0]} position={[-5.4, D + 0.6, 0]} mat={MAT.chassis} />
          <Cyl r={0.45} h={0.3} rotation={[Math.PI / 2, 0, 0]} position={[-5.4, D + 0.7, 1.15]} mat={MAT.darkSteel} />
          <Box size={[9.0, 0.03, 0.5]} position={[0.3, D + 2.38, 0]} mat={MAT.grating} />
          <Handrail length={9.0} position={[0.3, D + 2.38, 0.3]} height={0.9} />
        </Trailer>
      )}
      {showLabels && <Label position={[0, 7.5, 2]} text={fleet === 'efrac-turbine' ? 'Turbine generators and switchgear' : fleet === 'efrac-genset' ? 'Gas reciprocating gensets' : fleet === 'grid' ? 'Grid substation' : fleet === 'dualfuel' ? 'Gas conditioning skid (dual fuel)' : 'Fuel trailer (diesel)'} />}
    </group>
  );
}

// terrain functions live in terrain.js; re-exported here for existing imports
export { terrainNoise, terrainHeight } from './terrain.js';
import { terrainNoise, terrainHeight } from './terrain.js';
import { Vegetation, Horizon, RoadFurniture } from './vegetation.jsx';
import { padStainTexture } from './ground.js';
const NO_GRIME = { grime: 0 };
const TERRAIN = { grime: 0, terrain: 1 };   // ground planes take the macro soil variation (Drop 49)

export function Ground({ terrain, pad, seed = 1, stain = null }) {
  // Drop 44: the pad's stain map (lanes, ruts, drips, spills drawn from the layout) reaches the pad material through
  // stable uniform holders in its userData; the material patch in lighting.jsx samples it in world XZ.
  const stainTex = useMemo(() => (stain ? padStainTexture(stain) : null), [stain]);
  const stainHolder = useMemo(() => ({ uniform: { value: null }, rect: { value: new THREE.Vector4() } }), []);
  stainHolder.uniform.value = stainTex;
  stainHolder.rect.value.set(pad.x0, pad.z0, pad.x1 - pad.x0, pad.z1 - pad.z0);
  const padUserData = useMemo(() => ({ grime: 0, stain: stainHolder }), [stainHolder]);
  const t = terrain || { ground: '#4b4235', pad: '#5a5245', relief: 0.5, veg: 'scrub', density: 0.1, vegColor: '#4f5b3c' };
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(720, 720, 144, 144);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const base = new THREE.Color(t.ground);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainHeight(x, z, t.relief, pad);
      pos.setY(i, h);
      const v = 0.82 + 0.36 * terrainNoise(x / 9 + 3, z / 9 + 1);
      c.copy(base).multiplyScalar(v);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }, [t.ground, t.relief, pad.x0, pad.x1, pad.z0, pad.z1]); // eslint-disable-line react-hooks/exhaustive-deps
  // outer ground: a coarse 2 km plane under the horizon features so distant relief stands on land, not sky
  const outer = useMemo(() => {
    const g = new THREE.PlaneGeometry(2000, 2000, 50, 50);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, terrainHeight(x, z, t.relief, pad) - 0.35); }
    g.computeVertexNormals();
    return g;
  }, [t.relief, pad.x0, pad.x1, pad.z0, pad.z1]); // eslint-disable-line react-hooks/exhaustive-deps
  const padW = pad.x1 - pad.x0, padL = pad.z1 - pad.z0;
  // ground: fractal noise as color detail and bump over the vertex-colored terrain; pad: gravel with ruts and stains
  const groundTex = useMemo(() => noiseTexture('ground', { size: 256, octaves: 5, base: 0.78, amp: 0.3, period: 8, repeat: 90 }), []);
  const padTex = useMemo(() => { const tx = padTexture(); if (tx) tx.repeat.set(padW / 16, padL / 16); return tx; }, [padW, padL]);
  const roadTex = useMemo(() => { const tx = padTexture(); return tx ? tx.clone() : null; }, []);
  if (roadTex) { roadTex.needsUpdate = true; roadTex.repeat.set(14, 0.35); }
  return (
    <group>
      <mesh geometry={geom} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} metalness={0} map={groundTex || undefined} bumpMap={LITE ? undefined : groundTex || undefined} bumpScale={0.35} userData={TERRAIN} />
      </mesh>
      <mesh geometry={outer}>
        <meshStandardMaterial color={t.ground} roughness={1} metalness={0} map={groundTex || undefined} userData={TERRAIN} />
      </mesh>
      {/* the pad itself: graded caliche or crushed stone, the stain map over it, and the lease road out to the edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(pad.x0 + pad.x1) / 2, 0.0, (pad.z0 + pad.z1) / 2]} receiveShadow>
        <planeGeometry args={[padW, padL]} />
        <meshStandardMaterial color={t.pad} roughness={0.95} metalness={0} map={padTex || undefined} bumpMap={LITE ? undefined : padTex || undefined} bumpScale={0.12} userData={padUserData} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[pad.x1 + 160, 0.01, pad.z0 + 12]} receiveShadow>
        <planeGeometry args={[320, 7]} />
        <meshStandardMaterial color={t.pad} roughness={0.95} metalness={0} map={roadTex || undefined} userData={NO_GRIME} />
      </mesh>
      {/* berm around the pad */}
      {[[pad.x0, (pad.z0 + pad.z1) / 2, 1.2, padL + 1.2], [pad.x1, (pad.z0 + pad.z1) / 2, 1.2, padL + 1.2], [(pad.x0 + pad.x1) / 2, pad.z0, padW + 1.2, 1.2], [(pad.x0 + pad.x1) / 2, pad.z1, padW + 1.2, 1.2]].map(([x, z, w, l], i) => (
        <mesh key={i} position={[x, 0.25, z]}><boxGeometry args={[w, 0.5, l]} /><meshStandardMaterial color={t.ground} roughness={1} userData={NO_GRIME} /></mesh>
      ))}
      <Vegetation terrain={t} pad={pad} seed={seed} />
      <Horizon terrain={t} pad={pad} seed={seed} />
      <RoadFurniture pad={pad} />
    </group>
  );
}

