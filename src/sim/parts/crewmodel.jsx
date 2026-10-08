// Animated crew (Drop 78): the four Mixamo characters in public/models/crew (lewis, pete, brian, kate; Adobe's
// Mixamo license, free for use in a project like this), converted by scripts/mixamo-to-glb.py, repainted into FRC
// coveralls with a hi-vis vest zone and reflective bands by scripts/crew-frc.py, packed by scripts/crew-pack.mjs.
// Each GLB carries idle, walk (in place), point, kneel, radio and hammer. The hard hat is drawn here and parented
// to the head bone, so it rides every animation. Full quality only: Lite keeps the capsule figures in life.jsx
// (phones), and while a model is still loading the capsule figure stands in, so nothing pops out of existence.
// A figure is a SkeletonUtils clone of the loaded scene, so several of one character can be on the pad at once.
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { LITE } from './lighting.jsx';
import { Crew, Walker } from './life.jsx';
import { useTheme } from '../../theme/theme.js';
import { withKtx } from './gpu.js';
import { TIER } from './tier.js';

export const CREW_MODELS = ['lewis', 'pete', 'brian', 'kate'];
// Drop 84: a character whose mesh already wears a hard hat gets no drawn hat on top (pete's model has its own)
export const OWN_HAT = { pete: true };
const url = (name) => '/models/crew/' + name + TIER.suffix + '.glb';   // KTX2 textures, 512 px on a phone (Drop 86)
const CLIP = { stand: 'idle', point: 'point', kneel: 'kneel', radio: 'radio', hammer: 'hammer', walk: 'walk' };
const HAT = { white: '#f2f2f2', yellow: '#e8d23a', orange: '#f07a2a', blue: '#2a5d9f' };

// a hard hat on the head bone: a flattened dome with a short brim and a longer peak, in the crew color
function hardHat(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05, userData: { grime: 0.3, family: 'plastic' } });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.112, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat); dome.scale.set(1, 0.95, 1.1); dome.castShadow = true;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.14, 0.012, 24), mat); brim.position.y = 0.002; brim.scale.set(1, 1, 1.05);
  const peak = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.07), mat); peak.position.set(0, 0.004, 0.15);
  g.add(dome, brim, peak);
  return g;
}

function Model({ name, clip = 'idle', hat = 'white', timeScale = 1, phase = 0 }) {
  const gltf = useGLTF(url(name), undefined, undefined, withKtx);
  const scene = useMemo(() => cloneSkinned(gltf.scene), [gltf.scene]);
  const group = useRef();
  const { actions, mixer } = useAnimations(gltf.animations, group);
  useEffect(() => {
    // skinned meshes are not walk obstacles by their bind-pose box (a T-pose is 1.8 m wide); the figure's group carries a body-sized box instead
    scene.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.userData.walkSkip = true; } });
    // the hat: on the head bone (Mixamo head bones point +Y up the skull), at the height crew-frc.py measured for
    // this character and stored in the scene extras (the characters differ in height and head size)
    let head = null; scene.traverse(o => { if (!head && o.isBone && /Head$/.test(o.name)) head = o; });
    if (head && OWN_HAT[name]) { const old = head.getObjectByName('HAT'); if (old) head.remove(old); }
    else if (head) {
      const old = head.getObjectByName('HAT'); if (old) head.remove(old);
      const h = hardHat(HAT[hat] || hat); h.name = 'HAT';
      // Mixamo rigs are in centimeters under a 0.01 root scale: the hat is built in meters, so it counters that scale
      scene.updateMatrixWorld(true); const ws = new THREE.Vector3(); head.getWorldScale(ws); const k = 1 / (ws.y || 1);
      const hatY = ((gltf.scene.userData && gltf.scene.userData.hatY) || 0.165) - 0.02;   // measured to the hair; the hat sits in it a little
      h.scale.setScalar(k); h.position.set(0, hatY * k, 0.02 * k); head.add(h);
    }
  }, [scene, hat, gltf.scene, name]);
  useEffect(() => {
    const a = actions[CLIP[clip] || clip] || actions.idle;
    if (!a) return;
    a.reset().setEffectiveTimeScale(timeScale).setLoop(THREE.LoopRepeat, Infinity).play();
    a.time = phase % Math.max(0.1, a.getClip().duration);
    return () => { a.stop(); };
  }, [actions, clip, timeScale, phase]);
  useEffect(() => () => { if (mixer) mixer.stopAllAction(); }, [mixer]);
  return <primitive ref={group} object={scene} rotation={[0, Math.PI, 0]} />;
}
const BODY_BOX = { walkBoxes: { boxes: [new THREE.Box3(new THREE.Vector3(-0.3, 0, -0.3), new THREE.Vector3(0.3, 1.8, 0.3))], mats: [new THREE.Matrix4()] } };

// one crew member, standing in a pose; `seed` picks the character and the hat as the capsule figures do
export function CrewModel({ position = [0, 0, 0], rotation = 0, pose = 'stand', seed = 0, vest, hat }) {
  const name = CREW_MODELS[Math.abs(seed) % CREW_MODELS.length];
  const op = useTheme(st => st.theme.operator);
  const hatColor = op.hat || 'white';
  const fallback = <Crew position={position} rotation={rotation} pose={pose} seed={seed} vest={vest || op.ppe} hat={hat || op.hat} />;
  if (LITE) return fallback;
  return (
    <Suspense fallback={fallback}>
      <group position={position} rotation={[0, rotation, 0]} name="LG-CREW" userData={BODY_BOX}>
        <Model name={name} clip={pose} hat={seed % 3 === 0 ? hatColor : seed % 3 === 1 ? 'yellow' : 'orange'} phase={seed * 0.7} />
      </group>
    </Suspense>
  );
}

// one crew member walking a closed path, the in-place walk clip playing while the group moves along it
export function CrewWalker({ path, speed = 1.1, seed = 0, vest, hat }) {
  const name = CREW_MODELS[(Math.abs(seed) + 2) % CREW_MODELS.length];
  const op = useTheme(st => st.theme.operator);
  const ref = useRef();
  const loop = useMemo(() => {
    const pts = path.map(p => new THREE.Vector3(p[0], 0, p[1])); pts.push(pts[0].clone());
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    return { pts, cum, total: cum[cum.length - 1] };
  }, [path]);
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + seed * 11;
    const d = ((t % loop.total) + loop.total) % loop.total;
    let i = 1; while (i < loop.cum.length - 1 && loop.cum[i] < d) i++;
    const a = loop.pts[i - 1], b = loop.pts[i], k = (d - loop.cum[i - 1]) / Math.max(1e-6, loop.cum[i] - loop.cum[i - 1]);
    if (ref.current) { ref.current.position.set(a.x + (b.x - a.x) * k, 0, a.z + (b.z - a.z) * k); ref.current.rotation.y = Math.atan2(-(b.x - a.x), -(b.z - a.z)); }
  });
  const fallback = <Walker path={path} speed={speed} seed={seed} vest={vest || op.ppe} hat={hat || op.hat} />;
  if (LITE) return fallback;
  return (
    <Suspense fallback={fallback}>
      <group ref={ref} name="LG-CREW-WALKER" userData={BODY_BOX}>
        <Model name={name} clip="walk" hat={seed % 2 ? 'yellow' : (op.hat || 'white')} timeScale={speed / 1.1} phase={seed * 0.37} />
      </group>
    </Suspense>
  );
}

if (!LITE) CREW_MODELS.forEach(n => useGLTF.preload(url(n), undefined, undefined, withKtx));
