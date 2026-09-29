// Model viewer: part list, only-this, translucent others, section plane, explode, frame.
// Keys: F frame part or all, O only this, T translucent others, S section, E explode, A show all, R reset, Esc clear.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Focus, EyeOff, Blend, Scissors, Expand, RotateCcw } from 'lucide-react';

function Model({ url, selected, mode, explode, ghost, onPick, onNodes, onLoaded }) {
  const { scene } = useGLTF(url, '/draco/');
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const centers = useRef(new Map());
  useEffect(() => {
    const names = [];
    cloned.traverse(o => {
      if (o.isMesh) {
        o.userData.baseMaterial = o.material;
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.side = THREE.DoubleSide;
        o.material.clipShadows = true;
        const key = o.name || o.parent?.name;
        o.userData.key = key;
        if (key) names.push(key);
        const b = new THREE.Box3().setFromObject(o);
        centers.current.set(o, b.getCenter(new THREE.Vector3()));
        o.userData.basePos = o.position.clone();
      }
    });
    onNodes([...new Set(names)]);
    onLoaded && onLoaded();
  }, [cloned, onNodes]);

  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0), []);
  useEffect(() => {
    const sel = new Set(selected);
    const ghostSet = new Set(ghost || []);
    cloned.traverse(o => {
      if (!o.isMesh) return;
      const key = o.userData.key;
      const isSel = sel.size === 0 || sel.has(key);
      const isGhost = ghostSet.has(key) && !(sel.size > 0 && sel.has(key));
      o.visible = mode === 'isolate' ? isSel : true;
      o.material.opacity = (mode === 'fade' && !isSel) ? 0.18 : isGhost ? 0.22 : 1;
      o.material.depthWrite = !((mode === 'fade' && !isSel) || isGhost);
      o.material.clippingPlanes = mode === 'cut' ? [plane] : [];
      o.material.emissive = new THREE.Color(isSel && sel.size > 0 ? '#1d4d3a' : '#000000');
      o.material.needsUpdate = true;
      const c = centers.current.get(o);
      if (c && o.userData.basePos) {
        const dir = c.clone().normalize();
        o.position.copy(o.userData.basePos).add(dir.multiplyScalar(explode * 0.6));
      }
    });
  }, [cloned, selected, mode, explode, plane, ghost]);

  // CadQuery exports are Z-up; glTF viewers are Y-up. Rotate so the stem points up.
  return <primitive object={cloned} rotation={[-Math.PI / 2, 0, 0]} onClick={e => { e.stopPropagation(); onPick(e.object.userData.key); }} onPointerMissed={() => onPick(null)} />;
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
    scene.traverse(o => { if (o.isMesh && o.visible && (!useSel || sel.has(o.userData.key)) && !(ghostSet.has(o.userData.key) && !useSel)) box.expandByObject(o); });
    if (box.isEmpty()) scene.traverse(o => { if (o.isMesh && o.visible) box.expandByObject(o); });
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
  const frameSel = () => { setScope('selection'); setFrame(x => x + 1); };
  const frameAll = () => { setScope('all'); setFrame(x => x + 1); };
  const frameToggle = () => { setScope(sc => sc === 'selection' ? 'all' : 'selection'); setFrame(x => x + 1); };
  useEffect(() => { setSelected(highlight); setMode(highlight.length ? 'fade' : 'normal'); }, [highlight]);
  useEffect(() => { setLoaded(false); }, [url]);

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] h-full min-h-[420px]">
      <div className="relative bg-ink">
        <Canvas dpr={[1, 1.5]} camera={{ position: [2, 1.2, 2], fov: 40 }} gl={{ antialias: true, localClippingEnabled: true }} onCreated={({ gl }) => { gl.localClippingEnabled = true; }}>
          <color attach="background" args={['#0b0f14']} />
          <ambientLight intensity={0.9} />
          <directionalLight position={[3, 5, 2]} intensity={2.2} />
          <directionalLight position={[-3, 2, -2]} intensity={0.5} />
          <hemisphereLight args={['#c9d6e8', '#2a2419', 0.6]} />
          <Suspense fallback={null}>
            <Model url={url} selected={selected} mode={mode} explode={explode} ghost={ghost} onPick={(k) => setSelected(k ? [k] : [])} onNodes={setNodes} onLoaded={() => { setLoaded(true); frameSel(); }} />
          </Suspense>
          <Framer trigger={frame} selected={selected} scope={scope} ghost={ghost} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
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
              <button className={'w-full text-left text-[11px] mono px-1.5 py-1 rounded hover:bg-panel2 ' + (selected.includes(n) ? 'bg-panel2 text-accent' : 'text-mute')} onClick={() => setSelected(selected.length === 1 && selected[0] === n ? [] : [n])}>
                {nodeLabels[n] || n.replace(/^[A-Z]{2}-[A-Z0-9]+-/, '')}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 text-[10px] text-mute">Keys: F frame part or all, O only this, T translucent others, S section, E explode, A show all, R reset, Esc clear.</div>
      </div>
    </div>
  );
}

useGLTF.preload && useGLTF.preload('/glb/WH/WH-GATEVALVE.glb', '/draco/');
