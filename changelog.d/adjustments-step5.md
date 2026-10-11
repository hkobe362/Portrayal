### Added
- **The Explorer has a control for a part that slides** (#950, step 5 of
  `docs/adjustable-positions-design.md`). For each adjustment of the device
  on screen it shows, above the tree, a slider over the range in steps of
  0.1 mm, a number box in mm, one button for each named stop and a reset. A
  value is written through `setFields`, so it goes into the `fields=` link and
  to the 3D scene with every other field. A value that is refused is said
  under the control. A view that cannot show the motion names the views that
  do. A device that declares no adjustment gets no control.
- **`@portrayal/kit` 0.20.0 gains `positions.js`**, with one export,
  `positionControl(shell, opts)`, the control above. A host that mounts a
  shell mounts it with one call, and says which stage is showing by emitting
  `mode` (`'2d'` or `'3d'`) on the shell. Nothing else in the kit changes.

### Changed
- **FS DINRAIL2U and DINRAIL4U 1.1.0 state their rail setback as an
  adjustment, `rail-setback`** (#950). The front face of the rail panel
  stands 51.2 to 271.2 mm behind the ears on the 2U and 50.5 to 269.4 on the
  4U, with stops `front`, `middle` and `rear`. The default is the position
  drawn before, 161.2 and 159.9, so no face changes but for the new
  attributes: `data-adjustments` on each root, and `data-moves-with` and
  `data-moves-by` on the 29 nodes that draw the panel. A saved link can now
  carry `fields=rail-panel~rail-setback~<mm>`. `provenance.setback` is renamed
  `provenance.rail-setback`, and the `gaps` entry that asked for a way to
  state the range is removed. The three `physical.din-rail-setback` attrs
  stay, and a test now requires them. The DCIM exports of the two devices
  change in one comment line each, the drawing version; no configuration is
  added and no field of a DCIM schema moves.
