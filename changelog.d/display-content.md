### Added
- **A display in a rack shows text, digits or an image** (P-0042).
  `@portrayal/kit` is 0.47.0. An item and a part beside the rack take
  `displays`, a map of the path of a display to what it shows, as `states` says
  what a part is: `{text: [lines]}` (drawn in the display's font, cut to its
  columns and rows), `{digits: "04"}` (a segment display) or `{image: ...}` (an
  SVG, PNG, JPEG or GIF as a data URL, or the path of a library asset, fitted
  into the window without stretching; a GIF shows its first frame). The rack
  file's version and its published schema are unchanged: the key is optional
  and a reader that does not know it keeps it. `display.set` sets and clears
  one and refuses, with a sentence, a part that is no display and content the
  display cannot take; text that is cut and a picture that does not fill its
  window are said. The `displays` query lists which parts are displays and what
  each shows, and `inspect` of a device lists the same. `shell.setDisplays` and
  `viewer.setDisplays` draw the content in 2D and 3D: the lines or the picture
  sit flat in the display's window (3D: in the face's texture, so the relief
  and its batches are as they were) and the digits of a segment display are
  the state of each cell. Docs: `docs/display-content-design.md`.
- **The library marks the window and the kind of a display.** A `class:
  display` element takes `kind` (`pixel`, `character` or `segment`) and, for a
  character display, `rows`; the window is the element's own box. The build
  publishes them as `data-display-kind`, `data-display-rows` and
  `data-display-window` on the drawing's node and as `displays` in
  `components.json` and in each configuration of `configs.json`. L98 asks the
  kind to fit the numbers. Marked: the Eaton G4 eNMC LCD (`pixel`, 19 columns,
  the longest line seen) and the UfiSpace `seg7-status-2` digits, the status
  display of the S9700-53DX and the beacon digits of the S9705-48D (and the
  S9700-23D and S9600-72XC, which use the same part). A display whose kind or
  window no drawing or contract states stays unmarked and cannot be set.

### Changed
- `eaton/g4-enmc` is 1.1.0 and `ufispace/seg7-status-2` 1.4.0; the devices that
  compose them take a patch bump (`eaton/evma8365x`, `eaton/evmi2130x`,
  `ufispace/s9600-72xc`, `ufispace/s9700-23d`, `ufispace/s9700-53dx`,
  `ufispace/s9705-48d`).
