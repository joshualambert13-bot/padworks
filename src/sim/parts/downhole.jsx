// Procedural downhole cut-away: layered formation, cemented casing (or openhole liner with packers), stages with
// perforation clusters or frac sleeves, plugs or balls on seats, bi-wing fractures with branches and proppant,
// fluid particles, wireline tool string, coiled tubing mill-out. Simplified motion; illustrative only.
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSim } from '../store.js';
import { Label } from './primitives.jsx';
import { rockTexture, dotTexture, fractureAlpha, LITE } from './lighting.jsx';

export const LATERAL = { heelX: -16, toeX: 16, casingR: 0.5, holeR: 0.68 };
const count = () => useSim.getState().stages.length;
const clusters = () => useSim.getState().setup.clusters;
export const stageLen = () => (LATERAL.toeX - LATERAL.heelX) / count();
export const stageX = (i) => LATERAL.toeX - (i + 0.5) * stageLen();                       // stage center; stage 0 at the toe
export const clusterX = (i, c) => { const n = clusters(); const span = stageLen() * 0.62; return stageX(i) + (n === 1 ? 0 : (c - (n - 1) / 2) * (span / (n - 1))); };
export const plugX = (i) => LATERAL.toeX - i * stageLen() - 0.45;                          // plug toe-ward of stage i perfs (between stage i and i-1)
export const sleeveX = (i) => stageX(i);                                                    // frac sleeve sub at the stage center

const LAYERS = [
  { y: 4.6, h: 1.4, color: '#8c7a5e', kind: 'sand' },
  { y: 3.3, h: 1.2, color: '#5e5040', kind: 'shale' },
  { y: 2.1, h: 1.2, color: '#9a8a66', kind: 'sand' },
  { y: 1.05, h: 0.9, color: '#6f7a84', kind: 'lime' },
  { y: 0, h: 1.2, color: '#3f4a55', kind: 'shale' },   // target: a darker shale band around the lateral
  { y: -1.05, h: 0.9, color: '#6f7a84', kind: 'lime' },
  { y: -2.1, h: 1.2, color: '#8a7a5a', kind: 'sand' },
  { y: -3.3, h: 1.2, color: '#55483a', kind: 'shale' },
  { y: -4.6, h: 1.4, color: '#5a4e40', kind: 'sand' },
];

// Layered formation: each bed is a textured box (rock texture tinted by the bed color, bump for grain), the section
// face carries bedding lines and a few natural fractures. The schematic grid shows only with labels.
export function Formation({ grid = false }) {
  const bedding = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ y: -5.2 + i * 0.4 + ((i * 7) % 3) * 0.05, x: ((i * 13) % 7) - 3, w: 30 + ((i * 5) % 9) })), []);
  const tex = useMemo(() => ({ sand: rockTexture('sand'), shale: rockTexture('shale'), lime: rockTexture('lime') }), []);
  const maps = useMemo(() => LAYERS.map(l => { const t = tex[l.kind]; if (!t) return null; const c = t.clone(); c.needsUpdate = true; c.repeat.set(10, Math.max(1, Math.round(l.h / 1.2))); return c; }), [tex]);
  return (
    <group name="FORMATION">
      {LAYERS.map((l, i) => (
        <mesh key={i} position={[0, l.y, -4.5]} receiveShadow>
          <boxGeometry args={[44, l.h, 9]} />
          <meshStandardMaterial color={l.color} roughness={1} metalness={0} map={maps[i] || undefined} bumpMap={LITE ? undefined : maps[i] || undefined} bumpScale={0.08} />
        </mesh>
      ))}
      {bedding.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, 0.01]}>
          <planeGeometry args={[b.w, 0.025]} />
          <meshBasicMaterial color="#1c2027" transparent opacity={0.35} />
        </mesh>
      ))}
      {[-11, -3, 6, 13].map((x, i) => (
        <mesh key={'nf' + i} position={[x, 0.2, 0.012]} rotation={[0, 0, THREE.MathUtils.degToRad(70 + i * 9)]}>
          <planeGeometry args={[0.035, 3.2]} />
          <meshBasicMaterial color="#141820" transparent opacity={0.6} />
        </mesh>
      ))}
      {grid && <gridHelper args={[44, 22, '#2b2f36', '#22262c']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]} />}
    </group>
  );
}

