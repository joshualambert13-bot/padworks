// Procedural downhole cut-away: layered formation, cemented casing (or openhole liner with packers), stages with
// perforation clusters or frac sleeves, plugs or balls on seats, bi-wing fractures with branches and proppant,
// fluid particles, wireline tool string, coiled tubing mill-out. Simplified motion; illustrative only.
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSim } from '../store.js';
import { Label } from './primitives.jsx';

export const LATERAL = { heelX: -16, toeX: 16, casingR: 0.5, holeR: 0.68 };
const count = () => useSim.getState().stages.length;
const clusters = () => useSim.getState().setup.clusters;
export const stageLen = () => (LATERAL.toeX - LATERAL.heelX) / count();
export const stageX = (i) => LATERAL.toeX - (i + 0.5) * stageLen();                       // stage center; stage 0 at the toe
export const clusterX = (i, c) => { const n = clusters(); const span = stageLen() * 0.62; return stageX(i) + (n === 1 ? 0 : (c - (n - 1) / 2) * (span / (n - 1))); };
export const plugX = (i) => LATERAL.toeX - i * stageLen() - 0.45;                          // plug toe-ward of stage i perfs (between stage i and i-1)
export const sleeveX = (i) => stageX(i);                                                    // frac sleeve sub at the stage center

const LAYERS = [
  { y: 4.6, h: 1.4, color: '#7a6a52' },
  { y: 3.3, h: 1.2, color: '#66573f' },
  { y: 2.1, h: 1.2, color: '#8a7a5a' },
  { y: 1.05, h: 0.9, color: '#5d6a74' },
  { y: 0, h: 1.2, color: '#414c56' },   // target: a darker shale band around the lateral
  { y: -1.05, h: 0.9, color: '#5d6a74' },
  { y: -2.1, h: 1.2, color: '#7a6b4f' },
  { y: -3.3, h: 1.2, color: '#5e5040' },
  { y: -4.6, h: 1.4, color: '#4c4236' },
];

export function Formation() {
  const bedding = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ y: -5.2 + i * 0.4 + ((i * 7) % 3) * 0.05, x: ((i * 13) % 7) - 3, w: 30 + ((i * 5) % 9) })), []);
  return (
    <group name="FORMATION">
      {LAYERS.map((l, i) => (
        <mesh key={i} position={[0, l.y, -4.5]} receiveShadow>
          <boxGeometry args={[44, l.h, 9]} />
          <meshStandardMaterial color={l.color} roughness={1} metalness={0} />
        </mesh>
      ))}
      {/* bedding planes on the section face and a few natural fractures */}
      {bedding.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, 0.01]}>
          <planeGeometry args={[b.w, 0.03]} />
          <meshBasicMaterial color="#1c2027" transparent opacity={0.5} />
        </mesh>
      ))}
      {[-11, -3, 6, 13].map((x, i) => (
        <mesh key={'nf' + i} position={[x, 0.2, 0.012]} rotation={[0, 0, THREE.MathUtils.degToRad(70 + i * 9)]}>
          <planeGeometry args={[0.04, 3.2]} />
          <meshBasicMaterial color="#141820" transparent opacity={0.55} />
        </mesh>
      ))}
      <gridHelper args={[44, 22, '#2b2f36', '#22262c']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]} />
    </group>
  );
}

