import { Play, Pause, RotateCcw, AlertTriangle, Gauge, Zap, ArrowRightCircle, CheckCircle2, Lock, ListChecks, Circle, Settings2, Bolt, Dices, GraduationCap, Trophy, FileText, Lightbulb, XCircle } from 'lucide-react';
import { useSim, phasesFor, FRAC_MODES, BORES, COMPLETIONS, FLEETS, LIFTS, EVENTS, padRoles, nextSteps, wellParams, basinOf, spreadSizing, designTotals, scoreOf } from '../store.js';
import { lessonById, nextLessonId, stepValve } from '../lessons.js';
import SetupPanel from './SetupPanel.jsx';
import { heightZone, BARRIER_TOP } from '../geology.js';

// Score chip: points and grade for the job so far, and the way into the session summary
export function ScoreChip({ s }) {
  const L = s.lesson.id && !s.lesson.finished ? lessonById(s.lesson.id) : null;
  const sc = L ? scoreOf(s.score, { since: s.lesson.startedAt, exempt: L.exempt || [] }) : scoreOf(s.score);
  const color = sc.grade === 'A' ? 'text-ok' : sc.grade === 'B' ? 'text-accent' : sc.grade === 'C' ? 'text-warn' : 'text-bad';
  return (
    <button className="btn flex items-center gap-1" onClick={s.openSummary} title={(L ? 'Lesson score so far (before the time check). ' : 'Job score so far. ') + 'Opens the session summary: deductions, recoveries, stage times'} data-action="summary">
      <Trophy size={14} className={color} /><span className="mono text-xs">{sc.total}</span><span className={'mono text-xs ' + color}>{sc.grade}</span>
    </button>
  );
}

