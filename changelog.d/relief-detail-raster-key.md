### Changed
- **The relief detail pass asks for each raster once** (`kit/relief.js`,
  P-0039). `@portrayal/kit` is 0.51.0. A node's text carries the face's whole
  `<style>` and `<defs>` (tens of kilobytes, up to a megabyte), and
  `rasterKey` rewrote all of it, and every kept raster held it as a key, on
  each ask. The shared prefix before `<!--art-->` is now rewritten once, found
  again by its length and ends and one comparison, and a key is a short number
  for it, the ids of it that only the art names and the art's own rewrite.
  Texts that `rasterKeyText` (the whole-text rewrite, now exported) tells
  apart never share a key, so nothing is drawn differently. `svgCanvas`, the
  lamp phases and the domes, which only make a texture of a raster, take the
  kept one (`rasterSource`) instead of a copy; a caller that draws on its
  canvas still takes `rasterize`. `svgCanvas` now returns the shared canvas,
  so a host that drew on one must copy it first. Measured on a large rack
  in headless Chromium with software GL: the 3D build from the click to
  settled 18.3 s to 15.1 s, `rasterKey` and what it called about 3.8 s to
  1.5 s of main thread, and the same 5,064 asks, 210 rasters drawn and
  the same pixels.