// Casing rendered as the back half of a cylinder so the interior is visible from the front (+Z).
// Cemented: a cement sheath fills the annulus. Openhole: a rugose borehole wall and no cement.
export function Casing({ openhole = false }) {
  const len = LATERAL.toeX - LATERAL.heelX + 2;
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
        <mesh>
          <cylinderGeometry args={[LATERAL.holeR, LATERAL.holeR, len, 24, 1, true, Math.PI, Math.PI]} />
          <meshStandardMaterial color="#9a9a90" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh>
        <cylinderGeometry args={[LATERAL.casingR, LATERAL.casingR, len, 24, 1, true, Math.PI, Math.PI]} />
        <meshStandardMaterial color="#8b939c" metalness={0.8} roughness={0.35} side={THREE.DoubleSide} />
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
function Fracture({ extent, color, seed }) {
  const scale = 7 * extent;
  const branch = [0.55, 0.4];
  return (
    <group>
      <mesh rotation={[0, Math.PI / 2, 0]} scale={[1, 0.5, 1]}>
        <circleGeometry args={[scale, 44]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {branch.map((b, i) => (
        <mesh key={i} rotation={[0, Math.PI / 2 + (i ? -0.32 : 0.28) * (seed % 2 ? 1 : -1), 0.12 * (i ? -1 : 1)]} scale={[1, 0.42, 1]} position={[0.15 * (i ? -1 : 1), 0, 0]}>
          <circleGeometry args={[scale * b, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
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
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[LATERAL.holeR - 0.02, LATERAL.holeR - 0.02, 1.4, 24, 1, true, Math.PI, Math.PI]} />
        <meshStandardMaterial color="#2b2622" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      {[-0.8, 0.8].map((dx, i) => (
        <mesh key={i} rotation={[0, 0, Math.PI / 2]} position={[dx, 0, 0]}>
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
    <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 0.05, 16]} /><meshStandardMaterial color="#4a4a4a" transparent opacity={0.4} /></mesh>
  );
  return (
    <group name={'DT-FRACPLUG-' + (index + 1)}>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 1.3, 16]} /><meshStandardMaterial color="#2f2f2f" roughness={0.8} /></mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.02, 0, 0]}><cylinderGeometry args={[0.44, 0.44, 0.3, 16]} /><meshStandardMaterial color="#1a1a1a" roughness={0.95} /></mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.28, 0, 0]}><cylinderGeometry args={[0.44, 0.33, 0.22, 16]} /><meshStandardMaterial color="#6a4a2e" roughness={0.9} /></mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.24, 0, 0]}><cylinderGeometry args={[0.33, 0.44, 0.22, 16]} /><meshStandardMaterial color="#6a4a2e" roughness={0.9} /></mesh>
      {[0.5, -0.46].map((x, k) => (
        <group key={k} position={[x, 0, 0]}>
          {[0, 60, 120, 180, 240, 300].map(a => {
            const rad = THREE.MathUtils.degToRad(a);
            return <mesh key={a} position={[0, Math.cos(rad) * 0.4, Math.sin(rad) * 0.4]} rotation={[rad, 0, 0]}><boxGeometry args={[0.18, 0.1, 0.16]} /><meshStandardMaterial color="#8a8f95" metalness={0.8} roughness={0.4} /></mesh>;
          })}
        </group>
      ))}
      <mesh position={[-0.78, 0, 0]}><sphereGeometry args={[0.2, 12, 12]} /><meshStandardMaterial color="#d8d8d8" metalness={0.3} roughness={0.4} /></mesh>
      {showLabels && <Label position={[0, 0.9, 0]} text={`Plug ${index + 1}`} />}
    </group>
  );
}

