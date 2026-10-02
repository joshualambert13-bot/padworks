// Model viewer: part list, only-this, translucent others, section plane, explode, frame.
// Keys: F frame part or all, O only this, T translucent others, S section, E explode, A show all, R reset, Esc clear.
// Hero pass (Drop 17): creased normals instead of flat facets, materials classed from the part color (cast steel,
// machined steel, brass, elastomer, paint) under the sky environment, a studio backdrop and ground shadow,
// key, fill, and rim lights, a turntable until the first touch, hover and selection glow, a label on the selected
// part, and a solid cut face in section mode.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Focus, EyeOff, Blend, Scissors, Expand, RotateCcw } from 'lucide-react';
import { SceneEnvironment, LITE } from '../sim/parts/lighting.jsx';
import { Effects } from '../sim/parts/effects.jsx';
import { ContextLoss } from '../sim/parts/stability.jsx';
import { Label } from '../sim/parts/primitives.jsx';

const VIEWER_SKY = { sky: '#b9cbe0', fog: '#d8d5cc', ground: '#5a5044' };
const CREASE = THREE.MathUtils.degToRad(32);

// Material class from the exported base color: the CAD scripts color parts by function, so the color says what
// the surface is. Dark: elastomer. Brass tones: bronze. Saturated: paint. Gray: steel, lighter means machined.
function classify(color) {
  const hsl = color.getHSL({ h: 0, s: 0, l: 0 });
  if (hsl.l < 0.12) return { metalness: 0.05, roughness: 0.85 };
  if (hsl.s > 0.25 && hsl.h > 0.08 && hsl.h < 0.16 && hsl.l > 0.3) return { metalness: 0.9, roughness: 0.32 };    // brass and bronze
  if (hsl.s > 0.3) return { metalness: 0.3, roughness: 0.45 };                                                    // paint
  return { metalness: 0.82, roughness: hsl.l > 0.55 ? 0.28 : hsl.l > 0.4 ? 0.4 : 0.52 };                          // machined, bright, cast
}
// Section mode: back faces (the interior seen through the cut) draw as a solid cut face instead of the inside of a shell.
function cutFace(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCut = material.userData.uCut;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uCut;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n if (uCut > 0.5 && !gl_FrontFacing) { gl_FragColor = vec4(mix(gl_FragColor.rgb, vec3(0.62, 0.6, 0.56), 0.9), gl_FragColor.a); }');
  };
  material.customProgramCacheKey = () => 'padworks-cut';
}

