// The electric frac fleet's pump units (Drop 90): the downloaded twin-pump electric frac trailer
// (public/models/props/efracpump.glb, CC-BY, credited on the About page; scripts/props-pack.mjs and ktx-pack.mjs)
// in place of the drawn single-pump electric unit of Drops 11 to 89. One trailer carries two 3,000 hp pumps, which
// is what the fleet table says an electric fleet runs, so a spread of N pumps parks ceil(N/2) trailers nose-out on
// both sides of the missile, each across two missile pitches, and the last trailer of an odd spread has one pump
// hooked up and a spare fluid end. The model's own materials are replaced by the pad's palette (the pumps and
// motors in the fleet's primary color, the cabinets in its secondary, steel, chassis and tires as everywhere else)
// so the theme paints it and the photographic detail layer lands on it, and its part groups are renamed to the
// records the drawn pump carried (motor, drive cabinets, power end, fluid end) so a hover opens the same cards.
// The body is one instanced bake (primitives.jsx Instanced) with the logo plates in it; the pump numbers, status
// lamps and the work light after dark are per trailer (`EfracLive`), as `FracPumpLive` does for the diesel units.
//
// Geometry measured from the packed file (its frame; the scene turns a unit so its rear faces the missile):
//   rear face x -8.12 (the pump end, with both discharge lines and the suction manifold ending there)
//   discharge line ends: pump A (-8.12, 1.70, 0.965), pump B (-8.12, 1.30, 0.965); suction end (-8.12, 1.46, -1.155)
//   drive cabinets x 5.02..7.92, y 1.86..4.16, faces at z 1.12 and -1.32 (signs, lamps and logo plates go there)
import { useMemo, Suspense } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Instanced, Merged, GEO, MAT, stdProps } from './primitives.jsx';
import { LITE, glowTexture } from './lighting.jsx';
import { Sign } from './life.jsx';
import { LogoPlate } from './logo.jsx';
import { withKtx } from './gpu.js';
import { TIER } from './tier.js';
import { useTheme } from '../../theme/theme.js';

export const EFRAC = {
  half: 8.12,                       // half length; the rear face is at local -half
  standoff: 2.9,                    // rear face to the missile centerline (the LP outlets reach 1.77 m, the hose tails 2.55)
  discharge: [[1.70, 0.965], [1.30, 0.965]],   // [y, z] of each pump's discharge line end at the rear face (local frame)
  suction: [1.46, -1.155],          // [y, z] of the suction manifold end at the rear face
  cabinet: { x0: 5.02, x1: 7.92, zFace: [1.12, -1.32], y0: 1.86, y1: 4.16 },
};
export const EFRAC_URL = '/models/props/efracpump' + TIER.suffix + '.glb';

// part groups of the model -> the drawn pump's record suffixes (hover.js aliases VFD to the motor record)
const PART_OF = [[/Pump_\d_Motor|Cooling_cover/, 'MOTOR'], [/Electrical_cabinets|Drive_cabinets|Cooling_module/, 'VFD'], [/Powerend|Lubrication/, 'POWEREND'], [/Fluidend|fluidend/, 'FLUIDEND']];
const partOf = (name) => { for (const [re, p] of PART_OF) if (re.test(name)) return p; return null; };

// a three material from a palette entry (what <Mat> renders, built in code)
function fromPalette(entry, extra = {}) {
  const p = { ...entry, ...extra }; const ud = { ...(p.userData || {}) }; delete p.userData;
  for (const k of Object.keys(p)) if (p[k] === undefined) delete p[k];   // a palette entry carries `undefined` for maps Lite leaves out; the constructor warns on those
  const m = (!LITE && p.clearcoat != null) ? new THREE.MeshPhysicalMaterial(p) : new THREE.MeshStandardMaterial(stdProps(p));
  m.userData = ud; return m;
}
// the model's material names -> palette entries. `material` is the red of the pumps and motors; `red_dark` their
// shadowed castings; `cabinet` the enclosures; `yellow` the handrails and stair (safety yellow, not the wellhead accent)
function paletteFor() {
  const primary = new THREE.Color(MAT.blue.color), dark = primary.clone().multiplyScalar(0.62);
  const mats = {
    material: fromPalette(MAT.blue), red_dark: fromPalette(MAT.blue, { color: '#' + dark.getHexString() }),
    cabinet: fromPalette(MAT.paintWhite), white: fromPalette(MAT.paintWhite), offwhite: fromPalette(MAT.white),
    darksteel: fromPalette(MAT.darkSteel), steel: fromPalette(MAT.steel), silver: fromPalette(MAT.alu), chrome: fromPalette(MAT.alu),
    black: fromPalette(MAT.chassis), grille: fromPalette(MAT.dimSteel), rubber: fromPalette(MAT.tire),
    yellow: fromPalette(MAT.yellow, { color: '#dcae12' }), tail_red: fromPalette(MAT.paintRed), amber: fromPalette(MAT.yellow, { color: '#d08a1a' }),
  };
  return { mats, fallback: fromPalette(MAT.darkSteel) };
}

