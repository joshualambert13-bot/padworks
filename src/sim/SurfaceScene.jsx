import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSim, padRoles, nextSteps, basinOf, spreadSizing } from './store.js';
import { useHover, pickHandlers } from './hover.js';
import { SkyDome, SceneEnvironment, Clouds, SunLight, Exposure, skyFor, sunFor, seasonSky, seasonSun, installSnowPatch, SNOW, GRIME, Flurries, LITE, HdriSky, hdriActive, glowTexture } from './parts/lighting.jsx';
import { Totes, IronRack, Cones, Barricades, Welfare, FuelCube, SafetyPoint, HoseCoils } from './parts/padlife.jsx';
import { useHdri } from './parts/hdri.js';
import { WalkControls, LAST_TARGET } from './parts/walk.jsx';
import { installTextureSets } from './parts/textures.js';
import { SOURCES } from './sound.js';
installSnowPatch();
import { Effects, Diagnostics } from './parts/effects.jsx';
import { ContextLoss } from './parts/stability.jsx';
import { Crew, Walker, Windsock, Flag, Flagpoles, Sign, PLUME } from './parts/life.jsx';
import { ParkedPickups, RoadTruck } from './parts/vehicles.jsx';
import { terrainHeight } from './parts/terrain.js';
import { Ground, FracTree, FracTreeIron, FracTreeTop, ProductionTreeIron, dimTint, lubricatorTopY, ProductionTree, BopStack, WorkoverRig, ZipperManifold, ZIPPER_X, zipperDims, Missile, MISSILE_PITCH, missileDims, FracPump, FracPumpLive, PowerGen, Blender, Hydration, ChemAdd, SandSilos, SandBoxStation, ShuttleForklift, CRADLE_X, CRADLE_Z, SandBoxes, WaterTanks, DataVan, WirelineUnit, CTUnit, FlowbackSpread, RedZone, treeDims, BORE_M, Containment, FuelTrailers, LightTower, FlangedRun, WELL_COLORS, Accumulator, HydraulicStand, standLayout, HOSE_BUNDLE_X, ZIPPER_BUNDLE_X, WaterTransfer, WaterPit, StorageTank } from './parts/surface.jsx';
import { PipeRun, PipeStands, Pipe, Hose, MAT, Label, Instanced } from './parts/primitives.jsx';

const WELL_SPACING = 8;   // meters between wellheads along the row
const MISSILE_X = -30;    // missile centerline; pumps park nose-in on both sides

function Ticker({ enabled }) {
  const tick = useSim(s => s.tick);
  useFrame((_, dt) => { if (enabled) tick(dt); });
  return null;
}

function presets(rowCenter, rowLen, production = false, k = 1, bZ = 20, rig = false) {
  return {
    // production: the workover rig's substructure sits on the +X side of the well, so the rig-up view comes from -X
    ...(production ? { tree: rig ? { pos: [-6.5, 4.5, 5.5], target: [0.3, 2.6, 0] } : { pos: [6.0, 4.0, 6.5], target: [0.3, 1.9, 0] } } : {}),
    pad:   { pos: [30 + rowLen * 0.25, 34 + rowLen * 0.2, 70 + rowLen * 0.35], target: [-18, 0, rowCenter] },
    ...(production ? {} : { tree: { pos: [11 * k, 7.5 * k, 12 * k], target: [0, 3.2 * k, 0] } }),
    row:   { pos: [30 + rowLen * 0.45, 12 + rowLen * 0.18, rowCenter + 6], target: [-2, 3.5, rowCenter] },
    zipper: { pos: [-17, 7, rowCenter - 15], target: [-8, 2.4, rowCenter - 1] },
    pumps: { pos: [-6, 19, 38], target: [-30, 2, 4] },
    sand:  { pos: [-12, 16, bZ + 26], target: [-40, 3, bZ - 4] },
    tanks: { pos: [-58, 14, 66], target: [-70, 2, 40] },
    gate: { pos: [78, 7, -12], target: [52, 1, -31] },
    support: { pos: [-2, 16, -60], target: [-22, 2, -34] },
    flowback: { pos: [34, 14, 44 + rowLen], target: [26, 1, 20 + rowLen] },
    basin: { pos: [90, 60, 160 + rowLen], target: [-20, 0, rowCenter] },
  };
}

// Render counters for the headless checks (window.__padworksStats), no cost when nobody reads them.
// Test hooks (the draw counters moved into Diagnostics in effects.jsx, Drop 45: one reader, one reset per frame)
function RenderStats() {
  useFrame((state) => {
    window.__padworksScene = state.scene;
    if (state.controls && state.controls.target) LAST_TARGET.copy(state.controls.target);
    window.__padworksCam = () => ({ pos: state.camera.position.toArray(), target: state.controls ? state.controls.target.toArray() : null });
    window.__padworksView = (pos, target) => { state.camera.position.set(...pos); if (state.controls) { state.controls.target.set(...target); state.controls.update(); } };
  });
  return null;
}
function CameraPreset({ preset, rowCenter, rowLen, production, k, bZ, rig, walk }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    if (walk) return;   // walk mode owns the camera; leaving it re-applies the preset
    const P = presets(rowCenter, rowLen, production, k, bZ, rig);
    const p = P[preset] || P.pad;
    camera.position.set(...p.pos);
    if (controls) { controls.target.set(...p.target); controls.update(); }
  }, [preset, camera, controls, rowCenter, rowLen, production, k, bZ, rig, walk]);
  return null;
}

