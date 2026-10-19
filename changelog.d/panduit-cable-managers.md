### Added
- Panduit cable managers (#1092, part of #1091), with `panduit` added to the vendor registry (listed
  directly before `accton`). The NetManager High Capacity horizontals `panduit/nm1`, `nm2`, `nmf1`,
  `nmf2`, `nmf3` and `nmf4` (1 to 4RU, twelve T-shaped fingers a wall and a `duct` guide; the
  front-and-rear NM1 and NM2 also have five open D-rings on the rear, each a `ring` guide); the
  NetManager `panduit/ncmh2` (front and rear) and `ncmhf2` (front only), with the 9.5 mm finger
  spacing and 34.925 mm pitch Panduit states; the PatchRunner 2 horizontals `panduit/pr2hf3wh` and
  `pr2hf4wh` (seven fingers a wall); the PatchRunner 2 verticals `panduit/pr2vsd06`, `pr2vd08` and
  `pr2vd10` (45RU, 45 fingers a side of each face, four 3.0 in holes, doors that ship fitted); and the
  NetRunner vertical `panduit/wmpvhc45e` (eight oval holes, four covers). Every part has its
  pass-through windows or holes declared open, and a cover or door that ships fitted and comes off in
  a `cover-off`, `doors-off`, `door-off` or `covers-off` configuration. Cable capacity is the figure
  Panduit's bulletin or calculator states for the part, with its basis; the horizontals are `rack`
  parts that fill their rack units, the verticals `rack-side`. The PR2VSD06 states no capacity because
  no Panduit document does. The NM3, NM4, NCMHF1 and the PatchLink, Open-Access and strain-relief
  parts are not modelled.
