// Procedural downhole cut-away: formation layers, cemented casing, stages with perforation
// clusters, frac plugs, bi-wing fractures, fluid and proppant particles, wireline tool string,
// coiled tubing drillout. Simplified motion; illustrative only.
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STAGE_COUNT, CLUSTERS_PER_STAGE } from '../store.js';
import { Label } from './primitives.jsx';

export const LATERAL = { heelX: -16, toeX: 16, stageLen: 6.4, casingR: 0.5, holeR: 0.68 };
export const stageX = (i) => LATERAL.toeX - (i + 0.5) * LATERAL.stageLen;             // stage center; stage 0 at the toe
export const clusterX = (i, c) => stageX(i) + (c - (CLUSTERS_PER_STAGE - 1) / 2) * 1.6; // cluster centers
export const plugX = (i) => LATERAL.toeX - i * LATERAL.stageLen - 0.55;                // plug toe-ward of stage i perfs (between stage i and i-1)

const LAYERS = [
  { y: 3.2, h: 2.2, color: '#6b5b45' },
  { y: 1.3, h: 1.6, color: '#8a7a5a' },
  { y: 0, h: 1.0, color: '#4f5b66' },   // target: a darker shale band around the lateral
  { y: -1.3, h: 1.6, color: '#7a6b4f' },
  { y: -3.2, h: 2.2, color: '#5e5040' },
];

export function Formation() {
  return (
    <group name="FORMATION">
      {LAYERS.map((l, i) => (
        <mesh key={i} position={[0, l.y, -4]} receiveShadow>
          <boxGeometry args={[40, l.h, 8]} />
          <meshStandardMaterial color={l.color} roughness={1} metalness={0} />
        </mesh>
      ))}
      {/* faint section face grid */}
      <gridHelper args={[40, 20, '#2b2f36', '#22262c']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]} />
    </group>
  );
}

