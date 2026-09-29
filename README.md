# Completions Explorer

Interactive 3D reference library and stage-cycle simulator for oil and gas well completions. Training and reference only. Not for operational decisions.

Drop 2: 64 WH records, seven Draco-compressed GLB assemblies (gate valve manual and hydraulic, frac tree, wellhead, zipper manifold, flow iron kit, tree saver) bound to records, simulator with procedural surface and downhole scenes, record library with search, integrity report, validation and CI, Vercel rewrite config.

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
| `npm run integrity` | Binds record `mesh_nodes` to node names inside each GLB, checks budgets, writes `public/integrity.json` |
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
src/library/                         library, system, record pages, viewer, integrity, about
scripts/                             validate, integrity, postbuild, shots, seed
docs/                                writing standard, modeling standard, session template
```

## Review workflow

Every AI-drafted record is `status: "draft"` and is not shown as reviewed. To review a record: open the JSON, read every tab, check each citation against the source register, correct the text, then set `status` to `proposed` (read once) or `reviewed` (every tab and citation checked) and add yourself to `reviewers`:

```json
"status": "reviewed",
"reviewers": [{ "name": "J. Lambert", "affiliation": "Completions Explorer", "date": "2026-10-01", "scope": "all tabs" }]
```

`verified` requires two independent sources per numeric value. `npm run validate` refuses a non-draft record with no reviewer.

## Geometry

Two paths, both free:

1. Procedural (Three.js in code): everything in the simulator scenes (`src/sim/parts/`). Node names equal record IDs; a record with `"scene": "WH-FRACTREE"` binds to that node.
2. Scripted CAD (CadQuery): the scripts in `cad/scripts/WH/` build named solids and write uncompressed GLBs into `cad/out/WH/`; `npm run glb` compresses them into `public/glb/WH/`. The shared builders live in `cad/scripts/WH/_lib.py`. You do not need Python on your machine to use the site: the compressed GLBs are already in `public/glb/`. To regenerate, install Python 3.12, run `pip install cadquery trimesh` in a virtual environment, then `python cad/scripts/WH/WH-FRACTREE.py --out cad/out/WH` (and the other scripts), then `npm run glb`. The viewer decodes Draco with the files in `public/draco/`.

## Deploy

Vercel (recommended, free Hobby plan): sign in with GitHub, import the repository, accept the detected Vite settings, deploy. `vercel.json` rewrites every path to `index.html` so record links work. Every push to `main` redeploys. Cloudflare Pages and GitHub Pages also work (build `npm run build`, output `dist`; the `404.html` copy handles path routing on GitHub Pages). The step-by-step guide is in the Setup Guide document delivered with Drop 2.

Set `GITHUB_REPO` in `src/config.js` so the "Report an error" link on each record opens an issue in your repository.

## Licenses

Code: MIT. Content, records, geometry scripts, and generated models: CC BY-NC-SA 4.0. See LICENSE and CONTENT-LICENSE.
