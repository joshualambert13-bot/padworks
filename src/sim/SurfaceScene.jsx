import { useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { useSim, padRoles } from './store.js';
import { Ground, FracTree, ProductionTree, ZipperManifold, Missile, FracPump, Blender, Hydration, ChemAdd, SandSilos, WaterTanks, DataVan, WirelineUnit, CTUnit, FlowbackSpread, RedZone, treeDims, BORE_M } from './parts/surface.jsx';
import { PipeRun, MAT, Label } from './parts/primitives.jsx';

const WELL_SPACING = 8;   // meters between wellheads along the row

function Ticker({ enabled }) {
  const tick = useSim(s => s.tick);
  useFrame((_, dt) => { if (enabled) tick(dt); });
  return null;
}

function presets(rowCenter, rowLen, production = false) {
  return {
    ...(production ? { tree: { pos: [5.5, 4.2, 6.0], target: [0.3, 2.7, 0] } } : {}),
    pad:   { pos: [24 + rowLen * 0.25, 28 + rowLen * 0.2, 58 + rowLen * 0.35], target: [-12, 0, rowCenter] },
    ...(production ? {} : { tree: { pos: [12.5, 9.5, 13.5], target: [0, 4.8, 0] } }),
    row:   { pos: [30 + rowLen * 0.45, 12 + rowLen * 0.18, rowCenter + 6], target: [-2, 3.5, rowCenter] },
    pumps: { pos: [-6, 12, 24], target: [-28, 2, 0] },
    sand:  { pos: [-30, 18, 40], target: [-48, 4, 8] },
    flowback: { pos: [34, 14, 44], target: [26, 1, 20] },
  };
}

function CameraPreset({ preset, rowCenter, rowLen, production }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    const P = presets(rowCenter, rowLen, production);
    const p = P[preset] || P.pad;
    camera.position.set(...p.pos);
    if (controls) { controls.target.set(...p.target); controls.update(); }
  }, [preset, camera, controls, rowCenter, rowLen, production]);
  return null;
}

// Valve pattern for a partner well that follows the crews automatically.
function partnerValves(role) {
  const v = (pos) => ({ pos, target: pos });
  if (role === 'frac') return { lmv: v(1), umv: v(1), wingA: v(0), wingB: v(0), crown: v(1), swab: v(0), zip: v(1) };
  if (role === 'wireline') return { lmv: v(1), umv: v(1), wingA: v(1), wingB: v(0), crown: v(1), swab: v(1), zip: v(0) };
  if (role === 'done') return { lmv: v(1), umv: v(1), wingA: v(0), wingB: v(1), crown: v(0), swab: v(0), zip: v(0) };
  return { lmv: v(1), umv: v(0), wingA: v(0), wingB: v(0), crown: v(0), swab: v(0), zip: v(0) };
}

