### Fixed
- **The Fibrain XCU10's adapters are couplers with a cable end on each face,
  and its body is open behind them** (P-0047). `@portrayal/kit` is 0.48.0. A
  holder seated in the drawer's slot (`drawer/module/slot-1/module/…`) was
  unknown to the kit: an end on it was neither accepted nor refused, and the
  far end of an adapter on the panel into the rack was a loose end. `seatedPort`
  now answers for it and shows its back on the other panel, so a cable on `sc01`
  (the face toward the aisle) and one on `b01` (view `rear`, the face into the
  rack) are the two ends of one pass through the panel. `cable.add` and
  `cable.update` refuse a port a passive panel does not have, with the
  loose-end finding's sentence, and `freePorts` lists the far ends of a panel
  in a drawer. `fibrain/xcu` gains a sheet body (`shell: sheet`), a top, floor
  and two sides, so its solids are plates and not a block to 284 mm; the
  rear of the shell is open, which is estimated. The rear faces of the
  holders cite Fibrain's XM, XCU and SCM-A datasheets. The site needs a
  re-vendor of the kit; a cable editor that checks an end before it calls the
  kit can stay as it is.
