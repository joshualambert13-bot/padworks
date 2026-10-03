Flag artwork. The pad draws the US flag and the simple geometric state flags (TX, CO, NM, OH) in code; the seal
flags come from these files, loaded by `flagTexture()` in src/sim/parts/lighting.jsx and drawn over the coded
fallback when they arrive.

  ND.svg  LA.svg  PA.svg  OK.svg  WY.svg

Source: the npm package `us-state-flags` 1.0.7 (ISC license), inner SVG content of its Flag<ST> components written
out as plain SVG files, unchanged. They are traced vector renderings of the official state flags; the flag designs
themselves are state government works. A file for any other kind listed in `FLAG_FILES` (same module) replaces the
drawn flag the same way: name it `<kind>.svg` (us.svg, TX.svg, CO.svg, NM.svg, OH.svg) and add the kind to the set.
