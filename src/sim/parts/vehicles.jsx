// Light vehicles (Drop 84): the downloaded crew-cab pickup (public/models/props/pickup.glb, CC-BY, credited on the
// About page; badges and plates blanked at pack time) in the operator's color, both parked in a row and driving the
// lease road. The model's paint is one flat material, so the fleet is one instanced draw per material with the paint
// as a per-instance tint, and the road truck is a clone with its wheels re-centered on their axles so they turn.
// The drawn pickup of Drops 25 to 81 is gone: the shape is the type, the model carries it better.
import { useRef, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Instanced } from './primitives.jsx';
import { withKtx } from './gpu.js';
import { TIER } from './tier.js';

const URL = '/models/props/pickup' + TIER.suffix + '.glb';   // KTX2 textures, 512 px on a phone (Drop 86)
const isBody = (m) => m && /Bodymat/i.test(m.name);

// a clone of the model with the paint material swapped: `tint` true leaves it white and flags it for the instanced
// per-unit color; a color string paints it outright
function paintedClone(scene, paint) {
  const s = scene.clone(true);
  let body = null;
  s.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    if (isBody(o.material)) {
      if (!body) { body = o.material.clone(); if (paint === true) { body.color.set('#ffffff'); body.userData.instanceTint = true; } else body.color.set(paint); }
      o.material = body;
    }
  });
  return s;
}

function Fleet({ position, count, paint, spacing }) {
  const gltf = useGLTF(URL, undefined, undefined, withKtx);
  const scene = useMemo(() => paintedClone(gltf.scene, true), [gltf.scene]);
  const transforms = useMemo(() => Array.from({ length: count }, (_, i) => ({ position: [0, 0, i * spacing], rotation: [0, 0, 0], tint: paint })), [count, spacing, paint]);
  return (
    <group position={position} name="LG-PICKUPS">
      <Instanced transforms={transforms} name="LG-PICKUPS" version={paint || ''}><primitive object={scene} /></Instanced>
    </group>
  );
}
// Trucks parked in a row along z, noses to +x, in the operator's color.
export function ParkedPickups({ position, count = 6, paint = '#d7dde5', spacing = 3.4 }) {
  return <Suspense fallback={null}><Fleet position={position} count={count} paint={paint} spacing={spacing} /></Suspense>;
}

// The crew truck on the lease road: out to the edge of the terrain and back, on the road surface.
function Rolling({ road, speed, height, paint }) {
  const gltf = useGLTF(URL, undefined, undefined, withKtx);
  const ref = useRef(); const wheels = useRef([]);
  const scene = useMemo(() => {
    const s = paintedClone(gltf.scene, paint || '#d7dde5');
    // each wheel mesh has its geometry where the wheel sits; move the geometry onto the node's origin and the node onto
    // the wheel's center, so a turn about the axle spins it in place. The axle runs along the truck's z, but the wheel
    // nodes sit under the model's own rotated root (a Sketchfab export), so the axle is taken into each node's own frame
    // (Drop 85; turning about the node's z spun the wheels flat)
    const list = [];
    s.updateMatrixWorld(true);
    const q = new THREE.Quaternion();
    s.traverse(o => {
      if (!o.isMesh || !/WheelStock/i.test(o.name)) return;
      const g = o.geometry.clone(); g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3());
      g.translate(-c.x, -c.y, -c.z); o.geometry = g; o.position.add(c);
      o.parent.getWorldQuaternion(q); o.userData.axle = new THREE.Vector3(0, 0, 1).applyQuaternion(q.invert()).normalize();
      list.push(o);
    });
    wheels.current = list;
    return s;
  }, [gltf.scene, paint]);
  useFrame((state, dt) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed;
    const span = road.x1 - road.x0;
    const u = t % (2 * span); const out = u < span; const x = out ? road.x0 + u : road.x1 - (u - span);
    const z = road.z + (out ? 1.6 : -1.6);
    ref.current.position.set(x, height(x, z), z);
    ref.current.rotation.y = out ? 0 : Math.PI;
    wheels.current.forEach(wh => { wh.rotateOnAxis(wh.userData.axle, -dt * speed / 0.385); });
  });
  return <group ref={ref} name="LG-PICKUPS"><primitive object={scene} /></group>;
}
export function RoadTruck({ road, speed = 6, height = () => 0, paint = null }) {
  return <Suspense fallback={null}><Rolling road={road} speed={speed} height={height} paint={paint} /></Suspense>;
}
