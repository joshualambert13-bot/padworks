// The data van's screens (Drop 88). Each monitor in the van is a canvas texture drawn from the live job twice a
// second: the treating chart (surface pressure, slurry rate and proppant concentration against time, the same
// history the timeline panel plots), the numbers board, the pump status board, the pad table of every well and
// its crew, and the stage table. Nothing here is a hydraulic model of the spread beyond what the store holds;
// the pump board splits the live rate across the pumps online, which is what a van screen shows a company man.
import * as THREE from 'three';
import { padTelemetry, padRoles, wellParams, spreadSizing, phasesFor } from '../store.js';

export const SCREENS = ['chart', 'numbers', 'pumps', 'wells', 'stages'];
const BG = '#0b1016', GRID = '#1e2a38', TEXT = '#c9d3dd', MUTE = '#7f8c9a', P = '#ff5a4d', Q = '#3aa7ff', PPA = '#f2c94c', OK = '#3ecf7a', BAD = '#ff4d4d', TITLE = '#8fb3d9';
const mono = (px, bold = false) => (bold ? 'bold ' : '') + px + 'px ui-monospace, Menlo, Consolas, monospace';
const mmss = (t) => { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; };

function frame(ctx, w, h, title, alarm = false) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = alarm ? '#4a1414' : '#141c26'; ctx.fillRect(0, 0, w, 22);
  ctx.fillStyle = alarm ? '#ffb3b3' : TITLE; ctx.font = mono(12, true); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(title, 8, 11);
}

function drawChart(ctx, w, h, s) {
  const alarm = !!(s.alarms.overpressure || s.alarms.screenout || s.alarms.kickout);
  frame(ctx, w, h, 'TREATING', alarm);
  const L = 44, R = 36, T = 30, B = 20; const x0 = L, x1 = w - R, y0 = T, y1 = h - B;
  const hist = s.history; const kick = wellParams(s).maxTreatingPsi;
  ctx.strokeStyle = GRID; ctx.lineWidth = 1; ctx.font = mono(9); ctx.fillStyle = MUTE; ctx.textAlign = 'right';
  for (let p = 0; p <= 15000; p += 5000) { const y = y0 + (1 - p / 15000) * (y1 - y0); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.fillText(p / 1000 + 'k', x0 - 4, y + 3); }
  ctx.textAlign = 'left'; ctx.fillStyle = Q;
  for (let q = 0; q <= 100; q += 50) { const y = y0 + (1 - q / 100) * (y1 - y0); ctx.fillText(String(q), x1 + 4, y + 3); }
  const yk = y0 + (1 - Math.min(1, kick / 15000)) * (y1 - y0);
  ctx.strokeStyle = BAD; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x0, yk); ctx.lineTo(x1, yk); ctx.stroke(); ctx.setLineDash([]);
  if (hist.length > 1) {
    const tMin = hist[0].t, tMax = hist[hist.length - 1].t, span = Math.max(1, tMax - tMin);
    const sx = (t) => x0 + (t - tMin) / span * (x1 - x0);
    const line = (key, max, color, width) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); hist.forEach((pt, i) => { const x = sx(pt.t), y = y0 + (1 - Math.min(1, (pt[key] || 0) / max)) * (y1 - y0); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); };
    line('ppa', 5, PPA, 1); line('q', 100, Q, 1.5); line('p', 15000, P, 2);
    ctx.fillStyle = MUTE; ctx.font = mono(9); ctx.textAlign = 'left'; ctx.fillText('t = ' + mmss(tMin), x0, h - 6); ctx.textAlign = 'right'; ctx.fillText(mmss(tMax), x1, h - 6);
  } else { ctx.fillStyle = MUTE; ctx.font = mono(11); ctx.textAlign = 'center'; ctx.fillText('waiting on the job', (x0 + x1) / 2, (y0 + y1) / 2); }
  ctx.font = mono(12, true); ctx.textAlign = 'right';
  ctx.fillStyle = P; ctx.fillText(Math.round(s.surfacePsi) + ' psi', x1, 18);
  ctx.fillStyle = Q; ctx.fillText((s.pumpsOnline && !s.alarms.kickout ? s.pumpRate : 0).toFixed(0) + ' bpm', x1 - 90, 18);
  ctx.fillStyle = PPA; ctx.fillText((s.ppa || 0).toFixed(1) + ' ppa', x1 - 170, 18);
}

