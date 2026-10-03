// Pad clutter (Drop 48): the small things a working pad is never without. All generic, all merged by material,
// placed by the layout from SurfaceScene. Totes on pallets at the chemical add, a rack of spare treating iron on
// timbers by the missile, cones at the red zone corners, water-filled barricades at the pump row ends, a dumpster
// and two portable toilets by the parking, a fuel cube by the pump row, a spill kit and extinguisher stands at the
// chemical add and hydration unit, coiled lay-flat hose by the water transfer.
import { useMemo } from 'react';
import { Merged, GEO, MAT, Instanced } from './primitives.jsx';
import { Stencil } from './life.jsx';

const ORANGE = { color: '#e8641b', metalness: 0, roughness: 0.6 };
const WHITE = { color: '#e9e9e9', metalness: 0, roughness: 0.6 };
const TOTE = { color: '#eef0ea', metalness: 0, roughness: 0.5 };
const CAGE = { color: '#9aa2ab', metalness: 0.7, roughness: 0.45 };
const TIMBER = { color: '#6b5533', metalness: 0, roughness: 0.95 };
const BLUE = { color: '#2d5fb5', metalness: 0.1, roughness: 0.6 };
const GREEN = { color: '#2f6f3e', metalness: 0.2, roughness: 0.6 };
const YELLOW = { color: '#e6c21a', metalness: 0.1, roughness: 0.6 };
const HOSE = { color: '#2a7fd0', metalness: 0.05, roughness: 0.8 };

// IBC tote on a pallet: the bottle, its cage, the pallet, and the valve
export function Totes({ position = [0, 0, 0], count = 6, rotation = [0, 0, 0] }) {
  const transforms = useMemo(() => Array.from({ length: count }, (_, i) => ({ position: [(i % 3) * 1.3, 0, Math.floor(i / 3) * 1.3] })), [count]);
  return (
    <group position={position} rotation={rotation} name="LG-TOTES">
      <Instanced transforms={transforms} name="LG-TOTES">
        <group>
          <Merged mat={TIMBER} parts={() => [{ g: GEO.box(1.2, 0.14, 1.0), p: [0, 0.07, 0] }]} />
          <Merged mat={TOTE} parts={() => [{ g: GEO.rbox(1.0, 1.0, 0.95, 0.06, 1), p: [0, 0.66, 0] }, { g: GEO.cyl(0.1, 0.06, 10), p: [0, 1.19, 0] }]} />
          <Merged mat={CAGE} shadow={false} parts={() => [
            ...[0.3, 0.6, 0.9].flatMap(y => [{ g: GEO.box(1.08, 0.02, 0.02), p: [0, 0.14 + y, 0.5] }, { g: GEO.box(1.08, 0.02, 0.02), p: [0, 0.14 + y, -0.5] }, { g: GEO.box(0.02, 0.02, 1.0), p: [0.54, 0.14 + y, 0] }, { g: GEO.box(0.02, 0.02, 1.0), p: [-0.54, 0.14 + y, 0] }]),
            ...[-0.54, -0.18, 0.18, 0.54].flatMap(x => [{ g: GEO.box(0.02, 1.0, 0.02), p: [x, 0.64, 0.5] }, { g: GEO.box(0.02, 1.0, 0.02), p: [x, 0.64, -0.5] }]),
            { g: GEO.cyl(0.04, 0.12, 8), p: [0, 0.26, 0.55], r: [Math.PI / 2, 0, 0] },
          ]} />
        </group>
      </Instanced>
    </group>
  );
}

