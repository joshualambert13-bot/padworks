// Lessons mode (Drop 77): the guided path as a page of its own. The introduction first (a narrated tour of the
// pad), then every lesson with two doors: Watch (the simulator performs the lesson with captions and a voice)
// and Try it (the lesson starts and the trainee runs it, scored). Best results come from the account.
import { Link } from 'react-router-dom';
import { Play, Pencil, Clock, Trophy } from 'lucide-react';
import { LESSONS } from '../sim/lessons.js';
import { useSim } from '../sim/store.js';
import { bestFor } from '../sim/progress.js';
import { useTheme } from '../theme/theme.js';
import { orderedLessons, featuredLessons, focusName } from '../theme/focus.js';

export default function LessonsPage() {
  const results = useSim(s => s.lessonResults);
  const theme = useTheme(s => s.theme);
  const lessons = orderedLessons(theme), featured = featuredLessons(theme), who = focusName(theme);   // Drop 83: the focus's lessons first
  const done = LESSONS.filter(l => bestFor(results, l.id)).length;
  return (
    <div className="h-full overflow-y-auto" data-page="lessons">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Lessons</h1>
          <p className="text-sm text-mute">Each lesson sets up the pad, runs one job in sequence with checkpoints and hints, and scores it. Watch the demo first: the simulator performs the lesson while a voice explains each step. Then try it yourself. {done > 0 ? `${done} of ${LESSONS.length} passed on this account.` : 'Nothing passed yet on this account.'}</p>
        </div>
        <div className="card p-4 border-accent/50 flex flex-col md:flex-row md:items-center gap-3" data-lesson-card="intro">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wide text-accent mono">Introduction</div>
            <div className="text-lg font-medium">Walk the pad</div>
            <p className="text-sm text-mute mt-1">A narrated tour of the pad: the tree, the wellhead row, the zipper manifold, the pump row and missile, sand, water, support, the gate and flowback. About four minutes. Start here if the pad is new to you.</p>
          </div>
          <Link to="/simulate?demo=intro" className="btn btn-primary flex items-center gap-1.5 self-start md:self-center" data-action="watch-intro"><Play size={14} />Watch the introduction</Link>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {lessons.map(l => {
            const best = bestFor(results, l.id);
            const star = featured.includes(l);
            return (
              <div key={l.id} className={'card p-4 flex flex-col ' + (star ? 'border-accent/40' : '')} data-lesson-card={l.id} data-featured={star ? '1' : undefined}>
                <div className="flex items-start gap-2">
                  <span className="mono text-xs px-1.5 py-0.5 rounded bg-panel2 border border-line shrink-0">{l.n}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{l.title}{star && <span className="badge text-accent ml-2 text-[10px]" title={'Featured for ' + who}>Featured</span>}</div>
                    <p className="text-sm text-mute mt-1">{l.blurb}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-mute">
                  <span className="flex items-center gap-1"><Clock size={12} />target {l.targetSec} s</span>
                  <span>{l.steps.length} checkpoints</span>
                  {best && <span className={'flex items-center gap-1 ' + (best.grade === 'A' ? 'text-ok' : best.grade === 'B' ? 'text-accent' : 'text-warn')} title={'Best: ' + best.score + ' points, ' + best.secs + ' s'}><Trophy size={12} />{best.score} {best.grade}</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  <Link to={'/simulate?demo=' + l.id} className="btn flex items-center gap-1.5" data-action={'watch-' + l.id}><Play size={14} />Watch</Link>
                  <Link to={'/simulate?lesson=' + l.id} className="btn btn-primary flex items-center gap-1.5" data-action={'try-' + l.id}><Pencil size={14} />Try it</Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
