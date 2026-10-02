// Light vehicles. A generic three-quarter-ton crew-cab pickup with the proportions of a modern North American
// work truck (6.4 m long, 2.0 m wide, 2.0 m tall, four doors, 2 m bed, tow mirrors), white, with no badge, grille
// signature, or livery: the shape is the type, not a make. Rounded sheet metal, glass, black trim, chrome bumpers.
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Merged, MAT, GEO, metal , Instanced } from './primitives.jsx';
import { BlobShadow } from './lighting.jsx';

const CHROME = metal('#d9dde2', 1.0, 0.15);
const TRIM = { color: '#15171a', metalness: 0.2, roughness: 0.7 };
const LAMP = { color: '#fff7df', metalness: 0.1, roughness: 0.2 };

// `wheelRefs` receives the four wheel groups so a mover can spin them. x forward, bed at -x.
export function PickupTruck({ paint = MAT.paintWhite, wheelRefs = null, shadow = true, lights = false }) {
  const refs = useRef([]);
  const W = 2.0, FLOOR = 0.42;
  return (
    <group>
      {shadow && <BlobShadow size={[7.4, 3.2]} />}
      {/* sheet metal: hood, cowl and cab, roof, bed sides and tailgate, rear fender flares */}
      <Merged mat={paint} parts={() => [
        { g: GEO.rbox(1.75, 0.62, W - 0.1, 0.12), p: [2.35, FLOOR + 0.95, 0] },                 // hood and front fenders
        { g: GEO.rbox(2.1, 0.75, W, 0.1), p: [0.45, FLOOR + 0.82, 0] },                          // cab lower body, four doors
        { g: GEO.rbox(2.0, 0.78, W - 0.22, 0.14), p: [0.4, FLOOR + 1.55, 0] },                   // cab upper body (pillars and roof)
        { g: GEO.rbox(2.05, 0.74, W, 0.08), p: [-1.7, FLOOR + 0.8, 0] },                         // bed sides and front wall
        { g: GEO.box(0.06, 0.6, W - 0.1), p: [-2.72, FLOOR + 0.85, 0] },                          // tailgate
        { g: GEO.rbox(0.9, 0.3, 0.2, 0.08), p: [-1.75, FLOOR + 0.5, W / 2 + 0.02] }, { g: GEO.rbox(0.9, 0.3, 0.2, 0.08), p: [-1.75, FLOOR + 0.5, -W / 2 - 0.02] },   // rear flares
      ]} />
      {/* glass: windshield, side glass, rear window */}
      <Merged mat={MAT.glass} shadow={false} parts={() => [
        { g: GEO.box(0.06, 0.62, W - 0.5), p: [1.36, FLOOR + 1.6, 0], r: [0, 0, -0.42] },
        { g: GEO.box(1.8, 0.5, 0.02), p: [0.4, FLOOR + 1.58, W / 2 - 0.095] }, { g: GEO.box(1.8, 0.5, 0.02), p: [0.4, FLOOR + 1.58, -W / 2 + 0.095] },   // just proud of the door skin
        { g: GEO.box(0.04, 0.5, W - 0.6), p: [-0.58, FLOOR + 1.58, 0] },
      ]} />
      {/* trim: bed floor, grille, bumper fascia, door handles, mirrors, running boards, wheel wells */}
      <Merged mat={TRIM} shadow={false} parts={() => [
        { g: GEO.box(2.0, 0.08, W - 0.2), p: [-1.7, FLOOR + 0.48, 0] },
        { g: GEO.box(0.06, 0.5, 1.3), p: [3.24, FLOOR + 0.75, 0] },                               // grille opening, plain mesh
        { g: GEO.box(0.5, 0.12, 0.3), p: [0.95, FLOOR + 1.7, W / 2 + 0.22] }, { g: GEO.box(0.5, 0.12, 0.3), p: [0.95, FLOOR + 1.7, -W / 2 - 0.22] },   // tow mirror heads
        { g: GEO.box(0.08, 0.3, 0.2), p: [0.95, FLOOR + 1.5, W / 2 + 0.2] }, { g: GEO.box(0.08, 0.3, 0.2), p: [0.95, FLOOR + 1.5, -W / 2 - 0.2] },
        { g: GEO.box(1.9, 0.08, 0.25), p: [0.45, FLOOR + 0.25, W / 2 + 0.1] }, { g: GEO.box(1.9, 0.08, 0.25), p: [0.45, FLOOR + 0.25, -W / 2 - 0.1] },   // running boards
        { g: GEO.box(0.5, 0.35, 0.3), p: [1.0, FLOOR + 1.6, W / 2 - 0.1] },                      // B pillar
      ]} />
      <Merged mat={CHROME} shadow={false} parts={() => [
        { g: GEO.rbox(0.25, 0.3, W + 0.1, 0.06), p: [3.25, FLOOR + 0.35, 0] },                    // front bumper
        { g: GEO.rbox(0.22, 0.26, W + 0.05, 0.05), p: [-2.85, FLOOR + 0.35, 0] },                 // rear bumper
        { g: GEO.box(0.04, 0.06, 1.2), p: [3.28, FLOOR + 1.02, 0] },                              // hood lip
      ]} />
      <Merged mat={LAMP} shadow={false} parts={() => [[1, 1], [1, -1]].map(([, sz]) => ({ g: GEO.box(0.04, 0.22, 0.42), p: [3.24, FLOOR + 1.0, sz * 0.72] }))} />
      <Merged mat={{ color: '#b0121b', metalness: 0.2, roughness: 0.4 }} shadow={false} parts={() => [[1], [-1]].map(([sz]) => ({ g: GEO.box(0.04, 0.5, 0.14), p: [-2.76, FLOOR + 0.9, sz * 0.9] }))} />
      {lights && <mesh position={[-1.75, FLOOR + 1.75, 0]}><boxGeometry args={[0.3, 0.22, 0.4]} /><meshStandardMaterial color="#ffb020" emissive="#ffb020" emissiveIntensity={1.4} /></mesh>}
      {/* axles and wheels */}
      <Merged mat={MAT.chassis} shadow={false} parts={() => [{ g: GEO.cyl(0.07, W - 0.3, 8), p: [2.0, FLOOR, 0], r: [Math.PI / 2, 0, 0] }, { g: GEO.cyl(0.09, W - 0.3, 8), p: [-1.95, FLOOR, 0], r: [Math.PI / 2, 0, 0] }, { g: GEO.box(4.6, 0.12, 0.7), p: [0, FLOOR + 0.1, 0] }]} />
      {[[2.0, W / 2 - 0.1], [2.0, -W / 2 + 0.1], [-1.95, W / 2 - 0.1], [-1.95, -W / 2 + 0.1]].map(([x, z], k) => (
        <group key={k} ref={el => { refs.current[k] = el; if (wheelRefs) wheelRefs.current[k] = el; }} position={[x, FLOOR, z]}>
          <Merged mat={MAT.tire} parts={() => [{ g: GEO.cyl(0.42, 0.3, 20), r: [Math.PI / 2, 0, 0] }]} />
          <Merged mat={MAT.alu} shadow={false} parts={() => [{ g: GEO.cyl(0.26, 0.32, 12), r: [Math.PI / 2, 0, 0] }, { g: GEO.cyl(0.09, 0.4, 8), r: [Math.PI / 2, 0, 0] }]} />
        </group>
      ))}
    </group>
  );
}

// Trucks parked in a row, nose to the same side.
export function ParkedPickups({ position, count = 6 }) {
  const transforms = useMemo(() => Array.from({ length: count }, (_, i) => ({ position: [0, 0, i * 3.2] })), [count]);
  return (
    <group position={position} name="LG-PICKUPS">
      <Instanced transforms={transforms} name="LG-PICKUPS"><PickupTruck /></Instanced>
    </group>
  );
}

// The crew truck on the lease road: out to the edge of the terrain and back, on the road surface, with a light bar.
export function RoadTruck({ road, speed = 6, height = () => 0 }) {
  const ref = useRef(); const wheels = useRef([]);
  useFrame((state, dt) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed;
    const span = road.x1 - road.x0;
    const u = t % (2 * span); const out = u < span; const x = out ? road.x0 + u : road.x1 - (u - span);
    const z = road.z + (out ? 1.6 : -1.6);
    ref.current.position.set(x, height(x, z), z);
    ref.current.rotation.y = out ? 0 : Math.PI;
    wheels.current.forEach(wh => { if (wh) wh.rotation.z -= dt * speed / 0.42; });
  });
  return <group ref={ref}><PickupTruck wheelRefs={wheels} lights /></group>;
}
