### Added
- `fibrain/xpu`: the Fibrain HD 1U eight-slot frame, XPU00 (without grounding)
  and XPS00 (with grounding), as two orderable configurations of one device
  (#1040). The front is measured on the maker's 1:1 front elevation: 484.60 x
  43.96 with its ears, five guide posts on a 107.00 pitch, eight slots in two
  rows, each taking any Fibrain HD holder or the blind cover. It is an open
  sheet body: the ears, posts, floor, top sheet, sides and rear cable bar are
  parts (`fibrain/xpu-ear@1`, `xpu-guide-post@1`, `xpu-floor@1`,
  `xpu-top-sheet@1`, `xpu-side@1`, `xpu-cable-bar@1`), and a seated holder
  shows its back through the open rear. XPS00 also carries
  `fibrain/xpu-grounding-bar@1`, a copper-coloured mark on the plan that is
  not built in 3D. Slots are numbered 1 to 4 along the upper row and 5 to 8
  along the lower, which is proposed and not the maker's. New DCIM device
  types `XPU00` and `XPS00`, eight module bays each.
- `fibrain/lc-duplex-adapter@1`: Fibrain's own LC duplex adapter, 12.70 x 9.30
  with its bores side by side, off the same drawings. It ships holding
  `common/lc-duplex-dust-cap@2`, as the adapter it replaces in the holders
  did.

### Changed
- **BREAKING for a manifest or a saved rack that names the old majors.** The
  twenty Fibrain HD holders and their twenty rear faces are `@2`, redrawn from
  the maker's front elevations (#1039): `fibrain/xmi1021ca`, `-da`, `-ga`,
  `-ha`, `xmi1031ga`, `xmi1041ca`, `-da`, `-ga`, `-ha`, `xmi1051ga`,
  `xmn1021cb`, `-db`, `-gb`, `-hb`, `xmn1031gb`, `xmn1041cb`, `-db`, `-gb`,
  `-hb`, `xmn1051gb`, and each `-rear`. The adapter columns stand on a 16.10
  pitch where they stood on 15.87, so each port is up to 0.58 mm from where it
  was; a 6-way holder carries its row at mid height, 4.7 mm above where `@1`
  had it; the LC holders compose `fibrain/lc-duplex-adapter@1` where `@1`
  composed `common/lc-duplex-v-adapter@6` on its side. Part ids, fibre
  positions, port paths and DCIM port names are unchanged.
- **A saved rack that seats a Fibrain holder at `@1` must be edited by hand.**
  The `@1` holders are removed and the slots of the XCU10's drawer accept
  only `@2`. A rack file that names, say, `fibrain/xmn1021gb@1` in a drawer
  slot still loads, and a plain load and save keeps the entry as written. But
  the slot no longer accepts it, so the entry is ignored: the blind cover
  `fibrain/xbcs0@1` is drawn in the holder's place with no ports, cables on
  the holder's ports go loose, a DCIM export names the cover, and a page that
  writes back only accepted entries drops the `@1` entry when the rack is
  edited. To fix a rack, replace `@1` with `@2` in the ref of every Fibrain
  holder in the file, for example `fibrain/xmn1021gb@1` to
  `fibrain/xmn1021gb@2`; nothing else about the entry changes, and the
  ports, their paths and their names come back as they were. Do it before
  editing the rack in a page.
- `fibrain/xcu` 0.3.0 and `fibrain/xcu-drawer` 1.2.0 accept and seat the `@2`
  holders, and no longer accept the `@1` ones. The XCU10's own geometry is
  unchanged and stays estimated; its provenance records that the 1U frame of
  the same family is drawn 484.60 over its ears.
- **BREAKING for Nautobot data already imported.** The twenty holders' Nautobot
  module types name their ports `{module}/...` where they named them
  `{module.parent}/{module}/...`. A holder now also seats directly in a bay
  of a device, the 1U frame, and one module type has to serve both seats. So
  that the names a holder installs under do not change, the Nautobot module
  type of the XCU10 drawer, `XCU10`, gives its four module bays the positions
  `drawer/slot-1` to `drawer/slot-4` where they were `slot-1` to `slot-4`: a
  holder in the drawer still installs as `drawer/slot-1/B01-1`, and one in
  the 1U frame as `slot-1/B01-1`. A holder type and a drawer type have to be
  re-imported together, and the drawer type's comments say so. NetBox's names
  and bays are unchanged.
- The Nautobot export gives a carrier's bays their carrier's own position in
  front of theirs when the carrier only ever sits in one bay id (#1040), where
  such a bay was withheld if it accepted a module that also seats directly in
  a chassis bay. Besides the XCU10 drawer this reaches one part: the Dell
  `riser-2s-16g` module type gains its bays `e3s-0` and `e3s-1`, at
  `riser-2/e3s-0` and `riser-2/e3s-1`, so a drive carrier can be installed in
  the R660's riser 2S on Nautobot under NetBox's names.

### Removed
- `fibrain/xm*@1`, the forty retired majors above; each is replaced by its
  `@2`, and nothing redirects the old ref.

### Fixed
- The 3D view of a sheet body builds nothing in a hole a bay's occupant is
  seen through from behind, or in an open bay's mouth; it drew a painted
  plane across every such slot. No device had both until `fibrain/xpu`. The
  fix is in the repository's kit and reaches a consumer of the published
  `@portrayal/kit` with its next version.
