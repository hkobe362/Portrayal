### Added
- **`common/rj45-ganged-eth-plain@1`: a ganged RJ-45 cell for an Ethernet jack
  whose housing has no lamps** (#1041). It is `std/rj45-ganged@2` with the
  Ethernet claim of `common/rj45-ganged-eth@1` (`media: rj45`) and none of its
  lamps, and its skin is the bare cell's own housing outline, so the drawing is
  the bare cell's. L76 accepts an Ethernet jack on it without asking for lamps
  and still sends one on the bare cell to a lamped member; the DCIM export types
  it as an interface (`1000base-t`, the family's default for an Ethernet cell: the
  module datasheets give a cable category, Cat.5, 6 or 6A, which the export does
  not use).
- **The Fibrain HD copper slot parts: the six-way RJ45 holders `fibrain/xmu00@1`
  (XMU00, unscreened) and `fibrain/xms00@1` (XMS00, screened), and twelve RJ45
  connection modules** - `fibrain/xe100@1`, `xe110@1`, `xe200@1` and `xe210@1`
  (Cat.5), `xq100@1`, `xq110@1`, `xq200@1` and `xq210@1` (Cat.6), `xr100@1`,
  `xr110@1`, `xr200@1` and `xr210@1` (Cat.6A). In each part number the first
  digit after the letters is 1 for unscreened and 2 for screened, and the last
  is 1 where the module is sold with a keystone adapter. A holder fills one HD
  slot and its six positions, `pos-1` to `pos-6`, are bays measured on the
  maker's front elevation (six windows on a 16.02 pitch); each takes any of
  the twelve modules, and each module carries one RJ45 jack,
  `common/rj45-ganged-eth-plain@1`, so a cable lands on it as a copper port at
  `slot-N/module/pos-M/module/jack` and the DCIM export lists it as an
  interface and not a console port. The two holders differ in the screening
  springs the screened one draws. XR300 and XR310 are cable-end plugs and are
  not modules. `fibrain/xpu` takes both holders in each of its eight slots
  (0.1.1 to 0.2.0) and gains the `copper-mixed` example build; the XCU10's
  drawer is unchanged, because the maker lists no copper for it.