// Guided lesson card: the lesson's own checkpoints in order, with the hint for the one that is up
function LessonCard({ s }) {
  const L = lessonById(s.lesson.id);
  if (!L) return null;
  const mask = s.lesson.doneMask;
  const idx = mask.indexOf(false);
  const doneCount = mask.filter(Boolean).length;
  const r = s.lesson.result;
  const nextId = nextLessonId(L.id);
  return (
    <div className={'card p-2 space-y-1 ' + (s.lesson.finished ? 'border-ok/60 bg-ok/10' : 'border-cool/60')} data-panel="lesson">
      <div className="flex items-center gap-1 text-xs font-semibold text-cool"><GraduationCap size={14} /><span>Lesson {L.n} of 8: {L.title}</span>
        <span className="ml-auto mono text-[10px] text-mute">{doneCount}/{L.steps.length}</span>
        {!s.lesson.finished && <button className="text-mute" title="Leave the lesson; the job continues" onClick={s.quitLesson}><XCircle size={14} /></button>}
      </div>
      <div className="h-1 rounded bg-line overflow-hidden"><div className="h-full bg-cool" style={{ width: (doneCount / L.steps.length * 100) + '%' }} /></div>
      {s.lesson.finished && r && (
        <div className="text-xs space-y-1" data-lesson-result>
          <div className="flex items-center gap-2"><Trophy size={14} className="text-ok" /><span className="font-semibold">Lesson complete: <span className="mono">{r.score}</span> points, grade <span className="mono">{r.grade}</span></span></div>
          <div className="text-[11px] text-mute">{r.secs} s against a target of {r.targetSec} s{r.timePts ? ' (' + r.timePts + ' points off for time)' : ''}. {r.deductions.length ? r.deductions.length + ' deduction' + (r.deductions.length > 1 ? 's' : '') + ': ' + r.deductions.map(d => d.label.split(':')[0].toLowerCase() + ' (' + d.pts + ')').join(', ') + '.' : 'No deductions.'}</div>
          <div className="flex gap-1">
            {nextId && <button className="btn btn-primary text-[11px] px-2 py-0.5" onClick={s.nextLesson}>Next: lesson {L.n + 1}</button>}
            <button className="btn text-[11px] px-2 py-0.5" onClick={() => s.startLesson(L.id)}>Run it again</button>
            <button className="btn text-[11px] px-2 py-0.5" onClick={s.quitLesson}>Free play</button>
          </div>
        </div>
      )}
      <ol className="space-y-1">
        {L.steps.map((step, i) => {
          const done = !!mask[i];
          const isCurrent = i === idx;
          const valve = isCurrent ? stepValve(step, s) : null;
          return (
            <li key={i} className={'flex items-start gap-2 text-xs ' + (done ? 'text-mute line-through' : isCurrent ? 'text-white' : 'text-mute')}>
              {done ? <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-ok" /> : <Circle size={14} className={'shrink-0 mt-0.5 ' + (isCurrent ? 'text-cool' : '')} />}
              <span className="flex-1"><span className="mono text-[10px] mr-1">{i + 1}.</span>{step.text}</span>
              {isCurrent && step.action && <button className="btn btn-primary text-[11px] px-2 py-0.5" onClick={() => { s.focusOn({ action: step.action }); s.guide(step.action); }}>{step.label || 'Do it'}</button>}
              {isCurrent && !step.action && valve && s.valves[valve] && <button className="btn text-[11px] px-2 py-0.5" onClick={() => { s.focusOn({ valve }); s.commandValve(valve, s.valves[valve].target === 1 ? 0 : 1); }}>{s.valves[valve].target === 1 ? 'Close' : 'Open'}</button>}
            </li>
          );
        })}
      </ol>
      {idx >= 0 && L.steps[idx].hint && <div className="flex items-start gap-1 text-[11px] text-mute"><Lightbulb size={12} className="shrink-0 mt-0.5 text-cool" /><span>{L.steps[idx].hint}</span></div>}
    </div>
  );
}

function ValveRow({ id, v, onCommand, hot }) {
  const open = v.pos > 0.99, closed = v.pos < 0.01;
  const state = open ? 'OPEN' : closed ? 'CLOSED' : v.target === 1 ? 'OPENING' : 'CLOSING';
  const color = open ? 'text-ok' : closed ? 'text-bad' : 'text-warn';
  return (
    <div className={'flex items-center gap-2 py-1 border-b border-line/60 ' + (hot ? 'bg-accent/10 -mx-1 px-1 rounded ring-1 ring-accent/60' : '')}>
      <div className="flex-1 min-w-0">
        <div className={'text-xs truncate ' + (hot ? 'text-accent' : '')}>{hot ? '▶ ' : ''}{v.label}</div>
        <div className="h-1 mt-1 rounded bg-line overflow-hidden"><div className="h-full bg-ok" style={{ width: (v.pos * 100) + '%' }} /></div>
      </div>
      <span className={'mono text-[10px] w-14 text-right ' + color}>{state}</span>
      <button className={'btn ' + (v.target === 1 ? '' : 'btn-primary')} onClick={() => onCommand(id, v.target === 1 ? 0 : 1)} title={v.kind === 'hydraulic' ? 'Hydraulic actuator' : 'Handwheel'}>
        {v.target === 1 ? 'Close' : 'Open'}
      </button>
    </div>
  );
}

function Readout({ label, value, unit, warn }) {
  return (
    <div className="card p-2">
      <div className="text-[10px] uppercase tracking-wide text-mute">{label}</div>
      <div className={'mono text-lg leading-tight ' + (warn ? 'text-bad' : 'text-ok')}>{value}<span className="text-xs text-mute ml-1">{unit}</span></div>
    </div>
  );
}

export default function ControlPanel() {
  const s = useSim();
  if (s.phase === 'setup') return <SetupPanel />;
  const PH = phasesFor(s.setup).filter(p => p.id !== 'setup');
  const st = s.stages[s.stage];
  const count = s.stages.length;
  const WELL = wellParams(s);
  const sleeve = s.setup.completion === 'sleeve';
  const phaseIdx = PH.findIndex(p => p.id === s.phase);
  const nextPhase = PH[phaseIdx + 1];
  const allFracked = s.stages.every(x => x.fracComplete);
  const stageFracDone = st.fracComplete;
  const mode = FRAC_MODES.find(m => m.id === s.pad.mode) || FRAC_MODES[0];
  const roles = padRoles(s);
  const fracWells = roles.filter(r => r.role === 'frac').length + (s.phase === 'frac' ? 1 : 0);
  const wlWells = roles.filter(r => r.role === 'wireline').length + (s.phase === 'wireline' ? 1 : 0);
  const liveRate = s.pumpsOnline && !s.alarms.kickout ? s.pumpRate : 0;
  const guide = nextSteps(s);
  const current = guide.steps.find(x => !x.done);
  const lessonOn = !!s.lesson.id && !s.lesson.finished;
  const L = lessonOn ? lessonById(s.lesson.id) : null;
  const lessonIdx = lessonOn ? s.lesson.doneMask.indexOf(false) : -1;
  const lessonValve = L && lessonIdx >= 0 && !guide.blocked ? stepValve(L.steps[lessonIdx], s) : null;
  const hotValve = lessonValve || (current && current.valve ? current.valve : null);
  const basin = basinOf(s);
  const spread = spreadSizing(s);
  const totals = designTotals(s);
  const completion = COMPLETIONS.find(c => c.id === s.setup.completion) || COMPLETIONS[0];
  const fleet = FLEETS.find(f => f.id === s.setup.fleet) || FLEETS[0];

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3 text-sm">
      {/* run controls */}
      <div className="flex items-center gap-2">
        <button className="btn flex items-center gap-1" onClick={s.toggleRunning}>{s.running ? <Pause size={14} /> : <Play size={14} />}{s.running ? 'Pause' : 'Run'}</button>
        <select className="btn" value={s.speed} onChange={e => s.setSpeed(Number(e.target.value))}>
          {[0.5, 1, 2, 4].map(x => <option key={x} value={x}>{x}x</option>)}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <ScoreChip s={s} />
          <button className="btn flex items-center gap-1" onClick={s.reset} title="Back to pad setup"><RotateCcw size={14} />Reset</button>
        </div>
      </div>

      {/* guided lesson, when one is running */}
      {s.lesson.id && <LessonCard s={s} />}

      {/* next steps: what still has to happen, in order, for the job to continue (during a lesson only when the job is stopped) */}
      {(!lessonOn || guide.blocked) && (
      <div className={'card p-2 space-y-1 ' + (guide.blocked ? 'border-bad/70 bg-bad/10' : 'border-accent/40')}>
        <div className={'flex items-center gap-1 text-xs font-semibold ' + (guide.blocked ? 'text-bad' : 'text-accent')}>
          {guide.blocked ? <AlertTriangle size={14} /> : <ListChecks size={14} />}
          <span>{guide.blocked ? 'Job stopped: ' : 'Next steps: '}{guide.title}</span>
        </div>
        {guide.why && <div className="text-[11px] text-mute">{guide.why}</div>}
        <ol className="space-y-1">
          {guide.steps.map((step, i) => {
            const isCurrent = step === current;
            return (
              <li key={i} className={'flex items-start gap-2 text-xs ' + (step.done ? 'text-mute line-through' : isCurrent ? 'text-white' : 'text-mute')}>
                {step.done ? <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-ok" /> : <Circle size={14} className={'shrink-0 mt-0.5 ' + (isCurrent ? 'text-accent' : '')} />}
                <span className="flex-1"><span className="mono text-[10px] mr-1">{i + 1}.</span>{step.text}</span>
                {isCurrent && step.action && (
                  <button className="btn btn-primary text-[11px] px-2 py-0.5" disabled={step.gate === false} onClick={() => { s.focusOn({ action: step.action }); s.guide(step.action); }}>{step.label || 'Do it'}</button>
                )}
                {isCurrent && step.valve && !step.action && (
                  <button className="btn text-[11px] px-2 py-0.5" onClick={() => { s.focusOn({ valve: step.valve }); s.commandValve(step.valve, s.valves[step.valve].target === 1 ? 0 : 1); }}>{s.valves[step.valve].target === 1 ? 'Close' : 'Open'}</button>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      )}

      {/* job summary from setup */}
      <div className="card p-2 space-y-1">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-mute">Job<button className="btn ml-auto text-[11px] px-2 py-0.5 flex items-center gap-1" onClick={s.backToSetup} title="Back to pad setup (restarts the job)"><Settings2 size={12} />Change setup</button></div>
        <div className="text-[11px] text-mute"><span className="text-white">{basin.label}</span> · {s.pad.wells} well{s.pad.wells > 1 ? 's' : ''}, {mode.label.toLowerCase()} · {(BORES.find(b => b.id === s.pad.bore) || BORES[5]).label} tree</div>
        <div className="text-[11px] text-mute">{completion.label}{sleeve ? ', ' + (s.setup.sleeveSystem === 'openhole' ? 'openhole packers' : 'cemented') : ''}, {s.setup.plugs === 'dissolvable' ? 'dissolvable' : 'millable'} · {s.setup.lateralFt.toLocaleString()} ft lateral, {totals.stages} stages by design, {s.setup.clusters} {sleeve ? 'ports' : 'clusters'} each</div>
        <div className="text-[11px] text-mute">{fleet.label}: {spread.pumps} pumps, {spread.availableHhp.toLocaleString()} hhp · {s.setup.proppantLbFt.toLocaleString()} lb/ft, {s.setup.fluidBblFt} bbl/ft · lift: {(LIFTS.find(l => l.id === s.setup.lift) || LIFTS[0]).label.toLowerCase()}</div>
        <div className="text-[11px] text-mute">Well 1 is yours to operate. The other wells follow the crews: <span className="mono text-white">{fracWells}</span> pumping, <span className="mono text-white">{wlWells}</span> on {sleeve ? 'ball drop' : 'wireline'} right now.</div>
      </div>

      {/* phase selection */}
      <div className="card p-2">
        <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Phase</div>
        <div className="grid grid-cols-3 gap-1">
          {PH.map(p => (
            <button key={p.id} className={'btn text-xs ' + (s.phase === p.id ? 'btn-primary' : '')} onClick={() => s.setPhase(p.id)}>{p.short}</button>
          ))}
        </div>
        <div className="mt-2 text-xs text-mute">Stage <span className="mono text-white">{s.stage + 1}</span> of {count} shown · {PH[phaseIdx].label}</div>
        {nextPhase && s.phase !== 'frac' && s.phase !== 'wireline' && (
          <button className="btn mt-2 w-full flex items-center justify-center gap-1" onClick={() => s.setPhase(nextPhase.id)}><ArrowRightCircle size={14} />Next: {nextPhase.short}</button>
        )}
      </div>

      {/* training events: the instructor's panel */}
      <div className="card p-2 space-y-1" data-panel="events">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-mute"><Bolt size={12} />Events (instructor)
          <button className={'btn ml-auto text-[11px] px-2 py-0.5 flex items-center gap-1 ' + (s.events.random ? 'btn-primary' : '')} onClick={() => s.setRandomEvents(!s.events.random)} title="Fire events at random during the job"><Dices size={12} />Random {s.events.random ? 'on' : 'off'}</button>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {EVENTS.filter(e => !(e.pnpOnly && sleeve)).map(e => (
            <button key={e.id} className="btn text-[11px] px-1" disabled={!e.phases.includes(s.phase) || s.events.active === e.id || (e.id === 'misfire' && s.events.misfireArmed) || (e.id === 'stuck' && s.wl.step !== 'pumpdown') || (e.id === 'valveFault' && s.events.valveFault) || ((e.id === 'screenout' || e.id === 'prvLift' || e.id === 'sandOut') && liveRate <= 0) || (e.id === 'screenout' && s.alarms.screenout)} title={e.blurb} onClick={() => s.injectEvent(e.id)}>{e.label}</button>
          ))}
        </div>
        <div className="text-[10px] text-mute">{s.events.active ? 'Active: ' + (EVENTS.find(e => e.id === s.events.active) || {}).label + '. Follow the recovery steps above.' : s.events.misfireArmed ? 'Misfire armed for the next perforating run.' : 'Inject a fault to practice the recovery; the steps card shows the sequence.'}</div>
      </div>

      {/* production hookup */}
      {s.phase === 'production' && s.hookup.step !== 'done' && (
        <div className="card p-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-mute">Production hookup</div>
          <div className="text-xs text-mute">{s.hookup.step === 'rig' ? 'Frac stack off; the workover rig moves over the well with the BOP stack.' : s.hookup.step === 'tubing' ? 'Running tubing: ' + s.hookup.joints + ' of 300 joints.' : 'BOP stack off; production tree going on.'}</div>
          {s.hookup.step === 'tubing' && <div className="h-1 rounded bg-line overflow-hidden"><div className="h-full bg-ok" style={{ width: (s.hookup.progress * 100) + '%' }} /></div>}
        </div>
      )}

      {/* wireline or ball-drop controls */}
      {s.phase === 'wireline' && !sleeve && (
        <div className="card p-2 space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-mute">Wireline run (stage {s.stage + 1})</div>
          <div className="text-xs text-mute">Sequence: pump down, set plug toe-ward of the new perfs, fire clusters bottom-up, pull out. Pump-down pumps supply rate through the tree.</div>
          <div className="flex items-center gap-2">
            <button className="btn btn-primary" disabled={s.wl.step !== 'idle' || st.perforated || s.valves.swab.pos < 0.99 || s.valves.umv.pos < 0.99 || s.valves.lmv.pos < 0.99} onClick={s.startWirelineRun} title="Enabled when the swab and master valves are open">Run in hole</button>
            <button className="btn btn-danger flex items-center gap-1" disabled={s.wl.step !== 'armed'} onClick={s.fireGuns}><Zap size={14} />Fire guns</button>
          </div>
          {s.valves.swab.pos < 0.99 && s.wl.step === 'idle' && <div className="text-xs text-warn">Waiting for the swab valve to open.</div>}
          <div className="mono text-xs">Step: {s.wl.step} {s.wl.step !== 'idle' && s.wl.step !== 'armed' && s.wl.step !== 'done' ? Math.round(s.wl.progress * 100) + '%' : ''}</div>
          <label className="block text-xs">Pump-down rate <span className="mono">{s.pumpRate.toFixed(0)} bpm</span>
            <input type="range" min={0} max={30} step={1} value={s.pumpRate} onChange={e => s.setPumpRate(Number(e.target.value))} />
          </label>
          {s.wl.step === 'done' && <button className="btn btn-primary w-full" onClick={() => s.setPhase('frac')}>Swap to frac (close swab, rig down lubricator)</button>}
        </div>
      )}
      {s.phase === 'wireline' && sleeve && (
        <div className="card p-2 space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-mute">{s.stage === 0 ? 'Toe sleeve (stage 1)' : 'Ball drop (stage ' + (s.stage + 1) + ')'}</div>
          <div className="text-xs text-mute">{s.stage === 0 ? 'The toe sleeve opens on casing pressure: no ball, no wireline. Pump at a low rate until the ports open and pressure drops.' : 'Release the next larger ball from the launcher on the tree while pumping. It lands on its seat, shears the sleeve open, and isolates the stages below.'}</div>
          <div className="flex items-center gap-2">
            <button className={'btn ' + (s.pumpsOnline ? 'btn-danger' : 'btn-primary')} onClick={() => s.setPumpsOnline(!s.pumpsOnline)} disabled={s.alarms.kickout}>{s.pumpsOnline ? 'Pumps offline' : 'Pumps online'}</button>
            <button className="btn btn-primary" disabled={s.wl.step !== 'idle' || st.perforated} onClick={s.startWirelineRun}>{s.stage === 0 ? 'Pressure up' : 'Release ball ' + s.stage}</button>
          </div>
          <div className="mono text-xs">Step: {s.wl.step} {s.wl.step !== 'idle' && s.wl.step !== 'done' ? Math.round(s.wl.progress * 100) + '%' : ''} · balls dropped {s.ballsDropped}</div>
          <label className="block text-xs">Rate <span className="mono">{s.pumpRate.toFixed(0)} bpm</span>
            <input type="range" min={0} max={30} step={1} value={s.pumpRate} onChange={e => s.setPumpRate(Number(e.target.value))} />
          </label>
          {s.wl.step === 'done' && <button className="btn btn-primary w-full" onClick={() => s.setPhase('frac')}>Swap to frac (keep pumping)</button>}
        </div>
      )}

      {/* frac tree, missile, and zipper valves */}
      <div className="card p-2">
        <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Tree, missile, and zipper valves (two-position)</div>
        {Object.entries(s.valves).map(([id, v]) => <ValveRow key={id} id={id} v={v} onCommand={s.commandValve} hot={hotValve === id} />)}
        {s.alarms.interlock && (
          <div className="mt-2 flex items-start gap-1 text-xs text-warn"><Lock size={14} className="shrink-0 mt-0.5" /><span>{s.alarms.interlock}</span><button className="ml-auto text-mute" onClick={s.clearInterlock}>x</button></div>
        )}
      </div>

      {/* pumping controls */}
      {(s.phase === 'frac') && (
        <div className="card p-2 space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-mute">Frac spread</div>
          {!st.perforated && <div className="text-xs text-warn">Stage {s.stage + 1} has no {sleeve ? 'open sleeve ports. Drop the ball first.' : 'open perforations. Run wireline first.'}</div>}
          <div className="flex items-center gap-2">
            <button className={'btn ' + (s.pumpsOnline ? 'btn-danger' : 'btn-primary')} onClick={() => s.setPumpsOnline(!s.pumpsOnline)} disabled={s.alarms.kickout}>{s.pumpsOnline ? 'Pumps offline' : 'Pumps online'}</button>
            {s.alarms.kickout && <button className="btn" onClick={s.acknowledgeAlarms}>Acknowledge kickout</button>}
          </div>
          <label className="block text-xs">Slurry rate <span className="mono">{s.pumpRate.toFixed(0)} bpm</span> <span className="text-mute">(cap {spread.maxRatePerWell} bpm per well for this spread)</span>
            <input type="range" min={0} max={spread.maxRatePerWell} step={1} value={Math.min(s.pumpRate, spread.maxRatePerWell)} onChange={e => s.setPumpRate(Number(e.target.value))} />
          </label>
          <label className="block text-xs">Proppant concentration <span className="mono">{s.ppa.toFixed(2)} PPA</span>
            <input type="range" min={0} max={4} step={0.05} value={s.ppa} onChange={e => s.setPpa(Number(e.target.value))} />
          </label>
          <div className="text-[11px] text-mute">Kickout {WELL.maxTreatingPsi.toLocaleString()} psi · PRV {WELL.prvSetPsi.toLocaleString()} psi. Stage design {Math.round(totals.stageProppantLb / 1000)} klb and {Math.round(totals.stageFluidBbl).toLocaleString()} bbl; this stage {Math.round(st.stageProppantLb / 1000)} klb, {Math.round(st.stageSlurryBbl).toLocaleString()} bbl. Screenout risk rises with concentration at low rate and with thin fluids.</div>
          {stageFracDone && s.stage < count - 1 && (
            <button className="btn btn-primary w-full flex items-center justify-center gap-1" onClick={() => { s.nextStage(); s.setPhase('wireline'); }}><CheckCircle2 size={14} />Stage {s.stage + 1} complete: next stage {sleeve ? 'ball drop' : 'wireline'}</button>
          )}
          {allFracked && <button className="btn btn-primary w-full" onClick={() => s.setPhase('drillout')}>All stages complete: {s.setup.plugs === 'dissolvable' ? 'shut in and dissolve' : 'rig up coiled tubing'}</button>}
        </div>
      )}

      {s.phase === 'flowback' && (
        <div className="card p-2 space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-mute">Flowback</div>
          <label className="block text-xs">Choke opening <span className="mono">{Math.round(s.fb.choke * 64)}/64 in.</span>
            <input type="range" min={0.05} max={1} step={0.01} value={s.fb.choke} onChange={e => s.setChoke(Number(e.target.value))} />
          </label>
          <div className="text-xs text-mute">Cumulative flowback <span className="mono text-white">{s.fb.cumBbl.toFixed(0)} bbl</span></div>
        </div>
      )}

      {/* alarms */}
      {(s.alarms.overpressure || s.alarms.prvLifted || s.alarms.screenout || s.alarms.kickout) && (
        <div className="card p-2 border-bad/70 bg-bad/10 space-y-1">
          <div className="flex items-center gap-1 text-bad font-semibold text-xs"><AlertTriangle size={14} />ALARM</div>
          {s.alarms.overpressure && <div className="text-xs">Surface overpressure: pumping against a closed flow path.</div>}
          {s.alarms.prvLifted && <div className="text-xs">Pressure relief valve lifted on the missile.</div>}
          {s.alarms.kickout && <div className="text-xs">Pumps kicked out at maximum treating pressure.</div>}
          {s.alarms.screenout && <div className="text-xs">Screenout: pressure ramping at constant rate. Cut proppant and flush.</div>}
          <button className="btn w-full" onClick={s.acknowledgeAlarms}>Acknowledge</button>
        </div>
      )}

      {/* telemetry */}
      <div className="grid grid-cols-2 gap-2">
        <Readout label="Surface treating" value={s.surfacePsi.toFixed(0)} unit="psi" warn={s.surfacePsi > WELL.maxTreatingPsi * 0.9} />
        <Readout label="Rate, this well" value={liveRate.toFixed(0)} unit="bpm" />
        <Readout label="Spread rate" value={(liveRate * Math.max(1, fracWells)).toFixed(0)} unit={'bpm · ' + Math.max(1, fracWells) + ' well' + (fracWells > 1 ? 's' : '')} />
        <Readout label="Proppant" value={s.ppa.toFixed(2)} unit="PPA" />
        <Readout label="Slurry density" value={s.slurryPpg.toFixed(2)} unit="ppg" />
        <Readout label="Bottomhole" value={s.bhtpPsi.toFixed(0)} unit="psi" />
        <Readout label="Net pressure" value={s.netPsi.toFixed(0)} unit="psi" warn={s.netPsi > 2000} />
        <Readout label="Frac height" value={heightZone((s.stages[s.stage] || {}).fracTop || 0).label} unit={((s.stages[s.stage] || {}).fracTop || 0) >= BARRIER_TOP ? 'into sand above' : 'target band'} warn={heightZone((s.stages[s.stage] || {}).fracTop || 0).warn} />
        <Readout label="Friction" value={s.frictionPsi.toFixed(0)} unit="psi" />
        <Readout label="Hydrostatic" value={s.hydroPsi.toFixed(0)} unit="psi" />
        <Readout label="Slurry pumped" value={s.cumSlurryBbl.toFixed(0)} unit="bbl" />
        <Readout label="Proppant pumped" value={(s.cumProppantLb / 1000).toFixed(0)} unit="klb" />
      </div>
      <div className="text-[10px] text-mute flex items-start gap-1"><Gauge size={12} className="shrink-0 mt-0.5" /><span>Schematic motion and an illustrative pressure model; job volumes run 30 times faster than the clock. This is a training aid, not a fracturing simulator; nothing here is a design value.</span></div>
    </div>
  );
}
