# Padworks: O&G Completions Simulator

Interactive 3D equipment library and stage-cycle simulator for oil and gas well completions. Built for training. Not for operational decisions. Written, modeled, and coded independently from public sources.

Live at https://padworks.vercel.app (GitHub repository joshlambert13-bot/padworks). The local folder may still be named completions-explorer; the folder name has no effect on the build.

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
| `npm run shots` | Headless Chromium screenshot walkthrough into `shots/` (after a build) |
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
2. Scripted CAD (CadQuery): the scripts in `cad/scripts/WH/` build named solids and write uncompressed GLBs into `cad/out/WH/`; `npm run glb` compresses them into `public/glb/WH/`. The shared builders live in `cad/scripts/WH/_lib.py`. You do not need Python on your machine to use the site: the compressed GLBs are already in `public/glb/`. To regenerate, install Python 3.12, run `pip install cadquery trimesh` in a virtual environment, then `python cad/scripts/WH/WH-FRACTREE.py --out cad/out/WH` (and the other scripts), then `npm run glb`. The viewer decodes Draco with the files in `public/draco/`.

## Deploy

Vercel (recommended, free Hobby plan): sign in with GitHub, import the repository, accept the detected Vite settings, deploy. `vercel.json` rewrites every path to `index.html` so record links work. Every push to `main` redeploys. Cloudflare Pages and GitHub Pages also work (build `npm run build`, output `dist`; the `404.html` copy handles path routing on GitHub Pages). The step-by-step guide is in the Setup Guide document delivered with Drop 2.

`GITHUB_REPO` in `src/config.js` points the "Report an error" link on each record at the repository's issues page. The logo lives in `public/brand/` (`mark.svg` plus PNG renders).

## Licenses

Code: MIT. Content, records, geometry scripts, and generated models: CC BY-NC-SA 4.0. See LICENSE and CONTENT-LICENSE.
