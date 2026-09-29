// Procedural building blocks shared by the surface and downhole scenes.
import { useMemo } from 'react';
import * as THREE from 'three';

export const MAT = {
  steel:   { color: '#7d8590', metalness: 0.85, roughness: 0.35 },
  darkSteel: { color: '#3a4149', metalness: 0.8, roughness: 0.45 },
  redIron: { color: '#a3261d', metalness: 0.6, roughness: 0.5 },
  yellow:  { color: '#d9a400', metalness: 0.3, roughness: 0.6 },
  white:   { color: '#d7dde5', metalness: 0.2, roughness: 0.6 },
  blue:    { color: '#2a5d9f', metalness: 0.4, roughness: 0.55 },
  green:   { color: '#2e8b57', metalness: 0.4, roughness: 0.55 },
  rubber:  { color: '#1d1f22', metalness: 0.0, roughness: 0.95 },
  brass:   { color: '#b08d3c', metalness: 0.9, roughness: 0.3 },
  tire:    { color: '#141618', metalness: 0.0, roughness: 1.0 },
  ground:  { color: '#4b4235', metalness: 0.0, roughness: 1.0 },
  sand:    { color: '#c9b47a', metalness: 0.0, roughness: 1.0 },
};

export function Box({ size = [1, 1, 1], position = [0, 0, 0], rotation = [0, 0, 0], mat = MAT.steel, name, castShadow = true, children, ...rest }) {
  return (
    <mesh position={position} rotation={rotation} name={name} castShadow={castShadow} receiveShadow {...rest}>
      <boxGeometry args={size} />
      <meshStandardMaterial {...mat} />
      {children}
    </mesh>
  );
}

export function Cyl({ r = 0.5, r2, h = 1, position = [0, 0, 0], rotation = [0, 0, 0], mat = MAT.steel, name, segments = 24, open = false, thetaLength, ...rest }) {
  const args = thetaLength !== undefined
    ? [r2 ?? r, r, h, segments, 1, open, 0, thetaLength]
    : [r2 ?? r, r, h, segments, 1, open];
  return (
    <mesh position={position} rotation={rotation} name={name} castShadow receiveShadow {...rest}>
      <cylinderGeometry args={args} />
      <meshStandardMaterial {...mat} side={open ? THREE.DoubleSide : THREE.FrontSide} />
    </mesh>
  );
}

// Pipe between two points, with optional hammer-union bulges at the ends.
export function Pipe({ from, to, r = 0.05, mat = MAT.redIron, unions = true, name }) {
  const { position, rotation, length } = useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(b, a);
    const length = dir.length();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const euler = new THREE.Euler().setFromQuaternion(quat);
    return { position: [mid.x, mid.y, mid.z], rotation: [euler.x, euler.y, euler.z], length };
  }, [from, to]);
  return (
    <group position={position} rotation={rotation} name={name}>
      <mesh castShadow>
        <cylinderGeometry args={[r, r, length, 12]} />
        <meshStandardMaterial {...mat} />
      </mesh>
      {unions && length > 0.6 && (
        <>
          <mesh position={[0, length / 2 - 0.12, 0]}><cylinderGeometry args={[r * 1.6, r * 1.6, 0.16, 12]} /><meshStandardMaterial {...MAT.darkSteel} /></mesh>
          <mesh position={[0, -length / 2 + 0.12, 0]}><cylinderGeometry args={[r * 1.6, r * 1.6, 0.16, 12]} /><meshStandardMaterial {...MAT.darkSteel} /></mesh>
        </>
      )}
    </group>
  );
}

// Polyline of pipes through a list of points
export function PipeRun({ points, r = 0.05, mat = MAT.redIron, name }) {
  return (
    <group name={name}>
      {points.slice(1).map((p, i) => <Pipe key={i} from={points[i]} to={p} r={r} mat={mat} />)}
      {points.slice(1, -1).map((p, i) => (
        <mesh key={'j' + i} position={p}><sphereGeometry args={[r * 1.5, 12, 12]} /><meshStandardMaterial {...MAT.darkSteel} /></mesh>
      ))}
    </group>
  );
}

export function Wheel({ position, r = 0.5, w = 0.3 }) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow><cylinderGeometry args={[r, r, w, 16]} /><meshStandardMaterial {...MAT.tire} /></mesh>
      <mesh><cylinderGeometry args={[r * 0.55, r * 0.55, w + 0.02, 12]} /><meshStandardMaterial {...MAT.steel} /></mesh>
    </group>
  );
}

// Flatbed trailer: deck plus wheels, oriented along X
export function Trailer({ length = 12, width = 2.6, position = [0, 0, 0], rotation = [0, 0, 0], color = MAT.white, children, name }) {
  return (
    <group position={position} rotation={rotation} name={name}>
      <Box size={[length, 0.25, width]} position={[0, 1.05, 0]} mat={MAT.darkSteel} />
      <Box size={[length * 0.98, 0.45, width * 0.35]} position={[0, 0.75, 0]} mat={MAT.darkSteel} />
      {[-length * 0.32, -length * 0.22, length * 0.36].map((x, i) => (
        <group key={i}>
          <Wheel position={[x, 0.5, width / 2 - 0.15]} />
          <Wheel position={[x, 0.5, -width / 2 + 0.15]} />
        </group>
      ))}
      {children}
    </group>
  );
}

// Text label as a sprite (canvas texture), constant screen size, no DOM nodes.
const labelCache = new Map();
function labelTexture(text) {
  if (labelCache.has(text)) return labelCache.get(text);
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = '600 28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 28, h = 44;
  c.width = w; c.height = h;
  ctx.font = font;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 8); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 14, h / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  const out = { tex, aspect: w / h };
  labelCache.set(text, out);
  return out;
}
export function Label({ text, position = [0, 0, 0], size = 0.022 }) {
  const { tex, aspect } = useMemo(() => labelTexture(text), [text]);
  return (
    <sprite position={position} scale={[size * aspect, size, 1]} renderOrder={10}>
      <spriteMaterial map={tex} sizeAttenuation={false} depthTest={false} depthWrite={false} transparent />
    </sprite>
  );
}
