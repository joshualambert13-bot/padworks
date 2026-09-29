import { Play, Pause, RotateCcw, AlertTriangle, Gauge, Droplets, Zap, ArrowRightCircle, CheckCircle2, Lock } from 'lucide-react';
import { useSim, PHASES, STAGE_COUNT, WELL, FRAC_MODES, BORES, MAX_WELLS, padRoles } from '../store.js';

function ValveRow({ id, v, onCommand }) {
  const open = v.pos > 0.99, closed = v.pos < 0.01;
  const state = open ? 'OPEN' : closed ? 'CLOSED' : v.target === 1 ? 'OPENING' : 'CLOSING';
  const color = open ? 'text-ok' : closed ? 'text-bad' : 'text-warn';
  return (
    <div className="flex items-center gap-2 py-1 border-b border-line/60">
      <div className="flex-1 min-w-0">
        <div className="text-xs truncate">{v.label}</div>
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
  const st = s.stages[s.stage];
  const phaseIdx = PHASES.findIndex(p => p.id === s.phase);
  const nextPhase = PHASES[phaseIdx + 1];
  const canFrac = s.phase === 'frac' && st.perforated;
  const allFracked = s.stages.every(x => x.fracComplete);
  const stageFracDone = st.fracComplete;
  const mode = FRAC_MODES.find(m => m.id === s.pad.mode) || FRAC_MODES[0];
  const roles = padRoles(s);
  const fracWells = roles.filter(r => r.role === 'frac').length + (s.phase === 'frac' ? 1 : 0);
  const wlWells = roles.filter(r => r.role === 'wireline').length + (s.phase === 'wireline' ? 1 : 0);
  const liveRate = s.pumpsOnline && !s.alarms.kickout ? s.pumpRate : 0;

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3 text-sm">
      {/* run controls */}
      <div className="flex items-center gap-2">
        <button className="btn flex items-center gap-1" onClick={s.toggleRunning}>{s.running ? <Pause size={14} /> : <Play size={14} />}{s.running ? 'Pause' : 'Run'}</button>
        <select className="btn" value={s.speed} onChange={e => s.setSpeed(Number(e.target.value))}>
          {[0.5, 1, 2, 4].map(x => <option key={x} value={x}>{x}x</option>)}
        </select>
        <button className="btn flex items-center gap-1 ml-auto" onClick={s.reset}><RotateCcw size={14} />Reset</button>
      </div>

      {/* pad configuration */}
      <div className="card p-2 space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-mute">Pad configuration</div>
        <label className="block text-xs">Wells on the pad <span className="mono">{s.pad.wells}</span>
          <input type="range" min={1} max={MAX_WELLS} step={1} value={s.pad.wells} onChange={e => s.setPad({ wells: Number(e.target.value) })} />
        </label>
        <div className="grid grid-cols-5 gap-1">
          {FRAC_MODES.map(m => (
            <button key={m.id} className={'btn text-[11px] px-1 ' + (s.pad.mode === m.id ? 'btn-primary' : '')} disabled={s.pad.wells < m.fracSlots + m.wlSlots} title={m.blurb} onClick={() => s.setPad({ mode: m.id })}>{m.short}</button>
          ))}
        </div>
        <div className="text-[11px] text-mute">{mode.blurb}</div>
        <label className="block text-xs">Tree bore and rating
          <select className="btn w-full mt-1" value={s.pad.bore} onChange={e => s.setPad({ bore: e.target.value })}>
            {BORES.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
        <div className="text-[11px] text-mute">Well 1 is yours to operate. The other wells follow the crews: <span className="mono text-white">{fracWells}</span> pumping, <span className="mono text-white">{wlWells}</span> on wireline right now.</div>
      </div>

      {/* phase selection */}
      <div className="card p-2">
        <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Phase</div>
        <div className="grid grid-cols-3 gap-1">
          {PHASES.map(p => (
            <button key={p.id} className={'btn text-xs ' + (s.phase === p.id ? 'btn-primary' : '')} onClick={() => s.setPhase(p.id)}>{p.short}</button>
          ))}
        </div>
        <div className="mt-2 text-xs text-mute">Stage <span className="mono text-white">{s.stage + 1}</span> of {STAGE_COUNT} · {PHASES[phaseIdx].label}</div>
        {nextPhase && s.phase !== 'frac' && s.phase !== 'wireline' && (
          <button className="btn mt-2 w-full flex items-center justify-center gap-1" onClick={() => s.setPhase(nextPhase.id)}><ArrowRightCircle size={14} />Next: {nextPhase.short}</button>
        )}
      </div>

      {/* wireline controls */}
      {s.phase === 'wireline' && (
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

      {/* frac tree valves */}
      <div className="card p-2">
        <div className="text-[10px] uppercase tracking-wide text-mute mb-1">Frac tree and zipper valves (two-position)</div>
        {Object.entries(s.valves).map(([id, v]) => <ValveRow key={id} id={id} v={v} onCommand={s.commandValve} />)}
        {s.alarms.interlock && (
          <div className="mt-2 flex items-start gap-1 text-xs text-warn"><Lock size={14} className="shrink-0 mt-0.5" /><span>{s.alarms.interlock}</span><button className="ml-auto text-mute" onClick={s.clearInterlock}>x</button></div>
        )}
      </div>

      {/* pumping controls */}
      {(s.phase === 'frac') && (
        <div className="card p-2 space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-mute">Frac spread</div>
          {!st.perforated && <div className="text-xs text-warn">Stage {s.stage + 1} has no open perforations. Run wireline first.</div>}
          <div className="flex items-center gap-2">
            <button className={'btn ' + (s.pumpsOnline ? 'btn-danger' : 'btn-primary')} onClick={() => s.setPumpsOnline(!s.pumpsOnline)} disabled={s.alarms.kickout}>{s.pumpsOnline ? 'Pumps offline' : 'Pumps online'}</button>
            {s.alarms.kickout && <button className="btn" onClick={s.acknowledgeAlarms}>Acknowledge kickout</button>}
          </div>
          <label className="block text-xs">Slurry rate <span className="mono">{s.pumpRate.toFixed(0)} bpm</span>
            <input type="range" min={0} max={100} step={1} value={s.pumpRate} onChange={e => s.setPumpRate(Number(e.target.value))} />
          </label>
          <label className="block text-xs">Proppant concentration <span className="mono">{s.ppa.toFixed(2)} PPA</span>
            <input type="range" min={0} max={4} step={0.05} value={s.ppa} onChange={e => s.setPpa(Number(e.target.value))} />
          </label>
          <div className="text-[11px] text-mute">Kickout {WELL.maxTreatingPsi.toLocaleString()} psi · PRV {WELL.prvSetPsi.toLocaleString()} psi. Screenout risk rises with concentration at low rate.</div>
          {stageFracDone && s.stage < STAGE_COUNT - 1 && (
            <button className="btn btn-primary w-full flex items-center justify-center gap-1" onClick={() => { s.nextStage(); s.setPhase('wireline'); }}><CheckCircle2 size={14} />Stage {s.stage + 1} complete: next stage wireline</button>
          )}
          {allFracked && <button className="btn btn-primary w-full" onClick={() => s.setPhase('drillout')}>All stages complete: rig up coiled tubing</button>}
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
        <Readout label="Friction" value={s.frictionPsi.toFixed(0)} unit="psi" />
        <Readout label="Hydrostatic" value={s.hydroPsi.toFixed(0)} unit="psi" />
        <Readout label="Slurry pumped" value={s.cumSlurryBbl.toFixed(0)} unit="bbl" />
        <Readout label="Proppant pumped" value={(s.cumProppantLb / 1000).toFixed(1)} unit="klb" />
      </div>
      <div className="text-[10px] text-mute flex items-start gap-1"><Gauge size={12} className="shrink-0 mt-0.5" /><span>Schematic motion and an illustrative pressure model. This is a training aid, not a fracturing simulator; nothing here is a design value.</span></div>
    </div>
  );
}