// Camera focus: when a next-step or lesson button is pressed the camera glides to the equipment that step is about
// (a tree valve at its own height from the operator side, the zipper leg, the missile inlet, the pumps, the wireline
// or coil unit, the flowback spread). Anything the person does with the mouse afterwards takes over as usual.
function focusView(f, c) {
  const v = f.valve, a = f.action;
  const P = presets(c.rowCenter, c.rowLen, c.production, c.k, c.bZ, c.rig);
  const d = c.d, zd = c.zd;
  const treeY = { lmv: d.lmvY, umv: d.umvY, crown: d.crownY, swab: d.swabY, wingA: d.crossY, wingB: d.crossY }[v];
  if (treeY != null) return { pos: [v === 'wingB' ? 6 : -5, treeY + 2.4, -6], target: [v === 'wingA' ? -d.wingOuterX : v === 'wingB' ? d.wingOuterX : 0, treeY, 0] };
  if (v === 'iso') return { pos: [ZIPPER_X + 6.5, 4, c.zipperFrontZ - 6], target: [ZIPPER_X - 1, 0.7, c.zipperFrontZ + 0.9] };
  if (v === 'zipIso' || v === 'zipWork') return { pos: [ZIPPER_X + 6, 4.5, -7], target: [ZIPPER_X - 1, v === 'zipIso' ? zd.isoY : zd.workY, 0] };
  switch (a) {
    case 'start': case 'reset': return P.pad;
    case 'run': case 'fire': case 'rerunGuns': case 'workLine': case 'phaseWireline': return c.sleeve ? { pos: [9, d.topY + 4, 9], target: [0, d.topY, 0] } : { pos: [-10, 13, -14], target: [5, 7, 3] };
    case 'pumpsOn': case 'pumpsOff': case 'rateLow': case 'rateFlush': case 'rateZero': case 'stop': case 'ppaZero': case 'phaseFrac': case 'ack': return P.pumps;
    case 'phaseDrillout': return { pos: [-10, 13, 14], target: [5, 7, -3] };
    case 'phaseFlowback': return P.flowback;
    case 'phaseProduction': case 'hookupNext': return P.tree;
    case 'nextStage': return P.row;
    case 'resetActuator': return { pos: [ZIPPER_X + 6, 4.5, -7], target: [ZIPPER_X - 1, zd.workY, 0] };
    default: return null;
  }
}
// Light plants by work area (Drop 37): each entry is [x, z, aimX, aimZ], the tower's spot on the pad and the point on
// the ground its lamps are aimed at. Both wellhead row ends, both ends of the pump row, the sand and water side, the
// hydration and chemical side, the data van, and the flowback spread. Ten towers against the four of Drop 31.
const PIT_POS = [-112, 0, 26];
const TOWERS = (rowLen, bZ) => [
  [6, -11, -2, -3], [-16, -20, -6, -4],                       // wellhead row, south end (treating line runs at z -12.6, kept clear)
  [6, rowLen + 11, -2, rowLen + 3], [-14, rowLen + 11, -6, rowLen + 3],   // wellhead row, north end
  [-46, -12, -32, -2], [-46, 22, -32, 12],                     // pump row, west side, both ends
  [-44, bZ + 8, -56, bZ - 1], [-22, bZ + 9, -24, bZ + 1],      // sand and water side; hydration and chemical side
  [-20, -40, -14, -30], [26, rowLen + 28, 16, rowLen + 22],   // data van; flowback spread
];
// Night (Drop 31): one shadowless spot light at each light tower's lamp head, aimed at its work area. Spot lights
// cost per-fragment shader work in every material, so they exist only while the night preset is on; the first
// switch recompiles the materials (a short hitch), after which the frame cost is steady.
function TowerLights({ towers }) {
  const targets = useMemo(() => towers.map(() => new THREE.Object3D()), [towers.length]);
  return towers.map(([x, z, ax, az], i) => (
    <group key={i}>
      <primitive object={targets[i]} position={[ax, 0, az]} />
      <spotLight position={[x - 0.6, 10.2, z]} target={targets[i]} color="#ffeec4" intensity={95} distance={120} angle={0.8} penumbra={0.6} decay={1.5} />
    </group>
  ));
}
// Lamp-head glow at each tower after dark (Drop 48): one additive sprite per tower, the haze around a metal halide
// head that bloom gives in Full and nothing gave in Lite
function LampGlow({ towers, strength = 1 }) {
  const tex = useMemo(() => glowTexture(), []);
  return towers.map(([x, z], i) => (
    <sprite key={i} position={[x - 0.6, 10.3, z]} scale={[4.5 * strength, 4.5 * strength, 1]}>
      <spriteMaterial map={tex} color="#ffe9b0" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
    </sprite>
  ));
}
// Sets the shared snow and grime uniforms for this scene's draws only (the downhole section and the viewer stay
// bare and clean)
function SnowSetter({ amount }) {
  const scene = useThree(st => st.scene);
  useEffect(() => {
    scene.onBeforeRender = () => { SNOW.value = amount; GRIME.value = 1; };
    scene.onAfterRender = () => { SNOW.value = 0; GRIME.value = 0; };
    return () => { scene.onBeforeRender = () => {}; scene.onAfterRender = () => {}; SNOW.value = 0; GRIME.value = 0; };
  }, [scene, amount]);
  return null;
}
function FocusCamera({ ctx }) {
  const focus = useSim(s => s.ui.focus);
  const camera = useThree(s => s.camera);
  // the request is consumed inside the frame loop, once the controls exist: a phase change can hide and re-show
  // this tree (equipment loading), and an effect that ran while the controls were being replaced would be lost
  const pending = useRef(null), anim = useRef(null), seen = useRef(0), ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  useEffect(() => { if (focus && focus.n !== seen.current) { seen.current = focus.n; pending.current = focus; } }, [focus]);
  useFrame((state, dt) => {
    const controls = state.controls;
    if (pending.current && controls) {
      const view = focusView(pending.current, ctxRef.current);
      pending.current = null;
      if (view) anim.current = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...view.pos), t1: new THREE.Vector3(...view.target) };
    }
    const an = anim.current; if (!an || !controls) return;
    an.t = Math.min(1, an.t + Math.min(dt, 0.1) / 0.8);
    const k = an.t < 0.5 ? 2 * an.t * an.t : 1 - Math.pow(-2 * an.t + 2, 2) / 2;
    camera.position.lerpVectors(an.p0, an.p1, k);
    controls.target.lerpVectors(an.t0, an.t1, k);
    controls.update();
    if (an.t >= 1) anim.current = null;
  });
  return null;
}