// the loaded scene as a template: palette materials, record names, shadows
function useTemplate(gltfScene, themeVersion) {
  return useMemo(() => {
    const { mats, fallback } = paletteFor();
    const s = gltfScene.clone(true);
    s.traverse(o => {
      const part = partOf(o.name || '');
      o.name = part ? 'PP-FRACPUMP-' + part : '';
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      const key = (o.material && o.material.name) || '';
      o.material = mats[key] || fallback;
    });
    s.name = 'PP-FRACPUMP';
    return s;
  }, [gltfScene, themeVersion]); // eslint-disable-line react-hooks/exhaustive-deps
}

function Bodies({ transforms, version }) {
  const gltf = useGLTF(EFRAC_URL, undefined, undefined, withKtx);
  const themeVersion = useTheme(st => st.version);
  const scene = useTemplate(gltf.scene, themeVersion);
  const C = EFRAC.cabinet, cx = (C.x0 + C.x1) / 2;
  return (
    <Instanced transforms={transforms} version={version + ':' + themeVersion} name="PP-FRACPUMP">
      <group name="PP-FRACPUMP">
        <primitive object={scene} />
        {/* customer logo on both faces of the drive cabinets, under the pump numbers (Drop 82); nothing without a theme logo */}
        <LogoPlate position={[cx, 2.75, C.zFace[0] + 0.005]} width={1.6} maxHeight={0.5} />
        <LogoPlate position={[cx, 2.75, C.zFace[1] - 0.005]} rotation={[0, Math.PI, 0]} width={1.6} maxHeight={0.5} />
      </group>
    </Instanced>
  );
}
// `transforms`: one per trailer ({ position, rotation }); `version` re-bakes (the logo decoding, the fleet)
export function EfracTrailers({ transforms, version = 0 }) {
  return <Suspense fallback={null}><Bodies transforms={transforms} version={version} /></Suspense>;
}
export function preloadEfrac() { useGLTF.preload(EFRAC_URL, undefined, undefined, withKtx); }

