// Walk mode (Drop 56): first person on the pad at eye height. W A S D or the arrow keys move, Shift runs, dragging
// the view looks around (mouse or one finger), Escape returns to the camera preset. Phones get the on-screen
// arrows the Simulator shows while walking; they write the same `WALK` input the keys do. The walker follows the
// terrain outside the pad and is kept within 60 m of the pad edge. Picking keeps working: a click that did not
// drag still opens the record under it.
import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { terrainHeight } from './terrain.js';
import { LISTENER, updateListener } from '../sound.js';

export const WALK = { f: 0, s: 0, run: false };     // forward (+1 ahead, -1 back), strafe (+1 right), run
export const LAST_TARGET = new THREE.Vector3(-20, 0, 10);   // the orbit target, kept current by the scene so a walk starts at what was being looked at
const EYE = 1.7, SPEED = 2.6, RUN = 5.5, LOOK = 0.0042;
const KEYS = { KeyW: ['f', 1], ArrowUp: ['f', 1], KeyS: ['f', -1], ArrowDown: ['f', -1], KeyD: ['s', 1], ArrowRight: ['s', 1], KeyA: ['s', -1], ArrowLeft: ['s', -1] };

// Obstacles (Drop 61): the walker cannot pass through the units. Collected once when the walk starts from the
// scene's own meshes: every visible mesh (each instance of an instanced mesh on its own) whose world box stands in
// the body band (reaches above 0.7 m and starts below 1.3 m), is at least 0.5 m across both ways, and is not a
// whole-area bake (over 400 square meters, or 30 m long: the ground, the pad, the pad berm). Thin things (pipes,
// hoses, masts, flags, cones) fall through and are walked past. Boxes are padded by the body radius; the walker is
// pushed out of any box it ends a step in, along the shorter way, which makes it slide along a trailer rather
// than stop dead.
// Drop 75: an object can carry its own boxes in `userData.walkBoxes` ({ boxes: Box3[] in its own frame, mats:
// Matrix4[] placements, force }) and its descendants `userData.walkSkip`. The instancing baker writes them for
// every set it bakes (the boxes of the source meshes, one unit each, which a merged set loses), and the water pit
// writes one forced box over the whole pit, berm included, since a ring is a keep-out and not a box to filter.
// Drop 88: floors. The walker's feet used to sit on the terrain everywhere; the data van's interior, its landing
// and its stair register floors here (world rectangles with a height, or a ramp whose height runs along one axis)
// and the feet take the highest floor under them. Obstacles keep their height range and only count when they cross
// the body band above the feet, so a trailer's chassis and tires block a walker on the ground and not one standing
// on the deck above them, and the stair's treads below the feet never block the climb. `walkBoxes` may carry a
// `pad` of its own (the body radius a door gap is padded by: 0.25 lets a person through a one-meter door).
export const FLOORS = new Map();   // id -> [{ x0, z0, x1, z1, y0, y1, axis }]
export function registerFloors(id, list) { FLOORS.set(id, list); }
export function unregisterFloors(id) { FLOORS.delete(id); }
export function floorAt(x, z) {
  let best = -Infinity;
  for (const list of FLOORS.values()) for (const f of list) {
    if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue;
    let y = f.y0;
    if (f.axis === 'x') y = f.y0 + (f.y1 - f.y0) * (x - f.x0) / (f.x1 - f.x0);
    else if (f.axis === 'z') y = f.y0 + (f.y1 - f.y0) * (z - f.z0) / (f.z1 - f.z0);
    if (y > best) best = y;
  }
  return best;
}
const BODY_R = 0.6;
function collectObstacles(scene) {
  const out = [];
  const box = new THREE.Box3(), m = new THREE.Matrix4(), w = new THREE.Matrix4();
  const consider = (bb, world, force = false, pad = BODY_R) => {
    box.copy(bb).applyMatrix4(world);
    if (box.max.y < 0.7 || box.min.y > 12) return;   // nothing below knee height; a sky-high mast top still carries its own box down to the ground
    const sx = box.max.x - box.min.x, sz = box.max.z - box.min.z;
    if (!force && (sx < 0.5 || sz < 0.5 || sx > 30 || sz > 30 || sx * sz > 400)) return;
    out.push([box.min.x - pad, box.min.z - pad, box.max.x + pad, box.max.z + pad, box.min.y, box.max.y]);
  };
  scene.traverse(o => {
    if (o.userData.walkSkip) return;
    for (let p = o; p; p = p.parent) if (p.visible === false) return;
    const wb = o.userData.walkBoxes;
    if (wb) { for (const mat of wb.mats) for (const b of wb.boxes) consider(b, w.multiplyMatrices(o.matrixWorld, mat), !!wb.force, wb.pad != null ? wb.pad : BODY_R); return; }
    if (!o.isMesh || o.isSprite || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox; if (!bb || bb.isEmpty()) return;
    if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); consider(bb, w.multiplyMatrices(o.matrixWorld, m)); } }
    else consider(bb, o.matrixWorld);
  });
  return out;
}
// `feet` is the walker's ground height: a box counts when it crosses the band 0.7 to 1.3 m above the feet
function pushOut(p, boxes, feet = 0) {
  for (let pass = 0; pass < 2; pass++) {
    for (const [x0, z0, x1, z1, y0, y1] of boxes) {
      if (y1 < feet + 0.7 || y0 > feet + 1.3) continue;
      if (p.x <= x0 || p.x >= x1 || p.z <= z0 || p.z >= z1) continue;
      const dx0 = p.x - x0, dx1 = x1 - p.x, dz0 = p.z - z0, dz1 = z1 - p.z;
      const dx = Math.min(dx0, dx1), dz = Math.min(dz0, dz1);
      if (dx < dz) p.x = dx0 < dx1 ? x0 : x1; else p.z = dz0 < dz1 ? z0 : z1;
    }
  }
}

