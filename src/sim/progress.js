// Lesson results stay in this browser only (localStorage). Nothing is sent anywhere; there is no account
// and no telemetry. Clearing site data clears the results.
const KEY = 'padworks.lessons.v1';

export function loadResults() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(-200) : [];
  } catch { return []; }
}
export function saveResults(results) {
  try { window.localStorage.setItem(KEY, JSON.stringify(results.slice(-200))); } catch { /* storage unavailable: results live for this session only */ }
}
export function clearResults() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
export function bestFor(results, id) {
  let best = null;
  for (const r of results) if (r.id === id && (!best || r.score > best.score)) best = r;
  return best;
}
