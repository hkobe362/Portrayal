### Fixed
- Lint L45 (a face that declares a size and nothing else) no longer warns on a
  face whose view carries an `empty:` sentence, which is the answer its own
  message asks for. A gap whose `scope` names the face still clears it too,
  and an empty face still does not count as drawn for the capability level.
  The 58 baseline entries on such faces are gone.
