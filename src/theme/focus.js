// Pitch focus (Drop 83): a theme's `site.focus` says which company on the pad the site is being shown to, and
// the site leads with their part of the job: the landing page features their lessons, the lessons page lists
// those first, and the simulator opens on their equipment. 'pad' (the default) is the whole pad, nothing featured.
// The lesson sets are training groupings, not anyone's product list.
import { LESSONS } from '../sim/lessons.js';

export const FOCUS = {
  pad: { id: 'pad', label: 'Whole pad', lessons: [], preset: 'pad', who: null, line: '' },
  pumping: { id: 'pumping', label: 'Pressure pumping', lessons: ['L2', 'L3', 'L4', 'L11', 'L10'], preset: 'pumps', who: 'fleet',
    line: 'The pump row, the missile and the treating line: pumping a stage, kickouts, screenouts, a treating iron leak and a lightning hold.' },
  wellhead: { id: 'wellhead', label: 'Wellhead and frac tree', lessons: ['L1', 'L6', 'L9', 'L8', 'L5'], preset: 'tree', who: 'wellhead',
    line: 'The tree, the zipper and the wireline: a first run, a stuck tool string, a gun misfire, the production hookup and a toe sleeve.' },
  operator: { id: 'operator', label: 'Operator', lessons: ['L12', 'L7', 'L8', 'L2', 'L10'], preset: 'van', who: 'operator',
    line: 'The whole job as the company man sees it: a stage called from the data van, drillout and flowback, the production hookup, pumping and a weather hold.' },
};
export const FOCUS_IDS = Object.keys(FOCUS);

export function focusOf(theme) { return FOCUS[theme && theme.site && theme.site.focus] || FOCUS.pad; }
// the company the focus is for, named by the theme (null for the whole pad)
export function focusName(theme) { const f = focusOf(theme); return f.who ? (theme[f.who] && theme[f.who].name) || f.label : null; }
export function featuredLessons(theme) { const f = focusOf(theme); return f.lessons.map(id => LESSONS.find(l => l.id === id)).filter(Boolean); }
// every lesson, the featured ones first in their featured order
export function orderedLessons(theme) { const feat = featuredLessons(theme); return [...feat, ...LESSONS.filter(l => !feat.includes(l))]; }
