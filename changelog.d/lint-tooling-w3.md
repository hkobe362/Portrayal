### Fixed
- Lint L45 (a face that declares a size and nothing else) no longer warns on a
  face whose view carries an `empty:` sentence, which is the answer its own
  message asks for. A gap whose `scope` names the face still clears it too,
  and an empty face still does not count as drawn for the capability level.
  The 58 baseline entries on such faces are gone.
- `preflight.py` passes its `changelog` check on a release diff: fragments
  deleted, their entries folded under a new `## <version>` heading, and
  `## Unreleased` left empty. It still fails a branch that changes `library/`,
  `spec/` or `kit/` and neither adds a fragment nor is such a diff.
