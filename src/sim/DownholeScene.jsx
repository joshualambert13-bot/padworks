import { useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSim } from './store.js';
import { useHover, pickHandlers } from './hover.js';
import { Formation, Casing, Stage, FluidFlow, PerfFlash, WirelineString, BallInFlight, CoiledTubing, Dissolving, HeelMarker, clusterX, stageX } from './parts/downhole.jsx';

function Ticker({ enabled }) {
  const tick = useSim(s => s.tick);
  useFrame((_, dt) => { if (enabled) tick(dt); });
  return null;
}

function FollowStage({ follow }) {
  const stage = useSim(s => s.stage);
  const count = useSim(s => s.stages.length);
  const { camera, controls } = useThree();
  useEffect(() => {
    if (!follow || !controls) return;
    const x = stageX(stage);
    camera.position.set(x + 2, 7, 26);
    controls.target.set(x - 1, -0.4, 0);
    controls.update();
  }, [stage, count, follow, camera, controls]);
  return null;
}

export default function DownholeScene({ showLabels, tickHere = true, follow = true }) {
  const s = useSim();
  const pumping = s.pumpsOnline && s.pumpRate > 0 && !s.alarms.kickout;
  const st = s.stages[s.stage];
  const sleeve = s.setup.completion === 'sleeve';
  const openhole = sleeve && s.setup.sleeveSystem === 'openhole';
  const firingCluster = s.wl.step === 'perforate' ? Math.min(s.setup.clusters - 1, st.clustersFired - 1) : -1;
  const show = useHover(h => h.show), hide = useHover(h => h.hide);
  const pick = pickHandlers('downhole', show, hide);
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [4, 5, 16], fov: 45, near: 0.1, far: 300 }} gl={{ antialias: true }}>
      <color attach="background" args={['#0b0f14']} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[10, 20, 30]} intensity={2.0} />
      <hemisphereLight args={['#dfe7f2', '#3a2f22', 0.8]} />
      <Ticker enabled={tickHere} />
      <FollowStage follow={follow} />
      <group {...pick} key={s.stages.length + '-' + s.setup.clusters + '-' + s.setup.completion + '-' + s.setup.sleeveSystem}>
      <Formation />
      <Casing openhole={openhole} />
      <HeelMarker />
      {s.stages.map(stage => <Stage key={stage.index} stage={stage} isCurrent={stage.index === s.stage} netPsi={s.netPsi} showLabels={showLabels} sleeve={sleeve} openhole={openhole} />)}
      <FluidFlow rate={s.pumpRate} currentStage={s.stage} active={pumping && ((s.phase === 'frac' && st.perforated) || (s.phase === 'wireline' && sleeve))} ppa={s.ppa} />
      {!sleeve && Array.from({ length: s.setup.clusters }).map((_, c) => <PerfFlash key={c} x={clusterX(s.stage, c)} active={firingCluster === c} />)}
      {!sleeve && <WirelineString wl={s.wl} stage={s.stage} />}
      {sleeve && <BallInFlight wl={s.wl} stage={s.stage} />}
      {s.setup.plugs === 'dissolvable' ? <Dissolving ct={s.ct} stages={s.stages} sleeve={sleeve} /> : <CoiledTubing ct={s.ct} stages={s.stages} sleeve={sleeve} />}
      </group>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={2} maxDistance={80} />
    </Canvas>
  );
}
