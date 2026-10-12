### Added
- **A power cord can be addressed to a NEMA outlet and to an Eaton C39**
  (#1045, `docs/connectors-power-design.md` section 9). Three connector
  interfaces are registered in `spec/schemas/connectors.yaml`: `nema-5-15r`,
  `nema-5-20r` and `eaton-c39`. `std/nema-5-20r@1` (1.1.0) presents
  `nema-5-20r` and `eaton/c39-outlet@1` (1.1.0) presents `eaton-c39`, each
  with a `mate` point, so every outlet of a PDU that places one is now a
  connector slot in the `cages` of its `configs.json`. Nothing drawn moves:
  each face rasterises to the same pixels. No part presents `nema-5-15r`
  yet.
- **Two cord ends: `generic/nema-5-15p-cord@1` and
  `generic/nema-5-20p-cord@1`**, moulded straight NEMA plugs on their cord,
  drawn from the cable end as the IEC cord ends are, with a `cable` point and
  the `cable-od` and `jacket-color` fields. The 5-15P mates `nema-5-15r` and
  `nema-5-20r`; the 5-20P mates `nema-5-20r`. Each states `attrs.rating-a`
  (15 and 20). Bodies from the Volex Power Products catalogue, Aug-2025
  (PS204 and PS520). `generic/nema-5-20p-plug@1`, the face-on input plug of a
  PDU, is a different part and is unchanged.
- **`mates` on a component is one interface or a list of them**
  (`spec/schemas/component.schema.json`). A part that seats in more than one
  kind of receptacle names each, and a slot presenting any of them offers it.
  A contract that states one interface is read and published as before. In
  `components.json` the `mates` of an entry is a string or a list of strings,
  and a consumer that compares it with an interface must take both; the same
  holds for `mates` in `configs[].mount-points`, though no mount part lists
  two today. `kit/rack/zero-u.js` reads both.

### Changed
- `generic/c14-plug@1` and `generic/c20-plug@1` are 1.1.0: each also mates
  `eaton-c39`, so `mates` on both is now a list (`[iec-c13, eaton-c39]` and
  `[iec-c19, eaton-c39]`). The Eaton Rack PDU G4 guide says the C39 takes
  both plugs.
- `std/c13-outlet@1` and `std/c19-outlet@1` are 1.1.0, and with the two
  outlets above now state `attrs.media: ac`. `attrs.outlet` says which way
  power runs and did not say AC, so a reader could not tell an AC outlet
  from a DC terminal. Each placed outlet gains `data-media="ac"` on its
  drawing.
- Eaton PDUMH20NET 0.2.0, EVMI2130X 0.3.0, EVMA8365X 0.2.0 and
  PDUMV20HVNETLX 0.2.0, for the parts above. Their DCIM exports change in
  the drawing version line and nowhere else: the same power outlets, by the
  same names, of the same types.
