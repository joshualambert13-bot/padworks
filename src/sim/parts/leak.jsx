// Treating iron leak (Drop 74): a hammer union seal on the high-pressure line lets go. The spray is one line-segment
// mesh (420 droplets in a fan from the seal, thrown by the line pressure and bent by gravity, recycled at the end
// of their flight) and a wet patch on the ground that spreads while the leak runs. The fan's reach and the number
// of droplets drawn follow the line pressure read from the store each frame, so the spray dies down as the line
// is bled and stops when it reads zero; nothing is drawn once the joint is swapped. Two draw calls while it runs.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSim } from '../store.js';

const N = 420;
export function IronLeak({ position = [0, 0.9, 0], maxPsi = 10000 }) {
  const on = useSim(st => st.events.ironLeak);
  const ref = useRef(), patch = useRef();
  const geom = useMemo(() => {
    const pos = new Float32Array(N * 6), vel = new Float32Array(N * 3), age = new Float32Array(N);
    for (let i = 0; i < N; i++) age[i] = Math.random() * 0.7;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.userData = { vel, age, started: new Uint8Array(N) };
    return g;
  }, []);
  const wet = useRef(0);
  useEffect(() => { wet.current = 0; }, [on]);
  useFrame((_, dt) => {
    const seg = ref.current; if (!seg) return;
    const st = useSim.getState(); const k = Math.max(0, Math.min(1, st.events.linePsi / maxPsi));
    const step = Math.min(dt, 0.1);
    const a = geom.attributes.position, { vel, age, started } = geom.userData;
    const speed = 4 + 14 * Math.sqrt(k);                  // a few m/s at a few hundred psi, a hard jet at treating pressure
    const count = Math.round(N * Math.min(1, 0.15 + k)); // fewer droplets as the line comes down
    for (let i = 0; i < count; i++) {
      age[i] += step;
      if (!started[i] || age[i] > 0.7) {
        // out of the seal gap: mostly sideways (-z, the open side of the line) and up, spread into a fan
        const ang = (Math.random() - 0.5) * 1.1, tilt = 0.25 + Math.random() * 0.55, sp = speed * (0.7 + Math.random() * 0.5);
        vel[i * 3] = Math.sin(ang) * sp * Math.cos(tilt); vel[i * 3 + 1] = Math.sin(tilt) * sp; vel[i * 3 + 2] = -Math.cos(ang) * sp * Math.cos(tilt);
        a.setXYZ(i * 2, 0, 0, 0); age[i] = 0; started[i] = 1;
      }
      vel[i * 3 + 1] -= 9.8 * step;
      const x = a.getX(i * 2) + vel[i * 3] * step, y = Math.max(-position[1], a.getY(i * 2) + vel[i * 3 + 1] * step), z = a.getZ(i * 2) + vel[i * 3 + 2] * step;
      a.setXYZ(i * 2, x, y, z);
      a.setXYZ(i * 2 + 1, x - vel[i * 3] * 0.02, y - vel[i * 3 + 1] * 0.02, z - vel[i * 3 + 2] * 0.02);
    }
    for (let i = count; i < N; i++) { a.setXYZ(i * 2, 0, 0, 0); a.setXYZ(i * 2 + 1, 0, 0, 0); started[i] = 0; }
    a.needsUpdate = true;
    seg.material.opacity = 0.25 + 0.45 * k;
    // the wet patch grows while there is pressure behind the leak
    wet.current = Math.min(1, wet.current + step * 0.08 * (0.3 + k));
    if (patch.current) { const r = 1.5 + 4.5 * wet.current; patch.current.scale.set(r, r * 0.7, 1); patch.current.material.opacity = 0.35 * wet.current; }
  });
  if (!on) return null;
  return (
    <group position={position}>
      <lineSegments ref={ref} geometry={geom} frustumCulled={false} renderOrder={3} raycast={() => null}>
        <lineBasicMaterial color="#e8eef4" transparent opacity={0.5} depthWrite={false} fog />
      </lineSegments>
      <mesh ref={patch} position={[0, -position[1] + 0.012, -2.2]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <circleGeometry args={[1, 24]} />
        <meshBasicMaterial color="#2a2621" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
