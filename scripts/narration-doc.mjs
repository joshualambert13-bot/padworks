// Writes the narration script as a Word document for editing (content/narration.json in, a .docx out). One table
// per section: the line id (keep it), the cue (where the camera is, what the demo does), and the narration text.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const docx = createRequire(import.meta.url)(process.env.DOCX_PATH || 'docx');   // the docx package from the global node modules (NODE_PATH or DOCX_PATH)
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, ShadingType, AlignmentType } = docx;
const N = JSON.parse(fs.readFileSync('content/narration.json', 'utf8'));
const { LESSONS } = await import('../src/sim/lessons.js');
const out = process.argv[2] || 'padworks-narration-script.docx';
const PRESET = { pad: 'Whole pad from above', tree: 'Frac tree', row: 'Wellhead row', zipper: 'Zipper manifold', pumps: 'Pump row and missile', sand: 'Sand side', tanks: 'Water', support: 'Data van, fuel, lights, totes, crew', gate: 'Gate and lease road', flowback: 'Flowback' };
const cell = (text, w, opts = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, shading: opts.head ? { type: ShadingType.CLEAR, fill: 'E7E6E6' } : undefined, margins: { top: 60, bottom: 60, left: 90, right: 90 }, children: [new Paragraph({ children: [new TextRun({ text, bold: !!opts.head, size: 19, font: 'Calibri' })] })] });
const W = [1500, 2600, 5260];
const table = (rows) => new Table({ columnWidths: W, width: { size: W.reduce((a, b) => a + b, 0), type: WidthType.DXA }, rows: [
  new TableRow({ tableHeader: true, children: [cell('Line id', W[0], { head: true }), cell('Cue', W[1], { head: true }), cell('Narration (edit this column)', W[2], { head: true })] }),
  ...rows.map(r => new TableRow({ children: [cell(r[0], W[0]), cell(r[1], W[1]), cell(r[2], W[2])] })),
] });
const h = (t, lvl = HeadingLevel.HEADING_2) => new Paragraph({ heading: lvl, children: [new TextRun(t)] });
const p = (t) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t, size: 20, font: 'Calibri' })] });
const children = [
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('Padworks narration script')] }),
  p('Every line the voice says in the introduction and the eleven lesson demos, in the order it is said. Edit the Narration column only. Keep the line ids. A line can be as long or short as you like; the demo waits for the voice to finish before it moves on. The score at the end of a lesson is shown in the caption, not spoken. Send the file back and the lines go into the build and get rendered to audio.'),
  p('Where it is spoken: the introduction plays from the landing page and the lessons page (Watch the introduction). A lesson demo plays from the lessons page (Watch) and the landing page featured row. The cue column says where the camera is or what the simulator does while the line plays.'),
  h('Introduction', HeadingLevel.HEADING_1),
  table(N.intro.map(it => [it.id, PRESET[it.preset] || it.preset, it.text])),
];
for (const L of LESSONS) {
  const n = N.lessons[L.id]; if (!n) continue;
  children.push(h('Lesson ' + L.n + ': ' + L.title, HeadingLevel.HEADING_1));
  const rows = [[L.id + '-intro', 'Lesson starts; pad set up for it', n.intro]];
  L.steps.forEach((s, i) => { const cue = s.action ? 'Demo presses: ' + (s.label || s.action) : s.valve ? 'Demo moves a valve' : s.demo ? 'Demo runs the controls' : 'Waits for the sim'; rows.push([L.id + '-step-' + (i + 1), cue, n.steps[i]]); });
  rows.push([L.id + '-end', 'Lesson complete', n.end]);
  children.push(table(rows));
}
const doc = new Document({ styles: { default: { document: { run: { font: 'Calibri', size: 20 } } } }, sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children }] });
fs.writeFileSync(out, await Packer.toBuffer(doc));
console.log('wrote', out);
