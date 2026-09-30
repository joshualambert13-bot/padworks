# Padworks: O&G Completions Simulator

Interactive 3D equipment library and stage-cycle simulator for oil and gas well completions. Built for training. Not for operational decisions. Written, modeled, and coded independently from public sources.

Live at https://padworks.vercel.app (GitHub repository joshlambert13-bot/padworks). The local folder may still be named completions-explorer; the folder name has no effect on the build.

Drop 10: scoring and guided lessons. Every job is scored from 100: points off for interlock rejections, valve moves against the sequence, operator-caused overpressure, kickouts, and screenouts, and for event recoveries that run past their time target; eight guided lessons (first wireline run, pump stage 1, kickout recovery, screenout, toe sleeve and ball drop, stuck tool string, drillout and flowback, production hookup) each set up the pad, put the job at the right point, and walk through ordered checkpoints with hints and a graded result against a time target; a session summary (score, deductions, event recoveries, per-stage times, lesson results, log) with a print stylesheet and a JSON export; lesson results stay in the browser (localStorage), nothing is sent anywhere.

Drop 9: training events (an instructor card injects a gun misfire, stuck tool string, working valve actuator fault, sand delivery interruption, relief valve lift, or screenout, or fires them at random) with recovery sequences in the next-steps card; production hookup as sub-steps with a workover rig and BOP stack in the scene (rig up, run 300 joints of tubing, nipple down, tree on); RG system (workover rig, BOP stack cut-away model, tubing handling, snubbing, accumulator, choke and kill lines), DA system (frac van and the instrumentation behind every readout), MT system (proppant, fluid systems, additives, water, cement, casing grades, elastomers); the four cut-away models now open with the cut face toward the camera; 322 records, 37 model files.

Drop 8: artificial lift as a Pad Setup variable (natural flow, rod pump with an animated beam unit, ESP, gas lift, plunger lift) shown at the tree and in the downhole view during the production phase; AL system with beam unit and rod pump cut-away models and 27 records; SC system with a gravel pack cut-away and 11 records; LG pad records (containment, sand boxes, light towers) and fuel gas trailers; color-coded wells (tree bodies and flanged runs per well); 287 records, 36 model files.

Drop 7: Pad Setup stage before the job (basin with matching terrain, wells and frac scheme, tree bore and rating with a treating-pressure check, plug and perf or sliding sleeve with cemented or openhole and millable or dissolvable options, lateral and stage design, fleet type with horsepower and pump count, proppant and fluid systems and intensities); sliding sleeve job path (toe sleeve on pressure, ball launcher on the tree, ball drop per stage, seat mill-out or dissolve) with matching tree, phases, guidance, and downhole scene; missile rebuilt with low-pressure suction sides and a high-pressure discharge header feeding the zipper through an inlet isolation valve; zipper rebuilt as vertical legs with two valves each (model in three sizes, PP-MISSILE and DT-FRACSLEEVE cut-away models); more lifelike downhole section (bedding, perforation tunnels, branched fractures, plug slips, sleeves with ports and seats, openhole packers, coiled tubing BHA); next-steps guidance card with valve highlighting; labels off by default with hover popups that open the library and return to the pad at the same stage; 234 records, 33 model files.

Drop 6: production tree model with UC records (21: tree components, tubing, packer, safety valve, nipples, sleeve, flowline), cased wellbore cut-away with CM records (16: strings, cement, floats, centralizers, cement head, unit, evaluation), production phase shows the production tree in the simulator; 208 records, 31 model files.

Drop 5: coiled tubing stack and injector model with CT records (18), flowback choke manifold model with FB records (15), wireline stack rebuilt with a block wireline valve and hands-free adapter in two bores, wellhead rebuilt with block side-outlet valves, per-well pad table in the simulator; 170 records, 29 model files.

Drop 4: block-body valves and the standard frac stack from photo proportions and public flange tables, in three bores and two ratings (size selector on the record page); pad configuration in the simulator (1 to 16 wells; single, zipper, simul-frac, trimul-frac, quad-frac; tree bore choice); PP pressure pumping records (26) and DT downhole tool records (21) with a frac plug on setting tool cut-away; 135 records, 26 model files.

