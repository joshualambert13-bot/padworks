import { Suspense, useEffect, useState } from 'react';
import { Layers, Mountain, Columns2, Tag, Camera, SlidersHorizontal, Box as BoxIcon, ListOrdered, Sparkles, Sun, Sunset, Moon, Volume2, VolumeX, Snowflake, Leaf, Link2, Check, Activity, Footprints, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { WALK } from './parts/walk.jsx';
import { soundOn, toggleSound, onSoundChange, armSoundOnGesture, disableSound } from './sound.js';
import { LITE, setLite, nextTod } from './parts/lighting.jsx';
import { useFx, fxOn, FX_LIMIT_MS, useDiag } from './parts/effects.jsx';
import { Wand2 } from 'lucide-react';
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

const WALK_ARROWS = [['f', 1, ArrowUp, 'Forward'], ['s', -1, ArrowLeft, 'Left'], ['s', 1, ArrowRight, 'Right'], ['f', -1, ArrowDown, 'Back']];
// Phone walk pad (Drop 59): thumb-sized arrows in the lower right corner of the 3D view, shown only on narrow
// screens (the toolbar keeps its small arrows on desktop). Hold an arrow to walk; the Run toggle in the middle
// doubles the pace. Writes the same WALK input the keys do.
function WalkPad() {
  const [run, setRun] = useState(false);
  const hold = (axis, v) => ({
    onPointerDown: (e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); WALK[axis] = v; },
    onPointerUp: () => { WALK[axis] = 0; }, onPointerCancel: () => { WALK[axis] = 0; }, onPointerLeave: () => { WALK[axis] = 0; },
  });
  const cell = 'w-12 h-12 rounded-lg bg-black/60 text-white flex items-center justify-center touch-none select-none active:bg-accent/80';
  return (
    <div className="absolute right-3 bottom-9 z-20 md:hidden grid grid-cols-3 gap-1 pointer-events-auto" data-walk-pad>
      <div />
      <button className={cell} aria-label="Forward" {...hold('f', 1)}><ArrowUp size={22} /></button>
      <div />
      <button className={cell} aria-label="Left" {...hold('s', -1)}><ArrowLeft size={22} /></button>
      <button className={cell + ' text-[10px] font-semibold ' + (run ? 'bg-accent/80' : '')} aria-label="Run" onClick={() => { WALK.run = !run; setRun(!run); }}>RUN</button>
      <button className={cell} aria-label="Right" {...hold('s', 1)}><ArrowRight size={22} /></button>
      <div />
      <button className={cell} aria-label="Back" {...hold('f', -1)}><ArrowDown size={22} /></button>
      <div />
    </div>
  );
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
  const tod = ui.tod || 'day';
  const TOD_UI = { day: { Icon: Sun, label: 'Day', title: 'Midday sun. Click for dusk: low warm sun, light towers lit.' }, dusk: { Icon: Sunset, label: 'Dusk', title: 'Dusk: low sun in the west, light towers lit. Click for night.' }, night: { Icon: Moon, label: 'Night', title: 'Night: moonlight, light towers carrying the pad, data van lit. Click for day.' } };
  const todUi = TOD_UI[tod] || TOD_UI.day;
  // sound (Drop 32): on only after a click; a remembered preference re-arms on the first gesture; off when leaving the simulator
  const [sound, setSound] = useState(soundOn());
  // shareable links (Drop 42): ?s=<token> on /simulate rebuilds the job; the Share button copies the current one
  const [copied, setCopied] = useState(false);
  // Stats readout (Drop 43): the numbers to send when something runs slow or looks wrong on a machine I cannot see
  const [statsOpen, setStatsOpen] = useState(false);
  const diag = useDiag();
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('s');
    if (token) { useSim.getState().applyShareToken(token); window.history.replaceState({}, '', window.location.pathname); }
  }, []);
  const share = () => {
    const url = window.location.origin + window.location.pathname + '?s=' + useSim.getState().shareToken();
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link', url));
    else window.prompt('Copy this link', url);
  };
  useEffect(() => { const off = onSoundChange(setSound); const disarm = armSoundOnGesture(); return () => { off(); disarm(); disableSound(false); }; }, []);
  const setPreset = (preset) => setUi({ preset, walk: false });
  const walk = !!ui.walk;
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
  const fx = useFx();
  const fxLive = fxOn(fx);

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
            <option value="tanks">Frac tanks</option>
            <option value="gate">Pad entrance</option>
            <option value="support">Data van and power</option>
            <option value="flowback">Flowback spread</option>
            <option value="basin">Basin view</option>
          </select>
        )}
        {view === 'surface' && <button className={'btn flex items-center gap-1 ' + (walk ? 'btn-primary' : '')} title={walk ? 'Walking the pad: W A S D or arrows move, Shift runs, drag to look, Esc or click to leave.' : 'Walk the pad at eye height: W A S D or arrows move, Shift runs, drag to look, Esc to leave.'} onClick={() => setUi({ walk: !walk })} data-action="walk"><Footprints size={14} />Walk</button>}
        <button className={'btn flex items-center gap-1 ' + (showLabels ? 'btn-primary' : '')} onClick={() => setShowLabels(!showLabels)}><Tag size={14} />Labels</button>
        {view === 'surface' && <button className="btn flex items-center gap-1" title={todUi.title} onClick={() => setUi({ tod: nextTod(tod) })}><todUi.Icon size={14} />{todUi.label}</button>}
        {view === 'surface' && <button className="btn flex items-center gap-1" title={ui.season === 'winter' ? 'Winter: snow by basin (deep in the north, frost in the Permian), overcast, flurries, condensing exhaust. Click for summer.' : 'Summer. Click for winter conditions.'} onClick={() => setUi({ season: ui.season === 'winter' ? 'summer' : 'winter' })}>{ui.season === 'winter' ? <Snowflake size={14} /> : <Leaf size={14} />}{ui.season === 'winter' ? 'Winter' : 'Summer'}</button>}
        <button className={'btn flex items-center gap-1 ' + (statsOpen ? 'btn-primary' : '')} title="Stats: frame rate, frame time, draw calls, triangles, the graphics chip, and any shader error. Screenshot this when reporting a problem." onClick={() => setStatsOpen(!statsOpen)} data-action="stats"><Activity size={14} />Stats</button>
        <button className="btn flex items-center gap-1" title="Copy a link that opens this job as it is now: setup, phase, stage, time of day, season, and camera preset." onClick={share} data-action="share">{copied ? <Check size={14} /> : <Link2 size={14} />}{copied ? 'Copied' : 'Share'}</button>
        <button className={'btn flex items-center gap-1 ' + (sound ? '' : 'text-mute')} title={sound ? 'Sound on: pumps, wireline, coil, flowback, alarms, valve actuation. Click to mute.' : 'Sound off. Click for pad sound (synthesized; no downloads).'} onClick={toggleSound}>{sound ? <Volume2 size={14} /> : <VolumeX size={14} />}{sound ? 'Sound' : 'Muted'}</button>
        <button className="btn flex items-center gap-1" title={LITE ? 'Lite rendering: hard shadows, no sky reflections. Click for full quality (reloads the page).' : 'Full rendering: sky reflections, soft shadows, ground detail. Click for lite mode on a slow machine (reloads the page).'} onClick={() => setLite(!LITE)}><Sparkles size={14} />{LITE ? 'Lite' : 'Full'}</button>
        {!LITE && <button className={'btn flex items-center gap-1 ' + (fxLive ? '' : 'text-mute')} title={fxLive ? 'Effects on: ambient occlusion and bloom. Click to turn them off.' : fx.auto ? 'Effects turned off automatically: this machine averaged ' + fx.frameMs + ' ms per frame with them on (limit ' + FX_LIMIT_MS + ' ms). Click to try again.' : 'Effects off. Click for ambient occlusion and bloom.'} onClick={() => fx.setWanted(!fxLive)} data-action="effects"><Wand2 size={14} />{fxLive ? 'Effects' : 'Effects off'}</button>}
      </div>
      {statsOpen && (
        <div className="w-full mt-1 text-[11px] mono px-2 py-1 rounded bg-black/70 text-white pointer-events-none" data-stats>
          {diag.fps} fps · {diag.frameMs} ms/frame · {diag.calls.toLocaleString()} draws · {(diag.triangles / 1000).toFixed(0)}k tris · {LITE ? 'Lite' : 'Full'}{!LITE ? (fxLive ? ' + effects' : ' (effects off)') : ''} · {window.innerWidth}x{window.innerHeight} @ {diag.dpr || Math.round(window.devicePixelRatio * 100) / 100}x (screen {Math.round(window.devicePixelRatio * 100) / 100}x) · GPU: {diag.gpu || '...'}{diag.shaderError ? ' · SHADER ERROR: ' + diag.shaderError : ''}
        </div>
      )}
      {walk && view === 'surface' && (
        <div className="w-full mt-1 flex items-center gap-2 text-[11px] px-2 py-1 rounded bg-black/60 text-white pointer-events-auto" data-walk-bar>
          <span className="mr-auto hidden md:inline">Walking: W A S D or arrows move, Shift runs, drag the view to look around, Esc leaves.</span>
          <span className="mr-auto md:hidden">Walking: drag to look around, the arrows walk, the Walk button leaves.</span>
          {WALK_ARROWS.map(([axis, v, Icon, label]) => (
            <button key={label} className="btn px-2 py-1 touch-none select-none hidden md:block" title={label} aria-label={label}
              onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); WALK[axis] = v; }}
              onPointerUp={() => { WALK[axis] = 0; }} onPointerCancel={() => { WALK[axis] = 0; }} onPointerLeave={() => { WALK[axis] = 0; }}>
              <Icon size={14} />
            </button>
          ))}
        </div>
      )}
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
        <aside className={'min-h-0 min-w-0 overflow-hidden border-r border-line bg-panel ' + (mobileTab === 'controls' ? 'block' : 'hidden md:block')}><ControlPanel /></aside>
        <section className={'relative min-h-0 min-w-0 ' + (mobileTab === '3d' ? 'block' : 'hidden md:block')}>
          <Viewport view={view} showLabels={showLabels} preset={preset} />
          {toolbar}
          {walk && view === 'surface' && <WalkPad />}
        </section>
        <aside className={'min-h-0 min-w-0 overflow-hidden border-l border-line bg-panel ' + (mobileTab === 'timeline' ? 'block' : 'hidden md:block')}><TimelinePanel /></aside>
      </div>
    </div>
  );
}
