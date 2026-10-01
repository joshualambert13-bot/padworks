import { useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSim, padRoles, nextSteps, basinOf, spreadSizing } from './store.js';
import { useHover, pickHandlers } from './hover.js';
import { SkyDome, PadEnvironment, LITE } from './parts/lighting.jsx';
import { Crew, Windsock, Flag, RovingPickup, Sign } from './parts/life.jsx';
import { Ground, FracTree, ProductionTree, BopStack, WorkoverRig, ZipperManifold, ZIPPER_X, zipperDims, Missile, MISSILE_PITCH, missileDims, FracPump, PowerGen, Blender, Hydration, ChemAdd, SandSilos, SandBoxes, WaterTanks, DataVan, WirelineUnit, CTUnit, FlowbackSpread, RedZone, treeDims, BORE_M, Containment, FuelTrailers, LightTower, Pickups, FlangedRun, WELL_COLORS } from './parts/surface.jsx';
import { PipeRun, Pipe, MAT, Label } from './parts/primitives.jsx';

const WELL_SPACING = 8;   // meters between wellheads along the row
const MISSILE_X = -30;    // missile centerline; pumps park nose-in on both sides

function Ticker({ enabled }) {
  const tick = useSim(s => s.tick);
  useFrame((_, dt) => { if (enabled) tick(dt); });
  return null;
}

function presets(rowCenter, rowLen, production = false, k = 1) {
  return {
    ...(production ? { tree: { pos: [5.5, 4.2, 6.0], target: [0.3, 2.7, 0] } } : {}),
    pad:   { pos: [30 + rowLen * 0.25, 34 + rowLen * 0.2, 70 + rowLen * 0.35], target: [-18, 0, rowCenter] },
    ...(production ? {} : { tree: { pos: [12.5 * k, 9.5 * k, 13.5 * k], target: [0, 4.8 * k, 0] } }),
    row:   { pos: [30 + rowLen * 0.45, 12 + rowLen * 0.18, rowCenter + 6], target: [-2, 3.5, rowCenter] },
    zipper: { pos: [-17, 7, rowCenter - 15], target: [-8, 2.4, rowCenter - 1] },
    pumps: { pos: [-6, 19, 38], target: [-30, 2, 4] },
    sand:  { pos: [-44, 18, 44], target: [-62, 4, 8] },
    tanks: { pos: [-40, 14, 62], target: [-56, 2, 38] },
    gate: { pos: [78, 7, -12], target: [52, 1, -31] },
    support: { pos: [-2, 16, -60], target: [-22, 2, -34] },
    flowback: { pos: [34, 14, 44 + rowLen], target: [26, 1, 20 + rowLen] },
    basin: { pos: [90, 60, 160 + rowLen], target: [-20, 0, rowCenter] },
  };
}