Drop 3: new name (Padworks) and logo, wireline pressure control stack (WL) with records and a model, differentiated vocabulary (tab names, status names, build check page, viewer keys), 86 records, eight Draco-compressed model files (superseded by Drop 4), simulator with procedural surface and downhole scenes, record library with search, build check page, validation and CI, Vercel rewrite config.

## Run it

Requires Node.js 22 (LTS). Inside this folder:

```
npm install
npm run build
npm run preview
```

Open the address printed by `npm run preview` (normally http://localhost:4173). For live editing use `npm run dev` instead of build and preview.

On a phone on the same Wi-Fi: run `npm run preview -- --host` and open the network address it prints.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run validate` | Schema, ID, parent, citation, alias, and glossary checks on every record |
| `npm run integrity` | Checks record `mesh_nodes` against part names inside each GLB, checks budgets, writes `public/build-check.json` (the Build check page) |
| `npm run build` | Runs validate and integrity, then builds `dist/` and writes `dist/404.html` for path routing |
| `npm run preview` | Serves `dist/` |
| `npm run shots` | Headless Chromium screenshot walkthrough into `shots/` (after a build); the walkthrough starts a job from Pad Setup |
| `npm run glb` | Draco-compresses every GLB in `cad/out/{SYSTEM}/` into `public/glb/{SYSTEM}/` (node names preserved) |

## Layout

```
content/records/{SYSTEM}/{ID}.json   one record per file; file name equals id
content/schema/record.schema.json    the record contract
content/systems.json, sources.json, glossary.json, hazards.json
cad/scripts/{SYSTEM}/{ID}.py         CadQuery scripts (Python) for GLB assemblies
cad/dims/{SYSTEM}/{ID}.json          dimension sheet per scripted assembly
public/glb/{SYSTEM}/{ID}.glb         compressed GLB served to the record viewer
src/sim/                             simulator: store.js (state and response model), scenes, procedural parts, panels
src/library/                         library, system, record pages, viewer, build check, about
scripts/                             validate, integrity, postbuild, shots, seed
docs/                                writing standard, modeling standard, session template
```

## Review workflow

Every AI-drafted record is `status: "draft"` and is labeled "Unreviewed draft" on the site. To review a record: open the JSON, read every tab, check each citation against the source register, correct the text, then set `status` to `screened` (read once) or `reviewed` (every tab and source checked) and add yourself to `reviewers`:

```json
"status": "reviewed",
"reviewers": [{ "name": "J. Lambert", "affiliation": "Independent", "date": "2026-10-01", "scope": "all tabs" }]
```

`verified` requires two independent sources per numeric value. `npm run validate` refuses a non-draft record with no reviewer.

## Geometry

Two paths, both free:

1. Procedural (Three.js in code): everything in the simulator scenes (`src/sim/parts/`). Node names equal record IDs; a record with `"scene": "WH-FRACTREE"` binds to that node.
2. Scripted CAD (CadQuery): the scripts in `cad/scripts/WH/` build named solids and write uncompressed GLBs into `cad/out/WH/`; `npm run glb` compresses them into `public/glb/WH/`. The shared builders live in `cad/scripts/WH/_lib.py`. You do not need Python on your machine to use the site: the compressed GLBs are already in `public/glb/`. To regenerate, install Python 3.12, run `pip install cadquery trimesh` in a virtual environment, then `python cad/scripts/WH/WH-FRACTREE.py --out cad/out/WH` (and the other scripts: `WH-ZIPPER.py --all`, `PP/PP-MISSILE.py`, `DT/DT-FRACSLEEVE.py`, and the rest), then `npm run glb`. The viewer decodes Draco with the files in `public/draco/`.

## Deploy

Vercel (recommended, free Hobby plan): sign in with GitHub, import the repository, accept the detected Vite settings, deploy. `vercel.json` rewrites every path to `index.html` so record links work. Every push to `main` redeploys. Cloudflare Pages and GitHub Pages also work (build `npm run build`, output `dist`; the `404.html` copy handles path routing on GitHub Pages). The step-by-step guide is in the Setup Guide document delivered with Drop 2.

`GITHUB_REPO` in `src/config.js` points the "Report an error" link on each record at the repository's issues page. The logo lives in `public/brand/` (`mark.svg` plus PNG renders).

## Licenses

Code: MIT. Content, records, geometry scripts, and generated models: CC BY-NC-SA 4.0. See LICENSE and CONTENT-LICENSE.
