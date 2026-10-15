### Fixed
- **The FS FHD RJ45 module's jacks have a rear, and a cable end on a missing
  side is refused when it is added** (P-0045). `@portrayal/kit` is 0.46.0.
  `fs/fhd-fapm6-rj45@1` gains a rear face, `fs/fhd-fapm6-rj45-rear@1`: each jack
  `p1` to `p6` has the punch-down (IDC) back of a keystone jack, the new
  `common/idc-termination@1`, as `b1` to `b6` on the rear (lint L112 does not
  let a rear id repeat a front id), so a cable on `b1` of the rear and one on
  `p1` of the front are the two ends of one pass through the panel. The
  rear rests on FS's Cat6 punchdown keystone jack datasheet; that #72818 is
  that jack is estimated, as the contract says. `cable.add` and `cable.update`
  (and so a dry run, which runs the same code) refuse an end under a bay on a
  port or panel the seated part does not have, with the sentence the loose-end
  finding gives, instead of laying a cable the page then flags; so does a
  made-up port of a passive panel (class `adapter-panel`). `freePorts` lists the
  jacks' rear ends from the reader of the rear panel, as it does a FAP18's. A part with a long
  description is named by its model (`FHD-FAPM6-RJ45`) and not its library ref.
  The site needs a re-vendor of the kit; a cable editor that checks an end
  before it calls the kit can stay as it is.
