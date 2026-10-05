// Landing page (Drop 77): three doors instead of dropping straight into the simulator. Lessons for the guided,
// scored path with narrated demos; the full simulator for free play; the library for the equipment records.
import { Link } from 'react-router-dom';
import { Activity, GraduationCap, Library as LibraryIcon, Play, ArrowRight } from 'lucide-react';
import { LESSONS } from './sim/lessons.js';
import { records } from './lib/records.js';
import { SITE_TAGLINE } from './config.js';

const DOORS = [
  {
    to: '/lessons', icon: GraduationCap, title: 'Lessons', kicker: 'Start here',
    text: `${LESSONS.length} guided lessons, each one job in sequence with checkpoints, hints and a score. Every lesson has a narrated demo that performs it for you first; then you run it yourself.`,
    action: 'Open the lessons', accent: true, data: 'lessons',
  },
  {
    to: '/simulate', icon: Activity, title: 'Full simulator', kicker: 'Free play',
    text: 'Set up the pad for any basin, run the whole completion from wireline to production hookup, inject faults, walk the pad, change the weather. Nothing is scripted.',
    action: 'Open the simulator', data: 'simulate',
  },
  {
    to: '/library', icon: LibraryIcon, title: 'Library', kicker: 'Reference',
    text: `${records.length} equipment records with 3D models, hazards and sources, organized by system. Everything on the pad links here when you hover and click it.`,
    action: 'Open the library', data: 'library',
  },
];

export default function Landing() {
  return (
    <div className="h-full overflow-y-auto" data-page="landing">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        <div className="pt-4 md:pt-10">
          <div className="flex items-center gap-3">
            <img src="/brand/mark.svg" alt="" className="h-12 w-12" />
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Pad<span className="text-accent">works</span></h1>
              <div className="text-sm text-mute">{SITE_TAGLINE}</div>
            </div>
          </div>
          <p className="mt-4 text-base text-mute max-w-2xl">A frac pad you can run. Wireline, fracturing, drillout, flowback and the production hookup on a multi-well pad drawn from generic equipment at real proportions, with the interlocks, the alarms and the mistakes that cost points.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/simulate?demo=intro" className="btn btn-primary flex items-center gap-1.5" data-action="watch-intro"><Play size={14} />Watch the introduction</Link>
            <span className="badge text-mute self-center">Built for training. Not for operational decisions.</span>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {DOORS.map(d => (
            <Link key={d.to} to={d.to} className={'card p-4 flex flex-col hover:border-ok/60 transition ' + (d.accent ? 'border-accent/50' : '')} data-door={d.data}>
              <div className="flex items-center gap-2">
                <d.icon size={20} className={d.accent ? 'text-accent' : 'text-mute'} />
                <span className="text-[10px] uppercase tracking-wide text-mute mono">{d.kicker}</span>
              </div>
              <div className="mt-2 text-lg font-medium">{d.title}</div>
              <p className="mt-1 text-sm text-mute flex-1">{d.text}</p>
              <div className="mt-3 text-sm flex items-center gap-1 text-white">{d.action} <ArrowRight size={14} /></div>
            </Link>
          ))}
        </div>
        <div className="text-xs text-mute">Generic geometry and public standards only; no manufacturer models or drawings. Hover anything on the pad to name it; click to open its record.</div>
      </div>
    </div>
  );
}
