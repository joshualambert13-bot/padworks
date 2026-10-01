# Padworks: O&G Completions Simulator

Interactive 3D equipment library and stage-cycle simulator for oil and gas well completions. Built for training. Not for operational decisions. Written, modeled, and coded independently from public sources.

Live at https://padworks.vercel.app (GitHub repository joshlambert13-bot/padworks). The local folder may still be named completions-explorer; the folder name has no effect on the build.

Drop 14: vegetation and terrain. Plants are built per basin from a few instanced parts with per-plant color variation: pines as trunk and three cone tiers, hardwoods as trunk, two branches, and a lumpy three-blob canopy, mesquite as a leaning trunk under a wide flat canopy, creosote scrub and sage as low clumps, brush as a bushy mid-size plant, and prairie grass as alpha-tested crossed-quad tufts; forested basins carry up to 1,700 plants in full quality (550 in lite). Instanced rocks, a 2 km outer ground plane, and a horizon ring that fits the basin: mesas and buttes for the desert, a pointed pine or rounded hardwood tree line at the clearing edge, rolling ridges for the plains. The lease road now runs out 320 m with a barbed-wire fence on both sides, a cattle guard and gate posts at the pad entrance, and two gate signs (check in, H2S and no smoking). New camera preset: Pad entrance. Terrain math moved to src/sim/parts/terrain.js.

Drop 13: hero detail and pad life. Frac tree: hydraulic hose pairs from every actuator to a junction box on its stand and a trunk bundle toward the control unit, tubing head lockdown screws, adapter studs, stud ring on the inlet hub, lifting eyes on the cross, a pressure gauge with its needle valve on the inlet block, well number signs and high-pressure placards while pumping, and a wear map on the tinted valve bodies. Zipper: a gauge on every tee, hose pairs from both leg actuators to a base junction and trunks to the control unit, a danger placard on the skid. Pumps: numbered signs, a hazard strip across the rear, and exhaust plumes from the stacks while a diesel or dual-fuel engine runs. Missile: hazard strips on the deck ends and a placard. Pad life: crew figures in coveralls, vests, and hard hats at the data van, the zipper control unit, the sand boxes, the tree during wireline, the flowback spread, and the wellhead during hookup; a windsock and a safety flag by the data van; a crew truck driving the lease road and back; red zone placards at the containment. The per-frame contact shadow pass was removed (blob shadows cover it), which brought full quality from 3.7 to 2.6 s per software frame and lite from 2.0 to 1.2. Wording on every placard is generic; there are no company, crew, or product names anywhere.

Drop 12: rendering pass. A procedural sky dome (basin sky, haze, and ground colors with a sun) is both the background and, rendered once into a small cube map, the image-based light for every surface, so bare metal reflects the sky and paint takes sky light; materials reworked (metallic steel, aluminum, and brass; dielectric paint with a shared wear map that varies roughness; rubber, tires, glass); soft shadows with bias tuning; ACES tone mapping with rebalanced lights; ground and pad textures generated in the browser (fractal noise as color and bump on the terrain, gravel with wheel ruts and stains on the pad and the lease road); blob contact shadows under every trailer, tank, silo, sand box row, and wellhead; the library viewer lit by the same sky with self-shadowing and rubber parts detected by color. A Full/Lite quality toggle on the toolbar (phones default to lite: hard shadows, no environment map, no bump maps); the headless pass runs the logic in lite mode and a separate full-quality set covers the visuals. No image files and no network fetch: every texture and the sky are computed on load.

Drop 11: pad geometry detail pass on the procedural surface assets. Trailers now carry a gooseneck, tri-axle duals, fenders, landing gear, deck grating, rub rails, and marker lights; frac pumps have a hooded engine with radiator, fan, exhaust silencer, and air cleaner (or a motor with cooling blower and VFD cabinet), transmission, power end with covers and lube reservoir, quintuplex fluid end with plunger housings, suction and discharge manifolds, discharge iron and a suction hose to the missile, walkway, handrail, and control panel; blender with a mixing tub and hopper, covered augers with ground hoppers, hydraulic suction and discharge pumps, manifolds, additive tanks, cabin; hydration unit with baffled compartments, paddle mixers, level gauges, walkway; chemical add unit with a pump cabin and totes in a containment tray; sand silos with stiffener rings, cone bottoms on braced legs, dust collectors, ladders, and a transfer conveyor; sand boxes on a conveyor cradle with a forklift; 500 bbl frac tanks with rounded tops, stairs, roof walkways, and valve manifolds; data van with a window band, roof air conditioners, stair, generator, and mast; wireline unit with a windowed cabin, drum with level wind, outriggered crane with a three-section boom and hook block; coiled tubing unit with a flanged reel on a cradle, chain-drive injector with gooseneck rollers, and a control cabin; flowback spread with an adjustable-choke manifold, plug catcher with closures, sand separator with cone and ladder, three-phase separator with domed heads on saddles and a meter run, guyed flare with a knockout drum; fuel gas and diesel tankers with domed ends; light towers, pickups; turbine, genset, substation, and gas skid detail; hammer unions with lugs on every pipe; stud sets on every valve flange and bonnet. Two new camera presets (Frac tanks, Data van and power). Hover names and record bindings unchanged.

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