function tile(ctx, x, y, w, h, label, value, color = TEXT, sub = '') {
  ctx.fillStyle = '#121a24'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = MUTE; ctx.font = mono(9); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + 6, y + 10);
  ctx.fillStyle = color; ctx.font = mono(h > 50 ? 22 : 16, true); ctx.fillText(value, x + 6, y + h * 0.58);
  if (sub) { ctx.fillStyle = MUTE; ctx.font = mono(9); ctx.textAlign = 'right'; ctx.fillText(sub, x + w - 6, y + h - 9); }
}
function drawNumbers(ctx, w, h, s) {
  const anyAlarm = s.alarms.overpressure || s.alarms.screenout || s.alarms.kickout;
  const PH = phasesFor(s.setup); const ph = PH.find(p => p.id === s.phase);
  frame(ctx, w, h, (ph ? ph.label.toUpperCase() : 'PAD') + '  ·  STAGE ' + Math.min(s.stage + 1, Math.max(1, s.stages.length)) + ' OF ' + s.stages.length + '  ·  ' + mmss(s.t), !!anyAlarm);
  const live = s.pumpsOnline && !s.alarms.kickout ? s.pumpRate : 0;
  const g = 6, cw = (w - g * 4) / 3, ch = (h - 22 - g * 4) / 3; const X = (i) => g + i * (cw + g), Y = (j) => 22 + g + j * (ch + g);
  tile(ctx, X(0), Y(0), cw, ch, 'SURFACE TREATING PRESSURE', Math.round(s.surfacePsi) + ' psi', s.alarms.overpressure ? BAD : P, 'kick ' + Math.round(wellParams(s).maxTreatingPsi));
  tile(ctx, X(1), Y(0), cw, ch, 'SLURRY RATE', live.toFixed(1) + ' bpm', Q, s.pumpsOnline ? 'pumps online' : 'pumps idle');
  tile(ctx, X(2), Y(0), cw, ch, 'PROPPANT', (s.ppa || 0).toFixed(2) + ' ppa', PPA, (s.slurryPpg || 0).toFixed(2) + ' ppg slurry');
  tile(ctx, X(0), Y(1), cw, ch, 'BOTTOMHOLE TREATING', Math.round(s.bhtpPsi) + ' psi', TEXT, 'net ' + Math.round(s.netPsi));
  tile(ctx, X(1), Y(1), cw, ch, 'HYDROSTATIC / FRICTION', Math.round(s.hydroPsi) + ' / ' + Math.round(s.frictionPsi), TEXT, 'psi');
  tile(ctx, X(2), Y(1), cw, ch, 'STAGE TOTALS', Math.round(s.cumSlurryBbl) + ' bbl', TEXT, Math.round((s.cumProppantLb || 0) / 1000) + ' klb sand');
  tile(ctx, X(0), Y(2), cw, ch, 'FLUID', String(s.setup.fluid || '').toUpperCase(), TEXT, String(s.setup.proppant || ''));
  tile(ctx, X(1), Y(2), cw, ch, 'WELL', (s.setup.lateralFt || 0).toLocaleString() + ' ft lateral', TEXT, (s.setup.tvdFt || 0).toLocaleString() + ' ft TVD');
  const alarmText = s.alarms.kickout ? 'KICKOUT' : s.alarms.overpressure ? 'OVERPRESSURE' : s.alarms.screenout ? 'SCREENOUT' : 'NORMAL';
  tile(ctx, X(2), Y(2), cw, ch, 'ALARMS', alarmText, anyAlarm ? BAD : OK, anyAlarm ? 'see the control panel' : '');
}

function drawPumps(ctx, w, h, s, pumpCount) {
  const n = pumpCount || spreadSizing(s).pumps;
  const live = s.pumpsOnline && !s.alarms.kickout ? s.pumpRate : 0;
  const online = s.pumpsOnline && !s.alarms.kickout;
  frame(ctx, w, h, 'PUMP STATUS  ·  ' + n + ' PUMPS  ·  ' + (online ? n + ' ONLINE' : 'IDLE') + '  ·  ' + (live > 0 ? (live / n).toFixed(1) + ' bpm each' : ''), !!s.alarms.kickout);
  const cols = n > 12 ? 8 : n > 6 ? 6 : n > 4 ? 4 : n, rows = Math.ceil(n / cols);
  const g = 4, cw = (w - g * (cols + 1)) / cols, ch = Math.min(44, (h - 22 - g * (rows + 1)) / rows);
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols); const x = g + c * (cw + g), y = 22 + g + r * (ch + g);
    const trip = s.alarms.kickout && i % 5 === 2;   // the pump that tripped the kickout reads in red; the rest went to idle
    ctx.fillStyle = trip ? '#4a1414' : online ? '#10301f' : '#161c24'; ctx.fillRect(x, y, cw, ch);
    ctx.fillStyle = trip ? BAD : online ? OK : MUTE; ctx.font = mono(10, true); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('P' + (i + 1), x + 4, y + 9);
    ctx.font = mono(9); ctx.fillStyle = TEXT; ctx.fillText(online ? (live / n).toFixed(1) + ' bpm' : trip ? 'TRIP' : 'idle', x + 4, y + ch - 8);
    if (online) { ctx.textAlign = 'right'; ctx.fillStyle = MUTE; ctx.fillText(Math.round(s.surfacePsi * (0.97 + 0.03 * ((i * 7) % 3) / 2)) + '', x + cw - 4, y + ch - 8); }
  }
}

