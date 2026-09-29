// GLB record viewer: navigator of named nodes, isolate, fade others, cut-away (clipping plane),
// explode, frame, and keyboard shortcuts (F frame, I isolate, D fade, X cut-away, E explode, U unhide, R reset).
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { Focus, EyeOff, Blend, Scissors, Expand, RotateCcw } from 'lucide-react';

function Model({ url, selected, mode, explode, onPick, onNodes, onLoaded }) {
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
    cloned.traverse(o => {
      if (!o.isMesh) return;
      const key = o.userData.key;
      const isSel = sel.size === 0 || sel.has(key);
      o.visible = mode === 'isolate' ? isSel : true;
      o.material.opacity = mode === 'fade' && !isSel ? 0.12 : 1;
      o.material.depthWrite = !(mode === 'fade' && !isSel);
      o.material.clippingPlanes = mode === 'cut' ? [plane] : [];
      o.material.emissive = new THREE.Color(isSel && sel.size > 0 ? '#1d4d3a' : '#000000');
      o.material.needsUpdate = true;
      const c = centers.current.get(o);
      if (c && o.userData.basePos) {
        const dir = c.clone().normalize();
        o.position.copy(o.userData.basePos).add(dir.multiplyScalar(explode * 0.6));
      }
    });
  }, [cloned, selected, mode, explode, plane]);

  // CadQuery exports are Z-up; glTF viewers are Y-up. Rotate so the stem points up.
  return <primitive object={cloned} rotation={[-Math.PI / 2, 0, 0]} onClick={e => { e.stopPropagation(); onPick(e.object.userData.key); }} onPointerMissed={() => onPick(null)} />;
}

function Framer({ trigger }) {
  const camera = useThree(st => st.camera);
  const controls = useThree(st => st.controls);
  const scene = useThree(st => st.scene);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    scene.traverse(o => { if (o.isMesh && o.visible) box.expandByObject(o); });
    if (box.isEmpty()) { const t = setTimeout(() => setRetry(x => x + 1), 200); return () => clearTimeout(t); }
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    const fov = THREE.MathUtils.degToRad(camera.fov || 40);
    const dist = (size / 2) / Math.tan(fov / 2) * 1.15;
    camera.position.copy(center).add(new THREE.Vector3(0.6, 0.35, 0.72).normalize().multiplyScalar(dist));
    camera.near = Math.max(0.01, size / 100); camera.far = size * 20; camera.updateProjectionMatrix();
    camera.lookAt(center);
    if (controls) { controls.target.copy(center); controls.update(); }
    else { const t = setTimeout(() => setRetry(x => x + 1), 200); return () => clearTimeout(t); }
  }, [trigger, retry, camera, controls, scene]);
  return null;
}

export default function Viewer({ url, highlight = [], nodeLabels = {} }) {
  const [selected, setSelected] = useState(highlight);
  const [mode, setMode] = useState('normal');
  const [explode, setExplode] = useState(0);
  const [nodes, setNodes] = useState([]);
  const [frame, setFrame] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setSelected(highlight), [highlight]);
  useEffect(() => { setLoaded(false); }, [url]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === 'f') setFrame(x => x + 1);
      if (k === 'i') setMode(m => m === 'isolate' ? 'normal' : 'isolate');
      if (k === 'd') setMode(m => m === 'fade' ? 'normal' : 'fade');
      if (k === 'x') setMode(m => m === 'cut' ? 'normal' : 'cut');
      if (k === 'e') setExplode(x => x > 0 ? 0 : 1);
      if (k === 'u') { setMode('normal'); }
      if (k === 'r') { setMode('normal'); setExplode(0); setSelected(highlight); setFrame(x => x + 1); }
      if (k === 'escape') setSelected([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [highlight]);

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
            <Model url={url} selected={selected} mode={mode} explode={explode} onPick={(k) => setSelected(k ? [k] : [])} onNodes={setNodes} onLoaded={() => { setLoaded(true); setFrame(x => x + 1); }} />
          </Suspense>
          <Framer trigger={frame} />
          <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
        </Canvas>
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          <Btn icon={Focus} label="Frame (F)" onClick={() => setFrame(x => x + 1)} />
          <Btn m="isolate" icon={EyeOff} label="Isolate (I)" active={mode === 'isolate'} />
          <Btn m="fade" icon={Blend} label="Fade others (D)" active={mode === 'fade'} />
          <Btn m="cut" icon={Scissors} label="Cut-away (X)" active={mode === 'cut'} />
          <Btn icon={Expand} label="Explode (E)" active={explode > 0} onClick={() => setExplode(x => x > 0 ? 0 : 1)} />
          <Btn icon={RotateCcw} label="Reset (R)" onClick={() => { setMode('normal'); setExplode(0); setSelected(highlight); setFrame(x => x + 1); }} />
        </div>
        <div className="absolute bottom-2 left-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-mute">Generic geometry from public dimensions; not an OEM design. Click a part to select it.</div>
        {!loaded && <div className="absolute inset-0 flex items-center justify-center text-xs text-mute pointer-events-none">Loading model</div>}
      </div>
      <div className="border-l border-line bg-panel overflow-y-auto p-2">
        <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Navigator</div>
        <ul className="space-y-0.5">
          {nodes.map(n => (
            <li key={n}>
              <button className={'w-full text-left text-[11px] mono px-1.5 py-1 rounded hover:bg-panel2 ' + (selected.includes(n) ? 'bg-panel2 text-ok' : 'text-mute')} onClick={() => setSelected(selected.length === 1 && selected[0] === n ? [] : [n])}>
                {nodeLabels[n] || n.replace(/^[A-Z]{2}-[A-Z0-9]+-/, '')}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 text-[10px] text-mute">Keys: F frame, I isolate, D fade, X cut-away, E explode, U unhide, R reset, Esc clear.</div>
      </div>
    </div>
  );
}

useGLTF.preload && useGLTF.preload('/glb/WH/WH-GATEVALVE.glb', '/draco/');