function Model({ url, selected, mode, explode, ghost, hovered, onPick, onHover, onNodes, onLoaded, onBounds }) {
  const { scene } = useGLTF(url, '/draco/');
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const centers = useRef(new Map());
  useEffect(() => {
    const names = [];
    const done = new Set();
    cloned.traverse(o => {
      if (o.isMesh) {
        if (!done.has(o.geometry)) { done.add(o.geometry); if (!o.geometry.attributes.normal || o.geometry.userData.creased !== true) { const g = toCreasedNormals(o.geometry, CREASE); g.userData.creased = true; o.geometry = g; } }
        o.userData.baseMaterial = o.material;
        const m = o.material.clone();
        m.flatShading = false;
        m.transparent = true;
        m.side = THREE.DoubleSide;
        m.clipShadows = true;
        m.envMapIntensity = 1.0;
        Object.assign(m, classify(m.color));
        m.userData.uCut = { value: 0 };
        cutFace(m);
        m.needsUpdate = true;
        o.material = m;
        o.castShadow = true; o.receiveShadow = true;
        const key = o.name || o.parent?.name;
        o.userData.key = key;
        if (key) names.push(key);
        const b = new THREE.Box3().setFromObject(o);
        centers.current.set(o, b.getCenter(new THREE.Vector3()));
        o.userData.basePos = o.position.clone();
      }
    });
    onNodes([...new Set(names)]);
    // bounds in the viewer frame (the model is rotated Z-up to Y-up): the ground plane and the backdrop size from these
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    onBounds && onBounds({ minZ: box.min.z, maxZ: box.max.z, radius: size.length() / 2, center: box.getCenter(new THREE.Vector3()) });
    onLoaded && onLoaded();
  }, [cloned, onNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0), []);
  useEffect(() => {
    const sel = new Set(selected);
    const ghostSet = new Set(ghost || []);
    cloned.traverse(o => {
      if (!o.isMesh) return;
      const key = o.userData.key;
      const isSel = sel.size === 0 || sel.has(key);
      const isGhost = ghostSet.has(key) && !(sel.size > 0 && sel.has(key));
      const isHover = hovered && key === hovered && !(sel.size > 0 && sel.has(key));
      o.visible = mode === 'isolate' ? isSel : true;
      o.material.opacity = (mode === 'fade' && !isSel) ? 0.18 : isGhost ? 0.22 : 1;
      o.material.depthWrite = !((mode === 'fade' && !isSel) || isGhost);
      o.material.clippingPlanes = mode === 'cut' ? [plane] : [];
      o.material.userData.uCut.value = mode === 'cut' ? 1 : 0;
      o.material.emissive = new THREE.Color(isSel && sel.size > 0 ? '#1d4d3a' : isHover ? '#2a2f1a' : '#000000');
      o.material.needsUpdate = true;
      const c = centers.current.get(o);
      if (c && o.userData.basePos) {
        const dir = c.clone().normalize();
        o.position.copy(o.userData.basePos).add(dir.multiplyScalar(explode * 0.6));
      }
    });
  }, [cloned, selected, mode, explode, plane, ghost, hovered]);

  // CadQuery exports are Z-up; glTF viewers are Y-up. Rotate so the stem points up.
  return (
    <primitive object={cloned} rotation={[-Math.PI / 2, 0, 0]}
      onClick={e => { e.stopPropagation(); onPick(e.object.userData.key); }}
      onPointerMissed={() => onPick(null)}
      onPointerOver={e => { e.stopPropagation(); onHover(e.object.userData.key); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { onHover(null); document.body.style.cursor = ''; }} />
  );
}

// Studio backdrop: a dark gradient sphere around the model (horizon band a little lighter than the top and floor).
function Backdrop({ radius }) {
  const geom = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 24, 16);
    const pos = g.attributes.position; const col = new Float32Array(pos.count * 3);
    const top = new THREE.Color('#0d1117'), mid = new THREE.Color('#1f2631'), low = new THREE.Color('#07090c'); const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y >= 0) c.copy(mid).lerp(top, Math.pow(y, 0.7)); else c.copy(mid).lerp(low, Math.min(1, -y * 2.5)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  }, []);
  return <mesh geometry={geom} scale={[radius, radius, radius]}><meshBasicMaterial vertexColors side={THREE.BackSide} toneMapped={false} /></mesh>;
}
// Ground: catches the model's shadow and nothing else.
function Ground({ y, radius }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
      <circleGeometry args={[radius * 4, 48]} />
      <shadowMaterial transparent opacity={0.38} />
    </mesh>
  );
}
// Slow turntable until the first pointer touch on the canvas.
function Turntable({ active }) {
  const controls = useThree(st => st.controls);
  useEffect(() => { if (controls) { controls.autoRotate = active; controls.autoRotateSpeed = 0.7; } }, [controls, active]);
  useFrame(() => { if (controls && active) controls.update(); });
  return null;
}
// The selected part's label floats at its center.
function PartLabel({ selected, nodeLabels }) {
  const scene = useThree(st => st.scene);
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (selected.length !== 1) { setPos(null); return; }
    const box = new THREE.Box3(); let found = false;
    scene.updateMatrixWorld(true);
    scene.traverse(o => { if (o.isMesh && o.userData.key === selected[0]) { box.expandByObject(o); found = true; } });
    if (!found || box.isEmpty()) { setPos(null); return; }
    const c = box.getCenter(new THREE.Vector3()); c.y = box.max.y; setPos([c.x, c.y, c.z]);
  }, [selected, scene]);
  if (!pos) return null;
  const k = selected[0];
  return <Label position={pos} text={nodeLabels[k] || k.replace(/^[A-Z]{2}-[A-Z0-9]+-/, '')} size={0.028} />;
}