// Per-trailer live parts over the instanced body: a number sign and a status lamp per pump on both cabinet faces,
// and a work light over the cabinets after dark. `numbers` holds one or two pump numbers.
export function EfracLive({ position, rotation = [0, 0, 0], online = false, numbers = [], night = false, name }) {
  const C = EFRAC.cabinet;
  const xs = [C.x0 + 0.85, C.x1 - 0.85];
  return (
    <group position={position} rotation={rotation} name={name}>
      {C.zFace.map((z, f) => (
        <group key={f}>
          {numbers.map((n, i) => (
            <group key={n}>
              <Sign lines={['PUMP ' + n]} position={[xs[i], 3.55, z + (f === 0 ? 0.01 : -0.01)]} rotation={[0, f === 0 ? 0 : Math.PI, 0]} width={0.9} height={0.4} bg="#1a1a1a" fg="#ffffff" />
              <mesh position={[xs[i], 3.2, z + (f === 0 ? 0.06 : -0.06)]}>
                <sphereGeometry args={[0.07, 8, 8]} />
                <meshStandardMaterial color={online ? '#35e08f' : '#555'} emissive={online ? '#35e08f' : '#000'} emissiveIntensity={1.5} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {night && (
        <group position={[(C.x0 + C.x1) / 2, C.y1 + 0.12, C.zFace[0] + 0.1]}>
          <mesh><boxGeometry args={[0.3, 0.1, 0.16]} /><meshStandardMaterial color="#fff6dc" emissive="#fff0c8" emissiveIntensity={2.2} toneMapped={false} /></mesh>
          <sprite position={[0, -0.1, 0.1]} scale={[1.6, 1.6, 1]}><spriteMaterial map={glowTexture()} color="#ffe9b0" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} /></sprite>
        </group>
      )}
    </group>
  );
}

// Power cables (Drop 91). An electric fleet's pumps run on cable, and on a real pad the cable is what you trip over:
// bundles from the switchgear along the ground to each trailer, rising into the drive cabinets at the gooseneck end.
// Three cables per run. The switchgear's cabinet end is the anchor (per fleet); a west trunk runs north just outside the
// west row's cabinet ends, an east trunk crosses south of the row and runs north between the east row's cabinet ends
// and the treating line riser; each trailer takes three drops from its trunk up the cabinet face. Straight legs are
// cylinders merged into one mesh (about 2,000 triangles for a fleet), with a bead at every bend.
const CABLE_R = 0.045, CABLE_Y = 0.07;
function legs(points, r) {
  const out = []; const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i + 1 < points.length; i++) {
    const a = new THREE.Vector3(...points[i]), b = new THREE.Vector3(...points[i + 1]);
    const d = new THREE.Vector3().subVectors(b, a); const len = d.length(); if (len < 0.01) continue;
    q.setFromUnitVectors(up, d.clone().normalize()); e.setFromQuaternion(q);
    const m = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    out.push({ g: GEO.cyl(r, len, 7), p: [m.x, m.y, m.z], r: [e.x, e.y, e.z] });
    if (i + 2 < points.length) out.push({ g: GEO.sphere(r, 6, 5), p: points[i + 1] });
  }
  return out;
}
// `trailers`: [{ side, x, z }] (scene frame); `anchor`: [x, y, z] where the cables leave the switchgear; `missileX`
export function EfracCables({ trailers, anchor, missileX }) {
  // keyed by value: the scene renders every sim tick and builds `trailers` fresh each time (the Drop 89 lesson)
  const key = JSON.stringify([trailers.map(t => [t.side, +t.x.toFixed(2), +t.z.toFixed(2)]), anchor, missileX]);
  const parts = useMemo(() => {
    const east = trailers.filter(t => t.side === 1), west = trailers.filter(t => t.side === -1);
    const frontE = missileX + EFRAC.standoff + 2 * EFRAC.half, frontW = missileX - EFRAC.standoff - 2 * EFRAC.half;   // the cabinet faces
    const trunkE = frontE + 0.56, trunkW = frontW - 1.2;
    const [ax, ay, az] = anchor;
    const zC = -24.5;                                                        // the east crossing, south of the row
    const zEnd = (list) => Math.max(...list.map(t => t.z)) + 0.8;
    const runs = [];
    if (west.length) runs.push([[ax, ay, az], [ax + 0.6, CABLE_Y, az], [ax + 0.6, CABLE_Y, -21], [trunkW, CABLE_Y, -21], [trunkW, CABLE_Y, zEnd(west)]]);
    if (east.length) runs.push([[ax, ay, az], [ax + 0.6, CABLE_Y, az], [ax + 0.6, CABLE_Y, zC], [trunkE, CABLE_Y, zC], [trunkE, CABLE_Y, zEnd(east)]]);
    const all = [];
    for (const run of runs) for (let k = -1; k <= 1; k++) all.push(...legs(run.map(([x, y, z]) => [x + k * 0.11, y, z + k * 0.11]), CABLE_R));
    for (const t of trailers) {
      const trunk = t.side === 1 ? trunkE : trunkW, face = t.side === 1 ? frontE : frontW;
      const fx = face + t.side * 0.08;                                     // the risers hug the cabinet face
      for (let k = -1; k <= 1; k++) {
        const z = t.z + k * 0.32;
        all.push(...legs([[trunk, CABLE_Y, z], [fx, CABLE_Y, z], [fx, EFRAC.cabinet.y0 + 0.08, z]], CABLE_R));
      }
    }
    return all;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Merged mat={MAT.rubber} parts={() => parts} deps={[parts]} name="PP-POWERGEN-CABLES" />;
}
