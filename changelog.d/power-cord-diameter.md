### Changed
- **A power cord is drawn at its real diameter, and meets the plug stub**
  (#1060). Every cable was drawn 3 mm wide, so an IEC cord, 7.1 mm, was a thin
  line going into a plug stub drawn at the cord's real size, in 2D and 3D.
  `@portrayal/kit` is 0.34.0: `widthOf(cable, diameterOf)` in
  `rack/cable-geometry.js` gives the width to draw a cable at, the type's
  `od_mm` for media `power` (7.1 mm for the `power-c13` cord when it names no
  type) and `WIDTH` for every other media, so a cable of another media is
  drawn exactly as it was. **The site must call it:** its `cables.js` draws
  at `WIDTH` and is the side that has to change for the cord to be thicker.
- `generic/c13-plug@1`, `c14-plug@1`, `c19-plug@1` and `c20-plug@1` are
  1.2.0: their default `cable-od`, and so their drawn stub, is the H05VV-F
  cord of the kit's `power-c13` (7.1 mm, was the SJT 8.33) and `power-c19`
  (7.9 mm, was 9.65), from the Oznur Kablo H05VV-F data, so the stub is as
  wide as the cord drawn from it. A placement that sets its own `cable-od`
  is unchanged. The NEMA 5-15P and 5-20P cords keep their SJT figures.