function drawWells(ctx, w, h, s) {
  frame(ctx, w, h, 'PAD  ·  ' + s.pad.wells + ' WELLS  ·  ' + String(s.pad.mode || '').toUpperCase());
  const tele = padTelemetry(s); const roles = padRoles(s); const count = s.stages.length;
  const ROLE = { focus: ['LIVE', TITLE], frac: ['pumping', OK], wireline: [s.setup.completion === 'sleeve' ? 'ball drop' : 'wireline', Q], idle: ['waiting', MUTE], done: ['done', MUTE] };
  const cols = ['WELL', 'CREW', 'STAGE', 'bpm', 'STP psi']; const cx = [10, 60, 150, 220, 290];
  ctx.font = mono(9); ctx.fillStyle = MUTE; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  cols.forEach((c, i) => ctx.fillText(c, cx[i], 34));
  const rowH = Math.min(22, (h - 46) / Math.max(1, roles.length));
  tele.forEach((t, i) => {
    const y = 48 + i * rowH; const [label, color] = ROLE[t.role] || ROLE.idle;
    ctx.fillStyle = i % 2 ? '#0f151d' : BG; ctx.fillRect(4, y - rowH / 2, w - 8, rowH);
    ctx.font = mono(11, true); ctx.fillStyle = TEXT; ctx.fillText('W' + (t.i + 1), cx[0], y);
    ctx.font = mono(10); ctx.fillStyle = color; ctx.fillText(label, cx[1], y);
    ctx.fillStyle = TEXT; ctx.fillText(Math.min(t.stage + 1, count) + ' / ' + count, cx[2], y);
    ctx.fillStyle = Q; ctx.fillText((t.q || 0).toFixed(0), cx[3], y);
    ctx.fillStyle = P; ctx.fillText(Math.round(t.p || 0) + '', cx[4], y);
  });
}

function drawStages(ctx, w, h, s) {
  const sleeve = s.setup.completion === 'sleeve';
  frame(ctx, w, h, 'STAGES  ·  TOE TO HEEL  ·  ' + s.stages.length + ' STAGES');
  const cols = ['STG', sleeve ? 'BALL' : 'PLUG', sleeve ? 'PORTS' : 'PERFS', 'FRAC', s.setup.plugs === 'dissolvable' ? 'GONE' : 'MILLED']; const cx = [10, 60, 130, 210, 270];
  ctx.font = mono(9); ctx.fillStyle = MUTE; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  cols.forEach((c, i) => ctx.fillText(c, cx[i], 34));
  const list = s.stages; const rowH = Math.min(18, (h - 46) / Math.max(1, list.length));
  list.forEach((st, i) => {
    const y = 48 + i * rowH; const cur = i === s.stage;
    ctx.fillStyle = cur ? '#17283a' : i % 2 ? '#0f151d' : BG; ctx.fillRect(4, y - rowH / 2, w - 8, rowH);
    ctx.font = mono(10, cur); ctx.fillStyle = cur ? TITLE : TEXT; ctx.fillText((i + 1) + (cur ? ' *' : ''), cx[0], y);
    ctx.fillStyle = TEXT;
    ctx.fillText(st.plugSet ? (st.plugMilled ? (s.setup.plugs === 'dissolvable' ? 'gone' : 'milled') : (sleeve ? 'seated' : 'set')) : (sleeve && st.index === 0 && st.perforated ? 'toe' : '-'), cx[1], y);
    ctx.fillText((st.clustersFired || 0) + '/' + (s.setup.clusters || 0), cx[2], y);
    ctx.fillStyle = st.fracComplete ? OK : TEXT; ctx.fillText(st.fracComplete ? 'done' : st.fracExtent > 0 ? Math.round(st.fracExtent * 100) + '%' : '-', cx[3], y);
    ctx.fillStyle = TEXT; ctx.fillText(st.plugMilled ? 'yes' : '-', cx[4], y);
  });
}

const DRAW = { chart: drawChart, numbers: drawNumbers, pumps: drawPumps, wells: drawWells, stages: drawStages };

// A screen: canvas, texture and a draw call that only touches the canvas when asked
export function makeScreen(kind, w = 512, h = 256) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  tex.name = 'VAN-SCREEN-' + kind;
  return { kind, canvas: c, ctx, tex, draw: (s, extra) => { try { DRAW[kind](ctx, w, h, s, extra); } catch { /* a field missing mid-rebuild: keep the last picture */ } tex.needsUpdate = true; } };
}