function Framer({ trigger, selected, scope, ghost }) {
  const camera = useThree(st => st.camera);
  const controls = useThree(st => st.controls);
  const scene = useThree(st => st.scene);
  const size3 = useThree(st => st.size);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    scene.updateMatrixWorld(true);
    const sel = new Set(selected);
    const useSel = scope === 'selection' && sel.size > 0;
    const ghostSet = new Set(ghost || []);
    const box = new THREE.Box3();
    scene.traverse(o => { if (o.isMesh && o.visible && o.userData.key && (!useSel || sel.has(o.userData.key)) && !(ghostSet.has(o.userData.key) && !useSel)) box.expandByObject(o); });
    if (box.isEmpty()) scene.traverse(o => { if (o.isMesh && o.visible && o.userData.key) box.expandByObject(o); });
    if (box.isEmpty()) { const t = setTimeout(() => setRetry(x => x + 1), 200); return () => clearTimeout(t); }
    const dims = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const aspect = size3.width / Math.max(1, size3.height);
    const vfov = THREE.MathUtils.degToRad(camera.fov || 40);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    // fit the bounding sphere in the smaller of the two view angles, then pad
    const radius = dims.length() / 2;
    const dist = radius / Math.sin(Math.min(vfov, hfov) / 2) * (useSel ? 1.6 : 1.05);
    camera.position.copy(center).add(new THREE.Vector3(0.6, 0.35, 0.72).normalize().multiplyScalar(dist));
    camera.near = Math.max(0.005, dist / 200); camera.far = dist * 50; camera.updateProjectionMatrix();
    camera.lookAt(center);
    if (controls) { controls.target.copy(center); controls.update(); }
    else { const t = setTimeout(() => setRetry(x => x + 1), 200); return () => clearTimeout(t); }
  }, [trigger, retry, camera, controls, scene]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function Viewer({ url, highlight = [], nodeLabels = {}, ghost = [] }) {
  const [selected, setSelected] = useState(highlight);
  // component pages open with the other parts translucent so an internal part is visible through the body
  const baseMode = highlight.length ? 'fade' : 'normal';
  const [mode, setMode] = useState(baseMode);
  const [explode, setExplode] = useState(0);
  const [nodes, setNodes] = useState([]);
  const [frame, setFrame] = useState(0);
  const [scope, setScope] = useState('selection'); // 'selection' frames the highlighted parts; 'all' frames the assembly
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [touched, setTouched] = useState(false);
  const frameSel = () => { setScope('selection'); setFrame(x => x + 1); };
  const frameToggle = () => { setScope(sc => sc === 'selection' ? 'all' : 'selection'); setFrame(x => x + 1); };
  useEffect(() => { setSelected(highlight); setMode(highlight.length ? 'fade' : 'normal'); }, [highlight]);
  useEffect(() => { setLoaded(false); setBounds(null); setTouched(false); }, [url]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === 'f') frameToggle();
      if (k === 'o') setMode(m => m === 'isolate' ? 'normal' : 'isolate');
      if (k === 't') setMode(m => m === 'fade' ? 'normal' : 'fade');
      if (k === 's') setMode(m => m === 'cut' ? 'normal' : 'cut');
      if (k === 'e') setExplode(x => x > 0 ? 0 : 1);
      if (k === 'a') { setMode('normal'); }
      if (k === 'r') { setMode(baseMode); setExplode(0); setSelected(highlight); frameSel(); }
      if (k === 'escape') setSelected([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [highlight]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (m) => setMode(x => x === m ? 'normal' : m);
  const Btn = ({ m, icon: Icon, label, onClick, active }) => (
    <button className={'btn flex items-center gap-1 ' + (active ? 'btn-primary' : '')} onClick={onClick || (() => toggle(m))} title={label}><Icon size={14} /><span className="hidden lg:inline">{label}</span></button>
  );
  // the model is rotated -90 degrees about X, so CAD Z becomes viewer Y: the ground sits at the lowest point
  const groundY = bounds ? bounds.minZ : 0;
  const R = bounds ? Math.max(0.3, bounds.radius) : 1;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] h-full min-h-[420px]">
      <div className="relative bg-ink" onPointerDown={() => setTouched(true)} onWheel={() => setTouched(true)}>
        <Canvas shadows={LITE ? true : 'soft'} dpr={[1, 1.5]} camera={{ position: [2, 1.2, 2], fov: 40 }} gl={{ antialias: true, localClippingEnabled: true, toneMappingExposure: 1.15 }} onCreated={({ gl }) => { gl.localClippingEnabled = true; }}>
          <color attach="background" args={['#0b0f14']} />
          <SceneEnvironment terrain={VIEWER_SKY} intensity={0.8} lite />
          {LITE && <hemisphereLight args={['#c9d6e8', '#2a2419', 0.3]} />}
          <ambientLight intensity={0.12} />
          <directionalLight position={[3 * R, 5 * R, 2 * R]} intensity={2.2} color="#fff3e0" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.02} shadow-camera-left={-2.5 * R} shadow-camera-right={2.5 * R} shadow-camera-top={2.5 * R} shadow-camera-bottom={-2.5 * R} shadow-camera-near={0.1 * R} shadow-camera-far={14 * R} />
          <directionalLight position={[-3 * R, 2 * R, -2 * R]} intensity={0.35} color="#cfe0ff" />
          <directionalLight position={[-2 * R, 3 * R, -4 * R]} intensity={0.9} color="#9fc5ff" />
          <hemisphereLight args={['#c9d6e8', '#2a2419', 0.2]} />
          {bounds && <Backdrop radius={R * 40} />}
          {bounds && <Ground y={groundY - 0.002 * R} radius={R} />}
          <Suspense fallback={null}>
            <Model url={url} selected={selected} mode={mode} explode={explode} ghost={ghost} hovered={hovered} onPick={(k) => setSelected(k ? [k] : [])} onHover={setHovered} onNodes={setNodes} onBounds={setBounds} onLoaded={() => { setLoaded(true); frameSel(); }} />
          </Suspense>
          <PartLabel selected={selected} nodeLabels={nodeLabels} />
          <Framer trigger={frame} selected={selected} scope={scope} ghost={ghost} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
          <Turntable active={loaded && !touched} />
          <ContextLoss />
          {bounds && <Effects ao={{ aoRadius: R * 0.35, distanceFalloff: 0.5, intensity: 2.0 }} bloom={{ intensity: 0.15 }} guard={false} />}
        </Canvas>
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          <Btn icon={Focus} label={!selected.length ? 'Frame (F)' : scope === 'selection' ? 'Frame all (F)' : 'Frame part (F)'} onClick={frameToggle} />
          <Btn m="isolate" icon={EyeOff} label="Only this (O)" active={mode === 'isolate'} />
          <Btn m="fade" icon={Blend} label="Translucent (T)" active={mode === 'fade'} />
          <Btn m="cut" icon={Scissors} label="Section (S)" active={mode === 'cut'} />
          <Btn icon={Expand} label="Explode (E)" active={explode > 0} onClick={() => setExplode(x => x > 0 ? 0 : 1)} />
          <Btn icon={RotateCcw} label="Reset (R)" onClick={() => { setMode(baseMode); setExplode(0); setSelected(highlight); frameSel(); }} />
        </div>
        <div className="absolute bottom-2 left-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-mute">Generic model built from public dimensions; not a manufacturer's design. Click a part to select it.</div>
        {!loaded && <div className="absolute inset-0 flex items-center justify-center text-xs text-mute pointer-events-none">Loading model</div>}
      </div>
      <div className="border-l border-line bg-panel overflow-y-auto p-2">
        <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Parts</div>
        <ul className="space-y-0.5">
          {nodes.map(n => (
            <li key={n}>
              <button className={'w-full text-left text-[11px] mono px-1.5 py-1 rounded hover:bg-panel2 ' + (selected.includes(n) ? 'bg-panel2 text-accent' : hovered === n ? 'bg-panel2 text-white' : 'text-mute')} onClick={() => setSelected(selected.length === 1 && selected[0] === n ? [] : [n])} onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(null)}>
                {nodeLabels[n] || n.replace(/^[A-Z]{2}-[A-Z0-9]+-/, '')}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 text-[10px] text-mute">Keys: F frame part or all, O only this, T translucent others, S section, E explode, A show all, R reset, Esc clear. The model turns slowly until you touch it.</div>
      </div>
    </div>
  );
}

useGLTF.preload && useGLTF.preload('/glb/WH/WH-GATEVALVE.7-15K.glb', '/draco/');
