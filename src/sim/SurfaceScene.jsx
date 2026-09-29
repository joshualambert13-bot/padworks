import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { useSim } from './store.js';
import { Ground, FracTree, ZipperManifold, Missile, FracPump, Blender, Hydration, ChemAdd, SandSilos, WaterTanks, DataVan, WirelineUnit, CTUnit, FlowbackSpread, RedZone } from './parts/surface.jsx';
import { PipeRun, MAT } from './parts/primitives.jsx';

const TREE_TOP = [0, 6.3, 0];

function Ticker({ enabled }) {
  const tick = useSim(s => s.tick);
  useFrame((_, dt) => { if (enabled) tick(dt); });
  return null;
}

const PRESETS = {
  pad:   { pos: [24, 28, 58], target: [-12, 0, 6] },
  tree:  { pos: [10, 8, 12], target: [0, 4.5, 0] },
  pumps: { pos: [-6, 12, 24], target: [-28, 2, 0] },
  sand:  { pos: [-30, 18, 40], target: [-48, 4, 8] },
  flowback: { pos: [34, 14, 44], target: [26, 1, 20] },
};

function CameraPreset({ preset }) {
  const { camera, controls } = useThree();
  useEffect(() => {
    const p = PRESETS[preset] || PRESETS.pad;
    camera.position.set(...p.pos);
    if (controls) { controls.target.set(...p.target); controls.update(); }
  }, [preset, camera, controls]);
  return null;
}

export default function SurfaceScene({ showLabels, preset, tickHere = true }) {
  const s = useSim();
  const pumping = s.pumpsOnline && s.pumpRate > 0;
  const pumpPositions = [];
  for (let i = 0; i < 8; i++) pumpPositions.push({ x: i < 4 ? -26 : -32, z: -9 + (i % 4) * 6 });
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: PRESETS.pad.pos, fov: 45, near: 0.1, far: 800 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <color attach="background" args={['#0b0f14']} />
      <fog attach="fog" args={['#0b0f14', 120, 320]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[40, 60, 20]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-80} shadow-camera-right={80} shadow-camera-top={80} shadow-camera-bottom={-80} />
      <hemisphereLight args={['#9fb4d6', '#2b241b', 0.5]} />
      <Ticker enabled={tickHere} />
      <CameraPreset preset={preset} />
      <Ground />
      <RedZone visible={pumping} />

      <FracTree valves={s.valves} showLabels={showLabels && preset === 'tree'} lubricator={s.lubricatorRigged} wlStep={s.wl.step} goatHead={!s.ctRigged} />
      <ZipperManifold valves={s.valves} showLabels={showLabels} />
      {/* frac line from the goat head to the zipper manifold outlet (this well is the center outlet) */}
      <PipeRun points={[[-0.9, 6.9, 0], [-3.5, 6.9, 0], [-4.5, 4.0, 0], [-4.5, 0.9, 0], [-6.5, 0.9, 0]]} r={0.075} />
      {/* zipper inlet header to the missile high-pressure header */}
      <PipeRun points={[[-9.2, 0.9, -3.6], [-12, 0.9, -3.6], [-16, 1.9, -3.6]]} r={0.09} mat={MAT.darkSteel} />
      <PipeRun points={[[-9.2, 0.9, 3.6], [-12, 0.9, 3.6], [-16, 1.9, 3.6]]} r={0.09} mat={MAT.darkSteel} />
      <Missile showLabels={showLabels} />
      {pumpPositions.map((p, i) => (
        <FracPump key={i} position={[p.x, 0, p.z]} rotation={[0, i < 4 ? 0 : Math.PI, 0]} online={s.pumpsOnline && !s.alarms.kickout} rate={s.pumpRate} name={'PP-FRACPUMP-' + (i + 1)} />
      ))}
      {/* suction side: blender to missile low-pressure header */}
      <Blender position={[-42, 0, 0]} showLabels={showLabels} />
      <PipeRun points={[[-40.5, 1.9, 0], [-36, 1.2, 0], [-20.5, 1.5, 0]]} r={0.14} mat={MAT.steel} />
      <Hydration position={[-48, 0, 0]} showLabels={showLabels} />
      <ChemAdd position={[-48, 0, 16]} showLabels={showLabels} />
      <SandSilos position={[-56, 0, -22]} showLabels={showLabels} />
      <WaterTanks position={[-52, 0, 34]} showLabels={showLabels} />
      <DataVan position={[-22, 0, -24]} showLabels={showLabels} />

      {s.lubricatorRigged && <WirelineUnit position={[14, 0, 10]} treeTop={TREE_TOP} showLabels={showLabels} active={s.wl.step !== 'idle' && s.wl.step !== 'done' && s.wl.step !== 'armed'} />}
      {s.ctRigged && <CTUnit position={[16, 0, -10]} treeTop={TREE_TOP} showLabels={showLabels} active={s.ct.progress > 0} />}
      <FlowbackSpread position={[14, 0, 22]} showLabels={showLabels} flaring={s.phase === 'flowback' && s.valves.wingB.pos > 0.99} />
      <PipeRun points={[[0.9, 5.5, 0], [4, 5.5, 0], [5, 2.0, 0], [5, 0.9, 6], [12.8, 0.9, 21.4]]} r={0.075} />

      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={160} blur={2.5} far={20} />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.02} minDistance={3} maxDistance={220} enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}