// Valve pattern for a partner well that follows the crews automatically.
function partnerValves(role) {
  const v = (pos) => ({ pos, target: pos });
  if (role === 'frac') return { lmv: v(1), umv: v(1), wingA: v(0), wingB: v(0), crown: v(1), swab: v(0), iso: v(1), zipIso: v(1), zipWork: v(1) };
  if (role === 'wireline') return { lmv: v(1), umv: v(1), wingA: v(1), wingB: v(0), crown: v(1), swab: v(1), iso: v(1), zipIso: v(0), zipWork: v(0) };
  if (role === 'done') return { lmv: v(1), umv: v(1), wingA: v(0), wingB: v(1), crown: v(0), swab: v(0), iso: v(1), zipIso: v(0), zipWork: v(0) };
  return { lmv: v(1), umv: v(0), wingA: v(0), wingB: v(0), crown: v(0), swab: v(0), iso: v(1), zipIso: v(1), zipWork: v(0) };
}

export default function SurfaceScene({ showLabels, preset, tickHere = true }) {
  const s = useSim();
  useEffect(() => { installTextureSets(); }, []);   // optional photo texture sets in public/textures (Drop 44)
  const pumping = s.pumpsOnline && s.pumpRate > 0 && s.phase !== 'setup';
  const bore = BORE_M[s.pad.bore] || 0.18;
  const d = treeDims(bore);
  const zd = zipperDims(bore);
  const roles = padRoles(s);
  const basin = basinOf(s);
  const tod = useSim(st => st.ui.tod) || 'day';
  const season = useSim(st => st.ui.season) || 'summer';
  const walk = !!useSim(st => st.ui.walk);
  const winter = season === 'winter';
  const snow = winter ? (basin.snow == null ? 0.6 : basin.snow) : 0;
  const hdriStatus = useHdri(st => st[tod]);
  const hdri = hdriActive(tod, season, hdriStatus);   // photographic sky in place of the atmosphere model (Drop 47)
  const terrain = seasonSky(skyFor(basin.terrain, tod), season, tod);
  const sun = seasonSun(sunFor(tod), season);
  PLUME.boost = winter ? 1.7 : 1;
  const sleeve = s.setup.completion === 'sleeve';
  const spread = spreadSizing(s);
  const guideStep = nextSteps(s).steps.find(x => !x.done);
  const focusValve = guideStep && guideStep.valve ? guideStep.valve : null;
  const wellZ = useMemo(() => roles.map((_, i) => i * WELL_SPACING), [roles.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowCenter = (wellZ[0] + wellZ[wellZ.length - 1]) / 2;
  const rowLen = wellZ[wellZ.length - 1] - wellZ[0];
  const coneSpots = useMemo(() => [...Array.from({ length: 8 }, (_, i) => [-34 + i * 6.3, -15.6]), ...Array.from({ length: 8 }, (_, i) => [-34 + i * 6.3, rowLen + 11.6])], [rowLen]);   // red zone corners (Drop 48)
  const treeTop = [0, d.topY, 0];
  const lubTop = lubricatorTopY(d, bore);
  // pumps: nose-in on both sides of the missile, one per pitch
  const pumpCount = spread.pumps;
  const perSide = Math.ceil(pumpCount / 2);
  const md = missileDims(perSide);
  const missileOutletZ = -8;                                            // the high-pressure outlet end stays near the zipper front
  const missileZ = missileOutletZ + perSide * MISSILE_PITCH / 2 + 0.9;
  const pumps = [];
  for (let i = 0; i < pumpCount; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const k = Math.floor(i / 2);
    const zLocal = (k - (perSide - 1) / 2) * MISSILE_PITCH;
    pumps.push({ side, z: missileZ - zLocal, x: MISSILE_X + side * 8.0 });
  }
  const pumpTransforms = useMemo(() => pumps.map(p => ({ position: [p.x, 0, p.z], rotation: [0, p.side === 1 ? Math.PI : 0, 0] })), [pumps.length, missileZ, perSide]); // eslint-disable-line react-hooks/exhaustive-deps
  const wlWells = roles.filter(r => r.role === 'wireline');
  const show = useHover(h => h.show), hide = useHover(h => h.hide);
  const pick = pickHandlers('surface', show, hide);
  const rear = missileZ + md.len / 2;                                   // low-pressure inlet end of the missile
  const bZ = rear + 8.2;                                                // blender centerline: its discharge end sits 3 m behind the missile
  const water = basin.water || 'tanks';
  const towerTransforms = useMemo(() => TOWERS(rowLen, bZ).map(([x, z, ax, az]) => ({ position: [x, 0, z], rotation: [0, Math.atan2(ax - x, az - z), 0] })), [rowLen, bZ]);
  const pad = useMemo(() => ({ x0: water === 'pit' ? -138 : -84, x1: 44, z0: -44, z1: Math.max(rowLen + 50, bZ + 22) }), [rowLen, bZ, water]);
  // Pad stain layout (Drop 44): truck lanes, compaction, drips and spills drawn from where things actually are
  const sandMode = s.setup.sand === 'boxes' ? 'boxes' : 'silos';
  const fuelCount = (s.setup.fleet !== 'diesel' && s.setup.fleet !== 'grid') ? Math.min(8, 3 + Math.round(spread.pumps / 3)) : 0;
  const stainLayout = useMemo(() => {
    const lanes = [
      [[pad.x1 + 2, -32], [38, -32], [38, rowLen + 36], [-62, rowLen + 36], [-62, -36], [-4, -36]],   // entrance, east service loop, north and west legs
      [[-14, -33], [-14, bZ - 6]],                                                                     // east pump lane (trucks back in from here)
      [[-47, -33], [-47, bZ - 19], [Math.max(pad.x0 + 4, -88), bZ - 19]],                              // west pump lane, on to the sand and water side
      [[26, -32], [26, rowLen + 36]],                                                                  // wellhead service lane (wireline, coil, flowback)
    ];
    const spots = [];
    pumps.forEach(p => {
      spots.push({ x: p.x + p.side * 3.0, z: p.z, rx: 2.4, rz: 1.2, a: 0.32, drips: 14 });              // oil under the power end
      spots.push({ x: p.x, z: p.z, rx: 6.5, rz: 1.5, a: 0.12 });                                         // compaction under the trailer
    });
    spots.push({ x: MISSILE_X, z: bZ, rx: 7, rz: 4.5, a: 0.22 });                                         // slurry around the blender
    spots.push({ x: MISSILE_X, z: bZ - 5, rx: 3.5, rz: 2, a: 0.16, light: true });                        // dry sand at the hopper
    spots.push({ x: MISSILE_X + 8, z: bZ + 0.5, rx: 4.5, rz: 3, a: 0.2 });                                // hydration unit
    spots.push({ x: MISSILE_X + 16, z: bZ + 1, rx: 3, rz: 2, a: 0.16, drips: 8 });                        // chemical add
    for (let i = 0; i < fuelCount; i++) spots.push({ x: 7.5, z: -39.5 + i * 3.6, rx: 1.4, rz: 0.9, a: 0.2, drips: 5 });   // diesel at the fuel row
    spots.push({ x: -19.5, z: -30, rx: 1.6, rz: 1.2, a: 0.25, drips: 6 });                                // data van generator
    spots.push({ x: 14, z: 22 + rowLen, rx: 9, rz: 5, a: 0.26 });                                         // flowback tanks and choke
    wellZ.forEach(z => spots.push({ x: 0, z, rx: 3.2, rz: 3.2, a: 0.18 }));                               // cellar ring
    if (water === 'tanks' || water === 'heated') spots.push({ x: -80, z: 31, rx: 12, rz: 2.5, a: 0.2 });   // under the tank manifolds
    if (water === 'ast') spots.push({ x: -65, z: 29, rx: 14, rz: 2.5, a: 0.18 });
    if (water === 'pit') spots.push({ x: PIT_POS[0] + 24, z: PIT_POS[2], rx: 4, rz: 2.5, a: 0.18 });      // bank pump
    if (sandMode === 'boxes') { spots.push({ x: MISSILE_X - 50, z: bZ - 12, rx: 8, rz: 5, a: 0.2, light: true }); spots.push({ x: MISSILE_X - 19.6 - 5.75, z: bZ - 6, rx: 5, rz: 3, a: 0.18, light: true }); }
    else spots.push({ x: MISSILE_X - 19.6, z: bZ - 6, rx: 7, rz: 4, a: 0.2, light: true });               // spilled sand at the silos or boxes
    const rects = [{ x0: 26, z0: -38.5, x1: 34, z1: -36 + 7 * 3.2, a: 0.1 }];                             // pickups
    if (fuelCount) rects.push({ x0: 5.5, z0: -41, x1: 18.5, z1: -39.5 + fuelCount * 3.6 - 1.8, a: 0.08 });
    return { pad, lanes, spots, rects };
  }, [pad, rowLen, bZ, pumps.length, missileZ, perSide, wellZ, water, sandMode, fuelCount]); // eslint-disable-line react-hooks/exhaustive-deps
  const zipperFrontZ = rowCenter - (rowLen + 6.0) / 2;
  const ACC = [-2, -22];
  const treatingLine = useMemo(() => [[MISSILE_X, md.hpY, missileOutletZ], [MISSILE_X, md.hpY, missileOutletZ - 1.4], [MISSILE_X + 2, 0.9, missileOutletZ - 2.6], [ZIPPER_X - 1.0, 0.9, missileOutletZ - 2.6], [ZIPPER_X - 1.0, zd.headerY, zipperFrontZ + 0.9 - zd.ftf / 2 - 0.1]], [md.hpY, missileOutletZ, zd.headerY, zd.ftf, zipperFrontZ]);
  const flowbackLine = useMemo(() => [[d.wingOuterX + d.ftf / 2, d.crossY, 0], [d.wingOuterX + 3, d.crossY, 0], [d.wingOuterX + 4, 2.0, 0], [d.wingOuterX + 4, 0.9, 6], [12.8, 0.9, 21.4 + rowLen]], [d.wingOuterX, d.ftf, d.crossY, rowLen]);
  const stands = useMemo(() => standLayout(roles.length, ACC, 5), [roles.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // where the working sounds come from, for the positional mix while walking (Drop 60): pad meters [x, z]
  useEffect(() => {
    SOURCES.pump = [MISSILE_X, missileZ]; SOURCES.choke = [14, 22 + rowLen]; SOURCES.wl = [16.5, 3]; SOURCES.ct = [18.5, -10]; SOURCES.mill = [0, 0];
  }, [missileZ, rowLen]);
  // wells that carry a frac tree (the manual well until it goes on production, partners until they are done) and,
  // among them, the ones with a bare top adapter (no lubricator, no ball launcher)
  const hasTree = roles.map((r, i) => (i === 0 ? s.phase !== 'production' : r.role !== 'done'));
  const bareTop = roles.map((r, i) => hasTree[i] && !sleeve && (i === 0 ? !s.lubricatorRigged : r.role !== 'wireline'));
  const treeKey = hasTree.map(x => (x ? 1 : 0)).join('') + '|' + wellZ.join(',');
  const topKey = bareTop.map(x => (x ? 1 : 0)).join('') + '|' + wellZ.join(',');
  const treeSpots = useMemo(() => roles.map((r, i) => i).filter(i => hasTree[i]).map(i => ({ position: [0, 0, wellZ[i]], tint: i === 0 ? WELL_COLORS[i % WELL_COLORS.length] : dimTint(WELL_COLORS[i % WELL_COLORS.length]) })), [treeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const topSpots = useMemo(() => roles.map((r, i) => i).filter(i => bareTop[i]).map(i => ({ position: [0, 0, wellZ[i]] })), [topKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // wells on production with a production tree on them (the manual well once its hookup is past the rig, partners once done)
  const hasProd = roles.map((r, i) => (i === 0 ? s.phase === 'production' && s.hookup.step !== 'rig' && s.hookup.step !== 'tubing' : r.role === 'done'));
  const prodKey = hasProd.map(x => (x ? 1 : 0)).join('') + '|' + wellZ.join(',');
  const prodSpots = useMemo(() => roles.map((r, i) => i).filter(i => hasProd[i]).map(i => ({ position: [0, 0, wellZ[i]], tint: i === 0 ? WELL_COLORS[i % WELL_COLORS.length] : dimTint(WELL_COLORS[i % WELL_COLORS.length]) })), [prodKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Canvas shadows={LITE ? true : { type: THREE.PCFShadowMap }} dpr={[1, 1.5]} camera={{ position: [30, 34, 70], fov: 45, near: 0.1, far: 2600 }} gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.05 * 1.25 }}>
      <HdriSky tod={tod} season={season} />
      {!hdri && <SkyDome terrain={terrain} tod={tod} season={season} />}
      {LITE && <Clouds seed={basin.id.length} count={winter ? 18 : 9} tint={winter ? (tod === 'night' ? '#141822' : '#c9cfd8') : tod === 'dusk' ? '#f2a988' : tod === 'night' ? '#1c2235' : '#ffffff'} />}
      <SnowSetter amount={snow} />
      {winter && snow >= 0.5 && <Flurries density={snow} />}
      {!hdri && <SceneEnvironment terrain={terrain} tod={tod} season={season} />}
      <Exposure value={sun.exposure} />
      {LITE && <hemisphereLight args={[terrain.sky, terrain.ground, sun.liteHemi]} />}
      <fog attach="fog" args={[terrain.fog, 180 + rowLen, 620 + rowLen]} />
      <ambientLight intensity={sun.ambient} />
      <SunLight tod={tod} />
      
      <RenderStats />
      <Diagnostics />
      <ContextLoss />
      <hemisphereLight args={[terrain.sky, terrain.ground, sun.hemi]} />
      <Ticker enabled={tickHere} />
      <CameraPreset walk={walk} preset={preset} rowCenter={rowCenter} rowLen={rowLen} production={s.phase === 'production'} rig={s.phase === 'production' && (s.hookup.step === 'rig' || s.hookup.step === 'tubing')} k={0.6 + 0.4 * bore / 0.18} bZ={bZ} />
      <FocusCamera ctx={{ rowCenter, rowLen, production: s.phase === 'production', rig: s.phase === 'production' && (s.hookup.step === 'rig' || s.hookup.step === 'tubing'), k: 0.6 + 0.4 * bore / 0.18, bZ, d, zd, zipperFrontZ, sleeve }} />
      <Ground terrain={terrain} pad={pad} seed={basin.id.length} stain={stainLayout} />
      <Containment x0={-3.2} x1={4.2} z0={-3.5} z1={rowLen + 3.5} />
      <RedZone visible={pumping} x0={-34} xm={-14} x1={10} z0={-14} zm={rear + 1.5} z1={rowLen + 10} />
      <group {...pick}>

      {/* the row of wells: well 0 is under manual control, the others follow the crews. The frac trees' shared
          iron is one instanced set over the wells that carry a frac tree (Drop 57), tinted per well; the top
          adapter another over the wells with nothing rigged on top; each well then draws only its moving parts. */}
      {treeSpots.length > 0 && (
        <Instanced transforms={treeSpots} version={bore} name="WH-FRACTREE">
          <FracTreeIron bore={bore} />
        </Instanced>
      )}
      {topSpots.length > 0 && (
        <Instanced transforms={topSpots} version={bore} name="WH-FRACTREE-TOPADAPTER">
          <FracTreeTop bore={bore} />
        </Instanced>
      )}
      {prodSpots.length > 0 && (
        <Instanced transforms={prodSpots} name="UC-PRODTREE">
          <ProductionTreeIron />
        </Instanced>
      )}
      {roles.map((r, i) => (
        <group key={i} position={[0, 0, wellZ[i]]}>
          {i === 0
            ? (s.phase === 'production'
              ? (s.hookup.step === 'rig' || s.hookup.step === 'tubing'
                ? <BopStack showLabels={showLabels && preset === 'tree'} />
                : <ProductionTree showLabels={showLabels && preset === 'tree'} tint={WELL_COLORS[i % WELL_COLORS.length]} lift={s.hookup.step === 'done' ? s.setup.lift : 'flow'} />)
              : <FracTree valves={s.valves} showLabels={showLabels && preset === 'tree'} lubricator={s.lubricatorRigged} wlStep={s.wl.step} bore={bore} focusValve={focusValve} launcher={sleeve} ballsLeft={Math.max(0, s.stages.length - 1 - s.ballsDropped)} wellNo={1} pumping={pumping} />)
            : (r.role === 'done'
              ? <ProductionTree showLabels={false} partner tint={WELL_COLORS[i % WELL_COLORS.length]} lift={s.setup.lift} />
              : <FracTree valves={partnerValves(r.role)} showLabels={false} lubricator={!sleeve && r.role === 'wireline'} wlStep={r.role === 'wireline' ? 'pumpdown' : 'idle'} bore={bore} dim launcher={sleeve} ballsLeft={3} wellNo={i + 1} pumping={r.role === 'frac'} />)}
          {/* flanged treating spools from the zipper leg outlet up to the inlet block, in the well's color (gone once the well is on production) */}
          {!((i === 0 && s.phase === 'production') || (i > 0 && r.role === 'done')) && (
            <FlangedRun points={[[ZIPPER_X - 1.0 + zd.outletX, zd.topY, 0], [(ZIPPER_X - 1.0 + zd.outletX - bore * 2.6) / 2, zd.topY, 0], [-bore * 2.6, d.inletY, 0]]} r={bore * 0.6} color={WELL_COLORS[i % WELL_COLORS.length]} />
          )}
          {showLabels && i > 0 && <Label position={[2.5, d.topY + 0.6, 0]} text={'Well ' + (i + 1) + ': ' + (r.role === 'frac' ? 'pumping' : r.role === 'wireline' ? (sleeve ? 'ball drop' : 'wireline') : r.role === 'done' ? 'complete' : 'waiting') + ' · stage ' + Math.min(r.stage + 1, s.stages.length)} />}
          {i === 0 && showLabels && <Label position={[2.5, d.topY + 0.6, 0]} text={'Well 1: your well'} />}
        </group>
      ))}
      <ZipperManifold valves={s.valves} showLabels={showLabels} wellZ={wellZ} roles={roles} bore={bore} focusValve={focusValve} />
      {/* treating line: missile high-pressure outlet to the zipper inlet isolation valve */}
      <PipeRun points={treatingLine} r={0.14} mat={MAT.darkSteel} />
      <PipeStands points={treatingLine} r={0.14} every={3.0} />
      <Missile position={[MISSILE_X, 0, missileZ]} showLabels={showLabels} perSide={perSide} prvLifted={s.alarms.prvLifted} pumping={pumping} />
      {/* pump bodies as one instanced set (Drop 41); fans, lamps, plumes, and numbers per pump on top */}
      <Instanced transforms={pumpTransforms} version={spread.electric ? 1 : 0} name="PP-FRACPUMP">
        <FracPump position={[0, 0, 0]} name="PP-FRACPUMP" electric={spread.electric} template />
      </Instanced>
      {pumps.map((p, i) => (
        <group key={i}>
          <FracPumpLive position={[p.x, 0, p.z]} rotation={[0, p.side === 1 ? Math.PI : 0, 0]} online={s.pumpsOnline && !s.alarms.kickout && s.phase !== 'setup'} rate={s.pumpRate} name={'PP-FRACPUMP-' + (i + 1)} electric={spread.electric} number={i + 1} night={tod === 'night'} />
          {/* discharge: swivel arm from the missile feed port over to the end of the pump's own discharge iron (at its nose, 2.18 m up, offset to its +z side); suction: hose from the low-pressure outlet down to the pump's suction hose end at ground level */}
          <PipeRun points={[[MISSILE_X + p.side * 1.06, md.hpY, p.z], [MISSILE_X + p.side * 2.0, 2.95, p.z - p.side * 0.55], [MISSILE_X + p.side * 1.4, 2.18, p.z - p.side * 1.2]]} r={0.07} mat={MAT.redIron} />
          <Hose from={[MISSILE_X + p.side * 1.85, md.lpY, p.z]} to={[MISSILE_X + p.side * (8.0 - 3.4), 1.18 + 0.3, p.z + p.side * 1.2]} r={0.14} sag={0.45} segments={10} />
        </group>
      ))}
      {/* blender behind the missile, discharge end toward it: two suction hoses from its manifolds to the low-pressure headers; hydration and chemical units beside it, silos and conveyor feeding the hoppers */}
      <Blender position={[MISSILE_X, 0, bZ]} showLabels={showLabels} lit={tod === 'night'} />
      <Hose from={[MISSILE_X + 1.25, 1.53, bZ - 5.3]} to={[MISSILE_X + 1.15, md.lpY, rear - 0.2]} r={0.16} sag={0.25} mat={MAT.hose} segments={10} />
      <Hose from={[MISSILE_X - 1.25, 1.53, bZ - 5.3]} to={[MISSILE_X - 1.15, md.lpY, rear - 0.2]} r={0.16} sag={0.25} mat={MAT.hose} segments={10} />
      <Hydration position={[MISSILE_X + 8, 0, bZ + 0.5]} showLabels={showLabels} />
      <ChemAdd position={[MISSILE_X + 16, 0, bZ + 1]} showLabels={showLabels} />
      {/* sand system (Drop 35): silos, or a box station at the same spot feeding the same hopper with the box stack
          to the west and the handler shuttling full boxes along the lane in front of the stack to the first cradle */}
      {s.setup.sand === 'boxes' ? (
        <>
          <SandBoxStation position={[MISSILE_X - 19.6, 0, bZ - 6.0]} showLabels={showLabels} />
          <SandBoxes position={[MISSILE_X - 50, 0, bZ - 12]} showLabels={showLabels} />
          <ShuttleForklift path={[[MISSILE_X - 51.5, bZ - 18.2], [MISSILE_X - 19.6 + CRADLE_X[0], bZ - 18.2], [MISSILE_X - 19.6 + CRADLE_X[0], bZ - 6.0 + CRADLE_Z - 3.25]]} />
        </>
      ) : (
        <SandSilos position={[MISSILE_X - 19.6, 0, bZ - 6.0]} showLabels={showLabels} />
      )}
      {(s.setup.fleet !== 'diesel' && s.setup.fleet !== 'grid') && <FuelTrailers position={[12, 0, -39.5]} count={Math.min(8, 3 + Math.round(spread.pumps / 3))} showLabels={showLabels} />}
      <ParkedPickups position={[30, 0, -36]} count={7} />
      {/* light towers as one instanced set, each yawed so its lamp side (local +z) faces its aim point */}
      <Instanced transforms={towerTransforms} version={tod === 'day' ? 0 : 1} name="LG-LIGHTTOWER">
        <LightTower position={[0, 0, 0]} lit={tod !== 'day'} />
      </Instanced>
      {tod === 'night' && <TowerLights towers={TOWERS(rowLen, bZ)} />}
      {tod !== 'day' && <LampGlow towers={TOWERS(rowLen, bZ)} strength={tod === 'night' ? 1 : 0.6} />}
      {/* water source by basin (Drop 40): lined pit off the west edge (Permian, Eagle Ford, Haynesville), two storage
          tanks (Appalachia, DJ, Anadarko), or frac tanks with a frac heater (Bakken, Powder River); the rest use frac tanks */}
      {water === 'pit' && <WaterPit position={PIT_POS} frozen={winter && snow >= 0.5} showLabels={showLabels} />}
      {water === 'ast' && [0, 1].map(i => <StorageTank key={i} position={[-74 + i * 18, 0, 36]} showLabels={showLabels && i === 0} name={i === 0 ? 'PP-STORAGETANK' : undefined} />)}
      {(water === 'tanks' || water === 'heated') && <WaterTanks position={[-80, 0, 36]} showLabels={showLabels} />}
      <WaterTransfer tanks={water === 'pit' ? PIT_POS : water === 'ast' ? [-74, 0, 36] : [-80, 0, 36]} count={8} source={water} winter={winter} to={[MISSILE_X + 8 + 1.55, 1.48, bZ + 0.5 + 2.0]} showLabels={showLabels} />
      <DataVan position={[-14, 0, -30]} showLabels={showLabels} lit={tod === 'night'} />
      {/* accumulator unit outside the red zone with one remote hydraulic stand per tree-and-leg pair on an arc in front of it; supply daisy-chains from the skid stand to stand, and each stand's control hoses run on the ground to its tree trunk (along the containment) and its zipper leg trunk (along the pump side) */}
      <Accumulator position={[ACC[0], 0, ACC[1]]} showLabels={showLabels} />
      {stands.map((st, i) => (
        <group key={i}>
          <HydraulicStand position={[st.x, 0, st.z]} rotation={[0, st.rot, 0]} number={i + 1} showLabels={showLabels && i === 0} />
          {[-0.08, 0.08].map((o, k) => <Hose key={k} from={i === 0 ? [ACC[0] + 1.7 + o, 0.3, ACC[1] + 1.1] : [stands[i - 1].x + o, 0.25, stands[i - 1].z]} to={[st.x + o, 0.25, st.z]} r={0.035} sag={-0.04} segments={6} />)}
          <Hose from={[st.x, 0.3, st.z]} to={[HOSE_BUNDLE_X - 0.08 * i, 0.07, -8 - 0.3 * i]} r={0.045} sag={-0.03} segments={6} />
          <Hose from={[HOSE_BUNDLE_X - 0.08 * i, 0.07, -8 - 0.3 * i]} to={[HOSE_BUNDLE_X - 0.08 * i, 0.07, wellZ[i] - 2.3]} r={0.045} sag={-0.02} segments={4} />
          <Hose from={[st.x, 0.3, st.z]} to={[ZIPPER_BUNDLE_X + 0.08 * i, 0.07, -8 - 0.3 * i]} r={0.045} sag={-0.03} segments={6} />
          <Hose from={[ZIPPER_BUNDLE_X + 0.08 * i, 0.07, -8 - 0.3 * i]} to={[ZIPPER_BUNDLE_X + 0.08 * i, 0.07, wellZ[i]]} r={0.045} sag={-0.02} segments={4} />
        </group>
      ))}
      {/* pad life: crew at their stations, windsock and safety flag by the data van, a truck on the lease road, red zone placards */}
      <Windsock position={[-4, 0, -33]} height={6} />
      <Flag position={[-6, 0, -33]} height={7} color="#ff6a00" />
      <Flagpoles position={[-13.5, 0, -33.6]} state={basin.state || 'TX'} />
      {/* pad clutter (Drop 48): placed off the lanes and clear of the work areas */}
      <Totes position={[MISSILE_X + 14, 0, bZ + 6]} count={6} />
      <SafetyPoint position={[MISSILE_X + 9.5, 0, bZ + 4.6]} rotation={[0, Math.PI / 2, 0]} />
      <IronRack position={[MISSILE_X - 6, 0, -19.5]} />
      <Cones spots={coneSpots} />
      <Barricades position={[MISSILE_X - 16, 0, -9.6]} count={3} />
      <Barricades position={[MISSILE_X + 10, 0, -9.6]} count={3} />
      <Welfare position={[18.5, 0, -41]} />
      <FuelCube position={[MISSILE_X - 11, 0, -27]} />
      <SafetyPoint position={[3.5, 0, -36]} />
      <HoseCoils position={[-56, 0, bZ + 14]} rotation={[0, 0.4, 0]} />
      <Crew position={[-7.2, 0, -27.6]} rotation={-0.6} pose="stand" seed={1} />
      <Crew position={[-8.6, 0, -27.2]} rotation={0.9} pose="point" vest="#e8e83a" seed={2} />
      <Crew position={[ACC[0] + 0.4, 0, ACC[1] + 2.1]} rotation={Math.PI} pose="stand" seed={3} />
      <Crew position={[-77, 0, 8.5]} rotation={Math.PI / 2} pose="stand" vest="#e8e83a" seed={4} />
      {/* crew on the move (Drop 28): data van to the accumulator stand along the red zone edge, and a tank watch along the frac tanks */}
      <Walker path={[[-13, -27], [-4, -24.5], [1.5, -19], [-6, -19], [-14, -24]]} speed={1.1} seed={1} />
      <Walker path={[[-81, 45.5], [-57, 45.5], [-57, 48], [-81, 48]]} speed={1.0} vest="#e8e83a" seed={2} />
      {(s.phase === 'wireline' && !sleeve) && <Crew position={[10.5, 0, 6.5]} rotation={-Math.PI / 2} pose="point" seed={5} />}
      {s.phase === 'flowback' && <Crew position={[16, 0, 24 + rowLen]} rotation={Math.PI} pose="kneel" seed={6} />}
      {s.phase === 'production' && <Crew position={[3.6, 0, -3.2]} rotation={2.3} pose="stand" seed={7} />}
      <RoadTruck road={{ x0: pad.x1 + 6, x1: pad.x1 + 150, z: pad.z0 + 12 }} speed={5} height={(x, z) => terrainHeight(x, z, terrain.relief, pad)} />
      <Sign lines={['RED ZONE', 'NO ENTRY WHILE PUMPING']} position={[10.6, 1.4, -14.6]} rotation={[0, Math.PI / 4, 0]} width={1.2} height={0.6} post={1.4} danger />
      <Sign lines={['RED ZONE', 'NO ENTRY WHILE PUMPING']} position={[10.6, 1.4, rowLen + 10.6]} rotation={[0, -Math.PI / 4, 0]} width={1.2} height={0.6} post={1.4} danger />
      <Sign lines={['RED ZONE', 'NO ENTRY WHILE PUMPING']} position={[-34.6, 1.4, -14.6]} rotation={[0, 3 * Math.PI / 4, 0]} width={1.2} height={0.6} post={1.4} danger />
      <Sign lines={['RED ZONE', 'NO ENTRY WHILE PUMPING']} position={[-34.6, 1.4, rear + 2.1]} rotation={[0, -3 * Math.PI / 4, 0]} width={1.2} height={0.6} post={1.4} danger />
      <PowerGen fleet={s.setup.fleet} position={[-52, 0, -34]} showLabels={showLabels} />

      {/* wireline unit east of its own well, rear toward it, the crane in line with the well (the unit used to park
          10 m down the row, past the next wellhead) */}
      {s.lubricatorRigged && <WirelineUnit position={[16.5, 0, 3]} treeTop={treeTop} lubTop={lubTop} showLabels={showLabels} active={s.wl.step !== 'idle' && s.wl.step !== 'done' && s.wl.step !== 'armed'} wl={s.wl} />}
      {!sleeve && wlWells.map((r) => (
        <group key={'wl' + r.i} position={[0, 0, wellZ[r.i]]}>
          <WirelineUnit position={[16.5, 0, 3]} treeTop={treeTop} lubTop={lubTop} showLabels={false} active />
        </group>
      ))}
      {s.ctRigged && <CTUnit position={[18.5, 0, -10]} treeTop={treeTop} showLabels={showLabels} active={s.ct.progress > 0} ct={s.ct} />}
      {s.phase === 'production' && s.hookup.step !== 'done' && <WorkoverRig active={s.hookup.step === 'tubing'} showLabels={showLabels} />}
      <FlowbackSpread position={[14, 0, 22 + rowLen]} showLabels={showLabels} flaring={s.phase === 'flowback' && s.valves.wingB.pos > 0.99} night={tod === 'night'} />
      {s.phase !== 'production' && <PipeRun points={flowbackLine} r={0.075} />}
      {s.phase !== 'production' && <PipeStands points={flowbackLine} r={0.075} every={4.0} />}

      </group>
      {walk
        ? <WalkControls terrain={terrain} pad={pad} onExit={() => useSim.getState().setUi({ walk: false })} />
        : <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.02} minDistance={3} maxDistance={420} enableDamping dampingFactor={0.08} />}
      <Effects ao={{ aoRadius: 1.4, distanceFalloff: 1.0, intensity: 2.4 }} bloom={{ intensity: 0.25, luminanceThreshold: 1.3 }} />
    </Canvas>
  );
}
