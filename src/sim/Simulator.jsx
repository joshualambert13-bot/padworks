import { Suspense } from 'react';
import { Layers, Mountain, Columns2, Tag, Camera, SlidersHorizontal, Box as BoxIcon, ListOrdered } from 'lucide-react';
import SurfaceScene from './SurfaceScene.jsx';
import DownholeScene from './DownholeScene.jsx';
import ControlPanel from './panels/ControlPanel.jsx';
import TimelinePanel from './panels/TimelinePanel.jsx';
import { useSim, phasesFor } from './store.js';
import { lessonById } from './lessons.js';
import HoverPopup from './HoverPopup.jsx';
import SessionSummary from './SessionSummary.jsx';

const VIEWS = [
  { id: 'surface', label: 'Surface', icon: Layers },
  { id: 'downhole', label: 'Downhole', icon: Mountain },
  { id: 'split', label: 'Split', icon: Columns2 },
];

function Viewport({ view, showLabels, preset }) {
  if (view === 'split') {
    return (
      <div className="h-full grid grid-rows-2 md:grid-rows-1 md:grid-cols-2 gap-px bg-line">
        <div className="relative min-h-0"><Suspense fallback={null}><SurfaceScene showLabels={showLabels} preset={preset} tickHere /></Suspense><HoverPopup canvasKey="surface" /><Tagline text="Surface" /></div>
        <div className="relative min-h-0"><Suspense fallback={null}><DownholeScene showLabels={showLabels} tickHere={false} /></Suspense><HoverPopup canvasKey="downhole" /><Tagline text="Downhole section (schematic)" /></div>
      </div>
    );
  }
  if (view === 'downhole') return <div className="relative h-full"><Suspense fallback={null}><DownholeScene showLabels={showLabels} tickHere /></Suspense><HoverPopup canvasKey="downhole" /><Tagline text="Downhole section (schematic)" /></div>;
  return <div className="relative h-full"><Suspense fallback={null}><SurfaceScene showLabels={showLabels} preset={preset} tickHere /></Suspense><HoverPopup canvasKey="surface" /><Tagline text="Surface (generic models). Hover an item for its name; click to open its record." /></div>;
}

function Tagline({ text }) {
  return <div className="absolute left-2 bottom-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-mute pointer-events-none">{text}</div>;
}

export default function Simulator() {
  // view settings live in the store so they survive a trip to the library and back
  const ui = useSim(s => s.ui);
  const setUi = useSim(s => s.setUi);
  const view = ui.view, showLabels = ui.showLabels, preset = ui.preset, mobileTab = ui.mobileTab;
  const setView = (view) => setUi({ view });
  const setShowLabels = (showLabels) => setUi({ showLabels });
  const setPreset = (preset) => setUi({ preset });
  const setMobileTab = (mobileTab) => setUi({ mobileTab });
  const phase = useSim(s => s.phase);
  const stage = useSim(s => s.stage);
  const setup = useSim(s => s.setup);
  const PHASES = phasesFor(setup);
  const alarms = useSim(s => s.alarms);
  const anyAlarm = alarms.overpressure || alarms.screenout || alarms.kickout;
  const lesson = useSim(s => s.lesson);
  const L = lesson.id ? lessonById(lesson.id) : null;
  const lessonText = L ? 'Lesson ' + L.n + ': ' + L.title + (lesson.finished ? ' · complete' : ' · step ' + (lesson.doneMask.indexOf(false) + 1) + ' of ' + L.steps.length) + ' · ' : '';
  const summary = ui.summary;

  const toolbar = (
    <div className="absolute top-2 left-2 right-2 z-20 flex flex-wrap items-center gap-1 pointer-events-none">
      <div className="flex gap-1 pointer-events-auto">
        {VIEWS.map(v => (
          <button key={v.id} className={'btn flex items-center gap-1 ' + (view === v.id ? 'btn-primary' : '')} onClick={() => setView(v.id)}><v.icon size={14} />{v.label}</button>
        ))}
      </div>
      <div className="flex gap-1 pointer-events-auto ml-auto">
        {view !== 'downhole' && (
          <select className="btn" value={preset} onChange={e => setPreset(e.target.value)} title="Camera preset">
            <option value="pad">Pad overview</option>
            <option value="tree">Frac tree</option>
            <option value="row">Well row</option>
            <option value="zipper">Zipper manifold</option>
            <option value="pumps">Pumps and missile</option>
            <option value="sand">Sand and blender</option>
            <option value="flowback">Flowback spread</option>
            <option value="basin">Basin view</option>
          </select>
        )}
        <button className={'btn flex items-center gap-1 ' + (showLabels ? 'btn-primary' : '')} onClick={() => setShowLabels(!showLabels)}><Tag size={14} />Labels</button>
      </div>
      <div className={'w-full mt-1 text-xs px-2 py-1 rounded pointer-events-none ' + (anyAlarm ? 'bg-bad/80 text-white' : 'bg-black/50 text-mute')}>
        {anyAlarm ? 'ALARM ACTIVE: see the control panel' : phase === 'setup' ? 'Pad setup: pick a guided lesson or set up the pad yourself, then press Start the job.' : lessonText + PHASES.find(p => p.id === phase).label + ' · stage ' + (stage + 1)}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col relative">
      {summary && <SessionSummary />}
      {/* mobile tab bar */}
      <div className="md:hidden flex border-b border-line bg-panel">
        {[['controls', 'Controls', SlidersHorizontal], ['3d', '3D', BoxIcon], ['timeline', 'Timeline', ListOrdered]].map(([id, label, Icon]) => (
          <button key={id} className={'flex-1 py-2 text-xs flex items-center justify-center gap-1 ' + (mobileTab === id ? 'tab-active' : 'text-mute')} onClick={() => setMobileTab(id)}><Icon size={14} />{label}</button>
        ))}
      </div>
      <div className="flex-1 min-h-0 grid md:grid-cols-[320px_1fr_320px] xl:grid-cols-[340px_1fr_360px]">
        <aside className={'min-h-0 border-r border-line bg-panel ' + (mobileTab === 'controls' ? 'block' : 'hidden md:block')}><ControlPanel /></aside>
        <section className={'relative min-h-0 ' + (mobileTab === '3d' ? 'block' : 'hidden md:block')}>
          <Viewport view={view} showLabels={showLabels} preset={preset} />
          {toolbar}
        </section>
        <aside className={'min-h-0 border-l border-line bg-panel ' + (mobileTab === 'timeline' ? 'block' : 'hidden md:block')}><TimelinePanel /></aside>
      </div>
    </div>
  );
}
