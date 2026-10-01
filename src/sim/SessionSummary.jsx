// Session summary: the score for the job, every deduction with its time, event recoveries against their
// targets, per-stage times, lesson results, and the log. Printable (the print stylesheet hides everything
// else) and exportable as JSON. With a `job` prop it shows a saved summary (the admin panel uses this).
import { X, Printer, Download, Trophy } from 'lucide-react';
import { useSim, scoreOf, gradeOf, BASINS, FRAC_MODES, BORES, COMPLETIONS, FLEETS, LIFTS, EVENTS, DEDUCT, EVENT_TARGETS, phasesFor } from './store.js';
import { LESSONS } from './lessons.js';

const fmtS = (x) => (x == null ? '-' : Math.round(x) + ' s');

export default function SessionSummary({ job: jobProp = null, lessonResults: lrProp = null, onClose = null, heading = null }) {
  const s = useSim();
  const job = jobProp || (s.phase === 'setup' ? s.lastJob : { setup: s.setup, pad: s.pad, t: s.t, phase: s.phase, stages: s.stages, score: s.score, log: s.log, events: s.events, lesson: s.lesson, when: Date.now() });
  const lessonResults = lrProp || s.lessonResults;
  const close = onClose || s.closeSummary;
  if (!job) return null;
  const sc = scoreOf(job.score);
  const basin = BASINS.find(b => b.id === job.setup.basin) || BASINS[0];
  const mode = FRAC_MODES.find(m => m.id === job.pad.mode) || FRAC_MODES[0];
  const bore = BORES.find(b => b.id === job.pad.bore) || BORES[5];
  const completion = COMPLETIONS.find(c => c.id === job.setup.completion) || COMPLETIONS[0];
  const fleet = FLEETS.find(f => f.id === job.setup.fleet) || FLEETS[0];
  const lift = LIFTS.find(l => l.id === job.setup.lift) || LIFTS[0];
  const phases = phasesFor(job.setup);
  const stageRows = job.stages.map(st => ({ st, rec: job.score.stages[st.index] || {} }));
  const sessionLessons = lessonResults.slice(-12).reverse();
  const stamp = new Date(job.when || Date.now()).toLocaleString();
  const exportJson = () => {
    const data = { site: 'Padworks', version: 'drop16', when: stamp, setup: job.setup, pad: job.pad, simSeconds: Math.round(job.t), score: sc, deductions: job.score.deductions, eventRecoveries: job.score.events, phaseSeconds: job.score.phaseSec, stages: stageRows.map(r => ({ stage: r.st.index + 1, ...r.rec, placed: r.st.proppantFill })), lessonResults, log: [...job.log].reverse() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'padworks-session.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const color = sc.grade === 'A' ? 'text-ok' : sc.grade === 'B' ? 'text-accent' : sc.grade === 'C' ? 'text-warn' : 'text-bad';
  return (
    <div className="absolute inset-0 z-40 bg-black/70 flex items-start justify-center overflow-y-auto p-3 md:p-6" data-panel="summary" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="print-area card w-full max-w-3xl p-4 space-y-4 text-sm bg-panel">
        <div className="flex items-center gap-2 no-print">
          <div className="text-xs uppercase tracking-wide text-mute">{heading || 'Session summary'}</div>
          <button className="btn ml-auto flex items-center gap-1" onClick={() => window.print()} data-action="print"><Printer size={14} />Print</button>
          <button className="btn flex items-center gap-1" onClick={exportJson}><Download size={14} />JSON</button>
          <button className="btn" onClick={close} title="Close" data-action="close-summary"><X size={14} /></button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2"><Trophy size={28} className={color} /><div><div className={'mono text-3xl leading-none ' + color}>{sc.total} <span className="text-xl">{sc.grade}</span></div><div className="text-[11px] text-mute">out of 100 · {sc.pts} points off</div></div></div>
          <div className="text-[11px] text-mute leading-relaxed">
            <div className="text-white font-semibold">Padworks training session · {stamp}</div>
            <div>{basin.label} · {job.pad.wells} well{job.pad.wells > 1 ? 's' : ''}, {mode.label.toLowerCase()} · {bore.label} tree · {completion.label}{job.setup.completion === 'sleeve' ? ' (' + job.setup.sleeveSystem + ')' : ''}, {job.setup.plugs}</div>
            <div>{fleet.label} · {job.setup.lateralFt.toLocaleString()} ft lateral, {job.setup.stageSpacingFt} ft stages, {job.setup.clusters} {job.setup.completion === 'sleeve' ? 'ports' : 'clusters'} · lift: {lift.label.toLowerCase()}</div>
            <div>Simulation time {Math.round(job.t)} s · reached {(phases.find(p => p.id === job.phase) || phases[0]).short.toLowerCase()} · {job.stages.filter(x => x.fracComplete).length} of {job.stages.length} stages pumped</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="card p-2">
            <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Deductions</div>
            {sc.deductions.length === 0 && <div className="text-xs text-mute">None. Every move followed the sequence and every recovery met its target.</div>}
            {sc.deductions.length > 0 && (
              <table className="w-full text-[11px]">
                <thead className="text-mute"><tr><th className="text-left font-normal">Time</th><th className="text-left font-normal">What</th><th className="text-right font-normal">Pts</th></tr></thead>
                <tbody>{sc.deductions.map((d, i) => <tr key={i}><td className="mono text-mute align-top">{Math.round(d.t)}s</td><td className="align-top">{d.label}</td><td className="mono text-right text-bad align-top">-{d.pts}</td></tr>)}</tbody>
              </table>
            )}
            <div className="text-[10px] text-mute mt-1">Weights: interlock {DEDUCT.interlock.pts}, valve against the sequence {DEDUCT.wrongMove.pts}, overpressure {DEDUCT.overpressure.pts}, kickout {DEDUCT.kickout.pts}, screenout {DEDUCT.screenout.pts}; slow recovery 1 per 15 s over target (max 8). Grades: A 90, B 80, C 70, D 60.</div>
          </div>
          <div className="card p-2">
            <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Event recoveries</div>
            {job.score.events.length === 0 && Object.keys(job.score.open || {}).length === 0 && <div className="text-xs text-mute">No events injected. Use the Events card (or Random) to practice recoveries.</div>}
            {(job.score.events.length > 0 || Object.keys(job.score.open || {}).length > 0) && (
              <table className="w-full text-[11px]">
                <thead className="text-mute"><tr><th className="text-left font-normal">Event</th><th className="text-right font-normal">At</th><th className="text-right font-normal">Recovered</th><th className="text-right font-normal">Target</th><th className="text-right font-normal">Pts</th></tr></thead>
                <tbody>
                  {job.score.events.map((e, i) => <tr key={i}><td>{e.label}</td><td className="mono text-right text-mute">{Math.round(e.at)}s</td><td className={'mono text-right ' + (e.secs <= e.target ? 'text-ok' : 'text-warn')}>{fmtS(e.secs)}</td><td className="mono text-right text-mute">{e.target} s</td><td className="mono text-right text-bad">{e.pts ? '-' + e.pts : ''}</td></tr>)}
                  {Object.entries(job.score.open || {}).map(([id, o]) => <tr key={id} className="text-mute"><td>{(EVENTS.find(e => e.id === id) || { label: id }).label}</td><td className="mono text-right">{Math.round(o.at)}s</td><td className="mono text-right">open</td><td className="mono text-right">{EVENT_TARGETS[id]} s</td><td /></tr>)}
                </tbody>
              </table>
            )}
            <div className="text-[10px] text-mute mt-1">Counts: {job.score.kickouts} kickout{job.score.kickouts === 1 ? '' : 's'}, {job.score.overpressures} overpressure{job.score.overpressures === 1 ? '' : 's'}, {job.score.screenouts} screenout{job.score.screenouts === 1 ? '' : 's'}, {job.score.interlocks} interlock reject{job.score.interlocks === 1 ? '' : 's'}, {job.score.wrongMoves} valve move{job.score.wrongMoves === 1 ? '' : 's'} against the sequence, {job.score.moves} valve commands.</div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="card p-2">
            <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Stages</div>
            <table className="w-full text-[11px] mono">
              <thead className="text-mute"><tr><th className="text-left font-normal">Stage</th><th className="text-right font-normal">{job.setup.completion === 'sleeve' ? 'Ball drop' : 'Wireline'}</th><th className="text-right font-normal">Frac</th><th className="text-right font-normal">Placed</th><th className="text-right font-normal">Kickouts</th></tr></thead>
              <tbody>
                {stageRows.map(({ st, rec }) => (
                  <tr key={st.index} className={st.fracComplete ? '' : 'text-mute'}>
                    <td>{st.index + 1}</td>
                    <td className="text-right">{rec.wlStart != null ? fmtS((rec.wlEnd ?? job.t) - rec.wlStart) : '-'}</td>
                    <td className="text-right">{rec.fracStart != null ? fmtS((rec.fracEnd ?? (st.fracComplete ? rec.fracStart : job.t)) - rec.fracStart) : '-'}</td>
                    <td className="text-right">{st.proppantFill > 0 ? Math.round(st.proppantFill * 100) + '%' : '-'}</td>
                    <td className="text-right">{rec.kickouts || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-[10px] text-mute mt-1">Phase time: {Object.entries(job.score.phaseSec).map(([k, v]) => (phases.find(p => p.id === k) || { short: k }).short.toLowerCase() + ' ' + Math.round(v) + ' s').join(', ') || 'none yet'}.</div>
          </div>
          <div className="card p-2">
            <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Lesson results (this account)</div>
            {sessionLessons.length === 0 && <div className="text-xs text-mute">No lessons run yet. Start one from the pad setup panel.</div>}
            {sessionLessons.length > 0 && (
              <table className="w-full text-[11px]">
                <thead className="text-mute"><tr><th className="text-left font-normal">Lesson</th><th className="text-right font-normal">Score</th><th className="text-right font-normal">Time</th><th className="text-right font-normal">Target</th></tr></thead>
                <tbody>{sessionLessons.map((r, i) => <tr key={i}><td>{r.n}. {r.title}</td><td className={'mono text-right ' + (r.grade === 'A' ? 'text-ok' : r.grade === 'B' ? 'text-accent' : 'text-warn')}>{r.score} {r.grade}</td><td className="mono text-right">{r.secs} s</td><td className="mono text-right text-mute">{r.targetSec} s</td></tr>)}</tbody>
              </table>
            )}
            <div className="text-[10px] text-mute mt-1">{LESSONS.filter(l => lessonResults.some(r => r.id === l.id)).length} of {LESSONS.length} lessons run. Results and this summary are saved to the account.</div>
          </div>
        </div>

        <div className="card p-2">
          <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Log</div>
          <ul className="space-y-0.5 max-h-56 overflow-y-auto print-all">
            {[...job.log].reverse().map((l, i) => <li key={i} className="text-[11px]"><span className="mono text-mute">{l.t.toFixed(0)}s</span> {l.msg}</li>)}
          </ul>
        </div>
        <div className="text-[10px] text-mute">Schematic motion and an illustrative pressure model; the score is a training weight over that model, not a measure of field competence.</div>
      </div>
    </div>
  );
}
