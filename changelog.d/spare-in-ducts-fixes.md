### Fixed
- **Spare in a duct, as a tester found it through the Rack Builder preview.**
  `@portrayal/kit` is 0.39.0. `cable.slack` refuses an amount larger than the cable's spare (the others
  already stored count toward it) and any spare on a cable that is short, and
  says how much spare there is or how short the cable is. A duct's cable count
  is the cable's own kind: a fibre cable is not counted against a count of
  Cat6, and says so in a finding instead of taking the blame for what the
  Cat6 cables fill; a part whose maker states no count reads as it did. A
  count of one reads "1 cat6 cable's worth". A route summary names a window the
  route goes through ("through vcm-1 duct and vcm-1 pass-through-5"; `windowsOf`
  in `rack/route.js`), and names a part beside the rack by its label and, where
  another part shares the label, its id ("vcm-1 (z2)").
