# Modeling standard

Applies to procedural geometry in `src/sim/parts/` and to CadQuery scripts in `cad/scripts/`.

- Units: procedural scenes in meters. CadQuery scripts in inches, exported to meters (scale 0.0254) in the GLB.
- Origin and axes for an assembly: origin at the flow-path center on the assembly centerline. Flow along +X. Stem or vertical along +Z in CadQuery (rotated to +Y in the viewer); +Y up in procedural scenes.
- Node names equal record IDs. A part of an assembly is `{ASSEMBLY-ID}-{PART}`. The integrity check fails the build when a record claims a node that does not exist or a GLB contains a node no record claims.
- Generic geometry only: proportions from public catalog dimensions or from the dimension sheet in `cad/dims/`. No brand features, part numbers, or proprietary internals.
- Budgets: per-assembly GLB under 2 MB compressed; per-scene resident triangles under 500,000 on the phone variant and 1.5 million on the laptop variant.
- Materials: use the shared `MAT` set in `src/sim/parts/primitives.jsx` for procedural parts; the CadQuery exporter maps part roles to the same palette.
- Motion: two-position valves travel over a fixed time; mechanisms use simple kinematics and carry the "simplified motion" label.
- Cut-away: a section plane through the stem axis and the bore (world z = 0 in the viewer) must show the interior correctly, so bores, cavities, and seats are real solids, not painted on.
- Labels: sprite labels only (no DOM labels inside the canvas).
