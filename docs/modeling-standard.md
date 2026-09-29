# Modeling standard

Applies to procedural geometry in `src/sim/parts/` and to CadQuery scripts in `cad/scripts/`.

- Units: procedural scenes in meters. CadQuery scripts in inches, exported to meters (scale 0.0254) in the GLB.
- Origin and axes for an assembly: origin at the flow-path center on the assembly centerline. Flow along +X. Stem or vertical along +Z in CadQuery (rotated to +Y in the viewer); +Y up in procedural scenes.
- Node names equal record IDs. A part of an assembly is `{ASSEMBLY-ID}-{PART}`. The build check (scripts/integrity.mjs) fails the build when a record claims a node that does not exist or a GLB contains a node no record claims.
- Generic geometry only: proportions from public catalog dimensions or from the dimension sheet in `cad/dims/`. No brand features, part numbers, or proprietary internals.
- Budgets: per-assembly GLB under 2 MB compressed; per-scene resident triangles under 500,000 on the phone variant and 1.5 million on the laptop variant.
- Materials: use the shared `MAT` set in `src/sim/parts/primitives.jsx` for procedural parts; the CadQuery exporter maps part roles to the same palette.
- Motion: two-position valves travel over a fixed time; mechanisms use simple kinematics and carry the "schematic motion" label.
- Section: the section plane through the stem axis and the bore (world z = 0 in the viewer) must show the interior correctly, so bores, cavities, and seats are real solids, not painted on.
- Labels: sprite labels only (no DOM labels inside the canvas).
- Framing: a component page opens framed on its own part with the rest of the assembly translucent; F toggles between the part and the whole assembly. Tall stacks (the WL pressure control stack) therefore read at part level, not assembly level.
- Own vocabulary: tab names, status names, viewer keys, and page names are this project's own and are not to be aligned with any other site's wording.
- Size variants: an assembly that exists in several bores and ratings is exported once per size as `{ID}.{size}.glb` (sizes 4-10K, 4-15K, 5-10K, 5-15K, 7-10K, 7-15K). The record's `glb` is the default file and `variants` lists the rest; the build check binds every record node in every variant. Node names never change between variants.
- Flange envelopes come from `cad/dims/WH/flanges.json` (public 6BX table, E2). Body, bonnet, and actuator proportions are the project's own.
- Photographs: field and yard photographs are read for overall proportion only (block height to flange diameter, actuator length to bore, stack height to well count). No logo, paint scheme, nameplate, or distinctive design feature is reproduced, and no photograph enters the repository. Photographs stay in `reference-photos/` outside the repo.
- Context nodes: a part drawn only to give context (the casing around a downhole tool) is listed in the record's `ghost_nodes` and the viewer draws it translucent and leaves it out of framing.
- Standard frac stack: tree adapter, lower master (manual), upper master (hydraulic), cross with a manual then a hydraulic wing valve each side, crown valve (hydraulic), flanged inlet block, swab valve (hydraulic), top adapter. The procedural simulator tree and the CadQuery tree share this configuration and the same node names.
- Assemblies by system: WH (gate valves, frac stack, zipper, wellhead, flow iron, tree saver), WL (pressure control stack), CT (pressure control stack and injector), DT (plug on setting tool), FB (choke manifold). Each keeps its node names in its own `cad/scripts/{SYSTEM}/` script; the build check page lists every file with its triangle count and budget status.
