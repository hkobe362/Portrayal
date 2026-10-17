### Added
- `components.json` now lists a slot for the lone receptacle of a card that seats in another card's bay. The indexer reads a card's `bays:` mapping as it reads a device view's list, so these cards are bay-seated and not placed wrappers forwarding their one aperture. New slots, which a consumer of `components.json` will see:
  `commscope/cc3008@1` publishes its Micro-USB jack as slot `usb`, and
  `smartoptics/ppm-dcm-10@2`, `smartoptics/ppm-dcm-20@2`,
  `smartoptics/ppm-dcm-40@2` and `smartoptics/ppm-dcm-80@2` each publish their
  LC duplex adapter as slot `dcm`. Nothing is removed from the export (#796).
