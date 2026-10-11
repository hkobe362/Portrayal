### Added
- **`inspect`, `describe` and the export notes carry what the lay finds**
  (#1007, `kit/rack/`). `inspect` of a cable gains `route.bends`, each corner
  with less room than its bend radius and its sentence, and `route.covers`,
  the ports a span of it crosses in front of (#1013); each key is there only
  when there is something to say. The `Findings:` line of `describe` counts
  the cables with a tight bend and names the worst, and counts those in front
  of other ports and names the one that covers most, beside the bodies it
  already counted. `cableScheduleRows` takes `bends` and `covers` beside
  `bodies` and writes a sentence for each into a cable's notes, and the new
  `layNotes(rack, {bends, covers})` gives one line a cable for a BOM or a
  drawing. The columns are unchanged; a reader that parses `inspect`, the
  findings line or a notes cell sees more.
- `bendFindingsOf` and `coverFindingsOf`, the findings of one cable.

### Fixed
- **One bend finding a corner** (#1007). Two points of a path a fraction of a
  millimetre apart gave two findings at one place, with two angles; they are
  merged (`mergeCorners` in `rack/route-path.js`), so a page draws one ring
  and says one sentence.
