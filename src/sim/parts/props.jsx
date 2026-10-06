// Downloaded props (Drop 79): the CC0 and CC-BY models in public/models/props, packed by scripts/props-pack.mjs
// to real size with the base on y 0, so a placement here is a point on the pad and a heading. Repeated props go
// through the Instanced baker (one draw per material for all the barrels), single ones are plain clones. Every
// prop sits in a named group so the hover opens a record; credits for the CC-BY models are on the About page
// (content/credits.json). While a model loads nothing is drawn (the props are dressing, not equipment).
import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Instanced } from './primitives.jsx';

const url = (id) => '/models/props/' + id + '.glb';

function Loaded({ id, transforms, name, scale = 1 }) {
  const gltf = useGLTF(url(id));
  const scene = useMemo(() => { const s = gltf.scene.clone(true); s.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return s; }, [gltf.scene]);
  const tr = useMemo(() => transforms.map(t => ({ position: t.position, rotation: t.rotation || [0, 0, 0] })), [transforms]);
  return (
    <Instanced transforms={tr} name={name}>
      <primitive object={scene} scale={scale} />
    </Instanced>
  );
}

// `items`: [{ id, name, scale, spots: [{ position, rotation }] }]
export function Props({ items }) {
  return (
    <>
      {items.map(it => (
        <Suspense key={it.id + it.name} fallback={null}>
          <Loaded id={it.id} transforms={it.spots} name={it.name} scale={it.scale} />
        </Suspense>
      ))}
    </>
  );
}

// the pad's standing dressing, by station (pad meters). MISSILE_X and bZ come from the scene.
export function padProps(MISSILE_X, bZ, rowLen, pad) {
  const rot = (a) => [0, a, 0];
  const gateX = pad ? pad.x1 : 40;
  return [
    // vehicles (Drop 80): an iron hauler on the lease road at the gate, the fuel tanker behind the fuel row, a generator trailer
    // by the data van, a second office trailer south of the pickups, two more pickups at the end of the row, a telehandler on the sand side
    { id: 'semitruck', name: 'LG-PICKUPS', spots: [[gateX + 16, 0, -32.2, -Math.PI / 2]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'flatbed', name: 'LG-PICKUPS', spots: [[gateX + 26.5, 0, -32.2, -Math.PI / 2]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'fueltanker', name: 'LG-FUELCUBE', spots: [[-4, 0, -40.2, Math.PI / 2]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'generator', name: 'LG-WELFARE', spots: [[-23.5, 0, -34.5, 0]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'officetrailer', name: 'LG-WELFARE', spots: [[33, 0, -22, Math.PI / 2]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'pickup', name: 'LG-PICKUPS', spots: [[30, 0, -36 + 7 * 3.6, 0], [30, 0, -36 + 8 * 3.6, 0.05]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'telehandler', name: 'LG-SANDBOXSTATION', spots: [[MISSILE_X - 44, 0, bZ - 20, 0.9]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'barrel', name: 'LG-TOTES', spots: [[MISSILE_X + 17.5, 0, bZ + 8.2, 0.3], [MISSILE_X + 18.3, 0, bZ + 8.4, 1.9], [MISSILE_X + 18.0, 0, bZ + 7.3, 0.8], [MISSILE_X + 19.1, 0, bZ + 7.6, 2.6]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'pallet', name: 'LG-IRONRACK', spots: [[MISSILE_X - 9.5, 0, -22.3, 0.1], [MISSILE_X - 11.0, 0, -22.5, 1.62], [MISSILE_X - 9.5, 0.14, -22.3, 0.08]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'tire', name: 'LG-IRONRACK', spots: [[MISSILE_X - 12.6, 0, -22.4, 0.4], [MISSILE_X - 12.9, 0.25, -22.3, 1.1]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'extinguisher', name: 'LG-SAFETYPOINT', spots: [[MISSILE_X + 9.5, 0, bZ + 5.9, 0.6], [4.3, 0, -36.9, -0.4]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'jerrycan', name: 'LG-FUELCUBE', spots: [[MISSILE_X - 9.4, 0, -26.0, 0.2], [MISSILE_X - 9.8, 0, -26.2, 1.4], [MISSILE_X - 9.1, 0, -26.5, 2.9]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'toolbox', name: 'LG-WELFARE', spots: [[21.3, 0, -38.6, 0.3]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'trashcan', name: 'LG-WELFARE', spots: [[22.2, 0, -39.4, 0], [15.0, 0, -38.8, 0.7]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'box', name: 'LG-WELFARE', spots: [[21.9, 0, -37.8, 0.5], [21.6, 0.5, -37.9, 1.1]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'portapotty', name: 'LG-WELFARE', spots: [[24.5, 0, -43.2, Math.PI], [25.9, 0, -43.2, Math.PI]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'dumpster', name: 'LG-WELFARE', spots: [[13.5, 0, -43.3, Math.PI / 2]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'conex', name: 'LG-IRONRACK', spots: [[MISSILE_X - 22, 0, -27.5, Math.PI / 2]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'watertank', name: 'LG-WELFARE', spots: [[9.6, 0, -43.2, 0]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'cone', name: 'LG-CONES', spots: [[MISSILE_X - 16.5, 0, -11.8, 0], [MISSILE_X + 10.5, 0, -11.8, 0], [MISSILE_X - 2, 0, -13.0, 0]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
    { id: 'forklift', name: 'LG-IRONRACK', spots: [[MISSILE_X - 15, 0, -16.5, -0.5]].map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) })) },
  ];
}

export function preloadProps() { for (const id of ['semitruck', 'flatbed', 'fueltanker', 'generator', 'officetrailer', 'pickup', 'telehandler', 'barrel', 'pallet', 'tire', 'extinguisher', 'jerrycan', 'toolbox', 'trashcan', 'box', 'portapotty', 'dumpster', 'conex', 'watertank', 'cone', 'forklift']) useGLTF.preload(url(id)); }
