// Writes content/narration.json from the demo scripts as the code has them today (the introduction in demo.js, the
// lesson lines assembled from lessons.js), so the narration can be edited as text. Run once; after that the JSON
// is the source and demo.js reads it. Lines already in the JSON are kept (an edited line is never overwritten).
import fs from 'node:fs';
const { INTRO } = await import('../src/sim/demo-intro.js');
const { LESSONS } = await import('../src/sim/lessons.js');
const path = 'content/narration.json';
const have = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : { intro: [], lessons: {} };
const out = { note: 'Narration for the introduction and the lesson demos. Edit the text; keep the ids. The score is shown in the caption at the end of a lesson, not spoken, so every line here is the same every time. scripts/narration-render.mjs turns these lines into the voice clips in public/audio/narration.', intro: [], lessons: {} };
INTRO.forEach((it, i) => { const id = 'intro-' + (i + 1); const prev = have.intro.find(x => x.id === id); out.intro.push({ id, preset: it.preset, text: prev ? prev.text : it.text }); });
for (const L of LESSONS) {
  const prev = (have.lessons || {})[L.id] || {};
  const steps = L.steps.map((s, i) => (prev.steps && prev.steps[i]) || ('Step ' + (i + 1) + ' of ' + L.steps.length + '. ' + s.text + '.' + (s.hint ? ' ' + s.hint : '')));
  const replies = L.steps.map((s, i) => (prev.replies && prev.replies[i]) || s.reply || '');   // the radio answers (Drop 89), rendered in the second voice
  out.lessons[L.id] = { title: L.title, intro: prev.intro || ('Lesson ' + L.n + ', ' + L.title + '. ' + L.blurb + ' Watch first; then try it yourself.'), steps, ...(replies.some(Boolean) ? { replies } : {}), end: prev.end || 'Lesson complete. Now try it yourself: press Try it on the lessons page, or Reset and start the lesson from the setup panel.' };
}
out.clips = have.clips || [];   // the rendered clip names (scripts/narration-render.mjs keeps this current)
fs.writeFileSync(path, JSON.stringify(out, null, 2) + '\n');
console.log('narration.json:', out.intro.length, 'intro lines,', Object.values(out.lessons).reduce((a, l) => a + l.steps.length + 2, 0), 'lesson lines');
