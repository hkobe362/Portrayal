# What a display shows

A rack file can say what a display in the rack shows. This note is the design:
what a display is in the library, how a rack entry says what it shows, and what
the kit does with it. Code: `kit/displays.js` (the rules and the painter),
`kit/rack/displays.js` (a display of a placed device), `display.set` in
`kit/rack/commands.js`, the `displays` query in `kit/rack/queries.js`.

## What a display is in the library

A display is an element of a contract with `class: display` that also says
which kind it is. Three facts are added to the element, all optional, and all
read from the drawing or the contract and not guessed:

| key | meaning |
|---|---|
| `kind` | `pixel`, `character` or `segment` |
| `characters` | already there: the columns of a character display; for a pixel display the longest line seen on it; `1` for a segment cell |
| `rows` | rows of a `character` display; one when absent; never on a pixel display, which has none |

The window is the element's own box (`at`, `size`), in the frame of its part.
The build puts `data-display-kind`, `data-display-rows` and `data-display-window` on the drawing's node
beside the `data-characters` it already had, and publishes `displays` for each
part in `components.json` and for each configuration in `configs.json`
(`{<part>: {<element>: {kind, characters, rows?, glyphs?, at, size}}}`).

**A display that does not say its kind is not listed and cannot be set.** The
kit never infers a window or a kind. Where the library is silent on a display
it stays silent:

- the Eaton G4 eNMC `lcd` is `pixel`: the drawing calls it a "MENU PIXEL LCD" and
  records `characters: 19`, the longest line seen. No row count is stated and none
  is recorded; a pixel display takes as many lines as its window is tall enough
  for at the font that fits 19 columns;
- the UfiSpace `seg7-status-2` digits (the status display of the NCP
  `s9700-53dx` and the beacon digits of the NCF `s9705-48d`) are `segment`:
  the vendor draws the two windows as `88`, a seven-segment cell. The part has no
  decimal point;
- left out, and why: the Cisco four-character LED matrix (the characters read
  turned, and no document says which way; the contract says so), the nrgSMART OLED
  (the contract records its width as estimated), the CommScope alphanumeric
  display (no row or column count is stated), the MaiaEdge touch screen (the
  contract draws the glass, not a window on it), and the other seven-segment
  parts (the Tripp Lite meters, the S9611 beacon, the small S9610 status), which
  can carry `kind: segment` the same way when someone adds it and bumps their
  devices.

## What a rack entry says

An item and a part beside the rack carry `displays`, a map of the path of the
display to its content, the shape `states` and `readings` already have:

```json
{"id": "pdu-1", "ref": "eaton/evma8365x", "displays": {
  "network-module/module/lcd": {"text": ["PDU-1 192.0.2.17", "OUTLET A 4.2 A"]}}}
```

Content is exactly one of:

| content | for | meaning |
|---|---|---|
| `{text: [lines]}` | `pixel`, `character` | each line in the display's monospace font, cut to its columns and its rows |
| `{digits: "04"}` | `segment` | a character per digit, `0`-`9`, `a`-`f`, a space for a blank, right-aligned; the glyphs are the states the cell declares |
| `{image: <data URL or library asset>}` | `pixel` | an SVG, PNG, JPEG or GIF of up to 512 KiB, fitted into the window |

The path of a pixel or character display is its element's path
(`network-module/module/lcd`: the module seated in the bay `network-module`).
The path of a segment display is its part's (`status-display`); its cells are
read from left to right.

**The rack file's published schema does not change.** `displays` is an
optional key that an item and a part beside the rack keep as written, as the
v4 reader keeps any key it does not know (`unknownOf`), so no version bump of
the rack file is needed, and a v4 reader that does not know it keeps it. The
schema (`spec/schemas/rack.schema.json`) is left as published: describing the
key there is a change to a published schema, which waits for a yes.

## What the kit checks

- **A part that is not a display is refused with a sentence**, naming the
  displays the device has (or saying it has none that say their kind).
- **Content the display cannot take is refused**: digits on a pixel display, an
  image on a character display, text on a segment cell, a digit the cell has no
  glyph for, an image that is not an SVG, PNG, JPEG or GIF, or over 512 KiB, or
  has no size.
- **Text is clipped and says so**: a line longer than the columns is cut, and
  lines past the rows are dropped. Digits past the cells are cut from the right.
  The sentence comes back as a note from `display.set` and from
  `displayNotices`.
- **An image is fitted, never stretched**: scaled to the largest size that
  keeps its proportions, centred, with bars where the window is not that shape
  (a note says so). A GIF is cut to its first frame before it is drawn, without
  being decoded: the blocks of the first frame are copied and the rest, and the
  loop extension, are dropped, so no viewer animates it. The image data is
  sniffed, not trusted from the type its URL declares.
- An image given as a library asset (a path in the build) is read by
  `loadDisplayImages` and handed on as a data URL, so 3D rasterises it and 2D
  draws it without a further fetch.

## How it is drawn

One painter, `paintDisplays`, for both halves, as `paintFields` is.

- **2D**: `shell.setDisplays(map)` paints the drawing the page shows.
- **3D**: `viewer.setDisplays(map)` holds the map in the relief scope
  (`setNodeDisplays`); every document a texture is painted from has it applied
  (`applyNodeDisplays`, in `restyleText` and at the start of `extractRelief`),
  so it is on the face's texture for that window. It adds a flat group beside
  the window's node and no mesh, so the relief and its batches are as they were,
  and a change repaints the textures that hold the path and never re-shapes.
- The text or picture goes in a group placed straight after the window's node,
  in the frame of its part, so a rolled or turned item turns it with the face.
  The digits of a segment display are set as the `state-<glyph>` class on each
  cell, which the drawing already has a rule for.

## The agent

- `display.set {id, path, content}` sets or (`content: null`) clears one.
- `displays(rack, ctx, {item})` lists every display of every device and part
  beside the rack that says its kind: `{item, path, kind, columns, rows,
  takes, text, shows}`. `inspect` of a device lists the same under `displays`.
- `rack/displays.js` has `displaysOf`, `displayRefusal`, `displaysFor` (the map
  to hand a drawing) and `displayNotices`.

## Not done

- A PDU's LCD showing its stored `readings` as text when no content is set. The
  readings are a `{current-a, power-w, energy-kwh}` per outlet or branch, and
  which of them the LCD of a G4 shows is not in any document the library holds;
  a made-up screen would look like the real one. A host can set `text` from the
  readings itself.
- Decimal points of a segment display. A cell's point is its own element and is
  not a digit.
- A character display. The library holds none that states its columns and rows,
  so the kind is in the schema, the checks and the tests and on no part yet.