// Casing rendered as the back half of a cylinder so the interior is visible from the front (+Z).
export function Casing({ stages }) {
  const len = LATERAL.toeX - LATERAL.heelX + 2;
  return (
    <group name="CM-PRODUCTIONCASING" rotation={[0, 0, -Math.PI / 2]} position={[(LATERAL.toeX + LATERAL.heelX) / 2, 0, 0]}>
      {/* cement sheath (half) */}
      <mesh>
        <cylinderGeometry args={[LATERAL.holeR, LATERAL.holeR, len, 24, 1, true, Math.PI, Math.PI]} />
        <meshStandardMaterial color="#9a9a90" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
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

// One stage: perforation clusters, plug, fractures, proppant points
export function Stage({ stage, isCurrent, netPsi, showLabels }) {
  const color = useMemo(() => fracColor(isCurrent ? netPsi : 400), [isCurrent, netPsi]);
  const px = plugX(stage.index);
  return (
    <group name={'STAGE-' + (stage.index + 1)}>
      {/* perforation clusters */}
      {Array.from({ length: CLUSTERS_PER_STAGE }).map((_, c) => {
        const x = clusterX(stage.index, c);
        const fired = c < stage.clustersFired;
        return (
          <group key={c} position={[x, 0, 0]}>
            {fired && [60, 120, 240, 300].map(a => (
              <mesh key={a} rotation={[THREE.MathUtils.degToRad(a), 0, 0]} position={[0, Math.cos(THREE.MathUtils.degToRad(a)) * 1.0, -Math.sin(THREE.MathUtils.degToRad(a)) * 1.0]}>
                <cylinderGeometry args={[0.03, 0.08, 1.3, 6]} />
                <meshStandardMaterial color="#111" roughness={1} />
              </mesh>
            ))}
            {fired && stage.fracExtent > 0 && (
              <group>
                <mesh rotation={[0, Math.PI / 2, 0]} scale={[1, 0.55, 1]}>
                  <circleGeometry args={[7 * stage.fracExtent, 40]} />
                  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
                </mesh>
                <Proppant extent={stage.fracExtent} fill={stage.proppantFill} />
              </group>
            )}
          </group>
        );
      })}
      {/* frac plug toe-ward of this stage's perfs */}
      {stage.plugSet && !stage.plugMilled && (
        <group position={[px, 0, 0]} name={'DT-FRACPLUG-' + (stage.index + 1)}>
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.42, 0.42, 1.1, 16]} /><meshStandardMaterial color="#2f2f2f" roughness={0.8} /></mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0.4, 0, 0]}><cylinderGeometry args={[0.47, 0.36, 0.25, 16]} /><meshStandardMaterial color="#7a4a1e" roughness={0.9} /></mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.4, 0, 0]}><cylinderGeometry args={[0.36, 0.47, 0.25, 16]} /><meshStandardMaterial color="#7a4a1e" roughness={0.9} /></mesh>
          <mesh position={[-0.75, 0, 0]}><sphereGeometry args={[0.22, 12, 12]} /><meshStandardMaterial color="#d8d8d8" metalness={0.3} roughness={0.4} /></mesh>
          {showLabels && <Label position={[0, 0.9, 0]} text={`Plug ${stage.index + 1}`} />}
        </group>
      )}
      {stage.plugMilled && (
        <group position={[px, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 0.05, 16]} /><meshStandardMaterial color="#4a4a4a" transparent opacity={0.4} /></mesh>
        </group>
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
      pos[i * 3 + 1] = Math.sin(a) * r * 0.55;
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

// Fluid particles moving from the heel to the open perforations of the current stage
export function FluidFlow({ rate, currentStage, active, ppa }) {
  const count = 320;
  const ref = useRef();
  const seeds = useMemo(() => Array.from({ length: count }, () => ({ u: Math.random(), r: Math.random() * 0.4, a: Math.random() * Math.PI * 2 })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const targetX = currentStage != null ? clusterX(currentStage, 1) : LATERAL.toeX;
  useFrame((_, dt) => {
    if (!ref.current) return;
    const speed = active ? 0.02 + rate / 100 * 0.35 : 0;
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      s.u += speed * dt * (0.8 + 0.4 * (i % 5) / 5);
      if (s.u > 1) s.u -= 1;
      const x = LATERAL.heelX + (targetX - LATERAL.heelX) * s.u;
      const y = Math.cos(s.a) * s.r;
      const z = -Math.abs(Math.sin(s.a) * s.r);  // keep inside the back half of the cut-away
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
    <instancedMesh ref={ref} args={[null, null, count]} frustumCulled={false}>
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
  const gunsLen = 4.2;
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
      <mesh rotation={[0, 0, Math.PI / 2]} position={[x - 0.6, 0, -0.05]}>
        <cylinderGeometry args={[0.2, 0.2, 0.9, 12]} /><meshStandardMaterial color="#b08d3c" metalness={0.9} roughness={0.3} />
      </mesh>
      {(wl.step === 'pumpdown' || wl.step === 'setplug') && (
        <group position={[x, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.38, 0.38, 1.1, 16]} /><meshStandardMaterial color="#2f2f2f" roughness={0.8} /></mesh>
        </group>
      )}
    </group>
  );
}

// Coiled tubing with a mill at the end; debris particles when milling
export function CoiledTubing({ ct, stages }) {
  const mill = useRef();
  const debris = useRef();
  const count = 80;
  const seeds = useMemo(() => Array.from({ length: count }, () => ({ u: Math.random(), y: (Math.random() - 0.5) * 0.4, z: -Math.random() * 0.3 })), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tipX = LATERAL.heelX + (LATERAL.toeX - LATERAL.heelX) * ct.progress;
  useFrame((_, dt) => {
    if (mill.current) mill.current.rotation.x += dt * (ct.milling > 0 ? 25 : 6);
    if (!debris.current) return;
    const active = ct.milling > 0;
    for (let i = 0; i < count; i++) {
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
  return (
    <group name="CT-DOWNHOLE">
      <mesh rotation={[0, 0, Math.PI / 2]} position={[(LATERAL.heelX + tipX) / 2, 0.04, -0.04]}>
        <cylinderGeometry args={[0.07, 0.07, Math.max(0.01, tipX - LATERAL.heelX), 10]} />
        <meshStandardMaterial color="#8b939c" metalness={0.85} roughness={0.35} />
      </mesh>
      <group position={[tipX - 0.9, 0.04, -0.04]}>
        <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.16, 0.16, 1.6, 12]} /><meshStandardMaterial color="#3b3f45" metalness={0.8} roughness={0.4} /></mesh>
      </group>
      <mesh ref={mill} rotation={[0, 0, -Math.PI / 2]} position={[tipX + 0.15, 0.04, -0.04]} name="CT-MILL">
        <coneGeometry args={[0.28, 0.5, 6]} />
        <meshStandardMaterial color="#c0c4c9" metalness={0.9} roughness={0.25} />
      </mesh>
      {ct.atPlug >= 0 && stages[ct.atPlug] && !stages[ct.atPlug].plugMilled && (
        <mesh position={[plugX(ct.atPlug), 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1 - ct.milling * 0.98, 1]}>
          <cylinderGeometry args={[0.43, 0.43, 1.1, 16]} />
          <meshStandardMaterial color="#ff8a00" emissive="#ff5a00" emissiveIntensity={ct.milling > 0 ? 1.2 : 0} transparent opacity={0.9} />
        </mesh>
      )}
      <instancedMesh ref={debris} args={[null, null, count]} frustumCulled={false}>
        <boxGeometry args={[0.07, 0.05, 0.05]} />
        <meshStandardMaterial color="#7a4a1e" />
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
