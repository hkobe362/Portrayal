### Added
- **A component contract can say `lid: true`.** A lid is a hinged or removable
  cover that opens over a duct; it is not a solid body. Lint L136 now allows a
  declared pass-through (`passes:`) under a lid and still refuses one under any
  other placed part, or off its face. The key is optional, changes nothing in
  the drawing, and a consumer that ignores it is unaffected.

### Fixed
- **The FS CMH-DFD1U declares its two middle pass-through holes.** Each is
  76.4 x 24.7 mm, at x 54.2 and 302.4 on both the front and the rear face, from
  the FS finger duct datasheet that covers the CMH-SFD1U as well. Its cover is
  marked as a lid (`fs/cmh-sfd1u-cover` 1.2.0, which the CMH-SFD1U shares), so
  `rack.json` carries the holes and the Rack Builder routes a front-duct to
  rear-duct crossing through them rather than round the end.
