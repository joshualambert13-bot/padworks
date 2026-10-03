Photographic textures (optional). The pad draws every texture in code. Files dropped in here are picked up at load
and blended into the drawn ones (src/sim/parts/textures.js): the pad and ground take the gravel grain, painted
sheet metal takes the scuffs, bare steel takes the brushed roughness. Nothing breaks when a file is absent.

All files come from Poly Haven (polyhaven.com), which publishes everything under CC0 (public domain, no attribution
required). 2K JPG is the right size. Inside a Poly Haven texture zip the files are named like
`gravelly_sand_diff_2k.jpg`, `gravelly_sand_nor_gl_2k.jpg`, `gravelly_sand_rough_2k.jpg`; copy the ones listed and
rename them exactly as shown. Only these names are read:

  ground_diff.jpg    a dry, pale, fine gravel or caliche ground, seen from straight above (Poly Haven: search
                     "gravel" or "sand"; good picks: gravelly_sand, sandy_gravel_02, aerial_rocks_02)
  paint_diff.jpg     scuffed painted metal, mostly flat with wear (search "painted metal"; the color does not
                     matter, it is reduced to gray)
  paint_rough.jpg    the `_rough_` file from the same painted metal set
  steel_rough.jpg    the `_rough_` file from a brushed or bare metal set (search "metal plate" or "brushed")

Skies, for the Full renderer's reflections and visible sky (the loader for these lands in the drop after the files
are in the folder; until then they are simply served):

  sky_day.hdr        a clear or lightly clouded daytime HDRI, 2K .hdr (good picks: kloofendal_48d_partly_cloudy_puresky,
                     syferfontein_1d_clear_puresky, kloppenheim_06_puresky)
  sky_dusk.hdr       a sunset HDRI, 2K .hdr (belfast_sunset_puresky, qwantani_dusk_2_puresky)
  sky_night.hdr      a night HDRI, 2K .hdr (dikhololo_night, moonless_golf, satara_night_no_lamps)

Keep this folder to these files: anything else here ships with the site.