// Render counters for the headless checks (window.__padworksStats), no cost when nobody reads them.
function RenderStats() {
  useFrame((state) => { const r = state.gl.info.render; window.__padworksStats = { calls: r.calls, triangles: r.triangles, geometries: state.gl.info.memory.geometries }; window.__padworksScene = state.scene; });
  return null;
}
function CameraPreset({ preset, rowCenter, rowLen, production, k }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    const P = presets(rowCenter, rowLen, production, k);
    const p = P[preset] || P.pad;
    camera.position.set(...p.pos);
    if (controls) { controls.target.set(...p.target); controls.update(); }
  }, [preset, camera, controls, rowCenter, rowLen, production, k]);
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
  const pumping = s.pumpsOnline && s.pumpRate > 0 && s.phase !== 'setup';
  const bore = BORE_M[s.pad.bore] || 0.18;
  const d = treeDims(bore);
  const zd = zipperDims(bore);
  const roles = padRoles(s);
  const basin = basinOf(s);
  const terrain = basin.terrain;
  const sleeve = s.setup.completion === 'sleeve';
  const spread = spreadSizing(s);
  const guideStep = nextSteps(s).steps.find(x => !x.done);
  const focusValve = guideStep && guideStep.valve ? guideStep.valve : null;
  const wellZ = useMemo(() => roles.map((_, i) => i * WELL_SPACING), [roles.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowCenter = (wellZ[0] + wellZ[wellZ.length - 1]) / 2;
  const rowLen = wellZ[wellZ.length - 1] - wellZ[0];
  const treeTop = [0, d.topY, 0];
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
  const wlWells = roles.filter(r => r.role === 'wireline');
  const show = useHover(h => h.show), hide = useHover(h => h.hide);
  const pick = pickHandlers('surface', show, hide);
  const pad = useMemo(() => ({ x0: -84, x1: 44, z0: -44, z1: rowLen + 50 }), [rowLen]);
  const zipperFrontZ = rowCenter - (rowLen + 6.0) / 2;

  return (
    <Canvas shadows={LITE ? true : 'soft'} dpr={[1, 1.5]} camera={{ position: [30, 34, 70], fov: 45, near: 0.1, far: 2600 }} gl={{ antialias: true, powerPreference: 'high-performance', toneMappingExposure: 1.05 }}>
      <SkyDome terrain={terrain} />
      {!LITE && <PadEnvironment terrain={terrain} />}
      {LITE && <hemisphereLight args={[terrain.sky, terrain.ground, 0.6]} />}
      <fog attach="fog" args={[terrain.fog, 180 + rowLen, 620 + rowLen]} />
      <ambientLight intensity={0.12} />
      <directionalLight position={[60, 90, 30]} intensity={2.4} color="#fff3e0" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-100} shadow-camera-right={100} shadow-camera-top={100} shadow-camera-bottom={-100} shadow-bias={-0.0004} shadow-normalBias={0.03} />
      <RenderStats />
      <hemisphereLight args={[terrain.sky, terrain.ground, 0.25]} />
      <Ticker enabled={tickHere} />
      <CameraPreset preset={preset} rowCenter={rowCenter} rowLen={rowLen} production={s.phase === 'production'} k={0.6 + 0.4 * bore / 0.18} />
      <Ground terrain={terrain} pad={pad} seed={basin.id.length} />
      <Containment x0={-3.2} x1={4.2} z0={-3.5} z1={rowLen + 3.5} />
      <RedZone visible={pumping} />
      <group {...pick}>

      {/* the row of wells: well 0 is under manual control, the others follow the crews */}
      {roles.map((r, i) => (
        <group key={i} position={[0, 0, wellZ[i]]}>
          {i === 0
            ? (s.phase === 'production'
              ? (s.hookup.step === 'rig' || s.hookup.step === 'tubing'
                ? <BopStack showLabels={showLabels && preset === 'tree'} />
                : <ProductionTree showLabels={showLabels && preset === 'tree'} tint={WELL_COLORS[i % WELL_COLORS.length]} lift={s.hookup.step === 'done' ? s.setup.lift : 'flow'} />)
              : <FracTree valves={s.valves} showLabels={showLabels && preset === 'tree'} lubricator={s.lubricatorRigged} wlStep={s.wl.step} bore={bore} focusValve={focusValve} launcher={sleeve} ballsLeft={Math.max(0, s.stages.length - 1 - s.ballsDropped)} tint={WELL_COLORS[i % WELL_COLORS.length]} wellNo={1} pumping={pumping} />)
            : (r.role === 'done'
              ? <ProductionTree showLabels={false} partner tint={WELL_COLORS[i % WELL_COLORS.length]} lift={s.setup.lift} />
              : <FracTree valves={partnerValves(r.role)} showLabels={false} lubricator={!sleeve && r.role === 'wireline'} wlStep={r.role === 'wireline' ? 'pumpdown' : 'idle'} bore={bore} dim partner launcher={sleeve} ballsLeft={3} tint={WELL_COLORS[i % WELL_COLORS.length]} wellNo={i + 1} pumping={r.role === 'frac'} />)}
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
      <PipeRun points={[[MISSILE_X, md.hpY, missileOutletZ], [MISSILE_X, md.hpY, missileOutletZ - 1.4], [MISSILE_X + 2, 0.9, missileOutletZ - 2.6], [ZIPPER_X - 1.0, 0.9, missileOutletZ - 2.6], [ZIPPER_X - 1.0, zd.headerY, zipperFrontZ + 0.9 - zd.ftf / 2 - 0.1]]} r={0.14} mat={MAT.darkSteel} />
      <Missile position={[MISSILE_X, 0, missileZ]} showLabels={showLabels} perSide={perSide} prvLifted={s.alarms.prvLifted} pumping={pumping} />
      {pumps.map((p, i) => (
        <group key={i}>
          <FracPump position={[p.x, 0, p.z]} rotation={[0, p.side === 1 ? Math.PI : 0, 0]} online={s.pumpsOnline && !s.alarms.kickout && s.phase !== 'setup'} rate={s.pumpRate} name={'PP-FRACPUMP-' + (i + 1)} electric={spread.electric} number={i + 1} />
          {/* discharge swivel arm to the missile feed port and suction hose from the low-pressure outlet */}
          <Pipe from={[MISSILE_X + p.side * 1.06, md.hpY, p.z]} to={[MISSILE_X + p.side * 2.4, 2.9, p.z]} r={0.06} mat={MAT.redIron} unions={false} />
          <Pipe from={[MISSILE_X + p.side * 1.85, md.lpY, p.z]} to={[MISSILE_X + p.side * 2.4, 1.2, p.z]} r={0.11} mat={MAT.rubber} unions={false} />
        </group>
      ))}
      {/* blender discharge to the low-pressure headers at the rear of the missile */}
      <Blender position={[-52, 0, 0]} showLabels={showLabels} />
      <PipeRun points={[[-50.5, 1.9, 0.6], [-40, 1.3, 0.6], [MISSILE_X - 1.15, md.lpY, missileZ + md.len / 2 - 0.2]]} r={0.16} mat={MAT.steel} />
      <PipeRun points={[[-50.5, 1.9, -0.6], [-40, 1.3, -0.6], [MISSILE_X + 1.15, md.lpY, missileZ + md.len / 2 - 0.2]]} r={0.16} mat={MAT.steel} />
      <Hydration position={[-58, 0, 0]} showLabels={showLabels} />
      <ChemAdd position={[-58, 0, 16]} showLabels={showLabels} />
      <SandSilos position={[-70, 0, -22]} showLabels={showLabels} />
      <SandBoxes position={[-80, 0, -2]} showLabels={showLabels} />
      {(s.setup.fleet !== 'diesel' && s.setup.fleet !== 'grid') && <FuelTrailers position={[-8, 0, -40]} count={Math.min(8, 3 + Math.round(spread.pumps / 3))} showLabels={showLabels} />}
      <Pickups position={[30, 0, -36]} count={7} />
      {[[-20, -40], [-62, 30], [36, rowLen + 40], [-40, rowLen + 44]].map(([x, z], i) => <LightTower key={i} position={[x, 0, z]} />)}
      <WaterTanks position={[-66, 0, 34]} showLabels={showLabels} />
      <DataVan position={[-14, 0, -30]} showLabels={showLabels} />
      {/* pad life: crew at their stations, windsock and safety flag by the data van, a truck on the lease road, red zone placards */}
      <Windsock position={[-4, 0, -33]} height={6} />
      <Flag position={[-6, 0, -33]} height={7} color="#ff6a00" />
      <Crew position={[-7.2, 0, -27.6]} rotation={-0.6} pose="stand" seed={1} />
      <Crew position={[-8.6, 0, -27.2]} rotation={0.9} pose="point" vest="#e8e83a" seed={2} />
      <Crew position={[ZIPPER_X + 1.6, 0, zipperFrontZ - 0.6]} rotation={Math.PI * 0.9} pose={pumping ? 'stand' : 'kneel'} seed={3} />
      <Crew position={[-77, 0, 8.5]} rotation={Math.PI / 2} pose="stand" vest="#e8e83a" seed={4} />
      {(s.phase === 'wireline' && !sleeve) && <Crew position={[10.5, 0, 6.5]} rotation={-Math.PI / 2} pose="point" seed={5} />}
      {s.phase === 'flowback' && <Crew position={[16, 0, 24 + rowLen]} rotation={Math.PI} pose="kneel" seed={6} />}
      {s.phase === 'production' && <Crew position={[3.5, 0, 3.2]} rotation={-2.2} pose="stand" seed={7} />}
      <RovingPickup road={{ x0: pad.x1 + 6, x1: pad.x1 + 150, z: pad.z0 + 12 }} speed={5} />
      <Sign lines={['RED ZONE', 'NO ENTRY WHILE PUMPING']} position={[6.5, 1.4, -6.5]} rotation={[0, Math.PI / 4, 0]} width={1.2} height={0.6} post={1.4} danger />
      <Sign lines={['RED ZONE', 'NO ENTRY WHILE PUMPING']} position={[6.5, 1.4, rowLen + 6.5]} rotation={[0, -Math.PI / 4, 0]} width={1.2} height={0.6} post={1.4} danger />
      <PowerGen fleet={s.setup.fleet} position={[-52, 0, -34]} showLabels={showLabels} />

      {s.lubricatorRigged && <WirelineUnit position={[14, 0, 10]} treeTop={treeTop} showLabels={showLabels} active={s.wl.step !== 'idle' && s.wl.step !== 'done' && s.wl.step !== 'armed'} />}
      {!sleeve && wlWells.map((r) => (
        <group key={'wl' + r.i} position={[0, 0, wellZ[r.i]]}>
          <WirelineUnit position={[14, 0, 10]} treeTop={treeTop} showLabels={false} active />
        </group>
      ))}
      {s.ctRigged && <CTUnit position={[16, 0, -10]} treeTop={treeTop} showLabels={showLabels} active={s.ct.progress > 0} />}
      {s.phase === 'production' && s.hookup.step !== 'done' && <WorkoverRig active={s.hookup.step === 'tubing'} showLabels={showLabels} />}
      <FlowbackSpread position={[14, 0, 22 + rowLen]} showLabels={showLabels} flaring={s.phase === 'flowback' && s.valves.wingB.pos > 0.99} />
      {s.phase !== 'production' && <PipeRun points={[[d.wingOuterX + d.ftf / 2, d.crossY, 0], [d.wingOuterX + 3, d.crossY, 0], [d.wingOuterX + 4, 2.0, 0], [d.wingOuterX + 4, 0.9, 6], [12.8, 0.9, 21.4 + rowLen]]} r={0.075} />}

      </group>
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.02} minDistance={3} maxDistance={420} enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}
