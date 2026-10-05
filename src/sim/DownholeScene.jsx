import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSim, wellParams } from './store.js';
import { useHover, pickHandlers } from './hover.js';
import { SceneEnvironment, LITE } from './parts/lighting.jsx';
import { Effects } from './parts/effects.jsx';
import { ContextLoss } from './parts/stability.jsx';

const UNDERGROUND = { sky: '#5c6a78', fog: '#3a424c', ground: '#23272c' };
import { Formation, Casing, Stage, FluidFlow, FlowbackFlow, CuttingsBed, PerfFlash, WirelineString, BallInFlight, ToePressure, CoiledTubing, Dissolving, HeelMarker, ProductionString, clusterX, stageX, plugX, sleeveX, LATERAL } from './parts/downhole.jsx';

function Ticker({ enabled }) {   // the 50 ms step of Drop 67 lives in the surface scene's Ticker; this one only runs when the surface scene is not mounted (downhole view alone)
  const tick = useSim(s => s.tick);
  const acc = useRef(0);
  useFrame((state, dt) => { if (enabled) { acc.current += dt; if (acc.current >= 0.05) { tick(acc.current); acc.current = 0; } } window.__padworksDownScene = state.scene; window.__padworksDownView = (pos, target) => { state.camera.position.set(...pos); if (state.controls) { state.controls.target.set(...target); state.controls.update(); } }; });
  return null;
}

// The camera follows the work: the current stage while fracturing, the plug being milled during drillout, the heel
// while the well cleans up and produces.
function FollowStage({ follow }) {
  const stage = useSim(s => s.stage);
  const count = useSim(s => s.stages.length);
  const phase = useSim(s => s.phase);
  const atPlug = useSim(s => s.ct.atPlug);
  const sleeve = useSim(s => s.setup.completion === 'sleeve');
  const { camera, controls } = useThree();
  useEffect(() => {
    if (!follow || !controls) return;
    const x = phase === 'production' || phase === 'flowback' ? -6 : phase === 'drillout' && atPlug >= 0 ? (sleeve ? sleeveX(atPlug) : plugX(atPlug)) : stageX(stage);
    camera.position.set(x + 2, 7, 26);
    controls.target.set(x - 1, -0.4, 0);
    controls.update();
  }, [stage, count, phase, atPlug, sleeve, follow, camera, controls]);
  return null;
}

export default function DownholeScene({ showLabels, tickHere = true, follow = true }) {
  const s = useSim();
  const pumping = s.pumpsOnline && s.pumpRate > 0 && !s.alarms.kickout;
  const st = s.stages[s.stage];
  const sleeve = s.setup.completion === 'sleeve';
  const openhole = sleeve && s.setup.sleeveSystem === 'openhole';
  const firingCluster = s.wl.step === 'perforate' && st.clustersFired > 0 ? Math.max(0, s.setup.clusters - st.clustersFired) : -1;   // bottom-up: toe-most first
  const settled = s.phase === 'drillout' || s.phase === 'flowback' || s.phase === 'production';
  const cleanup = Math.min(1, s.fb.cumBbl / 200);
  const flowingBack = s.phase === 'flowback' && s.valves.wingB.pos > 0.99;
  const pumpingDown = s.phase === 'wireline' && !sleeve && s.wl.step === 'pumpdown' && pumping;
  const stringX = LATERAL.heelX + (plugX(s.stage) - LATERAL.heelX) * s.wl.progress;
  const dissolvable = s.setup.plugs === 'dissolvable';
  const toePressuring = sleeve && s.phase === 'wireline' && s.wl.step === 'toe';
  const toeFraction = toePressuring ? s.surfacePsi / Math.max(1, wellParams(s).toeOpenPsi) : 0;
  const show = useHover(h => h.show), hide = useHover(h => h.hide);
  const pick = pickHandlers('downhole', show, hide);
  return (
    <Canvas shadows={LITE ? true : 'soft'} dpr={[1, 1.5]} camera={{ position: [4, 5, 16], fov: 45, near: 0.1, far: 300 }} gl={{ antialias: true, toneMappingExposure: 1.1 }}>
      <color attach="background" args={['#0b0f14']} />
      <SceneEnvironment terrain={UNDERGROUND} intensity={0.55} />
      <ambientLight intensity={LITE ? 0.8 : 0.35} />
      <directionalLight position={[10, 20, 30]} intensity={2.2} color="#fff1dc" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-camera-near={5} shadow-camera-far={80} shadow-bias={-0.0003} shadow-normalBias={0.02} />
      <directionalLight position={[-14, 6, 20]} intensity={0.5} color="#cfe0ff" />
      <hemisphereLight args={['#dfe7f2', '#3a2f22', LITE ? 0.7 : 0.4]} />
      <Ticker enabled={tickHere} />
      <ContextLoss />
      <FollowStage follow={follow} />
      <group {...pick} key={s.stages.length + '-' + s.setup.clusters + '-' + s.setup.completion + '-' + s.setup.sleeveSystem}>
      <Formation grid={showLabels} />
      <Casing openhole={openhole} />
      <HeelMarker />
      {s.stages.map(stage => <Stage key={stage.index} stage={stage} isCurrent={stage.index === s.stage} netPsi={s.netPsi} showLabels={showLabels} sleeve={sleeve} openhole={openhole} settled={settled} seating={sleeve && stage.index === s.stage && s.wl.step === 'seat'} dissolve={dissolvable && s.ct.atPlug === stage.index && !stage.plugMilled ? s.ct.milling : 0} />)}
      {sleeve && <ToePressure fraction={toeFraction} active={toePressuring && pumping} />}
      <FluidFlow rate={s.pumpRate} currentStage={s.stage} active={pumping && ((s.phase === 'frac' && st.perforated) || (s.phase === 'wireline' && sleeve))} ppa={s.ppa} />
      {pumpingDown && <FluidFlow rate={s.pumpRate} currentStage={s.stage} active ppa={0} targetOverride={stringX - 0.3} spray={false} />}
      <FlowbackFlow active={flowingBack} choke={s.fb.choke} cleanup={cleanup} stages={s.stages} sleeve={sleeve} />
      {s.setup.plugs !== 'dissolvable' && <CuttingsBed stages={s.stages} cleanup={s.phase === 'flowback' || s.phase === 'production' ? (s.phase === 'production' ? 1 : cleanup) : 0} sleeve={sleeve} />}
      {!sleeve && Array.from({ length: s.setup.clusters }).map((_, c) => <PerfFlash key={c} x={clusterX(s.stage, c)} active={firingCluster === c} />)}
      {!sleeve && <WirelineString wl={s.wl} stage={s.stage} />}
      {sleeve && <BallInFlight wl={s.wl} stage={s.stage} />}
      {s.setup.plugs === 'dissolvable' ? <Dissolving ct={s.ct} stages={s.stages} sleeve={sleeve} /> : <CoiledTubing ct={s.ct} stages={s.stages} sleeve={sleeve} />}
      {s.phase === 'production' && <ProductionString lift={s.setup.lift} active />}
      </group>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={2} maxDistance={80} />
      <Effects ao={{ aoRadius: 0.6, distanceFalloff: 0.8, intensity: 2.0 }} bloom={{ intensity: 0.6, luminanceThreshold: 0.95 }} guard={tickHere} />
    </Canvas>
  );
}
