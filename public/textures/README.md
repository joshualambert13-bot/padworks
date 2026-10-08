Photographic textures. The pad draws every surface in code; the CC0 photo sets here become the detail layer of
every material in their family (src/sim/parts/textures.js and the DETAIL layer in lighting.jsx): sampled in
world space on every surface of that family, no UVs needed, nothing recompiles. Nothing breaks when a set is
absent, and the Lite renderer never loads any of them.

Since Drop 86 this folder holds what the site serves: KTX2 files (GPU-compressed, mipmaps included) written by
`npm run textures` from the sources in `assets/textures/`, plus `index.json`, which lists the file for each device
tier and the mean color of each map (the normalization that used to be read from the pixels). Drop new source
files into `assets/textures/` under the names below and run `npm run textures` (needs `toktx` from KTX-Software on
the PATH); the JPG or PNG itself must not be copied here. Where a source is 2k (the ground, the terrain) a 1k copy
is written as well for phones. The skies are the exception: `.hdr` files stay here as they are, with a 1k copy
for phones written by `python3 scripts/hdr-half.py`.

All sources come from Poly Haven (polyhaven.com) or ambientCG (ambientcg.com), both CC0 (public domain, no
attribution required). 1K JPG is the right size for most sets, 2K for the ground, the terrain and the skies.
Inside a Poly Haven texture zip the files are named like `gravelly_sand_diff_1k.jpg`, `gravelly_sand_nor_gl_1k.jpg`,
`gravelly_sand_rough_1k.jpg`, `gravelly_sand_ao_1k.jpg`; copy the ones listed and rename them exactly as shown.
Only these names are read. Each family takes up to four maps: `_diff` (color), `_nor` (normal, OpenGL convention,
the `_nor_gl_` file), `_rough` (roughness), `_ao` (ambient occlusion, optional).

  ground_*.jpg      the pad surface: pale caliche or fine gravel from straight above (gravelly_sand, sandy_gravel_02)
  terrain_*.jpg     the land around the pad: dry dirt and rock (rocky_terrain_02, aerial_rocks_02, sand_01)
  sand_*.jpg        proppant piles (any fine sand)
  paint_*.jpg       scuffed painted sheet metal; the color is reduced, the wear is kept (painted_metal_shutter, metal_plate_02)
  steel_*.jpg       bare steel plate (metal_plate, any brushed metal)
  rust_*.jpg        heavy rust (rusty_metal_02, rusty_metal_03, rust_coarse_01)
  rubber_*.jpg      tires and hoses (any rubber)
  concrete_*.jpg    mats and cellars (concrete_floor_02)
  plastic_*.jpg     totes, poly tanks, hard hats (any plastic)
  liner_*.jpg       the black pit liner and tarps (any tarp or plastic sheet)
  fabric_*.jpg      coverall cloth (denim, nylon, canvas)
  hivis_*.jpg       vest mesh (any mesh fabric; the color is reduced)
  water_nor.jpg     ripples for the pit's water (any water normal map)

Decals, from ambientCG's Decals category, PNG with transparency, renamed:

  decal_oil.png        an oil stain (goes under every pump's power end and at the drips)
  decal_stain.png      a dirt or water stain (the wet and muddy spots)
  decal_tiretrack.png  tire tracks, running left to right in the image (along the truck lanes)
  decal_crack.png      a crack or a patch (scattered over the pad)

Skies, for the Full renderer's reflections and visible sky (HDRIs tab, 2K, HDR format), kept here as .hdr:

  sky_day.hdr        a clear or lightly clouded daytime HDRI (kloofendal_48d_partly_cloudy_puresky, syferfontein_1d_clear_puresky)
  sky_dusk.hdr       a sunset HDRI (belfast_sunset_puresky, qwantani_dusk_2_puresky)
  sky_night.hdr      a night HDRI (dikhololo_night, moonless_golf, satara_night_no_lamps)

Keep this folder to the packed files, the skies and index.json: anything else here ships with the site.