// One stage: perforation clusters or sleeve, plug or ball, fractures, proppant points
export function Stage({ stage, isCurrent, netPsi, showLabels, sleeve, openhole }) {
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
              <Fracture extent={stage.fracExtent * (1 - 0.12 * c)} color={color} seed={stage.index + c} />
              <Proppant extent={stage.fracExtent * (1 - 0.12 * c)} fill={stage.proppantFill} />
            </group>
          ))}
        </group>
      ) : (
        Array.from({ length: n }).map((_, c) => {
          const x = clusterX(stage.index, c);
          const fired = c < stage.clustersFired;
          const stressShadow = 1 - 0.08 * Math.abs(c - (n - 1) / 2);
          return (
            <group key={c} position={[x, 0, 0]}>
              <PerfCluster fired={fired} />
              {fired && stage.fracExtent > 0 && (
                <group>
                  <Fracture extent={stage.fracExtent * stressShadow} color={color} seed={stage.index * 7 + c} />
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
    for (let i = 0; i < max; i++) {
      const r = Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      pos[i * 3] = (Math.random() - 0.5) * 0.08;
      pos[i * 3 + 1] = Math.sin(a) * r * 0.5;
      pos[i * 3 + 2] = Math.cos(a) * r;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const n = Math.floor(max * fill);
  geom.setDrawRange(0, n);
  return (
    <points geometry={geom} scale={[1, 7 * extent, 7 * extent]}>
      <pointsMaterial color="#e8d28a" size={0.09} sizeAttenuation />
    </points>
  );
}

// Fluid particles moving from the heel to the open perforations of the current stage, then out into the fractures
export function FluidFlow({ rate, currentStage, active, ppa }) {
  const cnt = 360;
  const ref = useRef();
  const seeds = useMemo(() => Array.from({ length: cnt }, () => ({ u: Math.random(), r: Math.random() * 0.4, a: Math.random() * Math.PI * 2, spray: Math.random() < 0.3, s: Math.random() })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const sleeve = useSim.getState().setup.completion === 'sleeve';
  const targetX = currentStage != null ? (sleeve ? sleeveX(currentStage) : clusterX(currentStage, Math.floor((clusters() - 1) / 2))) : LATERAL.toeX;
  useFrame((_, dt) => {
    if (!ref.current) return;
    const speed = active ? 0.02 + rate / 100 * 0.35 : 0;
    for (let i = 0; i < cnt; i++) {
      const s = seeds[i];
      s.u += speed * dt * (0.8 + 0.4 * (i % 5) / 5);
      if (s.u > 1) s.u -= 1;
      let x, y, z;
      if (s.spray && s.u > 0.85) {
        // leaving the wellbore through the perforations into the fracture plane
        const k = (s.u - 0.85) / 0.15;
        x = targetX + (s.s - 0.5) * 0.3;
        y = Math.cos(s.a) * (0.45 + k * 3.0);
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
      <sphereGeometry args={[0.06, 6, 6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
    </instancedMesh>
  );
}

// Perforating flash particles at a cluster when it fires
export function PerfFlash({ x, active }) {
  const ref = useRef();
  const life = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    life.current = active ? Math.min(1, life.current + dt * 3) : Math.max(0, life.current - dt * 2);
    const s = 0.2 + life.current * 1.6;
    ref.current.scale.set(s, s, s);
    ref.current.material.opacity = life.current * 0.9;
  });
  return (
    <mesh ref={ref} position={[x, 0, 0]}>
      <sphereGeometry args={[0.5, 12, 12]} />
      <meshBasicMaterial color="#ffb020" transparent opacity={0} />
    </mesh>
  );
}

// Wireline tool string: cable from the heel, setting tool, plug, guns
export function WirelineString({ wl, stage }) {
  if (!wl || wl.step === 'idle' || wl.step === 'done') return null;
  const px = plugX(stage);
  let x;
  if (wl.step === 'pumpdown') x = LATERAL.heelX + (px - LATERAL.heelX) * wl.progress;
  else if (wl.step === 'pooh') x = px - (px - LATERAL.heelX) * wl.progress;
  else x = px;
  const gunsLen = Math.min(4.2, stageLen() * 0.6);
  return (
    <group name="WL-TOOLSTRING-DOWNHOLE">
      <mesh rotation={[0, 0, Math.PI / 2]} position={[(LATERAL.heelX + x - gunsLen) / 2, 0.05, -0.05]}>
        <cylinderGeometry args={[0.012, 0.012, Math.max(0.01, x - gunsLen - LATERAL.heelX), 6]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* guns and setting tool ahead of the plug (heel side), plug at the front (toe side) */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[x - gunsLen / 2 - 0.4, 0, -0.05]}>
        <cylinderGeometry args={[0.18, 0.18, gunsLen, 12]} />
        <meshStandardMaterial color="#3b3f45" metalness={0.8} roughness={0.4} />
      </mesh>
      {Array.from({ length: clusters() }).map((_, c) => (
        <mesh key={c} position={[x - gunsLen + 0.3 + c * (gunsLen - 0.8) / Math.max(1, clusters() - 1), 0.19, -0.05]}><sphereGeometry args={[0.04, 6, 6]} /><meshStandardMaterial color="#111" /></mesh>
      ))}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[x - 0.6, 0, -0.05]}>
        <cylinderGeometry args={[0.2, 0.2, 0.9, 12]} /><meshStandardMaterial color="#b08d3c" metalness={0.9} roughness={0.3} />
      </mesh>
      {(wl.step === 'pumpdown' || wl.step === 'setplug') && (
        <group position={[x, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.36, 0.36, 1.2, 16]} /><meshStandardMaterial color="#2f2f2f" roughness={0.8} /></mesh>
        </group>
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

// Coiled tubing with a motor and mill at the end; debris particles when milling
export function CoiledTubing({ ct, stages, sleeve = false }) {
  const mill = useRef();
  const debris = useRef();
  const cnt = 80;
  const seeds = useMemo(() => Array.from({ length: cnt }, () => ({ u: Math.random(), y: (Math.random() - 0.5) * 0.4, z: -Math.random() * 0.3 })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tipX = LATERAL.heelX + (LATERAL.toeX - LATERAL.heelX) * ct.progress;
  useFrame((_, dt) => {
    if (mill.current) mill.current.rotation.x += dt * (ct.milling > 0 ? 25 : 6);
    if (!debris.current) return;
    const active = ct.milling > 0;
    for (let i = 0; i < cnt; i++) {
      const s = seeds[i];
      if (active) { s.u += dt * 0.35; if (s.u > 1) s.u -= 1; }
      const x = tipX - (tipX - LATERAL.heelX) * s.u;
      dummy.position.set(x, s.y, s.z);
      const sc = active ? 1 : 0.0001;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      debris.current.setMatrixAt(i, dummy.matrix);
    }
    debris.current.instanceMatrix.needsUpdate = true;
  });
  if (ct.progress <= 0.001) return null;
  const targetX = ct.atPlug >= 0 ? (sleeve ? sleeveX(ct.atPlug) : plugX(ct.atPlug)) : 0;
  return (
    <group name="CT-DOWNHOLE">
      <mesh rotation={[0, 0, Math.PI / 2]} position={[(LATERAL.heelX + tipX) / 2, 0.04, -0.04]}>
        <cylinderGeometry args={[0.07, 0.07, Math.max(0.01, tipX - LATERAL.heelX), 10]} />
        <meshStandardMaterial color="#8b939c" metalness={0.85} roughness={0.35} />
      </mesh>
      <group position={[tipX - 1.6, 0.04, -0.04]} name="CT-BHA">
        <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.16, 0.16, 1.6, 12]} /><meshStandardMaterial color="#3b3f45" metalness={0.8} roughness={0.4} /></mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[1.1, 0, 0]}><cylinderGeometry args={[0.19, 0.19, 0.6, 12]} /><meshStandardMaterial color="#b08d3c" metalness={0.9} roughness={0.3} /></mesh>
      </group>
      <mesh ref={mill} rotation={[0, 0, -Math.PI / 2]} position={[tipX + 0.15, 0.04, -0.04]} name="CT-MILL">
        <coneGeometry args={[0.3, 0.5, 6]} />
        <meshStandardMaterial color="#c0c4c9" metalness={0.9} roughness={0.25} />
      </mesh>
      {ct.atPlug >= 0 && stages[ct.atPlug] && !stages[ct.atPlug].plugMilled && (
        <mesh position={[targetX, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1 - ct.milling * 0.98, 1]}>
          <cylinderGeometry args={[0.43, 0.43, sleeve ? 0.5 : 1.1, 16]} />
          <meshStandardMaterial color="#ff8a00" emissive="#ff5a00" emissiveIntensity={ct.milling > 0 ? 1.2 : 0} transparent opacity={0.9} />
        </mesh>
      )}
      <instancedMesh ref={debris} args={[null, null, cnt]} frustumCulled={false}>
        <boxGeometry args={[0.07, 0.05, 0.05]} />
        <meshStandardMaterial color="#7a4a1e" />
      </instancedMesh>
    </group>
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

export function HeelMarker() {
  return (
    <group position={[LATERAL.heelX - 0.5, 0, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.45, 0.45, 1.0, 20, 1, true, Math.PI, Math.PI]} /><meshStandardMaterial color="#6d757d" side={THREE.DoubleSide} /></mesh>
      <Label position={[0, 1.2, 0]} text={'Heel: to surface'} />
    </group>
  );
}