export default function SurfaceScene({ showLabels, preset, tickHere = true }) {
  const s = useSim();
  const pumping = s.pumpsOnline && s.pumpRate > 0;
  const bore = BORE_M[s.pad.bore] || 0.18;
  const d = treeDims(bore);
  const roles = padRoles(s);
  const wellZ = useMemo(() => roles.map((_, i) => i * WELL_SPACING), [roles.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowCenter = (wellZ[0] + wellZ[wellZ.length - 1]) / 2;
  const rowLen = wellZ[wellZ.length - 1] - wellZ[0];
  const treeTop = [0, d.topY, 0];
  const pumpPositions = [];
  const fracWells = roles.filter(r => r.role === 'frac').length + (s.phase === 'frac' ? 1 : 0);
  const pumpCount = Math.min(16, 8 + 4 * Math.max(0, fracWells - 1));
  for (let i = 0; i < pumpCount; i++) pumpPositions.push({ x: i % 2 === 0 ? -26 : -32, z: -9 + Math.floor(i / 2) * 6 });
  const wlWells = roles.filter(r => r.role === 'wireline');

  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: [24, 28, 58], fov: 45, near: 0.1, far: 900 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <color attach="background" args={['#0b0f14']} />
      <fog attach="fog" args={['#0b0f14', 140 + rowLen, 360 + rowLen]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[40, 60, 20]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} />
      <hemisphereLight args={['#9fb4d6', '#2b241b', 0.5]} />
      <Ticker enabled={tickHere} />
      <CameraPreset preset={preset} rowCenter={rowCenter} rowLen={rowLen} production={s.phase === 'production'} />
      <Ground />
      <RedZone visible={pumping} />

      {/* the row of wells: well 0 is under manual control, the others follow the crews */}
      {roles.map((r, i) => (
        <group key={i} position={[0, 0, wellZ[i]]}>
          {i === 0
            ? (s.phase === 'production'
              ? <ProductionTree showLabels={showLabels && preset === 'tree'} />
              : <FracTree valves={s.valves} showLabels={showLabels && preset === 'tree'} lubricator={s.lubricatorRigged} wlStep={s.wl.step} bore={bore} />)
            : (r.role === 'done'
              ? <ProductionTree showLabels={false} partner />
              : <FracTree valves={partnerValves(r.role)} showLabels={false} lubricator={r.role === 'wireline'} wlStep={r.role === 'wireline' ? 'pumpdown' : 'idle'} bore={bore} dim partner />)}
          {/* spooled treating line from the inlet block to this well's zipper outlet (gone once the well is on production) */}
          {!((i === 0 && s.phase === 'production') || (i > 0 && r.role === 'done')) && (
            <PipeRun points={[[-bore * 2.6, d.inletY, 0], [-3.2, d.inletY, 0], [-4.4, d.inletY - 1.5, 0], [-4.4, 0.9, 0], [-6.5, 0.9, 0]]} r={bore * 0.55} mat={MAT.steel} />
          )}
          {showLabels && i > 0 && <Label position={[2.5, d.topY + 0.6, 0]} text={'Well ' + (i + 1) + ': ' + (r.role === 'frac' ? 'pumping' : r.role === 'wireline' ? 'wireline' : r.role === 'done' ? 'complete' : 'waiting') + ' · stage ' + Math.min(r.stage + 1, 5)} />}
          {i === 0 && showLabels && <Label position={[2.5, d.topY + 0.6, 0]} text={'Well 1: your well'} />}
        </group>
      ))}
      <ZipperManifold valves={s.valves} showLabels={showLabels} wellZ={wellZ} roles={roles} bore={bore} />
      {/* zipper inlet header to the missile high-pressure header */}
      <PipeRun points={[[-9.2, 0.9, wellZ[0] - 1.7], [-12, 0.9, -3.6], [-16, 1.9, -3.6]]} r={0.09} mat={MAT.darkSteel} />
      <PipeRun points={[[-9.2, 0.9, wellZ[wellZ.length - 1] + 1.7], [-12, 0.9, 3.6], [-16, 1.9, 3.6]]} r={0.09} mat={MAT.darkSteel} />
      <Missile showLabels={showLabels} />
      {pumpPositions.map((p, i) => (
        <FracPump key={i} position={[p.x, 0, p.z]} rotation={[0, i % 2 === 0 ? 0 : Math.PI, 0]} online={s.pumpsOnline && !s.alarms.kickout} rate={s.pumpRate} name={'PP-FRACPUMP-' + (i + 1)} />
      ))}
      <Blender position={[-42, 0, 0]} showLabels={showLabels} />
      <PipeRun points={[[-40.5, 1.9, 0], [-36, 1.2, 0], [-20.5, 1.5, 0]]} r={0.14} mat={MAT.steel} />
      <Hydration position={[-48, 0, 0]} showLabels={showLabels} />
      <ChemAdd position={[-48, 0, 16]} showLabels={showLabels} />
      <SandSilos position={[-56, 0, -22]} showLabels={showLabels} />
      <WaterTanks position={[-52, 0, 34]} showLabels={showLabels} />
      <DataVan position={[-22, 0, -24]} showLabels={showLabels} />

      {s.lubricatorRigged && <WirelineUnit position={[14, 0, 10]} treeTop={treeTop} showLabels={showLabels} active={s.wl.step !== 'idle' && s.wl.step !== 'done' && s.wl.step !== 'armed'} />}
      {wlWells.map((r, k) => (
        <group key={'wl' + r.i} position={[0, 0, wellZ[r.i]]}>
          <WirelineUnit position={[14, 0, 10]} treeTop={treeTop} showLabels={false} active />
        </group>
      ))}
      {s.ctRigged && <CTUnit position={[16, 0, -10]} treeTop={treeTop} showLabels={showLabels} active={s.ct.progress > 0} />}
      <FlowbackSpread position={[14, 0, 22 + rowLen]} showLabels={showLabels} flaring={s.phase === 'flowback' && s.valves.wingB.pos > 0.99} />
      {s.phase !== 'production' && <PipeRun points={[[d.wingOuterX + d.ftf / 2, d.crossY, 0], [d.wingOuterX + 3, d.crossY, 0], [d.wingOuterX + 4, 2.0, 0], [d.wingOuterX + 4, 0.9, 6], [12.8, 0.9, 21.4 + rowLen]]} r={0.075} />}

      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={200} blur={2.5} far={20} />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.02} minDistance={3} maxDistance={300} enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}
