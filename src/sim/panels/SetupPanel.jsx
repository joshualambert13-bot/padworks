// Pad Setup: every variable of the job is chosen here before the simulation starts. The 3D pad
// updates live as choices change. Values are illustrative starting points, not design values.
import { PlayCircle, MapPin, Layers3, Wrench, Drill, Ruler, Fuel, Beaker, Info, ArrowUpFromLine, GraduationCap, FileText } from 'lucide-react';
import { useSim, BASINS, COMPLETIONS, SLEEVE_SYSTEMS, PLUG_TYPES, FLEETS, FLUIDS, PROPPANTS, LIFTS, FRAC_MODES, BORES, MAX_WELLS, basinOf, estimateStp, spreadSizing, designTotals, wellParams, scoreOf } from '../store.js';
import { LESSONS } from '../lessons.js';
import { bestFor } from '../progress.js';

// Guided lessons: eight scripted sequences with checkpoints and a score. Results are saved to the trainee's account.
function Lessons({ s }) {
  const done = LESSONS.filter(l => bestFor(s.lessonResults, l.id)).length;
  return (
    <div className="card p-2 space-y-2 border-cool/40" data-panel="lessons">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-mute"><GraduationCap size={12} />Guided lessons<span className="ml-auto mono">{done}/{LESSONS.length} passed</span></div>
      <div className="text-[11px] text-mute">Each lesson sets up the pad, puts the job at the right point, and walks you through one sequence with checkpoints, hints, and a score. Free play is below.</div>
      <ol className="space-y-1">
        {LESSONS.map(l => {
          const best = bestFor(s.lessonResults, l.id);
          return (
            <li key={l.id} className="flex items-start gap-2 text-xs">
              <span className="mono text-[10px] text-mute mt-0.5 w-4">{l.n}.</span>
              <span className="flex-1 min-w-0"><span className="text-white">{l.title}</span><span className="text-mute"> · target {l.targetSec} s</span>
                <span className="line-clamp-1 text-[10px] text-mute" title={l.blurb}>{l.blurb}</span></span>
              {best && <span className={'mono text-[10px] mt-0.5 ' + (best.grade === 'A' ? 'text-ok' : best.grade === 'B' ? 'text-accent' : 'text-warn')} title={'Best: ' + best.score + ' points, ' + best.secs + ' s'}>{best.score} {best.grade}</span>}
              <button className="btn text-[11px] px-2 py-0.5" onClick={() => s.startLesson(l.id)} data-action={'lesson-' + l.id}>Start</button>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center gap-1 text-[10px] text-mute">
        {s.lastJob && <button className="btn text-[11px] px-2 py-0.5 flex items-center gap-1" onClick={s.openSummary} data-action="summary"><FileText size={12} />Last job summary <span className="mono">{scoreOf(s.lastJob.score).total} {scoreOf(s.lastJob.score).grade}</span></button>}
        {s.lessonResults.length > 0 && <span className="ml-auto" title="Lesson results are saved to your account">{s.lessonResults.length} result{s.lessonResults.length === 1 ? '' : 's'} saved</span>}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="card p-2 space-y-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-mute"><Icon size={12} />{title}</div>
      {children}
    </div>
  );
}
function Choice({ options, value, onChange, cols = 2, name }) {
  return (
    <div className={'grid gap-1 ' + (cols === 3 ? 'grid-cols-3' : cols === 5 ? 'grid-cols-5' : 'grid-cols-2')} data-choice={name}>
      {options.map(o => (
        <button key={o.id} className={'btn text-[11px] px-1 ' + (value === o.id ? 'btn-primary' : '')} title={o.blurb} disabled={o.disabled} onClick={() => onChange(o.id)}>{o.short || o.label}</button>
      ))}
    </div>
  );
}
function Range({ label, value, unit, min, max, step, onChange, name, fmt = (x) => x.toLocaleString() }) {
  return (
    <label className="block text-xs">{label} <span className="mono">{fmt(value)}{unit ? ' ' + unit : ''}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} data-range={name} />
    </label>
  );
}

export default function SetupPanel() {
  const s = useSim();
  const basin = basinOf(s);
  const stp = estimateStp(s);
  const w = wellParams(s);
  const spread = spreadSizing(s);
  const totals = designTotals(s);
  const mode = FRAC_MODES.find(m => m.id === s.pad.mode) || FRAC_MODES[0];
  const completion = COMPLETIONS.find(c => c.id === s.setup.completion) || COMPLETIONS[0];
  const fleet = FLEETS.find(f => f.id === s.setup.fleet) || FLEETS[0];
  const fluid = FLUIDS.find(f => f.id === s.setup.fluid) || FLUIDS[0];
  const prop = PROPPANTS.find(p => p.id === s.setup.proppant) || PROPPANTS[0];
  const bore = BORES.find(b => b.id === s.pad.bore) || BORES[5];
  const ratingPsi = bore.rating * 1000;
  const overRating = stp > w.maxTreatingPsi;
  const nearRating = !overRating && stp > w.maxTreatingPsi * 0.85;

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3 text-sm" data-panel="setup">
      <div className="card p-2 border-accent/40 space-y-1">
        <div className="text-xs font-semibold text-accent">Pad setup</div>
        <div className="text-[11px] text-mute">Choose the job before the first valve moves. The pad on the right rebuilds as you go. Every number is an illustrative starting point for training, not a design value.</div>
        <button className="btn btn-primary w-full flex items-center justify-center gap-1" onClick={s.startJob} data-action="start"><PlayCircle size={14} />Start the job</button>
      </div>

      <Lessons s={s} />

      <Section icon={MapPin} title="Basin">
        <select className="btn w-full" value={s.setup.basin} onChange={e => s.setBasin(e.target.value)} title="Basin" data-select="basin">
          {BASINS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <div className="text-[11px] text-mute">{basin.region}. {basin.blurb}</div>
        <div className="text-[10px] text-mute">Picking a basin loads its typical values below; change any of them.</div>
        <div className="grid grid-cols-2 gap-2">
          <Range label="Lateral TVD" value={s.setup.tvdFt} unit="ft" min={4000} max={14000} step={250} onChange={v => s.setSetup({ tvdFt: v })} name="tvd" />
          <Range label="Frac gradient" value={s.setup.fracGradient} unit="psi/ft" min={0.6} max={1.05} step={0.01} onChange={v => s.setSetup({ fracGradient: v })} name="gradient" fmt={x => x.toFixed(2)} />
        </div>
      </Section>

      <Section icon={Layers3} title="Pad and frac scheme">
        <Range label="Wells on the pad" value={s.pad.wells} min={1} max={MAX_WELLS} step={1} onChange={v => s.setPad({ wells: v })} name="wells" />
        <Choice options={FRAC_MODES.map(m => ({ ...m, disabled: s.pad.wells < m.fracSlots + m.wlSlots }))} value={s.pad.mode} onChange={v => s.setPad({ mode: v })} cols={5} name="mode" />
        <div className="text-[11px] text-mute">{mode.blurb}</div>
      </Section>

      <Section icon={Wrench} title="Frac tree bore and pressure rating">
        <select className="btn w-full" value={s.pad.bore} onChange={e => s.setPad({ bore: e.target.value })} title="Bore and pressure rating" data-select="bore">
          {BORES.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <div className="text-[11px] text-mute">Working pressure <span className="mono text-white">{ratingPsi.toLocaleString()} psi</span>. Kickout set at <span className="mono text-white">{w.maxTreatingPsi.toLocaleString()} psi</span>, relief valve at <span className="mono text-white">{w.prvSetPsi.toLocaleString()} psi</span>.</div>
        <div className={'text-[11px] rounded px-2 py-1 ' + (overRating ? 'bg-bad/20 text-bad' : nearRating ? 'bg-warn/20 text-warn' : 'bg-ok/10 text-ok')}>
          Expected treating pressure at 90 bpm about <span className="mono">{stp.toLocaleString()} psi</span>{overRating ? ': above the kickout for this rating. Choose a 15K tree or a shallower target.' : nearRating ? ': close to the kickout; little margin for friction or a pressure ramp.' : ': inside the rating with margin.'}
        </div>
        <div className="text-[10px] text-mute">Bigger bores cut friction and erosion at high rate; smaller bores are lighter and cheaper to rig. Standard stack: manual lower master, hydraulic upper master, cross with manual and hydraulic wing valves both sides, hydraulic crown, flanged inlet block, hydraulic swab{s.setup.completion === 'sleeve' ? ', ball launcher on top.' : ', top adapter for the lubricator.'}</div>
      </Section>

      <Section icon={Drill} title="Completion method">
        <Choice options={COMPLETIONS.map(c => ({ ...c, short: c.label }))} value={s.setup.completion} onChange={v => s.setSetup({ completion: v })} name="completion" />
        <div className="text-[11px] text-mute">{completion.blurb}</div>
        {s.setup.completion === 'sleeve' && (
          <>
            <Choice options={SLEEVE_SYSTEMS.map(c => ({ ...c, short: c.label }))} value={s.setup.sleeveSystem} onChange={v => s.setSetup({ sleeveSystem: v })} name="sleeveSystem" />
            <div className="text-[11px] text-mute">{(SLEEVE_SYSTEMS.find(x => x.id === s.setup.sleeveSystem) || SLEEVE_SYSTEMS[0]).blurb}</div>
          </>
        )}
        <Choice options={PLUG_TYPES.map(c => ({ ...c, short: s.setup.completion === 'sleeve' ? c.label.replace('Composite', 'Millable seats').replace('Dissolvable', 'Dissolvable balls') : c.label }))} value={s.setup.plugs} onChange={v => s.setSetup({ plugs: v })} name="plugs" />
        <div className="text-[11px] text-mute">{(PLUG_TYPES.find(x => x.id === s.setup.plugs) || PLUG_TYPES[0]).blurb}</div>
      </Section>

      <Section icon={Ruler} title="Lateral and stage design">
        <Range label="Lateral length" value={s.setup.lateralFt} unit="ft" min={3000} max={20000} step={500} onChange={v => s.setSetup({ lateralFt: v })} name="lateral" />
        <Range label="Stage spacing" value={s.setup.stageSpacingFt} unit="ft" min={100} max={400} step={10} onChange={v => s.setSetup({ stageSpacingFt: v })} name="spacing" />
        <Range label={s.setup.completion === 'sleeve' ? 'Ports per sleeve' : 'Clusters per stage'} value={s.setup.clusters} min={1} max={8} step={1} onChange={v => s.setSetup({ clusters: v })} name="clusters" />
        <Range label="Stages shown in the simulation" value={s.setup.stagesShown} min={3} max={8} step={1} onChange={v => s.setSetup({ stagesShown: v })} name="stagesShown" />
        <div className="text-[11px] text-mute">Design: <span className="mono text-white">{totals.stages}</span> stages, <span className="mono text-white">{totals.clustersTotal}</span> {s.setup.completion === 'sleeve' ? 'ports' : 'clusters'} along the lateral. The simulation runs <span className="mono text-white">{s.setup.stagesShown}</span> representative stages at the toe.</div>
      </Section>

      <Section icon={Fuel} title="Frac fleet">
        <select className="btn w-full" value={s.setup.fleet} onChange={e => s.setSetup({ fleet: e.target.value })} title="Fleet" data-select="fleet">
          {FLEETS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <div className="text-[11px] text-mute">{fleet.blurb}</div>
        <div className="text-[11px] text-mute">Needs about <span className="mono text-white">{spread.hhp.toLocaleString()} hhp</span> for {spread.wellsAtOnce} well{spread.wellsAtOnce > 1 ? 's' : ''} at 90 bpm and {w.maxTreatingPsi.toLocaleString()} psi: <span className="mono text-white">{spread.pumps}</span> pumps of {fleet.hpPerPump.toLocaleString()} hp at 85 percent, two on standby. Rate cap about <span className="mono text-white">{spread.maxRatePerWell}</span> bpm per well.</div>
      </Section>

      <Section icon={Beaker} title="Proppant and fluid">
        <select className="btn w-full" value={s.setup.proppant} onChange={e => s.setSetup({ proppant: e.target.value })} title="Proppant" data-select="proppant">
          {PROPPANTS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <div className="text-[11px] text-mute">{prop.blurb}</div>
        <Range label="Proppant intensity" value={s.setup.proppantLbFt} unit="lb/ft" min={300} max={4000} step={50} onChange={v => s.setSetup({ proppantLbFt: v })} name="proppantLbFt" />
        <select className="btn w-full" value={s.setup.sand || 'silos'} onChange={e => s.setSetup({ sand: e.target.value })} title="Sand delivery" data-select="sand">
          <option value="silos">Sand delivery: silos, pneumatic fill, belt to the blender</option>
          <option value="boxes">Sand delivery: boxes, handler to a cradle station, belt to the blender</option>
        </select>
        <select className="btn w-full" value={s.setup.fluid} onChange={e => s.setSetup({ fluid: e.target.value })} title="Fluid system" data-select="fluid">
          {FLUIDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <div className="text-[11px] text-mute">{fluid.blurb}</div>
        <Range label="Fluid intensity" value={s.setup.fluidBblFt} unit="bbl/ft" min={10} max={80} step={1} onChange={v => s.setSetup({ fluidBblFt: v })} name="fluidBblFt" />
        <div className="text-[11px] text-mute">Per well: <span className="mono text-white">{(totals.proppantLb / 1e6).toFixed(1)} million lb</span> of proppant and <span className="mono text-white">{Math.round(totals.fluidBbl).toLocaleString()} bbl</span> of fluid; per stage <span className="mono text-white">{Math.round(totals.stageProppantLb / 1000)} klb</span> and <span className="mono text-white">{Math.round(totals.stageFluidBbl).toLocaleString()} bbl</span>.</div>
      </Section>

      <Section icon={ArrowUpFromLine} title="Artificial lift (production phase)">
        <select className="btn w-full" value={s.setup.lift} onChange={e => s.setSetup({ lift: e.target.value })} title="Artificial lift" data-select="lift">
          {LIFTS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <div className="text-[11px] text-mute">{(LIFTS.find(l => l.id === s.setup.lift) || LIFTS[0]).blurb}</div>
        <div className="text-[10px] text-mute">Shows up in the production phase: the equipment at the tree and the string in the downhole view.</div>
      </Section>

      <div className="text-[10px] text-mute flex items-start gap-1"><Info size={12} className="shrink-0 mt-0.5" /><span>Basin values are typical public ranges rounded for training. Nothing here comes from a specific operator or well.</span></div>
      <button className="btn btn-primary w-full flex items-center justify-center gap-1" onClick={s.startJob}><PlayCircle size={14} />Start the job</button>
    </div>
  );
}
