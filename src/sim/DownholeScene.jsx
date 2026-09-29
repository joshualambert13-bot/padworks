import { useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSim } from './store.js';
import { Formation, Casing, Stage, FluidFlow, PerfFlash, WirelineString, CoiledTubing, HeelMarker, clusterX, stageX } from './parts/downhole.jsx';

function Ticker({ enabled }) {
  const tick = useSim(s => s.tick);
  useFrame((_, dt) => { if (enabled) tick(dt); });
  return null;
}

function FollowStage({ follow }) {
  const stage = useSim(s => s.stage);
  const { camera, controls } = useThree();
  useEffect(() => {
    if (!follow || !controls) return;
    const x = stageX(stage);
    camera.position.set(x + 3, 6, 24);
    controls.target.set(x - 2, -0.5, 0);
    controls.update();
  }, [stage, follow, camera, controls]);
  return null;
}

export default function DownholeScene({ showLabels, tickHere = true, follow = true }) {
  const s = useSim();
  const pumping = s.pumpsOnline && s.pumpRate > 0 && !s.alarms.kickout;
  const st = s.stages[s.stage];
  const firingCluster = s.wl.step === 'perforate' ? Math.min(2, st.clustersFired - 1) : -1;
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [4, 5, 16], fov: 45, near: 0.1, far: 300 }} gl={{ antialias: true }}>
      <color attach="background" args={['#0b0f14']} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[10, 20, 30]} intensity={2.0} />
      <hemisphereLight args={['#dfe7f2', '#3a2f22', 0.8]} />
      <Ticker enabled={tickHere} />
      <FollowStage follow={follow} />
      <Formation />
      <Casing />
      <HeelMarker />
      {s.stages.map(stage => <Stage key={stage.index} stage={stage} isCurrent={stage.index === s.stage} netPsi={s.netPsi} showLabels={showLabels} />)}
      <FluidFlow rate={s.pumpRate} currentStage={s.stage} active={pumping && s.phase === 'frac' && st.perforated} ppa={s.ppa} />
      {[0, 1, 2].map(c => <PerfFlash key={c} x={clusterX(s.stage, c)} active={firingCluster === c} />)}
      <WirelineString wl={s.wl} stage={s.stage} />
      <CoiledTubing ct={s.ct} stages={s.stages} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={2} maxDistance={80} />
    </Canvas>
  );
}
