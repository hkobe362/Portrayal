### Fixed
- **Lint rule L31's text names the bottom view too** (#991, `spec/tools/portrayal/lint.py`, `docs/lint-rules.md`): it read "a side or top view's region label" though the rule also checks a bottom view; it now reads "a side, top or bottom view's region label". The rule's logic is unchanged.