// A rack of spare 3-inch treating iron on timbers: pup joints with hammer unions, two swivels, a stack of ring gaskets
export function IronRack({ position = [0, 0, 0], rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation} name="LG-IRONRACK">
      <Merged mat={TIMBER} parts={() => [-1.6, 1.6].map(x => ({ g: GEO.box(0.2, 0.2, 1.6), p: [x, 0.1, 0] }))} />
      <Merged mat={MAT.darkSteel} parts={() => [
        ...[-0.6, -0.36, -0.12, 0.12, 0.36, 0.6].map(z => ({ g: GEO.cyl(0.055, 4.0, 10), p: [0, 0.26, z], r: [0, 0, Math.PI / 2] })),
        ...[-0.48, -0.24, 0, 0.24, 0.48].map(z => ({ g: GEO.cyl(0.055, 4.0, 10), p: [0, 0.37, z], r: [0, 0, Math.PI / 2] })),
        { g: GEO.cyl(0.12, 0.5, 12), p: [-1.2, 0.6, -0.9], r: [0, 0, Math.PI / 2] }, { g: GEO.cyl(0.12, 0.5, 12), p: [-0.6, 0.6, -0.9] },
        { g: GEO.cyl(0.12, 0.5, 12), p: [1.0, 0.6, -0.9], r: [0, 0, Math.PI / 2] }, { g: GEO.cyl(0.12, 0.5, 12), p: [1.6, 0.6, -0.9] },
      ]} />
      <Merged mat={MAT.steel} shadow={false} parts={() => [
        ...[-0.6, -0.36, -0.12, 0.12, 0.36, 0.6].flatMap(z => [-1.9, 1.9].map(x => ({ g: GEO.cyl(0.085, 0.14, 10), p: [x, 0.26, z], r: [0, 0, Math.PI / 2] }))),
        ...[-0.48, -0.24, 0, 0.24, 0.48].flatMap(z => [-1.9, 1.9].map(x => ({ g: GEO.cyl(0.085, 0.14, 10), p: [x, 0.37, z], r: [0, 0, Math.PI / 2] }))),
      ]} />
    </group>
  );
}

// Traffic cones at the given [x, z] spots (one instanced mesh for the cones, one for the white bands)
export function Cones({ spots = [] }) {
  const transforms = useMemo(() => spots.map(([x, z]) => ({ position: [x, 0, z] })), [spots]);
  if (!spots.length) return null;
  return (
    <group name="LG-CONES">
      <Instanced transforms={transforms} name="LG-CONES">
        <group>
          <Merged mat={ORANGE} parts={() => [{ g: GEO.box(0.4, 0.04, 0.4), p: [0, 0.02, 0] }, { g: GEO.cyl(0.03, 0.72, 10, 0.16), p: [0, 0.38, 0] }]} />
          <Merged mat={WHITE} shadow={false} parts={() => [{ g: GEO.cyl(0.095, 0.1, 10, 0.12), p: [0, 0.5, 0] }]} />
        </group>
      </Instanced>
    </group>
  );
}

// Water-filled plastic barricades in a row along X
export function Barricades({ position = [0, 0, 0], rotation = [0, 0, 0], count = 3 }) {
  const transforms = useMemo(() => Array.from({ length: count }, (_, i) => ({ position: [i * 2.0, 0, 0] })), [count]);
  return (
    <group position={position} rotation={rotation} name="LG-BARRICADES">
      <Instanced transforms={transforms} name="LG-BARRICADES">
        <group>
          <Merged mat={ORANGE} parts={() => [{ g: GEO.rbox(1.9, 0.8, 0.45, 0.06, 1), p: [0, 0.4, 0] }, { g: GEO.box(1.95, 0.08, 0.6), p: [0, 0.04, 0] }]} />
          <Merged mat={WHITE} shadow={false} parts={() => [{ g: GEO.box(1.6, 0.14, 0.47), p: [0, 0.55, 0] }]} />
        </group>
      </Instanced>
    </group>
  );
}

// Dumpster and two portable toilets by the parking
export function Welfare({ position = [0, 0, 0], rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation} name="LG-WELFARE">
      <Merged mat={GREEN} parts={() => [{ g: GEO.box(3.0, 1.3, 1.6), p: [0, 0.75, 0] }, { g: GEO.box(3.1, 0.1, 1.7), p: [0, 1.42, 0] }, { g: GEO.box(0.08, 0.1, 1.2), p: [-1.6, 0.05, 0] }, { g: GEO.box(0.08, 0.1, 1.2), p: [1.6, 0.05, 0] }]} />
      <Merged mat={BLUE} parts={() => [3.0, 4.4].map(x => ({ g: GEO.rbox(1.1, 2.25, 1.1, 0.05, 1), p: [x, 1.14, 0] }))} />
      <Merged mat={WHITE} shadow={false} parts={() => [3.0, 4.4].flatMap(x => [{ g: GEO.box(1.14, 0.12, 1.14), p: [x, 2.3, 0] }, { g: GEO.box(0.5, 1.0, 0.02), p: [x, 1.1, 0.56] }])} />
      <Merged mat={MAT.dimSteel} shadow={false} parts={() => [3.0, 4.4].map(x => ({ g: GEO.box(0.02, 0.4, 0.02), p: [x - 0.18, 1.1, 0.58] }))} />
    </group>
  );
}

