// Downloaded props (Drop 79): the CC0 and CC-BY models in public/models/props, packed by scripts/props-pack.mjs
// to real size with the base on y 0, so a placement here is a point on the pad and a heading. Repeated props go
// through the Instanced baker (one draw per material for all the barrels), single ones are plain clones. Every
// prop sits in a named group so the hover opens a record; credits for the CC-BY models are on the About page
// (content/credits.json). While a model loads nothing is drawn (the props are dressing, not equipment).
import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Instanced } from './primitives.jsx';
import { withKtx } from './gpu.js';
import { TIER } from './tier.js';

// Drop 86: the GLBs carry KTX2 textures (scripts/ktx-pack.mjs); a phone loads the .phone.glb with 512 px textures
const url = (id) => '/models/props/' + id + TIER.suffix + '.glb';

function Loaded({ id, transforms, name, scale = 1 }) {
  const gltf = useGLTF(url(id), undefined, undefined, withKtx);
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

// the pad's standing dressing, by station (pad meters). MISSILE_X and bZ come from the scene. Every spot is
// [x, y, z, yaw] or { position, rotation }; Drop 84 placed each one against the layout check (scripts/probe-layout84.mjs,
// and the pass), so nothing here sits inside drawn equipment, a light tower or the forklift's lane.
export function padProps(MISSILE_X, bZ) {
  const rot = (a) => [0, a, 0];
  const at = (list) => list.map(([x, y, z, a]) => ({ position: [x, y, z], rotation: rot(a) }));
  const tz = bZ - 26;   // the telehandler and its spotter, south of the sand station and clear of the forklift's lane (bZ - 18.2)
  return [
    // vehicles (Drop 80, re-placed Drop 84): the empty iron flatbed dropped by the iron rack with its nose east, the fuel
    // tanker behind the fuel row (landing gear drawn by the scene), a generator trailer by the data van, the telehandler
    // on the sand side. The pickups are the modeled truck in the operator's color (vehicles.jsx); no semi on the lease road.
    { id: 'flatbed', name: 'LG-IRONRACK', spots: at([[-32.7, 0, -35, Math.PI / 2]]) },
    { id: 'fueltanker', name: 'LG-FUELCUBE', spots: at([[-4, 0, -40.2, Math.PI / 2]]) },
    { id: 'generator', name: 'LG-WELFARE', spots: at([[-23.5, 0, -34.5, 0]]) },
    { id: 'telehandler', name: 'LG-SANDBOXSTATION', spots: at([[MISSILE_X - 44, 0, tz, 0.9]]) },
    // drums by the chemical totes (the totes sit past the chemical trailer's rear, Drop 84)
    { id: 'barrel', name: 'LG-TOTES', spots: at([[MISSILE_X + 18.2, 0, bZ + 9.8, 0.3], [MISSILE_X + 19.0, 0, bZ + 10.0, 1.9], [MISSILE_X + 18.7, 0, bZ + 8.9, 0.8], [MISSILE_X + 19.8, 0, bZ + 9.2, 2.6]]) },
    { id: 'pallet', name: 'LG-IRONRACK', spots: at([[MISSILE_X - 9.5, 0, -22.3, 0.1], [MISSILE_X - 11.0, 0, -22.5, 1.62], [MISSILE_X - 9.5, 0.14, -22.3, 0.08]]) },
    // tires lying flat, three high (the model stands on its tread: laid over with a quarter turn, its center then sits 0.525 m along z)
    { id: 'tire', name: 'LG-IRONRACK', spots: [0.14, 0.42, 0.70].map((y, i) => ({ position: [MISSILE_X - 12.2, y, -22.4 - 0.525], rotation: [Math.PI / 2, 0, i * 0.9] })) },
    { id: 'extinguisher', name: 'LG-SAFETYPOINT', spots: at([[MISSILE_X + 11.9, 0, bZ + 11.4, 0.6], [4.3, 0, -36.9, -0.4]]) },
    { id: 'toolbox', name: 'LG-WELFARE', spots: at([[21.3, 0, -38.6, 0.3]]) },
    { id: 'trashcan', name: 'LG-WELFARE', spots: at([[22.2, 0, -39.4, 0], [24.6, 0, -39.0, 0.7]]) },
    { id: 'box', name: 'LG-WELFARE', spots: at([[21.9, 0, -37.8, 0.5], [21.6, 0.5, -37.9, 1.1]]) },
    { id: 'portapotty', name: 'LG-WELFARE', spots: at([[36.6, 0, -43.2, Math.PI], [38.0, 0, -43.2, Math.PI]]) },
    { id: 'dumpster', name: 'LG-WELFARE', spots: at([[13.5, 0, -43.3, Math.PI / 2]]) },
    { id: 'conex', name: 'LG-IRONRACK', spots: at([[-50, 0, -17, 0]]) },
    { id: 'watertank', name: 'LG-WELFARE', spots: at([[9.6, 0, -43.2, 0]]) },
    // the cone model stands on its base as packed (Drop 84 turned it over by mistake: the drawn cones were the ones on their points); between the drawn red zone cones
    { id: 'cone', name: 'LG-CONES', spots: at([[-26, 0, -14, 0], [-17, 0, -14, 0.4], [-8, 0, -14, 0.9]]) },
    { id: 'forklift', name: 'LG-IRONRACK', spots: at([[MISSILE_X - 15, 0, -16.5, -0.5]]) },
  ];
}

export function preloadProps() { for (const id of ['flatbed', 'fueltanker', 'generator', 'pickup', 'telehandler', 'barrel', 'pallet', 'tire', 'extinguisher', 'toolbox', 'trashcan', 'box', 'portapotty', 'dumpster', 'conex', 'watertank', 'cone', 'forklift']) useGLTF.preload(url(id), undefined, undefined, withKtx); }