export function WalkControls({ terrain, pad, onExit }) {
  const { camera, gl, scene } = useThree();
  const yaw = useRef(0), pitch = useRef(0), keys = useRef({}), tick = useRef(1), obstacles = useRef([]);
  // start 8 m short of what the orbit camera was looking at, on its side, at eye height, facing it
  const groundAt = (x, z) => Math.max(terrainHeight(x, z, terrain.relief, pad), floorAt(x, z));
  useEffect(() => {
    const t = LAST_TARGET.clone();
    const back = camera.position.clone().sub(t); back.y = 0; if (back.length() < 1) back.set(0, 0, 1); back.normalize();
    // a camera already standing on a floor (the data van seat preset, Drop 88) walks from where it is; otherwise the
    // walk starts 8 m short of what was being looked at
    const inside = floorAt(camera.position.x, camera.position.z) > -Infinity;
    const x = inside ? camera.position.x : THREE.MathUtils.clamp(t.x + back.x * 8, pad.x0 - 60, pad.x1 + 60), z = inside ? camera.position.z : THREE.MathUtils.clamp(t.z + back.z * 8, pad.z0 - 60, pad.z1 + 60);
    yaw.current = Math.atan2(-(t.x - x), -(t.z - z)); pitch.current = 0;
    camera.position.set(x, groundAt(x, z) + EYE, z);
    camera.rotation.set(0, yaw.current, 0, 'YXZ');
    camera.updateProjectionMatrix();
    scene.updateMatrixWorld(true);
    obstacles.current = collectObstacles(scene);
    if (typeof window !== 'undefined') { window.__padworksObstacles = obstacles.current; window.__padworksFloorAt = floorAt; }   // test hooks
    const p = { x, z }; pushOut(p, obstacles.current, groundAt(x, z)); camera.position.x = p.x; camera.position.z = p.z;   // never start inside a unit
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // the exit callback lives in a ref: the listeners below are installed once per canvas, not once per scene render
  // (the scene re-renders every sim tick, and re-installing reset the held arrows and the sound listener; Drop 60)
  const exitRef = useRef(onExit); exitRef.current = onExit;
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Escape') { if (exitRef.current) exitRef.current(); return; }
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
      if (KEYS[e.code]) { keys.current[e.code] = true; e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.current.shift = true;
    };
    const up = (e) => { delete keys.current[e.code]; if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.current.shift = false; };
    const el = gl.domElement;
    let drag = null;
    const pdown = (e) => { if (e.isPrimary === false) return; drag = { x: e.clientX, y: e.clientY }; };
    const pmove = (e) => {
      if (!drag || e.isPrimary === false) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
      yaw.current -= dx * LOOK; pitch.current = THREE.MathUtils.clamp(pitch.current - dy * LOOK, -1.2, 1.2);
    };
    const pup = () => { drag = null; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    el.addEventListener('pointerdown', pdown); window.addEventListener('pointermove', pmove); window.addEventListener('pointerup', pup); window.addEventListener('pointercancel', pup);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      el.removeEventListener('pointerdown', pdown); window.removeEventListener('pointermove', pmove); window.removeEventListener('pointerup', pup); window.removeEventListener('pointercancel', pup);
      WALK.f = 0; WALK.s = 0; WALK.run = false;
      LISTENER.walk = false; updateListener();   // back to the plain pad mix
    };
  }, [gl]);
  useFrame((_, dt) => {
    const k = keys.current;
    let f = WALK.f, s = WALK.s;
    for (const code in KEYS) if (k[code]) { const [axis, v] = KEYS[code]; if (axis === 'f') f = v; else s = v; }
    const run = k.shift || WALK.run;
    const step = Math.min(dt, 0.1) * (run ? RUN : SPEED);
    if (f || s) {
      const sin = Math.sin(yaw.current), cos = Math.cos(yaw.current);
      // forward is -Z in the camera frame rotated by yaw; right is +X
      const fx = -sin, fz = -cos, rx = cos, rz = -sin;
      let x = camera.position.x + (fx * f + rx * s) * step, z = camera.position.z + (fz * f + rz * s) * step;
      x = THREE.MathUtils.clamp(x, pad.x0 - 60, pad.x1 + 60); z = THREE.MathUtils.clamp(z, pad.z0 - 60, pad.z1 + 60);
      const p = { x, z }; pushOut(p, obstacles.current, groundAt(camera.position.x, camera.position.z));
      camera.position.x = p.x; camera.position.z = p.z;
    }
    const groundY = groundAt(camera.position.x, camera.position.z) + EYE;
    camera.position.y += (groundY - camera.position.y) * Math.min(1, dt * 10);
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
    // positional sound: the walker is the listener (updated a few times a second, not every frame)
    LISTENER.x = camera.position.x; LISTENER.z = camera.position.z; LISTENER.yaw = yaw.current; LISTENER.walk = true;
    tick.current += dt; if (tick.current > 0.2) { tick.current = 0; updateListener(); }
  });
  return null;
}