// Fuel cube (a double-wall diesel tank in a frame with a pump cabinet) for the light plants and small engines
export function FuelCube({ position = [0, 0, 0], rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation} name="LG-FUELCUBE">
      <Merged mat={MAT.paintWhite} parts={() => [{ g: GEO.rbox(2.4, 1.3, 1.4, 0.06, 1), p: [0, 0.8, 0] }]} />
      <Merged mat={MAT.chassis} parts={() => [{ g: GEO.box(2.5, 0.15, 1.5), p: [0, 0.08, 0] }, ...[-1.15, 1.15].flatMap(x => [-0.6, 0.6].map(z => ({ g: GEO.box(0.08, 1.5, 0.08), p: [x, 0.8, z] })))]} />
      <Merged mat={MAT.dimSteel} shadow={false} parts={() => [{ g: GEO.box(0.5, 0.6, 0.1), p: [0.9, 0.7, 0.72] }, { g: GEO.cyl(0.03, 0.9, 8), p: [0.7, 1.0, 0.75], r: [0.9, 0, 0] }, { g: GEO.cyl(0.08, 0.08, 10), p: [-0.6, 1.5, 0] }]} />
      <Stencil text="DIESEL" position={[-0.3, 0.9, 0.72]} width={1.2} color="#8a1c1c" wear={0.3} />
    </group>
  );
}

// Spill kit drum and an extinguisher on a stand, at a chemical or fuel point
export function SafetyPoint({ position = [0, 0, 0], rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation} name="LG-SAFETYPOINT">
      <Merged mat={YELLOW} parts={() => [{ g: GEO.cyl(0.3, 0.9, 14), p: [0, 0.45, 0] }, { g: GEO.cyl(0.31, 0.04, 14), p: [0, 0.92, 0] }]} />
      <Merged mat={MAT.paintRed} parts={() => [{ g: GEO.cyl(0.11, 0.6, 10), p: [0.8, 0.62, 0] }]} />
      <Merged mat={MAT.dimSteel} shadow={false} parts={() => [{ g: GEO.box(0.5, 0.04, 0.5), p: [0.8, 0.02, 0] }, { g: GEO.box(0.04, 1.3, 0.04), p: [0.8, 0.65, -0.14] }, { g: GEO.cyl(0.03, 0.12, 6), p: [0.8, 0.98, 0] }]} />
      <Stencil text="SPILL KIT" position={[0, 0.5, 0.31]} width={0.5} color="#1b1b1b" wear={0.2} />
    </group>
  );
}

// Coiled lay-flat hose stacked on a pallet by the water transfer
export function HoseCoils({ position = [0, 0, 0], rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation} name="LG-HOSECOILS">
      <Merged mat={TIMBER} parts={() => [{ g: GEO.box(1.3, 0.14, 1.3), p: [0, 0.07, 0] }, { g: GEO.box(1.3, 0.14, 1.3), p: [1.6, 0.07, 0] }]} />
      <Merged mat={HOSE} parts={() => [
        ...[0, 0.2, 0.4].map(y => ({ g: GEO.torus(0.42, 0.1, 8, 20), p: [0, 0.24 + y, 0], r: [Math.PI / 2, 0, 0] })),
        ...[0, 0.2].map(y => ({ g: GEO.torus(0.42, 0.1, 8, 20), p: [1.6, 0.24 + y, 0], r: [Math.PI / 2, 0, 0] })),
      ]} />
    </group>
  );
}
