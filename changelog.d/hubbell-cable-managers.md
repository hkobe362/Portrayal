### Added
- **Hubbell Premise Wiring horizontal cable managers** (#1101, part of #1091, vendor
  `hubbell`): the M-Series HM14C (1 RU), HM24C (2 RU), HM34C (3 RU) and HM144C (1 RU,
  4 in front and 4 in rear extension), the S-Series HS23C (2 RU, steel fingers) and the
  SD-Series HSD13 (1 RU, plastic fingers), each from the maker's own spec sheet. An M-Series
  part is a centre plate with four windows and five wire rings (`ring` guides) on each side;
  the HS23C and HSD13 are finger ducts (`duct` guide with the finger pitch and gap). The
  plate's windows are declared pass-throughs, the cover of each part is a removable lid, and
  a `cover-off` configuration shows the rings or fingers it hides. The HSD13's fingers are
  parts of their own, so each can be taken out. No part states a cable capacity: no sheet
  does. The rear extension of the HM14C, HM24C and HM34C, which the sheets' figure marks and
  no table gives, is estimated at the 4 in the HM144C states.
- **Hubbell components under `hubbell/`**: the centre plate, wire ring and replacement cover
  of each M-Series height (`hm-plate-1u`, `hm-ring-1u`, `hm1c`, and the 2u and 3u),
  the HS23C's plate, floor, finger, tab and cover (`hs2c`), and the HSD13's base, finger,
  end block and cover.
