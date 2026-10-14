### Changed
- **The 3D relief is built and drawn in batches** (`kit/relief.js`, P-0036).
  A raster is kept by what decides its pixels (`rasterKey`: the text, less an
  id, a `data-` value and a title's words the drawing's stylesheet and
  references cannot see, at one canvas size and flip), so a drawing is
  rasterised once however often a face asks for it (`rasterSource`,
  `setRasterBudget`, `clearRasterCache`, `rasterStats`). Once a face is built,
  `batchRelief` makes equal textures and materials one and merges the meshes
  that share a material, a part and a frame (`mergePieces`). A part
  (`userData.portrayalPath`), a FRU's group and a material a restyle changes
  stay apart; a host names the parts it styles itself with `ctx.parts(path)`,
  and `ctx.batch: false` builds a face as before. `nodeTools` asks the
  document for each element's CTM and box once. Measured on a generated rack
  of 42 parts and 456 cables in headless Chromium: 14,737 SVG rasters to 185,
  and 59,739 draw calls a frame to 28,863 (23,101 with `parts`). `@portrayal/kit`
  is 0.42.0.
- **A USDZ download now carries the relief that was a box of several
  materials.** three's USDZ exporter writes no mesh with more than one
  material, so every such box (a raised part's sides, a cage's walls) was left
  out of the file; split by material, each is written. A GLB holds the same
  triangles in fewer meshes.
