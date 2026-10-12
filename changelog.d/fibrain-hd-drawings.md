### Added
- `fibrain/xpu`: the Fibrain HD 1U eight-slot frame, XPU00 (without grounding)
  and XPS00 (with grounding), as two orderable configurations of one device
  (#1040). The front is measured on the maker's 1:1 front elevation: 484.60 x
  43.96 with its ears, five guide posts on a 107.00 pitch, eight slots in two
  rows, each taking any Fibrain HD holder or the blind cover. It is an open
  sheet body: the ears, posts, floor, top sheet, sides, rear cable bar and
  cross-member are parts (`fibrain/xpu-ear@1`, `xpu-guide-post@1`,
  `xpu-floor@1`, `xpu-top-sheet@1`, `xpu-side@1`, `xpu-cable-bar@1`,
  `xpu-cross-member@1`), and a seated holder shows its back through the open
  rear. The cross-member's `finish` is copper on XPS00. Slots are numbered 1
  to 4 along the upper row and 5 to 8 along the lower, which is proposed and
  not the maker's. New DCIM device types `XPU00` and `XPS00`, eight module
  bays each.
- `fibrain/lc-duplex-adapter@1`: Fibrain's own LC duplex adapter, 12.70 x 9.30
  with its bores side by side, off the same drawings. It ships holding
  `common/lc-duplex-dust-cap@2`, as the adapter it replaces in the holders
  did.

### Changed
- **BREAKING for a manifest that names the old majors.** The twenty Fibrain
  HD holders and their twenty rear faces are `@2`, redrawn from the maker's
  front elevations (#1039): `fibrain/xmi1021ca`, `-da`, `-ga`, `-ha`,
  `xmi1031ga`, `xmi1041ca`, `-da`, `-ga`, `-ha`, `xmi1051ga`, `xmn1021cb`,
  `-db`, `-gb`, `-hb`, `xmn1031gb`, `xmn1041cb`, `-db`, `-gb`, `-hb`,
  `xmn1051gb`, and each `-rear`. The adapter columns stand on a 16.10 pitch
  where they stood on 15.87, so each port is up to 0.58 mm from where it was;
  a 6-way holder carries its row at mid height, 4.7 mm above where `@1` had
  it; the LC holders compose `fibrain/lc-duplex-adapter@1` where `@1` composed
  `common/lc-duplex-v-adapter@6` on its side, so what fills `lc01` is another
  part and its bores are 0.24 mm from where they were. Port ids, fibre
  positions and DCIM port names are unchanged.
- `fibrain/xcu` 0.3.0 and `fibrain/xcu-drawer` 1.2.0 accept and seat the `@2`
  holders. The XCU10's own geometry is unchanged and stays estimated; its
  provenance records that the 1U frame of the same family is drawn 484.60
  over its ears.
- **BREAKING for Nautobot data already imported.** The twenty holders' Nautobot
  module types name their ports `{module}/...` where they named them
  `{module.parent}/{module}/...`. A holder now also seats directly in a bay
  of a device, the 1U frame, and a module seated at more than one depth is
  written at depth one. NetBox's names are unchanged.

### Removed
- `fibrain/xm*@1`, the forty retired majors above; each is replaced by its
  `@2`.

### Fixed
- The 3D view of a sheet body builds nothing in a hole a bay's occupant is
  seen through from behind, or in an open bay's mouth; it drew a painted
  plane across every such slot. No device had both until `fibrain/xpu`.
