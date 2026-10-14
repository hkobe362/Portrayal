### Added
- **A cable's spare can be stored in a finger duct its route uses**, as a
  service loop. `@portrayal/kit` is 0.35.0. `cable.slack` takes `{item, via}`
  for the duct of a horizontal manager, of a rack-face bracket such as the
  CMV-5U3W, or of a vertical manager beside the rack such as the
  CMV-SFD42U9W, as well as a tray it rests on and an end. Which pathways hold
  spare is one table, `SPARE_HOLDS` in `rack/slack.js`: a duct and a tray do,
  a ring and a pass-through do not. A ring, a lacer bar, a pass-through, a
  pathway off the route and a name the part does not have are refused, and
  the refusal says where the spare can go. A duct whose part states a cable
  capacity counts the loop against it (`spareLoad`) and refuses past it; one
  that states none accepts it with a finding. `spareMarks` gives the point a
  drawing puts each stored loop at. `inspect` lists the places a cable's
  spare can go (`spare_places`), each stored duct's load, and each part's
  pathways with which hold spare; `describe` names the spare stored on each
  cable's line.
- **A route can name a part beside the rack**: its duct, read as the lane run
  through it, and a window such as `pass-through-2`. The route summary says
  when a lane run goes through a duct. A pathway may be named as the summary
  says it ("ring 3", "left end ring") and by a common duct name ("duct" and
  "front-duct", "duct-rear" and "rear-duct"); it is stored by its id, and no
  id is renamed.