// Casing rendered as the back half of a cylinder so the interior is visible from the front (+Z).
// Cemented: a cement sheath fills the annulus. Openhole: a rugose borehole wall and no cement.
export function Casing({ openhole = false }) {
  const len = LATERAL.toeX - LATERAL.heelX + 2;
  const cementTex = useMemo(() => { const t = rockTexture('sand'); if (!t) return null; const c = t.clone(); c.needsUpdate = true; c.repeat.set(2, 12); return c; }, []);
  const wall = useMemo(() => {
    const g = new THREE.CylinderGeometry(LATERAL.holeR, LATERAL.holeR, len, 40, 24, true, Math.PI, Math.PI);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      const k = 1 + 0.06 * Math.sin(y * 3.1 + x * 5) * Math.cos(z * 4.7 + y);
      p.setX(i, x / r * LATERAL.holeR * k); p.setZ(i, z / r * LATERAL.holeR * k);
    }
    g.computeVertexNormals();
    return g;
  }, [len]);
  return (
    <group name="CM-PRODUCTIONCASING" rotation={[0, 0, -Math.PI / 2]} position={[(LATERAL.toeX + LATERAL.heelX) / 2, 0, 0]}>
      {openhole ? (
        <mesh geometry={wall}><meshStandardMaterial color="#4a5058" roughness={1} side={THREE.DoubleSide} /></mesh>
      ) : (
        <mesh receiveShadow>
          <cylinderGeometry args={[LATERAL.holeR, LATERAL.holeR, len, 24, 1, true, Math.PI, Math.PI]} />
          <meshStandardMaterial color="#b9b5a6" roughness={0.95} metalness={0} side={THREE.DoubleSide} map={cementTex || undefined} />
        </mesh>
      )}
      <mesh receiveShadow>
        <cylinderGeometry args={[LATERAL.casingR, LATERAL.casingR, len, 32, 1, true, Math.PI, Math.PI]} />
        <meshStandardMaterial color="#9aa2aa" metalness={0.9} roughness={0.32} side={THREE.DoubleSide} />
      </mesh>
      {/* couplings every 12 m */}
      {Array.from({ length: Math.floor(len / 4) }).map((_, i) => (
        <mesh key={i} position={[0, -len / 2 + 2 + i * 4, 0]}>
          <cylinderGeometry args={[LATERAL.casingR + 0.03, LATERAL.casingR + 0.03, 0.25, 24, 1, true, Math.PI, Math.PI]} />
          <meshStandardMaterial color="#6d757d" metalness={0.8} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function fracColor(net) {
  const t = Math.max(0, Math.min(1, net / 2500));
  return new THREE.Color().setHSL(0.6 - 0.6 * t, 0.95, 0.5);
}

// Bi-wing fracture at one cluster: a thin main plane plus two smaller branches, height limited by the layers above and below.
// `settled`: pumping is over and the fracture has closed on its proppant, so the pressure glow is gone and the
// wings read as a faint propped plane rather than a lit one.
function Fracture({ extent, color, seed, settled = false }) {
  const scale = 7 * extent;
  const branch = [0.55, 0.4];
  const alpha = useMemo(() => fractureAlpha(), []);
  const c = settled ? '#6f8aa6' : color;
  const glow = settled ? 0.15 : 1.1, op = settled ? 0.28 : 0.55;
  return (
    <group>
      <mesh rotation={[0, Math.PI / 2, 0]} scale={[1, 0.5, 1]}>
        <planeGeometry args={[scale * 2, scale * 2]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={glow} transparent opacity={op} alphaMap={alpha || undefined} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {branch.map((b, i) => (
        <mesh key={i} rotation={[0, Math.PI / 2 + (i ? -0.32 : 0.28) * (seed % 2 ? 1 : -1), 0.12 * (i ? -1 : 1)]} scale={[1, 0.42, 1]} position={[0.15 * (i ? -1 : 1), 0, 0]}>
          <planeGeometry args={[scale * b * 2, scale * b * 2]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={glow * 0.7} transparent opacity={op * 0.7} alphaMap={alpha || undefined} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// Perforation cluster: shots at 60 degree phasing over a short interval, each a tunnel with a crushed zone and a hole in the casing.
function PerfCluster({ fired }) {
  if (!fired) return null;
  const shots = [40, 100, 160, 220, 280, 340];
  return (
    <group>
      {shots.map((a, i) => {
        const rad = THREE.MathUtils.degToRad(a);
        const dx = (i - 2.5) * 0.09;
        return (
          <group key={a} position={[dx, 0, 0]}>
            <mesh rotation={[rad, 0, 0]} position={[0, Math.cos(rad) * 0.95, -Math.sin(rad) * 0.95]}>
              <cylinderGeometry args={[0.025, 0.07, 1.1, 6]} />
              <meshStandardMaterial color="#0e0e0e" roughness={1} />
            </mesh>
            <mesh rotation={[rad, 0, 0]} position={[0, Math.cos(rad) * 0.62, -Math.sin(rad) * 0.62]}>
              <cylinderGeometry args={[0.09, 0.13, 0.25, 8]} />
              <meshStandardMaterial color="#2a2622" roughness={1} />
            </mesh>
            <mesh position={[0, Math.cos(rad) * LATERAL.casingR, -Math.sin(rad) * LATERAL.casingR]} rotation={[rad, 0, 0]}>
              <circleGeometry args={[0.05, 10]} />
              <meshBasicMaterial color="#050505" side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// Frac sleeve sub in the casing: a thicker housing with port windows, the inner sleeve (closed or shifted), a ball seat.
function SleeveSub({ open, ballSeated, toe, ports = 4, showLabels, index }) {
  const R = LATERAL.casingR;
  const windows = Array.from({ length: ports }, (_, i) => 180 + 20 + i * (140 / Math.max(1, ports - 1)));
  return (
    <group name={toe ? 'DT-TOESLEEVE' : 'DT-FRACSLEEVE'}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[R + 0.09, R + 0.09, 2.2, 24, 1, true, Math.PI, Math.PI]} />
        <meshStandardMaterial color="#5f6870" metalness={0.85} roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      {[-1.15, 1.15].map((x, i) => (
        <mesh key={i} rotation={[0, 0, Math.PI / 2]} position={[x, 0, 0]}>
          <cylinderGeometry args={[R + 0.12, R + 0.12, 0.2, 24, 1, true, Math.PI, Math.PI]} />
          <meshStandardMaterial color="#4b5259" metalness={0.85} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* port windows through the housing: dark when open, steel when the inner sleeve still covers them */}
      {windows.map((a, i) => {
        const rad = THREE.MathUtils.degToRad(a - 180);
        return (
          <mesh key={i} position={[0, Math.cos(rad) * (R + 0.095), -Math.abs(Math.sin(rad)) * (R + 0.095)]} rotation={[rad, 0, 0]}>
            <planeGeometry args={[0.55, 0.16]} />
            <meshStandardMaterial color={open ? '#050505' : '#8b939c'} emissive={open ? '#000' : '#000'} side={THREE.DoubleSide} metalness={open ? 0 : 0.8} roughness={open ? 1 : 0.4} />
          </mesh>
        );
      })}
      {/* inner sleeve: shifts toe-ward when open */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[open ? 0.9 : 0, 0, 0]}>
        <cylinderGeometry args={[R - 0.06, R - 0.06, 1.3, 24, 1, true, Math.PI, Math.PI]} />
        <meshStandardMaterial color="#b0b8c0" metalness={0.9} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* ball seat ring and the ball when landed (the toe sleeve has no seat) */}
      {!toe && (
        <mesh rotation={[0, 0, Math.PI / 2]} position={[open ? 0.9 : 0, 0, 0]}>
          <cylinderGeometry args={[R - 0.06, R - 0.2, 0.2, 24, 1, false]} />
          <meshStandardMaterial color="#b08d3c" metalness={0.9} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}
      {!toe && ballSeated && (
        <mesh position={[(open ? 0.9 : 0) - 0.22, 0, 0]}><sphereGeometry args={[0.27, 14, 14]} /><meshStandardMaterial color="#e8e8e8" metalness={0.3} roughness={0.35} /></mesh>
      )}
      {showLabels && <Label position={[0, 1.1, 0]} text={toe ? 'Toe sleeve' : 'Sleeve ' + (index + 1) + (ballSeated ? ' (ball on seat)' : '')} />}
    </group>
  );
}

// Swellable packer element between openhole stages
function Packer({ x }) {
  return (
    <group position={[x, 0, 0]} name="DT-OPENHOLEPACKER">
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[LATERAL.holeR - 0.02, LATERAL.holeR - 0.02, 1.4, 24, 1, true, Math.PI, Math.PI]} />
        <meshStandardMaterial color="#2b2622" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {[-0.8, 0.8].map((dx, i) => (
        <mesh castShadow key={i} rotation={[0, 0, Math.PI / 2]} position={[dx, 0, 0]}>
          <cylinderGeometry args={[LATERAL.casingR + 0.08, LATERAL.casingR + 0.08, 0.25, 24, 1, true, Math.PI, Math.PI]} />
          <meshStandardMaterial color="#4b5259" metalness={0.85} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

// Composite frac plug: upper slips, cone, element, cone, lower slips, mandrel, ball on the seat
function FracPlug({ index, showLabels, milled }) {
  if (milled) return (
    <mesh castShadow rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 0.05, 16]} /><meshStandardMaterial color="#4a4a4a" transparent opacity={0.4} /></mesh>
  );
  return (
    <group name={'DT-FRACPLUG-' + (index + 1)}>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 1.3, 16]} /><meshStandardMaterial color="#2f2f2f" roughness={0.8} /></mesh>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[0.02, 0, 0]}><cylinderGeometry args={[0.44, 0.44, 0.3, 16]} /><meshStandardMaterial color="#1a1a1a" roughness={0.95} /></mesh>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[0.28, 0, 0]}><cylinderGeometry args={[0.44, 0.33, 0.22, 16]} /><meshStandardMaterial color="#6a4a2e" roughness={0.9} /></mesh>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[-0.24, 0, 0]}><cylinderGeometry args={[0.33, 0.44, 0.22, 16]} /><meshStandardMaterial color="#6a4a2e" roughness={0.9} /></mesh>
      {[0.5, -0.46].map((x, k) => (
        <group key={k} position={[x, 0, 0]}>
          {[0, 60, 120, 180, 240, 300].map(a => {
            const rad = THREE.MathUtils.degToRad(a);
            return <mesh castShadow key={a} position={[0, Math.cos(rad) * 0.4, Math.sin(rad) * 0.4]} rotation={[rad, 0, 0]}><boxGeometry args={[0.18, 0.1, 0.16]} /><meshStandardMaterial color="#8a8f95" metalness={0.8} roughness={0.4} /></mesh>;
          })}
        </group>
      ))}
      <mesh castShadow position={[-0.78, 0, 0]}><sphereGeometry args={[0.2, 12, 12]} /><meshStandardMaterial color="#d8d8d8" metalness={0.3} roughness={0.4} /></mesh>
      {showLabels && <Label position={[0, 0.9, 0]} text={`Plug ${index + 1}`} />}
    </group>
  );
}

// One stage: perforation clusters or sleeve, plug or ball, fractures, proppant points
export function Stage({ stage, isCurrent, netPsi, showLabels, sleeve, openhole, settled = false }) {
  const color = useMemo(() => fracColor(isCurrent ? netPsi : 400), [isCurrent, netPsi]);
  const px = plugX(stage.index);
  const n = clusters();
  const nStages = count();
  return (
    <group name={'STAGE-' + (stage.index + 1)}>
      {sleeve ? (
        <group position={[sleeveX(stage.index), 0, 0]}>
          <SleeveSub open={stage.perforated} ballSeated={stage.plugSet && !stage.plugMilled} toe={stage.index === 0} ports={n} showLabels={showLabels} index={stage.index} />
          {stage.perforated && stage.fracExtent > 0 && Array.from({ length: Math.max(1, Math.min(3, Math.round(n / 2))) }).map((_, c, arr) => (
            <group key={c} position={[(c - (arr.length - 1) / 2) * 0.5, 0, 0]}>
              <Fracture extent={stage.fracExtent * (1 - 0.12 * c)} color={color} seed={stage.index + c} settled={settled} />
              <Proppant extent={stage.fracExtent * (1 - 0.12 * c)} fill={stage.proppantFill} />
            </group>
          ))}
        </group>
      ) : (
        Array.from({ length: n }).map((_, c) => {
          const x = clusterX(stage.index, c);
          const fired = c >= n - stage.clustersFired;            // bottom-up: the toe-most cluster fires first
          const stressShadow = 1 - 0.08 * Math.abs(c - (n - 1) / 2);
          return (
            <group key={c} position={[x, 0, 0]}>
              <PerfCluster fired={fired} />
              {fired && stage.fracExtent > 0 && (
                <group>
                  <Fracture extent={stage.fracExtent * stressShadow} color={color} seed={stage.index * 7 + c} settled={settled} />
                  <Proppant extent={stage.fracExtent * stressShadow} fill={stage.proppantFill} />
                </group>
              )}
            </group>
          );
        })
      )}
      {openhole && stage.index < nStages - 1 && <Packer x={plugX(stage.index + 1) + 0.2} />}
      {openhole && stage.index === 0 && <Packer x={LATERAL.toeX - 0.9} />}
      {/* frac plug toe-ward of this stage's perfs (plug and perf only) */}
      {!sleeve && stage.plugSet && (
        <group position={[px, 0, 0]}><FracPlug index={stage.index} showLabels={showLabels} milled={stage.plugMilled} /></group>
      )}
      {showLabels && <Label position={[stageX(stage.index), -1.2, 0]} text={`Stage ${stage.index + 1}${isCurrent ? ' (current)' : ''}`} />}
    </group>
  );
}

// Proppant points inside the fracture ellipse, count grows with fill
function Proppant({ extent, fill }) {
  const max = 240;
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(max * 3);
    const col = new Float32Array(max * 3);
    for (let i = 0; i < max; i++) {
      const r = Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      pos[i * 3] = (Math.random() - 0.5) * 0.08;
      pos[i * 3 + 1] = Math.sin(a) * r * 0.5;
      pos[i * 3 + 2] = Math.cos(a) * r;
      const v = 0.8 + Math.random() * 0.3;
      col[i * 3] = v; col[i * 3 + 1] = v * (0.9 + Math.random() * 0.1); col[i * 3 + 2] = v * 0.7;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  const n = Math.floor(max * fill);
  geom.setDrawRange(0, n);
  const dot = useMemo(() => dotTexture(), []);
  return (
    <points geometry={geom} scale={[1, 7 * extent, 7 * extent]}>
      <pointsMaterial vertexColors size={0.13} sizeAttenuation map={dot || undefined} alphaTest={0.4} transparent depthWrite={false} />
    </points>
  );
}

// Fluid particles moving from the heel to the open perforations of the current stage, then out into the fractures
export function FluidFlow({ rate, currentStage, active, ppa, targetOverride = null, spray = true }) {
  const cnt = 360;
  const ref = useRef();
  const seeds = useMemo(() => Array.from({ length: cnt }, () => ({ u: Math.random(), r: Math.random() * 0.4, a: Math.random() * Math.PI * 2, spray: Math.random() < 0.3, s: Math.random() })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const sleeve = useSim.getState().setup.completion === 'sleeve';
  const targetX = targetOverride != null ? targetOverride : currentStage != null ? (sleeve ? sleeveX(currentStage) : clusterX(currentStage, Math.floor((clusters() - 1) / 2))) : LATERAL.toeX;
  useFrame((_, dt) => {
    if (!ref.current) return;
    const speed = active ? 0.02 + rate / 100 * 0.35 : 0;
    for (let i = 0; i < cnt; i++) {
      const s = seeds[i];
      s.u += speed * dt * (0.8 + 0.4 * (i % 5) / 5);
      if (s.u > 1) s.u -= 1;
      let x, y, z;
      if (spray && s.spray && s.u > 0.85) {
        // leaving the wellbore through the perforations into the fracture plane
        const k = (s.u - 0.85) / 0.15;
        x = targetX + (s.s - 0.5) * 0.3;
        y = Math.max(-3.2, Math.min(3.2, Math.cos(s.a) * (0.45 + k * 2.6)));
        z = -Math.abs(Math.sin(s.a)) * (0.45 + k * 2.0) * 0.3;
      } else {
        x = LATERAL.heelX + (targetX - LATERAL.heelX) * Math.min(1, s.u / 0.85);
        y = Math.cos(s.a) * s.r;
        z = -Math.abs(Math.sin(s.a) * s.r);  // keep inside the back half of the cut-away
      }
      dummy.position.set(x, y, z);
      const sc = active ? 1 : 0.0001;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  const color = ppa > 0.1 ? '#c9b47a' : '#3aa7ff';
  return (
    <instancedMesh ref={ref} args={[null, null, cnt]} frustumCulled={false}>
      <sphereGeometry args={[0.055, 6, 6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} roughness={0.3} metalness={0} />
    </instancedMesh>
  );
}

// Perforating: a flash in the bore and six shaped-charge jets punching out through the casing at the gun's phasing,
// each a bright cone that reaches into the rock and fades as the tunnel it leaves behind appears.
const PHASING = [40, 100, 160, 220, 280, 340];
export function PerfFlash({ x, active }) {
  const ref = useRef();
  const jets = useRef([]);
  const life = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    life.current = active ? Math.min(1, life.current + dt * 3) : Math.max(0, life.current - dt * 2);
    const k = life.current;
    const pulse = Math.sin(Math.min(1, k) * Math.PI);                  // the flash blooms and is gone; the jets outlast it
    const s = 0.15 + pulse * 0.9;
    ref.current.scale.set(s, s, s);
    ref.current.material.opacity = pulse * 0.75;
    jets.current.forEach((m, i) => {
      if (!m) return;
      const jk = Math.max(0, Math.min(1, k * 1.4 - i * 0.05));        // the shots go off within a few hundredths of a second
      m.scale.set(0.5 + jk * 0.6, 0.2 + jk * 1.1, 0.5 + jk * 0.6);
      m.material.opacity = jk * (1 - 0.45 * jk);
    });
  });
  return (
    <group position={[x, 0, 0]}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshBasicMaterial color="#ffb020" transparent opacity={0} />
      </mesh>
      {PHASING.map((a, i) => {
        const rad = THREE.MathUtils.degToRad(a);
        return (
          <mesh key={a} ref={el => (jets.current[i] = el)} rotation={[rad, 0, 0]} position={[(i - 2.5) * 0.09, Math.cos(rad) * 0.85, -Math.sin(rad) * 0.85]}>
            <coneGeometry args={[0.09, 1.3, 8]} />
            <meshBasicMaterial color="#ffd27a" transparent opacity={0} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

// Plug setting sequence on the wireline string: run in with everything retracted, then as the setting tool
// strokes, the slips ride up their cones and bite the casing, the element is squeezed out against the wall, and at
// the end the tool shears off and backs away, leaving the plug set. `progress` 0..1 drives it.
function PlugSetting({ progress }) {
  const k = Math.max(0, Math.min(1, progress));
  const bite = Math.min(1, k / 0.6);                     // slips first
  const squeeze = Math.max(0, Math.min(1, (k - 0.3) / 0.5));  // then the element
  const shear = k > 0.9 ? (k - 0.9) / 0.1 : 0;          // then the release
  const slipR = 0.3 + bite * 0.14;
  const elemR = 0.31 + squeeze * 0.17;
  return (
    <group>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 1.3, 16]} /><meshStandardMaterial color="#2f2f2f" roughness={0.8} /></mesh>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[0.02, 0, 0]} scale={[1, elemR / 0.31, elemR / 0.31]}><cylinderGeometry args={[0.31, 0.31, 0.3 - squeeze * 0.06, 16]} /><meshStandardMaterial color="#1a1a1a" roughness={0.95} /></mesh>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[0.28 - squeeze * 0.04, 0, 0]}><cylinderGeometry args={[0.44, 0.33, 0.22, 16]} /><meshStandardMaterial color="#6a4a2e" roughness={0.9} /></mesh>
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[-0.24 + squeeze * 0.04, 0, 0]}><cylinderGeometry args={[0.33, 0.44, 0.22, 16]} /><meshStandardMaterial color="#6a4a2e" roughness={0.9} /></mesh>
      {[0.5 - bite * 0.06, -0.46 + bite * 0.06].map((x, kk) => (
        <group key={kk} position={[x, 0, 0]}>
          {[0, 60, 120, 180, 240, 300].map(a => {
            const rad = THREE.MathUtils.degToRad(a);
            return <mesh castShadow key={a} position={[0, Math.cos(rad) * slipR, Math.sin(rad) * slipR]} rotation={[rad, 0, 0]}><boxGeometry args={[0.18, 0.1, 0.16]} /><meshStandardMaterial color="#8a8f95" metalness={0.8} roughness={0.4} /></mesh>;
          })}
        </group>
      ))}
      {/* setting tool: sleeve over the mandrel strokes toward the plug, then the shear stud lets go and the tool backs off */}
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[-0.95 - 0.1 * squeeze + 0.5 * shear, 0, 0]}><cylinderGeometry args={[0.22, 0.22, 0.5, 12]} /><meshStandardMaterial color="#b08d3c" metalness={0.9} roughness={0.3} /></mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.72 + 0.5 * shear, 0, 0]}><cylinderGeometry args={[0.06, 0.06, 0.3, 8]} /><meshStandardMaterial color="#d8d8d8" metalness={0.8} roughness={0.3} /></mesh>
    </group>
  );
}

// Wireline tool string: cable from the heel, setting tool, plug, guns
export function WirelineString({ wl, stage }) {
  if (!wl || wl.step === 'idle' || wl.step === 'done') return null;
  const px = plugX(stage);
  let x;
  const released = wl.step === 'armed' || wl.step === 'perforate' || wl.step === 'pooh';
  if (wl.step === 'pumpdown' || wl.step === 'stuck') x = LATERAL.heelX + (px - LATERAL.heelX) * wl.progress;
  else if (wl.step === 'freeing') x = LATERAL.heelX + (px - LATERAL.heelX) * Math.min(0.98, wl.progress);   // worked free and moving again
  else if (wl.step === 'pooh') x = px - 0.5 - (px - 0.5 - LATERAL.heelX) * wl.progress;
  else x = released ? px - 0.5 : px;                      // after the shear the string sits half a meter back from the plug
  const gunsLen = Math.min(4.2, stageLen() * 0.6);
  return (
    <group name="WL-TOOLSTRING-DOWNHOLE">
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[(LATERAL.heelX + x - gunsLen) / 2, 0.05, -0.05]}>
        <cylinderGeometry args={[0.012, 0.012, Math.max(0.01, x - gunsLen - LATERAL.heelX), 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* guns and setting tool ahead of the plug (heel side), plug at the front (toe side) */}
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[x - gunsLen / 2 - 0.4, 0, -0.05]}>
        <cylinderGeometry args={[0.18, 0.18, gunsLen, 12]} />
        <meshStandardMaterial color="#3b3f45" metalness={0.8} roughness={0.4} />
      </mesh>
      {Array.from({ length: clusters() }).map((_, c) => (
        <mesh castShadow key={c} position={[x - gunsLen + 0.3 + c * (gunsLen - 0.8) / Math.max(1, clusters() - 1), 0.19, -0.05]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#111" /></mesh>
      ))}
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[x - 0.6, 0, -0.05]}>
        <cylinderGeometry args={[0.2, 0.2, 0.9, 12]} /><meshStandardMaterial color="#b08d3c" metalness={0.9} roughness={0.3} />
      </mesh>
      {(wl.step === 'pumpdown' || wl.step === 'stuck' || wl.step === 'freeing' || wl.step === 'setplug') && (
        <group position={[x, 0, 0]}><PlugSetting progress={wl.step === 'setplug' ? wl.progress : 0} /></group>
      )}
    </group>
  );
}

// Frac ball traveling down the lateral with the fluid (sliding sleeve jobs)
export function BallInFlight({ wl, stage }) {
  if (!wl || stage === 0 || (wl.step !== 'launch' && wl.step !== 'pumpdown')) return null;
  const target = sleeveX(stage) - 0.25;
  const x = wl.step === 'launch' ? LATERAL.heelX - 1.5 : LATERAL.heelX + (target - LATERAL.heelX) * wl.progress;
  return (
    <mesh position={[x, 0, -0.02]} name="DT-FRACSLEEVE-BALL"><sphereGeometry args={[0.27, 14, 14]} /><meshStandardMaterial color="#e8e8e8" metalness={0.3} roughness={0.35} /></mesh>
  );
}

// Coiled tubing with a motor and mill at the end. While milling, cuttings (composite flakes and slip fragments)
// tumble heel-ward in the annular return flow, riding the low side with a slow spiral, and the mill throws sparks.
export function CoiledTubing({ ct, stages, sleeve = false }) {
  const mill = useRef();
  const debris = useRef();
  const sparks = useRef();
  const cnt = 160, nSparks = 48;
  const seeds = useMemo(() => Array.from({ length: cnt }, (_, i) => ({ u: Math.random(), a: Math.random() * Math.PI * 2, r: 0.15 + Math.random() * 0.25, w: 1.5 + Math.random() * 2, big: i % 7 === 0, rot: Math.random() * 6 })), []);
  const sparkSeeds = useMemo(() => Array.from({ length: nSparks }, () => ({ u: Math.random(), a: Math.random() * Math.PI * 2, v: 0.6 + Math.random() * 0.9 })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tipX = LATERAL.heelX + (LATERAL.toeX - LATERAL.heelX) * ct.progress;
  useFrame((state, dt) => {
    if (mill.current) mill.current.rotation.x += dt * (ct.milling > 0 ? 25 : 6);
    const active = ct.milling > 0;
    const tm = state.clock.elapsedTime;
    if (debris.current) {
      for (let i = 0; i < cnt; i++) {
        const s = seeds[i];
        if (active) { s.u += dt * (0.25 + 0.15 * (i % 4) / 4); if (s.u > 1) s.u -= 1; }
        const x = tipX - (tipX - LATERAL.heelX) * s.u;
        const ang = s.a + tm * s.w;
        const r = s.r * (1 - 0.6 * s.u);                                  // cuttings settle toward the low side as they travel
        dummy.position.set(x, -0.42 + r * (0.5 + 0.5 * Math.cos(ang)) + 0.05, -Math.abs(Math.sin(ang)) * r * 0.8 - 0.05);
        dummy.rotation.set(s.rot + tm * s.w, s.rot, 0);
        const sc = active ? (s.big ? 1.8 : 1) : 0.0001;
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        debris.current.setMatrixAt(i, dummy.matrix);
      }
      debris.current.instanceMatrix.needsUpdate = true;
    }
    if (sparks.current) {
      for (let i = 0; i < nSparks; i++) {
        const s = sparkSeeds[i];
        if (active) { s.u += dt * s.v * 2.2; if (s.u > 1) { s.u -= 1; s.a = Math.random() * Math.PI * 2; } }
        const k = s.u;
        dummy.position.set(tipX + 0.35 - k * 1.4, Math.cos(s.a) * (0.2 + k * 0.25) * 1.0 - k * k * 0.5, -Math.abs(Math.sin(s.a)) * (0.2 + k * 0.25) - 0.04);
        dummy.rotation.set(0, 0, 0);
        const sc = active ? (1 - k) * 1.2 : 0.0001;
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        sparks.current.setMatrixAt(i, dummy.matrix);
      }
      sparks.current.instanceMatrix.needsUpdate = true;
    }
  });
  if (ct.progress <= 0.001) return null;
  const targetX = ct.atPlug >= 0 ? (sleeve ? sleeveX(ct.atPlug) : plugX(ct.atPlug)) : 0;
  return (
    <group name="CT-DOWNHOLE">
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[(LATERAL.heelX + tipX) / 2, 0.04, -0.04]}>
        <cylinderGeometry args={[0.07, 0.07, Math.max(0.01, tipX - LATERAL.heelX), 10]} />
        <meshStandardMaterial color="#8b939c" metalness={0.85} roughness={0.35} />
      </mesh>
      <group position={[tipX - 1.6, 0.04, -0.04]} name="CT-BHA">
        <mesh castShadow rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.16, 0.16, 1.6, 12]} /><meshStandardMaterial color="#3b3f45" metalness={0.8} roughness={0.4} /></mesh>
        <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[1.1, 0, 0]}><cylinderGeometry args={[0.19, 0.19, 0.6, 12]} /><meshStandardMaterial color="#b08d3c" metalness={0.9} roughness={0.3} /></mesh>
      </group>
      <mesh ref={mill} rotation={[0, 0, -Math.PI / 2]} position={[tipX + 0.15, 0.04, -0.04]} name="CT-MILL">
        <coneGeometry args={[0.3, 0.5, 6]} />
        <meshStandardMaterial color="#c0c4c9" metalness={0.9} roughness={0.25} />
      </mesh>
      {ct.atPlug >= 0 && stages[ct.atPlug] && !stages[ct.atPlug].plugMilled && (
        <mesh castShadow position={[targetX, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1 - ct.milling * 0.98, 1]}>
          <cylinderGeometry args={[0.43, 0.43, sleeve ? 0.5 : 1.1, 16]} />
          <meshStandardMaterial color="#ff8a00" emissive="#ff5a00" emissiveIntensity={ct.milling > 0 ? 1.2 : 0} transparent opacity={0.9} />
        </mesh>
      )}
      <instancedMesh ref={debris} args={[null, null, cnt]} frustumCulled={false}>
        <boxGeometry args={[0.07, 0.02, 0.05]} />
        <meshStandardMaterial color="#6b4520" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={sparks} args={[null, null, nSparks]} frustumCulled={false}>
        <sphereGeometry args={[0.03, 5, 5]} />
        <meshBasicMaterial color="#ffb347" />
      </instancedMesh>
    </group>
  );
}

// Cuttings bed: what settles on the low side of the lateral after each plug is milled, from the heel out to the
// toe-most milled plug; flowback cleans it up (the bed shortens and thins with the cleanup fraction).
export function CuttingsBed({ stages, cleanup = 0, sleeve = false }) {
  const milled = stages.filter(x => x.plugMilled);
  if (milled.length === 0 || cleanup >= 0.98) return null;
  const toeMost = Math.min(...milled.map(x => x.index));
  const xEnd = sleeve ? sleeveX(toeMost) : plugX(toeMost);
  const len = Math.max(0.1, (xEnd - LATERAL.heelX) * (1 - cleanup));
  const h = 0.09 * (1 - 0.7 * cleanup);
  return (
    <mesh position={[LATERAL.heelX + len / 2, -LATERAL.casingR + h / 2 + 0.01, -0.12]} receiveShadow>
      <boxGeometry args={[len, h, 0.5]} />
      <meshStandardMaterial color="#5a3d1e" roughness={1} />
    </mesh>
  );
}

// Flowback: produced fluid comes out of every perforated cluster into the wellbore and runs to the heel. Early
// in the cleanup the near-wellbore sand comes back with it (tan grains among the blue water); as the cleanup
// fraction rises the returns run clean. Speed follows the choke.
export function FlowbackFlow({ active, choke = 0.35, cleanup = 0, stages, sleeve = false }) {
  const cnt = 320;
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorA = useMemo(() => new THREE.Color('#3aa7ff'), []);
  const colorB = useMemo(() => new THREE.Color('#c9a56a'), []);
  const sources = useMemo(() => {
    const out = [];
    stages.forEach(st => {
      if (!st.perforated) return;
      if (sleeve) out.push(sleeveX(st.index));
      else for (let c = 0; c < st.clustersFired; c++) out.push(clusterX(st.index, c));
    });
    return out.length ? out : [LATERAL.toeX - 1];
  }, [stages, sleeve]);
  const seeds = useMemo(() => Array.from({ length: cnt }, (_, i) => ({ u: Math.random(), src: i % sources.length, a: Math.random() * Math.PI * 2, r: 0.1 + Math.random() * 0.3, sand: Math.random() })), [sources]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const speed = active ? 0.04 + choke * 0.22 : 0;
    for (let i = 0; i < cnt; i++) {
      const s = seeds[i];
      s.u += speed * dt * (0.7 + 0.6 * (i % 5) / 5);
      if (s.u > 1) { s.u -= 1; s.src = Math.floor(Math.random() * sources.length); }
      const sx = sources[s.src] ?? sources[0];
      let x, y, z;
      if (s.u < 0.15) {                                                  // out of the fracture into the bore
        const k = 1 - s.u / 0.15;
        x = sx + (s.a - Math.PI) * 0.03;
        y = Math.max(-2.6, Math.min(2.6, Math.cos(s.a) * (0.4 + k * 2.2)));
        z = -Math.abs(Math.sin(s.a)) * (0.4 + k * 1.6) * 0.3;
      } else {                                                           // along the lateral to the heel
        const k = (s.u - 0.15) / 0.85;
        x = sx - (sx - LATERAL.heelX + 0.8) * k;
        y = Math.cos(s.a) * s.r;
        z = -Math.abs(Math.sin(s.a) * s.r);
      }
      const isSand = s.sand < 0.45 * (1 - cleanup);
      dummy.position.set(x, y, z);
      const sc = active ? (isSand ? 0.8 : 1) : 0.0001;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
      ref.current.setColorAt(i, isSand ? colorB : colorA);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, cnt]} frustumCulled={false}>
      <sphereGeometry args={[0.055, 6, 6]} />
      <meshStandardMaterial color="#ffffff" emissive="#8fb8e8" emissiveIntensity={0.45} roughness={0.3} metalness={0} />
    </instancedMesh>
  );
}

// Dissolving plug or ball: shrinks and fades at its position while the phase runs
export function Dissolving({ ct, stages, sleeve }) {
  if (ct.atPlug < 0 || !stages[ct.atPlug] || stages[ct.atPlug].plugMilled || ct.milling <= 0) return null;
  const x = sleeve ? sleeveX(ct.atPlug) - 0.22 : plugX(ct.atPlug);
  const k = 1 - ct.milling;
  return (
    <mesh position={[x, 0, 0]} scale={[k, k, k]}>
      <sphereGeometry args={[0.55, 14, 14]} />
      <meshStandardMaterial color="#9fd0ff" emissive="#5aa9e6" emissiveIntensity={0.8} transparent opacity={0.35} />
    </mesh>
  );
}


// Production string in the lateral once the well is on production: tubing from the heel with the lift equipment
// at its tail (rod pump, ESP, gas lift mandrels, or a plunger and bumper spring), and produced fluid moving to the heel.
export function ProductionString({ lift = 'flow', active = true }) {
  const rod = useRef(); const plunger = useRef(); const flow = useRef();
  const tailX = LATERAL.heelX + (LATERAL.toeX - LATERAL.heelX) * 0.42;
  const cnt = 160;
  const seeds = useMemo(() => Array.from({ length: cnt }, () => ({ u: Math.random(), r: Math.random() * 0.35, a: Math.random() * Math.PI * 2 })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state, dt) => {
    const tm = state.clock.elapsedTime;
    if (rod.current) rod.current.position.x = tailX - 1.4 + 0.5 * Math.sin(tm * 1.2);
    if (plunger.current) { const k = (Math.sin(tm * 0.35) + 1) / 2; plunger.current.position.x = tailX - 1.0 - (tailX - 1.0 - LATERAL.heelX - 0.5) * k; }
    if (!flow.current) return;
    for (let i = 0; i < cnt; i++) {
      const s = seeds[i];
      if (active) { s.u += dt * 0.08 * (0.7 + 0.6 * (i % 3) / 3); if (s.u > 1) s.u -= 1; }
      const x = LATERAL.toeX - (LATERAL.toeX - LATERAL.heelX) * s.u;
      dummy.position.set(x, Math.cos(s.a) * s.r, -Math.abs(Math.sin(s.a) * s.r));
      dummy.scale.setScalar(active ? 1 : 0.0001); dummy.updateMatrix(); flow.current.setMatrixAt(i, dummy.matrix);
    }
    flow.current.instanceMatrix.needsUpdate = true;
  });
  const tubeR = 0.16;
  return (
    <group name="UC-TUBING">
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[(LATERAL.heelX + tailX) / 2, 0.02, -0.05]}>
        <cylinderGeometry args={[tubeR, tubeR, tailX - LATERAL.heelX, 12]} />
        <meshStandardMaterial color="#9aa3ac" metalness={0.85} roughness={0.35} />
      </mesh>
      {lift === 'rodpump' && (
        <group name="AL-RODPUMP">
          <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[tailX - 1.2, 0.02, -0.05]}><cylinderGeometry args={[tubeR + 0.05, tubeR + 0.05, 2.6, 12]} /><meshStandardMaterial color="#6d757d" metalness={0.85} roughness={0.35} /></mesh>
          <mesh ref={rod} rotation={[0, 0, Math.PI / 2]} position={[tailX - 1.4, 0.02, -0.05]}><cylinderGeometry args={[0.05, 0.05, 6.0, 8]} /><meshStandardMaterial color="#e8e8e8" metalness={0.6} roughness={0.3} /></mesh>
          <mesh castShadow position={[tailX + 0.2, 0.02, -0.05]}><sphereGeometry args={[0.12, 10, 10]} /><meshStandardMaterial color="#d8d8d8" /></mesh>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[tailX + 1.4, 0.02, -0.05]}><cylinderGeometry args={[tubeR, tubeR, 2.2, 10]} /><meshStandardMaterial color="#5b6168" metalness={0.8} roughness={0.4} /></mesh>
        </group>
      )}
      {lift === 'esp' && (
        <group name="AL-ESP">
          {[[0.0, 2.2, '#3b3f45'], [2.4, 0.9, '#7d8590'], [3.6, 1.4, '#2a5d9f'], [5.6, 2.6, '#8b939c']].map(([dx, len, color], i) => (
            <mesh castShadow key={i} rotation={[0, 0, Math.PI / 2]} position={[tailX + dx + len / 2 - 3.0, 0.02, -0.05]}><cylinderGeometry args={[tubeR + 0.08, tubeR + 0.08, len, 12]} /><meshStandardMaterial color={color} metalness={0.8} roughness={0.4} /></mesh>
          ))}
          <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[(LATERAL.heelX + tailX) / 2, tubeR + 0.08, -0.05]}><cylinderGeometry args={[0.03, 0.03, tailX - LATERAL.heelX, 6]} /><meshStandardMaterial color="#111" /></mesh>
        </group>
      )}
      {lift === 'gaslift' && (
        <group name="AL-GASLIFT">
          {[0.2, 0.45, 0.7].map((f, i) => (
            <mesh castShadow key={i} rotation={[0, 0, Math.PI / 2]} position={[LATERAL.heelX + (tailX - LATERAL.heelX) * f, 0.02, -0.05]}><cylinderGeometry args={[tubeR + 0.09, tubeR + 0.09, 0.9, 12]} /><meshStandardMaterial color="#b08d3c" metalness={0.8} roughness={0.35} /></mesh>
          ))}
        </group>
      )}
      {lift === 'plunger' && (
        <group name="AL-PLUNGERLIFT">
          <mesh ref={plunger} rotation={[0, 0, Math.PI / 2]} position={[tailX - 1.0, 0.02, -0.05]}><cylinderGeometry args={[tubeR - 0.03, tubeR - 0.03, 0.7, 10]} /><meshStandardMaterial color="#e0b15a" metalness={0.7} roughness={0.35} /></mesh>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[tailX - 0.3, 0.02, -0.05]}><cylinderGeometry args={[tubeR - 0.04, tubeR - 0.04, 0.5, 8]} /><meshStandardMaterial color="#444" wireframe /></mesh>
        </group>
      )}
      <instancedMesh ref={flow} args={[null, null, cnt]} frustumCulled={false}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshStandardMaterial color="#3a2a12" emissive="#5a3a10" emissiveIntensity={0.5} />
      </instancedMesh>
    </group>
  );
}

export function HeelMarker() {
  return (
    <group position={[LATERAL.heelX - 0.5, 0, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.45, 0.45, 1.0, 20, 1, true, Math.PI, Math.PI]} /><meshStandardMaterial color="#6d757d" side={THREE.DoubleSide} /></mesh>
      <Label position={[0, 1.2, 0]} text={'Heel: to surface'} />
    </group>
  );
}
