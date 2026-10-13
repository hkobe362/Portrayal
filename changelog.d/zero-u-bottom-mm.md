### Fixed
- **A zero-U part is drawn where it fits.** Fit judged a part hung at an offset
  that is no whole unit in millimetres, while its solid, and so the routes that
  go round it, stood at the nearest unit. `zeroUBottomMm` in `rack/model` is
  now the one owner of the bottom, the solid reads it, and the lane tests (`zeroUTouched`) read the units its millimetres touch. A part the kit placed
  by its unit does not move; a part hung on brackets moves up to half a unit,
  to the offset the file states (#1030).
