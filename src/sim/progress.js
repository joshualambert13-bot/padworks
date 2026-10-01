// Progress lives in the trainee's account on the server: lesson results and job summaries are posted as they
// happen and loaded at sign-in. A failed post is logged and the session carries on; nothing is kept in the
// browser between visits.
import { api, useAuth } from '../auth/auth.js';
import { lessonById } from './lessons.js';

// Server rows ({ id: lessonId, total, grade, secs, at }) into the shape the panels use.
export function fromServer(rows) {
  return (rows || []).map(r => {
    const L = lessonById(r.id) || { n: Number(String(r.id).slice(1)) || 0, title: r.id, targetSec: 0 };
    return { id: r.id, n: L.n, title: L.title, score: r.total, grade: r.grade, secs: r.secs, targetSec: L.targetSec, when: r.at };
  });
}
function failed(e) {
  if (e && e.status === 401) useAuth.getState().signedOutByServer();
  else console.warn('[padworks] progress not saved:', e && e.message);
}
export function postLessonResult(entry, summary) {
  return api('me/results', { method: 'POST', body: { lessonId: entry.id, total: entry.score, secs: entry.secs, title: 'Lesson ' + entry.n + ': ' + entry.title, summary } }).catch(failed);
}
export function postJobSummary({ kind = 'free', title, total, secs, payload }) {
  return api('me/summaries', { method: 'POST', body: { kind, title, total, secs, payload } }).catch(failed);
}
export function bestFor(results, id) {
  let best = null;
  for (const r of results) if (r.id === id && (!best || r.score > best.score)) best = r;
  return best;
}
