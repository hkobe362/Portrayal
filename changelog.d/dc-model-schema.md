### Added
- **A `dc` block in the component contract, and a `dc` override on a device
  placement** (DC power, step 1). A part that takes or hands on direct current
  states its DC ports: each has a direction, a signed voltage, a rating, the
  AWG it takes, a side, and its poles, one per conductor, each with a role and
  the slot it lands on. A placement may override the side, the voltage, the
  rating and the role of a pole, because one part is feed A in one place and
  feed B in another. Both keys are optional and additive: `format` stays 1, and
  no part states either yet, so nothing in the library, the exports or the kit
  changes. The two published schemas change; the site republishes them when it
  next carries them.
- **`spec/schemas/dc.yaml`: the role vocabulary and the pairs a feed may join.**
  Six roles (`batt`, `rtn`, `pos`, `neg`, `gnd`, `unstated`) and the match
  table, each pair with its source: a role matches itself, and on an end whose
  voltage is negative `batt` matches `neg` and `rtn` matches `pos`. A pole with
  no sourced role is `unstated`, which no check calls crossed.
- **Lint L187 to L191.** A role is in the vocabulary and sourced (L187); a
  pole's slot resolves and a placement's `dc` names real ports and poles
  (L188); a port's poles are all slots or all connection points (L189); an
  `unstated` role has a `dc-polarity` gap on the device (L190); a voltage
  carries its sign (L191). L185 and L186 are reserved for the two-slot cards.
