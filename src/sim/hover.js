// Hover and tap picking in the simulator scenes: resolves a scene node name to a library record
// and holds the popup state. Shared by the surface and downhole canvases and the HTML overlay.
import { create } from 'zustand';
import { byId } from '../lib/records.js';

// Scene names that do not equal a record id map here.
const ALIAS = {
  'CM-PRODUCTIONCASING': 'CM-WELLBORE-PRODUCTIONCASING', 'FORMATION': 'CM-WELLBORE-FORMATION', 'CT-DOWNHOLE': 'CT-BHA',
  'LG-SANDSILOS': 'PP-SANDHANDLING', 'LG-SANDSILO': 'PP-SANDHANDLING', 'LG-CONVEYOR': 'PP-SANDHANDLING',
  'PP-FRACTANK': 'PP-FRACTANKS', 'WL-PCE-STACK': 'WL-PCE', 'FB-SPREAD': 'FB', 'WH-TREEADAPTER': 'WH-FRACTREE-TREEADAPTER',
  'WH-CASINGSPOOL': 'WH-CASINGHEAD', 'WL-UNIT-CAB': 'WL-UNIT', 'WL-TOOLSTRING-DOWNHOLE': 'WL-TOOLSTRING',
  'CT-INJECTOR': 'CT-STACK-INJECTOR', 'CT-INJECTORHEAD': 'CT-STACK-INJECTOR', 'CT-QUADBOP': 'CT-STACK-QUADBOP', 'CT-STRIPPER': 'CT-STACK-STRIPPER',
  'CT-MILL': 'CT-BHA', 'PP-FRACPUMP-VFD': 'PP-FRACPUMP-MOTOR', 'PP-POWERGEN-SWITCHGEAR': 'PP-POWERGEN-TURBINE', 'PP-POWERGEN-TRANSFORMER': 'PP-POWERGEN',
  'PP-POWERGEN-FUELTRAILER': 'PP-POWERGEN', 'WH-ZIPPER-ACCUMULATOR': 'WH-FRACVALVECONTROL-ACCUMULATOR', 'WH-ZIPPER-HPU': 'WH-FRACVALVECONTROL-HPU',
  'RG-WORKOVERRIG-SUBSTRUCTURE': 'RG-WORKOVERRIG', 'RG-WORKOVERRIG-CROWN': 'RG-WORKOVERRIG-MAST', 'RG-WORKOVERRIG-BLOCK': 'RG-WORKOVERRIG-MAST', 'RG-WORKOVERRIG-PIPERACK': 'RG-TUBINGHANDLING',
  'AL-ESP-SURFACE': 'AL-ESP', 'AL-GASLIFT-SURFACE': 'AL-GASLIFT', 'LG-SANDBOXES': 'PP-SANDHANDLING', 'LG-SANDBOX': 'PP-SANDHANDLING', 'PP-FUELGAS-TRAILER': 'PP-FUELGAS',
  'WH-FRACLINE': 'WH-FLOWIRON',   // the treating line from the missile to the zipper (Drop 74)
};

export function resolveRecord(name) {
  if (!name) return null;
  if (byId.has(name)) return name;
  if (ALIAS[name]) return ALIAS[name];
  // numbered instances: PP-FRACPUMP-3 -> PP-FRACPUMP, PP-FRACPUMP-3-ENGINE -> PP-FRACPUMP-ENGINE
  const n = name.replace(/-\d+(?=-|$)/g, '');
  if (n !== name) { const r = resolveRecord(n); if (r) return r; }
  // sub-part names: WH-FRACTREE-LMV-BODY -> WH-FRACTREE-LMV
  const parts = name.split('-');
  if (parts.length > 2) return resolveRecord(parts.slice(0, -1).join('-'));
  return null;
}

// Walk up from the hit mesh to the nearest ancestor whose name resolves to a record.
export function recordFromObject(obj) {
  let o = obj;
  while (o) {
    const id = resolveRecord(o.name);
    if (id) return id;
    o = o.parent;
  }
  return null;
}

export const useHover = create((set) => ({
  id: null, x: 0, y: 0, pinned: false, canvas: null,
  show: (id, x, y, canvas, pinned = false) => set(s => (s.pinned && !pinned ? {} : { id, x, y, canvas, pinned })),
  hide: (force = false) => set(s => (s.pinned && !force ? {} : { id: null, pinned: false })),
  unpin: () => set({ pinned: false, id: null }),
}));

// Handlers to spread on a top-level <group> inside a Canvas. Only the nearest thing under the pointer counts
// (Drop 75): the handler is called once per object the ray passes through, nearest first, and before this an
// unnamed near object (a berm, the ground seen from inside the pit) let the record of whatever stood behind it
// show. Things that must never catch the ray (rain, flurries, the leak spray, labels) have no-op raycasts.
const nearest = (e) => { const hits = e.intersections; return !hits || hits.length === 0 || hits[0].object === e.object; };
export function pickHandlers(canvasKey, show, hide) {
  return {
    onPointerOver: (e) => { if (!nearest(e)) return; const id = recordFromObject(e.object); e.stopPropagation(); if (!id) { hide(); return; } show(id, e.nativeEvent.offsetX, e.nativeEvent.offsetY, canvasKey); document.body.style.cursor = 'pointer'; },
    onPointerOut: () => { document.body.style.cursor = 'auto'; hide(); },
    onPointerMove: (e) => { if (!nearest(e)) return; const id = recordFromObject(e.object); e.stopPropagation(); if (!id) { hide(); return; } show(id, e.nativeEvent.offsetX, e.nativeEvent.offsetY, canvasKey); },
    onClick: (e) => { if (!nearest(e)) return; const id = recordFromObject(e.object); if (!id) return; e.stopPropagation(); show(id, e.nativeEvent.offsetX, e.nativeEvent.offsetY, canvasKey, true); },
    onPointerMissed: () => hide(true),
  };
}
